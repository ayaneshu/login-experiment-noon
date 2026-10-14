import type { ChangeEvent, CSSProperties, ReactNode, Ref } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { HTMLMotionProps, Transition } from 'motion/react'
import { animate, AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion } from 'motion/react'
import type { KeyboardKind } from '../app/context'
import { useFlow, useLang, useScreen } from '../app/context'
import { iconSwap, materialize, spring, swiftSpring } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { AuthFlow } from '../model/authFlow'
import type { Country } from '../model/country'
import { maxDigits } from '../model/country'
import { PhoneFormatter } from '../model/identifier'
import { ltr, t } from '../model/lang'
import { CountryFlag, InputChrome } from '../ui/Controls'
import { Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Spinner } from '../ui/Spinner'
import { useFieldFocus } from './shared'

// MARK: - Layout-pixel helpers

/** A motion.div that glides to wherever a re-render moves it (the web twin of SwiftUI animating a
 *  stack's layout). Positions are read as offsetLeft/offsetTop, which are layout pixels, so the slide
 *  is exact inside the scaled phone (Motion's `layout` prop measures viewport pixels and jumps).
 *  Works as a direct AnimatePresence child, including `mode="popLayout"`. */
export function Slide({ ref, style, slide = spring.smooth, ...rest }: HTMLMotionProps<'div'> & { ref?: Ref<HTMLDivElement>; slide?: Transition }) {
  const own = useRef<HTMLDivElement | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const last = useRef<{ left: number; top: number } | null>(null)
  const { isStatic } = useScreen()
  useLayoutEffect(() => {
    const el = own.current
    if (!el) return
    const next = { left: el.offsetLeft, top: el.offsetTop }
    const previous = last.current
    last.current = next
    if (!previous || isStatic) return
    const dx = previous.left - next.left
    const dy = previous.top - next.top
    if (dx) {
      x.set(x.get() + dx)
      void animate(x, 0, slide)
    }
    if (dy) {
      y.set(y.get() + dy)
      void animate(y, 0, slide)
    }
  })
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      own.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )
  // Positioned, so nested Slides measure against this one and never double up its movement.
  return <motion.div ref={setRef} style={{ position: 'relative', ...style, x, y }} {...rest} />
}

/** Fractional width in layout pixels (unaffected by the phone's CSS scale). */
const layoutWidth = (el: HTMLElement) => parseFloat(getComputedStyle(el).width) || el.offsetWidth

// MARK: - Field

/** The identifier row: the country code chip (phones) beside the M-InputText field, which holds
 *  the text field, the ghost completion and the trailing status. */
export function IdentifierField({ focused, setFocused, onCountryTap }: { focused: boolean; setFocused: (v: boolean) => void; onCountryTap: () => void }) {
  const flow = useFlow()
  const lang = useLang()
  /** The smart field names both; the toggle variant names what's selected; Sign up asks for email. */
  const placeholder =
    flow.isSeparate && flow.step === 'signup'
      ? t(lang, 'Email address', 'البريد الإلكتروني')
      : flow.variant !== 'toggle'
        ? t(lang, 'Email or phone number', 'البريد الإلكتروني أو رقم الهاتف')
        : flow.method === 'phone'
          ? t(lang, 'Mobile number', 'رقم الجوال')
          : t(lang, 'Email address', 'البريد الإلكتروني')
  /** Separate flow: the account was found, so the field turns green. */
  const isFound = flow.isSeparate && !flow.showsInputError && flow.lookup.type === 'returning'

  return (
    <div style={{ display: 'flex', height: 56 }}>
      <CountrySlot show={flow.showsCountryChip}>
        <CountryChip country={flow.country} onTap={onCountryTap} />
      </CountrySlot>
      <InputChrome
        focused={focused}
        error={flow.showsInputError || flow.signupPhoneError}
        success={isFound}
        quietFocus={flow.isSeparate}
        onClick={() => setFocused(true)}
        style={{ flex: 1, minWidth: 0, padding: '0 16px', gap: 8, cursor: 'text' }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 0, height: 26, display: 'flex', alignItems: 'center' }}>
          <FieldGhost />
          <IdentifierInput focused={focused} setFocused={setFocused} placeholder={placeholder} />
        </div>
        <TrailingAccessory focused={focused} />
      </InputChrome>
    </div>
  )
}

