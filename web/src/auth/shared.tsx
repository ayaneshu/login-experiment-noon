import type { ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { KeyboardKind } from '../app/context'
import { useScreen } from '../app/context'
import { iconSwap } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { Lang } from '../model/lang'
import { ltr } from '../model/lang'
import type { Identifier } from '../model/identifier'
import { idDisplay } from '../model/identifier'
import { Pressable } from '../ui/Pressable'
import { assetURL, Glyph } from '../ui/Icon'

/** Where sign-in was opened from (see AppModel). */
export type { AuthEntry } from '../model/appModel'

/** What stands above the resting sheet: noon's shopping scene, the noon One card offer, or (separate
 *  Log in / Sign up flow) the welcome carousel. */
export type AuthHeaderArt = 'hero' | 'noonOne' | 'carousel'

/** Layout constants from AuthScreen.swift, in 375pt design units. Offsets are measured from the
 *  bottom of the 62pt status bar (the Figma frames' top safe area). */
export const AuthLayout = {
  safeTop: 62,
  restSheetOffset(art: AuthHeaderArt, isMyAccount: boolean) {
    if (!isMyAccount) return 401 - 62 // checkout / link: Figma 401
    // Smart field 309; tabs and Choose your account 360; separate Welcome 358.
    return art === 'hero' ? 309 - 62 : art === 'carousel' ? 358 - 62 : 360 - 62
  },
  /** Sheet padding: 20 above the title in the smart flow, 32 under a grabber, 24 while typing. */
  sheetTopPadding: 20,
  grabberTopPadding: 32,
  raisedTopPadding: 24,
  sheetBottomPadding: 20,
  chooseBottomPadding: 20,
  /** While typing, the main action sits at a fixed height in the sheet (its top 324pt below the
   *  sheet's top), so it never jumps as helper text comes and goes. */
  raisedStageHeight: 324 - 24 + 56,
  /** Typing: the sheet rises to just under the header controls. */
  raisedSheetOffset: 58,
  sheetRadius: 24,
}

export const Links = {
  privacyPolicy: (lang: Lang) => (lang === 'ar' ? 'https://www.noon.com/uae-ar/privacy-policy/' : 'https://www.noon.com/uae-en/privacy-policy/'),
  policies: 'https://www.noon.com/uae-en/terms-of-use/',
  sellOnNoon: 'https://sell.noon.com/',
  facebook: 'https://www.facebook.com/noon',
  x: 'https://x.com/noon',
  instagram: 'https://www.instagram.com/noon',
  linkedIn: 'https://www.linkedin.com/company/noon',
  noonOne: 'https://www.noon.com/uae-en/',
  /** Placeholder until the CIB noon Credit card page is confirmed. */
  creditCard: 'https://www.noon.com/uae-en/',
  forgotPassword: 'https://www.noon.com/uae-en/account/',
}

/** Opens a link the way the app's in-app browser would: a new tab here. */
export const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

/** Page Title: H24 Bold title over a B14 Regular subtitle, inset 4pt like the Figma component. */
export function AuthTitle({ title, subtitle, bottomPadding = 8 }: { title: string; subtitle?: ReactNode; bottomPadding?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: `0 4px ${bottomPadding}px` }}>
      <h1 style={{ ...type.h24Bold, color: colour.text.primary, margin: 0 }}>{title}</h1>
      {subtitle != null && <div style={{ ...type.b14Regular, color: colour.text.tertiary }}>{subtitle}</div>}
    </div>
  )
}

/** "Sent on ajain@gmail.com ✉︎ • Change", "Sent on +971 50 123 4567 via (WhatsApp) • Change". */
export function SentToRow({
  prefix,
  identifier,
  suffix,
  channelIcon,
  changeTitle,
  onChange,
}: {
  prefix: string
  identifier: Identifier
  suffix?: string
  /** Tinted like the text (email, SMS) or in brand colours (WhatsApp). */
  channelIcon?: { kind: 'template' | 'original'; name: string }
  changeTitle: string
  onChange: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', height: 20 }}>
      <span style={{ ...type.b14Regular, color: colour.text.tertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
        {`${prefix} ${ltr(idDisplay(identifier))}${suffix ? ` ${suffix}` : ''}`}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        {channelIcon && (
          <motion.span key={channelIcon.name} {...iconSwap} style={{ display: 'flex', flex: 'none' }}>
            {channelIcon.kind === 'template' ? (
              <Glyph src={assetURL(channelIcon.name)} size={16} color={colour.text.tertiary} />
            ) : (
              <img src={assetURL(channelIcon.name)} width={16} height={16} alt="" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
      <span aria-hidden style={{ width: 4, height: 4, borderRadius: 2, background: colour.text.action, margin: '0 2px', flex: 'none' }} />
      <Pressable scale={0.96} onClick={onChange} style={{ ...type.b14Medium, color: colour.text.action, minHeight: 44, margin: '-12px 0', display: 'flex', alignItems: 'center', flex: 'none' }}>
        {changeTitle}
      </Pressable>
    </div>
  )
}

/** Binds a real <input> to a focus flag owned by the screen, like a SwiftUI @FocusState: setting
 *  `focused` focuses the input (and raises the iOS keyboard of `kind`); tapping or leaving the input
 *  reports back. Static thumbnails never take real focus. Spread the returned props on the input. */
export function useFieldFocus(ref: RefObject<HTMLInputElement | null>, focused: boolean, setFocused: (v: boolean) => void, kind: KeyboardKind) {
  const { showKeyboard, hideKeyboard, isStatic, isTouch } = useScreen()
  useEffect(() => {
    if (isStatic) return
    const el = ref.current
    if (!el) return
    if (focused && document.activeElement !== el) el.focus({ preventScroll: true })
    else if (!focused && document.activeElement === el) el.blur()
  }, [focused, isStatic, ref])
  useEffect(() => {
    if (focused && !isStatic) showKeyboard(kind)
  }, [focused, kind, isStatic, showKeyboard])
  // A focused field that leaves the screen (sign-in dissolving the sheet) never reports a blur:
  // put the keyboard away with it. Checked before the DOM node goes, so a field that already
  // handed focus to the next step's field leaves the keyboard up.
  useLayoutEffect(() => {
    const el = ref.current
    return () => {
      if (el && document.activeElement === el) hideKeyboard()
    }
  }, [ref, hideKeyboard])
  return {
    onFocus: () => {
      setFocused(true)
      showKeyboard(kind)
    },
    onBlur: () => {
      setFocused(false)
      hideKeyboard()
    },
    /** On touch screens the on-screen iOS keyboard types; keep the device keyboard away. */
    inputMode: isTouch ? ('none' as const) : undefined,
    readOnly: isStatic,
    tabIndex: isStatic ? -1 : undefined,
  }
}
