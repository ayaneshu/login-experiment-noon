import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { field } from '../design/motion'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> & {
  /** Touch-down scale (FieldPressStyle): 0.98 for buttons, 0.96 for chips, 0.92–0.94 for icons. */
  scale?: number
  style?: CSSProperties
  children?: ReactNode
  ref?: React.Ref<HTMLButtonElement>
}

/** Every pressable surface: scales the instant it's touched, springs back on release. */
export function Pressable({ scale = 0.98, style, children, type = 'button', ...rest }: Props) {
  return (
    <motion.button
      type={type}
      whileTap={rest.disabled ? undefined : { scale, transition: field.standard(field.duration.xs) }}
      transition={field.snappySpring}
      style={style}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
