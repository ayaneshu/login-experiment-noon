import type { CSSProperties, ReactNode } from 'react'
import { useId } from 'react'
import { SAFE_BOTTOM, SAFE_TOP, SCREEN, useApp } from './context'
import type { Lang } from '../model/lang'
import { isRTL, ltr, t } from '../model/lang'
import type { Account } from '../model/services'
import { BOTTOM_NAV_HEIGHT } from '../ui/BottomNav'
import { Pressable } from '../ui/Pressable'

// MARK: - Palette (Palette.swift, light appearance — the web app is light only)

const Palette = {
  yellow: '#FEEE00',
  onYellow: '#0E1014',
  surface: '#FFFFFF',
  raised: '#F3F4F6',
  ink: '#0E1014',
  ink2: '#5E6371',
  ink3: '#9A9EA9',
  accent: '#3866DF',
  danger: '#D92D3A',
}

/** `.system` fonts: SF Pro / SF Arabic, with the face's natural leading (≈1.19). */
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Arabic', 'Geeza Pro', system-ui, sans-serif"
const SF_ROUNDED = "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
const lineHeight = (size: number) => size * 1.193
function sf(size: number, weight = 400, family = SF): CSSProperties {
  return { fontFamily: family, fontSize: size, fontWeight: weight, lineHeight: `${lineHeight(size)}px` }
}

const LOGO_SIZE = 28

// MARK: - Catalog (HomeCatalog.swift)

/** Placeholder merchandising so the home page feels like noon, not a template. */
interface Category { id: string; en: string; ar: string; symbol: SymbolName; tint: string }
interface Banner { id: string; eyebrowEN: string; eyebrowAR: string; titleEN: string; titleAR: string; symbol: SymbolName; colors: [string, string] }
interface Product { id: string; en: string; ar: string; symbol: SymbolName; tint: string; price: string; was: string; discount: number }

export const HomeCatalog: { categories: Category[]; banners: Banner[]; products: Product[] } = {
  categories: [
    { id: 'mobiles', en: 'Mobiles', ar: 'الجوالات', symbol: 'iphone', tint: '#3866DF' },
    { id: 'electronics', en: 'Electronics', ar: 'الإلكترونيات', symbol: 'tv', tint: '#6A4CE0' },
    { id: 'fashion', en: 'Fashion', ar: 'الأزياء', symbol: 'tshirt', tint: '#E0487A' },
    { id: 'beauty', en: 'Beauty', ar: 'الجمال', symbol: 'sparkles', tint: '#D2508F' },
    { id: 'home', en: 'Home', ar: 'المنزل', symbol: 'sofa', tint: '#C2771A' },
    { id: 'grocery', en: 'Grocery', ar: 'البقالة', symbol: 'basket', tint: '#1E9B55' },
    { id: 'toys', en: 'Toys', ar: 'الألعاب', symbol: 'teddybear', tint: '#E2842B' },
    { id: 'sports', en: 'Sports', ar: 'الرياضة', symbol: 'figure.run', tint: '#0E8FA8' },
  ],
  banners: [
    { id: 'phones', eyebrowEN: 'Mobile week', eyebrowAR: 'أسبوع الجوالات', titleEN: 'The latest phones, delivered today', titleAR: 'أحدث الجوالات تصلك اليوم', symbol: 'iphone.gen3', colors: ['#2A4FC4', '#6C8CFF'] },
    { id: 'minutes', eyebrowEN: 'noon Minutes', eyebrowAR: 'نون مينتس', titleEN: 'Groceries at your door in 15 minutes', titleAR: 'بقالتك عند بابك خلال 15 دقيقة', symbol: 'basket.fill', colors: ['#12814A', '#3CC47C'] },
    { id: 'beauty', eyebrowEN: 'Beauty edit', eyebrowAR: 'مختارات الجمال', titleEN: 'New arrivals from top brands', titleAR: 'وصل حديثاً من أشهر العلامات', symbol: 'sparkles', colors: ['#B0306E', '#F0709E'] },
  ],
  products: [
    { id: 'buds', en: 'Wireless noise-cancelling earbuds', ar: 'سماعات لاسلكية بعزل الضوضاء', symbol: 'earbuds', tint: '#3A3F4B', price: '649', was: '899', discount: 28 },
    { id: 'watch', en: 'Smart watch with GPS, 45mm', ar: 'ساعة ذكية مع GPS، 45 مم', symbol: 'applewatch', tint: '#E0487A', price: '1,299', was: '1,599', discount: 19 },
    { id: 'controller', en: 'Wireless game controller', ar: 'يد تحكم لاسلكية للألعاب', symbol: 'gamecontroller.fill', tint: '#6A4CE0', price: '229', was: '279', discount: 18 },
    { id: 'laptop', en: '13-inch ultralight laptop', ar: 'حاسوب محمول خفيف 13 إنش', symbol: 'laptopcomputer', tint: '#3866DF', price: '3,899', was: '4,499', discount: 13 },
    { id: 'camera', en: 'Instant film camera', ar: 'كاميرا فورية', symbol: 'camera.fill', tint: '#C2771A', price: '349', was: '429', discount: 19 },
  ],
}

