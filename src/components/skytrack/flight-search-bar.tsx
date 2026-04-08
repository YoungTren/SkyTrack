"use client";

import { Loader2Icon, PlaneIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterAircraftBySearch } from "@/lib/opensky/filter-aircraft";
import type { AircraftState } from "@/lib/opensky/types";
import { cn } from "@/lib/utils";

/** Heuristic: strings like BA123 / DL44 (IATA-style marketing flight numbers). */
export const looksLikeIataFlightNumber = (raw: string): boolean => {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{2,3}\d{1,4}[A-Z]?$/.test(s);
};

type FlightSearchBarProps = {
  aircraft: AircraftState[];
  loading: boolean;
  onSelect: (a: AircraftState) => void;
  onQueryChange: (query: string) => void;
  className?: string;
};

export const FlightSearchBar = ({
  aircraft,
  loading,
  onSelect,
  onQueryChange,
  className,
}: FlightSearchBarProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "flight-search-results";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return filterAircraftBySearch(aircraft, query);
  }, [aircraft, query]);

  const effectiveActiveIndex =
    results.length === 0 || activeIndex < 0
      ? -1
      : Math.min(activeIndex, results.length - 1);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showList = open && query.trim().length >= 2;

  const onPick = useCallback(
    (a: AircraftState) => {
      onSelect(a);
      setQuery("");
      onQueryChange("");
      setOpen(false);
      setActiveIndex(-1);
    },
    [onSelect, onQueryChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? -1 : i < results.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? -1 : i <= 0 ? results.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length === 0) return;
      const idx = effectiveActiveIndex >= 0 ? effectiveActiveIndex : 0;
      onPick(results[idx]);
    }
  };

  const iataLike = looksLikeIataFlightNumber(query);

  return (
    <div ref={rootRef} className={cn("relative z-50", className)}>
      <div className="border-border/60 bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-md rounded-xl border">
        <div className="relative flex items-center gap-2 px-3 py-2">
          <SearchIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              onQueryChange(v);
              setActiveIndex(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search callsign or ICAO24…"
            className="h-9 flex-1 border-0 bg-transparent text-popover-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-activedescendant={
              showList && effectiveActiveIndex >= 0
                ? `${listId}-opt-${effectiveActiveIndex}`
                : undefined
            }
            autoComplete="off"
          />
          {loading ? (
            <Loader2Icon className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden />
          ) : null}
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                onQueryChange("");
                setActiveIndex(-1);
                setOpen(false);
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground border-border/50 border-t px-3 py-1.5 text-[11px] leading-snug">
          With 2+ characters, the map shows only aircraft that match your search. Data is still the
          current OpenSky snapshot for the visible area. Ticket flight numbers often differ from
          radio callsigns.
        </p>
      </div>

      {showList ? (
        <ul
          id={listId}
          className="border-border/60 bg-popover/98 text-popover-foreground absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-auto rounded-xl border py-1 shadow-xl backdrop-blur-md"
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="text-muted-foreground space-y-2 px-3 py-4 text-left text-sm">
              <p>No matches in the current data.</p>
              <p className="text-[12px] leading-snug">
                OpenSky only returns aircraft in the requested map area. Try panning or zooming,
                check spelling, or search by 6-character ICAO24 (hex). Ticket or gate flight numbers
                often differ from the callsign transmitted on the radio.
              </p>
              {iataLike ? (
                <p className="text-popover-foreground text-[12px] leading-snug font-medium">
                  This input looks like an IATA flight number. SkyTrack does not map those to
                  callsigns; use the callsign or ICAO24 when you have them.
                </p>
              ) : null}
            </li>
          ) : (
            results.map((a, i) => (
              <li
                key={a.icao24}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={i === effectiveActiveIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
                    i === effectiveActiveIndex ? "bg-muted/90" : "hover:bg-muted/80",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => onPick(a)}
                >
                  <PlaneIcon className="text-primary size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {a.callsign?.trim() || "—"}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">{a.icao24}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
};
