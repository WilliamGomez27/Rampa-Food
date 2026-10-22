import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './fondo.css'
import App from './App.jsx'
import Portada from './components/Portada.jsx'
import { registrarSW } from './lib/push'

registrarSW()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Portada />
  </StrictMode>,
)
