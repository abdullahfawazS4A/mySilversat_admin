/**
 * Push campaigns.
 *
 * The one irreversible action in the console: a sent notification cannot be
 * recalled from anyone's phone. So the screen is built around making the blast
 * radius visible before the send — the composer resolves the live audience
 * count as the targeting changes, and sending goes through a confirm that
 * states that number back.
 *
 * A sent campaign is read-only afterwards: it is a record of what went out,
 * and editing it would make the delivery counters lie.
 */

import { useEffect, useState } from 'react';
import { BellRing, Eye, Pencil, Send, Trash2, Users } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  TextArea,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { Governorate, Id, NotificationAudience, NotificationCampaign, SlideTarget } from '@/types';
import { AUDIENCE, CAMPAIGN_STATE, SLIDE_TARGET } from '@/lib/labels';
import { formatDateTimeAr, formatNumber, formatPercent, relativeAr } from '@/lib/format';

export function NotificationsPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<NotificationCampaign | 'new' | null>(null);
  const [sending, setSending] = useState<NotificationCampaign | null>(null);
  const [deleting, setDeleting] = useState<NotificationCampaign | null>(null);
  const [run, action] = useAction();

  const campaigns = useAsync(
    () => repos.notifications.list({ search: debounced, page, pageSize: 20 }),
    [debounced, page],
  );
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const all = campaigns.data?.items ?? [];
  const sent = all.filter((c) => c.state === 'sent');
  const reached = sent.reduce((total, c) => total + c.deliveredCount, 0);
  const opened = sent.reduce((total, c) => total + c.openedCount, 0);

  const confirmSend = async () => {
    if (!sending) return;
    const ok = await run(() => repos.notifications.send(sending.id));
    if (ok) {
      toast('انرسل الإشعار');
      setSending(null);
      campaigns.reload();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.notifications.remove(deleting.id));
    if (ok) {
      toast('انحذف الإشعار');
      setDeleting(null);
      campaigns.reload();
    }
  };

  const columns: Column<NotificationCampaign>[] = [
    {
      key: 'titleAr',
      header: 'الإشعار',
      render: (row) => (
        <div className="row row-gap-2" style={{ minWidth: 0 }}>
          <span className="chip-icon" style={{ width: 28, height: 28 }}>
            <BellRing size={14} />
          </span>
          <div className="col" style={{ lineHeight: 1.35, minWidth: 0 }}>
            <span className="fs-13 strong truncate">{row.titleAr}</span>
            <span className="fs-11 dim truncate">{row.bodyAr}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'الجمهور',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-12">{AUDIENCE[row.audience]}</span>
          {row.audience === 'governorate' ? (
            <span className="fs-11 dim truncate">
              {row.targetIds
                .map((id) => governorates.data?.find((g) => g.id === id)?.nameAr ?? '—')
                .join('، ')}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'state',
      header: 'الحالة',
      width: 110,
      render: (row) => (
        <Pill tone={CAMPAIGN_STATE[row.state].tone}>{CAMPAIGN_STATE[row.state].label}</Pill>
      ),
    },
    {
      key: 'delivery',
      header: 'الوصول',
      numeric: true,
      render: (row) =>
        row.state === 'sent' ? (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-13 strong num">{formatNumber(row.deliveredCount)}</span>
            <span className="fs-11 dim num">
              فتحوه {formatPercent(row.deliveredCount ? row.openedCount / row.deliveredCount : 0)}
            </span>
          </div>
        ) : (
          <span className="fs-12 dim">—</span>
        ),
    },
    {
      key: 'when',
      header: 'التاريخ',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-12">{formatDateTimeAr(row.sentAt ?? row.scheduledAt ?? row.createdAt)}</span>
          <span className="fs-11 dim">{relativeAr(row.sentAt ?? row.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 130,
      render: (row) => (
        <div className="row row-gap-1 end">
          {row.state === 'sent' ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Eye size={13} />}
              title="عرض"
              onClick={() => setEditing(row)}
            />
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil size={13} />}
                title="تعديل"
                onClick={() => setEditing(row)}
              />
              <Button
                variant="outline"
                size="sm"
                icon={<Send size={13} />}
                title="إرسال"
                onClick={() => setSending(row)}
              />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={13} />}
            title="حذف"
            disabled={row.state === 'sent'}
            onClick={() => setDeleting(row)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الإشعارات"
        subtitle="حملات الإشعارات المرسلة لتطبيق المشتركين"
        actions={
          <Button variant="primary" icon={<BellRing size={16} />} onClick={() => setEditing('new')}>
            إشعار جديد
          </Button>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        <div className="grid grid-kpi">
          <StatTile label="إشعارات مُرسلة" value={formatNumber(sent.length)} icon={<Send size={15} />} />
          <StatTile
            label="مجموع الوصول"
            value={formatNumber(reached)}
            hint="عدد الأجهزة اللي وصلها إشعار"
            icon={<Users size={15} />}
          />
          <StatTile
            label="نسبة الفتح"
            value={formatPercent(reached ? opened / reached : 0, 1)}
            tone="success"
            icon={<Eye size={15} />}
          />
          <StatTile
            label="مسودّات"
            value={formatNumber(all.filter((c) => c.state !== 'sent').length)}
            hint="ما انرسلت بعد"
          />
        </div>

        <div className="card">
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالعنوان أو النص…" />
          </Toolbar>

          {action.error ? (
            <div className="card-pad">
              <Notice tone="danger">{action.error}</Notice>
            </div>
          ) : null}

          <AsyncBlock state={campaigns}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <EmptyState
                    title="ما بيها إشعارات"
                    hint="سوّي إشعار جديد وحدد الجمهور قبل الإرسال."
                    icon={<BellRing size={22} />}
                  />
                }
              />
            )}
          </AsyncBlock>
        </div>
      </div>

      {editing ? (
        <CampaignDialog
          campaign={editing === 'new' ? null : editing}
          governorates={governorates.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            campaigns.reload();
          }}
        />
      ) : null}

      {sending ? (
        <SendConfirm
          campaign={sending}
          pending={action.pending}
          onConfirm={() => void confirmSend()}
          onCancel={() => setSending(null)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الإشعار"
          message={`راح تنحذف مسودّة "${deleting.titleAr}".`}
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

/**
 * The send gate. It re-resolves the audience at confirm time rather than
 * trusting the number stored on the draft, because the audience is a live
 * query — "اشتراكاتهم قرب تنتهي" is a different set of people today than it
 * was when the draft was written.
 */
function SendConfirm({
  campaign,
  pending,
  onConfirm,
  onCancel,
}: {
  campaign: NotificationCampaign;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const repos = useRepos();
  const size = useAsync(
    () => repos.notifications.audienceSize(campaign.audience, campaign.targetIds),
    [campaign.id],
  );

  return (
    <ConfirmDialog
      title="إرسال الإشعار"
      message={
        <div className="col" style={{ gap: 'var(--sp-3)' }}>
          <span>
            راح ينرسل <span className="strong">{campaign.titleAr}</span> إلى{' '}
            <span className="strong">{AUDIENCE[campaign.audience]}</span>
            {size.loading ? (
              <span className="dim"> — جاري حساب العدد…</span>
            ) : (
              <>
                {' '}
                (<span className="num strong">{formatNumber(size.data ?? 0)}</span> مشترك).
              </>
            )}
          </span>
          <Notice tone="warning">
            الإشعار ما يرجع بعد الإرسال — ما تكدر تسحبه من أجهزة المشتركين.
          </Notice>
        </div>
      }
      confirmLabel="إرسال الآن"
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function CampaignDialog({
  campaign,
  governorates,
  onClose,
  onSaved,
}: {
  campaign: NotificationCampaign | null;
  governorates: Governorate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const readOnly = campaign?.state === 'sent';

  const [titleAr, setTitleAr] = useState(campaign?.titleAr ?? '');
  const [bodyAr, setBodyAr] = useState(campaign?.bodyAr ?? '');
  const [audience, setAudience] = useState<NotificationAudience>(campaign?.audience ?? 'all');
  const [targetIds, setTargetIds] = useState<Id[]>(campaign?.targetIds ?? []);
  const [routeTarget, setRouteTarget] = useState<SlideTarget>(campaign?.routeTarget ?? 'none');

  // Live blast-radius readout: the composer shows who this reaches right now.
  const [reach, setReach] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    setReach(null);
    repos.notifications
      .audienceSize(audience, targetIds)
      .then((count) => {
        if (!cancelled) setReach(count);
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repos, audience, targetIds]);

  const toggleGovernorate = (id: Id) =>
    setTargetIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = async () => {
    if (!titleAr.trim() || !bodyAr.trim()) {
      toast('العنوان والنص مطلوبين', 'error');
      return;
    }
    if (audience === 'governorate' && targetIds.length === 0) {
      toast('اختر محافظة وحدة على الأقل', 'error');
      return;
    }
    const ok = await run(() =>
      repos.notifications.save({
        id: campaign?.id,
        titleAr: titleAr.trim(),
        bodyAr: bodyAr.trim(),
        audience,
        targetIds: audience === 'governorate' ? targetIds : [],
        routeTarget,
        state: campaign?.state ?? 'draft',
        scheduledAt: campaign?.scheduledAt ?? null,
        sentAt: campaign?.sentAt ?? null,
        audienceSize: reach ?? 0,
        deliveredCount: campaign?.deliveredCount ?? 0,
        openedCount: campaign?.openedCount ?? 0,
      }),
    );
    if (ok) {
      toast(campaign ? 'انحفظت المسودّة' : 'انضافت المسودّة');
      onSaved();
    }
  };

  return (
    <Modal
      size="lg"
      title={readOnly ? 'تفاصيل الإشعار' : campaign ? 'تعديل الإشعار' : 'إشعار جديد'}
      onClose={onClose}
      footer={
        readOnly ? (
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        ) : (
          <>
            <Button variant="primary" onClick={() => void submit()} disabled={action.pending}>
              حفظ كمسودّة
            </Button>
            <Button variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
          </>
        )
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        {readOnly ? (
          <Notice tone="info">
            هذا الإشعار انرسل — ما ينعدّل، لأن أرقام الوصول والفتح مربوطة بنصّه الأصلي.
          </Notice>
        ) : null}

        <Field label="العنوان" hint="يظهر بسطر واحد على شاشة الهاتف">
          <TextInput value={titleAr} onChange={setTitleAr} disabled={readOnly} />
        </Field>
        <Field label="النص">
          <TextArea value={bodyAr} onChange={setBodyAr} rows={3} />
        </Field>

        <div className="grid grid-form">
          <Field label="الجمهور">
            <Select
              value={audience}
              onChange={(next) => {
                setAudience(next);
                setTargetIds([]);
              }}
              disabled={readOnly}
              options={(Object.keys(AUDIENCE) as NotificationAudience[])
                .filter((key) => key !== 'single_user')
                .map((key) => ({ value: key, label: AUDIENCE[key] }))}
            />
          </Field>
          <Field label="يفتح على" hint="الشاشة اللي تنفتح لما يضغط المشترك">
            <Select
              value={routeTarget}
              onChange={setRouteTarget}
              disabled={readOnly}
              options={(Object.keys(SLIDE_TARGET) as SlideTarget[]).map((key) => ({
                value: key,
                label: SLIDE_TARGET[key],
              }))}
            />
          </Field>
        </div>

        {audience === 'governorate' ? (
          <Field label="المحافظات المستهدفة">
            <div className="chips">
              {governorates.map((governorate) => (
                <button
                  key={governorate.id}
                  type="button"
                  disabled={readOnly}
                  className={`chip${targetIds.includes(governorate.id) ? ' active' : ''}`}
                  onClick={() => toggleGovernorate(governorate.id)}
                >
                  {governorate.nameAr}
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        <Notice tone={reach === 0 ? 'warning' : 'info'} icon={<Users size={16} />}>
          {reach === null ? (
            'جاري حساب حجم الجمهور…'
          ) : reach === 0 ? (
            'ما بيها أحد بهذا الجمهور — عدّل الاستهداف قبل الإرسال.'
          ) : (
            <>
              راح يوصل إلى <span className="num strong">{formatNumber(reach)}</span> مشترك فعّال.
            </>
          )}
        </Notice>
      </div>
    </Modal>
  );
}
