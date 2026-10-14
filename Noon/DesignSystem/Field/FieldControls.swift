import SwiftUI

/// Colours from the Log in / Sign up file that @field-ds/tokens doesn't carry yet.
enum NoonBrand {
    /// Figma blue/800 → blue/1000: the signed-out header.
    static let headerBlueTop = Color(fieldHex: 0x1155CB)
    static let headerBlueBottom = Color(fieldHex: 0x002888)
    static let navIndicator = Color(fieldHex: 0x1155CB)
    static let noonOneCream = Color(fieldHex: 0xFEF8EC)
}

/// The colour moods of the sign-in header.
enum HeaderTone: Equatable {
    case blue, success, error, welcome

    var top: Color {
        switch self {
        case .blue: NoonBrand.headerBlueTop
        case .success: FieldColour.Surface.successBold
        case .error: FieldColour.Surface.errorBold
        case .welcome: FieldColour.Surface.brandPrimary
        }
    }

    var bottom: Color {
        switch self {
        case .blue: NoonBrand.headerBlueBottom
        case .success: FieldColour.Surface.successExtrabold
        case .error: FieldColour.Surface.errorExtrabold
        case .welcome: FieldColour.Surface.yellowBold
        }
    }

    /// Yellow needs dark glyphs; every other tone takes white.
    var isLight: Bool { self == .welcome }

    /// Figma: the tone holds to 16.6% of the screen, then deepens until halfway down.
    var gradient: LinearGradient {
        LinearGradient(
            stops: [.init(color: top, location: 0.166), .init(color: bottom, location: 0.5)],
            startPoint: .top, endPoint: .bottom
        )
    }

    init(_ kind: AuthFlow.HeaderEvent.Kind) {
        switch kind {
        case .success: self = .success
        case .error: self = .error
        case .welcome: self = .welcome
        }
    }
}

// MARK: - Header controls

/// Language Toggle-Switch: a white handle slides to the chosen language before the screen
/// re-renders in it.
struct LanguageToggle: View {
    let current: Lang
    var onLight = false
    var action: () -> Void

    @State private var shown: Lang
    @Namespace private var handle
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(current: Lang, onLight: Bool = false, action: @escaping () -> Void) {
        self.current = current
        self.onLight = onLight
        self.action = action
        _shown = State(initialValue: current)
    }

    var body: some View {
        Button {
            withAnimation(reduceMotion ? nil : FieldMotion.Spring.snappy) {
                shown = shown == .en ? .ar : .en
            }
            Task {
                try? await Task.sleep(for: .milliseconds(reduceMotion ? 0 : 200))
                action()
            }
        } label: {
            HStack(spacing: 0) {
                segment(.en, "English", selected: .a12SemiBold, idle: FieldTextStyle(fontName: "Noontree-Medium", size: 12, lineHeight: 16, letterSpacing: 0))
                segment(.ar, "العربية", selected: FieldTextStyle(fontName: "Noontree-SemiBold", size: 14, lineHeight: 16, letterSpacing: 0), idle: FieldTextStyle(fontName: "Noontree-Medium", size: 14, lineHeight: 16, letterSpacing: 0))
            }
            .padding(FieldSpace.s4)
            .background(Capsule().fill(FieldColour.Surface.overlaySubtle))
            .environment(\.layoutDirection, .leftToRight)
        }
        .buttonStyle(FieldPressStyle())
        .accessibilityLabel(current == .en ? "التبديل إلى العربية" : "Switch to English")
        .accessibilityValue(current == .en ? "English" : "العربية")
    }

    private func segment(_ lang: Lang, _ title: String, selected: FieldTextStyle, idle: FieldTextStyle) -> some View {
        let isOn = shown == lang
        return Text(title)
            .font((isOn ? selected : idle).font)
            .foregroundStyle(isOn ? handleText : idleText)
            .padding(.horizontal, FieldSpace.s10)
            .frame(height: 30.scaled)
            .background {
                if isOn {
                    RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
                        .fill(handleFill)
                        .matchedGeometryEffect(id: "handle", in: handle)
                }
            }
    }

