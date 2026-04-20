import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Camera from './Camera';
import Form from './Form';
import Preview from './Preview';
import Uploader from './Uploader';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { listExpenses, processExpense } from '../services/api';

const emptyExpense = {
  vendor_name: '',
  invoice_number: '',
  invoice_date: '',
  currency: 'PAB',
  total_amount: '',
  tax_amount: '',
  notes: '',
};

export default function ExpenseWorkspace({ integrationSettings }) {
  const { token } = useAuth();
  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [formValues, setFormValues] = useState(emptyExpense);
  const [expenses, setExpenses] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasSettings = useMemo(
    () =>
      Boolean(
        integrationSettings?.has_mistral_api_key &&
          integrationSettings?.odoo_url &&
          integrationSettings?.odoo_db &&
          integrationSettings?.odoo_login &&
          integrationSettings?.has_odoo_api_key,
      ),
    [integrationSettings],
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
          setError(loadError.message);
        }
      }
    }

    loadExpenses();

    return () => {
      ignore = true;
    };
  }, [token]);

  function resetSelection() {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setFormValues(emptyExpense);
    setFeedback('');
    setError('');
  }

  function handleAssetSelection({ file, previewUrl: nextPreviewUrl }) {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setFeedback('');
    setError('');
  }

  async function handleProcess() {
    if (!selectedFile) {
      setError(t('workspace.errNoFileProcess'));
      return;
    }

    setProcessing(true);
    setFeedback('');
    setError('');

    try {
      const payload = await processExpense(token, selectedFile, {
        process_only: true,
        expense: formValues,
      });

      setFormValues((prev) => ({
        ...prev,
        ...payload.extracted_expense,
      }));
      setFeedback(t('workspace.feedbackOcr'));
    } catch (processError) {
      setError(processError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setError(t('workspace.errNoFileSubmit'));
      return;
    }

    setSubmitting(true);
    setFeedback('');
    setError('');

    try {
      const payload = await processExpense(token, selectedFile, {
        process_only: false,
        expense: formValues,
      });

      setFormValues((prev) => ({ ...prev, ...payload.expense }));
      setExpenses((prev) => [payload.expense, ...prev]);
      setFeedback(payload.message || t('workspace.feedbackSaved'));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
            <Camera onCapture={handleAssetSelection} />
            <Uploader onSelect={handleAssetSelection} />
          </div>
          <Preview previewUrl={previewUrl} fileName={selectedFile?.name} onClear={resetSelection} />
        </div>

        <div className="space-y-6">
          <Form
            disabled={!selectedFile}
            hasSettings={hasSettings}
            onProcess={handleProcess}
            onSubmit={handleSubmit}
            processing={processing}
            submitting={submitting}
            values={formValues}
            onChange={(field, value) => setFormValues((prev) => ({ ...prev, [field]: value }))}
          />

          {feedback ? (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm">{feedback}</p>
          ) : null}
          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">{error}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{t('workspace.recentTitle')}</h3>
            <p className="text-sm text-slate-500">{t('workspace.recentSubtitle')}</p>
          </div>
          <Link
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            to="/history"
          >
            {t('workspace.viewAllHistory')}
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">{t('workspace.colVendor')}</th>
                <th className="px-3 py-3">{t('workspace.colDate')}</th>
                <th className="px-3 py-3">{t('workspace.colTotal')}</th>
                <th className="px-3 py-3">{t('workspace.colCurrency')}</th>
                <th className="px-3 py-3">{t('workspace.colOdoo')}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length ? (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-50 transition hover:bg-slate-50/80">
                    <td className="px-3 py-3 font-medium text-slate-900">{expense.vendor_name || '-'}</td>
                    <td className="px-3 py-3">{expense.invoice_date || '-'}</td>
                    <td className="px-3 py-3">{expense.total_amount || '-'}</td>
                    <td className="px-3 py-3">{expense.currency || '-'}</td>
                    <td className="px-3 py-3">
                      {expense.odoo_synced ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          {t('workspace.synced')}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                          {t('workspace.pending')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-400" colSpan="5">
                    {t('workspace.noExpenses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
