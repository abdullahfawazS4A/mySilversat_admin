/**
 * The prediction leaderboard, in two views.
 *
 * - **الترتيب العام** ranks on each user's points balance, the number the
 *   app's board shows. The server searches, filters and pages it.
 * - **الشهر الماضي** ranks on points earned by predictions on last calendar
 *   month's matches (Baghdad time). That route returns one list and nothing
 *   else, so search, province and paging run here over it.
 *
 * Ties share a rank: two users on 40 points are both 3rd and the next is 5th.
 */

import { useMemo, useState } from 'react';
import { Download, RotateCcw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAuth } from '@/app/AuthContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Pill,
  SearchInput,
  Select,
  Tabs,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatNumber, formatPercent, formatPhone } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';
import { collectAll } from '@/lib/paging';
import type { Id, LeaderboardRow, Page } from '@/types';

type View = 'all' | 'lastMonth';

const PAGE_SIZE = 25;

/** "أيلول 2026" for the calendar month before now, in Baghdad. */
function lastMonthLabel(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  // Mid-month at noon UTC, so no time zone can push it into a neighbour.
  const previous = new Date(Date.UTC(month === 1 ? year - 1 : year, (month + 10) % 12, 15, 12));
  return new Intl.DateTimeFormat('ar-IQ', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(previous);
}

/** The podium gets its own treatment; everyone else is a plain number. */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Pill tone="gold">الأول</Pill>;
  if (rank === 2) return <Pill tone="neutral">الثاني</Pill>;
  if (rank === 3) return <Pill tone="neutral">الثالث</Pill>;
  return <span className="num dim">{rank}</span>;
}

