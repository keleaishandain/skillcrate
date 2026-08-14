import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { NotificationToast } from '../types';

interface ToastProps {
  toasts: NotificationToast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-md w-full">
      {toasts.map((toast) => {
        let icon = <Info className="text-sky-400 shrink-0" size={18} />;
        let borderClass = 'border-sky-500/30 bg-slate-900/95';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />;
          borderClass = 'border-emerald-500/30 bg-slate-900/95';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="text-amber-400 shrink-0" size={18} />;
          borderClass = 'border-amber-500/30 bg-slate-900/95';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="text-rose-400 shrink-0" size={18} />;
          borderClass = 'border-rose-500/30 bg-slate-900/95';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-lg border shadow-xl backdrop-blur-md transition-all transform translate-y-0 ${borderClass}`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-100">{toast.title}</div>
              <div className="text-xs text-slate-300 mt-0.5 leading-relaxed break-words">{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
