import { useEffect } from 'react'
import type { Transition } from 'motion/react'
import { motion, useReducedMotion } from 'motion/react'
import { useFlow, useLang, useScreen } from '../app/context'
import { swiftSpring } from '../design/motion'
import { idDisplay } from '../model/identifier'
import { ltr, t } from '../model/lang'
import type { Account } from '../model/services'
import { Art, ArtGlyph } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

const SYSTEM_BLUE = '#0088FF'
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Arabic", system-ui, sans-serif'

/** "Use Face ID to sign in?" (Figma 1123:138623): the system passkey sheet a saved account sees after
 *  tapping "Log in with Face ID". It scans on its own; ✕ (or a cancelled scan) sends a code instead,
 *  and two misses fall back to a code too (see `AuthFlow.signInWithPasskey`). The Face ID animation
 *  itself plays in the phone frame's Dynamic Island. A port of FaceIDPromptSheet.swift. */
export function FaceIDPromptSheet({ account }: { account: Account }) {
  const flow = useFlow()
  const lang = useLang()
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const scanning = flow.biometricState === 'scanning'
  const present: Transition = isStatic ? { duration: 0 } : reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.5, 0)

  useEffect(() => {
    if (isStatic) return
    // The sheet settles, then the scan starts by itself, like the system sheet.
    const id = window.setTimeout(() => flow.signInWithPasskey(), 650)
    return () => window.clearTimeout(id)
    // Once, on appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const title = t(lang, 'Use Face ID to sign in?', 'استخدام بصمة الوجه لتسجيل الدخول؟')
  const identifier = ltr(idDisplay(account.identifier))

  return (
    <div role="dialog" aria-modal aria-label={title} style={{ position: 'absolute', inset: 0 }}>
      <motion.div
        aria-hidden
        initial={isStatic ? false : { opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={present}
        style={{ position: 'absolute', inset: 0, background: '#000' }}
      />

      <motion.div
        initial={isStatic ? false : { y: 460 }}
        animate={{ y: 0 }}
        transition={present}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
          padding: '70px 32px 34px',
          background: '#FFFFFF',
          borderRadius: '38px 38px 24px 24px',
          boxShadow: '0 15px 75px rgba(0, 0, 0, 0.18)',
          color: '#000',
          fontFamily: SF,
        }}
      >
        {/* Face ID glyph, title and the system's explanation. */}
        <span style={{ padding: 8, display: 'flex' }}>
          <ArtGlyph name={Art.faceID} size={48} color={SYSTEM_BLUE} />
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 8px 24px', textAlign: 'start' }}>
          <h2 style={{ margin: 0, fontFamily: SF, fontSize: 22, fontWeight: 700, lineHeight: '28px', letterSpacing: -0.26 }}>{title}</h2>
          <p style={{ margin: 0, fontFamily: SF, fontSize: 17, fontWeight: 400, lineHeight: '22px', letterSpacing: -0.43 }}>
            {t(
              lang,
              `Verify for “${identifier}” will be saved in Passwords and available on all your devices.`,
              `سيتم حفظ التحقق لـ “${identifier}” في كلمات المرور وسيكون متاحاً على جميع أجهزتك.`,
            )}
          </p>
        </div>

        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* Breathes while the scan runs. */}
          <motion.span
            aria-hidden
            initial={false}
            animate={{ opacity: scanning ? [1, 0.6] : 1 }}
            transition={scanning && !isStatic ? { duration: 0.6, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' } : { duration: 0.6, ease: 'easeInOut' }}
            style={{ display: 'flex' }}
          >
            <ArtGlyph name={Art.faceID} size={48} color={SYSTEM_BLUE} />
          </motion.span>
          <span style={{ fontFamily: SF, fontSize: 16, lineHeight: '21px', color: SYSTEM_BLUE }}>Face ID</span>
        </div>

        <Pressable
          scale={0.92}
          onClick={() => flow.cancelFaceIDPrompt()}
          aria-label={t(lang, 'Cancel', 'إلغاء')}
          style={{
            position: 'absolute',
            top: 16,
            insetInlineEnd: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: '#EBEBEB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* SF Symbols "xmark", 17pt medium. */}
          <svg aria-hidden width={14} height={14} viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
            <path d="M1.5 1.5 L12.5 12.5 M12.5 1.5 L1.5 12.5" stroke="#999999" strokeWidth={2.1} strokeLinecap="round" />
          </svg>
        </Pressable>
      </motion.div>
    </div>
  )
}
