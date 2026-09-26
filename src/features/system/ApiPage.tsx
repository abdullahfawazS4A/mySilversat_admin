/**
 * The two upstreams this console depends on.
 *
 * **سيرفرات سلفرسات** are the vendor endpoints that actually activate codes —
 * one per region, each with its own credentials. Products and subscribers
 * each point at one, and the region's province is theirs — so a region that
 * stops answering takes its products' activations down with it, and a region
 * with no province drops everything on it out of every province view. That is
 * why the health check and the province are on this screen.
 *
 * **مزوّد المباريات** is API-Football, where every league, team and fixture
 * comes from. Its quota is the thing worth watching: a sync that runs out of
 * requests half way leaves a partial table, so the counters are shown before
 * the buttons that spend them.
 *
 * Each server's card shows the vendor account it signs in with, as the API
 * returns it — the password behind a reveal so it is not on screen by default.
 * The edit form still leaves stored values out of its boxes: an empty box
 * there means "keep it", which is why they are not seeded.
 */

import { useMemo, useState } from 'react';
import { Activity, Copy, Eye, EyeOff, PlugZap, RefreshCw } from 'lucide-react';
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
  Select,
  Switch,
  Tabs,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import { formatNumber } from '@/lib/format';
import type { Id, Province, RegionCheckResult, SilversatRegion } from '@/types';
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
  // Only to name the binding a server carries. The picker in the dialog and
  // the row on the card both read from this one list.
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const provinceName = (id: Id | null | undefined) =>
    id ? ((provinces.data ?? []).find((row) => row.id === id)?.name ?? id) : null;
  // The list leaves the address out; the copy embedded under a product has it.
  const products = useAsync(() => repos.catalog.products.all(), []);
  const embedded = useMemo(() => {
    const map = new Map<Id, SilversatRegion>();
    for (const product of products.data ?? []) {
      if (product.silversatRegion) map.set(product.silversatRegion.id, product.silversatRegion);
    }
    return map;
  }, [products.data]);
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
   * Every row names the region it is about, and the rows arrive in whatever
   * order the checks finished — so they are keyed by that id. A row for a
   * region this screen has not loaded is kept rather than dropped; it simply
   * has no card to land on yet.
   */
  const checkAll = async () => {
    setChecking('all');
    try {
      const results = await repos.regions.checkAll();
      const next: Record<Id, RegionCheckResult> = {};
      for (const result of results) next[result.id] = result;
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
                const known = embedded.get(region.id);
                const baseUrl = result?.baseUrl ?? known?.baseUrl;
                const appDeviceId = region.appDeviceId || known?.appDeviceId;
                return (
                  <Card key={region.id} pad>
                    <CardHead
                      title={region.name}
                      subtitle={baseUrl ?? 'العنوان يطلع بعد الفحص'}
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
                          [
                            'المحافظة',
                            provinceName(region.provinceId) ?? (
                              <span className="dim">بلا ربط</span>
                            ),
                          ],
                          [
                            'المستخدم',
                            region.userId ? (
                              <Secret value={region.userId} plain />
                            ) : (
                              <span className="dim">—</span>
                            ),
                          ],
                          [
                            'كلمة المرور',
                            region.password ? (
                              <Secret value={region.password} />
                            ) : (
                              <span className="dim">—</span>
                            ),
                          ],
                          ...(appDeviceId
                            ? [['معرّف الجهاز', <Secret value={appDeviceId} plain />] as [string, JSX.Element]]
                            : []),
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
          provinces={provinces.data ?? []}
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
 * One stored credential, with copy — and for a password, hidden until asked.
 *
 * Hidden by default because this screen gets shown and screenshotted; one
 * click reveals it, and copying works either way.
 */
function Secret({ value, plain = false }: { value: string; plain?: boolean }) {
  const { toast } = useToast();
  const [shown, setShown] = useState(plain);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast('انتسخ');
    } catch {
      toast('تعذّر النسخ', 'error');
    }
  };

  return (
    <span className="row row-gap-1">
      <code className="num" dir="ltr">
        {shown ? value : '•'.repeat(Math.min(value.length, 12))}
      </code>
      {plain ? null : (
        <Button
          variant="ghost"
          size="sm"
          icon={shown ? <EyeOff size={13} /> : <Eye size={13} />}
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? 'إخفاء' : 'إظهار'}
        />
      )}
      <Button
        variant="ghost"
        size="sm"
        icon={<Copy size={13} />}
        onClick={() => void copy()}
        aria-label="نسخ"
      />
    </span>
  );
}

