import { useI18n } from '../hooks/useI18n';

export default function Preview({ previewUrl, fileName, onClear }) {
  const { t } = useI18n();

  if (!previewUrl) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-3xl border border-slate-100 bg-white p-6 text-center text-slate-400 shadow-[0_2px_20px_rgba(15,23,42,0.04)]">
        {t('preview.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_20px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('preview.title')}</h3>
          <p className="max-w-md truncate text-sm text-slate-500">{fileName}</p>
        </div>
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          onClick={onClear}
        >
          {t('preview.clear')}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
        <img className="max-h-[32rem] w-full object-contain" src={previewUrl} alt={t('preview.alt')} />
      </div>
    </div>
  );
}
