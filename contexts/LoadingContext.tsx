import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress?: number;
  showProgressBar: boolean;
}

interface LoadingContextType {
  loadingState: LoadingState;
  setLoading: (isLoading: boolean, message?: string, progress?: number, showProgressBar?: boolean) => void;
  startLoading: (message?: string, showProgressBar?: boolean) => void;
  stopLoading: () => void;
  updateProgress: (progress: number, message?: string) => void;
  updateMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

const initialLoadingState: LoadingState = {
  isLoading: false,
  message: 'Processing...',
  progress: undefined,
  showProgressBar: false,
};

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>(initialLoadingState);

  const setLoading = useCallback((
    isLoading: boolean,
    message: string = 'Processing...',
    progress?: number,
    showProgressBar: boolean = false
  ) => {
    setLoadingState({
      isLoading,
      message,
      progress,
      showProgressBar,
    });
  }, []);

  const startLoading = useCallback((
    message: string = 'Processing...',
    showProgressBar: boolean = false
  ) => {
    setLoadingState({
      isLoading: true,
      message,
      progress: undefined,
      showProgressBar,
    });
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingState(initialLoadingState);
  }, []);

  const updateProgress = useCallback((progress: number, message?: string) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
      ...(message && { message }),
    }));
  }, []);

  const updateMessage = useCallback((message: string) => {
    setLoadingState(prev => ({
      ...prev,
      message,
    }));
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        loadingState,
        setLoading,
        startLoading,
        stopLoading,
        updateProgress,
        updateMessage,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

/**
 * Hook to access the Loading context.
 * 
 * Provides methods to manage loading states, progress, and messages.
 * Must be used within a LoadingProvider.
 * 
 * @returns {LoadingContextType} The loading context containing:
 * - loadingState: Current loading state (isLoading, message, progress, showProgressBar)
 * - setLoading: Set loading state with full control
 * - startLoading: Start loading with optional message and progress bar
 * - stopLoading: Stop loading
 * - updateProgress: Update progress percentage (0-100) and optional message
 * - updateMessage: Update the loading message
 * 
 * @throws {Error} If used outside of a LoadingProvider
 * 
 * @example
 * ```typescript
 * const { startLoading, stopLoading, updateProgress } = useLoading();
 * 
 * // Start loading with progress bar
 * startLoading('Processing...', true);
 * 
 * // Update progress
 * updateProgress(50, 'Halfway done');
 * 
 * // Stop loading
 * stopLoading();
 * ```
 */
export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
