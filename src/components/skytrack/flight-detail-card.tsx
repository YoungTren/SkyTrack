"use client";

import { ChevronDownIcon, CrosshairIcon, PlaneIcon, XIcon } from "lucide-react";

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

const formatTime = (sec: number | null) => {
  if (sec == null) return null;
  try {
    return new Date(sec * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(sec);
  }
};

const formatRelativeAgo = (sec: number): string => {
  const now = Date.now() / 1000;
  const delta = Math.max(0, Math.floor(now - sec));
  const h = Math.floor(delta / 3600);
  const m = Math.floor((delta % 3600) / 60);
  if (h > 0) return `${h}h ${m}m ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
};

const mpsToKmh = (mps: number) => Math.round(mps * 3.6);

const positionRows = (a: AircraftState) => {
  const out: { label: string; value: string }[] = [];
  if (a.latitude != null && a.longitude != null) {
    out.push({ label: "Coordinates", value: formatCoord(a.latitude, a.longitude) });
  }
  if (a.baro_altitude != null) {
    out.push({ label: "Baro altitude", value: `${Math.round(a.baro_altitude)} m` });
  }
  if (a.geo_altitude != null) {
    out.push({ label: "Geometric altitude", value: `${Math.round(a.geo_altitude)} m` });
  }
  if (a.velocity != null) {
    out.push({
      label: "Ground speed",
      value: `${mpsToKmh(a.velocity)} km/h (${a.velocity.toFixed(1)} m/s)`,
    });
  }
  if (a.true_track != null) {
    out.push({ label: "True track", value: `${a.true_track.toFixed(1)}°` });
  }
  if (a.vertical_rate != null) {
    out.push({ label: "Vertical rate", value: `${a.vertical_rate.toFixed(1)} m/s` });
  }
  out.push({ label: "On ground", value: a.on_ground ? "Yes" : "No" });
  if (a.squawk) out.push({ label: "Squawk", value: a.squawk });
  if (a.spi === true || a.spi === false) {
    out.push({ label: "SPI", value: a.spi ? "Yes" : "No" });
  }
  if (a.position_source != null) {
    out.push({ label: "Position source", value: String(a.position_source) });
  }
  return out;
};

const summaryClass =
  "flex cursor-pointer list-none items-center justify-between py-3 text-xs font-semibold tracking-wide uppercase [&::-webkit-details-marker]:hidden";

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
  const displayFlight = aircraft.callsign?.trim() || aircraft.icao24.toUpperCase();
  const radioCallsign = aircraft.callsign?.trim() || null;
  const lastReportSec = aircraft.time_position ?? aircraft.last_contact;
  const depTime = formatTime(aircraft.time_position);
  const depAgo = formatRelativeAgo(lastReportSec);

  return (
    <div className={cn("flex flex-col", className)}>
      <CardHeader className="border-border/60 border-b px-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-2xl font-bold tracking-tight">{displayFlight}</CardTitle>
            {radioCallsign ? (
              <p className="text-muted-foreground mt-0.5 font-mono text-sm">
                {radioCallsign} · {aircraft.icao24}
              </p>
            ) : (
              <p className="text-muted-foreground mt-0.5 font-mono text-sm">{aircraft.icao24}</p>
            )}
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

        <div className="mt-5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-center">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              From
            </p>
            <p className="text-foreground mt-1 text-2xl font-bold tracking-tight">—</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
              Airport not in OpenSky feed
            </p>
          </div>
          <div className="text-primary flex shrink-0 flex-col items-center pt-6">
            <PlaneIcon className="size-8 rotate-90" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              To
            </p>
            <p className="text-foreground mt-1 text-2xl font-bold tracking-tight">—</p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
              Destination not in OpenSky feed
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[11px]">{depAgo} · last ADS-B fix</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-0 px-0 pt-0">
        <div className="border-border/60 grid grid-cols-2 gap-px border-b bg-border">
          <div className="bg-card px-4 py-3">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Departure
            </p>
            <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">
              {depTime ?? "—"}
            </p>
            <p className="text-muted-foreground text-xs">Last position report (local)</p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Arrival
            </p>
            <p className="text-foreground mt-1 text-lg font-semibold tabular-nums">—</p>
            <p className="text-muted-foreground text-xs">Needs schedule / commercial data</p>
          </div>
        </div>

        <div className="border-border/60 border-b px-4 py-3">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Remaining en route
          </p>
          <p className="text-foreground mt-1 text-xl font-bold tabular-nums">—</p>
          <p className="text-muted-foreground mt-1 text-xs leading-snug">
            OpenSky state vectors do not include destination or scheduled landing time, so ETA and
            time-to-go cannot be computed here. Sites like aviado.ru use additional airline or
            commercial radar data for that.
          </p>
        </div>

        <div className="border-border/60 bg-muted/30 mx-4 mt-4 overflow-hidden rounded-xl border">
          <div className="from-primary/10 to-muted/50 flex aspect-[16/10] items-center justify-center bg-gradient-to-br">
            <PlaneIcon className="text-primary/40 size-16" aria-hidden />
          </div>
          <div className="border-border/60 space-y-0.5 border-t px-3 py-2">
            <p className="text-foreground font-mono text-sm font-semibold tracking-wide">
              {aircraft.icao24.toUpperCase()}
            </p>
            <p className="text-muted-foreground text-xs">ICAO24 address (not tail registration)</p>
            <p className="text-muted-foreground text-xs">Aircraft photo requires a separate registry</p>
          </div>
        </div>

        <div className="px-4">
          <details
            open
            className="border-border/60 border-b [&>summary>svg]:transition-transform [&[open]>summary>svg]:rotate-180"
          >
            <summary className={summaryClass}>
              Flight data
              <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
            </summary>
            <dl className="grid gap-2 pb-3 text-sm">
              {aircraft.callsign?.trim() ? (
                <div className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2">
                  <dt className="text-muted-foreground">Callsign</dt>
                  <dd className="font-medium break-words">{aircraft.callsign.trim()}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2">
                <dt className="text-muted-foreground">ICAO24</dt>
                <dd className="font-mono font-medium">{aircraft.icao24}</dd>
              </div>
              {aircraft.origin_country ? (
                <div className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2">
                  <dt className="text-muted-foreground">Origin country</dt>
                  <dd className="font-medium break-words">{aircraft.origin_country}</dd>
                </div>
              ) : null}
            </dl>
          </details>

          <details className="border-border/60 border-b [&>summary>svg]:transition-transform [&[open]>summary>svg]:rotate-180">
            <summary className={summaryClass}>
              Position information
              <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
            </summary>
            <dl className="grid gap-2 pb-3 text-sm">
              {positionRows(aircraft).map(({ label, value }) => (
                <div key={label} className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-2 gap-y-0.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <p className="text-muted-foreground border-border/60 mt-2 border-t px-4 py-3 text-[11px] leading-snug">
          Data source:{" "}
          <a
            href="https://opensky-network.org"
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            OpenSky Network
          </a>
          . SkyTrack is not affiliated with aviado.ru or AirNav; live tiles on other sites use
          different backends and licensing.
        </p>
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
          "absolute top-[calc(env(safe-area-inset-top)+7.5rem)] left-3 z-30 flex w-[min(100%,24rem)] max-h-[min(78vh,calc(100dvh-9rem))] max-w-[calc(100vw-1.5rem)] flex-col overflow-y-auto overflow-x-hidden rounded-2xl border shadow-xl backdrop-blur-md md:left-4 md:w-[min(100%,28rem)]",
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
        className="border-border/60 max-h-[min(88dvh,640px)] overflow-y-auto rounded-t-2xl p-0"
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
