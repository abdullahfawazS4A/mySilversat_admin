/**
 * Matches.
 *
 * Fixtures are mirrored from API-Football — nothing here creates or deletes
 * one — so this screen answers a single operator question: **out of every
 * fixture the feed gave us, which ones do we open for predictions?**
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
import { MATCH_STATUS } from '@/lib/labels';
import { countdownAr, formatDateAr, formatTimeAr } from '@/lib/format';
import { ScoreOverrideDialog } from './ScoreOverrideDialog';
import { MatchPredictionsDialog } from './MatchPredictionsDialog';

type PredictFilter = 'all' | 'open' | 'closed';

/** A crest seed from the team id, so the same team always gets the same look. */
function crestSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

export function MatchesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState<MatchStatus | 'all'>('all');
  const [predictFilter, setPredictFilter] = useState<PredictFilter>('all');
  const [leagueId, setLeagueId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [scoring, setScoring] = useState<Match | null>(null);
  const [viewingPicks, setViewingPicks] = useState<Match | null>(null);
  const [settling, setSettling] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const leagues = useAsync(() => repos.matches.leagues.all(), []);
  const matches = useAsync(
    () =>
      repos.matches.matches.list({
        search: debounced,
        status: status === 'all' ? undefined : status,
        leagueId: leagueId === 'all' ? undefined : leagueId,
        isOpenForPrediction: predictFilter === 'all' ? undefined : predictFilter === 'open',
        page,
        pageSize: 25,
      }),
    [debounced, status, predictFilter, leagueId, page],
  );

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
            />
            <div className="col" style={{ lineHeight: 1.35 }}>
              <span className="fs-13 strong">
                {match.homeTeam?.name ?? '—'} <span className="dim">ضد</span>{' '}
                {match.awayTeam?.name ?? '—'}
              </span>
              <span className="fs-11 dim">{match.league?.name ?? ''}</span>
            </div>
            <TeamCrest
              name={match.awayTeam?.name ?? '—'}
              seed={crestSeed(match.awayTeamId)}
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
            <span className="fs-13">{formatDateAr(match.matchAt)}</span>
            <span className="fs-11 dim num">{formatTimeAr(match.matchAt)}</span>
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
                <span className="fs-13 strong num">
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
                <span className="fs-11 dim">
                  يقفل بعد <span className="num">{countdownAr(match.predictionClosesAt)}</span>
                </span>
              ) : (
                <span className="fs-11 dim">انقفل التوقع</span>
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
        title="المباريات"
        subtitle="المباريات تجي جاهزة من المزوّد — وهنا تختار أي وحدة تنفتح للتوقع داخل التطبيق"
        actions={
          <Button
            variant="primary"
            icon={<RefreshCw size={16} />}
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? 'جاري المزامنة…' : 'مزامنة الآن'}
          </Button>
        }
      />

      <div className="page">
        <Notice tone="info">
          المباريات والفرق تجي من <span className="strong">API-Football</span> — ما تنضاف يدوياً.
          المزامنة تجيب المباريات الجديدة وتحدّث نتائج المباريات المباشرة.
        </Notice>

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
                { value: 'all' as const, label: 'كل الدوريات' },
                ...(leagues.data ?? []).map((league) => ({ value: league.id, label: league.name })),
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
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <div className="empty">
                    <span className="empty-icon">
                      <Flag size={22} />
                    </span>
                    <span className="strong">ما بيها مباريات بهذه الفلاتر</span>
                    <span className="fs-12 muted">جرّب مزامنة المزوّد أو غيّر الفلاتر</span>
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
