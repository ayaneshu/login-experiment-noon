import type { CSSProperties, ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { blurReplace, field } from '../design/motion'
import type { TextStyleName } from '../design/tokens'
import { colour, type } from '../design/tokens'
import { ArtGlyph, Icon } from './Icon'
import type { IconName } from './Icon'
import { Pressable } from './Pressable'
import { Spinner } from './Spinner'

export type ButtonSize = 'h56' | 'h52' | 'h48'

const SIZE: Record<ButtonSize, { height: number; text: TextStyleName; radius: number; icon: number }> = {
  h56: { height: 56, text: 'a17SemiBold', radius: 12, icon: 24 },
  h52: { height: 52, text: 'a16SemiBold', radius: 12, icon: 24 },
  h48: { height: 48, text: 'a14SemiBold', radius: 10, icon: 20 },
}

export interface ButtonTone {
  background: string
  pressed: string
  foreground: string
  border?: string
}

export const tones = {
  /** M-NeutralButton: filled near-black. */
  neutral: { background: colour.surface.primaryInverted, pressed: colour.surface.secondaryInverted, foreground: colour.text.onSurfaceBold },
  /** M-PrimaryButton: filled blue. */
  primary: { background: colour.surface.actionBold, pressed: colour.surface.actionExtrabold, foreground: colour.text.onSurfaceBold },
  /** M-SecondaryButton: white with a soft blue outline and a blue label. */
  secondary: { background: colour.surface.primary, pressed: colour.surface.actionSubtle, foreground: colour.text.action, border: colour.border.action },
  /** M-SecondaryNeutralButton: outline neutral. */
  secondaryNeutral: { background: colour.surface.primary, pressed: colour.surface.secondary, foreground: colour.text.primary, border: colour.border.primary },
} satisfies Record<string, ButtonTone>

/** Rectangular Field button (Neutral / Primary / Secondary / Secondary-Neutral). The label
 *  blur-replaces when it changes; loading swaps it for a spinner or a pulsing glyph. */
export function FieldButton({
  title,
  tone = tones.neutral,
  size = 'h56',
  leadingArt,
  leadingIcon,
  leadingSize,
  trailingIcon,
  textStyle,
  isLoading = false,
  loadingArt,
  onClick,
  buttonRef,
  style,
}: {
  title: string
  tone?: ButtonTone
  size?: ButtonSize
  /** Template artwork name (e.g. Art.faceID) before the label. */
  leadingArt?: string
  leadingIcon?: IconName
  leadingSize?: number
  /** A directional glyph after the label; mirrors in Arabic. */
  trailingIcon?: IconName
  /** A token name, or a one-off style for a screen's own type (the cart's Checkout). */
  textStyle?: TextStyleName | CSSProperties
  isLoading?: boolean
  /** Pulses instead of a spinner while loading, when the wait has a meaning (Face ID). */
  loadingArt?: string
  onClick?: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
  style?: CSSProperties
}) {
  const s = SIZE[size]
  const iconSize = leadingSize ?? s.icon
  return (
    <Pressable
      ref={buttonRef}
      onClick={onClick}
      disabled={isLoading}
      aria-label={title}
      style={{
        position: 'relative',
        width: '100%',
        height: s.height,
        borderRadius: s.radius,
        background: tone.background,
        boxShadow: tone.border ? `inset 0 0 0 1px ${tone.border}` : undefined,
        color: tone.foreground,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <motion.span
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={field.standard(field.duration.sm)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        {leadingArt && <ArtGlyph name={leadingArt} size={iconSize} />}
        {leadingIcon && <Icon name={leadingIcon} size={iconSize} />}
        <span style={{ display: 'grid' }}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={title} {...blurReplace} transition={field.snappySpring} style={{ ...(typeof textStyle === 'object' ? textStyle : type[textStyle ?? s.text]), whiteSpace: 'nowrap', gridArea: '1 / 1' }}>
              {title}
            </motion.span>
          </AnimatePresence>
        </span>
        {trailingIcon && <Icon name={trailingIcon} size={size === 'h48' ? 20 : 24} flipsRTL />}
      </motion.span>
      <motion.span
        animate={{ opacity: isLoading ? 1 : 0 }}
        transition={field.standard(field.duration.sm)}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
      >
        {isLoading && (loadingArt ? <ArtGlyph name={loadingArt} size={s.icon + 4} style={{ animation: 'pulse 1s ease-in-out infinite' }} /> : <Spinner color={tone.foreground} />)}
      </motion.span>
    </Pressable>
  )
}

/** M-TextButtonBlue: low-emphasis blue label with an optional trailing chevron. */
export function FieldTextButtonBlue({ title, showsChevron = false, textStyle = 'a14SemiBold', onClick, style }: { title: string; showsChevron?: boolean; textStyle?: TextStyleName; onClick?: () => void; style?: CSSProperties }) {
  return (
    <Pressable onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: colour.text.action, padding: '0 8px', minHeight: 28, ...style }}>
      <span style={type[textStyle]}>{title}</span>
      {showsChevron && <Icon name="system-chevron-right" size={20} flipsRTL />}
    </Pressable>
  )
}

/** M-TextButtonNeutral: quiet inline action in the primary text tone. */
export function FieldNeutralTextButton({ title, leadingArt, onClick, buttonRef, style }: { title: string; leadingArt?: string; onClick?: () => void; buttonRef?: React.Ref<HTMLButtonElement>; style?: CSSProperties }) {
  return (
    <Pressable ref={buttonRef} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: colour.text.primary, padding: '0 6px', minHeight: 44, ...style }}>
      {leadingArt && <ArtGlyph name={leadingArt} size={20} />}
      <span style={{ display: 'grid' }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={title} {...blurReplace} transition={field.snappySpring} style={{ ...type.a14SemiBold, whiteSpace: 'nowrap', gridArea: '1 / 1' }}>
            {title}
          </motion.span>
        </AnimatePresence>
      </span>
    </Pressable>
  )
}

/** M-NeutralRoundButton: pill chip for compact actions (email domains, resend channels). */
export function FieldRoundButton({ title, leading, tint = colour.text.primary, fill = colour.surface.tertiary, onClick, style }: { title: string; leading?: ReactNode; tint?: string; fill?: string; onClick?: () => void; style?: CSSProperties }) {
  return (
    <Pressable scale={0.96} onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: tint, background: fill, borderRadius: 999, padding: '0 12px', height: 36, flex: 'none', ...style }}>
      {leading}
      <span style={{ ...type.b13Medium, whiteSpace: 'nowrap' }}>{title}</span>
    </Pressable>
  )
}

/** A 1pt dashed rule in the border colour (4 on, 3 off). */
export function DashedLine({ color = colour.border.primary, style }: { color?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden height={1} style={{ width: '100%', display: 'block', overflow: 'visible', ...style }}>
      <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={color} strokeWidth={1} strokeDasharray="4 3" />
    </svg>
  )
}

/** M-Divider with an inline label, e.g. "OR". */
export function LabeledDivider({ label, dashed = false }: { label: string; dashed?: boolean }) {
  const rule = dashed ? <DashedLine /> : <div style={{ height: 1, background: colour.border.primary, width: '100%' }} />
  return (
    <div role="separator" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 8px' }}>
      <div style={{ flex: 1 }}>{rule}</div>
      <span style={{ ...type.a14SemiBold, color: colour.text.muted }}>{label}</span>
      <div style={{ flex: 1 }}>{rule}</div>
    </div>
  )
}
