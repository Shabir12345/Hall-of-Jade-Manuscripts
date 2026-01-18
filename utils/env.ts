/**
 * Environment variable validation and access
 * Ensures all required environment variables are present at startup
 * 
 * Note: Vite only exposes variables prefixed with VITE_ to the client.
 * For DEEPSEEK_API_KEY, we use Vite's define in vite.config.ts to expose it.
 */

interface EnvConfig {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  DEEPSEEK_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  XAI_API_KEY: string;
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

  // Check API keys (some are required, some are optional)
  // Variables defined in vite.config.ts are available via process.env
  // Note: process.env values from vite.config.ts define are strings, including "undefined" if not set
  const getProcessEnv = (key: string): string | undefined => {
    const value = (process.env as any)[key];
    // Vite's define can set values to the string "undefined" if the env var doesn't exist
    if (value === 'undefined' || value === undefined || value === null || value === '') {
      return undefined;
    }
    return value;
  };

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.local file and ensure all required variables are set.\n` +
      `Required variables:\n` +
      `  - VITE_SUPABASE_URL\n` +
      `  - VITE_SUPABASE_ANON_KEY`
    );
  }

  // Check if at least one AI provider API key is set
  const anthropicKey = getProcessEnv('ANTHROPIC_API_KEY');
  const geminiKey = getProcessEnv('GEMINI_API_KEY');
  const openaiKey = getProcessEnv('OPENAI_API_KEY');
  const deepseekKey = getProcessEnv('DEEPSEEK_API_KEY');
  const grokKey = getProcessEnv('XAI_API_KEY');

  const hasAtLeastOneApiKey = !!(anthropicKey || geminiKey || openaiKey || deepseekKey || grokKey);

  if (!hasAtLeastOneApiKey) {
    throw new Error(
      `No AI provider API keys found. Please set at least one of the following in your environment:\n` +
      `  - ANTHROPIC_API_KEY (Claude)\n` +
      `  - GEMINI_API_KEY (Google Gemini)\n` +
      `  - OPENAI_API_KEY (OpenAI/GPT)\n` +
      `  - DEEPSEEK_API_KEY (DeepSeek)\n` +
      `  - XAI_API_KEY (Grok)`
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
    // Get from process.env (defined in vite.config.ts)
    const processValue = (process.env as any)[key];
    // Vite's define can set values to the string "undefined" if the env var doesn't exist
    if (processValue && processValue !== 'undefined' && processValue !== 'null' && processValue.trim() !== '') {
      value = processValue;
    }
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
  deepseek: {
    apiKey: getOptionalEnvVar('DEEPSEEK_API_KEY'),
  },
  anthropic: {
    apiKey: getOptionalEnvVar('ANTHROPIC_API_KEY'),
  },
  gemini: {
    apiKey: getOptionalEnvVar('GEMINI_API_KEY'),
  },
  openai: {
    apiKey: getOptionalEnvVar('OPENAI_API_KEY'),
  },
  grok: {
    apiKey: getOptionalEnvVar('XAI_API_KEY'),
  },
} as const;
