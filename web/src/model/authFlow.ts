import type { Country } from './country'
import { INITIAL_COUNTRY, matchingDialPrefix, maxDigits } from './country'
import type { DeviceStore, LoginVariant } from './deviceStore'
import type { Identifier, IdentifierKind, PhoneValidity } from './identifier'
import { EmailAssist, InputParser, PhoneFormatter, idIsPhone, idKey, phoneCountry, phoneID } from './identifier'
import type { Point } from './observable'
import { Observable, TaskSlot, sleep } from './observable'
import type { Account, Biometrics, RememberedAccount } from './services'
import { AuthService } from './services'

export type Step = 'remembered' | 'identify' | 'otp' | 'password' | 'createPassword' | 'welcome' | 'login' | 'signup'
export type NavDirection = 'forward' | 'backward'
export type Lookup = { type: 'idle' } | { type: 'checking' } | { type: 'returning'; account: Account } | { type: 'new' }
export type Channel = 'sms' | 'whatsapp' | 'email'
export type CodeState = 'entering' | 'verifying' | 'failed' | 'verified'
export type PasswordState = 'idle' | 'verifying' | 'failed' | 'verified'
export type BiometricState = 'idle' | 'scanning' | 'failed'
export type CodeSource = 'messages' | 'mail' | 'pasted' | 'filled'

/** A moment the header reacts to with a colour wash: green found/verified, red error, yellow welcome. */
export interface HeaderEvent {
  kind: 'success' | 'error' | 'welcome'
  /** Where the wash grows from, in screen (375×812 design) coordinates. */
  origin: Point
  id: number
}

/** What the line under the identifier field says right now. */
export type Hint =
  | { type: 'intro' }
  | { type: 'digitsLeft'; n: number }
  | { type: 'badPrefix'; country: Country }
  | { type: 'domains'; domains: string[] }
  | { type: 'typo'; email: string }
  | { type: 'checking' }
  | { type: 'returning'; kind: IdentifierKind }
  | { type: 'new'; kind: IdentifierKind }

export interface PasswordRules {
  length: boolean
  number: boolean
  symbol: boolean
  uppercase: boolean
  lowercase: boolean
  isStrong: boolean
}

let eventCounter = 0
let flowCounter = 0

/** The sign-in state machine. Views render it; they never decide what happens next.
 *  A line-for-line port of AuthFlow.swift. */
export class AuthFlow extends Observable {
  /** Identity for React keys: a fresh flow rebuilds the sign-in screen. */
  readonly uid = ++flowCounter
  onAuthenticated: ((account: Account, isNew: boolean, origin: Point) => void) | null = null

  headerEvent: HeaderEvent | null = null

  // Navigation
  step: Step
  direction: NavDirection = 'forward'
  /** Where the current verification started: identify or remembered. */
  origin: Step = 'identify'

  // Identify
  input = ''
  /** Bumped whenever the flow rewrites what was typed, so the text field re-syncs. */
  inputRevision = 0
  kind: IdentifierKind = 'unknown'
  country: Country = INITIAL_COUNTRY
  lookup: Lookup = { type: 'idle' }
  isSending = false
  rejectedKeystrokes = 0
  remembered: RememberedAccount | null
  showsInputError = false
  variant: LoginVariant
  method: IdentifierKind = 'phone'

  // Verify
  target: Identifier | null = null
  targetAccount: Account | null = null
  channel: Channel = 'sms'
  code = ''
  codeState: CodeState = 'entering'
  showsCodeError = false
  codeSource: CodeSource | null = null
  resendIn = 0
  isResending = false
  resentVia: Channel | null = null

  // Password
  password = ''
  passwordState: PasswordState = 'idle'
  newPassword = ''
  weakPasswordAttempts = 0

  passkeyOffer: Account | null = null
  biometricState: BiometricState = 'idle'

  // Separate Log in / Sign up
  /** Log in: the number typed has no account. Error under the field + "Continue with email". */
  phoneHasNoAccount = false
  /** Sign up: the email typed already has an account. Green, TnC hides, "Continue to log in". */
  foundOnSignup: Account | null = null
  /** Checkout or a link opened Log in directly: ✕ closes instead of going back to Welcome. */
  entryIsDirect = false
  /** Sign up was reached from Log in (back returns there rather than to Welcome). */
  signupFromLogin = false
  /** Saved account: the system-style Face ID sheet is up. */
  showsFaceIDPrompt = false
  /** Saved account: Face ID misses so far. Two misses (or a cancel) fall back to a code. */
  faceIDFailures = 0

