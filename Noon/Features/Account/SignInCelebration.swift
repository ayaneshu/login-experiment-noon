import SwiftUI

/// The moment you're in, in three quiet beats (after the reference the design team liked):
///
/// 1. **Resolve** — the green code becomes your avatar where it stands, while everything else on
///    the sheet dissolves and the sheet grows into the page.
/// 2. **Pulse** — the avatar, still the code's green, takes centre stage; the green leaves it as
///    one soft ring of light, a verified tick settles in its place, and a sound and haptic land on
///    that same frame.
/// 3. **Arrive** — the greeting blurs in, then gives way as the avatar flies along an arc into
///    its place on the account page and the page rises to meet it.
struct SignInCelebration: View {
    let celebration: AppModel.Celebration

    var body: some View {
        GeometryReader { geo in
            CelebrationStage(celebration: celebration, size: geo.size)
        }
        .ignoresSafeArea()
    }
}

/// A checkmark drawn as one stroke, so it can draw itself in with `trim`.
nonisolated struct CheckShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.55))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.36, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}

private struct CelebrationStage: View {
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let celebration: AppModel.Celebration
    let size: CGSize

    /// The avatar is drawn at hero size and only ever scaled down, so it stays crisp.
    private let heroSize: CGFloat = 80.scaled
    private let landedSize: CGFloat = 48.scaled
    private let resolvedSize: CGFloat = 56.scaled

    @State private var avatarX: CGFloat
    @State private var avatarY: CGFloat
    @State private var avatarScale: CGFloat
    @State private var avatarOpacity: Double = 0
    @State private var avatarBlur: CGFloat = 8
    @State private var avatarSettled = false
    /// Carries the verified code's green until the pulse releases it.
    @State private var avatarGreen = true
    @State private var tickShown = false
    @State private var tickDrawn = false
    @State private var ripple: CGFloat = 0
    @State private var rippleOpacity: Double = 0
    @State private var greetingShown = false
    @State private var greetingGone = false
    @State private var calmBackdrop = false
    @State private var pulse = 0

    init(celebration: AppModel.Celebration, size: CGSize) {
        self.celebration = celebration
        self.size = size
        let origin = celebration.origin == .zero ? CGPoint(x: size.width / 2, y: size.height * 0.36) : celebration.origin
        _avatarX = State(initialValue: origin.x)
        _avatarY = State(initialValue: origin.y)
        _avatarScale = State(initialValue: 56 / 80)
    }

    private var heroPoint: CGPoint { CGPoint(x: size.width / 2, y: size.height * 0.36) }
    private var rippleDiameter: CGFloat { max(size.width, size.height) * 0.95 }

    var body: some View {
        ZStack {
            // Reduce Motion: a calm cross-fade stands in for the sheet sweeping up.
            FieldColour.Surface.tertiary
                .opacity(calmBackdrop ? 1 : 0)

            Circle()
                .fill(RadialGradient(
                    stops: [
                        .init(color: FieldPalette.Green.c500.opacity(0), location: 0.46),
                        .init(color: FieldPalette.Green.c500.opacity(0.28), location: 0.74),
                        .init(color: FieldPalette.Green.c500.opacity(0), location: 1),
                    ],
                    center: .center, startRadius: 0, endRadius: rippleDiameter / 2
                ))
                .frame(width: rippleDiameter, height: rippleDiameter)
                .scaleEffect(0.16 + 0.84 * ripple)
                .opacity(rippleOpacity)
                .position(heroPoint)
                .allowsHitTesting(false)

            avatar
                .scaleEffect(avatarScale)
                .blur(radius: avatarBlur)
                .opacity(avatarOpacity)
                .position(x: avatarX, y: avatarY)

            greeting
                .position(x: size.width / 2, y: heroPoint.y + heroSize / 2 + 56)
        }
        .allowsHitTesting(app.celebrationStage != .land)
        .sensoryFeedback(.success, trigger: pulse)
        .task { await run() }
    }

    // MARK: - Pieces

