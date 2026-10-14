import type { CSSProperties } from 'react'
import { t } from '../model/lang'
import type { Lang } from '../model/lang'

/** The CIB noon Credit card and its two tags (Figma 1267:100727, 347×114), built from the design's
 *  own layers: Figma's export bakes the header in behind the tilted card, so it can't be used as a
 *  picture. Positions, gradients and SVGs are the frame's, in its coordinates. */
export const CIB_CARD_ART_SIZE = { width: 347, height: 114 }

/** Its layers live in public/art, outside the folder the iOS asset export rewrites. */
const svg = (name: string) => `/art/cib-card/${name}`

/** The card face: a radial highlight, two diagonal glints and a radial edge over flat yellow. */
const CARD_FACE = [
  `url("data:image/svg+xml;utf8,<svg viewBox='0 0 163.2 102' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.699999988079071'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(5.4299e-13 5.3275 9.2233 -9.4634e-13 19.521 15.806)'><stop stop-color='rgba(255,249,218,1)' offset='0'/><stop stop-color='rgba(255,249,218,0)' offset='1'/></radialGradient></defs></svg>")`,
  'linear-gradient(140.2571729110956deg, rgba(255, 255, 255, 0) 9.9477%, rgba(255, 255, 255, 0.42) 23.933%, rgba(255, 255, 255, 0) 40.033%, rgba(255, 255, 255, 0) 62.171%, rgba(255, 255, 255, 0.35) 71.579%, rgba(255, 255, 255, 0) 79.958%)',
  `url("data:image/svg+xml;utf8,<svg viewBox='0 0 163.2 102' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(6.7895e-14 10.717 25.285 -1.3016e-12 -4.8345 2.4913e-13)'><stop stop-color='rgba(252,232,86,0)' offset='0'/><stop stop-color='rgba(252,219,86,1)' offset='1'/></radialGradient></defs></svg>")`,
  'linear-gradient(90deg, rgb(255, 242, 90) 0%, rgb(255, 242, 90) 100%)',
].join(', ')

/** The gold EMV chip. */
const CHIP_FACE = [
  'linear-gradient(128.93014275775568deg, rgba(255, 255, 255, 0) 0.36034%, rgba(255, 255, 255, 0.45) 15.595%, rgba(255, 255, 255, 0) 31.063%, rgba(255, 255, 255, 0) 55.035%, rgba(255, 255, 255, 0.35) 73.68%, rgba(255, 255, 255, 0) 95.293%, rgba(255, 255, 255, 0) 122.79%)',
  `url("data:image/svg+xml;utf8,<svg viewBox='0 0 17.6 14.344' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='0.30000001192092896'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(-1.1213e-16 1.6124 -1.9785 1.5422e-15 8.8 -0.67644)'><stop stop-color='rgba(255,190,69,0)' offset='0'/><stop stop-color='rgba(255,190,69,1)' offset='1'/></radialGradient></defs></svg>")`,
  'linear-gradient(121.31226866778874deg, rgb(255, 212, 117) 2.7209%, rgb(242, 201, 114) 12.747%, rgb(255, 219, 142) 26.661%, rgb(238, 202, 127) 44.649%, rgb(255, 230, 179) 65.782%, rgb(255, 216, 138) 79.801%, rgb(240, 210, 151) 90.891%, rgb(197, 165, 105) 109.18%)',
  'linear-gradient(90deg, rgb(107, 107, 107) 0%, rgb(107, 107, 107) 100%)',
].join(', ')

/** An SVG layer filling an absolutely placed box, optionally overdrawn by `bleed` (Figma's inner
 *  inset on vector strokes). */
function Layer({ name, box, bleed }: { name: string; box: CSSProperties; bleed?: string }) {
  return (
    <div style={{ position: 'absolute', ...box }}>
      <div style={{ position: 'absolute', inset: bleed ?? 0 }}>
        <img src={svg(name)} alt="" draggable={false} style={{ display: 'block', width: '100%', height: '100%', maxWidth: 'none' }} />
      </div>
    </div>
  )
}

