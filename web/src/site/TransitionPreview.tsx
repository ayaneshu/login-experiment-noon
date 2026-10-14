import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Dot, SegmentedControl, Slider, Text, Toggle } from 'lightweight-ui'
import { CaretRight } from 'lightweight-ui/icons'
import { useApp } from '../app/context'
import { HeaderWash } from '../auth/HeaderWash'
import type { WashSize } from '../auth/HeaderWash'
import { HERO_SIZE, HeroIllustration } from '../auth/HeroIllustration'
import { colour } from '../design/tokens'
import type { HeaderEvent } from '../model/authFlow'
import type { HeaderTransitionSettings, HeaderTransitionStyle, PixelWashParams } from '../model/deviceStore'
import { HEADER_TRANSITION_INFO, defaultPixelParams, paramsFor } from '../model/deviceStore'
import type { Point } from '../model/observable'
import { HEADER_TONES, headerGradient } from '../ui/Controls'

type Kind = HeaderEvent['kind']

const STAGE_HEIGHT = 232
const SHEET_PEEK = 44
const STYLES: HeaderTransitionStyle[] = ['smooth', 'ripple', 'dissolve', 'bloom']

/** DemoPanel.swift's sliders: title, key, range, step, unit and decimals shown. */
const SLIDERS: { title: string; key: keyof PixelWashParams; min: number; max: number; step: number; unit: string; digits: number }[] = [
  { title: 'Pixel size', key: 'cell', min: 6, max: 32, step: 1, unit: 'pt', digits: 0 },
  { title: 'Grid gap', key: 'gap', min: 0, max: 4, step: 0.5, unit: 'pt', digits: 1 },
  { title: 'Spread', key: 'spread', min: 0.3, max: 2, step: 0.05, unit: 's', digits: 2 },
  { title: 'Hold', key: 'hold', min: 0.3, max: 3, step: 0.1, unit: 's', digits: 1 },
  { title: 'Recede', key: 'recede', min: 0.3, max: 2, step: 0.05, unit: 's', digits: 2 },
  { title: 'Edge width', key: 'band', min: 0.05, max: 0.8, step: 0.01, unit: '', digits: 2 },
  { title: 'Scatter', key: 'scatter', min: 0, max: 1, step: 0.01, unit: '', digits: 2 },
  { title: 'Glow', key: 'glow', min: 0, max: 1, step: 0.01, unit: '', digits: 2 },
  { title: 'Grid linger', key: 'grid', min: 0, max: 1, step: 0.01, unit: '', digits: 2 },
]

let previewEventCounter = 0

/** Prototype tool: a miniature sign-in header that plays the colour reactions with the current
 *  settings, with the style picker and the pixel styles' knobs. Click the header to play from that
 *  spot; it replays by itself a beat after any setting changes. Internal tool, so English only.
 *  A port of TransitionPreview.swift plus DemoPanel's header-transition section. */
