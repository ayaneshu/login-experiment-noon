import { AuthFlow } from './authFlow'
import type { Country } from './country'
import { INITIAL_COUNTRY } from './country'
import type { LoginVariant } from './deviceStore'
import { isSeparateFamily } from './deviceStore'
import { DeviceStore } from './deviceStore'
import type { Identifier } from './identifier'
import type { Lang } from './lang'
import { t } from './lang'
import type { Point } from './observable'
import { Observable, sleep } from './observable'
import type { Account } from './services'
import { AuthService, Biometrics } from './services'
import { SoundEffects } from './sound'

export type Tab = 'home' | 'categories' | 'deals' | 'account' | 'cart'
export type Scenario = 'newDevice' | 'rememberedCode' | 'rememberedFaceID'
export type AccountPhase = 'signedOut' | 'signedIn'
/** Where sign-in was opened from. My Account shows the market, language and the noon One offer;
 *  checkout and links open it full screen with noon's wordmark and a close button. */
export type AuthEntry = 'account' | 'checkout' | 'addressLink'

/** The signed-in moment: the code resolves into your avatar, the sheet clears into the page, a
 *  greeting, then the avatar settles into its place on the account page. */
export interface Celebration {
  id: number
  origin: Point
  initial: string | null
  title: string
  subtitle: string
  /** From My Account the avatar flies into the profile card; from checkout or a link it fades. */
  landsOnAccount: boolean
}

export type CelebrationStage = 'resolve' | 'clear' | 'greet' | 'land'

let celebrationCounter = 0

/** App-level state: tabs, session, the celebration and the other entry points. A port of AppModel.swift. */
export class AppModel extends Observable {
  readonly store: DeviceStore
  readonly biometrics = new Biometrics()
  readonly sound: SoundEffects
  flow: AuthFlow
  session: Account | null = null
  sessionIsNew = false
  phase: AccountPhase = 'signedOut'
  accountRevealed = false
  showsFaceIDOffer = false
  sheetCoversStatusBar = false
  celebration: Celebration | null = null
  celebrationStage: CelebrationStage = 'resolve'
  avatarCenter: Point = { x: 60, y: 120 }
  private usedPasskey = false

  selectedTab: Tab = 'account'
  showsDemo = false
  authEntry: AuthEntry | null = null
  showsCheckout = false
  /** Prototype: a WhatsApp chat where a friend shared a noon address link. */
  showsAddressChat = false
  /** A sheet drawn inside sign-in (the country code sheet) covers the tab bar too. */
  authSheetUp = false
  toast: string | null = null
  introPending = true
  restoreKeyboard = false
  authHeaderIsLight = false
  market: Country = INITIAL_COUNTRY
  /** Flow-map thumbnails render a frozen state: no sounds, no entrance. */
  readonly isStatic: boolean

  constructor(options: { persist: boolean; isStatic?: boolean }) {
    super()
    this.isStatic = options.isStatic ?? false
    this.store = new DeviceStore(options.persist)
    this.sound = new SoundEffects(() => this.store.soundOn && !this.isStatic)
    this.flow = this.makeFlow()
    if (this.isStatic) this.introPending = false
    this.store.subscribe(() => this.changed())
    this.biometrics.subscribe(() => this.changed())
  }

  get lang(): Lang {
    return this.store.lang
  }

  get scenario(): Scenario {
    const remembered = this.store.remembered
    if (!remembered) return 'newDevice'
    return remembered.passkeyEnabled ? 'rememberedFaceID' : 'rememberedCode'
  }

  get statusBarIsDark() {
    if (this.celebration) return this.sheetCoversStatusBar
    if (this.authEntry) return this.authHeaderIsLight
    if (this.selectedTab !== 'account') return true
    return this.phase === 'signedIn' ? true : this.authHeaderIsLight
  }

  get loginVariant(): LoginVariant {
    return this.store.loginVariant
  }

