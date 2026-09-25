// Generates the grain tiles used by the design page (and later the app) as small PNGs.
// Live SVG feTurbulence filters stalled page painting badly, so textures must be pre-rendered tiles.
// Deterministic (seeded) and dependency-free: node docs/design/make-textures.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SIZE = 128

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Greyscale + alpha grain: every pixel is `tone`, with random alpha up to maxAlpha. */
function grain(tone, maxAlpha, seed) {
  const rnd = mulberry32(seed)
  const raw = Buffer.alloc((SIZE * 2 + 1) * SIZE)
  for (let y = 0; y < SIZE; y++) {
    const row = y * (SIZE * 2 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < SIZE; x++) {
      // Two octaves: fine speckle plus a softer mottle, for a paper/print feel.
      const a = (rnd() * 0.75 + rnd() * 0.25) * maxAlpha
      raw[row + 1 + x * 2] = tone
      raw[row + 2 + x * 2] = Math.round(a)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit, grey+alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(new URL('./textures/', import.meta.url), { recursive: true })
writeFileSync(new URL('./textures/grain-paper.png', import.meta.url), grain(70, 40, 1)) // warm-dark specks for light paper (A)
writeFileSync(new URL('./textures/grain-night.png', import.meta.url), grain(245, 22, 2)) // pale specks for the dark ground (B)
console.log('wrote textures/grain-paper.png, textures/grain-night.png')
