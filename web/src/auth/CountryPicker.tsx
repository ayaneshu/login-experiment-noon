import { swiftSpring } from '../design/motion'
import type { ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Transition } from 'motion/react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { SAFE_BOTTOM, SAFE_TOP, SCREEN, useLang, useScreen } from '../app/context'
import type { Country } from '../model/country'
import { ALL_COUNTRIES, SUGGESTED_COUNTRIES, countryName, flagEmoji } from '../model/country'
import type { Lang } from '../model/lang'
import { ltr, t } from '../model/lang'
import { useFieldFocus } from './shared'

// iOS system look (the picker is a stock SwiftUI List in a NavigationStack, not Field DS).
const SF = '-apple-system, "SF Pro Text", "SF Pro Display", "SF Arabic", system-ui, sans-serif'
const LABEL = '#000000'
const SECONDARY_LABEL = 'rgba(60, 60, 67, 0.6)'
const GROUPED_BACKGROUND = '#F2F2F7'
const SEPARATOR = 'rgba(60, 60, 67, 0.29)'
const FILL = 'rgba(118, 118, 128, 0.12)'
const ROW_PRESSED = '#E5E5EA'
// Palette.ink / ink2 / accent (light appearance).
const INK = '#0E1014'
const INK2 = '#5E6371'
const ACCENT = '#3866DF'

/** Page sheet detents: .large sits just under the status bar, .medium about half the screen. */
const LARGE_TOP = SAFE_TOP + 10
const MEDIUM_TOP = Math.round(SCREEN.height / 2)
const HIDDEN_TOP = SCREEN.height
const DIM = 0.35
const SHEET_SPRING: Transition = { ...swiftSpring(0.5, 0) }

const SEARCH_CSS = `.country-search::placeholder{color:${SECONDARY_LABEL};opacity:1}.country-search::-webkit-search-cancel-button{display:none}`

/** Past the top detent the sheet slows down rather than stopping dead. */
function rubberBand(overshoot: number) {
  const dimension = 300
  return (overshoot * dimension * 0.55) / (dimension + 0.55 * overshoot)
}

/** Country code picker. Swift presents it with `.sheet` at .medium/.large with a drag indicator;
 *  here it is an iOS page sheet sliding up inside the phone screen. Drag the top down (or tap the
 *  dimmed screen) to dismiss; drag it up, or start searching, for the large detent. */
