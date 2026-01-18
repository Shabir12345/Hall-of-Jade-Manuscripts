
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { validateEnv } from './utils/env';
import { LlmProvider } from './contexts/LlmContext';
import { ChapterGenerationModelProvider } from './contexts/ChapterGenerationModelContext';
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
  
  // Debug: Show what environment variables are actually available
  console.log('🔍 Debug - Available process.env keys:', Object.keys(process.env).filter(k => k.includes('API_KEY') || k.includes('SUPABASE')));
  console.log('🔍 Debug - ANTHROPIC_API_KEY:', (process.env as any).ANTHROPIC_API_KEY ? `Set (${String((process.env as any).ANTHROPIC_API_KEY).substring(0, 10)}...)` : 'NOT SET');
  console.log('🔍 Debug - GEMINI_API_KEY:', (process.env as any).GEMINI_API_KEY ? `Set (${String((process.env as any).GEMINI_API_KEY).substring(0, 10)}...)` : 'NOT SET');
  console.log('🔍 Debug - OPENAI_API_KEY:', (process.env as any).OPENAI_API_KEY ? `Set (${String((process.env as any).OPENAI_API_KEY).substring(0, 10)}...)` : 'NOT SET');
  console.log('🔍 Debug - DEEPSEEK_API_KEY:', (process.env as any).DEEPSEEK_API_KEY ? `Set (${String((process.env as any).DEEPSEEK_API_KEY).substring(0, 10)}...)` : 'NOT SET');
  
  // Show user-friendly error message
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto;">
      <h1 style="color: #ef4444; margin-bottom: 16px; font-size: 1.5rem;">⚠️ Environment Configuration Error</h1>
      <p style="color: #fbbf24; margin-bottom: 12px; font-weight: 600; font-size: 1.1rem;">${errorMessage}</p>
      <div style="background: #1f2937; padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #374151;">
        <p style="color: #e5e7eb; margin-bottom: 8px; font-weight: 600;">🔧 Quick Fix Steps:</p>
        <ol style="color: #d1d5db; margin-left: 20px; line-height: 1.8;">
          <li>Make sure your <code style="background: #374151; padding: 2px 6px; border-radius: 4px; color: #fbbf24;">.env.local</code> file exists in the project root directory</li>
          <li>Verify all required API keys are set (no empty values, no quotes around the values)</li>
          <li><strong style="color: #fbbf24;">⚠️ CRITICAL: RESTART your dev server</strong> after adding/updating .env.local</li>
          <li>Stop the server (Ctrl+C in terminal) and run <code style="background: #374151; padding: 2px 6px; border-radius: 4px; color: #fbbf24;">npm run dev</code> again</li>
        </ol>
      </div>
      <div style="background: #1f2937; padding: 16px; border-radius: 8px; border: 1px solid #374151;">
        <p style="color: #e5e7eb; margin-bottom: 8px; font-weight: 600;">📋 Required API Keys:</p>
        <ul style="color: #d1d5db; margin-left: 20px; line-height: 1.8;">
          <li><code style="background: #374151; padding: 2px 6px; border-radius: 4px;">ANTHROPIC_API_KEY</code> - For Claude Sonnet 4.5 (prose generation)</li>
          <li><code style="background: #374151; padding: 2px 6px; border-radius: 4px;">GEMINI_API_KEY</code> - For Gemini Flash (metadata extraction)</li>
        </ul>
        <p style="color: #9ca3af; font-size: 0.875rem; margin-top: 12px;">Check the browser console (F12) for debug information showing which keys are detected.</p>
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
          <ChapterGenerationModelProvider>
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
          </ChapterGenerationModelProvider>
        </LlmProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
