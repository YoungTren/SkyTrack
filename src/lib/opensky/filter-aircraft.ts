import type { AircraftState } from "./types";

/** Same rules as the search dropdown: ≥2 chars; 6 hex = exact ICAO24; else callsign/icao substring. */
export const filterAircraftBySearch = (list: AircraftState[], raw: string): AircraftState[] => {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return list;

  const hex = q.replace(/\s/g, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return list.filter((a) => a.icao24.toLowerCase() === hex.toLowerCase()).slice(0, 24);
  }

  return list
    .filter((a) => {
      const cs = a.callsign?.toLowerCase() ?? "";
      return cs.includes(q) || a.icao24.includes(q);
    })
    .slice(0, 24);
};
