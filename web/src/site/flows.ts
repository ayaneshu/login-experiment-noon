import type { KeyboardKind, PresetUI } from '../app/context'
import type { AppModel, AuthEntry, Scenario, Tab } from '../model/appModel'
import type { AuthFlow } from '../model/authFlow'
import { SAUDI, UAE } from '../model/country'
import type { LoginVariant } from '../model/deviceStore'
import type { Identifier } from '../model/identifier'
import { emailID } from '../model/identifier'
import type { Account } from '../model/services'
import { AuthService } from '../model/services'
import type { HeaderToneName } from '../ui/Controls'

/** One screen in a flow: how to set the app up to show it, and what to say about it. */
export interface Preset {
  id: string
  title: string
  note?: string
  variant?: LoginVariant
  scenario?: Scenario
  tab?: Tab
  entry?: AuthEntry
  ui?: PresetUI
  keyboard?: KeyboardKind | null
  /** The header's reaction colour, frozen (thumbnails only; live, the wash plays). */
  tone?: HeaderToneName
  setup?: (app: AppModel) => void
  /** Live prototype only: restart timers so the screen carries on from here. */
  resume?: (app: AppModel) => void
}

export interface Flow {
  id: string
  number: string
  title: string
  summary: string
  steps: Preset[]
  /** Which approach the flow belongs to: the 16 Oct revision, the first separate Log in / Sign up,
   *  or the earlier ones. */
  group?: FlowGroup
}

export type FlowGroup = 'oct16' | 'separate' | 'earlier'

export const FLOW_GROUPS: Record<FlowGroup, { title: string }> = {
  oct16: { title: 'Variant - 16 Oct' },
  separate: { title: 'Log in | Sign up' },
  earlier: { title: 'Earlier approaches' },
}

const sara: Account = { firstName: null, lastName: null, identifier: emailID('sara@yahoo.com'), hasPassword: false }

// MARK: - Setup helpers

const typing = (input: string, kind: 'phone' | 'email', extra: Partial<AuthFlow> = {}) => (app: AppModel) => {
  app.flow.hydrate({ input, kind, method: app.flow.variant === 'toggle' ? kind : app.flow.method, inputRevision: app.flow.inputRevision + 1, ...extra })
}

const verifying =
  (target: Identifier, account: Account | null, extra: Partial<AuthFlow> = {}) =>
  (app: AppModel) => {
    app.flow.hydrate({
      step: 'otp',
      direction: 'forward',
      target,
      targetAccount: account,
      channel: target.type === 'phone' ? 'whatsapp' : 'email',
      origin: app.flow.remembered ? 'remembered' : 'identify',
      resendIn: 24,
      ...extra,
    })
  }

/** Carry on counting down and, if the code is empty, let autofill "arrive". */
const resumeCode = (app: AppModel) => {
  const flow = app.flow
  if (flow.step !== 'otp' && flow.step !== 'password' && flow.step !== 'createPassword') return
  if (flow.resendIn > 0) flow.startResendTimer(flow.resendIn)
  if (flow.step === 'otp' && !flow.code) flow.scheduleAutofill()
}

const signedIn = (account: Account, extra: Partial<AppModel> = {}) => (app: AppModel) => {
  app.store.update({ remembered: { account, passkeyEnabled: false } })
  app.set({ phase: 'signedIn', session: account, accountRevealed: true, ...extra })
}

const phoneAnmol = AuthService.anmolPhone
const emailAnmol = AuthService.anmolEmail

// MARK: - Flows

/** A step in the separate Log in / Sign up approach. */
const sep = (p: Preset): Preset => ({ variant: 'separate', ...p })
const onLogin = (input: string, kind: 'phone' | 'email', extra: Partial<AuthFlow> = {}) => (app: AppModel) => {
  app.flow.hydrate({ step: 'login', direction: 'forward', input, kind: input ? kind : 'unknown', inputRevision: app.flow.inputRevision + 1, ...extra })
}
const onSignup = (input: string, kind: 'phone' | 'email', extra: Partial<AuthFlow> = {}) => (app: AppModel) => {
  app.flow.hydrate({ step: 'signup', direction: 'forward', input, kind: input ? kind : 'unknown', inputRevision: app.flow.inputRevision + 1, ...extra })
}
const celebrating = (account: Account, isNew: boolean) => (app: AppModel) => {
  app.store.update({ remembered: { account, passkeyEnabled: false } })
  app.set({
    phase: 'signedIn',
    session: account,
    sessionIsNew: isNew,
    celebrationStage: 'greet',
    // By the greeting the sheet fills the screen, so the status bar is already dark.
    sheetCoversStatusBar: true,
    celebration: {
      id: 1,
      origin: { x: 187, y: 300 },
      initial: account.firstName?.[0] ?? (account.identifier.type === 'email' ? account.identifier.email[0].toUpperCase() : null),
      title: isNew ? 'Welcome to noon' : `Welcome back, ${account.firstName}`,
      subtitle: isNew ? 'Your account is ready' : "You're signed in",
      landsOnAccount: true,
    },
  })
}
const passkeyPhone = AuthService.anmolPasskeyPhone


