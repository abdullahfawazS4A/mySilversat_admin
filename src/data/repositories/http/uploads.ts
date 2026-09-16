/**
 * The one route that takes a file rather than JSON.
 *
 * Images reach the app as URLs — `ads.image`, and anything else authored with
 * a picture — and until now the console could only be handed one that had been
 * uploaded somewhere else. This turns a file the operator picked into such a
 * URL, so the two halves of "add a banner" happen on one screen.
 *
 * What comes back may be relative (`/uploads/ads/x.jpg`), because the API and
 * the files it serves share an origin and it has no reason to spell out its
 * own host. The console does not share that origin — it runs on its own domain
 * and in dev on localhost — so a relative URL is resolved against `API_BASE`
 * here. Storing the bare path instead would produce a row that renders in the
 * mobile app and shows a broken image in the console, which is the kind of
 * difference nobody notices until a banner is live.
 */

import { api, API_BASE } from '@/data/http/client';
import type { UploadsRepository } from '../types';

/** What `POST /uploads` answers with. Only the URL is of any use here. */
interface UploadedFile {
  url?: string;
  path?: string;
  location?: string;
}

/**
 * Picks the URL out of the response and makes it absolute.
 *
 * Three key names are accepted because this route is newer than the screens
 * that call it; whichever one the server settles on, the console reads it.
 */
function resolveUrl(file: UploadedFile | string | null): string {
  const raw = typeof file === 'string' ? file : (file?.url ?? file?.path ?? file?.location ?? '');
  const value = raw.trim();
  if (!value) throw new Error('السيرفر ما رجّع رابط الصورة بعد الرفع.');
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${API_BASE}/${value.replace(/^\/+/, '')}`;
}

export class HttpUploadsRepository implements UploadsRepository {
  async image(file: File, signal?: AbortSignal): Promise<string> {
    const uploaded = await api.upload<UploadedFile | string>('/uploads', file, 'file', signal);
    return resolveUrl(uploaded);
  }
}
