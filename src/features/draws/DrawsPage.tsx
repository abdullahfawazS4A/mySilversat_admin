/**
 * Prize draws — the «جدّد واربح» campaign as the app shows it.
 *
 * What this screen owns is the announcement: the bilingual text, an optional
 * picture, the date the app counts down to, and whether the campaign is
 * showing at all.
 *
 * Holding the draw lives on the coupons screen, next to the winning coupons it
 * produces, so this one stays an editor and says where the draw is run.
 *
 * A date that has already passed is called out in the table. The app counts
 * down to `drawAt` and a finished countdown does not hide itself, so a draw
 * left switched on after its date keeps sitting on the home screen at zero;
 * that is a thing an operator has to be shown, not left to notice.
 */

import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Field, Notice, Pill, Switch, TextArea, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import type { PrizeDraw } from '@/types';
import type { PrizeDrawInput } from '@/data/repositories/types';
import { countdownAr, formatDateTimeAr, fromLocalInput, toLocalInput } from '@/lib/format';
import { mediaCrossOrigin, mediaUrl } from '@/lib/media';
import { CrudScreen } from '../shared/CrudScreen';
import { ImagePicker } from '../shared/ImagePicker';

/** Whether the announced date is behind us. */
function isOver(draw: PrizeDraw): boolean {
  return new Date(draw.drawAt).getTime() <= Date.now();
}

export function DrawsPage() {
  const repos = useRepos();

  return (
    <CrudScreen<PrizeDraw, PrizeDrawInput>
      title="السحوبات والجوائز"
      subtitle="إعلان السحب اللي يظهر بالتطبيق — نصّه وموعده"
      repo={repos.content.prizeDraws}
      searchable
      createLabel="إضافة سحب"
      createTitle="إضافة سحب"
      editTitle="تعديل السحب"
      dialogSize="lg"
      rowKey={(row) => row.id}
      labelOf={(row) => row.titleAr}
      columns={[
        {
          key: 'title',
          header: 'السحب',
          render: (row) => (
            <div className="row row-gap-2">
              {row.imageUrl ? (
                <span className="thumb-frame">
                  <img
                    className="thumb"
                    src={mediaUrl(row.imageUrl)}
                    crossOrigin={mediaCrossOrigin(mediaUrl(row.imageUrl))}
                    alt=""
                    loading="lazy"
                  />
                </span>
              ) : null}
              <div className="col grow">
                <span className="strong">{row.titleAr}</span>
                <span className="fs-small dim truncate">{row.bodyAr}</span>
              </div>
            </div>
          ),
        },
        {
          key: 'ku',
          header: 'بالكردي',
          render: (row) => <span className="fs-small">{row.titleKu || '—'}</span>,
        },
        {
          key: 'drawAt',
          header: 'موعد السحب',
          render: (row) => (
            <div className="col">
              <span className="num">{formatDateTimeAr(row.drawAt)}</span>
              {isOver(row) ? (
                <span className="fs-tiny text-danger">
                  انتهى موعده
                </span>
              ) : (
                <span className="fs-tiny dim">باقي {countdownAr(row.drawAt)}</span>
              )}
            </div>
          ),
        },
        {
          key: 'active',
          header: 'الحالة',
          width: 110,
          render: (row) =>
            !row.isActive ? (
              <Pill tone="muted">مخفي</Pill>
            ) : isOver(row) ? (
              // Still showing, and showing a countdown that has run out.
              <Pill tone="warning">ظاهر ومنتهي</Pill>
            ) : (
              <Pill tone="success">ظاهر</Pill>
            ),
        },
      ]}
      blank={() => ({
        titleAr: '',
        titleKu: '',
        bodyAr: '',
        bodyKu: '',
        drawAt: '',
        isActive: true,
        image: null,
        imageUrl: '',
      })}
      toInput={(row) => ({
        titleAr: row.titleAr,
        titleKu: row.titleKu,
        bodyAr: row.bodyAr,
        bodyKu: row.bodyKu,
        drawAt: row.drawAt,
        isActive: row.isActive,
        // No file yet: an edit that does not touch the picture keeps it.
        image: null,
        imageUrl: mediaUrl(row.imageUrl),
      })}
      validate={(draft) =>
        !draft.titleAr.trim()
          ? 'عنوان السحب بالعربي مطلوب'
          : !draft.titleKu.trim()
            ? 'عنوان السحب بالكردي مطلوب — التطبيق يعرض اللغتين'
            : !draft.bodyAr.trim()
              ? 'شرح السحب بالعربي مطلوب'
              : !draft.bodyKu.trim()
                ? 'شرح السحب بالكردي مطلوب'
                : !draft.drawAt
                  ? 'موعد السحب مطلوب'
                  : null
      }
      form={(draft, set) => (
        <>
          <Field label="العنوان بالعربي" className="span-2">
            <TextInput
              value={draft.titleAr}
              onChange={(next) => set('titleAr', next)}
              placeholder="السحب السنوي ٢٠٢٦"
            />
          </Field>
          <Field label="العنوان بالكردي" className="span-2">
            <TextInput value={draft.titleKu} onChange={(next) => set('titleKu', next)} />
          </Field>
          <Field label="الشرح بالعربي" className="span-2" hint="النص اللي يوضّح شلون يدخل السحب">
            <TextArea
              rows={3}
              value={draft.bodyAr}
              onChange={(next) => set('bodyAr', next)}
              placeholder="كل تجديد عبر التطبيق يمنحك كوبون يدخل السحب"
            />
          </Field>
          <Field label="الشرح بالكردي" className="span-2">
            <TextArea rows={3} value={draft.bodyKu} onChange={(next) => set('bodyKu', next)} />
          </Field>
          <ImagePicker
            label="صورة السحب (اختياري)"
            className="span-2"
            file={draft.image}
            currentUrl={draft.imageUrl}
            onPick={(next) => set('image', next)}
          />
          <Field label="موعد السحب" hint="بتوقيتك — التطبيق يعد له تنازلياً">
            <TextInput
              type="datetime-local"
              value={toLocalInput(draft.drawAt)}
              // An unparsable half-typed date stays out of the draft, so the
              // field is never storing something the API would take as null.
              onChange={(next) => set('drawAt', fromLocalInput(next) ?? '')}
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
      <Notice tone="info" icon={<Info size={16} />}>
        هذي الشاشة تكتب <span className="strong">إعلان السحب</span> — نصّه وموعده وظهوره بالتطبيق.
        إجراء السحب ومعرفة الكوبون الفائز من شاشة{' '}
        <Link to="/coupons" className="strong">
          الكوبونات
        </Link>
        .
      </Notice>
    </CrudScreen>
  );
}
