import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** The site chrome uses the lightweight-ui kit, whose precompiled CSS carries a global reset and
 *  opinions (corner smoothing, press scale, pixel headings, a reduced-motion override). The phone
 *  must keep its own look, so those rules are scoped to the site (`.lui`) and stop at anything
 *  marked `.app-surface` (the phone, flow-map thumbnails, the header-transition preview). */
function scopeKitGlobals(): Plugin {
  const scope = '@scope (.lui) to (.app-surface)'
  /** The index of the brace that closes the block opening at `open`. */
  const closing = (css: string, open: number) => {
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}' && --depth === 0) return i
    }
    throw new Error('lightweight-ui: unbalanced braces')
  }
  const wrap = (css: string, head: string) => {
    const start = css.indexOf(head)
    if (start < 0) throw new Error(`lightweight-ui: "${head}" not found; update scopeKitGlobals`)
    const open = start + head.length - 1
    const end = closing(css, open)
    return `${css.slice(0, open + 1)}${scope}{${css.slice(open + 1, end)}}${css.slice(end)}`
  }
  return {
    name: 'scope-kit-globals',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('lightweight-ui/dist/styles.css')) return
      let css = wrap(code, '@layer base{')
      // `*{transition-property:…!important}` under reduced motion: the site's only.
      const motion = css.indexOf('prefers-reduced-motion:reduce){*,:before,:after{')
      if (motion >= 0) {
        const rule = css.indexOf('*,:before,:after{', motion)
        const end = closing(css, css.indexOf('{', rule))
        css = `${css.slice(0, rule)}${scope}{${css.slice(rule, end + 1)}}${css.slice(end + 1)}`
      }
      return { code: css, map: null }
    },
  }
}

export default defineConfig({
  plugins: [scopeKitGlobals(), react()],
})
