/**
 * Adding a subscriber, and editing one.
 *
 * One dialog for both, because the fields are the same five and a second copy
 * is how the edit path ends up missing the province — the one field that
 * quietly decides whether this person can register a receiver at all.
 *
 * Two things differ by mode, and both are about the password. On a create it
 * is offered and may be left blank, because support usually sets the account
 * up and lets the customer claim it through the app's own OTP flow. On an edit
 * a blank box means **leave the password alone**, so it is never sent empty —
 * the same rule the server credentials follow, for the same reason: you cannot
 * show what is stored, so an empty box cannot mean "clear it".
 */

import { useState } from 'react';
import { Button, Field, Modal, Select, TextInput, useDraft } from '@/components/ui';
import { useAction } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { AppUser, Id } from '@/types';
import type { AppUserInput } from '@/data/repositories/types';

/** The API's own floor. Enforced here so it is not a 400 with a field list. */
const MIN_PASSWORD = 8;

export function UserDialog({
  user,
  provinceOptions,
  onClose,
  onSaved,
}: {
  /** The subscriber being edited, or null to add one. */
  user: AppUser | null;
  provinceOptions: { value: Id; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { draft, set } = useDraft<AppUserInput>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    provinceId: user?.provinceId ?? provinceOptions[0]?.value ?? '',
    email: user?.email ?? '',
    password: '',
  });
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const password = draft.password?.trim() ?? '';

  const submit = async () => {
    const problem = !draft.name.trim()
      ? 'اسم المشترك مطلوب'
      : !draft.phone.trim()
        ? 'رقم الهاتف مطلوب'
        : !draft.provinceId
          ? 'اختر المحافظة'
          : password && password.length < MIN_PASSWORD
            ? `كلمة المرور لازم تكون ${MIN_PASSWORD} أحرف على الأقل`
            : null;
    setInvalid(problem);
    if (problem) return;

    // Empty email clears it — the API reads null as "no address" — while an
    // empty password is an absence, and absence is how you leave one alone.
    const payload = {
      ...draft,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      email: draft.email?.trim() ? draft.email.trim() : null,
      password: password || undefined,
    };

    const ok = await run(() =>
      user ? repos.appUsers.update(user.id, payload) : repos.appUsers.create(payload),
    );
    if (ok) onSaved();
  };

  return (
    <Modal
      title={user ? `تعديل ${user.name}` : 'إضافة مشترك'}
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
      <div className="grid grid-form">
        <Field label="الاسم">
          <TextInput value={draft.name} onChange={(next) => set('name', next)} />
        </Field>
        <Field label="رقم الهاتف">
          <TextInput
            type="tel"
            value={draft.phone}
            onChange={(next) => set('phone', next)}
            placeholder="07XXXXXXXXX"
          />
        </Field>
        <Field
          label="المحافظة"
          hint={user ? 'تغييرها يغيّر السيرفر اللي تنسجّل عليه أجهزته الجديدة' : undefined}
        >
          <Select<Id>
            value={draft.provinceId}
            onChange={(next) => set('provinceId', next)}
            options={provinceOptions}
          />
        </Field>
        <Field label="البريد الإلكتروني" hint="اختياري — فرّغه حتى تشيله">
          <TextInput value={draft.email ?? ''} onChange={(next) => set('email', next)} />
        </Field>
        <Field
          label="كلمة المرور"
          hint={
            user
              ? 'اتركها فارغة إذا ما تريد تغيّرها'
              : `اختيارية — يكدر يفعّل حسابه من التطبيق (${MIN_PASSWORD} أحرف على الأقل)`
          }
        >
          <TextInput
            type="password"
            value={draft.password ?? ''}
            onChange={(next) => set('password', next)}
          />
        </Field>
      </div>
      {invalid || action.error ? (
        <div className="field-error mt-3">{invalid ?? action.error}</div>
      ) : null}
    </Modal>
  );
}