/** The chip slides in from the leading edge, pushing the field over, and leaves the same way. */
function CountrySlot({ show, children }: { show: boolean; children: ReactNode }) {
  const lang = useLang()
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [present, setPresent] = useState(show)
  if (show && !present) setPresent(true)
  // Shown from the start: no entrance. Every later arrival slides in.
  const [instantEntry, setInstantEntry] = useState(show)
  const lastChildren = useRef(children)
  if (show) lastChildren.current = children
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!present || !el) return
    setWidth(layoutWidth(el))
    const observer = new ResizeObserver(() => setWidth(layoutWidth(el)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [present])

  if (!present) return null
  const transition: Transition = reduceMotion ? { duration: 0.2, ease: 'easeOut' } : { ...swiftSpring(0.45, 0) }
  const away = lang === 'ar' ? '100%' : '-100%'
  const instant = isStatic || instantEntry
  return (
    <motion.div
      initial={instant ? false : { width: 0 }}
      animate={width == null ? {} : { width: show ? width : 0 }}
      transition={isStatic ? { duration: 0 } : transition}
      onAnimationComplete={() => {
        if (show) return
        setPresent(false)
        setInstantEntry(false)
      }}
      style={{ display: 'flex', flex: 'none', height: '100%' }}
    >
      <motion.div
        ref={innerRef}
        initial={instant ? false : reduceMotion ? { opacity: 0 } : { ...materialize({ opacity: 0, blur: 4 }), x: away }}
        animate={show ? (reduceMotion ? { opacity: 1 } : materialize({})) : reduceMotion ? { opacity: 0 } : { ...materialize({ opacity: 0, blur: 2 }), x: away }}
        transition={isStatic ? { duration: 0 } : transition}
        style={{ display: 'flex', flex: 'none', height: '100%', paddingInlineEnd: 8 }}
      >
        {show ? children : lastChildren.current}
      </motion.div>
    </motion.div>
  )
}

/** Country Code Chip: flag, dial code and caret on a tertiary tile the height of the field. */
function CountryChip({ country, onTap }: { country: Country; onTap: () => void }) {
  const lang = useLang()
  return (
    <Pressable
      scale={0.96}
      onClick={onTap}
      aria-label={t(lang, `Country code, ${country.name}, +${country.dialCode}`, `رمز الدولة، ${country.nameAR}، +${country.dialCode}`)}
      style={{
        direction: 'ltr',
        flex: 'none',
        height: '100%',
        padding: '0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 12,
        background: colour.surface.secondary,
        boxShadow: `inset 0 0 0 1px ${colour.border.primary}`,
      }}
    >
      <CountryFlag country={country} width={20} height={14} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ display: 'grid', overflow: 'hidden' }}>
          <AnimatePresence initial={false}>
            <motion.span
              key={country.dialCode}
              initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
              transition={spring.snappy}
              style={{ ...type.h18Bold, color: colour.text.primary, whiteSpace: 'nowrap', gridArea: '1 / 1' }}
            >
              {ltr(`+${country.dialCode}`)}
            </motion.span>
          </AnimatePresence>
        </span>
        <Icon name="system-caret-down" size={16} color={colour.text.primary} />
      </span>
    </Pressable>
  )
}

// MARK: - Text field

const PLACEHOLDER_CSS = `.noon-identifier-input::placeholder{color:var(--text-muted);opacity:1;font-family:var(--font-noon);font-weight:600;font-size:16px;letter-spacing:-0.15px}`

const isSpace = (ch: string) => /\s/.test(ch)

/** The identifier's real <input>. Formatting happens synchronously on every change, so digits group
 *  as you type, the caret stays after the same characters, and pasting can never race a re-format
 *  (IdentifierTextField's Coordinator). */
