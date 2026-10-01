/**
 * Predictions and scoring.
 *
 * Scoring is the API's job, and it does it by itself: a fixture is scored when
 * it finishes, paying 25 for an exact scoreline and 10 for the right outcome.
 * `scorePending` is the catch-up for when that did not happen. It only touches
 * rows whose `pointsEarned` is still null, so calling it twice cannot
 * double-pay — and for the same reason it cannot re-pay a corrected score.
 *
 * `stats` reads `/predictions/stats`, which counts the home-win / draw /
 * away-win split and the most-picked scorelines on the server.
 */

import { api } from '@/data/http/client';
import type { Id, ListQuery, MatchPredictionStats, Page, Prediction } from '@/types';
import type { PredictionsRepository } from '../types';
import { clean, toPage, toRange } from './crud';

/** What `/predictions/stats` returns, the fields the dialog reads. */
interface PredictionStatsResponse {
  total: number;
  homeWinCount: number;
  drawCount: number;
  awayWinCount: number;
  topScorelines: { home: number; away: number; count: number }[];
}

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
    const stats = await api.get<PredictionStatsResponse>('/predictions/stats', { matchId });
    return {
      matchId,
      total: stats.total,
      homeWin: stats.homeWinCount,
      draw: stats.drawCount,
      awayWin: stats.awayWinCount,
      topScorelines: stats.topScorelines,
    };
  }

  async scorePending(): Promise<{ scored: number }> {
    const raw = await api.post<unknown>('/predictions/score/pending');
    return { scored: scoredCount(raw) };
  }
}
