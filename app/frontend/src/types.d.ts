declare module 'react-plotly.js' {
  import { Component } from 'react'
  import type Plotly from 'plotly.js-dist-min'

  interface PlotParams {
    data: Plotly.Data[]
    layout?: Partial<Plotly.Layout>
    config?: Partial<Plotly.Config>
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

  namespace L {
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
  }
}

declare module '*.png' {
  const value: string
  export default value
}
