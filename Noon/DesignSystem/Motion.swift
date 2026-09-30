import SwiftUI

/// Motion tokens. Everything is a critically damped spring (Apple: damping 1.0) so any
/// transition can be interrupted and re-targeted mid-flight. Bounce is reserved for celebration.
enum Motion {
    static let press = Animation.spring(duration: 0.2, bounce: 0)
    static let quick = Animation.spring(duration: 0.25, bounce: 0)
    static let snappy = Animation.spring(duration: 0.35, bounce: 0)
    static let smooth = Animation.spring(duration: 0.5, bounce: 0)
    static let slow = Animation.spring(duration: 0.7, bounce: 0)
    static let celebrate = Animation.spring(duration: 0.5, bounce: 0.25)
    /// Colour and border changes: fast, never springy.
    static let tint = Animation.easeOut(duration: 0.15)
}

enum NavDirection: Equatable {
    case forward, backward
}

/// One modifier that covers every enter/exit recipe in the app: opacity, blur, scale and offset.
struct Materialize: ViewModifier {
    var opacity: Double = 1
    var blur: CGFloat = 0
    var scale: CGFloat = 1
    var x: CGFloat = 0
    var y: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .opacity(opacity)
            .blur(radius: blur)
            .scaleEffect(scale)
            .offset(x: x, y: y)
    }
}

extension AnyTransition {
    /// Contextual icon swap: scale 0.25 → 1, opacity 0 → 1, blur 4 → 0.
    static var iconSwap: AnyTransition {
        .modifier(active: Materialize(opacity: 0, blur: 4, scale: 0.25), identity: Materialize())
    }

    /// Small supporting content rising into place. Exits are softer than entrances.
    static var softRise: AnyTransition {
        .asymmetric(
            insertion: .modifier(active: Materialize(opacity: 0, blur: 4, y: 8), identity: Materialize()),
            removal: .modifier(active: Materialize(opacity: 0, blur: 2, y: -4), identity: Materialize())
        )
    }

    /// Step content moving along the flow's spatial axis. Forward enters from the trailing edge,
    /// back returns the way it came.
    static func step(_ direction: NavDirection, rtl: Bool, reduceMotion: Bool) -> AnyTransition {
        if reduceMotion { return .opacity }
        let sign: CGFloat = (direction == .forward ? 1 : -1) * (rtl ? -1 : 1)
        return .asymmetric(
            insertion: .modifier(active: Materialize(opacity: 0, blur: 6, x: 36 * sign), identity: Materialize()),
            removal: .modifier(active: Materialize(opacity: 0, blur: 6, x: -28 * sign), identity: Materialize())
        )
    }
}
