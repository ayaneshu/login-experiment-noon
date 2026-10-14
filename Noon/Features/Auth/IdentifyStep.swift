import SwiftUI

/// "Welcome to noon": one field for email or phone. It reshapes itself as you type (a country
/// chip slides in for numbers, domain chips appear after "@") and tells you who you are as soon
/// as it knows.
struct IdentifyStep: View {
    @Environment(AppModel.self) private var app
    var flow: AuthFlow
    @Binding var isFocused: Bool
    let raised: Bool
    /// From the top padding to the button's bottom edge while typing (see `AuthLayout`).
    let stageHeight: CGFloat
    let errorShakes: Int
    var onCountryTap: () -> Void
    var onOpen: (URL) -> Void
    /// Height of everything above the fold, so the resting sheet can sit on the nav with the rest
    /// of the footer just below it.
    var onFoldHeight: (CGFloat) -> Void = { _ in }
    /// My Account carries the footer; checkout and links end at the button (Figma entry points).
    var showsFooter = true

    @Environment(\.lang) private var lang
    /// Gentle prompts when the field is focused but nothing's been typed.
    @State private var idleNudges = 0

    private var isIdle: Bool { isFocused && flow.input.isEmpty }
    private var isTabs: Bool { flow.variant == .toggle }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            aboveTheFold
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { if !raised { onFoldHeight($0) } }

            if !raised && showsFooter {
                // The rest of the footer waits under the nav; pull the sheet up to reach it.
                AuthFooter(showsLinks: !isTabs, onOpen: onOpen)
                    .padding(.top, isTabs ? FieldSpace.s12 : FieldSpace.s20)
                    .transition(.softRise)
            }
        }
        .frame(minHeight: raised ? stageHeight : 0, alignment: .top)
        .animation(Motion.smooth, value: flow.hint)
        .animation(Motion.smooth, value: flow.showsInputError)
        .animation(Motion.smooth, value: flow.isNewCustomer)
        .animation(Motion.smooth, value: flow.variant)
        .animation(Motion.smooth, value: idleNudges > 0 && isIdle)
        .task(id: isIdle) { await nudgeWhileIdle() }
        .onChange(of: isFocused) { _, focused in
            if !focused { idleNudges = 0 }
        }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.7), trigger: idleNudges) { old, new in new > old }
    }

    private var aboveTheFold: some View {
        VStack(alignment: .leading, spacing: 0) {
            AuthTitle(title: lang.t("Welcome to noon", "أهلاً بك في نون"),
                      subtitle: lang.t("Log in with email or phone", "سجّل الدخول بالبريد الإلكتروني أو الهاتف"),
                      bottomPadding: titleBottomPadding)

            // Tabs flow: Phone number | Email between the title and the field.
            if isTabs {
                LoginMethodToggle(selection: flow.method) { flow.setMethod($0) }
                    .padding(.top, raised ? FieldSpace.s20 : FieldSpace.s16)
                    .transition(.softRise)
            }

            IdentifierField(flow: flow, isFocused: $isFocused, onCountryTap: onCountryTap)
                .shake(errorShakes + idleNudges)
                .reportCenter { flow.fieldAnchor = $0 }
                .padding(.top, isTabs ? (raised ? FieldSpace.s20 : FieldSpace.s16) : FieldSpace.s20)

            FieldSupport(flow: flow, isFocused: isFocused, nudging: idleNudges > 0 && isIdle, onOpen: onOpen)

            // While typing, the button holds a fixed spot above the keyboard (see
            // `AuthLayout.raisedStageHeight`) so helper text and chips never push it around.
            if raised {
                Spacer(minLength: FieldSpace.s20)
            }

            // The consent line belongs to the button that accepts it.
            if flow.isNewCustomer {
                ConsentLine(onOpen: onOpen)
                    .padding(.top, raised ? 0 : FieldSpace.s20)
                    .padding(.bottom, FieldSpace.s12)
                    .transition(.softRise)
            }

            FieldButton(
                title: ctaTitle,
                tone: .neutral,
                isLoading: flow.isSending,
                action: submit
            )
            .reportCenter { flow.ctaAnchor = $0 }
            .padding(.top, raised || flow.isNewCustomer ? 0 : buttonTopPadding)

            if !raised && showsFooter {
                if isTabs {
                    // Policies · Sell on noon peeks above the nav (Figma 921:241897).
                    FooterLinks(onOpen: onOpen)
                        .padding(.top, FieldSpace.s16)
                        .transition(.softRise)
                } else {
                    NoonOnePromoCard { onOpen(Links.noonOne) }
                        // Figma: 4pt wider than the form on each side.
                        .padding(.horizontal, -FieldSpace.s4)
                        .padding(.top, FieldSpace.s20)
                        .transition(.softRise)
                }
            }
        }
    }

    /// Smart field: 8 at rest (Figma Page Title 64 tall), 24 while typing. Tabs: the toggle sets the gap.
    private var titleBottomPadding: CGFloat {
        if isTabs { return 0 }
        return raised ? FieldSpace.s24 : FieldSpace.s8
    }

    /// Smart field: 20 under the field. Tabs: 28 (Figma field row's 12 + 16), less any helper line.
    private var buttonTopPadding: CGFloat {
        guard isTabs else { return FieldSpace.s20 }
        return FieldSupport.hasContent(flow: flow, isFocused: isFocused, nudging: idleNudges > 0 && isIdle) ? FieldSpace.s20 : 28.scaled
    }

    /// Focused, empty and quiet: after 4s, and once more after 9s, shake the field and say what to
    /// type. Then leave them alone.
    private func nudgeWhileIdle() async {
        guard isIdle else { return }
        for delay in [4.0, 9.0].dropFirst(idleNudges) {
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled, isIdle else { return }
            idleNudges += 1
        }
    }

    private var ctaTitle: String {
        flow.isNewCustomer
            ? lang.t("Agree & get OTP", "أوافق وأرسل الرمز")
            : lang.t("Sign in with OTP", "سجّل الدخول برمز التحقق")
    }

    private func submit() {
        flow.submitIdentifier()
    }
}

