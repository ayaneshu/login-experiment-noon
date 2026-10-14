import SwiftUI

/// "Enter the 6-digit code", with a password one quiet tap away on the same screen: "Enter your
/// password" for an existing account, "Create your account" for someone signing up. Switching
/// morphs in place instead of moving to another screen: the title rewrites itself, the identity
/// line stays where it is, the six code boxes slide together into one password field at the same
/// height, and the bottom action swaps in its own spot. The keyboard stays up and just changes
/// from number pad to letters.
struct VerifyStep: View {
    @Bindable var flow: AuthFlow
    var focus: FocusState<AuthField?>.Binding
    /// From the top padding to the bottom action's edge (see `AuthLayout`).
    let stageHeight: CGFloat
    var onOpen: (URL) -> Void = { _ in }
    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var passwordShakes = 0

    private enum Mode { case code, password, create }

    private var mode: Mode {
        switch flow.step {
        case .password: .password
        case .createPassword: .create
        default: .code
        }
    }

    private var usesPassword: Bool { mode != .code }

    /// One spring for the whole morph, so every part moves as one.
    private var morph: Animation {
        reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.5, bounce: 0)
    }

    var body: some View {
        // Title · 4 · identity line · 24 · 20 · input · notice, with the bottom action held at the
        // typing screens' fixed spot. The title-to-input gap matches the email/phone screen, so the
        // input sits at the same height on every step.
        VStack(alignment: .leading, spacing: 0) {
            AuthTitle(title: title, bottomPadding: 0)

            identityLine
                .padding(.top, FieldSpace.s4)

            // The shared element: the code boxes and the password field occupy the same slot.
            ZStack {
                OTPBoxes(flow: flow, focus: focus, merged: usesPassword)
                    .reportCenter { flow.codeAnchor = $0 }
                PasswordInput(
                    text: mode == .create ? $flow.newPassword : $flow.password,
                    placeholder: mode == .create ? lang.t("Create a password", "أنشئ كلمة مرور") : lang.t("Password", "كلمة المرور"),
                    isNew: mode == .create,
                    error: mode == .password && flow.passwordState == .failed,
                    focus: focus,
                    shown: usesPassword,
                    onSubmit: submitPassword
                )
                .shake(passwordShakes)
                .reportCenter { flow.fieldAnchor = $0 }
            }
            .frame(height: usesPassword ? 56.scaled : 66.scaled)
            .padding(.top, FieldSpace.s24 + FieldSpace.s20)

            ZStack(alignment: .topLeading) {
                switch mode {
                case .code:
                    CodeNotice(flow: flow)
                        .padding(.top, FieldSpace.s20)
                        .transition(.softRise)
                case .password:
                    passwordNotice
                        .padding(.top, FieldSpace.s4)
                        .transition(.softRise)
                case .create:
                    PasswordRulesHint(rules: flow.passwordRules, typed: !flow.newPassword.isEmpty)
                        .padding(.top, FieldSpace.s8)
                        .transition(.softRise)
                }
            }

            Spacer(minLength: FieldSpace.s20)

            // The bottom action changes in its own spot: the quiet password link becomes the button.
            ZStack(alignment: .bottomLeading) {
                switch mode {
                case .password:
                    VStack(alignment: .leading, spacing: FieldSpace.s20) {
                        FieldNeutralTextButton(title: flow.isSeparate ? lang.t("Use OTP instead", "استخدم رمز التحقق بدلاً من ذلك") : lang.t("Login with OTP", "سجّل الدخول برمز التحقق"), leadingImage: FieldArt.passwordInput) {
                            flow.switchToCode()
                        }
                        .padding(.horizontal, FieldSpace.s2)
                        FieldButton(
                            title: lang.t("Log in", "تسجيل الدخول"),
                            tone: .neutral,
                            isLoading: flow.passwordState == .verifying || flow.passwordState == .verified,
                            action: submitPassword
                        )
                        .reportCenter { flow.ctaAnchor = $0 }
                    }
                    .transition(.softRise)
                case .create:
                    FieldButton(
                        title: lang.t("Create account", "أنشئ الحساب"),
                        tone: .neutral,
                        isLoading: flow.passwordState == .verifying || flow.passwordState == .verified,
                        action: submitPassword
                    )
                    .reportCenter { flow.ctaAnchor = $0 }
                    .transition(.softRise)
                case .code:
                    if flow.canUsePassword {
                        FieldNeutralTextButton(title: flow.isSeparate ? lang.t("Use password instead", "استخدم كلمة المرور بدلاً من ذلك") : lang.t("Sign in with Password", "سجّل الدخول بكلمة المرور"), leadingImage: FieldArt.passwordInput) {
                            flow.switchToPassword()
                        }
                        .padding(.horizontal, FieldSpace.s2)
                        .transition(.softRise)
                    } else if flow.canCreatePassword {
                        FieldNeutralTextButton(title: flow.isSeparate ? lang.t("Use password instead", "استخدم كلمة المرور بدلاً من ذلك") : lang.t("Sign up with password", "أنشئ حساباً بكلمة مرور"), leadingImage: FieldArt.passwordInput) {
                            flow.switchToCreatePassword()
                        }
                        .padding(.horizontal, FieldSpace.s2)
                        .transition(.softRise)
                    }
                }
            }
        }
        .frame(minHeight: stageHeight, alignment: .top)
        .animation(morph, value: flow.step)
        .animation(Motion.smooth, value: flow.channel)
        .animation(Motion.smooth, value: flow.passwordState)
        .onChange(of: flow.passwordState) { _, state in
            if state == .failed { passwordShakes += 1 }
        }
        .onChange(of: flow.weakPasswordAttempts) { _, _ in passwordShakes += 1 }
    }

    private var title: String {
        switch mode {
        case .code: lang.t("Enter the 6-digit code", "أدخل الرمز المكوّن من 6 أرقام")
        case .password: lang.t("Enter your password", "أدخل كلمة المرور")
        case .create: lang.t("Create your account", "أنشئ حسابك")
        }
    }

    /// "Sent on … ✉︎ • Change", "Sent on +971 … via (WhatsApp) • Change", "Logging in as … • Change",
    /// or, when creating an account, what the password is for.
    @ViewBuilder
    private var identityLine: some View {
        if mode == .create {
            Text(lang.t("Set a password for your account", "عيّن كلمة مرور لحسابك"))
                .fieldText(.b14Regular)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .padding(.horizontal, FieldSpace.s4)
                .frame(maxWidth: .infinity, minHeight: 20.scaled, alignment: .leading)
                .transition(.softRise)
        } else if let target = flow.target {
            SentToRow(
                prefix: mode == .password ? lang.t("Logging in as", "تسجيل الدخول باسم") : lang.t("Sent on", "أُرسل إلى"),
                identifier: target,
                suffix: mode == .code && flow.channel != .email ? lang.t("via", "عبر") : nil,
                channelIcon: mode == .password ? nil : channelIcon,
                changeTitle: lang.t("Change", "تغيير"),
                onChange: flow.changeIdentity
            )
        }
    }

    private var channelIcon: SentToRow.Icon {
        switch flow.channel {
        case .email: .template(FieldArt.email)
        case .sms: .template(FieldIconName.message.assetName)
        case .whatsapp: .original(FieldArt.whatsapp)
        }
    }

    /// Under the password field: what went wrong, if anything, and the way to reset it.
    private var passwordNotice: some View {
        VStack(alignment: .leading, spacing: 0) {
            if flow.passwordState == .failed {
                FieldHelperText(
                    text: lang.t("Password failed. Retry or use OTP.", "تعذّر تسجيل الدخول. أعد المحاولة أو استخدم رمز التحقق."),
                    tone: .error
                )
                .transition(.softRise)
            }
            Button { onOpen(Links.forgotPassword) } label: {
                Text(lang.t("Forgot password?", "نسيت كلمة المرور؟"))
                    .fieldText(.b14Medium)
                    .foregroundStyle(FieldColour.TextNIcon.action)
                    .padding(.leading, FieldSpace.s8)
                    .padding(.top, FieldSpace.s8)
                    .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.97))
        }
    }

    private func submitPassword() {
        switch mode {
        case .create:
            flow.createAccount()
        default:
            guard !flow.password.isEmpty else {
                // Nothing typed yet: nudge the field rather than doing nothing.
                passwordShakes += 1
                focus.wrappedValue = .password
                return
            }
            flow.submitPassword()
        }
    }
}

