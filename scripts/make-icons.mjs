// Home-screen icons for Crave, rendered in Chrome with the app's own Playfair Display so the "C"
// matches the masthead. Repeatable:  node scripts/make-icons.mjs
//   public/icon-512.png, public/icon-192.png  (manifest; full-bleed, so they also work as maskable:
//                                              the plate sits inside the 80% safe zone)
//   public/apple-touch-icon.png (180px; iOS rounds the corners itself)
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const font = readFileSync(resolve('src/app/design/fonts/PlayfairDisplay-Italic.woff2')).toString('base64')
// Colours from tokens.css / covers.ts: saffron cover, cream plate, ink.
const html = `<!doctype html><style>
@font-face { font-family: P; src: url(data:font/woff2;base64,${font}) format('woff2'); font-style: italic; font-weight: 900; }
html, body { margin: 0; }
.icon { position: relative; width: 512px; height: 512px; background: #f2b441; }
.plate { position: absolute; left: 86px; top: 86px; width: 340px; height: 340px; box-sizing: border-box;
  border: 12px solid #22150e; border-radius: 50%; background: rgba(255, 246, 232, 0.45);
  display: grid; place-items: center; }
.c { font: italic 900 250px/1 P; color: #22150e; margin: -18px 0 0 -8px; }
</style><div class="icon"><div class="plate"><span class="c">C</span></div></div>`

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const png = await (await page.$('.icon')).screenshot({ type: 'png' })
  await sharp(png).png({ compressionLevel: 9 }).toFile('public/icon-512.png')
  await sharp(png).resize(192).png({ compressionLevel: 9 }).toFile('public/icon-192.png')
  await sharp(png).resize(180).png({ compressionLevel: 9 }).toFile('public/apple-touch-icon.png')
} finally {
  await browser.close()
}
console.log('wrote public/icon-512.png, icon-192.png, apple-touch-icon.png')
