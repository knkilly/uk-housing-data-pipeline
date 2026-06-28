import { TileLayer } from 'react-leaflet'
import './OSMapsTiles.css'

const OS_KEY = import.meta.env.VITE_OS_API_KEY || ''

interface Props {
  /** Darken the (light) OS basemap to fit the dark UI. Default true. */
  dark?: boolean
}

/**
 * OS Maps API raster basemap — Outdoor style, Web Mercator (EPSG:3857).
 *
 * Pre-rendered raster tiles through a plain Leaflet TileLayer: no WebGL, no
 * MapLibre, no extra dependencies, so it initialises fast — the right weight
 * for a basemap sitting under the heat overlay.
 *
 * OS has no dark raster style, so `dark` recolours the Light tiles with a CSS
 * filter scoped to these tiles only (markers and the heat layer are untouched).
 * Pass dark={false} to show the native OS Light style.
 *
 * Requires "OS Maps API" added to the key's OS Data Hub project.
 */
export default function OSMapsTiles({ dark = true }: Props) {
  const year = new Date().getFullYear()
  return (
    <div className={dark ? 'os-maps-tiles-wrapper-dark' : 'os-maps-tiles-wrapper'}>
      <TileLayer
        url={`https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${OS_KEY}`}
        attribution={`Contains OS data &copy; Crown copyright and database rights ${year}`}
        maxZoom={20}
      />
    </div>
  )
}