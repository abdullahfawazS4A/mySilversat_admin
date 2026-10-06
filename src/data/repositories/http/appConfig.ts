/**
 * The app's update gate.
 *
 * One row on the server, read by the app before sign-in and replaced whole by
 * the console — `PUT`, not `PATCH`, so both platforms go up on every save.
 */

import { api } from '@/data/http/client';
import type { AppVersionConfig } from '@/types';
import type { AppConfigRepository } from '../types';

export class HttpAppConfigRepository implements AppConfigRepository {
  version(): Promise<AppVersionConfig> {
    return api.get<AppVersionConfig>('/app-config/version');
  }

  updateVersion(config: AppVersionConfig): Promise<AppVersionConfig> {
    return api.put<AppVersionConfig>('/app-config/version', config);
  }
}