/// What a new password still needs, in one sentence that shrinks as rules are met: unmet terms in
/// SemiBold, then "You've got a strong password!" in green once they're all there.
private struct PasswordRulesHint: View {
    let rules: AuthFlow.PasswordRules
    /// Before anything is typed the full sentence shows, even though nothing is met yet.
    let typed: Bool
    @Environment(\.lang) private var lang

    var body: some View {
        Group {
            if typed, rules.isStrong {
                Text(lang.t("You've got a strong password!", "كلمة مرور قوية!"))
                    .fieldText(.b13Medium)
                    .foregroundStyle(FieldColour.TextNIcon.success)
                    .id("strong")
            } else {
                Text(sentence)
                    .fieldText(.b13Regular)
                    .foregroundStyle(FieldColour.TextNIcon.tertiary)
                    .fixedSize(horizontal: false, vertical: true)
                    .id("rules")
            }
        }
        .transition(.softRise)
        .padding(.horizontal, FieldSpace.s8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(Motion.smooth, value: rules)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private func bold(_ text: String) -> AttributedString {
        var a = AttributedString(text)
        a.font = FieldTextStyle.b13SemiBold.font
        a.foregroundColor = FieldColour.TextNIcon.primary
        return a
    }

    /// Figma: "Use 8+ characters with a number, a symbol, an uppercase and a lowercase letter", then
    /// only what's missing ("Use a symbol, an uppercase and a lowercase letter").
    private var sentence: AttributedString {
        guard lang == .en else {
            return AttributedString("استخدم ٨ أحرف على الأقل مع رقم ورمز وحرف كبير وحرف صغير")
        }
        var items: [(article: String, term: String)] = []
        if !rules.number || !typed { items.append(("a ", "number")) }
        if !rules.symbol || !typed { items.append(("a ", "symbol")) }
        if !rules.uppercase || !typed { items.append(("an ", "uppercase")) }
        if !rules.lowercase || !typed { items.append(("a ", "lowercase")) }
        let needsLength = !rules.length || !typed

        var result = AttributedString("Use ")
        if needsLength {
            result += bold("8+ characters")
            if !items.isEmpty { result += AttributedString(" with ") }
        }
        for (index, item) in items.enumerated() {
            if index > 0 { result += AttributedString(index == items.count - 1 ? " and " : ", ") }
            result += AttributedString(item.article)
            result += bold(item.term)
        }
        if let last = items.last, last.term == "uppercase" || last.term == "lowercase" {
            result += AttributedString(" letter")
        }
        return result
    }
}

// MARK: - Password field

/// The password input in M-InputText chrome. Always mounted while verifying, so switching from
/// the code keeps the keyboard up and only changes its layout.
private struct PasswordInput: View {
    @Binding var text: String
    var placeholder: String
    /// Creating an account: offer a strong password from Keychain instead of filling a saved one.
    var isNew = false
    var error = false
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
                if text.isEmpty {
                    Text(placeholder)
                        .font(FieldTextStyle.b16SemiBold.font)
                        .tracking(FieldTextStyle.b16SemiBold.tracking)
                        .foregroundStyle(FieldColour.TextNIcon.muted)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
                // Both fields stay mounted so toggling visibility never drops the keyboard.
                ZStack {
                    SecureField("", text: $text)
                        .focused(focus, equals: .password)
                        .opacity(reveals ? 0 : 1)
                    TextField("", text: $text)
                        .focused(focus, equals: .passwordVisible)
                        .opacity(reveals ? 1 : 0)
                }
                .font(FieldTextStyle.h18Bold.font)
                .foregroundStyle(FieldColour.TextNIcon.primary)
                .tint(FieldColour.Surface.actionBold)
                .textContentType(isNew ? .newPassword : .password)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit(onSubmit)
                .accessibilityLabel(placeholder)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                reveals.toggle()
                focus.wrappedValue = reveals ? .passwordVisible : .password
            } label: {
                ZStack {
                    Image(reveals ? FieldArt.eyeOff : FieldArt.eye)
                        .renderingMode(.template)
                        .resizable()
                        .frame(width: 24.scaled, height: 24.scaled)
                        .id(reveals)
                        .transition(.iconSwap)
                }
                .foregroundStyle(FieldColour.Surface.primaryInverted)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(FieldPressStyle(scale: 0.9))
            .padding(.trailing, -FieldSpace.s10)
            .accessibilityLabel(reveals ? lang.t("Hide password", "إخفاء كلمة المرور") : lang.t("Show password", "إظهار كلمة المرور"))
        }
        .padding(.horizontal, FieldSpace.s16)
        .fieldInputChrome(focused: isFocused, error: error)
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
        case .failed: FieldColour.Surface.errorSubtle
        case .verified: FieldColour.Surface.successSubtle
        default: FieldColour.Surface.secondary
        }
    }

