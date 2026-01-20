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
      className={`animate-in slide-in-from-bottom-4 xs:slide-in-from-right-8 fade-in p-3 xs:p-4 border rounded-xl shadow-2xl backdrop-blur-xl w-full xs:min-w-[280px] xs:max-w-sm md:max-w-md pointer-events-auto ${typeStyles[toast.type]}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-2 xs:space-x-3">
        <span className="text-base xs:text-lg font-bold flex-shrink-0">{icons[toast.type]}</span>
        <p className="text-xs xs:text-sm font-semibold text-zinc-200 leading-relaxed flex-1 break-words">
          {toast.message}
        </p>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 transition-colors w-8 h-8 xs:w-6 xs:h-6 flex items-center justify-center rounded-lg hover:bg-zinc-800/50 active:scale-95"
          aria-label="Dismiss notification"
        >
          <span className="text-lg xs:text-base">×</span>
        </button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed z-[100] space-y-2 xs:space-y-3 pointer-events-none w-[calc(100%-1rem)] xs:w-auto left-2 right-2 xs:left-auto xs:right-4 md:right-8"
      style={{ 
        bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
        top: 'auto'
      }}
    >
      {/* On mobile, show max 3 toasts to not overwhelm the screen */}
      {toasts.slice(0, 3).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
      {toasts.length > 3 && (
        <div className="text-xs text-zinc-500 text-center xs:text-right pointer-events-auto">
          +{toasts.length - 3} more notification{toasts.length - 3 !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default ToastContainer;
