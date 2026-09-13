/**
 * The HTTP client every repository runs on.
 *
 * The backend answers with one envelope on every route:
 *
 *   { data, total?, limit?, offset?, statusCode, timestamp, path }
 *
 * so unwrapping happens here once and repositories only ever see `data` (and
 * `total` when they asked for a page). Errors are normalised to an `ApiError`
 * carrying an Arabic message, because `useAsync`/`useAction` render
 * `error.message` straight into the UI.
 */

import { clearToken, readToken } from './session';

/** Base URL of the API, without a trailing slash. */
export const API_BASE: string = (
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.silversat.ahmed-muthana.com'
).replace(/\/+$/, '');

/**
 * The largest `limit` the API accepts.
 *
 * Every list DTO validates `limit` as 1..100 and rejects anything above it
 * with `limit must be between 1 and 100` — a 400, not a clamped page. So the
 * ceiling lives here and everything that builds a range clamps to it, rather
 * than each call site remembering a number the server owns.
 */
export const MAX_PAGE_SIZE = 100;

/** Clamps a requested page size into the range the API will accept. */
export function clampPageSize(pageSize: number): number {
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(pageSize)));
}

/** One page of a list route, as the envelope reports it. */
export interface ApiPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  /**
   * Whether `total` came from the server or was filled in from the row count.
   *
   * Without this the two are indistinguishable when a full page comes back —
   * `total === items.length` could mean "that was the whole table" or "no
   * total was sent" — and a walk over the pages has to guess which.
   */
  hasTotal: boolean;
}

/**
 * A failed request. `status` is the HTTP code so callers can special-case
 * 401/404, `message` is already in Arabic and safe to show.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Query values a request may carry. `undefined` and `''` are dropped. */
export type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** Sends the request without an Authorization header (login routes). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_BASE + (path.startsWith('/') ? path : `/${path}`));
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Arabic for the fixed English sentences the API throws.
 *
 * The console is Arabic end to end, and the most common failure of all — a
 * wrong password — came back reading `Invalid credentials` in the middle of an
 * otherwise Arabic screen. Only exact, known strings are translated; anything
 * unrecognised is still shown as the server wrote it, because a message we did
 * not anticipate is more useful verbatim than replaced by a guess.
 */
const SERVER_MESSAGES: Record<string, string> = {
  'invalid credentials': 'رقم الهاتف أو كلمة المرور غلط.',
  'invalid or expired otp': 'رمز التحقق غلط أو انتهت صلاحيته.',
  'invalid or expired challenge': 'انتهت صلاحية الجلسة — سجّل دخول من جديد.',
  'invalid otp code': 'رمز التحقق غلط.',
  unauthorized: 'انتهت الجلسة أو الصلاحية غير كافية — سجّل دخول من جديد.',
  'forbidden resource': 'ما عندك صلاحية لهذا الإجراء.',
  forbidden: 'ما عندك صلاحية لهذا الإجراء.',
  'not found': 'العنصر المطلوب غير موجود.',
  'user is blocked': 'هذا الحساب محظور.',
  'too many requests': 'محاولات كثيرة — انتظر شوية وعاود.',
};

/** Looks a server sentence up in the table above, ignoring case and dots. */
function translate(message: string): string {
  const key = message.trim().replace(/\.$/, '').toLowerCase();
  return SERVER_MESSAGES[key] ?? message;
}

/**
 * Turns whatever the server said into one Arabic sentence.
 *
 * Nest's validation pipe returns `message` as an array of field errors; a
 * thrown domain error returns it as a string. Both end up readable.
 */
function messageFrom(status: number, payload: unknown): string {
  const body = payload as { message?: unknown; error?: unknown } | null;
  const raw = body?.message ?? body?.error;
  if (Array.isArray(raw) && raw.length) return raw.map(String).map(translate).join(' • ');
  if (typeof raw === 'string' && raw.trim()) return translate(raw);

  switch (status) {
    case 0:
      return 'تعذّر الاتصال بالسيرفر — تحقق من الشبكة أو من عنوان الـ API.';
    case 400:
      return 'البيانات المرسلة غير صالحة.';
    case 401:
      return 'انتهت الجلسة أو الصلاحية غير كافية — سجّل دخول من جديد.';
    case 403:
      return 'ما عندك صلاحية لهذا الإجراء.';
    case 404:
      return 'العنصر المطلوب غير موجود.';
    case 409:
      return 'تعارض — العنصر موجود مسبقاً.';
    case 429:
      return 'محاولات كثيرة — انتظر شوية وعاود.';
    default:
      return status >= 500 ? 'خطأ في السيرفر — عاود المحاولة.' : 'صار خطأ غير متوقع.';
  }
}

