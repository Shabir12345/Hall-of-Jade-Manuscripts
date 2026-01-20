/**
 * Clerk Agent Module
 * 
 * The "Heavenly Record-Keeper" - an AI agent that maintains narrative consistency
 * by auditing each chapter and producing structured delta updates for the Lore Bible.
 * 
 * This module exports all Clerk-related services for easy import.
 * 
 * @example
 * ```typescript
 * import { runClerkAudit, applyClerkDelta, validateClerkDelta } from './services/clerk';
 * 
 * // Run audit after chapter generation
 * const result = await runClerkAudit(novelState, newChapter);
 * 
 * if (result.success && result.delta) {
 *   // Validate the delta
 *   const validation = validateClerkDelta(result.delta, loreBible, novelState);
 *   
 *   if (validation.valid) {
 *     // Apply to Lore Bible
 *     const applied = applyClerkDelta(loreBible, result.delta);
 *   }
 * }
 * ```
 */

// ============================================================================
// CLERK AGENT - Main Service
// ============================================================================

export {
  runClerkAudit,
  runQuickClerkAudit,
  hasMeaningfulUpdates,
  getDeltaSummary,
  mergeDeltas,
} from './clerkAgent';

// ============================================================================
// DELTA APPLICATOR - Apply deltas to Lore Bible
// ============================================================================

export {
  applyClerkDelta,
  type DeltaApplyResult,
} from './deltaApplicator';

// ============================================================================
// AUDIT VALIDATORS - Validation logic
// ============================================================================

export {
  validateClerkDelta,
  validateAgainstChapterText,
} from './auditValidators';

// ============================================================================
// PROMPTS - Clerk system prompts
// ============================================================================

export {
  CLERK_SYSTEM_PROMPT,
  buildClerkUserPrompt,
  buildQuickClerkPrompt,
  buildValidationPrompt,
  formatLoreBibleForClerk,
  CLERK_DELTA_SCHEMA,
} from './clerkPrompts';

// ============================================================================
// RE-EXPORT TYPES from types/clerk.ts
// ============================================================================

export type {
  // Delta types
  ClerkDelta,
  ClerkResult,
  ClerkConfig,
  ClerkRawResponse,
  
  // Update types
  TechniqueUpdate,
  InventoryUpdate,
  CharacterStateUpdate,
  ConflictUpdate,
  KarmaDebtUpdate,
  PromiseUpdate,
  ProtagonistUpdate,
  PowerSystemUpdate,
  
  // Validation types
  DeltaValidationResult,
  DeltaValidationError,
  ContinuityFlag,
  
  // Audit types
  CultivationAuditResult,
  InventoryAuditResult,
  KarmicTiesAuditResult,
  ThreadAuditResult,
  ClerkAuditResults,
} from '../../types/clerk';

export { DEFAULT_CLERK_CONFIG } from '../../types/clerk';
