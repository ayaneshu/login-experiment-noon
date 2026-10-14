import { swiftSpring } from '../design/motion'
import type { CSSProperties, ReactNode } from 'react'
import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { KeyboardKind, PresetUI } from '../app/context'
import { AppProvider, PresetUIProvider, SCREEN, ScreenProvider, useApp, useScreen } from '../app/context'
import type { AppModel } from '../model/appModel'
import { dir } from '../model/lang'
import { Keyboard } from './Keyboard'
import { HomeIndicator, StatusBar } from './StatusBar'

/** iPhone 17 Pro proportions at the 375pt design width. */
const BEZEL = 12
const SCREEN_RADIUS = 56
export const DEVICE = { width: SCREEN.width + BEZEL * 2, height: SCREEN.height + BEZEL * 2 }

/** One running copy of the app inside a phone: its model, the screen, status bar, keyboard and
 *  Face ID. `frame` draws the titanium iPhone around it; without it the screen is bare (phones). */
export function Phone({
  app,
  children,
  scale,
  frame = true,
  isStatic = false,
  isTouch = false,
  presetUI = {},
  initialKeyboard = null,
}: {
  app: AppModel
  children: ReactNode
  scale: number
  frame?: boolean
  isStatic?: boolean
  isTouch?: boolean
  presetUI?: PresetUI
  initialKeyboard?: KeyboardKind | null
}) {
  const screenRef = useRef<HTMLDivElement | null>(null)
  const width = (frame ? DEVICE.width : SCREEN.width) * scale
  const height = (frame ? DEVICE.height : SCREEN.height) * scale
  return (
    <AppProvider app={app}>
      <ScreenProvider screenRef={screenRef} scale={scale} isStatic={isStatic} isTouch={isTouch} initialKeyboard={initialKeyboard}>
        <PresetUIProvider value={presetUI}>
          <div className="app-surface" style={{ width, height, position: 'relative', flex: 'none' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              {frame ? (
                <DeviceFrame>
                  <Screen screenRef={screenRef}>{children}</Screen>
                </DeviceFrame>
              ) : (
                <Screen screenRef={screenRef}>{children}</Screen>
              )}
            </div>
          </div>
        </PresetUIProvider>
      </ScreenProvider>
    </AppProvider>
  )
}

function Screen({ screenRef, children }: { screenRef: React.RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const app = useApp()
  const { keyboard, isStatic } = useScreen()
  // The WhatsApp chat (entry point 3) is dark chrome over everything: light glyphs while it's up.
  const statusDark = !app.showsAddressChat && app.statusBarIsDark
  return (
    <div
      ref={screenRef}
      className="phone-screen"
      dir={dir(app.lang)}
      lang={app.lang}
      style={{ width: SCREEN.width, height: SCREEN.height, position: 'relative', overflow: 'hidden', background: 'var(--surface-tertiary)', borderRadius: SCREEN_RADIUS, isolation: 'isolate', pointerEvents: isStatic ? 'none' : undefined }}
    >
      {children}
      <StatusBar dark={statusDark} />
      <AnimatePresence>{keyboard && <Keyboard key={keyboard === 'numpad' ? 'numpad' : 'qwerty'} kind={keyboard} />}</AnimatePresence>
      <FaceIDPrompt />
      <HomeIndicator dark={keyboard ? true : !app.showsAddressChat && (statusDark || app.phase === 'signedIn' || app.selectedTab !== 'account' || !!app.authEntry)} />
    </div>
  )
}

/** Titanium frame, black bezel, Dynamic Island and side buttons. */
function DeviceFrame({ children }: { children: ReactNode }) {
  const side = (style: CSSProperties) => <span aria-hidden style={{ position: 'absolute', width: 4, borderRadius: 2, background: 'linear-gradient(90deg, #8d8a86, #c8c5c0 50%, #8d8a86)', ...style }} />
  return (
    <div
      style={{
        position: 'relative',
        width: DEVICE.width,
        height: DEVICE.height,
        borderRadius: SCREEN_RADIUS + BEZEL,
        padding: BEZEL,
        background: '#0b0b0d',
        boxShadow: '0 0 0 2.5px #b9b6b1, 0 0 0 4px #6f6c68, 0 40px 80px -20px rgba(0,0,0,0.45), 0 18px 36px -18px rgba(0,0,0,0.5)',
      }}
    >
      {side({ left: -6, top: 168, height: 30 })}
      {side({ left: -6, top: 228, height: 58 })}
      {side({ left: -6, top: 300, height: 58 })}
      {side({ right: -6, top: 250, height: 92 })}
      {children}
      <span aria-hidden style={{ position: 'absolute', top: BEZEL + 11, left: '50%', transform: 'translateX(-50%)', width: 120, height: 35, borderRadius: 20, background: '#000', zIndex: 200 }} />
    </div>
  )
}

/** Face ID, the way iOS shows it: the Dynamic Island grows into a square with the glyph, then a tick. */
function FaceIDPrompt() {
  const app = useApp()
  const prompt = app.biometrics.prompt
  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          key="faceid"
          initial={{ width: 120, height: 35, borderRadius: 20 }}
          animate={{ width: 156, height: 156, borderRadius: 44 }}
          exit={{ width: 120, height: 35, borderRadius: 20, opacity: 0 }}
          transition={{ ...swiftSpring(0.45, 0.15) }}
          style={{ position: 'absolute', top: 11, left: '50%', x: '-50%', background: '#000', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          role="status"
          aria-label={prompt === 'success' ? 'Face ID matched' : prompt === 'failed' ? 'Face not recognised' : 'Face ID'}
        >
          <motion.svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke={prompt === 'failed' ? '#ff453a' : prompt === 'success' ? '#30d158' : '#fff'} strokeWidth="3.2" strokeLinecap="round" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12, duration: 0.25 }}>
            {prompt === 'success' ? (
              <motion.path d="M18 33l9 9 19-21" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
            ) : (
              <motion.g animate={prompt === 'scanning' ? { opacity: [1, 0.55, 1] } : { x: [0, -6, 6, -4, 0] }} transition={prompt === 'scanning' ? { duration: 1, repeat: Infinity } : { duration: 0.4 }}>
                <path d="M6 18V12a6 6 0 0 1 6-6h6M46 6h6a6 6 0 0 1 6 6v6M58 46v6a6 6 0 0 1-6 6h-6M18 58h-6a6 6 0 0 1-6-6v-6" />
                <path d="M22 24v5M42 24v5M32 24v11h-3M24 43c4.5 4 11.5 4 16 0" />
              </motion.g>
            )}
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
