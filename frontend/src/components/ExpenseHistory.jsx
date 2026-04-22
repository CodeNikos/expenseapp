import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { useToast } from '../hooks/useToast';
import { deleteExpense, listExpenses, retryExpenseOdooSync } from '../services/api';

export default function ExpenseHistory() {
  const { token } = useAuth();
  const { t, dateLocale } = useI18n();
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [retryFiles, setRetryFiles] = useState({});

  const formatDate = useCallback(
    (value) => {
      if (!value) {
        return '-';
      }

      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }

      return parsed.toLocaleDateString(dateLocale);
    },
    [dateLocale],
  );

  useEffect(() => {
    let ignore = false;

    async function loadExpenses() {
      try {
        const data = await listExpenses(token);
        if (!ignore) {
          setExpenses(data);
        }
      } catch (loadError) {
        if (!ignore) {
          toast.error(loadError.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadExpenses();

    return () => {
      ignore = true;
    };
  }, [token, toast]);

  const pendingCount = useMemo(() => expenses.filter((expense) => !expense.odoo_synced).length, [expenses]);

  async function handleDelete(expenseId) {
    const confirmed = window.confirm(t('history.confirmDelete'));
    if (!confirmed) {
      return;
    }

    setBusyAction(`delete-${expenseId}`);

    try {
      const payload = await deleteExpense(token, expenseId);
      setExpenses((prev) => prev.filter((expense) => expense.id !== expenseId));
      toast.success(payload.message || t('history.feedbackDeleted'));
    } catch (actionError) {
      toast.error(actionError.message);
    } finally {
      setBusyAction('');
    }
  }

  async function handleRetry(expenseId) {
    setBusyAction(`retry-${expenseId}`);

    try {
      const payload = await retryExpenseOdooSync(token, expenseId, retryFiles[expenseId]);
      if (payload.expense) {
        setExpenses((prev) => prev.map((expense) => (expense.id === expenseId ? payload.expense : expense)));
      }
      setRetryFiles((prev) => {
        const next = { ...prev };
        delete next[expenseId];
        return next;
      });
      toast.success(payload.message || t('history.feedbackRetry'));
    } catch (actionError) {
      toast.error(actionError.message);
    } finally {
      setBusyAction('');
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">{t('history.label')}</p>
          <h2 className="text-2xl font-semibold text-slate-900">{t('history.title')}</h2>
          <p className="text-sm text-slate-500">{t('history.subtitle')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          {t('history.summary', { total: expenses.length, pending: pendingCount })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.06)] sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('history.loading')}</p>
        ) : expenses.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">{t('history.colVendor')}</th>
                  <th className="px-3 py-3">{t('history.colDate')}</th>
                  <th className="px-3 py-3">{t('history.colTotal')}</th>
                  <th className="px-3 py-3">{t('history.colStatus')}</th>
                  <th className="px-3 py-3">{t('history.colDetail')}</th>
                  <th className="px-3 py-3">{t('history.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const deleteKey = `delete-${expense.id}`;
                  const retryKey = `retry-${expense.id}`;
                  const isDeleting = busyAction === deleteKey;
                  const isRetrying = busyAction === retryKey;

                  return (
                    <tr key={expense.id} className="border-b border-slate-50 align-top transition hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <div>{expense.vendor_name || t('history.noVendor')}</div>
                        <div className="text-xs text-slate-400">{t('history.idLine', { id: expense.id })}</div>
                      </td>
                      <td className="px-3 py-3">{formatDate(expense.invoice_date || expense.created_at)}</td>
                      <td className="px-3 py-3">
                        {expense.total_amount || '-'} {expense.currency || ''}
                      </td>
                      <td className="px-3 py-3">
                        {expense.odoo_synced ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                            {t('history.synced')}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                            {t('history.pending')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {expense.odoo_synced
                          ? expense.odoo_id
                            ? t('history.odooId', { id: expense.odoo_id })
                            : t('history.noError')
                          : expense.odoo_error || t('history.pendingOdoo')}
                      </td>
                      <td className="px-3 py-3">
                        {expense.odoo_synced ? (
                          <span className="text-xs text-slate-400">{t('history.noActions')}</span>
                        ) : (
                          <div className="space-y-2">
                            <input
                              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                setRetryFiles((prev) => ({
                                  ...prev,
                                  [expense.id]: event.target.files?.[0] || null,
                                }))
                              }
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleDelete(expense.id)}
                                disabled={Boolean(busyAction)}
                              >
                                {isDeleting ? t('history.deleting') : t('history.delete')}
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => handleRetry(expense.id)}
                                disabled={Boolean(busyAction)}
                              >
                                {isRetrying ? t('history.retrying') : t('history.retryOdoo')}
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-400">{t('history.retryHint')}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">{t('history.empty')}</p>
        )}
      </div>
    </section>
  );
}
