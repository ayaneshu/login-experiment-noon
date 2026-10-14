import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Transition } from 'motion/react'
import { motion } from 'motion/react'
import { SAFE_BOTTOM, SAFE_TOP, SCREEN, useApp, useScreen, useReportCenter } from '../app/context'
import { Links, openLink } from '../auth/shared'
import { field, materialize } from '../design/motion'
import { colour, palette, type } from '../design/tokens'
import { idDisplay } from '../model/identifier'
import type { Lang } from '../model/lang'
import { ltr, t } from '../model/lang'
import { fullName } from '../model/services'
import { CountryFlag, FieldAvatar } from '../ui/Controls'
import type { IconName } from '../ui/Icon'
import { Art, ArtImage, assetURL, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

/** BottomNav.barHeight: the scroll content clears the tab bar. */
const NAV_BAR = 54
/** Thumbnail strip: four 47.25pt covers overlapping by 10, inset 8 each side. */
const STRIP = 4 * 47.25 - 3 * 10 + 2 * 8
/** SwiftUI sizes the page's column to its widest child, and the two thumbnail widgets can't shrink
 *  below their strips, so on the device the column is 362 wide and centred: every card sits 6.5pt
 *  from the screen edges rather than the 12 the padding asks for. Reproduced as measured. */
const COLUMN = Math.max(SCREEN.width - 2 * 12, 2 * STRIP + 12)

/** SwiftUI `.spring(duration:bounce:)`: stiffness (2π/d)², damping 4π(1−bounce)/d, mass 1. */
function swiftSpring(duration: number, bounce = 0): Transition {
  const omega = (2 * Math.PI) / duration
  return { type: 'spring', stiffness: omega * omega, damping: (4 * Math.PI * (1 - bounce)) / duration, mass: 1 }
}

/** The signed-in Account tab from the Figma file: profile, noon One, orders and wishlist, credits
 *  and settings, on the tertiary page colour. Fills its (positioned) parent and scrolls. Cards
 *  rise in when `app.accountRevealed` turns on during the celebration's landing. */
export function AccountPage() {
  const app = useApp()
  const lang = app.lang
  const revealed = app.accountRevealed

  const version = t(lang, 'Version 4.63.0, designed with care in every detail.', 'الإصدار 4.63.0، صُمّم بعناية في كل التفاصيل.')
  const joined = app.sessionIsNew
    ? t(lang, 'You joined noon today. Welcome!', 'انضممت إلى نون اليوم. أهلاً بك!')
    : t(lang, 'You joined the noon app in June 2022.', 'انضممت إلى تطبيق نون في يونيو 2022.')

  return (
    <div style={{ position: 'absolute', inset: 0, overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', background: colour.surface.tertiary }}>
      <div
        style={{
          width: COLUMN,
          margin: '0 auto',
          padding: `${SAFE_TOP + 8}px 0 ${16 + NAV_BAR + SAFE_BOTTOM}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Stays put so the avatar can land exactly in it; fades up as the avatar arrives. */}
        <motion.div
          initial={false}
          animate={{ opacity: revealed ? 1 : 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: revealed ? 0.18 : 0 }}
          style={{ pointerEvents: revealed ? undefined : 'none' }}
        >
          <ProfileCard />
        </motion.div>
        <Rise revealed={revealed} order={1} style={{ display: 'flex', gap: 12 }}>
          <ThumbnailWidget title={t(lang, 'My Orders', 'طلباتي')} images={[1, 2, 3, 4].map((n) => `order-${n}`)} />
          <ThumbnailWidget title={t(lang, 'My Wishlist', 'قائمة أمنياتي')} images={[1, 2, 3, 4].map((n) => `wish-${n}`)} />
        </Rise>
        <Rise revealed={revealed} order={2}>
          <CreditsRow />
        </Rise>
        <Rise revealed={revealed} order={3}>
          <SettingsCard
            rows={[
              { kind: 'link', icon: 'system-location', title: t(lang, 'Addresses', 'العناوين') },
              { kind: 'link', icon: 'system-payment-card-small', title: t(lang, 'Manage Cards', 'إدارة البطاقات') },
              { kind: 'link', icon: 'system-return-package', title: t(lang, 'Returns', 'المرتجعات') },
              { kind: 'link', icon: 'system-cross-shield', title: t(lang, 'Warranty claims', 'مطالبات الضمان') },
              { kind: 'language' },
              { kind: 'country' },
            ]}
          />
        </Rise>
        <Rise revealed={revealed} order={4}>
          <SettingsCard
            rows={[
              { kind: 'link', icon: 'system-preferences', title: t(lang, 'Preferences', 'التفضيلات') },
              { kind: 'link', icon: 'system-notification', title: t(lang, 'Notifications', 'الإشعارات') },
            ]}
          />
        </Rise>
        <Rise revealed={revealed} order={5}>
          <SettingsCard rows={[{ kind: 'link', icon: 'system-user-shield', title: t(lang, 'Account security', 'أمان الحساب') }, { kind: 'signOut' }]} />
        </Rise>
        <Rise revealed={revealed} order={6} style={{ padding: '16px 0', borderRadius: 16, background: colour.surface.primary }}>
          <Footer lang={lang} />
        </Rise>
        <Rise revealed={revealed} order={7} style={{ ...type.b12Regular, color: colour.text.muted, textAlign: 'center', padding: '12px 40px', whiteSpace: 'pre-line' }}>
          {`${joined}\n${version}`}
        </Rise>
      </div>
    </div>
  )
}

/** Cards rise into the page one after another while the sheet finishes filling the screen. */
function Rise({ revealed, order, style, children }: { revealed: boolean; order: number; style?: CSSProperties; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={materialize({ opacity: revealed ? 1 : 0, blur: revealed ? 0 : 4, y: revealed ? 0 : 24 })}
      transition={{ ...swiftSpring(0.6), delay: revealed ? 0.05 * order : 0 }}
      style={{ pointerEvents: revealed ? undefined : 'none', ...style }}
    >
      {children}
    </motion.div>
  )
}

// MARK: - Profile

function ProfileCard() {
  const app = useApp()
  const { isStatic } = useScreen()
  const lang = app.lang
  const account = app.session
  // Measured so the celebration knows where to land (static thumbnails don't need it).
  const avatarRef = useReportCenter<HTMLDivElement>((p) => {
    app.avatarCenter = p
  })
  const initial = account?.firstName?.[0] ?? (account?.identifier.type === 'email' ? account.identifier.email[0]?.toUpperCase() : undefined) ?? null
  const name = (account && fullName(account)) ?? t(lang, 'Welcome to noon', 'أهلاً بك في نون')
  const oneLine: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }

  return (
    <div style={{ position: 'relative', background: colour.surface.primary, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', height: 80 }}>
        {/* The celebration's avatar is flying in to take this spot. */}
        <div ref={isStatic ? undefined : avatarRef} style={{ display: 'flex', flex: 'none', opacity: app.celebration == null ? 1 : 0 }}>
          <FieldAvatar initial={initial} size={48} variant="neutral" />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span style={{ ...type.h18Bold, color: colour.text.primary, ...oneLine }}>{name}</span>
          {account && <span style={{ ...type.b12Regular, color: colour.text.tertiary, ...oneLine }}>{ltr(idDisplay(account.identifier))}</span>}
        </div>
        <Pressable
          scale={0.92}
          aria-label={t(lang, 'Edit profile', 'تعديل الملف الشخصي')}
          style={{ width: 44, height: 44, flex: 'none', marginInlineEnd: -4, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: colour.surface.primary,
              boxShadow: `inset 0 0 0 1px ${colour.border.primary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="system-edit" size={18} color={colour.text.primary} />
          </span>
        </Pressable>
      </div>

      <Pressable
        scale={0.99}
        style={{
          width: '100%',
          height: 46,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'start',
          // NoonBrand.noonOneCream → Orange 100, physically left to right in both languages (the
          // device doesn't mirror it).
          background: `linear-gradient(to right, #FEF8EC, ${palette.orange['100']})`,
        }}
      >
        <ArtImage name={Art.noonOne} width={40} height={24} style={{ objectFit: 'contain' }} />
        <span style={{ ...type.b14Bold, color: colour.text.primary }}>{t(lang, 'Save big with free delivery', 'وفّر أكثر مع التوصيل المجاني')}</span>
        <span style={{ flex: 1 }} />
        <Icon name="system-chevron-right" size={18} color={colour.text.tertiary} flipsRTL />
      </Pressable>

      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 16, border: `2px solid ${colour.border.white}`, pointerEvents: 'none' }} />
    </div>
  )
}

// MARK: - Widgets

function ThumbnailWidget({ title, images }: { title: string; images: string[] }) {
  return (
    <Pressable
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        textAlign: 'start',
        borderRadius: 12,
        overflow: 'hidden',
        background: colour.surface.primary,
      }}
    >
      <span style={{ ...type.b14SemiBold, color: colour.text.primary, height: 46, padding: '0 12px', display: 'flex', alignItems: 'center' }}>{title}</span>
      <span style={{ display: 'flex', direction: 'ltr', padding: '0 8px 13px' }}>
        {images.map((name, index) => (
          <span
            key={name}
            style={{
              position: 'relative',
              flex: 'none',
              width: 47.25,
              height: 63,
              marginLeft: index > 0 ? -10 : 0,
              zIndex: images.length - index,
              borderRadius: 9,
              overflow: 'hidden',
            }}
          >
            <img src={assetURL(name)} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: 9, border: `2.25px solid ${colour.border.white}` }} />
          </span>
        ))}
      </span>
    </Pressable>
  )
}

