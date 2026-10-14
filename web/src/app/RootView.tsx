import { AnimatePresence, motion } from 'motion/react'
import { useApp, useScreen } from './context'
import { field, swiftSpring } from '../design/motion'
import { AccountPage } from '../account/AccountPage'
import { FaceIDSheet } from '../account/FaceIDSheet'
import { SignInCelebration } from '../account/SignInCelebration'
import { AuthScreen } from '../auth/AuthScreen'
import type { HeaderToneName } from '../ui/Controls'
import { isRTL } from '../model/lang'
import { BottomNav } from '../ui/BottomNav'
import { AddressLinkChat } from './AddressLinkChat'
import { CART_BADGE_COUNT, CartTab } from './CartTab'
import { HomeView } from './HomeView'
import { CategoriesTab, DealsTab } from './OtherTabs'
import { Toast } from './Toast'

/** The app: five tabs, the tab bar, and the overlays that sit above them (sign-in from checkout or
 *  a link, the toast, the celebration, the biometric offer, the WhatsApp chat). A port of
 *  RootView.swift / MainTabs. */
export function RootView({ staticTone }: { staticTone?: HeaderToneName }) {
  const app = useApp()
  const { keyboard } = useScreen()
  // .move(edge: .trailing): the chat slides in from the right, from the left in Arabic.
  const trailing = isRTL(app.lang) ? '-100%' : '100%'
  // Out of the way while typing, and during the sign-in moment until the page arrives with it.
  const showsNav =
    !keyboard &&
    (app.flow.passkeyOffer == null || app.phase === 'signedIn') &&
    // The Face ID sheet and the country sheet cover the whole screen, like system sheets.
    !(app.phase === 'signedOut' && (app.flow.showsFaceIDPrompt || app.authSheetUp)) &&
    (app.celebration == null || app.celebrationStage === 'land')

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--surface-tertiary)' }}>
      {/* Tabs switch inside the snappy spring in Swift: a quick cross-fade. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={app.selectedTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={field.snappySpring}
          style={{ position: 'absolute', inset: 0 }}
        >
          {app.selectedTab === 'home' && <HomeView />}
          {app.selectedTab === 'categories' && <CategoriesTab />}
          {app.selectedTab === 'deals' && <DealsTab />}
          {app.selectedTab === 'account' && <AccountTab staticTone={app.authEntry ? undefined : staticTone} />}
          {app.selectedTab === 'cart' && <CartTab />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showsNav && (
          <motion.div
            key="nav"
            initial={{ y: 87, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 87, opacity: 0 }}
            transition={field.standard(field.duration.lg)}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}
          >
            <BottomNav selection={app.selectedTab} onSelect={(tab) => app.selectTab(tab)} cartBadge={CART_BADGE_COUNT} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign-in from checkout or a link covers the tab, nav included. */}
      <AnimatePresence>
        {app.authEntry && (
          <motion.div
            key={`modal-${app.flow.uid}`}
            initial={app.phase === 'signedIn' ? { opacity: 0 } : { y: 812 }}
            animate={{ y: 0, opacity: 1 }}
            exit={app.phase === 'signedIn' ? { opacity: 0 } : { y: 812 }}
            transition={{ ...swiftSpring(0.5, 0) }}
            style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'var(--surface-tertiary)' }}
          >
            <AuthScreen
              key={`${app.flow.uid}-${app.lang}`}
              leaving={app.celebration != null}
              expanded={app.celebration != null && app.celebrationStage !== 'resolve'}
              entry={app.authEntry}
              onClose={() => app.closeAuthEntry()}
              staticTone={staticTone}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Toast />
      <SignInCelebration />
      <FaceIDSheet />

      {/* Entry point 3: the WhatsApp chat with the shared address link, over everything. In with
          `.spring(duration: 0.45)`, out with `.spring(duration: 0.4)` (AppModel.swift). */}
      <AnimatePresence initial={false}>
        {app.showsAddressChat && (
          <motion.div
            key="address-chat"
            initial={{ x: trailing }}
            animate={{ x: 0, transition: { ...swiftSpring(0.45, 0) } }}
            exit={{ x: trailing, transition: { ...swiftSpring(0.4, 0) } }}
            style={{ position: 'absolute', inset: 0, zIndex: 80 }}
          >
            <AddressLinkChat />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Signed out it's the sign-in sheet; signed in it's the account page. A language switch rebuilds
 *  the sign-in screen with a cross-fade instead of every element sliding to its mirrored place. */
function AccountTab({ staticTone }: { staticTone?: HeaderToneName }) {
  const app = useApp()
  return (
    <AnimatePresence initial={false}>
      {app.phase === 'signedOut' ? (
        <motion.div
          key={`auth-${app.flow.uid}-${app.lang}`}
          // Under a checkout/link sign-in, this copy of the flow mustn't take focus.
          inert={!!app.authEntry}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <AuthScreen leaving={app.celebration != null && !app.authEntry} expanded={!app.authEntry && app.celebration != null && app.celebrationStage !== 'resolve'} staticTone={staticTone} />
        </motion.div>
      ) : (
        <motion.div key="account" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ position: 'absolute', inset: 0 }}>
          <AccountPage />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
