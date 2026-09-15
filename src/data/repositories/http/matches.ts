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

/**
 * Fixtures fetched one id at a time, and how long they may be reused.
 *
 * Short, because a fixture is not static reference data — its score and status
 * move while it is being played, and these rows are read on screens that show
 * both. The names and the crests, which are what the id is usually being
 * resolved for, do not move at all.
 */
const MATCH_BY_ID_TTL_MS = 60_000;
const matchById = new Map<Id, { at: number; row: Match }>();

/**
 * Teams fetched one id at a time, and how long they may be reused.
 *
 * Far longer than a fixture's, because a club's name and crest do not change
 * during a matchday — and the same two teams are behind dozens of predictions,
 * so a short window here would re-read the same rows all evening.
 */
const TEAM_BY_ID_TTL_MS = 10 * 60_000;
const teamById = new Map<Id, { at: number; row: Team }>();

/**
 * Leagues fetched one id at a time. The longest window of the three: a league
 * is the most repeated row on any fixture table and the least changeable.
 */
const LEAGUE_BY_ID_TTL_MS = 30 * 60_000;
const leagueById = new Map<Id, { at: number; row: League }>();

/** Whether an entry is still inside its window. */
function fresh(at: number, ttl: number): boolean {
  return Date.now() - at < ttl;
}

/**
 * Whether a fixture carries enough to name itself.
 *
 * A fixture arrives in three states depending on which endpoint served it:
 * absent, present but bare (ids only), or fully joined. The middle one is the
 * trap — it is truthy, so a screen that only checks for the fixture renders
 * "— ضد —" and looks like it has the data. This is the test that matters.
 */
export function isNamedMatch(match: Match | null | undefined): match is Match {
  return !!match?.homeTeam?.name && !!match?.awayTeam?.name;
}

/**
 * Fixtures fetched at once when resolving ids.
 *
 * Well under the fan-out the boundary search uses, because this runs on screens
 * that are already reading a table — it should stay out of the way rather than
 * race it for the rate limit.
 */
