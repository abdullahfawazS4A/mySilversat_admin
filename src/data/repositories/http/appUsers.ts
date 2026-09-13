/**
 * App users — the customers.
 *
 * Two things the API does not do for us are done here:
 *
 *  - **`detail`** fans out to devices, predictions and purchased codes so the
 *    detail screen mounts with one call instead of four waterfalls.
 *  - **`leaderboard`** does not exist for admins. `/app-auth/leaderboard` is
 *    app-user-scoped and 401s on an admin token, so the board is built by
 *    ranking `/app-users` on the `points` column — which is the same column
 *    the app's own board reads.
 */

import { api, fetchAll } from '@/data/http/client';
import type { AppUser, Code, Device, Id, LeaderboardRow, ListQuery, Page, Prediction } from '@/types';
import type { AppUserDetail, AppUserFilter, AppUserInput, AppUsersRepository } from '../types';
import { HttpCrudRepository, localPage, toPage, toRange } from './crud';

export class HttpAppUsersRepository
  extends HttpCrudRepository<AppUser, AppUserInput, Partial<AppUserInput>, AppUserFilter>
  implements AppUsersRepository
{
  constructor() {
    super('/app-users', (row) => `${row.name} ${row.phone} ${row.email ?? ''} ${row.province?.name ?? ''}`);
  }

  /**
   * Lists users, narrowing by province and block state.
   *
   * `/app-users` takes neither filter, so an unfiltered page is served
   * straight from the API and a filtered one is built from every row. The
   * split matters: the common case stays a single paged request.
   */
  async list(query?: ListQuery & AppUserFilter): Promise<Page<AppUser>> {
    const { provinceId, isBlocked, ...rest } = query ?? {};
    if (provinceId === undefined && isBlocked === undefined) return super.list(rest);

    const rows = this.narrow(await fetchAll<AppUser>('/app-users'), { provinceId, isBlocked });
    return localPage(rows, rest, (row) => `${row.name} ${row.phone} ${row.email ?? ''}`);
  }

  async all(filter?: AppUserFilter): Promise<AppUser[]> {
    return this.narrow(await fetchAll<AppUser>('/app-users'), filter);
  }

  private narrow(rows: AppUser[], filter: AppUserFilter | undefined): AppUser[] {
    return rows.filter(
      (row) =>
        (filter?.provinceId === undefined || row.provinceId === filter.provinceId) &&
        (filter?.isBlocked === undefined || row.isBlocked === filter.isBlocked),
    );
  }

  async detail(id: Id): Promise<AppUserDetail> {
    const [user, devices, predictions, purchases] = await Promise.all([
      this.get(id),
      fetchAll<Device>('/devices/all', { appUserId: id }),
      fetchAll<Prediction>('/predictions', { appUserId: id }, 500),
      // No `soldTo` filter exists, so the sold codes are scanned and matched.
      fetchAll<Code>('/codes', { status: 'sold' }, 5000).then((codes) =>
        codes.filter((code) => code.soldToAppUserId === id),
      ),
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
   * Ranks every user on points.
   *
   * Ties keep the same rank, so two users on 40 points are both 3rd and the
   * next one is 5th — the ordering the app shows. Accuracy needs the
   * predictions table, which is fetched once and bucketed by user rather than
   * queried per row.
   */
  async leaderboard(query?: ListQuery & { provinceId?: Id }): Promise<Page<LeaderboardRow>> {
    const [users, predictions] = await Promise.all([
      fetchAll<AppUser>('/app-users'),
      fetchAll<Prediction>('/predictions', undefined, 5000),
    ]);

    const counts = new Map<Id, { total: number; scored: number; won: number }>();
    for (const prediction of predictions) {
      const bucket = counts.get(prediction.appUserId) ?? { total: 0, scored: 0, won: 0 };
      bucket.total += 1;
      if (prediction.pointsEarned !== null) {
        bucket.scored += 1;
        if (prediction.pointsEarned > 0) bucket.won += 1;
      }
      counts.set(prediction.appUserId, bucket);
    }

    const scoped = query?.provinceId
      ? users.filter((user) => user.provinceId === query.provinceId)
      : users;

    const needle = query?.search?.trim()?.toLowerCase();
    const filtered = needle
      ? scoped.filter(
          (user) =>
            user.name.toLowerCase().includes(needle) || user.phone.includes(needle),
        )
      : scoped;

    const ranked = [...filtered]
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ar'))
      .map((user, index, all): LeaderboardRow => {
        const stats = counts.get(user.id) ?? { total: 0, scored: 0, won: 0 };
        // Equal points share the first index that reached them.
        const tiedWith = all.findIndex((other) => other.points === user.points);
        return {
          rank: (tiedWith === -1 ? index : tiedWith) + 1,
          user,
          points: user.points,
          predictionCount: stats.total,
          accuracy: stats.scored ? stats.won / stats.scored : 0,
        };
      });

    const { limit, offset } = toRange(query);
    return toPage(ranked.slice(offset, offset + limit), ranked.length, query);
  }
}
