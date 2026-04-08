"use client";

import { CrosshairIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AircraftState } from "@/lib/opensky/types";
import { cn } from "@/lib/utils";

const formatCoord = (lat: number, lon: number) =>
  `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;

const formatUnix = (sec: number | null) => {
  if (sec == null) return null;
  try {
    return new Date(sec * 1000).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return String(sec);
  }
};

const rowsForAircraft = (a: AircraftState) => {
  const out: { label: string; value: string }[] = [];

  if (a.latitude != null && a.longitude != null) {
    out.push({ label: "Position", value: formatCoord(a.latitude, a.longitude) });
  }
  if (a.baro_altitude != null) {
    out.push({ label: "Baro altitude", value: `${Math.round(a.baro_altitude)} m` });
  }
  if (a.geo_altitude != null) {
    out.push({ label: "Geometric altitude", value: `${Math.round(a.geo_altitude)} m` });
  }
  if (a.velocity != null) {
    out.push({ label: "Ground speed", value: `${a.velocity.toFixed(1)} m/s` });
  }
  if (a.true_track != null) {
    out.push({ label: "True track", value: `${a.true_track.toFixed(1)}°` });
  }
  if (a.vertical_rate != null) {
    out.push({ label: "Vertical rate", value: `${a.vertical_rate.toFixed(1)} m/s` });
  }
  out.push({ label: "On ground", value: a.on_ground ? "Yes" : "No" });
  if (a.origin_country) {
    out.push({ label: "Origin country", value: a.origin_country });
  }
  if (a.squawk) {
    out.push({ label: "Squawk", value: a.squawk });
  }
  if (a.spi === true || a.spi === false) {
    out.push({ label: "SPI", value: a.spi ? "Yes" : "No" });
  }
  if (a.position_source != null) {
    out.push({ label: "Position source", value: String(a.position_source) });
  }
  const tPos = formatUnix(a.time_position);
  if (tPos) out.push({ label: "Position time", value: tPos });
  const last = formatUnix(a.last_contact);
  if (last) out.push({ label: "Last contact", value: last });

  return out;
};

const PlaneHero = () => (
  <div
    className="from-primary/15 via-card to-card flex items-center justify-center bg-gradient-to-b py-8"
    aria-hidden
  >
    <svg
      viewBox="0 0 120 120"
      className="text-primary h-24 w-32 opacity-90"
      fill="currentColor"
    >
      <path d="M60 8 L88 52 L72 58 L72 78 L96 88 L96 98 L60 88 L24 98 L24 88 L48 78 L48 58 L32 52 Z" />
    </svg>
  </div>
);

type DetailBodyProps = {
  aircraft: AircraftState;
  follow: boolean;
  onFollowChange: (v: boolean) => void;
  onClose: () => void;
  className?: string;
};

export const FlightDetailBody = ({
  aircraft,
  follow,
  onFollowChange,
  onClose,
  className,
}: DetailBodyProps) => {
  const title = aircraft.callsign?.trim() || aircraft.icao24;
  const subtitle = aircraft.callsign?.trim() ? (
    <span className="text-muted-foreground font-mono text-sm">{aircraft.icao24}</span>
  ) : null;
  const rows = rowsForAircraft(aircraft);

  return (
    <div className={cn("flex flex-col", className)}>
      <PlaneHero />
      <CardHeader className="border-border/60 border-b pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
            {subtitle}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Now
        </p>
        <dl className="grid gap-2 text-sm">
          {rows.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[minmax(0,40%)_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="border-border/60 mt-auto flex flex-wrap gap-2 border-t">
        <Button
          type="button"
          variant={follow ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => onFollowChange(!follow)}
        >
          <CrosshairIcon className="size-3.5" />
          {follow ? "Following" : "Follow aircraft"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardFooter>
    </div>
  );
};

type FlightDetailPanelProps = {
  aircraft: AircraftState | null;
  follow: boolean;
  onFollowChange: (v: boolean) => void;
  onClose: () => void;
  isDesktop: boolean;
};

export const FlightDetailPanel = ({
  aircraft,
  follow,
  onFollowChange,
  onClose,
  isDesktop,
}: FlightDetailPanelProps) => {
  if (!aircraft) return null;

  if (isDesktop) {
    return (
      <aside
        className={cn(
          "border-border/60 bg-card text-card-foreground animate-in slide-in-from-left fade-in fill-mode-both duration-200",
          "absolute top-[calc(env(safe-area-inset-top)+7.5rem)] left-3 z-30 flex w-[min(100%,22rem)] max-h-[min(72vh,calc(100dvh-9rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-md md:left-4 md:w-[24rem]",
        )}
        aria-label="Flight details"
      >
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <FlightDetailBody
            aircraft={aircraft}
            follow={follow}
            onFollowChange={onFollowChange}
            onClose={onClose}
          />
        </Card>
      </aside>
    );
  }

  return (
    <Sheet open modal onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="border-border/60 max-h-[min(85dvh,560px)] overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Flight details</SheetTitle>
        </SheetHeader>
        <Card className="border-0 bg-transparent shadow-none ring-0">
          <FlightDetailBody
            aircraft={aircraft}
            follow={follow}
            onFollowChange={onFollowChange}
            onClose={onClose}
          />
        </Card>
      </SheetContent>
    </Sheet>
  );
};
