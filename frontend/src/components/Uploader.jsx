import { useI18n } from '../hooks/useI18n';

export default function Uploader({ onSelect }) {
  const { t } = useI18n();

  function handleChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onSelect({
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  return (
    <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-slate-200 bg-white p-5 shadow-[0_2px_20px_rgba(15,23,42,0.06)] transition hover:border-sky-300 hover:bg-sky-50/30 sm:p-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{t('uploader.title')}</h3>
        <p className="text-sm text-slate-500">{t('uploader.subtitle')}</p>
      </div>
      <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleChange} />
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {t('uploader.tap')}
      </div>
    </label>
  );
}
