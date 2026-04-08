"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DataDisclaimer } from "@/components/skytrack/data-disclaimer";
import { FlightDetailPanel } from "@/components/skytrack/flight-detail-card";
import { FlightSearchBar } from "@/components/skytrack/flight-search-bar";
import { MapControls } from "@/components/skytrack/map-controls";
import {
  boundsToBboxWithPadding,
  bboxToQueryRecord,
  DEFAULT_MAP_BBOX,
  type Bbox,
} from "@/lib/opensky/bbox";
import { filterAircraftBySearch } from "@/lib/opensky/filter-aircraft";
import type { AircraftState } from "@/lib/opensky/types";

const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";
/** Aligned with OpenSky ~10s anonymous guidance; server also caches identical bbox ~12s. */
const POLL_MS = 12_000;
const FETCH_TIMEOUT_MS = 35_000;
const BBOX_DEBOUNCE_MS = 400;
const SOURCE_ID = "skytrack-aircraft";
const LAYER_SYMBOL = "skytrack-aircraft-symbol";
const LAYER_HALO = "skytrack-aircraft-halo";
const NO_MATCH_ICAO = "________";

const aircraftToGeoJson = (list: AircraftState[]) => ({
  type: "FeatureCollection" as const,
  features: list.map((a) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [a.longitude!, a.latitude!],
    },
    properties: {
      icao24: a.icao24,
      bearing: a.true_track ?? 0,
      callsign: a.callsign ?? "",
      alt: a.baro_altitude ?? a.geo_altitude ?? "",
      spd: a.velocity ?? "",
    },
  })),
});

const addPlaneImage = (map: maplibregl.Map) => {
  if (map.hasImage("plane-icon")) return;
  const w = 64;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = w;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, w);
  ctx.translate(w / 2, w / 2);
  ctx.fillStyle = "#0369a1";
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(22, 24);
  ctx.lineTo(0, 12);
  ctx.lineTo(-22, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const data = ctx.getImageData(0, 0, w, w);
  map.addImage("plane-icon", data, { pixelRatio: 2 });
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
};

const mapAnimDuration = (reduced: boolean, ms: number) => (reduced ? 0 : ms);

const mapFlyTo = (
  map: maplibregl.Map,
  opts: { center: [number, number]; zoom?: number; duration: number },
) => {
  if (opts.duration <= 0) {
    map.jumpTo({ center: opts.center, zoom: opts.zoom ?? map.getZoom() });
    return;
  }
  map.flyTo({
    center: opts.center,
    zoom: opts.zoom,
    duration: opts.duration,
    essential: true,
  });
};

const mapEaseTo = (
  map: maplibregl.Map,
  opts: { center: [number, number]; duration: number },
) => {
  if (opts.duration <= 0) {
    map.jumpTo({ center: opts.center });
    return;
  }
  map.easeTo({ ...opts, essential: true });
};