    private func border(state: AuthFlow.CodeState, wave: Double) -> Color {
        switch state {
        case .failed: FieldColour.Surface.errorBold
        case .verified: FieldColour.Border.successBold
        case .verifying: FieldColour.Surface.actionBold.opacity(0.15 + 0.6 * wave)
        case .entering: .clear
        }
    }

    private func digitColor(_ state: AuthFlow.CodeState) -> Color {
        switch state {
        case .failed: FieldColour.TextNIcon.error
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

/// Under the boxes: while a code is filled or checked it says what's happening; once verified, a
/// green "Verified"; a rejected code gets "Invalid code." above the resend block (Figma OTP states).
private struct CodeNotice: View {
    var flow: AuthFlow
    @Environment(\.lang) private var lang

    private enum Status: Equatable {
        case verifying(String)
        case verified
        case invalid
        case none
    }

    private var status: Status {
        switch flow.codeState {
        case .verifying:
            let text = switch flow.codeSource {
            case .messages: lang.t("Filled from Messages. Verifying…", "تمت التعبئة من الرسائل. جارٍ التحقق…")
            case .mail: lang.t("Filled from Mail. Verifying…", "تمت التعبئة من البريد. جارٍ التحقق…")
            default: lang.t("Verifying…", "جارٍ التحقق…")
            }
            return .verifying(text)
        case .verified:
            return .verified
        case .failed, .entering:
            return flow.showsCodeError ? .invalid : .none
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s16) {
            switch status {
            case .verifying(let text):
                HStack(spacing: FieldSpace.s6) {
                    ProgressView().controlSize(.mini).tint(FieldColour.TextNIcon.tertiary)
                    Text(text)
                        .fieldText(.b14Regular)
                        .foregroundStyle(FieldColour.TextNIcon.tertiary)
                }
                .padding(.horizontal, FieldSpace.s8)
                .transition(.softRise)
            case .verified:
                HStack(spacing: FieldSpace.s4) {
                    FieldIcon(.checkCircleFilled, size: 14)
                    Text(lang.t("Verified", "تم التحقق"))
                        .fieldText(.b13Medium)
                }
                .foregroundStyle(FieldColour.TextNIcon.success)
                .padding(.horizontal, FieldSpace.s8)
                .transition(.softRise)
            case .invalid:
                Text(lang.t("Invalid code.", "رمز غير صحيح."))
                    .fieldText(.b13Medium)
                    .foregroundStyle(FieldColour.TextNIcon.error)
                    .padding(.leading, FieldSpace.s8)
                    .transition(.softRise)
                ResendBlock(flow: flow)
            case .none:
                ResendBlock(flow: flow)
                    .transition(.softRise)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 20.scaled, alignment: .leading)
        .animation(Motion.smooth, value: status)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Resend

/// "Didn't receive OTP? Resend in 14s". Email: "Resend via email" once the timer runs out. Phone:
/// "Resend on WhatsApp" and "Resend SMS" are always there, greyed out until the timer runs out.
private struct ResendBlock: View {
    var flow: AuthFlow
    @Environment(\.lang) private var lang

    private var canResend: Bool { flow.resendIn == 0 && !flow.isResending }

    var body: some View {
        VStack(alignment: .leading, spacing: FieldSpace.s8) {
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
                } else if flow.channel == .email {
                    Button { flow.resend(via: .email) } label: {
                        ZStack(alignment: .leading) {
                            Text(lang.t("Resend via email", "إعادة الإرسال عبر البريد"))
                                .fieldText(.b14SemiBold)
                                .foregroundStyle(FieldColour.TextNIcon.action)
                                .opacity(flow.isResending ? 0 : 1)
                            if flow.isResending {
                                ProgressView().controlSize(.mini)
                            }
                        }
                        .frame(minHeight: 32)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(FieldPressStyle(scale: 0.96))
                    .disabled(flow.isResending)
                    .transition(.softRise)
                }
            }
            .padding(.horizontal, FieldSpace.s8)
            .frame(minHeight: 20.scaled)

            if flow.channel != .email {
                HStack(spacing: FieldSpace.s8) {
                    chip(.whatsapp, title: lang.t("Resend on WhatsApp", "إعادة عبر واتساب")) {
                        Image(FieldArt.whatsapp).resizable()
                    }
                    chip(.sms, title: lang.t("Resend SMS", "إعادة إرسال SMS")) {
                        Image(FieldIconName.message.assetName).renderingMode(.template).resizable()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(Motion.smooth, value: canResend)
        .animation(Motion.snappy, value: flow.isResending)
    }

    /// M-NeutralRoundButton H40: tertiary and muted while counting down, white with a border once
    /// it can be tapped.
    private func chip<Icon: View>(_ channel: AuthFlow.Channel, title: String, @ViewBuilder icon: () -> Icon) -> some View {
        let enabled = canResend
        return Button { flow.resend(via: channel) } label: {
            HStack(spacing: FieldSpace.s4) {
                icon()
                    .frame(width: 16.scaled, height: 16.scaled)
                    .saturation(enabled ? 1 : 0)
                    .opacity(enabled ? 1 : 0.55)
                Text(title)
                    .fieldText(.b13Medium)
                    .fixedSize()
            }
            .foregroundStyle(enabled ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.muted)
            .padding(.horizontal, FieldSpace.s12)
            .frame(height: 40.scaled)
            .background(Capsule().fill(enabled ? FieldColour.Surface.primary : FieldColour.Surface.tertiary))
            .overlay(Capsule().strokeBorder(FieldColour.Border.primary, lineWidth: 1).opacity(enabled ? 1 : 0))
            .contentShape(Capsule())
        }
        .buttonStyle(FieldPressStyle(scale: 0.96))
        .disabled(!enabled)
        .accessibilityHint(enabled ? "" : lang.t("Available when the timer ends", "متاح عند انتهاء المؤقت"))
    }
}
