import type { Identifier } from './identifier'
import { emailID, idKey, phoneID } from './identifier'
import { Observable, sleep } from './observable'

export interface Account {
  firstName: string | null
  lastName: string | null
  identifier: Identifier
  hasPassword: boolean
}

/** What this device remembers after a successful sign-in. */
export interface RememberedAccount {
  account: Account
  passkeyEnabled: boolean
}

export const fullName = (a: Account) => [a.firstName, a.lastName].filter(Boolean).join(' ') || null

/** Stand-in for noon's identity API. Latencies are realistic so every loading state is visible. */
export const AuthService = {
  anmolEmail: { firstName: 'Anmol', lastName: 'Jain', identifier: emailID('ajain@gmail.com'), hasPassword: true } as Account,
  anmolPhone: { firstName: 'Anmol', lastName: 'Jain', identifier: phoneID('AE', '501234567'), hasPassword: true } as Account,
  /** Has a passkey on this device in the seed data. */
  anmolWork: { firstName: 'Anmol', lastName: 'Jain', identifier: emailID('ajain@noon.com'), hasPassword: true } as Account,
  omar: { firstName: 'Omar', lastName: 'Haddad', identifier: phoneID('SA', '551234567'), hasPassword: false } as Account,
  /** A number whose account has a passkey on this device (separate flow, Figma LG-2c). */
  anmolPasskeyPhone: { firstName: 'Anmol', lastName: 'Jain', identifier: phoneID('AE', '502466770'), hasPassword: true } as Account,

  get seeded(): Account[] {
    return [this.anmolEmail, this.anmolWork, this.anmolPhone, this.omar, this.anmolPasskeyPhone]
  },

  /** Accounts with a passkey on this device: the work address, or a remembered account that turned Face ID on. */
  hasPasskey(account: Account, remembered: RememberedAccount | null) {
    if (remembered && idKey(remembered.account.identifier) === idKey(account.identifier)) return remembered.passkeyEnabled
    return idKey(account.identifier) === idKey(this.anmolWork.identifier) || idKey(account.identifier) === idKey(this.anmolPasskeyPhone.identifier)
  },

  /** The code that always fails, so the error state can be demoed. */
  failingCode: '000000',

  async lookup(identifier: Identifier, registered: Record<string, Account>): Promise<Account | null> {
    await sleep(550)
    return this.seeded.find((a) => idKey(a.identifier) === idKey(identifier)) ?? registered[idKey(identifier)] ?? null
  },

  async sendCode(_identifier: Identifier): Promise<string> {
    await sleep(700)
    return String(Math.floor(100000 + Math.random() * 900000))
  },

  async verifyCode(code: string) {
    await sleep(850)
    return code !== this.failingCode
  },

  async verifyPassword(password: string) {
    await sleep(800)
    return password.length >= 6
  },
}

export type BiometricOutcome = 'success' | 'cancelled' | 'fallback' | 'failed'

/** Face ID, simulated: shows the system glyph over the app, then resolves to the outcome chosen in
 *  the prototype controls. */
export class Biometrics extends Observable {
  /** What the next scan returns (prototype controls). */
  nextOutcome: BiometricOutcome = 'success'
  /** The Face ID HUD over the screen. */
  prompt: 'scanning' | 'success' | 'failed' | null = null

  setNextOutcome(outcome: BiometricOutcome) {
    this.nextOutcome = outcome
    this.changed()
  }

  async authenticate(): Promise<BiometricOutcome> {
    this.prompt = 'scanning'
    this.changed()
    await sleep(1100)
    const outcome = this.nextOutcome
    if (outcome === 'success') {
      this.prompt = 'success'
      this.changed()
      await sleep(450)
    } else if (outcome === 'failed') {
      this.prompt = 'failed'
      this.changed()
      await sleep(700)
    }
    this.prompt = null
    this.changed()
    return outcome
  }
}
