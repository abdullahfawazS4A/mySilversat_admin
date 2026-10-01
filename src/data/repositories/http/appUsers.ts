/**
 * App users — the customers.
 *
 * `/app-users` searches (name, phone, email) and filters by province and block
 * state itself, and `/app-users/leaderboard` ranks users with their prediction
 * counts and accuracy. What is left here:
 *
 *  - **`detail`** fans out to devices, predictions and purchased codes so the
 *    detail screen mounts with one call instead of four waterfalls.
 *  - **`leaderboard`** reshapes the route's flat rows into `LeaderboardRow`.
 */

import { api, fetchAll } from '@/data/http/client';
import type { AppUser, Code, Device, Id, LeaderboardRow, ListQuery, Page, Prediction } from '@/types';
import type { AppUserDetail, AppUserFilter, AppUserInput, AppUsersRepository } from '../types';
import { HttpCrudRepository, clean, toPage, toRange } from './crud';

/** A row of `/app-users/leaderboard`, as measured against the live API. */
interface LeaderboardEntry {
  rank: number;
  id: Id;
  name: string;
  phone: string;
  points: number;
  predictionCount: number;
  accuracy: number;
  provinceId: Id | null;
  provinceName: string | null;
}

export class HttpAppUsersRepository
  extends HttpCrudRepository<AppUser, AppUserInput, Partial<AppUserInput>, AppUserFilter>
  implements AppUsersRepository
{
  protected readonly serverSearch = true;

  constructor() {
    super(
      '/app-users',
      (row) =>
        `${row.name} ${row.phone} ${row.email ?? ''} ${row.silversatRegion?.name ?? ''} ${row.silversatRegion?.province?.name ?? ''}`,
    );
  }

  async detail(id: Id): Promise<AppUserDetail> {
    const [user, devices, predictions, purchases] = await Promise.all([
      this.get(id),
      fetchAll<Device>('/devices/all', { appUserId: id }),
      fetchAll<Prediction>('/predictions', { appUserId: id }, 500),
      fetchAll<Code>('/codes', { status: 'sold', soldToAppUserId: id }),
    ]);

    predictions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    purchases.sort((a, b) => (b.soldAt ?? '').localeCompare(a.soldAt ?? ''));
    return { user, devices, predictions, purchases };
  }

  block(id: Id): Promise<AppUser> {
    return api.patch<AppUser>(`/app-users/${id}/block`);
  }

  unblock(id: Id): Promise<AppUser> {
    return api.patch<AppUser>(`/app-users/${id}/unblock`);
  }

  /**
   * Users ranked on points, one page at a time.
   *
   * `/app-users/leaderboard` filters, ranks and pages on the server, and each
   * row carries the province of the user's server.
   */
  async leaderboard(query?: ListQuery & { provinceId?: Id }): Promise<Page<LeaderboardRow>> {
    const board = await api.page<LeaderboardEntry>('/app-users/leaderboard', {
      ...clean({ provinceId: query?.provinceId, search: query?.search?.trim() }),
      ...toRange(query),
    });

    return toPage(
      board.items.map(
        (row): LeaderboardRow => ({
          rank: row.rank,
          user: { id: row.id, name: row.name, phone: row.phone },
          provinceName: row.provinceName,
          points: row.points,
          predictionCount: row.predictionCount,
          accuracy: row.accuracy,
        }),
      ),
      board.total,
      query,
    );
  }
}
