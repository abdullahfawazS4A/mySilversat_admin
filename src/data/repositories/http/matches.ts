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

import { api, clampPageSize, fetchAll, fetchRange, type Query } from '@/data/http/client';
import type { Id, League, ListQuery, Match, MatchStatus, Page, Team } from '@/types';
import type {
  CrudRepository,
  LeagueFilter,
  LeagueInput,
  LeaguesRepository,
  MatchFilter,
  MatchInput,
  MatchWindow,
  MatchesRepository,
  TeamInput,
} from '../types';
import { DEFAULT_PAGE_SIZE, HttpCrudRepository, clean, localPage, toPage } from './crud';

class HttpLeaguesRepository
  extends HttpCrudRepository<League, LeagueInput, Partial<LeagueInput>, LeagueFilter>
  implements LeaguesRepository
{
  constructor() {
    super('/leagues', (row) => `${row.name} ${row.country?.name ?? ''}`);
  }

  /** Only `countryId` reaches the API; `isActive` is applied over the rows. */
  protected filterQuery(filter: LeagueFilter | undefined): Query {
    const { isActive: _active, ...rest } = filter ?? {};
    return clean(rest);
  }

  /**
   * Lists leagues, narrowing by whether the app shows them.
   *
   * `/leagues` takes `isActive` and ignores it — both `true` and `false`
   * answer with all 1,237 rows — so an unfiltered page is served straight from
   * the API and a filtered one is built from every row. The split matters:
   * the common case stays a single paged request rather than thirteen.
   */
  async list(query?: ListQuery & LeagueFilter): Promise<Page<League>> {
    const { isActive, ...rest } = query ?? {};
    if (isActive === undefined) return super.list(rest);

    const rows = (await fetchAll<League>('/leagues', this.filterQuery(rest))).filter(
      (row) => row.isActive === isActive,
    );
    return localPage(rows, rest, (row) => `${row.name} ${row.country?.name ?? ''}`);
  }

  async all(filter?: LeagueFilter): Promise<League[]> {
    const rows = await fetchAll<League>('/leagues', this.filterQuery(filter));
    return filter?.isActive === undefined
      ? rows
      : rows.filter((row) => row.isActive === filter.isActive);
  }

  /** Shows a league in the app, or hides it and every fixture under it. */
  setActive(id: Id, active: boolean): Promise<League> {
    return this.update(id, { isActive: active });
  }

  /**
   * Runs the toggles in sequence rather than in parallel.
   *
   * The same reason the fixture switch does: the API rate-limits, and a burst
   * of parallel PATCHes buys nothing and can trip it. Here it matters more —
   * hiding a long tail of leagues is a much larger selection than opening an
   * evening's fixtures.
   */
  async bulkSetActive(ids: Id[], active: boolean): Promise<void> {
    for (const id of ids) {
      await this.setActive(id, active);
    }
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

/** Midnight today, local time — the instant "upcoming" is measured from. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Cached window boundaries, keyed by the day and the filter they were measured
 * under.
 *
 * Finding a boundary costs a binary search, and the table re-reads on every
 * page turn; without this, turning to page three would pay for the search
 * again. Entries are short-lived because the boundary genuinely moves — a
 * fixture kicks off, a sync adds rows above it — and the key carries the day,
 * so yesterday's answer can never be served for today.
 */
const BOUNDARY_TTL_MS = 60_000;
const boundaries = new Map<string, { at: number; offset: number; total: number }>();

/**
 * Probes sent at once when locating a window boundary.
 *
 * Eight-way splitting turns a fourteen-round search into a five-round one, at a
 * fan-out the API already sees from the paged reads elsewhere.
 *
 * Do not raise this. Sixteen trips the rate limiter — measured against the live
 * API, nineteen of thirty-two probes came back refused — and a refused probe is
 * not a slower search, it is a failed screen: the reads are awaited together, so
 * one rejection fails the whole list. Twelve happened to survive a run, which is
 * not the same as being safe.
 */
const BOUNDARY_PROBES = 8;

/** How many rows the filters the API cannot apply will read before giving up. */
const LOCAL_FILTER_CAP = 3000;

/** A fixture list split in two at "now": `offset` rows behind, the rest ahead. */
interface Boundary {
  offset: number;
  total: number;
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

  /** Only `leagueId` and `status` reach the API; the rest are applied here. */
  protected filterQuery(filter: MatchFilter | undefined): Query {
    const { isOpenForPrediction: _open, window: _window, ...rest } = filter ?? {};
    return clean(rest);
  }

  /**
   * Where today begins in a fixture list, memoised.
   *
   * `/matches` accepts `leagueId`, `status`, `limit` and `offset` and nothing
   * else — no date range and no sort key, and every other parameter is accepted
   * and silently ignored — but it does return rows ordered by `matchAt`
   * ascending. So the table cannot ask the API for "today onward"; it has to
   * find where today starts and page from there.
   *
   * This is what keeps the screen off the oldest row in the table. On the live
   * feed that row is nine days of finished football, so page one was a single
   * league in a single status and today's fixtures began on page 146 of 376.
   */
  private async boundary(filter: Query): Promise<Boundary | null> {
    const from = startOfToday();
    const key = `${from}|${JSON.stringify(filter)}`;
    const cached = boundaries.get(key);
    if (cached && Date.now() - cached.at < BOUNDARY_TTL_MS) {
      return { offset: cached.offset, total: cached.total };
    }

    const found = await this.search(filter, from);
    if (found) boundaries.set(key, { at: Date.now(), offset: found.offset, total: found.total });
    return found;
  }

  /**
   * Finds the first row at or after `from` in a list sorted by `matchAt`.
   *
   * This is a binary search widened to ask eight questions at once. Each probe
   * costs a round trip and almost no bandwidth — one row, no matter where it
   * lands — so the cost of the search is very nearly the number of *rounds*,
   * not the number of requests. Halving one row at a time takes fourteen
   * sequential trips over nine thousand fixtures and most of four seconds;
   * splitting into nine at a time settles in five rounds and about one, for
   * requests that are individually tiny.
   *
   * Interpolating the probe positions on time was tried and is worse: fixtures
   * cluster hard on the half hour, so hundreds of rows share a timestamp and
   * the guess stalls exactly where the bracket is tightest.
   */
  private async search(filter: Query, from: number): Promise<Boundary | null> {
    const rowAt = async (offset: number): Promise<Match | undefined> =>
      (await api.page<Match>('/matches', { ...filter, limit: 1, offset })).items[0];
    const isBehind = (row: Match | undefined) => !!row && new Date(row.matchAt).getTime() < from;

    const head = await api.page<Match>('/matches', { ...filter, limit: 1, offset: 0 });
    // Without a server total there is nothing to search over, and the caller
    // falls back to paging the list from the top.
    if (!head.hasTotal) return null;
    const total = head.total;

    /*
     * Rows before `lo` are all behind `from`, rows from `hi` on are all at or
     * after it, and the answer is somewhere in between. Each round probes
     * points spread across that bracket and keeps the tightest pair the
     * answers allow, so the span shrinks by roughly `PROBES` every round.
     */
    let lo = 0;
    let hi = total;

    while (lo < hi) {
      const span = hi - lo;
      const count = Math.min(BOUNDARY_PROBES, span);

      const offsets: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const offset = lo + Math.floor((span * i) / count);
        if (!offsets.length || offset > offsets[offsets.length - 1]) offsets.push(offset);
      }

      const rows = await Promise.all(
        offsets.map((offset) => (offset === 0 ? Promise.resolve(head.items[0]) : rowAt(offset))),
      );

      let nextLo = lo;
      let nextHi = hi;
      for (let i = 0; i < offsets.length; i += 1) {
        // A row that is behind us puts the answer after it; the first row that
        // is not caps the bracket, and everything past it is already known.
        if (isBehind(rows[i])) nextLo = offsets[i] + 1;
        else {
          nextHi = offsets[i];
          break;
        }
      }

      // The probes always include an index inside the bracket, so one of the
      // two ends must have moved; this guard is for a list that changed under
      // the search rather than an expected outcome.
      if (nextLo === lo && nextHi === hi) break;
      lo = nextLo;
      hi = nextHi;
    }

    return { offset: lo, total };
  }

  /** The rows a window covers, for the filters the API cannot apply. */
  private async windowRows(
    filter: Query,
    window: MatchWindow,
    range: Boundary | null,
  ): Promise<Match[]> {
    if (!range) return fetchAll<Match>('/matches', filter, LOCAL_FILTER_CAP);
    if (window === 'upcoming') {
      return fetchRange<Match>(
        '/matches',
        filter,
        range.offset,
        range.total - range.offset,
        LOCAL_FILTER_CAP,
      );
    }
    /*
     * Past fixtures read newest first, the same way their pages do below — and
     * when the cap bites it has to bite the far end of the archive, not the
     * near one. Reading from row zero would spend the whole budget on the
     * oldest fixtures in the feed and never reach the ones a search is
     * actually looking for.
     */
    const start = Math.max(0, range.offset - LOCAL_FILTER_CAP);
    const rows = await fetchRange<Match>(
      '/matches',
      filter,
      start,
      range.offset - start,
      LOCAL_FILTER_CAP,
    );
    return rows.reverse();
  }

  /**
   * Lists fixtures within a time window.
   *
   * Two of the three filters are ours rather than the API's. `window` becomes
   * an offset via `boundary`; `isOpenForPrediction` — which `/matches` accepts
   * and ignores — has to be applied over the rows themselves, since a page of
   * the wrong rows cannot be re-filtered into the right ones. `search` is in
   * the same position. Both therefore read the window rather than a page of it,
   * up to `LOCAL_FILTER_CAP`.
   */
  async list(query?: ListQuery & MatchFilter): Promise<Page<Match>> {
    const { search, page, pageSize, isOpenForPrediction, status, window = 'all' } = query ?? {};
    const filter = this.filterQuery(query);

    /*
     * A live fixture is current whatever its kickoff time says.
     *
     * The window is measured on `matchAt`, so a match that kicked off before
     * midnight sorts into the past while it is still being played — and the
     * feed leaves rows marked live for a day or two after. Windowing the live
     * view would therefore answer "what is live right now?" with nothing, so
     * it is the one view the window does not apply to.
     */
    const windowed = window !== 'all' && status !== 'live';
    const range = windowed ? await this.boundary(filter) : null;

    if (search?.trim() || isOpenForPrediction !== undefined) {
      const rows = (await this.windowRows(filter, window, range)).filter(
        (row) => isOpenForPrediction === undefined || row.isOpenForPrediction === isOpenForPrediction,
      );
      return localPage(rows, { search, page, pageSize }, (row) =>
        `${row.homeTeam?.name ?? ''} ${row.awayTeam?.name ?? ''} ${row.league?.name ?? ''}`,
      );
    }

    const size = clampPageSize(pageSize ?? DEFAULT_PAGE_SIZE);
    const wanted = Math.max(1, page ?? 1);

    if (!range) {
      const result = await api.page<Match>('/matches', {
        ...filter,
        limit: size,
        offset: (wanted - 1) * size,
      });
      return toPage(result.items, result.total, { page, pageSize });
    }

    if (window === 'upcoming') {
      const count = range.total - range.offset;
      const offset = range.offset + (wanted - 1) * size;
      const limit = Math.min(size, range.total - offset);
      if (limit <= 0) return toPage<Match>([], count, { page, pageSize });
      const result = await api.page<Match>('/matches', { ...filter, limit, offset });
      return toPage(result.items, count, { page, pageSize });
    }

    /*
     * Past fixtures, newest first.
     *
     * The API only counts up from the oldest row, so the most recent finished
     * match is the last one before the boundary. Page one is therefore the
     * slice that *ends* there, read forwards and then reversed — which is what
     * an operator correcting a score that just went wrong actually wants,
     * instead of a match from the start of the archive.
     */
    const count = range.offset;
    const end = count - (wanted - 1) * size;
    const offset = Math.max(0, end - size);
    const limit = Math.min(size, end - offset);
    if (limit <= 0) return toPage<Match>([], count, { page, pageSize });
    const result = await api.page<Match>('/matches', { ...filter, limit, offset });
    return toPage(result.items.reverse(), count, { page, pageSize });
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
  readonly leagues: LeaguesRepository = new HttpLeaguesRepository();
  readonly teams: CrudRepository<Team, TeamInput, Partial<TeamInput>, { leagueId?: Id }> =
    new HttpTeamsRepository();
  readonly matches = new HttpMatchesCollection();

  /** Fixtures the app is showing as live right now. */
  live(leagueId?: Id): Promise<Match[]> {
    return api.get<Match[]>('/matches/live', leagueId ? { leagueId } : undefined);
  }
}
