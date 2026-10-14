import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { AnimationPlaybackControls, MotionValue, Transition } from 'motion/react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { SCREEN, useApp, useScreen } from '../app/context'
import { colour, palette, type } from '../design/tokens'
import type { Celebration, CelebrationStage } from '../model/appModel'
import type { Point } from '../model/observable'
import { Icon } from '../ui/Icon'

/// The moment you're in, in three quiet beats (SignInCelebration.swift):
///
/// 1. Resolve — the green code becomes your avatar where it stands, while everything else on the
///    sheet dissolves and the sheet grows into the page.
/// 2. Pulse — the avatar, still the code's green, takes centre stage; the green leaves it as one
///    soft ring of light, a verified tick settles in its place, and the sound lands on that frame.
/// 3. Arrive — the greeting blurs in, then gives way as the avatar flies along an arc into its
///    place on the account page and the page rises to meet it.

/** The avatar is drawn at hero size and only ever scaled down, so it stays crisp. */
const HERO = 80
const LANDED = 48
const RESOLVED = 56
/** The separate Log in / Sign up flow's "Welcome to noon · success" screen (Figma 1123:137766) draws
 *  it a little larger, and starts it from the code at 56/82 as the Swift app does. */
const SUCCESS_HERO = 84
const SUCCESS_START_SCALE = 56 / 82
/** The success screen keeps a soft green glow behind the greeting until the avatar lands. */
const SUCCESS_GLOW = 0.55

/** SwiftUI `.spring(duration:bounce:)`: stiffness (2π/d)², damping 4π(1−bounce)/d, mass 1. (Motion's
 *  own `duration` springs settle about 1.5× sooner than SwiftUI's perceptual duration.) */
function swiftSpring(duration: number, bounce = 0): Transition {
  const omega = (2 * Math.PI) / duration
  return { type: 'spring', stiffness: omega * omega, damping: (4 * Math.PI * (1 - bounce)) / duration, mass: 1 }
}
/** `.timingCurve(0.23, 1, 0.32, 1, duration:)` */
const curve = (duration: number, delay = 0): Transition => ({ duration, ease: [0.23, 1, 0.32, 1], delay })
const easeOut = (duration: number, delay = 0): Transition => ({ duration, ease: 'easeOut', delay })

/** Reads a token's resolved colour so it can be interpolated (motion values can't mix `var()`s). */
function resolved(token: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const name = token.match(/var\((--[^)]+)\)/)?.[1]
  return (name && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback
}

const isZero = (p: Point) => p.x === 0 && p.y === 0

/** Success screen: the initial in Noontree SemiBold 36. */
const SUCCESS_INITIAL: CSSProperties = { fontFamily: 'var(--font-noon)', fontWeight: 600, fontSize: 36, lineHeight: '44px' }

/** The signed-in celebration overlay. Renders nothing unless `app.celebration` is set; a new
 *  celebration restarts the choreography (Swift's `.id(celebration.id)`). */
export function SignInCelebration() {
  const app = useApp()
  const celebration = app.celebration
  if (!celebration) return null
  return <CelebrationStage key={celebration.id} celebration={celebration} />
}

/** The values every animated property starts from. Flow-map thumbnails freeze on the frame for the
 *  preset's stage instead of playing. */
function startFrame(celebration: Celebration, origin: Point, hero: Point, frozen: CelebrationStage | null, landing: Point, isSuccessScreen: boolean) {
  const heroSize = isSuccessScreen ? SUCCESS_HERO : HERO
  const frame = {
    x: origin.x, y: origin.y, scale: isSuccessScreen ? SUCCESS_START_SCALE : RESOLVED / HERO, opacity: 0, blur: 8,
    settled: 0, green: 1, tick: 0, drawn: 0, ripple: 0, rippleOpacity: 0,
    greet: [0, 6, 8], sub: [0, 6, 6], calm: 0,
  }
  switch (frozen) {
    case null:
      return frame
    case 'resolve':
      return { ...frame, opacity: 1, blur: 0 }
    case 'clear':
      return { ...frame, x: hero.x, y: hero.y, scale: 1, opacity: 1, blur: 0 }
    case 'greet':
      return {
        ...frame, x: hero.x, y: hero.y, scale: 1, opacity: 1, blur: 0, green: 0, tick: 1, drawn: 1, greet: [1, 0, 0], sub: [1, 0, 0],
        ...(isSuccessScreen ? { ripple: 1, rippleOpacity: SUCCESS_GLOW } : {}),
      }
    case 'land':
      return celebration.landsOnAccount
        ? { ...frame, x: landing.x, y: landing.y, scale: LANDED / heroSize, opacity: 1, blur: 0, green: 0, settled: 1, drawn: 1, greet: [0, 4, -6], sub: [1, 0, 0] }
        : { ...frame, x: hero.x, y: hero.y, scale: 0.8, opacity: 0, blur: 4, green: 0, drawn: 1, greet: [0, 4, -6], sub: [1, 0, 0] }
  }
}

