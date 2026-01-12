
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { validateEnv } from './utils/env';
import { LlmProvider } from './contexts/LlmContext';
import { NovelProvider } from './contexts/NovelContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { AuthProvider } from './contexts/AuthContext';
import { logger } from './services/loggingService';

// Initialize pattern management utils (side effect import)
// This exposes PatternManagement API to window for console access in development
if (process.env.NODE_ENV === 'development') {
  import('./services/patternManagementUtils').catch(err => {
    logger.warn('Failed to load pattern management utils', 'index', {
      error: err instanceof Error ? err.message : String(err)
    });
  });
}

// Validate environment variables on startup
try {
  validateEnv();
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Environment validation failed:', errorMessage);
  
  // Show user-friendly error message
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; padding: 2rem; text-align: center; background: #0a0a0a; color: #e4e4e7;">
      <div style="max-width: 600px;">
        <h1 style="color: #ef4444; margin-bottom: 1rem; font-size: 1.5rem; font-weight: bold;">Configuration Error</h1>
        <p style="color: #a1a1aa; margin-bottom: 1rem; line-height: 1.6;">${errorMessage}</p>
        <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 0.5rem; padding: 1rem; margin-top: 1.5rem; text-align: left;">
          <p style="color: #fbbf24; font-weight: 600; margin-bottom: 0.5rem;">Required variables:</p>
          <ul style="color: #a1a1aa; font-size: 0.875rem; list-style: disc; padding-left: 1.5rem; line-height: 1.8;">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
            <li>At least one of: GEMINI_API_KEY or DEEPSEEK_API_KEY</li>
            <li>(Keep GEMINI_API_KEY for portraits + read-aloud)</li>
          </ul>
          <p style="color: #71717a; font-size: 0.875rem; margin-top: 1rem;">Please check your .env.local file and ensure all required variables are set, then restart the application.</p>
        </div>
      </div>
    </div>
  `;
  throw error;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Rarely-changing providers: Outer layer to reduce re-renders */}
      <AuthProvider>
        <LlmProvider>
          {/* Frequently-changing providers: Inner layer, respecting dependencies */}
          {/* ToastProvider must be before NovelProvider (NovelProvider uses useToast) */}
          <ToastProvider>
            {/* NovelProvider must be before NavigationProvider (NavigationProvider uses useNovel) */}
            <NovelProvider>
              <NavigationProvider>
                {/* LoadingProvider: Frequently changes, no dependencies, innermost */}
                <LoadingProvider>
                  <App />
                </LoadingProvider>
              </NavigationProvider>
            </NovelProvider>
          </ToastProvider>
        </LlmProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
