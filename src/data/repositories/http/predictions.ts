/**
 * Predictions and scoring.
 *
 * Scoring is the API's job, and it does it by itself: a fixture is scored when
 * it finishes, paying 25 for an exact scoreline and 10 for the right outcome.
 * `scorePending` is the catch-up for when that did not happen. It only touches
 * rows whose `pointsEarned` is still null, so calling it twice cannot
 * double-pay — and for the same reason it cannot re-pay a corrected score.
 *
 * `stats` is computed from the match's own picks rather than read from
 * `/predictions/stats`: that route counts exact / correct / wrong / unscored,
 * and the dialog shows the home-win / draw / away-win split, which it does not
 * return. The read is one match's picks, already filtered server-side.
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
    // `search` matches the user's name and phone and both teams' names.
    const result = await api.page<Prediction>('/predictions', {
      ...clean(filter),
      ...(search?.trim() ? { search: search.trim() } : {}),
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

  async scorePending(): Promise<{ scored: number }> {
    const raw = await api.post<unknown>('/predictions/score/pending');
    return { scored: scoredCount(raw) };
  }
}
