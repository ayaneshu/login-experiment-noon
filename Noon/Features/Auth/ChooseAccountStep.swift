import SwiftUI

/// "Choose your account": the account this device remembers, one tap from signed in.
struct ChooseAccountStep: View {
    @Environment(AppModel.self) private var app
    var flow: AuthFlow
    @Environment(\.lang) private var lang
    @State private var biometry = Biometrics.kind
    @State private var confirmsRemoval = false

    private var biometryName: String {
        switch biometry {
        case .touchID: "Touch ID"
        case .opticID: "Optic ID"
        default: "Face ID"
        }
    }

    var body: some View {
        VStack(spacing: FieldSpace.s20) {
            AuthTitle(title: lang.t("Choose your account", "اختر حسابك"))
                .padding(.bottom, -FieldSpace.s8)

            if let remembered = flow.remembered {
                card(remembered)
            }

            FieldLabeledDivider(label: lang.t("OR", "أو"))

            // Figma M-SecondaryButton: the other way in, a clear second choice after "OR".
            FieldButton(
                title: lang.t("Sign in with different account", "سجّل الدخول بحساب آخر"),
                tone: .secondary,
                size: .h56,
                trailingIcon: .chevronRight,
                textStyle: .a16SemiBold,
                action: flow.useDifferentAccount
            )
        }
        .confirmationDialog(
            lang.t("Remove this account from this iPhone?", "إزالة هذا الحساب من هذا الجهاز؟"),
            isPresented: $confirmsRemoval,
            titleVisibility: .visible
        ) {
            Button(lang.t("Remove account", "إزالة الحساب"), role: .destructive) { flow.forgetRememberedAccount() }
        } message: {
            Text(lang.t("You'll need your email or number to sign in next time. Your noon account isn't affected.",
                        "ستحتاج إلى بريدك الإلكتروني أو رقمك لتسجيل الدخول في المرة القادمة. لن يتأثر حسابك في نون."))
        }
    }

    // MARK: - Identity card

