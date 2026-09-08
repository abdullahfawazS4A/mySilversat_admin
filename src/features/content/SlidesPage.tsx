/**
 * Home-screen carousel slides.
 *
 * Order matters here more than anywhere else in the console — slide one is
 * what most users ever see — so reordering is a first-class action rather than
 * a numeric field inside the edit dialog.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp, Image, Pencil, Plus, Trash2 } from 'lucide-react';
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
  Select,
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { GradientIndex, Slide, SlideTarget } from '@/types';
import { GRADIENT_SWATCHES, SLIDE_TARGET } from '@/lib/labels';
import { formatDateAr } from '@/lib/format';

export function SlidesPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Slide | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Slide | null>(null);
  const [busy, setBusy] = useState(false);

  const slides = useAsync(() => repos.content.slides(), []);

  const move = async (slide: Slide, direction: -1 | 1) => {
    await repos.content.reorder('slide', slide.id, direction);
    slides.reload();
  };

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await repos.content.deleteSlide(deleting.id);
      toast('انحذف السلايد');
      setDeleting(null);
      slides.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="سلايدر الرئيسية"
        subtitle="الإعلانات المتحركة في أعلى الشاشة الرئيسية — الترتيب هنا هو الترتيب داخل التطبيق"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة سلايد
          </Button>
        }
      />

      <div className="page">
        <AsyncBlock
          state={slides}
          emptyWhen={(rows) => rows.length === 0}
          empty={<EmptyState title="ما بيها سلايدات" icon={<Image size={22} />} />}
        >
          {(rows) => (
            <div className="col" style={{ gap: 'var(--sp-4)' }}>
              {rows.map((slide, index) => {
                const now = Date.now();
                const live =
                  slide.active &&
                  new Date(slide.startsAt).getTime() <= now &&
                  new Date(slide.endsAt).getTime() >= now;
                return (
                  <Card key={slide.id} className="row row-gap-4 wrap card-pad">
                    <div
                      style={{
                        width: 128,
                        height: 76,
                        borderRadius: 'var(--r-card)',
                        background: GRADIENT_SWATCHES[slide.gradientIndex],
                        flex: 'none',
                        display: 'flex',
                        alignItems: 'flex-end',
                        padding: 10,
                        color: '#fff',
                      }}
                    >
                      <span className="fs-11">{slide.tagAr}</span>
                    </div>

                    <div className="col grow" style={{ gap: 4, minWidth: 200 }}>
                      <div className="row row-gap-2 wrap">
                        <span className="fs-11 dim num">#{index + 1}</span>
                        <Pill tone={live ? 'success' : 'muted'}>{live ? 'ظاهر الآن' : 'ما يظهر'}</Pill>
                        <Pill tone="neutral">{SLIDE_TARGET[slide.routeTarget]}</Pill>
                      </div>
                      <span className="fs-13 strong">{slide.titleAr}</span>
                      <span className="fs-12 muted">{slide.subtitleAr}</span>
                      <span className="fs-11 dim">
                        من {formatDateAr(slide.startsAt)} إلى {formatDateAr(slide.endsAt)}
                      </span>
                    </div>

                    <div className="row row-gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowUp size={13} />}
                        title="تقديم"
                        disabled={index === 0}
                        onClick={() => void move(slide, -1)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ArrowDown size={13} />}
                        title="تأخير"
                        disabled={index === rows.length - 1}
                        onClick={() => void move(slide, 1)}
                      />
                      <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(slide)}>
                        تعديل
                      </Button>
                      <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleting(slide)} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </AsyncBlock>
      </div>

      {editing ? (
        <SlideDialog
          slide={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            slides.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف السلايد"
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

function SlideDialog({
  slide,
  onClose,
  onSaved,
}: {
  slide: Slide | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [tagAr, setTagAr] = useState(slide?.tagAr ?? '');
  const [titleAr, setTitleAr] = useState(slide?.titleAr ?? '');
  const [subtitleAr, setSubtitleAr] = useState(slide?.subtitleAr ?? '');
  const [gradientIndex, setGradientIndex] = useState<GradientIndex>(slide?.gradientIndex ?? 0);
  const [routeTarget, setRouteTarget] = useState<SlideTarget>(slide?.routeTarget ?? 'none');
  const [startsAt, setStartsAt] = useState((slide?.startsAt ?? new Date().toISOString()).slice(0, 10));
  const [endsAt, setEndsAt] = useState((slide?.endsAt ?? new Date().toISOString()).slice(0, 10));
  const [active, setActive] = useState(slide?.active ?? true);

  const submit = async () => {
    if (!titleAr.trim()) {
      toast('اكتب عنوان السلايد', 'error');
      return;
    }
    const ok = await run(() =>
      repos.content.saveSlide({
        id: slide?.id,
        tagAr: tagAr.trim(),
        titleAr: titleAr.trim(),
        subtitleAr: subtitleAr.trim(),
        gradientIndex,
        routeTarget,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
        active,
        sortOrder: slide?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(slide ? 'انحفظ السلايد' : 'انضاف السلايد');
      onSaved();
    }
  };

  return (
    <Modal
      title={slide ? 'تعديل السلايد' : 'إضافة سلايد'}
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

        <Field label="الشارة">
          <TextInput value={tagAr} onChange={setTagAr} placeholder="عرض خاص" />
        </Field>
        <Field label="العنوان">
          <TextInput value={titleAr} onChange={setTitleAr} />
        </Field>
        <Field label="النص التوضيحي">
          <TextArea value={subtitleAr} onChange={setSubtitleAr} rows={2} />
        </Field>

        <Field label="عند الضغط يفتح">
          <Select
            value={routeTarget}
            onChange={setRouteTarget}
            options={(Object.keys(SLIDE_TARGET) as SlideTarget[]).map((key) => ({
              value: key,
              label: SLIDE_TARGET[key],
            }))}
          />
        </Field>

        <Field label="اللون">
          <div className="row row-gap-2 wrap">
            {GRADIENT_SWATCHES.map((swatch, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setGradientIndex(index as GradientIndex)}
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 'var(--r-chip)',
                  background: swatch,
                  border: gradientIndex === index ? '2px solid var(--brand-deep)' : '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>

        <div className="grid grid-form">
          <Field label="يبدأ في">
            <TextInput type="date" value={startsAt} onChange={setStartsAt} />
          </Field>
          <Field label="ينتهي في">
            <TextInput type="date" value={endsAt} onChange={setEndsAt} />
          </Field>
        </div>

        <Switch checked={active} onChange={setActive} label="السلايد مفعّل" />
      </div>
    </Modal>
  );
}
