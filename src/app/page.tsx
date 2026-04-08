import { MapSection } from "./_components/map-section";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">SkyTrack</h1>
        <span className="text-muted-foreground text-sm">
          Live flight map (MapLibre)
        </span>
      </header>
      <main className="relative min-h-0 flex-1">
        <MapSection />
      </main>
    </div>
  );
}
