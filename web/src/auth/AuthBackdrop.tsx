import { useEffect, useRef, useState } from 'react'
import type { MotionValue, Transition } from 'motion/react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { SAFE_TOP, SCREEN, useApp, useFlow, useScreen } from '../app/context'
import { field, materialize, spring, swiftSpring } from '../design/motion'
import { colour, palette, type } from '../design/tokens'
import type { AuthEntry } from '../model/appModel'
import type { HeaderEvent } from '../model/authFlow'
import { t } from '../model/lang'
import type { HeaderToneName } from '../ui/Controls'
import { HEADER_TONES, HeaderCircleButton, HeaderCloseButton, LanguageToggle, MarketPill, headerGradient } from '../ui/Controls'
import { Art, ArtGlyph, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { HeaderWash } from './HeaderWash'
import { HERO_SIZE, HeroIllustration, materializeTo } from './HeroIllustration'
import { NoonOneHeader } from './NoonOneHeader'
import { AuthLayout } from './shared'
import type { AuthHeaderArt } from './shared'
import { WELCOME_CAROUSEL_CONTENT, WelcomeCarousel } from './WelcomeCarousel'

/** The chip on the right of the Log in / Sign up header: "+ New account" or "Log in". */
export interface HeaderFormChip {
  title: string
  showsPlus: boolean
  onClick: () => void
}

/** Everything behind and around the sheet: the header colour, its reactions, the hero artwork,
 *  the header controls and the white sheet surface itself. A port of AuthBackdrop.swift.
 *
 *  Reactions grow from whatever caused them (the field, the code, the button) and then recede to
 *  the resting blue: green when we know you, orange when something needs fixing, yellow with a
 *  wave for someone new. */
/** The top row ends 38 under the status bar; the carousel's content is centred in what's left. */
const TOP_ROW_BOTTOM = SAFE_TOP + 38
const carouselY = (restSheetTop: number) =>
  TOP_ROW_BOTTOM + (restSheetTop - TOP_ROW_BOTTOM - WELCOME_CAROUSEL_CONTENT.height) / 2 - WELCOME_CAROUSEL_CONTENT.top

export function AuthBackdrop({
  sheetTop,
  restSheetTop,
  showsIllustration,
  headerArt,
  entry,
  showsBack,
  showsGrabber,
  expanded,
  introShift,
  onBack,
  onSwitchLanguage,
  onTapHeader,
  onClose,
  onApplyNoonOne,
  onApplyCreditCard,
  staticTone,
  formChip,
  leadingClose = false,
}: {
  /** Top of the sheet in screen coordinates; animated by the screen (rest ↔ raised, drags, expand). */
  sheetTop: MotionValue<number>
  /** Where the sheet rests; the artwork stands on this line. */
  restSheetTop: number
  showsIllustration: boolean
  /** What stands above the sheet: noon's shopping scene, or the noon One card offer. */
  headerArt: AuthHeaderArt
  /** My Account shows the market and language; other entry points show noon and a close button. */
  entry: AuthEntry
  /** While typing or partway through verification, the header holds only a back button. */
  showsBack: boolean
  /** Resting sheets in the new layouts carry a grabber on their top edge. */
  showsGrabber: boolean
  /** Signed in: the sheet fills the screen in the account page's colour. */
  expanded: boolean
  /** Pushes the sheet below the screen during the entrance. */
  introShift: MotionValue<number>
  onBack: () => void
  onSwitchLanguage: () => void
  onTapHeader: () => void
  onClose: () => void
  onApplyNoonOne: () => void
  /** The carousel's "Apply now" on the CIB noon Credit card slide. */
  onApplyCreditCard: () => void
  /** Flow-map thumbnails: the header painted in a reaction's colour, frozen. */
  staticTone?: HeaderToneName
  /** Separate flow, Log in / Sign up: the chip on the right ("New account" or "Log in"). */
  formChip?: HeaderFormChip
  /** Separate flow, opened from checkout or a link: ✕ on the left closes sign-in. */
  leadingClose?: boolean
}) {
  const app = useApp()
  const flow = useFlow()
  const lang = app.lang
  const { isStatic, scale } = useScreen()
  const [washes, setWashes] = useState<HeaderEvent[]>([])
  const [wave, setWave] = useState<HeaderEvent | null>(null)
  const washesRef = useRef(washes)
  washesRef.current = washes

  const isLight = staticTone ? HEADER_TONES[staticTone].isLight : app.authHeaderIsLight
  const controlForeground = isLight ? colour.text.primary : colour.text.onSurfaceBold
  const isMyAccount = entry === 'account'

  // A new reaction from the flow (Swift: `.onChange(of: flow.headerEvent)`, so not the one already
  // there when the screen appears).
  const lastEvent = useRef(flow.headerEvent?.id)
  useEffect(() => {
    const event = flow.headerEvent
    if (!event || event.id === lastEvent.current) return
    lastEvent.current = event.id
    if (isStatic) return
    setWashes((current) => {
      const next = [...current, event]
      return next.length > 3 ? next.slice(1) : next
    })
    setWave(event.kind === 'welcome' ? event : null)
  }, [flow.headerEvent, isStatic])

  useEffect(() => {
    // Loaded ahead so the welcome sound starts on its exact beat the first time.
    app.sound.prepare('welcomeNew')
    return () => app.setHeaderLight(false)
  }, [app])

  // Thumbnails in yellow take dark glyphs, status bar included.
  useEffect(() => {
    if (staticTone) app.setHeaderLight(HEADER_TONES[staticTone].isLight)
  }, [staticTone, app])

  const tapHeight = useTransform(sheetTop, (v) => Math.max(0, v))
  const sheetY = useTransform([sheetTop, introShift], ([top, shift]: number[]) => top + shift)
  const waveY = useTransform(sheetTop, (v) => v + 6 - 40)
  const resolution = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * scale

  // Faded out (expanded), the controls stop taking taps, as a SwiftUI view at zero opacity does.
  const controlHit = expanded ? 'none' : 'auto'
  const swapTransition: Transition = { ...swiftSpring(0.4, 0) }
  const headerSwap = {
    initial: materialize({ opacity: 0, blur: 4, scale: 0.8 }),
    animate: materializeTo({}),
    exit: materialize({ opacity: 0, blur: 2, scale: 0.9 }),
    transition: swapTransition,
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: headerGradient(staticTone ?? 'blue') }} />

      {washes.map((event) => (
        <HeaderWash
          key={event.id}
          event={event}
          size={SCREEN}
          settings={app.store.headerTransition}
          resolution={resolution}
          onCovered={() => app.setHeaderLight(event.kind === 'welcome')}
          onReceding={() => {
            const list = washesRef.current
            if (list[list.length - 1]?.id === event.id) app.setHeaderLight(false)
          }}
          onFinished={() => setWashes((current) => current.filter((e) => e.id !== event.id))}
        />
      ))}

      {/* Taps on the header above the sheet. */}
      <motion.div onClick={onTapHeader} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: tapHeight }} />

      <AnimatePresence initial={false}>
        <motion.div
          key={headerArt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={spring.smooth}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
        >
          {headerArt === 'hero' ? (
            // The scene stands on the resting sheet's edge.
            <motion.div
              initial={false}
              animate={{ y: restSheetTop - HERO_SIZE.height }}
              transition={isStatic ? { duration: 0 } : spring.smooth}
              style={{ position: 'absolute', left: (SCREEN.width - HERO_SIZE.width) / 2, top: 0 }}
            >
              <HeroIllustration visible={showsIllustration} isStatic={isStatic} />
            </motion.div>
          ) : headerArt === 'carousel' ? (
            // Centred in the blue between the top row and the resting sheet, so it sits right whether
            // the sheet rests high (Choose your account) or low (Welcome). Hidden, it lets taps
            // through (Swift: `.allowsHitTesting`).
            <motion.div
              initial={false}
              animate={{ y: carouselY(restSheetTop) }}
              transition={isStatic ? { duration: 0 } : spring.smooth}
              style={{ position: 'absolute', left: 0, top: 0 }}
            >
              <WelcomeCarousel visible={showsIllustration} onApply={onApplyCreditCard} />
            </motion.div>
          ) : (
            // Figma measures it from the top of the screen, status bar included.
            <NoonOneHeader visible={showsIllustration} onApply={onApplyNoonOne} />
          )}
        </motion.div>
      </AnimatePresence>

      {(wave || staticTone === 'welcome') && (
        <motion.div style={{ position: 'absolute', left: SCREEN.width * 0.44 - 40, top: 0, y: waveY, width: 80, height: 80, pointerEvents: 'none' }}>
          {wave ? <WavingHand key={wave.id} /> : <Hand rise={0} angle={22} />}
        </motion.div>
      )}

      {/* Top row */}
      <motion.div
        className="auth-top-row"
        initial={false}
        animate={{ opacity: expanded ? 0 : 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ position: 'absolute', left: 0, right: 0, top: SAFE_TOP, padding: '0 12px', pointerEvents: 'none' }}
      >
        {/* The pill's text follows the header's lightness like the language toggle's. */}
        <style>{`.auth-top-row button { transition: color ${field.duration.base}s cubic-bezier(0.32, 0.72, 0, 1); }`}</style>
        <div style={{ position: 'relative', height: 38, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
          {/* popLayout lifts the leaving control out of the row where it stood (measured in layout
              pixels, so the phone's CSS scale doesn't matter); insets are padding, not margins, so
              the lifted copy doesn't shift. */}
          <AnimatePresence initial={false} mode="popLayout">
            {leadingClose ? (
              <motion.div key="close" {...headerSwap} style={{ display: 'flex', pointerEvents: controlHit }}>
                <div style={{ marginInlineStart: -3 }}>
                  <HeaderCloseButton label={t(lang, 'Close', 'إغلاق')} onClick={onClose} />
                </div>
              </motion.div>
            ) : showsBack ? (
              // Overlay circle with a white arrow, on blue and on the yellow welcome alike.
              <motion.div key="back" {...headerSwap} style={{ display: 'flex', pointerEvents: controlHit }}>
                <div style={{ marginInlineStart: -3 }}>
                  <HeaderCircleButton icon="system-arrow-left" foreground={colour.text.onSurfaceBold} label={t(lang, 'Back', 'رجوع')} onClick={onBack} />
                </div>
              </motion.div>
            ) : isMyAccount ? (
              <motion.div key="market" {...headerSwap} style={{ paddingInlineStart: 4, pointerEvents: controlHit }}>
                <MarketPill market={app.market} foreground={controlForeground} lang={lang} onSelect={(c) => app.selectMarket(c)} />
              </motion.div>
            ) : (
              <motion.div key="wordmark" {...headerSwap} role="img" aria-label="noon" style={{ paddingInlineStart: 6, display: 'flex' }}>
                <ArtGlyph name={Art.noonWordmark} width={69} height={18} color={colour.text.onSurfaceBold} />
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ flex: 1 }} />

          <AnimatePresence initial={false} mode="popLayout">
            {formChip ? (
              // A new title is a new chip: "New account" swaps for "Log in" (Swift `.id(formChip.title)`).
              <motion.div key={`chip-${formChip.title}`} {...headerSwap} style={{ display: 'flex', pointerEvents: controlHit }}>
                <FormChipButton chip={formChip} />
              </motion.div>
            ) : (
              !showsBack &&
              !leadingClose && (
                <motion.div key="trailing" {...headerSwap} style={{ paddingInlineEnd: 4, pointerEvents: controlHit }}>
                  {isMyAccount ? (
                    <LanguageToggle current={app.lang} onLight={isLight} onToggle={onSwitchLanguage} />
                  ) : (
                    <HeaderCloseButton label={t(lang, 'Close', 'إغلاق')} onClick={onClose} />
                  )}
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Sheet */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ borderTopLeftRadius: expanded ? 0 : AuthLayout.sheetRadius, borderTopRightRadius: expanded ? 0 : AuthLayout.sheetRadius }}
        transition={isStatic ? { duration: 0 } : { ...swiftSpring(0.7, 0) }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: SCREEN.height + 40,
          y: sheetY,
          background: expanded ? colour.surface.tertiary : colour.surface.primary,
          transition: isStatic ? undefined : 'background-color 0.7s cubic-bezier(0.25, 1, 0.5, 1)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            marginLeft: -18,
            width: 36,
            height: 4,
            borderRadius: 2,
            background: palette.alphaDark['16'],
            opacity: showsGrabber && !expanded ? 1 : 0,
            transition: isStatic ? undefined : 'opacity 0.2s ease-out',
          }}
        />
      </motion.div>
    </div>
  )
}

// MARK: - Header chip

/** M-NeutralRoundButton on the header (Figma 1106:7079): a translucent pill, white label. */
function FormChipButton({ chip }: { chip: HeaderFormChip }) {
  return (
    <Pressable
      scale={0.96}
      onClick={chip.onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 40,
        paddingInlineStart: chip.showsPlus ? 12 : 16,
        paddingInlineEnd: 16,
        borderRadius: 999,
        background: palette.alphaDark['16'],
        color: colour.text.onSurfaceBold,
      }}
    >
      {chip.showsPlus && <Icon name="system-plus" size={20} />}
      <span style={{ ...type.b13SemiBold, whiteSpace: 'nowrap' }}>{chip.title}</span>
    </Pressable>
  )
}

