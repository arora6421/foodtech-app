// Accessibility audit in a real browser (M1.7). Repeatable.
//   node scripts/a11y-audit.mjs [label]
// Builds production, serves it, and walks every screen and sheet in headless Chrome at three
// viewports: a phone (390×844), the WCAG reflow width (320×568) and a phone at 200% zoom (195×422).
// On each screen:
//   · axe-core (WCAG 2.0/2.1/2.2 A and AA rules, including colour contrast)
//   · reflow: no horizontal scrolling
//   · clipping: text cut off by an overflow-hidden box (ellipsis or hidden overflow)
//   · target size: interactive elements under 24 px (WCAG 2.5.8 AA) and under 44 px (our bar)
//   · keyboard: Tab through everything; each stop must show a focus indicator and not be hidden
// Writes docs/a11y/audit-<label>.json and prints a summary. Exits 1 on any issue (errored step, axe
// violation, reflow, clipping, undersized target, keyboard problem); axe "needs review" items (colour
// contrast over the textured background) appear on every screen and do not count.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer-core'
import { build, preview } from 'vite'
import { issueLines } from './a11y-summary.mjs'

const label = process.argv[2] ?? 'current'
const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 4193
const BASE = `http://localhost:${PORT}`
const VIEWPORTS = [
  { name: 'phone 390×844', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'reflow 320×568', width: 320, height: 568, deviceScaleFactor: 2 },
  { name: '200% zoom 195×422', width: 195, height: 422, deviceScaleFactor: 6 },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Runs in the page: layout checks that axe doesn't cover.
const LAYOUT_CHECKS = () => {
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls =
      typeof el.className === 'string' && el.className
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      s.display !== 'none' &&
      !el.closest('[aria-hidden="true"], [inert]')
    )
  }
  const out = { reflow: null, clipped: [], targets: [] }
  const doc = document.scrollingElement
  if (doc.scrollWidth > innerWidth + 1)
    out.reflow = `page scrolls sideways: ${doc.scrollWidth}px wide in a ${innerWidth}px viewport`
  // The app clips horizontal overflow (so a flung card can't widen the page), which also hides
  // real reflow failures from scrollWidth. So: anything visible that extends past the screen edge.
  // What's actually visible: an element's box cut down by every ancestor that clips its overflow
  // (e.g. the deck card clips the plate that deliberately bleeds off its edge).
  const visibleRect = (el) => {
    let { left, right } = el.getBoundingClientRect()
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(a).overflowX)) {
        const b = a.getBoundingClientRect()
        left = Math.max(left, b.left)
        right = Math.min(right, b.right)
      }
    }
    return { left, right }
  }
  const past = []
  for (const el of document.querySelectorAll('main *, [role="dialog"] *')) {
    if (!visible(el) || el.closest('.swipe-card[inert], .deck-edge, .dish-media')) continue
    const r = visibleRect(el)
    if (r.right <= r.left) continue // clipped away entirely
    if (r.right > innerWidth + 1 || r.left < -1)
      past.push(`${describe(el)} spans ${Math.round(r.left)}–${Math.round(r.right)}px`)
  }
  if (past.length) out.reflow = `${past.length} element(s) past the screen edge, e.g. ${past.slice(0, 3).join('; ')}`
  // Visual checks count everything a sighted user sees, including aria-hidden text (the card's
  // visible rows are aria-hidden because its label covers screen readers, but zoom users read them).
  const seen = (el) => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return (
      r.width > 0 &&
      r.height > 0 &&
      st.visibility !== 'hidden' &&
      st.display !== 'none' &&
      !el.closest('[inert], .sr-only')
    )
  }
  for (const el of document.querySelectorAll('main *, [role="dialog"] *')) {
    if (!seen(el) || el.closest('.dish-media, .stamp, .deck-edge')) continue
    const st = getComputedStyle(el)
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const text = el.textContent.trim()
    if (!text) continue
    const hidesX = /hidden|clip/.test(st.overflowX) || st.webkitLineClamp !== 'none'
    const hidesY = /hidden|clip/.test(st.overflowY) || st.webkitLineClamp !== 'none'
    const scrolls = (v) => v === 'auto' || v === 'scroll' // overflow you can scroll to isn't lost
    // Text that actually extends past the box. Decorative layers (stamps, plates bleeding off a
    // cover or tile) don't count: their overflow is the design, and they carry no text.
    const box = el.getBoundingClientRect()
    const textPast = (axis) =>
      [...el.querySelectorAll('*')].some((d) => {
        if (
          d.closest('.stamp, .dish-media, .card-plate, .issue-plate, .welcome-plate, .sr-only') ||
          !d.textContent.trim()
        )
          return false
        const r = d.getBoundingClientRect()
        if (!(r.width > 0)) return false
        return axis === 'x'
          ? r.right > box.right + 1 || r.left < box.left - 1
          : r.bottom > box.bottom + 1 || r.top < box.top - 1
      })
    const pastX = !scrolls(st.overflowX) && (el.children.length ? textPast('x') : el.scrollWidth > el.clientWidth + 1)
    const overX = hidesX && pastX
    const overY =
      hidesY &&
      !scrolls(st.overflowY) &&
      ((ownText && el.scrollHeight > el.clientHeight + 1) ||
        (el.children.length ? textPast('y') : el.scrollHeight > el.clientHeight + 1))
    if (overX || overY) out.clipped.push(`cut off: ${describe(el)} "${text.slice(0, 40)}"`)
    else if (ownText && !hidesX && pastX && st.display !== 'inline')
      out.clipped.push(`spills out of its box: ${describe(el)} "${text.slice(0, 40)}"`)
  }
  for (const el of document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [tabindex="0"]',
  )) {
    if (!visible(el) || el.disabled) continue
    const r = el.getBoundingClientRect()
    const min = Math.min(r.width, r.height)
    if (min < 44)
      out.targets.push({
        el: `${describe(el)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}"`,
        w: Math.round(r.width),
        h: Math.round(r.height),
        belowAA: min < 24,
      })
  }
  return out
}

