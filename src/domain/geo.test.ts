import { describe, expect, it } from 'vitest'
import { deliveryMinutes, distanceMiles, walkMinutes } from './geo'

const ANGEL = { lat: 51.5322, lng: -0.1058 }
const KINGS_CROSS = { lat: 51.5308, lng: -0.1238 }
const LONDON_BRIDGE = { lat: 51.5055, lng: -0.0865 }

describe('distanceMiles', () => {
  it('is zero for the same point', () => {
    expect(distanceMiles(ANGEL, ANGEL)).toBe(0)
  })
  it('matches known London distances', () => {
    expect(distanceMiles(ANGEL, KINGS_CROSS)).toBeCloseTo(0.78, 1)
    expect(distanceMiles(ANGEL, LONDON_BRIDGE)).toBeGreaterThan(1.9)
    expect(distanceMiles(ANGEL, LONDON_BRIDGE)).toBeLessThan(2.1)
  })
  it('is symmetric', () => {
    expect(distanceMiles(ANGEL, LONDON_BRIDGE)).toBeCloseTo(distanceMiles(LONDON_BRIDGE, ANGEL), 10)
  })
})

describe('time estimates', () => {
  it('walks at 20 min/mile, minimum 1', () => {
    expect(walkMinutes(0.5)).toBe(10)
    expect(walkMinutes(0.01)).toBe(1)
  })
  it('rounds delivery to 5 minutes', () => {
    expect(deliveryMinutes(1)).toBe(20)
    expect(deliveryMinutes(2.5)).toBe(30)
  })
})
