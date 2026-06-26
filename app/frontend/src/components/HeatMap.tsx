import { useEffect, useRef } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { HeatmapRow } from '../lib/api'
import { fmtPrice } from '../lib/api'
import { typeColour, priceShade } from '../theme'
import OSMapsTiles from './OSMapsTiles'

interface Props {
  data: HeatmapRow[]
  center: [number, number]
  zoom: number
}

/**
 * Categorical price layer: one circle per point.
 *   hue      = property type (TYPE_COLORS)
 *   darkness = price — darker = more expensive
 * Price is normalised across the MIN–MAX of whatever points are passed in, so
 * filtering to a subset of types rescales the shading to match.
 * Rendered to a shared canvas for performance (up to 5000 points).
 */
function PointLayer({ data }: { data: HeatmapRow[] }) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    if (data.length === 0) return

    const prices = data.map(r => r.avg_price)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    const range = maxP - minP

    const renderer = L.canvas({ padding: 0.5 })
    const group = L.layerGroup()

    for (const r of data) {
      const t = range > 0 ? (r.avg_price - minP) / range : 0.5
      const marker = L.circleMarker([r.latitude, r.longitude], {
        renderer,
        radius: 5,
        stroke: false,
        fillColor: priceShade(typeColour(r.property_type), t),
        fillOpacity: 0.82,
      })
      marker.bindTooltip(
        `${r.property_type} · ${fmtPrice(r.avg_price)}<br>${r.postcode_district} · ${r.total_transactions.toLocaleString()} sales`,
        { direction: 'top', opacity: 0.9 },
      )
      marker.addTo(group)
    }

    group.addTo(map)
    layerRef.current = group

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [data, map])

  return null
}

export default function HeatMap({ data, center, zoom }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      maxZoom={20}
      preferCanvas={true}
      style={{ width: '100%', height: 480, borderRadius: 8 }}
      zoomControl={true}
    >
      <OSMapsTiles />
      <PointLayer data={data} />
    </MapContainer>
  )
}