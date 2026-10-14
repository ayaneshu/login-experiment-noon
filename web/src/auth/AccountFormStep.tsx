import { AnimatePresence, motion } from 'motion/react'
import { useFlow, useLang, useReportCenter } from '../app/context'
import { softRise, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { FieldButton, tones } from '../ui/Button'
import type { HelperTone } from '../ui/Controls'
import { HelperText, Shake } from '../ui/Controls'
import { Pressable } from '../ui/Pressable'
import { IdentifierField, Slide } from './IdentifierInput'
import { ConsentLine, DomainChips, TypoFix } from './IdentifyStep'
import { AuthTitle } from './shared'

export interface AccountFormStepProps {
  /** From the top padding to the button's bottom edge (the button sits 324pt below the sheet top). */
  stageHeight: number
  errorShakes: number
  /** The identifier field's focus (Swift `isFocused` binding). */
  focused: boolean
  setFocused: (v: boolean) => void
  onCountryTap: () => void
  onOpen: (url: string) => void
  /** Keyboard put away after opening from checkout or a link: the sheet hugs the form at the bottom,
   *  20 between title, field and button (Figma 1268:126419). */
  resting?: boolean
}

/** Log in and Sign up in the separate flow (Figma 1106:8916, 1106:106976, 1126:35302): one screen
 *  that changes its title, field rules and button with the step, so switching between them with the
 *  header chip morphs in place and keeps what was typed.
 *
 *  Log in takes email or phone and checks on Continue; a new email goes on to Sign up. Sign up takes
 *  email only: a number turns the
 *  field red, and "Agree & get OTP" stays dimmed until the email is valid. */
export function AccountFormStep({ stageHeight, errorShakes, focused, setFocused, onCountryTap, onOpen, resting = false }: AccountFormStepProps) {
  const flow = useFlow()
  const lang = useLang()
  const isSignup = flow.step === 'signup'
  const dimmed = isSignup && !flow.canSubmitSignup

  const fieldRef = useReportCenter<HTMLDivElement>((p) => {
    flow.fieldAnchor = p
  })
  const ctaRef = useReportCenter<HTMLButtonElement>((p) => {
    flow.ctaAnchor = p
  })

  const title = isSignup ? t(lang, 'Create account with email id', 'أنشئ حساباً بالبريد الإلكتروني') : t(lang, 'Log in to your account', 'سجّل الدخول إلى حسابك')
  const subtitle = isSignup
    ? t(lang, 'It takes less than a minute.', 'لن يستغرق الأمر أكثر من دقيقة.')
    : flow.entryIsDirect
      ? // From checkout or a link they may be new or returning (Figma 1268:126419).
        t(lang, 'Get started or pick up where you left off', 'ابدأ الآن أو تابِع من حيث توقفت')
      : t(lang, 'Use your email or phone number to continue.', 'استخدم بريدك الإلكتروني أو رقم هاتفك للمتابعة.')
  const ctaTitle = isSignup
    ? flow.foundOnSignup != null
      ? t(lang, 'Continue to log in', 'تابِع لتسجيل الدخول')
      : t(lang, 'Agree & get OTP', 'أوافق وأرسل الرمز')
    : t(lang, 'Continue', 'متابعة')

  return (
    <div
      // Taps around the sheet never take focus from the field (UIKit keeps the keyboard up); the
      // header and Back put it away.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
      }}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: stageHeight }}
    >
      {/* The title and subtitle cross-fade with the step. */}
      <div style={{ display: 'grid' }}>
        <AnimatePresence initial={false}>
          <motion.div key={flow.step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.smooth} style={{ gridArea: '1 / 1', minWidth: 0 }}>
            <AuthTitle title={title} subtitle={subtitle} bottomPadding={resting ? 0 : 24} />
          </motion.div>
        </AnimatePresence>
      </div>

      <Slide style={{ marginTop: 20 }}>
        <Shake trigger={errorShakes}>
          <div ref={fieldRef}>
            <IdentifierField focused={focused} setFocused={setFocused} onCountryTap={onCountryTap} />
          </div>
        </Shake>
      </Slide>

      <Slide>
        <FormSupport focused={focused} />
      </Slide>

      {/* The button holds a fixed spot above the keyboard so helper text and chips never push it. */}
      <div style={{ flex: 1, minHeight: 20 }} />

      {/* The consent line belongs to the button that accepts it; it goes once the email turns out to
          have an account. */}
      <AnimatePresence initial={false} mode="popLayout">
        {isSignup && flow.foundOnSignup == null && (
          <Slide key="consent" {...softRise} transition={spring.smooth} style={{ paddingBottom: 12 }}>
            <Slide>
              <ConsentLine onOpen={onOpen} />
            </Slide>
          </Slide>
        )}
      </AnimatePresence>

      <Slide>
        <FieldButton
          title={ctaTitle}
          tone={tones.neutral}
          isLoading={flow.isSending}
          onClick={() => flow.submitIdentifier()}
          buttonRef={ctaRef}
          style={{ opacity: dimmed ? 0.4 : 1, pointerEvents: dimmed ? 'none' : undefined, transition: 'opacity 0.15s ease-out' /* Motion.tint */ }}
        />
        {dimmed && (
          <span style={VISUALLY_HIDDEN}>{t(lang, 'Enter a valid email first', 'أدخل بريداً إلكترونياً صحيحاً أولاً')}</span>
        )}
      </Slide>
    </div>
  )
}

