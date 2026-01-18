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
 * Helper to check if an env value is valid (not undefined, null, empty, or the string "undefined")
 */
function isValidEnvValue(value: unknown): value is string {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'string') return false;
  if (value === '' || value === 'undefined' || value === 'null') return false;
  if (value.trim() === '') return false;
  return true;
}

/**
 * Validates that all required environment variables are present
 * Throws an error with helpful message if any are missing
 * 
 * IMPORTANT: Vite's define only replaces EXACT static matches like `process.env.ANTHROPIC_API_KEY`.
 * Dynamic access like `process.env[key]` does NOT work! We must access each variable directly.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  // Check Supabase vars (available via import.meta.env)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!isValidEnvValue(supabaseUrl)) missing.push('VITE_SUPABASE_URL');
  if (!isValidEnvValue(supabaseKey)) missing.push('VITE_SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.local file and ensure all required variables are set.\n` +
      `Required variables:\n` +
      `  - VITE_SUPABASE_URL\n` +
      `  - VITE_SUPABASE_ANON_KEY`
    );
  }

  // Check API keys - must access directly (not dynamically) for Vite's define to work
  // These are replaced at build time by vite.config.ts define
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const grokKey = process.env.XAI_API_KEY;

  const hasAtLeastOneApiKey = 
    isValidEnvValue(anthropicKey) || 
    isValidEnvValue(geminiKey) || 
    isValidEnvValue(openaiKey) || 
    isValidEnvValue(deepseekKey) || 
    isValidEnvValue(grokKey);

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
 * Gets optional environment variable value, returns undefined if not set or invalid.
 * For API keys, we must access them directly (not dynamically) for Vite's define to work.
 */
function getOptionalApiKey(value: unknown): string | undefined {
  return isValidEnvValue(value) ? value : undefined;
}

/**
 * Validated environment configuration
 * 
 * IMPORTANT: API keys must be accessed via direct property access (process.env.KEY_NAME)
 * because Vite's define only replaces exact static matches at build time.
 */
export const env = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  deepseek: {
    apiKey: getOptionalApiKey(process.env.DEEPSEEK_API_KEY),
  },
  anthropic: {
    apiKey: getOptionalApiKey(process.env.ANTHROPIC_API_KEY),
  },
  gemini: {
    apiKey: getOptionalApiKey(process.env.GEMINI_API_KEY),
  },
  openai: {
    apiKey: getOptionalApiKey(process.env.OPENAI_API_KEY),
  },
  grok: {
    apiKey: getOptionalApiKey(process.env.XAI_API_KEY),
  },
} as const;
