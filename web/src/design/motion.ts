import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/** SwiftUI's `.spring(duration:bounce:)` as a Motion spring: stiffness (2π/d)², damping
 *  4π(1−bounce)/d, mass 1. Motion's own `{ duration, bounce }` settles about 1.5× faster. */
export function swiftSpring(duration: number, bounce = 0) {
  const omega = (2 * Math.PI) / duration
  return { type: 'spring' as const, stiffness: omega * omega, damping: (4 * Math.PI * (1 - bounce)) / duration, mass: 1 }
}

/** Motion tokens, matching Motion.swift: critically damped springs everywhere so any transition can
 *  be interrupted mid-flight. Bounce is reserved for the celebration. */
export const spring = {
  press: swiftSpring(0.2),
  quick: swiftSpring(0.25),
  snappy: swiftSpring(0.35),
  smooth: swiftSpring(0.5),
  slow: swiftSpring(0.7),
  celebrate: swiftSpring(0.5, 0.25),
} satisfies Record<string, Transition>

/** Colour and border changes: fast, never springy. */
export const tint: Transition = { duration: 0.15, ease: 'easeOut' }

/** Field DS motion (FieldMotion in Swift). */
export const field = {
  standard: (duration: number): Transition => ({ duration, ease: [0.32, 0.72, 0, 1] }),
  loft: (duration: number): Transition => ({ duration, ease: [0.22, 1, 0.36, 1] }),
  snappySpring: { type: 'spring', stiffness: 280, damping: 22, mass: 1 } as Transition,
  interactionSpring: { type: 'spring', stiffness: 220, damping: 18, mass: 1 } as Transition,
  duration: { instant: 0.04, xs: 0.1, sm: 0.16, base: 0.2, recede: 0.18, emphasized: 0.22, lg: 0.26, xl: 0.32 },
}

/** The one enter/exit recipe used everywhere: opacity, blur, scale and offset (Materialize). */
export function materialize({ opacity = 1, blur = 0, scale = 1, x = 0, y = 0 }: { opacity?: number; blur?: number; scale?: number; x?: number; y?: number }): TargetAndTransition {
  return { opacity, filter: `blur(${blur}px)`, scale, x, y }
}

const identity = materialize({})

/** Small supporting content rising into place. Exits are softer than entrances. */
export const softRise = {
  initial: materialize({ opacity: 0, blur: 4, y: 8 }),
  animate: identity,
  exit: materialize({ opacity: 0, blur: 2, y: -4 }),
}

/** Contextual icon swap: scale 0.25 → 1, opacity 0 → 1, blur 4 → 0. */
export const iconSwap = {
  initial: materialize({ opacity: 0, blur: 4, scale: 0.25 }),
  animate: identity,
  exit: materialize({ opacity: 0, blur: 4, scale: 0.25 }),
}

/** Text that changes in place (SwiftUI .blurReplace). */
export const blurReplace = {
  initial: materialize({ opacity: 0, blur: 6, scale: 0.9 }),
  animate: identity,
  exit: materialize({ opacity: 0, blur: 6, scale: 0.9 }),
}

/** Step content moving along the flow's axis. Forward enters from the trailing edge; back returns
 *  the way it came. Use with AnimatePresence custom={{ direction, rtl, reduce }}. */
export type StepCustom = { direction: 'forward' | 'backward'; rtl: boolean; reduce?: boolean }
export const stepVariants: Variants = {
  enter: (c: StepCustom) => (c.reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 6, x: 36 * sign(c) })),
  center: identity,
  exit: (c: StepCustom) => (c.reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 6, x: -28 * sign(c) })),
}
function sign(c: StepCustom) {
  return (c.direction === 'forward' ? 1 : -1) * (c.rtl ? -1 : 1)
}
