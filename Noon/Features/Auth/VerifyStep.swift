import SwiftUI

/// "Enter the 6-digit code", with "Enter your password" one quiet tap away on the same screen.
/// Switching morphs in place instead of moving to another screen: the title rewrites itself, the
/// identity line stays where it is, the six code boxes slide together into one password field at
/// the same height, and the bottom action swaps in its own spot. The keyboard stays up and just
/// changes from number pad to letters.
struct VerifyStep: View {
    @Bindable var flow: AuthFlow
    var focus: FocusState<AuthField?>.Binding
    /// From the top padding to the bottom action's edge (see `AuthLayout`).
    let stageHeight: CGFloat
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var passwordShakes = 0

    private var usesPassword: Bool { flow.step == .password }

    /// One spring for the whole morph, so every part moves as one.
    private var morph: Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)
    }

    var body: some View {
        // Title · 4 · identity line · 24 · 20 · input · 20 · notice, with the bottom action held at
        // the typing screens' fixed spot. The title-to-input gap matches the email/phone screen,
        // so the input sits at the same height on every step.
        VStack(alignment: .leading, spacing: 0) {
            AuthTitle(title: usesPassword ? lang.t("Enter your password", "أدخل كلمة المرور")
                                          : lang.t("Enter the 6-digit code", "أدخل الرمز المكوّن من 6 أرقام"),
                      bottomPadding: 0)

            if let target = flow.target {
                SentToRow(
                    prefix: prefix,
                    identifier: target,
                    channelIcon: usesPassword ? nil : (flow.channel == .email ? FieldArt.email : FieldIconName.message.assetName),
                    changeTitle: lang.t("Change", "تغيير"),
                    onChange: flow.changeIdentity
                )
                .padding(.top, FieldSpace.s4)
            }

            // The shared element: the code boxes and the password field occupy the same slot.
            ZStack {
                OTPBoxes(flow: flow, focus: focus, merged: usesPassword)
                    .reportCenter { flow.codeAnchor = $0 }
                PasswordInput(flow: flow, focus: focus, shown: usesPassword, onSubmit: submitPassword)
                    .shake(passwordShakes)
                    .reportCenter { flow.fieldAnchor = $0 }
            }
            .frame(height: usesPassword ? 56.scaled : 66.scaled)
            .padding(.top, FieldSpace.s24 + FieldSpace.s20)

            ZStack(alignment: .topLeading) {
                if usesPassword {
                    passwordNotice
                        .transition(.softRise)
                } else {
                    VStack(alignment: .leading, spacing: FieldSpace.s12) {
                        CodeNotice(flow: flow)
                        if flow.channel == .whatsapp {
                            WhatsAppAssist(flow: flow)
                                .transition(.softRise)
                        }
                    }
                    .transition(.softRise)
                }
            }
            .padding(.top, usesPassword ? FieldSpace.s8 : FieldSpace.s20)

            Spacer(minLength: FieldSpace.s20)

            // The bottom action changes in its own spot: the quiet password link becomes the button.
            ZStack(alignment: .bottomLeading) {
                if usesPassword {
                    FieldButton(
                        title: lang.t("Log in", "تسجيل الدخول"),
                        tone: .neutral,
                        isLoading: flow.passwordState == .verifying || flow.passwordState == .verified,
                        action: submitPassword
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                    .transition(.softRise)
                } else if flow.canUsePassword {
                    FieldNeutralTextButton(title: lang.t("Sign in with password", "سجّل الدخول بكلمة المرور"), leadingImage: FieldArt.passwordInput) {
                        flow.switchToPassword()
                    }
                    .padding(.horizontal, FieldSpace.s2)
                    .transition(.softRise)
                }
            }
        }
        .frame(minHeight: stageHeight, alignment: .top)
        .animation(morph, value: usesPassword)
        .animation(Motion.smooth, value: flow.channel)
        .animation(Motion.smooth, value: flow.passwordState)
        .onChange(of: flow.passwordState) { _, state in
            if state == .failed { passwordShakes += 1 }
        }
    }

    private var prefix: String {
        if usesPassword { return lang.t("Logging in as", "تسجيل الدخول باسم") }
        return flow.channel == .whatsapp ? lang.t("Sent on WhatsApp to", "أُرسل عبر واتساب إلى") : lang.t("Sent on", "أُرسل إلى")
    }

    /// Under the password field: what went wrong, if anything, and the way back to a code.
    private var passwordNotice: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s4) {
            if flow.passwordState == .failed {
                FieldHelperText(
                    text: lang.t("That password didn't work. Try again or log in with OTP.",
                                 "كلمة المرور غير صحيحة. حاول مرة أخرى أو سجّل الدخول برمز التحقق."),
                    tone: .warning
                )
                .transition(.softRise)
            }
            FieldNeutralTextButton(title: lang.t("Login with OTP", "سجّل الدخول برمز التحقق"), leadingImage: FieldArt.passwordAlt) {
                flow.switchToCode()
            }
            .padding(.horizontal, FieldSpace.s2)
        }
    }

    private func submitPassword() {
        guard !flow.password.isEmpty else {
            // Nothing typed yet: nudge the field rather than doing nothing.
            passwordShakes += 1
            focus.wrappedValue = .password
            return
        }
        flow.submitPassword()
    }
}

