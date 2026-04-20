import { useMemo } from 'react';
import { useI18n } from '../hooks/useI18n';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20';

export default function Form({
  disabled,
  hasSettings,
  onProcess,
  onSubmit,
  processing,
  submitting,
  values,
  onChange,
}) {
  const { t } = useI18n();

  const fields = useMemo(
    () => [
      { name: 'vendor_name', label: t('form.vendor') },
      { name: 'invoice_number', label: t('form.invoiceNumber') },
      { name: 'invoice_date', label: t('form.date'), type: 'date' },
      { name: 'currency', label: t('form.currency') },
      { name: 'total_amount', label: t('form.total'), type: 'number', step: '0.01' },
      { name: 'tax_amount', label: t('form.tax'), type: 'number', step: '0.01' },
      { name: 'notes', label: t('form.notes'), type: 'textarea' },
    ],
    [t],
  );

  return (
    <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_20px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('form.title')}</h3>
          <p className="text-sm text-slate-500">{t('form.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-800 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || processing || !hasSettings}
            onClick={onProcess}
          >
            {processing ? t('form.processingOcr') : t('form.processOcr')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || submitting || !hasSettings}
            onClick={onSubmit}
          >
            {submitting ? t('form.submitting') : t('form.saveSync')}
          </button>
        </div>
      </div>

      {!hasSettings ? (
        <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">{t('form.noIntegration')}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.name}
            className={field.type === 'textarea' ? 'space-y-2 md:col-span-2' : 'space-y-2'}
          >
            <span className="text-sm font-medium text-slate-600">{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea
                className={`min-h-28 ${inputClass}`}
                value={values[field.name] || ''}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            ) : (
              <input
                className={inputClass}
                type={field.type || 'text'}
                step={field.step}
                value={values[field.name] || ''}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
