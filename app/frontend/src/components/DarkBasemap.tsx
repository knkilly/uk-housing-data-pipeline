import { TileLayer } from 'react-leaflet'

/**
 * Free Carto dark raster basemap.
 *
 * Used for the country-wide overview (zoom ~5), which sits below the OS NGD
 * vector tiles' minimum zoom of 7. It also matches the dark dashboard chrome
 * and needs no API key, so it never spends OS transactions on the wide view.
 */
export default function DarkBasemap() {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      maxZoom={20}
    />
  )
}
