import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fonts are deliberately not preloaded: this app paints nothing until its JS has run, and on a slow
// connection preloading 270 KB of fonts delayed that JS (first paint 3.0 s → 4.2 s at 4× CPU, slow 4G)
// without making the fonts ready any sooner (4.7 s either way). See docs/m1-perf.md.

// Vercel sets VERCEL_ENV at build time: 'production' for main, 'preview' for other branches.
const isVercelPreview = process.env.VERCEL_ENV === 'preview'

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    // Debug and review tools (see main.tsx and App.tsx): the dev server, `--mode review` builds and
    // Vercel previews. A literal replacement, so production builds drop the tools and their chunks.
    __DEBUG_TOOLS__: JSON.stringify(command === 'serve' || mode === 'review' || isVercelPreview),
    // Preview-only test images (src/app/debug/previewImages.ts): Vercel preview builds of the redesign
    // branch only, or VITE_PREVIEW_IMAGES=1 locally. Never in production.
    __PREVIEW_IMAGES__: JSON.stringify(isVercelPreview || process.env.VITE_PREVIEW_IMAGES === '1'),
  },
}))
