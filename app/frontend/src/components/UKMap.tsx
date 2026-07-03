import { useMemo } from 'react'
import { MapContainer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import type { OverviewRow } from '../lib/api'
import { ylOrRd, fmtPrice } from '../lib/api'
import DarkBasemap from './DarkBasemap'

interface Props {
  data: OverviewRow[]
  colourBy: 'avg_price' | 'median_price' | 'total_transactions'
  labels?: Record<string, string>
}

/** Scale total_transactions to a radius between 6 and 36. */
function scaleRadius(val: number, min: number, max: number): number {
  if (max === min) return 20
  return 6 + ((val - min) / (max - min)) * 30
}

function Markers({ data, colourBy, labels }: Props) {
  const navigate = useNavigate()
  const map = useMap()

  const { minVal, maxVal, minTx, maxTx } = useMemo(() => {
    const vals = data.map(r => r[colourBy])
    const txs = data.map(r => r.total_transactions)
    return {
      minVal: Math.min(...vals),
      maxVal: Math.max(...vals),
      minTx: Math.min(...txs),
      maxTx: Math.max(...txs),
    }
  }, [data, colourBy])

  return (
    <>
      {data.map(row => {
        const norm = maxVal === minVal ? 0.5 : (row[colourBy] - minVal) / (maxVal - minVal)
        const areaName = labels?.[row.postcode_area]
        return (
          <CircleMarker
            key={row.postcode_area}
            center={[row.center_lat, row.center_long]}
            radius={scaleRadius(row.total_transactions, minTx, maxTx)}
            pathOptions={{
              fillColor: ylOrRd(norm),
              fillOpacity: 0.8,
              color: ylOrRd(norm),
              weight: 1,
            }}
            eventHandlers={{
              click: () => navigate(`/area/${row.postcode_area}`),
            }}
          >
            <Tooltip>
              <strong>{row.postcode_area}</strong>
              {areaName && (
                <>
                  <br />
                  <span style={{ opacity: 0.8 }}>{areaName}</span>
                </>
              )}
              <br />
              Avg: {fmtPrice(row.avg_price)}
              <br />
              Median: {fmtPrice(row.median_price)}
              <br />
              Sales: {row.total_transactions.toLocaleString()}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}

export default function UKMap({ data, colourBy, labels }: Props) {
  return (
    <MapContainer
      center={[54.5, -3.0]}
      zoom={5}
      maxZoom={20}
      style={{ width: '100%', height: '100%', background: '#0f0f13' }}
      zoomControl={false}
    >
      <DarkBasemap />
      <Markers data={data} colourBy={colourBy} labels={labels} />
    </MapContainer>
  )
}
