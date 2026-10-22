import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { SAFE_BOTTOM, useFlow, useLang, usePresetUI, useScreen } from '../app/context'
import { field, materialize, spring } from '../design/motion'
import { colour, type } from '../design/tokens'
import { idDisplay } from '../model/identifier'
import { t } from '../model/lang'
import type { RememberedAccount } from '../model/services'
import { DashedLine, FieldButton, LabeledDivider, tones } from '../ui/Button'
import { HelperText } from '../ui/Controls'
import { Art, Icon } from '../ui/Icon'
import type { IconName } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { AuthFooter } from './IdentifyStep'
import { MiddleTruncated, ReportingButton, Reveal } from './PasskeyFoundSheet'
import { SavedAccountChoices } from './SavedAccountChoices'
import { AuthTitle } from './shared'

/** SwiftUI `.spring(duration:bounce:)`, exactly: stiffness (2π/d)², damping 4π(1−bounce)/d. */
const swiftSpring = (duration: number, bounce = 0): Transition => ({
  type: 'spring',
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: (4 * Math.PI * (1 - bounce)) / duration,
  mass: 1,
})

/** Biometry is simulated; the name is always Face ID. */
const BIOMETRY = 'Face ID'

/** "Choose your account": the account this device remembers, one tap from signed in. Its menu offers
 *  a code instead of Face ID, or removes the account from this iPhone. */
