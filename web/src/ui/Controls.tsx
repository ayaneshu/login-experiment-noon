import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'motion/react'
import { field, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { Country } from '../model/country'
import { SUGGESTED_COUNTRIES, countryName, flagEmoji } from '../model/country'
import type { Lang } from '../model/lang'
import { t } from '../model/lang'
import { Art, ArtImage, Icon } from './Icon'
import type { IconName } from './Icon'
import { Pressable } from './Pressable'

// MARK: - Header tone

export type HeaderToneName = 'blue' | 'success' | 'error' | 'welcome'

/** The colour moods of the sign-in header: top and bottom of its gradient. */
export const HEADER_TONES: Record<HeaderToneName, { top: string; bottom: string; isLight: boolean }> = {
  blue: { top: 'var(--header-blue-top)', bottom: 'var(--header-blue-bottom)', isLight: false },
  success: { top: colour.surface.successBold, bottom: colour.surface.successExtrabold, isLight: false },
  error: { top: colour.surface.errorBold, bottom: colour.surface.errorExtrabold, isLight: false },
  welcome: { top: colour.surface.brandPrimary, bottom: colour.surface.yellowBold, isLight: true },
}

/** Figma: the tone holds to 16.6% of the screen, then deepens until halfway down. */
export const headerGradient = (tone: HeaderToneName) =>
  `linear-gradient(180deg, ${HEADER_TONES[tone].top} 16.6%, ${HEADER_TONES[tone].bottom} 50%)`

// MARK: - Header controls

/** Language Toggle-Switch: a white handle slides to the chosen language before the screen
 *  re-renders in it. */
export function LanguageToggle({ current, onLight = false, onToggle }: { current: Lang; onLight?: boolean; onToggle: () => void }) {
  const [shown, setShown] = useState<Lang>(current)
  const enRef = useRef<HTMLSpanElement | null>(null)
  const arRef = useRef<HTMLSpanElement | null>(null)
  const [frames, setFrames] = useState<Record<Lang, { left: number; width: number }> | null>(null)
  useEffect(() => setShown(current), [current])
  // offsetLeft/offsetWidth are layout pixels, so the handle stays exact inside the scaled phone
  // (shared-layout animations would measure in viewport pixels and jump).
  useLayoutEffect(() => {
    const en = enRef.current
    const ar = arRef.current
    if (en && ar) setFrames({ en: { left: en.offsetLeft, width: en.offsetWidth }, ar: { left: ar.offsetLeft, width: ar.offsetWidth } })
  }, [shown])
  const segment = (lang: Lang, title: string) => {
    const isOn = shown === lang
    const isArabic = lang === 'ar'
    return (
      <span
        ref={isArabic ? arRef : enRef}
        style={{
          position: 'relative',
          padding: '0 10px',
          height: 30,
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--font-noon)',
          fontWeight: isOn ? 600 : 500,
          fontSize: isArabic ? 14 : 12,
          lineHeight: '16px',
          color: isOn ? colour.text.primary : onLight ? colour.text.primary : colour.text.onSurfaceBold,
          transition: 'color 0.2s',
        }}
      >
        {title}
      </span>
    )
  }
  return (
    <Pressable
      onClick={() => {
        setShown(shown === 'en' ? 'ar' : 'en')
        setTimeout(onToggle, 200)
      }}
      aria-label={current === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      style={{ position: 'relative', display: 'flex', padding: 4, borderRadius: 999, background: colour.surface.overlaySubtle, direction: 'ltr' }}
    >
      {frames && (
        <motion.span
          aria-hidden
          initial={false}
          animate={{ x: frames[shown].left, width: frames[shown].width }}
          transition={field.snappySpring}
          style={{ position: 'absolute', top: 4, left: 0, height: 30, borderRadius: 16, background: colour.surface.primary }}
        />
      )}
      <span style={{ position: 'relative', display: 'flex' }}>
        {segment('en', 'English')}
        {segment('ar', 'العربية')}
      </span>
    </Pressable>
  )
}

/** UAE flag from the Figma asset; other markets use the emoji flag. */
export function CountryFlag({ country, width = 24, height = 18 }: { country: Country; width?: number; height?: number }) {
  if (country.id === 'AE') return <ArtImage name={Art.flagAE} width={width} height={height} style={{ borderRadius: 2 }} />
  return (
    <span aria-hidden style={{ width, height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: height + 2, lineHeight: 1, flex: 'none' }}>
      {flagEmoji(country)}
    </span>
  )
}

/** Market pill: flag and country code ("AE") on the translucent header chip, with a small menu. */
export function MarketPill({ market, foreground, lang, onSelect }: { market: Country; foreground: string; lang: Lang; onSelect: (c: Country) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Pressable
        onClick={() => setOpen(!open)}
        aria-label={t(lang, `Shopping in ${market.name}`, `التسوّق في ${market.nameAR}`)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: foreground, padding: '0 8px 0 12px', height: 38, borderRadius: 999, background: colour.surface.overlaySubtle, transition: 'color 0.2s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <CountryFlag country={market} />
        <span style={{ ...type.b13SemiBold, whiteSpace: 'nowrap' }}>{market.id}</span>
      </Pressable>
      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.92, filter: 'blur(3px)' }}
              transition={spring.quick}
              style={{ position: 'absolute', top: 44, insetInlineStart: 0, zIndex: 41, transformOrigin: 'top left', background: 'rgba(250,250,252,0.96)', backdropFilter: 'blur(20px)', borderRadius: 14, boxShadow: '0 12px 32px rgba(16,22,40,0.2)', padding: 6, minWidth: 230 }}
            >
              {SUGGESTED_COUNTRIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpen(false)
                    onSelect(c)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 10px', borderRadius: 10, ...type.b14Medium, color: colour.text.primary, textAlign: 'start' }}
                >
                  <span style={{ width: 16, color: colour.text.action }}>{c.id === market.id ? '✓' : ''}</span>
                  <span>{flagEmoji(c)}</span>
                  <span>{countryName(c, lang)}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Round translucent header button (Back; Close with a cross). */
export function HeaderCircleButton({ icon, label, onClick, size = 38, iconSize = 20, foreground = colour.text.onSurfaceBold, flipsRTL = true }: { icon: IconName; label: string; onClick: () => void; size?: number; iconSize?: number; foreground?: string; flipsRTL?: boolean }) {
  return (
    <Pressable
      scale={0.94}
      onClick={onClick}
      aria-label={label}
      style={{ width: Math.max(44, size), height: Math.max(44, size), display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999 }}
    >
      <span style={{ width: size, height: size, borderRadius: 999, background: colour.surface.overlaySubtle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: foreground }}>
        <Icon name={icon} size={iconSize} flipsRTL={flipsRTL} />
      </span>
    </Pressable>
  )
}

/** M-IconButton (Ghost, H40): closes sign-in opened from checkout or a link. */
export function HeaderCloseButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <HeaderCircleButton icon="system-cross" label={label} onClick={onClick} size={40} flipsRTL={false} />
}

// MARK: - Avatar

export function FieldAvatar({ initial, size = 40, variant = 'action' }: { initial: string | null; size?: number; variant?: 'action' | 'neutral' }) {
  const isAction = variant === 'action'
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isAction ? colour.surface.actionSubtle : colour.surface.tertiary,
        color: isAction ? colour.text.action : colour.text.primary,
      }}
    >
      {initial ? <span style={size >= 48 ? type.h24Bold : type.b14SemiBold}>{initial}</span> : <Icon name="bottomnav-profile" size={size * 0.5} color={isAction ? colour.text.action : colour.text.tertiary} />}
    </span>
  )
}

