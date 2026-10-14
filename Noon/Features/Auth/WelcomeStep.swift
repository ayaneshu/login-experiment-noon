import SwiftUI

/// "Welcome to noon" (Figma 1109:9154): the My Account landing in the separate flow, with two clear
/// paths, "Log in" and "Create new account". Country, language and the carousel only show here.
struct WelcomeStep: View {
    var flow: AuthFlow
    var onOpen: (URL) -> Void
    /// The height above the fold (title and both buttons), so the resting sheet can sit on the nav
    /// with the footer tucked under it.
    var onFoldHeight: (CGFloat) -> Void = { _ in }

    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: FieldSpace.s16) {
                AuthTitle(title: lang.t("Welcome to noon", "أهلاً بك في نون"),
                          subtitle: lang.t("Log in or sign up in to your account", "سجّل الدخول أو أنشئ حساباً"))

                FieldButton(title: lang.t("Log in", "تسجيل الدخول"), tone: .neutral, action: { flow.openLogin() })
                    .reportCenter { flow.ctaAnchor = $0 }

                FieldButton(
                    title: lang.t("Create new account", "إنشاء حساب جديد"),
                    tone: .secondary,
                    size: .h52,
                    leadingImage: FieldIconName.plus.assetName,
                    textStyle: .a16SemiBold,
                    action: flow.openSignup
                )
            }
            // At rest the sheet ends just under "Create new account"; pulling it up brings the
            // footer out from under the nav (Figma 1109:9154).
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { onFoldHeight($0) }

            WelcomeFooter(onOpen: onOpen)
                .padding(.top, FieldSpace.s16)
        }
    }
}

/// The footer of the new screens: Policies · Sell on noon, four social icons spread across, and the
/// copyright line (Figma "Social icons + Links").
struct WelcomeFooter: View {
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: FieldSpace.s12) {
            FooterLinks(onOpen: onOpen)

            HStack {
                social(FieldArt.social("facebook"), "Facebook", Links.facebook)
                Spacer(minLength: 0)
                social(FieldArt.social("x"), "X", Links.x)
                Spacer(minLength: 0)
                social(FieldArt.social("linkedin"), "LinkedIn", Links.linkedIn)
                Spacer(minLength: 0)
                social(FieldArt.social("instagram"), "Instagram", Links.instagram)
            }
            .padding(.horizontal, 48.scaled)

            HStack(spacing: FieldSpace.s12) {
                Text(verbatim: Self.version)
                Circle().fill(FieldColour.Border.medium).frame(width: 2, height: 2)
                Text(lang.t("© \(String(Calendar.current.component(.year, from: .now))) noon. All Rights Reserved",
                            "© \(String(Calendar.current.component(.year, from: .now))) نون. جميع الحقوق محفوظة"))
            }
            .font(FieldTextStyle.b12Regular.font)
            .tracking(FieldTextStyle.b12Regular.tracking)
            .foregroundStyle(FieldColour.TextNIcon.muted)
            .lineLimit(1)
            .fixedSize()
            .frame(height: 18.scaled)
        }
        .frame(maxWidth: .infinity)
    }

    /// The build label from the design.
    static let version = "V2026.01.2214"

    private func social(_ image: String, _ name: String, _ url: URL) -> some View {
        Button { onOpen(url) } label: {
            Image(image)
                .resizable()
                .scaledToFit()
                .frame(width: 40.scaled, height: 40.scaled)
                .background(RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous).fill(FieldColour.Surface.secondary))
                .contentShape(RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous))
        }
        .buttonStyle(FieldPressStyle(scale: 0.94))
        .accessibilityLabel(lang.t("noon on \(name)", "نون على \(name)"))
    }
}
