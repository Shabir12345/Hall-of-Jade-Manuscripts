import React from 'react';

interface LoadingIndicatorProps {
  isVisible: boolean;
  message?: string;
  progress?: number; // 0 to 100, optional
  showProgressBar?: boolean;
  showSpinner?: boolean;
  position?: 'top' | 'center' | 'bottom';
  variant?: 'overlay' | 'banner';
}

/**
 * LoadingIndicator Component
 * A visible indicator that shows when async operations are in progress.
 * Can display as a banner at the top or as an overlay in the center.
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isVisible,
  message = 'Processing...',
  progress,
  showProgressBar = false,
  showSpinner = true,
  position = 'top',
  variant = 'banner',
}) => {
  if (!isVisible) return null;

  // Banner variant (appears at top of screen)
  if (variant === 'banner') {
    return (
      <div 
        className={`fixed left-0 right-0 z-[100] bg-zinc-900/95 backdrop-blur-xl border-b border-amber-500/50 shadow-lg animate-in slide-in-from-top duration-300 ${
          position === 'top' ? 'top-0' : position === 'bottom' ? 'bottom-0' : 'top-1/2 -translate-y-1/2'
        }`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {showSpinner && (
                <div className="flex-shrink-0">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500 border-t-transparent"></div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-semibold text-amber-500 truncate">
                  {message}
                </p>
                {showProgressBar && progress !== undefined && (
                  <div className="mt-2 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500 transition-all duration-300 ease-out relative"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    >
                      <div 
                        className="absolute inset-0 animate-shimmer"
                        style={{ 
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                          width: '50%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {progress !== undefined && !showProgressBar && (
              <div className="flex-shrink-0 text-xs font-mono text-zinc-500 tabular-nums">
                {Math.round(progress)}%
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Overlay variant (centered on screen)
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-zinc-900 border border-amber-500/50 rounded-2xl p-6 md:p-8 max-w-md w-full mx-4 shadow-2xl animate-in scale-in">
        <div className="flex flex-col items-center gap-4">
          {showSpinner && (
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
          )}
          <div className="text-center w-full">
            <p className="text-base md:text-lg font-semibold text-amber-500 mb-2">
              {message}
            </p>
            {showProgressBar && progress !== undefined && (
              <div className="mt-4 h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                <div 
                  className="h-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500 transition-all duration-300 ease-out relative"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                >
                  <div 
                    className="absolute inset-0 animate-shimmer"
                    style={{ 
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      width: '50%',
                    }}
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2 text-center font-mono tabular-nums">
                  {Math.round(progress)}%
                </p>
              </div>
            )}
            {progress !== undefined && !showProgressBar && (
              <p className="text-sm text-zinc-500 mt-2 font-mono tabular-nums">
                {Math.round(progress)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingIndicator;
