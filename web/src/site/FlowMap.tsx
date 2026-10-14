import { useEffect, useMemo, useRef, useState } from 'react'
import { Heading, Overline, Text } from 'lightweight-ui'
import { CaretRight } from 'lightweight-ui/icons'
import { RootView } from '../app/RootView'
import { AppModel } from '../model/appModel'
import type { Lang } from '../model/lang'
import { DEVICE, Phone } from '../phone/Phone'
import type { Flow, Preset } from './flows'
import { applyPreset, FLOW_GROUPS, FLOWS } from './flows'

const THUMB_SCALE = 0.36

const GROUPS = (Object.keys(FLOW_GROUPS) as (keyof typeof FLOW_GROUPS)[]).map((key) => ({
  key,
  title: FLOW_GROUPS[key].title,
  flows: FLOWS.filter((flow) => flow.group === key),
}))

/** Every flow laid out screen by screen, each one the real app frozen in that state. */
export function FlowMap({ lang, onOpen }: { lang: Lang; onOpen: (presetId: string) => void }) {
  return (
    <main className="map" id="map" tabIndex={-1} aria-labelledby="map-title">
      <div className="map-intro">
        <Heading size="display-sm" level={1} id="map-title">
          Flow map
        </Heading>
        <Text as="p" size="body" tone="muted">
          Every screen is a live render of the app. Open one to carry on from there.
        </Text>
      </div>
      {GROUPS.map((group) => (
        <div key={group.key} className="map-group">
          <Overline>{group.title}</Overline>
          {group.flows.map((flow) => (
            <FlowRow key={flow.id} flow={flow} lang={lang} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </main>
  )
}

function FlowRow({ flow, lang, onOpen }: { flow: Flow; lang: Lang; onOpen: (presetId: string) => void }) {
  return (
    <section className="map-flow">
      <div className="map-flow-head">
        <span className="flow-num">{flow.number}</span>
        <Heading size="title" level={2} id={`flow-${flow.id}`}>
          {flow.title}
        </Heading>
      </div>
      <Text as="p" size="label" tone="muted" className="map-flow-summary">
        {flow.summary}
      </Text>
      <div className="map-strip">
        {flow.steps.map((step, i) => (
          <div key={step.id} className="map-step">
            {i > 0 && <CaretRight className="map-arrow" size={16} weight="bold" aria-hidden />}
            <button type="button" className="map-card" onClick={() => onOpen(step.id)}>
              <Thumbnail preset={step} lang={lang} />
              <span className="map-card-text">
                <span className="flow-num">
                  {flow.number}.{i + 1}
                </span>
                <span className="map-card-title">{step.title}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/** A frozen copy of the app in a preset's state, mounted once it scrolls near the viewport. */
function Thumbnail({ preset, lang }: { preset: Preset; lang: Lang }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const width = DEVICE.width * THUMB_SCALE
  const height = DEVICE.height * THUMB_SCALE
  return (
    <div ref={ref} style={{ width, height }}>
      {near ? <FrozenPhone preset={preset} lang={lang} /> : <div className="map-thumb-placeholder" style={{ width, height }} />}
    </div>
  )
}

/** A frozen copy of the app in a preset's state (also used by the single-screen `#/frame/<id>` view). */
export function FrozenPhone({ preset, lang, scale = THUMB_SCALE }: { preset: Preset; lang: Lang; scale?: number }) {
  const app = useMemo(() => {
    const model = new AppModel({ persist: false, isStatic: true })
    model.store.update({ lang })
    applyPreset(model, preset, 'static')
    return model
  }, [preset, lang])
  return (
    <div aria-hidden>
      <Phone app={app} scale={scale} isStatic presetUI={preset.ui} initialKeyboard={preset.keyboard ?? null}>
        <RootView staticTone={preset.tone} />
      </Phone>
    </div>
  )
}