export function CountryPicker({ open, selected, onSelect, onClose }: { open: boolean; selected: Country; onSelect: (c: Country) => void; onClose: () => void }) {
  const lang = useLang()
  const { isStatic, scale, screenRef, keyboard, keyboardHeight } = useScreen()
  const [mounted, setMounted] = useState(open)
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const top = useMotionValue(open && isStatic ? MEDIUM_TOP : HIDDEN_TOP)
  const dim = useTransform(top, [MEDIUM_TOP, HIDDEN_TOP], [DIM, 0])
  const presentation = useRef(0)
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Present and dismiss.
  useLayoutEffect(() => {
    const token = ++presentation.current
    if (open) {
      setMounted(true)
      setQuery('')
      // Presenting a sheet resigns the field underneath, as UIKit does; the screen puts it back on dismiss.
      const active = document.activeElement
      if (active instanceof HTMLElement && screenRef.current?.contains(active)) active.blur()
      if (isStatic) top.set(MEDIUM_TOP)
      else void animate(top, MEDIUM_TOP, SHEET_SPRING)
    } else {
      setSearchFocused(false)
      if (isStatic) {
        top.set(HIDDEN_TOP)
        setMounted(false)
        return
      }
      void animate(top, HIDDEN_TOP, SHEET_SPRING).then(() => {
        if (token === presentation.current) setMounted(false)
      })
    }
  }, [open, isStatic, top, screenRef])

  // Searching takes the whole sheet.
  useEffect(() => {
    if (searchFocused && open && !isStatic) void animate(top, LARGE_TOP, SHEET_SPRING)
  }, [searchFocused, open, isStatic, top])

  const searchFocus = useFieldFocus(searchRef, searchFocused, setSearchFocused, 'text')

  // MARK: Dragging the sheet by its top

  const drag = useRef<{ startY: number; startTop: number; lastY: number; lastTime: number; velocity: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (isStatic || e.button !== 0) return
    drag.current = { startY: e.clientY, startTop: top.get(), lastY: e.clientY, lastTime: e.timeStamp, velocity: 0, moved: false }
    const move = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dy = (ev.clientY - d.startY) / scale
      if (!d.moved && Math.abs(dy) < 4) return
      if (!d.moved) {
        d.moved = true
        top.stop()
      }
      let next = d.startTop + dy
      if (next < LARGE_TOP) next = LARGE_TOP - rubberBand(LARGE_TOP - next)
      top.set(next)
      const dt = ev.timeStamp - d.lastTime
      if (dt > 0) d.velocity = (((ev.clientY - d.lastY) / scale) / dt) * 1000
      d.lastY = ev.clientY
      d.lastTime = ev.timeStamp
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      const d = drag.current
      drag.current = null
      if (!d?.moved) return
      const current = top.get()
      // Where a flick would coast to, then the nearer detent, or away below .medium.
      const projected = current + d.velocity * 0.2
      if (projected > MEDIUM_TOP + 110) {
        onClose()
        return
      }
      const target = Math.abs(projected - LARGE_TOP) < Math.abs(projected - MEDIUM_TOP) ? LARGE_TOP : MEDIUM_TOP
      void animate(top, target, { ...SHEET_SPRING, velocity: d.velocity })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  if (!mounted) return null

  const pick = (country: Country) => {
    onSelect(country)
    onClose()
  }
  const others = ALL_COUNTRIES.filter((c) => !SUGGESTED_COUNTRIES.includes(c)).sort((a, b) => (countryName(a, lang) < countryName(b, lang) ? -1 : 1))
  const needle = query.trim().replace(/\+/g, '').toLowerCase()
  const results = ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(needle) || c.nameAR.includes(needle) || c.dialCode.startsWith(needle) || c.id.toLowerCase() === needle)
  const keyboardUp = searchFocused && keyboard != null
  const title = t(lang, 'Country code', 'رمز الدولة')

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: open ? 'auto' : 'none' }}>
      <style>{SEARCH_CSS}</style>
      <motion.div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#000', opacity: dim }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          top,
          background: GROUPED_BACKGROUND,
          borderTopLeftRadius: 38,
          borderTopRightRadius: 38,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: SF,
          color: LABEL,
          boxShadow: '0 -1px 12px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Drag indicator and the inline navigation bar: the sheet's handle. */}
        <div onPointerDown={onPointerDown} style={{ flex: 'none', touchAction: 'none', paddingTop: 5 }}>
          <div aria-hidden style={{ width: 36, height: 5, borderRadius: 2.5, background: 'rgba(60, 60, 67, 0.3)', margin: '0 auto' }} />
          <div style={{ height: 44, marginTop: 6, padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
            <CloseButton label={t(lang, 'Close', 'إغلاق')} onClick={onClose} />
            <h2 style={{ margin: 0, fontSize: 17, lineHeight: '22px', fontWeight: 600, letterSpacing: -0.43, whiteSpace: 'nowrap' }}>{title}</h2>
            <span />
          </div>
        </div>

        {/* .searchable(placement: .navigationBarDrawer(displayMode: .always)) */}
        <div style={{ flex: 'none', padding: '10px 16px 6px' }}>
          <div
            onClick={() => setSearchFocused(true)}
            style={{ height: 36, borderRadius: 18, background: FILL, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 10px', cursor: 'text' }}
          >
            <MagnifierIcon size={17} color={SECONDARY_LABEL} />
            <input
              ref={searchRef}
              className="country-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              {...searchFocus}
              placeholder={t(lang, 'Country or code', 'الدولة أو الرمز')}
              aria-label={t(lang, 'Country or code', 'الدولة أو الرمز')}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              style={{ flex: 1, minWidth: 0, height: '100%', fontFamily: SF, fontSize: 17, letterSpacing: -0.43, color: LABEL, textAlign: 'start' }}
            />
            {query && (
              <button
                type="button"
                aria-label={t(lang, 'Clear text', 'مسح النص')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery('')}
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
              >
                <ClearIcon />
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `0 16px ${(keyboardUp ? keyboardHeight : SAFE_BOTTOM) + 16}px`, overscrollBehavior: 'contain' }}>
          {query === '' ? (
            <>
              <Section title={t(lang, 'Suggested', 'مقترحة')}>
                {SUGGESTED_COUNTRIES.map((c, i) => (
                  <Row key={c.id} country={c} lang={lang} isSelected={c.id === selected.id} isLast={i === SUGGESTED_COUNTRIES.length - 1} onPick={pick} />
                ))}
              </Section>
              <Section title={t(lang, 'All countries', 'كل الدول')}>
                {others.map((c, i) => (
                  <Row key={c.id} country={c} lang={lang} isSelected={c.id === selected.id} isLast={i === others.length - 1} onPick={pick} />
                ))}
              </Section>
            </>
          ) : results.length === 0 ? (
            <NoResults query={query} lang={lang} />
          ) : (
            <Section>
              {results.map((c, i) => (
                <Row key={c.id} country={c} lang={lang} isSelected={c.id === selected.id} isLast={i === results.length - 1} onPick={pick} />
              ))}
            </Section>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// MARK: - List pieces

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section style={{ paddingTop: title ? 0 : 14 }}>
      {title && <h3 style={{ margin: 0, padding: '18px 16px 7px', fontSize: 13, lineHeight: '18px', fontWeight: 400, letterSpacing: -0.08, textTransform: 'uppercase', color: SECONDARY_LABEL }}>{title}</h3>}
      <div role="listbox" aria-label={title} style={{ background: '#fff', borderRadius: 26, overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  )
}

function Row({ country, lang, isSelected, isLast, onPick }: { country: Country; lang: Lang; isSelected: boolean; isLast: boolean; onPick: (c: Country) => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => onPick(country)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 52,
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        textAlign: 'start',
        fontFamily: SF,
        background: pressed ? ROW_PRESSED : '#fff',
        transition: pressed ? 'none' : 'background-color 0.3s',
      }}
    >
      <span aria-hidden style={{ fontSize: 26, lineHeight: '32px', flex: 'none' }}>
        {flagEmoji(country)}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 17, lineHeight: '22px', letterSpacing: -0.43, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{countryName(country, lang)}</span>
      <span style={{ flex: 'none', fontSize: 17, lineHeight: '22px', letterSpacing: -0.43, color: INK2, fontVariantNumeric: 'tabular-nums' }}>{ltr(`+${country.dialCode}`)}</span>
      {isSelected && <CheckIcon />}
      {!isLast && <span aria-hidden style={{ position: 'absolute', bottom: 0, insetInlineStart: 16, insetInlineEnd: 0, height: 0.5, background: SEPARATOR }} />}
    </button>
  )
}

/** ContentUnavailableView.search(text:) */
function NoResults({ query, lang }: { query: string; lang: Lang }) {
  return (
    <div style={{ padding: '56px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
      <MagnifierIcon size={48} color="#AEAEB2" strokeWidth={1.6} />
      <div style={{ marginTop: 8, fontSize: 22, lineHeight: '28px', fontWeight: 700, letterSpacing: -0.26, color: LABEL }}>
        {t(lang, `No Results for “${query}”`, `لا توجد نتائج لـ "${query}"`)}
      </div>
      <div style={{ fontSize: 15, lineHeight: '20px', letterSpacing: -0.23, color: SECONDARY_LABEL }}>{t(lang, 'Check the spelling or try a new search.', 'تحقق من الإملاء أو حاول إجراء بحث جديد.')}</div>
    </div>
  )
}

/** Button(role: .close): the round glass close button in the sheet's toolbar. */
function CloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      whileTap={{ scale: 0.92 }}
      transition={{ ...swiftSpring(0.25, 0) }}
      style={{
        justifySelf: 'start',
        width: 44,
        height: 44,
        borderRadius: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.82)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08), inset 0 0 0 0.5px rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke={LABEL} strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M2 2l11 11M13 2L2 13" />
      </svg>
    </motion.button>
  )
}

function MagnifierIcon({ size, color, strokeWidth = 2 }: { size: number; color: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" aria-hidden style={{ flex: 'none' }}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden>
      <circle cx="8.5" cy="8.5" r="8.5" fill="rgba(60, 60, 67, 0.3)" />
      <path d="M5.8 5.8l5.4 5.4M11.2 5.8l-5.4 5.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** SF Symbol "checkmark", 15pt semibold, in Palette.accent. */
function CheckIcon() {
  return (
    <svg width="16" height="15" viewBox="0 0 16 15" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
      <path d="M2 8.2l4 4.3L14 2.5" />
    </svg>
  )
}
