import type { CSSProperties } from 'react'
import { SAFE_BOTTOM, SAFE_TOP, useApp } from './context'
import { isRTL, ltr, t } from '../model/lang'
import { ArtImage } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

/** WhatsApp's dark-mode chrome, from the Figma frame. */
const WhatsApp = {
  bar: '#171717',
  hairline: '#4B4B4D',
  blue: '#007AFF',
}

/** `.system` fonts: SF Pro / SF Arabic, with the face's natural leading (≈1.19). */
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Arabic', 'Geeza Pro', system-ui, sans-serif"
const sf = (size: number, weight = 400): CSSProperties => ({ fontFamily: SF, fontSize: size, fontWeight: weight, lineHeight: `${size * 1.193}px` })

/** SF Pro 17/22: WhatsApp's message text. (Figma's −0.41 tracking is SF's own default at this size,
 *  which the system face applies by itself; adding it again wraps the lines early.) */
const CHAT_BODY: CSSProperties = { fontFamily: SF, fontSize: 17, lineHeight: '22px' }

/** Entry point 3 (Figma "E-2b · 0 · Address link (entry)"): a WhatsApp chat where a friend has
 *  shared a noon address link. Tapping the link opens noon on Log in; "‹ 12" goes back. */
export function AddressLinkChat() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: WhatsApp.bar }}>
      {/* The doodle wallpaper runs from the top of the screen to the input bar, as in Figma. */}
      <ArtImage
        name="chat-wallpaper"
        width={375}
        height={812 - SAFE_BOTTOM}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `calc(100% - ${SAFE_BOTTOM}px)`, objectFit: 'cover', objectPosition: 'top' }}
      />
      <TitleBar />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14, padding: '24px 7px 0' }}>
        <Today />
        <Incoming />
        <Outgoing />
      </div>
      <InputBar />
    </div>
  )
}

// MARK: Title bar

function TitleBar() {
  const app = useApp()
  const lang = app.lang
  return (
    <div style={{ position: 'relative', flex: 'none', paddingTop: SAFE_TOP, background: WhatsApp.bar }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => app.closeAddressChat()}
          aria-label={t(lang, 'Back to chats', 'العودة إلى الدردشات')}
          style={{ flex: 'none', width: 61, display: 'flex', justifyContent: 'flex-start' }}
        >
          <span style={{ display: 'flex', alignItems: 'flex-start', gap: 5, padding: '10px 9px' }}>
            <ArtImage name="chat-chevron-left" width={11.98} height={20.79} style={{ transform: isRTL(lang) ? 'scaleX(-1)' : undefined }} />
            <span style={{ ...sf(17), height: 22, lineHeight: '22px', color: WhatsApp.blue }}>12</span>
          </span>
        </button>

        <div style={{ alignSelf: 'stretch', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 8, paddingTop: 3 }}>
          <ArtImage name="chat-avatar" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'var(--font-noon)', fontWeight: 600, fontSize: 18, lineHeight: '22px', height: 22, color: '#FFFFFF' }}>Ayush Kapoor</span>
            <span style={{ ...sf(12), color: '#898989' }}>{t(lang, 'typing...', 'يكتب...')}</span>
          </div>
        </div>

        <span style={{ flex: 1, minWidth: 0 }} />

        <div aria-hidden style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 22, paddingInlineEnd: 15 }}>
          <ArtImage name="chat-video" width={24} height={24} />
          <ArtImage name="chat-audio" width={24} height={24} />
        </div>
      </div>
      <Hairline edge="bottom" />
    </div>
  )
}

function Hairline({ edge }: { edge: 'top' | 'bottom' }) {
  return <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, [edge]: 0, height: 0.5, background: WhatsApp.hairline }} />
}

// MARK: Messages

