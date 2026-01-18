import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

/**
 * LoadingSpinner Component
 * A simple loading spinner for Suspense fallbacks and inline loading states.
 * Provides a consistent spinner style across the application.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  message,
}) => {
  const sizes = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${message ? 'flex-col gap-4' : ''} ${className}`}>
      <div
        className={`animate-spin rounded-full border-zinc-700 border-t-amber-600 ${sizes[size]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {message && (
        <p className="text-sm text-zinc-400 font-medium">{message}</p>
      )}
    </div>
  );
};

/**
 * LoadingSpinnerCentered Component
 * A convenience component that centers the spinner in its container.
 * Useful for Suspense fallbacks.
 */
export const LoadingSpinnerCentered: React.FC<Omit<LoadingSpinnerProps, 'className'>> = (props) => {
  return <LoadingSpinner {...props} className="h-full w-full" />;
};
