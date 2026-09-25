import { useEffect } from 'react'

// Warm the browser cache for images the user is about to see (the card after YES and the card
// after NOPE), in idle time, off the page: nothing is rendered, so the stack edge stays plain and
// nothing about the next card is revealed. Each URL is fetched at most once per page load.

const requested = new Set<string>()

const whenIdle = (fn: () => void) => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (ric) ric(fn)
  else setTimeout(fn, 60)
}

export function prefetchImage(src: string) {
  if (requested.has(src) || typeof Image === 'undefined') return
  requested.add(src)
  const img = new Image()
  img.decoding = 'async'
  img.src = src
}

/** `key` changes when the set of upcoming images may have changed (e.g. a new top card). */
export function useImagePrefetch(key: string | null, urls: () => string[]) {
  useEffect(() => {
    if (!key) return
    let cancelled = false
    whenIdle(() => {
      if (!cancelled) urls().forEach(prefetchImage)
    })
    return () => {
      cancelled = true
    }
    // `urls` is read lazily at idle time; only `key` decides when to look again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/** Test seam: forget what has been requested. */
export function resetImagePrefetch() {
  requested.clear()
}
