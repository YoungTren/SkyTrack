"use client";

import { InfoIcon } from "lucide-react";

export const DataDisclaimer = () => (
  <div
    className="border-border/60 bg-background/85 text-muted-foreground pointer-events-auto max-w-xs rounded-lg border px-3 py-2 text-xs leading-snug shadow-sm backdrop-blur-md md:max-w-sm"
    role="note"
  >
    <span className="text-foreground inline-flex items-start gap-1.5 font-medium">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
      Open data
    </span>
    <p className="mt-1">
      Positions are not real-time navigation data. Coverage and delay depend on OpenSky. Not for
      operational or safety decisions.
    </p>
  </div>
);
