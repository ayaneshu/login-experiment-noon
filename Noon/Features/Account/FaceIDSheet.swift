import SwiftUI

/// Offered once, right after a code-based sign-in: the best moment to trade the next code for a
/// glance. Floats over a scrim; drag down, tap outside or "Not now" to dismiss.
struct FaceIDSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var presented = false
    @State private var drag: CGFloat = 0
    @State private var phase: Phase = .offer
    @State private var biometry = Biometrics.kind
    @State private var paired = false

    private enum Phase { case offer, enabling, enabled }

    private var biometryName: String {
        switch biometry {
        case .touchID: "Touch ID"
        case .opticID: "Optic ID"
        default: "Face ID"
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Figma: black at 80% behind the sheet.
            Color.black
                .opacity(presented ? 0.8 * (1 - min(max(drag, 0) / 400, 1)) : 0)
                .ignoresSafeArea()
                .onTapGesture(perform: dismiss)
                .accessibilityHidden(true)

            VStack(spacing: FieldSpace.s4) {
                // The notch: a 36pt handle in a 24pt row above the card.
                Capsule()
                    .fill(Color(fieldHex: 0xB7B7B7))
                    .frame(width: 36.scaled, height: 4)
                    .frame(height: 24.scaled)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .accessibilityHidden(true)
                card
            }
            .padding(.horizontal, FieldSpace.s12)
            .padding(.bottom, FieldSpace.s4)
            .offset(y: presented ? rubberBanded(drag) : 520)
            .gesture(dragGesture)
        }
        .sensoryFeedback(.success, trigger: phase) { _, new in new == .enabled }
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)) { presented = true }
            #if DEBUG
            // QA hook for the success state: launch with `-qaEnableBiometric`.
            if ProcessInfo.processInfo.arguments.contains("-qaEnableBiometric") {
                Task {
                    try? await Task.sleep(for: .seconds(1.2))
                    enable()
                }
            }
            #endif
            // Once the sheet has landed, the fingerprint slides out from behind the face.
            withAnimation(reduceMotion ? nil : .spring(duration: 0.55, bounce: 0.2).delay(0.28)) { paired = true }
        }
        .accessibilityAddTraits(.isModal)
    }

    private var card: some View {
        VStack(spacing: FieldSpace.s12) {
            VStack(spacing: FieldSpace.s24) {
                ZStack {
                    if phase == .enabled {
                        // Figma 791:196269: a green tick in a pale halo with two sparkles.
                        Image(FieldArt.biometricOn)
                            .resizable()
                            .frame(width: 120.scaled, height: 92.26.scaled)
                            .transition(.modifier(active: Materialize(opacity: 0, blur: 4, scale: 0.6), identity: Materialize()))
                    } else {
                        illustration
                            .transition(.iconSwap)
                    }
                }
                .frame(height: phase == .enabled ? 92.26.scaled : 80.scaled)

                VStack(spacing: phase == .enabled ? 6.scaled : FieldSpace.s4) {
                    Text(phase == .enabled ? lang.t("Biometric is on", "تم تفعيل تسجيل الدخول بالبصمة") : lang.t("Enable biometric login", "فعّل تسجيل الدخول بالبصمة"))
                        .fieldText(.h20Bold)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .id("title-\(phase == .enabled)")
                        .transition(.blurReplace)
                    Text(phase == .enabled
                         ? lang.t("Skip the OTP next time & login with Face ID, Touch ID, or PIN/Pattern", "تخطَّ رمز التحقق في المرة القادمة وسجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول")
                         : lang.t("Sign in with Face ID, Touch ID, or PIN", "سجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول"))
                        .fieldText(.b14Regular)
                        .foregroundStyle(phase == .enabled ? FieldColour.TextNIcon.secondary : FieldColour.TextNIcon.tertiary)
                        .frame(maxWidth: phase == .enabled ? 282.scaled : .infinity)
                        .id("body-\(phase == .enabled)")
                        .transition(.blurReplace)
                }
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, FieldSpace.s12)

            if phase != .enabled {
                // Stacked, full width: the yes on top, the no right under it.
                VStack(spacing: FieldSpace.s12) {
                    FieldButton(
                        title: lang.t("Enable", "تفعيل"),
                        tone: .primary,
                        size: .h52,
                        textStyle: Self.label,
                        isLoading: phase == .enabling,
                        action: enable
                    )
                    FieldButton(
                        title: lang.t("Not now", "ليس الآن"),
                        tone: FieldButtonTone(background: FieldColour.Surface.primary, pressed: FieldColour.Surface.secondary,
                                              foreground: FieldColour.TextNIcon.primary, border: FieldColour.Border.primary),
                        size: .h52,
                        textStyle: Self.label,
                        action: dismiss
                    )
                }
                .transition(.softRise)
            }
        }
        .padding(FieldSpace.s12)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
        .animation(.spring(duration: 0.45, bounce: 0), value: phase)
    }

    /// Figma Label-2 SemiBold: 15/18, tracking -0.26.
    private static let label = FieldTextStyle(fontName: "Noontree-SemiBold", size: 15, lineHeight: 18, letterSpacing: -0.26)

    /// Face ID and fingerprint, overlapping by 20pt. The face sits on top, and its white ring cuts
    /// into the fingerprint circle behind it.
    private var illustration: some View {
        let circle = 80.scaled
        return HStack(spacing: -20.scaled) {
            Image(FieldArt.biometricFace)
                .resizable()
                .frame(width: 96.scaled, height: 96.scaled)
                .frame(width: circle, height: circle)
                .zIndex(2)

            ZStack {
                Circle().fill(FieldColour.Surface.actionSubtle)
                Image(FieldArt.biometricFingerprint)
                    .resizable()
                    .frame(width: 41.24.scaled, height: 44.31.scaled)
                    .offset(x: 0.38.scaled, y: 0.4.scaled)
                Circle().strokeBorder(FieldColour.Border.white, lineWidth: 8.scaled)
            }
            .frame(width: circle, height: circle)
            .clipShape(Circle())
            .offset(x: paired ? 0 : -44.scaled)
            .scaleEffect(paired ? 1 : 0.9)
            .zIndex(1)
        }
        .accessibilityHidden(true)
    }

    // MARK: - Gestures

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { drag = $0.translation.height }
            .onEnded { value in
                // A flick is enough; it doesn't have to travel far.
                if value.translation.height > 110 || value.predictedEndTranslation.height > 260 {
                    dismiss()
                } else {
                    withAnimation(.spring(duration: 0.4, bounce: 0.2)) { drag = 0 }
                }
            }
    }

    /// Pulling up past the resting spot resists more the further you go.
    private func rubberBanded(_ value: CGFloat) -> CGFloat {
        guard value < 0 else { return value }
        let dimension: CGFloat = 300
        return -(abs(value) * dimension * 0.55) / (dimension + 0.55 * abs(value))
    }

    // MARK: - Actions

    private func dismiss() {
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0)) {
            presented = false
        }
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            app.dismissFaceIDOffer()
        }
    }

    private func enable() {
        guard phase == .offer else { return }
        phase = .enabling
        Task {
            let outcome = await Biometrics.authenticate(
                reason: lang.t("Turn on \(biometryName) for noon", "فعّل \(biometryName) لتطبيق نون"),
                fallbackTitle: ""
            )
            if outcome == .success {
                app.setPasskey(enabled: true)
                phase = .enabled
                try? await Task.sleep(for: .seconds(1.6))
                dismiss()
            } else {
                phase = .offer
            }
        }
    }
}
