/**
 * The home-screen banners.
 *
 * A banner is an image plus what tapping it does: nothing, an external URL, or
 * a named screen inside the app. The action value means something different in
 * each case, so the field relabels itself rather than staying a generic box.
 *
 * The image is picked here and travels with the save: `/ads` takes the file
 * itself and has no field for a link, so there is no upload step to do first.
 *
 * `provinceId` is the targeting: null shows the banner to everyone, a province
 * shows it only there. The app resolves this per user, so a targeted banner
 * never reaches the wrong province.
 */

import { useState } from 'react';
import { Field, KeyValue, Modal, Pill, Select, Switch, TextInput } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { Ad, AdAction, Id } from '@/types';
import type { AdInput } from '@/data/repositories/types';
import { AD_ACTION } from '@/lib/labels';
import { mediaUrl, mediaCrossOrigin } from '@/lib/media';
import { CrudScreen } from '../shared/CrudScreen';
import { ImagePicker } from '../shared/ImagePicker';

/** What `actionValue` holds, which depends entirely on `actionType`. */
const ACTION_HINT: Record<AdAction, string | undefined> = {
  none: undefined,
  url: 'الرابط اللي يفتح بالمتصفح — لازم يبدي بـ https://',
  screen: 'الشاشة اللي تنفتح بالتطبيق لما المشترك يضغط السلايد',
};

/**
 * The screens a banner can open, keyed as the app routes them.
 *
 * This is the app's own list (`AppRoutes.deepLinkable` in the Flutter app),
 * not a suggestion: the app ignores any other value and the tap does nothing,
 * so the target is picked here rather than typed. The labels are the titles
 * the subscriber sees on each screen. A screen added to the app has to be
 * added here too.
 */
const APP_SCREENS: { value: string; label: string }[] = [
  { value: 'home', label: 'الرئيسية' },
  { value: 'renew', label: 'تجديد الاشتراك' },
  { value: 'offers', label: 'العروض' },
  { value: 'matches', label: 'المباريات' },
  { value: 'predict', label: 'توقع واربح' },
  { value: 'draws', label: 'جدد واربح' },
  { value: 'account', label: 'حسابي' },
  { value: 'tower', label: 'اتجاه البرج' },
  { value: 'videos', label: 'مقاطع فيديو تعليمية' },
  { value: 'faq', label: 'الأسئلة الشائعة' },
  { value: 'notifications', label: 'الإشعارات' },
];

/** The Arabic name of a screen target, or null when the app has no such screen. */
function screenName(value: string | null | undefined): string | null {
  const key = (value ?? '').trim().toLowerCase().split('/').find(Boolean) ?? '';
  return APP_SCREENS.find((screen) => screen.value === key)?.label ?? null;
}

/** A target as an operator reads it: the screen's name, or the raw value. */
function targetLabel(ad: Pick<Ad, 'actionType' | 'actionValue'>): string | null {
  if (!ad.actionValue) return null;
  if (ad.actionType !== 'screen') return ad.actionValue;
  return screenName(ad.actionValue) ?? `${ad.actionValue} (ما موجودة بالتطبيق)`;
}

