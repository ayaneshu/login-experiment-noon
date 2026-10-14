import type { Lang } from './lang'
import { orList } from './lang'

export interface Country {
  /** ISO 3166-1 alpha-2 */
  id: string
  name: string
  nameAR: string
  inName: string
  inNameAR: string
  dialCode: string
  /** National significant number length, without the trunk 0. */
  length: number
  /** Display grouping of the national significant number. */
  groups: number[]
  /** Valid first digits of a mobile number. Empty means any. */
  mobilePrefixes: string[]
  /** Whether people commonly type a leading 0 locally (050… in the UAE). */
  usesTrunkZero: boolean
}

const c = (id: string, name: string, nameAR: string, inName: string, inNameAR: string, dialCode: string, length: number, groups: number[], mobilePrefixes: string[], usesTrunkZero: boolean): Country =>
  ({ id, name, nameAR, inName, inNameAR, dialCode, length, groups, mobilePrefixes, usesTrunkZero })

export const UAE = c('AE', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'the UAE', 'الإمارات', '971', 9, [2, 3, 4], ['5'], true)
export const SAUDI = c('SA', 'Saudi Arabia', 'المملكة العربية السعودية', 'Saudi Arabia', 'السعودية', '966', 9, [2, 3, 4], ['5'], true)
export const EGYPT = c('EG', 'Egypt', 'مصر', 'Egypt', 'مصر', '20', 10, [2, 4, 4], ['10', '11', '12', '15'], true)

export const ALL_COUNTRIES: Country[] = [
  UAE, SAUDI, EGYPT,
  c('BH', 'Bahrain', 'البحرين', 'Bahrain', 'البحرين', '973', 8, [4, 4], ['3', '6'], false),
  c('BD', 'Bangladesh', 'بنغلاديش', 'Bangladesh', 'بنغلاديش', '880', 10, [4, 6], ['1'], true),
  c('IN', 'India', 'الهند', 'India', 'الهند', '91', 10, [5, 5], ['6', '7', '8', '9'], true),
  c('JO', 'Jordan', 'الأردن', 'Jordan', 'الأردن', '962', 9, [1, 4, 4], ['7'], true),
  c('KW', 'Kuwait', 'الكويت', 'Kuwait', 'الكويت', '965', 8, [4, 4], ['4', '5', '6', '9'], false),
  c('NP', 'Nepal', 'نيبال', 'Nepal', 'نيبال', '977', 10, [3, 7], ['9'], false),
  c('OM', 'Oman', 'عُمان', 'Oman', 'عُمان', '968', 8, [4, 4], ['7', '9'], false),
  c('PK', 'Pakistan', 'باكستان', 'Pakistan', 'باكستان', '92', 10, [3, 7], ['3'], true),
  c('PH', 'Philippines', 'الفلبين', 'the Philippines', 'الفلبين', '63', 10, [3, 3, 4], ['9'], true),
  c('QA', 'Qatar', 'قطر', 'Qatar', 'قطر', '974', 8, [4, 4], ['3', '5', '6', '7'], false),
  c('LK', 'Sri Lanka', 'سريلانكا', 'Sri Lanka', 'سريلانكا', '94', 9, [2, 3, 4], ['7'], true),
  c('GB', 'United Kingdom', 'المملكة المتحدة', 'the UK', 'المملكة المتحدة', '44', 10, [4, 6], ['7'], true),
  c('US', 'United States', 'الولايات المتحدة', 'the US', 'الولايات المتحدة', '1', 10, [3, 3, 4], [], false),
]

export const SUGGESTED_COUNTRIES = [UAE, SAUDI, EGYPT]

export const countryWithID = (id: string) => ALL_COUNTRIES.find((x) => x.id === id)

export const countryName = (country: Country, lang: Lang) => (lang === 'ar' ? country.nameAR : country.name)

export const flagEmoji = (country: Country) =>
  String.fromCodePoint(...[...country.id].map((ch) => 127397 + ch.charCodeAt(0)))

/** How the prefixes read in a hint: "05", or "010, 011, 012 or 015". */
export const prefixHint = (country: Country, lang: Lang) =>
  orList(lang, country.mobilePrefixes.map((p) => (country.usesTrunkZero ? `0${p}` : p)))

export const maxDigits = (country: Country, startingWithZero: boolean) =>
  country.length + (startingWithZero && country.usesTrunkZero ? 1 : 0)

/** The country whose dial code starts `digits` ("9715…" → UAE). Dial codes here are prefix-free. */
export function matchingDialPrefix(digits: string): Country | undefined {
  return ALL_COUNTRIES.filter((x) => digits.startsWith(x.dialCode)).sort((a, b) => b.dialCode.length - a.dialCode.length)[0]
}

export const INITIAL_COUNTRY = UAE