// MARK: - Wave

/** The hand's pose: how far it has sunk behind the sheet and its tilt (degrees, about its base). */
function Hand({ rise, angle }: { rise: number | MotionValue<number>; angle: number | MotionValue<number> }) {
  const y = useTransform(() => (typeof rise === 'number' ? rise : rise.get()) - 40)
  return (
    <motion.div
      aria-hidden
      style={{
        width: 80,
        height: 80,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontSize: 60,
        lineHeight: '72px',
        fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        y,
        rotate: angle,
        originX: 0.5,
        originY: 1,
      }}
    >
      {'👋🏽'}
    </motion.div>
  )
}

/** A hand pops up from behind the sheet, waves hello, and ducks back down.
 *  Placeholder artwork: swap the emoji for the final illustration. */
function WavingHand() {
  const app = useApp()
  const reduceMotion = useReducedMotion() ?? false
  const rise = useMotionValue(96)
  const angle = useMotionValue(12)

  useEffect(() => {
    // Reduce Motion keeps the hello but drops the swinging.
    const wave = (a: number) => (reduceMotion ? 12 : a)
    const riseTrack = keyframeTrack(96, [
      { kind: 'linear', to: 96, duration: 0.2 },
      { kind: 'spring', to: 0, duration: 0.5, springDuration: 0.5, bounce: 0.25 },
      { kind: 'linear', to: 0, duration: reduceMotion ? 1.3 : 1.15 },
      { kind: 'cubic', to: 96, duration: 0.4 },
    ])
    const angleTrack = keyframeTrack(12, [
      { kind: 'linear', to: 12, duration: 0.55 },
      { kind: 'cubic', to: wave(-8), duration: 0.18 },
      { kind: 'cubic', to: wave(26), duration: 0.2 },
      { kind: 'cubic', to: wave(-4), duration: 0.2 },
      { kind: 'cubic', to: wave(22), duration: 0.2 },
      { kind: 'cubic', to: wave(4), duration: 0.18 },
      { kind: 'cubic', to: 12, duration: 0.2 },
    ])
    const total = Math.max(riseTrack.total, angleTrack.total)
    const controls = animate(0, total, {
      duration: total,
      ease: 'linear',
      onUpdate: (time) => {
        rise.set(riseTrack.at(time))
        angle.set(angleTrack.at(time))
      },
    })
    // Pop as the hand clears the sheet (~0.3s), "hel-lo" on its two outward swings.
    app.sound.play('welcomeNew', 0.3)
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Hand rise={rise} angle={angle} />
}

type Keyframe =
  | { kind: 'linear' | 'cubic'; to: number; duration: number }
  | { kind: 'spring'; to: number; duration: number; springDuration: number; bounce: number }

/** A SwiftUI KeyframeTrack evaluated at any time: linear keyframes interpolate straight, adjacent
 *  cubic keyframes form a Catmull-Rom spline (taking the neighbouring segment's velocity where they
 *  meet another kind), and spring keyframes run `Spring(duration:bounce:)` for their duration. */
function keyframeTrack(initial: number, frames: Keyframe[]) {
  const times = [0]
  const values = [initial]
  for (const frame of frames) {
    times.push(times[times.length - 1] + frame.duration)
    values.push(frame.to)
  }
  const total = times[times.length - 1]
  // Segment i (1-based) runs from point i-1 to point i.
  const linearVelocity = (i: number) => (values[i] - values[i - 1]) / frames[i - 1].duration
  const catmullRom = (p: number) => (values[p + 1] - values[p - 1]) / (times[p + 1] - times[p - 1])
  const startVelocity = (i: number) => {
    const previous = frames[i - 2]
    if (!previous) return 0
    if (previous.kind === 'linear') return linearVelocity(i - 1)
    if (previous.kind === 'cubic') return catmullRom(i - 1)
    return 0
  }
  const endVelocity = (i: number) => {
    const next = frames[i]
    if (!next) return 0
    if (next.kind === 'linear') return linearVelocity(i + 1)
    if (next.kind === 'cubic') return catmullRom(i)
    return 0
  }

  const at = (time: number) => {
    if (time <= 0) return values[0]
    if (time >= total) return values[values.length - 1]
    let i = 1
    while (times[i] < time) i++
    const frame = frames[i - 1]
    const from = values[i - 1]
    const to = values[i]
    const elapsed = time - times[i - 1]
    const u = elapsed / frame.duration
    switch (frame.kind) {
      case 'linear':
        return from + (to - from) * u
      case 'cubic': {
        const d = frame.duration
        const v0 = startVelocity(i) * d
        const v1 = endVelocity(i) * d
        const u2 = u * u
        const u3 = u2 * u
        return (2 * u3 - 3 * u2 + 1) * from + (u3 - 2 * u2 + u) * v0 + (-2 * u3 + 3 * u2) * to + (u3 - u2) * v1
      }
      case 'spring': {
        const omega = (2 * Math.PI) / frame.springDuration
        const zeta = 1 - frame.bounce
        const x0 = from - to
        const v = startVelocity(i)
        if (zeta >= 1) return to + Math.exp(-omega * elapsed) * (x0 + (v + omega * x0) * elapsed)
        const omegaD = omega * Math.sqrt(1 - zeta * zeta)
        return to + Math.exp(-zeta * omega * elapsed) * (x0 * Math.cos(omegaD * elapsed) + ((v + zeta * omega * x0) / omegaD) * Math.sin(omegaD * elapsed))
      }
    }
  }
  return { total, at }
}
