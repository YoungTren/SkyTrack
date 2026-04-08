# SkyTrack

Live aircraft map for the browser using [OpenSky Network](https://opensky-network.org/) state vectors, [Next.js](https://nextjs.org/) (App Router), [MapLibre GL](https://maplibre.org/), and Tailwind + shadcn-style UI.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_MAP_STYLE_URL` | No | MapLibre-compatible style JSON. If unset, the app uses MapLibre demo tiles (fine for development, not ideal for production). |
| `OPENSKY_USERNAME` | No | OpenSky account username for server-side Basic Auth. |
| `OPENSKY_PASSWORD` | No | OpenSky account password (server-only; never sent to the browser). |

If `OPENSKY_USERNAME` / `OPENSKY_PASSWORD` are omitted, requests are anonymous (lower daily API credits).

## OpenSky limits

- Anonymous users: **400 credits/day** for `/states/*` (shared per client IP through this app’s server proxy on Vercel).
- Credit cost for `GET /states/all` depends on **bounding-box area** (latitude span × longitude span in square degrees). Very large boxes cost up to **4 credits** per request, same tier as a global query.
- On credit exhaustion the API returns **429** with `X-Rate-Limit-Retry-After-Seconds`. SkyTrack backs off until that time and shows a countdown in the UI.
- Data latency and coverage depend on ADS-B feeders; not for navigation or safety-critical use.

Docs: [OpenSky REST API](https://openskynetwork.github.io/opensky-api/rest.html).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |

## Deploy on Vercel

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/) and set root to this app if it lives in a monorepo.
3. Add environment variables in the Vercel project settings (`NEXT_PUBLIC_*` for the map style URL; OpenSky credentials as server secrets).
4. Deploy.

## Deep link

Append `?icao24=<6-char-hex>` to the URL. If that aircraft appears in the current OpenSky snapshot for the visible map area, the app selects it and opens the detail panel; otherwise a short status message explains that it is not in the current data.

## Licence

Map tiles and style are subject to your chosen `NEXT_PUBLIC_MAP_STYLE_URL` provider. OpenSky data is subject to [OpenSky terms](https://opensky-network.org/about/legal).
