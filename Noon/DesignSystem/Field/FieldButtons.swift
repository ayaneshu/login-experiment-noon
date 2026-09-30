import SwiftUI

// Mirrors @field-ds/components Button family: usePressScale (0.98, xs press-in, snappy
// release) and useLoadingFade (sm cross-fade on the standard curve).

/// Touch-down scale and a soft haptic tap, shared by every Field button. Both land the instant a
/// finger touches down, so the button feels pressed rather than clicked after the fact.
struct FieldPressStyle: ButtonStyle {
    var scale: CGFloat = 0.98

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(
                configuration.isPressed
                    ? FieldMotion.Easing.standard(FieldMotion.Duration.xs)
                    : FieldMotion.Spring.snappy,
                value: configuration.isPressed
            )
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: configuration.isPressed) { _, pressed in
                pressed
            }
    }
}

enum FieldButtonSize {
    case h56, h52, h48

    var height: CGFloat {
        switch self {
        case .h56: 56.scaled
        case .h52: 52.scaled
        case .h48: 48.scaled
        }
    }

    var text: FieldTextStyle {
        switch self {
        case .h56: .a17SemiBold
        case .h52: .a16SemiBold
        case .h48: .a14SemiBold
        }
    }

    var radius: CGFloat {
        switch self {
        case .h56, .h52: FieldRadius.r12
        case .h48: FieldRadius.r10
        }
    }

    var iconSize: CGFloat { (self == .h48 ? 20 : 24).scaled }
}

struct FieldButtonTone {
    var background: Color
    var pressed: Color
    var foreground: Color
    var border: Color = .clear

    /// M-NeutralButton: filled near-black.
    static let neutral = FieldButtonTone(
        background: FieldColour.Surface.primaryInverted,
        pressed: FieldColour.Surface.secondaryInverted,
        foreground: FieldColour.TextNIcon.onSurfaceBold
    )

    /// M-PrimaryButton: filled blue.
    static let primary = FieldButtonTone(
        background: FieldColour.Surface.actionBold,
        pressed: FieldColour.Surface.actionExtrabold,
        foreground: FieldColour.TextNIcon.onSurfaceBold
    )

    /// M-SecondaryButton: white with a soft blue outline and a blue label.
    static let secondary = FieldButtonTone(
        background: FieldColour.Surface.primary,
        pressed: FieldColour.Surface.actionSubtle,
        foreground: FieldColour.TextNIcon.action,
        border: FieldColour.Border.action
    )

    /// M-SecondaryNeutralButton: outline neutral.
    static let secondaryNeutral = FieldButtonTone(
        background: FieldColour.Surface.primary,
        pressed: FieldColour.Surface.secondary,
        foreground: FieldColour.TextNIcon.primary,
        border: FieldColour.Border.primary
    )
}

/// Rectangular Field button (Neutral / Primary / Secondary / Secondary-Neutral).
struct FieldButton: View {
    let title: String
    var tone: FieldButtonTone = .neutral
    var size: FieldButtonSize = .h56
    var leadingImage: String?
    /// Defaults to the size's icon slot (24, or 20 at h48).
    var leadingImageSize: CGFloat?
    /// A directional glyph after the label ("Right Icon"); mirrors in right-to-left languages.
    var trailingIcon: FieldIconName?
    var textStyle: FieldTextStyle?
    var isLoading = false
    var loadingImage: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                HStack(spacing: FieldSpace.s8) {
                    if let leadingImage {
                        Image(leadingImage)
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: leadingImageSize?.scaled ?? size.iconSize, height: leadingImageSize?.scaled ?? size.iconSize)
                    }
                    Text(title)
                        .fieldText(textStyle ?? size.text)
                        .lineLimit(1)
                        .id(title)
                        .transition(.blurReplace)
                    if let trailingIcon {
                        FieldIcon(trailingIcon, size: size == .h48 ? 20 : 24)
                            .flipsForRightToLeftLayoutDirection(true)
                    }
                }
                .opacity(isLoading ? 0 : 1)

                Group {
                    if let loadingImage {
                        Image(loadingImage)
                            .renderingMode(.template)
                            .resizable()
                            .scaledToFit()
                            .frame(width: size.iconSize + 4, height: size.iconSize + 4)
                            .symbolEffect(.pulse, options: .repeating)
                    } else {
                        ProgressView().tint(tone.foreground)
                    }
                }
                .opacity(isLoading ? 1 : 0)
            }
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, FieldSpace.s24)
            .frame(maxWidth: .infinity)
            .frame(height: size.height)
            .background(
                RoundedRectangle(cornerRadius: size.radius, style: .continuous)
                    .fill(tone.background)
            )
            .overlay(
                RoundedRectangle(cornerRadius: size.radius, style: .continuous)
                    .strokeBorder(tone.border, lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: size.radius, style: .continuous))
        }
        .buttonStyle(FieldPressStyle())
        .disabled(isLoading)
        .animation(FieldMotion.Easing.standard(FieldMotion.Duration.sm), value: isLoading)
        .animation(FieldMotion.Spring.snappy, value: title)
        .accessibilityLabel(title)
    }
}

