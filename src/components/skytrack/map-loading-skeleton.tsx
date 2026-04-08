"use client";

import { Skeleton } from "@/components/ui/skeleton";

export const MapLoadingSkeleton = () => (
  <div className="bg-background/40 flex h-full min-h-[240px] w-full flex-col gap-3 p-4 backdrop-blur-sm">
    <Skeleton className="h-full min-h-[200px] flex-1 rounded-xl opacity-40" />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-24 rounded-lg opacity-40" />
      <Skeleton className="h-8 flex-1 rounded-lg opacity-40" />
    </div>
  </div>
);