export function ChooseAccountStep({ onOpen, onFoldHeight }: { onOpen: (url: string) => void; onFoldHeight: (h: number) => void }) {
  const flow = useFlow()
  const lang = useLang()
  const preset = usePresetUI()
  const { screenRef } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [menuOpen, setMenuOpen] = useState(preset.menuOpen ?? false)
  const [confirmsRemoval, setConfirmsRemoval] = useState(preset.confirmRemove ?? false)
  /** The dialog's action runs once it has gone, like a UIAlertAction handler. */
  const pendingAction = useRef<(() => void) | null>(null)

  // Height of everything above the fold (the footer waits under the nav).
  const foldRef = useRef<HTMLDivElement>(null)
  const onFoldRef = useRef(onFoldHeight)
  onFoldRef.current = onFoldHeight
  useLayoutEffect(() => {
    const el = foldRef.current
    if (!el) return
    const report = () => onFoldRef.current(el.offsetHeight)
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The action sheet lives on the phone screen, over everything; the screen element exists after mount.
  const [screenEl, setScreenEl] = useState<HTMLElement | null>(null)
  useEffect(() => setScreenEl(screenRef.current), [screenRef])

  const openTransition: Transition = reduceMotion ? { duration: 0.15, ease: 'easeOut' } : swiftSpring(0.3, 0)
  const closeTransition: Transition = reduceMotion ? { duration: 0.15, ease: 'easeOut' } : swiftSpring(0.25, 0)
  const closeMenu = () => setMenuOpen(false)
  const remembered = flow.remembered
  /** The ⋮ button and its menu: taps there don't count as "outside". */
  const menuArea = useRef<HTMLDivElement>(null)

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column' }}
      // Tapping anywhere else closes the menu.
      onClick={(e) => {
        if (menuOpen && !menuArea.current?.contains(e.target as Node)) closeMenu()
      }}
    >

      <div ref={foldRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <AuthTitle title={t(lang, 'Choose your account', 'اختر حسابك')} bottomPadding={0} />

        {flow.isOct16 && remembered && <SavedAccountChoices remembered={remembered} />}

        {!flow.isOct16 && remembered && (
          <AccountCard
            remembered={remembered}
            menuArea={menuArea}
            menuOpen={menuOpen}
            menuTransition={menuOpen ? openTransition : closeTransition}
            closeTransition={closeTransition}
            onToggleMenu={() => setMenuOpen((open) => !open)}
            onCode={() => {
              closeMenu()
              flow.sendCodeToRememberedAccount()
            }}
            onRemove={() => {
              closeMenu()
              setConfirmsRemoval(true)
            }}
          />
        )}

        {!flow.isOct16 && <LabeledDivider label={t(lang, 'OR', 'أو')} dashed />}

        {/* Figma M-SecondaryButton (H52): the other way in. */}
        {!flow.isOct16 && <FieldButton
          title={flow.isSeparate ? t(lang, 'Login/Signup with another account', 'سجّل الدخول أو أنشئ حساباً آخر') : t(lang, 'Sign in with another account', 'سجّل الدخول بحساب آخر')}
          tone={tones.secondary}
          size="h52"
          trailingIcon="system-chevron-right"
          textStyle="a16SemiBold"
          // Separate flow: the sheet turns into Welcome's "Log in" / "Create new account".
          onClick={() => (flow.isSeparate ? flow.showAnotherAccount() : flow.useDifferentAccount())}
        />}
      </div>

      <div style={{ paddingTop: 20 }}>
        <AuthFooter onOpen={onOpen} />
      </div>

      {screenEl &&
        createPortal(
          <AnimatePresence
            initial={false}
            onExitComplete={() => {
              const action = pendingAction.current
              pendingAction.current = null
              action?.()
            }}
          >
            {confirmsRemoval && (
              <ActionSheet
                key="remove"
                title={t(lang, 'Remove this account from this iPhone?', 'إزالة هذا الحساب من هذا الجهاز؟')}
                message={t(
                  lang,
                  "You'll need your email or number to sign in next time. Your noon account isn't affected.",
                  'ستحتاج إلى بريدك الإلكتروني أو رقمك لتسجيل الدخول في المرة القادمة. لن يتأثر حسابك في نون.',
                )}
                actions={[
                  {
                    title: t(lang, 'Remove account', 'إزالة الحساب'),
                    destructive: true,
                    onClick: () => {
                      pendingAction.current = () => flow.forgetRememberedAccount()
                      setConfirmsRemoval(false)
                    },
                  },
                ]}
                cancelTitle={t(lang, 'Cancel', 'إلغاء')}
                onCancel={() => setConfirmsRemoval(false)}
              />
            )}

          </AnimatePresence>,
          screenEl,
        )}
    </div>
  )
}

// MARK: - Identity card

function AccountCard({
  remembered,
  menuArea,
  menuOpen,
  menuTransition,
  closeTransition,
  onToggleMenu,
  onCode,
  onRemove,
}: {
  remembered: RememberedAccount
  menuArea: RefObject<HTMLDivElement | null>
  menuOpen: boolean
  menuTransition: Transition
  closeTransition: Transition
  onToggleMenu: () => void
  onCode: () => void
  onRemove: () => void
}) {
  const flow = useFlow()
  const lang = useLang()
  const account = remembered.account
  const initial = account.firstName ? Array.from(account.firstName)[0] : null
  const reportCTA = (p: { x: number; y: number }) => {
    flow.ctaAnchor = p
  }

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: 12,
        borderRadius: 16,
        // The border sits behind the content so the open menu covers it.
        background: colour.surface.primary,
        boxShadow: `inset 0 0 0 1px ${colour.border.primary}`,
      }}
    >
      {/* The open menu hangs over the rest of the card. */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <HelloAvatar initial={initial} />
        <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, textAlign: 'start' }}>
          <span style={{ ...type.b13Regular, color: colour.text.tertiary }}>{t(lang, 'Logging in as', 'تسجيل الدخول باسم')}</span>
          <MiddleTruncated text={idDisplay(account.identifier)} style={{ ...type.b16Bold, color: colour.text.primary }} />
        </div>
        <MenuButton areaRef={menuArea} open={menuOpen} transition={menuTransition} onToggle={onToggleMenu}>
          <AnimatePresence initial={false}>
            {menuOpen && (
              <motion.div
                key="menu"
                initial={materialize({ opacity: 0, blur: 3, scale: 0.92 })}
                animate={materialize({})}
                exit={{ ...materialize({ opacity: 0, blur: 3, scale: 0.92 }), transition: closeTransition }}
                transition={menuTransition}
                // Just above the dots: its bottom 26pt above the button's (shrunk) frame, 2pt past its trailing edge.
                style={{ position: 'absolute', bottom: 26, insetInlineEnd: -2, width: 'max-content' }}
              >
                <AccountMenu offersCode={remembered.passkeyEnabled} onCode={onCode} onRemove={onRemove} />
              </motion.div>
            )}
          </AnimatePresence>
        </MenuButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {remembered.passkeyEnabled ? (
          <ReportingButton
            onCenter={reportCTA}
            title={t(lang, `Log in with ${BIOMETRY}`, `سجّل الدخول باستخدام ${BIOMETRY}`)}
            tone={tones.neutral}
            size="h52"
            leadingArt={Art.faceID}
            leadingSize={20}
            textStyle="a16SemiBold"
            isLoading={flow.biometricState === 'scanning'}
            loadingArt={Art.faceID}
            // The separate flow shows the system-style Face ID sheet first; it scans on its own.
            onClick={() => (flow.isSeparate ? flow.beginFaceIDPrompt() : flow.signInWithPasskey())}
          />
        ) : (
          // Without Face ID, the code is the way in.
          <ReportingButton
            onCenter={reportCTA}
            title={t(lang, 'Login with OTP', 'سجّل الدخول برمز التحقق')}
            tone={tones.neutral}
            size="h52"
            leadingIcon="system-message"
            leadingSize={20}
            textStyle="a16SemiBold"
            isLoading={flow.isSending}
            onClick={() => flow.sendCodeToRememberedAccount()}
          />
        )}
        <Reveal show={flow.biometricState === 'failed'} gap={8} transition={spring.smooth}>
          <HelperText
            tone="error"
            text={t(lang, `${BIOMETRY} didn't recognise you. Try again or log in with OTP.`, `لم يتعرّف ${BIOMETRY} عليك. حاول مرة أخرى أو سجّل الدخول برمز التحقق.`)}
          />
        </Reveal>
      </div>
    </div>
  )
}

