import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/app.css'
import { App } from './App'
import { DebugPanel } from './debug/DebugPanel'

// The app. ?debug=panel opens the standalone M0 engine panel (sim transcript replay) instead.
const root = document.getElementById('root')
if (root) {
  const standalonePanel = new URLSearchParams(location.search).get('debug') === 'panel'
  createRoot(root).render(<StrictMode>{standalonePanel ? <DebugPanel /> : <App />}</StrictMode>)
}
