/**
 * Leagues, teams and fixtures.
 *
 * All three are mirrored from API-Football and carry the provider's
 * `externalId`. The console's own decisions on top of the feed are
 * `isOpenForPrediction` / `predictionClosesAt`, a manual score fix, and the
 * Arabic name of a league or a club; all are ordinary PATCHes, spelled out here
 * so a screen never has to know which field name the prediction switch maps to.
 *
 * `nameAr` is why the text searches here match on two names per row: the tables
 * show the Arabic one, the feed only ever sends the English one, and both are
 * things an operator will type.
 *
 * A correction has to land before scoring runs: `/predictions/score/match/{id}`
 * pays out on whatever `homeScore`/`awayScore` say at the moment it is called.
 */

import { ApiError, MAX_PAGE_SIZE, api, clampPageSize, fetchRange, throttledPage, type Query } from '@/data/http/client';
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
import { DEFAULT_PAGE_SIZE, HttpCrudRepository, clean, toPage, toRange } from './crud';

/** The bulk routes take at most this many ids per call. */
const BULK_LIMIT = 500;

/**
 * One PATCH on a `/bulk` route, per 500 ids.
 *
 * The server applies each call in one transaction: every row changes or none
 * does. A call that names a row that no longer exists comes back 400 with
 * `missingIds`, and nothing in that call changed — said so in Arabic, since the
 * server's own sentence is English. A selection over 500 is split, so only a
 * failing later chunk can leave the earlier ones applied.
 */
async function bulkPatch(path: string, ids: Id[], body: object, noun: string): Promise<void> {
  for (let start = 0; start < ids.length; start += BULK_LIMIT) {
    try {
      await api.patch<{ updated: number }>(path, { ids: ids.slice(start, start + BULK_LIMIT), ...body });
    } catch (err) {
      const missing = (err instanceof ApiError ? err.detail : null) as { missingIds?: unknown } | null;
      if (Array.isArray(missing?.missingIds) && missing.missingIds.length) {
        throw new ApiError(
          400,
          `${missing.missingIds.length} ${noun} من المختارة ما موجودة بالسيرفر — ما تغيّر شي، حدّث الصفحة وعاود.`,
          missing,
        );
      }
      throw err;
    }
  }
}

/**
 * An Arabic name on its way to the API.
 *
 * The forms bind their text box to `''` when a row has no override, so a saved
 * draft carries an empty string where the API wants `null` — and the two are
 * not the same answer: `null` drops the override and puts the app back on the
 * provider's spelling, `''` is stored as the name and leaves a blank where a
 * league used to be. Normalised here rather than in the dialogs so it holds for
 * every caller, the way the paging translation does.
 *
 * A patch that never mentions `nameAr` is left alone — adding the key would
 * turn "rename this league" into "rename it and wipe its Arabic name".
 */
function withNameAr<T extends { nameAr?: string | null }>(input: T): T {
  if (!('nameAr' in input)) return input;
  return { ...input, nameAr: input.nameAr?.trim() || null };
}

class HttpLeaguesRepository
  extends HttpCrudRepository<League, LeagueInput, Partial<LeagueInput>, LeagueFilter>
  implements LeaguesRepository
{
  protected readonly serverSearch = true;

  constructor() {
    super('/leagues', (row) => `${row.name} ${row.nameAr ?? ''} ${row.country?.name ?? ''}`);
  }

  create(input: LeagueInput): Promise<League> {
    return super.create(withNameAr(input));
  }

  update(id: Id, input: Partial<LeagueInput>): Promise<League> {
    const body = withNameAr(input);
    // Same rule as `nameAr`: an emptied box clears the logo rather than storing ''.
    if ('logoUrl' in body) body.logoUrl = body.logoUrl?.trim() || null;
    return super.update(id, body);
  }

  /** Shows a league in the app, or hides it and every fixture under it. */
  setActive(id: Id, active: boolean): Promise<League> {
    return this.update(id, { isActive: active });
  }

  /** Shows or hides the selection in one call; all of it changes or none. */
  bulkSetActive(ids: Id[], active: boolean): Promise<void> {
    return bulkPatch('/leagues/bulk', ids, { isActive: active }, 'دوري');
  }
}

