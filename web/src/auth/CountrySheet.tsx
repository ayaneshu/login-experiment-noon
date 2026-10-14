import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PanInfo } from 'motion/react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useLang, useScreen } from '../app/context'
import { field, spring, swiftSpring } from '../design/motion'
import { colour, palette, type } from '../design/tokens'
import type { Country } from '../model/country'
import { ALL_COUNTRIES, countryName, countryWithID } from '../model/country'
import { ltr, t } from '../model/lang'
import { CountryFlag } from '../ui/Controls'
import { Icon } from '../ui/Icon'
import { useFieldFocus } from './shared'

/** The design's order: the Gulf and Egypt first. */
const FEATURED = ['SA', 'AE', 'EG', 'KW', 'QA', 'OM', 'BH']
/** How far below its resting spot the sheet starts and leaves to. */
const HIDDEN_OFFSET = 560
const DIM = 0.6
/** Swift waits this long for the exit before reporting back. */
const DISMISS_DELAY = 320
const SEARCH_CSS = `.noon-country-search::placeholder{color:var(--text-tertiary);opacity:1}`

/** Country code sheet (Figma 1132:282645): a floating sheet with a notch, a search field and the
 *  markets with their flags and dial codes. Picking one closes it; the number field keeps focus
 *  (the screen puts it back in `onDone`). Drag it down or tap outside to dismiss. */
