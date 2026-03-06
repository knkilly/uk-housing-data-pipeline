import Plot from 'react-plotly.js'
import type { SummaryRow } from '../lib/api'
import { PLOTLY_LAYOUT, AXIS, BLUE } from '../theme'

interface Props {
  data: SummaryRow[]
}

export default function VolumeChart({ data }: Props) {
  return (
    <Plot
      data={[
        {
          x: data.map(r => r.transaction_year),
          y: data.map(r => r.transaction_count),
          type: 'bar',
          marker: { color: BLUE, line: { width: 0 } },
        },
      ]}
      layout={{
        ...PLOTLY_LAYOUT,
        yaxis: { ...AXIS, tickformat: ',' },
        xaxis: { ...AXIS },
        autosize: true,
      }}
      config={{ displayModeBar: false, responsive: true }}
      useResizeHandler
      style={{ width: '100%', height: 320 }}
    />
  )
}
