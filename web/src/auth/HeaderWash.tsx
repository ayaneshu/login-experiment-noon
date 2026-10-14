import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { HeaderEvent } from '../model/authFlow'
import type { HeaderTransitionSettings, HeaderTransitionStyle, PixelWashParams } from '../model/deviceStore'
import { paramsFor, styleFor } from '../model/deviceStore'
import type { Point } from '../model/observable'
import { HEADER_TONES, headerGradient } from '../ui/Controls'

/** One colour reaction of the sign-in header, drawn in the style picked in the prototype controls:
 *  the classic soft circle, or one of the pixel sweeps. Used by the sign-in header and by the
 *  transition preview, so what you tune there is exactly what the app plays. A port of HeaderWash.swift. */

export type WashSize = { width: number; height: number }

type Callbacks = {
  onCovered: () => void
  onReceding: () => void
  onFinished: () => void
}

export function HeaderWash({
  event,
  size,
  settings,
  onCovered,
  onReceding,
  onFinished,
  resolution,
}: {
  event: HeaderEvent
  size: WashSize
  settings: HeaderTransitionSettings
  /** Pixel density for the canvas styles; defaults to the device pixel ratio. */
  resolution?: number
} & Callbacks) {
  const reduceMotion = useReducedMotion() ?? false
  // Taken once, so changing the settings mid-reaction can't restart or swap it.
  const [captured] = useState(settings)
  const callbacks = useLatest<Callbacks>({ onCovered, onReceding, onFinished })
  const style = styleFor(captured, event.kind)
  // Reduce Motion keeps the gentle crossfade of the classic wash.
  if (style !== 'smooth' && !reduceMotion) {
    return <PixelWash event={event} size={size} style={style} params={paramsFor(captured, style)} resolution={resolution} callbacks={callbacks} />
  }
  return <CircleWash event={event} size={size} reduceMotion={reduceMotion} callbacks={callbacks} />
}

/** Where the reaction starts; without a known cause, the upper middle of the header. */
export function washStartPoint(event: HeaderEvent, size: WashSize): Point {
  return event.origin.x === 0 && event.origin.y === 0 ? { x: size.width / 2, y: size.height * 0.3 } : event.origin
}

const corners = (size: WashSize): Point[] => [
  { x: 0, y: 0 },
  { x: size.width, y: 0 },
  { x: 0, y: size.height },
  { x: size.width, y: size.height },
]

function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

/** Runs `steps` (seconds from now, cumulative like Swift's sequential sleeps) once on mount; a
 *  removed wash cancels what's left, like its cancelled task. */
