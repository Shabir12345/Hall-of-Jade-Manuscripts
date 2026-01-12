import React, { useRef } from 'react';

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
  
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'border-red-500/50 bg-red-950/20',
    warning: 'border-amber-500/50 bg-amber-950/20',
    info: 'border-blue-500/50 bg-blue-950/20',
  };

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-amber-600 hover:bg-amber-500',
    info: 'bg-blue-600 hover:bg-blue-500',
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        ref={containerRef}
        className={`bg-zinc-900 border ${variantStyles[variant]} p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl animate-in scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className="text-xl md:text-2xl font-fantasy font-bold text-zinc-100 mb-4"
        >
          {title}
        </h3>
        <p
          id="confirm-dialog-message"
          className="text-sm md:text-base text-zinc-300 mb-6 leading-relaxed"
        >
          {message}
        </p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-8 py-2.5 ${buttonStyles[variant]} text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
