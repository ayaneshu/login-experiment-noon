import SwiftUI

enum AuthField: Hashable {
    case otp, password, passwordVisible
}

/// The sign-in state machine. Views render it; they never decide what happens next.
@Observable
final class AuthFlow {
    enum Step: Equatable {
        case remembered, identify, otp, password
        /// A new customer chose "Sign up with password" on the code screen.
        case createPassword
        /// Separate flow: "Welcome to noon" with Log in and Create new account.
        case welcome
        /// Separate flow: Log in with email or phone.
        case login
        /// Separate flow: Sign up with email only.
        case signup
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

    // MARK: Create password

    var newPassword = "" {
        didSet {
            if passwordState == .failed, newPassword != oldValue { passwordState = .idle }
        }
    }
    /// Bumped when "Create account" is tapped before every rule is met, so the field can shake.
    private(set) var weakPasswordAttempts = 0

    /// What a new password still needs, in the order the hint lists them.
    struct PasswordRules: Equatable {
        var length: Bool
        var number: Bool
        var symbol: Bool
        var uppercase: Bool
        var lowercase: Bool
        var isStrong: Bool { length && number && symbol && uppercase && lowercase }
    }

    var passwordRules: PasswordRules {
        PasswordRules(
            length: newPassword.count >= 8,
            number: newPassword.contains(where: \.isNumber),
            symbol: newPassword.contains { !$0.isLetter && !$0.isNumber && !$0.isWhitespace },
            uppercase: newPassword.contains(where: \.isUppercase),
            lowercase: newPassword.contains(where: \.isLowercase)
        )
    }

    // MARK: Separate Log in / Sign up

    /// Log in: the number typed has no account. Error under the field + "Continue with email".
    private(set) var phoneHasNoAccount = false
    /// Sign up: the email typed already has an account. Green, TnC hides, "Continue to log in".
    private(set) var foundOnSignup: Account?
    /// Checkout or a link opened Log in directly: ✕ closes instead of going back to Welcome.
    private(set) var entryIsDirect = false
    /// Sign up was reached from Log in (back returns there rather than to Welcome).
    private var signupFromLogin = false
    /// Saved account: the system-style Face ID sheet is up.
    private(set) var showsFaceIDPrompt = false
    /// Saved account: Face ID misses so far. Two misses (or a cancel) fall back to a code.
    private(set) var faceIDFailures = 0

    var isSeparate: Bool { variant == .separate }
    /// Opened from checkout or a link: the first screen gets ✕ instead of a back arrow.
    var showsCloseInsteadOfBack: Bool {
        entryIsDirect && (step == .login || (step == .signup && !signupFromLogin))
    }
    var isAccountForm: Bool { step == .login || step == .signup }

    /// Sign up takes email only: a number turns the field red and keeps the button disabled.
    var signupPhoneError: Bool { step == .signup && kind == .phone }
    /// "Agree & get OTP" stays dimmed until the email is valid.
    var canSubmitSignup: Bool { foundOnSignup != nil || (kind == .email && identifier != nil) }

    // MARK: Passkey found

    /// A typed-in account that has a passkey on this device: offer Face ID before sending a code.
    private(set) var passkeyOffer: Account?

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
        step = store.remembered != nil ? .remembered : (store.loginVariant == .separate ? .welcome : .identify)
    }

    // MARK: - Derived

    var canGoBack: Bool {
        switch step {
        case .remembered, .welcome: false
        case .identify: remembered != nil
        case .login: !entryIsDirect
        case .signup: !entryIsDirect || signupFromLogin
        case .otp, .password, .createPassword: true
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
    var canUsePassword: Bool {
        // The separate flow offers a password only to accounts that have one.
        isSeparate ? targetAccount?.hasPassword == true : targetAccount != nil
    }
    /// Someone signing up can set a password instead of using the code.
    var canCreatePassword: Bool { targetAccount == nil && target != nil }
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
        case .phone where isSeparate && step == .signup:
            // Sign up takes email only: show the number exactly as typed, under the error.
            value = normalized.trimmingCharacters(in: .whitespaces)
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
        // (The separate flow detects like the smart field: Log in takes both, Sign up flags numbers.)
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
        if isSeparate { return step == .login && kind == .phone }
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
        if step == .login { submitLogin(); return }
        if step == .signup { submitSignup(); return }
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
            if AuthService.hasPasskey(account, remembered: store.remembered) {
                withAnimation(Motion.smooth) { passkeyOffer = account }
            } else {
                startVerification(for: identifier, account: account, from: .identify)
            }
        case .new:
            startVerification(for: identifier, account: nil, from: .identify)
        }
    }