    private var avatar: some View {
        Circle()
            .fill(avatarGreen ? FieldColour.Surface.successBold : (avatarSettled ? FieldColour.Surface.tertiary : FieldColour.Surface.primary))
            .shadow(color: .black.opacity(avatarSettled ? 0 : 0.08), radius: 18, y: 8)
            .overlay {
                if let initial = celebration.initial {
                    Text(initial)
                        .font(FieldTextStyle.h40Bold.font)
                        .foregroundStyle(avatarGreen ? FieldColour.TextNIcon.onSurfaceBold : FieldColour.TextNIcon.primary)
                } else {
                    FieldIcon(.navProfile, size: 40)
                        .foregroundStyle(avatarGreen ? FieldColour.TextNIcon.onSurfaceBold : FieldColour.TextNIcon.tertiary)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                Circle()
                    .fill(FieldColour.Surface.successBold)
                    .overlay {
                        CheckShape()
                            .trim(from: 0, to: tickDrawn ? 1 : 0)
                            .stroke(FieldColour.TextNIcon.onSurfaceBold, style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
                            .frame(width: 11.scaled, height: 8.5.scaled)
                    }
                    .frame(width: 26.scaled, height: 26.scaled)
                    .overlay(Circle().strokeBorder(FieldColour.Surface.tertiary, lineWidth: 2.5).padding(-2.5))
                    .scaleEffect(tickShown ? 1 : 0.6)
                    .opacity(tickShown ? 1 : 0)
                    .offset(x: 2, y: 2)
            }
            .frame(width: heroSize, height: heroSize)
            .accessibilityHidden(true)
    }

    private var greeting: some View {
        VStack(spacing: FieldSpace.s4) {
            Text(celebration.title)
                .fieldText(.h24Bold)
                .foregroundStyle(FieldColour.TextNIcon.primary)
            Text(celebration.subtitle)
                .fieldText(.b14Regular)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .modifier(Materialize(opacity: greetingShown ? 1 : 0, blur: greetingShown ? 0 : 6, y: greetingShown ? 0 : 6))
                .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.5).delay(greetingShown ? 0.06 : 0), value: greetingShown)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, FieldSpace.s32)
        .frame(width: size.width)
        .modifier(Materialize(
            opacity: greetingShown && !greetingGone ? 1 : 0,
            blur: greetingShown && !greetingGone ? 0 : (greetingGone ? 4 : 6),
            y: greetingGone ? -6 : (greetingShown ? 0 : 8)
        ))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Choreography

    private func run() async {
        SoundEffects.shared.prepare(.signInSuccess)
        if reduceMotion { return await runReduced() }

        // 1. Resolve: the code becomes the avatar right where it was.
        withAnimation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.4)) {
            avatarOpacity = 1
            avatarBlur = 0
        }
        await pause(0.3)

        // The sheet grows into the page while the avatar glides to centre stage. X and Y move on
        // their own springs so the path curves instead of cutting straight across.
        app.celebrationClearing()
        withAnimation(.spring(duration: 0.7, bounce: 0)) { avatarY = heroPoint.y }
        withAnimation(.spring(duration: 0.8, bounce: 0)) {
            avatarX = heroPoint.x
            avatarScale = 1
        }
        await pause(0.62)
        app.celebrationCovered()

        // 2. Pulse: the green leaves as one ring of light; the tick, sound and haptic share its frame.
        withAnimation(.easeOut(duration: 0.12)) { rippleOpacity = 1 }
        withAnimation(.easeOut(duration: 0.45)) { avatarGreen = false }
        withAnimation(.timingCurve(0.23, 1, 0.32, 1, duration: 1.4)) { ripple = 1 }
        withAnimation(.spring(duration: 0.45, bounce: 0.3)) { tickShown = true }
        withAnimation(.easeOut(duration: 0.3).delay(0.1)) { tickDrawn = true }
        SoundEffects.shared.play(.signInSuccess)
        pulse += 1
        await pause(0.16)
        withAnimation(.easeOut(duration: 1.1)) { rippleOpacity = 0 }
        withAnimation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.5)) { greetingShown = true }

        // Long enough to read the greeting, short enough not to hold anyone up.
        await pause(0.85)

        // 3. Arrive: the greeting steps back and the avatar flies into the profile card.
        app.celebrationLanding()
        withAnimation(.easeOut(duration: 0.2)) {
            greetingGone = true
            tickShown = false
        }
        let target = app.avatarCenter == .zero ? CGPoint(x: 48, y: 110) : app.avatarCenter
        withAnimation(.spring(duration: 0.62, bounce: 0)) { avatarY = target.y }
        withAnimation(.spring(duration: 0.78, bounce: 0)) {
            avatarX = target.x
            avatarScale = landedSize / heroSize
            avatarSettled = true
        }
        await pause(0.8)
        app.celebrationFinished()
    }

    /// Reduce Motion: the same beats as cross-fades; nothing travels or grows.
    private func runReduced() async {
        avatarX = heroPoint.x
        avatarY = heroPoint.y
        avatarScale = 1
        avatarBlur = 0
        tickDrawn = true
        avatarGreen = false
        withAnimation(.easeOut(duration: 0.25)) {
            calmBackdrop = true
            avatarOpacity = 1
        }
        app.celebrationClearing()
        await pause(0.3)
        app.celebrationCovered()
        withAnimation(.easeOut(duration: 0.25)) {
            tickShown = true
            greetingShown = true
        }
        SoundEffects.shared.play(.signInSuccess)
        pulse += 1
        await pause(1.3)
        app.celebrationLanding()
        withAnimation(.easeOut(duration: 0.3)) {
            calmBackdrop = false
            avatarOpacity = 0
            greetingGone = true
        }
        await pause(0.32)
        app.celebrationFinished()
    }

    private func pause(_ seconds: Double) async {
        try? await Task.sleep(for: .seconds(seconds))
    }
}
