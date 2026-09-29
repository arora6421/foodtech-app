// Deck-card layout audit (Crave). Repeatable.
//   node scripts/card-layout-audit.mjs [--no-build] [--plate large]
// For each phone size: measures the real deck's card size, then renders every dish in the catalogue
// as a card of exactly that size (the ?debug=cards gallery, review build) and checks, in a real browser
// with the real fonts:
//   · the dish name takes at most two lines
//   · no line of text touches the plate (the plate's circle) or the price sticker (its circle)
//   · no text spills outside the card
// Text is measured line by line (Range.getClientRects), so a short line next to the plate counts only
// its own width. Exits non-zero if any card fails.
import puppeteer from 'puppeteer-core'
import { build, preview } from 'vite'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 4199
const PLATE = process.argv.includes('--plate') ? process.argv[process.argv.indexOf('--plate') + 1] : ''
const plateParam = PLATE ? `&plate=${PLATE}` : ''
const PHONES = [
  { name: 'iPhone SE 375×667', width: 375, height: 667 },
  { name: 'Android 360×740', width: 360, height: 740 },
  { name: 'iPhone 14 390×844', width: 390, height: 844 },
  { name: 'iPhone Pro Max 430×932', width: 430, height: 932 },
  { name: 'small 320×568', width: 320, height: 568 },
  // What a phone browser actually leaves for the page, with its address bar and toolbars showing.
  { name: 'iPhone 14 Safari 390×664', width: 390, height: 664 },
  { name: 'iPhone SE Safari 375×548', width: 375, height: 548 },
  { name: 'Android Chrome 360×660', width: 360, height: 660 },
  // Opened from the home screen (no toolbars): 844 less the status bar (47) and home indicator (34).
  { name: 'iPhone 14 home screen 390×763', width: 390, height: 763 },
]

if (!process.argv.includes('--no-build')) {
  await build({ mode: 'review', logLevel: 'error', build: { outDir: '.compare/layout-dist', emptyOutDir: true } })
}
const server = await preview({
  logLevel: 'error',
  build: { outDir: '.compare/layout-dist' },
  preview: { port: PORT, strictPort: true },
})
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

// Runs in the page, over every card in the gallery.
const CHECK = () => {
  const circle = (el, fill) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: (Math.min(r.width, r.height) / 2) * fill }
  }
  const hits = (c, rect, pad = 1) => {
    const nx = Math.max(rect.left, Math.min(c.x, rect.right))
    const ny = Math.max(rect.top, Math.min(c.y, rect.bottom))
    return Math.hypot(c.x - nx, c.y - ny) < c.r - pad
  }
  const lineRects = (root) => {
    const out = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue
      const host = n.parentElement
      if (host.closest('.price-sticker, .card-plate, .stamp, .sr-only, .allergen-panel')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of range.getClientRects())
        if (r.width > 0.5) out.push({ rect: r, text: n.textContent.trim().slice(0, 24) })
    }
    return out
  }
  const failures = []
  let maxTier = {}
  for (const slot of document.querySelectorAll('.gallery-slot')) {
    const card = slot.querySelector('.dish-card')
    const dish = slot.dataset.dish
    const name = card.querySelector('.card-name')
    const tier = name.className.match(/name-(\w+)/)?.[1] ?? 'xl'
    maxTier[tier] = (maxTier[tier] ?? 0) + 1
    const lh = parseFloat(getComputedStyle(name).lineHeight)
    const lines = Math.round(name.getBoundingClientRect().height / lh)
    if (lines > 2) failures.push(`${dish}: name takes ${lines} lines`)
    const plate = circle(card.querySelector('.card-plate'), 0.97)
    const stickerEl = card.querySelector('.price-sticker')
    const sticker = circle(stickerEl, 1)
    const cardBox = card.getBoundingClientRect()
    for (const { rect, text } of lineRects(card)) {
      if (hits(plate, rect)) failures.push(`${dish}: plate covers "${text}"`)
      if (hits(sticker, rect)) failures.push(`${dish}: price sticker covers "${text}"`)
      if (rect.bottom > cardBox.bottom + 1 || rect.right > cardBox.right + 1)
        failures.push(`${dish}: "${text}" spills out of the card`)
    }
  }
  // One layout per phone: the plate is the same size and in the same place on every card.
  const plates = [...document.querySelectorAll('.gallery-slot')].map((slot) => {
    const c = slot.querySelector('.dish-card').getBoundingClientRect()
    const p = slot.querySelector('.card-plate').getBoundingClientRect()
    return { dish: slot.dataset.dish, w: p.width, x: p.left - c.left, y: p.top - c.top }
  })
  for (const p of plates.slice(1))
    for (const k of ['w', 'x', 'y'])
      if (Math.abs(p[k] - plates[0][k]) > 1)
        failures.push(
          `${p.dish}: plate ${k} ${Math.round(p[k])}px, not ${Math.round(plates[0][k])}px as on the other cards`,
        )
  const plateBox = document.querySelector('.gallery-slot .card-plate')?.getBoundingClientRect()
  return {
    cards: document.querySelectorAll('.gallery-slot').length,
    tiers: maxTier,
    failures,
    plate: Math.round(plateBox?.width ?? 0),
  }
}

let failed = 0
try {
  for (const phone of PHONES) {
    const page = await browser.newPage()
    await page.setViewport({
      width: phone.width,
      height: phone.height,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    // 1. The real deck: how big is a card on this phone?
    await page.goto(`http://localhost:${PORT}/craving?x=1${plateParam}`, { waitUntil: 'load' })
    await page.evaluate(() => sessionStorage.clear())
    await page.goto(`http://localhost:${PORT}/craving?x=1${plateParam}`, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('::-p-text(Start swiping)').click()
    await page.waitForSelector('.swipe-card .dish-card')
    const size = await page.evaluate(() => {
      const r = document.querySelector('.swipe-card:not([inert]) .dish-card').getBoundingClientRect()
      // The deck must fit the screen: Nope/Yes and the links stay in view without scrolling.
      const scroll = document.documentElement.scrollHeight - innerHeight
      return { w: Math.round(r.width), h: Math.round(r.height), scroll }
    })
    const deckFailures =
      size.scroll > 1 ? [`deck page scrolls ${size.scroll}px: the buttons are pushed off screen`] : []
    // 2. Every dish at that size.
    await page.goto(`http://localhost:${PORT}/?debug=cards&images=review&w=${size.w}&h=${size.h}${plateParam}`, {
      waitUntil: 'load',
    })
    await page.waitForSelector('[data-gallery-ready]')
    await page.evaluate(() => document.fonts.ready)
    const r = await page.evaluate(CHECK)
    r.failures.unshift(...deckFailures)
    failed += r.failures.length
    console.log(
      `${phone.name.padEnd(26)} card ${size.w}×${size.h} · plate ${r.plate}px · ${r.cards} cards · name sizes ${JSON.stringify(r.tiers)} · ${r.failures.length ? `${r.failures.length} FAIL` : 'all clear'}`,
    )
    for (const f of r.failures.slice(0, 12)) console.log(`    ${f}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
process.exitCode = failed ? 1 : 0