// MARK: - Home

export function HomeView() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: Palette.surface }}>
      <Header />
      <div style={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            paddingTop: 20,
            // 32 of content padding, plus the tab bar (safeAreaPadding) and the home-indicator inset.
            paddingBottom: 32 + BOTTOM_NAV_HEIGHT + SAFE_BOTTOM,
          }}
        >
          <Greeting />
          <Categories />
          <Banners />
          <Deals />
        </div>
      </div>
    </div>
  )
}

// MARK: Header

function Header() {
  const app = useApp()
  const lang = app.lang
  return (
    // The yellow header is a brand surface, so it looks the same in light and dark.
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 12, padding: `${SAFE_TOP}px 16px 14px`, background: Palette.yellow }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Wordmark size={LOGO_SIZE} />
        <span style={{ flex: 1, minWidth: 8 }} />
        <Pressable scale={0.96} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ ...sf(12), color: 'rgba(14, 16, 20, 0.65)', whiteSpace: 'nowrap' }}>{t(lang, 'Deliver to', 'التوصيل إلى')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: Palette.onYellow }}>
            <span style={{ ...sf(15, 600), whiteSpace: 'nowrap' }}>{t(lang, 'Dubai Marina', 'دبي مارينا')}</span>
            <SFSymbol name="chevron.down" size={10} weight="bold" />
          </span>
        </Pressable>
        <Pressable scale={0.96} onClick={() => app.selectTab('account')} aria-label={t(lang, 'Account', 'حسابي')} style={{ borderRadius: 999, flex: 'none' }}>
          <Avatar initials={initials(app.session)} size={36} ring />
        </Pressable>
      </div>

      <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 14, background: '#FFFFFF' }}>
        <SFSymbol name="magnifyingglass" size={16} weight="semibold" color="#5E6371" />
        <span style={{ ...sf(16), color: '#8A8E99', whiteSpace: 'nowrap' }}>{t(lang, 'What are you looking for?', 'عمّ تبحث؟')}</span>
        <span style={{ flex: 1 }} />
        <SFSymbol name="camera" size={16} weight="medium" color="#5E6371" />
      </div>
    </div>
  )
}

/** "noon" in the rounded black system face (Wordmark in Components.swift). */
function Wordmark({ size = 60, color = Palette.onYellow }: { size?: number; color?: string }) {
  return (
    <span aria-label="noon" style={{ ...sf(size, 900, SF_ROUNDED), letterSpacing: -size * 0.035, color, whiteSpace: 'nowrap', flex: 'none', direction: 'ltr' }}>
      noon
    </span>
  )
}

function initials(account: Account | null): string | null {
  if (!account) return null
  const letters = [account.firstName, account.lastName].map((part) => part?.[0]).filter(Boolean)
  return letters.length ? letters.join('') : null
}

