// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

export interface OverviewRow {
  postcode_area: string
  center_lat: number
  center_long: number
  total_transactions: number
  avg_price: number
  median_price: number
}

export interface SummaryRow {
  transaction_year: number
  transaction_count: number
  avg_price: number
  median_price: number
  min_price: number
  max_price: number
}

export interface PropertyTypeRow {
  property_type: string
  transaction_year: number
  transaction_count: number
  avg_price: number
  median_price: number
  p25: number
  p75: number
}

export interface MonthlyRow {
  transaction_year: number
  transaction_month: number
  transaction_count: number
  avg_price: number
  median_price: number
}

export interface HeatmapRow {
  latitude: number
  longitude: number
  avg_price: number
  total_transactions: number
  property_type: string
  postcode_district: string
}

export interface DistrictRow {
  postcode_district: string
  district_name: string
  transaction_count: number
  avg_price: number
  median_price: number
  center_lat: number
  center_long: number
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export const fetchOverview = () =>
  fetchJSON<OverviewRow[]>('/api/overview')

/** Returns a map of postcode_area -> human-readable name, e.g. { CM: "Chelmsford, Basildon, Maldon" } */
export const fetchAreaLabels = () =>
  fetchJSON<Record<string, string>>('/api/area-labels')

export const fetchAreaSummary = (code: string) =>
  fetchJSON<SummaryRow[]>(`/api/area/${encodeURIComponent(code)}/summary`)

export const fetchPropertyTypes = (code: string) =>
  fetchJSON<PropertyTypeRow[]>(`/api/area/${encodeURIComponent(code)}/property-types`)

export const fetchMonthly = (code: string) =>
  fetchJSON<MonthlyRow[]>(`/api/area/${encodeURIComponent(code)}/monthly`)

export const fetchHeatmap = (
  code: string,
  propertyType = 'All',
  priceMin = 0,
  priceMax = 99999,
) => {
  const params = new URLSearchParams({
    property_type: propertyType,
    price_min: String(priceMin),
    price_max: String(priceMax),
  })
  return fetchJSON<HeatmapRow[]>(
    `/api/area/${encodeURIComponent(code)}/heatmap?${params}`,
  )
}

export const fetchDistricts = (code: string) =>
  fetchJSON<DistrictRow[]>(`/api/area/${encodeURIComponent(code)}/districts`)

// ---------------------------------------------------------------------------
// Colour scale — YlOrRd (yellow→orange→red) for price mapping
// ---------------------------------------------------------------------------

/** Interpolate between two hex colours at ratio t ∈ [0,1]. */
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const ca = parse(a)
  const cb = parse(b)
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const b_ = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r},${g},${b_})`
}

// YlOrRd stops from ColorBrewer
const YLOR_RD = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026']

/**
 * Map a normalised value (0–1) to a YlOrRd colour string.
 */
export function ylOrRd(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const idx = clamped * (YLOR_RD.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, YLOR_RD.length - 1)
  return lerpColor(YLOR_RD[lo], YLOR_RD[hi], idx - lo)
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function fmtPrice(val: number): string {
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(2)}M`
  if (val >= 1_000) return `£${Math.round(val / 1_000)}K`
  return `£${Math.round(val)}`
}
