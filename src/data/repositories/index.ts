/**
 * THE WIRING POINT.
 *
 * The only file that knows which implementation backs each repository. Every
 * screen reads its data through `useRepos()`, so pointing the console at a
 * different backend — a staging API, a set of fakes in a test — is a change
 * here and nowhere else.
 *
 * The base URL comes from `VITE_API_BASE` (see `.env.example`); the HTTP
 * client reads it once at module load.
 */

import type { Repositories } from './types';
import { HttpAuthRepository } from './http/auth';
import { HttpGeoRepository } from './http/geo';
import { HttpRegionsRepository } from './http/regions';
import { HttpCatalogRepository } from './http/catalog';
import { HttpStockRepository } from './http/stock';
import { HttpAppUsersRepository } from './http/appUsers';
import { HttpDevicesRepository } from './http/devices';
import { HttpMatchesRepository } from './http/matches';
import { HttpPredictionsRepository } from './http/predictions';
import { HttpSyncRepository } from './http/sync';
import { HttpNotificationsRepository } from './http/notifications';
import { HttpContentRepository } from './http/content';
import { HttpSilversatRepository } from './http/silversat';
import { HttpDashboardRepository } from './http/dashboard';

/** Builds the repository bundle the whole console runs on. */
export function createRepositories(): Repositories {
  return {
    auth: new HttpAuthRepository(),
    geo: new HttpGeoRepository(),
    regions: new HttpRegionsRepository(),
    catalog: new HttpCatalogRepository(),
    stock: new HttpStockRepository(),
    appUsers: new HttpAppUsersRepository(),
    devices: new HttpDevicesRepository(),
    matches: new HttpMatchesRepository(),
    predictions: new HttpPredictionsRepository(),
    sync: new HttpSyncRepository(),
    notifications: new HttpNotificationsRepository(),
    content: new HttpContentRepository(),
    silversat: new HttpSilversatRepository(),
    dashboard: new HttpDashboardRepository(),
  };
}

export type { Repositories } from './types';
