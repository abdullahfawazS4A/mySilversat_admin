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
import type { MatchView, PredictionView } from '@/types';
import { PREDICTION_OUTCOME } from '@/lib/labels';
import { downloadCsv } from '@/lib/utils';
import { formatDateTimeAr, formatPhone } from '@/lib/format';

export function MatchPredictionsDialog({
  match,
  onClose,
}: {
  match: MatchView;
  onClose: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);

  const stats = useAsync(() => repos.matches.predictionStats(match.id), [match.id]);
  const picks = useAsync(
    () => repos.matches.predictions(match.id, { search: debounced, page, pageSize: 12 }),
    [match.id, debounced, page],
  );

  const removePick = async (prediction: PredictionView) => {
    try {
      await repos.matches.deletePrediction(prediction.id);
      toast('انحذف التوقع');
      picks.reload();
      stats.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    }
  };

  const exportCsv = async () => {
    // Export the whole set, not just the visible page.
    const all = await repos.matches.predictions(match.id, { pageSize: 100000 });
    downloadCsv(`predictions-${match.id}.csv`, [
      ['الاسم', 'الهاتف', 'التوقع', 'النتيجة', 'النقاط', 'وقت التوقع'],
      ...all.items.map((p) => [
        p.userName,
        p.userPhone,
        `${p.homePick}-${p.awayPick}`,
        PREDICTION_OUTCOME[p.outcome].label,
        p.pointsAwarded ?? '',
        formatDateTimeAr(p.createdAt),
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<PredictionView>[] = [
    {
      key: 'user',
      header: 'المشترك',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{row.userName}</span>
          <span className="fs-11 dim num">{formatPhone(row.userPhone)}</span>
        </div>
      ),
    },
    {
      key: 'pick',
      header: 'التوقع',
      numeric: true,
      render: (row) => (
        <span className="fs-13 strong num">
          {row.homePick} – {row.awayPick}
        </span>
      ),
    },
    {
      key: 'outcome',
      header: 'النتيجة',
      render: (row) => {
        const meta = PREDICTION_OUTCOME[row.outcome];
        return <Pill tone={meta.tone}>{meta.label}</Pill>;
      },
    },
    {
      key: 'pointsAwarded',
      header: 'النقاط',
      numeric: true,
      sortable: true,
      width: 80,
      render: (row) =>
        row.pointsAwarded === null ? <span className="dim">—</span> : <span className="strong num">{row.pointsAwarded}</span>,
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

  return (
    <Modal
      title={`توقعات ${match.homeTeam.nameAr} ضد ${match.awayTeam.nameAr}`}
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
                <span className="fs-13 strong">توزيع التوقعات</span>
                <span className="fs-12 muted">
                  <span className="num strong">{data.total}</span> توقع
                </span>
              </div>

              <SentimentMeter
                homeLabel={`فوز ${match.homeTeam.nameAr}`}
                awayLabel={`فوز ${match.awayTeam.nameAr}`}
                homeWin={data.homeWin}
                draw={data.draw}
                awayWin={data.awayWin}
              />

              {data.topScorelines.length > 0 ? (
                <div className="col" style={{ gap: 'var(--sp-2)' }}>
                  <span className="fs-12 muted">أكثر النتائج توقعاً</span>
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
