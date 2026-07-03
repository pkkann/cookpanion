interface LogoProps {
  /** Rendered width/height in px. */
  size?: number
}

/**
 * "Pip the Pot" — the Cookpanion brand mark: a terracotta cooking pot with a
 * friendly face. Brand colours are fixed (not theme-driven) so the mark stays
 * consistent in light and dark.
 */
export default function Logo({ size = 28 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Cookpanion"
      style={{ display: 'block' }}
    >
      <ellipse cx="24" cy="17" rx="17" ry="4" fill="#9c4325" />
      <rect x="22.5" y="8.5" width="3" height="4" rx="1.5" fill="#9c4325" />
      <rect x="3" y="20" width="7" height="4.4" rx="2.2" fill="#9c4325" />
      <rect x="38" y="20" width="7" height="4.4" rx="2.2" fill="#9c4325" />
      <path d="M8 19 h32 v5 a16 16 0 0 1 -32 0 z" fill="#c75d3c" />
      <circle cx="19" cy="28" r="2.1" fill="#faf6f1" />
      <circle cx="29" cy="28" r="2.1" fill="#faf6f1" />
      <path
        d="M19.5 33 q4.5 3.5 9 0"
        fill="none"
        stroke="#faf6f1"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