  set loginVariant(variant: LoginVariant) {
    const current = this.store.loginVariant
    const familyChanges = variant !== current && (isSeparateFamily(current) || isSeparateFamily(variant))
    this.store.update({ loginVariant: variant })
    // The separate flows have their own screens (Welcome, Log in, Sign up): start them fresh.
    if (familyChanges) this.restartAuth()
    else this.flow.setVariant(variant)
  }

  private makeFlow() {
    const flow = new AuthFlow(this.store, this.biometrics)
    flow.market = this.market
    flow.onAuthenticated = (account, isNew, origin) => this.authenticated(account, isNew, origin)
    return flow
  }

  set(patch: Partial<AppModel>) {
    Object.assign(this, patch)
    this.changed()
  }

  selectTab(tab: Tab) {
    this.selectedTab = tab
    this.changed()
  }

  setHeaderLight(isLight: boolean) {
    if (this.authHeaderIsLight === isLight) return
    this.authHeaderIsLight = isLight
    this.changed()
  }

  // MARK: - Sign-in lifecycle

  private authenticated(account: Account, isNew: boolean, origin: Point) {
    this.usedPasskey = this.flow.biometricState === 'scanning'
    this.session = account
    this.sessionIsNew = isNew
    this.store.remember(account)
    this.authHeaderIsLight = false
    const lang = this.lang
    let title: string
    let subtitle: string
    if (isNew) {
      title = t(lang, 'Welcome to noon', 'أهلاً بك في نون')
      subtitle = t(lang, 'Your account is ready', 'حسابك جاهز')
    } else if (account.firstName) {
      title = t(lang, `Welcome back, ${account.firstName}`, `أهلاً بعودتك، ${account.firstName}`)
      subtitle = t(lang, "You're signed in", 'تم تسجيل دخولك')
    } else {
      title = t(lang, 'Welcome back', 'أهلاً بعودتك')
      subtitle = t(lang, "You're signed in", 'تم تسجيل دخولك')
    }
    const initial = account.firstName?.[0] ?? (account.identifier.type === 'email' ? account.identifier.email[0]?.toUpperCase() : null) ?? null
    this.celebrationStage = 'resolve'
    this.sheetCoversStatusBar = false
    this.celebration = { id: ++celebrationCounter, origin, initial, title, subtitle, landsOnAccount: this.authEntry == null }
    this.changed()
  }

  // MARK: - Other entry points

  /** Checkout needs an account: signed out, sign-in opens full screen; signed in, carry on. */
  beginCheckout() {
    if (this.phase === 'signedIn') {
      this.showsCheckout = true
      this.changed()
    } else {
      this.presentAuth('checkout')
    }
  }

  /** Prototype controls: someone opened a "save this address" link. */
  openAddressLink() {
    if (this.phase === 'signedIn') this.showToast(t(this.lang, 'Address saved to your account', 'تم حفظ العنوان في حسابك'))
    else this.presentAuth('addressLink')
  }

  closeAuthEntry() {
    this.authEntry = null
    this.authHeaderIsLight = false
    this.changed()
  }

  private presentAuth(entry: AuthEntry) {
    if (this.flow.isSeparate) {
      // Checkout and links open straight on Log in; ✕ closes and returns.
      this.restartAuth()
      this.flow.prepareDirectLogin()
    } else if (this.flow.step !== 'identify' && this.flow.step !== 'remembered') {
      this.restartAuth()
    }
    this.authEntry = entry
    this.changed()
  }

  /** The WhatsApp chat with a shared address link slides over the app. */
  openAddressChat() {
    this.showsAddressChat = true
    this.changed()
  }

  /** The link in the chat was tapped: noon comes forward and asks to log in. */
  followAddressLink() {
    this.showsAddressChat = false
    this.changed()
    void (async () => {
      await sleep(250)
      this.openAddressLink()
    })()
  }

  closeAddressChat() {
    this.showsAddressChat = false
    this.changed()
  }

  showToast(message: string) {
    this.toast = message
    this.changed()
    void (async () => {
      await sleep(2600)
      if (this.toast !== message) return
      this.toast = null
      this.changed()
    })()
  }

