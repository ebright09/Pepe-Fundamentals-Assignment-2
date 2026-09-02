import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Toast notifications for success and error feedback. Errors stay on screen
 * noticeably longer than successes, because they usually need reading.
 */

const ToastContext = createContext({ notify: () => {} });

let nextId = 0;

const TONES = {
  success: 'border-emerald-400/60 text-emerald-100',
  error: 'border-rose-400/70 text-rose-100',
  info: 'border-cyan-400/60 text-cyan-100',
};

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = 'success') => {
      const id = ++nextId;
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3800);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className={`glass pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3 text-sm font-semibold shadow-2xl ${TONES[toast.tone]}`}
              role={toast.tone === 'error' ? 'alert' : 'status'}
            >
              <span aria-hidden="true" className="text-base leading-5">
                {ICONS[toast.tone]}
              </span>
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="opacity-60 transition hover:opacity-100"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