    private var handleFill: Color { FieldColour.Surface.primary }
    private var handleText: Color { FieldColour.TextNIcon.primary }

    private var idleText: Color {
        onLight ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.onSurfaceBold
    }
}

/// UAE flag drawn from the Figma asset; other markets use the system flag.
struct CountryFlag: View {
    let country: Country
    var width: CGFloat = 24
    var height: CGFloat = 18

    var body: some View {
        Group {
            if country.id == "AE" {
                Image(FieldArt.flagAE)
                    .resizable()
                    .frame(width: width.scaled, height: height.scaled)
                    .clipShape(RoundedRectangle(cornerRadius: 2.scaled, style: .continuous))
            } else {
                Text(country.flag)
                    .font(.system(size: (height + 2).scaled))
                    .frame(width: width.scaled, height: height.scaled)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Market pill: flag and country code ("AE") on the translucent header chip.
struct MarketPill: View {
    let market: Country
    var foreground: Color
    var onSelect: (Country) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        Menu {
            ForEach(Country.suggested) { country in
                Button {
                    onSelect(country)
                } label: {
                    if country == market {
                        Label("\(country.flag)  \(country.name(lang))", systemImage: "checkmark")
                    } else {
                        Text("\(country.flag)  \(country.name(lang))")
                    }
                }
            }
        } label: {
            HStack(spacing: FieldSpace.s6) {
                CountryFlag(country: market)
                Text(market.id)
                    .fieldText(.b13SemiBold)
                    .fixedSize()
            }
            .foregroundStyle(foreground)
            .padding(.leading, FieldSpace.s12)
            .padding(.trailing, FieldSpace.s8)
            .frame(height: 38.scaled)
            .background(Capsule().fill(FieldColour.Surface.overlaySubtle))
            .contentShape(Capsule())
        }
        .accessibilityLabel(lang.t("Shopping in \(market.name)", "التسوّق في \(market.nameAR)"))
    }
}

/// M-IconButton (Ghost, H40) on the header: a white cross on the translucent circle. Closes sign-in
/// when it was opened from checkout or a link.
struct HeaderCloseButton: View {
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            FieldIcon(.cross, size: 20)
                .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                .frame(width: 40.scaled, height: 40.scaled)
                .background(Circle().fill(FieldColour.Surface.overlaySubtle))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.94))
        .accessibilityLabel(label)
    }
}

/// Round translucent header button, used for Back.
struct HeaderCircleButton: View {
    let icon: FieldIconName
    var foreground: Color
    var label: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            FieldIcon(icon, size: 20)
                .flipsForRightToLeftLayoutDirection(true)
                .foregroundStyle(foreground)
                .frame(width: 38.scaled, height: 38.scaled)
                .background(Circle().fill(FieldColour.Surface.overlaySubtle))
                .frame(width: max(44, 38.scaled), height: max(44, 38.scaled))
                .contentShape(Circle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.94))
        .accessibilityLabel(label)
    }
}

// MARK: - Avatar

struct FieldAvatar: View {
    enum Style { case action, neutral }

    let initial: String?
    var size: CGFloat = 40
    var style: Style = .action

    var body: some View {
        Circle()
            .fill(style == .action ? FieldColour.Surface.actionSubtle : FieldColour.Surface.tertiary)
            .overlay {
                if let initial {
                    Text(initial)
                        .font((size >= 48 ? FieldTextStyle.h24Bold : FieldTextStyle.b14SemiBold).font)
                        .foregroundStyle(style == .action ? FieldColour.TextNIcon.action : FieldColour.TextNIcon.primary)
                } else {
                    FieldIcon(.navProfile, size: size * 0.5)
                        .foregroundStyle(style == .action ? FieldColour.TextNIcon.action : FieldColour.TextNIcon.tertiary)
                }
            }
            .frame(width: size.scaled, height: size.scaled)
            .accessibilityHidden(true)
    }
}