  ctaAnchor: Point = { x: 187, y: 600 }
  codeAnchor: Point = { x: 187, y: 300 }
  fieldAnchor: Point = { x: 187, y: 400 }

  private lookupTask = new TaskSlot()
  private timerTask = new TaskSlot()
  private autofillTask = new TaskSlot()
  private verifyTask = new TaskSlot()
  private sentCode = ''
  private submitWhenResolved = false
  private celebratedKey: string | null = null
  private drafts: Partial<Record<IdentifierKind, string>> = {}

  constructor(
    readonly store: DeviceStore,
    readonly biometrics: Biometrics,
  ) {
    super()
    this.variant = store.loginVariant
    this.remembered = store.remembered
    this.step = store.remembered ? 'remembered' : store.loginVariant === 'separate' ? 'welcome' : 'identify'
  }

  /** Prototype only: jumps straight to a state (flow map presets). */
  hydrate(patch: Partial<AuthFlow>) {
    Object.assign(this, patch)
    this.changed()
  }

  /** Prototype only: replays a header reaction from the field (a preset opened mid-flow). */
  flashHeader(kind: HeaderEvent['kind']) {
    this.emit(kind, this.step === 'identify' ? this.fieldAnchor : this.step === 'otp' ? this.codeAnchor : this.ctaAnchor)
  }

  /** Stops every timer; used when a flow is replaced. */
  dispose() {
    for (const slot of [this.lookupTask, this.timerTask, this.autofillTask, this.verifyTask]) slot.cancel()
  }

  // MARK: - Derived

  get canGoBack() {
    switch (this.step) {
      case 'remembered':
      case 'welcome':
        return false
      case 'identify':
        return this.remembered != null
      case 'login':
        return !this.entryIsDirect
      case 'signup':
        return !this.entryIsDirect || this.signupFromLogin
      default:
        return true
    }
  }

  // MARK: Separate Log in / Sign up

  get isSeparate() {
    return this.variant === 'separate'
  }

  get isAccountForm() {
    return this.step === 'login' || this.step === 'signup'
  }

  /** Opened from checkout or a link: the first screen gets ✕ instead of a back arrow. */
  get showsCloseInsteadOfBack() {
    return this.entryIsDirect && (this.step === 'login' || (this.step === 'signup' && !this.signupFromLogin))
  }

  /** Sign up takes email only: a number turns the field red and keeps the button disabled. */
  get signupPhoneError() {
    return this.step === 'signup' && this.kind === 'phone'
  }

  /** "Agree & get OTP" stays dimmed until the email is valid. */
  get canSubmitSignup() {
    return this.foundOnSignup != null || (this.kind === 'email' && this.identifier != null)
  }

  get phoneDigits() {
    return InputParser.digits(this.input)
  }

  get phoneValidity(): PhoneValidity {
    return PhoneFormatter.validate(this.phoneDigits, this.country)
  }

  get identifier(): Identifier | null {
    switch (this.kind) {
      case 'unknown':
        return null
      case 'phone':
        if (this.phoneValidity.type !== 'valid') return null
        return phoneID(this.country.id, PhoneFormatter.nsn(this.phoneDigits, this.country))
      case 'email':
        return EmailAssist.isValid(this.input) ? { type: 'email', email: this.input } : null
    }
  }

  get isNewCustomer() {
    return this.lookup.type === 'new'
  }

  get ghostCompletion(): string | null {
    return this.kind === 'email' ? EmailAssist.ghostCompletion(this.input) : null
  }

  get canUsePassword() {
    // The separate flow offers a password only to accounts that have one.
    return this.isSeparate ? this.targetAccount?.hasPassword === true : this.targetAccount != null
  }

  get canCreatePassword() {
    return this.targetAccount == null && this.target != null
  }

  get rememberedUsesPasskey() {
    return this.remembered?.passkeyEnabled === true
  }

  get passwordRules(): PasswordRules {
    const p = this.newPassword
    const rules = {
      length: [...p].length >= 8,
      number: /\p{N}/u.test(p),
      symbol: /[^\p{L}\p{N}\s]/u.test(p),
      uppercase: /\p{Lu}/u.test(p),
      lowercase: /\p{Ll}/u.test(p),
    }
    return { ...rules, isStrong: Object.values(rules).every(Boolean) }
  }

