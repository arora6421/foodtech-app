import { useState } from 'react'
import { useSolo } from '../state/soloSessionStore'
import { SessionView } from './DebugPanel'

// ?debug=1: the M0 debug panel as an overlay on the live session (m1-spec §1). Dev tool only.
export function DebugOverlay() {
  const [open, setOpen] = useState(false)
  const state = useSolo((s) => s.state)
  const swipe = useSolo((s) => s.swipe)
  const pick = useSolo((s) => s.pick)
  const decide = useSolo((s) => s.decide)
  const notQuite = useSolo((s) => s.notQuite)
  const undo = useSolo((s) => s.undo)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          right: 8,
          bottom: 8,
          zIndex: 100,
          minHeight: 36,
          padding: '0 12px',
          font: '600 12px system-ui',
          background: '#222',
          color: '#fff',
          border: 0,
          borderRadius: 6,
        }}
      >
        {open ? 'Close debug' : 'Debug'}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            overflow: 'auto',
            background: 'rgba(255,255,255,.97)',
            padding: 12,
            font: '13px system-ui',
            color: '#222',
          }}
        >
          {state ? (
            <SessionView
              state={state}
              send={(e) => {
                if (e.type === 'swipe') swipe(e.verdict)
                else if (e.type === 'pick') pick()
                else if (e.type === 'decide') decide()
                else notQuite()
              }}
              onUndo={undo}
            />
          ) : (
            <p>No session yet. Start one from the Craving screen.</p>
          )}
        </div>
      )}
    </>
  )
}
