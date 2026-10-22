import { Badge, Button, Menu, MenuItem, Switch, Text } from 'lightweight-ui'
import { CaretUp, Check, ScanSmiley, UserCircle } from 'lightweight-ui/icons'
import type { AppModel } from '../model/appModel'
import type { Identifier } from '../model/identifier'
import { emailID, phoneID } from '../model/identifier'
import { useObserve } from '../model/observable'
import type { BiometricOutcome } from '../model/services'
import { AuthService } from '../model/services'

type Tag = 'Returning' | 'Passkey' | 'No password' | 'Verified phone' | 'New'
const ACCOUNTS: { value: string; tag: Tag; id: Identifier }[] = [
  { value: 'ajain@gmail.com', tag: 'Returning', id: emailID('ajain@gmail.com') },
  { value: 'ajain@noon.com', tag: 'Passkey', id: emailID('ajain@noon.com') },
  { value: 'sara@yahoo.com', tag: 'New', id: emailID('sara@yahoo.com') },
  { value: '+971 50 123 4567', tag: 'Returning', id: phoneID('AE', '501234567') },
  { value: '+971 50 246 6770', tag: 'Passkey', id: phoneID('AE', '502466770') },
  { value: '+966 55 123 4567', tag: 'No password', id: phoneID('SA', '551234567') },
  // Not the account's primary: verified on ajain@gmail.com, so it logs in to that account.
  { value: '+971 52 345 6789', tag: 'Verified phone', id: phoneID('AE', '523456789') },
  { value: '+971 55 987 6543', tag: 'New', id: phoneID('AE', '559876543') },
]

const FACE_ID: { value: BiometricOutcome; label: string }[] = [
  { value: 'success', label: 'Matches' },
  { value: 'failed', label: 'Fails' },
  { value: 'cancelled', label: 'Cancels' },
]

interface Helpers {
  /** Which test accounts the visible field takes. */
  accounts?: 'all' | 'email' | 'phone'
  /** On Sign up, what matters is whether the email already has an account. */
  signup?: boolean
  code?: boolean
  password?: boolean
  faceID?: boolean
}

/** What the screen on the phone can use right now. */
function helpersFor(app: AppModel): Helpers {
  const flow = app.flow
  if (app.showsFaceIDOffer) return { faceID: true }
  const signInVisible = app.phase === 'signedOut' && !app.celebration && !app.showsAddressChat && (app.selectedTab === 'account' || app.authEntry != null)
  if (!signInVisible) return {}
  const faceID = flow.showsFaceIDPrompt || flow.passkeyOffer != null || (flow.step === 'remembered' && !!flow.remembered?.passkeyEnabled)
  switch (flow.step) {
    case 'identify':
      return { accounts: flow.variant !== 'toggle' ? 'all' : flow.method === 'email' ? 'email' : 'phone', faceID }
    case 'login':
      return { accounts: 'all', faceID }
    case 'signup':
      return { accounts: 'email', signup: true }
    case 'otp':
      return { code: true }
    case 'password':
    case 'createPassword':
      return { password: true }
    case 'remembered':
      return { faceID }
    default:
      return {}
  }
}

/** The prototype's helpers for the screen on the phone, under it: test accounts beside a field,
 *  the failing code beside a code, Face ID's next result wherever Face ID can run. Nothing
 *  otherwise. One compact row, so the phone keeps its size as they come and go. */
export function ScreenContext({ app }: { app: AppModel }) {
  useObserve(app)
  useObserve(app.flow)
  useObserve(app.store)
  useObserve(app.biometrics)
  const helpers = helpersFor(app)
  const accounts = helpers.accounts
    ? ACCOUNTS.filter((a) => helpers.accounts === 'all' || a.id.type === helpers.accounts)
    : []

  return (
    <div className="stage-context">
      {accounts.length > 0 && (
        <Menu
          align="center"
          className="menu-up"
          label="Test accounts"
          trigger={
            <Button variant="secondary" size="sm" leadingIcon={<UserCircle size={16} aria-hidden />} trailingIcon={<CaretUp size={12} weight="bold" aria-hidden />}>
              <span className="label-long">Try a test account</span>
              <span className="label-short">Test account</span>
            </Button>
          }
        >
          {accounts.map((a) => (
            <MenuItem key={a.value} onSelect={() => app.demoFill(a.id)} trailing={<Badge size="sm">{helpers.signup && a.tag !== 'New' ? 'Has an account' : a.tag}</Badge>}>
              <span className="menu-account">{a.value}</span>
            </MenuItem>
          ))}
        </Menu>
      )}

      {helpers.code && (
        <>
          <Text as="span" size="label" tone="muted">
            {`${AuthService.failingCode} always fails`}
          </Text>
          <span className="context-switch">
            <Text as="span" size="label" weight="medium">
              Autofill
            </Text>
            <Switch label="Autofill the code" checked={app.store.simulateAutofill} onChange={(v) => app.store.update({ simulateAutofill: v })} />
          </span>
        </>
      )}

      {helpers.password && (
        <Text as="span" size="label" tone="muted">
          Any password with 6 or more characters works
        </Text>
      )}

      {helpers.faceID && (
        <Menu
          align="center"
          className="menu-up"
          label="Next Face ID result"
          trigger={
            <Button variant="secondary" size="sm" leadingIcon={<ScanSmiley size={16} aria-hidden />} trailingIcon={<CaretUp size={12} weight="bold" aria-hidden />}>
              {`Face ID: ${FACE_ID.find((f) => f.value === app.biometrics.nextOutcome)?.label}`}
            </Button>
          }
        >
          {FACE_ID.map((f) => (
            <MenuItem
              key={f.value}
              icon={f.value === app.biometrics.nextOutcome ? <Check size={16} aria-hidden /> : <span aria-hidden className="menu-check-space" />}
              onSelect={() => app.biometrics.setNextOutcome(f.value)}
            >
              {f.label}
              {f.value === app.biometrics.nextOutcome && <span className="sr-only"> (selected)</span>}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  )
}
