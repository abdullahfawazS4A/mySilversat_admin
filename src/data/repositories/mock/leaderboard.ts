/**
 * Mock leaderboard and seasons.
 *
 * The app promises users that the ranking resets at the start of each month.
 * That promise is implemented here as a season: closing one freezes its board
 * and opens a fresh one, so historic standings stay auditable instead of being
 * overwritten.
 */

import type { Id, LeaderboardRow, ListQuery, Page, Season } from '@/types';
import type { LeaderboardRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, newId } from '@/lib/utils';
import { paginate, requireById } from './helpers';
import { recomputePoints } from './users';

export class MockLeaderboardRepository implements LeaderboardRepository {
  seasons(): Promise<Season[]> {
    return mockDb.read(() =>
      [...mockDb.tables.seasons].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    );
  }

  async activeSeason(): Promise<Season> {
    await mockDb.latency();
    const season = mockDb.tables.seasons.find((s) => s.active);
    if (!season) throw new Error('لا يوجد موسم فعّال');
    return season;
  }

  async leaderboard(
    seasonId: Id,
    query: ListQuery & { governorateId?: Id },
  ): Promise<Page<LeaderboardRow>> {
    await mockDb.latency();

    // Totals come from the ledger, not the cached field, so a season other than
    // the active one still produces a correct historic board.
    const totals = new Map<string, number>();
    for (const entry of mockDb.tables.pointsEntries) {
      if (entry.seasonId !== seasonId) continue;
      totals.set(entry.userId, (totals.get(entry.userId) ?? 0) + entry.delta);
    }

    let rows: LeaderboardRow[] = [...totals.entries()]
      .map(([userId, points]) => {
        const user = mockDb.tables.users.find((u) => u.id === userId);
        const picks = mockDb.tables.predictions.filter(
          (p) => p.userId === userId && p.outcome !== 'pending',
        );
        const hits = picks.filter((p) => p.outcome === 'exact' || p.outcome === 'goaldiff' || p.outcome === 'result');
        return {
          rank: 0,
          userId,
          name: user?.fullName ?? '—',
          governorateId: user?.governorateId ?? '',
          points: Math.max(0, points),
          accuracy: picks.length ? hits.length / picks.length : 0,
          predictionCount: picks.length,
        };
      })
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points);

    // Rank before filtering, so a governorate filter still shows true positions.
    rows.forEach((row, index) => {
      row.rank = index + 1;
    });

    if (query.governorateId) rows = rows.filter((r) => r.governorateId === query.governorateId);
    if (query.search?.trim()) rows = rows.filter((r) => matchesSearch(r.name, query.search!));

    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<LeaderboardRow>;
  }

  async closeSeason(seasonId: Id, nextNameAr: string): Promise<Season> {
    await mockDb.latency();
    const season = requireById(mockDb.tables.seasons, seasonId, 'الموسم');
    if (!season.active) throw new Error('هذا الموسم مغلق مسبقاً');

    season.active = false;
    season.closedAt = new Date().toISOString();

    const start = new Date();
    const next: Season = {
      id: newId('ssn'),
      nameAr: nextNameAr,
      startsAt: new Date(start.getFullYear(), start.getMonth(), 1).toISOString(),
      endsAt: new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59).toISOString(),
      active: true,
      closedAt: null,
    };
    mockDb.tables.seasons.push(next);

    // Everyone starts the new season at zero; historic entries stay attached to
    // the closed season so the old board is still readable.
    for (const user of mockDb.tables.users) {
      user.points = 0;
      user.rank = null;
    }

    mockDb.audit('run', 'season', season.id, `إغلاق ${season.nameAr} وفتح ${next.nameAr}`);
    return next;
  }

  async resetPoints(seasonId: Id, reasonAr: string): Promise<void> {
    await mockDb.latency();
    const season = requireById(mockDb.tables.seasons, seasonId, 'الموسم');
    const affected = new Set(
      mockDb.tables.pointsEntries.filter((e) => e.seasonId === seasonId).map((e) => e.userId),
    );

    // Zero the board with a compensating ledger entry per user rather than by
    // deleting history — a customer can still be shown where their points went.
    const now = new Date().toISOString();
    for (const userId of affected) {
      const balance = mockDb.tables.pointsEntries
        .filter((e) => e.userId === userId && e.seasonId === seasonId)
        .reduce((sum, e) => sum + e.delta, 0);
      if (balance === 0) continue;
      mockDb.tables.pointsEntries.push({
        id: newId('pts'),
        userId,
        seasonId,
        delta: -balance,
        kind: 'season_reset',
        reasonAr,
        adminId: mockDb.currentAdmin?.id,
        createdAt: now,
      });
      recomputePoints(userId);
    }

    mockDb.audit('run', 'season', seasonId, `تصفير نقاط ${season.nameAr} — ${reasonAr}`);
  }
}
