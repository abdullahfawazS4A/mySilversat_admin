/**
 * The one route that takes a file rather than JSON.
 *
 * Images reach the app as URLs — `ads.image`, and anything else authored with
 * a picture — and until now the console could only be handed one that had been
 * uploaded somewhere else. This turns a file the operator picked into such a
 * URL, so the two halves of "add a banner" happen on one screen.
 *
 * What comes back may be relative (`/uploads/ads/x.jpg`), because the API and
 * the files it serves share an origin. `mediaUrl` makes it absolute, the same
 * way it does for the paths already stored on existing rows.
 */

import { api } from '@/data/http/client';
import { mediaUrl } from '@/lib/media';
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
  const url = mediaUrl(raw);
  if (!url) throw new Error('السيرفر ما رجّع رابط الصورة بعد الرفع.');
  return url;
}

export class HttpUploadsRepository implements UploadsRepository {
  async image(file: File, signal?: AbortSignal): Promise<string> {
    const uploaded = await api.upload<UploadedFile | string>('/uploads', file, 'file', signal);
    return resolveUrl(uploaded);
  }
}