function Today() {
  const lang = useApp().lang
  return (
    <span
      style={{
        ...sf(12, 600),
        alignSelf: 'center',
        padding: '2px 34px',
        borderRadius: 6,
        background: 'rgba(23, 23, 23, 0.9)',
        boxShadow: '0 -1px 1px rgba(140, 140, 140, 0.2)',
        color: '#A0A0A0',
      }}
    >
      {t(lang, 'Today', 'اليوم')}
    </span>
  )
}

/** The friend's message: map preview, the request and the noon link. */
function Incoming() {
  const app = useApp()
  const lang = app.lang
  const rtl = isRTL(lang)
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'flex-end', filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2))' }}>
      <ArtImage name="chat-tail-in" width={8} height={15} style={{ transform: rtl ? undefined : 'scaleX(-1)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 3, borderRadius: 6, background: '#3C3C3E' }}>
        <ArtImage name="chat-map-preview" width={284} height={156} alt={t(lang, 'Shared location', 'موقع مُشارَك')} style={{ borderRadius: 4 }} />
        <div style={{ width: 274, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ alignSelf: 'flex-start', width: 266, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ ...CHAT_BODY, color: '#FFFFFF' }}>{t(lang, 'Hey, please use this address to send the order 👇🏻', 'مرحباً، استخدم هذا العنوان لإرسال الطلب 👇🏻')}</span>
            <Pressable
              scale={0.98}
              onClick={() => app.followAddressLink()}
              aria-description={t(lang, 'Opens noon', 'يفتح نون')}
              style={{ ...CHAT_BODY, color: '#48B0FF', textDecoration: 'underline', textAlign: 'start' }}
            >
              {/* Breaks after "z75u/" as in Figma. */}
              {ltr('https://noon.onelink.me/z75u/')}
              <br />
              {ltr('bhsxqr9p')}
            </Pressable>
          </div>
          <Timestamp color="#828287" style={{ height: 16 }} />
        </div>
      </div>
    </div>
  )
}

/** The reply. Figma draws its bubble at a fixed 126pt, with the time tucked under the text. */
function Outgoing() {
  const lang = useApp().lang
  return (
    <div style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'flex-end', filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2))' }}>
      <div style={{ position: 'relative', width: 290, height: 126, padding: 8, borderRadius: 6, background: '#056162' }}>
        <span style={{ ...CHAT_BODY, display: 'block', color: '#FFFFFF' }}>{t(lang, 'Ohh, thanks Rahul for the address! 😄', 'شكراً يا راهول على العنوان! 😄')}</span>
        <div style={{ position: 'absolute', top: 38, insetInlineEnd: 8, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          <Timestamp color="rgba(255, 255, 255, 0.2)" />
          <ArtImage name="chat-ticks" width={15} height={14} />
        </div>
      </div>
      <ArtImage name="chat-tail-out" width={8} height={15} style={{ transform: isRTL(lang) ? 'scaleX(-1)' : undefined }} />
    </div>
  )
}

function Timestamp({ color, style }: { color: string; style?: CSSProperties }) {
  const lang = useApp().lang
  return <span style={{ ...sf(12, 500), color, whiteSpace: 'nowrap', ...style }}>{t(lang, '9:41 AM', '9:41 ص')}</span>
}

// MARK: Input bar

function InputBar() {
  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `10px 13px ${6 + SAFE_BOTTOM}px`,
        background: WhatsApp.bar,
      }}
    >
      <Hairline edge="top" />
      <ArtImage name="chat-plus" width={24} height={24} style={{ marginInlineEnd: 9 }} />
      <div
        style={{
          flex: 'none',
          width: 230,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingInlineEnd: 6,
          borderRadius: 15,
          background: '#2C2C2E',
          boxShadow: `inset 0 0 0 1px ${WhatsApp.hairline}`,
        }}
      >
        <ArtImage name="chat-sticker" width={24} height={24} />
      </div>
      <ArtImage name="chat-camera" width={24} height={24} style={{ marginInlineStart: 17 }} />
      <ArtImage name="chat-mic" width={24} height={24} style={{ marginInlineStart: 17 }} />
    </div>
  )
}
