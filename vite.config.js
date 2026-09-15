import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const campusPulseApiProxy = {
  target: process.env.CAMPUS_PULSE_API_TARGET || 'http://127.0.0.1:8000',
  changeOrigin: false,
  rewrite: (path) => path.replace(/^\/api/, ''),
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  cacheDir: process.env.CAMPUS_PULSE_VITE_CACHE_DIR || 'node_modules/.vite',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': campusPulseApiProxy,
    },
  },
  preview: {
    proxy: {
      '/api': campusPulseApiProxy,
    },
  },
  build: {
    sourcemap: false,
  },
})