    private func identityChanged() {
        lookupTask?.cancel()
        submitWhenResolved = false
        if isSending { withAnimation(Motion.snappy) { isSending = false } }
        if isSeparate {
            withAnimation(Motion.snappy) {
                phoneHasNoAccount = false
                foundOnSignup = nil
            }
            // Checked the moment it's complete, like the smart field. Sign up takes email only, so a
            // number there just shows its error.
            guard let identifier, !(kind == .email && ghostCompletion != nil), !(step == .signup && kind == .phone) else {
                if lookup != .idle { withAnimation(Motion.snappy) { lookup = .idle } }
                return
            }
            startAccountLookup(for: identifier)
            return
        }
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
        faceIDFailures = 0
        resetFormState()
        go(to: isSeparate ? .login : .identify, .forward)
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
                withAnimation(Motion.smooth) { showsFaceIDPrompt = false }
                emit(.success, from: ctaAnchor)
                try? await Task.sleep(for: .milliseconds(450))
                onAuthenticated?(remembered.account, false, ctaAnchor)
            case .cancelled where isSeparate, .fallback:
                // Cancelling the system sheet means "not now": send the code instead.
                withAnimation(Motion.snappy) {
                    biometricState = .idle
                    showsFaceIDPrompt = false
                }
                sendCodeToRememberedAccount()
            case .cancelled:
                withAnimation(Motion.snappy) { biometricState = .idle }
            case .failed:
                faceIDFailures += 1
                withAnimation(Motion.snappy) {
                    biometricState = .failed
                    showsFaceIDPrompt = false
                }
                emit(.error, from: ctaAnchor)
                if isSeparate, faceIDFailures >= 2 {
                    // Two misses: stop asking for a face and send the code.
                    try? await Task.sleep(for: .milliseconds(700))
                    withAnimation(Motion.snappy) { biometricState = .idle }
                    sendCodeToRememberedAccount()
                }
            }
        }
    }

    /// Separate flow, saved account: the system-style "Use Face ID to sign in?" sheet comes up and
    /// scans; the outcome lands in `signInWithPasskey`.
    func beginFaceIDPrompt() {
        guard remembered != nil, biometricState != .scanning else { return }
        withAnimation(.spring(duration: 0.45, bounce: 0)) { showsFaceIDPrompt = true }
    }

    /// ✕ on the Face ID sheet: same as cancelling the scan.
    func cancelFaceIDPrompt() {
        withAnimation(.spring(duration: 0.4, bounce: 0)) { showsFaceIDPrompt = false }
        guard biometricState != .scanning else { return }
        sendCodeToRememberedAccount()
    }

    // MARK: - Passkey found

    func signInWithFoundPasskey(reason: String, fallbackTitle: String) {
        guard let account = passkeyOffer, biometricState != .scanning else { return }
        withAnimation(Motion.snappy) { biometricState = .scanning }
        Task {
            let outcome = await Biometrics.authenticate(reason: reason, fallbackTitle: fallbackTitle)
            switch outcome {
            case .success:
                target = account.identifier
                targetAccount = account
                withAnimation(Motion.smooth) { passkeyOffer = nil }
                emit(.success, from: ctaAnchor)
                try? await Task.sleep(for: .milliseconds(450))
                onAuthenticated?(account, false, ctaAnchor)
            case .cancelled:
                withAnimation(Motion.snappy) { biometricState = .idle }
            case .fallback:
                withAnimation(Motion.snappy) { biometricState = .idle }
                declinePasskey()
            case .failed:
                withAnimation(Motion.snappy) { biometricState = .failed }
                emit(.error, from: ctaAnchor)
            }
        }
    }

    /// "Login with OTP" on the passkey sheet: close it and send the code as usual.
    func declinePasskey() {
        guard let account = passkeyOffer else { return }
        withAnimation(Motion.smooth) {
            passkeyOffer = nil
            biometricState = .idle
        }
        startVerification(for: account.identifier, account: account, from: isSeparate ? .login : .identify)
    }

    func dismissPasskeyOffer() {
        withAnimation(Motion.smooth) {
            passkeyOffer = nil
            biometricState = .idle
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
            // Phone codes go to WhatsApp first; SMS is the alternative.
            channel = identifier.isPhone ? .whatsapp : .email
            self.origin = origin
            resentVia = nil
            password = ""
            newPassword = ""
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
        if isSeparate {
            resetFormState()
            go(to: origin == .signup ? .signup : .login, .backward)
            return
        }
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

    /// "Sign up with password" on a new customer's code screen.
    func switchToCreatePassword() {
        guard canCreatePassword else { return }
        autofillTask?.cancel()
        passwordState = .idle
        go(to: .createPassword, .forward)
    }

    /// "Create account": every rule must be met; otherwise the field shakes and the hint says what's left.
    func createAccount() {
        guard passwordState != .verifying, passwordState != .verified else { return }
        guard passwordRules.isStrong else {
            weakPasswordAttempts += 1
            return
        }
        withAnimation(Motion.snappy) { passwordState = .verifying }
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            withAnimation(Motion.snappy) { passwordState = .verified }
            emit(.success, from: ctaAnchor)
            try? await Task.sleep(for: .milliseconds(600))
            finish(anchor: ctaAnchor, hasPassword: true)
        }
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
        case .remembered, .welcome:
            return
        case .login:
            guard !entryIsDirect else { return }
            resetFormState()
            go(to: remembered != nil ? .remembered : .welcome, .backward)
        case .signup:
            guard !entryIsDirect || signupFromLogin else { return }
            resetFormState()
            go(to: signupFromLogin ? .login : .welcome, .backward)
        case .identify:
            guard remembered != nil else { return }
            biometricState = .idle
            go(to: .remembered, .backward)
        case .otp:
            leaveVerification()
            if isSeparate, origin == .login || origin == .signup { resetFormState() }
            go(to: origin, .backward)
        case .password, .createPassword:
            go(to: .otp, .backward)
        }
    }

    // MARK: - Separate Log in / Sign up

    /// A fresh flow for checkout / a link: open on Log in with ✕, no transition.
    func prepareDirectLogin() {
        entryIsDirect = true
        step = .login
    }

    /// Welcome → "Log in", Choose your account → "Continue with different account", or straight in
    /// from checkout / a link (`direct`: ✕ closes instead of going back).
    func openLogin(direct: Bool = false) {
        if direct { entryIsDirect = true }
        replaceInput("")
        resetFormState()
        go(to: .login, .forward)
    }

    /// Welcome → "Create new account".
    func openSignup() {
        signupFromLogin = false
        replaceInput("")
        resetFormState()
        go(to: .signup, .forward)
    }

    /// The header chip: "New account" on Log in, "Log in" on Sign up. What was typed comes along,
    /// as long as Sign up can take it (an email).
    func switchAccountForm() {
        let next: Step = step == .login ? .signup : .login
        if next == .signup {
            signupFromLogin = true
            if kind == .phone { replaceInput("") }
        }
        resetFormState()
        go(to: next, next == .signup ? .forward : .backward)
        // What came along is checked again for the other form (its colour already played).
        identityChanged()
    }

    /// Log in, number has no account: "Continue with email" empties the field for an email.
    func continueWithEmail() {
        replaceInput("")
        withAnimation(Motion.snappy) {
            phoneHasNoAccount = false
            showsInputError = false
        }
    }

    private func replaceInput(_ value: String) {
        lookupTask?.cancel()
        input = value
        kind = InputParser.detect(value)
        inputRevision += 1
        lookup = .idle
    }

    private func resetFormState() {
        lookupTask?.cancel()
        submitWhenResolved = false
        isSending = false
        lookup = .idle
        showsInputError = false
        phoneHasNoAccount = false
        foundOnSignup = nil
    }

    /// Log in / Sign up: look the account up as soon as the entry is complete and react in the
    /// header straight away — green for an account, yellow for a new email, red for a number
    /// with no account. Continue, if it was tapped while we checked, carries on afterwards.
    private func startAccountLookup(for identifier: Identifier) {
        lookupTask?.cancel()
        withAnimation(Motion.snappy) { lookup = .checking }
        let registered = store.registered
        lookupTask = Task {
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            let account = try? await AuthService.lookup(identifier, registered: registered)
            guard !Task.isCancelled, step == .login || step == .signup else { return }
            let firstTime = celebratedKey != identifier.key
            celebratedKey = identifier.key
            if let account {
                withAnimation(Motion.smooth) {
                    lookup = .returning(account)
                    if step == .signup { foundOnSignup = account }
                }
                if firstTime { emit(.success, from: fieldAnchor) }
            } else if identifier.isPhone {
                // Numbers can't start a new account: point them to email.
                submitWhenResolved = false
                withAnimation(Motion.snappy) {
                    lookup = .idle
                    isSending = false
                    phoneHasNoAccount = true
                    showsInputError = true
                }
                if firstTime { emit(.error, from: fieldAnchor) }
                return
            } else {
                withAnimation(Motion.smooth) { lookup = .new }
                if firstTime { emit(.welcome, from: fieldAnchor) }
            }
            guard submitWhenResolved else { return }
            submitWhenResolved = false
            if step == .signup, account != nil {
                // "Continue to log in" takes its own tap.
                withAnimation(Motion.snappy) { isSending = false }
                return
            }
            // A beat of the colour first, then on.
            try? await Task.sleep(for: .milliseconds(account != nil ? 700 : 350))
            guard !Task.isCancelled else { return }
            submitIdentifier()
        }
    }

    /// Log in → Continue. The entry was checked while it was typed, so this acts on the result:
    /// Face ID or a code for an account, Sign up for a new email, the error again for a number.
    private func submitLogin() {
        guard let identifier else {
            // Incomplete number or email: say what's wrong, in red, next to the field.
            withAnimation(Motion.snappy) { showsInputError = true }
            emit(.error, from: fieldAnchor)
            return
        }
        if phoneHasNoAccount {
            emit(.error, from: fieldAnchor)
            return
        }
        switch lookup {
        case .idle:
            // Held back while the domain still looked half-typed; the tap says it's finished.
            startAccountLookup(for: identifier)
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .checking:
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .returning(let account):
            if AuthService.hasPasskey(account, remembered: store.remembered) {
                withAnimation(Motion.smooth) {
                    isSending = false
                    passkeyOffer = account
                }
            } else {
                startVerification(for: identifier, account: account, from: .login)
            }
        case .new:
            // No account for this email: over to Sign up with it filled in and already checked.
            withAnimation(Motion.snappy) { isSending = false }
            signupFromLogin = true
            go(to: .signup, .forward)
        }
    }

    /// Sign up → "Agree & get OTP" (or "Continue to log in" once the email turned out to exist).
    private func submitSignup() {
        if let account = foundOnSignup {
            startVerification(for: account.identifier, account: account, from: .signup)
            return
        }
        guard kind == .email, let identifier else {
            withAnimation(Motion.snappy) { showsInputError = true }
            emit(.error, from: fieldAnchor)
            return
        }
        switch lookup {
        case .idle:
            startAccountLookup(for: identifier)
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .checking:
            submitWhenResolved = true
            withAnimation(Motion.snappy) { isSending = true }
        case .returning(let account):
            startVerification(for: identifier, account: account, from: .signup)
        case .new:
            startVerification(for: identifier, account: nil, from: .signup)
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
        if isSeparate {
            resetFormState()
            if step != .login && step != .signup { go(to: .login, .forward) }
        } else if step != .identify {
            go(to: .identify, .forward)
        }
        identityChanged()
    }

    // MARK: - Private

    private func emit(_ kind: HeaderEvent.Kind, from origin: CGPoint) {
        headerEvent = HeaderEvent(kind: kind, origin: origin)
    }

    private func finish(anchor: CGPoint, hasPassword: Bool = false) {
        guard let target else { return }
        let isNew = targetAccount == nil
        let account = targetAccount ?? Account(firstName: nil, lastName: nil, identifier: target, hasPassword: hasPassword)
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
        guard store.simulateAutofill else { return }
        // Prototype: WhatsApp codes "arrive" too, so every flow can be demoed hands-free.
        let source: CodeSource = switch channel {
        case .email: .mail
        case .sms: .messages
        case .whatsapp: .filled
        }
        autofillTask = Task {
            try? await Task.sleep(for: .seconds(2.6))
            guard !Task.isCancelled, step == .otp, code.isEmpty, codeState == .entering else { return }
            setCode(sentCode, source: source)
        }
    }
}