// MARK: - Password field

/// The password input in M-InputText chrome. Always mounted while verifying, so switching from
/// the code keeps the keyboard up and only changes its layout.
private struct PasswordInput: View {
    @Bindable var flow: AuthFlow
    var focus: FocusState<AuthField?>.Binding
    let shown: Bool
    var onSubmit: () -> Void

    @Environment(\.lang) private var lang
    @State private var reveals = false

    private var isFocused: Bool {
        focus.wrappedValue == .password || focus.wrappedValue == .passwordVisible
    }

    var body: some View {
        HStack(spacing: FieldSpace.s8) {
            ZStack(alignment: .leading) {
                if flow.password.isEmpty {
                    Text(lang.t("Password", "كلمة المرور"))
                        .font(FieldTextStyle.b16SemiBold.font)
                        .tracking(FieldTextStyle.b16SemiBold.tracking)
                        .foregroundStyle(FieldColour.TextNIcon.muted)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
                // Both fields stay mounted so toggling visibility never drops the keyboard.
                ZStack {
                    SecureField("", text: $flow.password)
                        .focused(focus, equals: .password)
                        .opacity(reveals ? 0 : 1)
                    TextField("", text: $flow.password)
                        .focused(focus, equals: .passwordVisible)
                        .opacity(reveals ? 1 : 0)
                }
                .font(FieldTextStyle.h18Bold.font)
                .foregroundStyle(FieldColour.TextNIcon.primary)
                .tint(FieldColour.Surface.actionBold)
                .textContentType(.password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit(onSubmit)
                .accessibilityLabel(lang.t("Password", "كلمة المرور"))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                reveals.toggle()
                focus.wrappedValue = reveals ? .passwordVisible : .password
            } label: {
                ZStack {
                    Image(systemName: reveals ? "eye.slash" : "eye")
                        .id(reveals)
                        .transition(.iconSwap)
                }
                .font(.system(size: 17.scaled, weight: .medium))
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.9))
            .padding(.trailing, -FieldSpace.s10)
            .accessibilityLabel(reveals ? lang.t("Hide password", "إخفاء كلمة المرور") : lang.t("Show password", "إظهار كلمة المرور"))
        }
        .padding(.horizontal, FieldSpace.s16)
        .fieldInputChrome(focused: isFocused, error: flow.passwordState == .failed)
        .animation(Motion.snappy, value: reveals)
        // Arrives as the boxes join: fades up from their merged footprint, and leaves the same way.
        .modifier(Materialize(opacity: shown ? 1 : 0, blur: shown ? 0 : 3, scale: shown ? 1 : 0.98))
        .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.32).delay(shown ? 0.1 : 0), value: shown)
        .allowsHitTesting(shown)
        .accessibilityHidden(!shown)
    }
}

// MARK: - Boxes

/// Six boxes (3 • 3) over one invisible text field. The field does the real work (typing, paste
/// and iOS's one-time-code suggestions from Messages and Mail); the boxes are presentation.
private struct OTPBoxes: View {
    @Bindable var flow: AuthFlow
    var focus: FocusState<AuthField?>.Binding
    /// Password mode: the boxes slide together and join into the password field.
    let merged: Bool
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var ring

    /// What the boxes display. Trails `flow.code` so an autofilled code cascades in and a rejected
    /// one unwinds, digit by digit.
    @State private var shown: [Character] = []
    @State private var revealTask: Task<Void, Never>?
    @State private var shakes = 0
    @Environment(\.authLeaving) private var leaving

    private var isFocused: Bool { focus.wrappedValue == .otp }

    /// The box the next digit goes into. Always shown, so the first box reads as selected the
    /// moment the step appears, even before the keyboard finishes rising.
    private var activeIndex: Int? {
        guard !merged, flow.codeState == .entering, shown.count == flow.code.count, flow.code.count < 6 else { return nil }
        return flow.code.count
    }