// MARK: - Field

struct IdentifierField: View {
    var flow: AuthFlow
    @Binding var isFocused: Bool
    var onCountryTap: () -> Void

    @Environment(\.lang) private var lang
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var showsCountry: Bool { flow.showsCountryChip }

    /// The smart field names both; the toggle variant names what's selected; Sign up asks for email.
    private var placeholder: String {
        if flow.isSeparate, flow.step == .signup { return lang.t("Email address", "البريد الإلكتروني") }
        guard flow.variant == .toggle else { return lang.t("Email or phone number", "البريد الإلكتروني أو رقم الهاتف") }
        return flow.method == .phone ? lang.t("Mobile number", "رقم الجوال") : lang.t("Email address", "البريد الإلكتروني")
    }

    var body: some View {
        HStack(spacing: FieldSpace.s8) {
            if showsCountry {
                CountryChip(country: flow.country, action: onCountryTap)
                    .transition(chipTransition)
            }

            HStack(spacing: FieldSpace.s8) {
                ZStack(alignment: .leading) {
                    FieldGhost(flow: flow)
                    IdentifierTextField(
                        flow: flow,
                        isFocused: $isFocused,
                        keyboard: keyboard,
                        placeholder: placeholder,
                        accessibilityLabel: placeholder
                    )
                }
                .frame(maxWidth: .infinity)

                trailingAccessory
            }
            .padding(.horizontal, FieldSpace.s16)
            .fieldInputChrome(focused: isFocused, error: flow.showsInputError || flow.signupPhoneError, success: isFound, quietFocus: flow.isSeparate)
            .contentShape(Rectangle())
            .onTapGesture { isFocused = true }
        }
        .frame(height: 56.scaled)
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(duration: 0.45, bounce: 0), value: showsCountry)
    }

    private var chipTransition: AnyTransition {
        if reduceMotion { return .opacity }
        return .asymmetric(
            insertion: .move(edge: .leading).combined(with: .modifier(active: Materialize(opacity: 0, blur: 4), identity: Materialize())),
            removal: .move(edge: .leading).combined(with: .modifier(active: Materialize(opacity: 0, blur: 2), identity: Materialize()))
        )
    }

    /// Checked and ready: we know whether it's a returning or a new customer. (On the separate
    /// Log in a new email gets no tick: it can't log in, it moves on to Sign up.)
    private var isResolved: Bool {
        switch flow.lookup {
        case .returning: true
        case .new: !flow.isSeparate || flow.step == .signup
        case .idle, .checking: false
        }
    }

    /// Separate flow: the account was found, so the field turns green.
    private var isFound: Bool {
        guard flow.isSeparate, !flow.showsInputError, case .returning = flow.lookup else { return false }
        return true
    }

    /// Log in switches to the number pad once it's clearly a number; Sign up takes email only.
    private var keyboard: IdentifierKind {
        if flow.isSeparate { return flow.step == .signup ? .email : (flow.kind == .phone ? .phone : .unknown) }
        return flow.variant == .toggle ? flow.method : .unknown
    }

    @ViewBuilder
    private var trailingAccessory: some View {
        ZStack {
            if flow.lookup == .checking {
                ProgressView()
                    .tint(FieldColour.Surface.actionBold)
                    .controlSize(.small)
                    .transition(.iconSwap)
            } else if isResolved, !flow.showsInputError {
                FieldIcon(.checkCircleFilled, size: 24)
                    .foregroundStyle(FieldColour.TextNIcon.success)
                    .transition(.iconSwap)
                    .accessibilityLabel(lang.t("Looks good", "صحيح"))
            } else if isFocused, !flow.input.isEmpty {
                Button(action: flow.clearInput) {
                    FieldIcon(.cross, size: 12)
                        .foregroundStyle(FieldColour.TextNIcon.onSurfaceBold)
                        .frame(width: 20.scaled, height: 20.scaled)
                        .background(Circle().fill(FieldColour.TextNIcon.muted))
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(FieldPressStyle(scale: 0.9))
                .padding(.horizontal, -12)
                .accessibilityLabel(lang.t("Clear", "مسح"))
                .transition(.iconSwap)
            }
        }
        .frame(width: 24.scaled, height: 24.scaled)
        .animation(.spring(duration: 0.3, bounce: 0), value: flow.lookup)
        .animation(.spring(duration: 0.3, bounce: 0), value: flow.showsInputError)
        .animation(.spring(duration: 0.3, bounce: 0), value: isFocused && !flow.input.isEmpty)
    }
}

