import { z } from "zod";

import type { AircraftState } from "./types";

const OpenskyResponseSchema = z.object({
  time: z.number(),
  states: z.array(z.array(z.unknown())).nullable(),
});

const asString = (v: unknown): string | null =>
  typeof v === "string" ? v : v == null ? null : String(v);

const asNumber = (v: unknown): number | null =>
  typeof v === "number" && !Number.isNaN(v) ? v : null;

const asBool = (v: unknown): boolean => v === true;

const asNumberArray = (v: unknown): number[] | null => {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const x of v) {
    if (typeof x === "number" && !Number.isNaN(x)) out.push(x);
  }
  return out.length ? out : null;
};

export const parseOpenskyJson = (json: unknown): AircraftState[] => {
  const parsed = OpenskyResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.states) return [];

  const rows = parsed.data.states;
  const out: AircraftState[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 11) continue;

    const icaoRaw = row[0];
    if (typeof icaoRaw !== "string" || icaoRaw.length === 0) continue;

    const lon = asNumber(row[5]);
    const lat = asNumber(row[6]);
    if (lon == null || lat == null) continue;

    out.push({
      icao24: icaoRaw.toLowerCase(),
      callsign: asString(row[1])?.trim() || null,
      origin_country: asString(row[2]),
      time_position: asNumber(row[3]),
      last_contact: asNumber(row[4]) ?? 0,
      longitude: lon,
      latitude: lat,
      baro_altitude: asNumber(row[7]),
      on_ground: asBool(row[8]),
      velocity: asNumber(row[9]),
      true_track: asNumber(row[10]),
      vertical_rate: row.length > 11 ? asNumber(row[11]) : null,
      sensors: row.length > 12 ? asNumberArray(row[12]) : null,
      geo_altitude: row.length > 13 ? asNumber(row[13]) : null,
      squawk: asString(row[14]),
      spi: row.length > 15 ? (row[15] === true ? true : row[15] === false ? false : null) : null,
      position_source: row.length > 16 ? asNumber(row[16]) : null,
    });
  }

  return out;
};
