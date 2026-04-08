"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/** Official demo style — no API key. Swap for your own MapLibre-compatible style URL in production. */
const DEFAULT_STYLE = "https://demotiles.maplibre.org/style.json";

export const FlightMap = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE,
      center: [20, 48],
      zoom: 2,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full min-h-0" />;
};
