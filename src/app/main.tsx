import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/app.css'
import { App } from './App'
import { setImageSource } from './services/imageResolver'

// Replaced with a literal at build time (vite.config.ts): true only in the dev server and review builds,
// so production builds drop every debug and review tool along with its chunks and images.
declare const __DEBUG_TOOLS__: boolean
// Likewise: true only in Vercel preview builds (vite.config.ts), for the redesign review's test images.
declare const __PREVIEW_IMAGES__: boolean

// The app. In dev and review builds only (__DEBUG_TOOLS__ above), loaded on demand:
//   ?debug=panel   the standalone M0 engine panel (sim transcript replay) instead of the app
//   ?debug=cards   every dish as a deck card, for scripts/card-layout-audit.mjs
//   ?images=demo | broken | review | crops   image review sources (debug/demoImages.ts)
//   ?frame=W:H     try another deck-card frame shape (16:10 is the default)
//   ?plate=large   the larger-plate review variant of the deck card
const params = new URLSearchParams(location.search)

async function start() {
  let root: ReactNode = <App />
  if (__PREVIEW_IMAGES__ && !params.get('images')) {
    const { previewImageSource } = await import('./debug/previewImages')
    setImageSource(previewImageSource)
  }
  if (__DEBUG_TOOLS__) {
    const images = params.get('images')
    if (images) {
      const { IMAGE_SOURCES } = await import('./debug/demoImages')
      const source = IMAGE_SOURCES[images as keyof typeof IMAGE_SOURCES]
      if (source) setImageSource(source)
    }
    // ?plate=large: the review variant with two Inside ingredients and a larger plate (cover.css).
    if (params.get('plate') === 'large') document.documentElement.dataset.plate = 'large'
    const frame = /^(\d+):(\d+)$/.exec(params.get('frame') ?? '')
    if (frame) {
      document.documentElement.style.setProperty('--frame-w', frame[1]!)
      document.documentElement.style.setProperty('--frame-h', frame[2]!)
    }
    if (params.get('debug') === 'panel') {
      const { DebugPanel } = await import('./debug/DebugPanel')
      root = <DebugPanel />
    }
    if (params.get('debug') === 'cards') {
      const { CardGallery } = await import('./debug/CardGallery')
      root = <CardGallery />
    }
  }
  const el = document.getElementById('root')
  if (el) createRoot(el).render(<StrictMode>{root}</StrictMode>)
}

void start()
