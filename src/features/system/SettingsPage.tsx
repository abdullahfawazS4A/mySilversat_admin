/**
 * The operator's own account.
 *
 * This screen is deliberately narrow. The console was designed with a settings
 * page covering scoring rules, maintenance mode and support details — none of
 * which the API exposes: points are fixed in the backend, there is no
 * maintenance flag, and support details are rows in قنوات التواصل. What is
 * actually configurable from here is the signed-in admin's own profile and
 * password, so that is what the screen offers, and it says what it cannot do
 * rather than showing switches that go nowhere.
 *
 * A password change signs every other session out — the API stamps
 * `tokenInvalidatedAt` — so the form says so before it is submitted.
 */

import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useRepos } from '@/app/RepositoryContext';
import { useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import { Button, Card, CardHead, Field, KeyValue, Notice, Pill, TextInput } from '@/components/ui';
import { formatDateAr, formatPhone } from '@/lib/format';
import { ADMIN_ROLE, SCORING_NOTE } from '@/lib/labels';
import { SCORING } from '@/types';

export function SettingsPage() {
  const { session } = useAuth();
  const admin = session?.admin;

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="حسابك، وشنو ينضبط من اللوحة وشنو لا" />

      <div className="page">
        {admin ? (
          <Card pad>
            <CardHead
              title={admin.name}
              subtitle={formatPhone(admin.phone)}
              actions={<Pill tone={ADMIN_ROLE[admin.role].tone}>{ADMIN_ROLE[admin.role].label}</Pill>}
            />
            <div className="mt-3">
              <KeyValue
                rows={[
                  ['البريد الإلكتروني', admin.email ?? '—'],
                  ['تاريخ الإنشاء', formatDateAr(admin.createdAt)],
                ]}
              />
            </div>
          </Card>
        ) : null}

        <div className="grid grid-2">
          <ProfileCard />
          <PasswordCard />
        </div>

        <Card pad>
          <CardHead
            title="إعدادات ما تنضبط من هنا"
            subtitle="موجودة بالتصميم، بس السيرفر ما يوفّر إلها endpoints"
          />
          <div className="mt-3">
            <KeyValue
              rows={[
                [
                  'قواعد النقاط',
                  <>
                    ثابتة على السيرفر — <span className="num strong">{SCORING.exact}</span> للنتيجة
                    المطابقة و<span className="num strong">{SCORING.sameOutcome}</span> لنفس النتيجة.{' '}
                    {SCORING_NOTE}
                  </>,
                ],
                ['وضع الصيانة', 'ماكو مفتاح صيانة بالـ API.'],
                ['بيانات الدعم', 'تتضبط من شاشة «قنوات التواصل».'],
                ['صلاحيات المدراء', 'تتحدد بدور الحساب بالـ JWT، وما تنعدّل من اللوحة.'],
              ]}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function ProfileCard() {
  const { session } = useAuth();
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const admin = session?.admin;
  const [name, setName] = useState(admin?.name ?? '');
  const [email, setEmail] = useState(admin?.email ?? '');
  const [phone, setPhone] = useState(admin?.phone ?? '');

  const save = async () => {
    const ok = await run(() =>
      repos.auth.updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
    );
    if (ok) toast('انحفظت بياناتك — تظهر بعد إعادة تحميل الصفحة');
  };

  return (
    <Card pad>
      <CardHead title="بياناتي" subtitle="الاسم والبريد ورقم الهاتف" />

      <div className="grid grid-form mt-3">
        <Field label="الاسم">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="رقم الهاتف" hint="هو نفسه اسم الدخول، وعليه يوصل رمز التحقق">
          <TextInput type="tel" value={phone} onChange={setPhone} />
        </Field>
        <Field label="البريد الإلكتروني" className="span-2">
          <TextInput value={email} onChange={setEmail} />
        </Field>
      </div>

      {action.error ? <div className="field-error mt-2">{action.error}</div> : null}

      <div className="mt-4">
        <Button
          variant="primary"
          icon={<Save size={15} />}
          disabled={action.pending}
          onClick={() => void save()}
        >
          {action.pending ? 'جاري الحفظ…' : 'حفظ البيانات'}
        </Button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  const save = async () => {
    const problem = !current
      ? 'كلمة المرور الحالية مطلوبة'
      : next.length < 8
        ? 'كلمة المرور الجديدة لازم 8 خانات على الأقل'
        : next !== confirm
          ? 'التأكيد ما يطابق كلمة المرور الجديدة'
          : null;
    setInvalid(problem);
    if (problem) return;

    const ok = await run(() => repos.auth.changePassword(current, next));
    if (!ok) return;
    toast('انتغيّرت كلمة المرور');
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  return (
    <Card pad>
      <CardHead title="كلمة المرور" subtitle="غيّرها إذا تشك إنها انكشفت" />

      <div className="mt-3">
        <Notice tone="warning">
          تغيير كلمة المرور يقطع كل الجلسات الثانية المفتوحة بحسابك على أي جهاز.
        </Notice>
      </div>

      <div className="grid grid-form mt-3">
        <Field label="كلمة المرور الحالية" className="span-2">
          <TextInput type="password" value={current} onChange={setCurrent} />
        </Field>
        <Field label="كلمة المرور الجديدة">
          <TextInput type="password" value={next} onChange={setNext} />
        </Field>
        <Field label="تأكيد كلمة المرور">
          <TextInput type="password" value={confirm} onChange={setConfirm} />
        </Field>
      </div>

      {invalid || action.error ? (
        <div className="field-error mt-2">{invalid ?? action.error}</div>
      ) : null}

      <div className="mt-4">
        <Button
          variant="primary"
          icon={<KeyRound size={15} />}
          disabled={action.pending}
          onClick={() => void save()}
        >
          {action.pending ? 'جاري التغيير…' : 'تغيير كلمة المرور'}
        </Button>
      </div>
    </Card>
  );
}
