import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import type { HeatmapRow } from '../lib/api'

const STADIA_KEY = import.meta.env.VITE_STADIA_KEY || ''

interface Props {
  data: HeatmapRow[]
  center: [number, number]
  zoom: number
}

/**
 * Inner component that manages the heat layer via useEffect.
 * The MapContainer is rendered once; only the heat layer is replaced.
 */
function HeatLayer({ data }: { data: HeatmapRow[] }) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    // Remove previous heat layer
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (data.length === 0) return

    const points: [number, number, number][] = data.map(r => [
      r.latitude,
      r.longitude,
      r.avg_price,
    ])

    // Normalise intensity to [0, 1]
    const maxPrice = Math.max(...data.map(r => r.avg_price))
    const normalised: [number, number, number][] = points.map(([lat, lng, val]) => [
      lat,
      lng,
      maxPrice > 0 ? val / maxPrice : 0.5,
    ])

    // @ts-expect-error leaflet.heat augments L
    const heat = L.heatLayer(normalised, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.0: '#ffffb2',
        0.25: '#fed976',
        0.5: '#fd8d3c',
        0.75: '#e31a1c',
        1.0: '#b10026',
      },
    })

    heat.addTo(map)
    layerRef.current = heat

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
  const tileUrl = STADIA_KEY
    ? `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_KEY}`
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ width: '100%', height: 480, borderRadius: 8 }}
      zoomControl={true}
    >
      <TileLayer
        url={tileUrl}
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>'
      />
      <HeatLayer data={data} />
    </MapContainer>
  )
}
