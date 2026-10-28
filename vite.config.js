import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const COPYRIGHT_BANNER = `/*! @preserve
 * Rampa Food - Progressive Web Application
 * © 2026 William Alexander Gómez (gwilliamalexander@gmail.com). Todos los derechos reservados.
 * Prohibida la copia, reproducción, distribución o ingeniería inversa no autorizada.
 * Licensed exclusively for authorized testing & production evaluation.
 */`

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_AUTHOR__: JSON.stringify('William Alexander Gómez'),
    __APP_COPYRIGHT__: JSON.stringify('© 2026 William Alexander Gómez. Todos los derechos reservados.'),
    __APP_VERSION__: JSON.stringify('0.8.5')
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        banner: COPYRIGHT_BANNER
      }
    }
  }
})