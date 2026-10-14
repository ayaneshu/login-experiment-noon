import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Variants } from 'motion/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useLang, useScreen } from '../app/context'
import { materialize, swiftSpring } from '../design/motion'
import { palette, type } from '../design/tokens'
import type { Lang } from '../model/lang'
import { isRTL, t } from '../model/lang'
import { Art, ArtImage, assetURL } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { CIB_CARD_ART_SIZE, CibCardArt } from './CibCardArt'
import { materializeTo } from './HeroIllustration'

/** The carousel above "Welcome to noon" and "Choose your account" in the separate Log in / Sign up
 *  flow: artwork, a headline, a line under it and page dots. Designed slides first — the CIB noon
 *  Credit card with "Apply now" (Figma 1267:100226), then "Get everything in minute" (1120:181329);
 *  the other two are placeholders until their designs land.
 *  Laid out in the Figma frame's coordinates (375 wide, measured from the top of the screen): the
 *  backdrop places it. A port of WelcomeCarousel.swift. */
export const WELCOME_CAROUSEL_SIZE = { width: 375, height: 362 }

const SLIDE_COUNT = 4
// Wide enough for the card slide, whose tags reach past the other slides' 257pt artwork.
const SLIDE_FRAME = { width: CIB_CARD_ART_SIZE.width, height: 144 + 12 + 52 }
const TOP_PADDING = 116.98
/** What's drawn inside the 375×362 frame — the slide, then 12 to the 5pt dots — so the backdrop can
 *  centre it in the blue rather than centre the frame. */
export const WELCOME_CAROUSEL_CONTENT = { top: TOP_PADDING, height: SLIDE_FRAME.height + 12 + 5 }

type SlideCustom = { sign: number; reduce: boolean }
const slideVariants: Variants = {
  enter: (c: SlideCustom) => (c.reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 6, x: 60 * c.sign })),
  center: { ...materialize({}), transitionEnd: { filter: 'none' } },
  exit: (c: SlideCustom) => (c.reduce ? { opacity: 0 } : materialize({ opacity: 0, blur: 6, x: -60 * c.sign })),
}

export function WelcomeCarousel({ visible, onApply }: { visible: boolean; onApply: () => void }) {
  const lang = useLang()
  const { isStatic, scale } = useScreen()
  const reduceMotion = useReducedMotion() ?? false
  const [{ page, direction }, setState] = useState({ page: 0, direction: 1 })
  const dragging = useRef(false)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const rtl = isRTL(lang)

  const go = (next: (current: number) => number, newDirection: number) =>
    setState((s) => ({ page: (next(s.page) + SLIDE_COUNT) % SLIDE_COUNT, direction: newDirection }))

  // One slide every few seconds while it's on screen; a swipe in progress skips a beat.
  useEffect(() => {
    if (!visible || reduceMotion || isStatic) return
    const id = window.setInterval(() => {
      if (dragging.current) return
      go((p) => p + 1, 1)
    }, 4000)
    return () => window.clearInterval(id)
  }, [visible, reduceMotion, isStatic])

  // Swipe (SwiftUI DragGesture, minimum distance 16): past 40pt and more sideways than up or down
  // changes the slide. Arabic mirrors it: swiping right goes forward.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!visible || isStatic) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current
    if (!start || start.id !== e.pointerId || dragging.current) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) / scale >= 16) {
      dragging.current = true
      // Throws when the pointer is already gone (a synthetic or lifted touch); the swipe still works.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } catch {
        /* no active pointer */
      }
    }
  }
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const start = drag.current
    if (!start || start.id !== e.pointerId) return
    drag.current = null
    const wasDragging = dragging.current
    dragging.current = false
    if (!wasDragging || cancelled) return
    const dx = ((e.clientX - start.x) / scale) * (rtl ? -1 : 1)
    const dy = (e.clientY - start.y) / scale
    if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) return
    go((p) => p + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
  }

  const custom: SlideCustom = { sign: direction * (rtl ? -1 : 1), reduce: reduceMotion }
  const slideTransition = swiftSpring(0.55, 0)

  return (
    <motion.div
      role="region"
      aria-roledescription="carousel"
      aria-label={t(lang, 'Offers', 'العروض')}
      initial={false}
      animate={materializeTo({ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96, y: visible ? 0 : 14 })}
      transition={isStatic ? { duration: 0 } : swiftSpring(0.6, 0)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerEnd(e, false)}
      onPointerCancel={(e) => onPointerEnd(e, true)}
      style={{
        position: 'relative',
        width: WELCOME_CAROUSEL_SIZE.width,
        height: WELCOME_CAROUSEL_SIZE.height,
        // Hidden, it lets taps through to the header (Swift: `.allowsHitTesting(showsIllustration)`).
        pointerEvents: visible ? 'auto' : 'none',
        touchAction: 'none',
      }}
    >
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          left: (WELCOME_CAROUSEL_SIZE.width - SLIDE_FRAME.width) / 2,
          top: TOP_PADDING,
          width: SLIDE_FRAME.width,
          height: SLIDE_FRAME.height,
          overflow: 'hidden',
        }}
      >
        <AnimatePresence initial={false} custom={custom}>
          <motion.div
            key={page}
            custom={custom}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            style={{ position: 'absolute', left: 0, top: 0, width: SLIDE_FRAME.width, height: SLIDE_FRAME.height }}
          >
            {page === 0 ? <CardSlide lang={lang} onApply={onApply} /> : <Slide index={page} lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: TOP_PADDING + SLIDE_FRAME.height + 12, display: 'flex', justifyContent: 'center' }}>
        <PageDots count={SLIDE_COUNT} current={page} isStatic={isStatic} />
      </div>
    </motion.div>
  )
}

