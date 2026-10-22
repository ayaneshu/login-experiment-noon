# noon login experiment

Prototypes of the noon sign-in and sign-up flow, built from the
[Log in / Sign up Figma file](https://www.figma.com/design/cb8AVhgM93nmHUHaOGG0GV/Log-in---Sign-up)
with the Noontree font and [Field Design System](https://github.com/ayaneshu/field-design-system) tokens:

- **iOS** — a native SwiftUI app (`Noon/`, `Noon.xcodeproj`)
- **Web** — a React twin with every flow mapped out in an iPhone mockup (`web/`), live at
  **[login-experiment-noon.vercel.app](https://login-experiment-noon.vercel.app)**

## What's in it

Sign-in approaches, switchable in the prototype controls:

- **Variant - 16 Oct** (the web default) — the Log in | Sign up flow revised from the 16 Oct
  handoff: when Log in finds no account the field turns red and Continue gives way to contextual
  options ("Sign up instead", "Login with email instead", "Signup with email"); the header offers
  "New account" only from checkout or a link; Choose your account is a tappable account row plus a
  list; Sign up's button is always active, and Saudi Arabia ticks a TnC checkbox before "Get OTP".
- **Log in | Sign up** — Welcome with "Log in" and "Create new account"; Log in takes
  email or phone, Sign up takes email only. Checkout and a WhatsApp address link open Log in directly.
- **Smart field** — one field for phone or email that reshapes itself as you type
- **Phone | Email tabs**

Across them: OTP and password sign-in, Choose your account for a remembered device with Face ID,
passkeys, header colour reactions (green success, orange errors, yellow welcome) with pixel
transitions, the sign-in celebration, and the biometric login offer. The Cart page and a WhatsApp
chat with an address link are there as entry points.

The two builds differ in one place for now: the web prototype checks the account when you tap
Continue, while the iOS app checks it as soon as the email or number is complete.

## Running

**iOS:** open `Noon.xcodeproj` in Xcode and run the `Noon` scheme on an iOS 26 simulator or device.
Set your own team under Signing & Capabilities to run on a device.

**Web:**

```bash
cd web
npm install
npm run dev
```

`npm run typecheck` runs TypeScript and `npm run build` builds to `web/dist`; the site deploys to
Vercel from `web/`. The site's chrome uses [lightweight-ui](https://github.com/ayaneshu/lightweight-ui-kit),
installed from GitHub; its global styles are scoped away from the phone in `web/vite.config.ts`.

## Prototype controls

- **iOS:** long-press the delivery address on the Cart tab, or scroll to **Prototype controls** at
  the bottom of the cart.
- **Web:** the flow list on the left jumps to any screen; helpers under the phone (test accounts,
  codes, Face ID results) appear when the screen can use them; the gear opens the settings.

Test data:

- Returning: `ajain@gmail.com`, `+971 50 123 4567`, `+966 55 123 4567` (no password)
- With a passkey: `ajain@noon.com`, `+971 50 246 6770`
- No account: `+971 55 987 6543`; any other email signs up a new customer
- OTP `000000` always fails; any other 6 digits verify
- Passwords need 6+ characters

## Tools

- `Tools/generate_field_tokens.py` regenerates the Swift design tokens
- `Tools/generate_signin_sound.py` and `Tools/generate_welcome_sound.py` rebuild the sounds
- `npm run assets` (in `web/`) copies the iOS asset catalog, fonts and sounds into `web/public`
