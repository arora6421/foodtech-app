import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fonts are deliberately not preloaded: this app paints nothing until its JS has run, and on a slow
// connection preloading 270 KB of fonts delayed that JS (first paint 3.0 s → 4.2 s at 4× CPU, slow 4G)
// without making the fonts ready any sooner (4.7 s either way). See docs/m1-perf.md.
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    // Debug and review tools (see main.tsx and App.tsx): the dev server and `--mode review` builds only.
    // A literal replacement, so production builds drop the tools, their chunks and the review images.
    __DEBUG_TOOLS__: JSON.stringify(command === 'serve' || mode === 'review'),
  },
}))