  get hint(): Hint {
    switch (this.kind) {
      case 'unknown':
        return { type: 'intro' }
      case 'phone': {
        const v = this.phoneValidity
        if (v.type === 'empty') return { type: 'intro' }
        if (v.type === 'badPrefix') return { type: 'badPrefix', country: this.country }
        if (v.type === 'incomplete') return { type: 'digitsLeft', n: v.remaining }
        break
      }
      case 'email': {
        if (!EmailAssist.isValid(this.input) || this.ghostCompletion != null) {
          const domains = EmailAssist.domainSuggestions(this.input)
          return domains.length ? { type: 'domains', domains } : { type: 'intro' }
        }
        const fix = EmailAssist.typoCorrection(this.input)
        if (fix) return { type: 'typo', email: fix }
      }
    }
    switch (this.lookup.type) {
      case 'idle':
      case 'checking':
        return { type: 'checking' }
      case 'returning':
        return { type: 'returning', kind: this.kind }
      case 'new':
        return { type: 'new', kind: this.kind }
    }
  }

  /** Whether the country code chip sits beside the field. */
  get showsCountryChip() {
    if (this.input.startsWith('+')) return false
    if (this.isSeparate) return this.step === 'login' && this.kind === 'phone'
    return this.variant === 'toggle' ? this.method === 'phone' : this.kind === 'phone'
  }

  // MARK: - Identify

  setInput(newValue: string) {
    const normalized = InputParser.normalizingDigits(newValue)
    const detected = this.detectedKind(normalized)
    let nextCountry = this.country
    let value: string

    switch (detected) {
      case 'unknown':
        value = ''
        break
      case 'email':
        value = normalized.replace(/\s/g, '')
        break
      case 'phone': {
        if (this.isSeparate && this.step === 'signup') {
          // Sign up takes email only: show the number exactly as typed, under the error.
          value = normalized.trim()
          break
        }
        const trimmed = normalized.trim()
        let digits = InputParser.digits(trimmed)
        const international = trimmed.startsWith('+') || digits.startsWith('00')
        if (international) {
          if (digits.startsWith('00')) digits = digits.slice(2)
          const match = matchingDialPrefix(digits)
          if (!match) {
            // Still typing the dial code: show it exactly as typed.
            this.commit('+' + digits, 'phone', nextCountry, newValue)
            return
          }
          nextCountry = match
          digits = digits.slice(match.dialCode.length)
        } else if (digits.length > maxDigits(nextCountry, digits.startsWith('0'))) {
          // Pasted with the dial code but no "+", like 971501234567.
          if (digits.startsWith(nextCountry.dialCode) && digits.length - nextCountry.dialCode.length <= nextCountry.length) {
            digits = digits.slice(nextCountry.dialCode.length)
          } else {
            const match = matchingDialPrefix(digits)
            if (match && digits.length - match.dialCode.length === match.length) {
              nextCountry = match
              digits = digits.slice(match.dialCode.length)
            }
          }
        }
        const limit = maxDigits(nextCountry, PhoneFormatter.startsWithTrunkZero(digits, nextCountry))
        if (digits.length > limit) {
          digits = digits.slice(0, limit)
          this.rejectedKeystrokes++
        }
        value = PhoneFormatter.format(digits, nextCountry)
      }
    }
    this.commit(value, detected, nextCountry, newValue)
  }

  /** The smart field guesses from what's typed; the tabs variant takes what's selected. */
  private detectedKind(text: string): IdentifierKind {
    if (this.variant !== 'toggle') return InputParser.detect(text)
    const trimmed = text.trim()
    if (!trimmed) return 'unknown'
    if (this.method === 'phone') return !InputParser.digits(trimmed) && !trimmed.startsWith('+') ? 'unknown' : 'phone'
    return 'email'
  }

  /** Tabs variant: switch between Phone number and Email, each keeping its own draft. */
  setMethod(newMethod: IdentifierKind) {
    if (this.variant !== 'toggle' || newMethod === 'unknown' || newMethod === this.method) return
    this.drafts[this.method] = this.input
    this.method = newMethod
    this.showsInputError = false
    this.setInput(this.drafts[newMethod] ?? '')
    this.inputRevision++
    this.changed()
  }

  /** Prototype controls: swap between the smart field and the tabs. */
  setVariant(newVariant: LoginVariant) {
    if (newVariant === this.variant) return
    this.drafts = {}
    this.variant = newVariant
    this.method = 'phone'
    this.showsInputError = false
    if (this.step === 'identify') {
      this.setInput('')
      this.inputRevision++
    }
    this.changed()
  }

  private commit(value: string, detected: IdentifierKind, nextCountry: Country, typed: string) {
    const changed = value !== this.input || nextCountry.id !== this.country.id
    this.kind = detected
    this.country = nextCountry
    if (value !== typed) this.inputRevision++
    this.input = value
    if (this.showsInputError && changed) this.showsInputError = false
    this.changed()
    if (changed) this.identityChanged()
  }