    var body: some View {
        ZStack {
            TextField("", text: Binding(get: { flow.codeText }, set: { flow.typeCode($0) }))
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused(focus, equals: .otp)
                .foregroundStyle(.clear)
                .tint(.clear)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityLabel(lang.t("Verification code", "رمز التحقق"))
                .accessibilityValue(lang.t("\(flow.code.count) of 6 digits entered", "تم إدخال \(flow.code.count) من 6 أرقام"))
                .allowsHitTesting(!merged)
                .accessibilityHidden(merged)

            boxes
                .modifier(Materialize(opacity: merged ? 0 : 1, blur: merged ? 3 : 0, scale: merged ? 0.98 : 1))
                .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.3).delay(merged ? 0.06 : 0), value: merged)
                // Signed in: the code draws in toward its centre as the avatar forms there.
                .scaleEffect(leaving ? 0.6 : 1)
                .animation(.timingCurve(0.23, 1, 0.32, 1, duration: 0.35), value: leaving)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .environment(\.layoutDirection, .leftToRight)
        .shake(shakes)
        .onAppear {
            shown = Array(flow.code)
            if !merged { focusCode() }
        }
        .onChange(of: flow.code) { _, new in sync(to: new) }
        .onChange(of: flow.codeState) { _, state in
            if state == .verifying, shown != Array(flow.code) {
                // Whatever typing speed did to the cascade, show exactly what's being checked.
                revealTask?.cancel()
                withAnimation(Motion.snappy) { shown = Array(flow.code) }
            }
            if state == .failed, !reduceMotion { shakes += 1 }
        }
        .onDisappear { revealTask?.cancel() }
    }

    private var boxes: some View {
        TimelineView(.animation(minimumInterval: nil, paused: flow.codeState != .verifying)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            // Merging closes every gap (the separator folds away) so the six cells become one.
            HStack(spacing: 0) {
                HStack(spacing: merged ? 0 : FieldSpace.s8) {
                    ForEach(0..<3, id: \.self) { box($0, time: time) }
                }
                Text(verbatim: "•")
                    .font(FieldTextStyle(fontName: "Noontree-SemiBold", size: 24, lineHeight: 32, letterSpacing: 0).font)
                    .foregroundStyle(FieldColour.TextNIcon.muted)
                    .padding(.horizontal, merged ? 0 : FieldSpace.s6)
                    .frame(width: merged ? 0 : nil)
                    .opacity(merged ? 0 : 1)
                HStack(spacing: merged ? 0 : FieldSpace.s8) {
                    ForEach(3..<6, id: \.self) { box($0, time: time) }
                }
            }
            .animation(Motion.snappy, value: activeIndex)
        }
    }

    private func box(_ index: Int, time: TimeInterval) -> some View {
        let character: Character? = index < shown.count ? shown[index] : nil
        let state = flow.codeState
        let isActive = activeIndex == index
        // A highlight that travels across the digits while the code is being checked.
        let wave = state == .verifying ? (sin(time * 6.5 - Double(index) * 0.65) + 1) / 2 : 0

        return RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous)
            .fill(fill(state: state, active: isActive))
            .overlay {
                RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous)
                    .strokeBorder(border(state: state, wave: wave), lineWidth: 1)
            }
            .overlay {
                if isActive {
                    ZStack {
                        RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous)
                            .fill(FieldColour.Surface.primary)
                        RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous)
                            .strokeBorder(FieldColour.Surface.actionExtrabold, lineWidth: 1)
                        RoundedRectangle(cornerRadius: FieldRadius.r14, style: .continuous)
                            .strokeBorder(FieldColour.Border.action, lineWidth: 2)
                            .padding(-2)
                    }
                    .matchedGeometryEffect(id: "ring", in: ring)
                }
            }
            .overlay {
                if let character {
                    Text(String(character))
                        .font(FieldTextStyle.h32Bold.font)
                        .foregroundStyle(digitColor(state))
                        .opacity(state == .verifying ? 0.35 + 0.65 * wave : 1)
                        .id("\(index)-\(character)")
                        .transition(digitTransition)
                } else if isActive {
                    FieldCaret(height: 28)
                        .transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(Motion.snappy.delay(Double(index) * 0.035), value: state)
    }

    private func fill(state: AuthFlow.CodeState, active: Bool) -> Color {
        switch state {
        case .failed: FieldColour.Surface.warningSubtle
        case .verified: FieldColour.Surface.successSubtle
        default: FieldColour.Surface.secondary
        }
    }

    private func border(state: AuthFlow.CodeState, wave: Double) -> Color {
        switch state {
        case .failed: FieldColour.TextNIcon.warning
        case .verified: FieldColour.Border.successBold
        case .verifying: FieldColour.Surface.actionBold.opacity(0.15 + 0.6 * wave)
        case .entering: .clear
        }
    }

    private func digitColor(_ state: AuthFlow.CodeState) -> Color {
        switch state {
        case .failed: FieldColour.TextNIcon.warning
        case .verified: FieldColour.TextNIcon.success
        default: FieldColour.TextNIcon.primary
        }
    }

    private var digitTransition: AnyTransition {
        if reduceMotion { return .opacity }
        return .asymmetric(
            insertion: .modifier(active: Materialize(opacity: 0, blur: 5, scale: 0.55, y: 8), identity: Materialize()),
            removal: .modifier(active: Materialize(opacity: 0, blur: 3, scale: 0.8), identity: Materialize())
        )
    }

    /// Puts the number pad up on the code field as soon as the step appears. Focus handed over
    /// from the email field can be dropped mid-transition, so ask again once it has settled.
    private func focusCode() {
        Task {
            await Task.yield()
            focus.wrappedValue = .otp
            try? await Task.sleep(for: .milliseconds(350))
            if !merged, focus.wrappedValue != .otp, flow.step == .otp, flow.codeState == .entering {
                focus.wrappedValue = .otp
            }
        }
    }

    private func sync(to new: String) {
        revealTask?.cancel()
        let target = Array(new)
        let common = zip(shown, target).prefix { $0 == $1 }.count

        if target.count - common > 1 {
            // Autofill or paste: cascade the digits in.
            shown = Array(shown.prefix(common))
            revealTask = Task {
                for character in target.dropFirst(common) {
                    withAnimation(.spring(duration: 0.35, bounce: 0.3)) { shown.append(character) }
                    try? await Task.sleep(for: .milliseconds(55))
                    if Task.isCancelled { return }
                }
            }
        } else if shown.count - target.count > 1, common == target.count {
            // Rejected code: unwind right to left.
            revealTask = Task {
                while shown.count > target.count {
                    withAnimation(Motion.quick) { _ = shown.removeLast() }
                    try? await Task.sleep(for: .milliseconds(30))
                    if Task.isCancelled { return }
                }
            }
        } else {
            withAnimation(.spring(duration: 0.3, bounce: 0.25)) { shown = target }
        }
    }
}

