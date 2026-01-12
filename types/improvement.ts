import { NovelState, Chapter } from '../types';

/**
 * Improvement Category - Which aspect of the novel to improve
 */
export type ImprovementCategory = 
  | 'excellence'        // Overall excellence score
  | 'structure'         // Story structure (three-act, beats, Hero's Journey)
  | 'engagement'        // Reader engagement metrics
  | 'character'         // Character development and psychology
  | 'theme'             // Theme evolution and resonance
  | 'tension'           // Tension mapping and conflict
  | 'prose'             // Prose quality
  | 'originality'       // Originality and cliché detection
  | 'voice'             // Voice uniqueness
  | 'literary_devices'  // Literary device usage
  | 'market_readiness'; // Market readiness

/**
 * Improvement Request - User's request for improvement
 */
export interface ImprovementRequest {
  category: ImprovementCategory;
  focusArea?: string;              // Specific weakness ID or description
  targetScore?: number;            // Target score to achieve (0-100)
  maxChaptersToInsert?: number;    // Limit on new chapters (default: unlimited)
  maxChaptersToEdit?: number;      // Limit on chapters to edit (default: all needed)
  scope?: 'focused' | 'comprehensive'; // Focus on one area or all related areas
}

/**
 * Weakness Analysis - Analysis of weaknesses in a category
 */
export interface WeaknessAnalysis {
  category: ImprovementCategory;
  overallScore: number;            // Current overall score (0-100)
  targetScore: number;             // Target score to achieve
  weaknesses: Array<{
    id: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    currentScore: number;
    targetScore: number;
    chaptersAffected?: number[];
    improvements: string[];        // Suggested improvements
  }>;
  recommendations: string[];
}

/**
 * Category Weakness Analysis - Detailed weakness analysis
 */