const BY_ID_CONCURRENCY = 4;

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

  /**
   * Only `leagueId` and `status` reach the API; the rest are applied here.
   *
   * Named rather than "everything except the ones we handle", because `list`
   * hands its whole query in — paging included — and a leftover `pageSize` in
   * here is not a harmless spare parameter. It rides along into `boundary`'s
   * cache key, so changing the rows-per-page threw the memoised boundary away
   * and re-ran a twenty-request binary search against a rate-limited API for
   * an answer that had nothing to do with page size. The table sat on its old
   * rows for seconds, and a single rate-limited probe failed the read outright.
   */
  protected filterQuery(filter: MatchFilter | undefined): Query {
    return clean({ leagueId: filter?.leagueId, status: filter?.status });
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
    cap = LOCAL_FILTER_CAP,
  ): Promise<Match[]> {
    if (!range) return fetchAll<Match>('/matches', filter, cap);
    if (window === 'upcoming') {
      return fetchRange<Match>('/matches', filter, range.offset, range.total - range.offset, cap);
    }
    /*
     * Past fixtures read newest first, the same way their pages do below — and
     * when the cap bites it has to bite the far end of the archive, not the
     * near one. Reading from row zero would spend the whole budget on the
     * oldest fixtures in the feed and never reach the ones a search is
     * actually looking for.
     */
    const start = Math.max(0, range.offset - cap);
    const rows = await fetchRange<Match>('/matches', filter, start, range.offset - start, cap);
    return rows.reverse();
  }

  /**
   * Lists fixtures across several leagues at once.
   *
   * `/matches` takes one `leagueId` and has no list form, so a page spanning
   * three leagues cannot be requested — each league is read on its own and the
   * rows are merged here. Order has to be rebuilt on the merged rows: each
   * league comes back sorted on its own, and interleaving two sorted lists
   * does not keep either order.
   *
   * The leagues are read one after another rather than together on purpose.
   * `boundary` already fans out `BOUNDARY_PROBES` requests per league, and
   * running two of those searches side by side is exactly the burst the rate
   * limiter refuses — a refused probe does not slow the search down, it fails
   * the screen.
   */
  private async listAcross(ids: Id[], query: ListQuery & MatchFilter): Promise<Page<Match>> {
    const { search, page, pageSize, isOpenForPrediction, status, window = 'all' } = query;
    const windowed = window !== 'all' && status !== 'live';

    // Past fixtures read newest first, the same way the single-league path
    // hands them back; everything else keeps the feed's own ascending order.
    const direction = window === 'past' ? -1 : 1;
    const byTime = (a: Match, b: Match) =>
      direction * (new Date(a.matchAt).getTime() - new Date(b.matchAt).getTime());

    const slices: { filter: Query; range: Boundary | null }[] = [];
    for (const leagueId of ids) {
      const filter = this.filterQuery({ leagueId, status });
      slices.push({ filter, range: windowed ? await this.boundary(filter) : null });
    }

    /*
     * A filter the API cannot apply has to see every row of the window, the
     * same way the single-league path does — a page of the wrong rows cannot
     * be re-filtered into the right ones.
     *
     * The row budget is shared out rather than handed to each league whole, so
     * this costs about what one league does instead of multiplying by the size
     * of the set. The floor keeps a wide set from cutting every league down to
     * a page or two.
     */
    if (search?.trim() || isOpenForPrediction !== undefined) {
      const cap = Math.max(200, Math.ceil(LOCAL_FILTER_CAP / ids.length));
      const rows: Match[] = [];
      for (const { filter, range } of slices) {
        rows.push(...(await this.windowRows(filter, window, range, cap)));
      }
      const filtered = rows
        .filter(
          (row) =>
            isOpenForPrediction === undefined || row.isOpenForPrediction === isOpenForPrediction,
        )
        .sort(byTime);
      return localPage(filtered, { search, page, pageSize }, (row) =>
        `${row.homeTeam?.name ?? ''} ${row.awayTeam?.name ?? ''} ${row.league?.name ?? ''}`,
      );
    }

    /*
     * Nothing local to apply, so the merge only has to be deep enough to answer
     * the page being asked for.
     *
     * The first `need` rows of the merged list can only come from the first
     * `need` rows of each league, so that is all that is read — page one of two
     * leagues is two small requests, not two whole seasons. Reading the full
     * window here instead was the same answer for roughly twenty times the
     * traffic, on the screen that gets opened most.
     */
    const size = clampPageSize(pageSize ?? DEFAULT_PAGE_SIZE);
    const wanted = Math.max(1, page ?? 1);
    const need = wanted * size;

    const heads: Match[][] = [];
    let total = 0;
    for (const { filter, range } of slices) {
      if (range && window === 'upcoming') {
        total += range.total - range.offset;
        heads.push(await fetchRange<Match>('/matches', filter, range.offset, need, need));
        continue;
      }
      if (range) {
        // The archive ends at the boundary, so its newest page is the slice
        // that stops there — read forwards, then flipped.
        total += range.offset;
        const start = Math.max(0, range.offset - need);
        const rows = await fetchRange<Match>('/matches', filter, start, range.offset - start, need);
        heads.push(rows.reverse());
        continue;
      }
      // No boundary — either the whole archive was asked for, or the league's
      // list came back without a total to search over. Both read from the top.
      const head = await api.page<Match>('/matches', { ...filter, limit: size, offset: 0 });
      total += head.hasTotal ? head.total : head.items.length;
      heads.push(
        need <= size ? head.items : await fetchRange<Match>('/matches', filter, 0, need, need),
      );
    }

    const merged = heads.flat().sort(byTime);
    const offset = (wanted - 1) * size;
    return toPage(merged.slice(offset, offset + size), total, { page, pageSize });
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

    /*
     * A set of leagues is not something the API can be asked for, so it is
     * resolved before anything else: one id collapses back to the ordinary
     * single-league path, several go through `listAcross`, and none at all is
     * an empty table — dropping the filter instead would answer "the leagues
     * the app shows" with every league in the feed.
     */
    if (query?.leagueIds) {
      const ids = query.leagueIds;
      if (ids.length === 0) return toPage<Match>([], 0, { page, pageSize });
      if (ids.length > 1) return this.listAcross(ids, query);
      return this.list({ ...query, leagueIds: undefined, leagueId: ids[0] });
    }

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

  /** Runs `job` over `ids` a few at a time, keeping clear of the rate limit. */
  private async inBatches<T>(
    ids: Id[],
    job: (id: Id) => Promise<T | null>,
    onResult: (id: Id, result: T) => void,
  ): Promise<void> {
    for (let i = 0; i < ids.length; i += BY_ID_CONCURRENCY) {
      const batch = ids.slice(i, i + BY_ID_CONCURRENCY);
      const results = await Promise.all(batch.map((id) => job(id).catch(() => null)));
      results.forEach((result, index) => {
        if (result) onResult(batch[index], result);
      });
    }
  }

  /**
   * Resolves fixture ids to fixtures a table can actually name.
   *
   * For screens that hold a `matchId` and need the fixture behind it. The
   * obvious alternative — read every fixture once and look ids up in memory —
   * is what the predictions screen does for its filter, and it is both far
   * heavier and wrong: `all()` walks from the oldest row in the feed and stops
   * at its cap, so the fixtures a recent prediction points at are exactly the
   * ones missing from it.
   *
   * Two rounds, because a fixture from a nested join is not the fixture the
   * list route returns. `/matches` joins both clubs; a `match` embedded in
   * another resource, and a fixture read by its own id, may carry nothing but
   * `homeTeamId`/`awayTeamId` — which is what left the predictions table
   * reading "— ضد —" even once the fixture itself had been found. So whatever
   * comes back is checked, and the clubs it is missing are read from `/teams`
   * and attached.
   *
   * `seeds` are fixtures the caller already has, however incomplete. Seeding
   * them means an embedded-but-bare fixture costs only the two club reads —
   * shared across every prediction on that fixture — instead of re-reading the
   * fixture first.
   *
   * Anything that cannot be read is left out rather than failing the call. One
   * deleted row should cost its own cell, not the whole table.
   */
  async byIds(ids: Id[], seeds?: (Match | undefined)[]): Promise<Map<Id, Match>> {
    const wanted = [...new Set(ids.filter(Boolean))];

    for (const seed of seeds ?? []) {
      if (!seed?.id) continue;
      const hit = matchById.get(seed.id);
      // A cached row may already have been completed; a bare seed must not
      // undo that work.
      if (hit && (isNamedMatch(hit.row) || !isNamedMatch(seed))) continue;
      matchById.set(seed.id, { at: Date.now(), row: seed });
    }

    const missing = wanted.filter((id) => {
      const hit = matchById.get(id);
      return !hit || !fresh(hit.at, MATCH_BY_ID_TTL_MS);
    });
    await this.inBatches(
      missing,
      (id) => this.get(id),
      (id, row) => matchById.set(id, { at: Date.now(), row }),
    );

    const rows = wanted
      .map((id) => matchById.get(id)?.row)
      .filter((row): row is Match => Boolean(row));

    const needTeams = new Set<Id>();
    const needLeagues = new Set<Id>();
    for (const row of rows) {
      if (!row.homeTeam?.name && row.homeTeamId) needTeams.add(row.homeTeamId);
      if (!row.awayTeam?.name && row.awayTeamId) needTeams.add(row.awayTeamId);
      // The league names the fixture's second line; a bare fixture leaves it
      // blank, which is the same hole one line down.
      if (!row.league?.name && row.leagueId) needLeagues.add(row.leagueId);
    }

    await Promise.all([
      this.inBatches(
        [...needTeams].filter((id) => {
          const hit = teamById.get(id);
          return !hit || !fresh(hit.at, TEAM_BY_ID_TTL_MS);
        }),
        (id) => api.get<Team>(`/teams/${id}`),
        (id, row) => teamById.set(id, { at: Date.now(), row }),
      ),
      this.inBatches(
        [...needLeagues].filter((id) => {
          const hit = leagueById.get(id);
          return !hit || !fresh(hit.at, LEAGUE_BY_ID_TTL_MS);
        }),
        (id) => api.get<League>(`/leagues/${id}`),
        (id, row) => leagueById.set(id, { at: Date.now(), row }),
      ),
    ]);

    const out = new Map<Id, Match>();
    for (const row of rows) {
      // Written back onto the cached fixture, so the next screen to ask for it
      // gets the completed one and pays for neither round.
      if (!row.homeTeam?.name) row.homeTeam = teamById.get(row.homeTeamId)?.row ?? row.homeTeam;
      if (!row.awayTeam?.name) row.awayTeam = teamById.get(row.awayTeamId)?.row ?? row.awayTeam;
      if (!row.league?.name) row.league = leagueById.get(row.leagueId)?.row ?? row.league;
      out.set(row.id, row);
    }
    return out;
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
