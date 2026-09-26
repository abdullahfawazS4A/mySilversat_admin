/**
 * Adding a subscriber, and editing one.
 *
 * One dialog for both, because the fields are the same five and a second copy
 * is how the edit path ends up missing the server — the one field that
 * decides where this person's receivers are checked and activated, and which
 * province they count in. The picker names each server's province beside it,
 * because that is the only place the operator sees the province at all.
 *
 * Two things differ by mode, and both are about the password. On a create it
 * is required — the API refuses an account without one. On an edit a blank
 * box means **leave the password alone**, so it is never sent empty —
 * the same rule the server credentials follow, for the same reason: you cannot
 * show what is stored, so an empty box cannot mean "clear it".
 */

import { useMemo, useState } from 'react';
import { Button, Field, Modal, Select, TextInput, useDraft } from '@/components/ui';
import { useAction, useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { AppUser, Id } from '@/types';
import type { AppUserInput } from '@/data/repositories/types';

/** The API's own floor. Enforced here so it is not a 400 with a field list. */
const MIN_PASSWORD = 8;

export function UserDialog({
  user,
  onClose,
  onSaved,
}: {
  /** The subscriber being edited, or null to add one. */
  user: AppUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { draft, set } = useDraft<AppUserInput>({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    silversatRegionId: user?.silversatRegionId ?? '',
    email: user?.email ?? '',
    password: '',
  });

  const regions = useAsync(() => repos.regions.all(), []);
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const regionOptions = useMemo(() => {
    const names = new Map((provinces.data ?? []).map((row) => [row.id, row.name]));
    return (regions.data ?? []).map((row) => ({
      value: row.id,
      label: `${row.name} — ${(row.provinceId && names.get(row.provinceId)) || 'بدون محافظة'}${
        row.isActive ? '' : ' (متوقف)'
      }`,
    }));
  }, [regions.data, provinces.data]);
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const password = draft.password?.trim() ?? '';

  const submit = async () => {
    const problem = !draft.name.trim()
      ? 'اسم المشترك مطلوب'
      : !draft.phone.trim()
        ? 'رقم الهاتف مطلوب'
        : !draft.silversatRegionId
          ? 'اختر السيرفر'
          : !user && !password
            ? 'كلمة المرور مطلوبة'
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
          label="سيرفر سلفرسات"
          hint={
            user
              ? 'أجهزته تنفحص وتتفعّل على هذا السيرفر، ومحافظته هي محافظة السيرفر. إذا عنده أجهزة، السيرفر ممكن يرفض التغيير'
              : 'أجهزته تنفحص وتتفعّل على هذا السيرفر، ومحافظته هي محافظة السيرفر'
          }
        >
          <Select<Id>
            value={draft.silversatRegionId}
            onChange={(next) => set('silversatRegionId', next)}
            options={[{ value: '', label: 'اختر السيرفر' }, ...regionOptions]}
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
              : `${MIN_PASSWORD} أحرف على الأقل`
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
