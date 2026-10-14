import { field, swiftSpring } from '../design/motion'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Transition } from 'motion/react'
import { SAFE_BOTTOM, SAFE_TOP, useApp } from './context'
import { colour, palette, radius, type } from '../design/tokens'
import { idDisplay } from '../model/identifier'
import { isRTL, ltr, t } from '../model/lang'
import { BOTTOM_NAV_HEIGHT } from '../ui/BottomNav'
import type { ButtonTone } from '../ui/Button'
import { FieldButton, tones } from '../ui/Button'
import type { IconName } from '../ui/Icon'
import { ArtImage, Icon } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

/** noon's dirham sign, drawn by the Noontree face at U+E001. */
const DIRHAM = ''

/** `.number.precision(.fractionLength(2))` in the device's (English) locale: "4,899.00". */
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The count on the Cart tab in the bottom nav (Figma E-2 · 0; CartTab.badgeCount). */
export const CART_BADGE_COUNT = 2

const CART_TOTAL = 1_760

/** `withAnimation(.spring(duration: 0.45, bounce: 0))` around showsCheckout. */
const CHECKOUT_SPRING: Transition = { ...swiftSpring(0.45, 0) }

/** The cart whose Checkout asks a signed-out customer to sign in: the second entry point for
 *  sign-in (Figma "E-2 · 0 · Cart (entry)"). Signed in, Checkout slides on to the placeholder. */
export function CartTab() {
  const app = useApp()
  const lang = app.lang
  const showsCheckout = app.showsCheckout && app.phase === 'signedIn'
  // .move(edge:) combined with .opacity: checkout comes from the trailing edge, the cart leaves
  // toward the leading edge, and back again. Mirrored in Arabic.
  const trailing = isRTL(lang) ? '-100%' : '100%'
  const leading = isRTL(lang) ? '100%' : '-100%'

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: colour.surface.tertiary }}>
      <AnimatePresence initial={false}>
        {showsCheckout ? (
          <motion.div
            key="checkout"
            initial={{ x: trailing, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: trailing, opacity: 0 }}
            transition={CHECKOUT_SPRING}
            style={{ position: 'absolute', inset: 0 }}
          >
            <CheckoutPlaceholder total={CART_TOTAL} onBack={() => app.set({ showsCheckout: false })} />
          </motion.div>
        ) : (
          <motion.div
            key="cart"
            initial={{ x: leading, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: leading, opacity: 0 }}
            transition={CHECKOUT_SPRING}
            style={{ position: 'absolute', inset: 0 }}
          >
            <CartPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// MARK: - Page

/** The delivery header under the status bar: 4 + the 42pt address block + 8. */
const HEADER_HEIGHT = 54
/** The savings tab (48) over the total bar (10 + 52 + 10), overlapping by 16. */
const FOOTER_HEIGHT = 104
/** Scrolled to rest, the express group sits this far under the header, as drawn. */
const RESTING_GAP = 140

/** The Figma frame shows the page part-way down: the end of the Global group under the delivery
 *  header and the express group in full. The page opens at that same spot and scrolls both ways.
 *
 *  Swift also opens the prototype controls from here (long-press the address, or a button at the
 *  very bottom of the scroll). The web twin's controls live in the site's panel beside the phone,
 *  so neither entry point is drawn. */
function CartPage() {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const expressRef = useRef<HTMLDivElement | null>(null)

  // The ScrollViewReader's scrollTo(anchor: .top), before the first paint.
  useLayoutEffect(() => {
    const scroller = scrollRef.current
    const header = headerRef.current
    const express = expressRef.current
    if (scroller && header && express) scroller.scrollTop = express.offsetTop - RESTING_GAP - header.offsetHeight
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, zIndex: 0, overflowX: 'hidden', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            // The header's height (contentMargins), the footer (safeAreaInset) and the tab bar.
            padding: `${SAFE_TOP + HEADER_HEIGHT + 8}px 12px ${16 + FOOTER_HEIGHT + BOTTOM_NAV_HEIGHT + SAFE_BOTTOM}px`,
          }}
        >
          <GlobalGroup />
          <div ref={expressRef}>
            <ExpressGroup />
          </div>
        </div>
      </div>
      <CartFooter />
      <CartHeader ref={headerRef} />
    </div>
  )
}

function CartHeader({ ref }: { ref: Ref<HTMLDivElement> }) {
  const lang = useApp().lang
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: `${SAFE_TOP + 4}px 12px 8px`,
        background: palette.grey['50'],
        borderBottomLeftRadius: radius.r16,
        borderBottomRightRadius: radius.r16,
      }}
    >
      <DeliveryAddress />
      <Pressable scale={0.94} aria-label={t(lang, 'Wishlist', 'قائمة الأمنيات')} style={{ flex: 'none', display: 'flex' }}>
        <ArtImage name="cart-heart-button" width={36} height={36} />
      </Pressable>
    </div>
  )
}

