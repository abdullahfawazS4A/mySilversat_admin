/**
 * Admin sign-in.
 *
 * The demo accounts are listed on the card on purpose: this is a UI prototype
 * with no real authentication, and hiding the credentials would only make it
 * harder to show the role-based permission behaviour to the client.
 */

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Satellite } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Button, Card, Field, Notice, TextInput } from '@/components/ui';
import { ADMIN_ROLES } from '@/data/seed';

const DEMO_ACCOUNTS = [
  { username: 'admin', role: 'owner' },
  { username: 'ops.mustafa', role: 'operations' },
  { username: 'content.noor', role: 'content' },
  { username: 'support.hasan', role: 'support' },
] as const;

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

          <div className="col" style={{ gap: 6 }}>
            <span className="fs-11 dim">حسابات تجريبية — كل واحد بصلاحيات مختلفة:</span>
            <div className="row wrap row-gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className="chip"
                  onClick={() => setUsername(account.username)}
                >
                  {account.username}
                  <span className="dim">
                    {ADMIN_ROLES.find((role) => role.key === account.role)?.nameAr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
