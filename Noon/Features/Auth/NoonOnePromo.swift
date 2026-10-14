import SwiftUI

/// The noon One Credit Card offer at the top of the sign-in screen (tabs flow, Choose your
/// account): copy and "Apply now" on the left, the card standing on a pedestal of products on the
/// right. Laid out in the Figma frame's coordinates (375 wide, measured from the very top of the
/// screen) and scaled with the design.
struct NoonOneHeader: View {
    let visible: Bool
    var onApply: () -> Void

    @Environment(\.lang) private var lang

    static let size = CGSize(width: 375, height: 440)

    /// Arabic mirrors the composition: copy on the right, art on the left (the card stays readable).
    private var mirrored: Bool { lang == .ar }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Deepens the blue behind the pedestal so the sheet's edge reads cleanly.
            LinearGradient(
                stops: [
                    .init(color: Color(fieldHex: 0x002888, alpha: 0), location: 0),
                    .init(color: Color(fieldHex: 0x002888), location: 0.633),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .frame(width: 375, height: 206)
            .offset(y: 200)

            art
                .frame(width: 375, height: 336, alignment: .topLeading)
                .clipped()
                .offset(x: 104, y: 104)
                .modifier(Materialize(opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96, y: visible ? 0 : 14))
                .animation(.spring(duration: 0.6, bounce: 0), value: visible)
                .scaleEffect(x: mirrored ? -1 : 1, y: 1)

            copy
                .environment(\.layoutDirection, mirrored ? .rightToLeft : .leftToRight)
                .frame(width: Self.size.width - 36, alignment: mirrored ? .topTrailing : .topLeading)
                .offset(x: 18, y: 134)
                .modifier(Materialize(opacity: visible ? 1 : 0, blur: visible ? 0 : 4, y: visible ? 0 : 8))
                .animation(.spring(duration: 0.5, bounce: 0).delay(visible ? 0.12 : 0), value: visible)
        }
        .frame(width: Self.size.width, height: Self.size.height, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
    }

    /// Figma group 943:255467: the product pedestal at 20%, the card's shadow and the card.
    private var art: some View {
        ZStack(alignment: .topLeading) {
            Image(FieldArt.noonOneBoxes)
                .resizable()
                .frame(width: 407.6, height: 407.82)
                .opacity(0.2)
                .offset(x: -16.2, y: -31.82)
            Image(FieldArt.noonOneCardShadow)
                .resizable()
                .frame(width: 180.38, height: 4.47)
                .offset(x: 92.43, y: 142.22)
            Image(FieldArt.noonOneCard)
                .resizable()
                .frame(width: 108.8, height: 68)
                .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
                .scaleEffect(x: mirrored ? -1 : 1, y: 1)
                .offset(x: 133.2, y: 75.68)
        }
        .frame(width: 375, height: 376, alignment: .topLeading)
        .offset(y: -40)
        .accessibilityHidden(true)
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(lang.t("noon One Credit Card", "بطاقة نون ون الائتمانية"))
                .fieldText(.b16Bold)
                .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                .fixedSize()
            VStack(alignment: .leading, spacing: 2) {
                NoonOneBullet(text: lang.t("Free 1 year of noon one", "سنة مجانية من نون ون"), tint: FieldColour.TextNIcon.onSurfaceSubtle)
                NoonOneBullet(text: lang.t("Upto 20% savings", "توفير حتى ٢٠٪"), tint: Color.white.opacity(0.96))
            }
            .padding(.top, 7)
            Button(action: onApply) {
                Text(lang.t("Apply now", "قدّم الآن"))
                    .fieldText(.a12SemiBold)
                    .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                    .fixedSize()
                    .padding(.horizontal, 16)
                    .frame(height: 36)
                    .background(Capsule().fill(FieldPalette.AlphaLight.c16))
                    .contentShape(Capsule())
            }
            .buttonStyle(FieldPressStyle(scale: 0.96))
            .padding(.top, 17)
        }
    }
}

/// One line of the offer: a small sparkle and B12 copy.
struct NoonOneBullet: View {
    let text: String
    var tint: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(FieldArt.sparkleBullet)
                .renderingMode(.template)
                .resizable()
                .frame(width: 8, height: 8)
            Text(text)
                .fieldText(.b12Regular)
                .fixedSize()
        }
        .foregroundStyle(tint)
        .frame(height: 18)
    }
}

/// Smart flow: the same offer as a card under "Sign in with OTP" (Figma 732:114049).
struct NoonOnePromoCard: View {
    var onApply: () -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
        ZStack(alignment: .topLeading) {
            Image(FieldArt.noonOnePromoArt)
                .resizable()
                .frame(width: 257.scaled, height: 138.scaled)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .offset(y: 1)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                Text(lang.t("noon One Credit Card", "بطاقة نون ون الائتمانية"))
                    .fieldText(.b14Bold)
                    .foregroundStyle(FieldPalette.Grey.c800)
                    .fixedSize()
                VStack(alignment: .leading, spacing: 2) {
                    NoonOneBullet(text: lang.t("Free 1 year of noon one", "سنة مجانية من نون ون"), tint: FieldColour.TextNIcon.secondary)
                    NoonOneBullet(text: lang.t("Upto 20% savings", "توفير حتى ٢٠٪"), tint: FieldColour.TextNIcon.secondary)
                }
                .padding(.top, 8.scaled)
                Button(action: onApply) {
                    Text(lang.t("Apply now", "قدّم الآن"))
                        .fieldText(.a12SemiBold)
                        .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                        .fixedSize()
                        .padding(.horizontal, 16.scaled)
                        .frame(height: 36.scaled)
                        .background(RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous).fill(FieldColour.Surface.primaryInverted))
                        .contentShape(RoundedRectangle(cornerRadius: FieldRadius.r8, style: .continuous))
                }
                .buttonStyle(FieldPressStyle(scale: 0.96))
                .padding(.top, 10.scaled)
            }
            .padding(.leading, 13.scaled)
            .padding(.top, 11.scaled)
        }
        .frame(height: 138.scaled)
        .frame(maxWidth: .infinity)
        .background(shape.fill(FieldColour.Surface.primary))
        .clipShape(shape)
        .overlay(shape.strokeBorder(FieldColour.Border.subtle, lineWidth: 1))
        .environment(\.layoutDirection, .leftToRight)
    }
}
