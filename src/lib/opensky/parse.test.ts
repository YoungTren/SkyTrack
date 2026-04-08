import { describe, expect, it } from "vitest";

import { parseOpenskyJson } from "./parse";

describe("parseOpenskyJson", () => {
  it("parses a valid OpenSky-style response", () => {
    const json = {
      time: 1_700_000_000,
      states: [
        [
          "abc9f3",
          "UAL123 ",
          "United States",
          1_700_000_000,
          1_700_000_000,
          -122.37,
          37.62,
          3000,
          false,
          220.5,
          90,
          0,
        ],
      ],
    };
    const out = parseOpenskyJson(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      icao24: "abc9f3",
      callsign: "UAL123",
      longitude: -122.37,
      latitude: 37.62,
      on_ground: false,
    });
  });

  it("returns empty array when states is null", () => {
    expect(parseOpenskyJson({ time: 1, states: null })).toEqual([]);
  });

  it("returns empty array for malformed top-level shape", () => {
    expect(parseOpenskyJson({})).toEqual([]);
    expect(parseOpenskyJson(null)).toEqual([]);
  });

  it("skips rows with missing coords or icao24", () => {
    const json = {
      time: 1,
      states: [
        ["bad", null, null, null, null, null, null],
        ["", "X", "Y", 1, 1, 10, 20, 100, false, 0, 0],
        [123, "N", "Y", 1, 1, 10, 20, 100, false, 0, 0],
        ["cafeca", "OK", "Z", 1, 1, 15, 25, 0, true, 1, 2],
      ],
    };
    const out = parseOpenskyJson(json);
    expect(out).toHaveLength(1);
    expect(out[0].icao24).toBe("cafeca");
  });

  it("skips rows with too few columns", () => {
    const json = { time: 1, states: [["abc123", "X", "Y", 1, 1, 10]] };
    expect(parseOpenskyJson(json)).toEqual([]);
  });
});
