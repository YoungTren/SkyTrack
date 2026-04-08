/**
 * Default bbox for requests before the map fires `load` / `getBounds`.
 * Aligned with FlightMap initial view: center [20, 48], zoom 2 (Europe + N Atlantic).
 * OpenSky credits: area > 400 sq° → same tier as a global query (4 credits).
 */
export const DEFAULT_MAP_BBOX = {
  lamin: 22,
  lomin: -55,
  lamax: 74,
  lomax: 95,
} as const;

export type Bbox = {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type LngLatBoundsLike = {
  getWest: () => number;
  getSouth: () => number;
  getEast: () => number;
  getNorth: () => number;
};

/**
 * Visible map bounds with fractional padding (default 12%).
 * If bounds cross the antimeridian (negative lon span), falls back to {@link DEFAULT_MAP_BBOX}.
 */
export const boundsToBboxWithPadding = (
  bounds: LngLatBoundsLike,
  padFraction = 0.12,
): Bbox => {
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();
  const latSpan = north - south;
  let lonSpan = east - west;
  if (lonSpan < 0) lonSpan += 360;
  if (lonSpan <= 0 || lonSpan > 350) {
    return { ...DEFAULT_MAP_BBOX };
  }

  const latPad = latSpan * padFraction;
  const lonPad = lonSpan * padFraction;
  let lamin = clamp(south - latPad, -85, 85);
  let lamax = clamp(north + latPad, -85, 85);
  if (lamin >= lamax) {
    lamin = -85;
    lamax = 85;
  }

  let lomin = west - lonPad;
  let lomax = east + lonPad;
  if (lomax - lomin > 350) {
    return { ...DEFAULT_MAP_BBOX };
  }
  lomin = clamp(lomin, -180, 180);
  lomax = clamp(lomax, -180, 180);
  if (lomin >= lomax) {
    return { ...DEFAULT_MAP_BBOX };
  }

  return { lamin, lomin, lamax, lomax };
};

export const bboxToQueryRecord = (b: Bbox): Record<string, string> => ({
  lamin: String(b.lamin),
  lomin: String(b.lomin),
  lamax: String(b.lamax),
  lomax: String(b.lomax),
});

/**
 * Very large map views produce huge OpenSky queries that often exceed serverless timeouts
 * and return non-JSON errors. Shrink to a max window centered on the requested area.
 */
export const clampBboxForUpstreamFetch = (b: Bbox): Bbox => {
  /** Kept small so OpenSky + OAuth fit under typical ~10s serverless ceilings (e.g. Vercel Hobby). */
  const maxLatSpan = 12;
  const maxLonSpan = 20;
  const latSpan = b.lamax - b.lamin;
  const lonSpan = b.lomax - b.lomin;
  if (latSpan <= maxLatSpan && lonSpan <= maxLonSpan) return b;

  const cLat = (b.lamin + b.lamax) / 2;
  const cLon = (b.lomin + b.lomax) / 2;
  const halfLat = Math.min(latSpan / 2, maxLatSpan / 2);
  const halfLon = Math.min(lonSpan / 2, maxLonSpan / 2);
  let lamin = clamp(cLat - halfLat, -85, 85);
  let lamax = clamp(cLat + halfLat, -85, 85);
  if (lamin >= lamax) {
    lamin = clamp(cLat - 5, -85, 85);
    lamax = clamp(cLat + 5, -85, 85);
  }
  let lomin = clamp(cLon - halfLon, -180, 180);
  let lomax = clamp(cLon + halfLon, -180, 180);
  if (lomin >= lomax) {
    return { ...DEFAULT_MAP_BBOX };
  }
  return { lamin, lomin, lamax, lomax };
};