/** ⋮ opens a small menu just above it, growing from the dots (Figma 976:40044). The 44pt target
 *  hangs 10pt past the row's trailing edge and above and below it, taking 34×24 in the row. */
function MenuButton({ areaRef, open, transition, onToggle, children }: { areaRef: RefObject<HTMLDivElement | null>; open: boolean; transition: Transition; onToggle: () => void; children: ReactNode }) {
  const lang = useLang()
  return (
    <div ref={areaRef} style={{ position: 'relative', width: 34, height: 24, flex: 'none' }}>
      <Pressable
        scale={0.92}
        onClick={onToggle}
        aria-label={t(lang, 'Account options', 'خيارات الحساب')}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ position: 'absolute', top: -10, insetInlineStart: 0, width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <motion.span
          aria-hidden
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          transition={transition}
          style={{ position: 'absolute', width: 36, height: 36, borderRadius: '50%', background: colour.surface.secondary }}
        />
        <Icon name="system-vetricle-three-dot-menu" size={24} color={colour.text.secondary} style={{ position: 'relative' }} />
      </Pressable>
      {children}
    </div>
  )
}

/** Dropdown menu: white card, 16 radius, soft shadow; 24pt icon and B14 Medium per item. */
function AccountMenu({ offersCode, onCode, onRemove }: { offersCode: boolean; onCode: () => void; onRemove: () => void }) {
  const lang = useLang()
  return (
    <div
      role="menu"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 0',
        borderRadius: 16,
        background: colour.surface.primary,
        boxShadow: `inset 0 0 0 1px ${colour.surface.muted}, 0 12px 32px rgba(16, 22, 40, 0.14)`,
      }}
    >
      {offersCode && (
        <>
          <MenuItem icon="system-message" title={t(lang, 'Log in with OTP', 'سجّل الدخول برمز التحقق')} tint={colour.text.primary} onClick={onCode} />
          {/* Out of flow so the SVG's default 300px width doesn't size the (fixed-size) menu. */}
          <div style={{ position: 'relative', height: 1, margin: '0 14px' }}>
            <DashedLine style={{ position: 'absolute', top: 0, left: 0 }} />
          </div>
        </>
      )}
      <MenuItem icon="system-bin" title={t(lang, 'Remove account', 'إزالة الحساب')} tint={colour.text.error} onClick={onRemove} />
    </div>
  )
}

function MenuItem({ icon, title, tint, onClick }: { icon: IconName; title: string; tint: string; onClick: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '12px 14px',
        color: tint,
        textAlign: 'start',
        // RowPressStyle: the secondary surface while pressed.
        background: pressed ? colour.surface.secondary : 'transparent',
        transition: `background-color ${field.duration.xs}s cubic-bezier(0.32, 0.72, 0, 1)`,
      }}
    >
      <Icon name={icon} size={24} />
      <span style={{ ...type.b14Medium, whiteSpace: 'nowrap' }}>{title}</span>
    </button>
  )
}

// MARK: - Hello avatar

const AVATAR = 40
/** The keyframe timeline runs 2.15s; sampled at 60fps so springs and cubic curves match SwiftUI's. */
const POSE_DURATION = 2.15

/** The remembered account's avatar says hello once when the page appears: the initial lifts out, a
 *  hand rises inside the circle, waves twice and ducks away, and the initial drops back in. */
