import { ADVANCE, FALLBACK_ADVANCE } from './nameMetrics'

// The deck card's dish name is huge (Playfair Display Black) and must fit in two lines, without
// clipping. Rather than measure text in the DOM (a forced layout mid-swipe), the size tier is
// chosen by arithmetic from the font's own advance widths (nameMetrics.ts, generated).
//
// Sizes are in container units of the card (cqw), so the same name breaks the same way on every
// phone; the check uses the narrowest card we support (a 320px screen), where the card's inner
// width is the smallest share of its outer width. Verified against every dish in the catalogue in
// a real browser by scripts/card-layout-audit.mjs.

export const NAME_TIERS = [
  { tier: 'xl', cqw: 16.2 }, // the mockup's 58px on a 358px card
  { tier: 'l', cqw: 13.6 },
  { tier: 'm', cqw: 11.4 },
  { tier: 's', cqw: 9.6 },
  { tier: 'xs', cqw: 8.2 },
] as const
export type NameTier = (typeof NAME_TIERS)[number]['tier']

const LETTER_SPACING = -0.026 // em: the mockup's −1.5px at 58px
const INNER_SHARE = 0.86 // card inner width ÷ outer width on a 320px screen (20px padding each side)
const SAFETY = 0.96 // kerning and rounding margin

const advance = (text: string) =>
  [...text].reduce((w, ch) => w + (ADVANCE[ch] ?? FALLBACK_ADVANCE), 0) +
  LETTER_SPACING * Math.max(0, [...text].length - 1)

/** How many lines `name` wraps to at `lineEm` em per line, or Infinity if a word can't fit at all. */
function lines(name: string, lineEm: number): number {
  const space = advance(' ')
  let count = 1
  let used = 0
  for (const word of name.split(/\s+/).filter(Boolean)) {
    const w = advance(word)
    if (w > lineEm) return Infinity
    if (used === 0) used = w
    else if (used + space + w <= lineEm) used += space + w
    else {
      count++
      used = w
    }
  }
  return count
}

/** The largest size tier at which the name fits in two lines (the smallest if none does). */
export function nameTier(name: string): NameTier {
  for (const { tier, cqw } of NAME_TIERS) {
    if (lines(name, ((100 * INNER_SHARE) / cqw) * SAFETY) <= 2) return tier
  }
  return 'xs'
}