/** "Home ▾" over the street address. */
function DeliveryAddress() {
  const lang = useApp().lang
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginInlineStart: -1 }}>
        <ArtImage name="cart-address-home" width={20} height={20} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ ...cartType.addressLabel, color: palette.grey['900'], textShadow: '0 8px 16px rgba(0, 0, 0, 0.07)', whiteSpace: 'nowrap' }}>{t(lang, 'Home', 'المنزل')}</span>
          <ArtImage name="cart-chevron-down" width={16} height={16} />
        </div>
      </div>
      <div style={{ paddingInlineStart: 2 }}>
        <div dir="ltr" style={{ ...cartType.address, color: palette.grey['700'], width: 266, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Villa 52, Springville, K, VGP Layout, Mhada Colon
        </div>
      </div>
    </div>
  )
}

// MARK: - Fulfilment groups

interface Look {
  glass: string
  waves: string
  /** The items card's stroke, top to bottom. */
  cardStroke: [string, string]
  /** The strip's tint where it meets the card; it fades to white towards the bottom. */
  stripTint: string
  progressFill: string
}

/** One fulfilment group: a tinted glass card with colour waves and the group's mark, the white items
 *  card, and the free-shipping progress strip tucked 24pt under it. */
function FulfilmentGroup({ look, progressText, mark, children }: { look: Look; progressText: string; mark: ReactNode; children: ReactNode }) {
  const rtl = isRTL(useApp().lang)
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: radius.r16, background: look.glass, boxShadow: `inset 0 0 0 1px ${palette.grey['100']}` }}>
          <ArtImage name={look.waves} width={206} height={53.5} style={{ position: 'absolute', top: 1, insetInlineStart: 1, transform: rtl ? 'scaleX(-1)' : undefined }} />
        </div>

        <div style={{ position: 'relative', height: 20, padding: '0 20px', display: 'flex', alignItems: 'center' }}>{mark}</div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 12, borderRadius: radius.r16, overflow: 'hidden', background: colour.surface.primary }}>
          {children}
          <NoonOneCallout />
          <GradientStroke colors={look.cardStroke} cornerRadius={radius.r16} />
        </div>
      </div>

      <ProgressStrip text={progressText} tint={look.stripTint} fill={look.progressFill} />
    </div>
  )
}

function GlobalGroup() {
  const lang = useApp().lang
  return (
    <FulfilmentGroup
      look={{ glass: '#F5F2F7', waves: 'cart-waves-global', cardStroke: ['#EFC9FB', '#F9E9FE'], stripTint: '#F9EBFE', progressFill: palette.neutral.black }}
      progressText={t(lang, `Add ${DIRHAM} 12 from Global for free shipping`, `أضف ${DIRHAM} 12 من جلوبال للشحن المجاني`)}
      mark={
        // The mark reads left to right in Arabic too; it still sits at the leading edge.
        <span dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 1.9, paddingLeft: 2 }}>
          <ArtImage name="cart-global-icon" width={26.6} height={24.7} />
          <span style={{ fontFamily: 'var(--font-noon)', fontWeight: 700, fontSize: 15.2, lineHeight: 1.2, color: '#3D4048' }}>Global</span>
        </span>
      }
    >
      <CartItemRow line={LINES.globalFirst} />
      <div style={{ height: 1, margin: '0 8px', background: '#EBEBEB' }} />
      <CartItemRow line={LINES.globalSecond} />
    </FulfilmentGroup>
  )
}