/** Yellow circle with the customer's initials, or a person glyph (Avatar in Components.swift). */
function Avatar({ initials, size = 44, ring = false }: { initials: string | null; size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: Palette.yellow,
        // Inner 1pt hairline, and on the home header a 2pt white ring over it (both strokeBorder).
        boxShadow: `${ring ? 'inset 0 0 0 2px rgba(255, 255, 255, 0.7), ' : ''}inset 0 0 0 1px rgba(0, 0, 0, 0.06)`,
      }}
    >
      {initials ? (
        <span style={{ ...sf(size * 0.38, 700, SF_ROUNDED), lineHeight: 1, color: Palette.onYellow }}>{initials}</span>
      ) : (
        <SFSymbol name="person.fill" size={size * 0.42} weight="semibold" color="rgba(14, 16, 20, 0.85)" />
      )}
    </span>
  )
}

// MARK: Sections

function Greeting() {
  const app = useApp()
  const lang = app.lang
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 16px' }}>
      <h1 style={{ margin: 0, ...sf(22, 700), letterSpacing: -0.3, color: Palette.ink }}>{greetingTitle(lang, app.session?.firstName ?? null)}</h1>
      <p style={{ margin: 0, ...sf(15), color: Palette.ink2 }}>
        {app.sessionIsNew
          ? t(lang, 'Here are a few deals to get you started.', 'إليك بعض العروض لتبدأ بها.')
          : t(lang, "Here's what's new since your last visit.", 'إليك الجديد منذ زيارتك الأخيرة.')}
      </p>
    </div>
  )
}

function greetingTitle(lang: Lang, name: string | null) {
  const hour = new Date().getHours()
  const greeting =
    hour >= 5 && hour < 12 ? t(lang, 'Good morning', 'صباح الخير')
    : hour >= 12 && hour < 17 ? t(lang, 'Good afternoon', 'طاب يومك')
    : t(lang, 'Good evening', 'مساء الخير')
  if (!name) return greeting
  return t(lang, `${greeting}, ${name}`, `${greeting}، ${name}`)
}

/** A horizontal ScrollView row: hidden indicators, 16pt margins on both ends. */
function HorizontalScroll({ gap, children, snap = false, alignItems = 'flex-start' }: { gap: number; children: ReactNode; snap?: boolean; alignItems?: CSSProperties['alignItems'] }) {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', scrollSnapType: snap ? 'x mandatory' : undefined, scrollPaddingInline: snap ? 16 : undefined, overscrollBehaviorX: 'contain' }}>
      <div style={{ display: 'flex', alignItems, gap, width: 'max-content', padding: '0 16px' }}>{children}</div>
    </div>
  )
}

