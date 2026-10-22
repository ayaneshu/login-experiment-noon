import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useFlow, useLang, useReportCenter, useScreen } from '../app/context'
import { softRise, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { FieldButton, tones } from '../ui/Button'
import type { HelperTone } from '../ui/Controls'
import { HelperText, Shake } from '../ui/Controls'
import { Art, ArtGlyph, Glyph, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { IdentifierField, Slide } from './IdentifierInput'
import { ConsentLine, DomainChips, TypoFix } from './IdentifyStep'
import { AuthTitle, Links } from './shared'

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

  const title = isSignup
    ? flow.isOct16
      ? t(lang, 'Sign up with email', 'أنشئ حساباً بالبريد الإلكتروني')
      : t(lang, 'Create account with email id', 'أنشئ حساباً بالبريد الإلكتروني')
    : t(lang, 'Log in to your account', 'سجّل الدخول إلى حسابك')
  const subtitle = isSignup
    ? t(lang, 'It takes less than a minute.', 'لن يستغرق الأمر أكثر من دقيقة.')
    : flow.entryIsDirect
      ? // From checkout or a link they may be new or returning (Figma 1268:126419).
        t(lang, 'Get started or pick up where you left off', 'ابدأ الآن أو تابِع من حيث توقفت')
      : t(lang, 'Use your email or phone number to continue.', 'استخدم بريدك الإلكتروني أو رقم هاتفك للمتابعة.')
  const ctaTitle = isSignup
    ? flow.foundOnSignup != null
      ? t(lang, 'Continue to log in', 'تابِع لتسجيل الدخول')
      : flow.signupNeedsConsentBox
        ? // The checkbox does the agreeing (Saudi Arabia).
          t(lang, 'Get OTP', 'أرسل الرمز')
        : t(lang, 'Agree & get OTP', 'أوافق وأرسل الرمز')
    : flow.phoneHasNoAccount
      ? t(lang, 'Continue with email', 'تابِع بالبريد الإلكتروني')
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
            <Slide>{flow.signupNeedsConsentBox ? <ConsentCheckbox onOpen={onOpen} /> : <ConsentLine onOpen={onOpen} />}</Slide>
          </Slide>
        )}
      </AnimatePresence>

      {/* 16 Oct: when Log in finds nothing, Continue steps aside for the ways on under the error. */}
      <AnimatePresence initial={false} mode="popLayout">
        {!flow.loginFoundNothing && (
          <Slide key="cta" {...softRise} transition={spring.smooth}>
            <FieldButton
              title={ctaTitle}
              tone={tones.neutral}
              isLoading={flow.isSending}
              onClick={() => (flow.phoneHasNoAccount ? flow.continueWithEmail() : flow.submitIdentifier())}
              buttonRef={ctaRef}
              style={{ opacity: dimmed ? 0.4 : 1, pointerEvents: dimmed ? 'none' : undefined, transition: 'opacity 0.15s ease-out' /* Motion.tint */ }}
            />
            {dimmed && (
              <span style={VISUALLY_HIDDEN}>{t(lang, 'Enter a valid email first', 'أدخل بريداً إلكترونياً صحيحاً أولاً')}</span>
            )}
          </Slide>
        )}
      </AnimatePresence>
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
        // Only an unfinished number gets here; one with no account gets the calm note below.
        return flow.isOct16
          ? t(lang, 'Please enter a valid phone number', 'يرجى إدخال رقم هاتف صحيح')
          : t(lang, 'Enter your full mobile number to continue', 'أدخل رقم جوالك كاملاً للمتابعة')
      case 'email':
        return t(lang, 'Enter a valid email, like name@example.com', 'أدخل بريداً إلكترونياً صحيحاً، مثل name@example.com')
    }
  }

  const helper: { text: string; tone: HelperTone } | null = flow.signupPhoneError
    ? { text: t(lang, 'You can only sign up with an email address', 'يمكنك إنشاء حساب بالبريد الإلكتروني فقط'), tone: 'error' }
    : flow.loginFoundNothing
      ? flow.phoneHasNoAccount
        ? { text: t(lang, 'No account is linked with this phone number', 'لا يوجد حساب مرتبط بهذا الرقم'), tone: 'error' }
        : { text: t(lang, 'No account exists with this email yet! Make sure the spelling is correct', 'لا يوجد حساب بهذا البريد الإلكتروني بعد! تأكّد من كتابته بشكل صحيح'), tone: 'error' }
      : flow.showsInputError
      ? { text: inputError(), tone: 'error' }
      : flow.lookup.type === 'returning'
        ? { text: t(lang, 'Welcome back!', 'أهلاً بعودتك!'), tone: 'success' }
        : flow.phoneHasNoAccount
          ? { text: t(lang, 'No account uses this number yet.', 'لا يوجد حساب بهذا الرقم بعد.'), tone: 'secondary' }
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
        {flow.loginFoundNothing && (
          <Slide key={flow.phoneHasNoAccount ? 'ways:phone' : 'ways:email'} {...softRise} transition={spring.smooth} style={{ paddingTop: 16 }}>
            <WaysOn found={flow.phoneHasNoAccount ? 'noPhone' : 'noEmail'} />
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

// MARK: - 16 Oct

/** Log in found nothing (Figma 1555:221030): the ways on, stacked under the error. A number offers
 *  an email log in or a sign up; an email offers the sign up, carrying it over. `found` is a prop so
 *  the chips keep their words while they fade out. */
function WaysOn({ found }: { found: 'noPhone' | 'noEmail' }) {
  const flow = useFlow()
  const lang = useLang()
  const chips =
    found === 'noPhone'
      ? [
          { key: 'email', icon: <ArtGlyph name={Art.email} size={18} color={colour.text.primary} />, title: t(lang, 'Login with email instead', 'سجّل الدخول بالبريد الإلكتروني بدلاً من ذلك'), onClick: () => flow.continueWithEmail() },
          { key: 'signup', title: t(lang, 'Signup with email', 'أنشئ حساباً بالبريد الإلكتروني'), onClick: () => flow.signUpInstead() },
        ]
      : [{ key: 'signup', icon: <ArtGlyph name={Art.email} size={18} color={colour.text.primary} />, title: t(lang, 'Sign up instead', 'أنشئ حساباً بدلاً من ذلك'), onClick: () => flow.signUpInstead() }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
      {chips.map((chip, i) => (
        <WayOnChip key={chip.key} index={i} icon={chip.icon} title={chip.title} onClick={chip.onClick} />
      ))}
    </div>
  )
}

/** M-NeutralRoundButton, H44: a pill on the secondary surface with a hairline border, and a
 *  chevron (its Icon Right) saying it leads on. The chips rise in one after another, just after
 *  the error line, so the eye lands on them. */
function WayOnChip({ index, icon, title, onClick }: { index: number; icon?: ReactNode; title: string; onClick: () => void }) {
  const { isStatic } = useScreen()
  return (
    <motion.div
      initial={isStatic ? false : softRise.initial}
      animate={softRise.animate}
      transition={{ ...spring.smooth, delay: 0.12 + index * 0.1 }}
    >
      <Pressable
        scale={0.96}
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 44,
          padding: '0 16px',
          borderRadius: 999,
          background: colour.surface.secondary,
          boxShadow: `inset 0 0 0 1px ${colour.border.primary}`,
          color: colour.text.primary,
        }}
      >
        {icon}
        <span style={{ ...type.a14SemiBold, whiteSpace: 'nowrap' }}>{title}</span>
        <Icon name="system-chevron-right" size={16} color={colour.text.secondary} flipsRTL style={{ marginInlineStart: 2 }} />
      </Pressable>
    </motion.div>
  )
}

