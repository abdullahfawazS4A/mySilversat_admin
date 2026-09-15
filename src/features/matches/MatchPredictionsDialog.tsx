/**
 * Every pick on one fixture, plus the distribution.
 *
 * The stats block sits above the table because the aggregate is what an
 * operator actually looks at; the per-user rows are for investigating a
 * specific complaint or removing an abusive entry.
 */

import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { AsyncBlock, Button, Modal, Pill, SearchInput } from '@/components/ui';
import { DataTable, type Column } from '@/components/page';
import { SentimentMeter } from '@/components/charts';
import { outcomeOf, type Match, type Prediction } from '@/types';
import { PREDICTION_OUTCOME } from '@/lib/labels';
import { downloadCsv } from '@/lib/utils';
import { collectAll } from '@/lib/paging';
import { formatDateTimeAr, formatPhone } from '@/lib/format';

export function MatchPredictionsDialog({ match, onClose }: { match: Match; onClose: () => void }) {
  const repos = useRepos();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);

  const stats = useAsync(() => repos.predictions.stats(match.id), [match.id]);
  const picks = useAsync(
    () => repos.predictions.list({ matchId: match.id, search: debounced, page, pageSize: 12 }),
    [match.id, debounced, page],
  );

  const removePick = async (prediction: Prediction) => {
    try {
      await repos.predictions.remove(prediction.id);
      toast('انحذف التوقع');
      picks.reload();
      stats.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    }
  };

  const exportCsv = async () => {
    // Export the whole set, not just the visible page.
    const rows = await collectAll((paging) =>
      repos.predictions.list({ matchId: match.id, ...paging }),
    );
    downloadCsv(`predictions-${match.id}.csv`, [
      ['الاسم', 'الهاتف', 'التوقع', 'النتيجة', 'النقاط', 'وقت التوقع'],
      ...rows.map((row) => [
        row.appUser?.name ?? '',
        row.appUser?.phone ?? '',
        `${row.predictedHomeScore}-${row.predictedAwayScore}`,
        PREDICTION_OUTCOME[outcomeOf(row)].label,
        row.pointsEarned ?? '',
        formatDateTimeAr(row.createdAt),
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<Prediction>[] = [
    {
      key: 'user',
      header: 'المشترك',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body">{row.appUser?.name ?? '—'}</span>
          <span className="fs-tiny dim num">
            {row.appUser ? formatPhone(row.appUser.phone) : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'pick',
      header: 'التوقع',
      numeric: true,
      render: (row) => (
        <span className="fs-body strong num">
          {row.predictedHomeScore} – {row.predictedAwayScore}
        </span>
      ),
    },
    {
      key: 'outcome',
      header: 'النتيجة',
      render: (row) => {
        const meta = PREDICTION_OUTCOME[outcomeOf(row)];
        return <Pill tone={meta.tone}>{meta.label}</Pill>;
      },
    },
    {
      key: 'points',
      header: 'النقاط',
      numeric: true,
      width: 80,
      render: (row) =>
        row.pointsEarned === null ? (
          <span className="dim">—</span>
        ) : (
          <span className="strong num">{row.pointsEarned}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 50,
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          title="حذف التوقع"
          onClick={() => void removePick(row)}
        />
      ),
    },
  ];

  const home = match.homeTeam?.name ?? '—';
  const away = match.awayTeam?.name ?? '—';

  return (
    <Modal
      title={`توقعات ${home} ضد ${away}`}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-5)' }}>
        <AsyncBlock state={stats}>
          {(data) => (
            <div className="col" style={{ gap: 'var(--sp-4)' }}>
              <div className="row between">
                <span className="fs-body strong">توزيع التوقعات</span>
                <span className="fs-small muted">
                  <span className="num strong">{data.total}</span> توقع
                </span>
              </div>

              {/* The meter renders shares, so counts are divided here. */}
              <SentimentMeter
                homeLabel={`فوز ${home}`}
                awayLabel={`فوز ${away}`}
                homeWin={data.total ? data.homeWin / data.total : 0}
                draw={data.total ? data.draw / data.total : 0}
                awayWin={data.total ? data.awayWin / data.total : 0}
              />

              {data.topScorelines.length > 0 ? (
                <div className="col" style={{ gap: 'var(--sp-2)' }}>
                  <span className="fs-small muted">أكثر النتائج توقعاً</span>
                  <div className="row wrap row-gap-2">
                    {data.topScorelines.map((line) => (
                      <span key={`${line.home}-${line.away}`} className="chip">
                        <span className="num strong">
                          {line.home} – {line.away}
                        </span>
                        <span className="dim num">{line.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </AsyncBlock>

        <div className="card">
          <div className="toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم أو هاتف…" />
          </div>
          <AsyncBlock state={picks}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            )}
          </AsyncBlock>
        </div>
      </div>
    </Modal>
  );
}
