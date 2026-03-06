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
import DistrictTable from '../components/DistrictTable'
import { SURFACE, BORDER, TEXT, MUTED, GOLD, RED, GREEN, BG } from '../theme'

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
  const [heatPropType, setHeatPropType] = useState('All')
  const [heatPriceMin, setHeatPriceMin] = useState(100)
  const [heatPriceMax, setHeatPriceMax] = useState(1000)
  const [boundsInit, setBoundsInit] = useState(false)

  // Debounce values
  const [debouncedMin, setDebouncedMin] = useState(heatPriceMin)
  const [debouncedMax, setDebouncedMax] = useState(heatPriceMax)
  const [debouncedType, setDebouncedType] = useState(heatPropType)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedMin(heatPriceMin)
      setDebouncedMax(heatPriceMax)
      setDebouncedType(heatPropType)
    }, 400)
    return () => clearTimeout(t)
  }, [heatPriceMin, heatPriceMax, heatPropType])

  const heatmap = useQuery({
    queryKey: ['heatmap', areaCode, debouncedType, debouncedMin, debouncedMax],
    queryFn: () => fetchHeatmap(areaCode, debouncedType, debouncedMin, debouncedMax),
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
        <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.5rem' }}>Price Heatmap</h4>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Map */}
          <div style={{ flex: 1 }}>
            {heatmap.isLoading && !heatmap.data ? (
              <Skeleton height={480} />
            ) : heatmap.error ? (
              <ErrorMsg msg="Failed to load heatmap" />
            ) : (
              <HeatMap data={heatmap.data || []} center={heatCenter} zoom={heatZoom} />
            )}
            {heatmap.data && (
              <p style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.4rem' }}>
                {heatmap.data.length.toLocaleString()} points shown · last 5 years of sales data
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
            {/* Property type dropdown */}
            <div>
              <label style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                Property Type
              </label>
              <select
                value={heatPropType}
                onChange={e => setHeatPropType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  background: BG,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  color: TEXT,
                  fontFamily: 'DM Sans',
                  fontSize: '0.85rem',
                }}
              >
                <option value="All">All</option>
                <option value="Detached">Detached</option>
                <option value="Semi-Detached">Semi-Detached</option>
                <option value="Terraced">Terraced</option>
                <option value="Flat">Flat</option>
                <option value="Other">Other</option>
              </select>
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
        </h4>
        {districts.isLoading ? <Skeleton height={200} /> : districts.error ? <ErrorMsg msg="Failed to load districts" /> : districts.data && <DistrictTable data={districts.data} />}
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
