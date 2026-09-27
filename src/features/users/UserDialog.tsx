/**
 * Adding a subscriber, and editing one.
 *
 * One dialog for both, because the fields are the same five and a second copy
 * is how the edit path ends up missing the server — the one field that
 * decides where this person's receivers are checked and activated, and which
 * province they count in.
 *
 * The operator picks the province first and then a server in it, because
 * that is how they think about a subscriber. Only the server is sent: the API
 * has no province on a subscriber and refuses a `provinceId` outright, so the
 * province box is a filter over the servers, seeded from the current one.
 * Servers with no province yet get their own entry rather than vanishing.
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

/** The province box's entry for servers not yet given a province. */
const NO_PROVINCE = '__none__';

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

  // null until the operator touches it, so it can follow the current server
  // once the server list arrives instead of being fixed at first render.
  const [pickedProvince, setPickedProvince] = useState<string | null>(null);
  const provinceOfRegion = (id: Id) => {
    const region = (regions.data ?? []).find((row) => row.id === id);
    return region ? (region.provinceId ?? NO_PROVINCE) : '';
  };
  const provinceId = pickedProvince ?? provinceOfRegion(draft.silversatRegionId);

  const provinceOptions = useMemo(() => {
    const rows = (provinces.data ?? []).map((row) => ({ value: row.id as string, label: row.name }));
    const orphans = (regions.data ?? []).some((row) => !row.provinceId);
    return orphans ? [...rows, { value: NO_PROVINCE, label: 'سيرفرات بدون محافظة' }] : rows;
  }, [provinces.data, regions.data]);

  const regionOptions = useMemo(
    () =>
      (regions.data ?? [])
        .filter((row) => (row.provinceId ?? NO_PROVINCE) === provinceId)
        .map((row) => ({
          value: row.id,
          label: `${row.name}${row.isActive ? '' : ' (متوقف)'}`,
        })),
    [regions.data, provinceId],
  );

  const pickProvince = (next: string) => {
    setPickedProvince(next);
    if (provinceOfRegion(draft.silversatRegionId) !== next) set('silversatRegionId', '');
  };
  const [run, action] = useAction();
  const [invalid, setInvalid] = useState<string | null>(null);

  const password = draft.password?.trim() ?? '';

  const submit = async () => {
    const problem = !draft.name.trim()
      ? 'اسم المشترك مطلوب'
      : !draft.phone.trim()
        ? 'رقم الهاتف مطلوب'
        : !provinceId
          ? 'اختر المحافظة'
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

    // The API answers 200 to a server change it did not make — the other
    // fields land, the server stays — so the reply is checked, not trusted.
    const ok = await run(async () => {
      if (!user) return repos.appUsers.create(payload);
      const saved = await repos.appUsers.update(user.id, payload);
      if (saved.silversatRegionId !== payload.silversatRegionId) {
        throw new Error(
          'انحفظت باقي البيانات، بس الـ API ما غيّر السيرفر — تغيير سيرفر المشترك ما مدعوم من الباك إند حالياً',
        );
      }
      return saved;
    });
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
        <Field label="المحافظة" hint="تحدد السيرفرات اللي تقدر تختار منها">
          <Select<string>
            value={provinceId}
            onChange={pickProvince}
            options={[{ value: '', label: 'اختر المحافظة' }, ...provinceOptions]}
          />
        </Field>
        <Field label="سيرفر سلفرسات" hint="أجهزته تنفحص وتتفعّل على هذا السيرفر">
          <Select<Id>
            value={draft.silversatRegionId}
            onChange={(next) => set('silversatRegionId', next)}
            disabled={!provinceId}
            options={[
              {
                value: '',
                label: !provinceId
                  ? 'اختر المحافظة أولاً'
                  : regionOptions.length
                    ? 'اختر السيرفر'
                    : 'ما في سيرفر بهذه المحافظة',
              },
              ...regionOptions,
            ]}
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
