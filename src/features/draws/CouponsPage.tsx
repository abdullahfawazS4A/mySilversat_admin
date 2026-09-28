/**
 * Draw coupons — what an admin token can see of them, and the draw itself.
 *
 * The server issues a coupon on every renewal, and the only route that lists
 * them is `/coupons/my`, which answers for the signed-in app user and refuses
 * an admin. So this screen cannot show every coupon, or how many a draw has.
 * What it can show is each draw's winning coupon: the server records it when
 * the draw is held, and the single-draw read joins its code.
 *
 * Holding the draw is here too. It is the one irreversible thing on the screen:
 * the server picks a coupon at random, once per draw, and switches the draw off
 * in the app. So it goes through a confirmation that says exactly that, and
 * says it more loudly when the announced date has not come yet — the app is
 * still counting down to it.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Shuffle, Ticket, Trophy } from 'lucide-react';
import { DataTable, PageHeader, type Column } from '@/components/page';
import { AsyncBlock, Button, Card, ConfirmDialog, EmptyState, Notice, Pill } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import type { AppUser, PrizeDraw } from '@/types';
import { countdownAr, formatDateTimeAr } from '@/lib/format';

/** A draw with its winner's name, when it has one. */
interface DrawRow {
  draw: PrizeDraw;
  winner: AppUser | null;
}

function isOver(draw: PrizeDraw): boolean {
  return new Date(draw.drawAt).getTime() <= Date.now();
}

/** Held draws first, newest win on top; then the rest, soonest date first. */
function byDrawOrder(a: PrizeDraw, b: PrizeDraw): number {
  if (a.winnerSelectedAt && b.winnerSelectedAt) return b.winnerSelectedAt.localeCompare(a.winnerSelectedAt);
  if (a.winnerSelectedAt) return -1;
  if (b.winnerSelectedAt) return 1;
  return a.drawAt.localeCompare(b.drawAt);
}

export function CouponsPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [drawing, setDrawing] = useState<PrizeDraw | null>(null);

  const rows = useAsync<DrawRow[]>(async () => {
    const draws = await repos.content.prizeDraws.all();
    return Promise.all(
      [...draws].sort(byDrawOrder).map(async (listed): Promise<DrawRow> => {
        if (!listed.winnerCouponId) return { draw: listed, winner: null };
        // The list carries the coupon's id only; the single read joins its code.
        const [draw, winner] = await Promise.all([
          repos.content.prizeDraws.get(listed.id),
          listed.winnerAppUserId
            ? repos.appUsers.get(listed.winnerAppUserId).catch(() => null)
            : Promise.resolve(null),
        ]);
        return { draw, winner };
      }),
    );
  }, []);

  const hold = async () => {
    if (!drawing) return;
    const ok = await run(() => repos.content.prizeDraws.drawWinner(drawing.id));
    if (!ok) return;
    toast('انسحب الفائز');
    setDrawing(null);
    rows.reload();
  };

  const columns: Column<DrawRow>[] = [
    {
      key: 'draw',
      header: 'السحب',
      render: ({ draw }) => (
        <div className="col">
          <span className="strong">{draw.titleAr}</span>
          <span className="fs-tiny dim num">{formatDateTimeAr(draw.drawAt)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      width: 150,
      render: ({ draw }) =>
        draw.winnerCouponId ? (
          <Pill tone="gold">انسحب</Pill>
        ) : isOver(draw) ? (
          <Pill tone="warning">فات موعده</Pill>
        ) : (
          <div className="col">
            <Pill tone="neutral">بانتظار السحب</Pill>
            <span className="fs-tiny dim mt-1">باقي {countdownAr(draw.drawAt)}</span>
          </div>
        ),
    },
    {
      key: 'coupon',
      header: 'الكوبون الفائز',
      render: ({ draw }) =>
        draw.winnerCoupon ? (
          <span className="strong num" dir="ltr">
            {draw.winnerCoupon.code}
          </span>
        ) : draw.winnerCouponId ? (
          <span className="fs-small dim num" dir="ltr">
            {draw.winnerCouponId}
          </span>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'winner',
      header: 'الفائز',
      render: ({ draw, winner }) =>
        draw.winnerAppUserId ? (
          <Link className="col" to={`/users/${draw.winnerAppUserId}`}>
            <span className="fs-small strong">{winner?.name || 'فتح سجل المشترك'}</span>
            {winner?.phone ? (
              <span className="fs-tiny dim num" dir="ltr">
                {winner.phone}
              </span>
            ) : null}
          </Link>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'selectedAt',
      header: 'وقت السحب',
      render: ({ draw }) =>
        draw.winnerSelectedAt ? (
          <span className="fs-small num">{formatDateTimeAr(draw.winnerSelectedAt)}</span>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: 130,
      render: ({ draw }) =>
        draw.winnerCouponId ? null : (
          <Button
            size="sm"
            variant="outline"
            icon={<Shuffle size={14} />}
            onClick={() => {
              action.clearError();
              setDrawing(draw);
            }}
          >
            إجراء السحب
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="الكوبونات" subtitle="الكوبونات الفائزة بكل سحب، وإجراء السحب نفسه" />

      <div className="page">
        <Notice tone="info" icon={<Info size={16} />}>
          الكوبون ينطلع للمشترك تلقائياً عند كل تجديد. الـ API ما يعرض للأدمن كل الكوبونات ولا عددها
          بكل سحب — المسار الوحيد اللي يقرأها هو <span className="num">/coupons/my</span> وهو للمشترك
          نفسه — فهنا يبين الكوبون الفائز بس، بعد ما ينسحب.
        </Notice>

        <Card>
          <AsyncBlock state={rows}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data}
                rowKey={(row) => row.draw.id}
                empty={
                  <EmptyState
                    icon={<Ticket size={20} />}
                    title="ماكو سحوبات"
                    hint="أضف سحب من شاشة السحوبات والجوائز حتى يبين هنا"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {drawing ? (
        <ConfirmDialog
          title="إجراء السحب"
          confirmLabel="اسحب الفائز"
          pending={action.pending}
          onCancel={() => setDrawing(null)}
          onConfirm={() => void hold()}
          message={
            <div className="col" style={{ gap: 'var(--sp-3)' }}>
              <span>
                السيرفر راح يختار كوبون واحد عشوائياً من كوبونات سحب{' '}
                <span className="strong">{drawing.titleAr}</span> ويسجّل صاحبه فائز، ويخفي السحب من
                التطبيق.
              </span>
              <Notice tone="warning" icon={<Trophy size={16} />}>
                السحب يصير مرة وحدة بس — ما تكدر تعيده أو تغيّر الفائز بعدين.
              </Notice>
              {!isOver(drawing) ? (
                <Notice tone="danger">
                  موعد السحب المعلن ({formatDateTimeAr(drawing.drawAt)}) بعده ما إجا، والتطبيق
                  بعده يعدّ له تنازلياً. أي تجديد بعد هسه ما راح يدخل هذا السحب.
                </Notice>
              ) : null}
              {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
            </div>
          }
        />
      ) : null}
    </>
  );
}
