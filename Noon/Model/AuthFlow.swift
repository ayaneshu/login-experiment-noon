import SwiftUI

enum AuthField: Hashable {
    case otp, password, passwordVisible
}

/// The sign-in state machine. Views render it; they never decide what happens next.
@Observable
final class AuthFlow {
    enum Step: Equatable {
        case remembered, identify, otp, password
    }

    enum Lookup: Equatable {
        case idle, checking, returning(Account), new
    }

    enum Channel: Equatable {
        case sms, whatsapp, email
    }

    enum CodeState: Equatable {
        case entering, verifying, failed, verified
    }

    enum PasswordState: Equatable {
        case idle, verifying, failed, verified
    }

    enum BiometricState: Equatable {
        case idle, scanning, failed
    }

    enum CodeSource: Equatable {
        case messages, mail, pasted, filled
    }

    /// A moment the header should react to with a colour wash.
    struct HeaderEvent: Equatable {
        enum Kind: Equatable {
            /// Returning account found, or verification passed: green.
            case success
            /// Something needs fixing: orange.
            case error
            /// A new customer: yellow, with a hand waving hello.
            case welcome
        }

        let kind: Kind
        /// Where the wash grows from, in window coordinates.
        let origin: CGPoint
        let id = UUID()
    }

    /// What the line under the identifier field says right now.
    enum Hint: Hashable {
        case intro
        case digitsLeft(Int)
        case badPrefix(Country)
        case domains([String])
        case typo(String)
        case checking
        case returning(IdentifierKind)
        case new(IdentifierKind)
    }

    let store: DeviceStore
    @ObservationIgnored var onAuthenticated: ((Account, Bool, CGPoint) -> Void)?

    /// The latest header reaction. Views animate whenever its id changes.
    private(set) var headerEvent: HeaderEvent?

    // MARK: Navigation

    private(set) var step: Step
    private(set) var direction: NavDirection = .forward
    /// Where the current verification started: `.identify` or `.remembered`.
    private(set) var origin: Step = .identify

    // MARK: Identify

    private(set) var input = ""
    /// Bumped whenever the flow rewrites what was typed, so the text field re-syncs.
    private(set) var inputRevision = 0
    private(set) var kind: IdentifierKind = .unknown
    private(set) var country: Country = .initial
    private(set) var lookup: Lookup = .idle
    private(set) var isSending = false
    private(set) var rejectedKeystrokes = 0
    private(set) var remembered: RememberedAccount?
    /// Set when "Sign in with OTP" is tapped before the input is a valid email or number.
    private(set) var showsInputError = false
    /// Smart field, or an explicit Email / Phone number toggle (a prototype setting).
    private(set) var variant: LoginVariant
    /// Toggle variant: what the field accepts. Phone number comes first.
    private(set) var method: IdentifierKind = .phone

    // MARK: Verify

    private(set) var target: Identifier?
    private(set) var targetAccount: Account?
    private(set) var channel: Channel = .sms
    private(set) var code = ""
    /// What the hidden text field holds. Follows `code`, but can briefly hold a raw paste.
    private(set) var codeText = ""
    private(set) var codeState: CodeState = .entering
    private(set) var showsCodeError = false
    private(set) var codeSource: CodeSource?
    private(set) var resendIn = 0
    private(set) var isResending = false
    private(set) var resentVia: Channel?

    // MARK: Password

    var password = "" {
        didSet {
            if passwordState == .failed, password != oldValue { passwordState = .idle }
        }
    }
    private(set) var passwordState: PasswordState = .idle

    // MARK: Biometrics

    private(set) var biometricState: BiometricState = .idle

    /// Where the welcome reveal grows from, in window coordinates.
    @ObservationIgnored var ctaAnchor: CGPoint = .zero
    @ObservationIgnored var codeAnchor: CGPoint = .zero
    @ObservationIgnored var fieldAnchor: CGPoint = .zero

