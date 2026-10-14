import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader, Dialog, DialogBody, DialogHeader, IconButton, Logo, SlidingSwitch, UnderlineNav } from 'lightweight-ui'
import { GearSix } from 'lightweight-ui/icons'
import { AppModel } from '../model/appModel'
import type { Lang } from '../model/lang'
import { useObserve } from '../model/observable'
import { FlowList } from './FlowList'
import { FlowMap, FrozenPhone } from './FlowMap'
import type { Preset } from './flows'
import { applyPreset, findPreset } from './flows'
import { Settings } from './Settings'
import { Stage } from './Stage'
import './site.css'

type View = 'prototype' | 'map'

interface LiveSession {
  app: AppModel
  preset: Preset | null
  key: number
}

/** Starts a fresh live copy of the app, optionally at a flow step. */
function makeLive(presetId: string | null, previous?: LiveSession): LiveSession {
  previous?.app.flow.dispose()
  const app = new AppModel({ persist: true })
  const found = presetId ? findPreset(presetId) : undefined
  if (found) {
    applyPreset(app, found.preset, 'live')
    const tone = found.preset.tone
    // Opened mid-flow: replay the header's reaction once the screen is up.
    if (tone && tone !== 'blue') setTimeout(() => app.flow.flashHeader(tone), 450)
  }
  return { app, preset: found?.preset ?? null, key: (previous?.key ?? 0) + 1 }
}

function readHash(): { view: View; presetId: string | null } {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash === 'map') return { view: 'map', presetId: null }
  const match = hash.match(/^p\/([\w-]+)/)
  return { view: 'prototype', presetId: match ? match[1] : null }
}

export function App() {
  // Review aid: `#/frame/<preset-id>[/ar]` shows one frozen screen at full size.
  const frame = window.location.hash.match(/^#\/frame\/([\w-]+)(\/ar)?/)
  if (frame) {
    const found = findPreset(frame[1])
    return (
      <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', background: '#eceef2', padding: 24 }}>
        {found ? <FrozenPhone preset={found.preset} lang={frame[2] ? 'ar' : 'en'} scale={1} /> : 'Unknown screen'}
      </div>
    )
  }
  return <Site />
}

function Site() {
  const initial = useMemo(readHash, [])
  const [view, setView] = useState<View>(initial.view)
  const [live, setLive] = useState<LiveSession>(() => makeLive(initial.presetId))
  const [dialog, setDialog] = useState<'flows' | 'settings' | null>(null)
  useObserve(live.app)

  const open = useCallback((presetId: string | null) => {
    setLive((prev) => makeLive(presetId, prev))
    setView('prototype')
    setDialog(null)
    window.history.replaceState(null, '', presetId ? `#/p/${presetId}` : '#/')
  }, [])

  const switchView = (next: View) => {
    setView(next)
    window.history.replaceState(null, '', next === 'map' ? '#/map' : live.preset ? `#/p/${live.preset.id}` : '#/')
  }

  useEffect(() => {
    const onHash = () => {
      const next = readHash()
      setView(next.view)
      if (next.view === 'prototype' && next.presetId !== (live.preset?.id ?? null)) setLive((prev) => makeLive(next.presetId, prev))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [live.preset])

  const flows = <FlowList current={live.preset?.id ?? null} onOpen={open} />

  return (
    <div className="site">
      <a
        className="skip-link"
        href={view === 'map' ? '#map' : '#prototype'}
        onClick={(e) => {
          // The hash is the router here, so move focus without touching it.
          e.preventDefault()
          document.getElementById(view === 'map' ? 'map' : 'prototype')?.focus()
        }}
      >
        {view === 'map' ? 'Skip to flow map' : 'Skip to prototype'}
      </a>
      <AppHeader
        contained={false}
        sticky={false}
        brand={<Logo letter="n" name={<span className="brand-name">noon sign-in</span>} />}
        nav={
          <UnderlineNav<View>
            label="View"
            value={view}
            onChange={switchView}
            items={[
              { value: 'prototype', label: 'Prototype', href: live.preset ? `#/p/${live.preset.id}` : '#/' },
              { value: 'map', label: 'Flow map', href: '#/map' },
            ]}
          />
        }
        actions={
          <>
            <SlidingSwitch<Lang>
              label="Prototype language"
              value={live.app.lang}
              onChange={(lang) => live.app.setLanguage(lang)}
              items={[
                { value: 'en', label: <Responsive long="English" short="EN" /> },
                { value: 'ar', label: <Responsive long="العربية" short="ع" lang="ar" /> },
              ]}
            />
            <IconButton label="Settings" tooltip="bottom" onClick={() => setDialog('settings')}>
              <GearSix size={20} aria-hidden />
            </IconButton>
          </>
        }
      />

      {view === 'prototype' ? (
        <div className="site-body">
          <h1 className="sr-only">noon sign-in prototype</h1>
          <nav className="site-rail" aria-label="Flows">
            {flows}
          </nav>
          <Stage
            key={live.key}
            app={live.app}
            preset={live.preset}
            onRestart={() => open(live.preset?.id ?? null)}
            onOpenFlows={() => setDialog('flows')}
          />
        </div>
      ) : (
        <FlowMap lang={live.app.lang} onOpen={open} />
      )}

      <Dialog open={dialog === 'flows'} onClose={() => setDialog(null)} placement="top" size="sm">
        <DialogHeader title="Flows" divided />
        <DialogBody>{flows}</DialogBody>
      </Dialog>
      <Dialog open={dialog === 'settings'} onClose={() => setDialog(null)} placement="top" size="md">
        <DialogHeader title="Settings" divided />
        <div className="dialog-settings">
          <Settings app={live.app} onReset={() => open(null)} />
        </div>
      </Dialog>
    </div>
  )
}

/** A label that shortens on phones; the hidden form is display: none, so it's never read twice. */
function Responsive({ long, short, lang }: { long: string; short: string; lang?: string }) {
  return (
    <span lang={lang}>
      <span className="label-long">{long}</span>
      <span className="label-short">{short}</span>
    </span>
  )
}