export function TransitionPreview() {
  const app = useApp()
  const settings = app.store.headerTransition
  const style = settings.style
  const usesPixels = style !== 'smooth'
  const [kind, setKind] = useState<Kind>('success')
  const [event, setEvent] = useState<HeaderEvent | null>(null)
  const [stage, setStage] = useState<WashSize>({ width: 0, height: STAGE_HEIGHT })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const latest = useRef({ stage, event, kind })
  latest.current = { stage, event, kind }

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setStage({ width: el.offsetWidth, height: el.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Starts a reaction, by default from the field on the sheet's edge, as in the app. */
  const play = (value: Kind, point?: Point) => {
    setKind(value)
    const size = latest.current.stage
    if (!size.width) return
    const origin = point ?? { x: size.width / 2, y: size.height - SHEET_PEEK + 32 }
    setEvent({ kind: value, origin, id: ++previewEventCounter })
  }
  const playRef = useRef(play)
  playRef.current = play

  // Replays a beat after the last change, so dragging a slider doesn't stutter it.
  const settingsKey = JSON.stringify(settings)
  useEffect(() => {
    const timer = window.setTimeout(() => playRef.current(latest.current.kind), latest.current.event == null ? 700 : 350)
    return () => window.clearTimeout(timer)
  }, [settingsKey])

  const update = (patch: Partial<HeaderTransitionSettings>) => app.store.update({ headerTransition: { ...settings, ...patch } })
  const params = paramsFor(settings, style)
  const setParam = (key: keyof PixelWashParams, value: number) => {
    if (style === 'smooth') return
    update({ [style]: { ...settings[style], [key]: value } })
  }
  const defaults = defaultPixelParams(style)
  const atDefaults = SLIDERS.every((s) => params[s.key] === defaults[s.key])

  const sheetTop = stage.height - SHEET_PEEK
  const artScale = Math.min(1, stage.width / 360)
  const info = HEADER_TRANSITION_INFO[style]

  return (
    <div className="transition-tool">
      <div style={{ position: 'relative' }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={style} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
            <Text as="p" size="label" tone="muted">
              {info.summary}
            </Text>
          </motion.div>
        </AnimatePresence>
      </div>

      <SegmentedControl<HeaderTransitionStyle>
        label="Style"
        value={style}
        onChange={(value) => update({ style: value })}
        items={STYLES.map((value) => ({ value, label: HEADER_TRANSITION_INFO[value].title }))}
      />

      {/* Plays one reaction; the colour dot always comes with its name. */}
      <div className="transition-kinds" role="group" aria-label="Play">
        {KINDS.map((k) => (
          <Button
            key={k.value}
            variant={kind === k.value ? 'soft' : 'secondary'}
            size="sm"
            aria-pressed={kind === k.value}
            leadingIcon={<Dot color={HEADER_TONES[k.value].top} />}
            onClick={() => play(k.value)}
          >
            {k.title}
          </Button>
        ))}
      </div>

      {/* The app's header in miniature: click anywhere on it to play from that spot. */}
      <div
        ref={stageRef}
        className="app-surface"
        style={{
          position: 'relative',
          height: STAGE_HEIGHT,
          borderRadius: 12,
          overflow: 'hidden',
          isolation: 'isolate',
          cursor: 'pointer',
          background: headerGradient('blue'),
        }}
      >
        {event && stage.width > 0 && (
          <HeaderWash
            key={event.id}
            event={event}
            size={stage}
            settings={settings}
            onCovered={() => {}}
            onReceding={() => {}}
            onFinished={() => setEvent((current) => (current?.id === event.id ? null : current))}
          />
        )}

        {stage.width > 0 && (
          <div
            style={{
              position: 'absolute',
              left: stage.width / 2 - HERO_SIZE.width / 2,
              top: sheetTop - HERO_SIZE.height,
              transform: `scale(${artScale})`,
              transformOrigin: '50% 100%',
              pointerEvents: 'none',
            }}
          >
            <HeroIllustration visible />
          </div>
        )}

        {/* The sheet's edge with a hint of the field, where reactions usually start. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: sheetTop,
            height: SHEET_PEEK + 20,
            borderRadius: '20px 20px 0 0',
            background: colour.surface.primary,
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'absolute', top: 12, left: 16, right: 16, height: 40, borderRadius: 10, boxShadow: `inset 0 0 0 1px ${colour.border.primary}` }} />
        </div>

        {/* The whole preview is one native button; a click plays from where it lands. */}
        <button
          type="button"
          aria-label={`Play ${KINDS.find((k) => k.value === kind)?.title ?? ''} on the header preview`}
          onClick={(e) => {
            const el = e.currentTarget
            const rect = el.getBoundingClientRect()
            // Corrects for any CSS scale on the panel.
            const sx = el.offsetWidth / (rect.width || 1)
            const sy = el.offsetHeight / (rect.height || 1)
            // A keyboard press reports (0, 0): play from the field instead.
            play(kind, e.detail === 0 ? undefined : { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy })
          }}
          style={{ position: 'absolute', inset: 0, zIndex: 3, borderRadius: 12, cursor: 'pointer' }}
        />
      </div>

      {usesPixels && (
        <details className="tune">
          <summary>
            <CaretRight size={12} weight="bold" aria-hidden />
            Fine-tune {info.title}
          </summary>
          <div className="tune-body">
            {SLIDERS.map((s) => (
              <div key={s.key}>
                <div className="knob-label">
                  <span>{s.title}</span>
                  {s.unit && <span className="knob-unit">{s.unit === 's' ? 'seconds' : 'points'}</span>}
                </div>
                <Slider variant="compact" label={s.title} min={s.min} max={s.max} step={s.step} value={params[s.key]} onChange={(v) => setParam(s.key, v)} />
              </div>
            ))}
            <Toggle className="toggle-row" label="Use for new customers too" hint="The yellow welcome wash." checked={settings.includeWelcome} onChange={(includeWelcome) => update({ includeWelcome })} />
            <div>
              <Button variant="link" size="sm" disabled={atDefaults} onClick={() => update({ [style]: defaultPixelParams(style) })}>
                {`Reset ${info.title} to defaults`}
              </Button>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

const KINDS: { value: Kind; title: string }[] = [
  { value: 'success', title: 'Success' },
  { value: 'error', title: 'Error' },
  { value: 'welcome', title: 'New user' },
]
