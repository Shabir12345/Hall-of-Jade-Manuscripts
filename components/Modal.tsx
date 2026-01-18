/**
 * Reusable Modal Component
 * Provides consistent modal/dialog UI for forms and content
 */

import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-full',
};

const sizeClasses = {
  sm: 'p-4 md:p-6',
  md: 'p-6 md:p-8',
  lg: 'p-6 md:p-10',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
  size = 'md',
  className = '',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  headerActions,
  footer,
}) => {
  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-zinc-900 border border-zinc-700 ${sizeClasses[size]} rounded-2xl w-full ${maxWidthClasses[maxWidth]} shadow-2xl overflow-y-auto max-h-[95vh] scrollbar-thin animate-in scale-in ${className}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h3 id="modal-title" className="text-lg md:text-xl font-fantasy font-bold text-amber-500">
            {title}
          </h3>
          <div className="flex items-center space-x-2">
            {headerActions}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                aria-label="Close dialog"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
};
