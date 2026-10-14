import { useLang } from '../app/context'
import { colour, palette, type } from '../design/tokens'
import { t } from '../model/lang'
import { Art, ArtGlyph, ArtImage } from '../ui/Icon'
import { Pressable } from '../ui/Pressable'

/** One line of the offer: a small sparkle and B12 copy. */
export function NoonOneBullet({ text, tint }: { text: string; tint: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, color: tint }}>
      <ArtGlyph name={Art.sparkleBullet} size={8} />
      <span style={{ ...type.b12Regular, whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  )
}

/** Smart flow: the noon One Credit Card offer as a card under "Sign in with OTP" (Figma 732:114049).
 *  Laid out left to right in both languages, like the artwork. */
export function NoonOnePromoCard({ onApply }: { onApply: () => void }) {
  const lang = useLang()
  return (
    <div style={{ position: 'relative', height: 138, borderRadius: 16, overflow: 'hidden', background: colour.surface.primary, direction: 'ltr' }}>
      <ArtImage name={Art.noonOnePromoArt} width={257} height={138} style={{ position: 'absolute', right: 0, bottom: -1 }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '11px 0 0 13px' }}>
        <span style={{ ...type.b14Bold, color: palette.grey['800'], whiteSpace: 'nowrap' }}>{t(lang, 'noon One Credit Card', 'بطاقة نون ون الائتمانية')}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginTop: 8 }}>
          <NoonOneBullet text={t(lang, 'Free 1 year of noon one', 'سنة مجانية من نون ون')} tint={colour.text.secondary} />
          <NoonOneBullet text={t(lang, 'Upto 20% savings', 'توفير حتى ٢٠٪')} tint={colour.text.secondary} />
        </div>
        <Pressable
          scale={0.96}
          onClick={onApply}
          style={{
            marginTop: 10,
            height: 36,
            padding: '0 16px',
            borderRadius: 8,
            background: colour.surface.primaryInverted,
            color: colour.text.onSurfaceBold,
            ...type.a12SemiBold,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {t(lang, 'Apply now', 'قدّم الآن')}
        </Pressable>
      </div>

      {/* The hairline sits over the artwork, as in Figma. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: `inset 0 0 0 1px ${colour.border.subtle}`, pointerEvents: 'none' }} />
    </div>
  )
}