  selectCountry(newCountry: Country) {
    if (newCountry.id === this.country.id) return
    const startsWithZero = PhoneFormatter.startsWithTrunkZero(this.phoneDigits, newCountry)
    const digits = this.phoneDigits.slice(0, maxDigits(newCountry, startsWithZero))
    this.country = newCountry
    this.input = PhoneFormatter.format(digits, newCountry)
    this.inputRevision++
    this.changed()
    this.identityChanged()
  }

  applyDomain(provider: string) {
    this.setInput(EmailAssist.completing(this.input, provider))
  }

  acceptGhostCompletion() {
    const ghost = this.ghostCompletion
    if (ghost) this.setInput(this.input + ghost)
  }

  applyCorrection(email: string) {
    this.setInput(email)
  }

  clearInput() {
    this.setInput('')
  }

  returnKeyPressed() {
    if (this.identifier == null && this.ghostCompletion != null) this.acceptGhostCompletion()
    else this.submitIdentifier()
  }

  submitIdentifier() {
    if (this.step === 'login') return this.submitLogin()
    if (this.step === 'signup') return this.submitSignup()
    if (this.step !== 'identify') return
    const identifier = this.identifier
    if (!identifier) {
      // The CTA is always tappable; explain what's missing instead of disabling it.
      this.showsInputError = true
      this.emit('error', this.fieldAnchor)
      return
    }
    switch (this.lookup.type) {
      case 'idle':
        this.startLookup(identifier)
        this.submitWhenResolved = true
        this.isSending = true
        this.changed()
        break
      case 'checking':
        this.submitWhenResolved = true
        this.isSending = true
        this.changed()
        break
      case 'returning': {
        const account = this.lookup.account
        if (AuthService.hasPasskey(account, this.store.remembered)) {
          this.passkeyOffer = account
          this.changed()
        } else {
          this.startVerification(identifier, account, 'identify')
        }
        break
      }
      case 'new':
        this.startVerification(identifier, null, 'identify')
    }
  }

  private identityChanged() {
    this.lookupTask.cancel()
    this.submitWhenResolved = false
    if (this.isSending) this.isSending = false
    if (this.isSeparate) {
      // The separate flow checks on Continue, not as you type.
      this.lookup = { type: 'idle' }
      this.phoneHasNoAccount = false
      this.foundOnSignup = null
      this.changed()
      return
    }
    const identifier = this.identifier
    // "ajain@gmail.co" is a valid address, but almost always "gmail.com" on its way: wait.
    if (!identifier || (this.kind === 'email' && this.ghostCompletion != null)) {
      if (this.lookup.type !== 'idle') this.lookup = { type: 'idle' }
      this.changed()
      return
    }
    this.startLookup(identifier)
  }

  private startLookup(identifier: Identifier) {
    this.lookup = { type: 'checking' }
    this.changed()
    const registered = this.store.registered
    this.lookupTask.run(async (alive) => {
      await sleep(200)
      if (!alive()) return
      const account = await AuthService.lookup(identifier, registered)
      if (!alive()) return
      this.lookup = account ? { type: 'returning', account } : { type: 'new' }
      this.changed()
      if (this.celebratedKey !== idKey(identifier)) {
        this.celebratedKey = idKey(identifier)
        this.emit(account ? 'success' : 'welcome', this.fieldAnchor)
      }
      if (!this.submitWhenResolved) return
      this.submitWhenResolved = false
      if (!account) {
        // A new customer must see the consent line and tap "Agree & get OTP" themselves.
        this.isSending = false
        this.changed()
      } else {
        this.submitIdentifier()
      }
    })
  }

  // MARK: - Remembered account

  useDifferentAccount() {
    this.lookupTask.cancel()
    this.input = ''
    this.kind = 'unknown'
    this.lookup = { type: 'idle' }
    this.inputRevision++
    this.biometricState = 'idle'
    this.faceIDFailures = 0
    this.resetFormState()
    this.go(this.isSeparate ? 'login' : 'identify', 'forward')
  }

  forgetRememberedAccount() {
    this.store.update({ remembered: null })
    this.remembered = null
    this.useDifferentAccount()
  }

  sendCodeToRememberedAccount() {
    if (!this.remembered) return
    this.startVerification(this.remembered.account.identifier, this.remembered.account, 'remembered')
  }