async function keyboardWalk(page) {
  const problems = []
  const seen = new Set()
  await page.evaluate(() => {
    document.activeElement?.blur()
    document.querySelectorAll('[data-audit-visited]').forEach((el) => delete el.dataset.auditVisited)
  })
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const f = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      el.scrollIntoView({ block: 'nearest' })
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const ring =
        (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)
      const again = el.dataset.auditVisited === '1'
      el.dataset.auditVisited = '1'
      return { again, name, ring, obscured: !!hit && hit !== el && !el.contains(hit) && !hit.contains(el) }
    })
    if (!f || f.again) break
    seen.add(seen.size)
    if (!f.ring) problems.push(`no visible focus indicator: "${f.name}"`)
    if (f.obscured) problems.push(`focused element covered by another: "${f.name}"`)
  }
  return { stops: seen.size, problems }
}

async function audit(page, screen) {
  await sleep(400)
  await page.addScriptTag({ path: AXE })
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return {
      rules: r.passes.length + r.violations.length + r.incomplete.length,
      incomplete: r.incomplete.map((v) => v.id),
      violations: r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
      })),
    }
  })
  const layout = await page.evaluate(LAYOUT_CHECKS)
  const keyboard = await keyboardWalk(page)
  return { screen, axe: axe.violations, axeRules: axe.rules, axeIncomplete: axe.incomplete, ...layout, keyboard }
}

