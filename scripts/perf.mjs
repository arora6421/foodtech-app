// Throttled performance run (M1.7). Repeatable: same build, same device profile, same script.
//   node scripts/perf.mjs [label] [--runs 3] [--cpu 4]
// Builds production into .compare/perf-dist, serves it locally, then drives the installed Chrome
// (headless, via puppeteer-core) through a real session on a phone profile:
//   390×844 @3x touch viewport · CPU slowed ×4 (Lighthouse mobile) · slow-4G network
//   (150 ms RTT, 1.6 Mbps down) for the load metrics.
// Records: load (FCP, LCP, fonts ready, bytes), time to first swipeable card, swipe input latency
// (Event Timing), frames during scripted drags and fling, and the Match reveal.
// Writes docs/perf/perf-<label>.json and prints medians across runs.
import { mkdirSync, writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { build, preview } from 'vite'

const args = process.argv.slice(2)
const opt = (name, d) => (args.includes(`--${name}`) ? Number(args[args.indexOf(`--${name}`) + 1]) : d)
const label = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'current'
const RUNS = opt('runs', 3)
const CPU = opt('cpu', 4)
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 4190

await build({ logLevel: 'error', build: { outDir: '.compare/perf-dist', emptyOutDir: true } })
const server = await preview({
  logLevel: 'error',
  build: { outDir: '.compare/perf-dist' },
  preview: { port: PORT, strictPort: true },
})
const BASE = `http://localhost:${PORT}`

// Installed in every page before any app code runs.
const INSTRUMENT = () => {
  const w = window
  w.__perf = { lcp: 0, fcp: 0, longTasks: [], events: [], frames: null }
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__perf.lcp = e.startTime))).observe({
    type: 'largest-contentful-paint',
    buffered: true,
  })
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => e.name === 'first-contentful-paint' && (w.__perf.fcp = e.startTime)),
  ).observe({ type: 'paint', buffered: true })
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => w.__perf.longTasks.push({ start: e.startTime, dur: e.duration })),
  ).observe({ type: 'longtask', buffered: true })
  new PerformanceObserver((l) =>
    l
      .getEntries()
      .forEach((e) => e.interactionId && w.__perf.events.push({ name: e.name, start: e.startTime, dur: e.duration })),
  ).observe({ type: 'event', durationThreshold: 16, buffered: true })
  w.__frames = {
    start() {
      const times = []
      let on = true
      const tick = (t) => {
        times.push(t)
        if (on) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      w.__frames.stop = () => {
        on = false
        return times
      }
    },
  }
}

