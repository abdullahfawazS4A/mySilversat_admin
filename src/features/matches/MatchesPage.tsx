/**
 * Matches.
 *
 * Fixtures are mirrored from API-Football — nothing here creates or deletes
 * one — so this screen answers a single operator question: **out of every
 * fixture the feed gave us, which ones do we open for predictions?**
 *
 * The answer is only ever about the leagues the app actually shows, so that is
 * all this screen lists. A fixture in a hidden league cannot reach a single
 * user however it is switched, and the feed mirrors twelve hundred of those
 * leagues against the handful that are on — leaving them in meant an operator
 * scrolling an Icelandic third division to find tonight's match. The whole
 * catalogue is still reachable, one screen over on «الدوريات والفرق», where
 * deciding what the app shows is the actual job.
 *
 * The prediction switch is therefore in the table itself, not buried in a
 * dialog, and it works in bulk: a typical evening means opening five fixtures
 * at once. Everything else on the row is feed data shown read-only, with one
 * escape hatch — correcting a wrong score, because points are settled on it.
 *
 * Scoring is offered on every finished fixture rather than hidden once it has
 * run. The API only pays out picks it has not paid out before, so pressing it
 * twice is harmless — and there is no `settledAt` column to hide it by.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Flag,
  Lock,
  Pencil,
  RefreshCw,
  Unlock,
  Users,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader, DataTable, Toolbar, BulkBar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  FilterChips,
  Notice,
  Pill,
  SearchInput,
  Select,
  Switch,
  TeamCrest,
} from '@/components/ui';
import type { Id, Match, MatchStatus } from '@/types';
import type { MatchWindow } from '@/data/repositories/types';
import { MATCH_STATUS, leagueLabel } from '@/lib/labels';
import { countdownAr, formatDateAr, formatTimeAr } from '@/lib/format';
import { ScoreOverrideDialog } from './ScoreOverrideDialog';
import { MatchPredictionsDialog } from './MatchPredictionsDialog';

type PredictFilter = 'all' | 'open' | 'closed';

/**
 * Which leagues a board covers.
 *
 * `app` is the operating screen: the leagues switched on for the app, and
 * nothing else. `all` is the catalogue view that lives under «الدوريات
 * والفرق» — every league the feed mirrors, for looking something up rather
 * than running the evening.
 */
export type MatchesScope = 'app' | 'all';

/** A crest seed from the team id, so the same team always gets the same look. */
function crestSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

/** The routed screen: fixtures of the leagues the app shows. */
export function MatchesPage() {
  return <MatchesBoard scope="app" />;
}

/**
 * The fixtures table, over one scope or the other.
 *
 * Both scopes are the same screen — same columns, same switches, same bulk
 * bar — so they are one component with two league sources rather than two
 * copies that drift apart. What changes is the league list behind the picker
 * and, with it, what «كل الدوريات» means.
 */
