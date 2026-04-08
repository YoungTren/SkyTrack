"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { MapLoadingSkeleton } from "@/components/skytrack/map-loading-skeleton";

const FlightMap = dynamic(
  () =>
    import("@/components/flight-map").then((mod) => ({ default: mod.FlightMap })),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  },
);

export const MapSection = () => (
  <div className="h-dvh min-h-0 w-full">
    <Suspense fallback={<MapLoadingSkeleton />}>
      <FlightMap />
    </Suspense>
  </div>
);
