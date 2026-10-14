import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useFlow, useLang, useReportCenter, useScreen } from '../app/context'
import { field, iconSwap, softRise, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { Hint } from '../model/authFlow'
import type { IdentifierKind } from '../model/identifier'
import { ltr, t } from '../model/lang'
import { FieldButton, FieldRoundButton, tones } from '../ui/Button'
import type { HelperTone } from '../ui/Controls'
import { HelperText, Shake } from '../ui/Controls'
import { Art, assetURL, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { IdentifierField, Slide } from './IdentifierInput'
import { NoonOnePromoCard } from './NoonOnePromoCard'
import { AuthTitle, Links } from './shared'

export interface IdentifyStepProps {
  /** Typing: the sheet has risen and the button holds a fixed spot above the keyboard. */
  raised: boolean
  /** From the top padding to the button's bottom edge while typing (see `AuthLayout`). */
  stageHeight: number
  errorShakes: number
  /** The identifier field's focus (Swift `isFocused` binding). */
  focused: boolean
  setFocused: (v: boolean) => void
  onCountryTap: () => void
  onOpen: (url: string) => void
  /** Height of everything above the fold, so the resting sheet can sit on the nav with the rest of
   *  the footer just below it. */
  onFoldHeight: (h: number) => void
  /** My Account carries the footer; checkout and links end at the button (Figma entry points). */
  showsFooter: boolean
}

/** "Welcome to noon": one field for email or phone. It reshapes itself as you type (a country chip
 *  slides in for numbers, domain chips appear after "@") and tells you who you are as soon as it
 *  knows. The tabs variant puts Phone number | Email above the field. */
export function IdentifyStep({ raised, stageHeight, errorShakes, focused, setFocused, onCountryTap, onOpen, onFoldHeight, showsFooter }: IdentifyStepProps) {
  const flow = useFlow()
  const lang = useLang()
  const { isStatic } = useScreen()
  /** Gentle prompts when the field is focused but nothing's been typed. */
  const [idleNudges, setIdleNudges] = useState(0)
  const isIdle = focused && flow.input === ''
  const isTabs = flow.variant === 'toggle'
  const nudging = idleNudges > 0 && isIdle

  // Focused, empty and quiet: after 4s, and once more after 9s, shake the field and say what to
  // type. Then leave them alone.
  const nudgesSoFar = useRef(idleNudges)
  nudgesSoFar.current = idleNudges
  useEffect(() => {
    if (!isIdle || isStatic) return
    const delays = [4000, 9000].slice(nudgesSoFar.current)
    let timer: number | undefined
    let index = 0
    const next = () => {
      if (index >= delays.length) return
      timer = window.setTimeout(() => {
        index += 1
        setIdleNudges((n) => n + 1)
        next()
      }, delays[index])
    }
    next()
    return () => window.clearTimeout(timer)
  }, [isIdle, isStatic])
  useEffect(() => {
    if (!focused) setIdleNudges(0)
  }, [focused])

  // Above-the-fold height (onGeometryChange), in layout pixels, only at rest.
  const foldRef = useRef<HTMLDivElement | null>(null)
  const reportFold = useRef(onFoldHeight)
  reportFold.current = onFoldHeight
  useLayoutEffect(() => {
    const el = foldRef.current
    if (!el || raised) return
    reportFold.current(parseFloat(getComputedStyle(el).height) || el.offsetHeight)
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0]
      reportFold.current(box ? box.blockSize : el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [raised])

  const fieldRef = useReportCenter<HTMLDivElement>((p) => {
    flow.fieldAnchor = p
  })
  const ctaRef = useReportCenter<HTMLButtonElement>((p) => {
    flow.ctaAnchor = p
  })

  /** Smart field: 8 at rest (Figma Page Title 64 tall), 24 while typing. Tabs: the toggle sets the gap. */
  const titleBottomPadding = isTabs ? 0 : raised ? 24 : 8
  /** Smart field: 20 under the field. Tabs: 28 (Figma field row's 12 + 16), less any helper line. */
  const buttonTopPadding = !isTabs ? 20 : supportHasContent(flow.hint, flow.showsInputError, focused, nudging) ? 20 : 28
  const ctaTitle = flow.isNewCustomer ? t(lang, 'Agree & get OTP', 'أوافق وأرسل الرمز') : t(lang, 'Sign in with OTP', 'سجّل الدخول برمز التحقق')

  return (
    <div
      // Taps around the sheet never take focus from the field (UIKit keeps the keyboard up); the
      // header and Back put it away.
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
      }}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: raised ? stageHeight : 0 }}
    >
      <div ref={foldRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}>
        <AuthTitle title={t(lang, 'Welcome to noon', 'أهلاً بك في نون')} subtitle={t(lang, 'Log in with email or phone', 'سجّل الدخول بالبريد الإلكتروني أو الهاتف')} bottomPadding={titleBottomPadding} />

        {/* Tabs flow: Phone number | Email between the title and the field. */}
        <AnimatePresence initial={false} mode="popLayout">
          {isTabs && (
            <Slide key="toggle" {...softRise} transition={spring.smooth} style={{ paddingTop: raised ? 20 : 16 }}>
              <Slide>
                <LoginMethodToggle selection={flow.method} onSelect={(m) => flow.setMethod(m)} />
              </Slide>
            </Slide>
          )}
        </AnimatePresence>

        <Slide style={{ marginTop: isTabs ? (raised ? 20 : 16) : 20 }}>
          <Shake trigger={errorShakes + idleNudges}>
            <div ref={fieldRef}>
              <IdentifierField focused={focused} setFocused={setFocused} onCountryTap={onCountryTap} />
            </div>
          </Shake>
        </Slide>

        <Slide>
          <FieldSupport focused={focused} nudging={nudging} />
        </Slide>

        {/* While typing, the button holds a fixed spot above the keyboard so helper text and chips
            never push it around. */}
        {raised && <div style={{ flex: 1, minHeight: 20 }} />}

        {/* The consent line belongs to the button that accepts it. */}
        <AnimatePresence initial={false} mode="popLayout">
          {flow.isNewCustomer && (
            <Slide key="consent" {...softRise} transition={spring.smooth} style={{ paddingTop: raised ? 0 : 20, paddingBottom: 12 }}>
              <Slide>
                <ConsentLine onOpen={onOpen} />
              </Slide>
            </Slide>
          )}
        </AnimatePresence>

        <Slide style={{ marginTop: raised || flow.isNewCustomer ? 0 : buttonTopPadding }}>
          <FieldButton title={ctaTitle} tone={tones.neutral} isLoading={flow.isSending} onClick={() => flow.submitIdentifier()} buttonRef={ctaRef} />
        </Slide>

        <AnimatePresence initial={false} mode="popLayout">
          {!raised && showsFooter && isTabs && (
            // Policies · Sell on noon peeks above the nav (Figma 921:241897).
            <Slide key="links" {...softRise} transition={spring.smooth} style={{ paddingTop: 16 }}>
              <FooterLinks onOpen={onOpen} />
            </Slide>
          )}
          {!raised && showsFooter && !isTabs && (
            <Slide key="promo" {...softRise} transition={spring.smooth} style={{ paddingTop: 20 }}>
              {/* Figma: 4pt wider than the form on each side. */}
              <div style={{ marginInline: -4 }}>
                <NoonOnePromoCard onApply={() => onOpen(Links.noonOne)} />
              </div>
            </Slide>
          )}
        </AnimatePresence>
      </div>

      {/* The rest of the footer waits under the nav; pull the sheet up to reach it. */}
      <AnimatePresence initial={false} mode="popLayout">
        {!raised && showsFooter && (
          <Slide key="footer" {...softRise} transition={spring.smooth} style={{ paddingTop: isTabs ? 12 : 20 }}>
            <AuthFooter showsLinks={!isTabs} onOpen={onOpen} />
          </Slide>
        )}
      </AnimatePresence>
    </div>
  )
}

