import type { ReactNode } from 'react'
import { SAFE_BOTTOM, SAFE_TOP, useApp } from './context'
import { colour, type } from '../design/tokens'
import { t } from '../model/lang'
import { BOTTOM_NAV_HEIGHT } from '../ui/BottomNav'
import type { IconName } from '../ui/Icon'
import { Icon } from '../ui/Icon'

/** The Categories tab: a placeholder in the prototype. */
export function CategoriesTab() {
  const lang = useApp().lang
  return (
    <PlaceholderTab
      icon="bottomnav-categories"
      title={t(lang, 'Categories', 'الفئات')}
      message={t(lang, 'Browse everything noon sells.', 'تصفّح كل ما تبيعه نون.')}
    />
  )
}

/** The Deals tab: a placeholder in the prototype. */
export function DealsTab() {
  const lang = useApp().lang
  return (
    <PlaceholderTab
      icon="bottomnav-deals-bag"
      title={t(lang, 'Deals', 'العروض')}
      message={t(lang, "Today's best prices live here.", 'أفضل أسعار اليوم هنا.')}
    />
  )
}

/** A quiet centred icon, title and line of copy, centred in the space above the tab bar
 *  (PlaceholderTab in RootView.swift). */
export function PlaceholderTab({ icon, title, message, accessory }: { icon: IconName; title: string; message: string; accessory?: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: `${SAFE_TOP}px 32px ${BOTTOM_NAV_HEIGHT + SAFE_BOTTOM}px`,
        background: colour.surface.tertiary,
      }}
    >
      <Icon name={icon} size={40} color={colour.text.muted} style={{ marginBottom: 8 }} />
      <h1 style={{ margin: 0, ...type.h20Bold, color: colour.text.primary, textAlign: 'center' }}>{title}</h1>
      <p style={{ margin: 0, ...type.b14Regular, color: colour.text.tertiary, textAlign: 'center' }}>{message}</p>
      {accessory}
    </div>
  )
}
