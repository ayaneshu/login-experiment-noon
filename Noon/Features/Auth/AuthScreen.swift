import SwiftUI

/// Where sign-in was opened from. My Account shows the market, language and the noon One offer;
/// checkout and links open it full screen with noon's wordmark and a close button.
enum AuthEntry: Equatable {
    case account, checkout, addressLink
    var isMyAccount: Bool { self == .account }
}

/// What stands above the resting sheet.
enum AuthHeaderArt: Equatable {
    /// noon's shopping scene (smart field, and the visual for other entry points).
    case hero
    /// The noon One Credit Card offer (tabs flow and Choose your account).
    case noonOne
    /// Separate flow: the carousel above Welcome and Choose your account.
    case carousel
}

enum AuthLayout {
    /// Figma frames put the header controls right under a 62pt status bar and measure everything
    /// else from there, so offsets are relative to the top safe area. At rest the sheet is sized to
    /// its content and sits on the nav; these are the highest it goes.
    static func restSheetOffset(art: AuthHeaderArt, entry: AuthEntry) -> CGFloat {
        if !entry.isMyAccount { return (401 - 62).scaled }   // checkout / link: Figma 401
        switch art {
        case .hero: return (309 - 62).scaled                 // smart field: Figma 309
        case .noonOne: return (360 - 62).scaled              // tabs, Choose your account: Figma 360
        case .carousel: return (358 - 62).scaled             // separate Welcome: Figma 358 (Choose your account 360)
        }
    }
    /// Figma sheet padding: 20 above the title in the smart flow, 32 under a grabber, 24 while typing.
    static let sheetTopPadding: CGFloat = 20.scaled
    static let grabberTopPadding: CGFloat = 32.scaled
    static let raisedTopPadding: CGFloat = 24.scaled
    /// Below the last thing above the fold; the rest of the footer comes up with the sheet.
    static let sheetBottomPadding: CGFloat = 20.scaled
    static let chooseBottomPadding: CGFloat = 20.scaled
    /// While typing, the main action sits at a fixed height in the sheet (Figma: the button's top
    /// 324pt below the sheet's top) so it never jumps as helper text comes and goes. Measured from
    /// the top padding to the action's bottom edge. A taller keyboard pulls it up to stay above the keys.
    static let raisedStageHeight: CGFloat = (324 - 24 + 56).scaled
    /// Typing: the sheet rises to just under the header controls.
    static let raisedSheetOffset: CGFloat = 58.scaled
    static let sheetRadius: CGFloat = FieldRadius.r24
}

extension EnvironmentValues {
    /// Signed in: the sheet's content is dissolving so the avatar can take over.
    @Entry var authLeaving = false
}

enum Links {
    static func privacyPolicy(_ lang: Lang) -> URL {
        URL(string: lang == .ar ? "https://www.noon.com/uae-ar/privacy-policy/" : "https://www.noon.com/uae-en/privacy-policy/")!
    }
    static let policies = URL(string: "https://www.noon.com/uae-en/terms-of-use/")!
    static let sellOnNoon = URL(string: "https://sell.noon.com/")!
    static let facebook = URL(string: "https://www.facebook.com/noon")!
    static let x = URL(string: "https://x.com/noon")!
    static let instagram = URL(string: "https://www.instagram.com/noon")!
    static let linkedIn = URL(string: "https://www.linkedin.com/company/noon")!
    static let noonOne = URL(string: "https://www.noon.com/uae-en/")!
    static let forgotPassword = URL(string: "https://www.noon.com/uae-en/account/")!
}

