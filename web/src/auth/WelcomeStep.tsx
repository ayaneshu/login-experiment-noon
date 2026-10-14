import { useLayoutEffect, useRef } from 'react'
import { useFlow, useLang, useReportCenter } from '../app/context'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { FieldButton, tones } from '../ui/Button'
import { Art, assetURL } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { FooterLinks } from './IdentifyStep'
import { AuthTitle, Links } from './shared'

/** "Welcome to noon" (Figma 1109:9154): the My Account landing in the separate flow, with two clear
 *  paths, "Log in" and "Create new account". Country, language and the carousel only show here.
 *  A port of WelcomeStep.swift. */
export function WelcomeStep({ onOpen, onFoldHeight }: { onOpen: (url: string) => void; onFoldHeight: (h: number) => void }) {
  const flow = useFlow()
  const lang = useLang()

  // At rest the sheet ends just under "Create new account"; pulling it up brings the footer out
  // from under the nav (Figma 1109:9154). So only the height above the fold is reported (Swift:
  // onGeometryChange), in layout pixels.
  const foldRef = useRef<HTMLDivElement | null>(null)
  const report = useRef(onFoldHeight)
  report.current = onFoldHeight
  useLayoutEffect(() => {
    const el = foldRef.current
    if (!el) return
    report.current(parseFloat(getComputedStyle(el).height) || el.offsetHeight)
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0]
      report.current(box ? box.blockSize : el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const ctaRef = useReportCenter<HTMLButtonElement>((p) => {
    flow.ctaAnchor = p
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div ref={foldRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AuthTitle title={t(lang, 'Welcome to noon', 'أهلاً بك في نون')} subtitle={t(lang, 'Log in or sign up in to your account', 'سجّل الدخول أو أنشئ حساباً')} />

        <FieldButton buttonRef={ctaRef} title={t(lang, 'Log in', 'تسجيل الدخول')} tone={tones.neutral} onClick={() => flow.openLogin()} />

        <FieldButton
          title={t(lang, 'Create new account', 'إنشاء حساب جديد')}
          tone={tones.secondary}
          size="h52"
          leadingIcon="system-plus"
          textStyle="a16SemiBold"
          onClick={() => flow.openSignup()}
        />
      </div>

      <div style={{ paddingTop: 16 }}>
        <WelcomeFooter onOpen={onOpen} />
      </div>
    </div>
  )
}

/** The build label from the design. */
const APP_VERSION = 'V2026.01.2214'

/** The footer of the new screens: Policies · Sell on noon, four social icons spread across, and the
 *  copyright line (Figma "Social icons + Links"). */
export function WelcomeFooter({ onOpen }: { onOpen: (url: string) => void }) {
  const lang = useLang()
  const year = String(new Date().getFullYear())
  const social = (art: string, name: string, url: string) => (
    <Pressable
      key={name}
      scale={0.94}
      onClick={() => onOpen(url)}
      aria-label={t(lang, `noon on ${name}`, `نون على ${name}`)}
      style={{ width: 40, height: 40, flex: 'none', borderRadius: 10, background: colour.surface.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <img src={assetURL(art)} alt="" draggable={false} style={{ width: 40, height: 40, objectFit: 'contain' }} />
    </Pressable>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ alignSelf: 'stretch' }}>
        <FooterLinks onOpen={onOpen} />
      </div>

      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', padding: '0 48px' }}>
        {social(Art.socialFacebook, 'Facebook', Links.facebook)}
        {social(Art.socialX, 'X', Links.x)}
        {social(Art.socialLinkedIn, 'LinkedIn', Links.linkedIn)}
        {social(Art.socialInstagram, 'Instagram', Links.instagram)}
      </div>

      <div style={{ height: 18, display: 'flex', alignItems: 'center', gap: 12, ...type.b12Regular, color: colour.text.muted, whiteSpace: 'nowrap' }}>
        <span>{APP_VERSION}</span>
        <span aria-hidden style={{ width: 2, height: 2, borderRadius: 1, background: colour.border.medium, flex: 'none' }} />
        <span>{t(lang, `© ${year} noon. All Rights Reserved`, `© ${year} نون. جميع الحقوق محفوظة`)}</span>
      </div>
    </div>
  )
}
