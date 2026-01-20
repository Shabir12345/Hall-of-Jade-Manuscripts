/**
 * Director Agent Module
 * 
 * The Director sits between the Arc outline and the Writer (DeepSeek)
 * to generate detailed beat sheets that control pacing.
 * 
 * Exports:
 * - runDirectorAgent: Main entry point for beat sheet generation
 * - formatBeatSheetForPrompt: Format beat sheet for Writer injection
 * - shouldRunDirector: Check if Director should run
 * - analyzeArcPosition: Arc position analysis utilities
 * - Tension Tracker: Track and analyze tension across chapters
 */

export {
  runDirectorAgent,
  formatBeatSheetForPrompt,
  shouldRunDirector,
  analyzeArcPosition,
} from './directorAgent';

export {
  generatePhaseBeats,
  generatePacingGuidance,
  generateClimaxProtection,
  getXianxiaScenarioNotes,
  validateBeatSheet,
} from './beatSheetGenerator';

export {
  DIRECTOR_SYSTEM_PROMPT,
  buildDirectorUserPrompt,
  buildQuickDirectorPrompt,
  getArcPhaseDescription,
  generateXianxiaPacingWarnings,
} from './directorPrompts';

// Tension Tracking
export {
  recordTensionFromBeatSheet,
  analyzeTensionFromContent,
  getTensionHistory,
  analyzeTensionCurve,
  getRecommendedTension,
  saveTensionEntry,
  formatTensionAnalysis,
} from './tensionTracker';

export type {
  TensionEntry,
  TensionCurveAnalysis,
} from './tensionTracker';

// Configuration Helper
export {
  getDirectorConfig,
  getLivingWorldConfig,
  isDirectorEnabled,
  isLivingWorldEnabled,
  getXianxiaPacingRules,
  validateDirectorConfig,
  validateLivingWorldConfig,
  getRecommendedSettings,
  logConfiguration,
} from './configHelper';
