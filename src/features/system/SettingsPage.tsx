/**
 * Global settings.
 *
 * Everything on this screen is read by the customer app, so two of these
 * fields change what users see the moment they are saved:
 *
 *  - `expiryWarningDays` re-derives every device status, moving subscriptions
 *    between "فعّال" and "قرب ينتهي" — the repository recomputes them on save;
 *  - `maintenanceMode` blocks the app entirely behind a notice.
 *
 * Both are called out inline rather than left to the reader to discover. The
 * whole form edits a local draft and saves in one write, so a half-finished
 * scoring change never reaches the app.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, LifeBuoy, RotateCcw, Rss, Save, Settings, Target, Timer } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  Field,
  Notice,
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { AppSettings } from '@/types';
import { formatNumber, relativeAr } from '@/lib/format';

export function SettingsPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const settings = useAsync(() => repos.admin.settings(), []);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  // The draft follows the loaded settings, and every edit after that is local.
  useEffect(() => {
    if (settings.data) setDraft(structuredClone(settings.data));
  }, [settings.data]);

  const dirty =
    draft !== null && settings.data !== undefined
      ? JSON.stringify(draft) !== JSON.stringify(settings.data)
      : false;

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const patchScoring = <K extends keyof AppSettings['scoring']>(
    key: K,
    value: AppSettings['scoring'][K],
  ) =>
    setDraft((current) =>
      current ? { ...current, scoring: { ...current.scoring, [key]: value } } : current,
    );

  const patchFeed = <K extends keyof AppSettings['matchFeed']>(
    key: K,
    value: AppSettings['matchFeed'][K],
  ) =>
    setDraft((current) =>
      current ? { ...current, matchFeed: { ...current.matchFeed, [key]: value } } : current,
    );

  const save = async () => {
    if (!draft) return;
    const ok = await run(() => repos.admin.saveSettings(draft), (saved) => setDraft(structuredClone(saved)));
    if (ok) {
      toast('انحفظت الإعدادات');
      settings.reload();
    }
  };

  const revert = () => {
    if (settings.data) setDraft(structuredClone(settings.data));
  };

  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="قواعد النقاط، حالة التطبيق وبيانات الدعم"
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RotateCcw size={15} />}
              disabled={!dirty || action.pending}
              onClick={revert}
            >
              تراجع
            </Button>
            <Button
              variant="primary"
              icon={<Save size={15} />}
              disabled={!dirty || action.pending}
              onClick={() => void save()}
            >
              {action.pending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
            </Button>
          </>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <AsyncBlock state={settings}>
          {() =>
            draft === null ? null : (
              <div className="col" style={{ gap: 'var(--sp-4)' }}>
                {draft.maintenanceMode ? (
                  <Notice tone="danger" icon={<AlertTriangle size={16} />}>
                    وضع الصيانة شغّال — التطبيق مقفل على كل المشتركين هسه.
                  </Notice>
                ) : null}

                {/* ------------------------------------------- scoring --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="row row-gap-2">
                    <span className="chip-icon" style={{ width: 30, height: 30 }}>
                      <Target size={15} />
                    </span>
                    <div className="col">
                      <h3>قواعد النقاط</h3>
                      <span className="fs-12 muted">
                        تنطبق على المباريات اللي تنحسب بعد الحفظ — النقاط المحتسبة سابقاً ما تتغيّر
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-form">
                    <Field label="نتيجة بالضبط" hint="خمّن الهدفين صح">
                      <TextInput
                        type="number"
                        value={draft.scoring.exactScore}
                        onChange={(v) => patchScoring('exactScore', Number(v))}
                      />
                    </Field>
                    <Field label="فرق أهداف صحيح" hint="الفائز صح وفرق الأهداف صح">
                      <TextInput
                        type="number"
                        value={draft.scoring.goalDifference}
                        onChange={(v) => patchScoring('goalDifference', Number(v))}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-form">
                    <Field label="نتيجة صحيحة" hint="الفائز أو التعادل صح بس">
                      <TextInput
                        type="number"
                        value={draft.scoring.correctResult}
                        onChange={(v) => patchScoring('correctResult', Number(v))}
                      />
                    </Field>
                    <Field label="توقع خاطئ" hint="عادة صفر — القيمة السالبة مسموحة">
                      <TextInput
                        type="number"
                        value={draft.scoring.wrong}
                        onChange={(v) => patchScoring('wrong', Number(v))}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-form">
                    <Field label="نقاط المشاركة" hint="تنعطى لأي مشترك يشارك، صح أو غلط">
                      <TextInput
                        type="number"
                        value={draft.scoring.participation}
                        onChange={(v) => patchScoring('participation', Number(v))}
                      />
                    </Field>
                    <Field label="قفل التوقعات قبل البداية" hint="بالدقائق، لمن ما يكون وقت قفل محدد">
                      <TextInput
                        type="number"
                        min={0}
                        value={draft.scoring.lockMinutesBeforeKickoff}
                        onChange={(v) => patchScoring('lockMinutesBeforeKickoff', Number(v))}
                      />
                    </Field>
                  </div>

                  <Switch
                    checked={draft.scoring.allowEditBeforeLock}
                    onChange={(next) => patchScoring('allowEditBeforeLock', next)}
                    label="اسمح للمشترك يعدّل توقعه قبل القفل"
                  />
                </div>

                {/* ---------------------------- subscriptions & seasons --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="row row-gap-2">
                    <span className="chip-icon" style={{ width: 30, height: 30 }}>
                      <Timer size={15} />
                    </span>
                    <div className="col">
                      <h3>الاشتراكات والمواسم</h3>
                      <span className="fs-12 muted">متى ينذر التطبيق ومتى يصفّر الترتيب</span>
                    </div>
                  </div>

                  <div className="grid grid-form">
                    <Field
                      label="تنبيه قرب الانتهاء"
                      hint="بالأيام قبل تاريخ الانتهاء"
                    >
                      <TextInput
                        type="number"
                        min={1}
                        max={90}
                        value={draft.expiryWarningDays}
                        onChange={(v) => patch('expiryWarningDays', Number(v))}
                      />
                    </Field>
                    <Field label="أقل مدة تعطي كوبون سحب" hint="بالأشهر">
                      <TextInput
                        type="number"
                        min={1}
                        max={24}
                        value={draft.couponMinMonths}
                        onChange={(v) => patch('couponMinMonths', Number(v))}
                      />
                    </Field>
                    <Field
                      label="حد المخزون المنخفض"
                      hint="عدد الكارتات اللي تحته تنطلع تنبيه بشاشة المخزن"
                    >
                      <TextInput
                        type="number"
                        min={0}
                        max={500}
                        value={draft.lowStockThreshold}
                        onChange={(v) => patch('lowStockThreshold', Number(v))}
                      />
                    </Field>
                  </div>

                  <Notice tone="warning">
                    تغيير مدة التنبيه يعيد حساب حالة كل الأجهزة فوراً — اشتراكات هسه محسوبة "فعّالة"
                    ممكن تصير "قرب تنتهي" داخل التطبيق.
                  </Notice>

                  <Switch
                    checked={draft.monthlyLeaderboardReset}
                    onChange={(next) => patch('monthlyLeaderboardReset', next)}
                    label="صفّر الترتيب أول كل شهر"
                  />
                </div>

                {/* ------------------------------------- match feed --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="row row-gap-2">
                    <span className="chip-icon" style={{ width: 30, height: 30 }}>
                      <Rss size={15} />
                    </span>
                    <div className="col">
                      <h3>مزوّد المباريات</h3>
                      <span className="fs-12 muted">
                        من وين تجي الدوريات والفرق والمباريات — ما تنضاف يدوياً
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-form">
                    <Field label="اسم المزوّد">
                      <TextInput
                        value={draft.matchFeed.providerName}
                        onChange={(v) => patchFeed('providerName', v)}
                      />
                    </Field>
                    <Field label="فترة المزامنة" hint="بالدقائق — صفر يعني مزامنة يدوية فقط">
                      <TextInput
                        type="number"
                        min={0}
                        max={1440}
                        value={draft.matchFeed.syncIntervalMinutes}
                        onChange={(v) => patchFeed('syncIntervalMinutes', Number(v))}
                      />
                    </Field>
                  </div>

                  <Field label="الدومين" hint="العنوان الأساسي لواجهة المزوّد">
                    <TextInput
                      type="url"
                      value={draft.matchFeed.baseUrl}
                      onChange={(v) => patchFeed('baseUrl', v)}
                    />
                  </Field>

                  <Field label="مفتاح الوصول">
                    <TextInput
                      type="password"
                      value={draft.matchFeed.apiKey}
                      onChange={(v) => patchFeed('apiKey', v)}
                    />
                  </Field>

                  {draft.matchFeed.lastSyncAt ? (
                    <Notice tone={draft.matchFeed.lastSyncOk === false ? 'danger' : 'info'}>
                      آخر مزامنة <span className="num">{relativeAr(draft.matchFeed.lastSyncAt)}</span>
                      {draft.matchFeed.lastSyncMessageAr
                        ? ` — ${draft.matchFeed.lastSyncMessageAr}`
                        : ''}
                      . المزامنة تنفّذ من شاشة المباريات.
                    </Notice>
                  ) : (
                    <Notice tone="warning">
                      ما صارت مزامنة بعد — روح لشاشة المباريات واضغط «مزامنة الآن».
                    </Notice>
                  )}
                </div>

                {/* --------------------------------------- app status --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="row row-gap-2">
                    <span className="chip-icon" style={{ width: 30, height: 30 }}>
                      <Settings size={15} />
                    </span>
                    <div className="col">
                      <h3>حالة التطبيق</h3>
                      <span className="fs-12 muted">وضع الصيانة يقفل التطبيق على الكل</span>
                    </div>
                  </div>

                  <Switch
                    checked={draft.maintenanceMode}
                    onChange={(next) => {
                      if (next) setConfirmMaintenance(true);
                      else patch('maintenanceMode', false);
                    }}
                    label="وضع الصيانة"
                  />

                  <Field label="رسالة الصيانة" hint="اللي يشوفها المشترك بدل شاشات التطبيق">
                    <TextArea
                      value={draft.maintenanceMessageAr}
                      onChange={(v) => patch('maintenanceMessageAr', v)}
                      rows={2}
                    />
                  </Field>
                </div>

                {/* ------------------------------------------ support --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="row row-gap-2">
                    <span className="chip-icon" style={{ width: 30, height: 30 }}>
                      <LifeBuoy size={15} />
                    </span>
                    <div className="col">
                      <h3>بيانات الدعم</h3>
                      <span className="fs-12 muted">الأرقام اللي يفتحها التطبيق من شاشة المساعدة</span>
                    </div>
                  </div>

                  <div className="grid grid-form">
                    <Field label="هاتف الدعم">
                      <TextInput
                        type="tel"
                        value={draft.supportPhone}
                        onChange={(v) => patch('supportPhone', v)}
                      />
                    </Field>
                    <Field label="واتساب الدعم">
                      <TextInput
                        type="tel"
                        value={draft.supportWhatsapp}
                        onChange={(v) => patch('supportWhatsapp', v)}
                      />
                    </Field>
                  </div>
                </div>

                {/* --------------------------------------- mock layer --- */}
                <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
                  <div className="col">
                    <h3>طبقة البيانات التجريبية</h3>
                    <span className="fs-12 muted">
                      تأخير مصطنع بكل قراءة حتى تظهر حالات التحميل — يروح مع الباك-إند الحقيقي
                    </span>
                  </div>

                  <div className="grid grid-form">
                    <Field label="أقل تأخير" hint="بالمللي ثانية">
                      <TextInput
                        type="number"
                        min={0}
                        max={5000}
                        value={draft.mockLatencyMs[0]}
                        onChange={(v) => patch('mockLatencyMs', [Number(v), draft.mockLatencyMs[1]])}
                      />
                    </Field>
                    <Field label="أعلى تأخير" hint="بالمللي ثانية">
                      <TextInput
                        type="number"
                        min={0}
                        max={5000}
                        value={draft.mockLatencyMs[1]}
                        onChange={(v) => patch('mockLatencyMs', [draft.mockLatencyMs[0], Number(v)])}
                      />
                    </Field>
                  </div>

                  <span className="fs-12 dim">
                    القراءة الوحدة تاخذ بين{' '}
                    <span className="num">{formatNumber(draft.mockLatencyMs[0])}</span> و{' '}
                    <span className="num">{formatNumber(draft.mockLatencyMs[1])}</span> مللي ثانية.
                  </span>
                </div>
              </div>
            )
          }
        </AsyncBlock>
      </div>

      {confirmMaintenance ? (
        <ConfirmDialog
          title="تشغيل وضع الصيانة"
          message="كل المشتركين راح ينقفل عليهم التطبيق ويشوفون رسالة الصيانة بس. ما راح يكدرون يجددون أو يتوقعون لحد ما تطفّيه."
          confirmLabel="شغّل الصيانة"
          danger
          onConfirm={() => {
            patch('maintenanceMode', true);
            setConfirmMaintenance(false);
          }}
          onCancel={() => setConfirmMaintenance(false)}
        />
      ) : null}
    </>
  );
}
