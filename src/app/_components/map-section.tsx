"use client";

import dynamic from "next/dynamic";

const FlightMap = dynamic(
  () =>
    import("@/components/flight-map").then((mod) => ({ default: mod.FlightMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[240px] items-center justify-center bg-muted text-muted-foreground text-sm">
        Loading map…
      </div>
    ),
  },
);

export const MapSection = () => <FlightMap />;
