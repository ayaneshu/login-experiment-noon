# noon login experiment

A native SwiftUI prototype of the noon sign-in and sign-up flow, built from the
[Log in / Sign up Figma file](https://www.figma.com/design/cb8AVhgM93nmHUHaOGG0GV/Log-in---Sign-up)
with the Noontree font and [Field Design System](https://github.com/ayaneshu/field-design-system) tokens.

## What's in it

- One smart field for phone or email, with an alternate Email / Phone number toggle flow
- OTP and password sign-in with a shared-element morph between them
- Choose-your-account for remembered accounts, with Face ID
- Header colour reactions: green for success, orange for errors, yellow with a wave for new customers
- Pixel header transitions (Ripple, Dissolve, Bloom) alongside the classic wash
- Sign-in celebration with sound and haptics, then the biometric login offer

## Running

Open `Noon.xcodeproj` in Xcode and run the `Noon` scheme on an iOS 26 simulator or device.
Set your own team under Signing & Capabilities to run on a device.

## Prototype controls

Open the **Cart** tab and tap **Prototype controls** to switch login flows, start from any
scenario, fill test identities and tune the header transitions. The Cart tab also has a live
preview of the header transitions.

Test data:

- Returning: `ajain@gmail.com`, `ajain@noon.com`, `+971 50 123 4567`, `+966 55 123 4567`
- Any other valid number or email signs up a new customer
- OTP `000000` always fails; any other 6 digits verify
- Passwords need 6+ characters

## Tools

- `Tools/generate_field_tokens.py` regenerates the Swift design tokens
- `Tools/generate_signin_sound.py` and `Tools/generate_welcome_sound.py` rebuild the sounds
