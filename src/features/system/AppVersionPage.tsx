/**
 * The app's update gate.
 *
 * The app reads this before sign-in and compares its own build number against
 * each platform's two thresholds: below `minBuild` it refuses to go further
 * until the user updates, below `latestBuild` it offers an update they may
 * skip. Both at zero means no prompt at all.
 *
 * The build number is the integer after `+` in the app's version
 * (`1.0.0+1` is build 1). Any `minBuild` above zero locks out every user on an
 * older build the moment it is saved, so every save that carries one asks
 * first. The server keeps one row and the
 * route is a `PUT`, so the form always sends both platforms whole.
 */

import { useState } from 'react';
import { Save, Smartphone } from 'lucide-react';
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
  Field,
  Notice,
  Pill,
  Skeleton,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { AppVersionConfig, PlatformVersion } from '@/types';

type Platform = 'android' | 'ios';

const PLATFORM_LABEL: Record<Platform, string> = { android: 'أندرويد', ios: 'iOS' };

/** The form edits text; numbers are parsed once, on save. */
interface PlatformDraft {
  minBuild: string;
  latestBuild: string;
  storeUrl: string;
}

function toDraft(version: PlatformVersion): PlatformDraft {
  return {
    minBuild: String(version.minBuild),
    latestBuild: String(version.latestBuild),
    storeUrl: version.storeUrl,
  };
}

