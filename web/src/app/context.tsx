import type { ReactNode, RefObject } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { AppModel } from '../model/appModel'
import type { AuthFlow } from '../model/authFlow'
import type { Lang } from '../model/lang'
import type { Point } from '../model/observable'
import { useObserve } from '../model/observable'

// MARK: - App model

const AppContext = createContext<AppModel | null>(null)

export function AppProvider({ app, children }: { app: AppModel; children: ReactNode }) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>
}

/** The app model; re-renders the caller when it changes. */
export function useApp(): AppModel {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp outside AppProvider')
  useObserve(app)
  return app
}

/** The current sign-in flow; re-renders the caller when it changes. */
export function useFlow(): AuthFlow {
  const app = useApp()
  useObserve(app.flow)
  return app.flow
}

export function useLang(): Lang {
  return useApp().lang
}

// MARK: - Phone screen

export type KeyboardKind = 'numpad' | 'email' | 'text'

export interface ScreenContextValue {
  /** The 375×812 screen element; every point in the app is measured from its top-left. */
  screenRef: RefObject<HTMLDivElement | null>
  /** CSS scale applied to the screen (the mockup fits the window). */
  scale: number
  /** Flow-map thumbnail: frozen, no entrance animations, no keyboard input. */
  isStatic: boolean
  /** Touch device: inputs use inputMode="none" and the on-screen keyboard types instead. */
  isTouch: boolean
  /** The iOS keyboard currently shown, if any. */
  keyboard: KeyboardKind | null
  keyboardHeight: number
  showKeyboard: (kind: KeyboardKind) => void
  hideKeyboard: () => void
}

const ScreenContext = createContext<ScreenContextValue | null>(null)

export const KEYBOARD_HEIGHT: Record<KeyboardKind, number> = { numpad: 286, email: 312, text: 312 }
/** Figma frame: 62pt status bar, 34pt home indicator area, 54pt tab bar above it. */
export const SAFE_TOP = 62
export const SAFE_BOTTOM = 33
export const SCREEN = { width: 375, height: 812 }

export function ScreenProvider({
  screenRef,
  scale,
  isStatic,
  isTouch,
  initialKeyboard = null,
  children,
}: {
  screenRef: RefObject<HTMLDivElement | null>
  scale: number
  isStatic: boolean
  isTouch: boolean
  initialKeyboard?: KeyboardKind | null
  children: ReactNode
}) {
  const [keyboard, setKeyboard] = useState<KeyboardKind | null>(initialKeyboard)
  const hideTimer = useRef<number | undefined>(undefined)
  // Focus moving from one field to the next blurs then focuses: keep the keyboard up across it.
  const showKeyboard = useCallback((kind: KeyboardKind) => {
    window.clearTimeout(hideTimer.current)
    setKeyboard(kind)
  }, [])
  const hideKeyboard = useCallback(() => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setKeyboard(null), 30)
  }, [])
  useEffect(() => () => window.clearTimeout(hideTimer.current), [])
  const value = useMemo<ScreenContextValue>(
    () => ({ screenRef, scale, isStatic, isTouch, keyboard, keyboardHeight: keyboard ? KEYBOARD_HEIGHT[keyboard] : 0, showKeyboard, hideKeyboard }),
    [screenRef, scale, isStatic, isTouch, keyboard, showKeyboard, hideKeyboard],
  )
  return <ScreenContext.Provider value={value}>{children}</ScreenContext.Provider>
}

export function useScreen(): ScreenContextValue {
  const value = useContext(ScreenContext)
  if (!value) throw new Error('useScreen outside ScreenProvider')
  return value
}

/** Centre of an element in screen design coordinates (the web twin of `.reportCenter`). */
export function useScreenPoint() {
  const { screenRef, scale } = useScreen()
  return useCallback(
    (el: Element | null): Point | null => {
      const screen = screenRef.current
      if (!el || !screen) return null
      const s = screen.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height / 2 - s.top) / scale }
    },
    [screenRef, scale],
  )
}

/** Reports an element's centre (screen coordinates) whenever layout settles; use for header wash
 *  origins and celebration anchors. */
export function useReportCenter<T extends Element>(report: (p: Point) => void) {
  const ref = useRef<T | null>(null)
  const toPoint = useScreenPoint()
  const reportRef = useRef(report)
  reportRef.current = report
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const p = toPoint(el)
      if (p) reportRef.current(p)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    const interval = window.setInterval(update, 500)
    return () => {
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [toPoint])
  return ref
}

// MARK: - Preset UI state

/** View-local state a flow-map preset wants on first render (open menu, focused field, sheet lift). */
export interface PresetUI {
  focus?: 'identifier' | 'otp' | 'password' | null
  menuOpen?: boolean
  sheetLifted?: boolean
  countryPicker?: boolean
  showPassword?: boolean
  /** Choose your account: the "Remove this account?" action sheet is up. */
  confirmRemove?: boolean
  /** Face ID offer: already in its "Biometric is on" state. */
  faceIDEnabled?: boolean
  /** Opened from checkout or a link with the keyboard already put away. */
  keyboardDown?: boolean
}

const PresetUIContext = createContext<PresetUI>({})
export const PresetUIProvider = PresetUIContext.Provider
export const usePresetUI = () => useContext(PresetUIContext)
