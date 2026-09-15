/**
 * The in-app FAQ.
 *
 * Every question is authored twice — Arabic and Kurdish — because the app
 * ships both and a half-translated entry renders as a blank answer rather
 * than a fallback. `order` decides the sequence in the app; `isActive` hides
 * an entry without losing the text.
 */

import { Pill } from '@/components/ui';
import { Field, Switch, TextArea, TextInput } from '@/components/ui';
import { useRepos } from '@/app/RepositoryContext';
import type { Faq } from '@/types';
import type { FaqInput } from '@/data/repositories/types';
import { CrudScreen } from '../shared/CrudScreen';

export function FaqPage() {
  const repos = useRepos();

  return (
    <CrudScreen<Faq, FaqInput>
      title="الأسئلة الشائعة"
      subtitle="الأسئلة والأجوبة اللي تظهر بشاشة المساعدة داخل التطبيق"
      repo={repos.content.faqs}
      searchable
      createLabel="إضافة سؤال"
      createTitle="إضافة سؤال"
      editTitle="تعديل السؤال"
      dialogSize="lg"
      rowKey={(row) => row.id}
      labelOf={(row) => row.question}
      columns={[
        {
          key: 'order',
          header: 'الترتيب',
          numeric: true,
          width: 80,
          render: (row) => <span className="num">{row.order}</span>,
        },
        {
          key: 'question',
          header: 'السؤال',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.question}</span>
              <span className="fs-small dim truncate">{row.answer}</span>
            </div>
          ),
        },
        {
          key: 'ku',
          header: 'بالكردي',
          render: (row) => <span className="fs-small">{row.questionKu || '—'}</span>,
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
        question: '',
        questionKu: '',
        answer: '',
        answerKu: '',
        order: 0,
        isActive: true,
      })}
      toInput={(row) => ({
        question: row.question,
        questionKu: row.questionKu,
        answer: row.answer,
        answerKu: row.answerKu,
        order: row.order,
        isActive: row.isActive,
      })}
      validate={(draft) =>
        !draft.question.trim()
          ? 'السؤال بالعربي مطلوب'
          : !draft.answer.trim()
            ? 'الجواب بالعربي مطلوب'
            : null
      }
      form={(draft, set) => (
        <>
          <Field label="السؤال بالعربي" className="span-2">
            <TextInput
              value={draft.question}
              onChange={(next) => set('question', next)}
              placeholder="شلون أجدد اشتراكي؟"
            />
          </Field>
          <Field label="السؤال بالكردي" className="span-2">
            <TextInput value={draft.questionKu} onChange={(next) => set('questionKu', next)} />
          </Field>
          <Field label="الجواب بالعربي" className="span-2">
            <TextArea rows={3} value={draft.answer} onChange={(next) => set('answer', next)} />
          </Field>
          <Field label="الجواب بالكردي" className="span-2">
            <TextArea rows={3} value={draft.answerKu} onChange={(next) => set('answerKu', next)} />
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