const VISUALLY_HIDDEN = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' } as const

// MARK: - Under the field

/** What appears between the field and the button on Log in / Sign up: the helper line, the
 *  "Continue with email" link, a typo fix and domain chips. */
function FormSupport({ focused }: { focused: boolean }) {
  const flow = useFlow()
  const lang = useLang()
  const hint = flow.hint
  const showsError = flow.showsInputError || flow.signupPhoneError

  /** Says exactly what's missing instead of "Invalid input". */
  const inputError = () => {
    switch (flow.kind) {
      case 'unknown':
        return flow.step === 'signup'
          ? t(lang, 'Enter your email address to continue', 'أدخل بريدك الإلكتروني للمتابعة')
          : t(lang, 'Enter your email or mobile number to continue', 'أدخل بريدك الإلكتروني أو رقم جوالك للمتابعة')
      case 'phone':
        return t(
          lang,
          'Logging in with phone number is not available. Please use your email address to log in.',
          'تسجيل الدخول برقم الهاتف غير متاح. يرجى استخدام بريدك الإلكتروني لتسجيل الدخول.',
        )
      case 'email':
        return t(lang, 'Enter a valid email, like name@example.com', 'أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com')
    }
  }

  const helper: { text: string; tone: HelperTone } | null = flow.signupPhoneError
    ? { text: t(lang, 'You can only sign up with an email address', 'يمكنك إنشاء حساب بالبريد الإلكتروني فقط'), tone: 'error' }
    : flow.showsInputError
      ? { text: inputError(), tone: 'error' }
      : flow.lookup.type === 'returning'
        ? { text: t(lang, 'Welcome back!', 'أهلاً بعودتك!'), tone: 'success' }
        : null
  const typo = hint.type === 'typo' && !showsError ? hint.email : null
  const domains = hint.type === 'domains' && focused && !showsError ? hint.domains.slice(0, 3) : null

  return (
    <div aria-live="polite" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence initial={false} mode="popLayout">
        {helper && (
          <Slide key={`helper:${helper.text}`} {...softRise} transition={spring.smooth} style={{ paddingTop: 8 }}>
            <HelperText text={helper.text} tone={helper.tone} />
          </Slide>
        )}
        {flow.phoneHasNoAccount && (
          <Slide key="email" {...softRise} transition={spring.smooth} style={{ paddingTop: 2, display: 'flex' }}>
            <Pressable
              scale={0.97}
              onClick={() => flow.continueWithEmail()}
              style={{ ...type.a16SemiBold, color: colour.text.action, padding: '0 8px', minHeight: 44, display: 'flex', alignItems: 'center', textAlign: 'start' }}
            >
              {t(lang, 'Continue with email', 'تابِع بالبريد الإلكتروني')}
            </Pressable>
          </Slide>
        )}
        {typo != null && (
          <Slide key="typo" {...softRise} transition={spring.smooth} style={{ paddingTop: 4 }}>
            <TypoFix suggestion={typo} onAccept={() => flow.applyCorrection(typo)} />
          </Slide>
        )}
        {domains && (
          <Slide key="domains" {...softRise} transition={spring.smooth} style={{ paddingTop: 20 }}>
            <DomainChips domains={domains} onPick={(d) => flow.applyDomain(d)} />
          </Slide>
        )}
      </AnimatePresence>
    </div>
  )
}
