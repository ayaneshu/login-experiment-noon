import SwiftUI

/// Everything behind and around the sheet: the header colour, its reactions, the hero artwork,
/// the header controls and the white sheet surface itself.
///
/// Reactions grow as a circle from whatever caused them (the field, the code, the button) and then
/// recede to the resting blue: green when we know you, orange when something needs fixing, yellow
/// with a wave for someone new.
struct AuthBackdrop: View {
    @Environment(AppModel.self) private var app
    var flow: AuthFlow
    /// Top of the sheet in screen coordinates.
    let sheetTop: CGFloat
    /// Where the sheet rests; the artwork stands on this line.
    let restSheetTop: CGFloat
    let safeTop: CGFloat
    let showsIllustration: Bool
    /// What stands above the sheet: noon's shopping scene, or the noon One card offer.
    let headerArt: AuthHeaderArt
    /// My Account shows the market and language; other entry points show noon and a close button.
    let entry: AuthEntry
    /// While typing or partway through verification, the header holds only a back button.
    let showsBack: Bool
    /// Resting sheets in the new layouts carry a grabber on their top edge.
    let showsGrabber: Bool
    /// Signed in: the sheet fills the screen in the account page's colour.
    let expanded: Bool
    /// Pushes the sheet below the screen during the entrance.
    let introShift: CGFloat
    var onBack: () -> Void
    var onSwitchLanguage: () -> Void
    var onTapHeader: () -> Void
    var onClose: () -> Void = {}
    var onApplyNoonOne: () -> Void = {}
    /// Separate flow, Log in / Sign up: the chip on the right ("New account" or "Log in").
    var formChip: HeaderFormChip? = nil
    /// Separate flow, opened from checkout or a link: ✕ on the left closes sign-in.
    var leadingClose = false

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var washes: [AuthFlow.HeaderEvent] = []
    @State private var wave: AuthFlow.HeaderEvent?

