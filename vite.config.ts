import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Em produção (GitHub Pages) o site fica em https://<usuario>.github.io/<repo>/,
// então o base path precisa ser o nome do repositório.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH ?? '/',
})
