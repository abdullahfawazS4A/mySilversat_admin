/**
 * Matches.
 *
 * Fixtures are mirrored from the upstream feed — nothing here creates or
 * deletes one — so this screen answers a single operator question: **out of
 * every fixture the feed gave us, which ones do we open for predictions?**
 *
 * The prediction switch is therefore in the table itself, not buried in a
 * dialog, and it works in bulk: a typical evening means opening five fixtures
 * at once. Everything else on the row is feed data shown read-only, with one
 * escape hatch — correcting a wrong score, because points are settled on it.
 */

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Flag,
  Lock,
  Pencil,
  Pin,
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
import type { Id, MatchState, MatchView } from '@/types';
import { MATCH_STATE } from '@/lib/labels';
import { countdownAr, formatDateAr, formatTimeAr, relativeAr } from '@/lib/format';
import { ScoreOverrideDialog } from './ScoreOverrideDialog';
import { MatchPredictionsDialog } from './MatchPredictionsDialog';

type PredictFilter = 'all' | 'open' | 'closed';

export function MatchesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [state, setState] = useState<MatchState | 'all'>('all');
  const [predictFilter, setPredictFilter] = useState<PredictFilter>('all');
  const [leagueId, setLeagueId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [scoring, setScoring] = useState<MatchView | null>(null);
  const [viewingPicks, setViewingPicks] = useState<MatchView | null>(null);
  const [settling, setSettling] = useState<MatchView | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const leagues = useAsync(() => repos.catalog.leagues(), []);
  const settings = useAsync(() => repos.admin.settings(), []);
  const matches = useAsync(
    () =>
      repos.matches.list({
        search: debounced,
        state,
        predictFilter,
        leagueId: leagueId === 'all' ? undefined : leagueId,
        page,
        pageSize: 25,
      }),
    [debounced, state, predictFilter, leagueId, page],
  );

  const refresh = () => {
    matches.reload();
    setSelected(new Set());
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await repos.matches.sync();
      toast(
        result.matchesUpdated > 0
          ? `انمزامنت ${result.matchesUpdated} مباراة من المزوّد`
          : 'المباريات محدّثة — ما بيها جديد',
      );
      settings.reload();
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّرت المزامنة', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const toggleOpen = async (match: MatchView, open: boolean) => {
    try {
      await repos.matches.setOpenForPredict(match.id, open);
      toast(
        open
          ? `انفتح التوقع على ${match.homeTeam.nameAr} ضد ${match.awayTeam.nameAr}`
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
      await repos.matches.bulkSetOpenForPredict([...selected], open);
      toast(`${open ? 'انفتح' : 'انغلق'} التوقع على ${selected.size} مباراة`);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const runSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      const result = await repos.matches.settle(settling.id);
      toast(`تم احتساب ${result.settled} توقع — ${result.pointsAwarded} نقطة`);
      setSettling(null);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاحتساب', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Column<MatchView>[]>(
    () => [
      {
        key: 'teams',
        header: 'المباراة',
        render: (match) => (
          <div className="row row-gap-3">
            <TeamCrest name={match.homeTeam.nameAr} seed={match.homeTeam.crestSeed} />
            <div className="col" style={{ lineHeight: 1.35 }}>
              <span className="fs-13 strong">
                {match.homeTeam.nameAr} <span className="dim">ضد</span> {match.awayTeam.nameAr}
              </span>
              <span className="fs-11 dim">{match.league.nameAr}</span>
            </div>
            <TeamCrest name={match.awayTeam.nameAr} seed={match.awayTeam.crestSeed} size={26} />
            {match.featured ? <Pin size={13} style={{ color: 'var(--brand-primary)' }} /> : null}
          </div>
        ),
      },
      {
        key: 'kickoffAt',
        header: 'موعد الانطلاق',
        sortable: true,
        render: (match) => (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13">{formatDateAr(match.kickoffAt)}</span>
            <span className="fs-11 dim num">{formatTimeAr(match.kickoffAt)}</span>
          </div>
        ),
      },
      {
        key: 'state',
        header: 'الحالة',
        render: (match) => {
          const meta = MATCH_STATE[match.state];
          return (
            <div className="col" style={{ gap: 3 }}>
              <div className="row row-gap-2">
                <Pill tone={meta.tone} dot={match.state === 'live'}>
                  {meta.label}
                </Pill>
                {match.homeScore !== null && match.awayScore !== null ? (
                  <span className="fs-13 strong num">
                    {match.homeScore} – {match.awayScore}
                    {match.liveMinute ? <span className="dim"> {match.liveMinute}</span> : null}
                  </span>
                ) : null}
              </div>
              {match.scoreOverridden ? (
                <span className="fs-11" style={{ color: 'var(--tone-warning-fg, inherit)' }}>
                  نتيجة مثبتة يدوياً
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'openForPredict',
        header: 'مفتوحة للتوقع',
        width: 168,
        render: (match) => (
          <div className="col" style={{ gap: 3 }}>
            <Switch
              checked={match.openForPredict}
              disabled={!match.openForPredict && match.state !== 'scheduled'}
              onChange={(next) => void toggleOpen(match, next)}
              title={
                match.state !== 'scheduled' && !match.openForPredict
                  ? 'ما تنفتح إلا على مباراة مجدولة'
                  : undefined
              }
            />
            {match.openForPredict && match.predictionCloseAt ? (
              <span className="fs-11 dim">
                يقفل بعد <span className="num">{countdownAr(match.predictionCloseAt)}</span>
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'predictionCount',
        header: 'التوقعات',
        numeric: true,
        sortable: true,
        width: 96,
        render: (match) =>
          match.predictionCount > 0 ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                setViewingPicks(match);
              }}
            >
              <Users size={13} />
              <span className="num">{match.predictionCount}</span>
            </button>
          ) : (
            <span className="dim">—</span>
          ),
      },
      {
        key: 'settled',
        header: 'النقاط',
        width: 120,
        render: (match) =>
          match.settledAt ? (
            <Pill tone="success">محتسبة</Pill>
          ) : match.state === 'finished' && match.predictionCount > 0 ? (
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

  const openCount = matches.data?.items.filter((m) => m.openForPredict).length ?? 0;
  const feed = settings.data?.matchFeed;

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

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        {feed ? (
          <Notice tone={feed.lastSyncOk === false ? 'danger' : 'info'}>
            المباريات والفرق تجي من <span className="strong">{feed.providerName}</span> — ما تنضاف
            يدوياً.{' '}
            {feed.lastSyncAt ? (
              <>
                آخر مزامنة <span className="num">{relativeAr(feed.lastSyncAt)}</span>
                {feed.lastSyncMessageAr ? ` — ${feed.lastSyncMessageAr}` : ''}.
              </>
            ) : (
              'ما صارت مزامنة بعد.'
            )}
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
                { value: 'all' as const, label: 'كل الدوريات' },
                ...(leagues.data ?? []).map((league) => ({ value: league.id, label: league.nameAr })),
              ]}
            />

            <Select
              value={state}
              onChange={(next) => {
                setState(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل الحالات' },
                { value: 'scheduled' as const, label: 'مجدولة' },
                { value: 'live' as const, label: 'مباشر' },
                { value: 'finished' as const, label: 'منتهية' },
                { value: 'postponed' as const, label: 'مؤجلة' },
                { value: 'cancelled' as const, label: 'ملغاة' },
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
                { value: 'open', label: 'مفتوحة للتوقع', count: openCount },
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
              راح تنحسب النقاط لـ <span className="num strong">{settling.predictionCount}</span> توقع على
              نتيجة <span className="num strong">{settling.homeScore} – {settling.awayScore}</span>، وتنضاف
              لسجل نقاط كل مشترك. تكدر تتراجع عنها لاحقاً إذا طلعت النتيجة غلط.
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