// MARK: - Inputs

/// M-InputText chrome: 56pt, radius 12, a 1pt extrabold border, and a soft 2pt ring while focused.
struct FieldInputChrome: ViewModifier {
    var focused: Bool
    var error = false
    /// Verified (separate flow): a green border, a soft ring and a white-to-grey fill.
    var success = false
    /// Separate flow: typing keeps the light border (only error and verified recolour it).
    var quietFocus = false

    /// Figma field states: at rest white with a light border; focused or typing, the secondary
    /// surface with a dark border; in error, the secondary surface with a red border.
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous)
        let active = focused || error
        content
            .frame(height: 56.scaled)
            .background {
                if success {
                    shape.fill(LinearGradient(colors: [FieldColour.Surface.primary, FieldColour.Surface.secondary], startPoint: .top, endPoint: .bottom))
                } else {
                    shape.fill(active ? FieldColour.Surface.secondary : FieldColour.Surface.primary)
                }
            }
            .overlay {
                shape.strokeBorder(borderColour, lineWidth: 1)
            }
            .background {
                // The soft outer ring on verified and error fields.
                if success || error {
                    shape.inset(by: -2).strokeBorder(FieldColour.Surface.muted, lineWidth: 2)
                }
            }
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.sm), value: focused)
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.sm), value: error)
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.sm), value: success)
    }

    private var borderColour: Color {
        if error { return FieldColour.Surface.errorBold }
        if success { return FieldColour.Border.successBold }
        return focused && !quietFocus ? FieldColour.Border.extrabold : FieldColour.Border.primary
    }
}

extension View {
    func fieldInputChrome(focused: Bool, error: Bool = false, success: Bool = false, quietFocus: Bool = false) -> some View {
        modifier(FieldInputChrome(focused: focused, error: error, success: success, quietFocus: quietFocus))
    }

    /// A short, decaying side-to-side shake: "that didn't work".
    func shake(_ trigger: Int) -> some View {
        modifier(Shake(trigger: trigger))
    }
}

private struct Shake: ViewModifier {
    let trigger: Int

    func body(content: Content) -> some View {
        content.keyframeAnimator(initialValue: CGFloat.zero, trigger: trigger) { view, x in
            view.offset(x: x)
        } keyframes: { _ in
            KeyframeTrack {
                CubicKeyframe(-10, duration: 0.07)
                CubicKeyframe(8, duration: 0.08)
                CubicKeyframe(-5, duration: 0.08)
                CubicKeyframe(3, duration: 0.08)
                CubicKeyframe(0, duration: 0.08)
            }
        }
    }
}

/// Blinking insertion caret in the action colour.
struct FieldCaret: View {
    var height: CGFloat = 20
    @State private var visible = true

    var body: some View {
        Capsule()
            .fill(FieldColour.Surface.actionBold)
            .frame(width: 2, height: height.scaled)
            .opacity(visible ? 1 : 0)
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .milliseconds(530))
                    withAnimation(.easeInOut(duration: 0.12)) { visible.toggle() }
                }
            }
    }
}

/// Helper line under an input: B13 Medium, 8pt inset.
struct FieldHelperText: View {
    enum Tone { case neutral, action, success, warning, error }

    let text: String
    var tone: Tone = .neutral

    var body: some View {
        Text(text)
            .fieldText(.b13Medium)
            .foregroundStyle(color)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, FieldSpace.s8)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var color: Color {
        switch tone {
        case .neutral: FieldColour.TextNIcon.muted
        case .action: FieldColour.TextNIcon.action
        case .success: FieldColour.TextNIcon.success
        case .warning: FieldColour.TextNIcon.warning
        case .error: FieldColour.TextNIcon.error
        }
    }
}
