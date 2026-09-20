/**
 * Prize draws — the «جدّد واربح» campaign as the app shows it.
 *
 * What this screen owns is the announcement: the bilingual text, the date the
 * app counts down to, and whether the campaign is showing at all. That is the
 * whole of what the API exposes.
 *
 * What it deliberately does not claim to do is run a draw. There is no route
 * to hold one and none to record a winner — the coupons that enter a draw are
 * issued server-side on a renewal and are readable only by the user who earned
 * them — so the screen says so once, at the top, rather than offering a button
 * that would have to lie.
 *
 * A date that has already passed is called out in the table. The app counts
 * down to `drawAt` and a finished countdown does not hide itself, so a draw
 * left switched on after its date keeps sitting on the home screen at zero;
 * that is a thing an operator has to be shown, not left to notice.
 */

import { Info } from 'lucide-react';
import { Field, Notice, Pill, Switch, TextArea, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import type { PrizeDraw } from '@/types';
import type { PrizeDrawInput } from '@/data/repositories/types';
import { countdownAr, formatDateTimeAr, fromLocalInput, toLocalInput } from '@/lib/format';
import { CrudScreen } from '../shared/CrudScreen';

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
            <div className="col">
              <span className="strong">{row.titleAr}</span>
              <span className="fs-small dim truncate">{row.bodyAr}</span>
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
                <span className="fs-tiny" style={{ color: 'var(--danger)' }}>
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
      })}
      toInput={(row) => ({
        titleAr: row.titleAr,
        titleKu: row.titleKu,
        bodyAr: row.bodyAr,
        bodyKu: row.bodyKu,
        drawAt: row.drawAt,
        isActive: row.isActive,
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
        هذي الشاشة تكتب <span className="strong">إعلان السحب</span> بس — نصّه وموعده وظهوره
        بالتطبيق. إجراء السحب نفسه وتسجيل الفائز ماكو إلهم endpoints بالسيرفر، والكوبونات تنطلع
        تلقائياً عند التجديد وما تنقرأ إلا من حساب المشترك نفسه.
      </Notice>
    </CrudScreen>
  );
}