async function walk(browser, vp) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ ...vp, isMobile: true, hasTouch: true })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]) // settle instantly
  const results = []
  const go = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
  }
  const click = (text) => page.locator(`::-p-text(${text})`).setTimeout(5000).click()
  // Each step is independent: a step that can't run is recorded, and the walk carries on.
  const step = async (name, fn) => {
    try {
      await fn()
    } catch (e) {
      const error = e.message.split(String.fromCharCode(10))[0]
      results.push({
        screen: name,
        axe: [],
        reflow: null,
        clipped: [],
        targets: [],
        keyboard: { stops: 0, problems: [] },
        error,
      })
    }
  }

  await step('Saved › empty', async () => {
    await go('/saved')
    await page.waitForSelector('.empty-state')
    results.push(await audit(page, 'Saved › empty'))
  })
  await step('Welcome', async () => {
    await go('/')
    results.push(await audit(page, 'Welcome'))
  })
  await step('Craving', async () => {
    await click('Just me')
    await page.waitForSelector('::-p-text(Start swiping)')
    results.push(await audit(page, 'Craving'))
  })
  await step('Craving › Diet sheet', async () => {
    await (await page.$('.filter-row')).click()
    await page.waitForSelector('[role="dialog"]')
    results.push(await audit(page, 'Craving › Diet sheet'))
    await page.keyboard.press('Escape')
  })
  await step('Deck', async () => {
    await click('Start swiping')
    await page.waitForSelector('.swipe-card .dish-card')
    results.push(await audit(page, 'Deck'))
  })
  await step('Match', async () => {
    await click('Decide for me')
    await page.waitForSelector('.match-kicker')
    results.push(await audit(page, 'Match'))
  })
  await step('Match › hand-off sheet', async () => {
    await (await page.$('main .btn-cover-primary')).click()
    await page.waitForSelector('[role="dialog"]')
    results.push(await audit(page, 'Match › hand-off sheet'))
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
  })
  await step('Match › Alternative', async () => {
    await (await page.$('.or-try-tile')).click()
    await page.waitForSelector('::-p-text(Choose this instead)')
    results.push(await audit(page, 'Match › Alternative'))
    await click('Return to our match')
    await page.waitForSelector('::-p-text(Show me something else)')
  })
  await step('Saved', async () => {
    await (await page.$('.cover-actions-row button:last-child')).click()
    await go('/saved')
    await page.waitForSelector('.issue-open')
    results.push(await audit(page, 'Saved'))
  })
  await step('Saved › detail', async () => {
    await (await page.$('.issue-open')).click()
    await page.waitForSelector('main h1')
    results.push(await audit(page, 'Saved › detail'))
  })
  await step('Match › pick list', async () => {
    // Nothing landed twice: the closest five, as mini covers.
    const allNo = async () => {
      await page.waitForSelector('.swipe-card .dish-card')
      for (let i = 0; i < 25 && !(await page.$('.match-kicker')); i++) {
        await page.click('button.vote-no').catch(() => {})
        await new Promise((r) => setTimeout(r, 350))
      }
      await page.waitForSelector('::-p-text(Show me something else)')
    }
    await go('/craving')
    await click('Start swiping')
    await allNo()
    await click('Show me something else')
    await allNo()
    await click('Show me something else')
    await page.waitForSelector('.issue-open')
    results.push(await audit(page, 'Match › pick list'))
  })

  // Settings that leave only a few dishes (vegan, up to £10, going out), so the "fewer than 8 dishes"
  // notice and its raise-budget link show. Settings are read from localStorage at load, so reload.
  const tightSettings = async () => {
    await page.evaluate(() =>
      localStorage.setItem('fde.settings.v1', JSON.stringify({ diet: ['vegan'], budget: 'low', fulfilment: 'go_out' })),
    )
    await go('/craving')
    await page.waitForSelector('.notice')
  }
  await step('Craving › tight-pool notice', async () => {
    await tightSettings()
    // If the link ever stops showing for these settings this step fails, so the state can't quietly drop out of the audit.
    await page.waitForSelector('::-p-text(Raise budget)', { timeout: 5000 })
    results.push(await audit(page, 'Craving › tight-pool notice'))
  })
  await step('Craving › Budget sheet', async () => {
    await tightSettings()
    await (await page.$$('.filter-row'))[1].click() // Diet, Budget, Eating
    await page.waitForSelector('[role="dialog"]')
    await page.waitForSelector('::-p-text(priced at or under your limit)', { timeout: 5000 })
    results.push(await audit(page, 'Craving › Budget sheet'))
    await page.keyboard.press('Escape')
  })
  await ctx.close()
  return results
}

await build({ logLevel: 'error', build: { outDir: '.compare/a11y-dist', emptyOutDir: true } })
const server = await preview({
  logLevel: 'error',
  build: { outDir: '.compare/a11y-dist' },
  preview: { port: PORT, strictPort: true },
})
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const report = { label, date: new Date().toISOString(), viewports: [] }
try {
  for (const vp of VIEWPORTS) report.viewports.push({ viewport: vp.name, screens: await walk(browser, vp) })
} finally {
  await browser.close()
  await server.close()
}

let issues = 0
for (const { viewport, screens } of report.viewports) {
  console.log(`\n=== ${viewport}`)
  for (const s of screens) {
    const lines = issueLines(s)
    issues += lines.length
    console.log(
      `${s.screen.padEnd(24)} ${lines.length ? `${lines.length} issue(s)` : 'clean'} · ${s.keyboard.stops} tab stops · ${s.axeRules ?? 0} axe rules${s.axeIncomplete?.length ? ` (needs review: ${s.axeIncomplete.join(', ')})` : ''}`,
    )
    for (const l of lines) console.log(`    ${l}`)
  }
}
console.log(`\n${issues} issue(s) in total`)
mkdirSync('docs/a11y', { recursive: true })
writeFileSync(`docs/a11y/audit-${label}.json`, JSON.stringify(report, null, 2))
console.log(`Wrote docs/a11y/audit-${label}.json`)

// The report is written and the browser and server are closed, so the process ends on its own with
// this code. Only issues count; "needs review" items were never added to them (a11y-summary.mjs).
if (issues > 0) {
  console.error(`A11Y AUDIT FAILED: ${issues} issue(s). Details above and in docs/a11y/audit-${label}.json`)
  process.exitCode = 1
}
