import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { TargetAndTransition, Transition } from 'motion/react'
import { motion, useReducedMotion } from 'motion/react'
import { useLang } from '../app/context'
import { materialize, swiftSpring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { Art, ArtImage, assetURL } from '../ui/Icon'

/** Materialize as a motion target. At rest the blur filter is dropped entirely, so a settled view
 *  isn't kept on a filtered layer (which would also trap fixed-position menus inside it). */
export function materializeTo(m: Parameters<typeof materialize>[0]): TargetAndTransition {
  const target = materialize(m)
  return (m.blur ?? 0) === 0 ? { ...target, transitionEnd: { filter: 'none' } } : target
}

/** SwiftUI applies `.scaleEffect` after `.offset` around the view's *layout* frame, not where the
 *  offset drew it. The outer box is the layout frame (it takes the Materialize transform); the inner
 *  one carries the offset. */
function OffsetMaterialize({
  x,
  y,
  width,
  height,
  target,
  transition,
  children,
}: {
  x: number
  y: number
  width?: number
  height?: number
  target: TargetAndTransition
  transition: Transition
  children: ReactNode
}) {
  return (
    <motion.div initial={false} animate={target} transition={transition} style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <div style={{ transform: `translate(${x}px, ${y}px)`, width, height }}>{children}</div>
    </motion.div>
  )
}

/** The logged-out artwork: noon's shopping-bag scene with two floating proof chips and sparkles.
 *  Figma frame 337×148; the scene stands on the sheet's top edge. */
export const HERO_SIZE = { width: 337.05, height: 148 }

export function HeroIllustration({ visible, isStatic = false }: { visible: boolean; isStatic?: boolean }) {
  const lang = useLang()
  const reduceMotion = useReducedMotion() ?? false
  const [twinkle, setTwinkle] = useState(false)
  // Which change the sparkles are animating: the glint (its own ease) or appearing (springs).
  const [twinkleDriven, setTwinkleDriven] = useState(false)
  const [seenVisible, setSeenVisible] = useState(visible)
  if (seenVisible !== visible) {
    setSeenVisible(visible)
    setTwinkleDriven(false)
  }

  useEffect(() => {
    if (!visible || reduceMotion || isStatic) return
    // An occasional glint, not a constant loop competing with the form.
    const timers: number[] = []
    let cancelled = false
    const loop = () => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          setTwinkleDriven(true)
          setTwinkle(true)
          timers.push(
            window.setTimeout(() => {
              setTwinkle(false)
              loop()
            }, 380),
          )
        }, 3200),
      )
    }
    loop()
    return () => {
      cancelled = true
      timers.forEach((id) => window.clearTimeout(id))
      setTwinkle(false)
    }
  }, [visible, reduceMotion, isStatic])

  const chipTarget = materializeTo({ opacity: visible ? 1 : 0, blur: visible ? 0 : 4, scale: visible ? 1 : 0.9, y: visible ? 0 : 8 })
  const chipTransition = (delay: number): Transition => ({ ...swiftSpring(0.5, 0.2) , delay: visible ? delay : 0 })

  return (
    <div aria-hidden style={{ position: 'relative', width: HERO_SIZE.width, height: HERO_SIZE.height, direction: 'ltr' }}>
      <OffsetMaterialize
        x={44.77}
        y={3.26}
        width={253}
        height={146.9}
        target={materializeTo({ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.94, y: visible ? 0 : 18 })}
        transition={{ ...swiftSpring(0.6, 0) }}
      >
        <ArtImage name={Art.heroIllustration} width={253} height={146.9} />
      </OffsetMaterialize>

      <Sparkle x={291.13} y={52.82} delay={0.25} visible={visible} twinkle={twinkle} twinkleDriven={twinkleDriven} />
      <Sparkle x={48.19} y={15.55} delay={0.4} visible={visible} twinkle={twinkle} twinkleDriven={twinkleDriven} />

      <OffsetMaterialize x={234.9} y={8} target={chipTarget} transition={chipTransition(0.28)}>
        <Chip title={t(lang, '20M+ products', '+20 مليون منتج')} />
      </OffsetMaterialize>
      <OffsetMaterialize x={-1.73} y={92.09} target={chipTarget} transition={chipTransition(0.38)}>
        <Chip title={t(lang, 'global brands', 'علامات عالمية')} />
      </OffsetMaterialize>
    </div>
  )
}

function Sparkle({ x, y, delay, visible, twinkle, twinkleDriven }: { x: number; y: number; delay: number; visible: boolean; twinkle: boolean; twinkleDriven: boolean }) {
  const transition: Transition = twinkleDriven
    ? { duration: twinkle ? 0.35 : 0.5, ease: 'easeInOut' }
    : { ...swiftSpring(0.5, 0.3) , delay: visible ? delay : 0 }
  return (
    <motion.img
      src={assetURL(Art.sparkle)}
      alt=""
      draggable={false}
      initial={false}
      animate={{ scale: visible ? (twinkle ? 1.25 : 1) : 0.4, rotate: twinkle ? 20 : 0, opacity: visible ? 1 : 0 }}
      transition={transition}
      style={{ position: 'absolute', left: x, top: y, width: 23.79, height: 23.79 }}
    />
  )
}

/** A floating proof chip: A12 SemiBold on a white-to-grey capsule with a soft shadow. */
function Chip({ title }: { title: string }) {
  return (
    <div
      style={{
        ...type.a12SemiBold,
        color: colour.surface.absoluteBlack,
        whiteSpace: 'nowrap',
        width: 'max-content',
        padding: '0 10.8px',
        height: 30.28,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        background: `linear-gradient(180deg, ${colour.surface.primary}, ${colour.surface.tertiary})`,
        boxShadow: '0 1px 5px rgba(0, 0, 0, 0.15)',
      }}
    >
      {title}
    </div>
  )
}