function CreditsRow() {
  const lang = useApp().lang
  return (
    <Pressable
      scale={0.99}
      aria-label={t(lang, 'noon Credits, 320.21 dirhams', 'رصيد نون، 320.21 درهم')}
      style={{
        width: '100%',
        height: 62,
        paddingInline: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 16,
        background: colour.surface.primary,
      }}
    >
      <Icon name="system-noon-wallet" size={28} color={colour.text.secondary} />
      <span style={{ ...type.b14Medium, color: colour.text.primary }}>{t(lang, 'noon Credits', 'رصيد نون')}</span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          height: 34,
          paddingInlineStart: 12,
          paddingInlineEnd: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 999,
          background: colour.surface.secondary,
        }}
      >
        {/* Noontree's UAE dirham sign. It's also the "dhm" ligature, but tracking switches
            ligatures off, so use the glyph itself. */}
        <span style={{ ...type.b14SemiBold, color: colour.text.primary, direction: 'ltr' }}>{'320.21'}</span>
        <Icon name="system-chevron-right" size={14} color={colour.text.tertiary} flipsRTL />
      </span>
    </Pressable>
  )
}

// MARK: - Settings

type SettingsRow = { kind: 'link'; icon: IconName; title: string } | { kind: 'language' } | { kind: 'country' } | { kind: 'signOut' }

