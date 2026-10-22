import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { PieChart, CandlestickChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, CandlestickChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

export default function Grafica({ opcion, alto = 260 }) {
  const ref = useRef(null)
  const grafico = useRef(null)

  useEffect(() => {
    grafico.current = echarts.init(ref.current)
    const redimensionar = () => grafico.current && grafico.current.resize()
    window.addEventListener('resize', redimensionar)
    return () => {
      window.removeEventListener('resize', redimensionar)
      grafico.current.dispose()
      grafico.current = null
    }
  }, [])

  useEffect(() => {
    if (grafico.current) grafico.current.setOption(opcion, true)
  }, [opcion])

  return <div ref={ref} style={{ width: '100%', height: alto }} />
}
