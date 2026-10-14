import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        MainTabs()
            .tint(FieldColour.Surface.actionBold)
            .environment(\.lang, app.lang)
            .environment(\.layoutDirection, app.lang.layoutDirection)
            .environment(\.locale, app.lang.locale)
            .sheet(isPresented: $app.showsDemo) {
                DemoPanel()
                    .environment(app)
                    .environment(\.layoutDirection, .leftToRight)
            }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang
    @State private var keyboardVisible = false

    /// Out of the way while typing, and during the sign-in moment until the page arrives with it.
    private var showsNav: Bool {
        guard !keyboardVisible, app.flow.passkeyOffer == nil || app.phase == .signedIn else { return false }
        // The Face ID sheet covers the whole screen, like the system one.
        if app.flow.showsFaceIDPrompt || app.authSheetUp, app.phase == .signedOut { return false }
        return app.celebration == nil || app.celebrationStage == .land
    }

    var body: some View {
        @Bindable var app = app
        ZStack {
            switch app.selectedTab {
            case .home:
                HomeView()
                    .safeAreaPadding(.bottom, BottomNav.barHeight)
            case .categories:
                PlaceholderTab(icon: .navCategories, title: lang.t("Categories", "الفئات"),
                               message: lang.t("Browse everything noon sells.", "تصفّح كل ما تبيعه نون."))
            case .deals:
                PlaceholderTab(icon: .navDeals, title: lang.t("Deals", "العروض"),
                               message: lang.t("Today's best prices live here.", "أفضل أسعار اليوم هنا."))
            case .account:
                AccountTab()
            case .cart:
                CartTab()
            }
        }
        .overlay {
            // Typing gets the whole screen: the nav steps aside while the keyboard is up, so the
            // button can dock right above the keys.
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                if showsNav {
                    BottomNav(selection: $app.selectedTab, cartBadge: CartTab.badgeCount)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .ignoresSafeArea(.keyboard)
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.lg), value: showsNav)
        }
        .overlay {
            // Sign-in from checkout or a link covers the tab, nav included.
            if let entry = app.authEntry {
                AuthModal(entry: entry)
                    .transition(app.phase == .signedIn ? .opacity : .move(edge: .bottom))
                    .zIndex(1)
            }
        }
        .overlay(alignment: .top) {
            if let toast = app.toast {
                Text(toast)
                    .fieldText(.b14SemiBold)
                    .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                    .padding(.horizontal, FieldSpace.s16)
                    .padding(.vertical, FieldSpace.s12)
                    .background(Capsule().fill(FieldColour.Surface.primaryInverted))
                    .shadow(color: .black.opacity(0.15), radius: 12, y: 6)
                    .padding(.top, FieldSpace.s8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
        .overlay {
            if let celebration = app.celebration {
                SignInCelebration(celebration: celebration)
                    .id(celebration.id)
            }
        }
        .overlay {
            if app.showsFaceIDOffer {
                FaceIDSheet()
            }
        }
        .overlay {
            // Entry point 3: the WhatsApp chat with the shared address link, over everything.
            if app.showsAddressChat {
                AddressLinkChat()
                    .transition(.move(edge: .trailing))
            }
        }
        #if DEBUG
        .task {
            // QA: launch straight into the chat with `-qaAddressChat`.
            if ProcessInfo.processInfo.arguments.contains("-qaAddressChat") { app.openAddressChat() }
        }
        #endif
    }
}

struct PlaceholderTab<Accessory: View>: View {
    let icon: FieldIconName
    let title: String
    let message: String
    @ViewBuilder var accessory: Accessory

    init(icon: FieldIconName, title: String, message: String, @ViewBuilder accessory: () -> Accessory = { EmptyView() }) {
        self.icon = icon
        self.title = title
        self.message = message
        self.accessory = accessory()
    }

    var body: some View {
        VStack(spacing: FieldSpace.s8) {
            FieldIcon(icon, size: 40)
                .foregroundStyle(FieldColour.TextNIcon.muted)
                .padding(.bottom, FieldSpace.s8)
            Text(title)
                .fieldText(.h20Bold)
                .foregroundStyle(FieldColour.TextNIcon.primary)
            Text(message)
                .fieldText(.b14Regular)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .multilineTextAlignment(.center)
            accessory
        }
        .padding(.horizontal, FieldSpace.s32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FieldColour.Surface.tertiary.ignoresSafeArea())
        .safeAreaPadding(.bottom, BottomNav.barHeight)
    }
}
