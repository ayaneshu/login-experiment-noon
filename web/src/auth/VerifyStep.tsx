import type { CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MotionValue, Transition, Variants } from 'motion/react'
import { AnimatePresence, animate, motion, useAnimationControls, useIsPresent, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useApp, useFlow, useLang, usePresetUI, useReportCenter, useScreen } from '../app/context'
import { iconSwap, materialize, softRise, spring, swiftSpring } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { AuthFlow, CodeState, PasswordRules, Step } from '../model/authFlow'
import type { Lang } from '../model/lang'
import { t } from '../model/lang'
import { FieldButton, FieldNeutralTextButton, tones } from '../ui/Button'
import { Caret, HelperText, InputChrome } from '../ui/Controls'
import { Art, ArtGlyph, Icon, assetURL } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Spinner } from '../ui/Spinner'
import { Links, SentToRow, useFieldFocus } from './shared'

/** Swift's `@FocusState AuthField` (`.passwordVisible` folds into `'password'`). */
type Field = 'otp' | 'password' | null
type Mode = 'code' | 'password' | 'create'

const modeFor = (step: Step): Mode | null =>
  step === 'otp' ? 'code' : step === 'password' ? 'password' : step === 'createPassword' ? 'create' : null

/** Swift's `.timingCurve(0.23, 1, 0.32, 1, …)`. */
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const

/** SwiftUI's `spring(duration: d, bounce: 0)` as a CSS easing (critically damped: 1 − (1 + ωt)e^(−ωt),
 *  ω = 2π/d, settled at d), for colour transitions that need a per-box delay. */
const SPRING_CURVE = `linear(${Array.from({ length: 21 }, (_, i) => {
  const x = (2 * Math.PI * i) / 20
  return i === 20 ? '1' : (1 - (1 + x) * Math.exp(-x)).toFixed(3)
}).join(', ')})`
const springCSS = (props: string[], duration: number, delay = 0) => props.map((p) => `${p} ${duration}s ${SPRING_CURVE} ${delay}s`).join(', ')

/** "Enter the 6-digit code", with a password one quiet tap away on the same screen: "Enter your
 *  password" for an existing account, "Create your account" for someone signing up. Switching
 *  morphs in place: the title rewrites itself, the identity line stays put, the six code boxes slide
 *  together into one password field at the same height, and the bottom action swaps in its own spot.
 *  The keyboard stays up and changes from number pad to letters. */
