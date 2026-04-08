"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MapControlsProps = {
  className?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export const MapControls = ({ className, onZoomIn, onZoomOut }: MapControlsProps) => (
  <div
    className={cn(
      "border-border/60 bg-background/90 flex flex-col gap-0.5 rounded-lg border p-0.5 shadow-lg backdrop-blur-md",
      className,
    )}
    role="group"
    aria-label="Map zoom"
  >
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      className="size-9 rounded-md"
      onClick={onZoomIn}
      aria-label="Zoom in"
    >
      <PlusIcon className="size-4" />
    </Button>
    <Button
      type="button"
      variant="secondary"
      size="icon-sm"
      className="size-9 rounded-md"
      onClick={onZoomOut}
      aria-label="Zoom out"
    >
      <MinusIcon className="size-4" />
    </Button>
  </div>
);