const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null
}
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : null
}
const frameStats = (times) => {
  const gaps = times.slice(1).map((t, i) => t - times[i])
  return {
    frames: times.length,
    p95: pct(gaps, 95),
    max: Math.max(0, ...gaps),
    janky: gaps.filter((g) => g > 25).length,
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run(browser) {
  const ctx = await browser.createBrowserContext() // cold cache per run
  const page = await ctx.newPage()
  await page.emulate({
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
  })
  const cdp = await page.createCDPSession()
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  await page.evaluateOnNewDocument(INSTRUMENT)
  await page.evaluateOnNewDocument(() => sessionStorage.clear())

  const out = {}
  await page.goto(`${BASE}/`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  out.fontsReady = await page.evaluate(() => performance.now())
  await sleep(500)
  Object.assign(
    out,
    await page.evaluate(() => {
      const res = performance.getEntriesByType('resource')
      const bytes = (re) => res.filter((r) => re.test(r.name)).reduce((a, r) => a + r.transferSize, 0)
      const nav = performance.getEntriesByType('navigation')[0]
      return {
        fcp: window.__perf.fcp,
        lcp: window.__perf.lcp,
        loadBytes: {
          js: bytes(/\.js/),
          css: bytes(/\.css/),
          fonts: bytes(/\.(ttf|woff2?)/),
          images: bytes(/\.(png|jpe?g|webp|avif|svg)/),
          html: nav.transferSize,
        },
      }
    }),
  )
  // Load is done; the rest measures interaction, where the network doesn't matter.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })

  await page.locator('::-p-text(Just me)').click()
  await page.waitForSelector('::-p-text(Start swiping)')
  const t0 = await page.evaluate(() => performance.now())
  await page.locator('::-p-text(Start swiping)').click()
  await page.waitForSelector('.swipe-card .dish-card')
  out.firstCard = (await page.evaluate(() => performance.now())) - t0

  // Button swipes: input latency via Event Timing.
  await page.evaluate(() => (window.__perf.events.length = 0))
  for (let i = 0; i < 4; i++) {
    await sleep(700)
    await page.click(i % 2 ? 'button.vote-no' : 'button.vote-yes')
  }
  await sleep(600)
  out.swipeInput = await page.evaluate(() =>
    window.__perf.events.filter((e) => e.name === 'pointerup' || e.name === 'click').map((e) => e.dur),
  )

  // Scripted drags with release: frames from pointer down to the end of the fling.
  out.drag = []
  for (let i = 0; i < 3; i++) {
    await sleep(700)
    const box = await (await page.$('.swipe-card:not([inert])')).boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height * 0.45
    await page.evaluate(() => window.__frames.start())
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let s = 1; s <= 16; s++) {
      await page.mouse.move(x + (i % 2 ? -1 : 1) * s * 14, y + s, { steps: 1 })
      await sleep(16)
    }
    await page.mouse.up()
    await sleep(900)
    out.drag.push(frameStats(await page.evaluate(() => window.__frames.stop())))
  }

  // The Match reveal: long tasks and frames for 1.2 s after "Decide for me".
  await sleep(700)
  const lt0 = await page.evaluate(() => {
    window.__frames.start()
    return performance.now()
  })
  await page.locator('::-p-text(Decide for me)').click()
  await page.waitForSelector('.match-kicker')
  await sleep(1200)
  const reveal = await page.evaluate(
    (since) => ({ frames: window.__frames.stop(), long: window.__perf.longTasks.filter((t) => t.start >= since) }),
    lt0,
  )
  out.reveal = {
    ...frameStats(reveal.frames),
    longTaskMs: reveal.long.reduce((a, t) => a + t.dur, 0),
    longTasks: reveal.long.length,
  }

  await ctx.close()
  return out
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
})
const runs = []
try {
  for (let r = 0; r < RUNS; r++) {
    runs.push(await run(browser))
    process.stdout.write(`run ${r + 1}/${RUNS} done\n`)
  }
} finally {
  await browser.close()
  await server.close()
}

const m = (f) => median(runs.map(f))
const flat = (f) => runs.flatMap(f)
const summary = {
  label,
  date: new Date().toISOString(),
  profile: {
    viewport: '390x844@3x touch',
    cpu: `${CPU}x`,
    network: 'slow 4G (150 ms, 1.6 Mbps) for load only',
    runs: RUNS,
  },
  load: {
    fcpMs: m((r) => r.fcp),
    lcpMs: m((r) => r.lcp),
    fontsReadyMs: m((r) => r.fontsReady),
    bytes: Object.fromEntries(Object.keys(runs[0].loadBytes).map((k) => [k, m((r) => r.loadBytes[k])])),
  },
  firstCardMs: m((r) => r.firstCard),
  swipeInputMs: {
    p50: median(flat((r) => r.swipeInput)),
    p95: pct(
      flat((r) => r.swipeInput),
      95,
    ),
    max: Math.max(0, ...flat((r) => r.swipeInput)),
  },
  drag: {
    jankyFramesPerDrag: median(flat((r) => r.drag.map((d) => d.janky))),
    p95FrameMs: median(flat((r) => r.drag.map((d) => d.p95))),
    worstFrameMs: Math.max(...flat((r) => r.drag.map((d) => d.max))),
  },
  reveal: {
    longTaskMs: m((r) => r.reveal.longTaskMs),
    jankyFrames: m((r) => r.reveal.janky),
    worstFrameMs: Math.max(...runs.map((r) => r.reveal.max)),
  },
  runs,
}

const r1 = (n) => (n == null ? '—' : Math.round(n))
const kb = (n) => (n / 1024).toFixed(1)
console.log(`\nPerf "${label}" · ${summary.profile.viewport} · CPU ${summary.profile.cpu} · median of ${RUNS}`)
console.log(
  `Load (slow 4G): FCP ${r1(summary.load.fcpMs)} ms · LCP ${r1(summary.load.lcpMs)} ms · fonts ready ${r1(summary.load.fontsReadyMs)} ms`,
)
console.log(
  `  transferred: ${Object.entries(summary.load.bytes)
    .map(([k, v]) => `${k} ${kb(v)} KB`)
    .join(' · ')}`,
)
console.log(`Tap "Start swiping" → first card: ${r1(summary.firstCardMs)} ms`)
console.log(
  `Swipe button input latency: p50 ${r1(summary.swipeInputMs.p50)} ms · p95 ${r1(summary.swipeInputMs.p95)} ms · max ${r1(summary.swipeInputMs.max)} ms`,
)
console.log(
  `Drag + fling: janky frames (>25 ms) per drag ${r1(summary.drag.jankyFramesPerDrag)} · p95 frame ${r1(summary.drag.p95FrameMs)} ms · worst ${r1(summary.drag.worstFrameMs)} ms`,
)
console.log(
  `Match reveal: long tasks ${r1(summary.reveal.longTaskMs)} ms · janky frames ${r1(summary.reveal.jankyFrames)} · worst frame ${r1(summary.reveal.worstFrameMs)} ms`,
)
mkdirSync('docs/perf', { recursive: true })
writeFileSync(`docs/perf/perf-${label}.json`, JSON.stringify(summary, null, 2))
console.log(`\nWrote docs/perf/perf-${label}.json`)