function ExpressGroup() {
  const lang = useApp().lang
  return (
    <FulfilmentGroup
      look={{ glass: '#FDFDF1', waves: 'cart-waves-express', cardStroke: ['#FDF69B', '#FEFDC8'], stripTint: '#FFFEEF', progressFill: palette.grey['1000'] }}
      progressText={t(lang, `Add ${DIRHAM} 12 from Express for free shipping`, `أضف ${DIRHAM} 12 من إكسبريس للشحن المجاني`)}
      mark={
        <span role="img" aria-label="express" style={{ height: 18, marginTop: 2, display: 'flex', alignItems: 'center' }}>
          <ArtImage name="cart-express-wordmark" width={64.62} height={12.68} />
        </span>
      }
    >
      <CartItemRow line={LINES.express} />
    </FulfilmentGroup>
  )
}

/** A 1pt stroke just inside the edge, shaded top to bottom (`strokeBorder(LinearGradient…)`). */
function GradientStroke({ colors, cornerRadius }: { colors: [string, string]; cornerRadius: number }) {
  const ring = 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)'
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        padding: 1,
        borderRadius: cornerRadius,
        background: `linear-gradient(${colors[0]}, ${colors[1]})`,
        WebkitMask: ring,
        WebkitMaskComposite: 'xor',
        mask: ring,
        maskComposite: 'exclude',
        pointerEvents: 'none',
      }}
    />
  )
}

/** "Save with noon One. Try it now for Free" across the foot of an items card. */
function NoonOneCallout() {
  const lang = useApp().lang
  return (
    <div style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: colour.surface.primary, boxShadow: `inset 0 1px 0 ${palette.grey['200']}` }}>
      <NoonOneMark />
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 4, color: palette.grey['800'], whiteSpace: 'nowrap' }}>
        <span style={cartType.bodyMedium}>{t(lang, 'Save with noon One.', 'وفّر مع نون وان.')}</span>
        <span style={cartType.body}>{t(lang, 'Try it now for', 'جرّبه الآن')}</span>
        <span style={{ ...cartType.free, color: palette.emerald['700'] }}>{t(lang, 'Free', 'مجاناً')}</span>
      </div>
    </div>
  )
}

