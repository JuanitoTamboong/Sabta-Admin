import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // '/' is standard for web (Vercel). 
  // We only use './' if a specific Electron build script triggers it.
  base: process.env.IS_ELECTRON === 'true' ? './' : '/',
  
  plugins: [react()],
  
  resolve: {
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})