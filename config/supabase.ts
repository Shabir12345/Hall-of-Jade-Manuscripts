// Supabase configuration
// Uses environment variables for security

import { env } from '../utils/env';

// Authentication control flag
// Set to false to disable authentication during development
// Set to true when ready to launch with authentication enabled
export const AUTHENTICATION_ENABLED = false;

export const SUPABASE_CONFIG = {
  url: env.supabase.url,
  anonKey: env.supabase.anonKey,
};
