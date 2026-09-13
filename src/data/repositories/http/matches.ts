/**
 * Leagues, teams and fixtures.
 *
 * All three are mirrored from API-Football and carry the provider's
 * `externalId`. The console's own decisions on top of the feed are
 * `isOpenForPrediction` / `predictionClosesAt` and a manual score fix; both are
 * ordinary PATCHes, spelled out here so a screen never has to know which field
 * name the prediction switch maps to.
 *
 * A correction has to land before scoring runs: `/predictions/score/match/{id}`
 * pays out on whatever `homeScore`/`awayScore` say at the moment it is called.
 */

import { api, fetchAll } from '@/data/http/client';
import type { Id, League, ListQuery, Match, MatchStatus, Page, Team } from '@/types';
import type {
  CrudRepository,
  LeagueInput,
  MatchFilter,
  MatchInput,
  MatchesRepository,
  TeamInput,
} from '../types';
import { HttpCrudRepository, localPage } from './crud';

class HttpLeaguesRepository extends HttpCrudRepository<
  League,
  LeagueInput,
  Partial<LeagueInput>,
  { countryId?: Id }
> {
  constructor() {
    super('/leagues', (row) => `${row.name} ${row.country?.name ?? ''}`);
  }
}

class HttpTeamsRepository extends HttpCrudRepository<
  Team,
  TeamInput,
  Partial<TeamInput>,
  { leagueId?: Id }
> {
  constructor() {
    super('/teams', (row) => `${row.name} ${row.league?.name ?? ''}`);
  }
}

class HttpMatchesCollection extends HttpCrudRepository<
  Match,
  MatchInput,
  Partial<MatchInput>,
  MatchFilter
> {
  constructor() {
    super(
      '/matches',
      (row) => `${row.homeTeam?.name ?? ''} ${row.awayTeam?.name ?? ''} ${row.league?.name ?? ''}`,
    );
  }

  /**
   * Lists fixtures, narrowing by whether they are open for predictions.
   *
   * `/matches` filters on league and status but knows nothing about the
   * prediction switch, so that one filter is applied here — over every row,
   * since a page of the wrong rows cannot be re-filtered into the right ones.
   */
  async list(query?: ListQuery & MatchFilter): Promise<Page<Match>> {
    const { isOpenForPrediction, ...rest } = query ?? {};
    if (isOpenForPrediction === undefined) return super.list(rest);

    const { search, page, pageSize, ...filter } = rest;
    const rows = (await fetchAll<Match>('/matches', this.filterQuery(filter), 3000)).filter(
      (row) => row.isOpenForPrediction === isOpenForPrediction,
    );
    return localPage(rows, { search, page, pageSize }, (row) =>
      `${row.homeTeam?.name ?? ''} ${row.awayTeam?.name ?? ''} ${row.league?.name ?? ''}`,
    );
  }

  setOpenForPrediction(id: Id, open: boolean, closesAt?: string | null): Promise<Match> {
    return this.update(id, {
      isOpenForPrediction: open,
      // Only sent when the caller chose a time; otherwise the API keeps its own.
      ...(closesAt === undefined ? {} : { predictionClosesAt: closesAt }),
    });
  }

  /**
   * Runs the toggles in sequence rather than in parallel.
   *
   * A bulk open is a handful of rows an operator selected by hand, and the API
   * rate-limits; a burst of parallel PATCHes buys nothing and can trip it.
   */
  async bulkSetOpenForPrediction(ids: Id[], open: boolean): Promise<void> {
    for (const id of ids) {
      await this.setOpenForPrediction(id, open);
    }
  }

  setScore(
    id: Id,
    homeScore: number,
    awayScore: number,
    status: Extract<MatchStatus, 'live' | 'finished'>,
    currentMinute?: number | null,
  ): Promise<Match> {
    return this.update(id, {
      homeScore,
      awayScore,
      status,
      // A finished match has no clock; clearing it keeps the row consistent.
      currentMinute: status === 'finished' ? null : (currentMinute ?? null),
    });
  }
}

export class HttpMatchesRepository implements MatchesRepository {
  readonly leagues: CrudRepository<League, LeagueInput, Partial<LeagueInput>, { countryId?: Id }> =
    new HttpLeaguesRepository();
  readonly teams: CrudRepository<Team, TeamInput, Partial<TeamInput>, { leagueId?: Id }> =
    new HttpTeamsRepository();
  readonly matches = new HttpMatchesCollection();

  /** Fixtures the app is showing as live right now. */
  live(leagueId?: Id): Promise<Match[]> {
    return api.get<Match[]>('/matches/live', leagueId ? { leagueId } : undefined);
  }
}