// MARK: - Status

/// The one line under the boxes: while a code is being filled or checked it says what's
/// happening; otherwise it's the resend line ("Didn't receive OTP? Resend in 14s").
private struct CodeNotice: View {
    var flow: AuthFlow
    @Environment(\.lang) private var lang

    private struct Status: Equatable {
        var text: String
        var tone: FieldHelperText.Tone = .neutral
        var spinning = false
    }

    private var status: Status? {
        switch flow.codeState {
        case .verifying:
            let text = switch flow.codeSource {
            case .messages: lang.t("Filled from Messages. Verifying…", "تمت التعبئة من الرسائل. جارٍ التحقق…")
            case .mail: lang.t("Filled from Mail. Verifying…", "تمت التعبئة من البريد. جارٍ التحقق…")
            default: lang.t("Verifying…", "جارٍ التحقق…")
            }
            return Status(text: text, spinning: true)
        case .verified:
            return Status(text: lang.t("Verified", "تم التحقق"), tone: .success)
        case .failed, .entering:
            break
        }
        if flow.showsCodeError {
            return Status(text: lang.t("That code didn't work. Check it and try again.", "الرمز غير صحيح. تحقّق منه وحاول مرة أخرى."), tone: .warning)
        }
        if let channel = flow.resentVia {
            let text = switch channel {
            case .sms: lang.t("New code sent by SMS", "أرسلنا رمزاً جديداً برسالة نصية")
            case .whatsapp: lang.t("New code sent on WhatsApp", "أرسلنا رمزاً جديداً عبر واتساب")
            case .email: lang.t("New code sent by email", "أرسلنا رمزاً جديداً بالبريد الإلكتروني")
            }
            return Status(text: text)
        }
        return nil
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if let status {
                HStack(spacing: FieldSpace.s6) {
                    if status.spinning {
                        ProgressView().controlSize(.mini).tint(FieldColour.TextNIcon.tertiary)
                    } else if status.tone == .success {
                        FieldIcon(.checkCircleFilled, size: 16).foregroundStyle(FieldColour.TextNIcon.success)
                    } else if status.tone == .warning {
                        FieldIcon(.warningCircleFilled, size: 16).foregroundStyle(FieldColour.TextNIcon.warning)
                    }
                    Text(status.text)
                        .fieldText(.b14Regular)
                        .foregroundStyle(status.tone == .warning ? FieldColour.TextNIcon.warning : status.tone == .success ? FieldColour.TextNIcon.success : FieldColour.TextNIcon.tertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, FieldSpace.s8)
                .id(status.text)
                .transition(.softRise)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.updatesFrequently)
            } else {
                ResendRow(flow: flow)
                    .transition(.softRise)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 20.scaled, alignment: .leading)
        .animation(Motion.smooth, value: status)
    }
}

