/**
 * Prompt Dialog Component
 * Replaces native prompt() calls with a styled dialog
 */

import React, { useState, useEffect, useRef } from 'react';

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input after dialog opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultValue]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm(value);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, value, onConfirm, onCancel]);

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
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-amber-600 hover:bg-amber-500',
    info: 'bg-blue-600 hover:bg-blue-500',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-end xs:items-center justify-center z-[70] p-0 xs:p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-dialog-title"
      aria-describedby="prompt-dialog-message"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Mobile: Bottom sheet style | Desktop: Centered modal */}
      <div
        className={`bg-zinc-900 border-t xs:border ${variantStyles[variant]} p-4 xs:p-5 md:p-8 rounded-t-2xl xs:rounded-2xl w-full xs:max-w-md shadow-2xl animate-in slide-in-from-bottom xs:scale-in`}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        {/* Mobile drag indicator */}
        <div className="xs:hidden flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-zinc-600" />
        </div>
        
        <h3
          id="prompt-dialog-title"
          className="text-lg xs:text-xl md:text-2xl font-fantasy font-bold text-zinc-100 mb-1 xs:mb-2"
        >
          {title}
        </h3>
        <p
          id="prompt-dialog-message"
          className="text-xs xs:text-sm md:text-base text-zinc-400 mb-3 xs:mb-4 leading-relaxed"
        >
          {message}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg xs:rounded-xl px-3 xs:px-4 py-3 xs:py-3.5 text-sm xs:text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all mb-4 xs:mb-6"
            aria-label="Input"
          />
          {/* Buttons - stacked on mobile, side by side on larger screens */}
          <div className="flex flex-col-reverse xs:flex-row xs:justify-end gap-2 xs:gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="w-full xs:w-auto px-4 xs:px-6 py-3 xs:py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-all duration-200 rounded-xl hover:bg-zinc-800 active:scale-[0.98]"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              className={`w-full xs:w-auto px-6 xs:px-8 py-3 xs:py-2.5 ${buttonStyles[variant]} text-white rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-[0.98] shadow-lg`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptDialog;