/** The chip's contact lines: two sets of eight strokes, as Figma lays them out. */
function ChipLines() {
  const h = '-0.17px 0'
  const v = '0 -40.51%'
  return (
    <>
      <Layer name="ff7e2.svg" box={{ inset: '35.41% 67.27% 64.59% -1.96%' }} bleed={h} />
      <Layer name="ff7e2.svg" box={{ inset: '64.86% 67.27% 35.14% -1.96%' }} bleed={h} />
      <Layer name="7b769.svg" box={{ top: '35.41%', bottom: '64.59%', right: -0.03, width: 6.237 }} bleed={h} />
      <Layer name="7b769.svg" box={{ top: '64.86%', bottom: '35.14%', right: -0.03, width: 6.237 }} bleed={h} />
      <Layer name="071ab.svg" box={{ inset: '86.58% 43.69% 13.42% 39.25%' }} bleed={h} />
      <Layer name="071ab.svg" box={{ inset: '13.68% 43.69% 86.32% 39.25%' }} bleed={h} />
      <Layer name="cafb5.svg" box={{ inset: '-0.78% 65.21% 0.78% 32.36%' }} bleed={v} />
      <Layer name="27a2f.svg" box={{ inset: '-0.78% 36.75% 0.78% 60.83%' }} bleed={v} />
      <Layer name="1ad2f.svg" box={{ inset: '36.17% 65.3% 63.83% 0' }} bleed={h} />
      <Layer name="1ad2f.svg" box={{ inset: '65.71% 65.3% 34.29% 0' }} bleed={h} />
      <Layer name="4432b.svg" box={{ top: '36.17%', bottom: '63.83%', right: -0.16, width: 6.237 }} bleed={h} />
      <Layer name="4432b.svg" box={{ top: '65.71%', bottom: '34.29%', right: -0.16, width: 6.237 }} bleed={h} />
      <Layer name="34231.svg" box={{ inset: '87.42% 41.7% 12.58% 41.25%' }} bleed={h} />
      <Layer name="34231.svg" box={{ inset: '14.43% 41.7% 85.57% 41.25%' }} bleed={h} />
      <Layer name="5331e.svg" box={{ inset: '-0.01% 63.25% 0.01% 34.33%' }} bleed={v} />
      <Layer name="4bc5b.svg" box={{ inset: '-0.01% 34.78% 0.01% 62.79%' }} bleed={v} />
    </>
  )
}

function Card() {
  return (
    // Tilted -2.48° inside its 167×109 box, as in Figma.
    <div style={{ position: 'absolute', left: 89.67, top: 2.52, width: 167.459, height: 108.963, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ flex: 'none', transform: 'rotate(-2.48deg)' }}>
        <div style={{ position: 'relative', width: 163.2, height: 102, overflow: 'hidden', borderRadius: 6, backgroundImage: CARD_FACE }}>
          {/* The "O" texture, multiplied into the yellow. */}
          <Layer name="d6e48.svg" box={{ inset: '-52.02% -13.46% -51.78% -13.6%', mixBlendMode: 'multiply' }} bleed="-0.1%" />
          <div style={{ position: 'absolute', inset: '32.68% 81.87% 53.26% 7.35%', overflow: 'hidden', borderRadius: 2.308, border: '0.32px solid #76640d', backgroundImage: CHIP_FACE }}>
            <ChipLines />
          </div>
          {/* Contactless waves. */}
          <Layer name="de70c.svg" box={{ inset: '34.18% 75.82% 53.76% 20.25%' }} bleed="-2.58% -7.01% -2.58% -4.97%" />
          {/* VISA Platinum. */}
          <Layer name="0b447.svg" box={{ left: 116.58, top: 9, width: 37.618, height: 17.589 }} />
          <Layer name="e129c.svg" box={{ left: 116.58, top: 9, width: 37.618, height: 12.149 }} />
          {/* The noon wordmark across the bottom. */}
          <Layer name="153d4.svg" box={{ left: 'calc(50% - 0.01px)', bottom: -0.66, width: 163.209, height: 42.754, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, width: 164.235, height: 102.663, borderRadius: 7.65, border: '0.434px solid #fffef7' }} />
        </div>
      </div>
    </div>
  )
}

/** The offer tags beside the card: a pale capsule with a yellow ring. */
function Tag({ text, style }: { text: string; style: CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        ...style,
        height: 24,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 24,
        // The translucent ring sits outside the fill, so the header shows through it (Figma border-3).
        border: '3px solid rgba(255, 196, 0, 0.4)',
        background: '#F9F9FB',
        backgroundClip: 'padding-box',
        boxShadow: '0 1px 5px rgba(0, 0, 0, 0.1)',
        fontFamily: 'var(--font-noon)',
        fontWeight: 600,
        fontSize: 12,
        lineHeight: '14px',
        letterSpacing: -0.12,
        fontFeatureSettings: '"case" 1',
        color: '#000',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )
}

export function CibCardArt({ lang }: { lang: Lang }) {
  return (
    <div style={{ position: 'relative', width: CIB_CARD_ART_SIZE.width, height: CIB_CARD_ART_SIZE.height, overflow: 'hidden', direction: 'ltr' }}>
      <Card />
      <Tag text={t(lang, 'Upto 20% savings', 'وفّر حتى ٢٠٪')} style={{ left: 13, top: 4 }} />
      <Tag text={t(lang, 'Free 1 year of noon one', 'سنة مجانية من نون ون')} style={{ left: 186, top: 45 }} />
    </div>
  )
}
