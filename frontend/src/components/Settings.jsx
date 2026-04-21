import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createAdminUser,
  getAdminUserIntegrations,
  listAdminUsers,
  testAdminUserOdoo,
  updateAdminUserIntegrations,
} from '../services/api';
import LanguageSwitcher from './LanguageSwitcher';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';

const defaultState = {
  mistral_api_key: '',
  odoo_url: '',
  odoo_db: '',
  odoo_login: '',
  odoo_api_key: '',
  odoo_expense_model: 'hr.expense',
  odoo_employee_id: null,
  odoo_expense_product_id: null,
  has_mistral_api_key: false,
  has_odoo_api_key: false,
};

const initialCreateUser = {
  email: '',
  full_name: '',
  password: '',
  confirmPassword: '',
  role: 'user',
};

/** [fieldName, translation key under settings.*, input kind] */
const FIELD_DEF_KEYS = [
  ['mistral_api_key', 'fieldMistral', 'text'],
  ['odoo_url', 'fieldOdooUrl', 'text'],
  ['odoo_db', 'fieldOdooDb', 'text'],
  ['odoo_login', 'fieldOdooLogin', 'text'],
  ['odoo_employee_id', 'fieldEmployeeId', 'number'],
  ['odoo_expense_product_id', 'fieldProductId', 'number'],
  ['odoo_api_key', 'fieldOdooKey', 'password'],
  ['odoo_expense_model', 'fieldExpenseModel', 'text'],
];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