// MARK: - Slides

function title(lang: Lang, index: number) {
  switch (index) {
    case 1:
      return t(lang, 'Get everything in minute', 'كل ما تحتاجه في دقائق')
    case 2:
      return t(lang, '20M+ products', 'أكثر من 20 مليون منتج')
    default:
      return t(lang, 'Free delivery with one', 'توصيل مجاني مع ون')
  }
}

function subtitle(lang: Lang, index: number) {
  switch (index) {
    case 1:
      return t(lang, 'groceries, essentials, and more', 'بقالة، أساسيات، والمزيد')
    case 2:
      return t(lang, 'from global brands you love', 'من علامات عالمية تحبها')
    default:
      return t(lang, 'save big on every order', 'وفّر أكثر مع كل طلب')
  }
}

/** Figma 1267:100228: the card and its tags, the headline, then "Apply now" on a light wash. */
function CardSlide({ lang, onApply }: { lang: Lang; onApply: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div aria-hidden style={{ flex: 'none' }}>
        <CibCardArt lang={lang} />
      </div>
      <div style={{ width: 320, padding: '0 11px', textAlign: 'center' }}>
        <OneLine
          text={t(lang, 'Get the CIB noon Credit card', 'احصل على بطاقة CIB نون الائتمانية')}
          style={{ fontFamily: 'var(--font-noon)', fontWeight: 700, fontSize: 22, lineHeight: '28px', letterSpacing: -0.24, color: '#FCFCFD' }}
        />
      </div>
      <Pressable
        onClick={onApply}
        style={{
          width: 120,
          height: 36,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.16)',
          ...type.a12SemiBold,
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
        }}
      >
        {t(lang, 'Apply now', 'قدّم الآن')}
      </Pressable>
    </div>
  )
}

function Slide({ index, lang }: { index: number; lang: Lang }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div aria-hidden style={{ position: 'relative', width: 257.18, height: 143.83, flex: 'none' }}>
        <SlideArt index={index} lang={lang} />
      </div>
      <div style={{ width: 257.18, height: 52, padding: '0 11px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
        <OneLine text={title(lang, index)} style={{ ...type.h20Bold, color: '#FCFCFD' }} />
        <OneLine text={subtitle(lang, index)} style={{ ...type.b16Regular, color: palette.grey['400'] }} />
      </div>
    </div>
  )
}

/** One line that shrinks to as little as 80% before it overflows (`.lineLimit(1)` with
 *  `.minimumScaleFactor(0.8)`). Measured in layout pixels, so the phone's CSS scale doesn't matter. */
function OneLine({ text, style }: { text: string; style: CSSProperties }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const [fit, setFit] = useState(1)
  useLayoutEffect(() => {
    const box = boxRef.current
    const span = textRef.current
    if (!box || !span) return
    const measure = () => {
      const natural = span.offsetWidth
      setFit(natural > 0 ? Math.max(0.8, Math.min(1, box.clientWidth / natural)) : 1)
    }
    measure()
    // Fonts arriving late change the width.
    const observer = new ResizeObserver(measure)
    observer.observe(span)
    return () => observer.disconnect()
  }, [text])
  return (
    <div ref={boxRef} style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'center', ...style }}>
      <span ref={textRef} style={{ whiteSpace: 'nowrap', flex: 'none', transform: fit < 1 ? `scale(${fit})` : undefined }}>
        {text}
      </span>
    </div>
  )
}

