import type { GeoPoint } from '../domain'

/** Where the user is. Fixed in the MVP; real device location later (MVP_SPEC §20.5). */
export interface LocationProvider {
  getCurrentLocation(): Promise<GeoPoint>
}

/** Angel, Islington (N1): the mock neighbourhood every fictional venue is placed around. */
export const ANGEL_N1: GeoPoint = { lat: 51.5322, lng: -0.1058 }

export class FixedLocationProvider implements LocationProvider {
  constructor(private readonly point: GeoPoint = ANGEL_N1) {}

  getCurrentLocation(): Promise<GeoPoint> {
    return Promise.resolve(this.point)
  }
}
