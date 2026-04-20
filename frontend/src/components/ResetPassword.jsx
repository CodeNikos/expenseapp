import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../hooks/useI18n';
import { resetPassword } from '../services/api';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

export default function ResetPassword() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirm) {
      setError(t('reset.errMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('reset.errLength'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await resetPassword({ token, password });
      setSuccess(res.message || t('reset.passwordUpdated'));
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-12">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{t('reset.invalidTitle')}</h1>
            <LanguageSwitcher className="shrink-0" />
          </div>
          <p className="text-sm text-slate-600">{t('reset.invalidHint')}</p>
          <Link className="text-sm font-medium text-sky-700 underline underline-offset-4" to="/login">
            {t('reset.backLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('reset.recovery')}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{t('reset.title')}</h1>
            <p className="text-sm text-slate-500">{t('reset.hint')}</p>
          </div>
          <LanguageSwitcher className="shrink-0" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">{t('reset.newPassword')}</span>
            <input
              className={inputClass}
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-600">{t('reset.confirm')}</span>
            <input
              className={inputClass}
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
          ) : null}
          {success ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {success}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? t('reset.saving') : t('reset.submit')}
          </button>
        </form>

        <Link className="text-sm font-medium text-sky-700 underline underline-offset-4" to="/login">
          {t('reset.backLogin')}
        </Link>
      </div>
    </div>
  );
}
