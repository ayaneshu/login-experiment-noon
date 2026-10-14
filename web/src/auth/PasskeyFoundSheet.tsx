import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from 'motion/react'
import type { PanInfo, Transition } from 'motion/react'
import { SAFE_BOTTOM, useFlow, useLang, useReportCenter, useScreen } from '../app/context'
import { softRise, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { idDisplay } from '../model/identifier'
import { isRTL, ltr, t } from '../model/lang'
import type { Point } from '../model/observable'
import type { Account } from '../model/services'
import { FieldButton, tones } from '../ui/Button'
import { HelperText } from '../ui/Controls'
import { Art, ArtImage } from '../ui/Icon'

/** SwiftUI `.spring(duration:bounce:)`, exactly: stiffness (2π/d)², damping 4π(1−bounce)/d. */
const swiftSpring = (duration: number, bounce = 0): Transition => ({
  type: 'spring',
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: (4 * Math.PI * (1 - bounce)) / duration,
  mass: 1,
})

/** Biometry is simulated; the name is always Face ID. */
const BIOMETRY = 'Face ID'

/** "This account has a passkey" (Figma 791:197190): someone typed an email whose account has Face ID
 *  on this device. Offer it before sending a code; "Login with OTP" carries on as usual. Floats over a
 *  scrim like the biometric offer; drag down or tap outside to dismiss. */
export function PasskeyFoundSheet({ account }: { account: Account }) {
  const flow = useFlow()
  const lang = useLang()
  const failed = flow.biometricState === 'failed'
  const title = t(lang, 'This account has a passkey', 'لهذا الحساب مفتاح مرور')

  return (
    <FloatingSheet hiddenOffset={620} label={title} onDismissed={() => flow.dismissPasskeyOffer()}>
      {() => (
        <div style={{ background: colour.surface.primary, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              padding: '20px 12px 12px',
              borderRadius: 16,
              background: `linear-gradient(to bottom, ${colour.surface.secondary} 34.68%, ${colour.surface.tertiary} 100%)`,
            }}
          >
            <BiometricPair face={Art.biometricFaceOnGrey} ring={colour.surface.secondary} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
                <h2 style={{ ...type.h20Bold, color: colour.text.primary, margin: 0 }}>{title}</h2>
                <p style={{ ...type.b14Regular, color: colour.text.tertiary, margin: 0 }}>
                  {t(lang, 'Sign in with Face ID, Touch ID, or PIN', 'سجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول')}
                </p>
              </div>
              <IdentityRow account={account} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <ReportingButton
              onCenter={(p) => {
                flow.ctaAnchor = p
              }}
              title={t(lang, `Log in with ${BIOMETRY}`, `سجّل الدخول باستخدام ${BIOMETRY}`)}
              tone={tones.primary}
              size="h52"
              leadingArt={Art.faceID}
              leadingSize={23}
              textStyle="a16SemiBold"
              isLoading={flow.biometricState === 'scanning'}
              loadingArt={Art.faceID}
              onClick={() => flow.signInWithFoundPasskey()}
            />
            <FieldButton
              title={t(lang, 'Login with OTP', 'سجّل الدخول برمز التحقق')}
              tone={tones.secondaryNeutral}
              size="h52"
              textStyle="a16SemiBold"
              onClick={() => flow.declinePasskey()}
            />
          </div>
          <Reveal show={failed} gap={12} transition={spring.smooth}>
            <HelperText
              tone="error"
              style={{ textAlign: 'center' }}
              text={t(lang, `${BIOMETRY} didn't recognise you. Try again or log in with OTP.`, `لم يتعرّف ${BIOMETRY} عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق.`)}
            />
          </Reveal>
        </div>
      )}
    </FloatingSheet>
  )
}

/** "Logging in as" on white, inside the grey card. */
function IdentityRow({ account }: { account: Account }) {
  const lang = useLang()
  const initial = account.firstName ? Array.from(account.firstName)[0] : ''
  return (
    <div role="group" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: colour.surface.primary }}>
      <span aria-hidden style={{ ...type.b14SemiBold, color: colour.text.action, width: 40, height: 40, flex: 'none', borderRadius: '50%', background: colour.surface.actionSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {initial}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, textAlign: 'start' }}>
        <span style={{ ...type.b13Regular, color: colour.text.tertiary }}>{t(lang, 'Logging in as', 'تسجيل الدخول باسم')}</span>
        <MiddleTruncated text={idDisplay(account.identifier)} style={{ ...type.b16Bold, color: colour.text.primary }} />
      </div>
    </div>
  )
}