/** Saudi Arabia's TnC (Figma 1555:211463): a checkbox the customer ticks before "Get OTP". The
 *  whole line toggles it; tapping "Get OTP" unticked shakes it and outlines the box in red. */
function ConsentCheckbox({ onOpen }: { onOpen: (url: string) => void }) {
  const flow = useFlow()
  const lang = useLang()
  const checked = flow.consentChecked
  const nudged = flow.consentNudges > 0 && !checked
  const url = Links.privacyPolicy(lang)
  return (
    <Shake trigger={flow.consentNudges}>
      <div
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => flow.setConsentChecked(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            flow.setConsentChecked(!checked)
          }
        }}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0 8px', cursor: 'pointer', textAlign: 'start' }}
      >
        <Glyph
          src={checked ? '/art/icons/checkbox-on.svg' : '/art/icons/checkbox-off.svg'}
          size={20}
          color={checked ? colour.text.primary : nudged ? colour.text.error : colour.text.tertiary}
          style={{ transition: 'background-color 0.15s ease-out' }}
        />
        <p style={{ ...type.b12Regular, color: colour.text.tertiary, margin: 0, flex: 1, minWidth: 0 }}>
          {t(lang, 'I agree to the ', 'أوافق على ')}
          <a
            href={url}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpen(url)
            }}
            style={{ ...type.b12Medium, color: colour.text.action, textDecoration: 'none' }}
          >
            {t(lang, 'Privacy Policy', 'سياسة الخصوصية')}
          </a>
          {t(lang, ' & consent to receiving marketing communications.', ' وعلى تلقّي الرسائل التسويقية.')}
        </p>
      </div>
    </Shake>
  )
}
