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
    /// While typing or partway through verification, a back button sits beside the flag.
    let showsBack: Bool
    /// Signed in: the sheet fills the screen in the account page's colour.
    let expanded: Bool
    /// Pushes the sheet below the screen during the entrance.
    let introShift: CGFloat
    var onBack: () -> Void
    var onSwitchLanguage: () -> Void
    var onTapHeader: () -> Void

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

                HeroIllustration(visible: showsIllustration)
                    // Artwork scales with the design, standing on the sheet's edge.
                    .scaleEffect(FieldScale.factor, anchor: .bottom)
                    .position(x: geo.size.width / 2, y: restSheetTop - HeroIllustration.size.height / 2)
                    .allowsHitTesting(false)

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

    private var topRow: some View {
        HStack(spacing: FieldSpace.s8) {
            HStack(spacing: FieldSpace.s4) {
                if showsBack {
                    HeaderCircleButton(icon: .arrowLeft, foreground: controlForeground, label: lang.t("Back", "رجوع"), action: onBack)
                        .padding(.horizontal, -3)
                        .transition(.asymmetric(
                            insertion: .modifier(active: Materialize(opacity: 0, blur: 4, scale: 0.6, x: -12), identity: Materialize()),
                            removal: .modifier(active: Materialize(opacity: 0, blur: 2, scale: 0.8), identity: Materialize())
                        ))
                }
                MarketPill(market: app.market, foreground: controlForeground) { app.selectMarket($0) }
            }
            .animation(.spring(duration: 0.4, bounce: 0), value: showsBack)

            Spacer(minLength: 0)

            LanguageToggle(current: app.lang, onLight: isLight, action: onSwitchLanguage)
        }
        .frame(height: 38.scaled)
        .animation(FieldMotion.Easing.standard(FieldMotion.Duration.base), value: isLight)
    }

    // MARK: - Sheet

    private func sheetSurface(height: CGFloat) -> some View {
        let radius = expanded ? 0 : AuthLayout.sheetRadius
        return UnevenRoundedRectangle(topLeadingRadius: radius, topTrailingRadius: radius, style: .continuous)
            .fill(expanded ? FieldColour.Surface.tertiary : FieldColour.Surface.primary)
            .frame(height: height + 40)
            .offset(y: sheetTop + introShift)
            .frame(maxHeight: .infinity, alignment: .top)
            .allowsHitTesting(false)
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
