import React, { useRef, useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'border-red-500/50 bg-red-950/20',
    warning: 'border-amber-500/50 bg-amber-950/20',
    info: 'border-blue-500/50 bg-blue-950/20',
  };

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-500 active:bg-red-600',
    warning: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-600',
    info: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-600',
  };

  const iconColors = {
    danger: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
  };

  const icons = {
    danger: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-end xs:items-center justify-center z-[70] p-0 xs:p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Mobile: Bottom sheet style | Desktop: Centered modal */}
      <div
        ref={containerRef}
        className={`bg-zinc-900 border-t xs:border ${variantStyles[variant]} p-4 xs:p-5 md:p-8 rounded-t-2xl xs:rounded-2xl w-full xs:max-w-md shadow-2xl animate-in slide-in-from-bottom xs:scale-in`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        {/* Mobile drag indicator */}
        <div className="xs:hidden flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>
        
        {/* Icon and Title */}
        <div className="flex items-start gap-3 mb-3 xs:mb-4">
          <span className={`text-2xl xs:text-3xl ${iconColors[variant]}`}>{icons[variant]}</span>
          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-lg xs:text-xl md:text-2xl font-fantasy font-bold text-zinc-100"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-message"
              className="text-xs xs:text-sm md:text-base text-zinc-400 mt-1 xs:mt-2 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>
        
        {/* Buttons - stacked on mobile, side by side on larger screens */}
        <div className="flex flex-col-reverse xs:flex-row xs:justify-end gap-2 xs:gap-3 mt-4 xs:mt-6">
          <button
            onClick={onCancel}
            className="w-full xs:w-auto px-4 xs:px-5 py-3 xs:py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-all duration-200 rounded-xl hover:bg-zinc-800 active:scale-[0.98]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full xs:w-auto px-6 xs:px-8 py-3 xs:py-2.5 ${buttonStyles[variant]} text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-[0.98] shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
