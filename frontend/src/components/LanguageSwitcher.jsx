import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30';

const loginSegmentBase =
  'relative min-w-[3.25rem] rounded-lg px-3.5 py-2 text-sm font-semibold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

export default function LanguageSwitcher({ className = '', variant = 'default' }) {
  const { isAuthenticated, updateLanguage, isBootstrapping } = useAuth();
  const { t, lang, setGuestLanguage } = useI18n();
  const [busy, setBusy] = useState(false);

  async function applyLanguage(next) {
    if (next === lang) {
      return;
    }
    if (isAuthenticated && updateLanguage) {
      setBusy(true);
      try {
        await updateLanguage(next);
      } finally {
        setBusy(false);
      }
    } else {
      setGuestLanguage(next);
    }
  }

  async function onChange(event) {
    const next = event.target.value === 'en' ? 'en' : 'es';
    await applyLanguage(next);
  }

  if (variant === 'login') {
    return (
      <div
        className={`flex flex-col items-end gap-1.5 sm:items-stretch ${className}`}
        role="group"
        aria-label={t('login.langLabel')}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t('login.langLabel')}</span>
        <div className="flex rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-1 shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
          <button
            type="button"
            disabled={busy || isBootstrapping}
            className={`${loginSegmentBase} ${
              lang === 'es'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => applyLanguage('es')}
            aria-pressed={lang === 'es'}
          >
            ES
          </button>
          <button
            type="button"
            disabled={busy || isBootstrapping}
            className={`${loginSegmentBase} ${
              lang === 'en'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            } disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => applyLanguage('en')}
            aria-pressed={lang === 'en'}
          >
            EN
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{t('login.langLabel')}</span>
      <select
        className={selectClass}
        value={lang}
        onChange={onChange}
        disabled={busy || isBootstrapping}
        aria-label={t('login.langLabel')}
      >
        <option value="es">{t('settings.langEs')}</option>
        <option value="en">{t('settings.langEn')}</option>
      </select>
    </label>
  );
}
