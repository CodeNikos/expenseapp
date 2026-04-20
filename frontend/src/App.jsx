import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import ExpenseHistory from './components/ExpenseHistory';
import ExpenseWorkspace from './components/ExpenseWorkspace';
import ForgotPassword from './components/ForgotPassword';
import LanguageSwitcher from './components/LanguageSwitcher';
import LoginForm from './components/LoginForm';
import ResetPassword from './components/ResetPassword';
import Settings from './components/Settings';
import { useAuth } from './hooks/useAuth';
import { useI18n } from './hooks/useI18n';
import { usePWA } from './hooks/usePWA';
import { getIntegrationSettings } from './services/api';

function navLinkClass({ isActive }) {
  return [
    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition',
    isActive ? 'bg-sky-50 text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ');
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        {t('app.restoreSession')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AuthenticatedLayout() {
  const { logout, token, user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';
  const { canInstall, offlineReady, promptInstall, updateAvailable } = usePWA();
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadSettings() {
      try {
        const payload = await getIntegrationSettings(token);
        if (!ignore) {
          setSettings(payload);
          setSettingsError('');
        }
      } catch (error) {
        if (!ignore) {
          setSettingsError(error.message);
        }
      }
    }

    loadSettings();

    return () => {
      ignore = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/90 bg-white shadow-[4px_0_24px_rgba(15,23,42,0.04)] lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-lg text-white shadow-md shadow-sky-500/25">
            📄
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ExpenseApp</p>
            <p className="text-sm font-semibold text-slate-900">{t('app.brandSub')}</p>
          </div>
        </div>

        <p className="px-5 pt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{t('app.navHome')}</p>
        <nav className="flex flex-col gap-0.5 px-3 py-3">
          <NavLink to="/" end className={navLinkClass}>
            {t('app.capture')}
          </NavLink>
          <NavLink to="/history" className={navLinkClass}>
            {t('app.history')}
          </NavLink>
          {isAdmin ? (
            <NavLink to="/settings" className={navLinkClass}>
              {t('app.settings')}
            </NavLink>
          ) : null}
        </nav>

        <div className="mt-auto space-y-3 border-t border-slate-100 p-4">
          <LanguageSwitcher className="justify-center lg:justify-start" />
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="truncate text-sm font-medium text-slate-900">{user?.full_name || user?.email}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              onClick={logout}
            >
              {t('app.logout')}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:max-w-none lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 lg:hidden">
                📄
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('app.panel')}</p>
                <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-xl">
                  {t('app.hello')}, {user?.full_name || user?.email}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <nav className="flex lg:hidden">
                <Link
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  to="/"
                >
                  {t('app.capture')}
                </Link>
                <Link
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  to="/history"
                >
                  {t('app.history')}
                </Link>
                {isAdmin ? (
                  <Link
                    className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    to="/settings"
                  >
                    {t('app.settingsShort')}
                  </Link>
                ) : null}
              </nav>
              {canInstall ? (
                <button
                  type="button"
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:bg-sky-100"
                  onClick={promptInstall}
                >
                  {t('app.installApp')}
                </button>
              ) : null}
              <button
                type="button"
                className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
                onClick={logout}
              >
                {t('app.exit')}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:max-w-none lg:px-8 lg:py-8">
          {offlineReady ? (
            <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
              {t('app.offlineReady')}
            </p>
          ) : null}

          {updateAvailable ? (
            <p className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm">
              {t('app.updateAvailable')}
            </p>
          ) : null}

          {settingsError ? (
            <p className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 shadow-sm">
              {settingsError}
            </p>
          ) : null}

          <Routes>
            <Route path="/" element={<ExpenseWorkspace integrationSettings={settings} />} />
            <Route path="/history" element={<ExpenseHistory />} />
            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <Settings onSaved={setSettings} />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AuthenticatedLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
