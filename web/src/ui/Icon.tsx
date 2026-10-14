import type { CSSProperties } from 'react'
import manifest from '../design/assetManifest.json'

/** M-Icon names (FieldIconName in Swift); files live at /assets/mi-<name>.svg. */
export type IconName =
  | 'system-check-circle-filled' | 'system-caret-down' | 'system-arrow-up-right-bold' | 'system-vetricle-three-dot-menu'
  | 'system-chevron-right' | 'system-chevron-down' | 'system-edit' | 'system-location' | 'system-payment-card-small'
  | 'system-return-package' | 'system-cross-shield' | 'system-language' | 'system-world' | 'system-preferences'
  | 'system-notification' | 'system-user-shield' | 'system-sign-out' | 'system-noon-wallet' | 'system-arrow-left'
  | 'system-cross' | 'system-warning-circle-filled' | 'system-message' | 'system-bin' | 'system-lock' | 'system-refresh'
  | 'system-info-circle' | 'system-plus' | 'system-search'
  | 'bottomnav-home' | 'bottomnav-home-filled' | 'bottomnav-categories' | 'bottomnav-categories-filled'
  | 'bottomnav-deals-bag' | 'bottomnav-deals-bag-filled' | 'bottomnav-profile' | 'bottomnav-profile-filled'
  | 'bottomnav-cart' | 'bottomnav-cart-filled'

/** Artwork from the Log in / Sign up file (FieldArt in Swift), by asset name. */
export const Art = {
  faceID: 'icon-face-id',
  passwordAlt: 'icon-password-alt',
  email: 'icon-email',
  passwordInput: 'icon-password-input',
  biometric: 'biometric-illustration',
  biometricFace: 'biometric-face',
  biometricFingerprint: 'biometric-fingerprint',
  noonOne: 'noon-one',
  sparkle: 'sparkle',
  heroIllustration: 'hero-illustration',
  flagAE: 'flag-ae',
  noonOneBoxes: 'noon-one-boxes',
  noonOneCard: 'noon-one-card',
  noonOneCardShadow: 'noon-one-card-shadow',
  noonOnePromoArt: 'noon-one-promo-art',
  sparkleBullet: 'sparkle-bullet',
  whatsapp: 'icon-whatsapp',
  noonWordmark: 'noon-wordmark',
  biometricOn: 'biometric-on',
  biometricFaceOnGrey: 'biometric-face-secondary',
  eye: 'icon-eye',
  eyeOff: 'icon-eye-off',
  socialFacebook: 'social-facebook',
  socialX: 'social-x',
  socialLinkedIn: 'social-linkedin',
  socialInstagram: 'social-instagram',
} as const

/** URL of an exported asset by its Xcode imageset name (see scripts/export_assets.py). */
export function assetURL(name: string) {
  const file = (manifest as Record<string, string>)[name]
  return `/assets/${file ?? `${name}.svg`}`
}

/** A template glyph that takes `color` (currentColor by default), like `.renderingMode(.template)`. */
export function Glyph({ src, size, width, height, color = 'currentColor', style, flipsRTL = false }: { src: string; size?: number; width?: number; height?: number; color?: string; style?: CSSProperties; flipsRTL?: boolean }) {
  const w = width ?? size ?? 24
  const h = height ?? size ?? 24
  return (
    <span
      aria-hidden
      className={flipsRTL ? 'flips-rtl' : undefined}
      style={{
        display: 'inline-block',
        flex: 'none',
        width: w,
        height: h,
        backgroundColor: color,
        WebkitMask: `url(${src}) center / contain no-repeat`,
        mask: `url(${src}) center / contain no-repeat`,
        ...style,
      }}
    />
  )
}

/** An M-Icon glyph, tinted with `color`. Directional icons pass `flipsRTL`. */
export function Icon({ name, size = 24, color, style, flipsRTL }: { name: IconName; size?: number; color?: string; style?: CSSProperties; flipsRTL?: boolean }) {
  return <Glyph src={`/assets/mi-${name}.svg`} size={size} color={color} style={style} flipsRTL={flipsRTL} />
}

/** Template artwork (face ID, wordmark, eye…) tinted like text. */
export function ArtGlyph({ name, size, width, height, color, style, flipsRTL }: { name: string; size?: number; width?: number; height?: number; color?: string; style?: CSSProperties; flipsRTL?: boolean }) {
  return <Glyph src={assetURL(name)} size={size} width={width} height={height} color={color} style={style} flipsRTL={flipsRTL} />
}

/** Full-colour artwork. */
export function ArtImage({ name, width, height, style, alt = '' }: { name: string; width: number; height: number; style?: CSSProperties; alt?: string }) {
  return <img src={assetURL(name)} width={width} height={height} alt={alt} draggable={false} style={{ width, height, flex: 'none', ...style }} />
}
