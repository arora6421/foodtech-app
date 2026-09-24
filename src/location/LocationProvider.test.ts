import { describe, expect, it } from 'vitest'
import { ANGEL_N1, FixedLocationProvider } from './LocationProvider'

describe('FixedLocationProvider', () => {
  it('returns Angel, N1 by default and any injected point otherwise', async () => {
    expect(await new FixedLocationProvider().getCurrentLocation()).toEqual(ANGEL_N1)
    expect(await new FixedLocationProvider({ lat: 1, lng: 2 }).getCurrentLocation()).toEqual({ lat: 1, lng: 2 })
  })
})
