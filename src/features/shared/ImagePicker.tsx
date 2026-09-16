/**
 * Picking an image, for any screen that authors one.
 *
 * The console stores images as URLs, so the field used to *be* a URL box: the
 * operator uploaded the picture somewhere else, then pasted a link. That is
 * two tools and one chance to paste a link that 404s later. Here the file is
 * chosen, checked and uploaded in place, and only its returned URL is kept —
 * the stored value is exactly what it always was.
 *
 * The URL box is still here, behind a toggle, and deliberately so. It is the
 * way images already hosted elsewhere get in, and it is the way this field
 * keeps working on a server whose `/uploads` route does not exist yet — the
 * upload failing must not take the screen down with it.
 *
 * The preview is shown from a local object URL the moment a file is picked,
 * before the upload finishes, because the question an operator has at that
 * instant is "is this the right picture" and the network cannot answer it.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import { Button, Field, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import { ApiError } from '@/data/http/client';

/** What the API will accept, and what the picker filters the file dialog to. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * The size an image stops being a banner and starts being a problem.
 *
 * Nothing server-side is known to enforce this, which is the reason to enforce
 * it here: a 20MB photo straight off a phone uploads slowly, then loads slowly
 * for every subscriber who opens the home screen.
 */
const MAX_BYTES = 5 * 1024 * 1024;

function describeSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} م.ب`
    : `${Math.round(bytes / 1024)} ك.ب`;
}

/** Client-side refusals, phrased for the operator rather than the log. */
function checkFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'الملف لازم يكون صورة JPG أو PNG أو WEBP أو GIF.';
  if (file.size > MAX_BYTES) {
    return `الصورة كبيرة (${describeSize(file.size)}) — الحد ${describeSize(MAX_BYTES)}.`;
  }
  return null;
}

/**
 * Turns a failed upload into a sentence that says what to do next.
 *
 * A 404 or 405 here is not a broken console: it is a server that has no upload
 * route yet, and the operator's way past it is the URL box — so that is what
 * the message points at, instead of the generic "not found".
 */
function describeFailure(err: unknown): string {
  if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
    return 'السيرفر ما يدعم رفع الصور بعد — استخدم «الصق رابط» لحد ما ينضاف الراوت.';
  }
  if (err instanceof ApiError && err.status === 413) {
    return 'السيرفر رفض الصورة لأنها كبيرة — صغّرها وعاود.';
  }
  return err instanceof Error ? err.message : 'ما انرفعت الصورة — عاود المحاولة.';
}

export function ImagePicker({
  value,
  onChange,
  label = 'الصورة',
  className,
}: {
  /** The stored URL, or an empty string when there is no image yet. */
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const repos = useRepos();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);

  // The picked file, shown while it uploads. Revoked on replace and on
  // unmount — an object URL pins the whole file in memory until it is.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const upload = async (file: File) => {
    const refusal = checkFile(file);
    if (refusal) {
      setError(refusal);
      return;
    }

    const preview = URL.createObjectURL(file);
    setLocalPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return preview;
    });
    setError(null);
    setPending(true);
    try {
      onChange(await repos.uploads.image(file));
    } catch (err) {
      setError(describeFailure(err));
      // The upload is what failed, so the preview is a picture of something
      // that was never stored. Dropping it keeps the field honest.
      setLocalPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    } finally {
      setPending(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const clear = () => {
    setLocalPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setError(null);
    onChange('');
  };

  const shown = localPreview ?? (value.trim() || null);

  return (
    <Field label={label} className={className} error={error ?? undefined}>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Resetting lets the same file be picked again after a failure.
          event.target.value = '';
          if (file) void upload(file);
        }}
      />

      {shown ? (
        <div className="image-picked">
          <img className="image-preview" src={shown} alt="" />
          {pending ? <div className="image-picked-veil">جاري الرفع…</div> : null}
          <div className="row row-gap-2 mt-2">
            <Button
              size="sm"
              icon={<Upload size={14} />}
              disabled={pending}
              onClick={() => fileInput.current?.click()}
            >
              تغيير الصورة
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={pending} onClick={clear}>
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}${pending ? ' is-busy' : ''}`}
          onClick={() => !pending && fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={22} />
          <span className="strong">{pending ? 'جاري الرفع…' : 'اختر صورة أو اسحبها هنا'}</span>
          <span className="fs-tiny dim">JPG أو PNG أو WEBP أو GIF — حد أقصى {describeSize(MAX_BYTES)}</span>
        </div>
      )}

      {urlMode ? (
        <div className="mt-2">
          <TextInput
            type="url"
            value={value}
            onChange={(next) => {
              // A pasted link is the operator's way past a failed upload, so
              // the failure stops being news the moment they use it.
              setError(null);
              onChange(next);
            }}
            placeholder="https://…"
            disabled={pending}
          />
        </div>
      ) : null}

      <button type="button" className="link-button fs-tiny mt-2" onClick={() => setUrlMode((on) => !on)}>
        <Link2 size={12} /> {urlMode ? 'إخفاء حقل الرابط' : 'أو الصق رابط صورة'}
      </button>
    </Field>
  );
}
