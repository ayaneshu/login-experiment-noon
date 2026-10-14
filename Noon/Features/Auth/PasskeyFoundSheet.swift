import SwiftUI

/// "This account has a passkey" (Figma 791:197190): someone typed an email whose account has Face ID
/// on this device. Offer it before sending a code; "Login with OTP" carries on as usual. Floats
/// over a scrim like the biometric offer; drag down or tap outside to dismiss.
struct PasskeyFoundSheet: View {
    var flow: AuthFlow
    let account: Account

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presented = false
    @State private var drag: CGFloat = 0
    @State private var biometry = Biometrics.kind

    private var biometryName: String {
        switch biometry {
        case .touchID: "Touch ID"
        case .opticID: "Optic ID"
        default: "Face ID"
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black
                .opacity(presented ? 0.8 * (1 - min(max(drag, 0) / 400, 1)) : 0)
                .ignoresSafeArea()
                .onTapGesture(perform: dismiss)
                .accessibilityHidden(true)

            VStack(spacing: FieldSpace.s4) {
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
            .offset(y: presented ? rubberBanded(drag) : 620)
            .gesture(dragGesture)
        }
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)) { presented = true }
        }
        .accessibilityAddTraits(.isModal)
    }

    private var card: some View {
        VStack(spacing: FieldSpace.s12) {
            VStack(spacing: FieldSpace.s24) {
                illustration
                VStack(spacing: FieldSpace.s16) {
                    VStack(spacing: FieldSpace.s4) {
                        Text(lang.t("This account has a passkey", "لهذا الحساب مفتاح مرور"))
                            .fieldText(.h20Bold)
                            .foregroundStyle(FieldColour.TextNIcon.primary)
                        Text(lang.t("Sign in with Face ID, Touch ID, or PIN", "سجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول"))
                            .fieldText(.b14Regular)
                            .foregroundStyle(FieldColour.TextNIcon.tertiary)
                    }
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)

                    identity
                }
            }
            .padding(.top, FieldSpace.s20)
            .padding(.horizontal, FieldSpace.s12)
            .padding(.bottom, FieldSpace.s12)
            .background(
                RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
                    .fill(LinearGradient(stops: [.init(color: FieldColour.Surface.secondary, location: 0.3468), .init(color: FieldColour.Surface.tertiary, location: 1)],
                                         startPoint: .top, endPoint: .bottom))
            )

            VStack(spacing: FieldSpace.s12) {
                FieldButton(
                    title: lang.t("Log in with \(biometryName)", "سجّل الدخول باستخدام \(biometryName)"),
                    tone: .primary,
                    size: .h52,
                    leadingImage: FieldArt.faceID,
                    leadingImageSize: 23,
                    textStyle: .a16SemiBold,
                    isLoading: flow.biometricState == .scanning,
                    loadingImage: FieldArt.faceID,
                    action: signIn
                )
                .reportCenter { flow.ctaAnchor = $0 }
                FieldButton(
                    title: lang.t("Login with OTP", "سجّل الدخول برمز التحقق"),
                    tone: FieldButtonTone(background: FieldColour.Surface.primary, pressed: FieldColour.Surface.secondary,
                                          foreground: FieldColour.TextNIcon.primary, border: FieldColour.Border.primary),
                    size: .h52,
                    textStyle: .a16SemiBold,
                    action: flow.declinePasskey
                )
                if flow.biometricState == .failed {
                    FieldHelperText(
                        text: lang.t("\(biometryName) didn't recognise you. Try again or log in with OTP.",
                                     "لم يتعرّف \(biometryName) عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق."),
                        tone: .error
                    )
                    .multilineTextAlignment(.center)
                    .transition(.softRise)
                }
            }
        }
        .padding(FieldSpace.s12)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous).fill(FieldColour.Surface.primary))
        .animation(Motion.smooth, value: flow.biometricState)
    }

    /// Face ID and fingerprint, overlapping by 20pt; rings in the card's grey so they read as cut-outs.
    private var illustration: some View {
        let circle = 80.scaled
        return HStack(spacing: -20.scaled) {
            Image(FieldArt.biometricFaceOnGrey)
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
                Circle().strokeBorder(FieldColour.Surface.secondary, lineWidth: 8.scaled)
            }
            .frame(width: circle, height: circle)
            .clipShape(Circle())
            .zIndex(1)
        }
        .accessibilityHidden(true)
    }

    private var identity: some View {
        HStack(spacing: FieldSpace.s12) {
            Text(account.firstName.map { String($0.prefix(1)) } ?? "")
                .fieldText(.b14SemiBold)
                .foregroundStyle(FieldColour.TextNIcon.action)
                .frame(width: 40.scaled, height: 40.scaled)
                .background(Circle().fill(FieldColour.Surface.actionSubtle))
            VStack(alignment: .leading, spacing: FieldSpace.s2) {
                Text(lang.t("Logging in as", "تسجيل الدخول باسم"))
                    .fieldText(.b13Regular)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
                Text(ltr(account.identifier.display))
                    .fieldText(.b16Bold)
                    .foregroundStyle(FieldColour.TextNIcon.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(FieldSpace.s12)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).fill(FieldColour.Surface.primary))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Gestures

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { drag = $0.translation.height }
            .onEnded { value in
                if value.translation.height > 110 || value.predictedEndTranslation.height > 260 {
                    dismiss()
                } else {
                    withAnimation(.spring(duration: 0.4, bounce: 0.2)) { drag = 0 }
                }
            }
    }

    private func rubberBanded(_ value: CGFloat) -> CGFloat {
        guard value < 0 else { return value }
        let dimension: CGFloat = 300
        return -(abs(value) * dimension * 0.55) / (dimension + 0.55 * abs(value))
    }

    private func dismiss() {
        withAnimation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.4, bounce: 0)) { presented = false }
        Task {
            try? await Task.sleep(for: .milliseconds(380))
            flow.dismissPasskeyOffer()
        }
    }

    private func signIn() {
        flow.signInWithFoundPasskey(
            reason: lang.t("Log in to noon", "تسجيل الدخول إلى نون"),
            fallbackTitle: lang.t("Login with OTP", "سجّل الدخول برمز التحقق")
        )
    }
}
