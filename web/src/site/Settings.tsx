import { Button, PropertyGroup, RadioGroup, Text, Toggle } from 'lightweight-ui'
import { CaretRight } from 'lightweight-ui/icons'
import { AppProvider } from '../app/context'
import type { AppModel, Scenario } from '../model/appModel'
import type { LoginVariant } from '../model/deviceStore'
import { useObserve } from '../model/observable'
import { TransitionPreview } from './TransitionPreview'

const APPROACHES: { value: LoginVariant; label: string; description: string }[] = [
  { value: 'separate', label: 'Log in and Sign up', description: 'Separate screens from Welcome' },
  { value: 'smart', label: 'Smart field', description: 'One field for phone or email' },
  { value: 'toggle', label: 'Phone | Email tabs', description: 'Tabs choose the field' },
]

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: 'newDevice', label: 'New device' },
  { value: 'rememberedCode', label: 'Saved account' },
  { value: 'rememberedFaceID', label: 'Saved account with Face ID' },
]

/** The prototype's global settings, from the header. Per-screen helpers (test accounts, codes,
 *  Face ID) show under the phone instead, only when the screen can use them. */
export function Settings({ app, onReset }: { app: AppModel; onReset: () => void }) {
  useObserve(app)
  useObserve(app.store)
  const store = app.store
  return (
    <AppProvider app={app}>
      <PropertyGroup title="Sign-in approach">
        <RadioGroup label="Sign-in approach" options={APPROACHES} value={app.loginVariant} onChange={(v) => (app.loginVariant = v as LoginVariant)} />
      </PropertyGroup>

      <PropertyGroup title="Start as">
        <RadioGroup label="Start as" options={SCENARIOS} value={app.scenario} onChange={(v) => app.apply(v as Scenario)} />
      </PropertyGroup>

      <PropertyGroup>
        <Toggle
          className="toggle-row"
          label="Autofill codes"
          hint="Fills the code 2.5 seconds after it’s sent."
          checked={store.simulateAutofill}
          onChange={(v) => store.update({ simulateAutofill: v })}
        />
        <Toggle className="toggle-row" label="Play sounds" checked={store.soundOn} onChange={(v) => store.update({ soundOn: v })} />
      </PropertyGroup>

      <PropertyGroup>
        <details className="tune">
          <summary>
            <CaretRight size={12} weight="bold" aria-hidden />
            Header transition
          </summary>
          <div className="tune-body">
            <TransitionPreview />
          </div>
        </details>
      </PropertyGroup>

      <PropertyGroup>
        <Button
          variant="danger-outline"
          size="md"
          block
          onClick={() => {
            app.resetPrototype()
            onReset()
          }}
        >
          Reset prototype
        </Button>
        <Text as="p" size="label" tone="muted">
          Forgets saved accounts and sign-ups.
        </Text>
      </PropertyGroup>
    </AppProvider>
  )
}
