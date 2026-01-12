import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  timestamp: number;
}

interface ToastContextType {
  toasts: Toast[];
  toastHistory: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearHistory: () => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Hook to access the Toast context.
 * 
 * Provides methods to display toast notifications (success, error, warning, info).
 * Must be used within a ToastProvider.
 * 
 * @returns {ToastContextType} The toast context containing:
 * - showSuccess: Display a success toast notification
 * - showError: Display an error toast notification
 * - showWarning: Display a warning toast notification
 * - showInfo: Display an info toast notification
 * 
 * @throws {Error} If used outside of a ToastProvider
 * 
 * @example
 * ```typescript
 * const { showSuccess, showError } = useToast();
 * 
 * // Show a success message
 * showSuccess('Operation completed successfully!');
 * 
 * // Show an error message with custom duration
 * showError('Something went wrong', 5000);
 * ```
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastHistory, setToastHistory] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setToastHistory([]);
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 5000) => {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      const toast: Toast = { id, message, type, duration, timestamp };

      // Add to temporary toasts (for immediate display if needed)
      setToasts((prev) => [...prev, toast]);
      
      // Add to permanent history
      setToastHistory((prev) => [...prev, toast]);

      // Auto-remove from temporary toasts after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration || 7000),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toastHistory,
        showToast,
        removeToast,
        clearHistory,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};