    private var isLight: Bool { app.authHeaderIsLight }
    private var controlForeground: Color {
        isLight ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.onSurfaceBold
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                HeaderTone.blue.gradient

                ForEach(washes, id: \.id) { event in
                    HeaderWash(
                        event: event,
                        size: geo.size,
                        settings: app.store.headerTransition,
                        onCovered: { app.authHeaderIsLight = event.kind == .welcome },
                        onReceding: {
                            if washes.last?.id == event.id { app.authHeaderIsLight = false }
                        },
                        onFinished: { washes.removeAll { $0.id == event.id } }
                    )
                }

                Color.clear
                    .contentShape(Rectangle())
                    .frame(height: max(0, sheetTop))
                    .frame(maxHeight: .infinity, alignment: .top)
                    .onTapGesture(perform: onTapHeader)

                switch headerArt {
                case .hero:
                    HeroIllustration(visible: showsIllustration)
                        // Artwork scales with the design, standing on the sheet's edge.
                        .scaleEffect(FieldScale.factor, anchor: .bottom)
                        .position(x: geo.size.width / 2, y: restSheetTop - HeroIllustration.size.height / 2)
                        .allowsHitTesting(false)
                case .noonOne:
                    // Figma measures it from the top of the screen, status bar included.
                    NoonOneHeader(visible: showsIllustration, onApply: onApplyNoonOne)
                        .scaleEffect(FieldScale.factor, anchor: .topLeading)
                        .frame(width: NoonOneHeader.size.width * FieldScale.factor, height: NoonOneHeader.size.height * FieldScale.factor, alignment: .topLeading)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .offset(y: safeTop - 62.scaled)
                        .allowsHitTesting(showsIllustration)
                case .carousel:
                    // Centred in the blue between the top row and the resting sheet, so it sits right
                    // whether the sheet rests high (Choose your account) or low (Welcome).
                    WelcomeCarousel(visible: showsIllustration)
                        .scaleEffect(FieldScale.factor, anchor: .topLeading)
                        .frame(width: WelcomeCarousel.size.width * FieldScale.factor, height: WelcomeCarousel.size.height * FieldScale.factor, alignment: .topLeading)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .offset(y: carouselTop(safeTop: safeTop))
                        .allowsHitTesting(showsIllustration)
                }

                if let wave {
                    WavingHand()
                        .id(wave.id)
                        .position(x: geo.size.width * 0.44, y: sheetTop + 6)
                        .allowsHitTesting(false)
                }

                topRow
                    .padding(.top, safeTop)
                    .padding(.horizontal, FieldSpace.s12)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .opacity(expanded ? 0 : 1)
                    .animation(.easeOut(duration: 0.2), value: expanded)

                sheetSurface(height: geo.size.height)
            }
        }
        .onChange(of: flow.headerEvent) { _, event in
            guard let event else { return }
            washes.append(event)
            if washes.count > 3 { washes.removeFirst() }
            if event.kind == .welcome {
                wave = event
            } else {
                wave = nil
            }
        }
        .onDisappear { app.authHeaderIsLight = false }
        // Loaded ahead so the welcome sound starts on its exact beat the first time.
        .task { SoundEffects.shared.prepare(.welcomeNew) }
    }

    // MARK: - Header controls

    /// The carousel frame's top that centres its content between the top row (38pt under the
    /// status bar) and the resting sheet.
    private func carouselTop(safeTop: CGFloat) -> CGFloat {
        let rowBottom = safeTop + 38.scaled
        let content = WelcomeCarousel.contentHeight.scaled
        return rowBottom + (restSheetTop - rowBottom - content) / 2 - WelcomeCarousel.contentTop.scaled
    }

    private var topRow: some View {
        HStack(spacing: FieldSpace.s8) {
            if leadingClose {
                HeaderCloseButton(label: lang.t("Close", "إغلاق"), action: onClose)
                    .padding(.leading, -3)
                    .transition(headerTransition)
            } else if showsBack {
                // Overlay circle with a white arrow, on blue and on the yellow welcome alike.
                HeaderCircleButton(icon: .arrowLeft, foreground: FieldColour.TextNIcon.onSurfaceBold, label: lang.t("Back", "رجوع"), action: onBack)
                    .padding(.leading, -3)
                    .transition(headerTransition)
            } else if entry.isMyAccount {
                MarketPill(market: app.market, foreground: controlForeground) { app.selectMarket($0) }
                    .padding(.leading, FieldSpace.s4)
                    .transition(headerTransition)
            } else {
                Image(FieldArt.noonWordmark)
                    .renderingMode(.template)
                    .resizable()
                    .frame(width: 69.scaled, height: 18.scaled)
                    .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                    .padding(.leading, 6.scaled)
                    .transition(headerTransition)
                    .accessibilityLabel("noon")
            }

            Spacer(minLength: 0)

            if let formChip {
                FormChipButton(chip: formChip)
                    .id(formChip.title)
                    .transition(headerTransition)
            } else if !showsBack && !leadingClose {
                Group {
                    if entry.isMyAccount {
                        LanguageToggle(current: app.lang, onLight: isLight, action: onSwitchLanguage)
                    } else {
                        HeaderCloseButton(label: lang.t("Close", "إغلاق"), action: onClose)
                    }
                }
                .padding(.trailing, FieldSpace.s4)
                .transition(headerTransition)
            }
        }
        .frame(height: 38.scaled)
        .animation(.spring(duration: 0.4, bounce: 0), value: showsBack)
        .animation(.spring(duration: 0.4, bounce: 0), value: formChip?.title)
        .animation(FieldMotion.Easing.standard(FieldMotion.Duration.base), value: isLight)
    }

    private var headerTransition: AnyTransition {
        .asymmetric(
            insertion: .modifier(active: Materialize(opacity: 0, blur: 4, scale: 0.8), identity: Materialize()),
            removal: .modifier(active: Materialize(opacity: 0, blur: 2, scale: 0.9), identity: Materialize())
        )
    }

    // MARK: - Sheet

    private func sheetSurface(height: CGFloat) -> some View {
        let radius = expanded ? 0 : AuthLayout.sheetRadius
        return UnevenRoundedRectangle(topLeadingRadius: radius, topTrailingRadius: radius, style: .continuous)
            .fill(expanded ? FieldColour.Surface.tertiary : FieldColour.Surface.primary)
            .overlay(alignment: .top) {
                Capsule()
                    .fill(FieldPalette.AlphaDark.c16)
                    .frame(width: 36.scaled, height: 4.scaled)
                    .padding(.top, 12.scaled)
                    .opacity(showsGrabber && !expanded ? 1 : 0)
                    .animation(.easeOut(duration: 0.2), value: showsGrabber)
            }
            .frame(height: height + 40)
            .offset(y: sheetTop + introShift)
            .frame(maxHeight: .infinity, alignment: .top)
            .allowsHitTesting(false)
    }
}

