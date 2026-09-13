/**
 * The two upstreams this console depends on.
 *
 * **سيرفرات سلفرسات** are the vendor endpoints that actually activate codes —
 * one per region, each with its own credentials. A product points at one, so a
 * region that stops answering takes a whole province's activations down with
 * it. That is why the health check is on this screen and not buried in a menu.
 *
 * **مزوّد المباريات** is API-Football, where every league, team and fixture
 * comes from. Its quota is the thing worth watching: a sync that runs out of
 * requests half way leaves a partial table, so the counters are shown before
 * the buttons that spend them.
 *
 * Credentials are write-only in practice — the API returns them on the admin
 * list, but the form never displays a stored password back.
 */

import { useState } from 'react';
import { Activity, PlugZap, RefreshCw } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  Field,
  KeyValue,
  Modal,
  Notice,
  Pill,
  Switch,
  Tabs,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatNumber } from '@/lib/format';
import type { Id, RegionCheckResult, SilversatRegion } from '@/types';
import type { RegionInput } from '@/data/repositories/types';

export function ApiPage() {
  const [tab, setTab] = useState<'regions' | 'football'>('regions');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'regions', label: 'سيرفرات سلفرسات' },
            { value: 'football', label: 'مزوّد المباريات' },
          ]}
        />
      </div>
      {tab === 'regions' ? <RegionsTab /> : <FootballTab />}
    </>
  );
}

// --------------------------------------------------------------- regions ---

