import { Chapter, Arc, NovelState } from '../types';

export type EditorTriggerType = 'chapter_batch' | 'arc_complete' | 'manual';
export type IssueSeverity = 'minor' | 'major';
export type IssueType = 'gap' | 'transition' | 'grammar' | 'continuity' | 'time_skip' | 'character_consistency' | 'plot_hole' | 'style' | 'formatting' | 'paragraph_structure' | 'sentence_structure';
export type FixStatus = 'pending' | 'approved' | 'rejected' | 'applied';
export type OverallFlowRating = 'excellent' | 'good' | 'adequate' | 'needs_work';

export interface EditorIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  chapterNumber: number;
  chapterId?: string;
  location: 'start' | 'middle' | 'end' | 'transition';
  description: string;
  suggestion: string;
  autoFixable: boolean;
  originalText?: string;
  context?: string;
  lineNumber?: number;
}

export interface EditorFix {
  id: string;
  issueId: string;
  chapterId: string;
  chapterNumber: number;
  fixType: IssueType;
  originalText: string; // Can be empty string for pure insertions
  fixedText: string;
  reason: string; // Description of what the fix does (from AI analysis)
  status: FixStatus;
  appliedAt?: number;
  rejectedReason?: string;
  failureReason?: string; // Why the fix failed to apply (e.g., "Text not found", "Validation failed")
  // For insertions: indicates where text should be inserted
  insertionLocation?: 'before' | 'after' | 'split';
  // Flag to distinguish insertions from replacements
  isInsertion?: boolean;
}

export interface EditorAnalysis {
  overallFlow: OverallFlowRating;
  continuityScore: number; // 0-100
  grammarScore: number; // 0-100
  styleScore: number; // 0-100
  issues: EditorIssue[];
  summary: string;
  strengths: string[];
  recommendations: string[];
}

export interface EditorReport {
  id: string;
  novelId: string;
  triggerType: EditorTriggerType;
  triggerId?: string; // Arc ID if arc_complete, undefined if chapter_batch
  chaptersAnalyzed: number[];
  analysis: EditorAnalysis;
  fixes: EditorFix[];
  autoFixedCount: number;
  pendingFixCount: number;
  createdAt: number;
}

/**
 * Internal properties added to EditorReport (not part of public API)
 * These properties are used internally during fix application but are not persisted
 */
export interface EditorReportWithInternal extends EditorReport {
  _failedAutoFixes?: EditorFix[];
  _updatedChapters?: Chapter[];
  _fixProposals?: EditorFixProposal[];
  _autoFixedCount?: number;
}

/**
 * Type guard to check if an EditorReport has internal properties
 */
export function isEditorReportWithInternal(
  report: EditorReport
): report is EditorReportWithInternal {
  return '_failedAutoFixes' in report || 
         '_updatedChapters' in report ||
         '_fixProposals' in report ||
         '_autoFixedCount' in report;
}

export interface EditorFixProposal {
  issue: EditorIssue;
  fix: EditorFix;
  preview?: {
    before: string;
    after: string;
    context: string;
  };
}

export interface ChapterBatchEditorInput {
  chapters: Chapter[];
  novelState: NovelState;
  startChapter: number;
  endChapter: number;
}

export interface ArcEditorInput {
  arc: Arc;
  chapters: Chapter[];
  novelState: NovelState;
}

export interface EditorServiceOptions {
  onProgress?: (phase: string, progress?: number) => void;
  onIssueFound?: (issue: EditorIssue) => void;
  onAutoFix?: (fix: EditorFix) => void;
}

/**
 * Recurring Issue Pattern
 * Tracks patterns of recurring issues detected during chapter editing/analysis
 */
export interface RecurringIssuePattern {
  id: string;
  issueType: IssueType;
  location: 'start' | 'middle' | 'end' | 'transition';
  patternDescription: string; // Human-readable description
  occurrenceCount: number;
  thresholdCount: number; // Threshold for considering it recurring (default: 5)
  firstDetectedAt: number; // Timestamp
  lastSeenAt: number; // Timestamp
  isActive: boolean; // true if still occurring, false if resolved
  promptConstraintAdded?: string; // The constraint text added to prompts
  resolvedAt?: number; // Timestamp when pattern was resolved
  createdAt: number;
  updatedAt: number;
}