// MARK: - Header chip

/// The chip on the right of the Log in / Sign up header: "+ New account" or "Log in".
struct HeaderFormChip: Equatable {
    let title: String
    var showsPlus: Bool
    var action: () -> Void

    static func == (lhs: HeaderFormChip, rhs: HeaderFormChip) -> Bool {
        lhs.title == rhs.title && lhs.showsPlus == rhs.showsPlus
    }
}

/// M-NeutralRoundButton on the header (Figma 1106:7079): a translucent pill, white label.
private struct FormChipButton: View {
    let chip: HeaderFormChip

    var body: some View {
        Button(action: chip.action) {
            HStack(spacing: FieldSpace.s6) {
                if chip.showsPlus {
                    FieldIcon(.plus, size: 20)
                }
                Text(chip.title)
                    .fieldText(.b13SemiBold)
                    .fixedSize()
            }
            .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
            .padding(.leading, chip.showsPlus ? FieldSpace.s12 : FieldSpace.s16)
            .padding(.trailing, FieldSpace.s16)
            .frame(height: 40.scaled)
            .background(Capsule().fill(FieldPalette.AlphaDark.c16))
            .contentShape(Capsule())
        }
        .buttonStyle(FieldPressStyle(scale: 0.96))
    }
}

// MARK: - Wave

/// A hand pops up from behind the sheet, waves hello, and ducks back down.
/// Placeholder artwork: swap the emoji for the final illustration.
private struct WavingHand: View {
    private struct Pose {
        var rise: CGFloat = 96
        var angle: Double = 12
    }

    @State private var play = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Text(verbatim: "👋🏽")
            .font(.system(size: 60.scaled))
            .frame(width: 80.scaled, height: 80.scaled, alignment: .bottom)
            .keyframeAnimator(initialValue: Pose(), trigger: play) { content, pose in
                content
                    .rotationEffect(.degrees(pose.angle), anchor: .bottom)
                    .offset(y: pose.rise - 40)
            } keyframes: { _ in
                KeyframeTrack(\.rise) {
                    LinearKeyframe(96, duration: 0.2)
                    SpringKeyframe(0, duration: 0.5, spring: .init(duration: 0.5, bounce: 0.25))
                    LinearKeyframe(0, duration: reduceMotion ? 1.3 : 1.15)
                    CubicKeyframe(96, duration: 0.4)
                }
                KeyframeTrack(\.angle) {
                    LinearKeyframe(12, duration: 0.55)
                    CubicKeyframe(wave(-8), duration: 0.18)
                    CubicKeyframe(wave(26), duration: 0.2)
                    CubicKeyframe(wave(-4), duration: 0.2)
                    CubicKeyframe(wave(22), duration: 0.2)
                    CubicKeyframe(wave(4), duration: 0.18)
                    CubicKeyframe(12, duration: 0.2)
                }
            }
            .onAppear {
                play = true
                // Pop as the hand clears the sheet (~0.3s), "hel-lo" on its two outward swings.
                SoundEffects.shared.play(.welcomeNew, after: 0.3)
            }
            .accessibilityHidden(true)
    }

    /// Reduce Motion keeps the hello but drops the swinging.
    private func wave(_ angle: Double) -> Double {
        reduceMotion ? 12 : angle
    }
}

