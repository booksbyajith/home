import type { DraftGeo } from './draft';

export type GeoError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** One-shot browser location. No Maps API, no reverse geocoding. */
export function currentLocation(): Promise<DraftGeo> {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) return reject('unsupported' as GeoError);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: Math.round(p.coords.latitude * 1e6) / 1e6,
          lng: Math.round(p.coords.longitude * 1e6) / 1e6,
          accuracyM: Math.round(p.coords.accuracy),
          capturedAt: Date.now(),
        }),
      (e) => reject((e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable') as GeoError),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}
