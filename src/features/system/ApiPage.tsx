/**
 * Governorate APIs.
 *
 * Every governorate runs the same stack behind a different domain, so a
 * connection is four fields — domain, auth key, username, password — plus the
 * governorates it answers for. That sameness is the reason this is one screen
 * with a list rather than a per-governorate form: the operator adds a server
 * once and then points governorates at it.
 *
 * The invariant the screen is built around is that **a governorate answers to
 * exactly one connection**. Linking is therefore shown as a claim, not a
 * checkbox soup: a governorate already linked elsewhere says so, and picking
 * it moves it rather than silently double-booking a renewal.
 */

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  KeyRound,
  Link2,
  Pencil,
  Plug,
  PlugZap,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  Switch,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { ApiConnection, Governorate, Id } from '@/types';
import { formatNumber, relativeAr } from '@/lib/format';

export function ApiPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [editing, setEditing] = useState<ApiConnection | 'new' | null>(null);
  const [linking, setLinking] = useState<ApiConnection | null>(null);
  const [deleting, setDeleting] = useState<ApiConnection | null>(null);
  const [testingId, setTestingId] = useState<Id | null>(null);
  const [run, action] = useAction();

  const connections = useAsync(() => repos.api.list(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const governorateById = useMemo(() => {
    const map = new Map<Id, Governorate>();
    for (const governorate of governorates.data ?? []) map.set(governorate.id, governorate);
    return map;
  }, [governorates.data]);

  // Which governorates nothing points at. This is the number that actually
  // breaks renewals, so it gets a tile of its own.
  const linkedIds = new Set((connections.data ?? []).flatMap((c) => c.governorateIds));
  const unlinked = (governorates.data ?? []).filter((g) => g.active && !linkedIds.has(g.id));

  const runTest = async (connection: ApiConnection) => {
    setTestingId(connection.id);
    try {
      const result = await repos.api.test(connection.id);
      toast(result.messageAr, result.ok ? 'success' : 'error');
      connections.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الاختبار', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const runDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.api.remove(deleting.id));
    if (ok) {
      toast('انحذف الاتصال');
      setDeleting(null);
      connections.reload();
    }
  };

  return (
    <>
      <PageHeader
        title="الـ API"
        subtitle="سيرفر كل محافظة — نفس الهيكلية، يتغيّر بس الدومين والمفاتيح"
        actions={
          <Button variant="primary" icon={<Plug size={16} />} onClick={() => setEditing('new')}>
            إضافة اتصال
          </Button>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        <div className="grid grid-kpi-3">
          <StatTile
            label="اتصالات"
            value={formatNumber(connections.data?.length ?? 0)}
            icon={<Plug size={15} />}
          />
          <StatTile
            label="محافظات مربوطة"
            value={formatNumber(linkedIds.size)}
            hint={`من ${formatNumber(governorates.data?.length ?? 0)}`}
            icon={<Link2 size={15} />}
          />
          <StatTile
            label="محافظات بلا API"
            value={formatNumber(unlinked.length)}
            hint="مفعّلة بس ما مربوطة بسيرفر"
            tone={unlinked.length > 0 ? 'danger' : undefined}
            icon={<XCircle size={15} />}
          />
        </div>

        {unlinked.length > 0 ? (
          <Notice tone="danger">
            <span className="strong">{unlinked.map((g) => g.nameAr).join('، ')}</span> — مفعّلة بس ما
            مربوطة بأي API. التجديد بيها ما يوصل لسيرفر.
          </Notice>
        ) : null}

        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <AsyncBlock
          state={connections}
          emptyWhen={(rows) => rows.length === 0}
          empty={
            <Card>
              <EmptyState
                title="ما بيها اتصالات"
                hint="أضف سيرفر أول محافظة، وبعدها اربط باقي المحافظات اللي عليه."
                icon={<Plug size={22} />}
                action={
                  <Button variant="primary" size="sm" icon={<Plug size={14} />} onClick={() => setEditing('new')}>
                    إضافة اتصال
                  </Button>
                }
              />
            </Card>
          }
        >
          {(rows) => (
            <div className="grid grid-2">
              {rows.map((connection) => (
                <Card key={connection.id}>
                  <CardHead
                    title={connection.nameAr}
                    subtitle={connection.baseUrl}
                    actions={
                      <>
                        <Pill tone={connection.active ? 'success' : 'muted'}>
                          {connection.active ? 'مفعّل' : 'معطّل'}
                        </Pill>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={13} />}
                          title="تعديل"
                          onClick={() => setEditing(connection)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} />}
                          title="حذف"
                          onClick={() => setDeleting(connection)}
                        />
                      </>
                    }
                  />

                  <div className="card-pad col" style={{ gap: 'var(--sp-4)' }}>
                    <div className="col" style={{ gap: 6 }}>
                      <div className="row row-gap-2">
                        <Globe size={13} className="dim" />
                        <span className="fs-12 dim num truncate">{connection.baseUrl}</span>
                      </div>
                      <div className="row row-gap-2">
                        <KeyRound size={13} className="dim" />
                        <span className="fs-12 dim num truncate">
                          {connection.username} · {'•'.repeat(8)}
                        </span>
                      </div>
                    </div>

                    <div className="col" style={{ gap: 6 }}>
                      <span className="fs-11 muted">المحافظات المربوطة</span>
                      {connection.governorateIds.length > 0 ? (
                        <div className="row row-gap-2 wrap">
                          {connection.governorateIds.map((id) => (
                            <Pill key={id} tone="neutral">
                              {governorateById.get(id)?.nameAr ?? id}
                            </Pill>
                          ))}
                        </div>
                      ) : (
                        <span className="fs-12 dim">ما بيه محافظات — هذا الاتصال ما يشتغل بعد</span>
                      )}
                    </div>

                    {connection.lastCheckAt ? (
                      <div className="row row-gap-2">
                        {connection.lastCheckOk ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                        ) : (
                          <XCircle size={14} style={{ color: 'var(--danger)' }} />
                        )}
                        <span className="fs-12 dim truncate">
                          {connection.lastCheckMessageAr} · {relativeAr(connection.lastCheckAt)}
                        </span>
                      </div>
                    ) : (
                      <span className="fs-12 dim">ما انختبر بعد</span>
                    )}

                    <div className="row row-gap-2 wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<PlugZap size={13} />}
                        disabled={testingId === connection.id}
                        onClick={() => void runTest(connection)}
                      >
                        {testingId === connection.id ? 'جاري الاختبار…' : 'اختبار الاتصال'}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        icon={<Link2 size={13} />}
                        onClick={() => setLinking(connection)}
                      >
                        ربط المحافظات
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AsyncBlock>
      </div>

      {editing ? (
        <ConnectionDialog
          connection={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            connections.reload();
          }}
        />
      ) : null}

      {linking ? (
        <LinkDialog
          connection={linking}
          connections={connections.data ?? []}
          governorates={governorates.data ?? []}
          onClose={() => setLinking(null)}
          onSaved={() => {
            setLinking(null);
            connections.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`حذف ${deleting.nameAr}`}
          message={
            deleting.governorateIds.length > 0 ? (
              <>
                هذا الاتصال مربوط بـ{' '}
                <span className="num strong">{deleting.governorateIds.length}</span> محافظة. فك
                الارتباط أول قبل الحذف.
              </>
            ) : (
              <>راح ينحذف الاتصال ومفاتيحه نهائياً.</>
            )
          }
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

// --------------------------------------------------------------- dialogs ---

/** The four fields plus the on/off switch. Nothing else differs per server. */
function ConnectionDialog({
  connection,
  onClose,
  onSaved,
}: {
  connection: ApiConnection | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [nameAr, setNameAr] = useState(connection?.nameAr ?? '');
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? 'https://');
  const [authKey, setAuthKey] = useState(connection?.authKey ?? '');
  const [username, setUsername] = useState(connection?.username ?? '');
  const [password, setPassword] = useState(connection?.password ?? '');
  const [active, setActive] = useState(connection?.active ?? true);

  const submit = async () => {
    const ok = await run(() =>
      repos.api.save({
        id: connection?.id,
        nameAr,
        baseUrl,
        authKey,
        username,
        password,
        active,
        governorateIds: connection?.governorateIds ?? [],
      }),
    );
    if (ok) {
      toast(connection ? 'انحفظ الاتصال' : 'انضاف الاتصال — اربط عليه المحافظات الآن');
      onSaved();
    }
  };

  return (
    <Modal
      title={connection ? `تعديل ${connection.nameAr}` : 'إضافة اتصال'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" disabled={action.pending} onClick={() => void submit()}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <Field label="اسم الاتصال" hint="اسم تعرفه بيه، مثل «سيرفر بغداد»">
          <TextInput value={nameAr} onChange={setNameAr} placeholder="سيرفر بغداد" />
        </Field>

        <Field label="الدومين" hint="العنوان الأساسي بدون مسار — https://bgd.silversat.iq">
          <TextInput type="url" value={baseUrl} onChange={setBaseUrl} placeholder="https://" />
        </Field>

        <Field label="Auth Key" hint="المفتاح اللي ينرسل بترويسة كل طلب">
          <TextInput value={authKey} onChange={setAuthKey} placeholder="ak_..." />
        </Field>

        <div className="grid grid-2">
          <Field label="اسم المستخدم">
            <TextInput value={username} onChange={setUsername} />
          </Field>
          <Field label="الرمز">
            <TextInput type="password" value={password} onChange={setPassword} />
          </Field>
        </div>

        <Switch checked={active} onChange={setActive} label="الاتصال مفعّل" />

        {connection ? (
          <Notice tone="info">
            تغيير الدومين أو المفاتيح يلغي نتيجة آخر اختبار — اختبر الاتصال بعد الحفظ.
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * Claims governorates for one connection.
 *
 * Each row says where the governorate is *now*, so moving one off another
 * server is a visible decision rather than a surprise.
 */
function LinkDialog({
  connection,
  connections,
  governorates,
  onClose,
  onSaved,
}: {
  connection: ApiConnection;
  connections: ApiConnection[];
  governorates: Governorate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [chosen, setChosen] = useState<Set<Id>>(new Set(connection.governorateIds));

  // Where each governorate currently lives, excluding this connection.
  const ownerOf = useMemo(() => {
    const map = new Map<Id, ApiConnection>();
    for (const other of connections) {
      if (other.id === connection.id) continue;
      for (const id of other.governorateIds) map.set(id, other);
    }
    return map;
  }, [connections, connection.id]);

  const moving = [...chosen].filter((id) => ownerOf.has(id));

  const submit = async () => {
    const ok = await run(() => repos.api.setGovernorates(connection.id, [...chosen]));
    if (ok) {
      toast(`انربطت ${chosen.size} محافظة بـ ${connection.nameAr}`);
      onSaved();
    }
  };

  return (
    <Modal
      title={`ربط المحافظات بـ ${connection.nameAr}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Link2 size={15} />}
            disabled={action.pending}
            onClick={() => void submit()}
          >
            {action.pending ? 'جاري الحفظ…' : `ربط ${chosen.size} محافظة`}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <Notice tone="info">
          المحافظة تنربط بسيرفر واحد بس. إذا اخترت محافظة مربوطة بسيرفر ثاني، راح تنتقل لهنا.
        </Notice>

        {moving.length > 0 ? (
          <Notice tone="warning">
            راح تنتقل{' '}
            <span className="strong">
              {moving.map((id) => governorates.find((g) => g.id === id)?.nameAr).join('، ')}
            </span>{' '}
            من سيرفرها الحالي إلى {connection.nameAr}.
          </Notice>
        ) : null}

        <div className="col" style={{ gap: 'var(--sp-2)' }}>
          {governorates.map((governorate) => {
            const owner = ownerOf.get(governorate.id);
            const checked = chosen.has(governorate.id);
            return (
              <label
                key={governorate.id}
                className="row row-gap-3 card card-pad"
                style={{ alignItems: 'center', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={checked}
                  onChange={() =>
                    setChosen((current) => {
                      const next = new Set(current);
                      if (next.has(governorate.id)) next.delete(governorate.id);
                      else next.add(governorate.id);
                      return next;
                    })
                  }
                />
                <div className="col grow" style={{ lineHeight: 1.35, minWidth: 0 }}>
                  <span className="fs-13 strong truncate">{governorate.nameAr}</span>
                  <span className="fs-11 dim truncate">
                    {owner ? `مربوطة الآن بـ ${owner.nameAr}` : 'غير مربوطة'}
                  </span>
                </div>
                {!governorate.active ? <Pill tone="muted">معطّلة</Pill> : null}
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
