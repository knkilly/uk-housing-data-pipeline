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
export const PLOTLY_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: SURFACE,
  plot_bgcolor: SURFACE,
  font: { family: 'DM Sans', color: MUTED, size: 12 },
  margin: { l: 60, r: 20, t: 40, b: 40 },
  colorway: PALETTE,
}

export const AXIS: Partial<Plotly.LayoutAxis> = {
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

// Import Plotly types for layout typing
import type Plotly from 'plotly.js-dist-min'
