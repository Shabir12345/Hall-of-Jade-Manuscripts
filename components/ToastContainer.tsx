import React from 'react';
import { useToast, Toast } from '../contexts/ToastContext';

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({
  toast,
  onRemove,
}) => {
  const typeStyles = {
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-400',
    error: 'bg-red-950/95 border-red-500/50 text-red-400',
    warning: 'bg-amber-950/95 border-amber-500/50 text-amber-400',
    info: 'bg-blue-950/95 border-blue-500/50 text-blue-400',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`animate-in slide-in-from-right-8 fade-in p-4 border rounded-xl shadow-2xl backdrop-blur-xl min-w-[320px] max-w-md pointer-events-auto ${typeStyles[toast.type]}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-3">
        <span className="text-lg font-bold flex-shrink-0">{icons[toast.type]}</span>
        <p className="text-sm font-semibold text-zinc-200 leading-relaxed flex-1">
          {toast.message}
        </p>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 transition-colors"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-8 right-8 z-[100] space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;
