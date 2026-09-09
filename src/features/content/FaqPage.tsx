/**
 * FAQ entries.
 *
 * Both locales are edited side by side because the app ships a Kurdish UI:
 * an answer that exists only in Arabic reads as a bug to a Kurdish user, so
 * the editor sees the gap while writing rather than after publishing.
 *
 * Order matters — the app renders the list top to bottom with no sorting of
 * its own, so the arrows here are the only way to promote a question.
 */

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FilterChips,
  Modal,
  Notice,
  Pill,
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { FaqItem } from '@/types';

export function FaqPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [editing, setEditing] = useState<FaqItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FaqItem | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [run, action] = useAction();

  const faq = useAsync(() => repos.content.faq(), []);

  const categories = useMemo(() => {
    const seen = new Set((faq.data ?? []).map((item) => item.categoryAr));
    return ['all', ...[...seen].filter(Boolean)];
  }, [faq.data]);

  const rows = (faq.data ?? []).filter(
    (item) => category === 'all' || item.categoryAr === category,
  );

  const move = async (item: FaqItem, direction: -1 | 1) => {
    await repos.content.reorder('faq', item.id, direction);
    faq.reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.content.deleteFaq(deleting.id));
    if (ok) {
      toast('انحذف السؤال');
      setDeleting(null);
      faq.reload();
    }
  };

  return (
    <>
      <PageHeader
        title="الأسئلة الشائعة"
        subtitle="الأسئلة والأجوبة المعروضة داخل التطبيق بالعربي والكردي"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة سؤال
          </Button>
        }
      />

      <div className="page">
        <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
          <FilterChips
            value={category}
            onChange={setCategory}
            items={categories.map((key) => ({
              value: key,
              label: key === 'all' ? 'الكل' : key,
              count:
                key === 'all'
                  ? faq.data?.length
                  : (faq.data ?? []).filter((item) => item.categoryAr === key).length,
            }))}
          />

          {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

          <AsyncBlock
            state={faq}
            emptyWhen={() => rows.length === 0}
            empty={<EmptyState title="ما بيها أسئلة" icon={<HelpCircle size={22} />} />}
          >
            {() => (
              <div className="col" style={{ gap: 'var(--sp-3)' }}>
                {rows.map((item, index) => {
                  const open = expanded === item.id;
                  const missingKurdish = !item.questionCkb.trim() || !item.answerCkb.trim();
                  return (
                    <div key={item.id} className="card card-pad col" style={{ gap: 'var(--sp-3)' }}>
                      <div className="row between row-gap-3">
                        <button
                          className="row row-gap-2 grow"
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'start',
                            minWidth: 0,
                          }}
                          onClick={() => setExpanded(open ? null : item.id)}
                        >
                          <span className="chip-icon" style={{ width: 28, height: 28 }}>
                            <HelpCircle size={14} />
                          </span>
                          <span className="fs-13 strong truncate">{item.questionAr}</span>
                        </button>

                        <div className="row row-gap-1">
                          {item.categoryAr ? <Pill>{item.categoryAr}</Pill> : null}
                          {missingKurdish ? <Pill tone="warning">ناقص كردي</Pill> : null}
                          <Pill tone={item.active ? 'success' : 'muted'}>
                            {item.active ? 'ظاهر' : 'مخفي'}
                          </Pill>
                        </div>
                      </div>

                      {/*
                        Collapsed rows showed the question and nothing else, so
                        a list of six questions was six near-empty cards. One
                        line of the answer makes the list scannable without
                        opening anything.
                      */}
                      {!open ? (
                        <span className="fs-12 dim truncate" style={{ lineHeight: 1.6 }}>
                          {item.answerAr}
                        </span>
                      ) : null}

                      {open ? (
                        <div className="col" style={{ gap: 'var(--sp-2)' }}>
                          <span className="fs-12" style={{ lineHeight: 1.7 }}>
                            {item.answerAr}
                          </span>
                          <span className="fs-12 muted" style={{ lineHeight: 1.7 }}>
                            {item.questionCkb || '—'}
                          </span>
                          <span className="fs-12 dim" style={{ lineHeight: 1.7 }}>
                            {item.answerCkb || '—'}
                          </span>
                        </div>
                      ) : null}

                      <div className="row row-gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Pencil size={13} />}
                          onClick={() => setEditing(item)}
                        >
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowUp size={13} />}
                          title="فوق"
                          disabled={index === 0 || category !== 'all'}
                          onClick={() => void move(item, -1)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowDown size={13} />}
                          title="تحت"
                          disabled={index === rows.length - 1 || category !== 'all'}
                          onClick={() => void move(item, 1)}
                        />
                        <span className="grow" />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={13} />}
                          title="حذف"
                          onClick={() => setDeleting(item)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AsyncBlock>
        </div>
      </div>

      {editing ? (
        <FaqDialog
          item={editing === 'new' ? null : editing}
          categories={categories.filter((c) => c !== 'all')}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            faq.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف السؤال"
          message={`راح ينحذف "${deleting.questionAr}".`}
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function FaqDialog({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: FaqItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [questionAr, setQuestionAr] = useState(item?.questionAr ?? '');
  const [answerAr, setAnswerAr] = useState(item?.answerAr ?? '');
  const [questionCkb, setQuestionCkb] = useState(item?.questionCkb ?? '');
  const [answerCkb, setAnswerCkb] = useState(item?.answerCkb ?? '');
  const [categoryAr, setCategoryAr] = useState(item?.categoryAr ?? categories[0] ?? '');
  const [active, setActive] = useState(item?.active ?? true);

  const submit = async () => {
    if (!questionAr.trim() || !answerAr.trim()) {
      toast('السؤال والجواب بالعربي مطلوبين', 'error');
      return;
    }
    const ok = await run(() =>
      repos.content.saveFaq({
        id: item?.id,
        questionAr: questionAr.trim(),
        answerAr: answerAr.trim(),
        questionCkb: questionCkb.trim(),
        answerCkb: answerCkb.trim(),
        categoryAr: categoryAr.trim(),
        active,
        sortOrder: item?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(item ? 'انحفظ السؤال' : 'انضاف السؤال');
      onSaved();
    }
  };

  return (
    <Modal
      size="lg"
      title={item ? 'تعديل السؤال' : 'إضافة سؤال'}
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

        <Field label="السؤال بالعربي">
          <TextInput value={questionAr} onChange={setQuestionAr} />
        </Field>
        <Field label="الجواب بالعربي">
          <TextArea value={answerAr} onChange={setAnswerAr} rows={3} />
        </Field>

        <Field label="السؤال بالكردي">
          <TextInput value={questionCkb} onChange={setQuestionCkb} />
        </Field>
        <Field
          label="الجواب بالكردي"
          hint="إذا تركته فاضي، المستخدم الكردي راح يشوف النص العربي"
        >
          <TextArea value={answerCkb} onChange={setAnswerCkb} rows={3} />
        </Field>

        <div className="grid grid-form">
          <Field label="التصنيف" hint="يجمّع الأسئلة داخل الشاشة">
            <TextInput value={categoryAr} onChange={setCategoryAr} placeholder="الاشتراك" />
          </Field>
          <Field label="الظهور">
            <Switch checked={active} onChange={setActive} label="ظاهر داخل التطبيق" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