// MARK: - Hero artwork

/// The logged-out artwork: noon's shopping-bag scene with two floating proof chips and sparkles.
/// Figma frame 337×148; the scene stands on the sheet's top edge.
struct HeroIllustration: View {
    let visible: Bool
    static let size = CGSize(width: 337.05, height: 148)

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var twinkle = false

    var body: some View {
        ZStack(alignment: .topLeading) {
            Image(FieldArt.heroIllustration)
                .resizable()
                .frame(width: 253, height: 146.9)
                .offset(x: 44.77, y: 3.26)
                .modifier(Materialize(opacity: visible ? 1 : 0, scale: visible ? 1 : 0.94, y: visible ? 0 : 18))
                .animation(.spring(duration: 0.6, bounce: 0), value: visible)

            sparkle(at: CGPoint(x: 291.13, y: 52.82), delay: 0.25)
            sparkle(at: CGPoint(x: 48.19, y: 15.55), delay: 0.4)

            chip(lang.t("20M+ products", "+20 مليون منتج"))
                .offset(x: 234.9, y: 8)
                .modifier(Materialize(opacity: visible ? 1 : 0, blur: visible ? 0 : 4, scale: visible ? 1 : 0.9, y: visible ? 0 : 8))
                .animation(.spring(duration: 0.5, bounce: 0.2).delay(visible ? 0.28 : 0), value: visible)

            chip(lang.t("global brands", "علامات عالمية"))
                .offset(x: -1.73, y: 92.09)
                .modifier(Materialize(opacity: visible ? 1 : 0, blur: visible ? 0 : 4, scale: visible ? 1 : 0.9, y: visible ? 0 : 8))
                .animation(.spring(duration: 0.5, bounce: 0.2).delay(visible ? 0.38 : 0), value: visible)
        }
        .frame(width: Self.size.width, height: Self.size.height, alignment: .topLeading)
        .environment(\.layoutDirection, .leftToRight)
        .accessibilityHidden(true)
        .task(id: visible) {
            guard visible, !reduceMotion else { return }
            // An occasional glint, not a constant loop competing with the form.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(3.2))
                withAnimation(.easeInOut(duration: 0.35)) { twinkle = true }
                try? await Task.sleep(for: .milliseconds(380))
                withAnimation(.easeInOut(duration: 0.5)) { twinkle = false }
            }
        }
    }

    private func sparkle(at point: CGPoint, delay: Double) -> some View {
        Image(FieldArt.sparkle)
            .resizable()
            .frame(width: 23.79, height: 23.79)
            .scaleEffect(visible ? (twinkle ? 1.25 : 1) : 0.4)
            .rotationEffect(.degrees(twinkle ? 20 : 0))
            .opacity(visible ? 1 : 0)
            .offset(x: point.x, y: point.y)
            .animation(.spring(duration: 0.5, bounce: 0.3).delay(visible ? delay : 0), value: visible)
    }

    private func chip(_ title: String) -> some View {
        Text(title)
            .font(FieldTextStyle.a12SemiBold.font)
            .foregroundStyle(FieldColour.Surface.absoluteBlack)
            .fixedSize()
            .padding(.horizontal, 10.8)
            .frame(height: 30.28)
            .background {
                Capsule()
                    .fill(LinearGradient(colors: [FieldColour.Surface.primary, FieldColour.Surface.tertiary], startPoint: .top, endPoint: .bottom))
                    .shadow(color: .black.opacity(0.15), radius: 2.5, y: 1)
            }
    }
}
