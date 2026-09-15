/**
 * The prediction leaderboard.
 *
 * There is no leaderboard endpoint an admin can call — `/app-auth/leaderboard`
 * belongs to the app's own token — so the repository builds the board by
 * ranking app users on the `points` column, which is the column the app's
 * board reads too. The numbers therefore agree with what a subscriber sees.
 *
 * Ties share a rank: two users on 40 points are both 3rd and the next is 5th.
 */

import { useState } from 'react';
import { Download, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  EmptyState,
  Pill,
  SearchInput,
  Select,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatNumber, formatPercent, formatPhone } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';
import { collectAll } from '@/lib/paging';
import type { Id, LeaderboardRow } from '@/types';

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

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [provinceId, setProvinceId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const board = useAsync(
    () =>
      repos.appUsers.leaderboard({
        search: debounced,
        provinceId: provinceId === 'all' ? undefined : provinceId,
        page,
        pageSize: 25,
      }),
    [debounced, provinceId, page],
  );

  const exportCsv = async () => {
    const rows = await collectAll((paging) =>
      repos.appUsers.leaderboard({
        provinceId: provinceId === 'all' ? undefined : provinceId,
        ...paging,
      }),
    );
    downloadCsv('leaderboard.csv', [
      ['الترتيب', 'الاسم', 'الهاتف', 'المحافظة', 'النقاط', 'التوقعات', 'الدقة'],
      ...rows.map((row) => [
        row.rank,
        row.user.name,
        row.user.phone,
        row.user.province?.name ?? '',
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
        <Link className="col" to={`/users/${row.user.id}`} style={{ lineHeight: 1.35 }}>
          <span className="fs-body strong">{row.user.name}</span>
          <span className="fs-tiny dim num">{formatPhone(row.user.phone)}</span>
        </Link>
      ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => row.user.province?.name ?? '—',
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
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        <div className="grid grid-kpi-3">
          <StatTile label="عدد المتنافسين" value={formatNumber(board.data?.total ?? 0)} />
          <StatTile label="نقاط هذه الصفحة" value={formatNumber(totalPoints)} />
          <StatTile label="توقعات هذه الصفحة" value={formatNumber(totalPicks)} />
        </div>

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
                  <EmptyState
                    icon={<Trophy size={20} />}
                    title="ماكو ترتيب بعد"
                    hint="ما احتسبت نقاط لأي مشترك لحد الآن"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>
    </>
  );
}