/** What an empty credential box means on an edit — it is every box. */
const KEEP_HINT = 'محفوظة بالسيرفر — اتركها فارغة إذا ما تريد تغيّرها';

/**
 * Adding or editing a region.
 *
 * Every credential is write-only upstream, so an edit opens with all five
 * boxes empty — not because the server has none, but because the API will not
 * say what they are. That makes an empty box mean **leave it alone**, and an
 * edit sends only the boxes that were actually typed in.
 *
 * Getting that wrong is expensive and quiet: the form used to seed `baseUrl`,
 * `authKey` and `userId` from a region that never carries them, require a
 * `baseUrl` it could not show, and then send the other two as empty strings —
 * so renaming a server blanked the credentials a whole province activates
 * through, and the screen looked no different afterwards.
 *
 * The province picker is what the mobile app resolves a receiver against:
 * `POST /devices` sends no region, so the API looks for the server that names
 * the user's province. Leaving it empty is not a blank field, it is that
 * province's users being unable to add a device — which is invisible from the
 * product side, where everything looks correctly routed.
 *
 * Activations are the other path and still follow the product's server. The
 * two are meant to name the same one.
 */
function RegionDialog({
  region,
  provinces,
  onClose,
  onSaved,
}: {
  region: SilversatRegion | null;
  provinces: Province[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const [draft, setDraft] = useState<RegionInput>({
    name: region?.name ?? '',
    baseUrl: '',
    authKey: '',
    userId: '',
    password: '',
    appDeviceId: '',
    isActive: region?.isActive ?? true,
    provinceId: region?.provinceId ?? null,
  });
  const set = <K extends keyof RegionInput>(key: K, value: RegionInput[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    // A new server needs every credential; an edit needs none of them, because
    // leaving one alone is the normal case and the only way to express it.
    const missing = !draft.name.trim()
      ? 'اسم السيرفر مطلوب'
      : region
        ? null
        : !draft.baseUrl.trim()
          ? 'عنوان السيرفر مطلوب'
          : !draft.authKey.trim()
            ? 'مفتاح المصادقة مطلوب'
            : !draft.userId.trim()
              ? 'المستخدم مطلوب'
              : !draft.password.trim()
                ? 'كلمة المرور مطلوبة للسيرفر الجديد'
                : null;
    setInvalid(missing);
    if (missing) return;

    const ok = await run(() => {
      if (!region) return repos.regions.create(draft);

      const patch: Partial<RegionInput> = {
        name: draft.name.trim(),
        isActive: draft.isActive,
        provinceId: draft.provinceId ?? null,
      };
      if (draft.baseUrl.trim()) patch.baseUrl = draft.baseUrl.trim();
      if (draft.authKey.trim()) patch.authKey = draft.authKey.trim();
      if (draft.userId.trim()) patch.userId = draft.userId.trim();
      if (draft.password.trim()) patch.password = draft.password.trim();
      if (draft.appDeviceId?.trim()) patch.appDeviceId = draft.appDeviceId.trim();

      return repos.regions.update(region.id, patch);
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
        <Field label="العنوان (Base URL)" hint={region ? KEEP_HINT : undefined}>
          <TextInput
            type="url"
            value={draft.baseUrl}
            onChange={(next) => set('baseUrl', next)}
            placeholder="https://…"
          />
        </Field>
        <Field label="مفتاح المصادقة (Auth Key)" hint={region ? KEEP_HINT : undefined}>
          <TextInput value={draft.authKey} onChange={(next) => set('authKey', next)} />
        </Field>
        <Field label="المستخدم" hint={region ? KEEP_HINT : undefined}>
          <TextInput value={draft.userId} onChange={(next) => set('userId', next)} />
        </Field>
        <Field label="كلمة المرور" hint={region ? KEEP_HINT : undefined}>
          <TextInput
            type="password"
            value={draft.password}
            onChange={(next) => set('password', next)}
          />
        </Field>
        <Field label="معرّف الجهاز" hint={region ? KEEP_HINT : 'اختياري'}>
          <TextInput
            value={draft.appDeviceId ?? ''}
            onChange={(next) => set('appDeviceId', next)}
          />
        </Field>
        <Field
          label="المحافظة"
          hint="منتجات ومشتركين هذا السيرفر يُحسبون على هذي المحافظة — سيرفر بلا محافظة ما يطلع تحت أي محافظة"
        >
          <Select
            value={draft.provinceId ?? ''}
            onChange={(next) => set('provinceId', next || null)}
            options={[
              { value: '', label: 'بلا ربط' },
              ...provinces.map((row) => ({ value: row.id, label: row.name })),
            ]}
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
