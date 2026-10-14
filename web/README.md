# noon sign-in prototype (web)

A React port of the SwiftUI prototype in `../Noon`, running inside an iPhone mockup, with every
flow mapped out screen by screen.

```bash
npm install
npm run dev
```

- **Prototype**: the live app in the phone. Pick any flow step on the left to jump there; the
  controls on the right match the iOS app's Prototype controls.
- **Flow map**: every flow as a strip of frozen, live-rendered screens. Click one to continue
  from it in the prototype.

## Layout

| Folder | What's there |
| --- | --- |
| `src/model` | The state machine and app model, ported line for line from `Noon/Model` and `AppModel.swift` |
| `src/design` | Field DS tokens (generated), motion tokens, asset manifest |
| `src/ui` | Field DS primitives: buttons, icons, header controls, inputs, tab bar |
| `src/phone` | iPhone frame, status bar, iOS keyboard, Face ID prompt |
| `src/auth`, `src/account`, `src/app` | The screens |
| `src/site` | The website around the phone: flow list, flow map, controls |

The screen is 375×812 CSS pixels, the Figma frame size, so design values are used as-is.

## Regenerating from the iOS project

```bash
npm run assets                     # images, fonts and sounds from the Xcode catalog
python3 scripts/generate_tokens.py # colours, type and spacing from FieldTokens.swift
```
