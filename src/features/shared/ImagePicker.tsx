/**
 * Picking an image, for any screen that authors one.
 *
 * This used to upload the file to `/uploads` and hand back a URL, which is the
 * shape you want when images are their own resource. They are not here:
 * `/uploads` does not exist on this API — it answers `405` — and every route
 * that stores a picture takes it as a file on the request that saves the row:
 * a banner on `/ads`, a club crest on `/teams`. So the picker's job is smaller
 * than it was. It chooses a file, checks it, shows it, and hands it over;
 * whoever owns the form sends it.
 *
 * That also removes the URL box that used to sit behind a toggle. It was the
 * way past a failed upload, and there is no upload left to fail — a pasted
 * link is now something the API rejects, so offering it would only be a slower
 * way to reach an error.
 *
 * The preview comes from a local object URL the moment a file is picked,
 * because the question an operator has at that instant is "is this the right
 * picture" and nothing on the network is needed to answer it.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, Undo2, Upload } from 'lucide-react';
import { Button, Field } from '@/components/ui';

/** What the API will accept, and what the picker filters the file dialog to. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * The size an image stops being a picture and starts being a problem.
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

export function ImagePicker({
  file,
  currentUrl = '',
  onPick,
  label = 'الصورة',
  className,
}: {
  /** A picture chosen now and not saved yet. */
  file: File | null;
  /** The picture already stored, shown while nothing newer is picked. */
  currentUrl?: string;
  onPick: (file: File | null) => void;
  label?: string;
  className?: string;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /*
   * The object URL for the picked file.
   *
   * Derived from `file` rather than set alongside it, so it cannot drift out
   * of step with the draft the form holds — a stale preview here is a picture
   * of something that is not going to be saved. Revoked whenever it is
   * replaced and on unmount, because an object URL pins the whole file in
   * memory until it is.
   */
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (picked: File) => {
    const refusal = checkFile(picked);
    if (refusal) {
      setError(refusal);
      return;
    }
    setError(null);
    onPick(picked);
  };

  const shown = preview ?? (currentUrl.trim() || null);

  return (
    <Field label={label} className={className} error={error ?? undefined}>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED.join(',')}
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // Resetting lets the same file be picked again after a refusal.
          event.target.value = '';
          if (picked) choose(picked);
        }}
      />

      {shown ? (
        <div className="image-picked">
          <img className="image-preview" src={shown} alt="" />
          <div className="row row-gap-2 mt-2">
            <Button size="sm" icon={<Upload size={14} />} onClick={() => fileInput.current?.click()}>
              تغيير الصورة
            </Button>
            {/*
              * Undo, not delete. Taking a stored picture away is not something
              * any of these routes offers — the file part is how one is set,
              * and there is no documented way to spell "remove it" — so the
              * only thing there is to take back is a pick not yet saved.
              */}
            {file ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<Undo2 size={14} />}
                onClick={() => {
                  setError(null);
                  onPick(null);
                }}
              >
                {currentUrl.trim() ? 'رجّع الصورة السابقة' : 'تراجع'}
              </Button>
            ) : null}
          </div>
          {file ? <span className="fs-tiny dim mt-2">تنرفع مع الحفظ</span> : null}
        </div>
      ) : (
        <div
          className={`dropzone${dragging ? ' is-dragging' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) choose(dropped);
          }}
        >
          <ImagePlus size={22} />
          <span className="strong">اختر صورة أو اسحبها هنا</span>
          <span className="fs-tiny dim">JPG أو PNG أو WEBP أو GIF — حد أقصى {describeSize(MAX_BYTES)}</span>
        </div>
      )}
    </Field>
  );
}
