/**
 * Klien Meta Threads API (resmi). Endpoint & parameter diverifikasi di docs/THREADS_API_NOTES.md.
 * Dibungkus interface agar logika sinkron/OAuth bisa dites dengan klien tiruan.
 */
export const THREADS_SCOPES = ["threads_basic", "threads_keyword_search"] as const;
const GRAPH = "https://graph.threads.net";
const API_VERSION = "v1.0";
const AUTHORIZE_URL = "https://threads.com/oauth/authorize";

export type ThreadsPost = {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp?: string;
  media_type?: string;
  is_reply?: boolean;
};

export type TokenResult = { accessToken: string; expiresInSeconds: number };

export interface ThreadsApi {
  authorizeUrl(params: { appId: string; redirectUri: string; state: string }): string;
  exchangeCode(params: { appId: string; appSecret: string; redirectUri: string; code: string }): Promise<{ accessToken: string; userId: string }>;
  exchangeLongLived(params: { appSecret: string; accessToken: string }): Promise<TokenResult>;
  refreshLongLived(accessToken: string): Promise<TokenResult>;
  me(accessToken: string): Promise<{ id: string; username: string }>;
  keywordSearch(params: { accessToken: string; q: string; since?: number; limit?: number }): Promise<ThreadsPost[]>;
}

/** Token tidak valid/kedaluwarsa/dicabut (OAuthException, code 190). Hentikan monitoring. */
export class ThreadsAuthError extends Error {}
/** Batas pemakaian tercapai (HTTP 429 atau code 4/17/32/613). Coba lagi nanti. */
export class ThreadsRateLimitError extends Error {}
/** Galat API lain (izin belum disetujui, parameter salah, gangguan). */
export class ThreadsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
  }
}

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new ThreadsApiError(`Jaringan: ${(error as Error).message}`, 0);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; type?: string } } & T;
  if (res.ok && !body.error) return body;
  const code = body.error?.code;
  const message = body.error?.message ?? `HTTP ${res.status}`;
  if (code === 190 || (body.error?.type === "OAuthException" && res.status === 401)) throw new ThreadsAuthError(message);
  if (res.status === 429 || (code !== undefined && RATE_LIMIT_CODES.has(code))) throw new ThreadsRateLimitError(message);
  throw new ThreadsApiError(message, res.status, code);
}

export function threadsApi(): ThreadsApi {
  return {
    authorizeUrl({ appId, redirectUri, state }) {
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", THREADS_SCOPES.join(","));
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCode({ appId, appSecret, redirectUri, code }) {
      const body = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code: code.replace(/#_$/, ""),
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      const res = await call<{ access_token: string; user_id: string | number }>(`${GRAPH}/oauth/access_token`, { method: "POST", body });
      return { accessToken: res.access_token, userId: String(res.user_id) };
    },

    async exchangeLongLived({ appSecret, accessToken }) {
      const url = new URL(`${GRAPH}/access_token`);
      url.searchParams.set("grant_type", "th_exchange_token");
      url.searchParams.set("client_secret", appSecret);
      url.searchParams.set("access_token", accessToken);
      const res = await call<{ access_token: string; expires_in: number }>(url.toString());
      return { accessToken: res.access_token, expiresInSeconds: res.expires_in };
    },

    async refreshLongLived(accessToken) {
      const url = new URL(`${GRAPH}/refresh_access_token`);
      url.searchParams.set("grant_type", "th_refresh_token");
      url.searchParams.set("access_token", accessToken);
      const res = await call<{ access_token: string; expires_in: number }>(url.toString());
      return { accessToken: res.access_token, expiresInSeconds: res.expires_in };
    },

    async me(accessToken) {
      const url = new URL(`${GRAPH}/${API_VERSION}/me`);
      url.searchParams.set("fields", "id,username");
      url.searchParams.set("access_token", accessToken);
      return call<{ id: string; username: string }>(url.toString());
    },

    async keywordSearch({ accessToken, q, since, limit = 25 }) {
      const url = new URL(`${GRAPH}/${API_VERSION}/keyword_search`);
      url.searchParams.set("q", q);
      url.searchParams.set("search_type", "RECENT");
      url.searchParams.set("fields", "id,text,username,permalink,timestamp,media_type,is_reply");
      url.searchParams.set("limit", String(Math.min(limit, 100)));
      if (since) url.searchParams.set("since", String(since));
      url.searchParams.set("access_token", accessToken);
      const res = await call<{ data?: ThreadsPost[] }>(url.toString());
      return res.data ?? [];
    },
  };
}
