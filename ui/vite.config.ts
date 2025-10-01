import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const base = process.env.VITE_BASE_URL || '/'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0', // listen on all interfaces
    port: 3000,
    proxy: {
      [`^${base}(api|files|docs|openapi\.json)`]: {
        target: 'http://localhost:8000',
      },
    },
  },
})