/// Signed-out Account tab: a reactive colour header and one white sheet whose content changes
/// step by step. The sheet rises while you type and grows into the account page once you're in.
struct AuthScreen: View {
    @Environment(AppModel.self) private var app
    @Bindable var flow: AuthFlow
    /// Signed in: everything on the sheet dissolves except the code, which resolves into the avatar.
    let leaving: Bool
    /// The sheet grows to fill the screen and becomes the account page's background.
    let expanded: Bool
    var entry: AuthEntry = .account
    var onClose: () -> Void = {}

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focus: AuthField?
    /// The identifier field is UIKit-backed, so its focus is tracked separately.
    @State private var identifierFocused = false
    @State private var entered = false
    @State private var showsCountryPicker = false
    /// Separate flow: the new country code sheet (drawn in the app, over the form).
    @State private var showsCountrySheet = false
    @State private var webLink: WebLink?
    @State private var chooseContentHeight: CGFloat = 400
    @State private var identifyContentHeight: CGFloat = 361
    @State private var errorShakes = 0
    /// Dissolved content leaves the hierarchy so the keyboard's exit can't reflow it back into view.
    @State private var contentRemoved = false
    /// How far a resting sheet has been pulled up over the artwork to show the rest of the footer.
    /// The sheet itself moves, as it does for typing; its content never scrolls under its edge.
    @State private var sheetLift: CGFloat = 0
    @State private var dragStartLift: CGFloat?
    @GestureState private var sheetDragging = false
    /// Everything on the resting sheet, footer included.
    @State private var restContentHeight: CGFloat = 0

    private var isRaised: Bool {
        switch flow.step {
        case .otp, .password, .createPassword, .login, .signup: true
        case .identify: identifierFocused
        case .remembered, .welcome: false
        }
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            let keyboardUp = geo.safeAreaInsets.bottom > 120
            let restOffset = restSheetOffset(height: geo.size.height)
            let maxLift = maxSheetLift(height: geo.size.height, restOffset: restOffset)
            let offset = isRaised ? AuthLayout.raisedSheetOffset : restOffset - sheetLift
            let introShift = entered || reduceMotion ? 0 : geo.size.height + safeTop
            let visible = max(0, geo.size.height - max(offset, 0))

            ZStack(alignment: .top) {
                AuthBackdrop(
                    flow: flow,
                    sheetTop: expanded ? 0 : safeTop + offset,
                    restSheetTop: safeTop + restOffset,
                    safeTop: safeTop,
                    // Pulled most of the way up, the sheet has covered the artwork: it dissolves as it does for typing.
                    showsIllustration: showsIllustration && entered && !(maxLift > 24 && sheetLift > maxLift / 2),
                    headerArt: headerArt,
                    entry: entry,
                    showsBack: isRaised || flow.canGoBack,
                    showsGrabber: showsGrabber,
                    expanded: expanded,
                    introShift: introShift,
                    onBack: back,
                    onSwitchLanguage: switchLanguage,
                    onTapHeader: {
                        if sheetLift > 0 {
                            settleSheet(to: 0)
                        } else if flow.step == .identify {
                            identifierFocused = false
                        }
                    },
                    onClose: onClose,
                    onApplyNoonOne: { webLink = WebLink(url: Links.noonOne) },
                    formChip: formChip,
                    leadingClose: flow.showsCloseInsteadOfBack && !leaving
                )
                .ignoresSafeArea()

                if !contentRemoved {
                    sheetContent(visibleHeight: visible, keyboardUp: keyboardUp)
                        .frame(width: geo.size.width, height: visible, alignment: .top)
                        .contentShape(Rectangle())
                        .gesture(sheetDrag(maxLift: maxLift), including: isRaised ? .subviews : .all)
                        .accessibilityScrollAction { edge in
                            guard !isRaised else { return }
                            settleSheet(to: edge == .bottom ? maxLift : 0)
                        }
                        .padding(.top, max(offset, 0))
                        .offset(y: introShift)
                        .modifier(Materialize(opacity: leaving ? 0 : 1, blur: leaving ? 4 : 0))
                        .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.3), value: leaving)
                        .environment(\.authLeaving, leaving)
                        .allowsHitTesting(!leaving)
                }

                // "This account has a passkey": offered before a code is sent.
                if let account = flow.passkeyOffer {
                    PasskeyFoundSheet(flow: flow, account: account)
                        .ignoresSafeArea(.keyboard)
                        .transition(.opacity)
                        .zIndex(2)
                }