  signInWithPasskey() {
    const remembered = this.remembered
    if (!remembered || this.biometricState === 'scanning') return
    this.biometricState = 'scanning'
    this.changed()
    void (async () => {
      const outcome = await this.biometrics.authenticate()
      switch (outcome) {
        case 'success':
          this.target = remembered.account.identifier
          this.targetAccount = remembered.account
          this.showsFaceIDPrompt = false
          this.changed()
          this.emit('success', this.ctaAnchor)
          await sleep(450)
          this.onAuthenticated?.(remembered.account, false, this.ctaAnchor)
          break
        case 'cancelled':
          if (this.isSeparate) {
            // Cancelling the system sheet means "not now": send the code instead.
            this.biometricState = 'idle'
            this.showsFaceIDPrompt = false
            this.changed()
            this.sendCodeToRememberedAccount()
            break
          }
          this.biometricState = 'idle'
          this.changed()
          break
        case 'fallback':
          this.biometricState = 'idle'
          this.showsFaceIDPrompt = false
          this.changed()
          this.sendCodeToRememberedAccount()
          break
        case 'failed':
          this.faceIDFailures++
          this.biometricState = 'failed'
          this.showsFaceIDPrompt = false
          this.changed()
          this.emit('error', this.ctaAnchor)
          if (this.isSeparate && this.faceIDFailures >= 2) {
            // Two misses: stop asking for a face and send the code.
            await sleep(700)
            this.biometricState = 'idle'
            this.changed()
            this.sendCodeToRememberedAccount()
          }
      }
    })()
  }

  /** Separate flow, saved account: the system-style "Use Face ID to sign in?" sheet scans by itself. */
  beginFaceIDPrompt() {
    if (!this.remembered || this.biometricState === 'scanning') return
    this.showsFaceIDPrompt = true
    this.changed()
  }

  /** ✕ on the Face ID sheet: same as cancelling the scan. */
  cancelFaceIDPrompt() {
    this.showsFaceIDPrompt = false
    this.changed()
    if (this.biometricState === 'scanning') return
    this.sendCodeToRememberedAccount()
  }

  // MARK: - Passkey found

  signInWithFoundPasskey() {
    const account = this.passkeyOffer
    if (!account || this.biometricState === 'scanning') return
    this.biometricState = 'scanning'
    this.changed()
    void (async () => {
      const outcome = await this.biometrics.authenticate()
      switch (outcome) {
        case 'success':
          this.target = account.identifier
          this.targetAccount = account
          this.passkeyOffer = null
          this.changed()
          this.emit('success', this.ctaAnchor)
          await sleep(450)
          this.onAuthenticated?.(account, false, this.ctaAnchor)
          break
        case 'cancelled':
          this.biometricState = 'idle'
          this.changed()
          break
        case 'fallback':
          this.biometricState = 'idle'
          this.declinePasskey()
          break
        case 'failed':
          this.biometricState = 'failed'
          this.changed()
          this.emit('error', this.ctaAnchor)
      }
    })()
  }

  /** "Login with OTP" on the passkey sheet: close it and send the code as usual. */
  declinePasskey() {
    const account = this.passkeyOffer
    if (!account) return
    this.passkeyOffer = null
    this.biometricState = 'idle'
    this.changed()
    this.startVerification(account.identifier, account, this.isSeparate ? 'login' : 'identify')
  }

  dismissPasskeyOffer() {
    this.passkeyOffer = null
    this.biometricState = 'idle'
    this.changed()
  }

  // MARK: - Verify

  private startVerification(identifier: Identifier, account: Account | null, origin: Step) {
    this.submitWhenResolved = false
    this.isSending = true
    this.changed()
    void (async () => {
      const code = await AuthService.sendCode(identifier)
      this.sentCode = code
      this.target = identifier
      this.targetAccount = account
      // Phone codes go to WhatsApp first; SMS is the alternative.
      this.channel = idIsPhone(identifier) ? 'whatsapp' : 'email'
      this.origin = origin
      this.resentVia = null
      this.password = ''
      this.newPassword = ''
      this.passwordState = 'idle'
      this.resetCode()
      this.isSending = false
      this.go('otp', 'forward')
      this.startResendTimer()
      this.scheduleAutofill()
    })()
  }

  /** The OTP field reports what's typed or pasted. */
  typeCode(typed: string) {
    this.applyCode(typed, null)
  }

  private setCode(newValue: string, source: CodeSource) {
    this.applyCode(newValue, source)
  }

  private applyCode(newValue: string, source: CodeSource | null) {
    if (this.codeState !== 'entering') return
    const digits = InputParser.digits(InputParser.normalizingDigits(newValue)).slice(0, 6)
    if (digits === this.code) return
    const isBulk = digits.length - this.code.length > 1
    if (this.showsCodeError) this.showsCodeError = false
    if (digits.length < this.code.length) this.codeSource = null
    else if (isBulk) this.codeSource = source ?? 'filled'
    if (this.resentVia && digits) this.resentVia = null
    if (source == null) this.autofillTask.cancel()
    this.code = digits
    this.changed()
    if (digits.length === 6) this.verify(isBulk ? 420 : 160)
  }

