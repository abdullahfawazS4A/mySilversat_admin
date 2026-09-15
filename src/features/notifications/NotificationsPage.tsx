/**
 * Push notifications.
 *
 * The API has no drafts and no scheduling: `POST /notifications/send` *is* the
 * creation, so everything in the table has already gone out to real phones.
 * That makes the compose dialog a one-way door, which is why it ends in a
 * confirm that names the audience size rather than a plain save button.
 *
 * The audience count is an upper bound on reach, not on delivery — a user with
 * no FCM token is counted before sending and lands in `failureCount` after. The
 * table shows both numbers for that reason.
 */

import { useState } from 'react';
import { BellRing, Check, Send } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  Select,
  TextArea,
  TextInput,
} from '@/components/ui';
import { formatDateTimeAr, formatNumber } from '@/lib/format';
import { NOTIFICATION_TARGET } from '@/lib/labels';
import type { AppUser, Id, NotificationRecord, NotificationTarget } from '@/types';
import type { NotificationInput } from '@/data/repositories/types';

export function NotificationsPage() {
  const repos = useRepos();
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);

  const sent = useAsync(() => repos.notifications.list({ page, pageSize: 20 }), [page]);

  const columns: Column<NotificationRecord>[] = [
    {
      key: 'title',
      header: 'الإشعار',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body strong">{row.titleAr}</span>
          <span className="fs-tiny dim truncate">{row.bodyAr}</span>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'الجمهور',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-small">{NOTIFICATION_TARGET[row.targetType]}</span>
          <span className="fs-tiny dim">
            {row.targetProvince?.name ?? row.targetUser?.name ?? ''}
          </span>
        </div>
      ),
    },
    {
      key: 'delivery',
      header: 'الوصول',
      numeric: true,
      render: (row) => (
        <div className="row row-gap-2">
          <Pill tone="success">{formatNumber(row.successCount)}</Pill>
          {row.failureCount > 0 ? (
            <Pill tone="danger">{formatNumber(row.failureCount)}</Pill>
          ) : null}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'المصدر',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-small">{row.source === 'admin' ? 'من اللوحة' : row.source}</span>
          <span className="fs-tiny dim">{row.createdByUser?.name ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'sentAt',
      header: 'وقت الإرسال',
      render: (row) => <span className="fs-small">{formatDateTimeAr(row.createdAt)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="الإشعارات"
        subtitle="الإشعارات المرسلة للتطبيق — الإرسال فوري وما بيه مسودات"
        actions={
          <Button variant="primary" icon={<Send size={15} />} onClick={() => setComposing(true)}>
            إرسال إشعار
          </Button>
        }
      />

      <div className="page">
        <Card>
          <AsyncBlock state={sent}>
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
                    icon={<BellRing size={20} />}
                    title="ما انرسل أي إشعار"
                    hint="الإشعارات اللي ترسلها راح تظهر هنا"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {composing ? (
        <ComposeDialog
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            setPage(1);
            sent.reload();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Composing and sending.
 *
 * Two steps on purpose: the first is the message, the second states how many
 * phones it is about to reach. A push cannot be recalled, so the number has to
 * be in front of the operator at the moment they commit — not earlier, while
 * they are still editing the text.
 */
function ComposeDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [draft, setDraft] = useState<NotificationInput>({
    titleAr: '',
    titleKu: '',
    bodyAr: '',
    bodyKu: '',
    targetType: 'all',
  });
  const set = <K extends keyof NotificationInput>(key: K, value: NotificationInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const [confirming, setConfirming] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const users = useAsync<AppUser[]>(
    // Only loaded when a single user is the target — it is the whole table.
    () => (draft.targetType === 'user' ? repos.appUsers.all() : Promise.resolve([])),
    [draft.targetType],
  );

  const audience = useAsync(
    () => repos.notifications.audienceSize(draft.targetType, draft.provinceId),
    [draft.targetType, draft.provinceId],
  );

  const problem = (): string | null => {
    if (!draft.titleAr.trim()) return 'العنوان بالعربي مطلوب';
    if (!draft.bodyAr.trim()) return 'نص الإشعار بالعربي مطلوب';
    if (draft.targetType === 'province' && !draft.provinceId) return 'اختر المحافظة';
    if (draft.targetType === 'user' && !draft.appUserId) return 'اختر المشترك';
    return null;
  };

  const review = () => {
    const found = problem();
    setInvalid(found);
    if (!found) setConfirming(true);
  };

  const send = async () => {
    const ok = await run(() =>
      repos.notifications.send({
        ...draft,
        // Kurdish falls back to Arabic so the app never renders a blank push.
        titleKu: draft.titleKu.trim() || draft.titleAr,
        bodyKu: draft.bodyKu.trim() || draft.bodyAr,
        provinceId: draft.targetType === 'province' ? draft.provinceId : undefined,
        appUserId: draft.targetType === 'user' ? draft.appUserId : undefined,
      }),
    );
    if (!ok) return;
    toast('انرسل الإشعار');
    onSent();
  };

  if (confirming) {
    return (
      <Modal
        title="تأكيد الإرسال"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button
              variant="primary"
              icon={<Check size={15} />}
              disabled={action.pending}
              onClick={() => void send()}
            >
              {action.pending ? 'جاري الإرسال…' : 'إرسال الآن'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={action.pending}>
              رجوع للتعديل
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 'var(--sp-4)' }}>
          <Notice tone="warning">
            راح يوصل الإشعار لـ{' '}
            <span className="strong num">{formatNumber(audience.data ?? 0)}</span> مشترك
            ({NOTIFICATION_TARGET[draft.targetType]}). الإرسال فوري وما تكدر تتراجع عنه.
          </Notice>

          <div className="card card-pad col" style={{ gap: 4 }}>
            <span className="fs-body strong">{draft.titleAr}</span>
            <span className="fs-small">{draft.bodyAr}</span>
          </div>

          {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="إرسال إشعار"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" icon={<Send size={15} />} onClick={review}>
            مراجعة وإرسال
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">
        <Field label="العنوان بالعربي">
          <TextInput value={draft.titleAr} onChange={(next) => set('titleAr', next)} />
        </Field>
        <Field label="العنوان بالكردي" hint="إذا تركته فارغ ينرسل العربي">
          <TextInput value={draft.titleKu} onChange={(next) => set('titleKu', next)} />
        </Field>

        <Field label="النص بالعربي" className="span-2">
          <TextArea rows={3} value={draft.bodyAr} onChange={(next) => set('bodyAr', next)} />
        </Field>
        <Field label="النص بالكردي" className="span-2" hint="إذا تركته فارغ ينرسل العربي">
          <TextArea rows={3} value={draft.bodyKu} onChange={(next) => set('bodyKu', next)} />
        </Field>

        <Field label="الجمهور">
          <Select<NotificationTarget>
            value={draft.targetType}
            onChange={(next) => set('targetType', next)}
            options={(Object.keys(NOTIFICATION_TARGET) as NotificationTarget[]).map((value) => ({
              value,
              label: NOTIFICATION_TARGET[value],
            }))}
          />
        </Field>

        {draft.targetType === 'province' ? (
          <Field label="المحافظة">
            <Select<Id>
              value={draft.provinceId ?? ''}
              onChange={(next) => set('provinceId', next)}
              options={[
                { value: '', label: 'اختر محافظة' },
                ...(provinces.data ?? []).map((row) => ({ value: row.id, label: row.name })),
              ]}
            />
          </Field>
        ) : null}

        {draft.targetType === 'user' ? (
          <Field label="المشترك">
            <Select<Id>
              value={draft.appUserId ?? ''}
              onChange={(next) => set('appUserId', next)}
              options={[
                { value: '', label: 'اختر مشترك' },
                ...(users.data ?? []).map((row) => ({
                  value: row.id,
                  label: `${row.name} — ${row.phone}`,
                })),
              ]}
            />
          </Field>
        ) : null}
      </div>

      <div className="mt-3 fs-small muted">
        الجمهور الحالي:{' '}
        <span className="num strong">
          {audience.loading ? '…' : formatNumber(audience.data ?? 0)}
        </span>{' '}
        مشترك
      </div>

      {invalid ? <div className="field-error mt-2">{invalid}</div> : null}
    </Modal>
  );
}
