import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DebugPanel } from './debug/DebugPanel'

// M0: the app is just the engine debug panel (MVP_SPEC §4 D1). The real UI arrives in M1.
const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <DebugPanel />
    </StrictMode>,
  )
}
