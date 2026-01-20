/**
 * Critique-Correction Loop Types
 * 
 * Defines the interfaces for the Auto-Critic Agent system that evaluates
 * DeepSeek-generated chapters against a configurable Style Rubric and
 * iteratively refines prose quality.
 */

/**
 * A single criterion within a style rubric
 */
export interface StyleCriterion {
  /** Unique identifier for the criterion */
  id: string;
  /** Display name (e.g., "Poetic Language", "Adverb Minimization") */
  name: string;
  /** Detailed description of what this criterion evaluates */
  description: string;
  /** Importance weight from 1-10 (10 being most important) */
  weight: number;
  /** The prompt sent to Gemini to evaluate this criterion */
  evaluationPrompt: string;
  /** Optional examples of good and bad writing for this criterion */
  examples?: {
    good: string;
    bad: string;
  }[];
  /** Category for grouping related criteria */
  category?: 'voice' | 'style' | 'technical' | 'narrative' | 'character';
}

/**
 * A complete style rubric containing multiple criteria
 */
export interface StyleRubric {
  /** Unique identifier */
  id: string;
  /** Display name (e.g., "Literary Fiction", "Action-Focused") */
  name: string;
  /** Description of the rubric's purpose and style goals */
  description: string;
  /** Array of criteria to evaluate against */
  criteria: StyleCriterion[];
  /** Minimum score (1-10) required to pass (default: 8) */
  minimumScore: number;
  /** Maximum correction iterations before accepting (default: 3) */
  maxIterations: number;
  /** Whether this rubric is active/enabled */
  enabled: boolean;
  /** Optional genre-specific tags */
  genres?: string[];
  /** Timestamp when created */
  createdAt: number;
  /** Timestamp when last modified */
  updatedAt: number;
}

/**
 * A single issue identified during critique
 */
export interface CritiqueIssue {
  /** Which criterion this issue relates to */
  criterionId: string;
  /** Criterion name for display */
  criterionName: string;
  /** How severe is this issue */
  severity: 'minor' | 'major' | 'critical';
  /** Location in the text (optional) */
  location?: {
    /** Paragraph number (1-based) */
    paragraph: number;
    /** Sentence number within paragraph (1-based, optional) */
    sentence?: number;
    /** Approximate character offset from start */
    charOffset?: number;
    /** Text excerpt showing the issue */
    excerpt?: string;
  };
  /** Description of the issue */
  description: string;
  /** Specific suggestion for how to fix */
  suggestedFix: string;
  /** Example of better phrasing (optional) */
  betterExample?: string;
}

/**
 * Result of critiquing a chapter against a rubric
 */
export interface CritiqueResult {
  /** Overall score from 1-10 */
  overallScore: number;
  /** Individual scores for each criterion (criterion ID -> score) */
  criteriaScores: Record<string, number>;
  /** Detailed issues found */
  issues: CritiqueIssue[];
  /** Whether the chapter passes the minimum threshold */
  passesThreshold: boolean;
  /** The threshold that was used */
  threshold: number;
  /** Rubric ID that was used */
  rubricId: string;
  /** Summary of the critique in prose form */
  summary: string;
  /** Strengths identified in the writing */
  strengths: string[];
  /** Timestamp when critique was performed */
  critiquedAt: number;
}

/**
 * A specific instruction for correcting part of the chapter
 */
export interface CorrectionInstruction {
  /** Unique ID for this instruction */
  id: string;
  /** Priority order (lower = more important to fix) */
  priority: number;
  /** Type of correction */
  type: 'rewrite' | 'delete' | 'expand' | 'restructure' | 'tone_shift';
  /** Which part of the text to correct */
  target: {
    /** Paragraph number (1-based) */
    paragraph?: number;
    /** Sentence range within paragraph */
    sentenceRange?: { start: number; end: number };
    /** Or a text excerpt to find and replace */
    excerpt?: string;
    /** Scope of the correction */
    scope: 'sentence' | 'paragraph' | 'section' | 'chapter';
  };
  /** What the issue is */
  issue: string;
  /** Specific instruction for how to rewrite */
  instruction: string;
  /** Example of desired output (optional) */
  example?: string;
  /** Related criterion ID */
  criterionId: string;
}