export function VerifyStep({
  focus,
  setFocus,
  stageHeight,
  onOpen,
}: {
  focus: Field
  setFocus: (f: Field) => void
  /** From the top padding to the bottom action's edge (see `AuthLayout`). */
  stageHeight: number
  onOpen: (url: string) => void
}) {
  const flow = useFlow()
  const lang = useLang()
  const { isStatic } = useScreen()
  const reduce = useReducedMotion() ?? false
  const inPresence = useIsPresent()
  const [passwordShakes, setPasswordShakes] = useState(0)

  // Leaving (Change, Back), the flow has already moved on: keep showing the mode this step left in.
  const stepMode = modeFor(flow.step)
  const lastMode = useRef<Mode>(stepMode ?? 'code')
  if (stepMode) lastMode.current = stepMode
  const mode = stepMode ?? lastMode.current
  const present = inPresence && stepMode != null
  const usesPassword = mode !== 'code'

  /** One spring for the whole morph, so every part moves as one. */
  const morph: Transition = reduce ? { duration: 0.2, ease: 'easeOut' } : spring.smooth
  const busy = flow.passwordState === 'verifying' || flow.passwordState === 'verified'

  const codeRef = useReportCenter<HTMLDivElement>((p) => {
    flow.codeAnchor = p
  })
  const fieldRef = useReportCenter<HTMLDivElement>((p) => {
    flow.fieldAnchor = p
  })

  // A rejected password or a weak new one shakes the field.
  const lastPasswordState = useRef(flow.passwordState)
  useEffect(() => {
    if (lastPasswordState.current === flow.passwordState) return
    lastPasswordState.current = flow.passwordState
    if (flow.passwordState === 'failed') setPasswordShakes((n) => n + 1)
  }, [flow.passwordState])
  const lastWeakAttempts = useRef(flow.weakPasswordAttempts)
  useEffect(() => {
    if (lastWeakAttempts.current === flow.weakPasswordAttempts) return
    lastWeakAttempts.current = flow.weakPasswordAttempts
    setPasswordShakes((n) => n + 1)
  }, [flow.weakPasswordAttempts])

  const submitPassword = () => {
    if (mode === 'create') {
      flow.createAccount()
      return
    }
    if (!flow.password) {
      // Nothing typed yet: nudge the field rather than doing nothing.
      setPasswordShakes((n) => n + 1)
      setFocus('password')
      return
    }
    flow.submitPassword()
  }

  const title =
    mode === 'code'
      ? t(lang, 'Enter the 6-digit code', 'أدخل الرمز المكوّن من 6 أرقام')
      : mode === 'password'
        ? t(lang, 'Enter your password', 'أدخل كلمة المرور')
        : t(lang, 'Create your account', 'أنشئ حسابك')

  const channelIcon =
    flow.channel === 'email'
      ? ({ kind: 'template', name: Art.email } as const)
      : flow.channel === 'sms'
        ? ({ kind: 'template', name: 'mi-system-message' } as const)
        : ({ kind: 'original', name: Art.whatsapp } as const)

  const bottom = mode !== 'code' ? mode : flow.canUsePassword ? 'signIn' : flow.canCreatePassword ? 'signUp' : null

  return (
    // Title · 4 · identity line · 44 · input · notice, with the bottom action held at the typing
    // screens' fixed spot. The title-to-input gap matches the email/phone screen.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: stageHeight }}>
      <MorphTitle title={title} transition={morph} />

      {/* "Sent on … ✉︎ • Change", "Sent on +971 … via (WhatsApp) • Change", "Logging in as … • Change",
          or, when creating an account, what the password is for. */}
      <div style={stack({ paddingTop: 4 })}>
        <AnimatePresence initial={false}>
          {mode === 'create' ? (
            <Rise key="create" transition={morph}>
              <div style={{ ...type.b14Regular, color: colour.text.tertiary, padding: '0 4px', minHeight: 20 }}>
                {t(lang, 'Set a password for your account', 'عيّن كلمة مرور لحسابك')}
              </div>
            </Rise>
          ) : flow.target ? (
            <motion.div key="sentTo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={morph} style={{ gridArea: '1 / 1', minWidth: 0 }}>
              <SentToRow
                prefix={mode === 'password' ? t(lang, 'Logging in as', 'تسجيل الدخول باسم') : t(lang, 'Sent on', 'أُرسل إلى')}
                identifier={flow.target}
                suffix={mode === 'code' && flow.channel !== 'email' ? t(lang, 'via', 'عبر') : undefined}
                channelIcon={mode === 'password' ? undefined : channelIcon}
                changeTitle={t(lang, 'Change', 'تغيير')}
                onChange={() => flow.changeIdentity()}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* The shared element: the code boxes and the password field occupy the same slot. */}
      <motion.div initial={false} animate={{ height: usesPassword ? 56 : 66 }} transition={morph} style={{ position: 'relative', marginTop: 44, flex: 'none' }}>
        <div ref={codeRef} style={{ position: 'absolute', inset: 0 }}>
          <OTPBoxes flow={flow} focus={focus} setFocus={setFocus} merged={usesPassword} reduce={reduce} present={present} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          <ShakeBox trigger={passwordShakes} style={{ width: '100%' }}>
            <div ref={fieldRef} style={{ pointerEvents: usesPassword ? 'auto' : 'none' }}>
              <PasswordInput
                value={mode === 'create' ? flow.newPassword : flow.password}
                onChange={(v) => (mode === 'create' ? flow.setNewPassword(v) : flow.setPassword(v))}
                placeholder={mode === 'create' ? t(lang, 'Create a password', 'أنشئ كلمة مرور') : t(lang, 'Password', 'كلمة المرور')}
                isNew={mode === 'create'}
                error={mode === 'password' && flow.passwordState === 'failed'}
                focused={focus === 'password'}
                setFocused={(v) => {
                  if (v) setFocus('password')
                  else if (focus === 'password') setFocus(null)
                }}
                shown={usesPassword}
                onSubmit={submitPassword}
              />
            </div>
          </ShakeBox>
        </div>
      </motion.div>

      <div style={stack({ alignItems: 'start' })}>
        <AnimatePresence initial={false}>
          {mode === 'code' && (
            <Rise key="code" transition={morph} style={{ paddingTop: 20 }}>
              <CodeNotice flow={flow} />
            </Rise>
          )}
          {mode === 'password' && (
            <Rise key="password" transition={morph} style={{ paddingTop: 4 }}>
              <PasswordNotice failed={flow.passwordState === 'failed'} onForgot={() => onOpen(Links.forgotPassword)} />
            </Rise>
          )}
          {mode === 'create' && (
            <Rise key="create" transition={morph} style={{ paddingTop: 8 }}>
              <PasswordRulesHint rules={flow.passwordRules} typed={flow.newPassword !== ''} />
            </Rise>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flex: 1, minHeight: 20 }} />

      {/* The bottom action changes in its own spot: the quiet password link becomes the button. */}
      <div style={stack({ alignItems: 'end' })}>
        <AnimatePresence initial={false}>
          {bottom === 'password' && (
            <Rise key="password" transition={morph}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
                <FieldNeutralTextButton title={flow.isSeparate ? t(lang, 'Use OTP instead', 'استخدم رمز التحقق بدلاً من ذلك') : t(lang, 'Login with OTP', 'سجّل الدخول برمز التحقق')} leadingArt={Art.passwordInput} onClick={() => flow.switchToCode()} style={{ marginInline: 2 }} />
                <CtaButton flow={flow} title={t(lang, 'Log in', 'تسجيل الدخول')} isLoading={busy} onClick={submitPassword} />
              </div>
            </Rise>
          )}
          {bottom === 'create' && (
            <Rise key="create" transition={morph}>
              <CtaButton flow={flow} title={t(lang, 'Create account', 'أنشئ الحساب')} isLoading={busy} onClick={submitPassword} />
            </Rise>
          )}
          {bottom === 'signIn' && (
            <Rise key="signIn" transition={morph}>
              <div style={{ display: 'flex' }}>
                <FieldNeutralTextButton title={flow.isSeparate ? t(lang, 'Use password instead', 'استخدم كلمة المرور بدلاً من ذلك') : t(lang, 'Sign in with Password', 'سجّل الدخول بكلمة المرور')} leadingArt={Art.passwordInput} onClick={() => flow.switchToPassword()} style={{ marginInline: 2 }} />
              </div>
            </Rise>
          )}
          {bottom === 'signUp' && (
            <Rise key="signUp" transition={morph}>
              <div style={{ display: 'flex' }}>
                <FieldNeutralTextButton title={flow.isSeparate ? t(lang, 'Use password instead', 'استخدم كلمة المرور بدلاً من ذلك') : t(lang, 'Sign up with password', 'أنشئ حساباً بكلمة مرور')} leadingArt={Art.passwordInput} onClick={() => flow.switchToCreatePassword()} style={{ marginInline: 2 }} />
              </div>
            </Rise>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// MARK: - Small pieces

/** A ZStack: children share one grid cell, so a swap overlaps in place. */
const stack = (style: CSSProperties = {}): CSSProperties => ({ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', ...style })

/** `.transition(.softRise)`: small supporting content rising into place; exits are softer. */
function Rise({ children, transition, style }: { children: ReactNode; transition: Transition; style?: CSSProperties }) {
  return (
    <motion.div initial={softRise.initial} animate={softRise.animate} exit={softRise.exit} transition={transition} style={{ gridArea: '1 / 1', minWidth: 0, ...style }}>
      {children}
    </motion.div>
  )
}

/** The space a line takes in a VStack opens and closes with it, so what's below glides instead of
 *  jumping. Animates `grid-template-rows` 0fr ↔ 1fr: no measuring, so it stays exact in the scaled phone. */
function Collapse({ children, transition }: { children: ReactNode; transition: Transition }) {
  return (
    <motion.div initial={{ gridTemplateRows: '0fr' }} animate={{ gridTemplateRows: '1fr' }} exit={{ gridTemplateRows: '0fr' }} transition={transition} style={{ display: 'grid', alignSelf: 'stretch' }}>
      <div style={{ minHeight: 0 }}>{children}</div>
    </motion.div>
  )
}

/** `.shake(trigger)`: a short, decaying side-to-side shake each time `trigger` changes. */
function ShakeBox({ trigger, children, style }: { trigger: number; children: ReactNode; style?: CSSProperties }) {
  const controls = useAnimationControls()
  const last = useRef(trigger)
  useEffect(() => {
    if (trigger === last.current) return
    last.current = trigger
    void controls.start({ x: [0, -10, 8, -5, 3, 0], transition: { duration: 0.39, times: [0, 0.18, 0.38, 0.59, 0.79, 1], ease: 'easeInOut' } })
  }, [trigger, controls])
  return (
    <motion.div animate={controls} style={style}>
      {children}
    </motion.div>
  )
}

/** Page Title (AuthTitle, no bottom padding) whose text rewrites itself in place when it changes
 *  (`.contentTransition(.interpolate)`). */
function MorphTitle({ title, transition }: { title: string; transition: Transition }) {
  return (
    <div style={{ padding: '0 4px' }}>
      <h1 aria-label={title} style={{ ...type.h24Bold, color: colour.text.primary, margin: 0, display: 'grid' }}>
        <AnimatePresence initial={false}>
          <motion.span
            key={title}
            aria-hidden
            initial={{ opacity: 0, filter: 'blur(2px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(2px)' }}
            transition={transition}
            style={{ gridArea: '1 / 1' }}
          >
            {title}
          </motion.span>
        </AnimatePresence>
      </h1>
    </div>
  )
}

/** The main button, reporting its centre for the header wash and the celebration. */
function CtaButton({ flow, title, isLoading, onClick }: { flow: AuthFlow; title: string; isLoading: boolean; onClick: () => void }) {
  const ref = useReportCenter<HTMLButtonElement>((p) => {
    flow.ctaAnchor = p
  })
  return <FieldButton title={title} tone={tones.neutral} isLoading={isLoading} onClick={onClick} buttonRef={ref} />
}

// MARK: - Password

/** Under the password field: what went wrong, if anything, and the way to reset it. */
function PasswordNotice({ failed, onForgot }: { failed: boolean; onForgot: () => void }) {
  const lang = useLang()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <AnimatePresence initial={false}>
        {failed && (
          <Collapse key="failed" transition={spring.smooth}>
            <Rise transition={spring.smooth}>
              <HelperText tone="error" text={t(lang, 'Password failed. Retry or use OTP.', 'تعذّر تسجيل الدخول. أعد المحاولة أو استخدم رمز التحقق.')} />
            </Rise>
          </Collapse>
        )}
      </AnimatePresence>
      <Pressable scale={0.97} onClick={onForgot} style={{ ...type.b14Medium, color: colour.text.action, paddingInlineStart: 8, paddingTop: 8, textAlign: 'start' }}>
        {t(lang, 'Forgot password?', 'نسيت كلمة المرور؟')}
      </Pressable>
    </div>
  )
}

/** The password input in M-InputText chrome. Always mounted while verifying, so switching from the
 *  code keeps the keyboard up and only changes its layout. */
function PasswordInput({
  value,
  onChange,
  placeholder,
  isNew,
  error,
  focused,
  setFocused,
  shown,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  /** Creating an account: offer a strong new password instead of filling a saved one. */
  isNew: boolean
  error: boolean
  focused: boolean
  setFocused: (v: boolean) => void
  shown: boolean
  onSubmit: () => void
}) {
  const lang = useLang()
  const preset = usePresetUI()
  const [reveals, setReveals] = useState(preset.showPassword ?? false)
  const ref = useRef<HTMLInputElement | null>(null)
  const fieldFocus = useFieldFocus(ref, focused, setFocused, 'text')

  // Switching between dots and text can move the caret; keep it at the end.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length)
  }, [reveals])

  return (
    // Arrives as the boxes join: fades up from their merged footprint, and leaves the same way.
    <motion.div
      initial={false}
      animate={materialize({ opacity: shown ? 1 : 0, blur: shown ? 0 : 3, scale: shown ? 1 : 0.98 })}
      transition={{ duration: 0.32, ease: EASE_OUT_QUINT, delay: shown ? 0.1 : 0 }}
      aria-hidden={!shown || undefined}
    >
      <InputChrome focused={focused} error={error} style={{ padding: '0 16px', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
          {value === '' && (
            <span aria-hidden style={{ position: 'absolute', insetInlineStart: 0, fontFamily: type.b16SemiBold.fontFamily, fontWeight: type.b16SemiBold.fontWeight, fontSize: type.b16SemiBold.fontSize, letterSpacing: type.b16SemiBold.letterSpacing, color: colour.text.muted, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {placeholder}
            </span>
          )}
          <input
            ref={ref}
            {...fieldFocus}
            tabIndex={shown ? fieldFocus.tabIndex : -1}
            type={reveals ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              onSubmit()
            }}
            autoComplete={isNew ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label={placeholder}
            style={{ width: '100%', height: '100%', fontFamily: type.h18Bold.fontFamily, fontWeight: type.h18Bold.fontWeight, fontSize: type.h18Bold.fontSize, color: colour.text.primary, caretColor: colour.surface.actionBold }}
          />
        </div>
        <Pressable
          scale={0.9}
          tabIndex={shown ? undefined : -1}
          // Keep the keyboard up: the field stays focused while the eye is tapped.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setReveals(!reveals)
            setFocused(true)
          }}
          aria-label={reveals ? t(lang, 'Hide password', 'إخفاء كلمة المرور') : t(lang, 'Show password', 'إظهار كلمة المرور')}
          style={{ width: 44, height: 44, marginInlineEnd: -10, flex: 'none', display: 'grid', placeItems: 'center', color: colour.surface.primaryInverted }}
        >
          <AnimatePresence initial={false}>
            <motion.span key={reveals ? 'eyeOff' : 'eye'} {...iconSwap} transition={spring.snappy} style={{ gridArea: '1 / 1', display: 'flex' }}>
              <ArtGlyph name={reveals ? Art.eyeOff : Art.eye} size={24} />
            </motion.span>
          </AnimatePresence>
        </Pressable>
      </InputChrome>
    </motion.div>
  )
}

/** What a new password still needs, in one sentence that shrinks as rules are met: unmet terms in
 *  SemiBold, then "You've got a strong password!" in green once they're all there. */
function PasswordRulesHint({ rules, typed }: { rules: PasswordRules; typed: boolean }) {
  const lang = useLang()
  return (
    <div aria-live="polite" style={stack({ padding: '0 8px' })}>
      <AnimatePresence initial={false}>
        {typed && rules.isStrong ? (
          <Rise key="strong" transition={spring.smooth}>
            <span style={{ ...type.b13Medium, color: colour.text.success }}>{t(lang, "You've got a strong password!", 'كلمة مرور قوية!')}</span>
          </Rise>
        ) : (
          <Rise key="rules" transition={spring.smooth}>
            <span style={{ ...type.b13Regular, color: colour.text.tertiary }}>{rulesSentence(lang, rules, typed)}</span>
          </Rise>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Figma: "Use 8+ characters with a number, a symbol, an uppercase and a lowercase letter", then only
 *  what's missing ("Use a symbol, an uppercase and a lowercase letter"). Before anything is typed the
 *  full sentence shows. */
function rulesSentence(lang: Lang, rules: PasswordRules, typed: boolean): ReactNode {
  if (lang !== 'en') return 'استخدم ٨ أحرف على الأقل مع رقم ورمز وحرف كبير وحرف صغير'
  const items: { article: string; term: string }[] = []
  if (!rules.number || !typed) items.push({ article: 'a ', term: 'number' })
  if (!rules.symbol || !typed) items.push({ article: 'a ', term: 'symbol' })
  if (!rules.uppercase || !typed) items.push({ article: 'an ', term: 'uppercase' })
  if (!rules.lowercase || !typed) items.push({ article: 'a ', term: 'lowercase' })
  const needsLength = !rules.length || !typed
  const bold = (text: string) => (
    <span key={text} style={{ ...type.b13SemiBold, color: colour.text.primary }}>
      {text}
    </span>
  )
  const parts: ReactNode[] = ['Use ']
  if (needsLength) {
    parts.push(bold('8+ characters'))
    if (items.length) parts.push(' with ')
  }
  items.forEach((item, index) => {
    if (index > 0) parts.push(index === items.length - 1 ? ' and ' : ', ')
    parts.push(item.article, bold(item.term))
  })
  const last = items[items.length - 1]
  if (last && (last.term === 'uppercase' || last.term === 'lowercase')) parts.push(' letter')
  return parts
}

// MARK: - Boxes

const INSTANT: Transition = { duration: 0 }
/** Autofill or paste: each digit lands with a little life. */
const CASCADE: Transition = { ...swiftSpring(0.35, 0.3) }
const TYPED: Transition = { ...swiftSpring(0.3, 0.25) }

/** A highlight that travels across the digits while the code is being checked. */
const wave = (time: number, index: number) => (Math.sin(time * 6.5 - index * 0.65) + 1) / 2

/** Six boxes (3 • 3) over one invisible input. The input does the real work (typing, paste and the
 *  browser's one-time-code suggestions); the boxes are presentation. */
function OTPBoxes({
  flow,
  focus,
  setFocus,
  merged,
  reduce,
  present,
}: {
  flow: AuthFlow
  focus: Field
  setFocus: (f: Field) => void
  /** Password mode: the boxes slide together and join into the password field. */
  merged: boolean
  reduce: boolean
  present: boolean
}) {
  const lang = useLang()
  const leaving = useApp().celebration != null
  const { isStatic } = useScreen()
  const code = flow.code
  const state = flow.codeState
  const inputRef = useRef<HTMLInputElement | null>(null)
  const boxRefs = useRef<(HTMLDivElement | null)[]>([])
  const fieldFocus = useFieldFocus(
    inputRef,
    focus === 'otp',
    (v) => {
      if (v) setFocus('otp')
      else if (focus === 'otp') setFocus(null)
    },
    'numpad',
  )

  // What the boxes display. Trails `flow.code` so an autofilled code cascades in and a rejected one
  // unwinds, digit by digit. `anim` is how the latest change animates.
  const [shown, setShownState] = useState<{ chars: string[]; anim: Transition }>(() => ({ chars: [...code], anim: TYPED }))
  const shownRef = useRef(shown.chars)
  const timers = useRef<number[]>([])
  const setShown = (chars: string[], anim: Transition) => {
    shownRef.current = chars
    setShownState({ chars, anim })
  }
  const cancelReveal = () => {
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = []
  }
  const [shakes, setShakes] = useState(0)

  /** The box the next digit goes into. Shown from the start, so the first box reads as selected the
   *  moment the step appears, before the keyboard has finished rising. */
  const activeIndex = !merged && state === 'entering' && shown.chars.length === code.length && code.length < 6 ? code.length : null

  // The selection ring: one ring that slides from box to box (explicit x, measured in layout pixels so
  // it stays exact inside the scaled phone), fading out while there's no box to select.
  const [ringAt, setRingAt] = useState(activeIndex ?? 0)
  if (activeIndex != null && activeIndex !== ringAt) setRingAt(activeIndex)
  const ringVisible = activeIndex != null
  const ringX = useMotionValue(0)
  const ringOpacity = useMotionValue(ringVisible ? 1 : 0)
  const lastRing = useRef({ at: ringAt, visible: ringVisible })
  useLayoutEffect(() => {
    const prev = lastRing.current
    lastRing.current = { at: ringAt, visible: ringVisible }
    if (prev.at !== ringAt) {
      const from = boxRefs.current[prev.at]
      const to = boxRefs.current[ringAt]
      if (prev.visible && ringVisible && from && to && !isStatic) {
        // Picks up from wherever the ring is, so fast typing never makes it jump.
        ringX.jump(ringX.get() + from.offsetLeft - to.offsetLeft)
        void animate(ringX, 0, spring.snappy)
      } else {
        ringX.jump(0)
      }
    }
    if (prev.visible !== ringVisible) {
      if (isStatic) ringOpacity.jump(ringVisible ? 1 : 0)
      else void animate(ringOpacity, ringVisible ? 1 : 0, spring.snappy)
    }
  }, [ringAt, ringVisible, isStatic, ringX, ringOpacity])

  // The verifying wave's clock: runs only while the code is being checked.
  const clock = useMotionValue(0)
  useEffect(() => {
    if (state !== 'verifying' || isStatic) return
    let frame = requestAnimationFrame(function tick(now) {
      clock.set(now / 1000)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [state, isStatic, clock])

  // Put the number pad up as soon as the step appears. Focus handed over from the email field can be
  // dropped mid-transition, so ask again once it has settled.
  const latest = useRef({ focus, merged, step: flow.step, state, present, setFocus })
  latest.current = { focus, merged, step: flow.step, state, present, setFocus }
  useEffect(() => {
    if (merged || isStatic) return
    const first = window.setTimeout(() => latest.current.setFocus('otp'), 0)
    const retry = window.setTimeout(() => {
      const l = latest.current
      if (l.present && !l.merged && l.focus !== 'otp' && l.step === 'otp' && l.state === 'entering') l.setFocus('otp')
    }, 350)
    return () => {
      window.clearTimeout(first)
      window.clearTimeout(retry)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the code: one digit springs in, a pasted or autofilled code cascades in left to right, a
  // rejected one unwinds right to left.
  useEffect(() => {
    cancelReveal()
    const target = [...code]
    const current = shownRef.current
    let common = 0
    while (common < current.length && common < target.length && current[common] === target[common]) common++
    if (common === current.length && common === target.length) return cancelReveal
    if (isStatic) {
      setShown(target, INSTANT)
    } else if (target.length - common > 1) {
      setShown(current.slice(0, common), INSTANT)
      target.slice(common).forEach((char, i) => {
        timers.current.push(window.setTimeout(() => setShown([...shownRef.current, char], CASCADE), i * 55))
      })
    } else if (current.length - target.length > 1 && common === target.length) {
      for (let i = 0; i < current.length - target.length; i++) {
        timers.current.push(window.setTimeout(() => setShown(shownRef.current.slice(0, -1), spring.quick), i * 30))
      }
    } else {
      setShown(target, TYPED)
    }
    return cancelReveal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isStatic])

  const lastState = useRef(state)
  useEffect(() => {
    if (lastState.current === state) return
    lastState.current = state
    if (state === 'verifying' && shownRef.current.join('') !== flow.code) {
      // Whatever typing speed did to the cascade, show exactly what's being checked.
      cancelReveal()
      setShown([...flow.code], spring.snappy)
    }
    if (state === 'failed' && !reduce) setShakes((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // The separator's natural width (layout pixels), so it can fold to nothing and back.
  const bulletRef = useRef<HTMLSpanElement | null>(null)
  const [bulletWidth, setBulletWidth] = useState(9)
  useLayoutEffect(() => {
    const el = bulletRef.current
    if (!el) return
    const measure = () => setBulletWidth(el.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const mergeTransition: Transition = { duration: 0.3, ease: EASE_OUT_QUINT, delay: merged ? 0.06 : 0 }
  const ring = (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        borderRadius: 12,
        background: colour.surface.primary,
        boxShadow: `inset 0 0 0 1px ${colour.surface.actionExtrabold}, 0 0 0 2px ${colour.border.action}`,
        x: ringX,
        opacity: ringOpacity,
      }}
    />
  )
  // Merging closes every gap (the separator folds away) so the six cells become one.
  const group = (indices: number[]) => (
    <motion.div initial={false} animate={{ gap: merged ? '0px' : '8px' }} transition={mergeTransition} style={{ flex: '1 1 0', minWidth: 0, display: 'flex' }}>
      {indices.map((index) => (
        <CodeBox
          key={index}
          index={index}
          boxRef={(el) => {
            boxRefs.current[index] = el
          }}
          char={shown.chars[index]}
          state={state}
          active={activeIndex === index}
          ring={ringAt === index ? ring : null}
          clock={clock}
          anim={shown.anim}
          reduce={reduce}
          isStatic={isStatic}
        />
      ))}
    </motion.div>
  )

  const caretToEnd = (e: SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const end = el.value.length
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end)
  }

  return (
    <ShakeBox trigger={shakes} style={{ position: 'relative', height: '100%', direction: 'ltr' }}>
      <input
        ref={inputRef}
        {...fieldFocus}
        value={code}
        onChange={(e) => flow.typeCode(e.target.value)}
        onPaste={(e) => {
          e.preventDefault()
          flow.paste(e.clipboardData.getData('text'))
        }}
        onSelect={caretToEnd}
        autoComplete="one-time-code"
        inputMode={fieldFocus.inputMode ?? 'numeric'}
        pattern="[0-9]*"
        maxLength={6}
        tabIndex={merged ? -1 : fieldFocus.tabIndex}
        aria-hidden={merged || undefined}
        aria-label={t(lang, 'Verification code', 'رمز التحقق')}
        aria-description={t(lang, `${code.length} of 6 digits entered`, `تم إدخال ${code.length} من 6 أرقام`)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          color: 'transparent',
          caretColor: 'transparent',
          fontSize: 16,
          cursor: 'text',
          pointerEvents: merged ? 'none' : 'auto',
        }}
      />
      {/* Signed in: the code draws in toward its centre as the avatar forms there. */}
      <motion.div
        aria-hidden
        initial={false}
        animate={{ scale: leaving ? 0.6 : 1 }}
        transition={{ duration: 0.35, ease: EASE_OUT_QUINT }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <motion.div
          initial={false}
          animate={materialize({ opacity: merged ? 0 : 1, blur: merged ? 3 : 0, scale: merged ? 0.98 : 1 })}
          transition={mergeTransition}
          style={{ position: 'relative', height: '100%', display: 'flex' }}
        >
          {group([0, 1, 2])}
          <motion.span
            initial={false}
            animate={{ width: merged ? 0 : bulletWidth + 12, opacity: merged ? 0 : 1 }}
            transition={mergeTransition}
            style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            <span ref={bulletRef} style={{ flex: 'none', whiteSpace: 'nowrap', fontFamily: 'var(--font-noon)', fontWeight: 600, fontSize: 24, lineHeight: '32px', letterSpacing: 0, color: colour.text.muted }}>
              •
            </span>
          </motion.span>
          {group([3, 4, 5])}
        </motion.div>
      </motion.div>
    </ShakeBox>
  )
}

function boxFill(state: CodeState) {
  return state === 'failed' ? colour.surface.errorSubtle : state === 'verified' ? colour.surface.successSubtle : colour.surface.secondary
}

/** Failed red, verified green; verifying draws the travelling highlight on its own layer. */
function boxStroke(state: CodeState) {
  return state === 'failed' ? colour.surface.errorBold : state === 'verified' ? colour.border.successBold : 'transparent'
}

function digitColor(state: CodeState) {
  return state === 'failed' ? colour.text.error : state === 'verified' ? colour.text.success : colour.text.primary
}

function digitVariants(reduce: boolean): Variants {
  return {
    enter: () => (reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 5, scale: 0.55, y: 8 })),
    center: (anim: Transition) => ({ ...materialize({}), transition: anim }),
    exit: (anim: Transition) => ({ ...(reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 3, scale: 0.8 })), transition: anim }),
  }
}

function CodeBox({
  index,
  boxRef,
  char,
  state,
  active,
  ring,
  clock,
  anim,
  reduce,
  isStatic,
}: {
  index: number
  boxRef: (el: HTMLDivElement | null) => void
  char: string | undefined
  state: CodeState
  active: boolean
  ring: ReactNode
  clock: MotionValue<number>
  anim: Transition
  reduce: boolean
  isStatic: boolean
}) {
  // State colours ripple across the boxes, one after another.
  const delay = index * 0.035
  const verifying = state === 'verifying'
  const verifyMix = useMotionValue(verifying ? 1 : 0)
  useEffect(() => {
    const target = verifying ? 1 : 0
    if (isStatic) {
      verifyMix.jump(target)
      return
    }
    const controls = animate(verifyMix, target, { ...spring.snappy, delay })
    return () => controls.stop()
  }, [verifying, isStatic, verifyMix, delay])
  const strokeOpacity = useTransform([clock, verifyMix], ([time, mix]: number[]) => mix * (0.15 + 0.6 * wave(time, index)))
  const digitOpacity = useTransform([clock, verifyMix], ([time, mix]: number[]) => 1 - mix * 0.65 * (1 - wave(time, index)))

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          borderRadius: 10,
          background: boxFill(state),
          boxShadow: `inset 0 0 0 1px ${boxStroke(state)}`,
          transition: springCSS(['background-color', 'box-shadow'], 0.35, delay),
        }}
      />
      <motion.div style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 10, boxShadow: `inset 0 0 0 1px ${colour.surface.actionBold}`, opacity: strokeOpacity }} />
      {ring}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center' }}>
        <AnimatePresence initial={false} custom={anim}>
          {char != null ? (
            <motion.span
              key={`${index}-${char}`}
              custom={anim}
              variants={digitVariants(reduce)}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ gridArea: '1 / 1', ...type.h32Bold, color: digitColor(state), transition: springCSS(['color'], 0.35, delay) }}
            >
              <motion.span style={{ display: 'block', opacity: digitOpacity }}>{char}</motion.span>
            </motion.span>
          ) : active ? (
            <motion.span key="caret" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.snappy} style={{ gridArea: '1 / 1', display: 'flex' }}>
              {isStatic ? <span aria-hidden style={{ width: 2, height: 28, borderRadius: 1, background: colour.surface.actionBold }} /> : <Caret height={28} />}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

// MARK: - Status

type Status = { kind: 'verifying'; text: string } | { kind: 'verified' } | { kind: 'invalid' } | { kind: 'none' }

/** Under the boxes: while a code is filled or checked it says what's happening; once verified, a
 *  green "Verified"; a rejected code gets "Invalid code." above the resend block (Figma OTP states). */
function CodeNotice({ flow }: { flow: AuthFlow }) {
  const lang = useLang()
  const status: Status =
    flow.codeState === 'verifying'
      ? {
          kind: 'verifying',
          text:
            flow.codeSource === 'messages'
              ? t(lang, 'Filled from Messages. Verifying…', 'تمت التعبئة من الرسائل. جارٍ التحقق…')
              : flow.codeSource === 'mail'
                ? t(lang, 'Filled from Mail. Verifying…', 'تمت التعبئة من البريد. جارٍ التحقق…')
                : t(lang, 'Verifying…', 'جارٍ التحقق…'),
        }
      : flow.codeState === 'verified'
        ? { kind: 'verified' }
        : flow.showsCodeError
          ? { kind: 'invalid' }
          : { kind: 'none' }

  return (
    <div style={stack({ alignItems: 'start', minHeight: 20 })}>
      <AnimatePresence initial={false}>
        {status.kind === 'verifying' && (
          <Rise key="verifying" transition={spring.smooth}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
              <Spinner size={14} color={colour.text.tertiary} />
              <span style={{ ...type.b14Regular, color: colour.text.tertiary }}>{status.text}</span>
            </div>
          </Rise>
        )}
        {status.kind === 'verified' && (
          <Rise key="verified" transition={spring.smooth}>
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', color: colour.text.success }}>
              <Icon name="system-check-circle-filled" size={14} />
              <span style={type.b13Medium}>{t(lang, 'Verified', 'تم التحقق')}</span>
            </div>
          </Rise>
        )}
        {(status.kind === 'invalid' || status.kind === 'none') && (
          <Rise key="resend" transition={spring.smooth}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <AnimatePresence initial={false}>
                {status.kind === 'invalid' && (
                  <Collapse key="invalid" transition={spring.smooth}>
                    <Rise transition={spring.smooth}>
                      <div role="alert" style={{ ...type.b13Medium, color: colour.text.error, paddingInlineStart: 8, paddingBottom: 16 }}>
                        {t(lang, 'Invalid code.', 'رمز غير صحيح.')}
                      </div>
                    </Rise>
                  </Collapse>
                )}
              </AnimatePresence>
              <ResendBlock flow={flow} />
            </div>
          </Rise>
        )}
      </AnimatePresence>
    </div>
  )
}

// MARK: - Resend

/** "Didn't receive OTP? Resend in 14s". Email: "Resend via email" once the timer runs out. Phone:
 *  "Resend on WhatsApp" and "Resend SMS" are always there, greyed out until the timer runs out. */
function ResendBlock({ flow }: { flow: AuthFlow }) {
  const lang = useLang()
  const canResend = flow.resendIn === 0 && !flow.isResending
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', minHeight: 20 }}>
        <span style={{ ...type.b14Regular, color: colour.text.tertiary, whiteSpace: 'nowrap' }}>{t(lang, 'Didn’t receive OTP?', 'لم يصلك الرمز؟')}</span>
        <span style={{ display: 'grid', alignItems: 'center' }}>
          <AnimatePresence initial={false}>
            {flow.resendIn > 0 ? (
              <Rise key="countdown" transition={spring.smooth}>
                <span style={{ ...type.b14SemiBold, color: colour.text.primary, whiteSpace: 'nowrap' }}>
                  {t(lang, 'Resend in ', 'إعادة الإرسال خلال ')}
                  <CountdownNumber value={flow.resendIn} />
                  {t(lang, 's', ' ث')}
                </span>
              </Rise>
            ) : flow.channel === 'email' ? (
              <Rise key="email" transition={spring.smooth}>
                <Pressable scale={0.96} disabled={flow.isResending} onClick={() => flow.resend('email')} style={{ minHeight: 32, display: 'grid', alignItems: 'center', justifyItems: 'start' }}>
                  <motion.span initial={false} animate={{ opacity: flow.isResending ? 0 : 1 }} transition={spring.snappy} style={{ ...type.b14SemiBold, color: colour.text.action, whiteSpace: 'nowrap', gridArea: '1 / 1' }}>
                    {t(lang, 'Resend via email', 'إعادة الإرسال عبر البريد')}
                  </motion.span>
                  {flow.isResending && (
                    <span style={{ gridArea: '1 / 1', display: 'flex' }}>
                      <Spinner size={14} color={colour.text.tertiary} />
                    </span>
                  )}
                </Pressable>
              </Rise>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
      {flow.channel !== 'email' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <ResendChip
            enabled={canResend}
            title={t(lang, 'Resend on WhatsApp', 'إعادة عبر واتساب')}
            icon={(enabled) => <img src={assetURL(Art.whatsapp)} width={16} height={16} alt="" draggable={false} style={{ width: 16, height: 16, filter: enabled ? 'none' : 'grayscale(1)', transition: springCSS(['filter'], 0.5) }} />}
            onClick={() => flow.resend('whatsapp')}
          />
          <ResendChip enabled={canResend} title={t(lang, 'Resend SMS', 'إعادة إرسال SMS')} icon={() => <Icon name="system-message" size={16} />} onClick={() => flow.resend('sms')} />
        </div>
      )}
    </div>
  )
}

/** M-NeutralRoundButton H40: tertiary and muted while counting down, white with a border once it
 *  can be tapped. */
function ResendChip({ enabled, title, icon, onClick }: { enabled: boolean; title: string; icon: (enabled: boolean) => ReactNode; onClick: () => void }) {
  const lang = useLang()
  const tween = (props: string[]) => springCSS(props, 0.5)
  return (
    <Pressable scale={0.96} disabled={!enabled} onClick={onClick} aria-description={enabled ? undefined : t(lang, 'Available when the timer ends', 'متاح عند انتهاء المؤقت')} style={{ flex: 'none', borderRadius: 999 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          height: 40,
          padding: '0 12px',
          borderRadius: 999,
          color: enabled ? colour.text.primary : colour.text.muted,
          background: enabled ? colour.surface.primary : colour.surface.tertiary,
          boxShadow: `inset 0 0 0 1px ${enabled ? colour.border.primary : 'transparent'}`,
          transition: tween(['color', 'background-color', 'box-shadow']),
        }}
      >
        <span style={{ display: 'flex', width: 16, height: 16, opacity: enabled ? 1 : 0.55, transition: tween(['opacity']) }}>{icon(enabled)}</span>
        <span style={{ ...type.b13Medium, whiteSpace: 'nowrap' }}>{title}</span>
      </span>
    </Pressable>
  )
}

/** The countdown's number, rolling digit by digit as it counts down (`.numericText(countsDown: true)`). */
function CountdownNumber({ value }: { value: number }) {
  const digits = String(value).split('')
  return (
    <span style={{ display: 'inline-flex', direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' }}>
      {digits.map((digit, i) => (
        <span key={digits.length - 1 - i} style={{ display: 'inline-grid' }}>
          <AnimatePresence initial={false}>
            <motion.span
              key={digit}
              initial={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
              transition={spring.snappy}
              style={{ gridArea: '1 / 1' }}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  )
}