function IdentifierInput({ focused, setFocused, placeholder }: { focused: boolean; setFocused: (v: boolean) => void; placeholder: string }) {
  const flow = useFlow()
  const lang = useLang()
  const ref = useRef<HTMLInputElement | null>(null)
  /** What the field showed before the edit being handled. */
  const shown = useRef(flow.input)
  /** `.phone` for the number pad, `.email` for the email keyboard; the smart field uses email. In the
   *  separate flow, Log in switches to the number pad once it's clearly a number; Sign up takes
   *  email only. */
  const kind: KeyboardKind = flow.isSeparate
    ? flow.step === 'login' && flow.kind === 'phone'
      ? 'numpad'
      : 'email'
    : flow.variant === 'toggle' && flow.method === 'phone'
      ? 'numpad'
      : 'email'
  const focusProps = useFieldFocus(ref, focused, setFocused, kind)

  // The flow rewrote what was typed (cleared, picked a domain, switched tabs, changed country):
  // show it with the caret at the end.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.value === flow.input) return
    el.value = flow.input
    shown.current = flow.input
    if (document.activeElement === el) el.setSelectionRange(flow.input.length, flow.input.length)
  }, [flow.input, flow.inputRevision])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const previous = shown.current
    let proposed = el.value
    let caret = el.selectionStart ?? proposed.length

    // Backspacing over a group space deletes the digit before it instead.
    const removed = previous.length - proposed.length
    if (removed > 0 && caret > 0 && previous.slice(0, caret) === proposed.slice(0, caret) && previous.slice(caret + removed) === proposed.slice(caret)) {
      if ([...previous.slice(caret, caret + removed)].every(isSpace)) {
        proposed = previous.slice(0, caret - 1) + previous.slice(caret + removed)
        caret -= 1
      }
    }

    const significantBeforeCaret = [...proposed.slice(0, Math.min(caret, proposed.length))].filter((ch) => !isSpace(ch)).length
    flow.setInput(proposed)
    const formatted = flow.input
    el.value = formatted
    shown.current = formatted

    // Put the caret back after the same number of meaningful characters.
    let seen = 0
    let offset = 0
    for (const ch of formatted) {
      if (seen === significantBeforeCaret) break
      if (!isSpace(ch)) seen += 1
      offset += ch.length
    }
    el.setSelectionRange(offset, offset)
  }

  return (
    <>
      <style>{PLACEHOLDER_CSS}</style>
      <input
        ref={ref}
        {...focusProps}
        onFocus={() => {
          focusProps.onFocus()
          // Focus arrives from a tap on the row (the field itself lets touches through at rest):
          // the caret goes to the end, as UITextField does.
          const el = ref.current
          if (el) el.setSelectionRange(el.value.length, el.value.length)
        }}
        className="noon-identifier-input"
        type="text"
        // Numbers and emails are left-to-right text, but in Arabic they sit on the same edge as the
        // label and the country code.
        dir="ltr"
        defaultValue={flow.input}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            flow.returnKeyPressed()
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={kind === 'numpad' ? 'tel' : 'username'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        style={{
          position: 'relative',
          width: '100%',
          height: 26,
          ...type.h18Bold,
          color: colour.text.primary,
          caretColor: colour.surface.actionBold,
          textAlign: lang === 'ar' ? 'right' : 'left',
          // At rest the field lets touches through, so a drag that starts on it moves the sheet;
          // the row's tap focuses it.
          pointerEvents: focused ? 'auto' : 'none',
        }}
      />
    </>
  )
}

// MARK: - Ghost

/** What's still to come: the remaining digits of a number ("050| 000 0000") or the likely rest of
 *  an email ("ajain@gm|ail.com", which Return accepts). Left-to-right layouts only. */
function ghostRemainder(flow: AuthFlow, rtl: boolean): string | null {
  if (rtl || !flow.input || flow.showsInputError) return null
  switch (flow.kind) {
    case 'phone': {
      if (flow.input.startsWith('+')) return null
      const digits = flow.phoneDigits
      if (!digits) return null
      const country = flow.country
      const max = maxDigits(country, PhoneFormatter.startsWithTrunkZero(digits, country))
      if (digits.length >= max) return null
      const full = PhoneFormatter.format(digits + '0'.repeat(max - digits.length), country)
      if (!full.startsWith(flow.input)) return null
      return full.slice(flow.input.length)
    }
    case 'email':
      return flow.ghostCompletion
    case 'unknown':
      return null
  }
}

/** The remainder in muted grey right after what's typed, with a soft shimmer running through it.
 *  The typed part is laid out invisibly so the ghost starts exactly where the caret is. */