function HelloAvatar({ initial, size = AVATAR }: { initial: string | null; size?: number }) {
  const { isStatic } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (isStatic) return
    // Once, after the sheet has settled.
    const id = window.setTimeout(() => setPlay(true), 450)
    return () => window.clearTimeout(id)
  }, [isStatic])
  const pose = useMemo(() => poseKeyframes(size, reduceMotion ? 0 : 1), [size, reduceMotion])
  const timeline: Transition = { duration: POSE_DURATION, ease: 'linear' }
  const rest = { initial: { y: 0, opacity: 1 }, hand: { y: size * 0.7, opacity: 0, rotate: 0 } }

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        overflow: 'hidden',
        background: colour.surface.actionSubtle,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <motion.span
        initial={rest.initial}
        animate={play ? { y: pose.initialY, opacity: pose.initialOpacity } : rest.initial}
        transition={timeline}
        style={{ gridArea: '1 / 1', display: 'flex', color: colour.text.action }}
      >
        {initial ? <span style={type.b14SemiBold}>{initial}</span> : <Icon name="bottomnav-profile" size={20} />}
      </motion.span>
      <motion.span
        initial={rest.hand}
        animate={play ? { y: pose.handY, opacity: pose.handOpacity, rotate: pose.handAngle } : rest.hand}
        transition={timeline}
        style={{ gridArea: '1 / 1', display: 'block', fontSize: size * 0.5, lineHeight: `${Math.round(size * 0.6)}px`, transformOrigin: '70% 90%' }}
      >
        👋🏽
      </motion.span>
    </span>
  )
}

/** SwiftUI keyframe tracks (Linear / Spring / Cubic), evaluated the way KeyframeAnimator does: each
 *  keyframe starts from where the previous one actually ended; springs start at rest; adjacent cubic
 *  keyframes form a Catmull-Rom curve. */
type Keyframe =
  | { kind: 'linear'; to: number; d: number }
  | { kind: 'spring'; to: number; d: number; duration: number; bounce: number }
  | { kind: 'cubic'; to: number; d: number }

function sampleTrack(start: number, track: Keyframe[], times: number[]) {
  // Keyframe end times and target values.
  const ends: number[] = []
  let acc = 0
  for (const k of track) ends.push((acc += k.d))
  const targets = [start, ...track.map((k) => k.to)]
  const knots = [0, ...ends]

  // Where each keyframe actually starts (springs may end short of their target).
  const starts: number[] = [start]
  for (let i = 0; i < track.length; i++) starts.push(evaluate(i, track[i].d))

  function slope(j: number) {
    // Cubic tangent at knot j: Catmull-Rom between cubic neighbours, at rest next to other kinds.
    const before = track[j - 1]
    const after = track[j]
    if (!before || !after || before.kind !== 'cubic' || after.kind !== 'cubic') return 0
    return (targets[j + 1] - targets[j - 1]) / (knots[j + 1] - knots[j - 1])
  }

  function evaluate(i: number, local: number): number {
    const k = track[i]
    const from = starts[i] ?? targets[i]
    const p = Math.min(Math.max(local / k.d, 0), 1)
    switch (k.kind) {
      case 'linear':
        return from + (k.to - from) * p
      case 'spring': {
        const omega = (2 * Math.PI) / k.duration
        const zeta = 1 - k.bounce
        const time = Math.min(local, k.d)
        let remaining: number
        if (zeta >= 1) {
          remaining = (1 + omega * time) * Math.exp(-omega * time)
        } else {
          const wd = omega * Math.sqrt(1 - zeta * zeta)
          remaining = Math.exp(-zeta * omega * time) * (Math.cos(wd * time) + ((zeta * omega) / wd) * Math.sin(wd * time))
        }
        return k.to + (from - k.to) * remaining
      }
      case 'cubic': {
        const h = k.d
        const m0 = slope(i) * h
        const m1 = slope(i + 1) * h
        const p2 = p * p
        const p3 = p2 * p
        return (2 * p3 - 3 * p2 + 1) * from + (p3 - 2 * p2 + p) * m0 + (-2 * p3 + 3 * p2) * k.to + (p3 - p2) * m1
      }
    }
  }

  const samples = times.map((time) => {
    const i = ends.findIndex((end) => time <= end)
    if (i === -1) return starts[track.length]
    return evaluate(i, time - (i === 0 ? 0 : ends[i - 1]))
  })
  // The timeline comes to rest exactly on its last keyframe.
  samples[samples.length - 1] = targets[targets.length - 1]
  return samples
}

