import { lazy, Suspense, useEffect, useState } from 'react'
import { LazyMotion } from 'motion/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PRODUCT_NAME } from './copy/en-GB'
import { loadMotionFeatures } from './design/motionRuntime'
import { removeKey, STORAGE_KEYS } from './services/storage'
import { CravingScreen } from './screens/CravingScreen'
import { DeckScreen } from './screens/DeckScreen'
import { MatchScreen } from './screens/MatchScreen'
import { SavedDetailScreen, SavedScreen } from './screens/SavedScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { soloSessionStore } from './state/soloSessionStore'

// Replaced with a literal at build time (vite.config.ts): true only in the dev server and review builds,
// so production builds drop every debug and review tool along with its chunks and images.
declare const __DEBUG_TOOLS__: boolean

// Routes (m1-spec §1). Sheets are component state, not routes, so Back never dismantles a flow.

// Dev and review builds only, and loaded on demand (it pulls in the engine's internals).
const DebugOverlay = __DEBUG_TOOLS__
  ? lazy(() => import('./debug/DebugOverlay').then((m) => ({ default: m.DebugOverlay })))
  : null

/** Recovery from a screen that failed to render: forget the session and reload from Welcome. */
function startOver() {
  soloSessionStore.getState().reset()
  removeKey('session', STORAGE_KEYS.session)
  window.location.assign('/')
}

function Shell() {
  // ?debug=1 on any entry URL turns the overlay on until the tab reloads without it; in-app navigation drops query strings.
  const [debug] = useState(() => __DEBUG_TOOLS__ && new URLSearchParams(window.location.search).get('debug') === '1')
  return (
    <div className="app-shell">
      <ErrorBoundary onReset={startOver}>
        <Routes>
          <Route path="/" element={<WelcomeScreen />} />
          <Route path="/craving" element={<CravingScreen />} />
          <Route path="/deck" element={<DeckScreen />} />
          <Route path="/match" element={<MatchScreen />} />
          <Route path="/saved" element={<SavedScreen />} />
          <Route path="/saved/:id" element={<SavedDetailScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {debug && DebugOverlay && (
        <Suspense fallback={null}>
          <DebugOverlay />
        </Suspense>
      )}
    </div>
  )
}

export function App() {
  useEffect(() => {
    document.title = PRODUCT_NAME
    void soloSessionStore.getState().init()
  }, [])
  return (
    // `strict`: any full `motion.*` component would defeat the lazy split, so it throws in dev.
    <LazyMotion features={loadMotionFeatures} strict>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </LazyMotion>
  )
}