    @ObservationIgnored private var lookupTask: Task<Void, Never>?
    @ObservationIgnored private var timerTask: Task<Void, Never>?
    @ObservationIgnored private var autofillTask: Task<Void, Never>?
    @ObservationIgnored private var verifyTask: Task<Void, Never>?
    @ObservationIgnored private var sentCode = ""
    @ObservationIgnored private var submitWhenResolved = false
    /// The identifier the header last reacted to, so correcting a typo doesn't replay the wash.
    @ObservationIgnored private var celebratedKey: String?
    /// Toggle variant: what was typed under each option, restored when you switch back.
    @ObservationIgnored private var drafts: [IdentifierKind: String] = [:]

    init(store: DeviceStore) {
        self.store = store
        variant = store.loginVariant
        remembered = store.remembered
        step = store.remembered == nil ? .identify : .remembered
    }

    // MARK: - Derived

    var canGoBack: Bool {
        switch step {
        case .remembered: false
        case .identify: remembered != nil
        case .otp, .password: true
        }
    }

    var phoneDigits: String { InputParser.digits(input) }

    var phoneValidity: PhoneFormatter.Validity {
        PhoneFormatter.validate(phoneDigits, country: country)
    }

    var identifier: Identifier? {
        switch kind {
        case .unknown:
            return nil
        case .phone:
            guard phoneValidity == .valid else { return nil }
            return .phone(PhoneNumber(countryID: country.id, nsn: PhoneFormatter.nsn(phoneDigits, country: country)))
        case .email:
            return EmailAssist.isValid(input) ? .email(input) : nil
        }
    }

    var isNewCustomer: Bool { lookup == .new }

    var ghostCompletion: String? {
        kind == .email ? EmailAssist.ghostCompletion(for: input) : nil
    }

    /// Any existing account can choose a password instead of a code; someone signing up for the
    /// first time has no password yet.
    var canUsePassword: Bool { targetAccount != nil }
    var rememberedUsesPasskey: Bool { remembered?.passkeyEnabled == true }

    var hint: Hint {
        switch kind {
        case .unknown:
            return .intro
        case .phone:
            switch phoneValidity {
            case .empty: return .intro
            case .badPrefix: return .badPrefix(country)
            case .incomplete(let remaining): return .digitsLeft(remaining)
            case .valid: break
            }
        case .email:
            if !EmailAssist.isValid(input) || ghostCompletion != nil {
                let domains = EmailAssist.domainSuggestions(for: input)
                return domains.isEmpty ? .intro : .domains(domains)
            }
            if let fix = EmailAssist.typoCorrection(for: input) { return .typo(fix) }
        }
        switch lookup {
        case .idle, .checking: return .checking
        case .returning: return .returning(kind)
        case .new: return .new(kind)
        }
    }

    // MARK: - Identify

    func setInput(_ newValue: String) {
        let normalized = InputParser.normalizingDigits(newValue)
        let detected = detectedKind(normalized)
        var nextCountry = country
        let value: String

        switch detected {
        case .unknown:
            value = ""
        case .email:
            value = normalized.filter { !$0.isWhitespace }
        case .phone:
            let trimmed = normalized.trimmingCharacters(in: .whitespaces)
            var digits = InputParser.digits(trimmed)
            let international = trimmed.hasPrefix("+") || digits.hasPrefix("00")

            if international {
                if digits.hasPrefix("00") { digits.removeFirst(2) }
                guard let match = Country.matching(dialPrefixOf: digits) else {
                    // Still typing the dial code: show it exactly as typed.
                    commit("+" + digits, kind: .phone, country: nextCountry, typed: newValue)
                    return
                }
                nextCountry = match
                digits.removeFirst(match.dialCode.count)
            } else if digits.count > nextCountry.maxDigits(startingWithZero: digits.hasPrefix("0")) {
                // Pasted with the dial code but no "+", like 971501234567.
                if digits.hasPrefix(nextCountry.dialCode), digits.count - nextCountry.dialCode.count <= nextCountry.length {
                    digits.removeFirst(nextCountry.dialCode.count)
                } else if let match = Country.matching(dialPrefixOf: digits), digits.count - match.dialCode.count == match.length {
                    nextCountry = match
                    digits.removeFirst(match.dialCode.count)
                }
            }

            let limit = nextCountry.maxDigits(startingWithZero: PhoneFormatter.startsWithTrunkZero(digits, country: nextCountry))
            if digits.count > limit {
                digits = String(digits.prefix(limit))
                rejectedKeystrokes += 1
            }
            value = PhoneFormatter.format(digits, country: nextCountry)
        }

        commit(value, kind: detected, country: nextCountry, typed: newValue)
    }

