/**
 * Help videos.
 *
 * Titles carry both locales because the videos screen is one of the few places
 * the app shows editor-written copy rather than a translation key — Kurdish
 * users get a Kurdish title or nothing.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
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
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { GradientIndex, VideoItem } from '@/types';
import { GRADIENT_SWATCHES } from '@/lib/labels';

export function VideosPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [editing, setEditing] = useState<VideoItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<VideoItem | null>(null);
  const [busy, setBusy] = useState(false);

  const videos = useAsync(() => repos.content.videos(), []);

  const move = async (video: VideoItem, direction: -1 | 1) => {
    await repos.content.reorder('video', video.id, direction);
    videos.reload();
  };

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await repos.content.deleteVideo(deleting.id);
      toast('انحذف الفيديو');
      setDeleting(null);
      videos.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="الفيديوهات"
        subtitle="فيديوهات الشرح المعروضة داخل التطبيق"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة فيديو
          </Button>
        }
      />

      <div className="page">
        <AsyncBlock
          state={videos}
          emptyWhen={(rows) => rows.length === 0}
          empty={<EmptyState title="ما بيها فيديوهات" icon={<Play size={22} />} />}
        >
          {(rows) => (
            <div className="grid grid-2">
              {rows.map((video, index) => (
                <Card key={video.id} className="col">
                  <div
                    style={{
                      height: 96,
                      background: GRADIENT_SWATCHES[video.gradientIndex],
                      borderRadius: 'var(--r-card) var(--r-card) 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      position: 'relative',
                    }}
                  >
                    <Play size={26} />
                    <span
                      className="pill num"
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        background: 'rgba(20,48,77,0.55)',
                        color: '#fff',
                      }}
                    >
                      {video.duration}
                    </span>
                  </div>

                  <div className="col card-pad" style={{ gap: 'var(--sp-3)' }}>
                    <div className="row between row-gap-2">
                      <span className="fs-13 strong">{video.titleAr}</span>
                      <Pill tone={video.active ? 'success' : 'muted'}>
                        {video.active ? 'ظاهر' : 'مخفي'}
                      </Pill>
                    </div>
                    <span className="fs-12 muted">{video.titleCkb}</span>
                    <span className="fs-12 dim" style={{ lineHeight: 1.6 }}>
                      {video.descriptionAr}
                    </span>

                    <div className="row row-gap-1">
                      <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(video)}>
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUp size={13} />}
                        disabled={index === 0}
                        onClick={() => void move(video, -1)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowDown size={13} />}
                        disabled={index === rows.length - 1}
                        onClick={() => void move(video, 1)}
                      />
                      <span className="grow" />
                      <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleting(video)} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AsyncBlock>
      </div>

      {editing ? (
        <VideoDialog
          video={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            videos.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الفيديو"
          message={`راح ينحذف "${deleting.titleAr}".`}
          confirmLabel="حذف"
          danger
          pending={busy}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function VideoDialog({
  video,
  onClose,
  onSaved,
}: {
  video: VideoItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [titleAr, setTitleAr] = useState(video?.titleAr ?? '');
  const [titleCkb, setTitleCkb] = useState(video?.titleCkb ?? '');
  const [descriptionAr, setDescriptionAr] = useState(video?.descriptionAr ?? '');
  const [duration, setDuration] = useState(video?.duration ?? '');
  const [url, setUrl] = useState(video?.url ?? '');
  const [gradientIndex, setGradientIndex] = useState<GradientIndex>(video?.gradientIndex ?? 0);
  const [active, setActive] = useState(video?.active ?? true);

  const submit = async () => {
    if (!titleAr.trim() || !url.trim()) {
      toast('العنوان والرابط مطلوبين', 'error');
      return;
    }
    const ok = await run(() =>
      repos.content.saveVideo({
        id: video?.id,
        titleAr: titleAr.trim(),
        titleCkb: titleCkb.trim(),
        descriptionAr: descriptionAr.trim(),
        duration: duration.trim() || '0:00',
        url: url.trim(),
        gradientIndex,
        active,
        sortOrder: video?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(video ? 'انحفظ الفيديو' : 'انضاف الفيديو');
      onSaved();
    }
  };

  return (
    <Modal
      title={video ? 'تعديل الفيديو' : 'إضافة فيديو'}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void submit()} disabled={action.pending}>
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

        <Field label="العنوان بالعربي">
          <TextInput value={titleAr} onChange={setTitleAr} />
        </Field>
        <Field label="العنوان بالكردي">
          <TextInput value={titleCkb} onChange={setTitleCkb} />
        </Field>
        <Field label="الوصف">
          <TextArea value={descriptionAr} onChange={setDescriptionAr} rows={2} />
        </Field>

        <div className="grid grid-form">
          <Field label="المدة" hint="بصيغة دقائق:ثواني">
            <TextInput value={duration} onChange={setDuration} placeholder="3:24" />
          </Field>
          <Field label="لون البطاقة">
            <div className="row row-gap-2 wrap">
              {GRADIENT_SWATCHES.map((swatch, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setGradientIndex(index as GradientIndex)}
                  style={{
                    width: 34,
                    height: 26,
                    borderRadius: 8,
                    background: swatch,
                    border: gradientIndex === index ? '2px solid var(--brand-deep)' : '1px solid var(--hairline)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Field label="رابط الفيديو">
          <TextInput type="url" value={url} onChange={setUrl} placeholder="https://videos.silversat.iq/…" />
        </Field>

        <Switch checked={active} onChange={setActive} label="ظاهر داخل التطبيق" />
      </div>
    </Modal>
  );
}
