import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './fondo.css'
import App from './App.jsx'
import Portada from './components/Portada.jsx'
import { registrarSW } from './lib/push'

// Sello de autoría inmutable en runtime
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__RAMPA_FOOD__', {
    value: Object.freeze({
      author: 'William Alexander Gómez',
      project: 'Rampa Food',
      copyright: '© 2026 William Alexander Gómez. Todos los derechos reservados.',
      license: 'Proprietary - Testing & Evaluation Authorized. Unauthorized reproduction is prohibited.'
    }),
    writable: false,
    configurable: false
  })
}

registrarSW()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Portada />
  </StrictMode>,
)