    /// The smart field guesses from what's typed; the toggle variant takes what's selected.
    private func detectedKind(_ text: String) -> IdentifierKind {
        guard variant == .toggle else { return InputParser.detect(text) }
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .unknown }
        if method == .phone {
            return InputParser.digits(trimmed).isEmpty && !trimmed.hasPrefix("+") ? .unknown : .phone
        }
        return .email
    }

    /// Whether the country code chip sits beside the field.
    var showsCountryChip: Bool {
        if input.hasPrefix("+") { return false }
        return variant == .toggle ? method == .phone : kind == .phone
    }

    /// Toggle variant: switch between Email and Phone number, each keeping its own draft.
    func setMethod(_ newMethod: IdentifierKind) {
        guard variant == .toggle, newMethod != .unknown, newMethod != method else { return }
        drafts[method] = input
        withAnimation(Motion.snappy) {
            method = newMethod
            showsInputError = false
        }
        setInput(drafts[newMethod] ?? "")
        inputRevision += 1
    }

    /// Prototype controls: swap between the smart field and the Email / Phone number toggle.
    func setVariant(_ newVariant: LoginVariant) {
        guard newVariant != variant else { return }
        drafts = [:]
        withAnimation(Motion.smooth) {
            variant = newVariant
            method = .phone
            showsInputError = false
        }
        guard step == .identify else { return }
        setInput("")
        inputRevision += 1
    }

    private func commit(_ value: String, kind detected: IdentifierKind, country nextCountry: Country, typed: String) {
        let changed = value != input || nextCountry != country
        if detected != kind || nextCountry != country {
            withAnimation(Motion.snappy) {
                kind = detected
                country = nextCountry
            }
        }
        if value != typed { inputRevision += 1 }
        input = value
        if showsInputError, changed { withAnimation(Motion.snappy) { showsInputError = false } }
        if changed { identityChanged() }
    }

    func selectCountry(_ newCountry: Country) {
        guard newCountry != country else { return }
        let startsWithZero = PhoneFormatter.startsWithTrunkZero(phoneDigits, country: newCountry)
        let digits = String(phoneDigits.prefix(newCountry.maxDigits(startingWithZero: startsWithZero)))
        withAnimation(Motion.snappy) { country = newCountry }
        input = PhoneFormatter.format(digits, country: newCountry)
        inputRevision += 1
        identityChanged()
    }

    func applyDomain(_ provider: String) {
        setInput(EmailAssist.completing(input, with: provider))
    }

    func acceptGhostCompletion() {
        guard let ghost = ghostCompletion else { return }
        setInput(input + ghost)
    }

    func applyCorrection(_ email: String) {
        setInput(email)
    }

    func clearInput() {
        setInput("")
    }

    func returnKeyPressed() {
        if identifier == nil, ghostCompletion != nil {
            acceptGhostCompletion()
        } else {
            submitIdentifier()
        }
    }

    func submitIdentifier() {
        guard step == .identify else { return }
        guard let identifier else {
            // The CTA is always tappable; explain what's missing instead of disabling it.
            withAnimation(Motion.snappy) { showsInputError = true }
            emit(.error, from: fieldAnchor)
            return
        }
        switch lookup {
        case .idle:
            // Held back while the domain still looked half-typed; the tap says it's finished.
            startLookup(for: identifier)
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .checking:
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .returning(let account):
            startVerification(for: identifier, account: account, from: .identify)
        case .new:
            startVerification(for: identifier, account: nil, from: .identify)
        }
    }

    private func identityChanged() {
        lookupTask?.cancel()
        submitWhenResolved = false
        if isSending { withAnimation(Motion.snappy) { isSending = false } }
        // "ajain@gmail.co" is a valid address, but almost always "gmail.com" on its way: wait.
        guard let identifier, !(kind == .email && ghostCompletion != nil) else {
            if lookup != .idle { withAnimation(Motion.snappy) { lookup = .idle } }
            return
        }
        startLookup(for: identifier)
    }

    private func startLookup(for identifier: Identifier) {
        lookupTask?.cancel()
        withAnimation(Motion.snappy) { lookup = .checking }
        let registered = store.registered
        lookupTask = Task {
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            let account = try? await AuthService.lookup(identifier, registered: registered)
            guard !Task.isCancelled else { return }
            withAnimation(Motion.smooth) {
                lookup = account.map(Lookup.returning) ?? .new
            }
            if celebratedKey != identifier.key {
                celebratedKey = identifier.key
                emit(account == nil ? .welcome : .success, from: fieldAnchor)
            }
            guard submitWhenResolved else { return }
            submitWhenResolved = false
            if account == nil {
                // A new customer must see the consent line and tap "Agree & get OTP" themselves.
                withAnimation(Motion.snappy) { isSending = false }
            } else {
                submitIdentifier()
            }
        }
    }

    // MARK: - Remembered account

    func useDifferentAccount() {
        lookupTask?.cancel()
        input = ""
        kind = .unknown
        lookup = .idle
        inputRevision += 1
        biometricState = .idle
        go(to: .identify, .forward)
    }

    func forgetRememberedAccount() {
        store.remembered = nil
        remembered = nil
        useDifferentAccount()
    }

    func sendCodeToRememberedAccount() {
        guard let remembered else { return }
        startVerification(for: remembered.account.identifier, account: remembered.account, from: .remembered)
    }

    func signInWithPasskey(reason: String, fallbackTitle: String) {
        guard let remembered, biometricState != .scanning else { return }
        withAnimation(Motion.snappy) { biometricState = .scanning }
        Task {
            let outcome = await Biometrics.authenticate(reason: reason, fallbackTitle: fallbackTitle)
            switch outcome {
            case .success:
                target = remembered.account.identifier
                targetAccount = remembered.account
                emit(.success, from: ctaAnchor)
                try? await Task.sleep(for: .milliseconds(450))
                onAuthenticated?(remembered.account, false, ctaAnchor)
            case .cancelled:
                withAnimation(Motion.snappy) { biometricState = .idle }
            case .fallback:
                withAnimation(Motion.snappy) { biometricState = .idle }
                sendCodeToRememberedAccount()
            case .failed:
                withAnimation(Motion.snappy) { biometricState = .failed }
                emit(.error, from: ctaAnchor)
            }
        }
    }

    // MARK: - Verify

    private func startVerification(for identifier: Identifier, account: Account?, from origin: Step) {
        submitWhenResolved = false
        withAnimation(Motion.snappy) { isSending = true }
        Task {
            guard let code = try? await AuthService.sendCode(to: identifier) else {
                withAnimation(Motion.snappy) { isSending = false }
                return
            }
            sentCode = code
            target = identifier
            targetAccount = account
            channel = identifier.isPhone ? .sms : .email
            self.origin = origin
            resentVia = nil
            password = ""
            passwordState = .idle
            resetCode()
            go(to: .otp, .forward) { self.isSending = false }
            startResendTimer()
            scheduleAutofill()
        }
    }

    /// Called by the hidden text field as the user types, pastes or taps a keyboard suggestion.
    func typeCode(_ typed: String) {
        applyCode(typed, source: nil)
        guard typed != code else {
            codeText = typed
            return
        }
        // Same rule as the identifier field: mirror the edit, then correct it on the next turn.
        codeText = typed
        Task {
            guard codeText == typed else { return }
            codeText = code
        }
    }

    private func setCode(_ newValue: String, source: CodeSource) {
        applyCode(newValue, source: source)
        codeText = code
    }

    private func applyCode(_ newValue: String, source: CodeSource?) {
        guard codeState == .entering else { return }
        let digits = String(InputParser.digits(InputParser.normalizingDigits(newValue)).prefix(6))
        guard digits != code else { return }

        let isBulk = digits.count - code.count > 1
        if showsCodeError { withAnimation(Motion.snappy) { showsCodeError = false } }
        if digits.count < code.count {
            codeSource = nil
        } else if isBulk {
            codeSource = source ?? .filled
        }
        if resentVia != nil, !digits.isEmpty { withAnimation(Motion.snappy) { resentVia = nil } }
        if source == nil { autofillTask?.cancel() }

        code = digits
        if digits.count == 6 {
            verify(after: isBulk ? .milliseconds(420) : .milliseconds(160))
        }
    }

    /// Accepts anything containing a 6-digit code, like "Your noon code is 482913".
    func paste(_ text: String) {
        let normalized = InputParser.normalizingDigits(text)
        if let match = normalized.firstMatch(of: /\d{6}/) {
            setCode(String(match.output), source: .pasted)
        } else {
            setCode(normalized, source: .pasted)
        }
    }

    private func verify(after delay: Duration) {
        verifyTask?.cancel()
        verifyTask = Task {
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled, code.count == 6 else { return }
            withAnimation(Motion.snappy) { codeState = .verifying }
            let isCorrect = (try? await AuthService.verify(code: code)) ?? false
            guard !Task.isCancelled else { return }
            if isCorrect {
                timerTask?.cancel()
                autofillTask?.cancel()
                withAnimation(Motion.snappy) { codeState = .verified }
                emit(.success, from: codeAnchor)
                // Long enough to register the green digits before they resolve into the avatar.
                try? await Task.sleep(for: .milliseconds(550))
                finish(anchor: codeAnchor)
            } else {
                withAnimation(Motion.snappy) {
                    codeState = .failed
                    showsCodeError = true
                }
                emit(.error, from: codeAnchor)
                try? await Task.sleep(for: .milliseconds(700))
                guard !Task.isCancelled else { return }
                code = ""
                codeText = ""
                codeSource = nil
                withAnimation(Motion.snappy) { codeState = .entering }
            }
        }
    }

    func resend(via newChannel: Channel) {
        guard let target, resendIn == 0, !isResending else { return }
        withAnimation(Motion.snappy) { isResending = true }
        Task {
            guard let code = try? await AuthService.sendCode(to: target) else {
                withAnimation(Motion.snappy) { isResending = false }
                return
            }
            sentCode = code
            resetCode()
            withAnimation(Motion.smooth) {
                channel = newChannel
                resentVia = newChannel
                isResending = false
            }
            startResendTimer()
            scheduleAutofill()
        }
    }

    func editIdentifier() {
        guard let target else { return }
        leaveVerification()
        lookupTask?.cancel()
        switch target {
        case .phone(let number):
            country = number.country
            input = PhoneFormatter.format(number.nsn, country: number.country)
            kind = .phone
        case .email(let email):
            input = email
            kind = .email
        }
        if variant == .toggle { method = kind }
        inputRevision += 1
        lookup = targetAccount.map(Lookup.returning) ?? .new
        go(to: .identify, .backward)
    }

    /// "Change" on the code or password screen: back to the remembered account if that's where
    /// this started, otherwise back to the field with what was typed.
    func changeIdentity() {
        if origin == .remembered {
            leaveVerification()
            go(to: .remembered, .backward)
        } else {
            editIdentifier()
        }
    }

    func switchToPassword() {
        autofillTask?.cancel()
        passwordState = .idle
        go(to: .password, .forward)
    }

    func switchToCode() {
        go(to: .otp, .backward)
    }

    func submitPassword() {
        guard !password.isEmpty, passwordState != .verifying, passwordState != .verified else { return }
        withAnimation(Motion.snappy) { passwordState = .verifying }
        Task {
            let isCorrect = (try? await AuthService.verify(password: password)) ?? false
            if isCorrect {
                withAnimation(Motion.snappy) { passwordState = .verified }
                emit(.success, from: ctaAnchor)
                try? await Task.sleep(for: .milliseconds(600))
                finish(anchor: ctaAnchor)
            } else {
                withAnimation(Motion.snappy) { passwordState = .failed }
                emit(.error, from: fieldAnchor)
            }
        }
    }

    func back() {
        switch step {
        case .remembered:
            return
        case .identify:
            guard remembered != nil else { return }
            biometricState = .idle
            go(to: .remembered, .backward)
        case .otp:
            leaveVerification()
            go(to: origin, .backward)
        case .password:
            go(to: .otp, .backward)
        }
    }

    // MARK: - Demo

    func demoFill(_ identifier: Identifier) {
        lookupTask?.cancel()
        switch identifier {
        case .phone(let number):
            country = number.country
            input = PhoneFormatter.format(number.nsn, country: number.country)
            kind = .phone
        case .email(let email):
            input = email
            kind = .email
        }
        if variant == .toggle { method = kind }
        inputRevision += 1
        if step != .identify { go(to: .identify, .forward) }
        identityChanged()
    }

    // MARK: - Private

    private func emit(_ kind: HeaderEvent.Kind, from origin: CGPoint) {
        headerEvent = HeaderEvent(kind: kind, origin: origin)
    }

    private func finish(anchor: CGPoint) {
        guard let target else { return }
        let isNew = targetAccount == nil
        let account = targetAccount ?? Account(firstName: nil, lastName: nil, identifier: target, hasPassword: false)
        if isNew { store.registered[target.key] = account }
        onAuthenticated?(account, isNew, anchor)
    }

    /// Changes step. When the direction flips, the outgoing view gets one frame to pick up the
    /// new direction first, so it leaves the way it should.
    private func go(to next: Step, _ newDirection: NavDirection, alongside changes: @escaping @MainActor () -> Void = {}) {
        let apply: @MainActor () -> Void = {
            withAnimation(Motion.smooth) {
                self.step = next
                changes()
            }
        }
        if direction != newDirection {
            direction = newDirection
            Task {
                try? await Task.sleep(for: .milliseconds(20))
                apply()
            }
        } else {
            apply()
        }
    }

    private func resetCode() {
        verifyTask?.cancel()
        code = ""
        codeText = ""
        codeState = .entering
        showsCodeError = false
        codeSource = nil
    }

    private func leaveVerification() {
        verifyTask?.cancel()
        autofillTask?.cancel()
        timerTask?.cancel()
        resetCode()
    }

    private func startResendTimer() {
        timerTask?.cancel()
        resendIn = 30
        timerTask = Task {
            while resendIn > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                withAnimation(Motion.snappy) { resendIn -= 1 }
            }
        }
    }

    private func scheduleAutofill() {
        autofillTask?.cancel()
        guard store.simulateAutofill, channel != .whatsapp else { return }
        let source: CodeSource = channel == .email ? .mail : .messages
        autofillTask = Task {
            try? await Task.sleep(for: .seconds(2.6))
            guard !Task.isCancelled, step == .otp, code.isEmpty, codeState == .entering else { return }
            setCode(sentCode, source: source)
        }
    }
}