const rowID = (row: SettingsRow) => (row.kind === 'link' ? row.icon : row.kind)

function SettingsCard({ rows }: { rows: SettingsRow[] }) {
  const app = useApp()
  const lang = app.lang
  const chevron = <Icon name="system-chevron-right" size={14} color={colour.text.tertiary} flipsRTL />

  const rowView = (row: SettingsRow) => {
    switch (row.kind) {
      case 'link':
        return (
          <RowButton>
            <RowLabel icon={row.icon} title={row.title}>
              {chevron}
            </RowLabel>
          </RowButton>
        )
      case 'language':
        return (
          <RowLabel icon="system-language" title={t(lang, 'Language', 'اللغة')}>
            <MiniLanguageToggle current={app.lang} onToggle={() => app.toggleLanguage()} />
          </RowLabel>
        )
      case 'country':
        return (
          <RowButton>
            <RowLabel icon="system-world" title={t(lang, 'Country', 'الدولة')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CountryFlag country={app.market} width={24} height={18} />
                {chevron}
              </span>
            </RowLabel>
          </RowButton>
        )
      case 'signOut':
        return (
          <RowButton onClick={() => app.signOut()}>
            <RowLabel icon="system-sign-out" title={t(lang, 'Sign out', 'تسجيل الخروج')} />
          </RowButton>
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0', borderRadius: 16, background: colour.surface.primary }}>
      {rows.map((row, index) => (
        <div key={rowID(row)}>
          {index > 0 && <div aria-hidden style={{ height: 1, margin: '0 16px', background: colour.border.subtle }} />}
          {rowView(row)}
        </div>
      ))}
    </div>
  )
}

function RowLabel({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 50, width: '100%' }}>
      <Icon name={icon} size={20} color={colour.text.secondary} />
      <span style={{ ...type.b14Medium, color: colour.text.primary }}>{title}</span>
      <span style={{ flex: 1 }} />
      {children}
    </span>
  )
}

/** RowPressStyle: the row washes to the secondary surface while it's held; no scale. */
export function RowButton({ onClick, children, style }: { onClick?: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <motion.button type="button" onClick={onClick} initial="rest" animate="rest" whileTap="pressed" style={{ position: 'relative', display: 'block', width: '100%', textAlign: 'start', ...style }}>
      <motion.span
        aria-hidden
        variants={{ rest: { opacity: 0 }, pressed: { opacity: 1 } }}
        transition={field.standard(field.duration.xs)}
        style={{ position: 'absolute', inset: 0, background: colour.surface.secondary }}
      />
      {children}
    </motion.button>
  )
}

/** The Language row's compact switch: white handle on a tertiary track. The handle slides between
 *  the segments' measured layout boxes (offsetLeft/offsetWidth, which the phone's CSS scale doesn't
 *  touch) instead of a shared-layout animation. */
function MiniLanguageToggle({ current, onToggle }: { current: Lang; onToggle: () => void }) {
  const [shown, setShown] = useState<Lang>(current)
  const [handle, setHandle] = useState<{ x: number; width: number; instant: boolean } | null>(null)
  const enRef = useRef<HTMLSpanElement>(null)
  const arRef = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)
  useEffect(() => setShown(current), [current])
  useLayoutEffect(() => {
    let alive = true
    // The first placement (and a font reflow) jumps; a change of language slides.
    const measure = (instant: boolean) => {
      const el = (shown === 'en' ? enRef : arRef).current
      if (!alive || !el) return
      const x = el.offsetLeft
      const width = el.offsetWidth
      setHandle((prev) => (prev && prev.x === x && prev.width === width ? prev : { x, width, instant }))
    }
    measure(!placed.current)
    placed.current = true
    // Widths change once Noontree has loaded.
    void document.fonts?.ready.then(() => measure(true))
    return () => {
      alive = false
    }
  }, [shown])

  const segment = (lang: Lang, title: string, size: number) => {
    const isOn = shown === lang
    return (
      <span
        ref={lang === 'en' ? enRef : arRef}
        style={{
          position: 'relative',
          height: 28,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--font-noon)',
          fontWeight: isOn ? 600 : 500,
          fontSize: size,
          lineHeight: '16px',
          letterSpacing: 0,
          color: isOn ? colour.text.primary : colour.text.muted,
          transition: 'color 0.2s',
        }}
      >
        {title}
      </span>
    )
  }

  return (
    <Pressable
      onClick={() => {
        setShown(shown === 'en' ? 'ar' : 'en')
        setTimeout(onToggle, 200)
      }}
      aria-label={current === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      style={{ position: 'relative', display: 'flex', flex: 'none', padding: 3, borderRadius: 999, background: colour.surface.tertiary, direction: 'ltr' }}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ x: handle?.x ?? 3, width: handle?.width ?? 0, opacity: handle ? 1 : 0 }}
        transition={handle?.instant ? { duration: 0 } : field.snappySpring}
        style={{ position: 'absolute', top: 3, left: 0, height: 28, borderRadius: 999, background: colour.surface.primary, boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)' }}
      />
      {segment('en', 'English', 12)}
      {segment('ar', 'العربية', 14)}
    </Pressable>
  )
}

