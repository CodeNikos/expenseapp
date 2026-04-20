import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';

const initialRegisterState = {
  email: '',
  full_name: '',
  password: '',
  confirmPassword: '',
};

const initialLoginState = {
  email: '',
  password: '',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const { login, register, isBootstrapping, isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [loginState, setLoginState] = useState(initialLoginState);
  const [registerState, setRegisterState] = useState(initialRegisterState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated) {
      return;
    }
    navigate(from, { replace: true });
  }, [isAuthenticated, isBootstrapping, from, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(loginState);
      } else {
        if (registerState.password !== registerState.confirmPassword) {
          throw new Error(t('login.errPasswordMismatch'));
        }

        const fullName = registerState.full_name.trim();
        if (fullName.length < 2) {
          throw new Error(t('login.errNameLength'));
        }
        if (registerState.password.length < 8) {
          throw new Error(t('login.errPasswordLength'));
        }

        await register({
          email: registerState.email.trim(),
          full_name: fullName,
          password: registerState.password,
        });
        setSuccess(t('login.successCreated'));
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  const fields = mode === 'login' ? loginState : registerState;
  const setFields = mode === 'login' ? setLoginState : setRegisterState;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between border-r border-slate-100 bg-gradient-to-br from-sky-50 to-indigo-50 p-10 lg:flex">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-sky-200 bg-white px-4 py-1.5 text-sm font-medium text-sky-800 shadow-sm">
              {t('login.badge')}
            </span>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-slate-900">{t('login.heroTitle')}</h1>
              <p className="max-w-md text-slate-600">{t('login.heroText')}</p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto max-w-md space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('login.access')}</p>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {mode === 'login' ? t('login.signIn') : t('login.signUp')}
                </h2>
                <p className="text-slate-500">{mode === 'login' ? t('login.signInHint') : t('login.signUpHint')}</p>
              </div>
              <LanguageSwitcher variant="login" className="shrink-0" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">{t('login.email')}</span>
                <input
                  className={inputClass}
                  type="email"
                  value={fields.email}
                  onChange={(event) => setFields((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </label>

              {mode === 'register' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">{t('login.fullName')}</span>
                  <input
                    className={inputClass}
                    type="text"
                    minLength={2}
                    value={registerState.full_name}
                    onChange={(event) => setRegisterState((prev) => ({ ...prev, full_name: event.target.value }))}
                    required
                  />
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">
                  {t('login.password')}
                  {mode === 'register' ? t('login.passwordRegisterHint') : ''}
                </span>
                <input
                  className={inputClass}
                  type="password"
                  minLength={mode === 'register' ? 8 : undefined}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={fields.password}
                  onChange={(event) => setFields((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
              </label>

              {mode === 'login' ? (
                <div className="text-right">
                  <Link
                    className="text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900"
                    to="/forgot-password"
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>
              ) : null}

              {mode === 'register' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">{t('login.confirmPassword')}</span>
                  <input
                    className={inputClass}
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={registerState.confirmPassword}
                    onChange={(event) =>
                      setRegisterState((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    required
                  />
                </label>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
              ) : null}
              {success ? (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {success}
                </p>
              ) : null}

              <button
                className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={submitting || isBootstrapping}
              >
                {submitting
                  ? t('login.submitProcessing')
                  : mode === 'login'
                    ? t('login.submitEnter')
                    : t('login.submitCreate')}
              </button>
            </form>

            <button
              type="button"
              className="text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-900"
              onClick={() => {
                setError('');
                setSuccess('');
                setMode((prev) => (prev === 'login' ? 'register' : 'login'));
              }}
            >
              {mode === 'login' ? t('login.toggleNeedAccount') : t('login.toggleHaveAccount')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
