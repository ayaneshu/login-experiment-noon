import SwiftUI

/// The signed-in Account tab from the Figma file: profile, noon One, orders and wishlist, credits
/// and settings, on the tertiary page colour.
struct AccountPage: View {
    @Environment(AppModel.self) private var app
    let revealed: Bool
    @Environment(\.lang) private var lang
    @State private var webLink: WebLink?

    var body: some View {
        ScrollView {
            VStack(spacing: FieldSpace.s12) {
                // Stays put so the avatar can land exactly in it; fades up as the avatar arrives.
                ProfileCard()
                    .opacity(revealed ? 1 : 0)
                    .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.45).delay(revealed ? 0.18 : 0), value: revealed)
                HStack(spacing: FieldSpace.s12) {
                    ThumbnailWidget(title: lang.t("My Orders", "طلباتي"), images: (1...4).map { "order-\($0)" })
                    ThumbnailWidget(title: lang.t("My Wishlist", "قائمة أمنياتي"), images: (1...4).map { "wish-\($0)" })
                }
                .rise(revealed, order: 1)
                CreditsRow()
                    .rise(revealed, order: 2)
                SettingsCard(rows: [
                    .link(.location, lang.t("Addresses", "العناوين")),
                    .link(.paymentCard, lang.t("Manage Cards", "إدارة البطاقات")),
                    .link(.returnPackage, lang.t("Returns", "المرتجعات")),
                    .link(.crossShield, lang.t("Warranty claims", "مطالبات الضمان")),
                    .language,
                    .country,
                ])
                .rise(revealed, order: 3)
                SettingsCard(rows: [
                    .link(.preferences, lang.t("Preferences", "التفضيلات")),
                    .link(.notification, lang.t("Notifications", "الإشعارات")),
                ])
                .rise(revealed, order: 4)
                SettingsCard(rows: [
                    .link(.userShield, lang.t("Account security", "أمان الحساب")),
                    .signOut,
                ])
                .rise(revealed, order: 5)
                AuthFooter(onOpen: { webLink = WebLink(url: $0) })
                    .padding(.vertical, FieldSpace.s16)
                    .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
                    .rise(revealed, order: 6)
                Text(joinedLine)
                    .fieldText(.b12Regular)
                    .foregroundStyle(FieldColour.TextNIcon.muted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, FieldSpace.s40)
                    .padding(.vertical, FieldSpace.s12)
                    .rise(revealed, order: 7)
            }
            .padding(.horizontal, FieldSpace.s12)
            .padding(.top, FieldSpace.s8)
            .padding(.bottom, FieldSpace.s16)
        }
        .scrollIndicators(.hidden)
        .safeAreaPadding(.bottom, BottomNav.barHeight)
        .background(FieldColour.Surface.tertiary.ignoresSafeArea())
        .sheet(item: $webLink) { link in
            SafariView(url: link.url).ignoresSafeArea()
        }
    }

    private var joinedLine: String {
        let version = lang.t("Version 4.63.0, designed with care in every detail.", "الإصدار 4.63.0، صُمّم بعناية في كل التفاصيل.")
        let joined = app.sessionIsNew
            ? lang.t("You joined noon today. Welcome!", "انضممت إلى نون اليوم. أهلاً بك!")
            : lang.t("You joined the noon app in June 2022.", "انضممت إلى تطبيق نون في يونيو 2022.")
        return "\(joined)\n\(version)"
    }
}

private extension View {
    /// Cards rise into the page one after another while the sheet finishes filling the screen.
    func rise(_ revealed: Bool, order: Int) -> some View {
        modifier(Materialize(opacity: revealed ? 1 : 0, blur: revealed ? 0 : 4, y: revealed ? 0 : 24))
            .animation(.spring(duration: 0.6, bounce: 0).delay(revealed ? 0.05 * Double(order) : 0), value: revealed)
    }
}

// MARK: - Profile

