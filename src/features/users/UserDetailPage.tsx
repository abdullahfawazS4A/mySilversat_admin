/**
 * One subscriber, everything about them.
 *
 * Built for a support call: identity and status at the top, then the four
 * things a caller asks about — devices, what they paid, what they predicted,
 * and where their points went.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  BadgeCheck,
  CalendarPlus,
  Coins,
  Gift,
  Pencil,
  Save,
  Ticket,
  Tv,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { useAuth } from '@/app/AuthContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  KeyValue,
  Modal,
  Notice,
  Pill,
  Tabs,
  TextArea,
  TextInput,
} from '@/components/ui';
import { HealthMeter, StatTile } from '@/components/charts';
import {
  DEVICE_STATUS,
  PAYMENT_METHOD,
  POINTS_KIND,
  PREDICTION_OUTCOME,
  RENEWAL_STATUS,
  USER_STATUS,
} from '@/lib/labels';
import {
  daysUntil,
  formatDateAr,
  formatDateTimeAr,
  formatIqd,
  formatNumber,
  formatPhone,
  relativeAr,
} from '@/lib/format';
import { RenewDialog } from '../devices/RenewDialog';

type Tab = 'devices' | 'renewals' | 'predictions' | 'points' | 'coupons';

export function UserDetailPage() {
  const { userId = '' } = useParams();
  const repos = useRepos();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { can } = useAuth();

  const [tab, setTab] = useState<Tab>('devices');
  const [editing, setEditing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [renewingDeviceId, setRenewingDeviceId] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detail = useAsync(() => repos.users.detail(userId), [userId]);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const setStatus = async (next: 'active' | 'blocked', reason?: string) => {
    setBusy(true);
    try {
      await repos.users.setStatus(userId, next, reason);
      toast(next === 'blocked' ? 'انحظر المشترك' : 'انرفع الحظر');
      setBlocking(false);
      detail.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    if (notes === null) return;
    try {
      await repos.users.saveNote(userId, notes);
      toast('انحفظت الملاحظات');
      setNotes(null);
      detail.reload();
    } catch {
      toast('تعذّر الحفظ', 'error');
    }
  };

  return (
    <AsyncBlock state={detail}>
      {(data) => {
        const { user, devices, renewals, predictions, pointsLedger, coupons } = data;
        const statusMeta = USER_STATUS[user.status];
        const governorate = governorates.data?.find((g) => g.id === user.governorateId)?.nameAr ?? '—';

        return (
          <>
            <PageHeader
              title={user.fullName}
              subtitle={`${formatPhone(user.phone)} · ${governorate} — ${user.area}`}
              actions={
                <>
                  <Button variant="ghost" icon={<ArrowRight size={16} />} onClick={() => navigate('/users')}>
                    رجوع
                  </Button>
                  {can('users.edit') ? (
                    <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                      تعديل البيانات
                    </Button>
                  ) : null}
                  {can('users.block') ? (
                    user.status === 'blocked' ? (
                      <Button
                        variant="primary"
                        icon={<BadgeCheck size={15} />}
                        onClick={() => void setStatus('active')}
                      >
                        رفع الحظر
                      </Button>
                    ) : (
                      <Button variant="danger" icon={<Ban size={15} />} onClick={() => setBlocking(true)}>
                        حظر المشترك
                      </Button>
                    )
                  ) : null}
                </>
              }
            />

            <div className="page">
              {user.status === 'blocked' ? (
                <Notice tone="danger" icon={<Ban size={16} />}>
                  هذا الحساب محظور{user.blockReason ? ` — ${user.blockReason}` : ''}.
                </Notice>
              ) : null}

              <div className="grid grid-kpi">
                <StatTile
                  label="الحالة"
                  value={<Pill tone={statusMeta.tone}>{statusMeta.label}</Pill>}
                  hint={`انضم ${formatDateAr(user.joinedAt)}`}
                />
                <StatTile
                  label="النقاط"
                  value={formatNumber(user.points)}
                  hint={user.rank ? `المركز ${user.rank}` : 'غير مصنّف'}
                  icon={<Coins size={15} />}
                />
                <StatTile
                  label="الأجهزة"
                  value={formatNumber(devices.length)}
                  hint={`${devices.filter((d) => d.status === 'active').length} فعّال`}
                  icon={<Tv size={15} />}
                />
                <StatTile
                  label="إجمالي الصرف"
                  value={formatIqd(user.totalSpend)}
                  hint={`${user.totalRenewals} تجديد`}
                />
                <StatTile
                  label="كوبونات السحب"
                  value={formatNumber(coupons.length)}
                  hint={`${coupons.filter((c) => c.active).length} سارية`}
                  icon={<Ticket size={15} />}
                  tone="gold"
                />
                <StatTile
                  label="آخر ظهور"
                  value={<span className="fs-15">{relativeAr(user.lastSeenAt)}</span>}
                  hint={user.locale === 'ckb' ? 'لغة التطبيق: كردي' : 'لغة التطبيق: عربي'}
                />
              </div>

              <div className="split">
                <Card>
                  <div className="card-head">
                    <Tabs
                      value={tab}
                      onChange={setTab}
                      items={[
                        { value: 'devices', label: `الأجهزة (${devices.length})` },
                        { value: 'renewals', label: `التجديدات (${renewals.length})` },
                        { value: 'predictions', label: `التوقعات (${predictions.length})` },
                        { value: 'points', label: `سجل النقاط (${pointsLedger.length})` },
                        { value: 'coupons', label: `الكوبونات (${coupons.length})` },
                      ]}
                    />
                  </div>

                  {tab === 'devices' ? (
                    devices.length === 0 ? (
                      <EmptyState title="ما عنده أجهزة مسجلة" icon={<Tv size={22} />} />
                    ) : (
                      devices.map((device) => {
                        const meta = DEVICE_STATUS[device.status];
                        const left = daysUntil(device.expiryAt);
                        const total = Math.max(
                          1,
                          Math.round(
                            (new Date(device.expiryAt).getTime() -
                              new Date(device.periodStartAt).getTime()) /
                              86_400_000,
                          ),
                        );
                        return (
                          <div
                            key={device.id}
                            className="col"
                            style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--divider)', gap: 10 }}
                          >
                            <div className="row row-gap-3 wrap">
                              <span className="chip-icon">
                                <Tv size={16} />
                              </span>
                              <div className="col grow" style={{ lineHeight: 1.35 }}>
                                <span className="fs-13 strong">{device.name}</span>
                                <span className="fs-11 dim num">{device.number}</span>
                              </div>
                              <Pill tone={meta.tone}>{meta.label}</Pill>
                              {can('renewals.create') ? (
                                <Button
                                  variant="subtle"
                                  size="sm"
                                  icon={<CalendarPlus size={13} />}
                                  onClick={() => setRenewingDeviceId(device.id)}
                                >
                                  تجديد
                                </Button>
                              ) : null}
                            </div>
                            <HealthMeter
                              ratio={Math.max(0, Math.min(1, left / total))}
                              warning={left <= 7}
                            />
                            <div className="row between fs-12 muted">
                              <span>{device.model}</span>
                              <span className="num">
                                {left >= 0 ? `باقي ${left} يوم` : `منتهي من ${Math.abs(left)} يوم`} ·{' '}
                                {formatDateAr(device.expiryAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : null}

                  {tab === 'renewals' ? (
                    renewals.length === 0 ? (
                      <EmptyState title="ما عنده تجديدات" />
                    ) : (
                      renewals.map((renewal) => {
                        const meta = RENEWAL_STATUS[renewal.status];
                        return (
                          <div
                            key={renewal.id}
                            className="row row-gap-3 wrap"
                            style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                          >
                            <div className="col grow" style={{ lineHeight: 1.35 }}>
                              <span className="fs-13">
                                تجديد <span className="num">{renewal.months}</span> أشهر
                              </span>
                              <span className="fs-11 dim">
                                {PAYMENT_METHOD[renewal.method]} · {formatDateAr(renewal.createdAt)}
                              </span>
                            </div>
                            <span className="fs-13 strong num">{formatIqd(renewal.price)}</span>
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                          </div>
                        );
                      })
                    )
                  ) : null}

                  {tab === 'predictions' ? (
                    predictions.length === 0 ? (
                      <EmptyState title="ما شارك بالتوقعات" />
                    ) : (
                      predictions.map((prediction) => {
                        const meta = PREDICTION_OUTCOME[prediction.outcome];
                        return (
                          <div
                            key={prediction.id}
                            className="row row-gap-3 wrap"
                            style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                          >
                            <span className="fs-13 strong num" style={{ minWidth: 54 }}>
                              {prediction.homePick} – {prediction.awayPick}
                            </span>
                            <span className="fs-12 dim grow">{formatDateTimeAr(prediction.createdAt)}</span>
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            {prediction.pointsAwarded !== null ? (
                              <span className="fs-13 strong num">+{prediction.pointsAwarded}</span>
                            ) : null}
                          </div>
                        );
                      })
                    )
                  ) : null}

                  {tab === 'points' ? (
                    pointsLedger.length === 0 ? (
                      <EmptyState title="ما عنده حركات نقاط" icon={<Coins size={22} />} />
                    ) : (
                      pointsLedger.map((entry) => {
                        const meta = POINTS_KIND[entry.kind];
                        return (
                          <div
                            key={entry.id}
                            className="row row-gap-3 wrap"
                            style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                          >
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            <span className="fs-13 grow truncate">{entry.reasonAr}</span>
                            <span className="fs-12 dim">{formatDateAr(entry.createdAt)}</span>
                            <span
                              className="fs-13 strong num"
                              style={{ color: entry.delta >= 0 ? 'var(--success)' : 'var(--danger)' }}
                            >
                              {entry.delta >= 0 ? '+' : ''}
                              {entry.delta}
                            </span>
                          </div>
                        );
                      })
                    )
                  ) : null}

                  {tab === 'coupons' ? (
                    coupons.length === 0 ? (
                      <EmptyState title="ما عنده كوبونات" icon={<Gift size={22} />} />
                    ) : (
                      coupons.map((coupon) => (
                        <div
                          key={coupon.id}
                          className="row row-gap-3 wrap"
                          style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                        >
                          <span className="fs-13 strong num">{coupon.code}</span>
                          <span className="fs-12 dim grow">
                            {coupon.resultTextAr ?? `سحب ${coupon.year} — بانتظار السحب`}
                          </span>
                          <Pill tone={coupon.active ? 'success' : 'muted'}>
                            {coupon.active ? 'ساري' : 'منتهي'}
                          </Pill>
                        </div>
                      ))
                    )
                  ) : null}
                </Card>

                <div className="col" style={{ gap: 'var(--sp-4)' }}>
                  <Card>
                    <CardHead title="بيانات الحساب" />
                    <div className="card-pad">
                      <KeyValue
                        rows={[
                          ['الهاتف', <span className="num">{formatPhone(user.phone)}</span>],
                          ['المحافظة', governorate],
                          ['المنطقة', user.area],
                          ['لغة التطبيق', user.locale === 'ckb' ? 'كردي سوراني' : 'عربي'],
                          ['تاريخ الانضمام', formatDateAr(user.joinedAt)],
                          ['آخر ظهور', relativeAr(user.lastSeenAt)],
                        ]}
                      />
                    </div>
                  </Card>

                  <Card>
                    <CardHead
                      title="ملاحظات الدعم"
                      subtitle="داخلية — ما تظهر للمشترك"
                      actions={
                        notes !== null ? (
                          <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={() => void saveNotes()}>
                            حفظ
                          </Button>
                        ) : null
                      }
                    />
                    <div className="card-pad">
                      <TextArea
                        value={notes ?? user.notes}
                        onChange={setNotes}
                        rows={5}
                        placeholder="اكتب ملاحظة عن هذا المشترك…"
                      />
                    </div>
                  </Card>

                  <Card>
                    <CardHead title="روابط سريعة" />
                    <div className="col card-pad" style={{ gap: 'var(--sp-2)' }}>
                      <Link to={`/devices?user=${user.id}`}>
                        <Button variant="ghost" className="grow">
                          أجهزة هذا المشترك
                        </Button>
                      </Link>
                      <Link to={`/renewals?user=${user.id}`}>
                        <Button variant="ghost" className="grow">
                          تجديدات هذا المشترك
                        </Button>
                      </Link>
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            {editing ? (
              <EditUserDialog
                user={user}
                governorates={(governorates.data ?? []).map((g) => ({ value: g.id, label: g.nameAr }))}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  detail.reload();
                }}
              />
            ) : null}

            {blocking ? (
              <BlockDialog
                pending={busy}
                onCancel={() => setBlocking(false)}
                onConfirm={(reason) => void setStatus('blocked', reason)}
              />
            ) : null}

            {renewingDeviceId ? (
              <RenewDialog
                deviceId={renewingDeviceId}
                onClose={() => setRenewingDeviceId(null)}
                onSaved={() => {
                  setRenewingDeviceId(null);
                  detail.reload();
                }}
              />
            ) : null}
          </>
        );
      }}
    </AsyncBlock>
  );
}

function EditUserDialog({
  user,
  governorates,
  onClose,
  onSaved,
}: {
  user: import('@/types').AppUser;
  governorates: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [governorateId, setGovernorateId] = useState(user.governorateId);
  const [area, setArea] = useState(user.area);

  const save = async () => {
    const ok = await run(() =>
      repos.users.save({ ...user, fullName, phone, governorateId, area }),
    );
    if (ok) {
      toast('انحفظت البيانات');
      onSaved();
    }
  };

  return (
    <Modal
      title="تعديل بيانات المشترك"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void save()} disabled={action.pending}>
            حفظ
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
        <Field label="الاسم الكامل">
          <TextInput value={fullName} onChange={setFullName} />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput type="tel" value={phone} onChange={setPhone} />
        </Field>
        <div className="grid grid-form">
          <Field label="المحافظة">
            <select className="select" value={governorateId} onChange={(e) => setGovernorateId(e.target.value)}>
              {governorates.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المنطقة">
            <TextInput value={area} onChange={setArea} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function BlockDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      title="حظر المشترك"
      danger
      pending={pending}
      confirmLabel="حظر"
      onCancel={onCancel}
      onConfirm={() => onConfirm(reason || 'بدون سبب مذكور')}
      message={
        <div className="col" style={{ gap: 'var(--sp-3)' }}>
          <span>المشترك المحظور ما راح يكدر يدخل للتطبيق. أجهزته تبقى شغالة لحد انتهاء اشتراكها.</span>
          <Field label="سبب الحظر">
            <TextInput value={reason} onChange={setReason} placeholder="مثلاً: مشاركة بيانات الدخول" />
          </Field>
        </div>
      }
    />
  );
}