function CelebrationStage({ celebration }: { celebration: Celebration }) {
  const app = useApp()
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const size = SCREEN
  const hero = { x: size.width / 2, y: size.height * 0.36 }
  const rippleDiameter = Math.max(size.width, size.height) * 0.95
  const origin = isZero(celebration.origin) ? hero : celebration.origin
  const landingPoint = isZero(app.avatarCenter) ? { x: 48, y: 110 } : app.avatarCenter
  /** Separate Log in / Sign up flow: the "Welcome to noon · success" look (a light disc with a border,
   *  a white tick badge, a glow that holds). Captured once so a flow swapped mid-way can't restyle it. */
  const [isSuccessScreen] = useState(() => app.flow.isSeparate)
  const heroSize = isSuccessScreen ? SUCCESS_HERO : HERO

  // Captured once: later renders mustn't reset values the choreography is animating.
  const start = useMemo(() => startFrame(celebration, origin, hero, isStatic ? app.celebrationStage : null, landingPoint, isSuccessScreen), [])

  const avatarX = useMotionValue(start.x)
  const avatarY = useMotionValue(start.y)
  const avatarScale = useMotionValue(start.scale)
  const avatarOpacity = useMotionValue(start.opacity)
  const avatarBlur = useMotionValue(start.blur)
  /** Landed: the fill turns to the page's tertiary grey and the shadow lifts off. */
  const settled = useMotionValue(start.settled)
  /** Carries the verified code's green until the pulse releases it. */
  const green = useMotionValue(start.green)
  const tick = useMotionValue(start.tick)
  const tickDrawn = useMotionValue(start.drawn)
  const ripple = useMotionValue(start.ripple)
  const rippleOpacity = useMotionValue(start.rippleOpacity)
  const greetOpacity = useMotionValue(start.greet[0])
  const greetBlur = useMotionValue(start.greet[1])
  const greetY = useMotionValue(start.greet[2])
  const subOpacity = useMotionValue(start.sub[0])
  const subBlur = useMotionValue(start.sub[1])
  const subY = useMotionValue(start.sub[2])
  /** Reduce Motion: a calm cross-fade stands in for the sheet sweeping up. */
  const calm = useMotionValue(start.calm)

  const colours = useMemo(
    () => ({
      onBold: resolved(colour.text.onSurfaceBold, '#FFFFFF'),
      primary: resolved(colour.text.primary, '#1D2539'),
      tertiary: resolved(colour.text.tertiary, '#666D85'),
    }),
    [],
  )
  const avatarFilter = useTransform(avatarBlur, (b) => `blur(${b}px)`)
  const avatarShadow = useTransform(settled, (s) => (isSuccessScreen ? 'none' : `0 8px 36px rgba(0, 0, 0, ${0.08 * (1 - s)})`))
  /** Success screen: the Grey-200 ring shows only on the light disc (not green, not landed). */
  const ringOpacity = useTransform([green, settled], ([g, s]: number[]) => (1 - g) * (1 - s))
  /** Success screen: the filled check grows inside its white badge as it draws. */
  const checkScale = useTransform(tickDrawn, (v) => 0.4 + 0.6 * v)
  const initialColour = useTransform(green, [0, 1], [colours.primary, colours.onBold])
  const iconColour = useTransform(green, [0, 1], [colours.tertiary, colours.onBold])
  const tickScale = useTransform(tick, (v) => 0.6 + 0.4 * v)
  // A zero-length round-capped stroke would still show a dot; trim(0, 0) draws nothing.
  const tickStrokeOpacity = useTransform(tickDrawn, (v) => (v > 0.001 ? 1 : 0))
  const rippleScale = useTransform(ripple, (v) => 0.16 + 0.84 * v)
  const greetFilter = useTransform(greetBlur, (b) => `blur(${b}px)`)
  const subFilter = useTransform(subBlur, (b) => `blur(${b}px)`)

  useEffect(() => {
    if (isStatic) return
    let alive = true
    const running: AnimationPlaybackControls[] = []
    const to = (value: MotionValue<number>, target: number, transition: Transition) => {
      running.push(animate(value, target, transition))
    }
    const pause = (seconds: number) => new Promise<boolean>((resolve) => setTimeout(() => resolve(alive), seconds * 1000))

    const showGreeting = (transition: Transition) => {
      to(greetOpacity, 1, transition)
      to(greetBlur, 0, transition)
      to(greetY, 0, transition)
      // The subtitle carries its own animation, a beat behind the title.
      const lag = curve(0.5, 0.06)
      to(subOpacity, 1, lag)
      to(subBlur, 0, lag)
      to(subY, 0, lag)
    }
    const hideGreeting = (transition: Transition) => {
      to(greetOpacity, 0, transition)
      to(greetBlur, 4, transition)
      to(greetY, -6, transition)
    }

    /** Reduce Motion: the same beats as cross-fades; nothing travels or grows. */
    const runReduced = async () => {
      avatarX.set(hero.x)
      avatarY.set(hero.y)
      avatarScale.set(1)
      avatarBlur.set(0)
      tickDrawn.set(1)
      green.set(0)
      const fadeIn = easeOut(0.25)
      to(calm, 1, fadeIn)
      to(avatarOpacity, 1, fadeIn)
      app.celebrationClearing()
      if (!(await pause(0.3))) return
      app.celebrationCovered()
      to(tick, 1, fadeIn)
      showGreeting(fadeIn)
      app.sound.play('signinSuccess')
      if (!(await pause(1.3))) return
      app.celebrationLanding()
      const fadeOut = easeOut(0.3)
      to(calm, 0, fadeOut)
      to(avatarOpacity, 0, fadeOut)
      hideGreeting(fadeOut)
      if (!(await pause(0.32))) return
      app.celebrationFinished()
    }

    const run = async () => {
      app.sound.prepare('signinSuccess')
      if (reduceMotion) return runReduced()

      // 1. Resolve: the code becomes the avatar right where it was.
      to(avatarOpacity, 1, curve(0.4))
      to(avatarBlur, 0, curve(0.4))
      if (!(await pause(0.3))) return

      // The sheet grows into the page while the avatar glides to centre stage. X and Y move on
      // their own springs so the path curves instead of cutting straight across.
      app.celebrationClearing()
      to(avatarY, hero.y, swiftSpring(0.7))
      to(avatarX, hero.x, swiftSpring(0.8))
      to(avatarScale, 1, swiftSpring(0.8))
      if (!(await pause(0.62))) return
      app.celebrationCovered()

      // 2. Pulse: the green leaves as one ring of light; the tick and sound share its frame.
      to(rippleOpacity, 1, easeOut(0.12))
      to(green, 0, easeOut(0.45))
      to(ripple, 1, curve(1.4))
      to(tick, 1, swiftSpring(0.45, 0.3))
      to(tickDrawn, 1, easeOut(0.3, 0.1))
      app.sound.play('signinSuccess')
      if (!(await pause(0.16))) return
      // The success screen keeps a soft glow behind the greeting; the classic one lets it go.
      to(rippleOpacity, isSuccessScreen ? SUCCESS_GLOW : 0, easeOut(1.1))
      showGreeting(curve(0.5))

      // Long enough to read the greeting, short enough not to hold anyone up.
      if (!(await pause(isSuccessScreen ? 1.1 : 0.85))) return

      // 3. Arrive: the greeting steps back and the avatar flies into the profile card.
      app.celebrationLanding()
      hideGreeting(easeOut(0.2))
      to(tick, 0, easeOut(0.2))
      if (isSuccessScreen) to(rippleOpacity, 0, easeOut(0.4))
      if (!celebration.landsOnAccount) {
        // Checkout or a link: no profile card to land in, so the avatar settles and fades while
        // sign-in closes back to where it was opened.
        const settle = curve(0.45)
        to(avatarScale, 0.8, settle)
        to(avatarOpacity, 0, settle)
        to(avatarBlur, 4, settle)
        if (!(await pause(0.35))) return
        app.celebrationFinished()
        return
      }
      // Physical screen coordinates, measured by the account page. (The Swift app positions the
      // avatar in a mirrored space in Arabic, so there it flies to the wrong side; this lands it.)
      const target = isZero(app.avatarCenter) ? { x: 48, y: 110 } : app.avatarCenter
      to(avatarY, target.y, swiftSpring(0.62))
      const glide = swiftSpring(0.78)
      to(avatarX, target.x, glide)
      to(avatarScale, LANDED / heroSize, glide)
      to(settled, 1, glide)
      if (!(await pause(0.8))) return
      app.celebrationFinished()
    }

    void run()
    return () => {
      alive = false
      for (const animation of running) animation.stop()
    }
    // The choreography runs once per celebration (the stage is keyed by its id).
  }, [])

  const hits = app.celebrationStage !== 'land' ? ('auto' as const) : ('none' as const)

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <motion.div
        aria-hidden
        style={{ position: 'absolute', inset: 0, background: colour.surface.tertiary, opacity: calm, pointerEvents: reduceMotion ? hits : 'none' }}
      />

      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          left: hero.x - rippleDiameter / 2,
          top: hero.y - rippleDiameter / 2,
          width: rippleDiameter,
          height: rippleDiameter,
          borderRadius: '50%',
          background:
            'radial-gradient(circle closest-side, color-mix(in srgb, var(--green-500) 0%, transparent) 46%, color-mix(in srgb, var(--green-500) 28%, transparent) 74%, color-mix(in srgb, var(--green-500) 0%, transparent) 100%)',
          scale: rippleScale,
          opacity: rippleOpacity,
        }}
      />

      {/* Position, opacity and blur outside; scale inside, so the blur isn't scaled with it. */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: heroSize,
          height: heroSize,
          marginLeft: -heroSize / 2,
          marginTop: -heroSize / 2,
          x: avatarX,
          y: avatarY,
          opacity: avatarOpacity,
          filter: avatarFilter,
          pointerEvents: hits,
        }}
      >
        <motion.div style={{ position: 'relative', width: '100%', height: '100%', scale: avatarScale }}>
          <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: isSuccessScreen ? palette.grey['50'] : colour.surface.primary, boxShadow: avatarShadow }} />
          <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: colour.surface.tertiary, opacity: settled }} />
          {isSuccessScreen && <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 1px ${palette.grey['200']}`, opacity: ringOpacity }} />}
          <motion.div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: colour.surface.successBold, opacity: green }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {celebration.initial ? (
              <motion.span style={{ ...(isSuccessScreen ? SUCCESS_INITIAL : type.h40Bold), color: initialColour }}>{celebration.initial}</motion.span>
            ) : (
              <motion.span
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: iconColour,
                  WebkitMask: 'url(/assets/mi-bottomnav-profile.svg) center / contain no-repeat',
                  mask: 'url(/assets/mi-bottomnav-profile.svg) center / contain no-repeat',
                }}
              />
            )}
          </div>

          {isSuccessScreen ? (
            // Figma: a 30pt white disc holding the filled check, bottom-trailing.
            <motion.div style={{ position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 30, height: 30, scale: tickScale, opacity: tick }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: colour.surface.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.span style={{ display: 'flex', scale: checkScale }}>
                  <Icon name="system-check-circle-filled" size={26} color={colour.surface.successBold} />
                </motion.span>
              </div>
            </motion.div>
          ) : (
            // The verified tick, bottom-trailing, ringed in the page colour.
            <motion.div style={{ position: 'absolute', insetInlineEnd: -2, bottom: -2, width: 26, height: 26, scale: tickScale, opacity: tick }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: colour.surface.successBold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={11} height={8.5} viewBox="0 0 11 8.5" fill="none" style={{ overflow: 'visible', display: 'block' }}>
                  <motion.path
                    d="M0 4.675 L3.96 8.5 L11 0"
                    stroke={colour.text.onSurfaceBold}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pathLength: tickDrawn, opacity: tickStrokeOpacity }}
                  />
                </svg>
              </div>
              <div style={{ position: 'absolute', inset: -2.5, borderRadius: '50%', border: `2.5px solid ${colour.surface.tertiary}` }} />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* Centred on a line 56pt below the hero avatar, like `.position`. */}
      <div style={{ position: 'absolute', left: 0, top: hero.y + heroSize / 2 + 56, width: size.width, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          role="heading"
          aria-level={1}
          style={{
            flex: 'none',
            width: size.width,
            padding: '0 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            textAlign: 'center',
            opacity: greetOpacity,
            filter: greetFilter,
            y: greetY,
            pointerEvents: hits,
          }}
        >
          <span style={{ ...type.h24Bold, color: colour.text.primary }}>{celebration.title}</span>
          <motion.span style={{ ...type.b14Regular, color: isSuccessScreen ? colour.text.secondary : colour.text.tertiary, opacity: subOpacity, filter: subFilter, y: subY }}>
            {celebration.subtitle}
          </motion.span>
        </motion.div>
      </div>
    </div>
  )
}