/** A whole, non-negative build number, or null. */
function parseBuild(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function AppVersionPage() {
  const repos = useRepos();
  const state = useAsync(() => repos.appConfig.version(), []);

  return (
    <>
      <PageHeader title="تحديث التطبيق" subtitle="متى يطلب التطبيق من المشترك يحدّث، إجبارياً أو اختيارياً" />

      <div className="page">
        <AsyncBlock
          state={state}
          skeleton={
            <Card pad>
              <Skeleton h={18} w="40%" />
              <Skeleton h={120} className="mt-3" />
            </Card>
          }
        >
          {(config) => <VersionForm config={config} onSaved={state.setData} />}
        </AsyncBlock>
      </div>
    </>
  );
}

function VersionForm({
  config,
  onSaved,
}: {
  config: AppVersionConfig;
  onSaved: (next: AppVersionConfig) => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [platforms, setPlatforms] = useState<Record<Platform, PlatformDraft>>({
    android: toDraft(config.android),
    ios: toDraft(config.ios),
  });
  const [messageAr, setMessageAr] = useState(config.messageAr ?? '');
  const [messageKu, setMessageKu] = useState(config.messageKu ?? '');
  const [invalid, setInvalid] = useState<string | null>(null);
  /** The payload waiting on the operator's say-so when it raises a floor. */
  const [pending, setPending] = useState<AppVersionConfig | null>(null);

  const setPlatform = (platform: Platform, key: keyof PlatformDraft, value: string) =>
    setPlatforms((current) => ({ ...current, [platform]: { ...current[platform], [key]: value } }));

  /** Builds the payload, or explains why it cannot. */
  const build = (): AppVersionConfig | string => {
    const out = {} as Record<Platform, PlatformVersion>;
    for (const platform of ['android', 'ios'] as const) {
      const draft = platforms[platform];
      const label = PLATFORM_LABEL[platform];
      const minBuild = parseBuild(draft.minBuild);
      const latestBuild = parseBuild(draft.latestBuild);
      const storeUrl = draft.storeUrl.trim();
      if (minBuild === null || latestBuild === null) return `${label}: رقم البناء لازم يكون عدد صحيح من 0 وفوق`;
      if (minBuild > latestBuild) return `${label}: أقل بناء مسموح ما يصير أكبر من آخر بناء`;
      if (storeUrl && !/^https?:\/\//i.test(storeUrl)) return `${label}: رابط المتجر لازم يبدأ بـ http أو https`;
      if (latestBuild > 0 && !storeUrl) return `${label}: حط رابط المتجر قبل ما تفعّل التحديث`;
      out[platform] = { minBuild, latestBuild, storeUrl };
    }
    return {
      ...out,
      messageAr: messageAr.trim() || null,
      messageKu: messageKu.trim() || null,
    };
  };

  const send = async (payload: AppVersionConfig) => {
    const ok = await run(() => repos.appConfig.updateVersion(payload), onSaved);
    setPending(null);
    if (ok) toast('انحفظت إعدادات التحديث');
  };

  const save = () => {
    const payload = build();
    if (typeof payload === 'string') {
      setInvalid(payload);
      return;
    }
    setInvalid(null);
    const forces = (['android', 'ios'] as const).some((platform) => payload[platform].minBuild > 0);
    if (forces) setPending(payload);
    else void send(payload);
  };

  return (
    <>
      <Notice tone="info" icon={<Smartphone size={16} />}>
        <div className="col row-gap-1">
          <span>
            رقم البناء (build) هو الرقم اللي بعد علامة <span className="num">+</span> بإصدار التطبيق —
            مثلاً <span className="num">1.0.0+1</span> يعني بناء <span className="num">1</span>. التطبيق
            يقارن رقمه بهالأرقام قبل تسجيل الدخول:
          </span>
          <span>
            • إذا رقمه أقل من <strong>آخر بناء</strong>: تطلع له نافذة تحديث من الأسفل يكدر يسكّرها ويكمل.
          </span>
          <span>
            • إذا رقمه أقل من <strong>أقل بناء مسموح</strong>: التطبيق ينقفل بالكامل لحد ما يحدّث من
            المتجر.
          </span>
          <span>
            صفر بالاثنين يعني ماكو أي تحديث. رابط iOS يكدر يبقى فارغ لحد ما ينزل التطبيق على App Store.
          </span>
        </div>
      </Notice>

      <div className="grid grid-2">
        {(['android', 'ios'] as const).map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            draft={platforms[platform]}
            onChange={(key, value) => setPlatform(platform, key, value)}
          />
        ))}
      </div>

      <Card pad>
        <CardHead title="نص نافذة التحديث" subtitle="إذا تركته فارغ، التطبيق يعرض نصه الافتراضي" />
        <div className="grid grid-form mt-3">
          <Field label="بالعربي">
            <TextArea rows={3} value={messageAr} onChange={setMessageAr} placeholder="يرجى تحديث التطبيق للمتابعة" />
          </Field>
          <Field label="بالكردي (سوراني)">
            <TextArea rows={3} value={messageKu} onChange={setMessageKu} placeholder="تکایە ئەپلیکەیشنەکە نوێ بکەرەوە" />
          </Field>
        </div>
      </Card>

      {invalid || action.error ? <div className="field-error">{invalid ?? action.error}</div> : null}

      <div>
        <Button variant="primary" icon={<Save size={15} />} disabled={action.pending} onClick={save}>
          {action.pending ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
        </Button>
      </div>

      {pending ? (
        <ConfirmDialog
          title="تحديث إجباري"
          danger
          confirmLabel="احفظ"
          pending={action.pending}
          message={
            <>
              هذا الحفظ فيه تحديث إجباري: كل مشترك عنده نسخة أقدم ({floorSummary(pending)}) راح ينقفل عليه
              التطبيق بالكامل لحد ما يحدّث من المتجر. تأكد إن النسخة الجديدة منشورة بالمتجر قبل ما تحفظ.
            </>
          }
          onConfirm={() => void send(pending)}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </>
  );
}

/** "أندرويد تحت 7، iOS تحت 5" — only the platforms that force an update. */
function floorSummary(next: AppVersionConfig): string {
  return (['android', 'ios'] as const)
    .filter((platform) => next[platform].minBuild > 0)
    .map((platform) => `${PLATFORM_LABEL[platform]} تحت ${next[platform].minBuild}`)
    .join('، ');
}

function PlatformCard({
  platform,
  draft,
  onChange,
}: {
  platform: Platform;
  draft: PlatformDraft;
  onChange: (key: keyof PlatformDraft, value: string) => void;
}) {
  const minBuild = parseBuild(draft.minBuild);
  const latestBuild = parseBuild(draft.latestBuild);

  const status =
    minBuild === null || latestBuild === null ? null : minBuild > 0 ? (
      <Pill tone="danger">إجباري تحت {minBuild}</Pill>
    ) : latestBuild > 0 ? (
      <Pill tone="warning">اختياري تحت {latestBuild}</Pill>
    ) : (
      <Pill tone="muted">ماكو تحديث</Pill>
    );

  return (
    <Card pad>
      <CardHead title={PLATFORM_LABEL[platform]} actions={status} />
      <div className="grid grid-form mt-3">
        <Field label="أقل بناء مسموح" hint="أقل من هذا = تحديث إجباري">
          <TextInput type="number" min={0} step={1} value={draft.minBuild} onChange={(v) => onChange('minBuild', v)} />
        </Field>
        <Field label="آخر بناء" hint="أقل من هذا = تحديث اختياري">
          <TextInput
            type="number"
            min={0}
            step={1}
            value={draft.latestBuild}
            onChange={(v) => onChange('latestBuild', v)}
          />
        </Field>
        <Field label="رابط المتجر" className="span-2">
          <TextInput type="url" value={draft.storeUrl} onChange={(v) => onChange('storeUrl', v)} />
        </Field>
      </div>
    </Card>
  );
}
