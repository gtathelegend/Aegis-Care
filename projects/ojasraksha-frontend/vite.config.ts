import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.browser': 'true',
    'process.version': '"v20.0.0"',
    Buffer: ['buffer', 'Buffer'],
  },
})