function Categories() {
  const lang = useApp().lang
  return (
    <HorizontalScroll gap={14}>
      {HomeCatalog.categories.map((category) => (
        <div key={category.id} style={{ width: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 64, height: 64, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: withAlpha(category.tint, 0.12) }}>
            <SFSymbol name={category.symbol} size={24} weight="medium" color={category.tint} />
          </span>
          <span style={{ ...sf(12, 500), color: Palette.ink, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(lang, category.en, category.ar)}</span>
        </div>
      ))}
    </HorizontalScroll>
  )
}

function Banners() {
  return (
    <HorizontalScroll gap={12} snap>
      {HomeCatalog.banners.map((banner) => (
        <BannerCard key={banner.id} banner={banner} />
      ))}
    </HorizontalScroll>
  )
}

function Deals() {
  const lang = useApp().lang
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', padding: '0 16px' }}>
        <h2 style={{ margin: 0, ...sf(20, 700), color: Palette.ink }}>{t(lang, 'Deals for you', 'عروض لك')}</h2>
        <span style={{ flex: 1 }} />
        <span style={{ ...sf(15, 600), color: Palette.accent }}>{t(lang, 'View all', 'عرض الكل')}</span>
      </div>
      <HorizontalScroll gap={12}>
        {HomeCatalog.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </HorizontalScroll>
    </div>
  )
}

// MARK: - Cards

const BANNER = { width: SCREEN.width - 32, height: 168 }

function BannerCard({ banner }: { banner: Banner }) {
  const lang = useApp().lang
  const rtl = isRTL(lang)
  // LinearGradient(.topLeading → .bottomTrailing): the axis runs corner to corner, mirrored in Arabic.
  const diagonal = (Math.atan2(BANNER.height, BANNER.width) * 180) / Math.PI
  const angle = rtl ? 270 - diagonal : 90 + diagonal
  return (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        width: BANNER.width,
        height: BANNER.height,
        borderRadius: 20,
        overflow: 'hidden',
        scrollSnapAlign: 'start',
        background: `linear-gradient(${angle}deg, ${banner.colors[0]}, ${banner.colors[1]})`,
      }}
    >
      <SFSymbol
        name={banner.symbol}
        size={110}
        weight="regular"
        color="rgba(255, 255, 255, 0.22)"
        style={{ position: 'absolute', insetInlineEnd: -14, bottom: -18, transform: `rotate(${rtl ? 12 : -12}deg)` }}
      />
      <div style={{ position: 'absolute', inset: 0, padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ ...sf(11, 700), letterSpacing: 0.8, color: 'rgba(255, 255, 255, 0.8)' }}>{t(lang, banner.eyebrowEN, banner.eyebrowAR).toUpperCase()}</span>
        <span style={{ ...sf(24, 800), letterSpacing: -0.4, color: '#FFFFFF' }}>{t(lang, banner.titleEN, banner.titleAR)}</span>
        <span style={{ flex: 1, minHeight: 0 }} />
        <span style={{ ...sf(14, 600), color: banner.colors[0], height: 32, padding: '0 14px', borderRadius: 999, background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
          {t(lang, 'Shop now', 'تسوّق الآن')}
        </span>
      </div>
    </div>
  )
}

function ProductCard({ product }: { product: Product }) {
  const lang = useApp().lang
  return (
    <div style={{ width: 148, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
      <div style={{ position: 'relative', width: 148, height: 148, borderRadius: 16, background: Palette.raised, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SFSymbol name={product.symbol} size={54} weight="light" color={product.tint} gradient />
        <span style={{ position: 'absolute', top: 8, insetInlineStart: 8, ...sf(11, 700), lineHeight: 1, color: '#FFFFFF', height: 20, padding: '0 7px', borderRadius: 999, background: Palette.danger, display: 'inline-flex', alignItems: 'center' }}>
          {ltr(`-${product.discount}%`)}
        </span>
      </div>

      <span
        style={{
          ...sf(14),
          color: Palette.ink,
          width: '100%',
          // lineLimit(2, reservesSpace: true)
          height: lineHeight(14) * 2,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {t(lang, product.en, product.ar)}
      </span>

      <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, color: Palette.ink }}>
        <span style={sf(11, 600)}>{t(lang, 'AED', 'د.إ')}</span>
        <span style={{ ...sf(17, 700), fontVariantNumeric: 'tabular-nums' }}>{product.price}</span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...sf(12), textDecoration: 'line-through', color: Palette.ink3 }}>{product.was}</span>
        <span style={{ ...sf(11, 800), fontStyle: 'italic', lineHeight: 1, color: Palette.onYellow, height: 18, padding: '0 6px', borderRadius: 4, background: Palette.yellow, display: 'inline-flex', alignItems: 'center' }}>
          express
        </span>
      </span>
    </div>
  )
}

// MARK: - Colour helpers

function hexRGB(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = hexRGB(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
function mix(hex: string, toward: [number, number, number], amount: number) {
  const [r, g, b] = hexRGB(hex)
  const c = (a: number, z: number) => Math.round(a + (z - a) * amount)
  return `rgb(${c(r, toward[0])}, ${c(g, toward[1])}, ${c(b, toward[2])})`
}

// MARK: - SF Symbols (approximations)

/** The SF Symbols the home page uses, redrawn as SVG. Coordinates are in 1/24 em, so a symbol drawn
 *  at font size `size` is `box × size / 24` points, roughly the image size SF Symbols gives. Strokes
 *  thicken with the weight, as the symbol font does. */
type SymbolName =
  | 'chevron.down' | 'magnifyingglass' | 'camera' | 'camera.fill' | 'person.fill'
  | 'iphone' | 'iphone.gen3' | 'tv' | 'tshirt' | 'sparkles' | 'sofa' | 'basket' | 'basket.fill' | 'teddybear' | 'figure.run'
  | 'earbuds' | 'applewatch' | 'gamecontroller.fill' | 'laptopcomputer'

type SymbolWeight = 'light' | 'regular' | 'medium' | 'semibold' | 'bold'
const STROKE: Record<SymbolWeight, number> = { light: 1.3, regular: 1.75, medium: 2, semibold: 2.3, bold: 2.7 }

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
const CAMERA_BODY = 'M1.5 8.5a3.5 3.5 0 0 1 3.5-3.5h4.5l2-3h8l2 3h4.5a3.5 3.5 0 0 1 3.5 3.5v10.5a3.5 3.5 0 0 1-3.5 3.5h-21a3.5 3.5 0 0 1-3.5-3.5z'

const SYMBOLS: Record<SymbolName, { box: [number, number]; draw: (paint: string, sw: number) => ReactNode }> = {
  'chevron.down': { box: [18, 10.5], draw: (p, sw) => <path d="M2 2l7 6.5L16 2" fill="none" stroke={p} strokeWidth={sw} /> },
  magnifyingglass: {
    box: [24, 24],
    draw: (p, sw) => <path d={`${circle(10, 10, 7.6)}M15.6 15.6L22 22`} fill="none" stroke={p} strokeWidth={sw} />,
  },
  camera: {
    box: [31, 24],
    draw: (p, sw) => <path d={`${CAMERA_BODY}${circle(15.5, 13.5, 4.6)}`} fill="none" stroke={p} strokeWidth={sw} />,
  },
  'camera.fill': {
    box: [31, 24],
    draw: (p) => <path d={`${CAMERA_BODY}${circle(15.5, 13.5, 5.6)}${circle(15.5, 13.5, 3.7)}`} fill={p} fillRule="evenodd" />,
  },
  'person.fill': {
    box: [21.5, 22.5],
    draw: (p) => <path d={`${circle(10.75, 6, 5.2)}M1.2 20C1.2 15.6 5.4 12.8 10.75 12.8S20.3 15.6 20.3 20c0 1-.7 1.6-1.7 1.6H2.9c-1 0-1.7-.6-1.7-1.6z`} fill={p} />,
  },
  iphone: {
    box: [16, 29],
    draw: (p, sw) => <path d="M4.7 1.5h6.6a3.2 3.2 0 0 1 3.2 3.2v19.6a3.2 3.2 0 0 1-3.2 3.2H4.7a3.2 3.2 0 0 1-3.2-3.2V4.7a3.2 3.2 0 0 1 3.2-3.2zM6.5 4.6h3" fill="none" stroke={p} strokeWidth={sw} />,
  },
  'iphone.gen3': {
    box: [16, 29],
    draw: (p, sw) => (
      <>
        <path d="M4.7 1.5h6.6a3.2 3.2 0 0 1 3.2 3.2v19.6a3.2 3.2 0 0 1-3.2 3.2H4.7a3.2 3.2 0 0 1-3.2-3.2V4.7a3.2 3.2 0 0 1 3.2-3.2z" fill="none" stroke={p} strokeWidth={sw} />
        <rect x="5.8" y="3.6" width="4.4" height="1.9" rx="0.95" fill={p} />
      </>
    ),
  },
  tv: {
    box: [31, 24],
    draw: (p, sw) => <path d="M4 1.5h23a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 16V4A2.5 2.5 0 0 1 4 1.5zM9.5 22.5h12" fill="none" stroke={p} strokeWidth={sw} />,
  },
  tshirt: {
    box: [32, 24],
    draw: (p, sw) => (
      <path
        d="M11.5 1.8C12.4 3.6 14 4.6 16 4.6s3.6-1 4.5-2.8l9.1 3.8c.8.3 1.1 1.2.7 1.9l-2.4 4.3c-.3.6-1 .8-1.6.6l-2.7-1v9.3c0 .8-.6 1.5-1.4 1.5H9.8c-.8 0-1.4-.7-1.4-1.5v-9.3l-2.7 1c-.6.2-1.3 0-1.6-.6L1.7 7.5c-.4-.7-.1-1.6.7-1.9z"
        fill="none"
        stroke={p}
        strokeWidth={sw}
      />
    ),
  },
  sparkles: {
    box: [25, 30],
    draw: (p) => (
      <path
        d="M10 7.5c.9 6 2.6 7.9 8.5 10-5.9 2.1-7.6 4-8.5 10.5-.9-6.5-2.6-8.4-8.5-10.5 5.9-2.1 7.6-4 8.5-10zM19.5 1.5c.5 3.1 1.3 4.1 4.5 5.1-3.2 1-4 2-4.5 5.1-.5-3.1-1.3-4.1-4.5-5.1 3.2-1 4-2 4.5-5.1zM21 18c.3 1.8.8 2.4 2.6 3-1.8.6-2.3 1.2-2.6 3-.3-1.8-.8-2.4-2.6-3 1.8-.6 2.3-1.2 2.6-3z"
        fill={p}
      />
    ),
  },
  sofa: {
    box: [31, 23],
    draw: (p, sw) => (
      <path
        d="M5 10V6a3.5 3.5 0 0 1 3.5-3.5h14A3.5 3.5 0 0 1 26 6v4M1.5 12a2.25 2.25 0 0 1 4.5 0v2.5h19V12a2.25 2.25 0 0 1 4.5 0v5.5a2 2 0 0 1-2 2h-24a2 2 0 0 1-2-2zM5 19.5v2M26 19.5v2"
        fill="none"
        stroke={p}
        strokeWidth={sw}
      />
    ),
  },
  basket: {
    box: [31, 25],
    draw: (p, sw) => (
      <path
        d="M1.5 10h28M3.5 10l2.3 11a2 2 0 0 0 2 1.6h15.4a2 2 0 0 0 2-1.6l2.3-11M9 10l4-8M22 10l-4-8M11 14v4.5M15.5 14v4.5M20 14v4.5"
        fill="none"
        stroke={p}
        strokeWidth={sw}
      />
    ),
  },
  'basket.fill': {
    box: [31, 25],
    draw: (p, sw) => (
      <>
        <path
          d="M2 9.3h27l-2.6 12a2.2 2.2 0 0 1-2.1 1.7H6.7a2.2 2.2 0 0 1-2.1-1.7zM10.2 13.3h1.6v6h-1.6zM14.7 13.3h1.6v6h-1.6zM19.2 13.3h1.6v6h-1.6z"
          fill={p}
          fillRule="evenodd"
        />
        <path d="M9 9.3l4-7.3M22 9.3l-4-7.3" fill="none" stroke={p} strokeWidth={sw} />
      </>
    ),
  },
  teddybear: {
    box: [26, 25.5],
    draw: (p, sw) => (
      <>
        <path
          d={`M9.33 4.13A3.1 3.1 0 1 0 6.7 7.88M16.67 4.13A3.1 3.1 0 1 1 19.3 7.88${circle(13, 9.5, 6.5)}M8.6 14.3C5.4 15.8 3.5 18.4 3.5 21.4a2.6 2.6 0 0 0 2.6 2.6h13.8a2.6 2.6 0 0 0 2.6-2.6c0-3-1.9-5.6-5.1-7.1M15.4 11.6a2.4 1.8 0 1 1-4.8 0a2.4 1.8 0 1 1 4.8 0z`}
          fill="none"
          stroke={p}
          strokeWidth={sw}
        />
        <path d={`${circle(10.6, 8.6, 0.95)}${circle(15.4, 8.6, 0.95)}`} fill={p} />
      </>
    ),
  },
  'figure.run': {
    box: [22, 30],
    draw: (p, sw) => (
      <>
        <path d={circle(14.5, 3.6, 2.8)} fill={p} />
        <path d="M12.6 9L9.8 16.4M9.8 16.4L7.2 21.2 2.6 22.4M9.8 16.4l4 3.2-1.4 8M12.6 9l3.4 3.2 3.6.4M12.6 9l-4.2.8-2.2 3.6" fill="none" stroke={p} strokeWidth={sw + 1.4} />
      </>
    ),
  },
  earbuds: {
    box: [27, 25],
    draw: (p, sw) => (
      <path
        d="M7.5 1.8C4 1.8 1.6 4.3 1.6 7.5c0 2.9 2 5.1 4.7 5.4v8.7c0 1.1.9 1.8 1.9 1.8 1.1 0 1.9-.8 1.9-1.8V9.4c0-.8.4-1.4 1.1-1.8.9-.5 1.4-1.4 1.2-2.5-.4-2-2.5-3.3-4.9-3.3zM19.5 1.8c3.5 0 5.9 2.5 5.9 5.7 0 2.9-2 5.1-4.7 5.4v8.7c0 1.1-.9 1.8-1.9 1.8-1.1 0-1.9-.8-1.9-1.8V9.4c0-.8-.4-1.4-1.1-1.8-.9-.5-1.4-1.4-1.2-2.5.4-2 2.5-3.3 4.9-3.3z"
        fill="none"
        stroke={p}
        strokeWidth={sw}
      />
    ),
  },
  applewatch: {
    box: [18, 31],
    draw: (p, sw) => (
      <>
        <path d="M5.5 6.5h6a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4v-10a4 4 0 0 1 4-4zM4.5 6.5l.8-5h6.4l.8 5M4.5 24.5l.8 5h6.4l.8-5" fill="none" stroke={p} strokeWidth={sw} />
        <rect x="15.6" y="11.5" width="1.6" height="4" rx="0.8" fill={p} />
      </>
    ),
  },
  'gamecontroller.fill': {
    box: [36, 24],
    draw: (p) => (
      <path
        d={`M10 3.5h16c4 0 6.2 2.9 7.2 7.5l1.1 5.6c.6 3.3-1.3 5.7-4 5.7-1.9 0-3.1-1.1-4.2-2.7l-1.3-2H11.2l-1.3 2c-1.1 1.6-2.3 2.7-4.2 2.7-2.7 0-4.6-2.4-4-5.7L2.8 11c1-4.6 3.2-7.5 7.2-7.5zM9.05 8h1.9v2.35h2.35v1.9h-2.35v2.35h-1.9v-2.35H6.7v-1.9h2.35z${circle(24.6, 12.6, 1.5)}${circle(27.6, 9.6, 1.5)}`}
        fill={p}
        fillRule="evenodd"
      />
    ),
  },
  laptopcomputer: {
    box: [38, 23],
    draw: (p, sw) => <path d="M7 1.5h24a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2zM1.5 20.5h35" fill="none" stroke={p} strokeWidth={sw} />,
  },
}

function SFSymbol({ name, size, weight = 'regular', color = 'currentColor', gradient = false, style }: { name: SymbolName; size: number; weight?: SymbolWeight; color?: string; gradient?: boolean; style?: CSSProperties }) {
  const rawID = useId()
  const id = `sf${rawID.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const symbol = SYMBOLS[name]
  const [w, h] = symbol.box
  // `Color.gradient`: a soft top-to-bottom ramp from a lighter tint into the colour.
  const paint = gradient && color.startsWith('#') ? `url(#${id})` : color
  return (
    <svg
      aria-hidden
      width={(w * size) / 24}
      height={(h * size) / 24}
      viewBox={`0 0 ${w} ${h}`}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', overflow: 'visible', ...style }}
    >
      {gradient && color.startsWith('#') && (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={h}>
            <stop offset="0" stopColor={mix(color, [255, 255, 255], 0.22)} />
            <stop offset="1" stopColor={mix(color, [0, 0, 0], 0.06)} />
          </linearGradient>
        </defs>
      )}
      {symbol.draw(paint, STROKE[weight])}
    </svg>
  )
}
