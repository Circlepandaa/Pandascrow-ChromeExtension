import { useEffect, useState, type FormEvent } from 'react';
import logo from '@/assets/logo.png';
import { ApiError, login, loginWithAuthenticator, loginWithEmailCode, type LoginStep } from '@/lib/api';
import { dashboardUrl, type Env } from '@/lib/env';
import { isEmail } from '@/lib/format';
import { getSettings, saveSettings, type Session } from '@/lib/storage';
import { Button, ErrorBox, Field, Input, PasswordInput, cn } from '../ui';

type Step = { kind: 'password' } | { kind: 'email-code'; message: string } | { kind: 'authenticator'; token: string; message: string };

export function Login({ onSignedIn, pendingDraft }: { onSignedIn: (s: Session) => void; pendingDraft?: boolean }) {
  const [env, setEnv] = useState<Env>('live');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => setEnv(s.lastEnv));
  }, []);

  const handle = async (result: Promise<LoginStep>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await result;
      if (next.kind === 'done') {
        await saveSettings({ lastEnv: env });
        chrome.runtime.sendMessage({ type: 'signed-in' }).catch(() => undefined);
        onSignedIn(next.session);
      } else if (next.kind === 'email-code') {
        setCode('');
        setStep({ kind: 'email-code', message: next.message });
      } else {
        setCode('');
        setStep({ kind: 'authenticator', token: next.twoFactorToken, message: next.message });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const creds = { env, apiKey: apiKey.trim() };
    if (step.kind === 'password') {
      if (!creds.apiKey) return setError(`Paste your ${env} API key from Developers → API keys.`);
      if (!isEmail(email)) return setError('Enter a valid email address.');
      if (!password) return setError('Enter your password.');
      void handle(login(creds, email.trim(), password));
    } else if (step.kind === 'email-code') {
      if (!code.trim()) return setError('Enter the code from your email.');
      void handle(loginWithEmailCode(creds, email.trim(), code.trim()));
    } else {
      if (!code.trim()) return setError('Enter the code from your authenticator app.');
      void handle(loginWithAuthenticator(creds, step.token, code.trim()));
    }
  };

  return (
    <div className="flex flex-col min-h-[600px] px-6 pt-6 pb-5">
      <img src={logo} alt="Pandascrow" className="h-7 w-auto self-start" />

      <form onSubmit={submit} className="flex flex-col gap-4 mt-7 flex-1" noValidate>
        {step.kind === 'password' ? (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-semibold tracking-tight leading-tight">Sign in to Pandascrow</h1>
              {pendingDraft ? <p className="text-sm text-mid-gray">Sign in to protect this purchase with escrow.</p> : null}
            </div>
            <Field
              label={env === 'live' ? 'Live API key' : 'Sandbox API key'}
              hint="Dashboard → Developers → API keys. Saved only in this browser."
              aside={
                <a href={dashboardUrl(env, '/developers')} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-coral underline underline-offset-2">
                  Get key
                </a>
              }
            >
              <PasswordInput autoComplete="off" spellCheck={false} placeholder="pk_live_…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoFocus />
            </Field>
            <Field label="Email">
              <Input type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field
              label="Password"
              aside={
                <a href={dashboardUrl(env, '/auth/forgot-password')} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-coral underline underline-offset-2">
                  Forgot password?
                </a>
              }
            >
              <PasswordInput autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-semibold tracking-tight leading-tight">{step.kind === 'email-code' ? 'Check your email' : 'Two-step verification'}</h1>
              <p className="text-sm text-mid-gray">{step.message}</p>
            </div>
            <Field label={step.kind === 'email-code' ? 'Sign-in code' : 'Authenticator or recovery code'}>
              <Input inputMode={step.kind === 'email-code' ? 'numeric' : 'text'} autoComplete="one-time-code" placeholder="Enter code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </Field>
          </>
        )}

        {error ? <ErrorBox message={error} /> : null}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {step.kind === 'password' ? 'Sign In' : 'Verify'}
        </Button>

        {step.kind !== 'password' ? (
          <button type="button" onClick={() => { setStep({ kind: 'password' }); setError(null); }} className="text-sm text-mid-gray hover:text-brand-black cursor-pointer">
            Use a different account
          </button>
        ) : (
          <p className="text-sm text-center border-t border-border-gray pt-4">
            New to Pandascrow?{' '}
            <a href={dashboardUrl(env, '/auth/signup')} target="_blank" rel="noreferrer" className="text-brand-coral font-medium">
              Create an account
            </a>
          </p>
        )}
      </form>

      {step.kind === 'password' ? (
        <div className="flex items-center justify-center gap-2 text-xs text-light-gray mt-4">
          <span>Account:</span>
          {(['live', 'sandbox'] as Env[]).map((e) => (
            <button key={e} type="button" onClick={() => setEnv(e)} className={cn('px-2.5 h-6 rounded-full cursor-pointer', env === e ? 'bg-brand-black text-white' : 'hover:bg-g-gray text-mid-gray')}>
              {e === 'live' ? 'Live' : 'Sandbox (test)'}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