export function SlidesPage() {
  const repos = useRepos();
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const provinceOptions = (provinces.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  // The table thumbnail is too small to judge a banner, so a click opens it
  // full size. Kept here rather than inside the cell so only one is ever open.
  const [preview, setPreview] = useState<Ad | null>(null);

  return (
    <CrudScreen<Ad, AdInput>
      title="سلايدر الرئيسية"
      subtitle="الإعلانات المتحركة بأعلى الشاشة الرئيسية — عامة أو موجّهة لمحافظة"
      repo={repos.content.ads}
      searchable
      createLabel="إضافة إعلان"
      createTitle="إضافة إعلان"
      editTitle="تعديل الإعلان"
      dialogSize="lg"
      rowKey={(row) => row.id}
      labelOf={(row) => row.title}
      columns={[
        {
          key: 'order',
          header: 'الترتيب',
          numeric: true,
          width: 80,
          render: (row) => <span className="num">{row.order}</span>,
        },
        {
          key: 'image',
          header: 'الصورة',
          width: 92,
          render: (row) => (
            <button className="thumb-button" title={row.title} onClick={() => setPreview(row)}>
              <img
                className="thumb"
                src={mediaUrl(row.imageUrl)}
                crossOrigin={mediaCrossOrigin(mediaUrl(row.imageUrl))}
                alt=""
                loading="lazy"
              />
            </button>
          ),
        },
        {
          key: 'title',
          header: 'العنوان',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.title}</span>
              <span className="fs-small dim">{row.titleKu || '—'}</span>
            </div>
          ),
        },
        {
          key: 'action',
          header: 'عند الضغط',
          render: (row) => (
            <div className="col">
              <span className="fs-small">{AD_ACTION[row.actionType]}</span>
              {row.actionValue ? (
                <span className="fs-tiny dim truncate">{targetLabel(row)}</span>
              ) : null}
            </div>
          ),
        },
        {
          key: 'target',
          header: 'الاستهداف',
          render: (row) =>
            row.provinceId ? (
              <Pill tone="neutral">{row.province?.name ?? 'محافظة'}</Pill>
            ) : (
              <Pill tone="muted">كل المحافظات</Pill>
            ),
        },
        {
          key: 'active',
          header: 'الحالة',
          width: 96,
          render: (row) =>
            row.isActive ? <Pill tone="success">ظاهر</Pill> : <Pill tone="muted">مخفي</Pill>,
        },
      ]}
      blank={() => ({
        title: '',
        titleKu: '',
        image: null,
        imageUrl: '',
        actionType: 'none',
        actionValue: '',
        order: 0,
        isActive: true,
        provinceId: null,
      })}
      toInput={(row) => ({
        title: row.title,
        titleKu: row.titleKu,
        // No file yet: an edit that does not touch the picture leaves the one
        // on the server alone.
        image: null,
        imageUrl: mediaUrl(row.imageUrl),
        actionType: row.actionType,
        actionValue: row.actionValue ?? '',
        order: row.order,
        isActive: row.isActive,
        provinceId: row.provinceId,
      })}
      validate={(draft) =>
        !draft.title.trim()
          ? 'عنوان الإعلان مطلوب'
          : !draft.image && !draft.imageUrl.trim()
            ? 'صورة السلايد مطلوبة'
            : draft.actionType !== 'none' && !draft.actionValue?.trim()
              ? 'حدّد وجهة الضغط'
              : draft.actionType === 'screen' && !screenName(draft.actionValue)
                ? 'اختر شاشة من القائمة — التطبيق ما يعرف غيرها'
                : draft.actionType === 'url' && !/^https?:\/\//i.test(draft.actionValue?.trim() ?? '')
                  ? 'الرابط لازم يبدي بـ https://'
                  : null
      }
      form={(draft, set) => (
        <>
          <Field label="العنوان بالعربي">
            <TextInput value={draft.title} onChange={(next) => set('title', next)} />
          </Field>
          <Field label="العنوان بالكردي">
            <TextInput value={draft.titleKu} onChange={(next) => set('titleKu', next)} />
          </Field>

          <ImagePicker
            label="صورة السلايد"
            className="span-2"
            file={draft.image}
            currentUrl={draft.imageUrl}
            onPick={(next) => set('image', next)}
          />

          <Field label="عند الضغط">
            <Select<AdAction>
              value={draft.actionType ?? 'none'}
              onChange={(next) => {
                // A link and a screen name are different things; carrying one
                // into the other type only leaves a value the app ignores.
                if (next !== draft.actionType) set('actionValue', '');
                set('actionType', next);
              }}
              options={(Object.keys(AD_ACTION) as AdAction[]).map((value) => ({
                value,
                label: AD_ACTION[value],
              }))}
            />
          </Field>
          <Field label="وجهة الضغط" hint={ACTION_HINT[draft.actionType ?? 'none']}>
            {draft.actionType === 'screen' ? (
              <Select<string>
                value={draft.actionValue ?? ''}
                onChange={(next) => set('actionValue', next)}
                options={[
                  { value: '', label: 'اختر الشاشة' },
                  // An older banner may hold a value typed before this list
                  // existed; it is shown as what it is, not silently dropped.
                  ...(draft.actionValue && !screenName(draft.actionValue)
                    ? [{ value: draft.actionValue, label: `${draft.actionValue} (ما موجودة بالتطبيق)` }]
                    : []),
                  ...APP_SCREENS,
                ]}
              />
            ) : (
              <TextInput
                value={draft.actionValue ?? ''}
                onChange={(next) => set('actionValue', next)}
                placeholder={draft.actionType === 'url' ? 'https://' : undefined}
                disabled={(draft.actionType ?? 'none') === 'none'}
              />
            )}
          </Field>

          <Field label="الاستهداف" hint="خلّيها فارغة حتى يوصل كل المحافظات">
            <Select<Id>
              value={draft.provinceId ?? ''}
              onChange={(next) => set('provinceId', next || null)}
              options={[{ value: '', label: 'كل المحافظات' }, ...provinceOptions]}
            />
          </Field>
          <Field label="الترتيب" hint="الأصغر يظهر أول">
            <TextInput
              type="number"
              value={draft.order ?? 0}
              onChange={(next) => set('order', Number(next) || 0)}
            />
          </Field>
          <Field label="الظهور">
            <Switch
              checked={draft.isActive ?? true}
              onChange={(next) => set('isActive', next)}
              label="ظاهر بالتطبيق"
            />
          </Field>
        </>
      )}
    >
      {preview ? (
        <Modal title={preview.title} size="lg" onClose={() => setPreview(null)}>
          <img
            className="image-preview"
            src={mediaUrl(preview.imageUrl)}
            crossOrigin={mediaCrossOrigin(mediaUrl(preview.imageUrl))}
            alt={preview.title}
          />
          <div className="mt-3">
            <KeyValue
              rows={[
                ['العنوان بالكردي', preview.titleKu || '—'],
                ['عند الضغط', AD_ACTION[preview.actionType]],
                ['الوجهة', targetLabel(preview) ?? '—'],
                [
                  'الاستهداف',
                  preview.provinceId ? (preview.province?.name ?? 'محافظة') : 'كل المحافظات',
                ],
              ]}
            />
          </div>
        </Modal>
      ) : null}
    </CrudScreen>
  );
}