/**
 * Pattern Occurrence
 * Tracks individual occurrences of recurring issue patterns
 */
export interface PatternOccurrence {
  id: string;
  patternId: string;
  chapterId?: string;
  chapterNumber: number;
  reportId?: string;
  issueId: string; // Reference to issue in report_data
  novelId: string;
  detectedAt: number; // Timestamp
  createdAt: number;
}

/**
 * Pattern Detection Result
 * Result of pattern detection analysis
 */
export interface PatternDetectionResult {
  detectedPatterns: RecurringIssuePattern[]; // New patterns that exceeded threshold
  updatedPatterns: RecurringIssuePattern[]; // Existing patterns that were updated
  occurrenceCount: number; // Total occurrences processed
}

/**
 * Professional Editing Suite Types
 */

/**
 * Text Range
 * Represents a range of text by character positions
 */
export interface TextRange {
  start: number;
  end: number;
}

/**
 * Editing Mode
 * Mode for the chapter editor
 */
export type EditingMode = 'normal' | 'suggest' | 'track';

/**
 * Highlight Category
 * Categories for text highlighting
 */
export type HighlightCategory = 'issue' | 'strength' | 'needs_work' | 'note' | 'question';

/**
 * Editor Comment
 * Comment/annotation on a specific text range
 */
export interface EditorComment {
  id: string;
  chapterId: string;
  entityType: 'chapter' | 'scene';
  entityId: string; // Chapter ID or Scene ID
  textRange: TextRange;
  selectedText: string; // Snippet of commented text
  comment: string;
  author: 'user' | 'ai';
  resolved: boolean;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Editor Suggestion
 * Track change/suggestion (like Word/Google Docs)
 */
export interface EditorSuggestion {
  id: string;
  chapterId: string;
  suggestionType: 'insertion' | 'deletion' | 'replacement';
  originalText: string; // Can be empty string for pure insertions
  suggestedText: string;
  textRange: TextRange;
  status: 'pending' | 'accepted' | 'rejected';
  author: 'user' | 'ai';
  reason: string; // Explanation of suggestion
  createdAt: number;
  updatedAt: number;
}

/**
 * Editor Highlight
 * Text highlighting with category and color
 */
export interface EditorHighlight {
  id: string;
  chapterId: string;
  textRange: TextRange;
  highlightType: HighlightCategory;
  color: string; // Hex color code
  note?: string; // Optional note
  createdAt: number;
  updatedAt: number;
}

/**
 * Style Check Type
 * Types of style checks performed
 */
export type StyleCheckType = 'pov' | 'dialogue' | 'pacing' | 'sentence_variety' | 'structure' | 'consistency';

/**
 * Style Check Severity
 * Severity level of a style check issue
 */
export type StyleCheckSeverity = 'error' | 'warning' | 'info';

/**
 * Style Check
 * Result of a style check on text
 */
export interface StyleCheck {
  id: string;
  chapterId: string;
  checkType: StyleCheckType;
  location: TextRange;
  severity: StyleCheckSeverity;
  message: string;
  suggestion?: string; // Optional fix suggestion
  checkedAt: number;
}

/**
 * Create Comment Input
 * Input for creating a new comment
 */
export interface CreateCommentInput {
  chapterId: string;
  entityType: 'chapter' | 'scene';
  entityId: string;
  textRange: TextRange;
  selectedText: string;
  comment: string;
  author?: 'user' | 'ai';
}

/**
 * Create Suggestion Input
 * Input for creating a new suggestion
 */
export interface CreateSuggestionInput {
  chapterId: string;
  suggestionType: 'insertion' | 'deletion' | 'replacement';
  originalText: string;
  suggestedText: string;
  textRange: TextRange;
  author?: 'user' | 'ai';
  reason?: string;
}

/**
 * Create Highlight Input
 * Input for creating a new highlight
 */
export interface CreateHighlightInput {
  chapterId: string;
  textRange: TextRange;
  highlightType: HighlightCategory;
  color: string;
  note?: string;
}

/**
 * Update Comment Input
 * Input for updating a comment
 */
export interface UpdateCommentInput {
  comment?: string;
  resolved?: boolean;
}

/**
 * Update Highlight Input
 * Input for updating a highlight
 */
export interface UpdateHighlightInput {
  highlightType?: HighlightCategory;
  color?: string;
  note?: string;
}
