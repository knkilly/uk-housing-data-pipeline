export const BG      = '#0f0f13'
export const SURFACE = '#1a1a24'
export const BORDER  = '#2a2a38'
export const TEXT    = '#e8e4dc'
export const MUTED   = '#9090a8'
export const GOLD    = '#c8a96e'
export const BLUE    = '#7eb8c9'
export const RED     = '#e07070'
export const GREEN   = '#7ec99e'
export const PURPLE  = '#b07ec9'
export const PALETTE = [GOLD, BLUE, RED, GREEN, PURPLE]

/** Shared Plotly layout — matches the Streamlit dashboard PLOTLY_LAYOUT */
export const PLOTLY_LAYOUT: Record<string, any> = {
  paper_bgcolor: SURFACE,
  plot_bgcolor: SURFACE,
  font: { family: 'DM Sans', color: MUTED, size: 12 },
  margin: { l: 60, r: 20, t: 40, b: 40 },
  colorway: PALETTE,
}

export const AXIS: Record<string, any> = {
  gridcolor: BORDER,
  linecolor: BORDER,
  automargin: true,
}

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const PROP_LABELS: Record<string, string> = {
  Detached:        'Detached',
  'Semi-Detached': 'Semi-Detached',
  Terraced:        'Terraced',
  Flat:            'Flat/Maisonette',
  Other:           'Other',
  Unknown:         'Unknown',
}

// ---------------------------------------------------------------------------
// Categorical price map — hue = property type, darkness = price
// ---------------------------------------------------------------------------

/** Stable hue per property type (falls back to MUTED for unknowns). */
export const TYPE_COLORS: Record<string, string> = {
  Detached:          BLUE,
  'Semi-Detached':   GREEN,
  Terraced:          GOLD,
  Flat:              PURPLE,
  'Flat/Maisonette': PURPLE,
  Other:             RED,
  Unknown:           MUTED,
}

export function typeColour(type: string): string {
  return TYPE_COLORS[type] ?? MUTED
}

function mixHex(hex: string, target: string, t: number): string {
  const p = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ]
  const [r1, g1, b1] = p(hex)
  const [r2, g2, b2] = p(target)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

/** Shade a hue by price: t=0 (cheap) lighter, t=1 (expensive) darker. */
export function priceShade(hex: string, t: number): string {
  const tc = Math.max(0, Math.min(1, t))
  return tc < 0.5
    ? mixHex(hex, '#ffffff', (0.5 - tc) * 1.4)
    : mixHex(hex, '#000000', (tc - 0.5) * 1.4)
}

/**
 * Diverging colour for a % change: red (fell) → grey (flat) → green (rose).
 * Neutral is centred on 0%. Falls saturate by ~8%/yr, rises by ~12%/yr.
 */
export function changeColour(pct: number): string {
  const grey = '#6a6a7a'
  if (pct < 0) return mixHex(grey, RED, Math.min(Math.abs(pct) / 8, 1))
  return mixHex(grey, GREEN, Math.min(pct / 12, 1))
}
