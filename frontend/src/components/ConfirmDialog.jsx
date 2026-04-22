import { useEffect } from 'react';

/**
 * Modal de confirmación (backdrop + tarjeta). variant: 'violet' | 'danger'
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busyLabel = '…',
  variant = 'violet',
  busy = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) {
    return null;
  }

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
        aria-label={cancelLabel}
        onClick={() => !busy && onCancel()}
      />
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div
          className={`h-1.5 w-full ${isDanger ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600' : 'bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600'}`}
        />
        <div className="p-6 sm:p-7">
          <div className="flex gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
                isDanger ? 'bg-red-50 ring-1 ring-red-100' : 'bg-violet-50 ring-1 ring-violet-100'
              }`}
            >
              {isDanger ? (
                <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
              ) : (
                <svg className="h-7 w-7 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="confirm-dialog-title" className="text-lg font-semibold leading-snug text-slate-900">
                {title}
              </h2>
              <p id="confirm-dialog-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isDanger
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-500/25 hover:from-red-700 hover:to-rose-700'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700'
              }`}
              onClick={onConfirm}
            >
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
