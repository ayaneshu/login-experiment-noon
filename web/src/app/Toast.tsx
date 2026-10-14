import { swiftSpring } from '../design/motion'
import { AnimatePresence, motion } from 'motion/react'
import { SAFE_TOP, useApp } from './context'
import { colour, type } from '../design/tokens'

/** A short confirmation after a sign-in that came from a link: a dark capsule under the status bar.
 *  In with `.spring(duration: 0.4, bounce: 0)`, out with `.easeOut(duration: 0.3)`, moving from the
 *  top edge with a fade (RootView's toast overlay). */
export function Toast() {
  const app = useApp()
  const toast = app.toast
  return (
    <div aria-live="polite" style={{ position: 'absolute', top: SAFE_TOP, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <AnimatePresence initial={false}>
        {toast && (
          <motion.div
            key="toast"
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { ...swiftSpring(0.4, 0) } }}
            exit={{ y: '-100%', opacity: 0, transition: { duration: 0.3, ease: 'easeOut' } }}
            style={{ paddingTop: 8, maxWidth: '100%' }}
          >
            <div
              role="status"
              style={{
                ...type.b14SemiBold,
                color: colour.text.onSurfaceBold,
                padding: '12px 16px',
                borderRadius: 999,
                background: colour.surface.primaryInverted,
                boxShadow: '0 6px 24px rgba(0, 0, 0, 0.15)',
              }}
            >
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