// MARK: - Shared with ChooseAccountStep and FaceIDSheet

/** A sheet floating 12pt in from the edges over a black 80% scrim, under a 36pt notch. Slides up on
 *  appear; drag down (a flick is enough), tap the scrim, or call `dismiss` to send it away, after which
 *  `onDismissed` fires (380ms later, as in Swift). Pulling up rubber-bands. */
export function FloatingSheet({
  hiddenOffset,
  label,
  onDismissed,
  style,
  children,
}: {
  /** How far below its resting spot the sheet starts and leaves to. */
  hiddenOffset: number
  label: string
  onDismissed: () => void
  style?: CSSProperties
  children: (dismiss: () => void) => ReactNode
}) {
  const { isStatic, scale } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const y = useMotionValue(isStatic ? 0 : hiddenOffset)
  const scrim = useMotionValue(isStatic ? SCRIM : 0)
  const dismissed = useRef(false)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const onDismissedRef = useRef(onDismissed)
  onDismissedRef.current = onDismissed
  const config = useRef({ hiddenOffset, reduceMotion })
  config.current = { hiddenOffset, reduceMotion }

  useEffect(() => {
    if (isStatic) return
    const transition: Transition = reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.5, 0)
    const a = animate(y, 0, transition)
    const b = animate(scrim, SCRIM, transition)
    return () => {
      a.stop()
      b.stop()
    }
    // Once, on appear.
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const dismiss = useCallback(() => {
    if (dismissed.current) return
    dismissed.current = true
    const transition: Transition = config.current.reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.4, 0)
    animate(y, config.current.hiddenOffset, transition)
    animate(scrim, 0, transition)
    timer.current = window.setTimeout(() => onDismissedRef.current(), 380)
  }, [y, scrim])

  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (dismissed.current) return
    const dy = info.offset.y / scale
    if (!dragging.current) {
      // SwiftUI's DragGesture starts after 10pt.
      if (Math.hypot(info.offset.x, info.offset.y) / scale < 10) return
      dragging.current = true
      suppressClick.current = true
      y.stop()
      scrim.stop()
    }
    y.set(rubberBanded(dy))
    scrim.set(scrimFor(dy))
  }

  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    if (!dragging.current) return
    dragging.current = false
    if (dismissed.current) return
    const dy = info.offset.y / scale
    // UIKit's projection for a normal deceleration rate: where the flick would come to rest.
    const predicted = dy + (info.velocity.y / scale) * 0.499
    if (dy > 110 || predicted > 260) {
      dismiss()
    } else {
      const back = swiftSpring(0.4, 0.2)
      animate(y, 0, back)
      animate(scrim, SCRIM, back)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{ position: 'absolute', inset: 0, ...style }}>
      <motion.div aria-hidden onClick={dismiss} style={{ position: 'absolute', inset: 0, background: '#000', opacity: scrim }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: SAFE_BOTTOM, pointerEvents: 'none' }}>
        <motion.div
          onPan={onPan}
          onPanEnd={onPanEnd}
          onPointerDownCapture={() => {
            suppressClick.current = false
          }}
          onClickCapture={(e) => {
            // A drag that ends over a button isn't a tap.
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
            <span style={{ width: 36, height: 4, borderRadius: 2, background: '#B7B7B7' }} />
          </div>
          {children(dismiss)}
        </motion.div>
      </div>
    </div>
  )
}

/** Figma: black at 80% behind the sheet. */
const SCRIM = 0.8

/** Pulling down fades the scrim over 400pt. */
const scrimFor = (drag: number) => SCRIM * (1 - Math.min(Math.max(drag, 0) / 400, 1))

/** Pulling up past the resting spot resists more the further you go. */
function rubberBanded(value: number) {
  if (value >= 0) return value
  const dimension = 300
  return -(Math.abs(value) * dimension * 0.55) / (dimension + 0.55 * Math.abs(value))
}

