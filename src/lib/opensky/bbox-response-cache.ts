import type { AircraftState } from "./types";

export type CachedStatesPayload = {
  time: number | null;
  aircraft: AircraftState[];
};

const CACHE_TTL_MS = 12_000;
const MAX_KEYS = 28;

const store = new Map<string, { payload: CachedStatesPayload; storedAt: number }>();

const prune = () => {
  while (store.size > MAX_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
};

export const bboxCacheKey = (p: {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}): string =>
  `${p.lamin.toFixed(5)},${p.lomin.toFixed(5)},${p.lamax.toFixed(5)},${p.lomax.toFixed(5)}`;

export const getCachedStates = (key: string): CachedStatesPayload | null => {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() - row.storedAt > CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return row.payload;
};

export const setCachedStates = (key: string, payload: CachedStatesPayload) => {
  store.delete(key);
  store.set(key, { payload, storedAt: Date.now() });
  prune();
};
