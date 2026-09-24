import type { GeoPoint } from './types'

const EARTH_RADIUS_MILES = 3958.8

/** Great-circle distance in miles (haversine). */
export function distanceMiles(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Walking at 3 mph ≈ 20 min/mile (MVP_SPEC §13.3). */
export function walkMinutes(miles: number): number {
  return Math.max(1, Math.round(miles * 20))
}

/** Mock delivery estimate: 15 + 6 × miles, rounded to 5 minutes (MVP_SPEC §13.3). */
export function deliveryMinutes(miles: number): number {
  return Math.round((15 + 6 * miles) / 5) * 5
}