/** Face ID and fingerprint, overlapping by 20pt. The face sits on top and its ring (drawn in `ring`)
 *  cuts into the fingerprint circle behind it. `paired: false` tucks the fingerprint behind the face. */
export function BiometricPair({ face, ring, paired = true, transition }: { face: string; ring: string; paired?: boolean; transition?: Transition }) {
  const lang = useLang()
  // Toward the face: left in English, right in Arabic.
  const toward = isRTL(lang) ? -1 : 1
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 80, height: 80, flex: 'none', position: 'relative', zIndex: 2 }}>
        <ArtImage name={face} width={96} height={96} style={{ position: 'absolute', top: -8, insetInlineStart: -8 }} />
      </div>
      <motion.div
        initial={false}
        animate={{ x: paired ? 0 : -44 * toward, scale: paired ? 1 : 0.9 }}
        transition={transition}
        style={{
          width: 80,
          height: 80,
          flex: 'none',
          marginInlineStart: -20,
          position: 'relative',
          zIndex: 1,
          borderRadius: '50%',
          overflow: 'hidden',
          background: colour.surface.actionSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArtImage name={Art.biometricFingerprint} width={41.24} height={44.31} style={{ transform: `translate(${0.38 * toward}px, 0.4px)` }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 8px ${ring}` }} />
      </motion.div>
    </div>
  )
}

/** Content that comes and goes inside a stack (`.transition(.softRise)`): the room for it opens and
 *  closes with the same spring, and the content rises into it. `gap` is the stack spacing above it. */
export function Reveal({ show, gap, transition, children }: { show: boolean; gap: number; transition: Transition; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <Collapse key="reveal" transition={transition}>
          <motion.div initial={softRise.initial} animate={softRise.animate} exit={softRise.exit} transition={transition} style={{ paddingTop: gap }}>
            {children}
          </motion.div>
        </Collapse>
      )}
    </AnimatePresence>
  )
}

/** Inside AnimatePresence: a wrapper that opens from 0 to its content's height and closes back to 0,
 *  following the content in between. Nothing is clipped, as in SwiftUI. Heights are offsetHeight
 *  (layout px), never a viewport box, so the phone's CSS scale can't skew them. */
export function Collapse({ transition, children }: { transition: Transition; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <motion.div initial={{ height: 0 }} animate={height == null ? undefined : { height }} exit={{ height: 0 }} transition={transition}>
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}

/** One line, truncated in the middle when it doesn't fit (`.truncationMode(.middle)`); numbers and
 *  emails stay left-to-right in Arabic. */
export function MiddleTruncated({ text, style }: { text: string; style: CSSProperties }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(text)
  useLayoutEffect(() => {
    const box = boxRef.current
    const probe = probeRef.current
    if (!box || !probe) return
    const chars = Array.from(text)
    const width = (s: string) => {
      probe.textContent = ltr(s)
      return probe.offsetWidth
    }
    const middle = (n: number) => `${chars.slice(0, Math.ceil(n / 2)).join('')}…${chars.slice(chars.length - Math.floor(n / 2)).join('')}`
    const fit = () => {
      const available = box.clientWidth
      if (available === 0 || width(text) <= available) {
        setShown(text)
        return
      }
      let lo = 0
      let hi = chars.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (width(middle(mid)) <= available) lo = mid
        else hi = mid - 1
      }
      setShown(middle(lo))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    void document.fonts?.ready.then(fit)
    return () => observer.disconnect()
  }, [text])
  return (
    <span style={{ position: 'relative', display: 'block', minWidth: 0 }}>
      <span ref={boxRef} style={{ ...style, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {ltr(shown)}
      </span>
      <span ref={probeRef} aria-hidden style={{ ...style, position: 'absolute', top: 0, left: 0, visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }} />
    </span>
  )
}

/** A FieldButton whose centre is reported (`.reportCenter`), e.g. as the flow's celebration anchor. */
export function ReportingButton({ onCenter, ...props }: Parameters<typeof FieldButton>[0] & { onCenter: (p: Point) => void }) {
  const ref = useReportCenter<HTMLButtonElement>(onCenter)
  return <FieldButton {...props} buttonRef={ref} />
}
