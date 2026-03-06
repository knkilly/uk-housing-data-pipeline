import Plot from 'react-plotly.js'
import type { SummaryRow } from '../lib/api'
import { PLOTLY_LAYOUT, AXIS, GOLD, BLUE, TEXT } from '../theme'

interface Props {
  data: SummaryRow[]
}

export default function PriceTrend({ data }: Props) {
  const years = data.map(r => r.transaction_year)

  return (
    <Plot
      data={[
        {
          x: years,
          y: data.map(r => r.avg_price),
          mode: 'lines+markers',
          name: 'Avg',
          line: { color: GOLD, width: 2.5 },
          marker: { size: 5 },
        },
        {
          x: years,
          y: data.map(r => r.median_price),
          mode: 'lines',
          name: 'Median',
          line: { color: BLUE, width: 2, dash: 'dot' },
        },
      ]}
      layout={{
        ...PLOTLY_LAYOUT,
        yaxis: { ...AXIS, tickprefix: '£', tickformat: ',' },
        xaxis: { ...AXIS },
        legend: { orientation: 'h', y: 1.12, x: 0, font: { color: TEXT } },
        autosize: true,
      }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
      style={{ width: '100%', height: 320 }}
    />
  )
}
