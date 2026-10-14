import { swiftSpring } from '../design/motion'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { motion } from 'motion/react'
import type { KeyboardKind } from '../app/context'
import { KEYBOARD_HEIGHT, useScreen } from '../app/context'

const SF = '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif'

/** Types into whichever input inside the phone has focus, as if from the real keyboard. */
function sendKey(key: string) {
  const el = document.activeElement as HTMLInputElement | null
  if (!el || el.tagName !== 'INPUT' || !el.closest('.phone-screen')) return
  if (key === '⌫') {
    // execCommand keeps the caret, undo stack and React's onChange in step.
    if (!document.execCommand('delete', false)) {
      const start = el.selectionStart ?? el.value.length
      setNativeValue(el, el.value.slice(0, Math.max(0, start - 1)) + el.value.slice(start))
    }
  } else if (key === '⏎') {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
  } else if (!document.execCommand('insertText', false, key)) {
    setNativeValue(el, el.value + key)
  }
}

function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Keeps focus in the field while a key is pressed. */
const keep = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault()

function Key({ label, sub, onPress, style, dark = false }: { label: ReactNode; sub?: string; onPress: () => void; style?: CSSProperties; dark?: boolean }) {
  const [down, setDown] = useState(false)
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={keep}
      onPointerDown={(e) => {
        keep(e)
        setDown(true)
        onPress()
      }}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        flex: 1,
        height: '100%',
        borderRadius: 8.5,
        background: down ? (dark ? '#fff' : '#c9cbd2') : dark ? '#abb0bc' : '#fff',
        boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SF,
        color: '#000',
        transition: 'background-color 0.08s',
        ...style,
      }}
    >
      <span style={{ fontSize: sub !== undefined ? 25 : 22, lineHeight: 1, fontWeight: 400 }}>{label}</span>
      {sub !== undefined && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, marginTop: 1, minHeight: 12 }}>{sub}</span>}
    </button>
  )
}

const Globe = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1.5" aria-hidden>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M2.8 12h18.4M12 2.8c2.6 2.7 3.9 5.8 3.9 9.2s-1.3 6.5-3.9 9.2c-2.6-2.7-3.9-5.8-3.9-9.2S9.4 5.5 12 2.8Z" />
  </svg>
)

const Backspace = () => (
  <svg width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="#000" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
    <path d="M8 1.5h15a1.8 1.8 0 0 1 1.8 1.8v13.4a1.8 1.8 0 0 1-1.8 1.8H8L1.3 10 8 1.5Z" />
    <path d="m11.5 6.5 7 7M18.5 6.5l-7 7" strokeLinecap="round" />
  </svg>
)

function Numpad() {
  const rows: [string, string][][] = [
    [['1', ''], ['2', 'ABC'], ['3', 'DEF']],
    [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
    [['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '6px 6px 0' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, height: 47 }}>
          {row.map(([n, letters]) => (
            <Key key={n} label={n} sub={letters} onPress={() => sendKey(n)} />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, height: 47 }}>
        <div style={{ flex: 1 }} />
        <Key label="0" sub="" onPress={() => sendKey('0')} />
        <Key label={<Backspace />} onPress={() => sendKey('⌫')} style={{ background: 'transparent', boxShadow: 'none' }} />
      </div>
    </div>
  )
}

function Qwerty({ kind }: { kind: KeyboardKind }) {
  const [shift, setShift] = useState(false)
  const [symbols, setSymbols] = useState(false)
  const letters = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  const numbers = ['1234567890', '-/:;()$&@"', '.,?!\'']
  const rows = symbols ? numbers : letters
  const type = (ch: string) => {
    sendKey(shift && !symbols ? ch.toUpperCase() : ch)
    if (shift) setShift(false)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '0 3px' }}>
      <div style={{ display: 'flex', gap: 6, height: 42, padding: '0 0' }}>
        {[...rows[0]].map((ch) => (
          <Key key={ch} label={shift && !symbols ? ch.toUpperCase() : ch} onPress={() => type(ch)} style={{ fontSize: 22 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, height: 42, padding: symbols ? 0 : '0 18px' }}>
        {[...rows[1]].map((ch) => (
          <Key key={ch} label={shift && !symbols ? ch.toUpperCase() : ch} onPress={() => type(ch)} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, height: 42 }}>
        <Key
          label={symbols ? '#+=' : <span style={{ fontSize: 19 }}>{shift ? '⬆︎' : '⇧'}</span>}
          dark={!shift}
          onPress={() => !symbols && setShift(!shift)}
          style={{ flex: 'none', width: 44, marginInlineEnd: 8, fontSize: 15 }}
        />
        {[...rows[2]].map((ch) => (
          <Key key={ch} label={shift && !symbols ? ch.toUpperCase() : ch} onPress={() => type(ch)} />
        ))}
        <Key label={<Backspace />} dark onPress={() => sendKey('⌫')} style={{ flex: 'none', width: 44, marginInlineStart: 8 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, height: 42 }}>
        <Key label={<span style={{ fontSize: 16 }}>{symbols ? 'ABC' : '123'}</span>} dark onPress={() => setSymbols(!symbols)} style={{ flex: 'none', width: 92 }} />
        <Key label={<span style={{ fontSize: 16 }}>space</span>} onPress={() => sendKey(' ')} />
        {kind === 'email' && (
          <>
            <Key label="@" onPress={() => sendKey('@')} style={{ flex: 'none', width: 44 }} />
            <Key label="." onPress={() => sendKey('.')} style={{ flex: 'none', width: 44 }} />
          </>
        )}
        <Key
          label={
            <svg width="20" height="18" viewBox="0 0 20 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="return">
              <path d="M2 9h15M11 3l6 6-6 6" />
            </svg>
          }
          onPress={() => sendKey('⏎')}
          style={{ flex: 'none', width: 92, background: '#0a84ff' }}
        />
      </div>
    </div>
  )
}

/** The iOS keyboard, sliding up from the bottom of the screen while a field has focus. Keys type into
 *  the focused field; on a computer you can just as well type with your own keyboard. */
export function Keyboard({ kind }: { kind: KeyboardKind }) {
  const { isStatic } = useScreen()
  const height = KEYBOARD_HEIGHT[kind]
  const isNumpad = kind === 'numpad'
  return (
    <motion.div
      initial={isStatic ? false : { y: height }}
      animate={{ y: 0 }}
      exit={{ y: height }}
      transition={{ ...swiftSpring(0.42, 0) }}
      onMouseDown={keep}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height,
        zIndex: 90,
        background: 'rgba(214, 216, 222, 0.94)',
        backdropFilter: 'blur(24px)',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingTop: isNumpad ? 6 : 8,
        direction: 'ltr',
      }}
    >
      {!isNumpad && (
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', color: '#8a8d95' }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6l4-4 4 4M4 10l4 4 4-4" /></svg>
          <span style={{ width: 1, height: 22, background: '#c4c6cc' }} />
          <span style={{ width: 1, height: 22, background: '#c4c6cc' }} />
          <span style={{ fontFamily: SF, fontSize: 12, fontWeight: 600, border: '1.5px solid currentColor', borderRadius: 4, padding: '0 3px' }}>A</span>
        </div>
      )}
      {isNumpad ? <Numpad /> : <Qwerty kind={kind} />}
      <div style={{ position: 'absolute', left: 22, bottom: isNumpad ? 26 : 22 }} aria-hidden>
        <Globe />
      </div>
    </motion.div>
  )
}