/**
 * Sends one request and returns the whole envelope.
 *
 * A 401 clears the stored token before throwing: the session is gone
 * server-side, so keeping it locally would only produce another 401 on the
 * next screen.
 */
async function send(path: string, options: RequestOptions = {}): Promise<Record<string, unknown>> {
  const { method = 'GET', query, body, anonymous, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, messageFrom(0, null), err);
  }

  // 204 and empty bodies are legitimate on DELETE.
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401) clearToken();
    throw new ApiError(response.status, messageFrom(response.status, payload), payload);
  }

  return (payload ?? {}) as Record<string, unknown>;
}

/** Sends a request and returns only the `data` field. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const envelope = await send(path, options);
  return envelope.data as T;
}

/** Sends a list request and keeps the paging counters alongside the rows. */
export async function apiPage<T>(path: string, options: RequestOptions = {}): Promise<ApiPage<T>> {
  const envelope = await send(path, options);
  const items = (envelope.data ?? []) as T[];
  const hasTotal = typeof envelope.total === 'number';
  return {
    items,
    total: hasTotal ? (envelope.total as number) : items.length,
    limit: typeof envelope.limit === 'number' ? envelope.limit : items.length,
    offset: typeof envelope.offset === 'number' ? envelope.offset : 0,
    hasTotal,
  };
}

export const api = {
  get: <T>(path: string, query?: Query) => apiRequest<T>(path, { query }),
  page: <T>(path: string, query?: Query) => apiPage<T>(path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    apiRequest<T>(path, { method: 'POST', body, query }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  delete: <T = void>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  /** Login routes, which must not carry a stale bearer token. */
  anonPost: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body, anonymous: true }),
};

/** Pages requested at once by `fetchAll`. Enough to be quick, not a burst. */
const FETCH_ALL_CONCURRENCY = 5;

/**
 * Fetches every page of a list route.
 *
 * Several screens (province pickers, league filters, the dashboard totals)
 * need the whole table rather than a page of it. The cap keeps a runaway
 * dataset from locking the browser up.
 *
 * The first page is always fetched alone, because it is what tells us how many
 * there are. After that the walk splits in two:
 *
 *  - when the envelope carried a **total**, every remaining offset is known up
 *    front, so they are fetched a few at a time instead of one after another —
 *    at 100 rows per page the dashboard's ten-thousand-row reads are a hundred
 *    requests, and a hundred sequential round trips is a visibly slow screen;
 *  - when it did not, there is nothing to plan from, so the pages are walked
 *    one by one until a short page ends it.
 *
 * Order is preserved either way: batches are awaited in sequence and
 * `Promise.all` keeps each batch in offset order.
 */
export async function fetchAll<T>(path: string, query?: Query, cap = 2000): Promise<T[]> {
  const pageSize = MAX_PAGE_SIZE;
  const pageAt = (offset: number) =>
    apiPage<T>(path, { query: { ...query, limit: pageSize, offset } });

  const first = await pageAt(0);
  const out = [...first.items];
  if (first.items.length < pageSize || out.length >= cap) return out.slice(0, cap);

  if (first.hasTotal) {
    const wanted = Math.min(first.total, cap);
    const offsets: number[] = [];
    for (let offset = pageSize; offset < wanted; offset += pageSize) offsets.push(offset);

    for (let i = 0; i < offsets.length; i += FETCH_ALL_CONCURRENCY) {
      const pages = await Promise.all(
        offsets.slice(i, i + FETCH_ALL_CONCURRENCY).map(pageAt),
      );
      for (const page of pages) out.push(...page.items);
    }
    return out.slice(0, cap);
  }

  // No usable total — probe forward until a page comes back short.
  for (let offset = pageSize; offset < cap; offset += pageSize) {
    const page = await pageAt(offset);
    out.push(...page.items);
    if (page.items.length < pageSize) break;
  }
  return out.slice(0, cap);
}
