/**
 * Admin sign-in — two panels, because the API makes it two calls.
 *
 * The password buys a challenge and an SMS, the six-digit code buys the token.
 * Only the second step authenticates, so the screen holds the challenge
 * between them and counts its five minutes down: a code typed after the
 * challenge expires fails with a message that reads like a wrong code, and the
 * countdown is what tells the operator it was neither.
 *
 * Resending replaces the challenge, so the timer restarts from the new one.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, LogIn, Satellite, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Button, Card, Field, Notice, TextInput } from '@/components/ui';
import type { OtpChallenge } from '@/types';

export function LoginPage() {
  const { status, signIn, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const failWith = (err: unknown, fallback: string) =>
    setError(err instanceof Error ? err.message : fallback);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const next = await signIn(phone, password);
      setChallenge(next);
      setCode('');
    } catch (err) {
      failWith(err, 'تعذّر تسجيل الدخول');
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    setPending(true);
    setError(null);
    try {
      await verifyOtp(challenge.challengeToken, code);
      navigate('/', { replace: true });
    } catch (err) {
      failWith(err, 'الرمز غير صحيح');
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    setPending(true);
    setError(null);
    try {
      await resendOtp(challenge.challengeToken);
      // The challenge token survives a resend; only the clock restarts.
      setChallenge({ ...challenge, expiresInSeconds: challenge.expiresInSeconds });
      setNotice('انبعث رمز جديد.');
    } catch (err) {
      failWith(err, 'تعذّر إرسال رمز جديد');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="col" style={{ gap: 'var(--sp-4)' }}>
          <div className="row row-gap-3">
            <span className="brand-mark" style={{ width: 42, height: 42 }}>
              <Satellite size={21} />
            </span>
            <div className="col">
              <span className="section-title">لوحة تحكم سلفرسات</span>
              <span className="section-sub">إدارة الاشتراكات والمسابقة والمحتوى</span>
            </div>
          </div>

          {challenge ? (
            <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={submitCode}>
              <Notice tone="info" icon={<ShieldCheck size={16} />}>
                انبعث رمز تحقّق من ٦ أرقام على <span className="num strong">{challenge.maskedPhone}</span>
              </Notice>

              <Field label="رمز التحقّق" hint="٦ أرقام وصلتك برسالة نصية">
                <TextInput
                  value={code}
                  onChange={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                />
              </Field>

              <Countdown seconds={challenge.expiresInSeconds} key={challenge.challengeToken + notice} />

              {error ? <Notice tone="danger">{error}</Notice> : null}
              {notice ? <Notice tone="success">{notice}</Notice> : null}

              <Button
                type="submit"
                variant="primary"
                disabled={pending || code.length < 6}
                icon={<KeyRound size={16} />}
              >
                {pending ? 'جاري التحقّق…' : 'تأكيد الرمز'}
              </Button>

              <div className="row row-gap-2">
                <Button variant="ghost" size="sm" onClick={resend} disabled={pending}>
                  إرسال رمز جديد
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowRight size={14} />}
                  disabled={pending}
                  onClick={() => {
                    setChallenge(null);
                    setError(null);
                    setNotice(null);
                  }}
                >
                  رجوع
                </Button>
              </div>
            </form>
          ) : (
            <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={submitPassword}>
              <Field label="رقم الهاتف" hint="بصيغة 07XXXXXXXXX">
                <TextInput
                  type="tel"
                  value={phone}
                  onChange={(next) => setPhone(next.replace(/\D/g, '').slice(0, 11))}
                  placeholder="07700000000"
                />
              </Field>

              <Field label="كلمة المرور">
                <TextInput type="password" value={password} onChange={setPassword} placeholder="••••••••" />
              </Field>

              {error ? <Notice tone="danger">{error}</Notice> : null}

              <Button
                type="submit"
                variant="primary"
                disabled={pending || phone.length < 10 || !password}
                icon={<LogIn size={16} />}
              >
                {pending ? 'جاري الإرسال…' : 'إرسال رمز التحقّق'}
              </Button>

              <span className="fs-11 dim">
                الدخول بخطوتين: كلمة المرور تبعث رمز على هاتفك، والرمز يفتح اللوحة.
              </span>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Counts the challenge down so an expiry is not mistaken for a wrong code. */
function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, seconds - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  if (left === 0) {
    return <span className="fs-12" style={{ color: 'var(--danger)' }}>انتهت صلاحية الرمز — اطلب رمز جديد.</span>;
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className="fs-12 muted">
      ينتهي الرمز خلال <span className="num strong">{mm}:{ss}</span>
    </span>
  );
}
