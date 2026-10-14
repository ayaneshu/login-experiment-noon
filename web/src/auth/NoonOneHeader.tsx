import { swiftSpring } from '../design/motion'
import { motion } from 'motion/react'
import { useLang } from '../app/context'
import { colour, palette, type } from '../design/tokens'
import { t } from '../model/lang'
import { Art, ArtGlyph, ArtImage } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'
import { materializeTo } from './HeroIllustration'

/** The noon One Credit Card offer at the top of the sign-in screen (tabs flow, Choose your
 *  account): copy and "Apply now" on the left, the card standing on a pedestal of products on the
 *  right. Laid out in the Figma frame's coordinates (375 wide, measured from the very top of the
 *  screen). A port of NoonOneHeader in NoonOnePromo.swift. */
export const NOON_ONE_SIZE = { width: 375, height: 440 }

export function NoonOneHeader({ visible, onApply }: { visible: boolean; onApply: () => void }) {
  const lang = useLang()
  // Arabic mirrors the composition: copy on the right, art on the left (the card stays readable).
  const mirrored = lang === 'ar'
  // Hidden, the whole header lets taps through (Swift: `.allowsHitTesting(showsIllustration)`).
  const hit = visible ? 'auto' : 'none'

  return (
    <div style={{ position: 'relative', width: NOON_ONE_SIZE.width, height: NOON_ONE_SIZE.height, direction: 'ltr', pointerEvents: 'none' }}>
      {/* Deepens the blue behind the pedestal so the sheet's edge reads cleanly. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 200,
          width: 375,
          height: 206,
          background: 'linear-gradient(180deg, rgba(0, 40, 136, 0) 0%, #002888 63.3%)',
          pointerEvents: hit,
        }}
      />

      {/* The art's layout frame is 375×336 at the top; Materialize scales around it and the mirror
          flips around it, while the clipped art itself is drawn 104pt in and down. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 375, height: 336, transform: mirrored ? 'scaleX(-1)' : undefined }}>
        <motion.div
          initial={false}
          animate={materializeTo({ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96, y: visible ? 0 : 14 })}
          transition={{ ...swiftSpring(0.6, 0) }}
          style={{ position: 'absolute', left: 0, top: 0, width: 375, height: 336 }}
        >
          <div aria-hidden style={{ position: 'absolute', left: 104, top: 104, width: 375, height: 336, overflow: 'hidden', pointerEvents: hit }}>
            <NoonOneArt mirrored={mirrored} />
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={false}
        animate={materializeTo({ opacity: visible ? 1 : 0, blur: visible ? 0 : 4, y: visible ? 0 : 8 })}
        transition={{ ...swiftSpring(0.5, 0) , delay: visible ? 0.12 : 0 }}
        style={{ position: 'absolute', left: 18, top: 134, width: NOON_ONE_SIZE.width - 36 }}
      >
        <div dir={mirrored ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{ ...type.b16Bold, color: colour.text.onSurfaceBold, whiteSpace: 'nowrap', pointerEvents: hit }}>
            {t(lang, 'noon One Credit Card', 'بطاقة نون ون الائتمانية')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginTop: 7 }}>
            <NoonOneBullet text={t(lang, 'Free 1 year of noon one', 'سنة مجانية من نون ون')} tint={colour.text.onSurfaceSubtle} hit={hit} />
            <NoonOneBullet text={t(lang, 'Upto 20% savings', 'توفير حتى ٢٠٪')} tint="rgba(255, 255, 255, 0.96)" hit={hit} />
          </div>
          <Pressable
            scale={0.96}
            onClick={onApply}
            style={{
              ...type.a12SemiBold,
              color: colour.text.onSurfaceBold,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              height: 36,
              borderRadius: 999,
              background: palette.alphaLight['16'],
              marginTop: 17,
              pointerEvents: hit,
            }}
          >
            {t(lang, 'Apply now', 'قدّم الآن')}
          </Pressable>
        </div>
      </motion.div>
    </div>
  )
}

/** Figma group 943:255467: the product pedestal at 20%, the card's shadow and the card. */
function NoonOneArt({ mirrored }: { mirrored: boolean }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: -40, width: 375, height: 376 }}>
      <ArtImage name={Art.noonOneBoxes} width={407.6} height={407.82} style={{ position: 'absolute', left: -16.2, top: -31.82, opacity: 0.2 }} />
      <ArtImage name={Art.noonOneCardShadow} width={180.38} height={4.47} style={{ position: 'absolute', left: 92.43, top: 142.22 }} />
      <ArtImage
        name={Art.noonOneCard}
        width={108.8}
        height={68}
        style={{ position: 'absolute', left: 133.2, top: 75.68, borderRadius: 4, transform: mirrored ? 'scaleX(-1)' : undefined }}
      />
    </div>
  )
}

/** One line of the offer: a small sparkle and B12 copy. */
export function NoonOneBullet({ text, tint, hit = 'auto' }: { text: string; tint: string; hit?: 'auto' | 'none' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, color: tint, pointerEvents: hit }}>
      <ArtGlyph name={Art.sparkleBullet} size={8} />
      <span style={{ ...type.b12Regular, whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  )
}
