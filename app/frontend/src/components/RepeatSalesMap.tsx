import { useEffect, useRef, useState } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import Plot from 'react-plotly.js'
import type { RepeatSaleRow } from '../lib/api'
import { fmtPrice } from '../lib/api'
import { PLOTLY_LAYOUT, AXIS, GOLD, TEXT, MUTED, SURFACE, BORDER, GREEN, RED, changeColour } from '../theme'
import OSMapsTiles from './OSMapsTiles'

interface Props {
  data: RepeatSaleRow[]
  center: [number, number]
  zoom: number
}

const addressLine = (r: RepeatSaleRow) =>
  `${r.paon}${r.saon ? ` ${r.saon}` : ''} ${r.street}`

/** More sales = slightly bigger marker (2 → 4px, 6+ → 8px). */
const markerRadius = (n: number) => 4 + Math.min(n - 2, 4)

/**
 * MapController: updates the map's center and zoom when props change.
 * This ensures the map re-centers when navigating between areas.
 */
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.5 })
  }, [center, zoom, map])

  return null
}

function PointLayer({
  data,
  onSelect,
}: {
  data: RepeatSaleRow[]
  onSelect: (r: RepeatSaleRow) => void
}) {
  const map = useMap()
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    if (data.length === 0) return

    const renderer = L.canvas({ padding: 0.5 })
    const group = L.layerGroup()

    for (const r of data) {
      const pct = r.annualised_pct_change ?? 0
      const marker = L.circleMarker([r.latitude, r.longitude], {
        renderer,
        radius: markerRadius(r.n_sales),
        weight: 0.5,
        color: '#00000066',
        fillColor: changeColour(pct),
        fillOpacity: 0.85,
      })
      marker.bindTooltip(
        `${addressLine(r)}<br>${r.n_sales} sales · ${r.annualised_pct_change ?? '—'}%/yr`,
        { direction: 'top', opacity: 0.9 },
      )
      marker.on('click', () => onSelect(r))
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
  }, [data, map, onSelect])

  return null
}

export default function RepeatSalesMap({ data, center, zoom }: Props) {
  const [selected, setSelected] = useState<RepeatSaleRow | null>(null)

  return (
    <div>
      <MapContainer
        center={center}
        zoom={zoom}
        maxZoom={20}
        preferCanvas={true}
        style={{ width: '100%', height: 480, borderRadius: 8 }}
        zoomControl={true}
      >
        <OSMapsTiles />
        <MapController center={center} zoom={zoom} />
        <PointLayer data={data} onSelect={setSelected} />
      </MapContainer>

      {selected && (
        <div
          style={{
            marginTop: '0.75rem',
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ color: TEXT, fontSize: '0.95rem' }}>{addressLine(selected)}</div>
              <div style={{ color: MUTED, fontSize: '0.78rem' }}>
                {selected.town_city} · {selected.postcode} · {selected.n_sales} sales
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                color: MUTED,
                borderRadius: 5,
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'DM Sans',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
            <span style={{ color: MUTED }}>
              First <span style={{ color: TEXT }}>{fmtPrice(selected.first_price)}</span> ({selected.first_date.slice(0, 4)})
            </span>
            <span style={{ color: MUTED }}>
              Latest <span style={{ color: TEXT }}>{fmtPrice(selected.last_price)}</span> ({selected.last_date.slice(0, 4)})
            </span>
            <span style={{ color: MUTED }}>
              Total{' '}
              <span style={{ color: selected.total_pct_change >= 0 ? GREEN : RED }}>
                {selected.total_pct_change >= 0 ? '+' : ''}{selected.total_pct_change}%
              </span>
            </span>
            <span style={{ color: MUTED }}>
              Annualised{' '}
              <span style={{ color: (selected.annualised_pct_change ?? 0) >= 0 ? GREEN : RED }}>
                {selected.annualised_pct_change ?? '—'}%/yr
              </span>
            </span>
          </div>

          <Plot
            data={(() => {
              // History is stored unsorted; dates are YYYY-MM-DD so a string
              // sort is chronological.
              const hist = [...selected.history].sort((a, b) => a.date.localeCompare(b.date))
              return [
                {
                  x: hist.map(h => h.date),
                  y: hist.map(h => h.price),
                  mode: 'lines+markers',
                  line: { color: GOLD, width: 2.5 },
                  marker: { size: 8, color: GOLD },
                  hovertemplate: '%{x|%b %Y}<br>£%{y:,}<extra></extra>',
                },
              ]
            })()}
            layout={{
              ...PLOTLY_LAYOUT,
              yaxis: { ...AXIS, tickprefix: '£', tickformat: ',' },
              xaxis: { ...AXIS, type: 'date' },
              autosize: true,
              margin: { l: 64, r: 16, t: 10, b: 30 },
            }}
            config={{ displayModeBar: false, responsive: true }}
            useResizeHandler
            style={{ width: '100%', height: 240 }}
          />
        </div>
      )}
    </div>
  )
}
