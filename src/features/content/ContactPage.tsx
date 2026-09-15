/**
 * The support channels the app's contact screen lists.
 *
 * `type` is not decoration — it picks the icon *and* the handler, so a row
 * typed `whatsapp` opens WhatsApp with the number while `phone` dials it. That
 * makes `value` mean something different per type, which is why the field
 * relabels itself instead of staying a generic box.
 */

import { Field, Pill, Select, Switch, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import type { ContactChannel, ContactLink } from '@/types';
import type { ContactLinkInput } from '@/data/repositories/types';
import { CONTACT_CHANNEL } from '@/lib/labels';
import { CrudScreen } from '../shared/CrudScreen';

/** What `value` has to contain for each channel. */
const VALUE_HINT: Record<ContactChannel, string> = {
  phone: 'رقم الهاتف اللي ينطلب مباشرة',
  whatsapp: 'رقم الواتساب بصيغة دولية، مثل 9647XXXXXXXX',
  facebook: 'رابط الصفحة',
  instagram: 'رابط الحساب أو المعرّف',
  telegram: 'رابط القناة أو المعرّف',
};

const CHANNEL_TONE: Record<ContactChannel, 'neutral' | 'success' | 'muted'> = {
  phone: 'neutral',
  whatsapp: 'success',
  facebook: 'neutral',
  instagram: 'neutral',
  telegram: 'muted',
};

export function ContactPage() {
  const repos = useRepos();

  return (
    <CrudScreen<ContactLink, ContactLinkInput>
      title="قنوات التواصل"
      subtitle="الأرقام والحسابات اللي تظهر بشاشة التواصل داخل التطبيق"
      repo={repos.content.contactLinks}
      searchable
      createLabel="إضافة قناة"
      createTitle="إضافة قناة تواصل"
      editTitle="تعديل القناة"
      dialogSize="lg"
      rowKey={(row) => row.id}
      labelOf={(row) => row.label}
      columns={[
        {
          key: 'order',
          header: 'الترتيب',
          numeric: true,
          width: 80,
          render: (row) => <span className="num">{row.order}</span>,
        },
        {
          key: 'type',
          header: 'القناة',
          width: 110,
          render: (row) => <Pill tone={CHANNEL_TONE[row.type]}>{CONTACT_CHANNEL[row.type]}</Pill>,
        },
        {
          key: 'label',
          header: 'الاسم المعروض',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.label}</span>
              <span className="fs-small dim">{row.labelKu || '—'}</span>
            </div>
          ),
        },
        {
          key: 'value',
          header: 'القيمة',
          render: (row) => (
            <div className="col">
              <span className="fs-small num truncate">{row.value}</span>
              {row.subLabel ? <span className="fs-tiny dim">{row.subLabel}</span> : null}
            </div>
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
        type: 'phone',
        label: '',
        labelKu: '',
        value: '',
        subLabel: '',
        subLabelKu: '',
        order: 0,
        isActive: true,
      })}
      toInput={(row) => ({
        type: row.type,
        label: row.label,
        labelKu: row.labelKu,
        value: row.value,
        subLabel: row.subLabel ?? '',
        subLabelKu: row.subLabelKu ?? '',
        order: row.order,
        isActive: row.isActive,
      })}
      validate={(draft) =>
        !draft.label.trim()
          ? 'الاسم المعروض مطلوب'
          : !draft.value.trim()
            ? 'قيمة القناة مطلوبة'
            : null
      }
      form={(draft, set) => (
        <>
          <Field label="نوع القناة">
            <Select<ContactChannel>
              value={draft.type}
              onChange={(next) => set('type', next)}
              options={(Object.keys(CONTACT_CHANNEL) as ContactChannel[]).map((value) => ({
                value,
                label: CONTACT_CHANNEL[value],
              }))}
            />
          </Field>
          <Field label="القيمة" hint={VALUE_HINT[draft.type]}>
            <TextInput value={draft.value} onChange={(next) => set('value', next)} />
          </Field>

          <Field label="الاسم المعروض بالعربي">
            <TextInput
              value={draft.label}
              onChange={(next) => set('label', next)}
              placeholder="خدمة الزبائن"
            />
          </Field>
          <Field label="الاسم المعروض بالكردي">
            <TextInput value={draft.labelKu} onChange={(next) => set('labelKu', next)} />
          </Field>

          <Field label="سطر ثانوي بالعربي" hint="اختياري — مثل أوقات الدوام">
            <TextInput value={draft.subLabel ?? ''} onChange={(next) => set('subLabel', next)} />
          </Field>
          <Field label="سطر ثانوي بالكردي">
            <TextInput value={draft.subLabelKu ?? ''} onChange={(next) => set('subLabelKu', next)} />
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
