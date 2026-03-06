import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { MonthlyRow } from '../lib/api'
import { PLOTLY_LAYOUT, AXIS, GOLD, BLUE, TEXT, MONTH_LABELS } from '../theme'

interface Props {
  data: MonthlyRow[]
}

function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export default function Candlestick({ data }: Props) {
  const candle = useMemo(() => {
    const byMonth: Record<number, number[]> = {}
    for (const r of data) {
      if (!byMonth[r.transaction_month]) byMonth[r.transaction_month] = []
      byMonth[r.transaction_month].push(r.avg_price)
    }
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const vals = byMonth[m] || []
      if (vals.length === 0) return { month: m, low: 0, q1: 0, med: 0, q3: 0, high: 0 }
      return {
        month: m,
        low: Math.min(...vals),
        q1: quantile(vals, 0.25),
        med: quantile(vals, 0.5),
        q3: quantile(vals, 0.75),
        high: Math.max(...vals),
      }
    })
  }, [data])

  return (
    <Plot
      data={[
        {
          x: candle.map(c => c.month),
          open: candle.map(c => c.q1),
          high: candle.map(c => c.high),
          low: candle.map(c => c.low),
          close: candle.map(c => c.q3),
          type: 'candlestick',
          increasing: {
            line: { color: BLUE, width: 1.5 },
            fillcolor: 'rgba(126,184,201,0.35)',
          },
          decreasing: {
            line: { color: BLUE, width: 1.5 },
            fillcolor: 'rgba(126,184,201,0.35)',
          },
          name: 'IQR range',
        },
        {
          x: candle.map(c => c.month),
          y: candle.map(c => c.med),
          mode: 'lines+markers',
          name: 'Median',
          line: { color: GOLD, width: 2.5, dash: 'dot' },
          marker: { size: 6, color: GOLD },
        },
      ]}
      layout={{
        ...PLOTLY_LAYOUT,
        xaxis: {
          ...AXIS,
          tickvals: Array.from({ length: 12 }, (_, i) => i + 1),
          ticktext: MONTH_LABELS,
          rangeslider: { visible: false },
        },
        yaxis: { ...AXIS, tickprefix: '£', tickformat: ',' },
        legend: { orientation: 'h', y: 1.12, x: 0, font: { color: TEXT } },
        autosize: true,
      }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
      style={{ width: '100%', height: 360 }}
    />
  )
}