export function MatchesBoard({ scope }: { scope: MatchesScope }) {
  const repos = useRepos();
  const { toast } = useToast();
  const appOnly = scope === 'app';

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<MatchStatus | 'all'>('all');
  const [predictFilter, setPredictFilter] = useState<PredictFilter>('all');
  const [leagueId, setLeagueId] = useState<Id | 'all'>('all');
  /*
   * The table opens on fixtures from today onward.
   *
   * `/matches` returns the whole archive ordered oldest-first and takes no date
   * parameter, so "no filter" means page one is the oldest rows in the feed —
   * in practice nine days of finished football in a single league. The screen's
   * question is which *upcoming* fixtures to open for predictions, so that is
   * where it starts; the archive is still one chip away.
   */
  const [timeWindow, setTimeWindow] = useState<MatchWindow>('upcoming');
  const [page, setPage] = useState(1);
  /*
   * Rows per page, chosen in the pager rather than fixed here.
   *
   * A night's fixtures are worked through in one pass, and twenty-five rows
   * meant paging through an evening three times. The pager offers 25/50/100
   * and takes a typed number too; 100 is the ceiling because that is what the
   * API accepts on one request.
   */
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [scoring, setScoring] = useState<Match | null>(null);
  const [viewingPicks, setViewingPicks] = useState<Match | null>(null);
  const [settling, setSettling] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const leagues = useAsync(
    () => repos.matches.leagues.all(appOnly ? { isActive: true } : undefined),
    [appOnly],
  );

  /*
   * The ids the app scope is allowed to read, as a dependency-safe key.
   *
   * A fresh array every render would re-run the read on every render, so the
   * effect watches the joined ids instead — they only change when the set
   * genuinely does.
   */
  const scopeIds = useMemo(
    () => (appOnly ? (leagues.data ?? []).map((league) => league.id) : null),
    [appOnly, leagues.data],
  );
  const scopeKey = scopeIds?.join(',') ?? '';

  const matches = useAsync(() => {
    /*
     * Nothing is read until the league set is known.
     *
     * In the app scope the set *is* the filter, and an unresolved one reads as
     * "no leagues" — which would flash an empty table over a query that has not
     * been asked yet. A promise that never settles leaves the skeleton up; the
     * run is discarded as stale the moment the leagues land and the deps move.
     */
    if (appOnly && leagues.data === undefined) return new Promise<never>(() => {});

    const single = leagueId === 'all' ? undefined : leagueId;
    return repos.matches.matches.list({
      search: debounced,
      status: status === 'all' ? undefined : status,
      // In the app scope even «كل الدوريات» is a list — the active ones — so
      // the twelve hundred hidden leagues can never leak into the table.
      ...(appOnly
        ? { leagueIds: single ? [single] : (scopeIds ?? []) }
        : { leagueId: single }),
      isOpenForPrediction: predictFilter === 'all' ? undefined : predictFilter === 'open',
      window: timeWindow,
      page,
      pageSize,
    });
  }, [appOnly, scopeKey, debounced, status, predictFilter, leagueId, timeWindow, page, pageSize]);

  /*
   * The picker's options, in the order the scope makes useful.
   *
   * In the app scope that is the app's own order — the same `order` column the
   * app sorts by — because the list is short and an operator thinks of it the
   * way the app presents it. In the catalogue scope the active ones come first
   * under a heading, since alphabetical order buries the handful that matter
   * somewhere past "1a Divisão", and without the heading the jump from La Liga
   * to "1. Deild — Faroe-Islands" just reads like a list that failed to sort.
   */
  const leagueOptions = useMemo(() => {
    const rows = [...(leagues.data ?? [])];
    if (appOnly) {
      rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      return rows.map((league) => ({ value: league.id, label: leagueLabel(league) }));
    }
    rows.sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name) ||
        (a.country?.name ?? '').localeCompare(b.country?.name ?? ''),
    );
    return rows.map((league) => ({
      value: league.id,
      label: leagueLabel(league),
      group: league.isActive ? 'الدوريات الفعّالة بالتطبيق' : 'بقية الدوريات',
    }));
  }, [appOnly, leagues.data]);

  /** No league is switched on, so there is nothing for this scope to show. */
  const noAppLeagues = appOnly && leagues.data !== undefined && leagues.data.length === 0;

  const refresh = () => {
    matches.reload();
    setSelected(new Set());
  };

  /**
   * Pulls fixtures, then live scores.
   *
   * Two calls because the feed splits them: the fixtures sync brings in new
   * rows and their kickoff times, the live sync only updates scores on
   * fixtures already in the table. Running them in that order means a fixture
   * that appeared minutes ago still gets its current score.
   */
  const runSync = async () => {
    setSyncing(true);
    try {
      const fixtures = await repos.sync.syncFixtures();
      await repos.sync.syncLive();
      const changed = (fixtures.created ?? 0) + (fixtures.updated ?? 0);
      toast(changed > 0 ? `انمزامنت ${changed} مباراة من المزوّد` : 'المباريات محدّثة — ما بيها جديد');
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّرت المزامنة', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toggleOpen = async (match: Match, open: boolean) => {
    try {
      await repos.matches.matches.setOpenForPrediction(match.id, open);
      toast(
        open
          ? `انفتح التوقع على ${match.homeTeam?.name ?? ''} ضد ${match.awayTeam?.name ?? ''}`
          : 'انغلق التوقع على المباراة',
      );
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    }
  };

  const bulkOpen = async (open: boolean) => {
    setBusy(true);
    try {
      await repos.matches.matches.bulkSetOpenForPrediction([...selected], open);
      toast(`${open ? 'انفتح' : 'انغلق'} التوقع على ${selected.size} مباراة`);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      const result = await repos.predictions.scoreMatch(settling.id);
      toast(
        result.scored > 0
          ? `انحسبت نقاط ${result.scored} توقع`
          : 'ماكو توقعات جديدة تنحسب على هذي المباراة',
      );
      setSettling(null);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاحتساب', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Column<Match>[]>(
    () => [
      {
        key: 'teams',
        header: 'المباراة',
        render: (match) => (
          <div className="row row-gap-3">
            <TeamCrest
              name={match.homeTeam?.name ?? '—'}
              seed={crestSeed(match.homeTeamId)}
              logoUrl={match.homeTeam?.logoUrl}
            />
            <div className="col" style={{ lineHeight: 1.35 }}>
              <span className="fs-body strong">
                {match.homeTeam?.name ?? '—'} <span className="dim">ضد</span>{' '}
                {match.awayTeam?.name ?? '—'}
              </span>
              <span className="fs-tiny dim">{match.league?.name ?? ''}</span>
            </div>
            <TeamCrest
              name={match.awayTeam?.name ?? '—'}
              seed={crestSeed(match.awayTeamId)}
              logoUrl={match.awayTeam?.logoUrl}
              size={26}
            />
          </div>
        ),
      },
      {
        key: 'matchAt',
        header: 'موعد الانطلاق',
        render: (match) => (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-body">{formatDateAr(match.matchAt)}</span>
            <span className="fs-tiny dim num">{formatTimeAr(match.matchAt)}</span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'الحالة',
        render: (match) => {
          const meta = MATCH_STATUS[match.status];
          return (
            <div className="row row-gap-2">
              <Pill tone={meta.tone} dot={match.status === 'live'}>
                {meta.label}
              </Pill>
              {match.homeScore !== null && match.awayScore !== null ? (
                <span className="fs-body strong num">
                  {match.homeScore} – {match.awayScore}
                  {match.currentMinute ? <span className="dim"> {match.currentMinute}′</span> : null}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'isOpenForPrediction',
        header: 'مفتوحة للتوقع',
        width: 168,
        render: (match) => (
          <div className="col" style={{ gap: 3 }}>
            <Switch
              checked={match.isOpenForPrediction}
              disabled={!match.isOpenForPrediction && match.status !== 'scheduled'}
              onChange={(next) => void toggleOpen(match, next)}
              title={
                match.status !== 'scheduled' && !match.isOpenForPrediction
                  ? 'ما تنفتح إلا على مباراة مجدولة'
                  : undefined
              }
            />
            {/*
              countdownAr returns "مغلق" once the close time has passed, which
              read as "يقفل بعد مغلق" on every finished fixture. Past and future
              are now two different sentences.
            */}
            {match.isOpenForPrediction && match.predictionClosesAt ? (
              new Date(match.predictionClosesAt).getTime() > Date.now() ? (
                <span className="fs-tiny dim">
                  يقفل بعد <span className="num">{countdownAr(match.predictionClosesAt)}</span>
                </span>
              ) : (
                <span className="fs-tiny dim">انقفل التوقع</span>
              )
            ) : null}
          </div>
        ),
      },
      {
        key: 'predictions',
        header: 'التوقعات',
        width: 104,
        render: (match) => (
          <Button
            variant="ghost"
            size="sm"
            icon={<Users size={13} />}
            title="شوف توزيع التوقعات"
            onClick={(event) => {
              event.stopPropagation();
              setViewingPicks(match);
            }}
          >
            عرض
          </Button>
        ),
      },
      {
        key: 'settle',
        header: 'النقاط',
        width: 120,
        render: (match) =>
          match.status === 'finished' ? (
            <Button
              variant="subtle"
              size="sm"
              icon={<CheckCircle2 size={13} />}
              onClick={() => setSettling(match)}
            >
              احتساب
            </Button>
          ) : (
            <span className="dim">—</span>
          ),
      },
      {
        key: 'actions',
        header: '',
        width: 60,
        render: (match) => (
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={14} />}
            title="تصحيح النتيجة يدوياً"
            onClick={() => setScoring(match)}
          />
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title={appOnly ? 'المباريات' : 'كل المباريات'}
        subtitle={
          appOnly
            ? 'مباريات الدوريات المضافة للتطبيق — اختار أي وحدة تنفتح للتوقع'
            : 'كل مباريات المزوّد، حتى دوريات ما هي مضافة للتطبيق'
        }
        actions={
          appOnly ? (
            <Button
              variant="primary"
              icon={<RefreshCw size={16} />}
              disabled={syncing}
              onClick={() => void runSync()}
            >
              {syncing ? 'جاري المزامنة…' : 'مزامنة الآن'}
            </Button>
          ) : undefined
        }
      />

      <div className="page">
        {appOnly ? (
          <Notice tone="info">
            هنا بس الدوريات المضافة للتطبيق — مباريات الدوريات المخفية ما تظهر لأنها أصلاً ما توصل
            للمستخدم. تشوف كل الدوريات وكل المباريات من <Link to="/leagues">الدوريات والفرق</Link>.
            {timeWindow === 'upcoming' ? (
              <> والجدول يبدي من مباريات اليوم وجاي — للقديمة اختار «السابقة».</>
            ) : null}
          </Notice>
        ) : (
          <Notice tone="warning">
            هذا عرض للاطلاع على كل ما يجيه المزوّد. فتح التوقع على مباراة من دوري مخفي ما ينفع شي —
            المستخدم ما يشوفها حتى يصير الدوري ظاهر بالتطبيق.
          </Notice>
        )}

        {noAppLeagues ? (
          <Notice tone="warning">
            ماكو ولا دوري مضاف للتطبيق، فما بيها مباريات تنعرض. فعّل دوري من{' '}
            <Link to="/leagues">شاشة الدوريات</Link> وارجع.
          </Notice>
        ) : null}

        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث بفريق أو دوري…" />

            <Select
              value={leagueId}
              onChange={(next) => {
                setLeagueId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: appOnly ? 'كل الدوريات المضافة' : 'كل الدوريات' },
                ...leagueOptions,
              ]}
            />

            <Select
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل الحالات' },
                { value: 'scheduled' as const, label: MATCH_STATUS.scheduled.label },
                { value: 'live' as const, label: MATCH_STATUS.live.label },
                { value: 'finished' as const, label: MATCH_STATUS.finished.label },
              ]}
            />
          </Toolbar>

          <Toolbar>
            <FilterChips
              value={timeWindow}
              onChange={(next) => {
                setTimeWindow(next);
                setPage(1);
              }}
              items={[
                { value: 'upcoming', label: 'القادمة' },
                { value: 'past', label: 'السابقة' },
                { value: 'all', label: 'كل الأرشيف' },
              ]}
            />

            <FilterChips
              value={predictFilter}
              onChange={(next) => {
                setPredictFilter(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'open', label: 'مفتوحة للتوقع' },
                { value: 'closed', label: 'مغلقة' },
              ]}
            />
          </Toolbar>

          {selected.size > 0 ? (
            <BulkBar count={selected.size}>
              <Button
                variant="primary"
                size="sm"
                icon={<Unlock size={14} />}
                disabled={busy}
                onClick={() => void bulkOpen(true)}
              >
                فتح التوقع
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Lock size={14} />}
                disabled={busy}
                onClick={() => void bulkOpen(false)}
              >
                إغلاق التوقع
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </Button>
            </BulkBar>
          ) : null}

          <AsyncBlock state={matches}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(match) => match.id}
                selectedIds={selected}
                onToggleSelect={(id) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onToggleSelectAll={(ids) =>
                  setSelected((current) =>
                    ids.every((id) => current.has(id)) ? new Set() : new Set(ids),
                  )
                }
                /*
                 * The requested page and size, not the ones the last answer
                 * came back with. Both are clamped identically on either side,
                 * so they never actually disagree — but reading them off the
                 * fetched page meant the control snapped back to the old value
                 * until the request landed, which on a slow read looks exactly
                 * like a click that did nothing.
                 */
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPage={setPage}
                onPageSize={(next) => {
                  // Row 30 is on page two at 25 a page and page one at 50, so
                  // staying on the current number would land somewhere the
                  // operator did not ask for — or past the end entirely.
                  setPageSize(next);
                  setPage(1);
                }}
                empty={
                  <div className="empty">
                    <span className="empty-icon">
                      <Flag size={22} />
                    </span>
                    <span className="strong">ما بيها مباريات بهذه الفلاتر</span>
                    <span className="fs-small muted">
                      {noAppLeagues
                        ? 'فعّل دوري من شاشة الدوريات حتى تظهر مبارياته هنا'
                        : timeWindow === 'upcoming'
                          ? 'ماكو مباريات جاية — جرّب «السابقة» أو شغّل مزامنة'
                          : 'جرّب مزامنة المزوّد أو غيّر الفلاتر'}
                    </span>
                  </div>
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {scoring ? (
        <ScoreOverrideDialog
          match={scoring}
          onClose={() => setScoring(null)}
          onSaved={() => {
            setScoring(null);
            refresh();
          }}
        />
      ) : null}

      {viewingPicks ? (
        <MatchPredictionsDialog match={viewingPicks} onClose={() => setViewingPicks(null)} />
      ) : null}

      {settling ? (
        <ConfirmDialog
          title="احتساب نقاط المباراة"
          message={
            <>
              راح تنحسب نقاط التوقعات على نتيجة{' '}
              <span className="num strong">
                {settling.homeScore} – {settling.awayScore}
              </span>
              ، وتنضاف لرصيد كل مشترك. التوقعات المحتسبة سابقاً ما تتأثر، فإذا النتيجة غلط صحّحها
              الأول.
            </>
          }
          confirmLabel="احتساب النقاط"
          pending={busy}
          onConfirm={() => void runSettle()}
          onCancel={() => setSettling(null)}
        />
      ) : null}
    </>
  );
}
