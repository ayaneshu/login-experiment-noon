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
        guard !keyboardVisible else { return false }
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
                    BottomNav(selection: $app.selectedTab)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .ignoresSafeArea(.keyboard)
            .animation(FieldMotion.Easing.standard(FieldMotion.Duration.lg), value: showsNav)
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
    }
}

/// Empty for now, and home to the prototype tools: the header transition preview on top and the
/// one way into the prototype controls.
struct CartTab: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: 0) {
            TransitionPreview()
                .environment(\.layoutDirection, .leftToRight)
                .padding(.horizontal, FieldSpace.s12)
                .padding(.top, FieldSpace.s8)

            PlaceholderTab(icon: .navCart, title: lang.t("Your cart is empty", "سلّتك فارغة"),
                           message: lang.t("Items you add will wait for you here.", "ستنتظرك هنا المنتجات التي تضيفها.")) {
                FieldRoundButton(title: "Prototype controls", leadingImage: FieldIconName.preferences.assetName, fill: FieldColour.Surface.primary) {
                    app.showsDemo = true
                }
                .environment(\.layoutDirection, .leftToRight)
                .padding(.top, FieldSpace.s20)
            }
        }
        .background(FieldColour.Surface.tertiary.ignoresSafeArea())
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