function useSchedule(steps: [number, () => void][]) {
  const latest = useLatest(steps)
  useEffect(() => {
    const timers = latest.current.map(([at], i) => window.setTimeout(() => latest.current[i][1](), at * 1000))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

// MARK: - Classic

const CIRCLE_TIMING: Record<HeaderEvent['kind'], { grow: number; hold: number; fade: number }> = {
  success: { grow: 0.55, hold: 1.0, fade: 0.6 },
  error: { grow: 0.4, hold: 0.7, fade: 0.5 },
  welcome: { grow: 0.55, hold: 1.9, fade: 0.6 },
}

/** The classic reaction: a circle of the tone's gradient grows from the cause until it covers the
 *  header, holds long enough to read, then fades back to what's underneath. */
function CircleWash({ event, size, reduceMotion, callbacks }: { event: HeaderEvent; size: WashSize; reduceMotion: boolean; callbacks: { current: Callbacks } }) {
  const timing = CIRCLE_TIMING[event.kind]
  const origin = washStartPoint(event, size)
  const radius = Math.max(...corners(size).map((c) => Math.hypot(c.x - origin.x, c.y - origin.y)))
  const [fading, setFading] = useState(false)

  useSchedule([
    [timing.grow * 0.45, () => callbacks.current.onCovered()],
    [
      timing.grow + timing.hold,
      () => {
        callbacks.current.onReceding()
        setFading(true)
      },
    ],
    [timing.grow + timing.hold + timing.fade, () => callbacks.current.onFinished()],
  ])

  const clip = (r: number) => `circle(${r}px at ${origin.x}px ${origin.y}px)`
  return (
    <motion.div
      aria-hidden
      initial={{ clipPath: clip(reduceMotion ? radius : radius * 0.02), opacity: reduceMotion ? 0 : 1 }}
      animate={{ clipPath: clip(radius), opacity: fading ? 0 : 1 }}
      transition={
        fading
          ? { opacity: { duration: timing.fade, ease: 'easeInOut' } }
          : reduceMotion
            ? { duration: 0.2, ease: 'easeOut' }
            : { clipPath: { duration: timing.grow, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0 } }
      }
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: size.width,
        height: size.height,
        background: headerGradient(event.kind),
        pointerEvents: 'none',
      }}
    />
  )
}

// MARK: - Pixels

/** Swift's PixelFrame.lead: how far ahead of the front the grid starts to show. */
const pixelLead = (params: PixelWashParams) => Math.max(params.band * 0.5, 0.02)

/** A pixel reaction: the grid radiates out from the cause, the colour lands behind it and the grid
 *  fades to solid; after the hold, the grid returns and the pixels sweep out the same way. Swift
 *  redraws Path shapes every frame; here a canvas redraws on each animation frame. */
function PixelWash({
  event,
  size,
  style,
  params,
  resolution,
  callbacks,
}: {
  event: HeaderEvent
  size: WashSize
  style: HeaderTransitionStyle
  params: PixelWashParams
  resolution?: number
  callbacks: { current: Callbacks }
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useLatest(size)
  const resolutionRef = useLatest(resolution)
  // Error is a nudge, not news: it holds a little shorter.
  const hold = event.kind === 'error' ? params.hold * 0.75 : params.hold

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const tone = HEADER_TONES[event.kind]
    const top = resolveColour(canvas, tone.top)
    const bottom = resolveColour(canvas, tone.bottom)
    const lead = pixelLead(params)
    const start = performance.now()
    let raf = 0
    let finished = false
    let drawn = { width: 0, height: 0, scale: 0 }
    let gradient: CanvasGradient | null = null

    /** Where each front is `elapsed` seconds in, in 0…1 of the header's reach. Both ease out, like
     *  an impulse spreading: quick off the cause, slowing as they reach the top. */
    const fronts = (elapsed: number): { frontIn: number; frontOut: number | null } => {
      const span = 1 + params.band + lead
      const inProgress = Math.min(Math.max(elapsed / params.spread, 0), 1)
      const frontIn = -lead + (1 - Math.pow(1 - inProgress, 1.7)) * span
      const outElapsed = elapsed - params.spread - hold
      if (outElapsed <= 0) return { frontIn, frontOut: null }
      const outProgress = Math.min(outElapsed / params.recede, 1)
      return { frontIn, frontOut: -lead + (1 - Math.pow(1 - outProgress, 1.7)) * span }
    }

    const draw = (now: number) => {
      const { width, height } = sizeRef.current
      const scale = Math.min(resolutionRef.current ?? (window.devicePixelRatio || 1), 3)
      if (drawn.width !== width || drawn.height !== height || drawn.scale !== scale) {
        canvas.width = Math.max(1, Math.round(width * scale))
        canvas.height = Math.max(1, Math.round(height * scale))
        drawn = { width, height, scale }
        // Figma: the tone holds to 16.6% of the header, then deepens until halfway down.
        gradient = ctx.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0.166, top)
        gradient.addColorStop(0.5, bottom)
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const { frontIn, frontOut } = fronts((now - start) / 1000)
      drawPixelFrame(ctx, { width, height }, style, params, washStartPoint(event, { width, height }), frontIn, frontOut, gradient!)
      if (!finished) raf = requestAnimationFrame(draw)
    }
    draw(start)

    const s = params.spread
    const timers = [
      window.setTimeout(() => callbacks.current.onCovered(), s * 0.45 * 1000),
      window.setTimeout(() => callbacks.current.onReceding(), (s + hold) * 1000),
      window.setTimeout(() => {
        finished = true
        cancelAnimationFrame(raf)
        draw(performance.now())
        callbacks.current.onFinished()
      }, (s + hold + params.recede) * 1000),
    ]
    return () => {
      finished = true
      cancelAnimationFrame(raf)
      timers.forEach((t) => window.clearTimeout(t))
    }
    // Taken once, like the Swift wash's @State settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height, pointerEvents: 'none' }}
    />
  )
}

/** Resolves a CSS colour (including `var(--token)`) to something a canvas understands. */
function resolveColour(el: HTMLElement, value: string) {
  const previous = el.style.color
  el.style.color = value
  const resolved = getComputedStyle(el).color
  el.style.color = previous
  return resolved || value
}

const LIGHT_LEVELS = 8
const opacityOfLevel = (level: number) => (level + 0.5) / LIGHT_LEVELS

/** One frame of a pixel reaction (Swift's PixelFrame). Each cell works out when the front reaches
 *  it and becomes nothing, a faint light (grid ahead of the front), a partly grown pixel of the
 *  tone, or solid tone. Tone cells share one path filled with the header gradient; flashes of light
 *  are bucketed into a few white paths on top. */
function drawPixelFrame(
  ctx: CanvasRenderingContext2D,
  size: WashSize,
  style: HeaderTransitionStyle,
  params: PixelWashParams,
  origin: Point,
  frontIn: number,
  frontOut: number | null,
  gradient: CanvasGradient,
) {
  const toneCells = new Path2D()
  const lights = Array.from({ length: LIGHT_LEVELS }, () => new Path2D())
  const lightUsed = new Array<boolean>(LIGHT_LEVELS).fill(false)
  let toneUsed = false

  const cell = Math.max(params.cell, 2)
  const columns = Math.ceil(size.width / cell)
  const rows = Math.ceil(size.height / cell)
  if (columns <= 0 || rows <= 0) return

  const diamond = style === 'bloom'
  const reach = Math.max(
    Math.max(...corners(size).map((c) => (diamond ? Math.abs(c.x - origin.x) + Math.abs(c.y - origin.y) : Math.hypot(c.x - origin.x, c.y - origin.y)))),
    1,
  )

  const band = Math.max(params.band, 0.01)
  const lead = pixelLead(params)
  const receding = frontOut != null
  const front = frontOut ?? frontIn
  const half = cell / 2
  const gap = params.gap
  const glow = params.glow
  const lingerPower = mix(3, 0.45, params.grid)
  const fullRadius = half * 1.415 + 0.5
  const dotRadius = Math.max(half - gap / 2, 1) * 0.35

  type Shape = 'square' | 'dot'
  const add = (shape: Shape, extent: number, cx: number, cy: number, path: Path2D) => {
    if (!(extent > 0.15)) return false
    if (shape === 'square') {
      if (extent >= half) path.rect(cx - half, cy - half, cell, cell)
      else path.rect(cx - extent, cy - extent, extent * 2, extent * 2)
    } else if (extent >= fullRadius - 0.01) {
      path.rect(cx - half, cy - half, cell, cell)
    } else {
      path.moveTo(cx + extent, cy)
      path.ellipse(cx, cy, extent, extent, 0, 0, Math.PI * 2)
    }
    return true
  }
  const tone = (shape: Shape, extent: number, cx: number, cy: number) => {
    if (add(shape, extent, cx, cy, toneCells)) toneUsed = true
  }
  const light = (amount: number, shape: Shape, extent: number, cx: number, cy: number) => {
    if (!(amount > 0.03)) return
    const level = Math.min(LIGHT_LEVELS - 1, Math.floor(amount * LIGHT_LEVELS))
    if (add(shape, extent, cx, cy, lights[level])) lightUsed[level] = true
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cx = (column + 0.5) * cell
      const cy = (row + 0.5) * cell
      const dx = cx - origin.x
      const dy = cy - origin.y
      const distance = (diamond ? Math.abs(dx) + Math.abs(dy) : Math.hypot(dx, dy)) / reach
      const h1 = hash(column, row)
      const h2 = hash(column + 17, row + 31)
      // Scatter trades the clean ring for a per-cell order.
      const d = mix(distance, h1, params.scatter)

      // 0 → 1 as the front approaches the cell, then 0 → 1 across the band behind it.
      const approach = clamp((front + lead - d) / lead)
      const t = clamp((front - d) / band)
      const reached = front > d

      if (!receding && approach <= 0) continue
      if (receding && approach <= 0) {
        tone('square', half, cx, cy)
        continue
      }

      switch (style) {
        case 'smooth':
        case 'ripple':
          if (!receding) {
            if (!reached) {
              // The grid radiates first: faint lit squares over the blue, ahead of the front.
              light(glow * 0.45 * approach * approach, 'square', half - Math.max(gap, 1) / 2, cx, cy)
              continue
            }
            const linger = Math.pow(1 - t, lingerPower)
            const pop = smoothstep(0, 0.3, t)
            const extent = mix((half - (gap * linger) / 2) * mix(0.55, 1, pop), half, 1 - linger)
            tone('square', extent, cx, cy)
            light(glow * Math.pow(1 - t, 2), 'square', extent, cx, cy)
          } else {
            // The grid comes back over the colour, then each pixel shrinks away.
            const extent = mix(half, half - gap / 2, approach) * (1 - smoothstep(0, 1, t))
            tone('square', extent, cx, cy)
            light(glow * 0.6 * approach * (1 - t), 'square', extent, cx, cy)
          }
          break

        case 'dissolve':
          if (!receding) {
            if (!reached) {
              // A few cells sparkle ahead of the front.
              if (h2 > 0.55) light(glow * 0.5 * approach * approach, 'square', half - Math.max(gap, 1) / 2, cx, cy)
              continue
            }
            const linger = Math.pow(1 - t, lingerPower)
            const extent = mix(half - gap / 2, half, 1 - linger)
            tone('square', extent, cx, cy)
            light(glow * (1 - smoothstep(0, 0.55, t)) * (0.45 + 0.55 * h2), 'square', extent, cx, cy)
          } else {
            // Each cell brightens, then blinks off at its own moment.
            const off = 0.15 + 0.7 * h2
            if (t > off) continue
            const extent = mix(half, half - gap / 2, approach)
            tone('square', extent, cx, cy)
            light(glow * approach * smoothstep(0, 1, t / off), 'square', extent, cx, cy)
          }
          break

        case 'bloom':
          if (!receding) {
            if (!reached) {
              // Tiny light dots mark the grid just ahead of the front.
              light(glow * 0.6 * approach, 'dot', dotRadius * approach, cx, cy)
              continue
            }
            const grow = mix(smoothstep(0, 1, t), Math.pow(t, 1.6), params.grid)
            const radius = mix(dotRadius, fullRadius, grow)
            tone('dot', radius, cx, cy)
            light(glow * (1 - t), 'dot', radius, cx, cy)
          } else {
            const radius = fullRadius * (1 - smoothstep(0, 1, t))
            tone('dot', radius, cx, cy)
            light(glow * 0.5 * approach * (1 - t), 'dot', radius, cx, cy)
          }
          break
      }
    }
  }

  if (toneUsed) {
    ctx.fillStyle = gradient
    ctx.fill(toneCells)
  }
  for (let level = 0; level < LIGHT_LEVELS; level++) {
    if (!lightUsed[level]) continue
    ctx.fillStyle = `rgba(255,255,255,${opacityOfLevel(level)})`
    ctx.fill(lights[level])
  }
}

// MARK: - Math

/** A stable 0…1 value per cell, so the scatter doesn't shimmer between frames (same bits as Swift). */
function hash(x: number, y: number) {
  let h = (Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263)) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4_294_967_295
}

const clamp = (x: number) => Math.min(Math.max(x, 0), 1)
const mix = (a: number, b: number, t: number) => a + (b - a) * t
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}