/** The noon One logo in its 20pt slot. */
function NoonOneMark() {
  return (
    <span aria-hidden style={{ flex: 'none', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ArtImage name="cart-one-logo" width={20} height={12.174} />
    </span>
  )
}

/** "Add ₿ 12 from … for free shipping", its progress bar and an Add button. */
function ProgressStrip({ text, tint, fill }: { text: string; tint: string; fill: string }) {
  const lang = useApp().lang
  return (
    <div
      style={{
        marginTop: -24,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '36px 12px 16px',
        background: `linear-gradient(${tint} 0%, #FFFFFF 93.2%)`,
        borderBottomLeftRadius: radius.r16,
        borderBottomRightRadius: radius.r16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ ...cartType.progress, color: palette.grey['1000'], maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
        <span style={{ position: 'relative', display: 'block', width: 258, height: 4, borderRadius: radius.r6, overflow: 'hidden', background: palette.grey['300'] }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, width: 67, borderRadius: radius.r2, background: fill }} />
        </span>
      </div>

      {/* Figma's 57pt button is narrower than its padded label, which overhangs both sides evenly. */}
      <Pressable
        scale={0.96}
        style={{ flex: 'none', width: 57, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.r6, background: colour.surface.primary, boxShadow: 'inset 0 0 0 1px rgba(14, 14, 14, 0.14)' }}
      >
        <span style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, paddingInlineStart: 6, paddingInlineEnd: 12 }}>
          <ArtImage name="cart-add-plus" width={16} height={16} />
          <span style={{ ...cartType.add, color: palette.grey['1000'], whiteSpace: 'nowrap' }}>{t(lang, 'Add', 'أضف')}</span>
        </span>
      </Pressable>
    </div>
  )
}

// MARK: - Items

type CartPhoto = 'airpods' | 'mug' | 'shampoo'
type CartPoint = 'refund' | 'warranty' | 'nonReturnable' | 'prepaid' | 'fasterDelivery'

/** One cart line as drawn in Figma. Every line carries the same product title there. */
interface CartLine {
  photo: CartPhoto
  quantity: number
  subtitle: 'combo' | 'variants'
  pricing: 'offerApplied' | 'regular'
  delivery: 'express' | 'scheduled'
  /** Coupons and the "Lowest Price in 30 days" badge. */
  showsDeals: boolean
  points: CartPoint[][]
  tertiarySpacing: number
}

const LINES = {
  express: {
    photo: 'airpods', quantity: 2, subtitle: 'combo', pricing: 'offerApplied', delivery: 'express', showsDeals: false,
    points: [['warranty', 'nonReturnable'], ['prepaid'], ['fasterDelivery']], tertiarySpacing: 8,
  },
  globalFirst: {
    photo: 'mug', quantity: 2, subtitle: 'variants', pricing: 'regular', delivery: 'scheduled', showsDeals: true,
    points: [['refund', 'nonReturnable'], ['fasterDelivery']], tertiarySpacing: 6,
  },
  globalSecond: {
    photo: 'shampoo', quantity: 1, subtitle: 'combo', pricing: 'regular', delivery: 'scheduled', showsDeals: true,
    points: [['warranty'], ['nonReturnable', 'prepaid']], tertiarySpacing: 8,
  },
} satisfies Record<string, CartLine>

/** A tint that fades from the leading edge to the trailing one, mirrored in Arabic. */
const alongLine = (rtl: boolean, stops: string) => `linear-gradient(${rtl ? 'to left' : 'to right'}, ${stops})`

const column = (gap: number, extra?: CSSProperties): CSSProperties => ({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap, ...extra })

function CartItemRow({ line }: { line: CartLine }) {
  const [quantity, setQuantity] = useState(line.quantity)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 8px' }}>
      <div style={{ flex: 'none', width: 104, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 104, height: 144, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.r12, overflow: 'hidden', background: palette.grey['100'] }}>
          <Photo photo={line.photo} />
        </div>
        <div style={{ position: 'relative', marginTop: -16 }}>
          <QuantityStepper quantity={quantity} onChange={setQuantity} />
        </div>
      </div>

      <div style={column(16, { flex: 1, minWidth: 0 })}>
        <div style={column(10, { alignSelf: 'stretch' })}>
          <div style={column(4, { alignSelf: 'stretch' })}>
            <TitleRow />
            <Subtitle kind={line.subtitle} />
          </div>
          <div style={column(8)}>
            <Price pricing={line.pricing} />
            {line.pricing === 'offerApplied' && <OfferApplied />}
            <Delivery kind={line.delivery} />
          </div>
        </div>
        <div style={column(line.tertiarySpacing, { alignSelf: 'stretch' })}>
          {line.showsDeals && (
            <>
              <CouponsBar />
              <LowestPrice />
            </>
          )}
          {/* Figma's points block is a fixed 60pt: three rows fill it, two leave a gap. */}
          <div style={column(6, { height: 60, maxWidth: '100%' })}>
            {line.points.map((row, index) => (
              <div key={index} style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                {row.map((point) => (
                  <Point key={point} point={point} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Photo({ photo }: { photo: CartPhoto }) {
  switch (photo) {
    case 'airpods':
      return <ArtImage name="cart-airpods" width={101.88} height={101.88} style={{ transform: 'translateX(-1.59px)' }} />
    case 'mug':
      return (
        <>
          <ArtImage name="cart-mug" width={104} height={144} style={{ objectFit: 'cover' }} />
          <ArtImage name="cart-checkbox" width={24} height={24} style={{ position: 'absolute', top: 8, insetInlineStart: 8 }} />
        </>
      )
    case 'shampoo':
      return <ArtImage name="cart-shampoo" width={60} height={70} style={{ objectFit: 'cover' }} />
  }
}

function TitleRow() {
  const lang = useApp().lang
  return (
    <div style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...cartType.title, color: palette.grey['1000'], flex: 1, minWidth: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {t(lang, 'Apple Watch Series 9 GPS 41mm Silver Aluminium Case With Storm Blue Sport Band', 'ساعة Apple Watch Series 9 بنظام GPS مقاس 41 ملم بهيكل من الألومنيوم الفضي وحزام رياضي بلون Storm Blue')}
      </span>
      <Pressable
        scale={0.94}
        aria-label={t(lang, 'Move to wishlist', 'انقل إلى قائمة الأمنيات')}
        style={{ flex: 'none', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.r8, background: palette.grey['50'], boxShadow: `inset 0 0 0 1px ${palette.grey['200']}` }}
      >
        <ArtImage name="cart-wishlist" width={16} height={16} />
      </Pressable>
    </div>
  )
}

function Subtitle({ kind }: { kind: CartLine['subtitle'] }) {
  const lang = useApp().lang
  const rtl = isRTL(lang)
  if (kind === 'combo') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: radius.r6, background: alongLine(rtl, '#EAF4FE 0%, #FFFFFF 85.4%') }}>
        <span style={{ flex: 'none', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArtImage name="cart-combo" width={16.2} height={16.2} style={{ objectFit: 'cover' }} />
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ ...cartType.chip, color: palette.grey['800'], height: 18, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{t(lang, 'Combo', 'مجموعة')}</span>
          <ArtImage name="cart-info" width={16} height={16} />
        </div>
      </div>
    )
  }
  const names = [t(lang, '256 GB', '256 جيجابايت'), t(lang, 'Natural Gray', 'رمادي طبيعي'), t(lang, 'WiFi+cellular', 'واي فاي + خلوي'), t(lang, 'Device only', 'الجهاز فقط')]
  return (
    <div style={{ alignSelf: 'stretch', height: 24, display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', borderRadius: radius.r6, background: palette.grey['100'] }}>
      <span style={{ ...cartType.chip, color: palette.grey['800'], flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {names.map((name, index) => (
          <Fragment key={index}>
            {index > 0 && <span style={cartType.chipSeparator}>{' · '}</span>}
            {name}
          </Fragment>
        ))}
      </span>
      <span style={{ flex: 'none', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArtImage name="cart-chevron-right" width={12} height={12} style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
      </span>
    </div>
  )
}

function Price({ pricing }: { pricing: CartLine['pricing'] }) {
  const lang = useApp().lang
  const discount = t(lang, '47% OFF', 'خصم 47%')
  const offer = pricing === 'offerApplied'
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4, color: palette.grey['500'], whiteSpace: 'nowrap' }}>
      <span style={{ ...cartType.price, color: offer ? undefined : palette.grey['1000'] }}>{`${DIRHAM}109`}</span>
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 1 }}>
        <span style={{ ...cartType.oldPrice, color: offer ? undefined : palette.grey['600'] }}>{`${DIRHAM}209`}</span>
        <span style={{ ...cartType.discount, color: offer ? undefined : palette.emerald['700'] }}>{discount}</span>
      </span>
      {/* The list price is struck through as one line: the offer price below replaces it. */}
      {offer && <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 1, background: palette.grey['500'] }} />}
    </div>
  )
}

function OfferApplied() {
  const lang = useApp().lang
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderRadius: radius.r6, background: alongLine(isRTL(lang), '#EBFFF4, rgba(235, 255, 244, 0.1)'), whiteSpace: 'nowrap' }}>
      <span style={{ ...cartType.offerPrice, color: '#108757' }}>{`${DIRHAM}95`}</span>
      <span style={{ flex: 'none', width: 3, height: 3, borderRadius: '50%', background: palette.grey['600'] }} />
      <span style={{ ...cartType.offerLabel, color: '#0E0E0E' }}>{t(lang, 'Offer Applied', 'تم تطبيق العرض')}</span>
      <ArtImage name="cart-xmark" width={16} height={16} />
    </div>
  )
}

function Delivery({ kind }: { kind: CartLine['delivery'] }) {
  const lang = useApp().lang
  const rtl = isRTL(lang)
  if (kind === 'express') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: radius.r6, background: alongLine(rtl, '#F5F5FC, #FFFFFF') }}>
        <ArtImage name="cart-flash" width={14} height={14} />
        <span style={{ ...cartType.eta, height: 18, color: palette.supermall['800'], whiteSpace: 'nowrap' }}>
          {t(lang, 'Get in ', 'استلمه خلال ')}
          <span style={{ fontWeight: 700 }}>{t(lang, '1 hour 12 mins', 'ساعة و12 دقيقة')}</span>
        </span>
      </div>
    )
  }
  return (
    // As in Figma, only the date pill takes up room; the cut-off line hangs below it.
    <div style={{ height: 26, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{ ...cartType.eta, flex: 'none', height: 26, padding: '4px 6px', borderRadius: radius.r6, background: alongLine(rtl, '#F6F6F6, #FFFFFF'), color: palette.grey['900'], whiteSpace: 'nowrap' }}>
        {t(lang, 'Get by ', 'استلمه بحلول ')}
        <span style={{ fontWeight: 700, color: palette.grey['1000'] }}>{t(lang, '7th Sep, Saturday', 'السبت، 7 سبتمبر')}</span>
      </span>
      <span style={{ ...cartType.body, flex: 'none', height: 20, lineHeight: '20px', padding: '0 6px', color: palette.grey['800'], whiteSpace: 'nowrap' }}>
        {t(lang, 'Order within ', 'اطلب خلال ')}
        <span style={{ fontWeight: 600 }}>{t(lang, '1 hrs 20 mins', 'ساعة و20 دقيقة')}</span>
      </span>
    </div>
  )
}

