import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { SAFE_BOTTOM, SAFE_TOP, SCREEN, useApp, useFlow, usePresetUI, useScreen } from '../app/context'
import { spring, stepVariants, swiftSpring } from '../design/motion'
import type { StepCustom } from '../design/motion'
import type { AuthEntry } from '../model/appModel'
import { isRTL, t } from '../model/lang'
import type { HeaderToneName } from '../ui/Controls'
import { AuthBackdrop } from './AuthBackdrop'
import { ChooseAccountStep } from './ChooseAccountStep'
import { CountryPicker } from './CountryPicker'
import { IdentifyStep } from './IdentifyStep'
import { PasskeyFoundSheet } from './PasskeyFoundSheet'
import { AccountFormStep } from './AccountFormStep'
import { CountrySheet } from './CountrySheet'
import { FaceIDPromptSheet } from './FaceIDPromptSheet'
import { WelcomeStep } from './WelcomeStep'
import type { AuthHeaderArt } from './shared'
import { AuthLayout, Links, openLink } from './shared'
import { VerifyStep } from './VerifyStep'

const NAV_HEIGHT = 54
/** Log in / Sign up at rest (Figma 1268:126419): 60 under the button, the home indicator's 33
 *  included, and the form's height before it has been measured. */
const FORM_REST_BOTTOM = 60 - SAFE_BOTTOM
const FORM_REST_CONTENT = 56 + 20 + 56 + 20 + 56
/** Swift: `.spring(response: 0.4, dampingFraction: 0.84)` for the pulled sheet settling. */
const SETTLE = { ...swiftSpring(0.45, 0.12) } as const

/** Signed-out sign-in: a reactive colour header and one white sheet whose content changes step by
 *  step. The sheet rises while you type, can be pulled up over the artwork to reach the footer, and
 *  grows into the account page once you're in. A port of AuthScreen.swift. */
