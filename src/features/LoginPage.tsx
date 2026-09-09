/**
 * Admin sign-in.
 *
 * The console has one account and no roles. The credentials stay on the card
 * on purpose: this is a UI prototype with no real authentication behind it.
 */

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Satellite } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Button, Card, Field, Notice, TextInput } from '@/components/ui';

export function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('silversat');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={submit}>
          <div className="row row-gap-3">
            <span className="brand-mark" style={{ width: 42, height: 42 }}>
              <Satellite size={21} />
            </span>
            <div className="col">
              <span className="section-title">لوحة تحكم سلفرسات</span>
              <span className="section-sub">إدارة الاشتراكات والمسابقة والمحتوى</span>
            </div>
          </div>

          <Field label="اسم المستخدم">
            <TextInput value={username} onChange={setUsername} placeholder="admin" />
          </Field>

          <Field label="كلمة المرور" hint="أي كلمة مرور من 4 أحرف فما فوق تُقبل في النسخة التجريبية">
            <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••" />
          </Field>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          <Button type="submit" variant="primary" disabled={pending} icon={<LogIn size={16} />}>
            {pending ? 'جاري الدخول…' : 'دخول'}
          </Button>

          <span className="fs-11 dim">الحساب التجريبي: admin</span>
        </form>
      </Card>
    </div>
  );
}
