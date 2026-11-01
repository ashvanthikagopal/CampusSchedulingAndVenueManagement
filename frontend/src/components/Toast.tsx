import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map((t) => {
          let bgClass = "bg-slate-900 border-slate-700 text-slate-200";
          let iconClass = "text-slate-400";
          let Icon = Info;
          if (t.type === 'success') {
            bgClass = "bg-slate-900/95 border-emerald-500/40 text-emerald-300";
            iconClass = "toast-icon-success text-emerald-400";
            Icon = CheckCircle2;
          } else if (t.type === 'error') {
            bgClass = "bg-slate-900/95 border-rose-500/40 text-rose-300";
            iconClass = "toast-icon-error text-rose-400";
            Icon = XCircle;
          } else if (t.type === 'warning') {
            bgClass = "bg-slate-900/95 border-amber-500/40 text-amber-300";
            iconClass = "toast-icon-warning text-amber-400";
            Icon = AlertTriangle;
          } else if (t.type === 'info') {
            iconClass = "toast-icon-info text-sky-400";
          }

          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
              className={`ledger-toast-item toast-${t.type} pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${bgClass}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
              <div className="flex-1 text-sm font-medium">{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="toast-close-btn text-slate-400 hover:text-white min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg: string) => console.log('Toast:', msg)
    };
  }
  return context;
};