export function LeaderboardPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const { session } = useAuth();
  // The server refuses everyone else with 403, so the button is not offered.
  const canReset = session?.admin?.role === 'SUPER_ADMIN';
  const [confirmReset, setConfirmReset] = useState(false);
  const [runReset, reset] = useAction();

  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [provinceId, setProvinceId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const overall = useAsync(
    () =>
      view === 'all'
        ? repos.appUsers.leaderboard({
            search: debounced,
            provinceId: provinceId === 'all' ? undefined : provinceId,
            page,
            pageSize: PAGE_SIZE,
          })
        : Promise.resolve(undefined),
    [view, debounced, provinceId, page],
  );

  const lastMonth = useAsync(
    () => (view === 'lastMonth' ? repos.appUsers.lastMonthLeaderboard() : Promise.resolve(undefined)),
    [view],
  );
  const monthLabel = useMemo(lastMonthLabel, []);

  /** Last month's rows after the search and province the operator picked. */
  const monthFiltered = useMemo(() => {
    const needle = debounced.trim().toLowerCase();
    const provinceName =
      provinceId === 'all' ? null : provinces.data?.find((row) => row.id === provinceId)?.name ?? null;
    return (lastMonth.data ?? []).filter(
      (row) =>
        (!needle ||
          row.user.name.toLowerCase().includes(needle) ||
          row.user.phone.includes(needle)) &&
        (!provinceName || row.provinceName === provinceName),
    );
  }, [lastMonth.data, debounced, provinceId, provinces.data]);

  // The route may leave the province off its rows; filtering on it then would
  // empty the board, so the select is only offered when it can work.
  const monthHasProvince = (lastMonth.data ?? []).some((row) => row.provinceName);
  const showProvince = view === 'all' || monthHasProvince;

  const board =
    view === 'all'
      ? overall
      : {
          ...lastMonth,
          data: lastMonth.data
            ? ({
                items: monthFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
                total: monthFiltered.length,
                page,
                pageSize: PAGE_SIZE,
              } satisfies Page<LeaderboardRow>)
            : undefined,
        };

  const exportCsv = async () => {
    const rows =
      view === 'lastMonth'
        ? monthFiltered
        : await collectAll((paging) =>
            repos.appUsers.leaderboard({
              provinceId: provinceId === 'all' ? undefined : provinceId,
              ...paging,
            }),
          );
    downloadCsv(view === 'lastMonth' ? 'leaderboard-last-month.csv' : 'leaderboard.csv', [
      ['الترتيب', 'الاسم', 'الهاتف', 'المحافظة', 'النقاط', 'التوقعات', 'الدقة'],
      ...rows.map((row) => [
        row.rank,
        row.user.name,
        row.user.phone,
        row.provinceName ?? '',
        row.points,
        row.predictionCount,
        formatPercent(row.accuracy),
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<LeaderboardRow>[] = [
    {
      key: 'rank',
      header: 'الترتيب',
      width: 92,
      render: (row) => <RankBadge rank={row.rank} />,
    },
    {
      key: 'user',
      header: 'المشترك',
      render: (row) => (
        <Link className="col lh-tight" to={`/users/${row.user.id}`}>
          <span className="fs-body strong">{row.user.name}</span>
          <span className="fs-tiny dim num">{formatPhone(row.user.phone)}</span>
        </Link>
      ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => row.provinceName ?? '—',
    },
    {
      key: 'points',
      header: 'النقاط',
      numeric: true,
      width: 96,
      render: (row) => <span className="num strong">{formatNumber(row.points)}</span>,
    },
    {
      key: 'predictions',
      header: 'التوقعات',
      numeric: true,
      width: 96,
      render: (row) => <span className="num">{formatNumber(row.predictionCount)}</span>,
    },
    {
      key: 'accuracy',
      header: 'الدقة',
      numeric: true,
      width: 90,
      render: (row) =>
        row.predictionCount === 0 ? (
          <span className="dim">—</span>
        ) : (
          <span className="num">{formatPercent(row.accuracy)}</span>
        ),
    },
  ];

  const rows = board.data?.items ?? [];
  const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);
  const totalPicks = rows.reduce((sum, row) => sum + row.predictionCount, 0);

  return (
    <>
      <PageHeader
        title="الترتيب والنقاط"
        subtitle="ترتيب المتوقعين حسب النقاط — نفس الترتيب اللي يشوفه المشترك بالتطبيق"
        actions={
          <>
            {canReset ? (
              <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirmReset(true)}>
                تصفير النقاط
              </Button>
            ) : null}
            <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
              تصدير CSV
            </Button>
          </>
        }
      />

      <div className="page">
        <div className="grid grid-kpi-3">
          <StatTile label="عدد المتنافسين" value={formatNumber(board.data?.total ?? 0)} />
          <StatTile label="نقاط هذه الصفحة" value={formatNumber(totalPoints)} />
          <StatTile label="توقعات هذه الصفحة" value={formatNumber(totalPicks)} />
        </div>

        <Tabs
          value={view}
          onChange={(next) => {
            setView(next);
            setPage(1);
          }}
          items={[
            { value: 'all', label: 'الترتيب العام' },
            { value: 'lastMonth', label: `الشهر الماضي — ${monthLabel}` },
          ]}
        />

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="ابحث باسم أو هاتف…"
            />
            {showProvince ? (
              <Select
                value={provinceId}
                onChange={(next) => {
                  setProvinceId(next);
                  setPage(1);
                }}
                options={[
                  { value: 'all' as const, label: 'كل المحافظات' },
                  ...(provinces.data ?? []).map((row) => ({ value: row.id, label: row.name })),
                ]}
              />
            ) : null}
          </Toolbar>

          <AsyncBlock state={board}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.user.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  view === 'lastMonth' ? (
                    <EmptyState
                      icon={<Trophy size={20} />}
                      title="ماكو نقاط بالشهر الماضي"
                      hint={`ما احتسبت نقاط لتوقعات مباريات ${monthLabel}`}
                    />
                  ) : (
                    <EmptyState
                      icon={<Trophy size={20} />}
                      title="ماكو ترتيب بعد"
                      hint="ما احتسبت نقاط لأي مشترك لحد الآن"
                    />
                  )
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {confirmReset ? (
        <ConfirmDialog
          danger
          title="تصفير نقاط كل المشتركين"
          confirmLabel="صفّر النقاط"
          pending={reset.pending}
          message={
            <>
              نقاط <span className="strong">كل المشتركين</span> راح ترجع صفر، والترتيب يبدي من جديد بالتطبيق.
              ما تكدر ترجّعها من اللوحة — صدّر CSV قبلها إذا تحتاج الأرقام الحالية.
              <div className="mt-2 dim">سجل التوقعات والنقاط اللي اخذها كل توقع يبقى مثل ما هو.</div>
              {reset.error ? <div className="field-error mt-2">{reset.error}</div> : null}
            </>
          }
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            const ok = await runReset(() => repos.appUsers.resetPoints());
            if (ok) {
              setConfirmReset(false);
              toast('تم تصفير النقاط');
              board.reload();
            }
          }}
        />
      ) : null}
    </>
  );
}
