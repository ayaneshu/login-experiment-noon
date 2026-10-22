import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useFlow, useLang, useReportCenter } from '../app/context'
import { iconSwap, spring, swiftSpring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { idDisplay } from '../model/identifier'
import { t } from '../model/lang'
import type { RememberedAccount } from '../model/services'
import { DashedLine, LabeledDivider } from '../ui/Button'
import { HelperText } from '../ui/Controls'
import { Glyph, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { Spinner } from '../ui/Spinner'
import { MiddleTruncated, Reveal } from './PasskeyFoundSheet'

/** Choose your account in Variant - 16 Oct (Figma 1555:216483): the saved account is one row that
 *  logs straight in (Face ID with a passkey, a code without), then the other ways in as a list. */
export function SavedAccountChoices({ remembered }: { remembered: RememberedAccount }) {
  const flow = useFlow()
  const lang = useLang()
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SavedAccountRow remembered={remembered} />
        <Reveal show={flow.biometricState === 'failed'} gap={8} transition={spring.smooth}>
          <HelperText tone="error" text={t(lang, "Face ID didn't recognise you. Try again or log in with OTP.", 'لم يتعرّف Face ID عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق.')} />
        </Reveal>
      </div>

      <LabeledDivider label={t(lang, 'OR', 'أو')} dashed />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '4px 0',
          paddingInlineEnd: 4,
          borderRadius: 16,
          background: colour.surface.primary,
          boxShadow: `inset 0 0 0 1px ${colour.border.primary}`,
          overflow: 'hidden',
        }}
      >
        <ChoiceRow
          icon={<Glyph src="/art/icons/sign-in.svg" size={20} color={colour.text.primary} flipsRTL />}
          title={t(lang, 'Log in with another account', 'سجّل الدخول بحساب آخر')}
          divider
          onClick={() => flow.useDifferentAccount()}
        />
        <ChoiceRow
          icon={<Glyph src="/art/icons/plus-bold.svg" size={18} color={colour.text.primary} />}
          title={t(lang, 'Create new account', 'أنشئ حساباً جديداً')}
          onClick={() => flow.createAccountFromRemembered()}
        />
      </div>
    </>
  )
}

/** The saved account: initial, address and how it logs in, with a chevron that turns into the
 *  loader while a code is on its way. */
function SavedAccountRow({ remembered }: { remembered: RememberedAccount }) {
  const flow = useFlow()
  const lang = useLang()
  const account = remembered.account
  const display = idDisplay(account.identifier)
  const initial = account.firstName ? Array.from(account.firstName)[0] : account.identifier.type === 'email' ? account.identifier.email[0].toUpperCase() : null
  const usesPasskey = remembered.passkeyEnabled
  const subtitle = usesPasskey ? t(lang, 'Log in with passkey', 'سجّل الدخول بمفتاح المرور') : t(lang, 'Log in with OTP', 'سجّل الدخول برمز التحقق')
  const busy = usesPasskey ? flow.biometricState === 'scanning' || flow.showsFaceIDPrompt : flow.isSending
  const ref = useReportCenter<HTMLButtonElement>((p) => {
    flow.ctaAnchor = p
  })

  return (
    <Pressable
      ref={ref}
      scale={0.98}
      aria-label={`${display}. ${subtitle}`}
      aria-busy={busy}
      onClick={() => (usesPasskey ? flow.beginFaceIDPrompt() : flow.sendCodeToRememberedAccount())}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        minHeight: 74,
        paddingInlineStart: 12,
        borderRadius: 16,
        background: colour.surface.primary,
        boxShadow: `inset 0 0 0 1px ${colour.border.subtle}, 0 4px 6px rgba(0, 0, 0, 0.08)`,
        textAlign: 'start',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          flex: 'none',
          borderRadius: 22,
          background: colour.surface.actionSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...type.h24Bold,
          fontSize: 20,
          color: colour.text.action,
        }}
      >
        {initial ?? <Icon name="bottomnav-profile" size={22} color={colour.text.action} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, padding: '16px 12px' }}>
        <MiddleTruncated text={display} style={{ ...type.b16Bold, color: colour.text.primary }} />
        <span style={{ ...type.b12Regular, color: colour.text.tertiary }}>{subtitle}</span>
      </span>
      <span style={{ position: 'relative', width: 20, height: 20, flex: 'none', marginInlineEnd: 16 }}>
        <AnimatePresence initial={false}>
          <motion.span
            key={busy ? 'busy' : 'chevron'}
            {...iconSwap}
            transition={swiftSpring(0.3, 0)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {busy ? <Spinner size={18} color={colour.surface.actionBold} /> : <Icon name="system-chevron-right" size={20} color={colour.text.tertiary} flipsRTL />}
          </motion.span>
        </AnimatePresence>
      </span>
    </Pressable>
  )
}

/** M-ListItem/Full width: a 40pt icon disc, the title and a chevron; a dashed rule under the text. */
function ChoiceRow({ icon, title, divider = false, onClick }: { icon: ReactNode; title: string; divider?: boolean; onClick: () => void }) {
  return (
    <Pressable scale={0.98} onClick={onClick} style={{ display: 'flex', alignItems: 'center', width: '100%', paddingInlineStart: 12, textAlign: 'start' }}>
      <span aria-hidden style={{ width: 40, height: 40, flex: 'none', borderRadius: 22, background: colour.surface.tertiary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        <span style={{ flex: 1, minWidth: 0, padding: '16px 12px', ...type.b14SemiBold, color: colour.text.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <Icon name="system-chevron-right" size={20} color={colour.text.tertiary} flipsRTL style={{ marginInlineEnd: 12 }} />
        {divider && (
          <span aria-hidden style={{ position: 'absolute', insetInline: 0, bottom: 0, height: 1 }}>
            <DashedLine style={{ position: 'absolute', top: 0, left: 0 }} />
          </span>
        )}
      </span>
    </Pressable>
  )
}
