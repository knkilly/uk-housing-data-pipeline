import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAreaSummary,
  fetchPropertyTypes,
  fetchMonthly,
  fetchHeatmap,
  fetchDistricts,
  fetchAreaLabels,
  fmtPrice,
} from '../lib/api'
import PriceTrend from '../components/PriceTrend'
import VolumeChart from '../components/VolumeChart'
import PropertyType from '../components/PropertyType'
import Candlestick from '../components/Candlestick'
import HeatMap from '../components/HeatMap'
import type { MapFocus } from '../components/HeatMap'
import DistrictTable from '../components/DistrictTable'
import { SURFACE, BORDER, TEXT, MUTED, GOLD, RED, GREEN, BG, typeColour, priceShade, PROP_LABELS } from '../theme'

function Skeleton({ height = 320 }: { height?: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        background: SURFACE,
        borderRadius: 8,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '1rem', background: SURFACE, borderRadius: 8, color: RED }}>
      {msg}
    </div>
  )
}

function KPI({ label, value, delta }: { label: string; value: string; delta?: string; deltaColor?: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '1rem',
      }}
    >
      <div style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: TEXT, fontSize: '1.5rem', fontWeight: 500, marginTop: '0.25rem' }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: '0.8rem', marginTop: '0.15rem', color: delta.startsWith('+') ? GREEN : delta.startsWith('-') ? RED : MUTED }}>
          {delta}
        </div>
      )}
    </div>
  )
}

