// One outline icon set, drawn inline so there are no icon-font or network requests.
const PATHS = {
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  back: <path d="m15 6-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, filled = false, className = 'icon' }: { name: IconName; filled?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={filled ? { fill: 'currentColor' } : undefined}>
      {PATHS[name]}
    </svg>
  )
}

export function Chilli({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={off ? 'off' : undefined}>
      <path d="M15 3.5c1.2-.2 2.3.6 2.2 1.7 2.5 1 3.8 3.6 3.1 6.5-1 4.5-6.6 8.5-13.3 8.8-1 0-1.4-1.2-.6-1.8 3.6-2.5 5.8-5.7 6.2-9.3.2-1.8 1.3-3.2 2.8-3.9-.3-.7-.6-1.6-.4-2z" />
    </svg>
  )
}