function RegionsTab() {
  const repos = useRepos();
  const { toast } = useToast();

  const regions = useAsync(() => repos.regions.all(), []);
  const [health, setHealth] = useState<Record<Id, RegionCheckResult>>({});
  const [checking, setChecking] = useState<Id | 'all' | null>(null);
  const [editing, setEditing] = useState<{ region: SilversatRegion | null } | null>(null);

  const checkOne = async (region: SilversatRegion) => {
    setChecking(region.id);
    try {
      const result = await repos.regions.check(region.id);
      setHealth((current) => ({ ...current, [region.id]: { ...result, name: region.name } }));
      toast(result.ok ? `${region.name}: يرد` : `${region.name}: ما يرد`, result.ok ? 'success' : 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الفحص', 'error');
    } finally {
      setChecking(null);
    }
  };

  /**
   * Checks every region at once.
   *
   * `check-all` answers positionally — the rows come back in the order of the
   * regions list without ids — so the results are zipped back onto that same
   * list rather than looked up by id.
   */
  const checkAll = async () => {
    setChecking('all');
    try {
      const results = await repos.regions.checkAll();
      const rows = regions.data ?? [];
      const next: Record<Id, RegionCheckResult> = {};
      results.forEach((result, index) => {
        const region = rows[index];
        if (region) next[region.id] = { ...result, id: region.id, name: region.name };
      });
      setHealth(next);
      const down = results.filter((result) => !result.ok).length;
      toast(down === 0 ? 'كل السيرفرات ترد' : `${down} سيرفر ما يرد`, down === 0 ? 'success' : 'error');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الفحص', 'error');
    } finally {
      setChecking(null);
    }
  };

  return (
    <>
      <PageHeader
        title="سيرفرات سلفرسات"
        subtitle="السيرفر اللي يفعّل كارتات كل منتج — وبياناته السرّية"
        actions={
          <>
            <Button
              variant="outline"
              icon={<Activity size={15} />}
              disabled={checking !== null}
              onClick={() => void checkAll()}
            >
              {checking === 'all' ? 'جاري الفحص…' : 'فحص الكل'}
            </Button>
            <Button variant="primary" onClick={() => setEditing({ region: null })}>
              إضافة سيرفر
            </Button>
          </>
        }
      />

      <div className="page">
        <Notice tone="warning">
          تغيير بيانات سيرفر يأثر فوراً على تفعيل كل الكارتات اللي منتجاتها مربوطة بيه. افحص بعد أي
          تعديل.
        </Notice>

        <AsyncBlock state={regions}>
          {(rows) => (
            <div className="grid grid-2">
              {rows.map((region) => {
                const result = health[region.id];
                return (
                  <Card key={region.id} pad>
                    <CardHead
                      title={region.name}
                      subtitle={region.baseUrl ?? '—'}
                      actions={
                        region.isActive ? (
                          <Pill tone="success">فعّال</Pill>
                        ) : (
                          <Pill tone="muted">متوقف</Pill>
                        )
                      }
                    />

                    <div className="mt-3">
                      <KeyValue
                        rows={[
                          ['المستخدم', region.userId ?? '—'],
                          ['معرّف الجهاز', region.appDeviceId ?? '—'],
                          [
                            'آخر فحص',
                            result ? (
                              <span className="row row-gap-2">
                                <Pill tone={result.ok ? 'success' : 'danger'}>
                                  {result.ok ? 'يرد' : 'ما يرد'}
                                </Pill>
                                {result.latencyMs !== undefined ? (
                                  <span className="num dim">{result.latencyMs}ms</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="dim">ما انفحص بهذه الجلسة</span>
                            ),
                          ],
                        ]}
                      />
                    </div>

                    {result && !result.ok && result.message ? (
                      <div className="mt-3">
                        <Notice tone="danger">{result.message}</Notice>
                      </div>
                    ) : null}

                    <div className="row row-gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<PlugZap size={14} />}
                        disabled={checking !== null}
                        onClick={() => void checkOne(region)}
                      >
                        {checking === region.id ? 'جاري…' : 'فحص'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ region })}>
                        تعديل
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </AsyncBlock>
      </div>

      {editing ? (
        <RegionDialog
          region={editing.region}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            regions.reload();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Adding or editing a region.
 *
 * The password field starts empty even when editing, and an empty password on
 * an edit is simply not sent — so saving a name change never blanks the
 * credential that a whole province's activations run through.
 */
function RegionDialog({
  region,
  onClose,
  onSaved,
}: {
  region: SilversatRegion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const [draft, setDraft] = useState<RegionInput>({
    name: region?.name ?? '',
    baseUrl: region?.baseUrl ?? '',
    authKey: region?.authKey ?? '',
    userId: region?.userId ?? '',
    password: '',
    appDeviceId: region?.appDeviceId ?? '',
    isActive: region?.isActive ?? true,
  });
  const set = <K extends keyof RegionInput>(key: K, value: RegionInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const problem = !draft.name.trim()
      ? 'اسم السيرفر مطلوب'
      : !draft.baseUrl.trim()
        ? 'عنوان السيرفر مطلوب'
        : !region && !draft.password.trim()
          ? 'كلمة المرور مطلوبة للسيرفر الجديد'
          : null;
    setInvalid(problem);
    if (problem) return;

    const ok = await run(() => {
      if (!region) return repos.regions.create(draft);
      const { password, ...rest } = draft;
      return repos.regions.update(region.id, password.trim() ? draft : rest);
    });
    if (!ok) return;
    toast(region ? 'انحفظ السيرفر' : 'انضاف السيرفر');
    onSaved();
  };

  return (
    <Modal
      title={region ? `تعديل ${region.name}` : 'إضافة سيرفر'}
      size="lg"
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
      <div className="grid grid-form">
        <Field label="اسم السيرفر">
          <TextInput value={draft.name} onChange={(next) => set('name', next)} />
        </Field>
        <Field label="العنوان (Base URL)">
          <TextInput
            type="url"
            value={draft.baseUrl}
            onChange={(next) => set('baseUrl', next)}
            placeholder="https://…"
          />
        </Field>
        <Field label="مفتاح المصادقة (Auth Key)">
          <TextInput value={draft.authKey} onChange={(next) => set('authKey', next)} />
        </Field>
        <Field label="المستخدم">
          <TextInput value={draft.userId} onChange={(next) => set('userId', next)} />
        </Field>
        <Field
          label="كلمة المرور"
          hint={region ? 'اتركها فارغة إذا ما تريد تغيّرها' : undefined}
        >
          <TextInput
            type="password"
            value={draft.password}
            onChange={(next) => set('password', next)}
          />
        </Field>
        <Field label="معرّف الجهاز" hint="اختياري">
          <TextInput
            value={draft.appDeviceId ?? ''}
            onChange={(next) => set('appDeviceId', next)}
          />
        </Field>
        <Field label="التفعيل">
          <Switch
            checked={draft.isActive ?? true}
            onChange={(next) => set('isActive', next)}
            label="فعّال"
          />
        </Field>
      </div>

      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

// -------------------------------------------------------------- football ---

function FootballTab() {
  const repos = useRepos();
  const { toast } = useToast();

  const config = useAsync(() => repos.sync.config(), []);
  const status = useAsync(() => repos.sync.status(), []);
  const [running, setRunning] = useState<string | null>(null);

  const run = async (label: string, job: () => Promise<{ created?: number; updated?: number }>) => {
    setRunning(label);
    try {
      const result = await job();
      const created = result.created ?? 0;
      const updated = result.updated ?? 0;
      toast(
        created + updated > 0
          ? `${label}: ${created} جديد، ${updated} محدّث`
          : `${label}: ما بيها جديد`,
      );
      status.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّرت المزامنة', 'error');
    } finally {
      setRunning(null);
    }
  };

  const requests = status.data?.requests;

  return (
    <>
      <PageHeader
        title="مزوّد المباريات"
        subtitle="API-Football — منه تجي الدوريات والفرق والمباريات"
      />

      <div className="page">
        <AsyncBlock state={config}>
          {(data) => (
            <>
              {!data.enabled || !data.hasApiKey ? (
                <Notice tone="danger">
                  المزوّد {data.enabled ? 'مفعّل' : 'مطفي'} و
                  {data.hasApiKey ? 'المفتاح موجود' : 'ماكو مفتاح API'} — المزامنة ما راح تشتغل لحد
                  ما ينضبط من إعدادات السيرفر.
                </Notice>
              ) : null}

              <div className="grid grid-kpi">
                <StatTile label="الموسم" value={String(data.season)} />
                <StatTile
                  label="طلبات اليوم"
                  value={
                    requests?.current !== undefined
                      ? `${formatNumber(requests.current)} / ${formatNumber(requests.limit_day ?? 0)}`
                      : '—'
                  }
                />
                <StatTile
                  label="نافذة المباريات"
                  value={`${data.fixtureDaysBack}− / ${data.fixtureDaysAhead}+ يوم`}
                />
                <StatTile
                  label="الدوريات المزامَنة"
                  value={data.syncAllIfQuotaAllows ? 'الكل (حسب الحصة)' : formatNumber(data.leagueIds.length)}
                />
              </div>

              <Card pad>
                <CardHead
                  title="تشغيل المزامنة"
                  subtitle="كل زر يصرف من حصة الطلبات — شغّل اللي تحتاجه بس"
                />

                <div className="row row-gap-2 wrap mt-3">
                  <Button
                    variant="outline"
                    icon={<RefreshCw size={15} />}
                    disabled={running !== null}
                    onClick={() => void run('الدوريات', () => repos.sync.syncLeagues())}
                  >
                    {running === 'الدوريات' ? 'جاري…' : 'مزامنة الدوريات'}
                  </Button>
                  <Button
                    variant="outline"
                    icon={<RefreshCw size={15} />}
                    disabled={running !== null}
                    onClick={() => void run('الفرق', () => repos.sync.syncTeams())}
                  >
                    {running === 'الفرق' ? 'جاري…' : 'مزامنة الفرق'}
                  </Button>
                  <Button
                    variant="primary"
                    icon={<RefreshCw size={15} />}
                    disabled={running !== null}
                    onClick={() => void run('المباريات', () => repos.sync.syncFixtures())}
                  >
                    {running === 'المباريات' ? 'جاري…' : 'مزامنة المباريات'}
                  </Button>
                  <Button
                    variant="subtle"
                    icon={<RefreshCw size={15} />}
                    disabled={running !== null}
                    onClick={() => void run('المباشر', () => repos.sync.syncLive())}
                  >
                    {running === 'المباشر' ? 'جاري…' : 'تحديث المباشر'}
                  </Button>
                </div>

                <div className="mt-4">
                  <KeyValue
                    rows={[
                      ['عنوان المزوّد', <code className="num">{data.baseUrl}</code>],
                      ['مفتاح API', data.hasApiKey ? 'مضبوط' : 'ماكو'],
                      ['احتياطي الحصة', <span className="num">{data.quotaReserve}</span>],
                      [
                        'أقصى طلبات بالدقيقة',
                        <span className="num">{data.maxRequestsPerMinute}</span>,
                      ],
                    ]}
                  />
                </div>
              </Card>
            </>
          )}
        </AsyncBlock>
      </div>
    </>
  );
}