/// M-TextButtonBlue: low-emphasis blue label with an optional trailing chevron.
struct FieldTextButtonBlue: View {
    let title: String
    var showsChevron = false
    var style: FieldTextStyle = .a14SemiBold
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldSpace.s4) {
                Text(title).fieldText(style)
                if showsChevron { FieldIcon(.chevronRight, size: 20).flipsForRightToLeftLayoutDirection(true) }
            }
            .foregroundStyle(FieldColour.TextNIcon.action)
            .padding(.horizontal, FieldSpace.s8)
            .frame(minHeight: 28.scaled)
            // 28pt tall like the Figma component, with a full 44pt touch target around it.
            .contentShape(Rectangle().inset(by: -8))
        }
        .buttonStyle(FieldPressStyle())
    }
}

/// M-TextButtonNeutral: quiet inline action in the primary text tone.
struct FieldNeutralTextButton: View {
    let title: String
    var leadingImage: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldSpace.s4) {
                if let leadingImage {
                    Image(leadingImage)
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 20.scaled, height: 20.scaled)
                }
                Text(title).fieldText(.a14SemiBold)
                    .id(title)
                    .transition(.blurReplace)
            }
            .foregroundStyle(FieldColour.TextNIcon.primary)
            .padding(.horizontal, FieldSpace.s6)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(FieldPressStyle())
        .animation(FieldMotion.Spring.snappy, value: title)
    }
}

/// M-NeutralRoundButton: pill chip for compact actions (email domains, resend channels).
struct FieldRoundButton: View {
    let title: String
    var leadingImage: String?
    var tint: Color = FieldColour.TextNIcon.primary
    /// Tertiary on white surfaces; use primary (white) on tertiary pages so it still reads as a chip.
    var fill: Color = FieldColour.Surface.tertiary
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldSpace.s4) {
                if let leadingImage {
                    Image(leadingImage)
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 16.scaled, height: 16.scaled)
                }
                Text(title)
                    .fieldText(.b13Medium)
                    .lineLimit(1)
                    .fixedSize()
            }
            .foregroundStyle(tint)
            .padding(.horizontal, FieldSpace.s12)
            .frame(height: 36.scaled)
            .background(Capsule().fill(fill))
            .contentShape(Capsule())
        }
        .buttonStyle(FieldPressStyle(scale: 0.96))
    }
}

/// M-Divider with an inline label, e.g. "OR".
struct FieldLabeledDivider: View {
    let label: String

    var body: some View {
        HStack(spacing: FieldSpace.s20) {
            Rectangle().fill(FieldColour.Border.primary).frame(height: 1)
            Text(label)
                .fieldText(.a14SemiBold)
                .foregroundStyle(FieldColour.TextNIcon.muted)
            Rectangle().fill(FieldColour.Border.primary).frame(height: 1)
        }
        .padding(.horizontal, FieldSpace.s8)
        .accessibilityElement(children: .combine)
    }
}