/**
 * Clubs, saved as multipart rather than JSON.
 *
 * `/teams` takes the crest as a file on the request that saves the club — its
 * `logo` is a binary part, exactly like the banner on `/ads` — and there is no
 * field anywhere for a crest URL. The console used to send a link in that field
 * and there was nothing on the API to receive it.
 *
 * The form is sent even when no file was picked, because the route is multipart
 * whether or not a crest is on the request; the parts it does carry are the
 * ordinary text ones.
 */
class HttpTeamsRepository extends HttpCrudRepository<
  Team,
  TeamInput,
  Partial<TeamInput>,
  { leagueId?: Id }
> {
  protected readonly serverSearch = true;

  constructor() {
    super('/teams', (row) => `${row.name} ${row.nameAr ?? ''} ${row.league?.name ?? ''}`);
  }

  /**
   * The draft as multipart.
   *
   * Every field crosses as text, which is all a multipart part can be. An empty
   * part is what clears `nameAr`, the same convention the banner form relies on
   * — measured there, taken on trust here.
   *
   * `logoUrl` is left out on purpose: it is the form's copy of the crest
   * already stored, and there is nothing on the API to send it to.
   */
  private static form(input: Partial<TeamInput>): FormData {
    const form = new FormData();
    const put = (key: string, value: string | null | undefined) => {
      // Absent means "not part of this edit"; null means "clear it".
      if (value === undefined) return;
      form.append(key, value ?? '');
    };

    put('name', input.name);
    put('nameAr', input.nameAr);
    put('leagueId', input.leagueId);
    if (input.logo) form.append('logo', input.logo, input.logo.name);
    return form;
  }

  create(input: TeamInput): Promise<Team> {
    return api.post<Team>('/teams', HttpTeamsRepository.form(withNameAr(input)));
  }

  update(id: Id, input: Partial<TeamInput>): Promise<Team> {
    return api.patch<Team>(`/teams/${id}`, HttpTeamsRepository.form(withNameAr(input)));
  }
}

/**
 * Midnight today, local time, as the instant "upcoming" and "past" split on.
 *
 * `/matches` takes `from` (inclusive) and `to` (exclusive) on `matchAt`, so the
 * two windows meet here without overlapping.
 */
