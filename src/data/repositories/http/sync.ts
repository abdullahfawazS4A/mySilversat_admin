/**
 * The API-Football mirror.
 *
 * Leagues, teams and fixtures enter the system only through these four calls —
 * there is no "add fixture" anywhere in the console, by design.
 *
 * Order matters when seeding from empty: leagues, then teams (which need a
 * league with an `externalId`), then fixtures. The sync screen runs them in
 * that order for exactly that reason.
 *
 * Every call spends provider quota, which is why `status()` exists and why the
 * screen shows the remaining requests next to the buttons.
 */

import { api } from '@/data/http/client';
import type { ApiFootballConfig, ApiFootballStatus, SyncResult } from '@/types';
import type { SyncRepository } from '../types';

export class HttpSyncRepository implements SyncRepository {
  config(): Promise<ApiFootballConfig> {
    return api.get<ApiFootballConfig>('/api-football/config');
  }

  status(): Promise<ApiFootballStatus> {
    return api.get<ApiFootballStatus>('/api-football/status');
  }

  syncLeagues(): Promise<SyncResult> {
    return api.post<SyncResult>('/api-football/sync/leagues');
  }

  syncTeams(): Promise<SyncResult> {
    return api.post<SyncResult>('/api-football/sync/teams');
  }

  syncFixtures(): Promise<SyncResult> {
    return api.post<SyncResult>('/api-football/sync/fixtures');
  }

  syncLive(): Promise<SyncResult> {
    return api.post<SyncResult>('/api-football/sync/live');
  }
}
