/**
 * Tutorial videos shown inside the app.
 *
 * The duration is stored rather than probed: the app renders the badge on the
 * thumbnail before the video is ever fetched, so it has to come from the
 * record. It is entered in seconds because that is what the API stores —
 * the table shows it back as m:ss so a typo is visible.
 */

import { Pill } from '@/components/ui';
import { Field, Switch, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import type { TutorialVideo } from '@/types';
import type { VideoInput } from '@/data/repositories/types';
import { CrudScreen } from '../shared/CrudScreen';

/** Seconds as `m:ss`, the way the app badges a thumbnail. */
function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function VideosPage() {
  const repos = useRepos();

  return (
    <CrudScreen<TutorialVideo, VideoInput>
      title="الفيديوهات"
      subtitle="فيديوهات الشرح داخل التطبيق — بالعربي والكردي"
      repo={repos.content.videos}
      searchable
      createLabel="إضافة فيديو"
      createTitle="إضافة فيديو"
      editTitle="تعديل الفيديو"
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
          key: 'title',
          header: 'الفيديو',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.title}</span>
              {row.subtitle ? <span className="fs-small dim truncate">{row.subtitle}</span> : null}
            </div>
          ),
        },
        {
          key: 'url',
          header: 'الرابط',
          render: (row) => (
            <a className="fs-small num truncate" href={row.videoUrl} target="_blank" rel="noreferrer">
              {row.videoUrl}
            </a>
          ),
        },
        {
          key: 'duration',
          header: 'المدة',
          numeric: true,
          width: 90,
          render: (row) => <span className="num">{duration(row.durationSeconds)}</span>,
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
        videoUrl: '',
        durationSeconds: 0,
        subtitle: '',
        subtitleKu: '',
        order: 0,
        isActive: true,
      })}
      toInput={(row) => ({
        title: row.title,
        titleKu: row.titleKu,
        videoUrl: row.videoUrl,
        durationSeconds: row.durationSeconds,
        subtitle: row.subtitle ?? '',
        subtitleKu: row.subtitleKu ?? '',
        order: row.order,
        isActive: row.isActive,
      })}
      validate={(draft) =>
        !draft.title.trim()
          ? 'عنوان الفيديو مطلوب'
          : !draft.videoUrl.trim()
            ? 'رابط الفيديو مطلوب'
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
          <Field label="وصف مختصر بالعربي">
            <TextInput
              value={draft.subtitle ?? ''}
              onChange={(next) => set('subtitle', next)}
            />
          </Field>
          <Field label="وصف مختصر بالكردي">
            <TextInput
              value={draft.subtitleKu ?? ''}
              onChange={(next) => set('subtitleKu', next)}
            />
          </Field>
          <Field label="رابط الفيديو" className="span-2">
            <TextInput
              type="url"
              value={draft.videoUrl}
              onChange={(next) => set('videoUrl', next)}
              placeholder="https://…"
            />
          </Field>
          <Field label="المدة بالثواني" hint="تظهر على الصورة داخل التطبيق">
            <TextInput
              type="number"
              min={0}
              value={draft.durationSeconds}
              onChange={(next) => set('durationSeconds', Number(next) || 0)}
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
    />
  );
}
