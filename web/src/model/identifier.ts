import type { Country } from './country'
import { UAE, countryWithID, maxDigits } from './country'

export type IdentifierKind = 'unknown' | 'phone' | 'email'

// MARK: - Raw input

export const InputParser = {
  /** Converts Arabic-Indic and Eastern Arabic-Indic digits (٠١٢ / ۰۱۲) to ASCII. */
  normalizingDigits(text: string) {
    return text
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
  },

  digits(text: string) {
    return text.replace(/[^0-9]/g, '')
  },

  /** Phone while everything typed could belong to a phone number; email as soon as anything couldn't. */
  detect(text: string): IdentifierKind {
    const trimmed = text.trim()
    if (!trimmed) return 'unknown'
    return /^[0-9+\-() ]+$/.test(trimmed) ? 'phone' : 'email'
  },
}

// MARK: - Phone

export interface PhoneNumber {
  countryID: string
  /** National significant number: no dial code, no trunk 0. */
  nsn: string
}

export const phoneCountry = (n: PhoneNumber) => countryWithID(n.countryID) ?? UAE
export const phoneE164 = (n: PhoneNumber) => `+${phoneCountry(n).dialCode}${n.nsn}`
export const phoneNational = (n: PhoneNumber) => PhoneFormatter.format(n.nsn, phoneCountry(n))
export const phoneDisplay = (n: PhoneNumber) => `+${phoneCountry(n).dialCode} ${phoneNational(n)}`

export type PhoneValidity = { type: 'empty' } | { type: 'badPrefix' } | { type: 'incomplete'; remaining: number } | { type: 'valid' }

export const PhoneFormatter = {
  startsWithTrunkZero(digits: string, country: Country) {
    return country.usesTrunkZero && digits.startsWith('0')
  },

  nsn(digits: string, country: Country) {
    return PhoneFormatter.startsWithTrunkZero(digits, country) ? digits.slice(1) : digits
  },

  /** Groups digits as people write them locally: "50 123 4567", or "050 123 4567" with the 0. */
  format(digits: string, country: Country) {
    const groups = [...country.groups]
    if (PhoneFormatter.startsWithTrunkZero(digits, country) && groups.length) groups[0] += 1
    const parts: string[] = []
    let index = 0
    for (const size of groups) {
      if (index >= digits.length) break
      parts.push(digits.slice(index, index + size))
      index += size
    }
    let result = parts.join(' ')
    if (index < digits.length) result += digits.slice(index)
    return result
  },

  validate(digits: string, country: Country): PhoneValidity {
    const number = PhoneFormatter.nsn(digits, country)
    if (!number) return { type: 'empty' }
    if (country.mobilePrefixes.length) {
      const plausible = country.mobilePrefixes.some((p) => number.startsWith(p) || p.startsWith(number))
      if (!plausible) return { type: 'badPrefix' }
    }
    if (number.length < country.length) return { type: 'incomplete', remaining: country.length - number.length }
    return { type: 'valid' }
  },

  maxDigits,
}

// MARK: - Email

// The first three are the chips shown under an empty domain: the most used providers.
const PROVIDERS = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'noon.com']

function split(email: string): { local: string; domain: string } | null {
  const at = email.indexOf('@')
  if (at <= 0) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (domain.includes('@')) return null
  return { local, domain }
}

function distance(a: string, b: string) {
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i, ...Array(b.length).fill(0)]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
    }
    previous = current
  }
  return previous[b.length]
}

export const EmailAssist = {
  providers: PROVIDERS,

  isValid(email: string) {
    return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/.test(email)
  },

  /** Providers that complete what's been typed after the @. */
  domainSuggestions(email: string): string[] {
    const parts = split(email)
    if (!parts) return []
    const typed = parts.domain.toLowerCase()
    if (!typed) return PROVIDERS.slice(0, 3)
    return PROVIDERS.filter((p) => p.startsWith(typed) && p !== typed)
  },

  /** The rest of the most likely provider, shown as ghost text after the caret. */
  ghostCompletion(email: string): string | null {
    const parts = split(email)
    if (!parts) return null
    if (!parts.domain) return PROVIDERS[0]
    const typed = parts.domain.toLowerCase()
    const match = PROVIDERS.find((p) => p.startsWith(typed) && p !== typed)
    return match ? match.slice(typed.length) : null
  },

  completing(email: string, provider: string) {
    const parts = split(email)
    return parts ? `${parts.local}@${provider}` : email
  },

  /** "aisha@gmial.com" → "aisha@gmail.com". Only for near-misses of popular providers. */
  typoCorrection(email: string): string | null {
    const parts = split(email)
    if (!EmailAssist.isValid(email) || !parts) return null
    const typed = parts.domain.toLowerCase()
    if (PROVIDERS.includes(typed)) return null
    const best = PROVIDERS.map((p) => [p, distance(typed, p)] as const).sort((a, b) => a[1] - b[1])[0]
    if (!best || best[1] < 1 || best[1] > 2) return null
    return `${parts.local}@${best[0]}`
  },
}

// MARK: - Identifier

export type Identifier = { type: 'phone'; number: PhoneNumber } | { type: 'email'; email: string }

export const phoneID = (countryID: string, nsn: string): Identifier => ({ type: 'phone', number: { countryID, nsn } })
export const emailID = (email: string): Identifier => ({ type: 'email', email })

/** Lookup key: E.164 for phones, lowercased for emails. */
export const idKey = (id: Identifier) => (id.type === 'phone' ? phoneE164(id.number) : id.email.toLowerCase())
export const idDisplay = (id: Identifier) => (id.type === 'phone' ? phoneDisplay(id.number) : id.email)
export const idIsPhone = (id: Identifier) => id.type === 'phone'
