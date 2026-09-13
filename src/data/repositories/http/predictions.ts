/**
 * Predictions and scoring.
 *
 * Scoring is the API's job — `/predictions/score/match/{id}` walks a finished
 * match's unscored picks and pays 25 for an exact scoreline, 10 for the right
 * outcome. It only touches rows whose `pointsEarned` is still null, so calling
 * it twice cannot double-pay.
 *
 * `stats` has no endpoint behind it; the distribution is computed from the
 * match's own picks, which is cheap because `/predictions?matchId=` is already
 * filtered server-side.
 */

import { api, fetchAll } from '@/data/http/client';
import type { Id, ListQuery, MatchPredictionStats, Page, Prediction } from '@/types';
import type { PredictionsRepository } from '../types';
import { clean, toPage, toRange } from './crud';

/** Reads a scored count out of whatever shape the score route returned. */
function scoredCount(raw: unknown): number {
  const body = (raw ?? {}) as Record<string, unknown>;
  for (const key of ['scored', 'count', 'updated', 'total']) {
    if (typeof body[key] === 'number') return body[key] as number;
  }
  return 0;
}

export class HttpPredictionsRepository implements PredictionsRepository {
  async list(query?: ListQuery & { appUserId?: Id; matchId?: Id }): Promise<Page<Prediction>> {
    const { search, page, pageSize, ...filter } = query ?? {};

    // No text search server-side, so a search reads the filtered set and cuts.
    if (search?.trim()) {
      const needle = search.trim().toLowerCase();
      const rows = (await fetchAll<Prediction>('/predictions', clean(filter), 5000)).filter(
        (row) =>
          (row.appUser?.name ?? '').toLowerCase().includes(needle) ||
          (row.appUser?.phone ?? '').includes(needle) ||
          (row.match?.homeTeam?.name ?? '').toLowerCase().includes(needle) ||
          (row.match?.awayTeam?.name ?? '').toLowerCase().includes(needle),
      );
      const { limit, offset } = toRange({ page, pageSize });
      return toPage(rows.slice(offset, offset + limit), rows.length, { page, pageSize });
    }

    const result = await api.page<Prediction>('/predictions', {
      ...clean(filter),
      ...toRange({ page, pageSize }),
    });
    return toPage(result.items, result.total, { page, pageSize });
  }

  async remove(id: Id): Promise<void> {
    await api.delete(`/predictions/${id}`);
  }

  async stats(matchId: Id): Promise<MatchPredictionStats> {
    const rows = await fetchAll<Prediction>('/predictions', { matchId }, 5000);

    const scorelines = new Map<string, number>();
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;

    for (const row of rows) {
      const { predictedHomeScore: home, predictedAwayScore: away } = row;
      if (home > away) homeWin += 1;
      else if (home < away) awayWin += 1;
      else draw += 1;

      const key = `${home}-${away}`;
      scorelines.set(key, (scorelines.get(key) ?? 0) + 1);
    }

    const topScorelines = [...scorelines.entries()]
      .map(([key, count]) => {
        const [home, away] = key.split('-').map(Number);
        return { home, away, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { matchId, total: rows.length, homeWin, draw, awayWin, topScorelines };
  }

  async scoreMatch(matchId: Id): Promise<{ scored: number }> {
    const raw = await api.post<unknown>(`/predictions/score/match/${matchId}`);
    return { scored: scoredCount(raw) };
  }

  async scorePending(): Promise<{ scored: number }> {
    const raw = await api.post<unknown>('/predictions/score/pending');
    return { scored: scoredCount(raw) };
  }
}
