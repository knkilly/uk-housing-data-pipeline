declare module 'plotly.js-dist-min' {
  const Plotly: any
  export default Plotly
  export type Data = any
  export type Layout = any
  export type Config = any
  export type LayoutAxis = any
}

declare module 'react-plotly.js' {
  interface PlotParams {
    data: any[]
    layout?: any
    config?: any
    style?: React.CSSProperties
    useResizeHandler?: boolean
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void
  }

  const Plot: React.FC<PlotParams>
  export default Plot
}

declare module 'leaflet.heat' {
  import * as L from 'leaflet'

  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number
      blur?: number
      maxZoom?: number
      max?: number
      gradient?: Record<number, string>
    },
  ): L.Layer

  export = heatLayer
}

declare module '*.png' {
  const value: string
  export default value
}
