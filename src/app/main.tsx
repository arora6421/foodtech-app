import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/app.css'
import { App } from './App'
import { DebugPanel } from './debug/DebugPanel'
import { brokenImageSource, cropsImageSource, demoImageSource, reviewImageSource } from './debug/demoImages'
import { setImageSource } from './services/imageResolver'

// The app. ?debug=panel opens the standalone M0 engine panel (sim transcript replay) instead.
const params = new URLSearchParams(location.search)
// Image review tools (M1.6), in the dev server and the `review` preview build only:
// ?images=demo | broken | review | crops (see debug/demoImages.ts),
// ?frame=4:3 (try the taller deck-card frame; 16:10 is the default).
if (import.meta.env.DEV || import.meta.env.MODE === 'review') {
  const pick = { demo: demoImageSource, broken: brokenImageSource, review: reviewImageSource, crops: cropsImageSource }[
    params.get('images') ?? ''
  ]
  if (pick) setImageSource(pick)
  const frame = /^(\d+):(\d+)$/.exec(params.get('frame') ?? '')
  if (frame) {
    document.documentElement.style.setProperty('--frame-w', frame[1]!)
    document.documentElement.style.setProperty('--frame-h', frame[2]!)
  }
}

const root = document.getElementById('root')
if (root) {
  const standalonePanel = params.get('debug') === 'panel'
  createRoot(root).render(<StrictMode>{standalonePanel ? <DebugPanel /> : <App />}</StrictMode>)
}
