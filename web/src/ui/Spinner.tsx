/** The iOS activity indicator: eight fading spokes. */
export function Spinner({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-label="Loading" role="img" style={{ animation: 'spin 0.8s steps(8) infinite', flex: 'none' }}>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="9" y="1.5" width="2" height="5" rx="1" fill={color} opacity={0.25 + (i / 8) * 0.75} transform={`rotate(${i * 45} 10 10)`} />
      ))}
    </svg>
  )
}