export function AuthScreen({
  leaving,
  expanded,
  entry = 'account',
  onClose = () => {},
  staticTone,
}: {
  /** Signed in: everything on the sheet dissolves except what resolves into the avatar. */
  leaving: boolean
  /** The sheet grows to fill the screen and becomes the account page's background. */
  expanded: boolean
  entry?: AuthEntry
  onClose?: () => void
  /** Flow-map thumbnails: paint the header in a reaction colour. */
  staticTone?: HeaderToneName
}) {
  const app = useApp()
  const flow = useFlow()
  const lang = app.lang
  const preset = usePresetUI()
  const { keyboard, keyboardHeight, isStatic, screenRef } = useScreen()
  // Sheets drawn over the whole phone (above the tab bar) live on the screen element itself.
  const [screenEl, setScreenEl] = useState<HTMLElement | null>(null)
  useEffect(() => setScreenEl(screenRef.current), [screenRef])
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const [identifierFocused, setIdentifierFocused] = useState(preset.focus === 'identifier')
  /** Separate flow: the new country code sheet, drawn over the form. */
  const [showsCountrySheet, setShowsCountrySheet] = useState(!!preset.countryPicker && flow.isSeparate)
  const [focus, setFocus] = useState<'otp' | 'password' | null>(preset.focus === 'otp' || preset.focus === 'password' ? preset.focus : null)
  const [showsCountryPicker, setShowsCountryPicker] = useState(!!preset.countryPicker && !flow.isSeparate)
  const [chooseContentHeight, setChooseContentHeight] = useState(400)
  const [identifyContentHeight, setIdentifyContentHeight] = useState(361)
  const [restContentHeight, setRestContentHeight] = useState(0)
  const [errorShakes, setErrorShakes] = useState(0)
  const [contentRemoved, setContentRemoved] = useState(false)
  const [artCovered, setArtCovered] = useState(false)

  const isMyAccount = entry === 'account'
  /** Opened from checkout or a link, Log in / Sign up come down to the bottom once the keyboard is
   *  put away (Figma 1268:126419), instead of leaving the raised sheet's white under the button. */
  const formResting = flow.isAccountForm && !isMyAccount && !identifierFocused && !showsCountrySheet && !flow.passkeyOffer && !leaving
  const isRaised =
    flow.step === 'otp' || flow.step === 'password' || flow.step === 'createPassword'
      ? true
      : flow.isAccountForm
        ? !formResting
        : flow.step === 'identify'
          ? identifierFocused
          : false
  const keyboardUp = keyboard != null
  /** The safe-area height the sheet lives in: under the status bar, above the home indicator or keys. */
  const height = SCREEN.height - SAFE_TOP - (keyboardUp ? keyboardHeight : SAFE_BOTTOM)

  const headerArt: AuthHeaderArt = !isMyAccount ? 'hero' : flow.isSeparate ? 'carousel' : flow.step === 'remembered' || flow.variant === 'toggle' ? 'noonOne' : 'hero'
  /** The new layouts rest the sheet under a grabber; the smart field's sheet has none. */
  // Welcome's footer sits under the nav until the sheet is pulled up, so it gets the grabber too.
  const showsGrabber = !isRaised && !flow.isAccountForm && (headerArt === 'noonOne' || (headerArt === 'carousel' && (flow.step === 'remembered' || flow.step === 'welcome')) || !isMyAccount)
  /** Below the content at rest. Welcome shows its whole footer above the nav (Figma pb24). */
  const restBottomPadding = flow.step === 'remembered' ? AuthLayout.chooseBottomPadding : flow.step === 'welcome' ? 23 : AuthLayout.sheetBottomPadding
  const navHeight = isMyAccount ? NAV_HEIGHT : 0
  const restTopPadding = showsGrabber ? AuthLayout.grabberTopPadding : AuthLayout.sheetTopPadding

  // The resting sheet keeps the Figma spacing and sits on the nav; a taller screen gives its extra
  // height to the artwork instead of stretching gaps in the form.
  const restBase = (h: number) =>
    flow.isAccountForm
      ? // Hugs the form: 24 above the title, 60 below the button with the home indicator (Figma).
        Math.max(AuthLayout.raisedSheetOffset, h - (AuthLayout.raisedTopPadding + (restContentHeight || FORM_REST_CONTENT) + FORM_REST_BOTTOM))
      : flow.step === 'remembered'
        ? Math.max(AuthLayout.restSheetOffset('noonOne', isMyAccount), h - navHeight - (AuthLayout.grabberTopPadding + chooseContentHeight + AuthLayout.chooseBottomPadding))
        : Math.max(AuthLayout.restSheetOffset(headerArt, isMyAccount), h - navHeight - (restTopPadding + identifyContentHeight + restBottomPadding))
  const restHeight = SCREEN.height - SAFE_TOP - SAFE_BOTTOM
  const restOffset = restBase(restHeight)
  // How far the resting sheet can be pulled up: until all of its content sits on the nav, never
  // over the header controls.
  const fullTop = flow.step === 'remembered' ? AuthLayout.grabberTopPadding : restTopPadding
  const fullBottom = restBottomPadding
  const maxLift = flow.isAccountForm ? 0 : Math.max(0, restOffset - Math.max(AuthLayout.raisedSheetOffset, restHeight - navHeight - (fullTop + restContentHeight + fullBottom)))
  const targetBase = isRaised ? AuthLayout.raisedSheetOffset : restOffset

  // MARK: Animated geometry. The base springs between rest and raised; the lift follows the finger.
  const base = useMotionValue(targetBase)
  const lift = useMotionValue(0)
  const expand = useMotionValue(expanded ? 1 : 0)
  const intro = useMotionValue(app.introPending && !reduceMotion ? SCREEN.height : 0)
  const heightMV = useMotionValue(height)
  const offset = useTransform(() => base.get() - lift.get())
  const contentTop = useTransform(() => SAFE_TOP + Math.max(offset.get(), 0) + intro.get())
  const contentHeight = useTransform(() => Math.max(0, heightMV.get() - Math.max(offset.get(), 0)))
  const sheetTop = useTransform(() => (SAFE_TOP + offset.get()) * (1 - expand.get()))
  const restSheetTop = SAFE_TOP + restOffset

  const lastRaised = useRef(isRaised)
  useLayoutEffect(() => {
    if (lastRaised.current !== isRaised && isRaised) {
      // The raised sheet ignores the lift; fold it into the base so nothing jumps.
      base.set(base.get() - lift.get())
      lift.set(0)
    }
    lastRaised.current = isRaised
    if (isStatic) base.set(targetBase)
    else void animate(base, targetBase, spring.smooth)
  }, [targetBase, isRaised, isStatic, base, lift])

  useEffect(() => {
    if (isStatic) heightMV.set(height)
    else void animate(heightMV, height, { ...swiftSpring(0.42, 0) })
  }, [height, isStatic, heightMV])

  useEffect(() => {
    void animate(expand, expanded ? 1 : 0, { ...swiftSpring(0.7, 0) })
  }, [expanded, expand])

  // Pulled most of the way up, the sheet has covered the artwork: it dissolves as it does for typing.
  useMotionValueEvent(lift, 'change', (v) => setArtCovered(maxLift > 24 && v > maxLift / 2))

  // Preset: start pulled up.
  const presetLifted = useRef(false)
  useEffect(() => {
    if (!preset.sheetLifted || presetLifted.current || maxLift <= 0 || restContentHeight === 0) return
    presetLifted.current = true
    lift.set(maxLift)
    setArtCovered(maxLift > 24)
  }, [preset.sheetLifted, maxLift, restContentHeight, lift])

  // MARK: Entrance

  const [entered, setEntered] = useState(!app.introPending || isStatic)
  useEffect(() => {
    if (app.introPending) {
      app.introPending = false
      setEntered(true)
      if (!reduceMotion) void animate(intro, 0, { ...swiftSpring(0.8, 0) , delay: 0.1 })
      else intro.set(0)
    } else if (app.restoreKeyboard) {
      // Rebuilt after a language switch: put the keyboard back if it was up.
      app.restoreKeyboard = false
      if (flow.step === 'identify' || flow.isAccountForm) setIdentifierFocused(true)
      else if (flow.step === 'otp') setFocus('otp')
      else if (flow.step === 'password' || flow.step === 'createPassword') setFocus('password')
    }
    // Opened straight on Log in (checkout, a link): the field is ready to type into.
    if (flow.isAccountForm && !isStatic && !showsCountrySheet && !preset.keyboardDown) setTimeout(() => setIdentifierFocused(true), 450)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // MARK: Reactions to the flow

  const lastStep = useRef(flow.step)
  useEffect(() => {
    if (lastStep.current === flow.step) return
    lastStep.current = flow.step
    if (lift.get() !== 0) void animate(lift, 0, spring.smooth)
    setIdentifierFocused(flow.step === 'identify' || flow.step === 'login' || flow.step === 'signup')
    if (flow.step === 'otp') setFocus('otp')
    else if (flow.step === 'password' || flow.step === 'createPassword') setFocus('password')
    else setFocus(null)
  }, [flow.step, lift])

  useEffect(() => {
    if (!leaving) return
    // Once the content has dissolved, take it out entirely; the keyboard leaves with it.
    const timer = setTimeout(() => {
      setContentRemoved(true)
      setFocus(null)
      setIdentifierFocused(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [leaving])

  const lastEvent = useRef(flow.headerEvent?.id)
  useEffect(() => {
    const event = flow.headerEvent
    if (!event || event.id === lastEvent.current) return
    lastEvent.current = event.id
    if (event.kind === 'error' && (flow.step === 'identify' || flow.isAccountForm)) setErrorShakes((n) => n + 1)
  }, [flow.headerEvent, flow.step])

  useEffect(() => {
    // The passkey sheet takes over from the keyboard; it comes back if they choose a code.
    if (flow.passkeyOffer) setIdentifierFocused(false)
  }, [flow.passkeyOffer])

  // MARK: Pulling the resting sheet

  const dragStart = useRef<number | null>(null)
  const justDragged = useRef(false)
  const rubberBanded = (value: number) => {
    const band = (o: number) => (o * 300 * 0.55) / (300 + 0.55 * o)
    if (value < 0) return -band(-value)
    if (value > maxLift) return maxLift + band(value - maxLift)
    return value
  }
  const settle = (to: number, velocity = 0) => {
    void animate(lift, to, reduceMotion ? { duration: 0.2, ease: 'easeOut' } : { ...SETTLE, velocity })
  }
  const onPanStart = () => {
    if (isRaised) return
    dragStart.current = lift.get()
    justDragged.current = true
  }
  const onPan = (_: PointerEvent, info: PanInfo) => {
    if (dragStart.current == null) return
    lift.set(rubberBanded(dragStart.current - info.offset.y))
  }
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    if (dragStart.current == null) return
    dragStart.current = null
    // Where a flick would coast to (Apple's scroll deceleration), then the nearer end.
    const velocity = -info.velocity.y
    const projected = lift.get() + (velocity / 1000) * (0.998 / (1 - 0.998))
    settle(projected > maxLift / 2 ? maxLift : 0, velocity)
    setTimeout(() => (justDragged.current = false), 0)
  }

  // MARK: Layout of the sheet's content

  const restPadding = restBottomPadding
  const bottomInset = keyboardUp ? 16 : formResting ? FORM_REST_BOTTOM : navHeight + restPadding
  const topPadding = isRaised || formResting ? AuthLayout.raisedTopPadding : flow.step === 'remembered' ? AuthLayout.grabberTopPadding : restTopPadding
  const visible = Math.max(0, height - Math.max(targetBase, 0))
  // The design's fixed spot for the bottom action, but never below what's visible.
  const stageHeight = Math.min(AuthLayout.raisedStageHeight, Math.max(0, visible - topPadding - bottomInset))

  const contentRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      if (!isRaised) setRestContentHeight(el.offsetHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isRaised])

  // Log in and Sign up share one view so the header chip morphs one into the other in place.
  const stepKey = flow.step === 'identify' || flow.step === 'remembered' || flow.step === 'welcome' ? flow.step : flow.isAccountForm ? 'form' : 'verify'
  const custom: StepCustom = { direction: flow.direction, rtl: isRTL(lang), reduce: reduceMotion }
  const onOpen = (url: string) => openLink(url)

  const openCountryPicker = () => {
    if (flow.isSeparate) {
      // The keyboard steps aside for the sheet and comes back once a country is picked.
      setIdentifierFocused(false)
      setShowsCountrySheet(true)
      app.set({ authSheetUp: true })
    } else {
      setShowsCountryPicker(true)
    }
  }

  const back = () => {
    if (flow.step === 'identify' && identifierFocused) setIdentifierFocused(false)
    else flow.back()
  }
  const switchLanguage = () => {
    app.restoreKeyboard = identifierFocused || focus != null
    app.toggleLanguage()
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <AuthBackdrop
        sheetTop={sheetTop}
        restSheetTop={restSheetTop}
        showsIllustration={!isRaised && !leaving && (flow.step === 'identify' || flow.step === 'remembered' || flow.step === 'welcome') && entered && !artCovered}
        headerArt={headerArt}
        entry={entry}
        showsBack={isRaised || flow.canGoBack}
        showsGrabber={showsGrabber}
        expanded={expanded}
        introShift={intro}
        onBack={back}
        onSwitchLanguage={switchLanguage}
        onTapHeader={() => {
          // A spring can leave a sliver of lift behind; only a real pull counts.
          if (lift.get() > 1) settle(0)
          else if (flow.step === 'identify') setIdentifierFocused(false)
          // From checkout or a link, the header puts the keyboard away and the form comes down.
          else if (flow.isAccountForm && !isMyAccount) setIdentifierFocused(false)
        }}
        onClose={onClose}
        onApplyNoonOne={() => onOpen(Links.noonOne)}
        onApplyCreditCard={() => onOpen(Links.creditCard)}
        staticTone={staticTone}
        formChip={
          // 16 Oct keeps "New account" only where someone new may land on Log in (checkout, links);
          // elsewhere the way across is contextual (Welcome, or the chips when Log in finds nothing).
          flow.isAccountForm && !leaving && (!flow.isOct16 || (flow.step === 'login' && flow.entryIsDirect))
            ? flow.step === 'login'
              ? { title: t(lang, 'New account', 'حساب جديد'), showsPlus: true, onClick: () => flow.switchAccountForm() }
              : { title: t(lang, 'Log in', 'تسجيل الدخول'), showsPlus: false, onClick: () => flow.switchAccountForm() }
            : undefined
        }
        leadingClose={flow.showsCloseInsteadOfBack && !leaving}
      />

      {!contentRemoved && (
        <motion.div
          onPanStart={onPanStart}
          onPan={onPan}
          onPanEnd={onPanEnd}
          onClickCapture={(e) => {
            // A drag that ends over a button isn't a tap.
            if (justDragged.current) {
              e.stopPropagation()
              e.preventDefault()
            }
          }}
          animate={{ opacity: leaving ? 0 : 1, filter: `blur(${leaving ? 4 : 0}px)` }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          style={{
            position: 'absolute',
            left: 0,
            width: SCREEN.width,
            top: contentTop,
            height: contentHeight,
            pointerEvents: leaving ? 'none' : undefined,
            touchAction: isRaised ? 'pan-y' : 'none',
            overflowY: isRaised ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        >
          <div style={{ padding: `${topPadding}px 16px ${bottomInset}px`, transition: 'padding 0.5s cubic-bezier(0.32,0.72,0,1)' }}>
            <div ref={contentRef} style={{ display: 'grid' }}>
              <AnimatePresence initial={false} custom={custom}>
                <motion.div key={stepKey} custom={custom} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={spring.smooth} style={{ gridArea: '1 / 1', minWidth: 0 }}>
                  {stepKey === 'identify' && (
                    <IdentifyStep
                      raised={isRaised}
                      stageHeight={stageHeight}
                      errorShakes={errorShakes}
                      focused={identifierFocused}
                      setFocused={setIdentifierFocused}
                      onCountryTap={openCountryPicker}
                      onOpen={onOpen}
                      onFoldHeight={(h) => {
                        if (!isRaised) setIdentifyContentHeight(h)
                      }}
                      showsFooter={isMyAccount}
                    />
                  )}
                  {stepKey === 'remembered' && <ChooseAccountStep onOpen={onOpen} onFoldHeight={setChooseContentHeight} />}
                  {stepKey === 'welcome' && (
                    <WelcomeStep
                      onOpen={onOpen}
                      onFoldHeight={(h) => {
                        if (!isRaised) setIdentifyContentHeight(h)
                      }}
                    />
                  )}
                  {stepKey === 'form' && (
                    <AccountFormStep
                      stageHeight={formResting ? 0 : stageHeight}
                      resting={formResting}
                      errorShakes={errorShakes}
                      focused={identifierFocused}
                      setFocused={setIdentifierFocused}
                      onCountryTap={openCountryPicker}
                      onOpen={onOpen}
                    />
                  )}
                  {stepKey === 'verify' && <VerifyStep focus={focus} setFocus={setFocus} stageHeight={stageHeight} onOpen={onOpen} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}

      {/* "This account has a passkey": offered before a code is sent. Over the whole phone, so its dim
          covers the tab bar that comes back when the keyboard goes (under the status bar). */}
      {screenEl &&
        createPortal(
          <AnimatePresence>
            {flow.passkeyOffer && (
              <motion.div key="passkey" initial={isStatic ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.smooth} style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
                <PasskeyFoundSheet account={flow.passkeyOffer} />
              </motion.div>
            )}
          </AnimatePresence>,
          screenEl,
        )}

      {/* Separate flow: the system-style "Use Face ID to sign in?" sheet for a saved account. */}
      <AnimatePresence>
        {flow.showsFaceIDPrompt && flow.remembered && (
          <motion.div key="faceid-prompt" initial={isStatic ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.smooth} style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
            <FaceIDPromptSheet account={flow.remembered.account} />
          </motion.div>
        )}
      </AnimatePresence>

      {showsCountrySheet && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
          <CountrySheet
            selected={flow.country}
            onDone={(country) => {
              if (country) flow.selectCountry(country)
              setShowsCountrySheet(false)
              app.set({ authSheetUp: false })
              // The number field keeps focus.
              setIdentifierFocused(true)
            }}
          />
        </div>
      )}

      <CountryPicker
        open={showsCountryPicker}
        selected={flow.country}
        onSelect={(c) => flow.selectCountry(c)}
        onClose={() => {
          setShowsCountryPicker(false)
          if (flow.step === 'identify') setIdentifierFocused(true)
        }}
      />
    </div>
  )
}