  /** Accepts anything containing a 6-digit code, like "Your noon code is 482913". */
  paste(text: string) {
    const normalized = InputParser.normalizingDigits(text)
    const match = normalized.match(/\d{6}/)
    this.setCode(match ? match[0] : normalized, 'pasted')
  }

  private verify(delay: number) {
    this.verifyTask.run(async (alive) => {
      await sleep(delay)
      if (!alive() || this.code.length !== 6) return
      this.codeState = 'verifying'
      this.changed()
      const isCorrect = await AuthService.verifyCode(this.code)
      if (!alive()) return
      if (isCorrect) {
        this.timerTask.cancel()
        this.autofillTask.cancel()
        this.codeState = 'verified'
        this.changed()
        this.emit('success', this.codeAnchor)
        // Long enough to register the green digits before they resolve into the avatar.
        await sleep(550)
        this.finish(this.codeAnchor)
      } else {
        this.codeState = 'failed'
        this.showsCodeError = true
        this.changed()
        this.emit('error', this.codeAnchor)
        await sleep(700)
        if (!alive()) return
        this.code = ''
        this.codeSource = null
        this.codeState = 'entering'
        this.changed()
      }
    })
  }

  resend(newChannel: Channel) {
    const target = this.target
    if (!target || this.resendIn !== 0 || this.isResending) return
    this.isResending = true
    this.changed()
    void (async () => {
      this.sentCode = await AuthService.sendCode(target)
      this.resetCode()
      this.channel = newChannel
      this.resentVia = newChannel
      this.isResending = false
      this.changed()
      this.startResendTimer()
      this.scheduleAutofill()
    })()
  }

  editIdentifier() {
    const target = this.target
    if (!target) return
    this.leaveVerification()
    this.lookupTask.cancel()
    if (target.type === 'phone') {
      this.country = phoneCountry(target.number)
      this.input = PhoneFormatter.format(target.number.nsn, this.country)
      this.kind = 'phone'
    } else {
      this.input = target.email
      this.kind = 'email'
    }
    if (this.variant === 'toggle') this.method = this.kind
    this.inputRevision++
    if (this.isSeparate) {
      this.resetFormState()
      this.go(this.origin === 'signup' ? 'signup' : 'login', 'backward')
      return
    }
    this.lookup = this.targetAccount ? { type: 'returning', account: this.targetAccount } : { type: 'new' }
    this.go('identify', 'backward')
  }

  /** "Change": back to the remembered account if that's where this started, otherwise to the field. */
  changeIdentity() {
    if (this.origin === 'remembered') {
      this.leaveVerification()
      this.go('remembered', 'backward')
    } else {
      this.editIdentifier()
    }
  }

  switchToPassword() {
    this.autofillTask.cancel()
    this.passwordState = 'idle'
    this.go('password', 'forward')
  }

  switchToCode() {
    this.go('otp', 'backward')
  }

  /** "Sign up with password" on a new customer's code screen. */
  switchToCreatePassword() {
    if (!this.canCreatePassword) return
    this.autofillTask.cancel()
    this.passwordState = 'idle'
    this.go('createPassword', 'forward')
  }

  setPassword(value: string) {
    if (this.passwordState === 'failed' && value !== this.password) this.passwordState = 'idle'
    this.password = value
    this.changed()
  }

  setNewPassword(value: string) {
    if (this.passwordState === 'failed' && value !== this.newPassword) this.passwordState = 'idle'
    this.newPassword = value
    this.changed()
  }

  /** "Create account": every rule must be met; otherwise the field shakes and the hint says what's left. */
  createAccount() {
    if (this.passwordState === 'verifying' || this.passwordState === 'verified') return
    if (!this.passwordRules.isStrong) {
      this.weakPasswordAttempts++
      this.changed()
      return
    }
    this.passwordState = 'verifying'
    this.changed()
    void (async () => {
      await sleep(700)
      this.passwordState = 'verified'
      this.changed()
      this.emit('success', this.ctaAnchor)
      await sleep(600)
      this.finish(this.ctaAnchor, true)
    })()
  }