// MARK: - Resend

private struct ResendRow: View {
    var flow: AuthFlow
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s12) {
            HStack(spacing: FieldSpace.s4) {
                Text(lang.t("Didn’t receive OTP?", "لم يصلك الرمز؟"))
                    .fieldText(.b14Regular)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
                if flow.resendIn > 0 {
                    Text(lang.t("Resend in \(flow.resendIn)s", "إعادة الإرسال خلال \(flow.resendIn) ث"))
                        .fieldText(.b14SemiBold)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .monospacedDigit()
                        .contentTransition(.numericText(countsDown: true))
                        .transition(.softRise)
                }
            }
            .padding(.horizontal, FieldSpace.s8)
            .frame(minHeight: 20.scaled)

            if flow.resendIn == 0 {
                ZStack(alignment: .leading) {
                    if flow.isResending {
                        ProgressView()
                            .controlSize(.small)
                            .frame(height: 36.scaled)
                            .padding(.horizontal, FieldSpace.s8)
                            .transition(.iconSwap)
                    } else {
                        ViewThatFits(in: .horizontal) {
                            HStack(spacing: FieldSpace.s8) { chips }
                            VStack(alignment: .leading, spacing: FieldSpace.s8) { chips }
                        }
                        .transition(.softRise)
                    }
                }
                .transition(.softRise)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(Motion.smooth, value: flow.resendIn == 0)
        .animation(Motion.snappy, value: flow.isResending)
    }

    private var chips: some View {
        ForEach(options, id: \.title) { option in
            FieldRoundButton(title: option.title, leadingImage: option.icon) {
                flow.resend(via: option.channel)
            }
        }
    }

    private struct Option {
        var channel: AuthFlow.Channel
        var title: String
        var icon: String
    }

    /// The channel you're on comes first as "Resend…"; the alternative sits next to it.
    private var options: [Option] {
        let sms = Option(channel: .sms, title: lang.t("Resend SMS", "إعادة إرسال SMS"), icon: FieldIconName.message.assetName)
        let smsInstead = Option(channel: .sms, title: lang.t("Send by SMS", "أرسل عبر SMS"), icon: FieldIconName.message.assetName)
        let whatsapp = Option(channel: .whatsapp, title: lang.t("Send on WhatsApp", "أرسل عبر واتساب"), icon: FieldIconName.message.assetName)
        let whatsappAgain = Option(channel: .whatsapp, title: lang.t("Resend on WhatsApp", "إعادة عبر واتساب"), icon: FieldIconName.message.assetName)
        let email = Option(channel: .email, title: lang.t("Resend email", "إعادة إرسال البريد"), icon: FieldArt.email)

        switch flow.channel {
        case .sms: return [sms, whatsapp]
        case .whatsapp: return [whatsappAgain, smsInstead]
        case .email: return [email]
        }
    }
}

// MARK: - WhatsApp

/// WhatsApp can't autofill, so keep the copy-and-come-back loop as short as possible.
private struct WhatsAppAssist: View {
    var flow: AuthFlow
    @Environment(\.lang) private var lang
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s8) {
            Text(lang.t("WhatsApp codes can't fill in automatically. Copy it there, then paste it here.",
                        "لا يمكن تعبئة رموز واتساب تلقائياً. انسخ الرمز من هناك ثم الصقه هنا."))
                .fieldText(.b12Medium)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, FieldSpace.s8)
            HStack(spacing: FieldSpace.s8) {
                FieldRoundButton(title: lang.t("Open WhatsApp", "افتح واتساب"), leadingImage: FieldIconName.arrowUpRightBold.assetName) {
                    if let url = URL(string: "whatsapp://") { openURL(url) }
                }
                PasteButton(payloadType: String.self) { strings in
                    let text = strings.first ?? ""
                    Task { @MainActor in flow.paste(text) }
                }
                .buttonBorderShape(.capsule)
                .labelStyle(.titleAndIcon)
                .tint(FieldColour.TextNIcon.primary)
            }
        }
    }
}