private struct ProfileCard: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang

    private var account: Account? { app.session }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: FieldSpace.s12) {
                FieldAvatar(initial: initial, size: 48, style: .neutral)
                    // The celebration's avatar is flying in to take this spot.
                    .opacity(app.celebration == nil ? 1 : 0)
                    .onGeometryChange(for: CGPoint.self) { proxy in
                        let frame = proxy.frame(in: .global)
                        return CGPoint(x: frame.midX, y: frame.midY)
                    } action: { app.avatarCenter = $0 }
                VStack(alignment: .leading, spacing: FieldSpace.s2) {
                    Text(account?.fullName ?? lang.t("Welcome to noon", "أهلاً بك في نون"))
                        .fieldText(.h18Bold)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .lineLimit(1)
                    if let identifier = account?.identifier {
                        Text(ltr(identifier.display))
                            .fieldText(.b12Regular)
                            .foregroundStyle(FieldColour.TextNIcon.tertiary)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)

                Button {} label: {
                    FieldIcon(.edit, size: 18)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .frame(width: 36.scaled, height: 36.scaled)
                        .background(Circle().fill(FieldColour.Surface.primary))
                        .overlay(Circle().strokeBorder(FieldColour.Border.primary, lineWidth: 1))
                        .frame(width: max(44, 36.scaled), height: max(44, 36.scaled))
                        .contentShape(Circle())
                }
                .buttonStyle(FieldPressStyle(scale: 0.92))
                .padding(.trailing, -FieldSpace.s4)
                .accessibilityLabel(lang.t("Edit profile", "تعديل الملف الشخصي"))
            }
            .padding(.horizontal, FieldSpace.s12)
            .frame(height: 80.scaled)
            .contentShape(Rectangle())

            Button {} label: {
                HStack(spacing: FieldSpace.s8) {
                    Image(FieldArt.noonOne)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 40.scaled, height: 24.scaled)
                    Text(lang.t("Save big with free delivery", "وفّر أكثر مع التوصيل المجاني"))
                        .fieldText(.b14Bold)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                    Spacer(minLength: 0)
                    FieldIcon(.chevronRight, size: 18)
                        .flipsForRightToLeftLayoutDirection(true)
                        .foregroundStyle(FieldColour.TextNIcon.tertiary)
                }
                .padding(.horizontal, FieldSpace.s12)
                .frame(height: 46.scaled)
                .background(
                    LinearGradient(colors: [NoonBrand.noonOneCream, FieldPalette.Orange.c100], startPoint: .leading, endPoint: .trailing)
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.99))
        }
        .background(FieldColour.Surface.primary)
        .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).strokeBorder(FieldColour.Border.white, lineWidth: 2))
    }

    private var initial: String? {
        if let first = account?.firstName?.first { return String(first) }
        if case .email(let email) = account?.identifier, let first = email.first { return String(first).uppercased() }
        return nil
    }
}

// MARK: - Widgets

private struct ThumbnailWidget: View {
    let title: String
    let images: [String]

    var body: some View {
        Button {} label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .fieldText(.b14SemiBold)
                    .foregroundStyle(FieldColour.TextNIcon.primary)
                    .frame(height: 46.scaled, alignment: .center)
                    .padding(.horizontal, FieldSpace.s12)

                HStack(spacing: -10.scaled) {
                    ForEach(Array(images.enumerated()), id: \.offset) { index, name in
                        Image(name)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 47.25.scaled, height: 63.scaled)
                            .clipShape(RoundedRectangle(cornerRadius: 9.scaled, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 9.scaled, style: .continuous).strokeBorder(FieldColour.Border.white, lineWidth: 2.25))
                            .zIndex(Double(images.count - index))
                    }
                }
                .padding(.horizontal, FieldSpace.s8)
                .padding(.bottom, 13.scaled)
                .environment(\.layoutDirection, .leftToRight)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).fill(FieldColour.Surface.primary))
            .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
        }
        .buttonStyle(FieldPressStyle())
    }
}

private struct CreditsRow: View {
    @Environment(\.lang) private var lang

    var body: some View {
        Button {} label: {
            HStack(spacing: FieldSpace.s6) {
                FieldIcon(.noonWallet, size: 28)
                    .foregroundStyle(FieldColour.TextNIcon.secondary)
                Text(lang.t("noon Credits", "رصيد نون"))
                    .fieldText(.b14Medium)
                    .foregroundStyle(FieldColour.TextNIcon.primary)
                Spacer(minLength: 0)
                HStack(spacing: FieldSpace.s6) {
                    // Noontree's UAE dirham sign. It's also the "dhm" ligature, but tracking
                    // switches ligatures off, so use the glyph itself.
                    Text(verbatim: "\u{E001}320.21")
                        .fieldText(.b14SemiBold)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .environment(\.layoutDirection, .leftToRight)
                    FieldIcon(.chevronRight, size: 14)
                        .flipsForRightToLeftLayoutDirection(true)
                        .foregroundStyle(FieldColour.TextNIcon.tertiary)
                }
                .padding(.leading, FieldSpace.s12)
                .padding(.trailing, FieldSpace.s8)
                .frame(height: 34.scaled)
                .background(Capsule().fill(FieldColour.Surface.secondary))
            }
            .padding(.leading, FieldSpace.s10)
            .padding(.trailing, FieldSpace.s10)
            .frame(height: 62.scaled)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
        }
        .buttonStyle(FieldPressStyle(scale: 0.99))
        .accessibilityLabel(lang.t("noon Credits, 320.21 dirhams", "رصيد نون، 320.21 درهم"))
    }
}