export function CountrySheet({ selected, onDone }: { selected: Country; onDone: (c: Country | null) => void }) {
  const lang = useLang()
  const { isStatic, scale, keyboard, keyboardHeight } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const searchFocus = useFieldFocus(searchRef, searching, setSearching, 'text')

  // `presented` animates 0 → 1; `drag` follows the finger. The sheet sits at the drag offset once
  // presented and HIDDEN_OFFSET below when not; the dim fades over 400pt of drag.
  const presented = useMotionValue(isStatic ? 1 : 0)
  const drag = useMotionValue(0)
  const y = useTransform([presented, drag], ([p, d]: number[]) => Math.max(d, 0) * p + HIDDEN_OFFSET * (1 - p))
  const dim = useTransform([presented, drag], ([p, d]: number[]) => p * DIM * (1 - Math.min(Math.max(d, 0) / 400, 1)))

  const dismissed = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const motionPrefs = useRef(reduceMotion)
  motionPrefs.current = reduceMotion

  useEffect(() => {
    if (isStatic) return
    const a = animate(presented, 1, reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.5, 0))
    return () => a.stop()
    // Once, on appear.
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const dismiss = useCallback(
    (country: Country | null) => {
      if (dismissed.current) return
      dismissed.current = true
      setSearching(false)
      animate(presented, 0, motionPrefs.current ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.4, 0))
      timer.current = window.setTimeout(() => onDoneRef.current(country), DISMISS_DELAY)
    },
    [presented],
  )

  // MARK: Dragging

  const dragging = useRef(false)
  /** The gesture started in the scrolling list, which scrolls instead. */
  const panBlocked = useRef(false)
  const suppressClick = useRef(false)

  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (dismissed.current || panBlocked.current) return
    if (!dragging.current) {
      // SwiftUI's DragGesture starts after 10pt.
      if (Math.hypot(info.offset.x, info.offset.y) / scale < 10) return
      dragging.current = true
      suppressClick.current = true
      drag.stop()
    }
    drag.set(info.offset.y / scale)
  }
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    if (!dragging.current) return
    dragging.current = false
    if (dismissed.current) return
    const dy = info.offset.y / scale
    // UIKit's projection for a normal deceleration rate: where the flick would come to rest.
    const predicted = dy + (info.velocity.y / scale) * 0.499
    if (dy > 110 || predicted > 260) dismiss(null)
    else animate(drag, 0, swiftSpring(0.4, 0.2))
  }

  // MARK: Results

  const trimmed = query.trim().toLowerCase()
  const digits = trimmed.replace(/\D/g, '')
  const countries: Country[] = !trimmed
    ? FEATURED.map(countryWithID).filter((c): c is Country => c != null)
    : ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(trimmed) || c.nameAR.includes(trimmed) || (digits !== '' && c.dialCode.startsWith(digits)))

  // Searching: the sheet rides up on the keyboard.
  const lift = searching && keyboard != null ? keyboardHeight : 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'Country code', 'رمز الدولة')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismiss(null)
      }}
      // Taps on the sheet never take focus from the search field, so the keyboard (and the sheet
      // riding on it) stays put until a row is picked.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <style>{SEARCH_CSS}</style>
      <motion.div aria-hidden onClick={() => dismiss(null)} style={{ position: 'absolute', inset: 0, background: '#000', opacity: dim }} />
      <motion.div
        initial={false}
        animate={{ y: -lift }}
        transition={isStatic ? { duration: 0 } : swiftSpring(0.42, 0)}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
      >
        <motion.div
          onPan={onPan}
          onPanEnd={onPanEnd}
          onPointerDownCapture={(e) => {
            suppressClick.current = false
            panBlocked.current = e.target instanceof Element && e.target.closest('[data-sheet-scroll]') != null
          }}
          onClickCapture={(e) => {
            // A drag that ends over a row isn't a tap.
            if (suppressClick.current) {
              suppressClick.current = false
              e.stopPropagation()
              e.preventDefault()
            }
          }}
          style={{ y, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 4px', pointerEvents: 'auto', touchAction: 'none' }}
        >
          {/* The notch: a 36pt handle in a 24pt row above the card. */}
          <div aria-hidden style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255, 255, 255, 0.7)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, borderRadius: 16, background: palette.grey['100'] }}>
            {/* M-SearchBar H48 */}
            <div
              onClick={() => setSearching(true)}
              style={{
                height: 48,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                background: colour.surface.primary,
                boxShadow: `inset 0 0 0 1px ${colour.border.subtle}`,
                cursor: 'text',
              }}
            >
              <Icon name="system-search" size={24} color={colour.text.tertiary} />
              <input
                ref={searchRef}
                {...searchFocus}
                className="noon-country-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(lang, 'Search by country', 'ابحث عن دولة')}
                aria-label={t(lang, 'Search by country', 'ابحث عن دولة')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="search"
                style={{ flex: 1, minWidth: 0, height: 24, ...type.b14Medium, color: colour.text.primary, caretColor: colour.surface.actionBold, textAlign: 'start' }}
              />
            </div>

            <Results>
              {countries.map((country, index) => (
                <CountryRow key={country.id} country={country} isFirst={index === 0} isSelected={country.id === selected.id} onPick={() => dismiss(country)} />
              ))}
              {countries.length === 0 && (
                <div style={{ ...type.b14Medium, color: colour.text.muted, padding: '12px 0', textAlign: 'center' }}>
                  {t(lang, `No country matches “${query}”`, `لا توجد دولة تطابق “${query}”`)}
                </div>
              )}
            </Results>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

/** The white results card: as tall as its rows up to 300pt, then it scrolls. Its height follows the
 *  rows as the search narrows them (Motion.snappy). */
function Results({ children }: { children: ReactNode }) {
  const { isStatic } = useScreen()
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    const measure = () => setContentHeight(parseFloat(getComputedStyle(el).height) || el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const height = contentHeight == null ? undefined : Math.min(contentHeight, 300)
  return (
    <motion.div
      data-sheet-scroll
      initial={false}
      animate={height == null ? {} : { height }}
      transition={isStatic ? { duration: 0 } : spring.snappy}
      style={{
        maxHeight: 300,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        scrollbarWidth: 'none',
        touchAction: 'pan-y',
        borderRadius: 16,
        background: colour.surface.primary,
      }}
    >
      <div ref={innerRef} role="listbox" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 8px' }}>
        {children}
      </div>
    </motion.div>
  )
}

function CountryRow({ country, isFirst, isSelected, onPick }: { country: Country; isFirst: boolean; isSelected: boolean; onPick: () => void }) {
  const lang = useLang()
  const name = countryName(country, lang)
  return (
    <>
      {!isFirst && <div aria-hidden style={{ height: 1, flex: 'none', background: colour.border.primary }} />}
      {/* RowPressStyle: the row washes to the secondary surface while it's held; no scale. */}
      <motion.button
        type="button"
        role="option"
        aria-selected={isSelected}
        aria-label={`${name}, +${country.dialCode}`}
        onClick={onPick}
        // `animate` too: under an AnimatePresence with initial={false}, Motion starts from `animate`.
        initial="rest"
        animate="rest"
        whileTap="pressed"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, minHeight: 28, padding: '4px 8px', width: '100%', textAlign: 'start', flex: 'none' }}
      >
        <motion.span
          aria-hidden
          variants={{ rest: { opacity: 0 }, pressed: { opacity: 1 } }}
          transition={field.standard(field.duration.xs)}
          style={{ position: 'absolute', inset: 0, background: colour.surface.secondary }}
        />
        <span style={{ position: 'relative', display: 'flex', flex: 'none' }}>
          <CountryFlag country={country} width={28} height={20} />
        </span>
        <span style={{ position: 'relative', ...type.b14Medium, letterSpacing: -0.14, color: palette.grey['800'], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span>
        <span style={{ flex: 1, minWidth: 8 }} />
        {isSelected && <Icon name="system-check-circle-filled" size={16} color={colour.text.action} style={{ position: 'relative' }} />}
        <span style={{ position: 'relative', ...type.b14Medium, color: colour.text.muted, whiteSpace: 'nowrap', flex: 'none' }}>{ltr(`+${country.dialCode}`)}</span>
      </motion.button>
    </>
  )
}

