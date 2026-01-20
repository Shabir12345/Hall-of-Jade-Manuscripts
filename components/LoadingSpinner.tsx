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
 * Responsive: adapts size on mobile devices.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  message,
}) => {
  // Responsive sizes - smaller on mobile
  const sizes = {
    sm: 'h-5 w-5 xs:h-6 xs:w-6 border-2',
    md: 'h-8 w-8 xs:h-10 xs:w-10 md:h-12 md:w-12 border-3 xs:border-4',
    lg: 'h-12 w-12 xs:h-14 xs:w-14 md:h-16 md:w-16 border-3 xs:border-4',
  };

  return (
    <div className={`flex items-center justify-center ${message ? 'flex-col gap-2 xs:gap-3 md:gap-4' : ''} ${className}`}>
      <div
        className={`animate-spin rounded-full border-zinc-700 border-t-amber-600 ${sizes[size]}`}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {message && (
        <p className="text-xs xs:text-sm text-zinc-400 font-medium text-center px-4">{message}</p>
      )}
    </div>
  );
};

/**
 * LoadingSpinnerCentered Component
 * A convenience component that centers the spinner in its container.
 * Useful for Suspense fallbacks. Includes safe area padding for mobile.
 */
export const LoadingSpinnerCentered: React.FC<Omit<LoadingSpinnerProps, 'className'>> = (props) => {
  return (
    <div 
      className="h-full w-full min-h-[200px] flex items-center justify-center"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <LoadingSpinner {...props} />
    </div>
  );
};
