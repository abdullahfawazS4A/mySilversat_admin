/**
 * The list-plus-editor screen that most resources are.
 *
 * Eleven collections on this API are the same page: a toolbar, a table, a
 * dialog with a few fields, and a delete confirm. Writing that eleven times is
 * how eleven screens drift apart — one grows a confirm the others lack, one
 * forgets to clear the error on close, one pages from zero.
 *
 * So the shape lives here and a screen supplies only what is actually its own:
 * its columns, its form fields, and how to turn a row back into an input.
 * Anything a resource does beyond CRUD (health checks, bulk actions, sending)
 * belongs in a hand-written screen instead — this is not meant to stretch.
 */

import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, Button, ConfirmDialog, Modal, SearchInput, useDraft } from '@/components/ui';
import { Column, DataTable, PageHeader, Toolbar } from '@/components/page';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import type { Id, ListQuery, Page } from '@/types';
import type { CrudRepository } from '@/data/repositories/types';

export interface CrudScreenProps<T, C, F extends object> {
  title: string;
  subtitle?: string;
  /** The collection this screen edits. */
  repo: CrudRepository<T, C, Partial<C>, F>;
  columns: Column<T>[];
  rowKey: (row: T) => Id;
  /** Shown in the delete confirm so the operator sees what they are removing. */
  labelOf: (row: T) => string;

  /** Omit to hide the search box for resources with nothing to search. */
  searchable?: boolean;
  /** Extra filter controls, rendered in the toolbar. */
  filters?: ReactNode;
  /** Filter values sent to the repository. Changing it reloads. */
  filter?: F;

  /** A fresh, empty input for the create dialog. */
  blank: () => C;
  /** Turns an existing row back into an editable input. */
  toInput: (row: T) => C;
  /** The dialog body. */
  form: (draft: C, set: <K extends keyof C>(key: K, value: C[K]) => void) => ReactNode;
  /** Returns an Arabic message to block the save, or null to allow it. */
  validate?: (draft: C) => string | null;

  createLabel?: string;
  createTitle?: string;
  editTitle?: string;
  dialogSize?: 'lg' | 'xl';
  /** Rendered between the header and the table — a notice, a stat strip. */
  children?: ReactNode;
  /** Extra header buttons, placed before the create button. */
  headerActions?: ReactNode;
  /** Hides the create button for feed-mirrored collections. */
  readOnlyCreate?: boolean;
}

export function CrudScreen<T, C extends object, F extends object = Record<string, never>>({
  title,
  subtitle,
  repo,
  columns,
  rowKey,
  labelOf,
  searchable,
  filters,
  filter,
  blank,
  toInput,
  form,
  validate,
  createLabel = 'إضافة',
  createTitle = 'إضافة جديد',
  editTitle = 'تعديل',
  dialogSize,
  children,
  headerActions,
  readOnlyCreate,
}: CrudScreenProps<T, C, F>) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  // `filter` is a fresh object each render, so the dep is its content.
  const filterKey = JSON.stringify(filter ?? {});

  const state = useAsync<Page<T>>(
    () => repo.list({ page, search: debounced, ...(filter ?? {}) } as ListQuery & F),
    [page, debounced, filterKey],
  );

  const [editing, setEditing] = useState<{ row: T | null } | null>(null);
  const [removing, setRemoving] = useState<T | null>(null);

  const reset = () => {
    setPage(1);
    state.reload();
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {headerActions}
            {readOnlyCreate ? null : (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing({ row: null })}>
                {createLabel}
              </Button>
            )}
          </>
        }
      />

      <div className="page">
        {children}

        <Card>
          {searchable || filters ? (
            <Toolbar>
              {searchable ? (
                <SearchInput
                  value={search}
                  onChange={(next) => {
                    setSearch(next);
                    setPage(1);
                  }}
                />
              ) : null}
              {filters}
            </Toolbar>
          ) : null}

          <DataTable
            columns={[
              ...columns,
              {
                key: '__actions',
                header: '',
                width: 92,
                render: (row: T) => (
                  <div className="row row-gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="تعديل"
                      icon={<Pencil size={14} />}
                      onClick={() => setEditing({ row })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      title="حذف"
                      icon={<Trash2 size={14} />}
                      onClick={() => setRemoving(row)}
                    />
                  </div>
                ),
              },
            ]}
            rows={state.data?.items ?? []}
            rowKey={rowKey}
            loading={state.loading && !state.data}
            page={state.data?.page}
            pageSize={state.data?.pageSize}
            total={state.data?.total}
            onPage={setPage}
          />
        </Card>
      </div>

      {editing ? (
        <EditorDialog
          title={editing.row ? editTitle : createTitle}
          size={dialogSize}
          initial={editing.row ? toInput(editing.row) : blank()}
          validate={validate}
          form={form}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing.row ? repo.update(rowKey(editing.row), input) : repo.create(input)
          }
          onSaved={() => {
            setEditing(null);
            reset();
          }}
        />
      ) : null}

      {removing ? (
        <DeleteDialog
          label={labelOf(removing)}
          onCancel={() => setRemoving(null)}
          onConfirm={() => repo.remove(rowKey(removing))}
          onDone={() => {
            setRemoving(null);
            reset();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * The create/edit dialog.
 *
 * Split out so the draft resets when the dialog opens rather than persisting
 * across two different rows — mounting a fresh component is the simplest way
 * to guarantee that.
 */
function EditorDialog<C extends object>({
  title,
  size,
  initial,
  form,
  validate,
  onSave,
  onSaved,
  onClose,
}: {
  title: string;
  size?: 'lg' | 'xl';
  initial: C;
  form: (draft: C, set: <K extends keyof C>(key: K, value: C[K]) => void) => ReactNode;
  validate?: (draft: C) => string | null;
  onSave: (input: C) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { draft, set } = useDraft<C>(initial);
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = async () => {
    const problem = validate?.(draft) ?? null;
    setInvalid(problem);
    if (problem) return;
    const ok = await run(() => onSave(draft));
    if (ok) onSaved();
  };

  return (
    <Modal
      title={title}
      size={size}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={submit} disabled={action.pending}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">{form(draft, set)}</div>
      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}

function DeleteDialog({
  label,
  onConfirm,
  onDone,
  onCancel,
}: {
  label: string;
  onConfirm: () => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [run, action] = useAction();
  return (
    <ConfirmDialog
      danger
      title="تأكيد الحذف"
      confirmLabel="حذف"
      pending={action.pending}
      message={
        <>
          راح ينحذف <span className="strong">{label}</span> نهائياً. ما تكدر ترجّعه من اللوحة.
          {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
        </>
      }
      onCancel={onCancel}
      onConfirm={async () => {
        const ok = await run(onConfirm);
        if (ok) onDone();
      }}
    />
  );
}
