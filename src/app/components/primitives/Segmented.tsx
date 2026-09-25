import type { ReactNode } from 'react'

// A single- or multi-select group of toggle buttons (aria-pressed), 44 px targets.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onToggle,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: readonly T[]
  onToggle: (v: T) => void
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value.includes(o.value)} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>
}