function KeyBadge({ ok, label, readyLabel, pendingLabel }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border border-slate-200 bg-slate-50 text-slate-600'
      }`}
    >
      {label}
      {ok ? readyLabel : pendingLabel}
    </span>
  );
}

export default function Settings({ onSaved }) {
  const { token, user } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [form, setForm] = useState(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createFields, setCreateFields] = useState(initialCreateUser);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const list = await listAdminUsers(token);
      setUsers(list);
    } catch (loadErr) {
      setUsersError(loadErr.message);
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }
    setSelectedUserId((prev) => {
      if (prev != null && users.some((row) => row.id === prev)) {
        return prev;
      }
      if (user?.id && users.some((row) => row.id === user.id)) {
        return user.id;
      }
      return users[0].id;
    });
  }, [users, user?.id]);

  useEffect(() => {
    if (selectedUserId == null) {
      return;
    }

    let ignore = false;

    async function loadSettings() {
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const payload = await getAdminUserIntegrations(token, selectedUserId);
        if (!ignore) {
          setForm((prev) => ({ ...defaultState, ...payload }));
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      ignore = true;
    };
  }, [token, selectedUserId]);

  const isConfigured = useMemo(
    () =>
      Boolean(
        form.has_mistral_api_key &&
          form.odoo_url &&
          form.odoo_db &&
          form.odoo_login &&
          form.has_odoo_api_key,
      ),
    [form],
  );

  const selectedLabel = useMemo(() => {
    const u = users.find((row) => row.id === selectedUserId);
    if (!u) {
      return '';
    }
    return `${u.full_name} (${u.email})`;
  }, [users, selectedUserId]);

  const fieldDefs = useMemo(
    () => FIELD_DEF_KEYS.map(([name, labelKey, inputType]) => [name, t(`settings.${labelKey}`), inputType]),
    [t],
  );

  async function handleSave(event) {
    event.preventDefault();
    if (selectedUserId == null) {
      return;
    }
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const payload = await updateAdminUserIntegrations(token, selectedUserId, form);
      setForm((prev) => ({ ...prev, ...payload }));
      if (user?.id === selectedUserId) {
        onSaved?.(payload);
      }
      setMessage(t('settings.saveOk'));
      await fetchUsers();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (selectedUserId == null) {
      return;
    }
    setError('');
    setMessage('');
    setTesting(true);

    try {
      const payload = await testAdminUserOdoo(token, selectedUserId, form);
      setMessage(payload.detail || t('settings.odooOk'));
    } catch (testError) {
      setError(testError.message);
    } finally {
      setTesting(false);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    if (createFields.password !== createFields.confirmPassword) {
      setCreateError(t('settings.errPasswordMismatch'));
      return;
    }
    if (createFields.full_name.trim().length < 2) {
      setCreateError(t('settings.errNameLength'));
      return;
    }
    if (createFields.password.length < 8) {
      setCreateError(t('settings.errPasswordLength'));
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminUser(token, {
        email: createFields.email.trim(),
        full_name: createFields.full_name.trim(),
        password: createFields.password,
        role: createFields.role,
      });
      setCreateSuccess(t('settings.userCreated', { email: created.email }));
      setCreateFields(initialCreateUser);
      setShowCreateUser(false);
      await fetchUsers();
      setSelectedUserId(created.id);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t('settings.langTitle')}</h3>
            <p className="mt-1 text-sm text-slate-500">{t('settings.langHint')}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('settings.admin')}</p>
          <h2 className="text-2xl font-semibold text-slate-900">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.intro')}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ${
            isConfigured
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-orange-200 bg-orange-50 text-orange-900'
          }`}
        >
          {selectedLabel ? (isConfigured ? t('settings.integrationReady') : t('settings.missingCreds')) : '—'}
        </span>
      </div>

      {usersError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{usersError}</p>
      ) : null}

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.06)] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{t('settings.usersTitle')}</h3>
          <button
            type="button"
            className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:bg-sky-100"
            onClick={() => {
              setShowCreateUser((v) => !v);
              setCreateError('');
              setCreateSuccess('');
            }}
          >
            {showCreateUser ? t('settings.closeForm') : t('settings.newUser')}
          </button>
        </div>

        {createSuccess ? (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {createSuccess}
          </p>
        ) : null}

        {showCreateUser ? (
          <form
            className="mb-6 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2"
            onSubmit={handleCreateUser}
          >
            <p className="text-sm text-slate-600 sm:col-span-2">{t('settings.createIntro')}</p>
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">{t('settings.colEmail')}</span>
              <input
                className={inputClass}
                type="email"
                autoComplete="off"
                value={createFields.email}
                onChange={(e) => setCreateFields((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </label>
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">{t('settings.fullName')}</span>
              <input
                className={inputClass}
                type="text"
                minLength={2}
                value={createFields.full_name}
                onChange={(e) => setCreateFields((p) => ({ ...p, full_name: e.target.value }))}
                required
              />
            </label>
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">{t('settings.createRole')}</span>
              <select
                className={inputClass}
                value={createFields.role}
                onChange={(e) => setCreateFields((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="user">{t('settings.roleUser')}</option>
                <option value="admin">{t('settings.roleAdmin')}</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">{t('settings.password')}</span>
              <input
                className={inputClass}
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={createFields.password}
                onChange={(e) => setCreateFields((p) => ({ ...p, password: e.target.value }))}
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-600">{t('settings.confirmPassword')}</span>
              <input
                className={inputClass}
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={createFields.confirmPassword}
                onChange={(e) => setCreateFields((p) => ({ ...p, confirmPassword: e.target.value }))}
                required
              />
            </label>
            {createError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 sm:col-span-2">
                {createError}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-blue-700 disabled:opacity-60"
                disabled={creating}
              >
                {creating ? t('settings.creating') : t('settings.createUser')}
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('settings.colUser')}</th>
                <th className="px-4 py-3">{t('settings.colEmail')}</th>
                <th className="hidden px-4 py-3 sm:table-cell">{t('settings.colRole')}</th>
                <th className="px-4 py-3">{t('settings.colMistral')}</th>
                <th className="px-4 py-3">{t('settings.colOdoo')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {usersLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {t('settings.loadingUsers')}
                  </td>
                </tr>
              ) : !users.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {t('settings.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((row) => {
                  const selected = row.id === selectedUserId;
                  return (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedUserId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedUserId(row.id);
                        }
                      }}
                      className={`cursor-pointer transition hover:bg-slate-50/90 ${
                        selected ? 'bg-sky-50/90 ring-1 ring-inset ring-sky-200' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{row.full_name}</span>
                        {selected ? (
                          <span className="ml-2 text-xs font-medium text-sky-700">{t('settings.editingIntegration')}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.email}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.role === 'admin'
                              ? 'border border-violet-200 bg-violet-50 text-violet-800'
                              : 'border border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <KeyBadge
                          ok={row.has_mistral_api_key}
                          label={t('settings.badgeMistral')}
                          readyLabel={t('settings.badgeReady')}
                          pendingLabel={t('settings.badgePending')}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <KeyBadge
                          ok={row.has_odoo_api_key}
                          label={t('settings.badgeOdoo')}
                          readyLabel={t('settings.badgeReady')}
                          pendingLabel={t('settings.badgePending')}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('settings.tableHint')}</p>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          {t('settings.integrationSection')}
          {selectedLabel ? `: ${selectedLabel}` : ''}
        </h3>
        <form
          className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.06)] lg:grid-cols-2 lg:p-6"
          onSubmit={handleSave}
        >
          {fieldDefs.map(([name, label, inputType]) => (
            <label
              key={name}
              className={
                name === 'odoo_expense_model' || name === 'odoo_employee_id' || name === 'odoo_expense_product_id'
                  ? 'space-y-2 lg:col-span-2'
                  : 'space-y-2'
              }
            >
              <span className="text-sm font-medium text-slate-600">{label}</span>
              <input
                className={inputClass}
                type={inputType === 'password' ? 'password' : inputType === 'number' ? 'number' : 'text'}
                min={inputType === 'number' ? '1' : undefined}
                step={inputType === 'number' ? '1' : undefined}
                value={
                  inputType === 'number'
                    ? form[name] === null || form[name] === undefined || form[name] === ''
                      ? ''
                      : form[name]
                    : form[name] || ''
                }
                onChange={(event) => {
                  if (inputType === 'number') {
                    const raw = event.target.value;
                    if (raw === '') {
                      setForm((prev) => ({ ...prev, [name]: null }));
                      return;
                    }
                    const n = Number.parseInt(raw, 10);
                    setForm((prev) => ({ ...prev, [name]: Number.isNaN(n) ? null : n }));
                  } else {
                    setForm((prev) => ({ ...prev, [name]: event.target.value }));
                  }
                }}
                placeholder={
                  loading
                    ? t('settings.loading')
                    : name === 'mistral_api_key' && form.has_mistral_api_key
                      ? t('settings.phMistralSet')
                      : name === 'odoo_api_key' && form.has_odoo_api_key
                        ? t('settings.phOdooSet')
                        : name === 'odoo_url'
                          ? t('settings.phOdooUrl')
                          : name === 'odoo_employee_id'
                            ? t('settings.phEmployee')
                            : name === 'odoo_expense_product_id'
                              ? t('settings.phProduct')
                              : ''
                }
                disabled={loading || selectedUserId == null}
              />
            </label>
          ))}

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 lg:col-span-2">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 lg:col-span-2">
              {message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 lg:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:from-sky-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || loading || selectedUserId == null}
            >
              {saving ? t('settings.saving') : t('settings.save')}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleTest}
              disabled={testing || loading || selectedUserId == null}
            >
              {testing ? t('settings.testing') : t('settings.testOdoo')}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