/// Country Code Chip: flag, dial code and caret on a tertiary tile the height of the field.
private struct CountryChip: View {
    let country: Country
    var action: () -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        Button(action: action) {
            HStack(spacing: FieldSpace.s6) {
                CountryFlag(country: country, width: 20, height: 14)
                HStack(spacing: FieldSpace.s4) {
                    Text(ltr("+\(country.dialCode)"))
                        .font(FieldTextStyle.h18Bold.font)
                        .tracking(FieldTextStyle.h18Bold.tracking)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                        .lineLimit(1)
                        .fixedSize()
                        .contentTransition(.numericText())
                    FieldIcon(.caretDown, size: 16)
                        .foregroundStyle(FieldColour.TextNIcon.primary)
                }
            }
            .padding(.horizontal, FieldSpace.s10)
            .frame(maxHeight: .infinity)
            .fixedSize(horizontal: true, vertical: false)
            .background(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).fill(FieldColour.Surface.secondary))
            .overlay(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).strokeBorder(FieldColour.Border.primary, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
        }
        .buttonStyle(FieldPressStyle(scale: 0.96))
        .environment(\.layoutDirection, .leftToRight)
        .animation(Motion.snappy, value: country)
        .accessibilityLabel(lang.t("Country code, \(country.name), +\(country.dialCode)", "رمز الدولة، \(country.nameAR)، +\(country.dialCode)"))
        .accessibilityHint(lang.t("Double-tap to change", "انقر مرتين للتغيير"))
    }
}

/// What's still to come, drawn in muted grey right after what you've typed, with a soft shimmer
/// running through it: the remaining digits of a number ("050| 000 0000") or the likely rest of an
/// email ("ajain@gm|ail.com", which Return accepts). Left-to-right layouts only, where it lines up
/// with the text field.
private struct FieldGhost: View {
    var flow: AuthFlow
    @Environment(\.layoutDirection) private var direction
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var remainder: String? {
        guard direction == .leftToRight, !flow.input.isEmpty, !flow.showsInputError else { return nil }
        switch flow.kind {
        case .phone:
            guard !flow.input.hasPrefix("+") else { return nil }
            let digits = flow.phoneDigits
            guard !digits.isEmpty else { return nil }
            let country = flow.country
            let max = country.maxDigits(startingWithZero: PhoneFormatter.startsWithTrunkZero(digits, country: country))
            guard digits.count < max else { return nil }
            let full = PhoneFormatter.format(digits + String(repeating: "0", count: max - digits.count), country: country)
            guard full.hasPrefix(flow.input) else { return nil }
            return String(full.dropFirst(flow.input.count))
        case .email:
            return flow.ghostCompletion
        case .unknown:
            return nil
        }
    }

