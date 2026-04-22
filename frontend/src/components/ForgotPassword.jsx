import { useState } from 'react';
import { Link } from 'react-router-dom';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { requestPasswordReset } from '../services/api';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

export default function ForgotPassword() {
  const { t } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await requestPasswordReset({ email: email.trim() });
      toast.success(res.message || t('forgot.checkEmail'));
      setDone(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('forgot.recovery')}</p>
            <h1 className="text-2xl font-semibold text-slate-900">{t('forgot.title')}</h1>
            <p className="text-sm text-slate-500">{t('forgot.hint')}</p>
          </div>
          <LanguageSwitcher className="shrink-0" />
        </div>

        {done ? (
          <p className="text-sm text-slate-600">{t('forgot.checkEmail')}</p>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">{t('forgot.email')}</span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? t('forgot.sending') : t('forgot.submit')}
            </button>
          </form>
        )}

        <Link
          className="inline-block text-sm font-medium text-sky-700 underline decoration-sky-300 underline-offset-4 hover:text-sky-900"
          to="/login"
        >
          {t('forgot.backLogin')}
        </Link>
      </div>
    </div>
  );
}
