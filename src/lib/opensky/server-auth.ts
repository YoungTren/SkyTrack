/**
 * OpenSky OAuth2 (client credentials) + legacy Basic Auth.
 * @see https://openskynetwork.github.io/opensky-api/python.html
 */

const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

type TokenJson = {
  access_token?: string;
  expires_in?: number;
};

let oauthCache: { token: string; expiresAtMs: number } | null = null;

const fetchOAuthAccessToken = async (
  signal?: AbortSignal,
): Promise<{ token: string; expiresInSec: number } | null> => {
  const clientId = process.env.OPENSKY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      cache: "no-store",
      signal,
    });

    if (!res.ok) {
      console.warn("[opensky] oauth_token_failed", { status: res.status });
      return null;
    }

    const json: unknown = await res.json();
    const parsed = json as TokenJson;
    if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
      console.warn("[opensky] oauth_token_missing_access_token");
      return null;
    }

    const expiresInSec =
      typeof parsed.expires_in === "number" && parsed.expires_in > 60
        ? parsed.expires_in
        : 300;

    return { token: parsed.access_token, expiresInSec };
  } catch (err) {
    console.warn("[opensky] oauth_token_error", err);
    return null;
  }
};

type AuthOpts = {
  /** Shared with OpenSky fetch so OAuth + REST stay within one serverless budget. */
  signal?: AbortSignal;
};

/**
 * Returns `Authorization` header value for OpenSky REST, or `undefined` for anonymous.
 * Caches OAuth token until ~1 min before expiry.
 */
export const getOpenskyAuthorizationHeader = async (opts?: AuthOpts): Promise<string | undefined> => {
  const marginMs = 60_000;
  if (oauthCache && Date.now() < oauthCache.expiresAtMs - marginMs) {
    return `Bearer ${oauthCache.token}`;
  }

  const oauth = await fetchOAuthAccessToken(opts?.signal);
  if (oauth) {
    oauthCache = {
      token: oauth.token,
      expiresAtMs: Date.now() + oauth.expiresInSec * 1000,
    };
    return `Bearer ${oauth.token}`;
  }

  oauthCache = null;

  const user = process.env.OPENSKY_USERNAME?.trim();
  const pass = process.env.OPENSKY_PASSWORD?.trim();
  if (user && pass) {
    const basic = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
    return `Basic ${basic}`;
  }

  return undefined;
};
