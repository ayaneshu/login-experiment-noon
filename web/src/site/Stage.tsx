import { useLayoutEffect, useRef, useState } from 'react'
import { Breadcrumb, Button, Text } from 'lightweight-ui'
import { ArrowCounterClockwise, ListBullets } from 'lightweight-ui/icons'
import { SCREEN } from '../app/context'
import { RootView } from '../app/RootView'
import type { AppModel } from '../model/appModel'
import { DEVICE, Phone } from '../phone/Phone'
import type { Preset } from './flows'
import { findPreset } from './flows'
import { ScreenContext } from './ScreenContext'

const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/** Fits the phone to the slot it's given: the framed device, or the bare screen on phones. Measures
 *  the slot itself, so the layout around it can change without the maths following. */
function usePhoneFit() {
  const slot = useRef<HTMLDivElement | null>(null)
  const [fit, setFit] = useState({ scale: 0.8, frame: true })
  useLayoutEffect(() => {
    const el = slot.current
    if (!el) return
    const measure = () => {
      const frame = window.innerWidth >= 520
      const size = frame ? DEVICE : SCREEN
      const scale = Math.max(0.42, Math.min(1, el.clientHeight / size.height, el.clientWidth / size.width))
      setFit((prev) => (prev.scale === scale && prev.frame === frame ? prev : { scale, frame }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { slot, ...fit }
}

/** The live phone, with the screen it started from above it and what that screen shows below.
 *  "From the start" lives at the top of the flow list, so the bar only restarts. */
export function Stage({
  app,
  preset,
  onRestart,
  onOpenFlows,
}: {
  app: AppModel
  preset: Preset | null
  onRestart: () => void
  onOpenFlows: () => void
}) {
  const { slot, scale, frame } = usePhoneFit()
  const flow = preset ? findPreset(preset.id)?.flow : undefined
  return (
    <main className="stage" id="prototype" tabIndex={-1} aria-label="Prototype">
      <div className="stage-bar">
        <div className="stage-panels">
          <Button variant="secondary" size="sm" leadingIcon={<ListBullets size={16} aria-hidden />} onClick={onOpenFlows}>
            Flows
          </Button>
        </div>
        <div className="stage-where">
          {preset && flow ? (
            <Breadcrumb label="Current screen" items={[{ label: `${flow.number} ${flow.title}` }, { label: preset.title }]} />
          ) : (
            <Text as="span" size="ui" weight="medium">
              From the start
            </Text>
          )}
        </div>
        <div className="stage-actions">
          <Button variant="secondary" size="sm" leadingIcon={<ArrowCounterClockwise size={16} aria-hidden />} onClick={onRestart}>
            Restart
          </Button>
        </div>
      </div>

      <div className="stage-slot" ref={slot}>
        <Phone app={app} scale={scale} frame={frame} isTouch={isCoarsePointer()} presetUI={preset?.ui} initialKeyboard={preset?.keyboard ?? null}>
          <RootView />
        </Phone>
      </div>

      <div className="stage-foot">
        <Text as="p" size="label" tone="muted" className="stage-note">
          {preset?.note ?? ''}
        </Text>
        <ScreenContext app={app} />
      </div>
    </main>
  )
}
