import { useState } from 'react'
import { copy } from '../../copy/en-GB'
import { track } from '../../services/analytics'
import { Sheet } from '../primitives/Sheet'

// Order / Directions hand-off (MVP_SPEC §4 S5–S6). Prototype states only: nothing opens a real app
// or a real address, and the sheet says so.

const PLATFORMS = ['Deliveroo', 'Uber Eats'] as const

export function OrderSheet({ open, onClose, venueName, offeringName }: { open: boolean; onClose: () => void; venueName: string; offeringName: string }) {
  const [opened, setOpened] = useState<string | null>(null)
  const close = () => {
    setOpened(null)
    onClose()
  }
  return (
    <Sheet open={open} onClose={close} title={copy.handoff.orderTitle(venueName)}>
      <p className="t-body" style={{ margin: '0 0 6px' }}>
        {offeringName}
      </p>
      <p className="t-body muted" style={{ margin: '0 0 16px' }}>
        {copy.handoff.orderBody}
      </p>
      <div className="flex flex-col gap-2.5">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setOpened(p)
              track('handoff_opened', { kind: 'delivery_platform', platform: p })
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="notice" role="status" style={{ marginTop: 16 }}>
        {opened ? copy.handoff.opened(opened, venueName) : copy.handoff.prototype}
      </p>
    </Sheet>
  )
}

export function DirectionsSheet({ open, onClose, venueName, timeLabel, distanceLabel }: { open: boolean; onClose: () => void; venueName: string; timeLabel: string; distanceLabel: string }) {
  const [opened, setOpened] = useState(false)
  const close = () => {
    setOpened(false)
    onClose()
  }
  return (
    <Sheet open={open} onClose={close} title={copy.handoff.directionsTitle(venueName)}>
      <p className="t-body dot-list" style={{ margin: '0 0 16px' }}>
        <span>{distanceLabel}</span>
        <span>{timeLabel}</span>
      </p>
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={() => {
          setOpened(true)
          track('handoff_opened', { kind: 'maps' })
        }}
      >
        {copy.handoff.openMaps}
      </button>
      <p className="notice" role="status" style={{ marginTop: 16 }}>
        {opened ? copy.handoff.mapsOpened : copy.handoff.mapsPrototype}
      </p>
    </Sheet>
  )
}