function SlideArt({ index, lang }: { index: number; lang: Lang }) {
  const centred: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  switch (index) {
    case 1:
      return <MinutesArt lang={lang} />
    case 2:
      return (
        <div style={centred}>
          <img src={assetURL(Art.heroIllustration)} alt="" draggable={false} style={{ width: 230, height: 134, objectFit: 'contain' }} />
        </div>
      )
    default:
      return (
        <div style={{ ...centred, direction: 'ltr' }}>
          <div style={{ position: 'absolute', width: 126.685, height: 143.83, borderRadius: 16, background: '#FEF8EC' }} />
          <img src={assetURL(Art.noonOne)} alt="" draggable={false} style={{ position: 'relative', width: 92, height: 'auto' }} />
          <Sparkle style={{ position: 'absolute', transform: 'translate(76px, -28px)' }} />
          <Sparkle style={{ position: 'absolute', transform: 'translate(-78px, 6px)' }} />
        </div>
      )
  }
}

function Sparkle({ style }: { style: CSSProperties }) {
  return <ArtImage name={Art.sparkle} width={15.24} height={15.24} style={style} />
}

/** Figma group 1120:180888: the noon Minutes bag on a dark card, two sparkles and two chips. */
function MinutesArt({ lang }: { lang: Lang }) {
  const at = (x: number, y: number): CSSProperties => ({ position: 'absolute', left: x, top: y })
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 257.18, height: 143.83, direction: 'ltr' }}>
      <div
        style={{
          ...at(53.34, 0),
          width: 126.685,
          height: 143.83,
          borderRadius: 16,
          background: 'radial-gradient(circle 72px at 50% 54%, #400B0C 0px, #210606 72px)',
          boxShadow: 'inset 0 0 0 1px #380A0B',
        }}
      />
      <Sparkle style={at(180.03, 43.82)} />
      <Sparkle style={at(34.29, 78.11)} />
      <img src={assetURL('minutes-food')} alt="" draggable={false} style={{ ...at(47.23, 36.9), width: 137.82, height: 87.08 }} />
      <MinutesChip text={t(lang, 'superfast delivery', 'توصيل فائق السرعة')} style={at(0, 10.23)} />
      <MinutesChip text={t(lang, 'daily essentials', 'أساسيات يومية')} style={at(157.17, 63.82)} />
    </div>
  )
}

function MinutesChip({ text, style }: { text: string; style: CSSProperties }) {
  return (
    <div
      style={{
        ...style,
        fontFamily: 'var(--font-noon)',
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: -0.12,
        lineHeight: '18.1px',
        color: '#000',
        whiteSpace: 'nowrap',
        width: 'max-content',
        height: 18.1,
        padding: '0 9px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 999,
        background: palette.grey['100'],
        // strokeBorder: the 3pt ring sits inside the capsule.
        boxShadow: 'inset 0 0 0 3px rgba(243, 129, 129, 0.4), 0 1px 5px rgba(0, 0, 0, 0.1)',
      }}
    >
      {text}
    </div>
  )
}

// MARK: - Page dots

/** Small dots, the current page a wider pill. */
function PageDots({ count, current, isStatic }: { count: number; current: number; isStatic: boolean }) {
  const transition = isStatic ? { duration: 0 } : swiftSpring(0.4, 0)
  return (
    <div aria-hidden style={{ display: 'flex', gap: 5 }}>
      {Array.from({ length: count }, (_, index) => (
        <motion.span
          key={index}
          initial={false}
          animate={{ width: index === current ? 16 : 5, opacity: index === current ? 1 : 0.4 }}
          transition={transition}
          style={{ display: 'block', height: 5, borderRadius: 999, background: '#FFFFFF' }}
        />
      ))}
    </div>
  )
}
