import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/icicilamboradr_outputs_case_review_dashboard/',
  plugins: [react()],
})
