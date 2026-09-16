/**
 * The home-screen banners.
 *
 * A banner is an image plus what tapping it does: nothing, an external URL, or
 * a named screen inside the app. The action value means something different in
 * each case, so the field relabels itself rather than staying a generic box.
 *
 * The image is picked and uploaded here rather than pasted as a link; what is
 * stored is still the URL that comes back, so nothing downstream changed.
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
import { mediaUrl } from '@/lib/media';
import { CrudScreen } from '../shared/CrudScreen';
import { ImagePicker } from '../shared/ImagePicker';

/** What `actionValue` holds, which depends entirely on `actionType`. */
const ACTION_HINT: Record<AdAction, string | undefined> = {
  none: undefined,
  url: 'الرابط اللي يفتح بالمتصفح',
  screen: 'اسم الشاشة داخل التطبيق، مثل predictions',
};

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
              <img className="thumb" src={mediaUrl(row.imageUrl)} alt="" loading="lazy" />
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
                <span className="fs-tiny dim num truncate">{row.actionValue}</span>
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
        image: '',
        actionType: 'none',
        actionValue: '',
        order: 0,
        isActive: true,
        provinceId: null,
      })}
      toInput={(row) => ({
        title: row.title,
        titleKu: row.titleKu,
        image: mediaUrl(row.imageUrl),
        actionType: row.actionType,
        actionValue: row.actionValue ?? '',
        order: row.order,
        isActive: row.isActive,
        provinceId: row.provinceId,
      })}
      validate={(draft) =>
        !draft.title.trim()
          ? 'عنوان الإعلان مطلوب'
          : !draft.image.trim()
            ? 'صورة السلايد مطلوبة'
            : draft.actionType !== 'none' && !draft.actionValue?.trim()
              ? 'حدّد وجهة الضغط'
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
            value={draft.image}
            onChange={(next) => set('image', next)}
          />

          <Field label="عند الضغط">
            <Select<AdAction>
              value={draft.actionType ?? 'none'}
              onChange={(next) => set('actionType', next)}
              options={(Object.keys(AD_ACTION) as AdAction[]).map((value) => ({
                value,
                label: AD_ACTION[value],
              }))}
            />
          </Field>
          <Field label="وجهة الضغط" hint={ACTION_HINT[draft.actionType ?? 'none']}>
            <TextInput
              value={draft.actionValue ?? ''}
              onChange={(next) => set('actionValue', next)}
              disabled={(draft.actionType ?? 'none') === 'none'}
            />
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
          <img className="image-preview" src={mediaUrl(preview.imageUrl)} alt={preview.title} />
          <div className="mt-3">
            <KeyValue
              rows={[
                ['العنوان بالكردي', preview.titleKu || '—'],
                ['عند الضغط', AD_ACTION[preview.actionType]],
                ['الوجهة', preview.actionValue ?? '—'],
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
