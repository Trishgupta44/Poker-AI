import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: true,
    watch: {
      // Ignore the Python backend directory — its __pycache__ / .pyc file
      // changes were triggering Vite full-page reloads during API calls.
      ignored: ['**/python-ai/**'],
    },
  },
})
