export const PALETA = ['#1d6fd8', '#2e9d5b', '#e0a82e', '#d9534f', '#8e5bd9', '#17a2b8', '#e07a3a']

export function horaTxt(h) {
  const sufijo = h >= 12 ? 'pm' : 'am'
  const x = h % 12 === 0 ? 12 : h % 12
  return `${x} ${sufijo}`
}

// datos: [{ name, value }]
export function opcionTorta(datos, texto) {
  return {
    color: PALETA,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: texto } },
    series: [{
      type: 'pie',
      radius: ['38%', '64%'],
      center: ['50%', '42%'],
      label: { show: false },
      data: datos,
    }],
  }
}

// horas: [{ hora, min, q1, q3, max, total }]
// Cada vela: cuerpo = de 25% a 75% de los días; mechas = mínimo y máximo.
export function opcionVelas(horas, texto, lineas) {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (ps) => {
        const h = horas[ps[0].dataIndex]
        return `${horaTxt(h.hora)}<br/>Máximo: ${h.max}<br/>75% de los días: ${h.q3}<br/>25% de los días: ${h.q1}<br/>Mínimo: ${h.min}<br/>Total: ${h.total}`
      },
    },
    grid: { left: 34, right: 10, top: 14, bottom: 30 },
    xAxis: {
      type: 'category',
      data: horas.map((h) => horaTxt(h.hora)),
      axisLabel: { color: texto },
      axisLine: { lineStyle: { color: lineas } },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: texto },
      splitLine: { lineStyle: { color: lineas } },
    },
    series: [{
      type: 'candlestick',
      data: horas.map((h) => [h.q1, h.q3, h.min, h.max]),
      itemStyle: { color: '#1d6fd8', color0: '#1d6fd8', borderColor: '#1d6fd8', borderColor0: '#1d6fd8' },
    }],
  }
}