    var body: some View {
        if let remainder {
            // Once the text outgrows the field it scrolls, and the ghost could no longer line up.
            ViewThatFits(in: .horizontal) {
                ghost(remainder)
                Color.clear.frame(width: 0, height: 0)
            }
        }
    }

    private func ghost(_ remainder: String) -> some View {
            TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
                let cycle = 1.8
                let phase = reduceMotion ? -1 : context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: cycle) / cycle
                line(remainder, color: FieldColour.TextNIcon.muted)
                    .overlay {
                        line(remainder, color: FieldColour.Surface.tertiary)
                            .mask {
                                GeometryReader { geo in
                                    let band = max(64, geo.size.width * 0.45)
                                    LinearGradient(colors: [.clear, .white, .clear], startPoint: .leading, endPoint: .trailing)
                                        .frame(width: band)
                                        .offset(x: -band + (geo.size.width + band) * phase * 1.25)
                                }
                            }
                    }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    /// The typed part is laid out invisibly so the ghost starts exactly where the caret is.
    private func line(_ remainder: String, color: Color) -> some View {
        var typed = AttributedString(flow.input)
        typed.foregroundColor = .clear
        var rest = AttributedString(remainder)
        rest.foregroundColor = color
        return Text(typed + rest)
            .font(FieldTextStyle.h18Bold.font)
            .tracking(FieldTextStyle.h18Bold.tracking)
            .lineLimit(1)
            .fixedSize()
    }
}

// MARK: - Under the field

/// Everything that can appear between the field and the button: the helper line, domain chips,
/// a typo fix and, for someone new, the consent line.
private struct FieldSupport: View {
    var flow: AuthFlow
    let isFocused: Bool
    let nudging: Bool
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let helper {
                FieldHelperText(text: helper.text, tone: helper.tone)
                    .id(helper.text)
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s8)
                    .accessibilityAddTraits(.updatesFrequently)
            }

            if case .typo(let suggestion) = flow.hint, !flow.showsInputError {
                TypoFix(suggestion: suggestion) { flow.applyCorrection(suggestion) }
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s4)
            }

            if case .domains(let domains) = flow.hint, isFocused, !flow.showsInputError {
                DomainChips(domains: Array(domains.prefix(3))) { flow.applyDomain($0) }
                    .transition(.softRise)
                    .padding(.top, FieldSpace.s16)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Whether anything shows between the field and the button.
    static func hasContent(flow: AuthFlow, isFocused: Bool, nudging: Bool) -> Bool {
        if flow.showsInputError || nudging { return true }
        switch flow.hint {
        case .returning, .new, .typo: return true
        case .domains: return isFocused
        default: return false
        }
    }

    private var helper: (text: String, tone: FieldHelperText.Tone)? {
        if flow.showsInputError { return (inputError, .error) }
        if nudging { return (nudge, .action) }
        switch flow.hint {
        case .returning:
            return (lang.t("Welcome back!", "أهلاً بعودتك!"), .success)
        case .new:
            return (lang.t("New at noon! Get started", "جديد على نون! لنبدأ"), .neutral)
        default:
            return nil
        }
    }

    private var nudge: String {
        guard flow.variant == .toggle else {
            return lang.t("Start typing your email or mobile number", "ابدأ بكتابة بريدك الإلكتروني أو رقم جوالك")
        }
        return flow.method == .phone
            ? lang.t("Start typing your mobile number", "ابدأ بكتابة رقم جوالك")
            : lang.t("Start typing your email address", "ابدأ بكتابة بريدك الإلكتروني")
    }

    /// Says exactly what's missing instead of "Invalid input".
    private var inputError: String {
        switch flow.kind {
        case .unknown:
            guard flow.variant == .toggle else {
                return lang.t("Enter your email or mobile number to continue", "أدخل بريدك الإلكتروني أو رقم جوالك للمتابعة")
            }
            return flow.method == .phone
                ? lang.t("Enter your mobile number to continue", "أدخل رقم جوالك للمتابعة")
                : lang.t("Enter your email address to continue", "أدخل بريدك الإلكتروني للمتابعة")
        case .phone:
            return lang.t("Logging in with phone number is not available. Please use your email address to log in.",
                          "تسجيل الدخول برقم الهاتف غير متاح. يرجى استخدام بريدك الإلكتروني لتسجيل الدخول.")
        case .email:
            return lang.t("Enter a valid email, like name@example.com", "أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com")
        }
    }
}