/**
 * A complete set of corrections to apply to a chapter
 */
export interface CorrectionSet {
  /** Unique ID for this correction set */
  id: string;
  /** Chapter ID being corrected */
  chapterId: string;
  /** Iteration number (1 = first correction attempt) */
  iteration: number;
  /** The critique result that generated these corrections */
  critiqueResult: CritiqueResult;
  /** Ordered list of correction instructions */
  instructions: CorrectionInstruction[];
  /** Combined instruction prompt for DeepSeek */
  combinedPrompt: string;
  /** Timestamp when created */
  createdAt: number;
}

/**
 * Configuration for the critique-correction loop
 */
export interface CritiqueCorrectionConfig {
  /** Whether the critique-correction loop is enabled */
  enabled: boolean;
  /** Default minimum score to pass (1-10) */
  defaultMinimumScore: number;
  /** Maximum iterations before accepting */
  maxIterations: number;
  /** Temperature for Gemini critique (lower = more consistent) */
  critiqueTemperature: number;
  /** Temperature for DeepSeek correction (higher = more creative) */
  correctionTemperature: number;
  /** Maximum issues to include in each correction prompt */
  maxIssuesPerCorrection: number;
  /** Whether to focus corrections on highest-weight criteria first */
  prioritizeHighWeightCriteria: boolean;
  /** Whether to preserve word count during corrections */
  preserveWordCount: boolean;
  /** Tolerance for word count changes (e.g., 0.1 = 10% change allowed) */
  wordCountTolerance: number;
  /** Whether to log detailed critique information */
  verboseLogging: boolean;
}

/**
 * Result of the complete critique-correction loop
 */
export interface CritiqueCorrectionResult {
  /** Whether the loop succeeded (passed threshold or max iterations) */
  success: boolean;
  /** Final chapter content after corrections */
  finalContent: string;
  /** Final chapter title (may be unchanged) */
  finalTitle: string;
  /** Final chapter summary (may be regenerated) */
  finalSummary: string;
  /** Number of iterations performed */
  iterations: number;
  /** Final critique result */
  finalCritique: CritiqueResult;
  /** History of all critiques and corrections */
  history: Array<{
    iteration: number;
    critique: CritiqueResult;
    corrections?: CorrectionSet;
    contentAfter: string;
  }>;
  /** Total time spent in the loop (ms) */
  totalTimeMs: number;
  /** Estimated cost of the critique loop */
  estimatedCost: number;
}

/**
 * Phase types for the critique-correction loop (for progress callbacks)
 */
export type CritiqueCorrectionPhase =
  | 'critique_start'
  | 'critique_evaluation'
  | 'critique_complete'
  | 'correction_start'
  | 'correction_generation'
  | 'correction_application'
  | 'correction_complete'
  | 'loop_complete';

/**
 * Callback for critique-correction phase updates
 */
export interface CritiqueCorrectionCallbacks {
  onPhase?: (phase: CritiqueCorrectionPhase, data?: Record<string, unknown>) => void;
  onProgress?: (message: string, progress: number) => void;
  onCritiqueResult?: (result: CritiqueResult, iteration: number) => void;
  onCorrectionApplied?: (corrections: CorrectionSet, newContent: string) => void;
}

/**
 * Novel-level style configuration (stored in NovelState)
 */
export interface NovelStyleConfig {
  /** Active rubric ID for this novel */
  activeRubricId?: string;
  /** Custom rubric overrides */
  customRubric?: Partial<StyleRubric>;
  /** Whether critique-correction is enabled for this novel */
  critiqueCorrectionEnabled: boolean;
  /** Custom minimum score override */
  minimumScoreOverride?: number;
  /** Custom max iterations override */
  maxIterationsOverride?: number;
  /** Character-specific voice guidelines */
  characterVoiceGuidelines?: Record<string, string>;
}
