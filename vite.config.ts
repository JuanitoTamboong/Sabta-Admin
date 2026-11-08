
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',

  plugins: [react()],

  resolve: {
    // This forces Vite to use only ONE copy of React
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
