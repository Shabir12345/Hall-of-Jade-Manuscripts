/**
 * Environment variable validation and access
 * 
 * Simplified Two-Model Architecture:
 *   - DEEPSEEK_API_KEY: Required for "The Writer" (DeepSeek-V3.2)
 *   - GEMINI_API_KEY: Required for "The Clerk" (Gemini Flash)
 * 
 * Note: Vite only exposes variables prefixed with VITE_ to the client.
 * For API keys, we use Vite's define in vite.config.ts to expose them.
 */

interface EnvConfig {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  DEEPSEEK_API_KEY: string;
  GEMINI_API_KEY: string;
  PINECONE_API_KEY?: string; // Optional for vector DB
  OPENAI_API_KEY?: string; // Optional for embeddings
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
 * IMPORTANT: Vite's define only replaces EXACT static matches like `process.env.DEEPSEEK_API_KEY`.
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
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const hasDeepSeek = isValidEnvValue(deepseekKey);
  const hasGemini = isValidEnvValue(geminiKey);

  // Both keys are required for the two-model architecture
  const missingApiKeys: string[] = [];
  if (!hasDeepSeek) missingApiKeys.push('DEEPSEEK_API_KEY');
  if (!hasGemini) missingApiKeys.push('GEMINI_API_KEY');

  if (missingApiKeys.length > 0) {
    throw new Error(
      `Missing required AI provider API keys: ${missingApiKeys.join(', ')}\n\n` +
      `This application uses a two-model architecture:\n` +
      `  - DEEPSEEK_API_KEY: "The Writer" - DeepSeek-V3.2 for chapter generation and creative writing\n` +
      `  - GEMINI_API_KEY: "The Clerk" - Gemini Flash for state extraction and metadata processing\n\n` +
      `Please set both API keys in your .env.local file:\n` +
      `  DEEPSEEK_API_KEY=your_deepseek_api_key\n` +
      `  GEMINI_API_KEY=your_gemini_api_key`
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
 * 
 * Two-Model Architecture:
 *   - deepseek: "The Writer" - DeepSeek-V3.2 for creative writing
 *   - gemini: "The Clerk" - Gemini Flash for state extraction
 */
export const env = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  // "The Writer" - DeepSeek-V3.2 for chapter generation, arc planning, creative writing
  deepseek: {
    apiKey: getOptionalApiKey(process.env.DEEPSEEK_API_KEY),
  },
  // "The Clerk" - Gemini Flash for state extraction, metadata processing
  gemini: {
    apiKey: getOptionalApiKey(process.env.GEMINI_API_KEY),
  },
  // Optional: Pinecone for vector database (semantic search)
  pinecone: {
    apiKey: getOptionalApiKey(process.env.PINECONE_API_KEY),
  },
  // Optional: OpenAI for embeddings (required for Pinecone semantic search)
  openai: {
    apiKey: getOptionalApiKey(process.env.OPENAI_API_KEY),
  },
} as const;

/**
 * Check if DeepSeek ("The Writer") is available
 */
export function hasDeepSeekApi(): boolean {
  return isValidEnvValue(env.deepseek.apiKey);
}

/**
 * Check if Gemini ("The Clerk") is available
 */
export function hasGeminiApi(): boolean {
  return isValidEnvValue(env.gemini.apiKey);
}

/**
 * Check if both required LLMs are configured
 */
export function hasRequiredLlms(): boolean {
  return hasDeepSeekApi() && hasGeminiApi();
}
