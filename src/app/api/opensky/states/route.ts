import { NextRequest, NextResponse } from "next/server";

import { clampBboxForUpstreamFetch } from "@/lib/opensky/bbox";
import {
  bboxCacheKey,
  getCachedStates,
  setCachedStates,
} from "@/lib/opensky/bbox-response-cache";
import { parseOpenskyJson } from "@/lib/opensky/parse";
import { getOpenskyAuthorizationHeader } from "@/lib/opensky/server-auth";

const OPENSKY_BASE = "https://opensky-network.org/api/states/all";

/** One wall-clock budget for OAuth + OpenSky so sequential timeouts do not exceed the platform limit. */
const UPSTREAM_BUDGET_MS = process.env.VERCEL ? 8_200 : 28_000;

const successCacheControl =
  "public, s-maxage=10, stale-while-revalidate=30, max-age=5";

export const maxDuration = 30;

const parseBbox = (sp: URLSearchParams): {
  ok: true;
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
} | { ok: false; message: string } => {
  const keys = ["lamin", "lomin", "lamax", "lomax"] as const;
  const raw: Record<string, string> = {};
  for (const k of keys) {
    const v = sp.get(k);
    if (v == null || v === "") {
      return { ok: false, message: `missing_${k}` };
    }
    raw[k] = v;
  }
  const nums = keys.map((k) => Number(raw[k]));
  if (nums.some((n) => Number.isNaN(n))) {
    return { ok: false, message: "invalid_number" };
  }
  const [lamin, lomin, lamax, lomax] = nums;
  if (lamin < -90 || lamin > 90 || lamax < -90 || lamax > 90) {
    return { ok: false, message: "latitude_out_of_range" };
  }
  if (lomin < -180 || lomin > 180 || lomax < -180 || lomax > 180) {
    return { ok: false, message: "longitude_out_of_range" };
  }
  if (lamin >= lamax || lomin >= lomax) {
    return { ok: false, message: "invalid_bbox_order" };
  }
  return { ok: true, lamin, lomin, lamax, lomax };
};

export async function GET(request: NextRequest) {
  try {
    const parsed = parseBbox(request.nextUrl.searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: "invalid_bbox", code: parsed.message }, { status: 400 });
    }

    const bbox = clampBboxForUpstreamFetch(parsed);
    const cKey = bboxCacheKey(bbox);
    const cached = getCachedStates(cKey);
    if (cached) {
      return NextResponse.json(
        { time: cached.time, aircraft: cached.aircraft, cached: true },
        { headers: { "Cache-Control": successCacheControl } },
      );
    }

    const url = new URL(OPENSKY_BASE);
    url.searchParams.set("lamin", String(bbox.lamin));
    url.searchParams.set("lomin", String(bbox.lomin));
    url.searchParams.set("lamax", String(bbox.lamax));
    url.searchParams.set("lomax", String(bbox.lomax));

    const netSignal = AbortSignal.timeout(UPSTREAM_BUDGET_MS);
    const headers: HeadersInit = { Accept: "application/json" };
    const auth = await getOpenskyAuthorizationHeader({ signal: netSignal });
    if (auth) headers.Authorization = auth;

    const res = await fetch(url.toString(), {
      headers,
      cache: "no-store",
      signal: netSignal,
    });

    const retryAfterRaw = res.headers.get("X-Rate-Limit-Retry-After-Seconds");
    const retryAfterSeconds = retryAfterRaw != null && retryAfterRaw !== "" ? Number(retryAfterRaw) : null;
    const safeRetry =
      retryAfterSeconds != null && !Number.isNaN(retryAfterSeconds) && retryAfterSeconds >= 0
        ? retryAfterSeconds
        : null;

    if (res.status === 429) {
      console.warn("[opensky] rate_limited", { status: 429, retryAfterSeconds: safeRetry });
    } else if (res.status >= 500) {
      console.warn("[opensky] upstream_error", { status: res.status });
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "opensky_request_failed",
          status: res.status,
          retryAfterSeconds: safeRetry,
        },
        { status: res.status === 429 ? 429 : 502 },
      );
    }

    const json: unknown = await res.json();
    const aircraft = parseOpenskyJson(json);
    const time =
      typeof (json as { time?: unknown }).time === "number" ? (json as { time: number }).time : null;

    setCachedStates(cKey, { time, aircraft });

    return NextResponse.json(
      { time, aircraft, cached: false },
      { headers: { "Cache-Control": successCacheControl } },
    );
  } catch (err) {
    const aborted =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    console.error("[opensky] states_route", err);
    return NextResponse.json(
      {
        error: "opensky_proxy_error",
        message: aborted
          ? "OpenSky or auth request exceeded the time budget — try again or zoom in."
          : "Upstream fetch failed or timed out",
      },
      { status: aborted ? 504 : 502 },
    );
  }
}