struct DomainChips: View {
    let domains: [String]
    var onPick: (String) -> Void

    var body: some View {
        HStack(spacing: FieldSpace.s8) {
            ForEach(domains, id: \.self) { domain in
                FieldRoundButton(title: ltr("@\(domain)")) { onPick(domain) }
                    .transition(.iconSwap)
            }
        }
        .animation(Motion.snappy, value: domains)
        .sensoryFeedback(.selection, trigger: domains.count)
    }
}

struct TypoFix: View {
    let suggestion: String
    var onAccept: () -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        Button(action: onAccept) {
            Text(attributed)
                .fieldText(.b12Medium)
                .foregroundStyle(FieldColour.TextNIcon.tertiary)
                .multilineTextAlignment(.leading)
                .padding(.horizontal, FieldSpace.s8)
                .frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(FieldPressStyle(scale: 0.98))
    }

    private var attributed: AttributedString {
        var result = AttributedString(lang.t("Did you mean ", "هل تقصد "))
        var email = AttributedString(ltr(suggestion))
        email.foregroundColor = FieldColour.TextNIcon.action
        email.font = FieldTextStyle.b12SemiBold.font
        result += email
        result += AttributedString(lang.t("?", "؟"))
        return result
    }
}

/// The consent line new customers agree to with "Agree & get OTP".
struct ConsentLine: View {
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        Text(attributed)
            .fieldText(.b12Regular)
            .foregroundStyle(FieldColour.TextNIcon.tertiary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, FieldSpace.s8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .environment(\.openURL, OpenURLAction { url in
                onOpen(url)
                return .handled
            })
    }

    private var attributed: AttributedString {
        let url = Links.privacyPolicy(lang).absoluteString
        let markdown = lang.t(
            "By continuing, you agree to our [Privacy Policy](\(url)) & consent to receiving marketing communications.",
            "بالمتابعة، أنت توافق على [سياسة الخصوصية](\(url)) وعلى تلقّي الرسائل التسويقية."
        )
        var result = (try? AttributedString(markdown: markdown)) ?? AttributedString(markdown)
        for run in result.runs where run.link != nil {
            result[run.range].font = FieldTextStyle.b12Medium.font
            result[run.range].foregroundColor = FieldColour.TextNIcon.action
        }
        return result
    }
}

// MARK: - Footer

/// Policies · Sell on noon ↗ (B12, muted, a 2pt dot between).
struct FooterLinks: View {
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        HStack(spacing: FieldSpace.s12) {
            Button { onOpen(Links.policies) } label: {
                Text(lang.t("Policies", "السياسات")).fixedSize()
            }
            Circle().fill(FieldColour.Border.medium).frame(width: 2, height: 2)
            Button {
                onOpen(Links.sellOnNoon)
            } label: {
                HStack(spacing: 0) {
                    Text(lang.t("Sell on noon", "بِع على نون")).fixedSize()
                    FieldIcon(.arrowUpRightBold, size: 12)
                        .flipsForRightToLeftLayoutDirection(true)
                }
            }
        }
        .font(FieldTextStyle.b12Regular.font)
        .foregroundStyle(FieldColour.TextNIcon.muted)
        .buttonStyle(FieldPressStyle(scale: 0.96))
        .fixedSize()
        .padding(.top, FieldSpace.s4)
        .frame(height: 22.scaled)
        .frame(maxWidth: .infinity)
        .contentShape(Rectangle().inset(by: -11))
    }
}