    private func card(_ remembered: RememberedAccount) -> some View {
        let account = remembered.account
        let shape = RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
        return VStack(spacing: FieldSpace.s20) {
            HStack(spacing: FieldSpace.s12) {
                HelloAvatar(initial: account.firstName.map { String($0.prefix(1)) })
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
                .accessibilityElement(children: .combine)

                Menu {
                    Button(role: .destructive) {
                        confirmsRemoval = true
                    } label: {
                        Label(lang.t("Remove from this iPhone", "إزالة من هذا الجهاز"), systemImage: "person.crop.circle.badge.minus")
                    }
                } label: {
                    FieldIcon(.threeDotMenu, size: 24)
                        .foregroundStyle(FieldColour.TextNIcon.secondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .padding(.vertical, -FieldSpace.s10)
                .padding(.trailing, -FieldSpace.s10)
                .accessibilityLabel(lang.t("Account options", "خيارات الحساب"))
            }

            VStack(spacing: FieldSpace.s12) {
                if remembered.passkeyEnabled {
                    FieldButton(
                        title: lang.t("Log in with \(biometryName)", "سجّل الدخول باستخدام \(biometryName)"),
                        tone: .neutral,
                        size: .h52,
                        leadingImage: FieldArt.faceID,
                        leadingImageSize: 20,
                        textStyle: .b14SemiBold,
                        isLoading: flow.biometricState == .scanning,
                        loadingImage: FieldArt.faceID,
                        action: signInWithPasskey
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                    otpTextAction
                } else {
                    // Without Face ID, the code is the main way in.
                    FieldButton(
                        title: lang.t("Login with OTP", "سجّل الدخول برمز التحقق"),
                        tone: .neutral,
                        size: .h52,
                        leadingImage: FieldArt.passwordAlt,
                        leadingImageSize: 20,
                        textStyle: .b14SemiBold,
                        isLoading: flow.isSending,
                        action: flow.sendCodeToRememberedAccount
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                }
            }

            if flow.biometricState == .failed {
                FieldHelperText(
                    text: lang.t("\(biometryName) didn't recognise you. Try again or log in with OTP.",
                                 "لم يتعرّف \(biometryName) عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق."),
                    tone: .warning
                )
                .padding(.top, -FieldSpace.s8)
                .transition(.softRise)
            }
        }
        .padding(FieldSpace.s12)
        .background(shape.fill(FieldColour.Surface.primary))
        .overlay(shape.strokeBorder(FieldColour.Border.primary, lineWidth: 1))
        .animation(Motion.smooth, value: flow.biometricState)
    }

    /// Figma "Actions": the quiet companion to Face ID. A 20pt icon on a secondary chip and a label.
    private var otpTextAction: some View {
        Button(action: flow.sendCodeToRememberedAccount) {
            ZStack {
                HStack(spacing: FieldSpace.s6) {
                    Image(FieldArt.passwordAlt)
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 20.scaled, height: 20.scaled)
                        .padding(FieldSpace.s4)
                        .background(Circle().fill(FieldColour.Surface.secondary))
                    Text(lang.t("Login with OTP", "سجّل الدخول برمز التحقق"))
                        .fieldText(.b14SemiBold)
                }
                .opacity(flow.isSending ? 0 : 1)

                ProgressView()
                    .tint(FieldColour.TextNIcon.primary)
                    .opacity(flow.isSending ? 1 : 0)
            }
            .foregroundStyle(FieldColour.TextNIcon.primary)
            .frame(maxWidth: .infinity)
            .frame(height: 40.scaled)
            .contentShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
        }
        .buttonStyle(FieldPressStyle())
        .disabled(flow.isSending)
        .animation(FieldMotion.Easing.standard(FieldMotion.Duration.sm), value: flow.isSending)
    }

    private func signInWithPasskey() {
        flow.signInWithPasskey(
            reason: lang.t("Log in to noon", "تسجيل الدخول إلى نون"),
            fallbackTitle: lang.t("Login with OTP", "سجّل الدخول برمز التحقق")
        )
    }
}

// MARK: - Hello avatar

/// The remembered account's avatar says hello once when the page appears: the initial lifts out,
/// a hand rises inside the circle, waves twice and ducks away, and the initial drops back in.
private struct HelloAvatar: View {
    let initial: String?
    var size: CGFloat = 40.scaled

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var play = false

    private struct Pose {
        var initialY: CGFloat = 0
        var initialOpacity: Double = 1
        var handY: CGFloat = 40.scaled * 0.7
        var handAngle: Double = 0
        var handOpacity: Double = 0
    }

    var body: some View {
        ZStack {
            initialLabel
                .keyframeAnimator(initialValue: Pose(), trigger: play) { view, pose in
                    view
                        .offset(y: pose.initialY)
                        .opacity(pose.initialOpacity)
                } keyframes: { _ in poseKeyframes }

            Text(verbatim: "👋🏽")
                .font(.system(size: size * 0.5))
                .keyframeAnimator(initialValue: Pose(), trigger: play) { view, pose in
                    view
                        .rotationEffect(.degrees(pose.handAngle), anchor: UnitPoint(x: 0.7, y: 0.9))
                        .offset(y: pose.handY)
                        .opacity(pose.handOpacity)
                } keyframes: { _ in poseKeyframes }
        }
        .frame(width: size, height: size)
        .background(Circle().fill(FieldColour.Surface.actionSubtle))
        .clipShape(Circle())
        .task {
            // Once, after the sheet has settled.
            try? await Task.sleep(for: .milliseconds(450))
            play = true
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var initialLabel: some View {
        if let initial {
            Text(initial)
                .font(FieldTextStyle.b14SemiBold.font)
                .foregroundStyle(FieldColour.TextNIcon.action)
        } else {
            FieldIcon(.navProfile, size: 20)
                .foregroundStyle(FieldColour.TextNIcon.action)
        }
    }

    private var lift: CGFloat { -size * 0.6 }
    /// Reduce Motion keeps the hello but drops the swinging.
    private var wave: Double { reduceMotion ? 0 : 1 }

    /// Initial lifts out · hand rises, waves twice, ducks · initial drops back in. About 2.1s.
    @KeyframesBuilder<Pose>
    private var poseKeyframes: some Keyframes<Pose> {
        // The initial leaves upward and comes back the way it went, as the hand ducks away.
        KeyframeTrack(\.initialY) {
            LinearKeyframe(0, duration: 0.5)
            SpringKeyframe(lift, duration: 0.3, spring: .init(duration: 0.3, bounce: 0))
            LinearKeyframe(lift, duration: 0.9)
            SpringKeyframe(0, duration: 0.45, spring: .init(duration: 0.45, bounce: 0.15))
        }
        KeyframeTrack(\.initialOpacity) {
            LinearKeyframe(1, duration: 0.5)
            LinearKeyframe(0, duration: 0.2)
            LinearKeyframe(0, duration: 1.0)
            LinearKeyframe(1, duration: 0.2)
        }
        KeyframeTrack(\.handY) {
            LinearKeyframe(size * 0.7, duration: 0.55)
            SpringKeyframe(1, duration: 0.4, spring: .init(duration: 0.4, bounce: 0.25))
            LinearKeyframe(1, duration: 0.65)
            SpringKeyframe(size * 0.7, duration: 0.3, spring: .init(duration: 0.3, bounce: 0))
        }
        KeyframeTrack(\.handOpacity) {
            LinearKeyframe(0, duration: 0.55)
            LinearKeyframe(1, duration: 0.12)
            LinearKeyframe(1, duration: 0.95)
            LinearKeyframe(0, duration: 0.18)
        }
        KeyframeTrack(\.handAngle) {
            LinearKeyframe(0, duration: 0.8)
            CubicKeyframe(18 * wave, duration: 0.16)
            CubicKeyframe(-10 * wave, duration: 0.16)
            CubicKeyframe(16 * wave, duration: 0.16)
            CubicKeyframe(-6 * wave, duration: 0.14)
            CubicKeyframe(0, duration: 0.14)
        }
    }
}
