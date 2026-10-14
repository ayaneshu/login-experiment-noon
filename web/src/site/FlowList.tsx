import { useEffect, useId, useState } from 'react'
import { Overline, RailItem } from 'lightweight-ui'
import { CaretDown, Play } from 'lightweight-ui/icons'
import type { Flow } from './flows'
import { findPreset, FLOW_GROUPS, FLOWS } from './flows'

const GROUPS = (Object.keys(FLOW_GROUPS) as (keyof typeof FLOW_GROUPS)[]).map((key) => ({
  key,
  title: FLOW_GROUPS[key].title,
  flows: FLOWS.filter((flow) => flow.group === key),
}))

/** Every flow as an accordion of its screens: one open at a time, following the live phone.
 *  Picking a screen restarts the phone there. */
export function FlowList({ current, onOpen }: { current: string | null; onOpen: (presetId: string | null) => void }) {
  const currentFlow = current ? (findPreset(current)?.flow.id ?? null) : null
  const [openFlow, setOpenFlow] = useState<string | null>(currentFlow ?? FLOWS[0]?.id ?? null)
  // When the phone jumps to another flow (from the flow map, say), open that one.
  useEffect(() => {
    if (currentFlow) setOpenFlow(currentFlow)
  }, [currentFlow])

  return (
    <div className="flow-list">
      <div className="flow-list-start">
        <RailItem icon={<Play size={12} weight="fill" aria-hidden />} label="From the start" active={current === null} onClick={() => onOpen(null)} />
      </div>
      {GROUPS.map((group) => (
        <div key={group.key} className="flow-list-group">
          <div className="flow-list-overline">
            <Overline as="span">{group.title}</Overline>
          </div>
          <div className="flow-acc-list">
            {group.flows.map((flow) => (
              <FlowAccordion
                key={flow.id}
                flow={flow}
                open={openFlow === flow.id}
                current={current}
                onToggle={() => setOpenFlow(openFlow === flow.id ? null : flow.id)}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FlowAccordion({
  flow,
  open,
  current,
  onToggle,
  onOpen,
}: {
  flow: Flow
  open: boolean
  current: string | null
  onToggle: () => void
  onOpen: (presetId: string | null) => void
}) {
  const id = useId()
  const holdsCurrent = flow.steps.some((step) => step.id === current)
  return (
    <div className="flow-acc">
      <h2 className="flow-acc-heading">
        <button
          type="button"
          className="flow-acc-trigger"
          aria-expanded={open}
          aria-controls={`${id}-steps`}
          data-current={holdsCurrent || undefined}
          data-static
          onClick={onToggle}
        >
          <span className="flow-num">{flow.number}</span>
          <span className="flow-acc-title">{flow.title}</span>
          <span className="flow-acc-count">
            {flow.steps.length}
            <span className="sr-only"> screens</span>
          </span>
          <CaretDown className="flow-acc-chevron" size={14} weight="bold" aria-hidden />
        </button>
      </h2>
      {/* Collapsed steps stay mounted so the height can animate; inert keeps them out of Tab. */}
      <div className="flow-acc-panel" id={`${id}-steps`} data-open={open} inert={!open}>
        <div className="flow-acc-clip">
          <div className="flow-acc-steps">
            {flow.steps.map((step, i) => (
              <RailItem key={step.id} icon={<span className="flow-num">{i + 1}</span>} label={step.title} active={current === step.id} onClick={() => onOpen(step.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
