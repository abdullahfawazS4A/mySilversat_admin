/**
 * Every prediction in the system, and the button that settles them.
 *
 * Scoring is the operator's real job here. `احتساب المعلّقة` walks every
 * finished match that still has unpaid picks and awards points in one pass —
 * which is what an operator wants at the end of a matchday, rather than
 * opening each fixture in turn.
 *
 * Points are fixed server-side (exact score 25, right outcome 10) and shown on
 * the screen so the rule is visible rather than folklore.
 */

import { useState } from 'react';
import { Calculator, Target, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  Notice,
  Pill,
  SearchInput,
  Select,
} from '@/components/ui';
import { formatDateTimeAr, formatPhone } from '@/lib/format';
import { PREDICTION_OUTCOME } from '@/lib/labels';
import { outcomeOf, SCORING, type Id, type Prediction, type PredictionOutcome } from '@/types';

type OutcomeFilter = 'all' | PredictionOutcome;

export function PredictionsPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [matchId, setMatchId] = useState<Id | 'all'>('all');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [page, setPage] = useState(1);

  const [removing, setRemoving] = useState<Prediction | null>(null);
  const [settling, setSettling] = useState(false);
  const [busy, setBusy] = useState(false);

  // Only fixtures that actually have picks are worth filtering by, but the API
  // cannot tell us that, so the picker lists what the feed gave us instead.
  const matches = useAsync(() => repos.matches.matches.all(), []);

  const predictions = useAsync(
    () =>
      repos.predictions.list({
        matchId: matchId === 'all' ? undefined : matchId,
        search: debounced,
        page,
        pageSize: 25,
      }),
    [matchId, debounced, page],
  );

  /**
   * The outcome filter is applied to the fetched page, not the query.
   *
   * `/predictions` has no filter for it, and fetching every row to filter
   * properly would be a heavy read on the busiest table in the system. The
   * chips therefore narrow what is on screen — the count next to each is of
   * this page, which is why they carry no totals.
   */
  const visible = (rows: Prediction[]) =>
    outcome === 'all' ? rows : rows.filter((row) => outcomeOf(row) === outcome);

  const runScorePending = async () => {
    setBusy(true);
    try {
      const result = await repos.predictions.scorePending();
      toast(
        result.scored > 0
          ? `انحسبت نقاط ${result.scored} توقع`
          : 'ماكو توقعات معلّقة تنحسب',
      );
      setSettling(false);
      predictions.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاحتساب', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await repos.predictions.remove(removing.id);
      toast('انحذف التوقع');
      setRemoving(null);
      predictions.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Prediction>[] = [
    {
      key: 'user',
      header: 'المشترك',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">{row.appUser?.name ?? '—'}</span>
          <span className="fs-11 dim num">{row.appUser ? formatPhone(row.appUser.phone) : ''}</span>
        </div>
      ),
    },
    {
      key: 'match',
      header: 'المباراة',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-13">
            {row.match?.homeTeam?.name ?? '—'} <span className="dim">ضد</span>{' '}
            {row.match?.awayTeam?.name ?? '—'}
          </span>
          <span className="fs-11 dim">{row.match?.league?.name ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'pick',
      header: 'التوقع',
      numeric: true,
      width: 90,
      render: (row) => (
        <span className="fs-13 strong num">
          {row.predictedHomeScore} – {row.predictedAwayScore}
        </span>
      ),
    },
    {
      key: 'actual',
      header: 'النتيجة',
      numeric: true,
      width: 90,
      render: (row) =>
        row.match && row.match.homeScore !== null && row.match.awayScore !== null ? (
          <span className="num">
            {row.match.homeScore} – {row.match.awayScore}
          </span>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'outcome',
      header: 'الحالة',
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
      key: 'createdAt',
      header: 'وقت التوقع',
      render: (row) => <span className="fs-12">{formatDateTimeAr(row.createdAt)}</span>,
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
          onClick={() => setRemoving(row)}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="التوقعات"
        subtitle="توقعات المشتركين على المباريات، واحتساب نقاطها"
        actions={
          <Button
            variant="primary"
            icon={<Calculator size={15} />}
            onClick={() => setSettling(true)}
          >
            احتساب المعلّقة
          </Button>
        }
      />

      <div className="page">
        <Notice tone="info">
          النقاط ثابتة على السيرفر: <span className="strong num">{SCORING.exact}</span> نقطة للنتيجة
          المطابقة، و<span className="strong num">{SCORING.sameOutcome}</span> إذا طلعت نفس النتيجة
          (فوز/تعادل) بفارق مختلف.
        </Notice>

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="ابحث بمشترك أو فريق…"
            />
            <Select
              value={matchId}
              onChange={(next) => {
                setMatchId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل المباريات' },
                ...(matches.data ?? []).map((match) => ({
                  value: match.id,
                  label: `${match.homeTeam?.name ?? '—'} × ${match.awayTeam?.name ?? '—'}`,
                })),
              ]}
            />
          </Toolbar>

          <Toolbar>
            <FilterChips<OutcomeFilter>
              value={outcome}
              onChange={setOutcome}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'pending', label: PREDICTION_OUTCOME.pending.label },
                { value: 'exact', label: PREDICTION_OUTCOME.exact.label },
                { value: 'outcome', label: PREDICTION_OUTCOME.outcome.label },
                { value: 'wrong', label: PREDICTION_OUTCOME.wrong.label },
              ]}
            />
          </Toolbar>

          <AsyncBlock state={predictions}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={visible(data.items)}
                rowKey={(row) => row.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <EmptyState
                    icon={<Target size={20} />}
                    title="ماكو توقعات"
                    hint={
                      outcome === 'all'
                        ? 'ما شارك أحد بهذه الفلاتر'
                        : 'ماكو توقعات بهذه الحالة ضمن هذه الصفحة'
                    }
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {settling ? (
        <ConfirmDialog
          title="احتساب التوقعات المعلّقة"
          confirmLabel="احتساب"
          pending={busy}
          message="راح تنحسب نقاط كل مباراة منتهية عدها توقعات ما انحسبت بعد. التوقعات المحتسبة سابقاً ما تتأثر. تأكد من صحة النتائج قبل ما تكمل."
          onConfirm={() => void runScorePending()}
          onCancel={() => setSettling(false)}
        />
      ) : null}

      {removing ? (
        <ConfirmDialog
          danger
          title="حذف التوقع"
          confirmLabel="حذف"
          pending={busy}
          message={
            <>
              راح ينحذف توقع <span className="strong">{removing.appUser?.name ?? 'المشترك'}</span>{' '}
              نهائياً. إذا كان محتسب، النقاط اللي أخذها ما ترجع تلقائياً.
            </>
          }
          onConfirm={() => void runRemove()}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