export default function Area() {
  const { code } = useParams<{ code: string }>()
  const areaCode = (code || '').toUpperCase()

  // ── Data queries ────────────────────────────────────────────
  const summary = useQuery({
    queryKey: ['summary', areaCode],
    queryFn: () => fetchAreaSummary(areaCode),
    enabled: !!areaCode,
  })

  const propTypes = useQuery({
    queryKey: ['propertyTypes', areaCode],
    queryFn: () => fetchPropertyTypes(areaCode),
    enabled: !!areaCode,
  })

  const monthly = useQuery({
    queryKey: ['monthly', areaCode],
    queryFn: () => fetchMonthly(areaCode),
    enabled: !!areaCode,
  })

  const districts = useQuery({
    queryKey: ['districts', areaCode],
    queryFn: () => fetchDistricts(areaCode),
    enabled: !!areaCode,
  })

  const { data: labels } = useQuery({
    queryKey: ['area-labels'],
    queryFn: fetchAreaLabels,
  })

  // ── Heatmap state + debounced fetch ─────────────────────────
  const [heatPriceMin, setHeatPriceMin] = useState(100)
  const [heatPriceMax, setHeatPriceMax] = useState(1000)
  const [boundsInit, setBoundsInit] = useState(false)

  // District focus: when a district row is clicked, the heatmap zooms to it and
  // rescales its colour ramp to that district. null = whole area.
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)

  // Property-type filter (client-side, multi-select). Seeded with all available
  // types once the data loads; an empty set shows nothing.
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [typesInit, setTypesInit] = useState(false)

  // Reset per-area view state when navigating between areas.
  useEffect(() => {
    setSelectedDistrict(null)
    setSelectedTypes(new Set())
    setTypesInit(false)
  }, [areaCode])

  // Debounce price values (type filtering is client-side now, so no refetch).
  const [debouncedMin, setDebouncedMin] = useState(heatPriceMin)
  const [debouncedMax, setDebouncedMax] = useState(heatPriceMax)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedMin(heatPriceMin)
      setDebouncedMax(heatPriceMax)
    }, 400)
    return () => clearTimeout(t)
  }, [heatPriceMin, heatPriceMax])

  const heatmap = useQuery({
    queryKey: ['heatmap', areaCode, debouncedMin, debouncedMax],
    queryFn: () => fetchHeatmap(areaCode, 'All', debouncedMin, debouncedMax),
    enabled: !!areaCode,
  })

  // Compute smart slider bounds from the first heatmap response
  const sliderBounds = useMemo(() => {
    if (!heatmap.data || heatmap.data.length === 0) return { floor: 100, ceil: 1000 }
    const prices = heatmap.data.map(r => r.avg_price / 1000)
    const dataMin = Math.floor(Math.min(...prices) / 10) * 10
    const dataMax = Math.ceil(Math.max(...prices) / 10) * 10
    return {
      floor: Math.max(dataMin, 100),
      ceil: Math.min(dataMax, 5000),
    }
  }, [heatmap.data])

  // Set initial slider positions once data arrives
  useEffect(() => {
    if (!boundsInit && heatmap.data && heatmap.data.length > 0) {
      setHeatPriceMin(sliderBounds.floor)
      setHeatPriceMax(sliderBounds.ceil)
      setBoundsInit(true)
    }
  }, [heatmap.data, sliderBounds, boundsInit])

  // ── Derived data ────────────────────────────────────────────
  const latest = summary.data?.at(-1)
  const prev = summary.data && summary.data.length > 1 ? summary.data.at(-2) : latest

  const yoyPct = useMemo(() => {
    if (!latest || !prev || !prev.avg_price) return 0
    return ((latest.avg_price - prev.avg_price) / prev.avg_price) * 100
  }, [latest, prev])

  const heatCenter = useMemo<[number, number]>(() => {
    if (!heatmap.data || heatmap.data.length === 0) {
      // Fallback from districts
      if (districts.data && districts.data.length > 0) {
        const lats = districts.data.map(d => d.center_lat).filter(Boolean)
        const lngs = districts.data.map(d => d.center_long).filter(Boolean)
        if (lats.length > 0) {
          return [
            lats.reduce((a, b) => a + b, 0) / lats.length,
            lngs.reduce((a, b) => a + b, 0) / lngs.length,
          ]
        }
      }
      return [54.5, -3.0]
    }
    const sorted = [...heatmap.data].sort((a, b) => a.latitude - b.latitude)
    const medIdx = Math.floor(sorted.length / 2)
    return [sorted[medIdx].latitude, sorted[medIdx].longitude]
  }, [heatmap.data, districts.data])

  const heatZoom = useMemo(() => {
    if (!heatmap.data || heatmap.data.length === 0) return 10
    const uniqueDistricts = new Set(heatmap.data.map(r => r.postcode_district)).size
    return uniqueDistricts <= 5 ? 11 : uniqueDistricts <= 15 ? 10 : 9
  }, [heatmap.data])

  // The district row matching the current selection (if any).
  const selectedRow = useMemo(
    () => districts.data?.find(d => d.postcode_district === selectedDistrict) ?? null,
    [districts.data, selectedDistrict],
  )

  // Heat points actually shown: filtered to the selected district and types.
  const displayedHeat = useMemo(() => {
    if (!heatmap.data) return []
    return heatmap.data.filter(
      r =>
        (!selectedDistrict || r.postcode_district === selectedDistrict) &&
        selectedTypes.has(r.property_type),
    )
  }, [heatmap.data, selectedDistrict, selectedTypes])

  // Property types present in this area, with sale counts (area-wide).
  const availableTypes = useMemo(
    () => Array.from(new Set((heatmap.data ?? []).map(r => r.property_type))).sort(),
    [heatmap.data],
  )

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of heatmap.data ?? []) {
      m.set(r.property_type, (m.get(r.property_type) ?? 0) + r.total_transactions)
    }
    return m
  }, [heatmap.data])

  const totalCount = useMemo(
    () => Array.from(typeCounts.values()).reduce((a, b) => a + b, 0),
    [typeCounts],
  )

  // Seed the type filter with all types once data first arrives.
  useEffect(() => {
    if (!typesInit && availableTypes.length > 0) {
      setSelectedTypes(new Set(availableTypes))
      setTypesInit(true)
    }
  }, [availableTypes, typesInit])

  const allTypesSelected =
    availableTypes.length > 0 && availableTypes.every(t => selectedTypes.has(t))

  const toggleType = useCallback((t: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }, [])

  const selectAllTypes = useCallback(() => {
    setSelectedTypes(new Set(availableTypes))
  }, [availableTypes])

  // Where the map should fly. Identity changes only when the target changes,
  // so the map flies on selection and on reset, not on every render.
  const focus = useMemo<MapFocus>(() => {
    if (selectedRow && selectedRow.center_lat) {
      return { center: [selectedRow.center_lat, selectedRow.center_long], zoom: 13 }
    }
    return { center: heatCenter, zoom: heatZoom }
  }, [selectedRow, heatCenter, heatZoom])

  const handleSelectDistrict = useCallback((row: { postcode_district: string }) => {
    // Toggle: clicking the focused district again clears the focus.
    setSelectedDistrict(prev => (prev === row.postcode_district ? null : row.postcode_district))
  }, [])

  const resetArea = useCallback(() => setSelectedDistrict(null), [])

  // ── Section styles ──────────────────────────────────────────
  const section: React.CSSProperties = { padding: '0 1.5rem', marginBottom: '1.5rem' }
  const hr: React.CSSProperties = { border: 'none', borderTop: `1px solid ${BORDER}`, margin: '1.5rem 0' }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <Link to="/" style={{ color: MUTED, fontSize: '0.9rem' }}>← UK Overview</Link>
        <h2 style={{ fontSize: '1.5rem', color: TEXT }}>{areaCode}</h2>
        {labels?.[areaCode] && (
          <span style={{ color: MUTED, fontSize: '0.95rem' }}>{labels[areaCode]}</span>
        )}
      </div>

      {/* 1. KPI row */}
      <div style={section}>
        {summary.isLoading ? (
          <Skeleton height={90} />
        ) : summary.error ? (
          <ErrorMsg msg={`Failed to load summary: ${summary.error}`} />
        ) : latest ? (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <KPI
              label="Avg Price"
              value={fmtPrice(latest.avg_price)}
              delta={`${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}% YoY (${latest.transaction_year})`}
            />
            <KPI label="Median Price" value={fmtPrice(latest.median_price)} />
            <KPI label="Transactions" value={latest.transaction_count.toLocaleString()} delta={`in ${latest.transaction_year}`} />
            <KPI label="Years of Data" value={String(summary.data?.length || 0)} delta="Land Registry" />
          </div>
        ) : (
          <ErrorMsg msg={`No data found for area ${areaCode}`} />
        )}
      </div>

      <hr style={hr} />

      {/* 2. Price Trend + Volume */}
      <div style={section}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.25rem' }}>Average Price Trend</h4>
            {summary.isLoading ? <Skeleton /> : summary.error ? <ErrorMsg msg="Failed to load" /> : summary.data && <PriceTrend data={summary.data} />}
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.25rem' }}>Transaction Volume</h4>
            {summary.isLoading ? <Skeleton /> : summary.error ? <ErrorMsg msg="Failed to load" /> : summary.data && <VolumeChart data={summary.data} />}
          </div>
        </div>
      </div>

      <hr style={hr} />

      {/* 3. Property Type */}
      <div style={section}>
        {propTypes.isLoading ? <Skeleton /> : propTypes.error ? <ErrorMsg msg="Failed to load property types" /> : propTypes.data && <PropertyType data={propTypes.data} />}
      </div>

      <hr style={hr} />

      {/* 4. Seasonality Candlestick */}
      <div style={section}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.25rem' }}>
          Monthly Seasonality — Price Spread Across All Years
        </h4>
        <p style={{ color: MUTED, fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          Box = Q1/Q3 of annual avg prices · Whiskers = min/max · Dotted line = median
        </p>
        {monthly.isLoading ? <Skeleton height={360} /> : monthly.error ? <ErrorMsg msg="Failed to load monthly data" /> : monthly.data && <Candlestick data={monthly.data} />}
      </div>

      <hr style={hr} />

      {/* 5. Price Heatmap */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 400 }}>Price Heatmap</h4>
          {selectedDistrict && (
            <>
              <span style={{ color: GOLD, fontSize: '0.8rem' }}>
                Focused on {selectedDistrict}
                {selectedRow?.district_name ? ` · ${selectedRow.district_name}` : ''}
              </span>
              <button
                onClick={resetArea}
                style={{
                  marginLeft: 'auto',
                  padding: '0.3rem 0.7rem',
                  background: SURFACE,
                  border: `1px solid ${GOLD}`,
                  borderRadius: 6,
                  color: GOLD,
                  fontFamily: 'DM Sans',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                ↺ Reset to whole area
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Map */}
          <div style={{ flex: 1 }}>
            {heatmap.isLoading && !heatmap.data ? (
              <Skeleton height={480} />
            ) : heatmap.error ? (
              <ErrorMsg msg="Failed to load heatmap" />
            ) : (
              <HeatMap data={displayedHeat} center={heatCenter} zoom={heatZoom} focus={focus} />
            )}
            {heatmap.data && (
              <p style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.4rem' }}>
                {displayedHeat.length.toLocaleString()} points shown
                {selectedDistrict ? ` in ${selectedDistrict}` : ''} · last 5 years of sales data
              </p>
            )}
          </div>

          {/* Controls */}
          <div
            style={{
              width: 220,
              flexShrink: 0,
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignSelf: 'flex-start',
            }}
          >
            {/* Property type multi-select */}
            <div>
              <label style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                Property Types
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <button
                  onClick={selectAllTypes}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.35rem 0.5rem', borderRadius: 5,
                    background: allTypesSelected ? `${GOLD}22` : BG,
                    border: `1px solid ${allTypesSelected ? GOLD : BORDER}`,
                    color: allTypesSelected ? GOLD : TEXT,
                    fontFamily: 'DM Sans', fontSize: '0.8rem', cursor: 'pointer',
                  }}
                >
                  <span>All</span>
                  <span style={{ color: MUTED }}>({totalCount.toLocaleString()})</span>
                </button>

                {availableTypes.map(t => {
                  const on = selectedTypes.has(t)
                  const c = typeColour(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.35rem 0.5rem', borderRadius: 5,
                        background: on ? SURFACE : BG,
                        border: `1px solid ${on ? c : BORDER}`,
                        color: on ? TEXT : MUTED,
                        opacity: on ? 1 : 0.55,
                        fontFamily: 'DM Sans', fontSize: '0.8rem', cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: 22, height: 10, borderRadius: 2, flexShrink: 0,
                        background: `linear-gradient(90deg, ${priceShade(c, 0)}, ${priceShade(c, 1)})`,
                      }} />
                      <span style={{ flex: 1 }}>{PROP_LABELS[t] ?? t}</span>
                      <span style={{ color: MUTED }}>({(typeCounts.get(t) ?? 0).toLocaleString()})</span>
                    </button>
                  )
                })}
              </div>
              <p style={{ color: MUTED, fontSize: '0.68rem', marginTop: '0.45rem', lineHeight: 1.3 }}>
                Hue = type · darker = more expensive
              </p>
            </div>

            {/* Min price slider */}
            <div>
              <label style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                Min Price (£K): {heatPriceMin}
              </label>
              <input
                type="range"
                min={0}
                max={5000}
                step={10}
                value={heatPriceMin}
                onChange={e => {
                  const v = Number(e.target.value)
                  setHeatPriceMin(Math.min(v, heatPriceMax))
                }}
                style={{ width: '100%', accentColor: GOLD }}
              />
            </div>

            {/* Max price slider */}
            <div>
              <label style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                Max Price (£K): {heatPriceMax}
              </label>
              <input
                type="range"
                min={0}
                max={5000}
                step={10}
                value={heatPriceMax}
                onChange={e => {
                  const v = Number(e.target.value)
                  setHeatPriceMax(Math.max(v, heatPriceMin))
                }}
                style={{ width: '100%', accentColor: GOLD }}
              />
            </div>
          </div>
        </div>
      </div>

      <hr style={hr} />

      {/* 6. District Table */}
      <div style={section}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.5rem' }}>
          District Breakdown (Latest Year)
          <span style={{ color: MUTED, fontSize: '0.75rem', marginLeft: '0.6rem', fontWeight: 400 }}>
            — click a row to focus the heatmap
          </span>
        </h4>
        {districts.isLoading ? <Skeleton height={200} /> : districts.error ? <ErrorMsg msg="Failed to load districts" /> : districts.data && (
          <DistrictTable {...({ data: districts.data, onSelect: handleSelectDistrict, selected: selectedDistrict } as any)} />
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}