function LowestPrice() {
  const lang = useApp().lang
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: radius.r4, background: alongLine(isRTL(lang), '#F3F5FC, #FFFFFF') }}>
      <ArtImage name="cart-price-drop" width={16} height={16} />
      <span style={{ ...cartType.offerLabel, color: palette.grey['700'], whiteSpace: 'nowrap' }}>{t(lang, 'Lowest Price in 30 days', 'أقل سعر خلال 30 يوماً')}</span>
    </div>
  )
}

function Point({ point }: { point: CartPoint }) {
  const lang = useApp().lang
  const [icon, title]: [string | null, string] = {
    refund: [null, t(lang, '2x Refund', 'استرداد مضاعف')],
    warranty: ['cart-warranty', t(lang, '1 year warranty', 'ضمان لمدة سنة')],
    nonReturnable: ['cart-nonreturnable', t(lang, 'non-returnable', 'غير قابل للإرجاع')],
    prepaid: ['cart-prepaid', t(lang, 'Prepaid only', 'الدفع المسبق فقط')],
    fasterDelivery: ['cart-fastdelivery', t(lang, 'Faster Delivery at checkout', 'توصيل أسرع عند الدفع')],
  }[point] as [string | null, string]
  return (
    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Figma's refund glyph is empty; its slot stays. */}
      {icon ? <ArtImage name={icon} width={16} height={16} /> : <span style={{ flex: 'none', width: 16, height: 16 }} />}
      <span style={{ ...(point === 'refund' ? type.b11Regular : cartType.body), color: palette.grey['900'], minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
    </div>
  )
}

/** − 2 + under the product photo; at one, minus becomes remove. */
function QuantityStepper({ quantity, onChange }: { quantity: number; onChange: (quantity: number) => void }) {
  const lang = useApp().lang
  // .numericText(value:): the new figure rolls in from below as the count rises, from above as it falls.
  const [rising, setRising] = useState(true)
  const step = (next: number) => {
    if (next === quantity) return
    setRising(next > quantity)
    onChange(next)
  }
  return (
    <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: radius.r8, background: colour.surface.primary, boxShadow: 'inset 0 0 0 1px #EBEBEB' }}>
      <StepButton
        image={quantity > 1 ? 'cart-minus' : 'cart-trash'}
        label={quantity > 1 ? t(lang, 'Decrease quantity', 'إنقاص الكمية') : t(lang, 'Remove', 'إزالة')}
        onClick={() => step(Math.max(1, quantity - 1))}
      />
      <span style={{ ...cartType.stepper, width: 20, display: 'grid', justifyItems: 'center', color: '#0E0E0E' }}>
        <AnimatePresence initial={false} custom={rising}>
          <motion.span
            key={quantity}
            custom={rising}
            variants={numericRoll}
            initial="enter"
            animate="center"
            exit="exit"
            transition={field.snappySpring}
            style={{ gridArea: '1 / 1' }}
          >
            {quantity}
          </motion.span>
        </AnimatePresence>
      </span>
      <StepButton image="cart-plus" label={t(lang, 'Increase quantity', 'زيادة الكمية')} onClick={() => step(quantity + 1)} />
    </div>
  )
}