                // Separate flow: the system-style "Use Face ID to sign in?" sheet for a saved account.
                if flow.showsFaceIDPrompt, let remembered = flow.remembered {
                    FaceIDPromptSheet(flow: flow, account: remembered.account)
                        .ignoresSafeArea()
                        .transition(.opacity)
                        .zIndex(3)
                }

                if showsCountrySheet {
                    CountrySheet(selected: flow.country) { country in
                        if let country { flow.selectCountry(country) }
                        showsCountrySheet = false
                        // The number field keeps focus.
                        identifierFocused = true
                    }
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .zIndex(3)
                }
            }
        }
        .animation(Motion.smooth, value: isRaised)
        .animation(Motion.smooth, value: flow.step)
        .animation(.spring(duration: 0.7, bounce: 0), value: expanded)
        .onAppear(perform: runIntro)
        .onChange(of: showsCountrySheet) { _, up in app.authSheetUp = up }
        .onChange(of: isRaised) { _, raised in
            // The raised sheet ignores the lift; come back down to rest, not to where it was pulled.
            if raised { sheetLift = 0 }
        }
        .onChange(of: sheetDragging) { _, dragging in
            // A cancelled drag never reports its end; settle from wherever it was left.
            guard !dragging, dragStartLift != nil else { return }
            dragStartLift = nil
            settleSheet(to: 0)
        }
        .onChange(of: flow.step) { _, step in
            if sheetLift != 0 { withAnimation(Motion.smooth) { sheetLift = 0 } }
            identifierFocused = step == .identify || step == .login || step == .signup
            switch step {
            case .identify, .remembered, .welcome, .login, .signup: focus = nil
            case .otp: focus = .otp
            case .password, .createPassword: focus = .password
            }
        }
        .onChange(of: leaving) { _, isLeaving in
            guard isLeaving else { return }
            // Once the content has dissolved, take it out entirely; the keyboard leaves with it.
            Task {
                try? await Task.sleep(for: .milliseconds(300))
                contentRemoved = true
                focus = nil
                identifierFocused = false
            }
        }
        .onChange(of: flow.headerEvent) { _, event in
            if event?.kind == .error, flow.step == .identify || flow.isAccountForm { errorShakes += 1 }
        }
        .onChange(of: flow.passkeyOffer?.identifier.key) { _, key in
            // The sheet takes over from the keyboard; it comes back if they choose a code.
            if key != nil { identifierFocused = false }
        }
        .sensoryFeedback(.selection, trigger: flow.kind)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.5), trigger: flow.rejectedKeystrokes)
        .sensoryFeedback(trigger: flow.headerEvent) { _, event in
            switch event?.kind {
            case .success: .success
            case .error: .error
            case .welcome: .impact(weight: .medium, intensity: 0.8)
            case nil: nil
            }
        }
        .sheet(isPresented: $showsCountryPicker, onDismiss: {
            if flow.step == .identify { identifierFocused = true }
        }) {
            CountryPicker(selected: flow.country) { flow.selectCountry($0) }
                .environment(\.lang, lang)
                .environment(\.layoutDirection, lang.layoutDirection)
        }
        .sheet(item: $webLink) { link in
            SafariView(url: link.url).ignoresSafeArea()
        }
    }

    // MARK: - Layout

    private var showsIllustration: Bool {
        !isRaised && !leaving && (flow.step == .identify || flow.step == .remembered || flow.step == .welcome)
    }

    private var headerArt: AuthHeaderArt {
        guard entry.isMyAccount else { return .hero }
        if flow.isSeparate { return .carousel }
        return flow.step == .remembered || flow.variant == .toggle ? .noonOne : .hero
    }

    /// The new layouts rest the sheet under a grabber; the smart field's sheet has none.
    private var showsGrabber: Bool {
        // Welcome's footer sits under the nav until the sheet is pulled up, so it gets the grabber too.
        !isRaised && (headerArt == .noonOne || (headerArt == .carousel && (flow.step == .remembered || flow.step == .welcome)) || !entry.isMyAccount)
    }

    /// Separate flow: the header chip that swaps Log in and Sign up, keeping what was typed.
    private var formChip: HeaderFormChip? {
        guard flow.isAccountForm, !leaving else { return nil }
        return flow.step == .login
            ? HeaderFormChip(title: lang.t("New account", "حساب جديد"), showsPlus: true, action: flow.switchAccountForm)
            : HeaderFormChip(title: lang.t("Log in", "تسجيل الدخول"), showsPlus: false, action: flow.switchAccountForm)
    }

    private func openCountryPicker() {
        if flow.isSeparate {
            // The keyboard steps aside for the sheet and comes back once a country is picked.
            identifierFocused = false
            withAnimation(.spring(duration: 0.45, bounce: 0)) { showsCountrySheet = true }
        } else {
            showsCountryPicker = true
        }
    }

    /// The tab bar sits under the sheet on My Account; other entry points are full screen.
    private var navHeight: CGFloat { entry.isMyAccount ? BottomNav.barHeight : 0 }

    private var restTopPadding: CGFloat {
        showsGrabber ? AuthLayout.grabberTopPadding : AuthLayout.sheetTopPadding
    }

    private func restSheetOffset(height: CGFloat) -> CGFloat {
        flow.step == .remembered ? chooseRestOffset(height: height) : identifyRestOffset(height: height)
    }

    /// How far the resting sheet can be pulled up: until all of its content sits on the nav, but
    /// never over the header controls.
    private func maxSheetLift(height: CGFloat, restOffset: CGFloat) -> CGFloat {
        let top = flow.step == .remembered ? AuthLayout.grabberTopPadding : restTopPadding
        let bottom = restBottomPadding
        let fullOffset = max(AuthLayout.raisedSheetOffset, height - navHeight - (top + restContentHeight + bottom))
        return max(0, restOffset - fullOffset)
    }

    private func chooseRestOffset(height: CGFloat) -> CGFloat {
        let sheetHeight = AuthLayout.grabberTopPadding + chooseContentHeight + AuthLayout.chooseBottomPadding
        return max(AuthLayout.restSheetOffset(art: .noonOne, entry: entry), height - navHeight - sheetHeight)
    }

    /// The resting sheet keeps the Figma frame's exact spacing and sits on the nav; a taller
    /// screen gives its extra height to the hero above instead of stretching gaps in the form.
    private func identifyRestOffset(height: CGFloat) -> CGFloat {
        let sheetHeight = restTopPadding + identifyContentHeight + restBottomPadding
        return max(AuthLayout.restSheetOffset(art: headerArt, entry: entry), height - navHeight - sheetHeight)
    }

    /// Below the content at rest. Welcome ends 23pt under "Create new account", its footer under
    /// the nav until the sheet is pulled up (Figma 1109:9154: sheet at 465, nav at 724).
    private var restBottomPadding: CGFloat {
        switch flow.step {
        case .remembered: AuthLayout.chooseBottomPadding
        case .welcome: 23.scaled
        default: AuthLayout.sheetBottomPadding
        }
    }

    private func sheetContent(visibleHeight: CGFloat, keyboardUp: Bool) -> some View {
        let restPadding = restBottomPadding
        let bottomInset = keyboardUp ? FieldSpace.s16 : navHeight + restPadding
        let topPadding = isRaised ? AuthLayout.raisedTopPadding : (flow.step == .remembered ? AuthLayout.grabberTopPadding : restTopPadding)
        // The design's fixed spot for the bottom action, but never below what's visible.
        let stageHeight = min(AuthLayout.raisedStageHeight, max(0, visibleHeight - topPadding - bottomInset))
        return ScrollView {
            ZStack(alignment: .top) {
                switch flow.step {
                case .identify:
                    IdentifyStep(
                        flow: flow,
                        isFocused: $identifierFocused,
                        raised: isRaised,
                        stageHeight: stageHeight,
                        errorShakes: errorShakes,
                        onCountryTap: openCountryPicker,
                        onOpen: { webLink = WebLink(url: $0) },
                        onFoldHeight: { height in if !isRaised { identifyContentHeight = height } },
                        showsFooter: entry.isMyAccount
                    )
                    .transition(stepTransition)
                case .remembered:
                    ChooseAccountStep(flow: flow, onOpen: { webLink = WebLink(url: $0) }, onFoldHeight: { chooseContentHeight = $0 })
                        .transition(stepTransition)
                case .welcome:
                    WelcomeStep(flow: flow, onOpen: { webLink = WebLink(url: $0) }, onFoldHeight: { height in
                        if !isRaised { identifyContentHeight = height }
                    })
                    .transition(stepTransition)
                case .login, .signup:
                    // One view for both, so the header chip morphs Log in into Sign up in place.
                    AccountFormStep(
                        flow: flow,
                        isFocused: $identifierFocused,
                        stageHeight: stageHeight,
                        errorShakes: errorShakes,
                        onCountryTap: openCountryPicker,
                        onOpen: { webLink = WebLink(url: $0) }
                    )
                    .transition(stepTransition)
                case .otp, .password, .createPassword:
                    // One view for both, so switching between code and password morphs in place.
                    VerifyStep(flow: flow, focus: $focus, stageHeight: stageHeight, onOpen: { webLink = WebLink(url: $0) })
                        .transition(stepTransition)
                }
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                if !isRaised { restContentHeight = height }
            }
            .padding(.horizontal, FieldSpace.s16)
            .padding(.top, topPadding)
            .padding(.bottom, bottomInset)
        }
        // At rest the whole sheet moves instead (see `sheetDrag`).
        .scrollDisabled(!isRaised)
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(flow.step == .identify ? .interactively : .never)
        .scrollIndicators(.hidden)
    }

    private var stepTransition: AnyTransition {
        .step(flow.direction, rtl: lang.isRTL, reduceMotion: reduceMotion)
    }

    // MARK: - Pulling the resting sheet

    /// The resting sheet follows the finger up over the artwork, resists past either end, and on
    /// release carries its momentum to whichever end it's heading for.
    private func sheetDrag(maxLift: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 8, coordinateSpace: .global)
            .updating($sheetDragging) { _, dragging, _ in dragging = true }
            .onChanged { value in
                let start = dragStartLift ?? sheetLift
                if dragStartLift == nil { dragStartLift = start }
                // Starts from where the sheet is, so grabbing it mid-settle doesn't jump.
                withAnimation(.interactiveSpring(response: 0.16, dampingFraction: 0.86)) {
                    sheetLift = rubberBanded(start - value.translation.height, limit: maxLift)
                }
            }
            .onEnded { value in
                dragStartLift = nil
                // Where a flick would coast to (Apple's scroll deceleration), then the nearer end.
                let velocity = -value.velocity.height
                let projected = sheetLift + velocity / 1000 * 0.998 / (1 - 0.998)
                settleSheet(to: projected > maxLift / 2 ? maxLift : 0)
            }
    }

    /// Springs keep the release velocity, so the sheet carries on at the finger's speed.
    private func settleSheet(to lift: CGFloat) {
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.4, dampingFraction: 0.84)) {
            sheetLift = lift
        }
    }

    /// Past either end the sheet slows down rather than stopping dead.
    private func rubberBanded(_ value: CGFloat, limit: CGFloat) -> CGFloat {
        func band(_ overshoot: CGFloat) -> CGFloat {
            let dimension: CGFloat = 300
            return (overshoot * dimension * 0.55) / (dimension + 0.55 * overshoot)
        }
        if value < 0 { return -band(-value) }
        if value > limit { return limit + band(value - limit) }
        return value
    }

    // MARK: - Actions

    /// While typing, Back puts the keyboard away first; after that it steps back through the flow.
    private func back() {
        if flow.step == .identify, identifierFocused {
            identifierFocused = false
        } else {
            flow.back()
        }
    }

    private func switchLanguage() {
        app.restoreKeyboard = identifierFocused || focus != nil
        app.toggleLanguage()
    }

    private func runIntro() {
        guard !entered else { return }
        // Opened straight on Log in (checkout, a link): the field is ready to type into.
        if flow.isAccountForm {
            Task {
                try? await Task.sleep(for: .milliseconds(450))
                identifierFocused = true
            }
        }
        if app.introPending {
            app.introPending = false
            withAnimation(.spring(duration: 0.8, bounce: 0).delay(0.1)) { entered = true }
            #if DEBUG
            // QA hook for screenshots of the typing layout: launch with `-qaFocusField`.
            if ProcessInfo.processInfo.arguments.contains("-qaFocusField"), flow.step == .identify {
                Task {
                    try? await Task.sleep(for: .seconds(1.2))
                    identifierFocused = true
                }
            }
            #endif
        } else {
            entered = true
            // Rebuilt after a language switch: put the keyboard back if it was up.
            guard app.restoreKeyboard else { return }
            app.restoreKeyboard = false
            switch flow.step {
            case .identify, .login, .signup: identifierFocused = true
            case .otp: focus = .otp
            case .password, .createPassword: focus = .password
            case .remembered, .welcome: break
            }
        }
    }
}

