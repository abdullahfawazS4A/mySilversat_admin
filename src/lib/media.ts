/**
 * Resolving a stored media path into something an `<img>` can load.
 *
 * The API stores what its own upload handler wrote — `/uploads/ads/ad-…png` —
 * a path relative to the API's origin, which is the right thing for it to
 * keep: the files sit beside it and it has no reason to hard-code its own
 * host. The console does not share that origin. It runs on its own domain,
 * and in development on localhost, so handing that path straight to an `<img>`
 * resolves it against the console and asks a server that has no `/uploads` for
 * a file that was never there.
 *
 * That failure is quiet — a broken thumbnail reads as a bad upload rather than
 * a bad URL — so every stored image goes through here on its way to a `src`.
 *
 * Values that are already absolute pass through untouched: banners linked from
 * an external CDN, `data:` previews of a file being uploaded, and the crest
 * URLs the fixtures provider sends, which point at its host and not ours.
 */

import { API_BASE } from '@/data/http/client';

/**
 * Absolute URL for a stored image, or `''` when there is nothing to show.
 *
 * Returning an empty string rather than `undefined` keeps callers from setting
 * `src` to the literal `"undefined"`, which browsers dutifully request.
 */
export function mediaUrl(value: string | null | undefined): string {
  const path = (value ?? '').trim();
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE}/${path.replace(/^\/+/, '')}`;
}

/**
 * The `crossOrigin` an `<img>` needs for `src`.
 *
 * The API answers its uploads with `Cross-Origin-Resource-Policy:
 * same-origin`, which forbids a page on any other origin — this console — from
 * showing them, so every banner and uploaded crest rendered broken. That
 * policy only binds plain (no-cors) image loads. Asked for with CORS, the same
 * file is governed by `Access-Control-Allow-Origin: *`, which the API also
 * sends, and it loads.
 *
 * Only for the API's own files: an external host (the fixtures provider's
 * crests) may send no CORS headers, and a CORS request to it would fail where
 * a plain one works.
 */
export function mediaCrossOrigin(src: string | null | undefined): 'anonymous' | undefined {
  return src && src.startsWith(`${API_BASE}/`) ? 'anonymous' : undefined;
}
