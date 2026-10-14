import SwiftUI

/// "Choose your account": the account this device remembers, one tap from signed in. Its menu
/// offers a code instead of Face ID, or removes the account from this iPhone.
struct ChooseAccountStep: View {
    @Environment(AppModel.self) private var app
    var flow: AuthFlow
    var onOpen: (URL) -> Void = { _ in }
    /// Height of everything above the fold (the footer waits under the nav).
    var onFoldHeight: (CGFloat) -> Void = { _ in }
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var biometry = Biometrics.kind
    @State private var confirmsRemoval = false
    @State private var menuOpen = false

    private var biometryName: String {
        switch biometry {
        case .touchID: "Touch ID"
        case .opticID: "Optic ID"
        default: "Face ID"
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: FieldSpace.s20) {
                AuthTitle(title: lang.t("Choose your account", "اختر حسابك"), bottomPadding: 0)

                if let remembered = flow.remembered {
                    card(remembered)
                        .zIndex(1)
                }

                FieldLabeledDivider(label: lang.t("OR", "أو"), dashed: true)

                // Figma M-SecondaryButton (H52): the other way in.
                FieldButton(
                    title: flow.isSeparate
                        ? lang.t("Continue with different account", "تابِع بحساب آخر")
                        : lang.t("Sign in with another account", "سجّل الدخول بحساب آخر"),
                    tone: .secondary,
                    size: .h52,
                    trailingIcon: .chevronRight,
                    textStyle: .a16SemiBold,
                    action: flow.useDifferentAccount
                )
            }
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { onFoldHeight($0) }

            AuthFooter(onOpen: onOpen)
                .padding(.top, FieldSpace.s20)
        }
        // Tapping anywhere else closes the menu.
        .background {
            if menuOpen {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { closeMenu() }
            }
        }
        #if DEBUG
        .task {
            // QA hook for screenshots of the open menu: launch with `-qaMenu`.
            guard ProcessInfo.processInfo.arguments.contains("-qaMenu") else { return }
            try? await Task.sleep(for: .seconds(1.4))
            withAnimation(.spring(duration: 0.3, bounce: 0)) { menuOpen = true }
        }
        #endif
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

                menuButton(remembered)
            }
            // The open menu hangs over the rest of the card.
            .zIndex(1)

            VStack(spacing: FieldSpace.s8) {
                if remembered.passkeyEnabled {
                    FieldButton(
                        title: lang.t("Log in with \(biometryName)", "سجّل الدخول باستخدام \(biometryName)"),
                        tone: .neutral,
                        size: .h52,
                        leadingImage: FieldArt.faceID,
                        leadingImageSize: 20,
                        textStyle: .a16SemiBold,
                        isLoading: flow.biometricState == .scanning,
                        loadingImage: FieldArt.faceID,
                        action: signInWithPasskey
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                } else {
                    // Without Face ID, the code is the way in.
                    FieldButton(
                        title: lang.t("Login with OTP", "سجّل الدخول برمز التحقق"),
                        tone: .neutral,
                        size: .h52,
                        leadingImage: FieldIconName.message.assetName,
                        leadingImageSize: 20,
                        textStyle: .a16SemiBold,
                        isLoading: flow.isSending,
                        action: flow.sendCodeToRememberedAccount
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                }

                if flow.biometricState == .failed {
                    FieldHelperText(
                        text: lang.t("\(biometryName) didn't recognise you. Try again or log in with OTP.",
                                     "لم يتعرّف \(biometryName) عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق."),
                        tone: .error
                    )
                    .transition(.softRise)
                }
            }
        }
        .padding(FieldSpace.s12)
        // The border sits behind the content so the open menu covers it.
        .background {
            shape.fill(FieldColour.Surface.primary)
                .overlay(shape.strokeBorder(FieldColour.Border.primary, lineWidth: 1))
        }
        .animation(Motion.smooth, value: flow.biometricState)
    }

    /// ⋮ opens a small menu just above it, growing from the dots (Figma 976:40044).
    private func menuButton(_ remembered: RememberedAccount) -> some View {
        Button {
            withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .spring(duration: 0.3, bounce: 0)) { menuOpen.toggle() }
        } label: {
            FieldIcon(.threeDotMenu, size: 24)
                .foregroundStyle(FieldColour.TextNIcon.secondary)
                .frame(width: 36.scaled, height: 36.scaled)
                .background(Circle().fill(FieldColour.Surface.secondary).opacity(menuOpen ? 1 : 0))
                .frame(width: 44, height: 44)
                .contentShape(Circle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.92))
        .padding(.vertical, -FieldSpace.s10)
        .padding(.trailing, -FieldSpace.s10)
        .accessibilityLabel(lang.t("Account options", "خيارات الحساب"))
        .overlay(alignment: .bottomTrailing) {
            if menuOpen {
                AccountMenu(
                    offersCode: remembered.passkeyEnabled,
                    onCode: {
                        closeMenu()
                        flow.sendCodeToRememberedAccount()
                    },
                    onRemove: {
                        closeMenu()
                        confirmsRemoval = true
                    }
                )
                .fixedSize()
                .alignmentGuide(.bottom) { $0[.bottom] + 44 / 2 + 4 }
                .alignmentGuide(.trailing) { $0[.trailing] - 2 }
                .transition(.modifier(
                    active: Materialize(opacity: 0, blur: 3, scale: 0.92),
                    identity: Materialize()
                ))
            }
        }
    }

    private func closeMenu() {
        withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .spring(duration: 0.25, bounce: 0)) { menuOpen = false }
    }

    private func signInWithPasskey() {
        // The separate flow shows the system-style Face ID sheet first; it scans on its own.
        if flow.isSeparate {
            flow.beginFaceIDPrompt()
            return
        }
        flow.signInWithPasskey(
            reason: lang.t("Log in to noon", "تسجيل الدخول إلى نون"),
            fallbackTitle: lang.t("Login with OTP", "سجّل الدخول برمز التحقق")
        )
    }
}

/// Dropdown menu: white card, 16 radius, soft shadow; 24pt icon and B14 Medium per item.
private struct AccountMenu: View {
    let offersCode: Bool
    var onCode: () -> Void
    var onRemove: () -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: FieldRadius.r16, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            if offersCode {
                item(icon: .message, title: lang.t("Log in with OTP", "سجّل الدخول برمز التحقق"), tint: FieldColour.TextNIcon.primary, action: onCode)
                FieldDashedLine()
                    .frame(height: 1)
                    .padding(.horizontal, FieldSpace.s14)
            }
            item(icon: .bin, title: lang.t("Remove account", "إزالة الحساب"), tint: FieldColour.TextNIcon.error, action: onRemove)
        }
        .padding(.vertical, FieldSpace.s4)
        .background(shape.fill(FieldColour.Surface.primary))
        .overlay(shape.strokeBorder(FieldColour.Surface.muted, lineWidth: 1))
        .shadow(color: Color(fieldHex: 0x101628, alpha: 0.14), radius: 16, y: 12)
    }

    private func item(icon: FieldIconName, title: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: FieldSpace.s10) {
                FieldIcon(icon, size: 24)
                Text(title)
                    .fieldText(.b14Medium)
                    .fixedSize()
            }
            .foregroundStyle(tint)
            .padding(.horizontal, FieldSpace.s14)
            .padding(.vertical, FieldSpace.s12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(RowPressStyle())
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
