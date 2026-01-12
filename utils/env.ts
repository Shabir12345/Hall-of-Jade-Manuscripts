/**
 * Environment variable validation and access
 * Ensures all required environment variables are present at startup
 * 
 * Note: Vite only exposes variables prefixed with VITE_ to the client.
 * For GEMINI_API_KEY, we use Vite's define in vite.config.ts to expose it.
 */

interface EnvConfig {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  GEMINI_API_KEY: string;
  DEEPSEEK_API_KEY: string;
}

const alwaysRequiredEnvVars: (keyof EnvConfig)[] = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

/**
 * Validates that all required environment variables are present
 * Throws an error with helpful message if any are missing
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of alwaysRequiredEnvVars) {
    const value = import.meta.env[key];
    if (!value || value.trim() === '') missing.push(key);
  }

  // At least one LLM API key must be configured.
  const geminiKey = (import.meta.env as any).GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
  const deepseekKey = (import.meta.env as any).DEEPSEEK_API_KEY || (process.env as any).DEEPSEEK_API_KEY;
  const hasGemini = typeof geminiKey === 'string' && geminiKey.trim() !== '';
  const hasDeepSeek = typeof deepseekKey === 'string' && deepseekKey.trim() !== '';

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.local file and ensure all required variables are set.\n` +
      `Required variables:\n` +
      `  - VITE_SUPABASE_URL\n` +
      `  - VITE_SUPABASE_ANON_KEY\n` +
      `\n` +
      `Also required:\n` +
      `  - At least one of GEMINI_API_KEY or DEEPSEEK_API_KEY\n` +
      `  - (Keep GEMINI_API_KEY if you want portraits + read-aloud)`
    );
  }

  if (!hasGemini && !hasDeepSeek) {
    throw new Error(
      `Missing required environment variables: GEMINI_API_KEY or DEEPSEEK_API_KEY\n` +
      `Please set at least one LLM API key in your .env.local file.\n` +
      `If you want portraits + read-aloud, you must also set GEMINI_API_KEY.`
    );
  }
}

/**
 * Gets environment variable
 */
function getEnvVar(key: keyof EnvConfig): string {
  let value: string | undefined;
  
  // VITE_ prefixed vars are available via import.meta.env
  value = import.meta.env[key];
  // Non-VITE keys are exposed via vite.config.ts define
  if (!value || value.trim() === '') {
    if (key === 'GEMINI_API_KEY') value = (import.meta.env as any).GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
    if (key === 'DEEPSEEK_API_KEY') value = (import.meta.env as any).DEEPSEEK_API_KEY || (process.env as any).DEEPSEEK_API_KEY;
  }
  
  if (!value || value.trim() === '') {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Gets environment variable, but returns undefined if missing.
 */
function getOptionalEnvVar(key: keyof EnvConfig): string | undefined {
  try {
    return getEnvVar(key);
  } catch {
    return undefined;
  }
}

/**
 * Validated environment configuration
 */
export const env = {
  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY'),
  },
  gemini: {
    apiKey: getOptionalEnvVar('GEMINI_API_KEY'),
  },
  deepseek: {
    apiKey: getOptionalEnvVar('DEEPSEEK_API_KEY'),
  },
} as const;
