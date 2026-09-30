import SwiftUI

enum AuthLayout {
    /// Figma frames put the header controls right under a 62pt status bar and measure everything
    /// else from there, so offsets are relative to the top safe area. At rest the sheet is sized to
    /// its content and sits on the nav; this is the highest it goes (Figma: 319 − 62).
    static let restSheetOffset: CGFloat = 257.scaled
    /// Figma sheet padding: 20 above the title at rest, 24 while typing; 24 below the footer and
    /// 32 below "Choose your account".
    static let sheetTopPadding: CGFloat = 20.scaled
    static let raisedTopPadding: CGFloat = 24.scaled
    static let sheetBottomPadding: CGFloat = 24.scaled
    static let chooseBottomPadding: CGFloat = 32.scaled
    /// While typing, the main action sits at a fixed height in the sheet (Figma: the button's top
    /// 324pt below the sheet's top, the password link's at 352) so it never jumps as helper text
    /// comes and goes. Measured from the top padding to the action's bottom edge. A taller keyboard
    /// (a real iPhone adds a suggestion bar for SMS codes) pulls it up to stay above the keys.
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

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focus: AuthField?
    /// The identifier field is UIKit-backed, so its focus is tracked separately.
    @State private var identifierFocused = false
    @State private var entered = false
    @State private var showsCountryPicker = false
    @State private var webLink: WebLink?
    @State private var chooseContentHeight: CGFloat = 400
    @State private var identifyContentHeight: CGFloat = 361
    @State private var errorShakes = 0
    /// Dissolved content leaves the hierarchy so the keyboard's exit can't reflow it back into view.
    @State private var contentRemoved = false

    private var isRaised: Bool {
        switch flow.step {
        case .otp, .password: true
        case .identify: identifierFocused
        case .remembered: false
        }
    }

