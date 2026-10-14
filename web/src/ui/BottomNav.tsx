import { AnimatePresence, motion } from 'motion/react'
import { useApp, useScreen, SAFE_BOTTOM } from '../app/context'
import { field } from '../design/motion'
import { colour, type } from '../design/tokens'
import type { Tab } from '../model/appModel'
import { isRTL, t } from '../model/lang'
import { assetURL } from './Icon'
import { Pressable } from './Pressable'

/** Height above the home indicator (BottomNav.barHeight). The labels sit a little lower, as in
 *  Figma, where the row is 63pt over a 25pt home bar. */
export const BOTTOM_NAV_HEIGHT = 54

const INDICATOR_WIDTH = 56
/** The row's side inset: five slots share the width between. */
const INSET = 16

interface Item {
  tab: Tab
  /** Asset name of the glyph; the selected tint is `<glyph>-selected`. */
  glyph: string
  en: string
  ar: string
}

const ITEMS: Item[] = [
  { tab: 'home', glyph: 'nav-home', en: 'Home', ar: 'الرئيسية' },
  { tab: 'categories', glyph: 'nav-categories', en: 'Categories', ar: 'الفئات' },
  { tab: 'deals', glyph: 'nav-deals', en: 'Deals', ar: 'العروض' },
  { tab: 'account', glyph: 'nav-account', en: 'Account', ar: 'حسابي' },
  { tab: 'cart', glyph: 'nav-cart', en: 'Cart', ar: 'السلة' },
]

/** Main bottom nav: five destinations, a 56×4 selection bar that slides between them, and the 32pt
 *  duotone glyphs from Figma ("Main bottom Nav"), grey at rest and blue when selected. The white bar
 *  runs down through the home-indicator area.
 *
 *  The indicator is one element that slides a slot's width per step (the matchedGeometryEffect in
 *  Swift). It's driven by a percentage `x` rather than a shared layoutId so it stays exact inside the
 *  CSS-scaled phone and never pairs up with another phone's nav on the same page. */
export function BottomNav({ selection, onSelect, cartBadge }: { selection: Tab; onSelect: (t: Tab) => void; cartBadge?: number }) {
  const app = useApp()
  const { isStatic } = useScreen()
  const lang = app.lang
  const index = Math.max(0, ITEMS.findIndex((item) => item.tab === selection))
  const step = isRTL(lang) ? -100 : 100

  return (
    <nav
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: BOTTOM_NAV_HEIGHT + SAFE_BOTTOM,
        padding: `0 ${INSET}px`,
        background: colour.surface.primary,
        boxShadow: 'inset 0 1px 0 #E9E9E9',
      }}
    >
      {/* Selection bar: one slot wide, centred in its slot, sliding between slots. */}
      <div aria-hidden style={{ position: 'absolute', top: 0, left: INSET, right: INSET, height: 4, pointerEvents: 'none', zIndex: 1 }}>
        <motion.div
          initial={false}
          animate={{ x: `${index * step}%` }}
          transition={isStatic ? { duration: 0 } : field.snappySpring}
          style={{ position: 'absolute', top: 0, insetInlineStart: 0, width: `${100 / ITEMS.length}%`, height: 4, display: 'flex', justifyContent: 'center' }}
        >
          <span style={{ width: INDICATOR_WIDTH, height: 4, background: 'var(--nav-indicator)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} />
        </motion.div>
      </div>

      <div role="tablist" style={{ display: 'flex', height: BOTTOM_NAV_HEIGHT }}>
        {ITEMS.map((item) => {
          const isSelected = item.tab === selection
          const title = t(lang, item.en, item.ar)
          const badge = item.tab === 'cart' ? cartBadge : undefined
          return (
            <Pressable
              key={item.tab}
              scale={0.94}
              role="tab"
              aria-selected={isSelected}
              aria-label={badge != null ? `${title}, ${t(lang, `${badge} items`, `${badge} منتجات`)}` : title}
              onClick={() => onSelect(item.tab)}
              style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <span style={{ height: 4, flex: 'none' }} />
              <span style={{ position: 'relative', display: 'grid', width: 32, height: 32, marginTop: 7, flex: 'none' }}>
                <AnimatePresence initial={false}>
                  <motion.img
                    key={isSelected ? 'on' : 'off'}
                    src={assetURL(isSelected ? `${item.glyph}-selected` : item.glyph)}
                    alt=""
                    draggable={false}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={field.snappySpring}
                    style={{ gridArea: '1 / 1', width: 32, height: 32 }}
                  />
                </AnimatePresence>
                {badge != null && <CountBadge count={badge} />}
              </span>
              <span
                style={{
                  height: 21,
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: type.b12Medium.fontFamily,
                  fontWeight: type.b12Medium.fontWeight,
                  fontSize: type.b12Medium.fontSize,
                  letterSpacing: type.b12Medium.letterSpacing,
                  // The face's natural leading: Swift sets only the font here, not the Figma line height.
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  color: isSelected ? 'var(--nav-indicator)' : colour.text.tertiary,
                  transition: isStatic ? undefined : 'color 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                {title}
              </span>
            </Pressable>
          )
        })}
      </div>
    </nav>
  )
}

/** The 14pt count on the Cart glyph: white numeral on blue, ringed in white so it reads over the
 *  glyph. */
function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        insetInlineEnd: 0.5,
        minWidth: 14,
        height: 14,
        padding: count > 9 ? '0 3px' : 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: 'var(--nav-indicator)',
        boxShadow: `inset 0 0 0 1px ${colour.border.white}`,
        fontFamily: 'var(--font-noon)',
        fontWeight: 600,
        fontSize: 9,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        color: colour.text.onSurfaceBold,
      }}
    >
      {count}
    </span>
  )
}