  submitPassword() {
    if (!this.password || this.passwordState === 'verifying' || this.passwordState === 'verified') return
    this.passwordState = 'verifying'
    this.changed()
    void (async () => {
      const isCorrect = await AuthService.verifyPassword(this.password)
      if (isCorrect) {
        this.passwordState = 'verified'
        this.changed()
        this.emit('success', this.ctaAnchor)
        await sleep(600)
        this.finish(this.ctaAnchor)
      } else {
        this.passwordState = 'failed'
        this.changed()
        this.emit('error', this.fieldAnchor)
      }
    })()
  }

  back() {
    switch (this.step) {
      case 'remembered':
      case 'welcome':
        return
      case 'login':
        if (this.entryIsDirect) return
        this.resetFormState()
        this.go(this.remembered ? 'remembered' : 'welcome', 'backward')
        return
      case 'signup':
        if (this.entryIsDirect && !this.signupFromLogin) return
        this.resetFormState()
        this.go(this.signupFromLogin ? 'login' : 'welcome', 'backward')
        return
      case 'identify':
        if (!this.remembered) return
        this.biometricState = 'idle'
        this.go('remembered', 'backward')
        return
      case 'otp':
        this.leaveVerification()
        if (this.isSeparate && (this.origin === 'login' || this.origin === 'signup')) this.resetFormState()
        this.go(this.origin, 'backward')
        return
      case 'password':
      case 'createPassword':
        this.go('otp', 'backward')
    }
  }

  // MARK: - Separate Log in / Sign up

  /** A fresh flow for checkout / a link: open on Log in with ✕, no transition. */
  prepareDirectLogin() {
    this.entryIsDirect = true
    this.step = 'login'
    this.changed()
  }

  /** Welcome → "Log in", or Choose your account → "Continue with different account". */
  openLogin(direct = false) {
    if (direct) this.entryIsDirect = true
    this.replaceInput('')
    this.resetFormState()
    this.go('login', 'forward')
  }

  /** Welcome → "Create new account". */
  openSignup() {
    this.signupFromLogin = false
    this.replaceInput('')
    this.resetFormState()
    this.go('signup', 'forward')
  }

  /** The header chip: "New account" on Log in, "Log in" on Sign up. What was typed comes along,
   *  as long as Sign up can take it (an email). */
  switchAccountForm() {
    const next: Step = this.step === 'login' ? 'signup' : 'login'
    if (next === 'signup') {
      this.signupFromLogin = true
      if (this.kind === 'phone') this.replaceInput('')
    }
    this.resetFormState()
    this.go(next, next === 'signup' ? 'forward' : 'backward')
  }

  /** Log in, number has no account: "Continue with email" empties the field for an email. */
  continueWithEmail() {
    this.replaceInput('')
    this.phoneHasNoAccount = false
    this.showsInputError = false
    this.changed()
  }

  private replaceInput(value: string) {
    this.lookupTask.cancel()
    this.input = value
    this.kind = InputParser.detect(value)
    this.inputRevision++
    this.lookup = { type: 'idle' }
  }

  private resetFormState() {
    this.lookupTask.cancel()
    this.submitWhenResolved = false
    this.isSending = false
    this.lookup = { type: 'idle' }
    this.showsInputError = false
    this.phoneHasNoAccount = false
    this.foundOnSignup = null
  }

  /** Log in → Continue: a loader in the field while we look the account up. An account turns the
   *  header green, then Face ID or a code; a new email goes on to Sign up (create account) with it
   *  filled in; a number with no account gets the error and "Continue with email". */
  private submitLogin() {
    const identifier = this.identifier
    if (!identifier) {
      // Incomplete number or email: say what's wrong, in red, next to the field.
      this.showsInputError = true
      this.emit('error', this.fieldAnchor)
      return
    }
    if (this.lookup.type === 'checking') return
    this.lookup = { type: 'checking' }
    this.phoneHasNoAccount = false
    this.showsInputError = false
    this.changed()
    const registered = this.store.registered
    this.lookupTask.run(async (alive) => {
      await sleep(200)
      if (!alive()) return
      const account = await AuthService.lookup(identifier, registered)
      if (!alive() || this.step !== 'login') return
      if (account) {
        // Found: a moment of green "Welcome back!", then Face ID or a code.
        this.lookup = { type: 'returning', account }
        this.changed()
        this.emit('success', this.fieldAnchor)
        await sleep(700)
        if (!alive() || this.step !== 'login') return
        if (AuthService.hasPasskey(account, this.store.remembered)) {
          this.passkeyOffer = account
          this.changed()
        } else {
          this.startVerification(identifier, account, 'login')
        }
      } else if (identifier.type === 'phone') {
        // Numbers can't start a new account: point them to email.
        this.lookup = { type: 'idle' }
        this.phoneHasNoAccount = true
        this.showsInputError = true
        this.changed()
        this.emit('error', this.fieldAnchor)
      } else {
        // No account for this email: over to Sign up with it filled in. It stays known-new, so
        // "Agree & get OTP" sends the code without checking again.
        this.signupFromLogin = true
        this.lookup = { type: 'new' }
        this.go('signup', 'forward')
      }
    })
  }

