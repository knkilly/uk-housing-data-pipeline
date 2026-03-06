import { useState, useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { PropertyTypeRow } from '../lib/api'
import { fmtPrice } from '../lib/api'
import { PLOTLY_LAYOUT, AXIS, PALETTE, TEXT, MUTED, BORDER, BG, GOLD, PROP_LABELS } from '../theme'

interface Props {
  data: PropertyTypeRow[]
}

export default function PropertyType({ data }: Props) {
  const years = useMemo(
    () => [...new Set(data.map(r => r.transaction_year))].sort((a, b) => a - b),
    [data],
  )

  const [fromYear, setFromYear] = useState(() => years.at(-1) ?? 2024)
  const [toYear, setToYear] = useState(() => years.at(-1) ?? 2024)

  // Aggregate across the selected range, excluding Unknown
  const pt = useMemo(() => {
    const filtered = data.filter(
      r =>
        r.transaction_year >= fromYear &&
        r.transaction_year <= toYear &&
        r.property_type !== 'Unknown',
    )

    // Group by property_type and aggregate
    const grouped: Record<string, { count: number; priceSum: number; p25Sum: number; p75Sum: number; yearCount: number }> = {}
    for (const r of filtered) {
      if (!grouped[r.property_type]) {
        grouped[r.property_type] = { count: 0, priceSum: 0, p25Sum: 0, p75Sum: 0, yearCount: 0 }
      }
      const g = grouped[r.property_type]
      g.count += r.transaction_count
      g.priceSum += r.avg_price * r.transaction_count
      g.p25Sum += r.p25 * r.transaction_count
      g.p75Sum += r.p75 * r.transaction_count
      g.yearCount += 1
    }

    return Object.entries(grouped)
      .map(([type, g]) => ({
        property_type: type,
        transaction_count: g.count,
        avg_price: g.count > 0 ? g.priceSum / g.count : 0,
        p25: g.count > 0 ? g.p25Sum / g.count : 0,
        p75: g.count > 0 ? g.p75Sum / g.count : 0,
      }))
      .sort((a, b) => a.avg_price - b.avg_price)
  }, [data, fromYear, toYear])

  const labels = pt.map(r => PROP_LABELS[r.property_type] || r.property_type)
  const rangeLabel = fromYear === toYear ? `${fromYear}` : `${fromYear}–${toYear}`

  const selectStyle: React.CSSProperties = {
    padding: '0.3rem 0.5rem',
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 4,
    color: TEXT,
    fontFamily: 'DM Sans',
    fontSize: '0.8rem',
  }
  const prices = pt.map(r => r.avg_price)
  const maxPrice = Math.max(...prices)

  const textPositions = prices.map(v =>
    v > maxPrice * 0.25 ? 'inside' : 'outside'
  )

  return (
    <div>
      {/* Year range controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ color: MUTED, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Year range
        </span>
        <select
          value={fromYear}
          onChange={e => {
            const v = Number(e.target.value)
            setFromYear(v)
            if (v > toYear) setToYear(v)
          }}
          style={selectStyle}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span style={{ color: MUTED }}>to</span>
        <select
          value={toYear}
          onChange={e => {
            const v = Number(e.target.value)
            setToYear(v)
            if (v < fromYear) setFromYear(v)
          }}
          style={selectStyle}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        {/* Horizontal bar */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.25rem' }}>
            Avg Price by Property Type ({rangeLabel})
          </h4>
          <Plot
            data={[
              {
                x: prices,
                y: labels,
                orientation: 'h',
                type: 'bar',
                marker: { color: PALETTE.slice(0, pt.length), line: { width: 0 } },
                text: prices.map(v => fmtPrice(v)),
                textposition: textPositions,
                insidetextanchor: 'end',
                textfont: { color: TEXT },
              },
            ]}
            layout={{
              ...PLOTLY_LAYOUT,
              xaxis: { ...AXIS, tickprefix: '£', tickformat: ',' },
              yaxis: { ...AXIS },
              autosize: true,
            }}
            config={{ displayModeBar: false, responsive: true, staticPlot: true }}
            useResizeHandler
            style={{ width: '100%', height: 300 }}
          />
        </div>

        {/* Donut */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 400, marginBottom: '0.25rem' }}>
            Transaction Mix ({rangeLabel})
          </h4>
          <Plot
            data={[
              {
                labels,
                values: pt.map(r => r.transaction_count),
                type: 'pie',
                hole: 0.55,
                marker: { colors: PALETTE },
                textfont: { color: TEXT },
              },
            ]}
            layout={{
              ...PLOTLY_LAYOUT,
              showlegend: true,
              legend: { font: { color: TEXT }, bgcolor: 'rgba(0,0,0,0)' },
              autosize: true,
            }}
            config={{ displayModeBar: false, responsive: true, staticPlot: true }}
            useResizeHandler
            style={{ width: '100%', height: 300 }}
          />
        </div>
      </div>
    </div>
  )
}