// MARK: - Inputs

const CHROME_EASE = '0.16s cubic-bezier(0.32,0.72,0,1)'

/** M-InputText chrome: 56pt, radius 12. At rest white with a light border; focused, the secondary
 *  surface with a dark border; in error, the secondary surface with a red border and a soft 2pt
 *  outer ring.
 *  - `success` (separate flow, account found): a green border, the ring and a white-to-grey fill.
 *  - `quietFocus` (separate flow): typing keeps the light border; only error and success recolour it. */
export function InputChrome({
  focused,
  error = false,
  success = false,
  quietFocus = false,
  children,
  style,
  onClick,
}: {
  focused: boolean
  error?: boolean
  success?: boolean
  quietFocus?: boolean
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  const active = focused || error || success
  const border = error ? colour.surface.errorBold : success ? colour.border.successBold : focused && !quietFocus ? colour.border.extrabold : colour.border.primary
  // The ring sits 2pt outside the field (radius 14), fading in rather than growing.
  const ring = success || error ? colour.surface.muted : 'transparent'
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        isolation: 'isolate',
        height: 56,
        borderRadius: 12,
        background: active ? colour.surface.secondary : colour.surface.primary,
        boxShadow: `inset 0 0 0 1px ${border}, 0 0 0 2px ${ring}`,
        transition: `background-color ${CHROME_EASE}, box-shadow ${CHROME_EASE}`,
        display: 'flex',
        alignItems: 'center',
        ...style,
      }}
    >
      {/* Success fill: white at the top easing into the secondary surface. Inset by the border,
          which is painted with the background and would otherwise sit under it. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 1,
          zIndex: -1,
          borderRadius: 11,
          background: `linear-gradient(180deg, ${colour.surface.primary}, ${colour.surface.secondary})`,
          opacity: success ? 1 : 0,
          transition: `opacity ${CHROME_EASE}`,
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  )
}

export type HelperTone = 'neutral' | 'action' | 'success' | 'warning' | 'error'
const HELPER_COLOUR: Record<HelperTone, string> = {
  neutral: colour.text.muted,
  action: colour.text.action,
  success: colour.text.success,
  warning: colour.text.warning,
  error: colour.text.error,
}

/** Helper line under an input: B13 Medium, 8pt inset. */
export function HelperText({ text, tone = 'neutral', style }: { text: ReactNode; tone?: HelperTone; style?: CSSProperties }) {
  return <div style={{ ...type.b13Medium, color: HELPER_COLOUR[tone], padding: '0 8px', ...style }}>{text}</div>
}

/** Blinking insertion caret in the action colour. */
export function Caret({ height = 20 }: { height?: number }) {
  return <span aria-hidden style={{ display: 'inline-block', width: 2, height, borderRadius: 1, background: colour.surface.actionBold, animation: 'caret 1.06s step-end infinite', flex: 'none' }} />
}

/** A short, decaying side-to-side shake each time `trigger` grows: "that didn't work". */
export function Shake({ trigger, children, style }: { trigger: number; children: ReactNode; style?: CSSProperties }) {
  const controls = useAnimationControls()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void controls.start({ x: [0, -10, 8, -5, 3, 0], transition: { duration: 0.39, times: [0, 0.18, 0.38, 0.59, 0.79, 1], ease: 'easeInOut' } })
  }, [trigger, controls])
  return (
    <motion.div animate={controls} style={style}>
      {children}
    </motion.div>
  )
}
