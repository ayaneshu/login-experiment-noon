import SwiftUI

@Observable
final class AppModel {
    enum Tab: Hashable, CaseIterable {
        case home, categories, deals, account, cart
    }

    enum Scenario: CaseIterable {
        case newDevice, rememberedCode, rememberedFaceID
    }

    /// Where the Account tab is in the sign-in story.
    enum AccountPhase: Equatable {
        case signedOut, signedIn
    }

    /// The signed-in moment: the code resolves into your avatar, the sheet clears into the page,
    /// a greeting, then the avatar settles into its place on the account page.
    struct Celebration: Identifiable, Equatable {
        let id = UUID()
        /// Where the avatar forms: the code boxes, or the button that was tapped.
        let origin: CGPoint
        let initial: String?
        let title: String
        let subtitle: String
        /// From My Account the avatar flies into the profile card; from checkout or a link it
        /// settles and fades, and sign-in closes back to where you were.
        var landsOnAccount = true
    }

    enum CelebrationStage: Equatable {
        /// The code resolves into the avatar while the sheet's content dissolves.
        case resolve
        /// The sheet grows to fill the screen and becomes the page.
        case clear
        /// The account page is underneath; the greeting is up.
        case greet
        /// The avatar flies into the profile card as the page rises to meet it.
        case land
    }

    let store: DeviceStore
    private(set) var flow: AuthFlow
    private(set) var session: Account?
    private(set) var sessionIsNew = false
    private(set) var phase: AccountPhase = .signedOut
    /// Account cards rise in once the sheet has started filling the screen.
    private(set) var accountRevealed = false
    private(set) var showsFaceIDOffer = false
    /// The clearing sheet has reached the top, so the status bar sits on a light page.
    private(set) var sheetCoversStatusBar = false
    private(set) var celebration: Celebration?
    private(set) var celebrationStage: CelebrationStage = .resolve
    /// Measured by the account page so the celebration knows where to land.
    @ObservationIgnored var avatarCenter: CGPoint = .zero
    @ObservationIgnored private var usedPasskey = false

    var selectedTab: Tab = .account
    var showsDemo = false
    /// Sign-in opened from somewhere other than My Account (checkout, a link), full screen.
    private(set) var authEntry: AuthEntry?
    /// Signed in from checkout: the Cart tab moves on to the checkout step.
    var showsCheckout = false
    /// Prototype: a WhatsApp chat where a friend shared a noon address link (Figma E-2b · 0). Tapping
    /// the link opens noon on Log in.
    var showsAddressChat = false
    /// A sheet drawn inside sign-in (the country code sheet) covers the tab bar too.
    var authSheetUp = false
    /// A short confirmation after a sign-in that came from a link.
    var toast: String?
    /// The sheet-rise entrance plays on launch and after signing out, not on language switches.
    var introPending = true
    /// Whether the keyboard was up when the language changed, so the rebuilt screen restores it.
    var restoreKeyboard = false
    /// True while the header is washed yellow, where white status bar glyphs would disappear.
    var authHeaderIsLight = false
    /// The market chosen in the header. New phone numbers start with its dial code.
    var market: Country = .initial

    var lang: Lang {
        get { store.lang }
        set { store.lang = newValue }
    }

    var scenario: Scenario {
        guard let remembered = store.remembered else { return .newDevice }
        return remembered.passkeyEnabled ? .rememberedFaceID : .rememberedCode
    }

    var statusBarIsDark: Bool {
        if celebration != nil { return sheetCoversStatusBar }
        if authEntry != nil { return authHeaderIsLight }
        guard selectedTab == .account else { return true }
        switch phase {
        case .signedIn: return true
        case .signedOut: return authHeaderIsLight
        }
    }

