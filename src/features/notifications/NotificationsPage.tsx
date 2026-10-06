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
 *
 * Editing or deleting a sent notification changes only the copy in the app's
 * inbox. The push already on phones cannot be recalled, and both dialogs say so.
 */

import { useState } from 'react';
import { BellRing, Check, Pencil, Send, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
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
import { APP_SCREENS, screenName } from '@/lib/appScreens';
import type { AppUser, Id, NotificationRecord, NotificationTarget } from '@/types';
import type { NotificationInput, NotificationTextInput } from '@/data/repositories/types';

export function NotificationsPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<NotificationRecord | null>(null);
  const [deleting, setDeleting] = useState<NotificationRecord | null>(null);

  const sent = useAsync(() => repos.notifications.list({ page, pageSize: 20 }), [page]);

  const remove = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.notifications.remove(deleting.id));
    if (!ok) return;
    setDeleting(null);
    toast('انحذف الإشعار');
    sent.reload();
  };

  const columns: Column<NotificationRecord>[] = [
    {
      key: 'title',
      header: 'الإشعار',
      render: (row) => (
        // Both lines are free text an operator typed, so both are capped and
        // carry the full value in a tooltip rather than being lost to the
        // ellipsis.
        <div className="col cell-text lh-tight" title={`${row.titleAr}
${row.bodyAr}`}>
          <span className="fs-body strong truncate">{row.titleAr}</span>
          <span className="fs-tiny dim truncate">{row.bodyAr}</span>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'الجمهور',
      render: (row) => (
        <div className="col lh-tight">
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
        <div className="col lh-tight">
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
    {
      key: 'actions',
      header: '',
      width: 96,
      render: (row) => (
        <div className="row row-gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Pencil size={14} />}
            title="تعديل"
            onClick={() => setEditing(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} />}
            title="حذف"
            onClick={() => {
              action.clearError();
              setDeleting(row);
            }}
          />
        </div>
      ),
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

      {editing ? (
        <EditDialog
          notification={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            sent.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الإشعار"
          confirmLabel="حذف"
          danger
          pending={action.pending}
          message={
            <div className="col row-gap-3">
              <span>
                راح ينحذف <span className="strong">{deleting.titleAr}</span> من صندوق الإشعارات عند كل
                المشتركين اللي وصلهم.
              </span>
              <Notice tone="warning">الإشعار اللي وصل للموبايلات ما ينسحب.</Notice>
              {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
            </div>
          }
          onConfirm={() => void remove()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Editing a sent notification's text.
 *
 * Only the four text fields can change — the audience is fixed once it has
 * been sent to. The same rules as composing apply: Arabic is required and a
 * blank Kurdish field falls back to it.
 */
/** The screen key a notification's `data` names, the way the app looks for it. */
function routeOf(data: Record<string, unknown> | null | undefined): string | null {
  return (
    ['route', 'screen', 'target', 'page']
      .map((name) => data?.[name])
      .find((value): value is string => typeof value === 'string' && value.trim() !== '') ?? null
  );
}

/**
 * Where tapping a sent notification takes the subscriber, read the way the app
 * reads its `data`: a screen key under `route` (or `screen`/`target`/`page`),
 * else an ad opens the offers screen and a match the matches screen, else the
 * inbox.
 */
function tapTarget(data: Record<string, unknown> | null | undefined): string {
  const key = routeOf(data);
  if (key) return screenName(key) ?? `${key} (ما موجودة بالتطبيق)`;
  if (data?.type === 'ad' && data.adId) return screenName('offers') ?? 'العروض';
  if (data?.matchId) return screenName('matches') ?? 'المباريات';
  return 'صندوق الإشعارات (الافتراضي)';
}

/** The edit form's stand-in for a non-screen target it leaves as it was. */
const KEEP = '__keep__';

function EditDialog({
  notification,
  onClose,
  onSaved,
}: {
  notification: NotificationRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [draft, setDraft] = useState<NotificationTextInput>({
    titleAr: notification.titleAr,
    titleKu: notification.titleKu,
    bodyAr: notification.bodyAr,
    bodyKu: notification.bodyKu,
  });
  const set = (key: 'titleAr' | 'titleKu' | 'bodyAr' | 'bodyKu', value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const [invalid, setInvalid] = useState<string | null>(null);

  /*
   * The tap target. `KEEP` stands for whatever `data` holds now when it is not
   * a plain screen key — an `adId`, a `matchId` — which this form cannot
   * rebuild, so it is left untouched unless the operator picks something else.
   */
  const existing = notification.dataJson;
  const existingRoute = routeOf(existing);
  const hasOther = !existingRoute && !!existing && Object.keys(existing).length > 0;
  const initialTarget = existingRoute ?? (hasOther ? KEEP : '');
  const [target, setTarget] = useState(initialTarget);

  const save = async () => {
    const found = !draft.titleAr.trim()
      ? 'العنوان بالعربي مطلوب'
      : !draft.bodyAr.trim()
        ? 'نص الإشعار بالعربي مطلوب'
        : null;
    setInvalid(found);
    if (found) return;

    const ok = await run(() =>
      repos.notifications.update(notification.id, {
        ...draft,
        titleKu: draft.titleKu.trim() || draft.titleAr,
        bodyKu: draft.bodyKu.trim() || draft.bodyAr,
        // Sent only when changed: an untouched target keeps every key it had.
        ...(target === initialTarget ? {} : { data: target ? { route: target } : null }),
      }),
    );
    if (!ok) return;
    toast('انحفظ التعديل');
    onSaved();
  };

  return (
    <Modal
      title="تعديل الإشعار"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Check size={15} />}
            disabled={action.pending}
            onClick={() => void save()}
          >
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <Notice tone="info">
        التعديل يتغيّر بصندوق الإشعارات داخل التطبيق بس — الإشعار اللي وصل للموبايلات يبقى مثل ما انرسل.
      </Notice>

      <div className="grid grid-form mt-3">
        <Field label="العنوان بالعربي">
          <TextInput value={draft.titleAr} onChange={(next) => set('titleAr', next)} />
        </Field>
        <Field label="العنوان بالكردي" hint="إذا تركته فارغ ينحفظ العربي">
          <TextInput value={draft.titleKu} onChange={(next) => set('titleKu', next)} />
        </Field>

        <Field label="النص بالعربي" className="span-2">
          <TextArea rows={3} value={draft.bodyAr} onChange={(next) => set('bodyAr', next)} />
        </Field>
        <Field label="النص بالكردي" className="span-2" hint="إذا تركته فارغ ينحفظ العربي">
          <TextArea rows={3} value={draft.bodyKu} onChange={(next) => set('bodyKu', next)} />
        </Field>

        <Field
          label="يفتح شاشة"
          className="span-2"
          hint="يتغيّر الضغط من صندوق الإشعارات بالتطبيق بس — الإشعار اللي وصل للموبايل يفتح اللي انرسل بيه"
        >
          <Select<string>
            value={target}
            onChange={setTarget}
            options={[
              ...(hasOther ? [{ value: KEEP, label: `${tapTarget(existing)} (الحالي — بدون تغيير)` }] : []),
              { value: '', label: 'صندوق الإشعارات (الافتراضي)' },
              // A key the app does not know is shown as what it is, not dropped.
              ...(existingRoute && !screenName(existingRoute)
                ? [{ value: existingRoute, label: `${existingRoute} (ما موجودة بالتطبيق)` }]
                : []),
              ...APP_SCREENS,
            ]}
          />
        </Field>
      </div>

      {invalid ? <div className="field-error mt-2">{invalid}</div> : null}
      {action.error ? (
        <div className="mt-3">
          <Notice tone="danger">{action.error}</Notice>
        </div>
      ) : null}
    </Modal>
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

  /** The app screen a tap opens; empty leaves the app's default, the inbox. */
  const [route, setRoute] = useState('');
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
        // FCM data values must be strings; the app reads `route` as a screen key.
        data: route ? { route } : undefined,
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
        <div className="col row-gap-4">
          <Notice tone="warning">
            راح يوصل الإشعار لـ{' '}
            <span className="strong num">{formatNumber(audience.data ?? 0)}</span> مشترك
            ({NOTIFICATION_TARGET[draft.targetType]}). الإرسال فوري وما تكدر تتراجع عنه.
          </Notice>

          <div className="card card-pad col row-gap-1">
            <span className="fs-body strong">{draft.titleAr}</span>
            <span className="fs-small">{draft.bodyAr}</span>
            <span className="fs-tiny dim mt-1">
              عند الضغط: {route ? `يفتح شاشة «${screenName(route)}»` : 'يفتح صندوق الإشعارات'}
            </span>
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

        <Field label="يفتح شاشة" hint="الشاشة اللي تنفتح لما المشترك يضغط الإشعار" className="span-2">
          <Select<string>
            value={route}
            onChange={setRoute}
            options={[{ value: '', label: 'صندوق الإشعارات (الافتراضي)' }, ...APP_SCREENS]}
          />
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
