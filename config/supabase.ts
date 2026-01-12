// Supabase configuration
// Uses environment variables for security

import { env } from '../utils/env';

export const SUPABASE_CONFIG = {
  url: env.supabase.url,
  anonKey: env.supabase.anonKey,
};