const numericRoll = {
  enter: (rising: boolean) => ({ y: rising ? 10 : -10, opacity: 0, filter: 'blur(2px)' }),
  center: { y: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (rising: boolean) => ({ y: rising ? -10 : 10, opacity: 0, filter: 'blur(2px)' }),
}

function StepButton({ image, label, onClick }: { image: string; label: string; onClick: () => void }) {
  return (
    // 10pt of extra hit area all round (contentShape inset by −10).
    <Pressable scale={0.9} aria-label={label} onClick={onClick} style={{ flex: 'none', display: 'flex', padding: 10, margin: -10 }}>
      <ArtImage name={image} width={16} height={16} />
    </Pressable>
  )
}

/** Coupon chips that scroll sideways and fade out at the trailing edge. */
function CouponsBar() {
  const lang = useApp().lang
  const rtl = isRTL(lang)
  return (
    <div style={{ alignSelf: 'stretch', position: 'relative', height: 30 }}>
      <div style={{ height: 30, display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden' }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            style={{
              flex: 'none',
              width: 150,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '0 10px',
              borderRadius: radius.r8,
              background: '#F6FEFD',
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${palette.emerald['700']} 40%, transparent)`,
            }}
          >
            <span style={{ ...cartType.discount, color: palette.grey['900'], minWidth: 0, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(lang, 'Extra 10%  Off - Code ', 'خصم إضافي 10% - كود ')}</span>
            <ArtImage name="cart-chevron-right" width={12} height={12} style={{ transform: rtl ? 'scaleX(-1)' : undefined }} />
          </div>
        ))}
      </div>
      <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 0, width: 30, background: alongLine(rtl, 'rgba(255, 255, 255, 0), #FFFFFF'), pointerEvents: 'none' }} />
    </div>
  )
}

// MARK: - Footer

/** The cart's Checkout: Figma #0057FF. */
const checkoutTone: ButtonTone = { background: '#0057FF', pressed: '#0047D1', foreground: colour.text.onSurfaceBold }

/** The savings tab and the sticky total + Checkout bar above the nav. */
function CartFooter() {
  const app = useApp()
  const lang = app.lang
  return (
    // Only the tab and the bar take touches: the page scrolls on beside the tab.
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: BOTTOM_NAV_HEIGHT + SAFE_BOTTOM, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', width: 239, height: 48, pointerEvents: 'auto' }}>
        <ArtImage name="cart-waves-savings" width={239} height={48} style={{ transform: isRTL(lang) ? 'scaleX(-1)' : undefined, filter: 'drop-shadow(0 -4px 20px rgba(0, 0, 0, 0.08))' }} />
        <div style={{ position: 'absolute', top: 4, insetInlineStart: 12, height: 24, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Saved />
          <NoonOneMark />
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          alignSelf: 'stretch',
          marginTop: -16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderTopLeftRadius: radius.r12,
          borderTopRightRadius: radius.r12,
          background: colour.surface.primary,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
          pointerEvents: 'auto',
        }}
      >
        <div style={column(4, { flex: 'none', width: 131, paddingInlineStart: 4 })}>
          <span style={{ ...cartType.totalLabel, color: palette.grey['600'] }}>{t(lang, 'Total', 'المجموع')}</span>
          <span
            style={{
              ...cartType.total,
              color: '#0E0E0E',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              textDecorationLine: 'underline',
              textDecorationStyle: 'dashed',
              textDecorationThickness: 1,
              textUnderlineOffset: 3,
            }}
          >
            {`${DIRHAM} ${money(CART_TOTAL)}`}
          </span>
        </div>
        <FieldButton
          title={t(lang, 'Checkout', 'إتمام الشراء')}
          tone={checkoutTone}
          size="h52"
          textStyle={cartType.checkout}
          onClick={() => app.beginCheckout()}
          style={{ flex: 1, minWidth: 0, width: 'auto' }}
        />
      </div>
    </div>
  )
}

/** "₿130 saved!", or "وفّرت ₿130" in Arabic. */
function Saved() {
  const lang = useApp().lang
  const amount = <span style={cartType.savedAmount}>{`${DIRHAM}130`}</span>
  const word = <span style={cartType.saved}>{t(lang, 'saved!', 'وفّرت')}</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: palette.emerald['700'], whiteSpace: 'nowrap' }}>
      {lang === 'ar' ? (
        <>
          {word}
          {amount}
        </>
      ) : (
        <>
          {amount}
          {word}
        </>
      )}
    </div>
  )
}

// MARK: - Styles

/** A Noontree style from the cart frame: weight, size, Figma line height and tracking. */
const noon = (fontWeight: number, fontSize: number, lineHeight: number, letterSpacing: number): CSSProperties => ({ fontFamily: 'var(--font-noon)', fontWeight, fontSize, lineHeight: `${lineHeight}px`, letterSpacing })

/** The cart frame's type, set in Noontree. (The delivery header is Figtree in Figma.) */
const cartType = {
  addressLabel: noon(700, 16, 22, -0.3),
  address: noon(400, 13, 18, -0.3),
  title: noon(500, 14, 18, 0),
  chip: noon(400, 12, 14, -0.07),
  chipSeparator: noon(500, 12, 14, 0),
  price: noon(700, 16, 20, -0.16),
  oldPrice: noon(400, 12, 16, 0),
  discount: noon(600, 12, 14, -0.12),
  offerPrice: noon(700, 14, 18, -0.14),
  offerLabel: noon(500, 12, 14, -0.12),
  eta: noon(400, 13, 18, 0),
  body: noon(400, 12, 16, 0),
  bodyMedium: noon(500, 12, 16, 0),
  free: noon(600, 12, 14, -0.12),
  stepper: noon(700, 14, 18, -0.14),
  progress: noon(500, 13, 16, -0.26),
  add: noon(600, 14, 18, -0.14),
  savedAmount: noon(600, 14, 18, -0.14),
  saved: noon(400, 14, 18, -0.14),
  totalLabel: noon(500, 12, 14, -0.12),
  total: noon(700, 20, 24, -0.2),
  checkout: noon(600, 17, 20, -0.26),
}

// MARK: - Checkout

/** Where checkout carries on once you're signed in. A placeholder for the real flow. */
export function CheckoutPlaceholder({ total, onBack }: { total: number; onBack: () => void }) {
  const app = useApp()
  const lang = app.lang
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 16,
        padding: `${SAFE_TOP + 8}px 16px ${16 + BOTTOM_NAV_HEIGHT + SAFE_BOTTOM}px`,
      }}
    >
      <Pressable scale={0.96} onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 44, color: colour.text.primary }}>
        <Icon name="system-arrow-left" size={20} flipsRTL />
        <span style={type.b14SemiBold}>{t(lang, 'Cart', 'السلة')}</span>
      </Pressable>

      <h1 style={{ margin: 0, ...type.h24Bold, color: colour.text.primary }}>{t(lang, 'Checkout', 'إتمام الشراء')}</h1>

      <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16, background: colour.surface.primary }}>
        <SummaryRow icon="bottomnav-profile" title={t(lang, 'Signed in as', 'تم تسجيل الدخول باسم')} value={app.session ? ltr(idDisplay(app.session.identifier)) : ''} />
        <div style={{ alignSelf: 'stretch', height: 1, background: colour.border.primary }} />
        <SummaryRow icon="system-location" title={t(lang, 'Deliver to', 'التوصيل إلى')} value={t(lang, 'Add an address', 'أضف عنواناً')} />
        <div style={{ alignSelf: 'stretch', height: 1, background: colour.border.primary }} />
        <SummaryRow icon="system-payment-card-small" title={t(lang, 'Pay with', 'الدفع بواسطة')} value={t(lang, 'Choose a payment method', 'اختر طريقة الدفع')} />
      </div>

      <div style={{ flex: 1, minHeight: 0 }} />

      <FieldButton
        title={t(lang, `Place order · ${DIRHAM} ${money(total)}`, 'تأكيد الطلب')}
        tone={tones.neutral}
        style={{ opacity: 0.5, pointerEvents: 'none' }}
      />
    </div>
  )
}

function SummaryRow({ icon, title, value }: { icon: IconName; title: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={24} color={colour.text.secondary} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={{ ...type.b13Regular, color: colour.text.tertiary }}>{title}</span>
        <span style={{ ...type.b14SemiBold, color: colour.text.primary }}>{value}</span>
      </div>
    </div>
  )
}
