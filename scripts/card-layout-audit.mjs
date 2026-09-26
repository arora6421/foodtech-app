// Deck-card layout audit (Crave). Repeatable.
//   node scripts/card-layout-audit.mjs [--no-build]
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
const PHONES = [
  { name: 'iPhone SE 375×667', width: 375, height: 667 },
  { name: 'Android 360×740', width: 360, height: 740 },
  { name: 'iPhone 14 390×844', width: 390, height: 844 },
  { name: 'iPhone Pro Max 430×932', width: 430, height: 932 },
  { name: 'small 320×568', width: 320, height: 568 },
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
  return { cards: document.querySelectorAll('.gallery-slot').length, tiers: maxTier, failures }
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
    await page.goto(`http://localhost:${PORT}/craving`, { waitUntil: 'load' })
    await page.evaluate(() => sessionStorage.clear())
    await page.goto(`http://localhost:${PORT}/craving`, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('::-p-text(Show me dishes)').click()
    await page.waitForSelector('.swipe-card .dish-card')
    const size = await page.evaluate(() => {
      const r = document.querySelector('.swipe-card:not([inert]) .dish-card').getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })
    // 2. Every dish at that size.
    await page.goto(`http://localhost:${PORT}/?debug=cards&images=review&w=${size.w}&h=${size.h}`, {
      waitUntil: 'load',
    })
    await page.waitForSelector('[data-gallery-ready]')
    await page.evaluate(() => document.fonts.ready)
    const r = await page.evaluate(CHECK)
    failed += r.failures.length
    console.log(
      `${phone.name.padEnd(24)} card ${size.w}×${size.h} · ${r.cards} cards · name sizes ${JSON.stringify(r.tiers)} · ${r.failures.length ? `${r.failures.length} FAIL` : 'all clear'}`,
    )
    for (const f of r.failures.slice(0, 12)) console.log(`    ${f}`)
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
}
process.exitCode = failed ? 1 : 0
