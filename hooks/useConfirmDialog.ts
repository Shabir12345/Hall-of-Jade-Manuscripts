import { useState, useCallback } from 'react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  variant?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

export interface ConfirmDialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
}

/**
 * Hook for managing confirmation dialogs
 * Extracted from App.tsx for better code organization
 * 
 * @returns [dialogState, showDialog, hideDialog]
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showDialog = useCallback(
    (
      options: ConfirmDialogOptions,
      onConfirm: () => void
    ) => {
      setDialogState({
        ...options,
        isOpen: true,
        onConfirm: () => {
          onConfirm();
          hideDialog();
        },
      });
    },
    []
  );

  const hideDialog = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    dialogState.onConfirm();
  }, [dialogState]);

  return {
    dialogState,
    showDialog,
    hideDialog,
    handleConfirm,
  };
}