// MARK: - Shared step pieces

/// Page Title: H24 Bold title over a B14 Regular subtitle, inset 4pt like the Figma component.
struct AuthTitle: View {
    let title: String
    var subtitle: String?
    /// Figma: 8 at rest, 24 on the typing screens, none on "Choose your account".
    var bottomPadding: CGFloat = FieldSpace.s8

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s4) {
            Text(title)
                .fieldText(.h24Bold)
                .foregroundStyle(FieldColour.TextNIcon.primary)
                // A changed title rewrites itself in place rather than swapping.
                .contentTransition(.interpolate)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle)
                    .fieldText(.b14Regular)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, FieldSpace.s4)
        .padding(.bottom, bottomPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// "Sent on ajain@gmail.com ✉︎ • Change", "Sent on +971 50 123 4567 via (WhatsApp) • Change":
/// who we're verifying, and the way back to fix it.
struct SentToRow: View {
    enum Icon {
        /// Tinted like the text (email, SMS).
        case template(String)
        /// Brand colours kept (WhatsApp).
        case original(String)
    }

    let prefix: String
    let identifier: Identifier
    var suffix: String?
    var channelIcon: Icon?
    var changeTitle: String
    var onChange: () -> Void

    var body: some View {
        HStack(spacing: FieldSpace.s6) {
            Text("\(prefix) \(ltr(identifier.display))\(suffix.map { " \($0)" } ?? "")")
                .fieldText(.b14Regular)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .lineLimit(1)
                .truncationMode(.middle)
                .contentTransition(.interpolate)
            if let channelIcon {
                icon(channelIcon)
                    .frame(width: 16.scaled, height: 16.scaled)
                    .transition(.iconSwap)
                    .accessibilityHidden(true)
            }
            Circle()
                .fill(FieldColour.TextNIcon.action)
                .frame(width: 4.scaled, height: 4.scaled)
                .padding(.horizontal, FieldSpace.s2)
                .accessibilityHidden(true)
            Button(action: onChange) {
                Text(changeTitle)
                    .fieldText(.b14Medium)
                    .foregroundStyle(FieldColour.TextNIcon.action)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.96))
        }
        .padding(.horizontal, FieldSpace.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        // The Change button keeps a 44pt touch target without adding to the row's 20pt height.
        .padding(.vertical, -(44 - 20.scaled) / 2)
    }

    @ViewBuilder
    private func icon(_ icon: Icon) -> some View {
        switch icon {
        case .template(let name):
            Image(name)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
        case .original(let name):
            Image(name)
                .resizable()
                .scaledToFit()
        }
    }
}
