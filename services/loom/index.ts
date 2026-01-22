/**
 * Heavenly Loom Service Exports
 * 
 * The complete Narrative Control System for long-form fiction.
 */

// Thread Physics Engine
export {
  storyThreadToLoomThread,
  calculateUrgency,
  calculateNarrativeGravity,
  determineNextStatus,
  transitionThread,
  incrementPayoffDebt,
  updateEntropy,
  selectThreadsForChapter,
  calculateThreadHealthMetrics,
  processChapterEnd,
  getOverallLoomHealth,
} from './threadPhysicsEngine';

// Loom Clerk (Narrative Auditor)
export {
  runLoomClerkAudit,
  applyAuditToThreads,
} from './loomClerkService';

// Loom Director (Narrative Scheduler)
export {
  generateDirectorDirective,
  directiveToConstraints,
  formatDirectiveForPrompt,
} from './loomDirectorService';

// Re-export types for convenience
export type {
  LoomThread,
  LoomThreadStatus,
  ThreadCategory,
  ProgressType,
  MentionType,
  ConstraintType,
  ThreadMention,
  DirectorConstraint,
  ClerkThreadUpdate,
  ClerkAuditResult,
  ThreadAnchor,
  DirectorDirective,
  LoomConfig,
  ThreadHealthMetrics,
  LoomDashboardState,
  ThreadPhysics,
} from '../../types/loom';

export {
  DEFAULT_LOOM_CONFIG,
  calculateThreadPhysics,
  calculatePayoffHorizon,
  getThreadPulseColor,
  canTransitionTo,
  validateResolution,
  VALID_STATUS_TRANSITIONS,
} from '../../types/loom';
