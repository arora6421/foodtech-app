// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DishCard } from '../components/food/DishCard'
import type { DishCardModel } from '../state/viewModels'

// Descenders on the deck card (the g in "Tom yum goong"). The name sits in a fixed two-line box that
// hides overflow, so a glyph is cut off whenever it hangs below its line box. That happens when the
// line height is smaller than the font's ascent + descent. jsdom can't lay text out, so this test
// checks the real constraint instead: the real font files' vertical metrics against the real CSS.

afterEach(cleanup)

const here = resolve(process.cwd(), 'src/app/design')
const css = readFileSync(resolve(here, 'components.css'), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} rule`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('}', start))
}
function fontOf(selector: string) {
  const m = /font:\s*(?:italic\s+)?\d+\s+([\d.]+)px\/([\d.]+)/.exec(block(selector))!
  return { size: Number(m[1]), lineHeight: Number(m[2]) }
}

/** Ascent + descent in em, from the metrics browsers use to size a line (typo when USE_TYPO_METRICS, else hhea). */
function contentArea(file: string) {
  const d = readFileSync(resolve(here, 'fonts', file))
  const tables = new Map<string, number>()
  for (let i = 0; i < d.readUInt16BE(4); i++)
    tables.set(d.toString('latin1', 12 + 16 * i, 16 + 16 * i), d.readUInt32BE(20 + 16 * i))
  const upm = d.readUInt16BE(tables.get('head')! + 18)
  const os2 = tables.get('OS/2')!
  const hhea = tables.get('hhea')!
  const useTypo = (d.readUInt16BE(os2 + 62) & 0x80) !== 0
  const [asc, desc] = useTypo
    ? [d.readInt16BE(os2 + 68), d.readInt16BE(os2 + 70)]
    : [d.readInt16BE(hhea + 4), d.readInt16BE(hhea + 6)]
  return { ascent: asc / upm, descent: -desc / upm }
}

const roman = contentArea('Fraunces.ttf')
const italic = contentArea('Fraunces-Italic.ttf')

describe('deck card title', () => {
  it('a two-line name with descenders keeps its last descender inside the clipped name box', () => {
    const { size, lineHeight } = fontOf('.card-name')
    const line = size * lineHeight
    // Each line box centres the font's content area; its descent ends half the leading above the box bottom.
    const halfLeading = (line - (roman.ascent + roman.descent) * size) / 2
    const lastBaseline = line + halfLeading + roman.ascent * size // line 2 of "Tom Yum Goong / with Ginger"
    const descenderBottom = lastBaseline + roman.descent * size
    expect(descenderBottom).toBeLessThanOrEqual(2 * line + 0.01)
  })

  it('the one-line dish type below it never clips its descenders either', () => {
    const { size, lineHeight } = fontOf('.dish-card .arch')
    expect(lineHeight).toBeGreaterThanOrEqual(italic.ascent + italic.descent)
    expect(size * lineHeight).toBeGreaterThan(0)
  })

  it('the fixed title area holds two name lines and the dish type line, so the card height never changes', () => {
    const name = fontOf('.card-name')
    const arch = fontOf('.dish-card .arch')
    const height = Number(/height:\s*([\d.]+)px/.exec(block('.card-title'))![1])
    expect(height).toBeGreaterThanOrEqual(2 * name.size * name.lineHeight + arch.size * arch.lineHeight)
  })

  it('renders a long two-line name with descenders whole in the clamped name element', () => {
    const model = {
      key: 'x',
      archetypeId: 'tom-yum',
      offeringId: 'x',
      cardNumber: 3,
      offeringName: 'Tom Yum Goong with Glass Noodles',
      archetypeName: 'Tom yum soup',
      showArchetype: true,
      cuisineLabel: 'Thai',
      venueName: 'Lemongrass & Lime',
      priceLabel: '£11.50',
      timeLabel: '12 min walk',
      distanceLabel: '0.6 mi',
      spiceLevel: 3,
      spiceWord: 'Hot',
      tags: ['Brothy', 'Tangy'],
      tint: '#c9783c',
      image: null,
      initial: 'T',
      allergens: [],
      a11yLabel: 'Tom Yum Goong with Glass Noodles. Tom yum soup, Thai.',
    } satisfies DishCardModel
    render(<DishCard model={model} />)
    const name = document.querySelector('.card-title .card-name')!
    expect(name.textContent).toBe('Tom Yum Goong with Glass Noodles')
    expect(name.tagName).toBe('H2')
  })
})