// MARK: - Footer

/** AuthFooter (IdentifyStep.swift): Policies · Sell on noon ↗, four social tiles, and the version ·
 *  copyright line. A local copy so this page doesn't depend on the identify step's file. */
function Footer({ lang }: { lang: Lang }) {
  const year = new Date().getFullYear()
  const dot = <span aria-hidden style={{ width: 2, height: 2, borderRadius: 1, background: colour.border.medium, flex: 'none' }} />
  const social = (art: string, name: string, url: string) => (
    <Pressable
      scale={0.96}
      onClick={() => openLink(url)}
      aria-label={t(lang, `noon on ${name}`, `نون على ${name}`)}
      style={{ flex: 1, minWidth: 0, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: colour.surface.secondary }}
    >
      <ArtImage name={art} width={40} height={40} style={{ objectFit: 'contain' }} />
    </Pressable>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ ...type.b12Regular, color: colour.text.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 22, paddingTop: 4, whiteSpace: 'nowrap' }}>
        <Pressable scale={0.96} onClick={() => openLink(Links.policies)}>
          {t(lang, 'Policies', 'السياسات')}
        </Pressable>
        {dot}
        <Pressable scale={0.96} onClick={() => openLink(Links.sellOnNoon)} style={{ display: 'flex', alignItems: 'center' }}>
          {t(lang, 'Sell on noon', 'بِع على نون')}
          <Icon name="system-arrow-up-right-bold" size={12} flipsRTL />
        </Pressable>
      </div>

      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        {social(Art.socialFacebook, 'Facebook', Links.facebook)}
        {social(Art.socialX, 'X', Links.x)}
        {social(Art.socialLinkedIn, 'LinkedIn', Links.linkedIn)}
        {social(Art.socialInstagram, 'Instagram', Links.instagram)}
      </div>

      <div style={{ ...type.b12Regular, color: colour.text.muted, display: 'flex', alignItems: 'center', gap: 12, height: 18, whiteSpace: 'nowrap' }}>
        <span>V2026.01.2214</span>
        {dot}
        <span>{t(lang, `© ${year} noon. All Rights Reserved`, `© ${year} نون. جميع الحقوق محفوظة`)}</span>
      </div>
    </div>
  )
}