function FieldGhost() {
  const flow = useFlow()
  const lang = useLang()
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const remainder = ghostRemainder(flow, lang === 'ar')
  const boxRef = useRef<HTMLDivElement | null>(null)
  const lineRef = useRef<HTMLSpanElement | null>(null)
  const [fits, setFits] = useState(true)
  const [lineWidth, setLineWidth] = useState(0)

  // Once the text outgrows the field it scrolls, and the ghost could no longer line up.
  useLayoutEffect(() => {
    const box = boxRef.current
    const line = lineRef.current
    if (!box || !line) return
    const width = line.offsetWidth
    const next = width <= box.clientWidth
    if (next !== fits) setFits(next)
    if (width !== lineWidth) setLineWidth(width)
  })

  if (remainder == null) return null
  const line = (color: string) => (
    <>
      <span style={{ color: 'transparent' }}>{flow.input}</span>
      <span style={{ color }}>{remainder}</span>
    </>
  )
  const text: CSSProperties = { ...type.h18Bold, whiteSpace: 'pre' }
  return (
    <div ref={boxRef} aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden', pointerEvents: 'none', visibility: fits ? 'visible' : 'hidden', direction: 'ltr' }}>
      <span ref={lineRef} style={{ ...text, position: 'relative', display: 'inline-block', flex: 'none' }}>
        {line(colour.text.muted)}
        {!isStatic && !reduceMotion && lineWidth > 0 && <Shimmer width={lineWidth}>{line(colour.surface.tertiary)}</Shimmer>}
      </span>
    </div>
  )
}

/** A light band sweeping left to right every 1.8s (FieldGhost's TimelineView). */
function Shimmer({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const band = Math.max(64, width * 0.45)
  useAnimationFrame(() => {
    const el = ref.current
    if (!el) return
    const cycle = 1.8
    const phase = ((Date.now() / 1000) % cycle) / cycle
    const position = `${-band + (width + band) * phase * 1.25}px 0px`
    el.style.maskPosition = position
    el.style.webkitMaskPosition = position
  })
  const mask = 'linear-gradient(90deg, transparent, #000, transparent)'
  return (
    <span
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        whiteSpace: 'pre',
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: `${band}px 100%`,
        WebkitMaskSize: `${band}px 100%`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: `${-band * 2}px 0px`,
        WebkitMaskPosition: `${-band * 2}px 0px`,
      }}
    >
      {children}
    </span>
  )
}

// MARK: - Trailing status

/** Checking spinner, a green tick once we know who you are, or the clear button while typing. */
function TrailingAccessory({ focused }: { focused: boolean }) {
  const flow = useFlow()
  const lang = useLang()
  // Checked and ready: we know whether it's a returning or a new customer. (The separate flow only
  // ticks a found account; a new email moves on to Sign up.)
  const resolved = flow.lookup.type === 'returning' || (flow.lookup.type === 'new' && !flow.isSeparate)
  const state = flow.lookup.type === 'checking' ? 'checking' : resolved && !flow.showsInputError ? 'resolved' : focused && flow.input ? 'clear' : null
  const swap: Transition = { ...swiftSpring(0.3, 0) }
  const centred: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div style={{ position: 'relative', width: 24, height: 24, flex: 'none' }}>
      <AnimatePresence initial={false}>
        {state === 'checking' && (
          <motion.div key="checking" {...iconSwap} transition={swap} style={centred}>
            <Spinner size={20} color={colour.surface.actionBold} />
          </motion.div>
        )}
        {state === 'resolved' && (
          <motion.div key="resolved" {...iconSwap} transition={swap} style={centred} role="img" aria-label={t(lang, 'Looks good', 'صحيح')}>
            <Icon name="system-check-circle-filled" size={24} color={colour.text.success} />
          </motion.div>
        )}
        {state === 'clear' && (
          <motion.div key="clear" {...iconSwap} transition={swap} style={centred}>
            <Pressable
              scale={0.9}
              onClick={(e) => {
                e.stopPropagation()
                flow.clearInput()
              }}
              aria-label={t(lang, 'Clear', 'مسح')}
              // 44pt target without growing the 24pt slot.
              style={{ width: 44, height: 44, margin: -10, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 10, background: colour.text.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="system-cross" size={12} color={colour.text.onSurfaceBold} />
              </span>
            </Pressable>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
