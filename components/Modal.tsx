/**
 * Reusable Modal Component
 * Provides consistent modal/dialog UI for forms and content
 * Fully responsive with mobile-first design
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
  /** If true, modal takes full screen on mobile devices */
  fullScreenMobile?: boolean;
}

// Responsive max-width classes - smaller on mobile
const maxWidthClasses = {
  sm: 'max-w-[calc(100vw-2rem)] xs:max-w-sm',
  md: 'max-w-[calc(100vw-2rem)] xs:max-w-md',
  lg: 'max-w-[calc(100vw-2rem)] sm:max-w-lg',
  xl: 'max-w-[calc(100vw-2rem)] sm:max-w-xl',
  '2xl': 'max-w-[calc(100vw-2rem)] md:max-w-2xl',
  '3xl': 'max-w-[calc(100vw-2rem)] md:max-w-3xl',
  full: 'max-w-full',
};

// Responsive padding - smaller on mobile
const sizeClasses = {
  sm: 'p-3 xs:p-4 md:p-6',
  md: 'p-4 xs:p-5 md:p-8',
  lg: 'p-4 xs:p-6 md:p-10',
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
  fullScreenMobile = false,
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

  // Full screen mobile classes
  const mobileFullScreenClasses = fullScreenMobile 
    ? 'xs:rounded-none xs:max-w-full xs:max-h-full xs:h-full sm:rounded-2xl sm:max-h-[90vh] sm:h-auto' 
    : '';

  return (
    <div
      className={`fixed inset-0 bg-black/95 flex items-center justify-center z-[60] backdrop-blur-xl animate-in fade-in duration-200 ${
        fullScreenMobile ? 'p-0 xs:p-0 sm:p-4' : 'p-2 xs:p-3 sm:p-4'
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        paddingTop: fullScreenMobile ? '0' : 'max(0.5rem, env(safe-area-inset-top, 0.5rem))',
        paddingBottom: fullScreenMobile ? '0' : 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))',
      }}
    >
      <div
        className={`bg-zinc-900 border border-zinc-700 ${sizeClasses[size]} rounded-xl sm:rounded-2xl w-full ${maxWidthClasses[maxWidth]} shadow-2xl overflow-y-auto scrollbar-thin animate-in scale-in ${mobileFullScreenClasses} ${className}`}
        style={{
          maxHeight: fullScreenMobile ? '100%' : 'calc(100dvh - 1rem)',
        }}
      >
        {/* Header - sticky on mobile for better UX */}
        <div className="flex justify-between items-center mb-3 xs:mb-4 md:mb-6 sticky top-0 bg-zinc-900 z-10 -mx-3 xs:-mx-4 md:-mx-8 px-3 xs:px-4 md:px-8 -mt-3 xs:-mt-4 md:-mt-8 pt-3 xs:pt-4 md:pt-8 pb-2 border-b border-zinc-800/50">
          <h3 id="modal-title" className="text-base xs:text-lg md:text-xl font-fantasy font-bold text-amber-500 truncate pr-2">
            {title}
          </h3>
          <div className="flex items-center space-x-1 xs:space-x-2 flex-shrink-0">
            {headerActions}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 w-9 h-9 xs:w-10 xs:h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200 text-xl"
                aria-label="Close dialog"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-2">
          {children}
        </div>

        {/* Footer - if provided */}
        {footer && (
          <div className="mt-4 xs:mt-5 md:mt-6 pt-3 xs:pt-4 border-t border-zinc-800/50 sticky bottom-0 bg-zinc-900 -mx-3 xs:-mx-4 md:-mx-8 px-3 xs:px-4 md:px-8 -mb-3 xs:-mb-4 md:-mb-8 pb-3 xs:pb-4 md:pb-8">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
