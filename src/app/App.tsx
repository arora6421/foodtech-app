import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { PRODUCT_NAME } from './copy/en-GB'
import { DebugOverlay } from './debug/DebugOverlay'
import { CravingScreen } from './screens/CravingScreen'
import { DeckScreen } from './screens/DeckScreen'
import { MatchScreen } from './screens/MatchScreen'
import { SavedDetailScreen, SavedScreen } from './screens/SavedScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { soloSessionStore } from './state/soloSessionStore'

// Routes (m1-spec §1). Sheets are component state, not routes, so Back never dismantles a flow.

function Shell() {
  // ?debug=1 on any entry URL turns the overlay on until the tab reloads without it; in-app navigation drops query strings.
  const [debug] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1')
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/craving" element={<CravingScreen />} />
        <Route path="/deck" element={<DeckScreen />} />
        <Route path="/match" element={<MatchScreen />} />
        <Route path="/saved" element={<SavedScreen />} />
        <Route path="/saved/:id" element={<SavedDetailScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {debug && <DebugOverlay />}
    </div>
  )
}

export function App() {
  useEffect(() => {
    document.title = PRODUCT_NAME
    void soloSessionStore.getState().init()
  }, [])
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