  /** Sign up → "Agree & get OTP" (or "Continue to log in" once the email turned out to exist). */
  private submitSignup() {
    if (this.foundOnSignup) {
      this.startVerification(this.foundOnSignup.identifier, this.foundOnSignup, 'signup')
      return
    }
    const identifier = this.identifier
    if (this.kind !== 'email' || !identifier) {
      this.showsInputError = true
      this.emit('error', this.fieldAnchor)
      return
    }
    if (this.lookup.type === 'checking' || this.isSending) return
    if (this.lookup.type === 'new') {
      // Log in already found no account for it.
      this.startVerification(identifier, null, 'signup')
      return
    }
    this.lookup = { type: 'checking' }
    this.changed()
    const registered = this.store.registered
    this.lookupTask.run(async (alive) => {
      await sleep(200)
      if (!alive()) return
      const account = await AuthService.lookup(identifier, registered)
      if (!alive() || this.step !== 'signup') return
      if (account) {
        // Already a customer: green "Welcome back!", the TnC goes, "Continue to log in".
        this.lookup = { type: 'returning', account }
        this.foundOnSignup = account
        this.changed()
        this.emit('success', this.fieldAnchor)
      } else {
        this.lookup = { type: 'new' }
        this.changed()
        this.startVerification(identifier, null, 'signup')
      }
    })
  }

  // MARK: - Demo

  demoFill(identifier: Identifier) {
    this.lookupTask.cancel()
    if (identifier.type === 'phone') {
      this.country = phoneCountry(identifier.number)
      this.input = PhoneFormatter.format(identifier.number.nsn, this.country)
      this.kind = 'phone'
    } else {
      this.input = identifier.email
      this.kind = 'email'
    }
    if (this.variant === 'toggle') this.method = this.kind
    this.inputRevision++
    if (this.isSeparate) {
      this.resetFormState()
      if (this.step !== 'login' && this.step !== 'signup') this.go('login', 'forward')
    } else if (this.step !== 'identify') {
      this.go('identify', 'forward')
    }
    this.changed()
    this.identityChanged()
  }

  // MARK: - Private

  private emit(kind: HeaderEvent['kind'], origin: Point) {
    this.headerEvent = { kind, origin, id: ++eventCounter }
    this.changed()
  }

  private finish(anchor: Point, hasPassword = false) {
    const target = this.target
    if (!target) return
    const isNew = this.targetAccount == null
    const account: Account = this.targetAccount ?? { firstName: null, lastName: null, identifier: target, hasPassword }
    if (isNew) this.store.update({ registered: { ...this.store.registered, [idKey(target)]: account } })
    this.onAuthenticated?.(account, isNew, anchor)
  }

  /** Changes step. Views read `direction` (through AnimatePresence `custom`) so the outgoing step
   *  leaves the way it should. */
  private go(next: Step, newDirection: NavDirection) {
    this.direction = newDirection
    this.step = next
    this.changed()
  }

  private resetCode() {
    this.verifyTask.cancel()
    this.code = ''
    this.codeState = 'entering'
    this.showsCodeError = false
    this.codeSource = null
  }

  private leaveVerification() {
    this.verifyTask.cancel()
    this.autofillTask.cancel()
    this.timerTask.cancel()
    this.resetCode()
  }

  /** Restarts the resend countdown from `seconds` (presets resume mid-countdown). */
  startResendTimer(seconds = 30) {
    this.resendIn = seconds
    this.changed()
    this.timerTask.run(async (alive) => {
      while (this.resendIn > 0) {
        await sleep(1000)
        if (!alive()) return
        this.resendIn -= 1
        this.changed()
      }
    })
  }

  scheduleAutofill() {
    this.autofillTask.cancel()
    if (!this.store.simulateAutofill) return
    if (!this.sentCode) this.sentCode = String(Math.floor(100000 + Math.random() * 900000))
    // Prototype: WhatsApp codes "arrive" too, so every flow can be demoed hands-free.
    const source: CodeSource = this.channel === 'email' ? 'mail' : this.channel === 'sms' ? 'messages' : 'filled'
    this.autofillTask.run(async (alive) => {
      await sleep(2600)
      if (!alive() || this.step !== 'otp' || this.code || this.codeState !== 'entering') return
      this.setCode(this.sentCode, source)
    })
  }
}
