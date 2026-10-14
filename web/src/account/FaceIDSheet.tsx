import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { useApp, usePresetUI, useScreen } from '../app/context'
import { blurReplace, field, iconSwap, materialize, softRise } from '../design/motion'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { sleep } from '../model/observable'
import { BiometricPair, Collapse, FloatingSheet } from '../auth/PasskeyFoundSheet'
import type { ButtonTone } from '../ui/Button'
import { tones } from '../ui/Button'
import { Art, ArtImage } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Spinner } from '../ui/Spinner'

/** SwiftUI `.spring(duration:bounce:)`, exactly: stiffness (2π/d)², damping 4π(1−bounce)/d. */
const swiftSpring = (duration: number, bounce = 0): Transition => ({
  type: 'spring',
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: (4 * Math.PI * (1 - bounce)) / duration,
  mass: 1,
})

/** Everything on the card moves with this when the phase changes. */
const PHASE = swiftSpring(0.45, 0)

/** Offered once, right after a code-based sign-in: the best moment to trade the next code for a
 *  glance. Floats over a scrim; drag down, tap outside or "Not now" to dismiss. Renders nothing
 *  unless `app.showsFaceIDOffer`; its own exit plays before it asks the app to drop the offer. */
export function FaceIDSheet() {
  const app = useApp()
  if (!app.showsFaceIDOffer) return null
  return (
    <FloatingSheet
      hiddenOffset={520}
      label={t(app.lang, 'Enable biometric login', 'فعّل تسجيل الدخول بالبصمة')}
      onDismissed={() => app.dismissFaceIDOffer()}
      style={{ zIndex: 60 }}
    >
      {(dismiss) => <FaceIDCard dismiss={dismiss} />}
    </FloatingSheet>
  )
}

type Phase = 'offer' | 'enabling' | 'enabled'

