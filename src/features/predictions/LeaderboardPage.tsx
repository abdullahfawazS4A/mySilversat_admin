/**
 * Leaderboard, seasons and manual point adjustments.
 *
 * The app tells users the ranking resets monthly, so this screen owns that
 * promise: closing a season freezes its board and opens the next one, which is
 * safer than deleting points and lets a customer still be shown last month's
 * standing.
 */

import { useState } from 'react';
import { Award, Download, Minus, Plus, RotateCcw, Trophy } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { useAuth } from '@/app/AuthContext';
import { PageHeader, DataTable, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  Field,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextInput,
} from '@/components/ui';
import type { Id, LeaderboardRow } from '@/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';

export function LeaderboardPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const { can } = useAuth();
  const canAdjust = can('points.adjust');

  const [seasonId, setSeasonId] = useState<Id | ''>('');
  const [governorateId, setGovernorateId] = useState<Id | 'all'>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);

  const [adjusting, setAdjusting] = useState<LeaderboardRow | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const seasons = useAsync(() => repos.leaderboard.seasons(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  // Default to the active season the first time the list arrives.
  const activeSeasonId = seasons.data?.find((s) => s.active)?.id ?? '';
  const currentSeasonId = seasonId || activeSeasonId;

  const board = useAsync(
    () =>
      currentSeasonId
        ? repos.leaderboard.leaderboard(currentSeasonId, {
            search: debounced,
            governorateId: governorateId === 'all' ? undefined : governorateId,
            page,
            pageSize: 25,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 25 }),
    [currentSeasonId, debounced, governorateId, page],
  );

  const season = seasons.data?.find((s) => s.id === currentSeasonId);
  const isActiveSeason = season?.active ?? false;

  const closeSeason = async () => {
    setBusy(true);
    try {
      const next = await repos.leaderboard.closeSeason(currentSeasonId, 'الموسم الجديد');
      toast(`انغلق الموسم وانفتح ${next.nameAr}`);
      setConfirmClose(false);
      setSeasonId('');
      seasons.reload();
      board.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الإغلاق', 'error');
    } finally {
      setBusy(false);
    }
  };

  const resetPoints = async () => {
    setBusy(true);
    try {
      await repos.leaderboard.resetPoints(currentSeasonId, 'تصفير يدوي من لوحة التحكم');
      toast('انصفّرت نقاط الموسم');
      setConfirmReset(false);
      board.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التصفير', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const all = await repos.leaderboard.leaderboard(currentSeasonId, { pageSize: 100000 });
    downloadCsv(`leaderboard-${currentSeasonId}.csv`, [
      ['المركز', 'الاسم', 'المحافظة', 'النقاط', 'عدد التوقعات', 'نسبة الإصابة'],
      ...all.items.map((row) => [
        row.rank,
        row.name,
        governorates.data?.find((g) => g.id === row.governorateId)?.nameAr ?? '',
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
      header: 'المركز',
      width: 74,
      numeric: true,
      render: (row) =>
        row.rank <= 3 ? (
          <Pill tone="gold">
            <Award size={12} />
            <span className="num">{row.rank}</span>
          </Pill>
        ) : (
          <span className="num muted">{row.rank}</span>
        ),
    },
    { key: 'name', header: 'المشترك', render: (row) => <span className="fs-13">{row.name}</span> },
    {
      key: 'governorate',
      header: 'المحافظة',
      render: (row) => (
        <span className="fs-12 muted">
          {governorates.data?.find((g) => g.id === row.governorateId)?.nameAr ?? '—'}
        </span>
      ),
    },
    {
      key: 'points',
      header: 'النقاط',
      numeric: true,
      sortable: true,
      render: (row) => <span className="fs-13 strong num">{formatNumber(row.points)}</span>,
    },
    {
      key: 'predictionCount',
      header: 'التوقعات',
      numeric: true,
      render: (row) => <span className="num muted">{row.predictionCount}</span>,
    },
    {
      key: 'accuracy',
      header: 'نسبة الإصابة',
      numeric: true,
      render: (row) => <span className="num">{formatPercent(row.accuracy)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 100,
      render: (row) =>
        canAdjust && isActiveSeason ? (
          <Button variant="ghost" size="sm" onClick={() => setAdjusting(row)}>
            تعديل النقاط
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="الترتيب والنقاط"
        subtitle="ترتيب المتوقعين حسب الموسم، مع إدارة المواسم والتعديلات اليدوية"
        actions={
          <>
            <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
              تصدير
            </Button>
            {canAdjust && isActiveSeason ? (
              <>
                <Button variant="outline" icon={<RotateCcw size={15} />} onClick={() => setConfirmReset(true)}>
                  تصفير النقاط
                </Button>
                <Button variant="primary" icon={<Trophy size={15} />} onClick={() => setConfirmClose(true)}>
                  إغلاق الموسم
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="page">
        {!isActiveSeason && season ? (
          <Notice tone="info">
            تشوف ترتيب موسم مغلق ({season.nameAr}). البيانات مجمّدة وما تتعدل.
          </Notice>
        ) : null}

        <Card>
          <CardHead title="الترتيب" subtitle="المركز محسوب على مستوى العراق حتى لو فلترت بمحافظة" />

          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث باسم المشترك…" />
            <Select
              value={currentSeasonId}
              onChange={(next) => {
                setSeasonId(next);
                setPage(1);
              }}
              options={(seasons.data ?? []).map((item) => ({
                value: item.id,
                label: item.active ? `${item.nameAr} (فعّال)` : item.nameAr,
              }))}
            />
            <Select
              value={governorateId}
              onChange={(next) => {
                setGovernorateId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل المحافظات' },
                ...(governorates.data ?? []).map((g) => ({ value: g.id, label: g.nameAr })),
              ]}
            />
          </Toolbar>

          <AsyncBlock state={board}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.userId}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {adjusting ? (
        <AdjustPointsDialog
          row={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            board.reload();
          }}
        />
      ) : null}

      {confirmClose ? (
        <ConfirmDialog
          title="إغلاق الموسم"
          message="راح ينجمّد ترتيب هذا الموسم وينفتح موسم جديد بنقاط صفر للجميع. السجل القديم يبقى محفوظ."
          confirmLabel="إغلاق وفتح موسم جديد"
          pending={busy}
          onConfirm={() => void closeSeason()}
          onCancel={() => setConfirmClose(false)}
        />
      ) : null}

      {confirmReset ? (
        <ConfirmDialog
          title="تصفير نقاط الموسم"
          message="راح تنصفّر نقاط كل المشتركين في هذا الموسم بقيد معاكس في السجل — يعني تكدر تشرح للمشترك وين راحت نقاطه."
          confirmLabel="تصفير النقاط"
          danger
          pending={busy}
          onConfirm={() => void resetPoints()}
          onCancel={() => setConfirmReset(false)}
        />
      ) : null}
    </>
  );
}

/** Manual +/- with a mandatory reason. The reason is what the customer is told. */
function AdjustPointsDialog({
  row,
  onClose,
  onSaved,
}: {
  row: LeaderboardRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [amount, setAmount] = useState('10');
  const [sign, setSign] = useState<1 | -1>(1);
  const [reason, setReason] = useState('');

  const save = async () => {
    const delta = sign * Number(amount || 0);
    if (!delta) {
      toast('أدخل عدد نقاط أكبر من صفر', 'error');
      return;
    }
    if (!reason.trim()) {
      toast('اكتب سبب التعديل — يظهر بسجل نقاط المشترك', 'error');
      return;
    }
    const ok = await run(() => repos.users.adjustPoints(row.userId, delta, reason.trim()));
    if (ok) {
      toast(`${delta > 0 ? 'انضافت' : 'انخصمت'} ${Math.abs(delta)} نقطة`);
      onSaved();
    }
  };

  return (
    <Modal
      title={`تعديل نقاط ${row.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void save()} disabled={action.pending}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ التعديل'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="row between fs-13">
          <span className="muted">الرصيد الحالي</span>
          <span className="strong num">{formatNumber(row.points)} نقطة</span>
        </div>

        <div className="row row-gap-2">
          <Button
            variant={sign === 1 ? 'primary' : 'outline'}
            icon={<Plus size={15} />}
            onClick={() => setSign(1)}
          >
            إضافة
          </Button>
          <Button
            variant={sign === -1 ? 'danger' : 'outline'}
            icon={<Minus size={15} />}
            onClick={() => setSign(-1)}
          >
            خصم
          </Button>
        </div>

        <Field label="عدد النقاط">
          <TextInput type="number" min={1} value={amount} onChange={setAmount} />
        </Field>

        <Field label="سبب التعديل" hint="يُسجَّل في سجل النقاط ويمكن عرضه للمشترك">
          <TextInput value={reason} onChange={setReason} placeholder="مثلاً: مكافأة حملة ترويجية" />
        </Field>

        <Notice tone="info">
          الرصيد الجديد راح يصير{' '}
          <span className="num strong">
            {formatNumber(Math.max(0, row.points + sign * Number(amount || 0)))}
          </span>{' '}
          نقطة.
        </Notice>
      </div>
    </Modal>
  );
}