// MARK: - Variant - 16 Oct (Figma 1555:209366)

/** A step in Variant - 16 Oct. */
const o16 = (p: Preset): Preset => ({ variant: 'oct16', ...p })
const inSaudi = (then: (app: AppModel) => void) => (app: AppModel) => {
  app.selectMarket(SAUDI)
  then(app)
}

const OCT16_FLOWS: Flow[] = [
  {
    id: 'o-entry',
    group: 'oct16',
    number: 'V0',
    title: 'Entry points',
    summary: 'My Account opens Welcome; the co-brand card, country and language show only there. Checkout and the address link open Log in directly with ✕ and “New account”. A remembered device opens Choose your account.',
    steps: [
      o16({ id: 'o-welcome', title: 'Welcome', note: 'Log in, or Create new account.' }),
      o16({ id: 'o-cart', title: 'Cart', note: 'Checkout asks a signed-out customer to log in.', tab: 'cart' }),
      o16({ id: 'o-checkout', title: 'From checkout', note: '✕ returns to Checkout; “New account” for someone new.', tab: 'cart', entry: 'checkout', ui: { focus: 'identifier' }, keyboard: 'email' }),
      o16({ id: 'o-checkout-rest', title: 'Keyboard put away', note: 'The form comes down to the bottom; tap the field to type again.', tab: 'cart', entry: 'checkout', ui: { keyboardDown: true } }),
      o16({ id: 'o-checkout-new', title: 'New account from checkout', note: 'Sign up; Back returns to Log in. After success, back to Checkout.', tab: 'cart', entry: 'checkout', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email', { signupFromLogin: true }) }),
      o16({ id: 'o-link-chat', title: 'Address link in WhatsApp', note: 'A friend shares a noon address link.', tab: 'home', setup: (app) => app.set({ showsAddressChat: true }) }),
      o16({ id: 'o-link', title: 'From the link', note: 'Log in first, then the address is saved.', tab: 'home', entry: 'addressLink', ui: { focus: 'identifier' }, keyboard: 'email' }),
      o16({ id: 'o-saved', title: 'Returning on this phone', note: 'Choose your account instead of Welcome.', scenario: 'rememberedFaceID' }),
    ],
  },
  {
    id: 'o-cached',
    group: 'oct16',
    number: 'V1',
    title: 'Saved account',
    summary: 'The saved account is one row: with a passkey it opens Face ID, without one it sends a code. Face ID failing twice, or cancelling, falls back to a code. Below it, “Log in with another account” and “Create new account”.',
    steps: [
      o16({ id: 'o-ca-faceid', title: 'Choose your account', note: 'Passkey cached: the row logs in with Face ID.', scenario: 'rememberedFaceID' }),
      o16({
        id: 'o-ca-prompt',
        title: 'Face ID prompt',
        note: 'The system sheet scans on its own.',
        scenario: 'rememberedFaceID',
        setup: (app) => {
          app.flow.hydrate({ showsFaceIDPrompt: true, biometricState: 'scanning' })
          app.biometrics.prompt = 'scanning'
        },
      }),
      o16({ id: 'o-ca-email', title: 'Email cached, no passkey', note: 'The row sends a code.', scenario: 'rememberedCode' }),
      o16({ id: 'o-ca-code', title: 'Code to the saved email', scenario: 'rememberedCode', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'remembered' }), resume: resumeCode }),
      o16({ id: 'o-ca-other', title: 'Log in with another account', note: 'An empty Log in; Back returns to the saved account.', scenario: 'rememberedFaceID', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email') }),
      o16({ id: 'o-ca-new', title: 'Create new account', note: 'An empty Sign up; Back returns to the saved account.', scenario: 'rememberedFaceID', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email') }),
    ],
  },
  {
    id: 'o-login',
    group: 'oct16',
    number: 'V2',
    title: 'Log in · email',
    summary: 'Log in takes email or phone and checks it on Continue. An account turns the header green. An email with no account turns the field red, and Continue gives way to “Sign up instead”, which carries the email over.',
    steps: [
      o16({ id: 'o-lg-empty', title: 'Log in', note: 'Just Back in the header.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email') }),
      o16({ id: 'o-lg-typing', title: 'Typing email', note: 'Domain chips help finish the email.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@', 'email') }),
      o16({ id: 'o-lg-checking', title: 'Checking', note: 'Loader in the field after Continue.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@noon.com', 'email', { lookup: { type: 'checking' } }) }),
      o16({ id: 'o-lg-found', title: 'Account found', note: 'Green “Welcome back!”.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@gmail.com', 'email', { lookup: { type: 'returning', account: emailAnmol } }) }),
      o16({ id: 'o-lg-code', title: 'Enter code', note: 'Password option: the account has one.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'login', resendIn: 14 }), resume: resumeCode }),
      o16({ id: 'o-lg-password', title: 'Enter password', note: 'Email is filled in; only the password is needed.', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'login', step: 'password', password: 'secret', resendIn: 0 }) }),
      o16({ id: 'o-lg-passkey', title: 'Passkey found', note: 'Face ID, or send a code instead.', tone: 'success', setup: onLogin('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork }, passkeyOffer: AuthService.anmolWork }) }),
      o16({ id: 'o-lg-noacct', title: 'No account', note: 'Red error; Continue gives way to “Sign up instead”.', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('sara@yahoo.com', 'email', { emailHasNoAccount: true }) }),
      o16({ id: 'o-lg-signup', title: 'Sign up instead', note: 'The email comes along; Back returns to Log in.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('sara@yahoo.com', 'email', { signupFromLogin: true, lookup: { type: 'new' } }) }),
    ],
  },
  {
    id: 'o-phone',
    group: 'oct16',
    number: 'V3',
    title: 'Log in · phone',
    summary: 'Typing digits turns the field into a phone field with the country chip. Codes go to WhatsApp first. A number with no account turns the field red, and Continue gives way to “Login with email instead” and “Signup with email”.',
    steps: [
      o16({ id: 'o-ph-typing', title: 'Phone', note: 'The field becomes a phone field with +971.', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('050', 'phone') }),
      o16({ id: 'o-ph-invalid', title: 'Incomplete number', note: 'Continue says what’s wrong, in red.', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('050 246', 'phone', { showsInputError: true }) }),
      o16({ id: 'o-ph-found', title: 'Account found', note: 'Green “Welcome back!”.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('050 123 4567', 'phone', { lookup: { type: 'returning', account: phoneAnmol } }) }),
      o16({ id: 'o-ph-code', title: 'Code on WhatsApp', note: 'SMS after the cooldown.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol, { origin: 'login' }), resume: resumeCode }),
      o16({ id: 'o-ph-verified', title: 'Verified phone', note: 'Not the primary, but verified on ajain@gmail.com: it logs in.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('052 345 6789', 'phone', { lookup: { type: 'returning', account: emailAnmol } }) }),
      o16({ id: 'o-ph-noacct', title: 'No account', note: 'Red error and two ways on, in place of Continue.', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('055 987 6543', 'phone', { phoneHasNoAccount: true }) }),
      o16({ id: 'o-ph-email', title: 'Login with email instead', note: 'Same Log in, the field empty for an email.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email') }),
      o16({ id: 'o-ph-signup', title: 'Signup with email', note: 'An empty Sign up; Back returns to Log in.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email', { signupFromLogin: true }) }),
      o16({ id: 'o-ph-country', title: 'Country code sheet', note: 'Pick a country; the number keeps focus.', ui: { countryPicker: true }, setup: onLogin('050', 'phone') }),
      o16({ id: 'o-ph-passkey', title: 'Phone with a passkey', note: 'The sheet shows the number.', tone: 'success', setup: onLogin('050 246 6770', 'phone', { lookup: { type: 'returning', account: passkeyPhone }, passkeyOffer: passkeyPhone }) }),
    ],
  },
  {
    id: 'o-signup',
    group: 'oct16',
    number: 'V4',
    title: 'Sign up',
    summary: 'Sign up accepts email only, and “Agree & get OTP” is always active: a number or an unfinished email gets an error on tap. A new email turns the header yellow while the code is sent. In Saudi Arabia the TnC is a checkbox.',
    steps: [
      o16({ id: 'o-su-empty', title: 'Sign up', note: 'Email only.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email') }),
      o16({ id: 'o-su-typing', title: 'Typing email', note: 'Domain chips; the button is always active.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('sara@', 'email') }),
      o16({ id: 'o-su-checking', title: 'Checking', note: 'Someone new: yellow while the loader finishes.', tone: 'welcome', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('sara@gmail.com', 'email', { lookup: { type: 'checking' } }) }),
      o16({ id: 'o-su-phone', title: 'Phone number', note: 'Red after “Agree & get OTP”; typing an email clears it.', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('0501234567', 'phone', { showsInputError: true }) }),
      o16({ id: 'o-su-found', title: 'Email has an account', note: 'TnC hides; “Continue to log in”.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork }, foundOnSignup: AuthService.anmolWork }) }),
      o16({ id: 'o-su-code', title: 'Enter code', note: 'Or set a password instead.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(sara.identifier, null, { origin: 'signup', resendIn: 22 }), resume: resumeCode }),
      o16({ id: 'o-su-create', title: 'Create password', note: 'No confirm field, so password managers can save it.', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(sara.identifier, null, { origin: 'signup', step: 'createPassword', newPassword: 'Noon@2026', resendIn: 0 }) }),
      o16({ id: 'o-su-saudi', title: 'Saudi Arabia', note: 'The TnC is a checkbox; the button reads “Get OTP”.', ui: { focus: 'identifier' }, keyboard: 'email', setup: inSaudi(onSignup('sara@gmail.com', 'email')) }),
      o16({ id: 'o-su-saudi-ready', title: 'Saudi · ready', note: 'Box ticked, then “Get OTP”.', ui: { focus: 'identifier' }, keyboard: 'email', setup: inSaudi(onSignup('sara@gmail.com', 'email', { consentChecked: true })) }),
      o16({ id: 'o-su-success', title: 'Welcome to noon', note: 'The success animation plays.', setup: celebrating(sara, true) }),
      o16({ id: 'o-su-passkey', title: 'Set up passkey', note: 'Shown once; a cooldown applies if dismissed.', setup: signedIn(sara, { sessionIsNew: true, showsFaceIDOffer: true }) }),
    ],
  },
]

const SEPARATE_FLOWS: Flow[] = [
  {
    id: 'n-entry',
    group: 'separate',
    number: 'N0',
    title: 'Entry points',
    summary: 'My Account opens Welcome with two clear buttons. Checkout and the address link open Log in directly (✕ closes and returns). A remembered device opens “Choose your account”.',
    steps: [
      sep({ id: 'n-welcome', title: 'Welcome', note: 'Policies and socials sit under the nav; pull the sheet up for them.' }),
      sep({ id: 'n-cart', title: 'Cart', note: 'Checkout asks a signed-out customer to log in.', tab: 'cart' }),
      sep({ id: 'n-checkout', title: 'From checkout', note: 'Opens straight on Log in. ✕ returns to Checkout.', tab: 'cart', entry: 'checkout', ui: { focus: 'identifier' }, keyboard: 'email' }),
      sep({ id: 'n-checkout-rest', title: 'Keyboard put away', note: 'The form comes down to the bottom; tap the field to type again.', tab: 'cart', entry: 'checkout', ui: { keyboardDown: true } }),
      sep({ id: 'n-link-chat', title: 'Address link in WhatsApp', note: 'A friend shares a noon address link.', tab: 'home', setup: (app) => app.set({ showsAddressChat: true }) }),
      sep({ id: 'n-link', title: 'From the link', note: 'Log in first, then the address is saved.', tab: 'home', entry: 'addressLink', ui: { focus: 'identifier' }, keyboard: 'email' }),
      sep({ id: 'n-saved', title: 'Returning on this phone', note: 'Choose your account instead of Welcome.', scenario: 'rememberedFaceID' }),
    ],
  },
  {
    id: 'n-cached',
    group: 'separate',
    number: 'N1',
    title: 'Saved account',
    summary: 'With a passkey the main action is Face ID; without one it’s “Log in with OTP”. Face ID failing twice, or cancelling, falls back to a code. “Login/Signup with another account” turns the sheet into Welcome’s two choices.',
    steps: [
      sep({ id: 'n-ca-faceid', title: 'Choose your account', note: 'Passkey cached → Log in with Face ID.', scenario: 'rememberedFaceID' }),
      sep({
        id: 'n-ca-prompt',
        title: 'Face ID prompt',
        note: 'The system sheet scans on its own.',
        scenario: 'rememberedFaceID',
        setup: (app) => {
          app.flow.hydrate({ showsFaceIDPrompt: true, biometricState: 'scanning' })
          app.biometrics.prompt = 'scanning'
        },
      }),
      sep({ id: 'n-ca-menu', title: 'Account menu', note: 'Log in with OTP, or remove the account.', scenario: 'rememberedFaceID', ui: { menuOpen: true } }),
      sep({ id: 'n-ca-email', title: 'Email cached, no passkey', note: 'One tap sends a code.', scenario: 'rememberedCode' }),
      sep({ id: 'n-ca-code', title: 'Code to the saved email', scenario: 'rememberedCode', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'remembered' }), resume: resumeCode }),
      sep({ id: 'n-ca-another', title: 'Another account', note: 'The sheet becomes Welcome: Log in or Create new account; Back returns to the saved account.', scenario: 'rememberedFaceID', setup: (app) => app.flow.hydrate({ step: 'welcome', anotherAccount: true }) }),
      sep({ id: 'n-ca-other', title: 'Log in picked', note: 'An empty Log in; Back returns to that Welcome.', scenario: 'rememberedFaceID', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email', { anotherAccount: true }) }),
      sep({ id: 'n-ca-new', title: 'Create new account picked', note: 'An empty Sign up; Back returns to that Welcome.', scenario: 'rememberedFaceID', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email', { anotherAccount: true }) }),
    ],
  },
  {
    id: 'n-login',
    group: 'separate',
    number: 'N2',
    title: 'Log in · email',
    summary: 'Log in takes email or phone and checks it on Continue: an account turns the header green; a new email goes on to create an account. The password option shows only if the account has one; a passkey is offered first.',
    steps: [
      sep({ id: 'n-lg-empty', title: 'Log in', note: '“New account” in the header for new users.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email') }),
      sep({ id: 'n-lg-typing', title: 'Typing email', note: 'Domain chips help finish the email.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@', 'email') }),
      sep({ id: 'n-lg-checking', title: 'Checking', note: 'Loader in the field after Continue.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@gmail.com', 'email', { lookup: { type: 'checking' } }) }),
      sep({ id: 'n-lg-found', title: 'Account found', note: 'Green “Welcome back!”.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('ajain@gmail.com', 'email', { lookup: { type: 'returning', account: emailAnmol } }) }),
      sep({ id: 'n-lg-code', title: 'Enter code', note: 'Password option: the account has one.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'login', resendIn: 14 }), resume: resumeCode }),
      sep({ id: 'n-lg-password', title: 'Enter password', note: 'Email is filled in; only the password is needed.', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(emailAnmol.identifier, emailAnmol, { origin: 'login', step: 'password', password: 'secret', resendIn: 0 }) }),
      sep({ id: 'n-lg-passkey', title: 'Passkey found', note: 'Face ID, or send a code instead.', tone: 'success', setup: onLogin('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork }, passkeyOffer: AuthService.anmolWork }) }),
      sep({ id: 'n-lg-new', title: 'No account → Sign up', note: 'Continue takes a new email to create an account, filled in.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('sara@yahoo.com', 'email', { signupFromLogin: true, lookup: { type: 'new' } }) }),
    ],
  },
  {
    id: 'n-phone',
    group: 'separate',
    number: 'N3',
    title: 'Log in · phone',
    summary: 'Typing digits turns the field into a phone field with the country chip. Codes go to WhatsApp first. A number verified on an email account logs in to that account. A number with no account gets a calm note and “Continue with email”, which clears the field for an email.',
    steps: [
      sep({ id: 'n-ph-typing', title: 'Phone', note: 'The field becomes a phone field with +971.', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('050 123 4567', 'phone') }),
      sep({ id: 'n-ph-code', title: 'Code on WhatsApp', note: 'SMS after the cooldown.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol, { origin: 'login' }), resume: resumeCode }),
      sep({ id: 'n-ph-verified', title: 'Verified phone', note: 'Not the primary, but verified on ajain@gmail.com: it logs in.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('052 345 6789', 'phone', { lookup: { type: 'returning', account: emailAnmol } }) }),
      sep({ id: 'n-ph-noacct', title: 'No account', note: 'No red: a note, and the button becomes “Continue with email”.', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: onLogin('055 987 6543', 'phone', { phoneHasNoAccount: true }) }),
      sep({ id: 'n-ph-email', title: 'Continue with email', note: 'Stays on Log in with the field cleared; a new email then goes on to Sign up.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onLogin('', 'email') }),
      sep({ id: 'n-ph-country', title: 'Country code sheet', note: 'Pick a country; the number keeps focus.', ui: { countryPicker: true }, setup: onLogin('050', 'phone') }),
      sep({ id: 'n-ph-passkey', title: 'Phone with a passkey', note: 'The sheet shows the number.', tone: 'success', setup: onLogin('050 246 6770', 'phone', { lookup: { type: 'returning', account: passkeyPhone }, passkeyOffer: passkeyPhone }) }),
    ],
  },
  {
    id: 'n-signup',
    group: 'separate',
    number: 'N4',
    title: 'Sign up',
    summary: 'Sign up accepts email only. “Agree & get OTP” stays dimmed until the email is valid; an email that already has an account turns green and continues to log in.',
    steps: [
      sep({ id: 'n-su-empty', title: 'Sign up', note: '“Log in” in the header for existing users.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('', 'email') }),
      sep({ id: 'n-su-typing', title: 'Typing email', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('sara@gm', 'email') }),
      sep({ id: 'n-su-phone', title: 'Phone number', note: 'Red field; the button stays disabled.', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('0501234567', 'phone') }),
      sep({ id: 'n-su-found', title: 'Email has an account', note: 'TnC hides; “Continue to log in”.', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: onSignup('ajain@gmail.com', 'email', { lookup: { type: 'returning', account: emailAnmol }, foundOnSignup: emailAnmol }) }),
      sep({ id: 'n-su-code', title: 'Enter code', note: 'Or set a password instead.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(sara.identifier, null, { origin: 'signup', resendIn: 22 }), resume: resumeCode }),
      sep({ id: 'n-su-create', title: 'Create password', note: 'No confirm field, so password managers can save it.', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(sara.identifier, null, { origin: 'signup', step: 'createPassword', newPassword: 'Noon@2026', resendIn: 0 }) }),
      sep({ id: 'n-su-success', title: 'Welcome to noon', note: 'The success animation plays.', setup: celebrating(sara, true) }),
      sep({ id: 'n-su-passkey', title: 'Set up passkey', note: 'Shown once; a cooldown applies if dismissed.', setup: signedIn(sara, { sessionIsNew: true, showsFaceIDOffer: true }) }),
    ],
  },
]

const EARLIER_FLOWS: Flow[] = [
  {
    id: 'entry',
    number: '00',
    title: 'Entry points',
    summary: 'Where sign-in starts. My Account shows the market, language and the noon One offer; checkout and links open the same flow full screen with the noon wordmark and a close button.',
    steps: [
      { id: 'entry-smart', title: 'My Account · smart field', note: 'One field that works out email or phone as you type.' },
      { id: 'entry-tabs', title: 'My Account · tabs', note: 'Phone number | Email tabs; the noon One header.', variant: 'toggle' },
      { id: 'entry-checkout', title: 'From checkout', note: 'Cart → Checkout asks a signed-out customer to sign in.', tab: 'cart', entry: 'checkout' },
      { id: 'entry-link', title: 'From an address link', note: 'Opening a “save this address” link.', tab: 'home', entry: 'addressLink' },
      { id: 'entry-lifted', title: 'Sheet pulled up', note: 'Drag the sheet over the artwork to reach the footer.', ui: { sheetLifted: true } },
    ],
  },
  {
    id: 'phone',
    number: '01',
    title: 'Returning customer · phone',
    summary: 'Anmol types their number. The header turns green the moment we recognise it, the code goes to WhatsApp, and the verified digits resolve into the avatar.',
    steps: [
      { id: 'phone-rest', title: 'Welcome to noon' },
      { id: 'phone-typing', title: 'Typing the number', note: 'Digits group as you type; the country code slides in.', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: typing('50 123', 'phone') },
      { id: 'phone-found', title: 'Account found', note: 'Green wash from the field: “Welcome back”.', ui: { focus: 'identifier' }, keyboard: 'numpad', tone: 'success', setup: typing('50 123 4567', 'phone', { lookup: { type: 'returning', account: phoneAnmol } }) },
      { id: 'phone-code', title: 'Code sent on WhatsApp', note: 'Resend on WhatsApp or SMS after 30s.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol), resume: resumeCode },
      { id: 'phone-filled', title: 'Code filled', note: 'Digits cascade in, then verify.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol, { code: '482913', codeState: 'verifying', codeSource: 'filled' }) },
      { id: 'phone-verified', title: 'Verified', tone: 'success', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol, { code: '482913', codeState: 'verified', codeSource: 'filled' }) },
      { id: 'phone-signed-in', title: 'Signed in', note: 'The avatar lands in the profile card.', setup: signedIn(phoneAnmol) },
      { id: 'phone-offer', title: 'Offer Face ID', note: 'After a code sign-in, offer the one-tap way next time.', setup: signedIn(phoneAnmol, { showsFaceIDOffer: true }) },
      { id: 'phone-faceid-on', title: 'Biometric is on', ui: { faceIDEnabled: true }, setup: signedIn(phoneAnmol, { showsFaceIDOffer: true }) },
    ],
  },
  {
    id: 'email',
    number: '02',
    title: 'Returning customer · email',
    summary: 'Email gets ghost completion and domain chips, typo fixes, and the code by email with “Resend via email” when the timer runs out.',
    steps: [
      { id: 'email-typing', title: 'Typing an email', note: 'Ghost completion and domain chips.', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('ajain@gm', 'email') },
      { id: 'email-typo', title: 'Typo fix', note: '“Did you mean …?”', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('ajain@gmial.com', 'email') },
      { id: 'email-found', title: 'Account found', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('ajain@gmail.com', 'email', { lookup: { type: 'returning', account: emailAnmol } }) },
      { id: 'email-code', title: 'Code sent by email', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { resendIn: 18 }), resume: resumeCode },
      { id: 'email-resend', title: 'Resend via email', note: 'When the countdown ends.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { resendIn: 0 }) },
    ],
  },
  {
    id: 'new',
    number: '03',
    title: 'New customer',
    summary: 'Someone new gets a yellow welcome and a waving hand, agrees to the terms on the button itself, and their account is ready after the code.',
    steps: [
      { id: 'new-welcome', title: 'Welcome, new customer', note: 'Yellow wash and a hand waving hello.', tone: 'welcome', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('sara@yahoo.com', 'email', { lookup: { type: 'new' } }) },
      { id: 'new-agree', title: 'Agree & get OTP', note: 'The terms sit right above the button.', tone: 'welcome', setup: typing('sara@yahoo.com', 'email', { lookup: { type: 'new' } }) },
      { id: 'new-code', title: 'Code sent', note: 'New customers can set a password instead.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(sara.identifier, null, { resendIn: 26 }), resume: resumeCode },
      { id: 'new-ready', title: 'Account ready', setup: signedIn(sara, { sessionIsNew: true }) },
    ],
  },
  {
    id: 'create',
    number: '04',
    title: 'New customer · set a password',
    summary: '“Sign up with password” on the code screen. The hint lists only what the password still needs, and turns green when it’s strong.',
    steps: [
      { id: 'create-empty', title: 'Create your account', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(sara.identifier, null, { step: 'createPassword', resendIn: 0 }) },
      { id: 'create-rules', title: 'What’s missing', note: 'Only the unmet rules are listed.', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(sara.identifier, null, { step: 'createPassword', newPassword: 'noon2026', resendIn: 0 }) },
      { id: 'create-strong', title: 'Strong password', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(sara.identifier, null, { step: 'createPassword', newPassword: 'Noon@2026', resendIn: 0 }) },
    ],
  },
  {
    id: 'password',
    number: '05',
    title: 'Sign in with password',
    summary: 'Any existing account can use a password instead of the code, with a clear way back to OTP.',
    steps: [
      { id: 'password-code', title: 'Code screen', note: '“Sign in with Password” sits above the keys.', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(emailAnmol.identifier, emailAnmol, { resendIn: 21 }), resume: resumeCode },
      { id: 'password-typing', title: 'Enter your password', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(emailAnmol.identifier, emailAnmol, { step: 'password', password: 'secret', resendIn: 0 }) },
      { id: 'password-failed', title: 'Password failed', note: 'Retry, use OTP, or reset it.', tone: 'error', ui: { focus: 'password' }, keyboard: 'text', setup: verifying(emailAnmol.identifier, emailAnmol, { step: 'password', password: 'abc', passwordState: 'failed', resendIn: 0 }) },
    ],
  },
  {
    id: 'passkey',
    number: '06',
    title: 'Passkey found',
    summary: 'An email whose account has Face ID on this device gets offered Face ID before any code is sent. Try ajain@noon.com.',
    steps: [
      { id: 'passkey-found', title: 'Account found', tone: 'success', setup: typing('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork } }) },
      { id: 'passkey-sheet', title: 'This account has a passkey', setup: typing('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork }, passkeyOffer: AuthService.anmolWork }) },
      {
        id: 'passkey-scan',
        title: 'Face ID',
        setup: (app) => {
          typing('ajain@noon.com', 'email', { lookup: { type: 'returning', account: AuthService.anmolWork }, passkeyOffer: AuthService.anmolWork, biometricState: 'scanning' })(app)
          app.biometrics.prompt = 'scanning'
        },
      },
    ],
  },
  {
    id: 'saved',
    number: '07',
    title: 'Saved account',
    summary: 'A device that remembers Anmol opens on “Choose your account”: one tap with Face ID, or a code. The menu offers OTP instead or removes the account.',
    steps: [
      { id: 'saved-faceid', title: 'Choose your account', note: 'Face ID is on for this account.', scenario: 'rememberedFaceID' },
      {
        id: 'saved-scan',
        title: 'Face ID',
        scenario: 'rememberedFaceID',
        setup: (app) => {
          app.flow.hydrate({ biometricState: 'scanning' })
          app.biometrics.prompt = 'scanning'
        },
      },
      { id: 'saved-menu', title: 'Account menu', note: 'Log in with OTP, or remove the account.', scenario: 'rememberedFaceID', ui: { menuOpen: true } },
      { id: 'saved-remove', title: 'Remove account?', scenario: 'rememberedFaceID', ui: { confirmRemove: true } },
      { id: 'saved-code', title: 'Without Face ID', note: 'One tap sends a code.', scenario: 'rememberedCode' },
      { id: 'saved-other', title: 'Another account', note: 'Back returns to the saved account.', scenario: 'rememberedFaceID', ui: { focus: 'identifier' }, keyboard: 'email', setup: (app) => app.flow.hydrate({ step: 'identify' }) },
    ],
  },
  {
    id: 'errors',
    number: '08',
    title: 'Errors',
    summary: 'The button is never disabled; tapping it with something missing explains what to fix, in red, next to the field.',
    steps: [
      { id: 'error-empty', title: 'Nothing typed', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'email', setup: (app) => app.flow.hydrate({ showsInputError: true }) },
      { id: 'error-phone', title: 'Phone not available', note: 'Incomplete or unsupported number.', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: typing('50 12', 'phone', { showsInputError: true }) },
      { id: 'error-email', title: 'Invalid email', tone: 'error', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('ajain@gmail', 'email', { showsInputError: true }) },
      { id: 'error-code', title: 'Invalid code', note: '000000 always fails.', tone: 'error', ui: { focus: 'otp' }, keyboard: 'numpad', setup: verifying(phoneAnmol.identifier, phoneAnmol, { code: '000000', codeState: 'failed', showsCodeError: true, resendIn: 12 }) },
      { id: 'error-faceid', title: 'Face ID failed', tone: 'error', scenario: 'rememberedFaceID', setup: (app) => app.flow.hydrate({ biometricState: 'failed' }) },
    ],
  },
  {
    id: 'tabs',
    number: '09',
    title: 'Phone | Email tabs',
    summary: 'The alternative identify screen: choose Phone number or Email first. Each tab keeps its own draft; the country chip opens the picker.',
    steps: [
      { id: 'tabs-rest', title: 'Phone number tab', variant: 'toggle' },
      { id: 'tabs-typing', title: 'Typing the number', variant: 'toggle', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: typing('050 123', 'phone') },
      { id: 'tabs-email', title: 'Email tab', variant: 'toggle', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'email', setup: typing('ajain@gmail.com', 'email', { lookup: { type: 'returning', account: emailAnmol } }) },
      { id: 'tabs-country', title: 'Country picker', variant: 'toggle', ui: { countryPicker: true } },
      { id: 'tabs-saudi', title: 'Another market', note: 'Omar, +966.', variant: 'toggle', tone: 'success', ui: { focus: 'identifier' }, keyboard: 'numpad', setup: typing('55 123 4567', 'phone', { country: SAUDI, lookup: { type: 'returning', account: AuthService.omar } }) },
    ],
  },
]

export const FLOWS: Flow[] = [...OCT16_FLOWS, ...SEPARATE_FLOWS, ...EARLIER_FLOWS.map((f) => ({ ...f, group: 'earlier' as const }))]

export const ALL_PRESETS = FLOWS.flatMap((f) => f.steps.map((s) => ({ flow: f, preset: s })))
export const findPreset = (id: string) => ALL_PRESETS.find((x) => x.preset.id === id)

/** Puts a fresh app into a preset's state. Live apps resume timers; thumbnails stay frozen. */
export function applyPreset(app: AppModel, preset: Preset, mode: 'live' | 'static') {
  const scenario = preset.scenario ?? 'newDevice'
  app.store.update({ loginVariant: preset.variant ?? 'smart' })
  app.apply(scenario)
  app.flow.hydrate({ country: UAE })
  app.introPending = mode === 'live' && !preset.setup && !preset.entry && !preset.ui
  app.selectedTab = preset.tab ?? 'account'
  if (preset.entry && preset.entry !== 'account') {
    // The separate flow opens checkout and links straight on Log in.
    if (app.flow.isSeparate) app.flow.prepareDirectLogin()
    app.authEntry = preset.entry
  }
  preset.setup?.(app)
  if (mode === 'live') preset.resume?.(app)
}
