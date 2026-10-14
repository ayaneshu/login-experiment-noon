/** iOS status bar for the 375pt frame: time on the left, signal/Wi‑Fi/battery on the right,
 *  either side of the Dynamic Island. Dark glyphs on light pages, white on the blue header. */
export function StatusBar({ dark }: { dark: boolean }) {
  const ink = dark ? '#000' : '#fff'
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px 0 44px',
        color: ink,
        pointerEvents: 'none',
        zIndex: 100,
        direction: 'ltr',
        transition: 'color 0.25s',
      }}
    >
      <span style={{ fontFamily: '-apple-system, "SF Pro Text", system-ui, sans-serif', fontWeight: 600, fontSize: 16.5, letterSpacing: -0.3, width: 54, textAlign: 'center', paddingTop: 2 }}>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill={ink}>
          <rect x="0" y="7.5" width="3" height="4.5" rx="0.9" />
          <rect x="5" y="5.2" width="3" height="6.8" rx="0.9" />
          <rect x="10" y="2.7" width="3" height="9.3" rx="0.9" />
          <rect x="15" y="0" width="3" height="12" rx="0.9" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill={ink}>
          <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.1-1.2A10.2 10.2 0 0 0 8 .7C5.3.7 2.8 1.7.9 3.6L2 4.8a8.5 8.5 0 0 1 6-2.4Z" />
          <path d="M8 5.8c1.4 0 2.6.5 3.6 1.4l1.1-1.2A7 7 0 0 0 8 4.1 7 7 0 0 0 3.3 6l1.1 1.2c1-.9 2.2-1.4 3.6-1.4Z" />
          <path d="M8 9.1c.5 0 1 .2 1.3.5L8 11l-1.3-1.4c.3-.3.8-.5 1.3-.5Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.8" stroke={ink} strokeOpacity="0.4" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill={ink} />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill={ink} fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  )
}

/** The home indicator bar, dark on light pages. */
export function HomeIndicator({ dark }: { dark: boolean }) {
  return (
    <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 120 }}>
      <span style={{ width: 134, height: 5, borderRadius: 3, background: dark ? '#000' : '#fff', opacity: 0.92, transition: 'background-color 0.25s' }} />
    </div>
  )
}
