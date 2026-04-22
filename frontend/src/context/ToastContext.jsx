import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useI18n } from '../hooks/useI18n';

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-orange-200 bg-orange-50 text-orange-900',
};

function ToastStack({ toasts, onDismiss }) {
  const { t } = useI18n();

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6"
      aria-live="polite"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-slate-900/10 transition [animation:toast-in_0.22s_ease-out] ${VARIANT_STYLES[item.variant] || VARIANT_STYLES.info}`}
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-words">{item.message}</p>
            <button
              type="button"
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-base leading-none opacity-70 hover:opacity-100"
              onClick={() => onDismiss(item.id)}
              aria-label={t('toast.close')}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const tId = timersRef.current.get(id);
    if (tId != null) {
      window.clearTimeout(tId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, variant = 'info') => {
      if (!message || String(message).trim() === '') {
        return;
      }
      const id = `toast-${Date.now()}-${idRef.current++}`;
      setToasts((prev) => [...prev.slice(-4), { id, message: String(message), variant }]);
      const tId = window.setTimeout(() => dismiss(id), 4800);
      timersRef.current.set(id, tId);
    },
    [dismiss],
  );

  const success = useCallback((m) => push(m, 'success'), [push]);
  const error = useCallback((m) => push(m, 'error'), [push]);
  const info = useCallback((m) => push(m, 'info'), [push]);
  const warning = useCallback((m) => push(m, 'warning'), [push]);

  const value = useMemo(
    () => ({ success, error, info, warning, dismiss }),
    [success, error, info, warning, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return ctx;
}