// MARK: - Settings

private enum SettingsRow: Identifiable {
    case link(FieldIconName, String)
    case language
    case country
    case signOut

    var id: String {
        switch self {
        case .link(let icon, _): icon.rawValue
        case .language: "language"
        case .country: "country"
        case .signOut: "signOut"
        }
    }
}

private struct SettingsCard: View {
    @Environment(AppModel.self) private var app
    let rows: [SettingsRow]
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if index > 0 {
                    Rectangle()
                        .fill(FieldColour.Border.subtle)
                        .frame(height: 1)
                        .padding(.horizontal, FieldSpace.s16)
                }
                rowView(row)
            }
        }
        .padding(.vertical, FieldSpace.s4)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
    }

    @ViewBuilder
    private func rowView(_ row: SettingsRow) -> some View {
        switch row {
        case .link(let icon, let title):
            Button {} label: { rowLabel(icon: icon, title: title) { chevron } }
                .buttonStyle(RowPressStyle())
        case .language:
            rowLabel(icon: .language, title: lang.t("Language", "اللغة")) {
                MiniLanguageToggle(current: app.lang) { app.toggleLanguage() }
            }
        case .country:
            Button {} label: {
                rowLabel(icon: .world, title: lang.t("Country", "الدولة")) {
                    HStack(spacing: FieldSpace.s8) {
                        CountryFlag(country: app.market, width: 24, height: 18)
                        chevron
                    }
                }
            }
            .buttonStyle(RowPressStyle())
        case .signOut:
            Button { app.signOut() } label: {
                rowLabel(icon: .signOut, title: lang.t("Sign out", "تسجيل الخروج")) { EmptyView() }
            }
            .buttonStyle(RowPressStyle())
        }
    }

    private var chevron: some View {
        FieldIcon(.chevronRight, size: 14)
            .flipsForRightToLeftLayoutDirection(true)
            .foregroundStyle(FieldColour.TextNIcon.tertiary)
    }

    private func rowLabel<Trailing: View>(icon: FieldIconName, title: String, @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(spacing: FieldSpace.s12) {
            FieldIcon(icon, size: 20)
                .foregroundStyle(FieldColour.TextNIcon.secondary)
            Text(title)
                .fieldText(.b14Medium)
                .foregroundStyle(FieldColour.TextNIcon.primary)
            Spacer(minLength: 0)
            trailing()
        }
        .padding(.horizontal, FieldSpace.s16)
        .frame(minHeight: 50.scaled)
        .contentShape(Rectangle())
    }
}

struct RowPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(FieldColour.Surface.secondary.opacity(configuration.isPressed ? 1 : 0))
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.xs), value: configuration.isPressed)
            .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.6), trigger: configuration.isPressed) { _, pressed in
                pressed
            }
    }
}

/// The Language row's compact switch: white handle on a tertiary track.
private struct MiniLanguageToggle: View {
    let current: Lang
    var action: () -> Void
    @Namespace private var handle
    @State private var shown: Lang

    init(current: Lang, action: @escaping () -> Void) {
        self.current = current
        self.action = action
        _shown = State(initialValue: current)
    }

    var body: some View {
        Button {
            withAnimation(FieldMotion.Spring.snappy) { shown = shown == .en ? .ar : .en }
            Task {
                try? await Task.sleep(for: .milliseconds(200))
                action()
            }
        } label: {
            HStack(spacing: 0) {
                segment(.en, "English", size: 12)
                segment(.ar, "العربية", size: 14)
            }
            .padding(3.scaled)
            .background(Capsule().fill(FieldColour.Surface.tertiary))
            .environment(\.layoutDirection, .leftToRight)
        }
        .buttonStyle(FieldPressStyle())
        .accessibilityLabel(current == .en ? "التبديل إلى العربية" : "Switch to English")
        .onChange(of: current) { _, new in shown = new }
    }

    private func segment(_ lang: Lang, _ title: String, size: CGFloat) -> some View {
        let isOn = shown == lang
        return Text(title)
            .font(FieldTextStyle(fontName: isOn ? "Noontree-SemiBold" : "Noontree-Medium", size: size, lineHeight: 16, letterSpacing: 0).font)
            .foregroundStyle(isOn ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.muted)
            .padding(.horizontal, FieldSpace.s10)
            .frame(height: 28.scaled)
            .background {
                if isOn {
                    Capsule()
                        .fill(FieldColour.Surface.primary)
                        .shadow(color: .black.opacity(0.06), radius: 2, y: 1)
                        .matchedGeometryEffect(id: "handle", in: handle)
                }
            }
    }
}