// MARK: - Under the field

/** Whether anything shows between the field and the button. */
function supportHasContent(hint: Hint, showsInputError: boolean, focused: boolean, nudging: boolean) {
  if (showsInputError || nudging) return true
  switch (hint.type) {
    case 'returning':
    case 'new':
    case 'typo':
      return true
    case 'domains':
      return focused
    default:
      return false
  }
}

/** Everything that can appear between the field and the button: the helper line, a typo fix and
 *  domain chips. */
function FieldSupport({ focused, nudging }: { focused: boolean; nudging: boolean }) {
  const flow = useFlow()
  const lang = useLang()
  const hint = flow.hint

  /** Says exactly what's missing instead of "Invalid input". */
  const inputError = () => {
    switch (flow.kind) {
      case 'unknown':
        if (flow.variant !== 'toggle') return t(lang, 'Enter your email or mobile number to continue', 'أدخل بريدك الإلكتروني أو رقم جوالك للمتابعة')
        return flow.method === 'phone'
          ? t(lang, 'Enter your mobile number to continue', 'أدخل رقم جوالك للمتابعة')
          : t(lang, 'Enter your email address to continue', 'أدخل بريدك الإلكتروني للمتابعة')
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
  const nudge = () => {
    if (flow.variant !== 'toggle') return t(lang, 'Start typing your email or mobile number', 'ابدأ بكتابة بريدك الإلكتروني أو رقم جوالك')
    return flow.method === 'phone' ? t(lang, 'Start typing your mobile number', 'ابدأ بكتابة رقم جوالك') : t(lang, 'Start typing your email address', 'ابدأ بكتابة بريدك الإلكتروني')
  }
  const helper: { text: string; tone: HelperTone } | null = flow.showsInputError
    ? { text: inputError(), tone: 'error' }
    : nudging
      ? { text: nudge(), tone: 'action' }
      : hint.type === 'returning'
        ? { text: t(lang, 'Welcome back!', 'أهلاً بعودتك!'), tone: 'success' }
        : hint.type === 'new'
          ? { text: t(lang, 'New at noon! Get started', 'جديد على نون! لنبدأ'), tone: 'neutral' }
          : null
  const typo = hint.type === 'typo' && !flow.showsInputError ? hint.email : null
  const domains = hint.type === 'domains' && focused && !flow.showsInputError ? hint.domains.slice(0, 3) : null

  return (
    <div aria-live="polite" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence initial={false} mode="popLayout">
        {helper && (
          <Slide key={`helper:${helper.text}`} {...softRise} transition={spring.smooth} style={{ paddingTop: 8 }}>
            <HelperText text={helper.text} tone={helper.tone} />
          </Slide>
        )}
        {typo != null && (
          <Slide key="typo" {...softRise} transition={spring.smooth} style={{ paddingTop: 4 }}>
            <TypoFix suggestion={typo} onAccept={() => flow.applyCorrection(typo)} />
          </Slide>
        )}
        {domains && (
          <Slide key="domains" {...softRise} transition={spring.smooth} style={{ paddingTop: 16 }}>
            <DomainChips domains={domains} onPick={(d) => flow.applyDomain(d)} />
          </Slide>
        )}
      </AnimatePresence>
    </div>
  )
}

export function DomainChips({ domains, onPick }: { domains: string[]; onPick: (domain: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
      <AnimatePresence initial={false} mode="popLayout">
        {domains.map((domain) => (
          <Slide key={domain} {...iconSwap} transition={spring.snappy} slide={spring.snappy} style={{ flex: 'none' }}>
            <FieldRoundButton title={ltr(`@${domain}`)} onClick={() => onPick(domain)} />
          </Slide>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** "Did you mean ajain@gmail.com?" */
export function TypoFix({ suggestion, onAccept }: { suggestion: string; onAccept: () => void }) {
  const lang = useLang()
  return (
    <Pressable
      scale={0.98}
      onClick={onAccept}
      style={{ ...type.b12Medium, color: colour.text.tertiary, textAlign: 'start', width: '100%', minHeight: 32, padding: '0 8px', display: 'flex', alignItems: 'center' }}
    >
      <span>
        {t(lang, 'Did you mean ', 'هل تقصد ')}
        <span style={{ ...type.b12SemiBold, color: colour.text.action }}>{ltr(suggestion)}</span>
        {t(lang, '?', '؟')}
      </span>
    </Pressable>
  )
}

/** The consent line new customers agree to with "Agree & get OTP". */
export function ConsentLine({ onOpen }: { onOpen: (url: string) => void }) {
  const lang = useLang()
  const url = Links.privacyPolicy(lang)
  const markdown = t(
    lang,
    `By continuing, you agree to our [Privacy Policy](${url}) & consent to receiving marketing communications.`,
    `بالمتابعة، أنت توافق على [سياسة الخصوصية](${url}) وعلى تلقّي الرسائل التسويقية.`,
  )
  const match = /^([^[]*)\[([^\]]+)\]\(([^)]+)\)(.*)$/.exec(markdown)
  return (
    <p style={{ ...type.b12Regular, color: colour.text.tertiary, margin: 0, padding: '0 8px' }}>
      {match ? (
        <>
          {match[1]}
          <a
            href={match[3]}
            onClick={(e) => {
              e.preventDefault()
              onOpen(match[3])
            }}
            style={{ ...type.b12Medium, color: colour.text.action, textDecoration: 'none' }}
          >
            {match[2]}
          </a>
          {match[4]}
        </>
      ) : (
        markdown
      )}
    </p>
  )
}

// MARK: - Footer

const Dot = () => <span aria-hidden style={{ width: 2, height: 2, borderRadius: 1, background: colour.border.medium, flex: 'none' }} />

/** Policies · Sell on noon ↗ (B12, muted, a 2pt dot between). */
export function FooterLinks({ onOpen }: { onOpen: (url: string) => void }) {
  const lang = useLang()
  // Each link keeps a taller touch target without changing the 22pt row.
  const link = { padding: '11px 0', margin: '-11px 0', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' } as const
  return (
    <div style={{ height: 22, paddingTop: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...type.b12Regular, color: colour.text.muted }}>
        <Pressable scale={0.96} onClick={() => onOpen(Links.policies)} style={link}>
          {t(lang, 'Policies', 'السياسات')}
        </Pressable>
        <Dot />
        <Pressable scale={0.96} onClick={() => onOpen(Links.sellOnNoon)} style={link}>
          {t(lang, 'Sell on noon', 'بِع على نون')}
          <Icon name="system-arrow-up-right-bold" size={12} flipsRTL />
        </Pressable>
      </div>
    </div>
  )
}

/** Footer (Figma 921:241896): links, four social tiles and the version · copyright line. Only at
 *  rest, mostly below the fold. */
export function AuthFooter({ showsLinks = true, onOpen }: { showsLinks?: boolean; onOpen: (url: string) => void }) {
  const lang = useLang()
  const year = String(new Date().getFullYear())
  const social = (art: string, name: string, url: string) => (
    <Pressable
      key={name}
      scale={0.96}
      onClick={() => onOpen(url)}
      aria-label={t(lang, `noon on ${name}`, `نون على ${name}`)}
      style={{ flex: 1, minWidth: 0, height: 40, borderRadius: 10, background: colour.surface.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <img src={assetURL(art)} alt="" draggable={false} style={{ width: 40, height: 40, objectFit: 'contain' }} />
    </Pressable>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {showsLinks && <FooterLinks onOpen={onOpen} />}

      <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch' }}>
        {social(Art.socialFacebook, 'Facebook', Links.facebook)}
        {social(Art.socialX, 'X', Links.x)}
        {social(Art.socialLinkedIn, 'LinkedIn', Links.linkedIn)}
        {social(Art.socialInstagram, 'Instagram', Links.instagram)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 18, ...type.b12Regular, color: colour.text.muted, whiteSpace: 'nowrap' }}>
        <span>V2026.01.2214</span>
        <Dot />
        <span>{t(lang, `© ${year} noon. All Rights Reserved`, `© ${year} نون. جميع الحقوق محفوظة`)}</span>
      </div>
    </div>
  )
}

// MARK: - Email / Phone number toggle

/** Tabs flow: the M-Switch segmented control (secondary track, white handle that slides to the
 *  choice), Phone number first. The handle is half the track, so it slides by its own width:
 *  exact inside the scaled phone, no measuring. */
function LoginMethodToggle({ selection, onSelect }: { selection: IdentifierKind; onSelect: (kind: IdentifierKind) => void }) {
  const lang = useLang()
  const { isStatic } = useScreen()
  const index = selection === 'email' ? 1 : 0
  const segment = (kind: IdentifierKind, title: string) => {
    const isOn = selection === kind
    return (
      <Pressable
        key={kind}
        role="tab"
        aria-selected={isOn}
        onClick={() => onSelect(kind)}
        style={{ position: 'relative', flex: 1, minWidth: 0, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ ...type.b14SemiBold, color: isOn ? colour.text.primary : colour.text.tertiary, transition: 'color 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      </Pressable>
    )
  }
  return (
    <div
      role="tablist"
      style={{
        position: 'relative',
        display: 'flex',
        padding: 4,
        borderRadius: 12,
        background: colour.surface.secondary,
        // Figma M-Switch: a faint inner shadow pressed into the track.
        boxShadow: 'inset 0 1px 2px 1px rgba(36, 36, 36, 0.04)',
      }}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: `${index * (lang === 'ar' ? -100 : 100)}%` }}
        transition={isStatic ? { duration: 0 } : field.snappySpring}
        style={{
          position: 'absolute',
          top: 4,
          bottom: 4,
          insetInlineStart: 4,
          width: 'calc(50% - 4px)',
          borderRadius: 10,
          background: colour.surface.primary,
          boxShadow: '0 1px 3px rgba(34, 34, 34, 0.06)',
        }}
      />
      {segment('phone', t(lang, 'Phone number', 'رقم الهاتف'))}
      {segment('email', t(lang, 'Email', 'البريد الإلكتروني'))}
    </div>
  )
}
