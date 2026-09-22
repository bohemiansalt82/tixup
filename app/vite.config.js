import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages serves the app under /tixup/; a Tauri build (TAURI_ENV_PLATFORM is set by tauri-cli)
// loads it from the bundle root, so it gets a relative base instead.
export default defineConfig({
  plugins: [react()],
  base: process.env.TAURI_ENV_PLATFORM ? './' : '/tixup/',
})