  // MARK: - Celebration beats (driven by the celebration view)

  /** The sheet starts growing to fill the screen. */
  celebrationClearing() {
    this.celebrationStage = 'clear'
    this.changed()
    void (async () => {
      await sleep(300)
      if (!this.celebration) return
      this.sheetCoversStatusBar = true
      this.changed()
    })()
  }

  /** The sheet is the page now: swap sign-in for the account page underneath the greeting. */
  celebrationCovered() {
    this.celebrationStage = 'greet'
    this.accountRevealed = false
    this.phase = 'signedIn'
    this.changed()
  }

  /** The avatar heads for the profile card: raise the page to meet it. */
  celebrationLanding() {
    this.celebrationStage = 'land'
    this.accountRevealed = true
    this.changed()
  }

  celebrationFinished() {
    const landed = this.celebration?.landsOnAccount ?? true
    this.celebration = null
    const entry = this.authEntry
    if (!landed && entry) {
      // Back to where sign-in was asked for.
      this.authEntry = null
      if (entry === 'checkout') this.showsCheckout = true
      if (entry === 'addressLink') this.showToast(t(this.lang, "You're signed in. Address saved.", 'تم تسجيل دخولك وحفظ العنوان.'))
    }
    this.changed()
    // A code-based sign-in is the moment to offer the one-tap alternative. The separate flow offers
    // it once, only to accounts without a passkey, and waits out a cooldown if dismissed.
    if (this.usedPasskey || this.store.remembered?.passkeyEnabled !== false) return
    if (this.flow.isSeparate) {
      if (this.store.passkeyOfferCoolingDown) return
      if (this.session && AuthService.hasPasskey(this.session, null)) return
    }
    void (async () => {
      await sleep(450)
      if (this.phase !== 'signedIn' || this.celebration) return
      this.showsFaceIDOffer = true
      this.changed()
    })()
  }

  dismissFaceIDOffer() {
    // Dismissed without turning it on: start the cooldown before offering again.
    if (this.store.remembered?.passkeyEnabled === false) this.store.update({ passkeyOfferDismissedAt: Date.now() })
    this.showsFaceIDOffer = false
    this.changed()
  }

  setPasskey(enabled: boolean) {
    const remembered = this.store.remembered
    if (remembered) this.store.update({ remembered: { ...remembered, passkeyEnabled: enabled } })
  }

  signOut() {
    this.session = null
    this.showsFaceIDOffer = false
    this.showsCheckout = false
    this.restartAuth()
  }

  toggleLanguage() {
    this.store.update({ lang: this.lang === 'en' ? 'ar' : 'en' })
  }

  setLanguage(lang: Lang) {
    this.store.update({ lang })
  }

  selectMarket(country: Country) {
    this.market = country
    this.flow.market = country
    if (this.flow.kind !== 'email') this.flow.selectCountry(country)
    this.changed()
  }

  // MARK: - Prototype controls

  apply(scenario: Scenario) {
    switch (scenario) {
      case 'newDevice':
        this.store.update({ remembered: null })
        break
      case 'rememberedCode':
        this.store.update({ remembered: { account: AuthService.anmolEmail, passkeyEnabled: false } })
        break
      case 'rememberedFaceID':
        this.store.update({ remembered: { account: AuthService.anmolEmail, passkeyEnabled: true } })
    }
    this.restartAuth()
  }

  demoFill(identifier: Identifier) {
    this.selectedTab = 'account'
    this.authEntry = null
    if (this.phase !== 'signedOut') this.restartAuth()
    this.flow.demoFill(identifier)
    this.changed()
  }

  resetPrototype() {
    this.store.resetAll()
    this.restartAuth()
  }

  restartAuth() {
    this.flow.dispose()
    this.flow = this.makeFlow()
    this.introPending = !this.isStatic
    this.authHeaderIsLight = false
    this.phase = 'signedOut'
    this.accountRevealed = false
    this.sheetCoversStatusBar = false
    this.showsFaceIDOffer = false
    this.celebration = null
    this.changed()
  }
}
