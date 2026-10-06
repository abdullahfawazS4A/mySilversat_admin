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
 *
 * Given a `spec`, the preview is framed at the ratio the app draws the picture
 * at, cropped the way the app crops it, with the safe area dashed over it. A
 * picked file whose ratio or size is off gets a warning, never a refusal: the
 * operator may know the crop is fine, and the save stays theirs to make.
 */

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { ImagePlus, TriangleAlert, Undo2, Upload } from 'lucide-react';
import { Button, Field } from '@/components/ui';
import { mediaCrossOrigin } from '@/lib/media';
import { cx } from '@/lib/utils';
import { RATIO_TOLERANCE, SAFE_AREA_INSET, SUGGESTED_BYTES, type ImageSpec } from '@/lib/imageSpecs';

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

/** «المقاس المطلوب: 1320×600 (2.2:1)» plus what the spec asks of the artwork. */
function specHint(spec: ImageSpec): string {
  const size = `المقاس المطلوب: ${spec.width}×${spec.height} (${spec.ratioLabel})`;
  return spec.round
    ? `${size} — PNG بخلفية شفافة`
    : `${size} — اترك الكتابة بعيدة عن الحواف، ويفضّل أقل من ${describeSize(SUGGESTED_BYTES)}`;
}

/** Soft warnings for a picked image of the given natural size. */
function specWarnings(spec: ImageSpec, width: number, height: number, file: File): string[] {
  const out: string[] = [];
  if (Math.abs(width / height / spec.ratio - 1) > RATIO_TOLERANCE) {
    out.push(
      `نسبة الصورة (${width}×${height}) لا تطابق ${spec.ratioLabel} — قد يُقص جزء منها في التطبيق.`,
    );
  }
  if (width < spec.minWidth || height < spec.minHeight) {
    out.push(`الصورة أصغر من الحد الأدنى ${spec.minWidth}×${spec.minHeight} — قد تظهر مشوشة.`);
  }
  if (spec.round && file.type !== 'image/png') out.push('الشعار يفضّل يكون PNG بخلفية شفافة.');
  return out;
}

/**
 * A picture framed and cropped the way the app shows it.
 *
 * Exported for the screens' own previews, so a banner opened from the table
 * looks the same as it did in the form.
 */
export function ImageFrame({
  src,
  spec,
  onLoad,
  className,
}: {
  src: string;
  spec: ImageSpec;
  onLoad?: (image: HTMLImageElement) => void;
  className?: string;
}) {
  const inset = `${SAFE_AREA_INSET * 100}%`;
  return (
    <div
      className={cx('image-frame', spec.round && 'is-round', className)}
      style={{ '--frame-ratio': spec.ratio } as CSSProperties}
    >
      <img
        src={src}
        crossOrigin={mediaCrossOrigin(src)}
        alt=""
        onLoad={(event) => onLoad?.(event.currentTarget)}
      />
      {spec.safeArea ? <span className="image-safe-area" style={{ inset }} aria-hidden="true" /> : null}
    </div>
  );
}

export function ImagePicker({
  file,
  currentUrl = '',
  onPick,
  label = 'الصورة',
  className,
  spec,
}: {
  /** A picture chosen now and not saved yet. */
  file: File | null;
  /** The picture already stored, shown while nothing newer is picked. */
  currentUrl?: string;
  onPick: (file: File | null) => void;
  label?: string;
  className?: string;
  /** The size the app shows this picture at; frames the preview and the hint. */
  spec?: ImageSpec;
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

  /*
   * The natural size of the picked file, read off the preview once it loads.
   * Tagged with its URL so a measurement can never be applied to a newer pick.
   */
  const [measured, setMeasured] = useState<{ src: string; width: number; height: number } | null>(null);

  const shown = preview ?? (currentUrl.trim() || null);

  // Only a pick not yet saved is judged: the stored picture is already live,
  // and nagging about it on every edit would teach operators to ignore this.
  const warnings =
    spec && file && preview && measured?.src === preview
      ? specWarnings(spec, measured.width, measured.height, file)
      : [];

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
          {spec ? (
            <ImageFrame
              src={shown}
              spec={spec}
              onLoad={(image) =>
                setMeasured({ src: shown, width: image.naturalWidth, height: image.naturalHeight })
              }
            />
          ) : (
            <img className="image-preview" src={shown} crossOrigin={mediaCrossOrigin(shown)} alt="" />
          )}
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
          {warnings.map((warning) => (
            <span key={warning} className="image-warning mt-2">
              <TriangleAlert size={14} />
              {warning}
            </span>
          ))}
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

      {spec ? <span className="field-hint">{specHint(spec)}</span> : null}
    </Field>
  );
}