export const FlightMap = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const selectedIcaoRef = useRef<string | null>(null);
  const followRef = useRef(false);
  const bboxRef = useRef<Bbox>({ ...DEFAULT_MAP_BBOX });
  const backoffUntilRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  /** Same `/api/opensky/states?...` already fetching — skip to avoid cancel spam. */
  const inFlightStatesUrlRef = useRef<string | null>(null);
  /** Bumps when a newer fetch supersedes or on unmount — ignore stale AbortError. */
  const fetchGenerationRef = useRef(0);
  const debounceTimerRef = useRef<number>(0);
  const hadAnyResponseRef = useRef(false);
  /** URL-driven selection applied for current data; reset when the aircraft drops out of the snapshot. */
  const deepLinkConsumedRef = useRef(false);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [rateLimitEndMs, setRateLimitEndMs] = useState<number | null>(null);
  const [rateTick, setRateTick] = useState(0);
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const aircraftOnMap = useMemo(
    () => filterAircraftBySearch(aircraft, searchQuery),
    [aircraft, searchQuery],
  );
  const aircraftOnMapRef = useRef<AircraftState[]>([]);
  aircraftOnMapRef.current = aircraftOnMap;

  selectedIcaoRef.current = selectedIcao;
  followRef.current = follow;

  const icao24FromUrl = useMemo(() => {
    const raw = searchParams.get("icao24")?.trim().toLowerCase() ?? "";
    return /^[0-9a-f]{6}$/.test(raw) ? raw : null;
  }, [searchParams]);

  const selectedAircraft = useMemo(
    () => aircraft.find((a) => a.icao24 === selectedIcao) ?? null,
    [aircraft, selectedIcao],
  );

  const rateLimitRemainingSec =
    rateLimitEndMs != null ? Math.max(0, Math.ceil((rateLimitEndMs - Date.now()) / 1000)) : 0;

  const syncIcao24ToUrl = useCallback(
    (icao: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (icao) params.set("icao24", icao);
      else params.delete("icao24");
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const syncIcao24ToUrlRef = useRef(syncIcao24ToUrl);
  syncIcao24ToUrlRef.current = syncIcao24ToUrl;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (rateLimitEndMs == null) return;
    const id = window.setInterval(() => setRateTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [rateLimitEndMs]);

  const fetchStatesRef = useRef<() => Promise<void>>(async () => {});

  fetchStatesRef.current = async () => {
    if (Date.now() < backoffUntilRef.current) return;

    const params = new URLSearchParams(bboxToQueryRecord(bboxRef.current));
    const url = `/api/opensky/states?${params.toString()}`;

    if (inFlightStatesUrlRef.current === url) {
      return;
    }

    abortRef.current?.abort();
    const myGen = ++fetchGenerationRef.current;
    const ac = new AbortController();
    abortRef.current = ac;
    inFlightStatesUrlRef.current = url;

    const timeoutId = window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

    const firstLoad = !hadAnyResponseRef.current;
    if (firstLoad) setInitialDataLoading(true);

    try {
      const res = await fetch(url, { signal: ac.signal });
      const data: unknown = await res.json();

      if (!res.ok) {
        hadAnyResponseRef.current = true;
        if (res.status === 429) {
          const body =
            typeof data === "object" && data !== null && "retryAfterSeconds" in data
              ? (data as { retryAfterSeconds: unknown }).retryAfterSeconds
              : null;
          const parsed = typeof body === "number" ? body : Number(body);
          const waitSec = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60;
          const until = Date.now() + waitSec * 1000;
          backoffUntilRef.current = until;
          setRateLimitEndMs(until);
          setApiError(null);
          setAircraft([]);
          return;
        }
        backoffUntilRef.current = 0;
        setRateLimitEndMs(null);
        setApiError("Flight data is temporarily unavailable.");
        setAircraft([]);
        return;
      }

      backoffUntilRef.current = 0;
      setRateLimitEndMs(null);
      setApiError(null);
      hadAnyResponseRef.current = true;
      setHasLoadedSnapshot(true);

      const acList =
        typeof data === "object" && data !== null && "aircraft" in data
          ? (data as { aircraft: AircraftState[] }).aircraft
          : [];
      const list = Array.isArray(acList) ? acList : [];
      setAircraft(list);

      const sel = selectedIcaoRef.current;
      const fol = followRef.current;
      const map = mapRef.current;
      if (fol && sel && map?.isStyleLoaded()) {
        const plane = list.find((a: AircraftState) => a.icao24 === sel);
        if (plane?.longitude != null && plane.latitude != null) {
          mapEaseTo(map, {
            center: [plane.longitude, plane.latitude],
            duration: mapAnimDuration(reducedMotionRef.current, 1200),
          });
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (fetchGenerationRef.current !== myGen) return;
        hadAnyResponseRef.current = true;
        setApiError(
          "Request timed out or was interrupted. OpenSky may be slow or overloaded — try again in a moment.",
        );
        setAircraft([]);
        return;
      }
      hadAnyResponseRef.current = true;
      setApiError("Network error while loading flight data.");
      setAircraft([]);
    } finally {
      window.clearTimeout(timeoutId);
      if (inFlightStatesUrlRef.current === url) {
        inFlightStatesUrlRef.current = null;
      }
      setInitialDataLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatesRef.current();
    const id = window.setInterval(() => {
      void fetchStatesRef.current();
    }, POLL_MS);
    return () => {
      window.clearInterval(id);
      fetchGenerationRef.current += 1;
      abortRef.current?.abort();
      inFlightStatesUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rateLimitEndMs == null || rateLimitRemainingSec > 0) return;
    setRateLimitEndMs(null);
    backoffUntilRef.current = 0;
    void fetchStatesRef.current();
  }, [rateLimitEndMs, rateLimitRemainingSec, rateTick]);

  useEffect(() => {
    deepLinkConsumedRef.current = false;
  }, [icao24FromUrl]);

  useEffect(() => {
    if (!icao24FromUrl) return;
    const found = aircraft.find((a) => a.icao24 === icao24FromUrl);
    if (!found) {
      deepLinkConsumedRef.current = false;
      return;
    }
    if (selectedIcao === icao24FromUrl) {
      deepLinkConsumedRef.current = true;
      return;
    }
    if (deepLinkConsumedRef.current) return;
    deepLinkConsumedRef.current = true;
    setSelectedIcao(icao24FromUrl);
    setFollow(false);
    const map = mapRef.current;
    if (map?.isStyleLoaded() && found.longitude != null && found.latitude != null) {
      mapFlyTo(map, {
        center: [found.longitude, found.latitude],
        zoom: Math.max(map.getZoom(), 8),
        duration: mapAnimDuration(reducedMotionRef.current, 1800),
      });
    }
  }, [aircraft, icao24FromUrl, selectedIcao]);

  const showDeepLinkMiss =
    icao24FromUrl != null &&
    hasLoadedSnapshot &&
    rateLimitEndMs == null &&
    apiError == null &&
    !aircraft.some((a) => a.icao24 === icao24FromUrl);

  const searchFiltersMap = searchQuery.trim().length >= 2;
  const showSearchHidesAll =
    searchFiltersMap &&
    aircraftOnMap.length === 0 &&
    aircraft.length > 0 &&
    !initialDataLoading &&
    rateLimitEndMs == null &&
    apiError == null;

  const showEmptyBbox =
    hasLoadedSnapshot &&
    aircraft.length === 0 &&
    !initialDataLoading &&
    rateLimitEndMs == null &&
    apiError == null;

  useEffect(() => {
    if (!selectedIcao) return;
    const exists = aircraft.some((a) => a.icao24 === selectedIcao);
    if (!exists) setSelectedIcao(null);
  }, [aircraft, selectedIcao]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE,
      center: [20, 48],
      zoom: 2,
    });

    mapRef.current = map;

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: "skytrack-popup",
    });
    popupRef.current = popup;

    const scheduleBboxFetch = () => {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = window.setTimeout(() => {
        if (!map.isStyleLoaded()) return;
        bboxRef.current = boundsToBboxWithPadding(map.getBounds());
        void fetchStatesRef.current();
      }, BBOX_DEBOUNCE_MS);
    };

    map.on("load", () => {
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* style may not support globe */
      }

      addPlaneImage(map);

      bboxRef.current = boundsToBboxWithPadding(map.getBounds());

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: aircraftToGeoJson([]),
      });

      map.addLayer({
        id: LAYER_HALO,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "icao24"], NO_MATCH_ICAO],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 10, 10, 24],
          "circle-color": "#fbbf24",
          "circle-opacity": 0.35,
          "circle-blur": 0.35,
        },
      });

      map.addLayer({
        id: LAYER_SYMBOL,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": "plane-icon",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 8, 1],
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });

      (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(
        aircraftToGeoJson(aircraftOnMapRef.current),
      );

      map.on("mouseenter", LAYER_SYMBOL, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_SYMBOL, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("mousemove", LAYER_SYMBOL, (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const cs = String(f.properties?.callsign ?? "").trim() || "—";
        const alt = f.properties?.alt;
        const spd = f.properties?.spd;
        const lines = [
          `<div style="font-weight:600;font-size:13px">${cs}</div>`,
          `<div style="font-size:11px;opacity:.85;margin-top:4px">`,
          alt !== "" && alt != null ? `Alt: ${alt} m<br/>` : "",
          spd !== "" && spd != null ? `Speed: ${spd} m/s` : "",
          `</div>`,
        ]
          .filter(Boolean)
          .join("");
        popup.setLngLat(e.lngLat).setHTML(lines).addTo(map);
      });

      map.on("click", LAYER_SYMBOL, (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const icao = f.properties?.icao24;
        if (typeof icao !== "string") return;
        setSelectedIcao(icao);
        syncIcao24ToUrlRef.current(icao);
        setFollow(false);
        const coords = f.geometry.coordinates as [number, number];
        mapFlyTo(map, {
          center: coords,
          zoom: Math.max(map.getZoom(), 8),
          duration: mapAnimDuration(reducedMotionRef.current, 1800),
        });
      });

      map.on("moveend", scheduleBboxFetch);
      void fetchStatesRef.current();
    });

    return () => {
      window.clearTimeout(debounceTimerRef.current);
      popup.remove();
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const sync = () => {
      try {
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        if (!src || !map.isStyleLoaded()) return;
        src.setData(aircraftToGeoJson(aircraftOnMap));
      } catch {
        /* style/source not ready */
      }
    };
    sync();
    map.on("idle", sync);
    return () => {
      map.off("idle", sync);
    };
  }, [aircraftOnMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const filter: maplibregl.FilterSpecification =
      selectedIcao == null
        ? ["==", ["get", "icao24"], NO_MATCH_ICAO]
        : ["==", ["get", "icao24"], selectedIcao];
    if (map.getLayer(LAYER_HALO)) map.setFilter(LAYER_HALO, filter);
  }, [selectedIcao]);

  const focusAircraft = useCallback((a: AircraftState) => {
    setSelectedIcao(a.icao24);
    syncIcao24ToUrlRef.current(a.icao24);
    setFollow(false);
    const map = mapRef.current;
    if (map?.isStyleLoaded() && a.longitude != null && a.latitude != null) {
      mapFlyTo(map, {
        center: [a.longitude, a.latitude],
        zoom: Math.max(map.getZoom(), 8),
        duration: mapAnimDuration(reducedMotionRef.current, 1800),
      });
    }
  }, []);

  const onZoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: mapAnimDuration(reducedMotionRef.current, 220) });
  }, []);

  const onZoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: mapAnimDuration(reducedMotionRef.current, 220) });
  }, []);

  const onSearchQueryChange = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedIcao(null);
    setFollow(false);
    syncIcao24ToUrl(null);
  }, [syncIcao24ToUrl]);

  const errorBanner =
    apiError ??
    (rateLimitEndMs != null
      ? `OpenSky 429 — credits or rate limit. Retry in ${rateLimitRemainingSec}s. Anonymous tier is ~400 credits/day per IP; dev reloads and Vercel burn them fast — add OPENSKY_USERNAME/PASSWORD or wait until reset.`
      : null);

  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden">
      <div
        ref={containerRef}
        className="maplibregl-map-container h-full w-full min-h-0"
        aria-label="Interactive flight map"
      />

      <div
        className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_100px_rgba(0,0,0,0.45)]"
        aria-hidden
      />

      <div className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] right-0 left-0 z-40 flex flex-col items-center gap-2 px-3">
        <div className="border-border/50 bg-card/90 text-card-foreground pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2 shadow-lg backdrop-blur-md">
          <span className="text-lg font-semibold tracking-tight">SkyTrack</span>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            Live flight map · open data
          </span>
        </div>
        <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
          <FlightSearchBar
            aircraft={aircraft}
            loading={initialDataLoading}
            onSelect={focusAircraft}
            onQueryChange={onSearchQueryChange}
          />
          <div className="border-border/50 bg-card/90 text-card-foreground flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-center shadow-md backdrop-blur-md">
            <p className="text-xs font-semibold tabular-nums">
              {initialDataLoading ? (
                <span className="text-muted-foreground">Loading aircraft…</span>
              ) : rateLimitEndMs != null || apiError != null ? (
                <span className="text-muted-foreground">—</span>
              ) : searchFiltersMap ? (
                <>
                  <span className="text-foreground">{aircraftOnMap.length}</span>
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    shown · {aircraft.length} in OpenSky snapshot
                  </span>
                </>
              ) : (
                <>
                  <span className="text-foreground">{aircraft.length}</span>
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    aircraft in view (OpenSky)
                  </span>
                </>
              )}
            </p>
            {showSearchHidesAll ? (
              <p className="text-muted-foreground max-w-sm text-[11px] leading-snug">
                Search matches nothing in this area. Clear the field to show all {aircraft.length}{" "}
                aircraft on the map.
              </p>
            ) : null}
            {showEmptyBbox ? (
              <p className="text-muted-foreground max-w-sm text-[11px] leading-snug">
                No aircraft in this map box. Zoom out or pan over busier airspace (e.g. Europe, US
                East Coast).
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {errorBanner ? (
        <div
          className="border-destructive/40 bg-destructive/15 text-destructive-foreground absolute top-[calc(env(safe-area-inset-top)+7rem)] left-1/2 z-40 max-w-md -translate-x-1/2 rounded-xl border px-4 py-2 text-center text-sm shadow-lg backdrop-blur-md"
          role="alert"
        >
          {errorBanner}
        </div>
      ) : null}

      {showDeepLinkMiss ? (
        <div
          className="border-border/60 bg-card/95 text-card-foreground absolute top-[calc(env(safe-area-inset-top)+7rem)] left-1/2 z-40 max-w-md -translate-x-1/2 rounded-xl border px-4 py-2 text-center text-sm shadow-lg backdrop-blur-md"
          role="status"
        >
          Aircraft <span className="font-mono">{icao24FromUrl}</span> is not in the current OpenSky
          snapshot for this map area. Pan the map or wait for the next update.
        </div>
      ) : null}

      <MapControls
        className="absolute right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 md:bottom-[calc(4rem+env(safe-area-inset-bottom))]"
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-40 max-w-[min(100%,20rem)] md:max-w-sm">
        <DataDisclaimer />
      </div>

      <FlightDetailPanel
        aircraft={selectedAircraft}
        follow={follow}
        onFollowChange={setFollow}
        onClose={closeDetail}
        isDesktop={isDesktop}
      />
    </div>
  );
};