function startOfToday(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/**
 * The query a window becomes.
 *
 * Past fixtures read newest first — the finished match an operator is about to
 * correct is the one that just ended, not the oldest in the feed. Live is never
 * windowed: a match that kicked off before midnight sorts into the past while
 * it is still being played, and the feed leaves rows marked live for a day or
 * two after, so windowing it would answer "what is live now?" with nothing.
 */
function windowQuery(window: MatchWindow, status: MatchStatus | undefined): Query {
  if (window === 'all' || status === 'live') return {};
  return window === 'upcoming'
    ? { from: startOfToday(), order: 'asc' }
    : { to: startOfToday(), order: 'desc' };
}

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
 * What a fixture is searched by.
 *
 * Both spellings of every name, because the table shows the Arabic one and the
 * feed only knows the English one: an operator who typed "الزوراء" and an
 * operator who pasted "Al-Zawraa" are looking for the same row, and a search
 * over one of the two answers nothing for half of them.
 */
function matchSearchText(row: Match): string {
  return [
    row.homeTeam?.name,
    row.homeTeam?.nameAr,
    row.awayTeam?.name,
    row.awayTeam?.nameAr,
    row.league?.name,
    row.league?.nameAr,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Fixtures fetched at once when resolving ids.
 *
 * Kept low because this runs on screens that are already reading a table — it
 * should stay out of the way rather than race it for the rate limit.
 */
const BY_ID_CONCURRENCY = 4;

class HttpMatchesCollection extends HttpCrudRepository<
  Match,
  MatchInput,
  Partial<MatchInput>,
  MatchFilter
> {
  constructor() {
    super('/matches', matchSearchText);
  }

  /**
   * The filters `/matches` applies itself. Named rather than spread, because
   * `list` hands its whole query in — paging and `window` included — and only
   * these are query parameters.
   */
  protected filterQuery(filter: MatchFilter | undefined): Query {
    return clean({
      leagueId: filter?.leagueId,
      status: filter?.status,
      isOpenForPrediction: filter?.isOpenForPrediction,
    });
  }

  /**
   * Lists fixtures across several leagues at once.
   *
   * `/matches` takes one `leagueId` and has no list form, so a page spanning
   * three leagues cannot be requested — each league is read on its own and the
   * rows are merged here. The first `need` rows of the merged list can only
   * come from the first `need` rows of each league, so that is all that is
   * read: page one of two leagues is two small requests. Order is rebuilt on
   * the merged rows, since interleaving sorted lists does not keep the order.
   */
  private async listAcross(ids: Id[], query: ListQuery & MatchFilter): Promise<Page<Match>> {
    const { search, page, pageSize, status, window = 'all' } = query;
    const size = clampPageSize(pageSize ?? DEFAULT_PAGE_SIZE);
    const wanted = Math.max(1, page ?? 1);
    const need = wanted * size;

    const direction = window === 'past' && status !== 'live' ? -1 : 1;
    // The API's order: kickoff, then id, both reversed for a descending read.
    // Matching it keeps each league's head a prefix of the merged order.
    const byTime = (a: Match, b: Match) =>
      direction *
      (new Date(a.matchAt).getTime() - new Date(b.matchAt).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    const perLeague = await Promise.all(
      ids.map(async (leagueId) => {
        const params: Query = {
          ...this.filterQuery({ ...query, leagueId }),
          ...windowQuery(window, status),
          ...(search?.trim() ? { search: search.trim() } : {}),
        };
        // Through the shared cap on pages in flight, so a wide set of leagues
        // queues rather than bursting into the rate limit.
        const head = await throttledPage<Match>('/matches', {
          ...params,
          limit: Math.min(need, MAX_PAGE_SIZE),
          offset: 0,
        });
        const rows =
          need <= MAX_PAGE_SIZE || head.items.length < MAX_PAGE_SIZE
            ? head.items
            : [
                ...head.items,
                ...(await fetchRange<Match>('/matches', params, MAX_PAGE_SIZE, need - MAX_PAGE_SIZE)),
              ];
        return { rows, total: head.total };
      }),
    );

    const merged = perLeague.flatMap((league) => league.rows).sort(byTime);
    const total = perLeague.reduce((sum, league) => sum + league.total, 0);
    const offset = (wanted - 1) * size;
    return toPage(merged.slice(offset, offset + size), total, { page, pageSize });
  }

  /**
   * Lists fixtures, one paged request.
   *
   * Every filter is the API's: `leagueId`, `status` and `isOpenForPrediction`
   * as they are, `window` as a `from`/`to` bound on `matchAt` with an order,
   * and `search` over both spellings of the team and league names.
   */
  async list(query?: ListQuery & MatchFilter): Promise<Page<Match>> {
    const { search, page, pageSize, status, window = 'all' } = query ?? {};

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

    const result = await api.page<Match>('/matches', {
      ...this.filterQuery(query),
      ...windowQuery(window, status),
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...toRange({ page, pageSize }),
    });
    return toPage(result.items, result.total, { page, pageSize });
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
   * Opens or closes the selection in one call; all of it changes or none.
   * Each fixture keeps its own closing time — none is sent.
   */
  bulkSetOpenForPrediction(ids: Id[], open: boolean): Promise<void> {
    return bulkPatch('/matches/bulk', ids, { isOpenForPrediction: open }, 'مباراة');
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
