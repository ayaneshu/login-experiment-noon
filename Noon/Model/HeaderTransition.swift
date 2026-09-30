import Foundation

/// How the sign-in header changes colour for success and error. Chosen in the prototype controls.
enum HeaderTransitionStyle: String, CaseIterable, Codable, Identifiable {
    /// The original: a soft circle of the new colour grows from the cause, holds, then fades.
    case smooth
    /// A ring of lit pixels travels out from the cause; the colour settles in behind it.
    case ripple
    /// Pixels flip one by one, loosely spreading outward, each with a quick flash.
    case dissolve
    /// Halftone dots grow on a diamond front until they merge into solid colour.
    case bloom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .smooth: "Classic"
        case .ripple: "Ripple"
        case .dissolve: "Dissolve"
        case .bloom: "Bloom"
        }
    }

    var summary: String {
        switch self {
        case .smooth: "The current wash: a soft circle grows from the field, holds, then fades."
        case .ripple: "A ring of lit pixels radiates out; the colour settles in behind it and the grid fades."
        case .dissolve: "Pixels flip in a loose outward scatter, each with a quick flash."
        case .bloom: "Halftone dots grow on a diamond front and merge into solid colour."
        }
    }

    var usesPixels: Bool { self != .smooth }
}

/// The knobs for one pixel style. Every value is in points or seconds, except the 0–1 ones.
struct PixelWashParams: Codable, Equatable {
    /// Size of one pixel cell.
    var cell: Double
    /// Space between cells while the grid shows.
    var gap: Double
    /// Seconds for the front to cross the header.
    var spread: Double
    /// Seconds the new colour holds before it recedes.
    var hold: Double
    /// Seconds for the colour to sweep back out.
    var recede: Double
    /// Width of the transition zone behind the front (0–1 of the header's reach).
    var band: Double
    /// How far the order strays from a clean ring (0 = clean, 1 = pure noise).
    var scatter: Double
    /// How brightly pixels flash as the front passes.
    var glow: Double
    /// How long the grid lines linger over the new colour before it goes solid.
    var grid: Double

    static func defaults(for style: HeaderTransitionStyle) -> PixelWashParams {
        switch style {
        case .smooth, .ripple:
            PixelWashParams(cell: 12, gap: 1.5, spread: 0.8, hold: 1.0, recede: 0.9, band: 0.28, scatter: 0.12, glow: 0.55, grid: 0.6)
        case .dissolve:
            PixelWashParams(cell: 10, gap: 1, spread: 0.9, hold: 1.0, recede: 0.9, band: 0.22, scatter: 0.6, glow: 0.7, grid: 0.35)
        case .bloom:
            PixelWashParams(cell: 14, gap: 0, spread: 0.85, hold: 1.0, recede: 0.9, band: 0.4, scatter: 0.08, glow: 0.3, grid: 0.5)
        }
    }
}

/// Everything the prototype controls can change about the header's colour reactions.
struct HeaderTransitionSettings: Codable, Equatable {
    var style: HeaderTransitionStyle = .ripple
    var ripple = PixelWashParams.defaults(for: .ripple)
    var dissolve = PixelWashParams.defaults(for: .dissolve)
    var bloom = PixelWashParams.defaults(for: .bloom)
    /// Also use the pixel style for the yellow new-customer wash.
    var includeWelcome = false

    /// The parameters of the selected pixel style (Classic has none of its own).
    var params: PixelWashParams {
        get { self[style] }
        set { self[style] = newValue }
    }

    subscript(style: HeaderTransitionStyle) -> PixelWashParams {
        get {
            switch style {
            case .smooth, .ripple: ripple
            case .dissolve: dissolve
            case .bloom: bloom
            }
        }
        set {
            switch style {
            case .smooth: break
            case .ripple: ripple = newValue
            case .dissolve: dissolve = newValue
            case .bloom: bloom = newValue
            }
        }
    }

    /// The style to use for a reaction of this kind.
    func style(for kind: AuthFlow.HeaderEvent.Kind) -> HeaderTransitionStyle {
        kind == .welcome && !includeWelcome ? .smooth : style
    }

    mutating func resetSelected() {
        guard style.usesPixels else { return }
        self[style] = .defaults(for: style)
    }
}