/** Initial lifts out · hand rises, waves twice, ducks · initial drops back in. About 2.1s. */
function poseKeyframes(size: number, wave: number) {
  const frames = Math.round(POSE_DURATION * 60)
  const times = Array.from({ length: frames + 1 }, (_, i) => (i / frames) * POSE_DURATION)
  const lift = -size * 0.6
  const down = size * 0.7
  return {
    // The initial leaves upward and comes back the way it went, as the hand ducks away.
    initialY: sampleTrack(0, [
      { kind: 'linear', to: 0, d: 0.5 },
      { kind: 'spring', to: lift, d: 0.3, duration: 0.3, bounce: 0 },
      { kind: 'linear', to: lift, d: 0.9 },
      { kind: 'spring', to: 0, d: 0.45, duration: 0.45, bounce: 0.15 },
    ], times),
    initialOpacity: sampleTrack(1, [
      { kind: 'linear', to: 1, d: 0.5 },
      { kind: 'linear', to: 0, d: 0.2 },
      { kind: 'linear', to: 0, d: 1.0 },
      { kind: 'linear', to: 1, d: 0.2 },
    ], times),
    handY: sampleTrack(down, [
      { kind: 'linear', to: down, d: 0.55 },
      { kind: 'spring', to: 1, d: 0.4, duration: 0.4, bounce: 0.25 },
      { kind: 'linear', to: 1, d: 0.65 },
      { kind: 'spring', to: down, d: 0.3, duration: 0.3, bounce: 0 },
    ], times),
    handOpacity: sampleTrack(0, [
      { kind: 'linear', to: 0, d: 0.55 },
      { kind: 'linear', to: 1, d: 0.12 },
      { kind: 'linear', to: 1, d: 0.95 },
      { kind: 'linear', to: 0, d: 0.18 },
    ], times),
    handAngle: sampleTrack(0, [
      { kind: 'linear', to: 0, d: 0.8 },
      { kind: 'cubic', to: 18 * wave, d: 0.16 },
      { kind: 'cubic', to: -10 * wave, d: 0.16 },
      { kind: 'cubic', to: 16 * wave, d: 0.16 },
      { kind: 'cubic', to: -6 * wave, d: 0.14 },
      { kind: 'cubic', to: 0, d: 0.14 },
    ], times),
  }
}

// MARK: - Confirmation dialog

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Arabic", system-ui, sans-serif'

/** `.confirmationDialog` on iPhone: an action sheet over a light dim, the title (and message) above
 *  the actions — red for a destructive one — and Cancel on its own underneath. Tapping the dim
 *  cancels. */
function ActionSheet({
  title,
  message,
  actions,
  cancelTitle,
  onCancel,
}: {
  title: string
  message?: string
  actions: { title: string; destructive?: boolean; onClick: () => void }[]
  cancelTitle: string
  onCancel: () => void
}) {
  const reduceMotion = useReducedMotion() ?? false
  const id = useId()
  const enter: Transition = reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.42, 0)
  const leave: Transition = reduceMotion ? { duration: 0.2, ease: 'easeOut' } : swiftSpring(0.32, 0)
  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 95, fontFamily: SYSTEM_FONT }}
      // Portalled: keep taps from bubbling (through React) into the sheet behind.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <motion.div
        aria-hidden
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: leave }}
        transition={enter}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.2)' }}
      />
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={message ? `${id}-message` : undefined}
        initial={{ y: '120%' }}
        animate={{ y: 0 }}
        exit={{ y: '120%', transition: leave }}
        transition={enter}
        style={{ position: 'absolute', left: 8, right: 8, bottom: SAFE_BOTTOM + 1, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div style={{ borderRadius: 13, overflow: 'hidden', background: 'rgba(249, 249, 249, 0.78)', backdropFilter: 'blur(20px) saturate(1.8)', WebkitBackdropFilter: 'blur(20px) saturate(1.8)' }}>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center', color: 'rgba(60, 60, 67, 0.6)', fontSize: 13, lineHeight: '18px', letterSpacing: -0.08 }}>
            <div id={`${id}-title`} style={{ fontWeight: 600 }}>
              {title}
            </div>
            {message && (
              <div id={`${id}-message`} style={{ fontWeight: 400 }}>
                {message}
              </div>
            )}
          </div>
          {actions.map((action) => (
            <div key={action.title}>
              <div style={{ height: 0.5, background: 'rgba(60, 60, 67, 0.29)' }} />
              <SheetAction title={action.title} color={action.destructive ? '#FF3B30' : colour.surface.actionBold} weight={400} onClick={action.onClick} />
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 13, overflow: 'hidden', background: '#FFFFFF' }}>
          <SheetAction title={cancelTitle} color={colour.surface.actionBold} weight={600} onClick={onCancel} />
        </div>
      </motion.div>
    </div>
  )
}

function SheetAction({ title, color, weight, onClick }: { title: string; color: string; weight: number; onClick: () => void }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        display: 'block',
        width: '100%',
        height: 57,
        fontFamily: SYSTEM_FONT,
        fontSize: 20,
        lineHeight: '25px',
        letterSpacing: -0.45,
        fontWeight: weight,
        color,
        background: pressed ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
      }}
    >
      {title}
    </button>
  )
}
