import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchOverview, fetchAreaLabels, fmtPrice, ylOrRd } from '../lib/api'
import UKMap from '../components/UKMap'
import { SURFACE, BORDER, TEXT, MUTED, GOLD, BG } from '../theme'

type ColourBy = 'avg_price' | 'median_price' | 'total_transactions'

const COLOUR_OPTIONS: { label: string; value: ColourBy }[] = [
  { label: 'Avg Price', value: 'avg_price' },
  { label: 'Median Price', value: 'median_price' },
  { label: 'Transaction Volume', value: 'total_transactions' },
]

export default function Overview() {
  const navigate = useNavigate()
  const [colourBy, setColourBy] = useState<ColourBy>('avg_price')

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
  })

  const { data: labels } = useQuery({
    queryKey: ['area-labels'],
    queryFn: fetchAreaLabels,
  })

  const top5 = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => b.total_transactions - a.total_transactions).slice(0, 5)
        : [],
    [data],
  )

  const top16 = useMemo(
    () =>
      data
        ? [...data].sort((a, b) => b.total_transactions - a.total_transactions).slice(0, 16)
        : [],
    [data],
  )

  if (error) {
    return (
      <div style={{ padding: '2rem', background: SURFACE, color: '#e07070' }}>
        Failed to load overview data: {String(error)}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Map + sidebar row */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          {isLoading || !data ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: SURFACE,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            <UKMap data={data} colourBy={colourBy} labels={labels} />
          )}
        </div>

        {/* Sidebar */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: SURFACE,
            borderLeft: `1px solid ${BORDER}`,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Colour by radio */}
          <div>
            <div style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Colour by
            </div>
            {COLOUR_OPTIONS.map(opt => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0',
                  color: colourBy === opt.value ? TEXT : MUTED,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="colourBy"
                  checked={colourBy === opt.value}
                  onChange={() => setColourBy(opt.value)}
                  style={{ accentColor: GOLD }}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Top 5 */}
          <div>
            <div style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Top 5 by volume
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ textAlign: 'left', padding: '0.25rem 0', fontWeight: 400 }}>Area</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0', fontWeight: 400 }}>Avg</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0', fontWeight: 400 }}>Sales</th>
                </tr>
              </thead>
              <tbody>
                {top5.map(row => (
                  <tr
                    key={row.postcode_area}
                    style={{ color: TEXT, cursor: 'pointer' }}
                    onClick={() => navigate(`/area/${row.postcode_area}`)}
                  >
                    <td style={{ padding: '0.2rem 0' }}>
                      <div>{row.postcode_area}</div>
                      {labels?.[row.postcode_area] && (
                        <div style={{ fontSize: '0.65rem', color: MUTED, lineHeight: 1.2 }}>
                          {labels[row.postcode_area]}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', paddingLeft: '0.6rem' }}>
                      {fmtPrice(row.avg_price)}
                    </td>
                    <td style={{ textAlign: 'right', paddingLeft: '0.6rem' }}>
                      {row.total_transactions.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Colour legend */}
          <div>
            <div style={{ color: MUTED, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Colour scale
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 4,
                background: 'linear-gradient(to right, #ffffb2, #fed976, #feb24c, #fd8d3c, #fc4e2a, #e31a1c, #b10026)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: MUTED, marginTop: 2 }}>
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Quick-select chips */}
      {top16.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.5rem',
            background: SURFACE,
            borderTop: `1px solid ${BORDER}`,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: MUTED, fontSize: '0.75rem', fontWeight: 500 }}>Quick select:</span>
          {top16.map(row => (
            <button
              key={row.postcode_area}
              onClick={() => navigate(`/area/${row.postcode_area}`)}
              title={labels?.[row.postcode_area] || row.postcode_area}
              style={{
                padding: '0.25rem 0.65rem',
                background: BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 4,
                color: TEXT,
                fontSize: '0.8rem',
                fontFamily: 'DM Sans',
                cursor: 'pointer',
              }}
            >
              {row.postcode_area}
            </button>
          ))}
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
