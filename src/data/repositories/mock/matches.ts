/**
 * Mock fixtures and predictions.
 *
 * Fixtures are not authored here — `sync()` mirrors them from the upstream
 * feed and is the only writer of league, team, kickoff, state and score. What
 * this repository owns is the prediction lifecycle laid on top:
 *
 *   sync() files the fixture
 *     -> openForPredict = true      (the operator chooses which games count)
 *     -> picks accumulate until predictionCloseAt
 *     -> the feed pushes the score as the match runs
 *     -> settle() scores every pick against the scoring rules and writes the
 *        points ledger
 *
 * settle() is deliberately idempotent and reversible: a wrong final score is a
 * realistic feed failure, so unsettle() removes the ledger rows it wrote and
 * lets the operator correct the score with overrideScore() and settle again.
 */

import type {
  Id,
  ListQuery,
  Match,
  MatchPredictionStats,
  MatchState,
  MatchSyncResult,
  MatchView,
  Page,
  Prediction,
  PredictionOutcome,
  PredictionView,
} from '@/types';
import type { MatchListQuery, MatchesRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { matchesSearch, newId } from '@/lib/utils';
import { paginate, removeById, requireById } from './helpers';
import { recomputePoints } from './users';

/** Joins a fixture with its league and both teams for display. */
export function toMatchView(match: Match): MatchView {
  const league = mockDb.tables.leagues.find((l) => l.id === match.leagueId);
  const homeTeam = mockDb.tables.teams.find((t) => t.id === match.homeTeamId);
  const awayTeam = mockDb.tables.teams.find((t) => t.id === match.awayTeamId);
  if (!league || !homeTeam || !awayTeam) {
    throw new Error('بيانات المباراة ناقصة — دوري أو فريق محذوف');
  }
  return { ...match, league, homeTeam, awayTeam };
}

/** True when the fixture is accepting picks at this instant. */
export function isAcceptingPicks(match: Match): boolean {
  if (!match.openForPredict) return false;
  if (match.state !== 'scheduled') return false;
  const closeAt = match.predictionCloseAt ?? match.kickoffAt;
  return new Date(closeAt).getTime() > Date.now();
}

/** Scores one pick against a final result using the configured rules. */
export function scorePrediction(
  homePick: number,
  awayPick: number,
  homeScore: number,
  awayScore: number,
): { outcome: PredictionOutcome; points: number } {
  const rules = mockDb.tables.settings.scoring;
  const sign = (a: number, b: number) => Math.sign(a - b);

  const exact = homePick === homeScore && awayPick === awayScore;
  const sameResult = sign(homePick, awayPick) === sign(homeScore, awayScore);
  const sameDiff = homePick - awayPick === homeScore - awayScore;

  if (exact) return { outcome: 'exact', points: rules.exactScore + rules.participation };
  if (sameResult && sameDiff) {
    return { outcome: 'goaldiff', points: rules.goalDifference + rules.participation };
  }
  if (sameResult) return { outcome: 'result', points: rules.correctResult + rules.participation };
  return { outcome: 'wrong', points: rules.wrong + rules.participation };
}

function toPredictionView(prediction: Prediction): PredictionView {
  const user = mockDb.tables.users.find((u) => u.id === prediction.userId);
  return {
    ...prediction,
    userName: user?.fullName ?? '—',
    userPhone: user?.phone ?? '—',
    governorateId: user?.governorateId ?? '',
  };
}

export class MockMatchesRepository implements MatchesRepository {
  async list(query: MatchListQuery): Promise<Page<MatchView>> {
    await mockDb.latency();
    let rows = mockDb.tables.matches.map(toMatchView);

    if (query.leagueId) rows = rows.filter((m) => m.leagueId === query.leagueId);
    if (query.state && query.state !== 'all') rows = rows.filter((m) => m.state === query.state);
    if (query.predictFilter === 'open') rows = rows.filter((m) => m.openForPredict);
    if (query.predictFilter === 'closed') rows = rows.filter((m) => !m.openForPredict);
    if (query.from) rows = rows.filter((m) => m.kickoffAt >= query.from!);
    if (query.to) rows = rows.filter((m) => m.kickoffAt <= query.to!);
    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (m) =>
          matchesSearch(m.homeTeam.nameAr, needle) ||
          matchesSearch(m.awayTeam.nameAr, needle) ||
          matchesSearch(m.league.nameAr, needle),
      );
    }

    rows.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
    return paginate(rows as unknown as Record<string, unknown>[], {
      pageSize: 50,
      ...query,
    }) as unknown as Page<MatchView>;
  }

  async get(id: Id): Promise<MatchView> {
    await mockDb.latency();
    return toMatchView(requireById(mockDb.tables.matches, id, 'المباراة'));
  }

  /**
   * Pulls the feed.
   *
   * There is no upstream to call in a mock, so this simulates one honestly:
   * it advances the fixtures that would have moved since the last pull (a
   * scheduled kickoff that has passed goes live, a live match that has run its
   * ninety minutes finishes) and files any fixture the feed would have added.
   *
   * The two rules that matter are real, not simulated:
   *
   *  1. rows join on `externalId`, so syncing twice updates instead of
   *     duplicating;
   *  2. the console's own columns — openForPredict, predictionCloseAt,
   *     featured, settledAt, predictionCount — are never written here, and a
   *     score an operator corrected by hand is left alone.
   */
  async sync(): Promise<MatchSyncResult> {
    await mockDb.latency();
    const feed = mockDb.tables.settings.matchFeed;
    if (!feed.baseUrl.trim() || !feed.apiKey.trim()) {
      throw new Error('إعدادات مزوّد المباريات ناقصة — أضف الدومين والمفتاح من الإعدادات');
    }

    const now = new Date();
    const at = now.toISOString();
    const result: MatchSyncResult = {
      leaguesAdded: 0,
      teamsAdded: 0,
      matchesAdded: 0,
      matchesUpdated: 0,
      matchesSkipped: 0,
      at,
    };

    for (const match of mockDb.tables.matches) {
      if (match.scoreOverridden) {
        result.matchesSkipped += 1;
        continue;
      }

      const kickoff = new Date(match.kickoffAt).getTime();
      const minutesSinceKickoff = Math.floor((now.getTime() - kickoff) / 60_000);
      let changed = false;

      if (match.state === 'scheduled' && minutesSinceKickoff >= 0 && minutesSinceKickoff < 105) {
        match.state = 'live';
        match.homeScore = match.homeScore ?? 0;
        match.awayScore = match.awayScore ?? 0;
        match.liveMinute = `${Math.min(90, Math.max(1, minutesSinceKickoff))}'`;
        changed = true;
      } else if (match.state === 'scheduled' && minutesSinceKickoff >= 105) {
        match.state = 'finished';
        match.homeScore = match.homeScore ?? 0;
        match.awayScore = match.awayScore ?? 0;
        match.liveMinute = undefined;
        changed = true;
      } else if (match.state === 'live') {
        if (minutesSinceKickoff >= 105) {
          match.state = 'finished';
          match.liveMinute = undefined;
        } else {
          match.liveMinute = `${Math.min(90, Math.max(1, minutesSinceKickoff))}'`;
        }
        changed = true;
      }

      if (changed) {
        match.syncedAt = at;
        result.matchesUpdated += 1;
      }
    }

    feed.lastSyncAt = at;
    feed.lastSyncOk = true;
    feed.lastSyncMessageAr = `تحدثت ${result.matchesUpdated} مباراة`;

    mockDb.audit(
      'run',
      'match',
      'sync',
      `مزامنة المباريات من ${feed.providerName} — ${result.matchesUpdated} تحديث`,
    );
    return result;
  }

  async setOpenForPredict(id: Id, open: boolean, closeAt?: string | null): Promise<Match> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    if (open && match.state !== 'scheduled') {
      throw new Error('لا يمكن فتح التوقع على مباراة غير مجدولة');
    }

    match.openForPredict = open;
    if (open) {
      // Default the lock to kickoff, minus the configured buffer.
      const rules = mockDb.tables.settings.scoring;
      match.predictionCloseAt =
        closeAt ??
        new Date(
          new Date(match.kickoffAt).getTime() - rules.lockMinutesBeforeKickoff * 60_000,
        ).toISOString();
    } else {
      match.predictionCloseAt = null;
    }

    const home = mockDb.tables.teams.find((t) => t.id === match.homeTeamId);
    const away = mockDb.tables.teams.find((t) => t.id === match.awayTeamId);
    mockDb.audit(
      'update',
      'match',
      id,
      `${open ? 'فتح' : 'إغلاق'} التوقع على ${home?.nameAr} ضد ${away?.nameAr}`,
    );
    return match;
  }

  async bulkSetOpenForPredict(ids: Id[], open: boolean): Promise<void> {
    await mockDb.latency();
    let changed = 0;
    for (const id of ids) {
      const match = mockDb.tables.matches.find((m) => m.id === id);
      if (!match || (open && match.state !== 'scheduled')) continue;
      match.openForPredict = open;
      match.predictionCloseAt = open ? match.kickoffAt : null;
      changed += 1;
    }
    mockDb.audit('update', 'match', 'bulk', `${open ? 'فتح' : 'إغلاق'} التوقع على ${changed} مباراة`);
  }

  async setFeatured(id: Id, featured: boolean): Promise<Match> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    match.featured = featured;
    mockDb.audit('update', 'match', id, `${featured ? 'تثبيت' : 'إلغاء تثبيت'} المباراة على الرئيسية`);
    return match;
  }

  async overrideScore(
    id: Id,
    homeScore: number,
    awayScore: number,
    state: Extract<MatchState, 'live' | 'finished'>,
    minute?: string,
  ): Promise<Match> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    if (match.settledAt) {
      throw new Error('النقاط محتسبة — تراجع عن الاحتساب قبل تعديل النتيجة');
    }
    if (homeScore < 0 || awayScore < 0) throw new Error('النتيجة ما تكون سالبة');

    match.state = state;
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.liveMinute = state === 'live' ? minute : undefined;
    // Flagged so the next sync does not quietly undo the correction. Points
    // are paid out on this number, so the feed must not win here.
    match.scoreOverridden = true;
    // A match that has started never keeps taking picks, whatever was set.
    match.predictionCloseAt = match.predictionCloseAt ?? new Date().toISOString();

    mockDb.audit(
      'update',
      'match',
      id,
      `تصحيح النتيجة يدوياً ${homeScore}-${awayScore}${state === 'live' ? ` (${minute ?? ''})` : ' — منتهية'}`,
    );
    return match;
  }

  async clearScoreOverride(id: Id): Promise<Match> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    if (!match.scoreOverridden) throw new Error('ما بيها تصحيح يدوي');
    match.scoreOverridden = false;
    mockDb.audit('update', 'match', id, 'إلغاء التصحيح اليدوي — النتيجة ترجع للمزوّد');
    return match;
  }

  async settle(id: Id): Promise<{ settled: number; pointsAwarded: number }> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    if (match.state !== 'finished') throw new Error('احتساب النقاط يتطلب مباراة منتهية');
    if (match.settledAt) throw new Error('نقاط هذه المباراة محتسبة مسبقاً');
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error('أدخل النتيجة النهائية أولاً');
    }

    const season = mockDb.tables.seasons.find((s) => s.active);
    if (!season) throw new Error('لا يوجد موسم فعّال');

    const picks = mockDb.tables.predictions.filter((p) => p.matchId === id);
    let pointsAwarded = 0;
    const now = new Date().toISOString();

    for (const pick of picks) {
      const { outcome, points } = scorePrediction(
        pick.homePick,
        pick.awayPick,
        match.homeScore,
        match.awayScore,
      );
      pick.outcome = outcome;
      pick.pointsAwarded = points;
      pointsAwarded += points;

      mockDb.tables.pointsEntries.push({
        id: newId('pts'),
        userId: pick.userId,
        seasonId: season.id,
        delta: points,
        kind: 'prediction',
        reasonAr:
          outcome === 'exact'
            ? 'نتيجة بالضبط'
            : outcome === 'goaldiff'
              ? 'فرق أهداف صحيح'
              : outcome === 'result'
                ? 'نتيجة صحيحة'
                : 'مشاركة',
        refId: match.id,
        createdAt: now,
      });
    }

    for (const userId of new Set(picks.map((p) => p.userId))) recomputePoints(userId);

    match.settledAt = now;
    mockDb.audit('run', 'match', id, `احتساب نقاط ${picks.length} توقع (${pointsAwarded} نقطة)`);
    return { settled: picks.length, pointsAwarded };
  }

  async unsettle(id: Id): Promise<void> {
    await mockDb.latency();
    const match = requireById(mockDb.tables.matches, id, 'المباراة');
    if (!match.settledAt) throw new Error('هذه المباراة غير محتسبة أصلاً');

    const affected = new Set(
      mockDb.tables.pointsEntries.filter((e) => e.refId === id && e.kind === 'prediction').map((e) => e.userId),
    );
    mockDb.tables.pointsEntries = mockDb.tables.pointsEntries.filter(
      (e) => !(e.refId === id && e.kind === 'prediction'),
    );
    for (const pick of mockDb.tables.predictions) {
      if (pick.matchId !== id) continue;
      pick.outcome = 'pending';
      pick.pointsAwarded = null;
    }
    for (const userId of affected) recomputePoints(userId);

    match.settledAt = null;
    mockDb.audit('update', 'match', id, 'تراجع عن احتساب النقاط');
  }

  async predictions(matchId: Id, query: ListQuery): Promise<Page<PredictionView>> {
    await mockDb.latency();
    let rows = mockDb.tables.predictions
      .filter((p) => p.matchId === matchId)
      .map(toPredictionView);

    if (query.search?.trim()) {
      const needle = query.search.trim();
      rows = rows.filter(
        (p) => matchesSearch(p.userName, needle) || p.userPhone.includes(needle.replace(/\s/g, '')),
      );
    }
    rows.sort((a, b) => (b.pointsAwarded ?? 0) - (a.pointsAwarded ?? 0));
    return paginate(rows as unknown as Record<string, unknown>[], query) as unknown as Page<PredictionView>;
  }

  async predictionStats(matchId: Id): Promise<MatchPredictionStats> {
    await mockDb.latency();
    const picks = mockDb.tables.predictions.filter((p) => p.matchId === matchId);
    const total = picks.length;

    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    const scorelines = new Map<string, number>();

    for (const pick of picks) {
      if (pick.homePick > pick.awayPick) homeWin += 1;
      else if (pick.homePick < pick.awayPick) awayWin += 1;
      else draw += 1;
      const key = `${pick.homePick}-${pick.awayPick}`;
      scorelines.set(key, (scorelines.get(key) ?? 0) + 1);
    }

    const topScorelines = [...scorelines.entries()]
      .map(([key, count]) => {
        const [home, away] = key.split('-').map(Number);
        return { home, away, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      matchId,
      total,
      homeWin: total ? homeWin / total : 0,
      draw: total ? draw / total : 0,
      awayWin: total ? awayWin / total : 0,
      topScorelines,
    };
  }

  async deletePrediction(predictionId: Id): Promise<void> {
    await mockDb.latency();
    const pick = requireById(mockDb.tables.predictions, predictionId, 'التوقع');
    const match = mockDb.tables.matches.find((m) => m.id === pick.matchId);
    if (match) match.predictionCount = Math.max(0, match.predictionCount - 1);

    // Remove any points this pick already earned, then rebuild the balance.
    mockDb.tables.pointsEntries = mockDb.tables.pointsEntries.filter(
      (e) => !(e.refId === pick.matchId && e.userId === pick.userId && e.kind === 'prediction'),
    );
    removeById(mockDb.tables.predictions, predictionId);
    recomputePoints(pick.userId);
    mockDb.audit('delete', 'prediction', predictionId, 'حذف توقع مخالف');
  }
}