    var body: some View {
        GeometryReader { geo in
            let safeTop = geo.safeAreaInsets.top
            let keyboardUp = geo.safeAreaInsets.bottom > 120
            let offset = sheetOffset(height: geo.size.height, safeTop: safeTop)
            let restOffset = flow.step == .remembered ? chooseRestOffset(height: geo.size.height) : identifyRestOffset(height: geo.size.height)
            let introShift = entered || reduceMotion ? 0 : geo.size.height + safeTop
            let visible = max(0, geo.size.height - max(offset, 0))

            ZStack(alignment: .top) {
                AuthBackdrop(
                    flow: flow,
                    sheetTop: expanded ? 0 : safeTop + offset,
                    restSheetTop: safeTop + restOffset,
                    safeTop: safeTop,
                    showsIllustration: showsIllustration && entered,
                    showsBack: isRaised || flow.canGoBack,
                    expanded: expanded,
                    introShift: introShift,
                    onBack: back,
                    onSwitchLanguage: switchLanguage,
                    onTapHeader: { if flow.step == .identify { identifierFocused = false } }
                )
                .ignoresSafeArea()

                if !contentRemoved {
                    sheetContent(visibleHeight: visible, keyboardUp: keyboardUp)
                        .frame(width: geo.size.width, height: visible, alignment: .top)
                        .padding(.top, max(offset, 0))
                        .offset(y: introShift)
                        .modifier(Materialize(opacity: leaving ? 0 : 1, blur: leaving ? 4 : 0))
                        .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.3), value: leaving)
                        .environment(\.authLeaving, leaving)
                        .allowsHitTesting(!leaving)
                }
            }
        }
        .animation(Motion.smooth, value: isRaised)
        .animation(Motion.smooth, value: flow.step)
        .animation(.spring(duration: 0.7, bounce: 0), value: expanded)
        .onAppear(perform: runIntro)
        .onChange(of: flow.step) { _, step in
            identifierFocused = step == .identify
            switch step {
            case .identify, .remembered: focus = nil
            case .otp: focus = .otp
            case .password: focus = .password
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
            if event?.kind == .error, flow.step == .identify { errorShakes += 1 }
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
        !isRaised && !leaving && flow.step != .otp && flow.step != .password
    }

    private func sheetOffset(height: CGFloat, safeTop: CGFloat) -> CGFloat {
        if isRaised { return AuthLayout.raisedSheetOffset }
        if flow.step == .remembered { return chooseRestOffset(height: height) }
        return identifyRestOffset(height: height)
    }

    private func chooseRestOffset(height: CGFloat) -> CGFloat {
        let sheetHeight = AuthLayout.sheetTopPadding + chooseContentHeight + AuthLayout.chooseBottomPadding
        return max(AuthLayout.restSheetOffset, height - BottomNav.barHeight - sheetHeight)
    }

    /// The resting sheet keeps the Figma frame's exact spacing and sits on the nav; a taller
    /// screen gives its extra height to the hero above instead of stretching gaps in the form.
    private func identifyRestOffset(height: CGFloat) -> CGFloat {
        let sheetHeight = AuthLayout.sheetTopPadding + identifyContentHeight + AuthLayout.sheetBottomPadding
        return max(AuthLayout.restSheetOffset, height - BottomNav.barHeight - sheetHeight)
    }

    private func sheetContent(visibleHeight: CGFloat, keyboardUp: Bool) -> some View {
        let restPadding = flow.step == .remembered ? AuthLayout.chooseBottomPadding : AuthLayout.sheetBottomPadding
        let bottomInset = keyboardUp ? FieldSpace.s16 : BottomNav.barHeight + restPadding
        let topPadding = isRaised ? AuthLayout.raisedTopPadding : AuthLayout.sheetTopPadding
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
                        onCountryTap: { showsCountryPicker = true },
                        onOpen: { webLink = WebLink(url: $0) }
                    )
                    .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                        if !isRaised { identifyContentHeight = height }
                    }
                    .transition(stepTransition)
                case .remembered:
                    ChooseAccountStep(flow: flow)
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { chooseContentHeight = $0 }
                        .transition(stepTransition)
                case .otp, .password:
                    // One view for both, so switching between code and password morphs in place.
                    VerifyStep(flow: flow, focus: $focus, stageHeight: stageHeight)
                        .transition(stepTransition)
                }
            }
            .padding(.horizontal, FieldSpace.s16)
            .padding(.top, topPadding)
            .padding(.bottom, bottomInset)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(flow.step == .identify ? .interactively : .never)
        .scrollIndicators(.hidden)
    }

    private var stepTransition: AnyTransition {
        .step(flow.direction, rtl: lang.isRTL, reduceMotion: reduceMotion)
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
            case .identify: identifierFocused = true
            case .otp: focus = .otp
            case .password: focus = .password
            case .remembered: break
            }
        }
    }
}

// MARK: - Shared step pieces

/// Page Title: H24 Bold title over a B14 Regular subtitle, inset 8pt like the Figma component.
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
        .padding(.horizontal, FieldSpace.s8)
        .padding(.bottom, bottomPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// "Sent on ajain@gmail.com ✉︎ • Change": who we're verifying, and the way back to fix it.
struct SentToRow: View {
    let prefix: String
    let identifier: Identifier
    var channelIcon: String?
    var changeTitle: String
    var onChange: () -> Void

    var body: some View {
        HStack(spacing: FieldSpace.s6) {
            Text("\(prefix) \(ltr(identifier.display))")
                .fieldText(.b14Regular)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .lineLimit(1)
                .truncationMode(.middle)
                .contentTransition(.interpolate)
            if let channelIcon {
                Image(channelIcon)
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 16.scaled, height: 16.scaled)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
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
        .padding(.horizontal, FieldSpace.s8)
        .frame(maxWidth: .infinity, alignment: .leading)
        // The Change button keeps a 44pt touch target without adding to the row's 20pt height.
        .padding(.vertical, -(44 - 20.scaled) / 2)
    }
}