function FaceIDCard({ dismiss }: { dismiss: () => void }) {
  const app = useApp()
  const lang = app.lang
  const preset = usePresetUI()
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [phase, setPhase] = useState<Phase>(preset.faceIDEnabled ? 'enabled' : 'offer')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Once the sheet has landed, the fingerprint slides out from behind the face.
  const [paired, setPaired] = useState(isStatic || reduceMotion)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    if (!isStatic) setPaired(true)
    // A preset that opens on "Biometric is on" leaves the way the real one does.
    const id = preset.faceIDEnabled && !isStatic ? window.setTimeout(dismiss, 1600) : undefined
    return () => {
      alive.current = false
      window.clearTimeout(id)
    }
    // Once, on appear.
  }, [])

  const enable = () => {
    if (phaseRef.current !== 'offer') return
    setPhase('enabling')
    void (async () => {
      const outcome = await app.biometrics.authenticate()
      if (!alive.current) return
      if (outcome === 'success') {
        app.setPasskey(true)
        setPhase('enabled')
        await sleep(1600)
        if (alive.current) dismiss()
      } else {
        setPhase('offer')
      }
    })()
  }

  const enabled = phase === 'enabled'
  const title = enabled ? t(lang, 'Biometric is on', 'تم تفعيل تسجيل الدخول بالبصمة') : t(lang, 'Enable biometric login', 'فعّل تسجيل الدخول بالبصمة')
  const body = enabled
    ? t(lang, 'Skip the OTP next time & login with Face ID, Touch ID, or PIN/Pattern', 'تخطَّ رمز التحقق في المرة القادمة وسجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول')
    : t(lang, 'Sign in with Face ID, Touch ID, or PIN', 'سجّل الدخول باستخدام Face ID أو Touch ID أو رمز الدخول')

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', padding: 12, borderRadius: 16, background: colour.surface.primary }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '12px 0' }}>
        <motion.div initial={false} animate={{ height: enabled ? 92.26 : 80 }} transition={PHASE} style={{ display: 'grid', placeItems: 'center' }}>
          <AnimatePresence initial={false}>
            {enabled ? (
              // Figma 791:196269: a green tick in a pale halo with two sparkles.
              <motion.div
                key="on"
                initial={materialize({ opacity: 0, blur: 4, scale: 0.6 })}
                animate={materialize({})}
                exit={materialize({ opacity: 0, blur: 4, scale: 0.6 })}
                transition={PHASE}
                style={{ gridArea: '1 / 1' }}
              >
                <ArtImage name={Art.biometricOn} width={120} height={92.26} />
              </motion.div>
            ) : (
              <motion.div key="pair" {...iconSwap} transition={PHASE} style={{ gridArea: '1 / 1' }}>
                <BiometricPair
                  face={Art.biometricFace}
                  ring={colour.border.white}
                  paired={paired}
                  transition={reduceMotion ? { duration: 0 } : { ...swiftSpring(0.55, 0.2), delay: 0.28 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'grid', width: '100%' }}>
            <AnimatePresence initial={false}>
              <motion.h2 key={`title-${enabled}`} {...blurReplace} transition={PHASE} style={{ ...type.h20Bold, color: colour.text.primary, margin: 0, gridArea: '1 / 1' }}>
                {title}
              </motion.h2>
            </AnimatePresence>
          </div>
          <motion.div initial={false} animate={{ marginTop: enabled ? 6 : 4 }} transition={PHASE} style={{ width: '100%' }}>
            <AutoHeight transition={PHASE}>
              <div style={{ display: 'grid' }}>
                <AnimatePresence initial={false}>
                  <motion.p
                    key={`body-${enabled}`}
                    {...blurReplace}
                    transition={PHASE}
                    style={{
                      ...type.b14Regular,
                      color: enabled ? colour.text.secondary : colour.text.tertiary,
                      maxWidth: enabled ? 282 : undefined,
                      justifySelf: 'center',
                      margin: 0,
                      gridArea: '1 / 1',
                    }}
                  >
                    {body}
                  </motion.p>
                </AnimatePresence>
              </div>
            </AutoHeight>
          </motion.div>
        </div>
      </div>

      {/* Stacked, full width: the yes on top, the no right under it. */}
      <AnimatePresence initial={false}>
        {!enabled && (
          <Collapse key="actions" transition={PHASE}>
            <motion.div {...softRise} transition={PHASE} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
              <LabelButton title={t(lang, 'Enable', 'تفعيل')} tone={tones.primary} isLoading={phase === 'enabling'} onClick={enable} />
              <LabelButton title={t(lang, 'Not now', 'ليس الآن')} tone={tones.secondaryNeutral} onClick={dismiss} />
            </motion.div>
          </Collapse>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Animates to its content's height, so text that changes length doesn't jump. */
function AutoHeight({ transition, children }: { transition: Transition; children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  // Unset until measured: animating from 'auto' would measure a (scaled) viewport box.
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
    <motion.div initial={false} animate={height == null ? undefined : { height }} transition={transition}>
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}

/** Figma Label-2 SemiBold: 15/18, tracking -0.26. */
const LABEL: CSSProperties = { fontFamily: 'var(--font-noon)', fontWeight: 600, fontSize: 15, lineHeight: '18px', letterSpacing: -0.26 }

/** FieldButton (H52) with the sheet's Label-2 text style, which isn't one of the Field text tokens. */
function LabelButton({ title, tone, isLoading = false, onClick }: { title: string; tone: ButtonTone; isLoading?: boolean; onClick: () => void }) {
  return (
    <Pressable
      onClick={onClick}
      disabled={isLoading}
      aria-label={title}
      style={{
        position: 'relative',
        width: '100%',
        height: 52,
        borderRadius: 12,
        background: tone.background,
        boxShadow: tone.border ? `inset 0 0 0 1px ${tone.border}` : undefined,
        color: tone.foreground,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.span animate={{ opacity: isLoading ? 0 : 1 }} transition={field.standard(field.duration.sm)} style={{ ...LABEL, whiteSpace: 'nowrap' }}>
        {title}
      </motion.span>
      <motion.span
        animate={{ opacity: isLoading ? 1 : 0 }}
        transition={field.standard(field.duration.sm)}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
      >
        {isLoading && <Spinner color={tone.foreground} />}
      </motion.span>
    </Pressable>
  )
}
