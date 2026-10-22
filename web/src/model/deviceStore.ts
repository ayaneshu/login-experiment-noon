import type { Lang } from './lang'
import { Observable } from './observable'
import type { Account, RememberedAccount } from './services'
import { idKey } from './identifier'

/** Which sign-in approach to test: separate Log in / Sign up screens (the 16 Oct revision, the
 *  newest, or the first version), one smart field, or Phone number | Email tabs. */
export type LoginVariant = 'oct16' | 'separate' | 'smart' | 'toggle'

/** Both separate Log in / Sign up variants share Welcome, Log in and Sign up. */
export const isSeparateFamily = (variant: LoginVariant) => variant === 'oct16' || variant === 'separate'

/** How the sign-in header changes colour for success and error. */
export type HeaderTransitionStyle = 'smooth' | 'ripple' | 'dissolve' | 'bloom'

export const HEADER_TRANSITION_INFO: Record<HeaderTransitionStyle, { title: string; summary: string }> = {
  smooth: { title: 'Classic', summary: 'The current wash: a soft circle grows from the field, holds, then fades.' },
  ripple: { title: 'Ripple', summary: 'A ring of lit pixels radiates out; the colour settles in behind it and the grid fades.' },
  dissolve: { title: 'Dissolve', summary: 'Pixels flip in a loose outward scatter, each with a quick flash.' },
  bloom: { title: 'Bloom', summary: 'Halftone dots grow on a diamond front and merge into solid colour.' },
}

/** The knobs for one pixel style, in points or seconds except the 0–1 ones. */
export interface PixelWashParams {
  cell: number
  gap: number
  spread: number
  hold: number
  recede: number
  band: number
  scatter: number
  glow: number
  grid: number
}

export function defaultPixelParams(style: HeaderTransitionStyle): PixelWashParams {
  switch (style) {
    case 'dissolve':
      return { cell: 10, gap: 1, spread: 0.9, hold: 1.0, recede: 0.9, band: 0.22, scatter: 0.6, glow: 0.7, grid: 0.35 }
    case 'bloom':
      return { cell: 14, gap: 0, spread: 0.85, hold: 1.0, recede: 0.9, band: 0.4, scatter: 0.08, glow: 0.3, grid: 0.5 }
    default:
      return { cell: 12, gap: 1.5, spread: 0.8, hold: 1.0, recede: 0.9, band: 0.28, scatter: 0.12, glow: 0.55, grid: 0.6 }
  }
}

export interface HeaderTransitionSettings {
  style: HeaderTransitionStyle
  ripple: PixelWashParams
  dissolve: PixelWashParams
  bloom: PixelWashParams
  /** Also use the pixel style for the yellow new-customer wash. */
  includeWelcome: boolean
}

export const defaultHeaderTransition = (): HeaderTransitionSettings => ({
  style: 'ripple',
  ripple: defaultPixelParams('ripple'),
  dissolve: defaultPixelParams('dissolve'),
  bloom: defaultPixelParams('bloom'),
  includeWelcome: false,
})

export function paramsFor(settings: HeaderTransitionSettings, style: HeaderTransitionStyle): PixelWashParams {
  return style === 'dissolve' ? settings.dissolve : style === 'bloom' ? settings.bloom : settings.ripple
}

/** The style to use for a reaction of this kind. */
export function styleFor(settings: HeaderTransitionSettings, kind: 'success' | 'error' | 'welcome'): HeaderTransitionStyle {
  return kind === 'welcome' && !settings.includeWelcome ? 'smooth' : settings.style
}

const KEY = 'noon-prototype.device'

interface Persisted {
  remembered: RememberedAccount | null
  registered: Record<string, Account>
  simulateAutofill: boolean
  lang: Lang
  loginVariant: LoginVariant
  headerTransition: HeaderTransitionSettings
  soundOn: boolean
  flowVersion: number
  passkeyOfferDismissedAt: number | null
}

/** Prototype cooldown for the post-sign-in passkey offer once it's dismissed. */
export const PASSKEY_OFFER_COOLDOWN_MS = 5 * 60 * 1000

/** Everything the app keeps on-device between launches. The live prototype persists it to
 *  localStorage; flow-map thumbnails keep theirs in memory. */
export class DeviceStore extends Observable {
  remembered: RememberedAccount | null = null
  registered: Record<string, Account> = {}
  simulateAutofill = true
  lang: Lang = 'en'
  loginVariant: LoginVariant = 'oct16'
  headerTransition: HeaderTransitionSettings = defaultHeaderTransition()
  soundOn = true
  flowVersion = 4
  passkeyOfferDismissedAt: number | null = null

  constructor(private persist: boolean) {
    super()
    if (!persist) return
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Persisted> | null
      if (saved) Object.assign(this, saved)
      // Variant - 16 Oct is the newest approach: start everyone on it once.
      if ((saved?.flowVersion ?? 0) < 4) {
        this.loginVariant = 'oct16'
        this.flowVersion = 4
        this.save()
      }
    } catch {
      // Private windows and blocked storage just start fresh.
    }
  }

  get passkeyOfferCoolingDown() {
    return this.passkeyOfferDismissedAt != null && Date.now() - this.passkeyOfferDismissedAt < PASSKEY_OFFER_COOLDOWN_MS
  }

  update(patch: Partial<Persisted>) {
    Object.assign(this, patch)
    this.save()
    this.changed()
  }

  remember(account: Account) {
    const keepPasskey = !!this.remembered && idKey(this.remembered.account.identifier) === idKey(account.identifier) && this.remembered.passkeyEnabled
    this.update({ remembered: { account, passkeyEnabled: keepPasskey } })
  }

  resetAll() {
    this.update({ remembered: null, registered: {}, simulateAutofill: true, passkeyOfferDismissedAt: null })
  }

  private save() {
    if (!this.persist) return
    const data: Persisted = {
      remembered: this.remembered,
      registered: this.registered,
      simulateAutofill: this.simulateAutofill,
      lang: this.lang,
      loginVariant: this.loginVariant,
      headerTransition: this.headerTransition,
      soundOn: this.soundOn,
      flowVersion: this.flowVersion,
      passkeyOfferDismissedAt: this.passkeyOfferDismissedAt,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // Storage can be unavailable; the prototype still works for this visit.
    }
  }
}
