/**
 * Predictions overview.
 *
 * The matches screen is where fixtures are managed; this screen is the
 * competition's own operating view — what is accepting picks right now, what
 * finished and still owes its players points, and what the scoring rules
 * currently pay.
 *
 * The "awaiting settlement" queue is the reason this screen exists: a finished
 * match with unsettled picks is a silent failure the operator must not have to
 * hunt for.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Target, Users } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Notice,
  Pill,
  TeamCrest,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { MatchView } from '@/types';
import { countdownAr, formatDateTimeAr, formatNumber } from '@/lib/format';
import { MatchPredictionsDialog } from '../matches/MatchPredictionsDialog';

function MatchRow({
  match,
  right,
  onOpenPicks,
}: {
  match: MatchView;
  right: React.ReactNode;
  onOpenPicks: () => void;
}) {
  return (
    <div
      className="row row-gap-3 wrap"
      style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
    >
      <TeamCrest name={match.homeTeam.nameAr} seed={match.homeTeam.crestSeed} size={28} />
      <TeamCrest name={match.awayTeam.nameAr} seed={match.awayTeam.crestSeed} size={28} />
      <div className="col grow" style={{ lineHeight: 1.35, minWidth: 160 }}>
        <span className="fs-13 strong">
          {match.homeTeam.nameAr} <span className="dim">ضد</span> {match.awayTeam.nameAr}
        </span>
        <span className="fs-11 dim">
          {match.league.nameAr} · {formatDateTimeAr(match.kickoffAt)}
        </span>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onOpenPicks}>
        <Users size={13} />
        <span className="num">{match.predictionCount}</span>
      </button>
      {right}
    </div>
  );
}

export function PredictionsPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [viewing, setViewing] = useState<MatchView | null>(null);
  const [settling, setSettling] = useState<MatchView | null>(null);
  const [busy, setBusy] = useState(false);

  const settings = useAsync(() => repos.admin.settings(), []);
  const all = useAsync(() => repos.matches.list({ pageSize: 500 }), []);

  const openNow = (all.data?.items ?? []).filter(
    (m) => m.openForPredict && m.state === 'scheduled',
  );
  const awaiting = (all.data?.items ?? []).filter(
    (m) => m.state === 'finished' && m.predictionCount > 0 && !m.settledAt,
  );
  const settled = (all.data?.items ?? []).filter((m) => m.settledAt);
  const totalPicks = (all.data?.items ?? []).reduce((sum, m) => sum + m.predictionCount, 0);

  const runSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      const result = await repos.matches.settle(settling.id);
      toast(`تم احتساب ${result.settled} توقع — ${result.pointsAwarded} نقطة`);
      setSettling(null);
      all.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاحتساب', 'error');
    } finally {
      setBusy(false);
    }
  };

  const settleAll = async () => {
    setBusy(true);
    let done = 0;
    for (const match of awaiting) {
      try {
        await repos.matches.settle(match.id);
        done += 1;
      } catch {
        // Keep going: one bad fixture must not block the rest of the queue.
      }
    }
    toast(`تم احتساب نقاط ${done} مباراة`);
    setBusy(false);
    all.reload();
  };

  return (
    <>
      <PageHeader
        title="التوقعات"
        subtitle="حالة المسابقة: شنو مفتوح للتوقع الآن، وشنو ينتظر احتساب النقاط"
      />

      <div className="page">
        <div className="grid grid-kpi">
          <StatTile
            label="مباريات مفتوحة للتوقع"
            value={formatNumber(openNow.length)}
            icon={<Target size={15} />}
          />
          <StatTile
            label="تنتظر احتساب النقاط"
            value={formatNumber(awaiting.length)}
            icon={<AlertTriangle size={15} />}
            tone={awaiting.length > 0 ? 'warning' : undefined}
          />
          <StatTile
            label="مباريات محتسبة"
            value={formatNumber(settled.length)}
            icon={<CheckCircle2 size={15} />}
            tone="success"
          />
          <StatTile label="إجمالي التوقعات" value={formatNumber(totalPicks)} icon={<Users size={15} />} />
        </div>

        {awaiting.length > 0 ? (
          <Card>
            <CardHead
              title="تنتظر احتساب النقاط"
              subtitle="مباريات انتهت وتوقعاتها ما انحسبت بعد — المشترك ما راح يشوف نقاطه حتى تحتسبها"
              actions={
                <Button variant="primary" disabled={busy} onClick={() => void settleAll()}>
                  {busy ? 'جاري الاحتساب…' : `احتساب الكل (${awaiting.length})`}
                </Button>
              }
            />
            {awaiting.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                onOpenPicks={() => setViewing(match)}
                right={
                  <div className="row row-gap-2">
                    <span className="fs-13 strong num">
                      {match.homeScore} – {match.awayScore}
                    </span>
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={<CheckCircle2 size={13} />}
                      onClick={() => setSettling(match)}
                    >
                      احتساب
                    </Button>
                  </div>
                }
              />
            ))}
          </Card>
        ) : null}

        <Card>
          <CardHead
            title="مفتوحة للتوقع الآن"
            subtitle="هذي المباريات تظهر للمشترك في شاشة توقع واربح"
          />
          <AsyncBlock state={all}>
            {() =>
              openNow.length === 0 ? (
                <EmptyState
                  title="ما بيها مباراة مفتوحة للتوقع"
                  hint="افتح مباريات من شاشة المباريات حتى تظهر للمشتركين"
                  icon={<Target size={22} />}
                />
              ) : (
                <>
                  {openNow.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      onOpenPicks={() => setViewing(match)}
                      right={
                        <Pill tone="warning">
                          <Clock size={12} />
                          يقفل بعد {countdownAr(match.predictionCloseAt)}
                        </Pill>
                      }
                    />
                  ))}
                </>
              )
            }
          </AsyncBlock>
        </Card>

        <AsyncBlock state={settings}>
          {(data) => (
            <Card>
              <CardHead
                title="قواعد احتساب النقاط الحالية"
                subtitle="تتعدل من شاشة الإعدادات — التغيير يسري على الاحتسابات الجاية فقط"
              />
              <div className="card-pad">
                <div className="grid grid-3">
                  {[
                    ['نتيجة بالضبط', data.scoring.exactScore],
                    ['فرق أهداف صحيح', data.scoring.goalDifference],
                    ['نتيجة صحيحة (فائز)', data.scoring.correctResult],
                    ['توقع خاطئ', data.scoring.wrong],
                    ['نقطة المشاركة', data.scoring.participation],
                  ].map(([label, value]) => (
                    <div key={label as string} className="row between fs-13">
                      <span className="muted">{label}</span>
                      <span className="strong num">{value as number}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Notice tone="info">
                    نقطة المشاركة تنضاف فوق أي نتيجة، يعني توقع صحيح بالضبط يعطي{' '}
                    <span className="num strong">
                      {data.scoring.exactScore + data.scoring.participation}
                    </span>{' '}
                    نقطة.
                  </Notice>
                </div>
              </div>
            </Card>
          )}
        </AsyncBlock>
      </div>

      {viewing ? <MatchPredictionsDialog match={viewing} onClose={() => setViewing(null)} /> : null}

      {settling ? (
        <ConfirmDialog
          title="احتساب نقاط المباراة"
          message={
            <>
              راح تنحسب النقاط لـ <span className="num strong">{settling.predictionCount}</span> توقع على
              نتيجة{' '}
              <span className="num strong">
                {settling.homeScore} – {settling.awayScore}
              </span>
              .
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