export interface CategoryWeaknessAnalysis extends WeaknessAnalysis {
  subCategoryScores?: Record<string, number>;
  specificIssues?: Array<{
    issue: string;
    location?: {
      chapterId?: string;
      chapterNumber?: number;
      section?: string;
    };
    impact: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Weakness Chapter Mapping - Maps weaknesses to specific chapters
 */
export interface WeaknessChapterMapping {
  weaknessId: string;
  chapterId: string;
  chapterNumber: number;
  relevance: number;               // 0-100, how relevant this chapter is
  actionType: 'edit' | 'insert_before' | 'insert_after';
  description: string;
}

/**
 * Edit Action - Action to edit an existing chapter
 */
export interface EditAction {
  chapterId: string;
  chapterNumber: number;
  section: 'beginning' | 'middle' | 'end' | 'throughout';
  improvementType: 'add_content' | 'modify_content' | 'enhance_quality' | 'fix_issue';
  description: string;
  estimatedWordCount?: number;
}

/**
 * Insert Action - Action to insert new chapters
 */
export interface InsertAction {
  position: number;                // Chapter number after which to insert
  chapterCount: number;            // How many chapters to insert
  purpose: string;                 // Why these chapters are needed
  estimatedWordCount?: number;
}

/**
 * Regenerate Action - Action to regenerate a chapter
 */
export interface RegenerateAction {
  chapterId: string;
  chapterNumber: number;
  reason: string;
  improvements: string[];
  preserveStructure?: boolean;     // Keep same beats/structure
}

/**
 * Improvement Strategy - Actionable plan for improvement
 */
export interface ImprovementStrategy {
  id: string;
  category: ImprovementCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetScore: number;              // Current score
  goalScore: number;                // Target score
  description: string;
  rationale: string;
  
  // Strategy type determines execution approach
  strategyType: 'edit' | 'insert' | 'hybrid' | 'regenerate';
  
  // Edit strategy: Which chapters and what to edit
  editActions?: EditAction[];
  
  // Insert strategy: Where to insert new chapters
  insertActions?: InsertAction[];
  
  // Hybrid strategy: Combination of edits and inserts
  hybridActions?: Array<{
    type: 'edit' | 'insert';
    action: EditAction | InsertAction;
  }>;
  
  // Regenerate strategy: Regenerate specific chapters
  regenerateActions?: RegenerateAction[];
  
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'low' | 'medium' | 'high';
  chaptersAffected: number[];
  expectedImprovement: number;      // Expected score improvement (0-100)
}

/**
 * Improvement Action - Specific action to execute
 */
export interface ImprovementAction {
  id: string;
  type: 'edit' | 'insert' | 'regenerate';
  strategyId: string;
  
  // Edit action
  editAction?: {
    chapterId: string;
    chapterNumber: number;
    instruction: string;             // Detailed instruction for AI
    targetSection?: string;          // Specific section to edit
    context?: string;                // Context for the edit
  };
  
  // Insert action
  insertAction?: {
    position: number;                // Insert after this chapter number
    chapterCount: number;
    instructions: string[];          // One instruction per chapter
    bridgingContent?: boolean;       // Whether to bridge to next chapter
  };
  
  // Regenerate action
  regenerateAction?: {
    chapterId: string;
    chapterNumber: number;
    improvements: string[];          // What to improve
    preserveStructure?: boolean;     // Keep same beats/structure
  };
  
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: ImprovementActionResult;
  error?: string;
}

/**
 * Improvement Result - Result of executing an action
 */
export interface ImprovementActionResult {
  success: boolean;
  chapterId?: string;
  chapterNumber?: number;
  changesApplied: boolean;
  newContentLength?: number;
  oldContentLength?: number;
  insertedChapters?: Array<{
    id: string;
    number: number;
    title: string;
  }>;
  validationScore?: number;          // Re-analysis score after improvement
  error?: string;
}

/**
 * Validation Result - Result of validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  scoreImprovement?: number;
  goalsMet?: boolean;
}

/**
 * Action Validation - Validation of action execution
 */
export interface ActionValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Continuity Validation - Validation of story continuity
 */
export interface ContinuityValidation {
  valid: boolean;
  issues: string[];
  previousChapterContinuity?: {
    valid: boolean;
    issues: string[];
  };
  nextChapterContinuity?: {
    valid: boolean;
    issues: string[];
  };
}

/**
 * Reference Update - Update to a reference after chapter insertion
 */
export interface ReferenceUpdate {
  type: 'arc' | 'character' | 'antagonist' | 'foreshadowing' | 'world_bible' | 'scene';
  entityId: string;
  field: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  description: string;
}

/**
 * Improvement Execution Result - Overall result
 */
export interface ImprovementExecutionResult {
  strategyId: string;
  category: ImprovementCategory;
  success: boolean;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  chaptersEdited: number;
  chaptersInserted: number;
  chaptersRegenerated: number;
  
  // Score improvements
  scoreBefore: number;
  scoreAfter: number;
  scoreImprovement: number;
  
  // Detailed results
  actionResults: ImprovementActionResult[];
  failures: Array<{
    actionId: string;
    error: string;
    chapterNumber?: number;
  }>;
  
  // Validation
  validationResults: {
    improvementsValidated: boolean;
    scoreImproved: boolean;
    allGoalsMet: boolean;
    warnings: string[];
  };
  
  summary: string;
  executionTime: number;
  updatedState?: NovelState;
}

/**
 * Improvement History - Track all improvements
 */
export interface ImprovementHistory {
  id: string;
  novelId: string;
  timestamp: number;
  category: ImprovementCategory;
  request: ImprovementRequest;
  strategy: ImprovementStrategy;
  result: ImprovementExecutionResult;
  rolledBack: boolean;
  rollbackTimestamp?: number;
}

/**
 * Improvement Guidance - Guidance for future chapter generation
 */
export interface ImprovementGuidance {
  targets: Array<{
    category: ImprovementCategory;
    description: string;
    currentScore: number;
    targetScore: number;
    specificInstructions?: string;
  }>;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Improvement Dialog State - State for improvement dialog
 */
export interface ImprovementDialogState {
  phase: 'strategy_preview' | 'executing' | 'results';
  strategy: ImprovementStrategy | null;
  progress: number;
  progressMessage: string;
  result: ImprovementExecutionResult | null;
  error: string | null;
}
