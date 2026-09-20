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
 *
 * The card has a third face: recovering a forgotten password. It is a separate
 * pair of calls against a separate challenge, and it ends where it started —
 * at the password panel, with a new password to type — because the API answers
 * a reset with no token. Keeping it inside this card rather than on its own
 * route is what lets the success message land on the form that needs it.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  KeyRound,
  LifeBuoy,
  LogIn,
  MessageCircle,
  Satellite,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { Button, Card, Field, Notice, TextInput } from '@/components/ui';
import type { OtpChallenge, ResetChallenge } from '@/types';

/** The API refuses anything shorter, so the form does too. */
const MIN_PASSWORD = 6;

export function LoginPage() {
  const { status } = useAuth();
  const location = useLocation();

  /** Which face of the card is showing. */
  const [mode, setMode] = useState<'signIn' | 'reset'>('signIn');
  /** Carried out of a finished reset and onto the sign-in form. */
  const [handover, setHandover] = useState<string | null>(null);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

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

          {mode === 'signIn' ? (
            <SignInForm
              handover={handover}
              onHandoverSeen={() => setHandover(null)}
              onForgot={() => setMode('reset')}
            />
          ) : (
            <ResetForm
              onDone={(message) => {
                setHandover(message);
                setMode('signIn');
              }}
              onCancel={() => setMode('signIn')}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

/** Password, then the SMS code. The only path that produces a session. */
function SignInForm({
  handover,
  onHandoverSeen,
  onForgot,
}: {
  /** A message from a finished reset, shown once above the password field. */
  handover: string | null;
  onHandoverSeen: () => void;
  onForgot: () => void;
}) {
  const { signIn, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const failWith = (err: unknown, fallback: string) =>
    setError(err instanceof Error ? err.message : fallback);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    onHandoverSeen();
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

  if (challenge) {
    return (
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
    );
  }

  return (
    <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={submitPassword}>
      {handover ? <Notice tone="success">{handover}</Notice> : null}

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

      <div className="row row-gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<LifeBuoy size={14} />}
          disabled={pending}
          onClick={onForgot}
        >
          نسيت كلمة المرور
        </Button>
      </div>

      <span className="fs-tiny dim">
        الدخول بخطوتين: كلمة المرور تبعث رمز على هاتفك، والرمز يفتح اللوحة.
      </span>
    </form>
  );
}

/**
 * Recovering a forgotten password.
 *
 * Two panels again, and deliberately worded differently from the sign-in ones:
 * the code travels over WhatsApp here, not SMS, and an operator staring at an
 * empty inbox needs to be told which one to look in.
 *
 * The first panel's confirmation cannot say "we sent you a code", because the
 * API answers a number with no account exactly the same way it answers one
 * with — that is what stops the form being used to discover who the admins
 * are. So it says what was *asked for* and leaves the outcome open.
 */
function ResetForm({
  onDone,
  onCancel,
}: {
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const { forgotPassword, resetPassword, resendResetOtp } = useAuth();

  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<ResetChallenge | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const failWith = (err: unknown, fallback: string) =>
    setError(err instanceof Error ? err.message : fallback);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const next = await forgotPassword(phone);
      setChallenge(next);
      setCode('');
    } catch (err) {
      failWith(err, 'تعذّر إرسال رمز الاسترجاع');
    } finally {
      setPending(false);
    }
  };

  /**
   * What is wrong with the new password, as it is being typed.
   *
   * Said out loud rather than only disabling the button: a submit that will not
   * fire and no reason why is the same dead end as a rejected request, without
   * even the server's sentence to explain it. Each rule stays quiet until the
   * field it judges has something in it.
   */
  const invalid =
    password && password.length < MIN_PASSWORD
      ? `كلمة المرور لازم ${MIN_PASSWORD} خانات على الأقل.`
      : confirm && password !== confirm
        ? 'الكلمتين مو نفسها.'
        : null;

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!challenge) return;
    if (invalid) return;
    setPending(true);
    setError(null);
    try {
      await resetPassword(challenge.challengeToken, code, password);
      onDone('انتغيّرت كلمة المرور — سجّل دخول بالكلمة الجديدة.');
    } catch (err) {
      failWith(err, 'تعذّر تغيير كلمة المرور');
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    if (!challenge) return;
    setPending(true);
    setError(null);
    try {
      await resendResetOtp(challenge.challengeToken);
      setNotice('انبعث رمز جديد على واتساب.');
    } catch (err) {
      failWith(err, 'تعذّر إرسال رمز جديد');
    } finally {
      setPending(false);
    }
  };

  if (challenge) {
    const ready = code.length === 6 && password.length >= MIN_PASSWORD && password === confirm;

    return (
      <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={submitReset}>
        <Notice tone="info" icon={<MessageCircle size={16} />}>
          إذا هذا الرقم عنده حساب، يوصله رمز من ٦ أرقام على{' '}
          <span className="strong">واتساب</span>
          {challenge.maskedPhone ? (
            <>
              {' '}
              — <span className="num strong">{challenge.maskedPhone}</span>
            </>
          ) : null}
          .
        </Notice>

        <Field label="رمز الاسترجاع" hint="٦ أرقام وصلتك بواتساب">
          <TextInput
            value={code}
            onChange={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
            placeholder="------"
          />
        </Field>

        <Field label="كلمة المرور الجديدة" hint={`${MIN_PASSWORD} خانات على الأقل`}>
          <TextInput
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
        </Field>

        <Field label="أعد كتابة كلمة المرور">
          <TextInput type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" />
        </Field>

        {/* Only shown when the challenge actually carried a clock. */}
        {challenge.expiresInSeconds ? (
          <Countdown
            seconds={challenge.expiresInSeconds}
            key={challenge.challengeToken + notice}
          />
        ) : null}

        {invalid ? <Notice tone="warning">{invalid}</Notice> : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}

        <Button
          type="submit"
          variant="primary"
          disabled={pending || !ready}
          icon={<KeyRound size={16} />}
        >
          {pending ? 'جاري الحفظ…' : 'تعيين كلمة المرور'}
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
    );
  }

  return (
    <form className="col" style={{ gap: 'var(--sp-4)' }} onSubmit={requestCode}>
      <Notice tone="info" icon={<LifeBuoy size={16} />}>
        اكتب رقم هاتفك وراح يوصلك رمز على <span className="strong">واتساب</span> تغيّر بيه كلمة
        المرور.
      </Notice>

      <Field label="رقم الهاتف" hint="بصيغة 07XXXXXXXXX">
        <TextInput
          type="tel"
          value={phone}
          onChange={(next) => setPhone(next.replace(/\D/g, '').slice(0, 11))}
          placeholder="07700000000"
        />
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={pending || phone.length < 10}
        icon={<MessageCircle size={16} />}
      >
        {pending ? 'جاري الإرسال…' : 'إرسال رمز الاسترجاع'}
      </Button>

      <div className="row row-gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowRight size={14} />}
          disabled={pending}
          onClick={onCancel}
        >
          رجوع لتسجيل الدخول
        </Button>
      </div>
    </form>
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
    return <span className="fs-small" style={{ color: 'var(--danger)' }}>انتهت صلاحية الرمز — اطلب رمز جديد.</span>;
  }

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <span className="fs-small muted">
      ينتهي الرمز خلال <span className="num strong">{mm}:{ss}</span>
    </span>
  );
}