/// Footer (Figma 921:241896): links, four social tiles and the version · copyright line. Only at
/// rest, mostly below the fold.
struct AuthFooter: View {
    /// The tabs layout shows the links above the fold, so the footer starts at the tiles.
    var showsLinks = true
    var onOpen: (URL) -> Void
    @Environment(\.lang) private var lang

    var body: some View {
        VStack(spacing: FieldSpace.s12) {
            if showsLinks {
                FooterLinks(onOpen: onOpen)
            }

            HStack(spacing: FieldSpace.s8) {
                social(FieldArt.social("facebook"), "Facebook", Links.facebook)
                social(FieldArt.social("x"), "X", Links.x)
                social(FieldArt.social("linkedin"), "LinkedIn", Links.linkedIn)
                social(FieldArt.social("instagram"), "Instagram", Links.instagram)
            }

            HStack(spacing: FieldSpace.s12) {
                Text(verbatim: "V2026.01.2214")
                Circle().fill(FieldColour.Border.medium).frame(width: 2, height: 2)
                Text(lang.t("© \(String(Calendar.current.component(.year, from: .now))) noon. All Rights Reserved",
                            "© \(String(Calendar.current.component(.year, from: .now))) نون. جميع الحقوق محفوظة"))
            }
            .font(FieldTextStyle.b12Regular.font)
            .foregroundStyle(FieldColour.TextNIcon.muted)
            .lineLimit(1)
            .fixedSize()
            .frame(height: 18.scaled)
        }
        .frame(maxWidth: .infinity)
    }

    private func social(_ image: String, _ name: String, _ url: URL) -> some View {
        Button { onOpen(url) } label: {
            Image(image)
                .resizable()
                .scaledToFit()
                .frame(width: 40.scaled, height: 40.scaled)
                .frame(maxWidth: .infinity)
                .frame(height: 40.scaled)
                .background(RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous).fill(FieldColour.Surface.secondary))
                .contentShape(RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous))
        }
        .buttonStyle(FieldPressStyle(scale: 0.96))
        .accessibilityLabel(lang.t("noon on \(name)", "نون على \(name)"))
    }
}

extension FieldArt {
    static func social(_ network: String) -> String { "social-\(network)" }
}

// MARK: - Email / Phone number toggle

/// Tabs flow: the M-Switch segmented control (secondary track, white handle that slides to the
/// choice), Phone number first.
private struct LoginMethodToggle: View {
    let selection: IdentifierKind
    var onSelect: (IdentifierKind) -> Void
    @Environment(\.lang) private var lang
    @Namespace private var handle

    var body: some View {
        HStack(spacing: 0) {
            segment(.phone, lang.t("Phone number", "رقم الهاتف"))
            segment(.email, lang.t("Email", "البريد الإلكتروني"))
        }
        .padding(FieldSpace.s4)
        .background(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous).fill(FieldColour.Surface.secondary))
        // Figma M-Switch: a faint inner shadow pressed into the track.
        .overlay(
            RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous)
                .stroke(Color(fieldHex: 0x242424, alpha: 0.04), lineWidth: 2)
                .blur(radius: 2)
                .offset(y: 1)
                .clipShape(RoundedRectangle(cornerRadius: FieldRadius.r12, style: .continuous))
                .allowsHitTesting(false)
        )
        .animation(FieldMotion.Spring.snappy, value: selection)
        .accessibilityElement(children: .contain)
    }

    private func segment(_ kind: IdentifierKind, _ title: String) -> some View {
        let isOn = selection == kind
        return Button {
            onSelect(kind)
        } label: {
            Text(title)
                .fieldText(.b14SemiBold)
                .foregroundStyle(isOn ? FieldColour.TextNIcon.primary : FieldColour.TextNIcon.tertiary)
                .lineLimit(1)
                .frame(maxWidth: .infinity)
                .frame(height: 42.scaled)
                .background {
                    if isOn {
                        RoundedRectangle(cornerRadius: FieldRadius.r10, style: .continuous)
                            .fill(FieldColour.Surface.primary)
                            .shadow(color: Color(fieldHex: 0x222222, alpha: 0.06), radius: 1.5, y: 1)
                            .matchedGeometryEffect(id: "handle", in: handle)
                    }
                }
                .contentShape(Rectangle())
        }
        .buttonStyle(FieldPressStyle())
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}
