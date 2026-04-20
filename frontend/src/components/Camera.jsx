import Webcam from 'react-webcam';
import { useCamera } from '../hooks/useCamera';
import { useI18n } from '../hooks/useI18n';

export default function Camera({ onCapture }) {
  const { t } = useI18n();
  const { webcamRef, capture, error, videoConstraints } = useCamera();

  function handleCapture() {
    const result = capture();
    if (result) {
      onCapture(result);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_2px_20px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t('camera.title')}</h3>
          <p className="text-sm text-slate-500">{t('camera.subtitle')}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          audio={false}
          className="aspect-[4/3] w-full bg-slate-200 object-cover"
          videoConstraints={videoConstraints}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-600 hover:to-blue-700"
        onClick={handleCapture}
      >
        {t('camera.capture')}
      </button>
    </div>
  );
}
