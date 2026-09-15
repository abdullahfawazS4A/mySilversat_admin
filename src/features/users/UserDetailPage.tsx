/**
 * One subscriber's whole record.
 *
 * A support call is about a specific person, so everything the operator might
 * be asked lives on this one screen: who they are, which receivers they own,
 * what they have bought, and how their predictions are going. The repository
 * gathers all four in one `detail()` call, so the screen never shows three
 * spinners finishing at different times.
 *
 * The tabs are just density management — all of it is already loaded.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ShieldBan, ShieldCheck, Tv } from 'lucide-react';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  Pill,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { Column, DataTable, PageHeader } from '@/components/page';
import { StatTile } from '@/components/charts';
import { useAction, useAsync } from '@/app/useAsync';
import { useMatchJoin } from '../shared/useMatchJoin';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import { formatDateAr, formatDateTimeAr, formatIqd, formatNumber, formatPhone } from '@/lib/format';
import { CODE_STATUS, MATCH_STATUS, PREDICTION_OUTCOME } from '@/lib/labels';
import { outcomeOf, toAmount, type Code, type Device, type Prediction } from '@/types';
import type { AppUserDetail } from '@/data/repositories/types';

type Tab = 'devices' | 'purchases' | 'predictions';

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();

  const detail = useAsync(() => repos.appUsers.detail(userId), [userId]);
  const [tab, setTab] = useState<Tab>('devices');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [run, action] = useAction();

  const toggleBlock = async (blocked: boolean) => {
    const ok = await run(() =>
      blocked ? repos.appUsers.unblock(userId) : repos.appUsers.block(userId),
    );
    if (!ok) return;
    toast(blocked ? 'انفك الحظر عن المشترك' : 'انحظر المشترك وانقطعت جلساته');
    setConfirmBlock(false);
    detail.reload();
  };

  return (
    <>
      <PageHeader
        title="سجل المشترك"
        actions={
          <Button variant="ghost" icon={<ArrowRight size={15} />} onClick={() => navigate('/users')}>
            رجوع للقائمة
          </Button>
        }
      />

      <AsyncBlock state={detail}>
        {(data: AppUserDetail) => (
          <div className="page">
            <Card pad>
              <CardHead
                title={data.user.name}
                subtitle={formatPhone(data.user.phone)}
                actions={
                  <>
                    {data.user.isBlocked ? (
                      <Pill tone="danger">محظور</Pill>
                    ) : (
                      <Pill tone="success">فعّال</Pill>
                    )}
                    <Button
                      variant={data.user.isBlocked ? 'subtle' : 'danger'}
                      icon={
                        data.user.isBlocked ? <ShieldCheck size={15} /> : <ShieldBan size={15} />
                      }
                      onClick={() => setConfirmBlock(true)}
                    >
                      {data.user.isBlocked ? 'فك الحظر' : 'حظر المشترك'}
                    </Button>
                  </>
                }
              />

              <div className="grid grid-form mt-3">
                <KeyValue
                  rows={[
                    ['المحافظة', data.user.province?.name ?? '—'],
                    ['البريد الإلكتروني', data.user.email ?? '—'],
                    ['تاريخ الاشتراك', formatDateAr(data.user.createdAt)],
                    [
                      'إشعارات التطبيق',
                      data.user.fcmToken ? (
                        <Pill tone="success">مفعّلة</Pill>
                      ) : (
                        <Pill tone="muted">ما مسجّل جهاز</Pill>
                      ),
                    ],
                  ]}
                />
              </div>
            </Card>

            <div className="grid grid-kpi">
              <StatTile label="النقاط" value={formatNumber(data.user.points)} />
              <StatTile label="الأجهزة" value={formatNumber(data.devices.length)} />
              <StatTile label="الكارتات المشتراة" value={formatNumber(data.purchases.length)} />
              <StatTile
                label="قيمة المشتريات"
                value={formatIqd(
                  data.purchases.reduce(
                    (sum, code) => sum + toAmount(code.category?.unitPrice),
                    0,
                  ),
                )}
              />
            </div>

            <Card>
              <div className="card-pad" style={{ paddingBottom: 0 }}>
                <Tabs
                  value={tab}
                  onChange={setTab}
                  items={[
                    { value: 'devices', label: `الأجهزة (${data.devices.length})` },
                    { value: 'purchases', label: `المشتريات (${data.purchases.length})` },
                    { value: 'predictions', label: `التوقعات (${data.predictions.length})` },
                  ]}
                />
              </div>

              {tab === 'devices' ? <DevicesTable rows={data.devices} /> : null}
              {tab === 'purchases' ? <PurchasesTable rows={data.purchases} /> : null}
              {tab === 'predictions' ? <PredictionsTable rows={data.predictions} /> : null}
            </Card>

            {confirmBlock ? (
              <ConfirmDialog
                danger={!data.user.isBlocked}
                title={data.user.isBlocked ? 'فك الحظر' : 'حظر المشترك'}
                confirmLabel={data.user.isBlocked ? 'فك الحظر' : 'حظر'}
                pending={action.pending}
                message={
                  <>
                    {data.user.isBlocked
                      ? 'راح يرجع المشترك يكدر يسجّل دخول بالتطبيق.'
                      : 'راح تنقطع جلساته المفتوحة بالتطبيق فوراً، ويتمنع من الدخول.'}
                    {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
                  </>
                }
                onCancel={() => setConfirmBlock(false)}
                onConfirm={() => void toggleBlock(data.user.isBlocked)}
              />
            ) : null}
          </div>
        )}
      </AsyncBlock>
    </>
  );
}

// ------------------------------------------------------------------ tabs ---

function DevicesTable({ rows }: { rows: Device[] }) {
  const columns: Column<Device>[] = [
    {
      key: 'name',
      header: 'الجهاز',
      render: (row) => <span className="strong">{row.name}</span>,
    },
    {
      key: 'number',
      header: 'رقم الجهاز',
      numeric: true,
      render: (row) => <span className="num">{row.deviceNumber}</span>,
    },
    {
      key: 'added',
      header: 'تاريخ الإضافة',
      render: (row) => <span className="fs-small">{formatDateAr(row.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={
        <EmptyState
          icon={<Tv size={20} />}
          title="ماكو أجهزة مسجّلة"
          hint="المشترك ما ربط أي رسيفر بحسابه لحد الآن"
        />
      }
    />
  );
}

/**
 * Purchase history.
 *
 * A "purchase" is a sold code — the API keeps no separate transaction record,
 * so the price shown is the category's current list price, not what was paid
 * at the time. The column says `سعر الفئة` rather than `المبلغ` for that
 * reason: it would be wrong to present it as the receipt.
 */
