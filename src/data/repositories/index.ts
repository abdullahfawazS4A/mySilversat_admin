/**
 * THE WIRING POINT.
 *
 * This file is the only place that knows which implementation backs each
 * repository interface. Switching the console from mock data to a real API is
 * a change to this file and nothing else:
 *
 *   export function createRepositories(): Repositories {
 *     const http = new HttpClient(import.meta.env.VITE_API_BASE);
 *     return {
 *       auth: new HttpAuthRepository(http),
 *       catalog: new HttpCatalogRepository(http),
 *       ...
 *     };
 *   }
 *
 * No screen, component or hook imports a Mock* class directly — they take the
 * repositories from React context. Keep it that way.
 */

import type { Repositories } from './types';
import { MockAuthRepository } from './mock/auth';
import { MockCatalogRepository } from './mock/catalog';
import { MockUsersRepository } from './mock/users';
import { MockDevicesRepository } from './mock/devices';
import { MockRenewalsRepository } from './mock/renewals';
import { MockMatchesRepository } from './mock/matches';
import { MockLeaderboardRepository } from './mock/leaderboard';
import { MockDrawsRepository } from './mock/draws';
import { MockContentRepository } from './mock/content';
import {
  MockAdminRepository,
  MockAgentsRepository,
  MockNotificationsRepository,
} from './mock/misc';

/** Builds the repository bundle the whole app runs on. */
export function createRepositories(): Repositories {
  return {
    auth: new MockAuthRepository(),
    catalog: new MockCatalogRepository(),
    users: new MockUsersRepository(),
    devices: new MockDevicesRepository(),
    renewals: new MockRenewalsRepository(),
    matches: new MockMatchesRepository(),
    leaderboard: new MockLeaderboardRepository(),
    draws: new MockDrawsRepository(),
    content: new MockContentRepository(),
    notifications: new MockNotificationsRepository(),
    agents: new MockAgentsRepository(),
    admin: new MockAdminRepository(),
  };
}

export type { Repositories } from './types';
