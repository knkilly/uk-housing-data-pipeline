import { useState, useMemo } from 'react'
import type { DistrictRow } from '../lib/api'
import { fmtPrice } from '../lib/api'
import { SURFACE, BORDER, TEXT, MUTED, GOLD } from '../theme'

interface Props {
  data: DistrictRow[]
}

type SortKey = 'postcode_district' | 'district_name' | 'transaction_count' | 'avg_price' | 'median_price'

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'postcode_district', label: 'District', align: 'left' },
  { key: 'district_name', label: 'Area Name', align: 'left' },
  { key: 'transaction_count', label: 'Sales', align: 'right' },
  { key: 'avg_price', label: 'Avg Price', align: 'right' },
  { key: 'median_price', label: 'Median Price', align: 'right' },
]

export default function DistrictTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('transaction_count')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [data, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.85rem',
          background: SURFACE,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  padding: '0.6rem 0.75rem',
                  textAlign: col.align,
                  color: sortKey === col.key ? GOLD : MUTED,
                  fontWeight: 500,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {col.label} {sortKey === col.key ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr
              key={row.postcode_district}
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <td style={{ padding: '0.5rem 0.75rem', color: TEXT }}>{row.postcode_district}</td>
              <td style={{ padding: '0.5rem 0.75rem', color: TEXT }}>{row.district_name}</td>
              <td style={{ padding: '0.5rem 0.75rem', color: TEXT, textAlign: 'right' }}>
                {row.transaction_count.toLocaleString()}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', color: TEXT, textAlign: 'right' }}>
                {fmtPrice(row.avg_price)}
              </td>
              <td style={{ padding: '0.5rem 0.75rem', color: TEXT, textAlign: 'right' }}>
                {fmtPrice(row.median_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}