function PurchasesTable({ rows }: { rows: Code[] }) {
  const columns: Column<Code>[] = [
    {
      key: 'category',
      header: 'الفئة',
      render: (row) => (
        <div className="col">
          <span className="strong">{row.category?.name ?? '—'}</span>
          <span className="fs-tiny dim">{row.category?.product?.displayName ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'الكارت',
      numeric: true,
      render: (row) => <span className="num">{row.primaryValue}</span>,
    },
    {
      key: 'price',
      header: 'سعر الفئة',
      numeric: true,
      render: (row) => <span className="num">{formatIqd(toAmount(row.category?.unitPrice))}</span>,
    },
    {
      key: 'soldAt',
      header: 'تاريخ البيع',
      render: (row) => <span className="fs-small">{formatDateTimeAr(row.soldAt)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      width: 96,
      render: (row) => (
        <Pill tone={CODE_STATUS[row.status].tone}>{CODE_STATUS[row.status].label}</Pill>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={<EmptyState title="ماكو مشتريات" hint="ما اشترى أي كارت لحد الآن" />}
    />
  );
}

function PredictionsTable({ rows }: { rows: Prediction[] }) {
  // `/predictions` does not always join the fixture, and the row only ever
  // carries its id; without this every match here read "— × —".
  const matchOf = useMatchJoin(rows);

  const columns: Column<Prediction>[] = [
    {
      key: 'match',
      header: 'المباراة',
      render: (row) => {
        const match = matchOf(row);
        // Still being fetched is a skeleton, not "—" — an em dash here would
        // claim the prediction has no match, which is never true.
        if (!match) return <Skeleton h={13} w={150} />;
        return (
          <div className="col">
            <span className="strong">
              {match.homeTeam?.name ?? '—'} × {match.awayTeam?.name ?? '—'}
            </span>
            <span className="fs-tiny dim">{match.league?.name ?? ''}</span>
          </div>
        );
      },
    },
    {
      key: 'guess',
      header: 'توقعه',
      numeric: true,
      render: (row) => (
        <span className="num strong">
          {row.predictedHomeScore} - {row.predictedAwayScore}
        </span>
      ),
    },
    {
      key: 'actual',
      header: 'النتيجة',
      numeric: true,
      render: (row) => {
        const match = matchOf(row);
        return match && match.homeScore !== null && match.awayScore !== null ? (
          <span className="num">
            {match.homeScore} - {match.awayScore}
          </span>
        ) : (
          <Pill tone={MATCH_STATUS[match?.status ?? 'scheduled'].tone}>
            {MATCH_STATUS[match?.status ?? 'scheduled'].label}
          </Pill>
        );
      },
    },
    {
      key: 'points',
      header: 'النقاط',
      numeric: true,
      width: 84,
      render: (row) => (
        <span className="num">{row.pointsEarned === null ? '—' : row.pointsEarned}</span>
      ),
    },
    {
      key: 'outcome',
      header: 'النتيجة',
      render: (row) => {
        const outcome = PREDICTION_OUTCOME[outcomeOf(row)];
        return <Pill tone={outcome.tone}>{outcome.label}</Pill>;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={
        <EmptyState
          title="ماكو توقعات"
          hint="المشترك ما شارك بأي مباراة"
          action={<Link to="/matches">شوف المباريات المفتوحة</Link>}
        />
      }
    />
  );
}
