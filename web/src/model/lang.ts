/** noon ships in English and Arabic. Copy is written as `t(lang, "English", "العربية")`. */
export type Lang = 'en' | 'ar'

export const t = (lang: Lang, en: string, ar: string) => (lang === 'ar' ? ar : en)
export const isRTL = (lang: Lang) => lang === 'ar'
export const dir = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr')

/** "3 more digits", with Arabic's dual and plural forms. */
export function digitsLeft(lang: Lang, n: number) {
  if (lang === 'en') return n === 1 ? '1 more digit' : `${n} more digits`
  if (n === 1) return 'باقي رقم واحد'
  if (n === 2) return 'باقي رقمان'
  if (n >= 3 && n <= 10) return `باقي ${n} أرقام`
  return `باقي ${n} رقماً`
}

/** "5, 6 or 9" / "5 و6 أو 9" */
export function orList(lang: Lang, items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  const head = items.slice(0, -1)
  const last = items[items.length - 1]
  return lang === 'en' ? `${head.join(', ')} or ${last}` : `${head.join('، ')} أو ${last}`
}

/** Wraps numbers, emails and codes in a left-to-right isolate so they never reverse in Arabic. */
export const ltr = (text: string) => `⁦${text}⁩`