    init() {
        let store = DeviceStore()
        self.store = store
        flow = AuthFlow(store: store)
        wire(flow)
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-qaVariant"), index + 1 < arguments.count,
           let variant = LoginVariant(rawValue: arguments[index + 1]) {
            store.loginVariant = variant
            flow.setVariant(variant)
        }
        if let index = arguments.firstIndex(of: "-qaScenario"), index + 1 < arguments.count {
            switch arguments[index + 1] {
            case "faceid": apply(.rememberedFaceID)
            case "code": apply(.rememberedCode)
            default: apply(.newDevice)
            }
        }
        // Language is stored, so QA runs set it every time: `-qaLang ar`.
        if let index = arguments.firstIndex(of: "-qaLang"), index + 1 < arguments.count {
            store.lang = Lang(rawValue: arguments[index + 1]) ?? .en
        } else {
            store.lang = .en
        }
        if arguments.contains("-qaAddressLink") {
            Task {
                try? await Task.sleep(for: .seconds(1.0))
                openAddressLink()
            }
        }
        if arguments.contains("-qaCheckout") {
            selectedTab = .cart
            Task {
                try? await Task.sleep(for: .seconds(1.0))
                beginCheckout()
            }
        }
        // Stored settings survive relaunches, so QA runs always say which way autofill goes.
        if arguments.contains("-qaAutoSignIn") || arguments.contains("-qaNoAutofill") { store.simulateAutofill = !arguments.contains("-qaNoAutofill") }
        if arguments.contains("-qaAutoSignIn") { runQAAutoSignIn() }
        if arguments.contains("-qaDemo") { showsDemo = true }
        if let index = arguments.firstIndex(of: "-qaTransition"), index + 1 < arguments.count,
           let style = HeaderTransitionStyle(rawValue: arguments[index + 1]) {
            store.headerTransition.style = style
        }
        if let index = arguments.firstIndex(of: "-qaTab"), index + 1 < arguments.count {
            selectedTab = ["home": .home, "categories": .categories, "deals": .deals, "cart": .cart][arguments[index + 1]] ?? .account
        }
        if let index = arguments.firstIndex(of: "-qaMethod"), index + 1 < arguments.count {
            let method: IdentifierKind = arguments[index + 1] == "email" ? .email : .phone
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                flow.setMethod(method)
            }
        }
        // Separate flow QA: `-qaLogin` / `-qaSignup` open the form, `-qaSubmit` taps its button
        // after `-qaFill`, `-qaFaceIDPrompt` taps "Log in with Face ID" on a saved account.
        if arguments.contains("-qaLogin") || arguments.contains("-qaSignup") {
            let signup = arguments.contains("-qaSignup")
            Task {
                try? await Task.sleep(for: .seconds(1.0))
                if signup { flow.openSignup() } else { flow.openLogin() }
            }
        }
        if arguments.contains("-qaSubmit") {
            Task {
                try? await Task.sleep(for: .seconds(2.4))
                flow.submitIdentifier()
            }
        }
        if arguments.contains("-qaFaceIDPrompt") {
            Task {
                try? await Task.sleep(for: .seconds(1.4))
                flow.beginFaceIDPrompt()
            }
        }
        if let index = arguments.firstIndex(of: "-qaFill"), index + 1 < arguments.count {
            let value = arguments[index + 1]
            Task {
                try? await Task.sleep(for: .seconds(1.6))
                flow.setInput(value)
            }
        }
        #endif
    }

    #if DEBUG
    /// QA hook for screen recordings: types Anmol's number and asks for a code; SMS autofill and
    /// the celebration take it from there. Launch with `-qaAutoSignIn`.
    private func runQAAutoSignIn() {
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            // `-qaIdentity <email or number>` signs in as someone else; Anmol's number by default.
            let arguments = ProcessInfo.processInfo.arguments
            if flow.isSeparate, flow.step == .welcome {
                flow.openLogin()
                try? await Task.sleep(for: .seconds(0.6))
            }
            if let index = arguments.firstIndex(of: "-qaIdentity"), index + 1 < arguments.count {
                flow.setInput(arguments[index + 1])
            } else {
                flow.demoFill(.phone(PhoneNumber(countryID: "AE", nsn: "501234567")))
            }
            try? await Task.sleep(for: .seconds(1.6))
            flow.submitIdentifier()
            if ProcessInfo.processInfo.arguments.contains("-qaCreatePassword") {
                // New customer: agree, then "Sign up with password" on the code screen.
                try? await Task.sleep(for: .seconds(1.4))
                flow.submitIdentifier()
                try? await Task.sleep(for: .seconds(1.6))
                flow.switchToCreatePassword()
                if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-qaNewPassword"), index + 1 < ProcessInfo.processInfo.arguments.count {
                    try? await Task.sleep(for: .seconds(1.0))
                    flow.newPassword = ProcessInfo.processInfo.arguments[index + 1]
                }
                return
            }
            if let index = ProcessInfo.processInfo.arguments.firstIndex(of: "-qaCode"), index + 1 < ProcessInfo.processInfo.arguments.count {
                try? await Task.sleep(for: .seconds(2.0))
                flow.typeCode(ProcessInfo.processInfo.arguments[index + 1])
                return
            }
            guard ProcessInfo.processInfo.arguments.contains("-qaPassword") else { return }
            // Code → password (before autofill), a wrong password, back to the code, then in.
            try? await Task.sleep(for: .seconds(2.0))
            flow.switchToPassword()
            try? await Task.sleep(for: .seconds(2.0))
            flow.password = "abc"
            flow.submitPassword()
            try? await Task.sleep(for: .seconds(2.4))
            flow.switchToCode()
            try? await Task.sleep(for: .seconds(1.8))
            flow.switchToPassword()
            try? await Task.sleep(for: .seconds(1.2))
            flow.password = "secret1"
            flow.submitPassword()
        }
    }
    #endif

    // MARK: - Sign-in lifecycle

    private func authenticated(_ account: Account, isNew: Bool, origin: CGPoint) {
        usedPasskey = flow.biometricState == .scanning
        session = account
        sessionIsNew = isNew
        store.remember(account)
        authHeaderIsLight = false

        let title: String
        let subtitle: String
        if isNew {
            title = lang.t("Welcome to noon", "أهلاً بك في نون")
            subtitle = lang.t("Your account is ready", "حسابك جاهز")
        } else if let name = account.firstName {
            title = lang.t("Welcome back, \(name)", "أهلاً بعودتك، \(name)")
            subtitle = lang.t("You're signed in", "تم تسجيل دخولك")
        } else {
            title = lang.t("Welcome back", "أهلاً بعودتك")
            subtitle = lang.t("You're signed in", "تم تسجيل دخولك")
        }
        let initial: String? = if let first = account.firstName?.first {
            String(first)
        } else if case .email(let email) = account.identifier, let first = email.first {
            String(first).uppercased()
        } else {
            nil
        }
        celebrationStage = .resolve
        sheetCoversStatusBar = false
        celebration = Celebration(origin: origin, initial: initial, title: title, subtitle: subtitle, landsOnAccount: authEntry == nil)
    }

    // MARK: - Other entry points

    /// Checkout needs an account: signed out, sign-in opens full screen; signed in, carry on.
    func beginCheckout() {
        if phase == .signedIn {
            withAnimation(.spring(duration: 0.45, bounce: 0)) { showsCheckout = true }
        } else {
            presentAuth(.checkout)
        }
    }

    /// Prototype controls: someone opened a "save this address" link.
    func openAddressLink() {
        if phase == .signedIn {
            showToast(lang.t("Address saved to your account", "تم حفظ العنوان في حسابك"))
        } else {
            presentAuth(.addressLink)
        }
    }

    /// The WhatsApp chat with the shared address link slides over the app.
    func openAddressChat() {
        withAnimation(.spring(duration: 0.45, bounce: 0)) { showsAddressChat = true }
    }

    /// The link in the chat was tapped: noon comes forward and asks to log in.
    func followAddressLink() {
        withAnimation(.spring(duration: 0.4, bounce: 0)) { showsAddressChat = false }
        Task {
            try? await Task.sleep(for: .milliseconds(250))
            openAddressLink()
        }
    }

    func closeAddressChat() {
        withAnimation(.spring(duration: 0.4, bounce: 0)) { showsAddressChat = false }
    }

    func closeAuthEntry() {
        withAnimation(.spring(duration: 0.45, bounce: 0)) { authEntry = nil }
        authHeaderIsLight = false
    }

    private func presentAuth(_ entry: AuthEntry) {
        if flow.isSeparate {
            // Checkout and links open straight on Log in; ✕ closes and returns.
            restartAuth(animated: false)
            flow.prepareDirectLogin()
        } else if flow.step != .identify && flow.step != .remembered {
            restartAuth(animated: false)
        }
        withAnimation(.spring(duration: 0.5, bounce: 0)) { authEntry = entry }
    }

    func showToast(_ message: String) {
        withAnimation(.spring(duration: 0.4, bounce: 0)) { toast = message }
        Task {
            try? await Task.sleep(for: .seconds(2.6))
            guard toast == message else { return }
            withAnimation(.easeOut(duration: 0.3)) { toast = nil }
        }
    }

    // MARK: - Celebration beats

    /// The sheet starts growing to fill the screen.
    func celebrationClearing() {
        celebrationStage = .clear
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            guard celebration != nil else { return }
            sheetCoversStatusBar = true
        }
    }

    /// The sheet is the page now: swap sign-in for the account page underneath the greeting.
    func celebrationCovered() {
        celebrationStage = .greet
        accountRevealed = false
        phase = .signedIn
    }

    /// The avatar heads for the profile card: raise the page to meet it.
    func celebrationLanding() {
        celebrationStage = .land
        accountRevealed = true
    }

    func celebrationFinished() {
        let landed = celebration?.landsOnAccount ?? true
        celebration = nil
        if !landed, let entry = authEntry {
            // Back to where sign-in was asked for.
            withAnimation(.spring(duration: 0.45, bounce: 0)) {
                authEntry = nil
                if entry == .checkout { showsCheckout = true }
            }
            if entry == .addressLink { showToast(lang.t("You're signed in. Address saved.", "تم تسجيل دخولك وحفظ العنوان.")) }
        }
        // A code-based sign-in is the moment to offer the one-tap alternative. The separate flow
        // offers it once, only to accounts without a passkey, and waits out a cooldown if dismissed.
        guard !usedPasskey, Biometrics.kind != .none, store.remembered?.passkeyEnabled == false else { return }
        if flow.isSeparate {
            guard !store.passkeyOfferCoolingDown else { return }
            if let session, AuthService.hasPasskey(session, remembered: nil) { return }
        }
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            guard phase == .signedIn, celebration == nil else { return }
            showsFaceIDOffer = true
        }
    }

    func dismissFaceIDOffer() {
        // Dismissed without turning it on: start the cooldown before offering again.
        if store.remembered?.passkeyEnabled == false { store.passkeyOfferDismissedAt = Date() }
        showsFaceIDOffer = false
    }

    func setPasskey(enabled: Bool) {
        store.remembered?.passkeyEnabled = enabled
    }

    func signOut() {
        session = nil
        showsFaceIDOffer = false
        showsCheckout = false
        restartAuth(animated: true)
    }

    func toggleLanguage() {
        withAnimation(.easeInOut(duration: 0.25)) {
            lang = lang == .en ? .ar : .en
        }
    }

    /// Prototype controls: which identify screen to test. Takes effect on the current sheet.
    var loginVariant: LoginVariant {
        get { store.loginVariant }
        set {
            let familyChanges = (store.loginVariant == .separate) != (newValue == .separate)
            store.loginVariant = newValue
            // The separate flow has its own screens (Welcome, Log in, Sign up): start it fresh.
            if familyChanges { restartAuth(animated: true) } else { flow.setVariant(newValue) }
        }
    }

    func selectMarket(_ country: Country) {
        market = country
        if flow.kind != .email { flow.selectCountry(country) }
    }

    // MARK: - Prototype controls

    func apply(_ scenario: Scenario) {
        switch scenario {
        case .newDevice:
            store.remembered = nil
        case .rememberedCode:
            store.remembered = RememberedAccount(account: AuthService.anmolEmail, passkeyEnabled: false)
        case .rememberedFaceID:
            store.remembered = RememberedAccount(account: AuthService.anmolEmail, passkeyEnabled: true)
        }
        restartAuth(animated: false)
    }

    func demoFill(_ identifier: Identifier) {
        selectedTab = .account
        if phase != .signedOut { restartAuth(animated: false) }
        flow.demoFill(identifier)
    }

    func resetPrototype() {
        store.resetAll()
        restartAuth(animated: false)
    }

    private func restartAuth(animated: Bool) {
        let fresh = AuthFlow(store: store)
        wire(fresh)
        introPending = true
        authHeaderIsLight = false
        let reset = {
            self.flow = fresh
            self.phase = .signedOut
            self.accountRevealed = false
            self.sheetCoversStatusBar = false
            self.showsFaceIDOffer = false
            self.celebration = nil
        }
        if animated {
            withAnimation(.spring(duration: 0.5, bounce: 0), reset)
        } else {
            reset()
        }
    }

    private func wire(_ flow: AuthFlow) {
        flow.onAuthenticated = { [weak self] account, isNew, origin in
            self?.authenticated(account, isNew: isNew, origin: origin)
        }
    }
}
