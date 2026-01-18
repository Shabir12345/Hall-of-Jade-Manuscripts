/**
 * Change Tracker Service
 * Tracks before/after content changes and generates diffs for visualization.
 * Provides detailed change analysis at paragraph and sentence level.
 */

import { NovelState, Chapter } from '../types';
import { generateUUID } from '../utils/uuid';

export interface ContentChange {
  id: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  type: 'addition' | 'deletion' | 'modification' | 'unchanged';
  beforeContent: string;
  afterContent: string;
  position: {
    startLine: number;
    endLine: number;
    startChar: number;
    endChar: number;
  };
  stats: {
    wordsBefore: number;
    wordsAfter: number;
    wordChange: number;
    charsBefore: number;
    charsAfter: number;
  };
  reason?: string; // Why this change was made
  explanation?: ChangeExplanation; // Detailed explanation
  timestamp: number;
}

/**
 * Detailed explanation for why a change was made
 */
export interface ChangeExplanation {
  summary: string; // Brief explanation
  category: string; // Which improvement category this addresses
  issueAddressed?: string; // What issue this fixes
  expectedBenefit: string; // What improvement is expected
  confidence: 'high' | 'medium' | 'low';
  relatedIssues?: string[]; // Other issues this might help with
}

export interface ChapterDiff {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  hasChanges: boolean;
  changes: ContentChange[];
  summary: {
    totalAdditions: number;
    totalDeletions: number;
    totalModifications: number;
    netWordChange: number;
    changePercentage: number; // How much of the chapter changed
  };
  beforeContent: string;
  afterContent: string;
}

export interface NovelDiff {
  novelId: string;
  novelTitle: string;
  timestamp: number;
  category: string;
  chapterDiffs: ChapterDiff[];
  summary: {
    chaptersChanged: number;
    chaptersUnchanged: number;
    totalAdditions: number;
    totalDeletions: number;
    totalModifications: number;
    netWordChange: number;
    overallChangePercentage: number;
  };
  beforeState: {
    totalWords: number;
    totalChapters: number;
  };
  afterState: {
    totalWords: number;
    totalChapters: number;
  };
}

/**
 * Generates a complete diff between original and improved novel states
 */
export function generateNovelDiff(
  originalState: NovelState,
  improvedState: NovelState,
  category: string
): NovelDiff {
  const chapterDiffs: ChapterDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalModifications = 0;
  let chaptersChanged = 0;
  let chaptersUnchanged = 0;
  
  // Process each chapter in the improved state
  improvedState.chapters.forEach(improvedChapter => {
    const originalChapter = originalState.chapters.find(ch => ch.id === improvedChapter.id);
    
    if (originalChapter) {
      const chapterDiff = generateChapterDiff(originalChapter, improvedChapter);
      chapterDiffs.push(chapterDiff);
      
      if (chapterDiff.hasChanges) {
        chaptersChanged++;
        totalAdditions += chapterDiff.summary.totalAdditions;
        totalDeletions += chapterDiff.summary.totalDeletions;
        totalModifications += chapterDiff.summary.totalModifications;
      } else {
        chaptersUnchanged++;
      }
    } else {
      // New chapter (entire chapter is an addition)
      const newChapterDiff: ChapterDiff = {
        chapterId: improvedChapter.id,
        chapterNumber: improvedChapter.number,
        chapterTitle: improvedChapter.title || `Chapter ${improvedChapter.number}`,
        hasChanges: true,
        changes: [{
          id: generateUUID(),
          chapterId: improvedChapter.id,
          chapterNumber: improvedChapter.number,
          chapterTitle: improvedChapter.title || `Chapter ${improvedChapter.number}`,
          type: 'addition',
          beforeContent: '',
          afterContent: improvedChapter.content,
          position: { startLine: 1, endLine: 1, startChar: 0, endChar: improvedChapter.content.length },
          stats: {
            wordsBefore: 0,
            wordsAfter: getWordCount(improvedChapter.content),
            wordChange: getWordCount(improvedChapter.content),
            charsBefore: 0,
            charsAfter: improvedChapter.content.length,
          },
          reason: 'New chapter added',
          timestamp: Date.now(),
        }],
        summary: {
          totalAdditions: 1,
          totalDeletions: 0,
          totalModifications: 0,
          netWordChange: getWordCount(improvedChapter.content),
          changePercentage: 100,
        },
        beforeContent: '',
        afterContent: improvedChapter.content,
      };
      chapterDiffs.push(newChapterDiff);
      chaptersChanged++;
      totalAdditions++;
    }
  });
  
  // Check for deleted chapters
  originalState.chapters.forEach(originalChapter => {
    const stillExists = improvedState.chapters.some(ch => ch.id === originalChapter.id);
    if (!stillExists) {
      const deletedChapterDiff: ChapterDiff = {
        chapterId: originalChapter.id,
        chapterNumber: originalChapter.number,
        chapterTitle: originalChapter.title || `Chapter ${originalChapter.number}`,
        hasChanges: true,
        changes: [{
          id: generateUUID(),
          chapterId: originalChapter.id,
          chapterNumber: originalChapter.number,
          chapterTitle: originalChapter.title || `Chapter ${originalChapter.number}`,
          type: 'deletion',
          beforeContent: originalChapter.content,
          afterContent: '',
          position: { startLine: 1, endLine: 1, startChar: 0, endChar: originalChapter.content.length },
          stats: {
            wordsBefore: getWordCount(originalChapter.content),
            wordsAfter: 0,
            wordChange: -getWordCount(originalChapter.content),
            charsBefore: originalChapter.content.length,
            charsAfter: 0,
          },
          reason: 'Chapter removed',
          timestamp: Date.now(),
        }],
        summary: {
          totalAdditions: 0,
          totalDeletions: 1,
          totalModifications: 0,
          netWordChange: -getWordCount(originalChapter.content),
          changePercentage: 100,
        },
        beforeContent: originalChapter.content,
        afterContent: '',
      };
      chapterDiffs.push(deletedChapterDiff);
      chaptersChanged++;
      totalDeletions++;
    }
  });
  
  // Calculate overall stats
  const originalTotalWords = originalState.chapters.reduce((sum, ch) => sum + getWordCount(ch.content), 0);
  const improvedTotalWords = improvedState.chapters.reduce((sum, ch) => sum + getWordCount(ch.content), 0);
  const netWordChange = improvedTotalWords - originalTotalWords;
  const overallChangePercentage = originalTotalWords > 0 
    ? Math.round((Math.abs(netWordChange) / originalTotalWords) * 100) 
    : 100;
  
  return {
    novelId: improvedState.id,
    novelTitle: improvedState.title,
    timestamp: Date.now(),
    category,
    chapterDiffs: chapterDiffs.sort((a, b) => a.chapterNumber - b.chapterNumber),
    summary: {
      chaptersChanged,
      chaptersUnchanged,
      totalAdditions,
      totalDeletions,
      totalModifications,
      netWordChange,
      overallChangePercentage,
    },
    beforeState: {
      totalWords: originalTotalWords,
      totalChapters: originalState.chapters.length,
    },
    afterState: {
      totalWords: improvedTotalWords,
      totalChapters: improvedState.chapters.length,
    },
  };
}

/**
 * Generates diff for a single chapter
 */
export function generateChapterDiff(
  originalChapter: Chapter,
  improvedChapter: Chapter
): ChapterDiff {
  const beforeContent = originalChapter.content || '';
  const afterContent = improvedChapter.content || '';
  
  // Quick check for no changes
  if (beforeContent === afterContent) {
    return {
      chapterId: originalChapter.id,
      chapterNumber: originalChapter.number,
      chapterTitle: originalChapter.title || `Chapter ${originalChapter.number}`,
      hasChanges: false,
      changes: [],
      summary: {
        totalAdditions: 0,
        totalDeletions: 0,
        totalModifications: 0,
        netWordChange: 0,
        changePercentage: 0,
      },
      beforeContent,
      afterContent,
    };
  }
  
  // Split into paragraphs for comparison
  const beforeParagraphs = beforeContent.split(/\n\n+/);
  const afterParagraphs = afterContent.split(/\n\n+/);
  
  const changes: ContentChange[] = [];
  
  // Use LCS-based diff for paragraph-level changes
  const diff = computeParagraphDiff(beforeParagraphs, afterParagraphs);
  
  diff.forEach((item, index) => {
    if (item.type !== 'unchanged') {
      changes.push({
        id: generateUUID(),
        chapterId: originalChapter.id,
        chapterNumber: originalChapter.number,
        chapterTitle: originalChapter.title || `Chapter ${originalChapter.number}`,
        type: item.type as 'addition' | 'deletion' | 'modification',
        beforeContent: item.before || '',
        afterContent: item.after || '',
        position: {
          startLine: index + 1,
          endLine: index + 1,
          startChar: 0,
          endChar: (item.after || item.before || '').length,
        },
        stats: {
          wordsBefore: getWordCount(item.before || ''),
          wordsAfter: getWordCount(item.after || ''),
          wordChange: getWordCount(item.after || '') - getWordCount(item.before || ''),
          charsBefore: (item.before || '').length,
          charsAfter: (item.after || '').length,
        },
        timestamp: Date.now(),
      });
    }
  });
  
  // Calculate summary stats
  const totalAdditions = changes.filter(c => c.type === 'addition').length;
  const totalDeletions = changes.filter(c => c.type === 'deletion').length;
  const totalModifications = changes.filter(c => c.type === 'modification').length;
  const netWordChange = getWordCount(afterContent) - getWordCount(beforeContent);
  
  // Calculate change percentage (based on characters changed)
  const totalCharsChanged = changes.reduce((sum, c) => {
    return sum + Math.max(c.stats.charsBefore, c.stats.charsAfter);
  }, 0);
  const totalChars = Math.max(beforeContent.length, afterContent.length);
  const changePercentage = totalChars > 0 ? Math.round((totalCharsChanged / totalChars) * 100) : 0;
  
  return {
    chapterId: originalChapter.id,
    chapterNumber: originalChapter.number,
    chapterTitle: originalChapter.title || `Chapter ${originalChapter.number}`,
    hasChanges: changes.length > 0,
    changes,
    summary: {
      totalAdditions,
      totalDeletions,
      totalModifications,
      netWordChange,
      changePercentage: Math.min(100, changePercentage),
    },
    beforeContent,
    afterContent,
  };
}

/**
 * Computes paragraph-level diff using a simple comparison algorithm
 */
function computeParagraphDiff(
  before: string[],
  after: string[]
): Array<{ type: 'addition' | 'deletion' | 'modification' | 'unchanged'; before?: string; after?: string }> {
  const result: Array<{ type: 'addition' | 'deletion' | 'modification' | 'unchanged'; before?: string; after?: string }> = [];
  
  const maxLen = Math.max(before.length, after.length);
  
  // Simple line-by-line comparison
  // For a more sophisticated diff, consider using a library like diff-match-patch
  let beforeIdx = 0;
  let afterIdx = 0;
  
  while (beforeIdx < before.length || afterIdx < after.length) {
    const beforePara = before[beforeIdx] || '';
    const afterPara = after[afterIdx] || '';
    
    if (beforeIdx >= before.length) {
      // Addition
      result.push({ type: 'addition', after: afterPara });
      afterIdx++;
    } else if (afterIdx >= after.length) {
      // Deletion
      result.push({ type: 'deletion', before: beforePara });
      beforeIdx++;
    } else if (beforePara === afterPara) {
      // Unchanged
      result.push({ type: 'unchanged', before: beforePara, after: afterPara });
      beforeIdx++;
      afterIdx++;
    } else if (similarity(beforePara, afterPara) > 0.5) {
      // Modification (similar enough to be considered the same paragraph)
      result.push({ type: 'modification', before: beforePara, after: afterPara });
      beforeIdx++;
      afterIdx++;
    } else {
      // Check if this paragraph was deleted or added
      // Look ahead to see if we find a match
      const nextAfterMatch = after.findIndex((p, i) => i > afterIdx && similarity(beforePara, p) > 0.7);
      const nextBeforeMatch = before.findIndex((p, i) => i > beforeIdx && similarity(afterPara, p) > 0.7);
      
      if (nextAfterMatch !== -1 && (nextBeforeMatch === -1 || nextAfterMatch - afterIdx < nextBeforeMatch - beforeIdx)) {
        // Additions before the match
        while (afterIdx < nextAfterMatch) {
          result.push({ type: 'addition', after: after[afterIdx] });
          afterIdx++;
        }
      } else if (nextBeforeMatch !== -1) {
        // Deletions before the match
        while (beforeIdx < nextBeforeMatch) {
          result.push({ type: 'deletion', before: before[beforeIdx] });
          beforeIdx++;
        }
      } else {
        // No good match - treat as modification
        result.push({ type: 'modification', before: beforePara, after: afterPara });
        beforeIdx++;
        afterIdx++;
      }
    }
  }
  
  return result;
}

/**
 * Calculates similarity between two strings (0-1)
 */
function similarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;
  
  // Normalize strings
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  // Use word-based Jaccard similarity
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Helper to count words
 */
function getWordCount(text: string): number {
  return (text || '').split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Generates a human-readable summary of changes
 */
export function generateChangeSummary(diff: NovelDiff): string {
  const { summary, chapterDiffs } = diff;
  
  if (summary.chaptersChanged === 0) {
    return 'No changes were made to the novel.';
  }
  
  const parts: string[] = [];
  
  parts.push(`Modified ${summary.chaptersChanged} of ${summary.chaptersChanged + summary.chaptersUnchanged} chapters.`);
  
  if (summary.netWordChange > 0) {
    parts.push(`Added ${summary.netWordChange} words overall.`);
  } else if (summary.netWordChange < 0) {
    parts.push(`Removed ${Math.abs(summary.netWordChange)} words overall.`);
  }
  
  // List the most changed chapters
  const significantChanges = chapterDiffs
    .filter(cd => cd.hasChanges && cd.summary.changePercentage > 10)
    .sort((a, b) => b.summary.changePercentage - a.summary.changePercentage)
    .slice(0, 3);
  
  if (significantChanges.length > 0) {
    const chapterList = significantChanges
      .map(cd => `Chapter ${cd.chapterNumber} (${cd.summary.changePercentage}% changed)`)
      .join(', ');
    parts.push(`Most significant changes: ${chapterList}.`);
  }
  
  return parts.join(' ');
}

/**
 * Exports diff as JSON for sharing/importing
 */
export function exportDiffAsJSON(diff: NovelDiff): string {
  return JSON.stringify(diff, null, 2);
}

/**
 * Imports diff from JSON
 */
export function importDiffFromJSON(json: string): NovelDiff | null {
  try {
    const parsed = JSON.parse(json);
    // Validate structure
    if (!parsed.novelId || !parsed.chapterDiffs) {
      return null;
    }
    return parsed as NovelDiff;
  } catch {
    return null;
  }
}

/**
 * Creates a visual diff representation for display
 */
export function createVisualDiff(change: ContentChange): {
  beforeLines: Array<{ text: string; type: 'removed' | 'context' }>;
  afterLines: Array<{ text: string; type: 'added' | 'context' }>;
} {
  const beforeLines = change.beforeContent.split('\n').map(text => ({
    text,
    type: 'removed' as const,
  }));
  
  const afterLines = change.afterContent.split('\n').map(text => ({
    text,
    type: 'added' as const,
  }));
  
  return { beforeLines, afterLines };
}

/**
 * Generates an explanation for a content change based on analysis
 */
export function generateChangeExplanation(
  change: ContentChange,
  category: string,
  actionDescription?: string
): ChangeExplanation {
  const { type, stats, beforeContent, afterContent } = change;
  
  // Analyze what kind of change was made
  const patterns = analyzeChangePatterns(beforeContent, afterContent);
  
  // Generate explanation based on change type and category
  let summary = '';
  let expectedBenefit = '';
  let issueAddressed: string | undefined;
  
  switch (type) {
    case 'addition':
      summary = `Added new content (${stats.wordsAfter} words)`;
      expectedBenefit = 'Expands narrative depth and addresses gaps';
      issueAddressed = 'Missing content or underdeveloped sections';
      break;
      
    case 'deletion':
      summary = `Removed content (${stats.wordsBefore} words)`;
      expectedBenefit = 'Tightens pacing and removes redundancy';
      issueAddressed = 'Verbose or redundant passages';
      break;
      
    case 'modification':
      if (stats.wordChange > 50) {
        summary = `Expanded content (+${stats.wordChange} words)`;
        expectedBenefit = 'Enhanced detail and narrative richness';
        issueAddressed = 'Thin or underdeveloped passages';
      } else if (stats.wordChange < -50) {
        summary = `Condensed content (${stats.wordChange} words)`;
        expectedBenefit = 'Improved pacing and readability';
        issueAddressed = 'Wordy or slow-paced passages';
      } else {
        summary = 'Refined content quality';
        expectedBenefit = 'Improved prose and clarity';
        issueAddressed = 'Quality or style issues';
      }
      break;
      
    default:
      summary = 'Minor adjustments';
      expectedBenefit = 'General improvement';
  }
  
  // Add category-specific context
  const categoryContext = getCategoryExplanation(category, patterns);
  if (categoryContext) {
    summary += `. ${categoryContext}`;
  }
  
  // Use action description if provided
  if (actionDescription) {
    summary = actionDescription;
  }
  
  // Determine confidence based on change magnitude
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (Math.abs(stats.wordChange) > 200 || patterns.length > 3) {
    confidence = 'high';
  } else if (Math.abs(stats.wordChange) < 20 && patterns.length < 2) {
    confidence = 'low';
  }
  
  return {
    summary,
    category,
    issueAddressed,
    expectedBenefit,
    confidence,
    relatedIssues: patterns.map(p => p.issue),
  };
}

/**
 * Analyzes patterns in the change to provide specific explanations
 */
function analyzeChangePatterns(
  before: string,
  after: string
): Array<{ pattern: string; issue: string }> {
  const patterns: Array<{ pattern: string; issue: string }> = [];
  
  const beforeLower = before.toLowerCase();
  const afterLower = after.toLowerCase();
  
  // Check for dialogue improvements
  const beforeDialogue = (before.match(/"/g) || []).length;
  const afterDialogue = (after.match(/"/g) || []).length;
  if (afterDialogue > beforeDialogue) {
    patterns.push({ pattern: 'dialogue', issue: 'Added dialogue for better character interaction' });
  }
  
  // Check for sensory detail additions
  const sensoryWords = ['saw', 'heard', 'felt', 'smelled', 'tasted', 'touched', 'watched', 'listened'];
  const beforeSensory = sensoryWords.filter(w => beforeLower.includes(w)).length;
  const afterSensory = sensoryWords.filter(w => afterLower.includes(w)).length;
  if (afterSensory > beforeSensory) {
    patterns.push({ pattern: 'sensory', issue: 'Added sensory details for immersion' });
  }
  
  // Check for emotion words
  const emotionWords = ['felt', 'feeling', 'emotion', 'anger', 'fear', 'joy', 'sadness', 'love', 'hate'];
  const beforeEmotion = emotionWords.filter(w => beforeLower.includes(w)).length;
  const afterEmotion = emotionWords.filter(w => afterLower.includes(w)).length;
  if (afterEmotion > beforeEmotion) {
    patterns.push({ pattern: 'emotion', issue: 'Enhanced emotional depth' });
  }
  
  // Check for action verbs
  const actionVerbs = ['ran', 'jumped', 'grabbed', 'pushed', 'pulled', 'fought', 'attacked', 'defended'];
  const beforeAction = actionVerbs.filter(w => beforeLower.includes(w)).length;
  const afterAction = actionVerbs.filter(w => afterLower.includes(w)).length;
  if (afterAction > beforeAction) {
    patterns.push({ pattern: 'action', issue: 'Added action for better pacing' });
  }
  
  // Check for sentence variety (short sentences added)
  const beforeSentences = before.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const afterSentences = after.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const beforeShort = beforeSentences.filter(s => s.split(/\s+/).length < 8).length;
  const afterShort = afterSentences.filter(s => s.split(/\s+/).length < 8).length;
  if (afterShort > beforeShort && afterSentences.length > beforeSentences.length) {
    patterns.push({ pattern: 'sentence_variety', issue: 'Improved sentence variety' });
  }
  
  return patterns;
}

/**
 * Gets category-specific explanation context
 */
function getCategoryExplanation(category: string, patterns: Array<{ pattern: string; issue: string }>): string {
  const explanations: Record<string, string> = {
    structure: 'Improved narrative structure and story beats',
    engagement: 'Enhanced reader engagement and page-turning elements',
    tension: 'Strengthened tension and conflict',
    theme: 'Deepened thematic elements',
    character: 'Enhanced character development',
    literary_devices: 'Added literary devices and prose craft',
    excellence: 'Overall quality improvement',
    prose: 'Refined prose quality and style',
    originality: 'Increased originality and uniqueness',
    voice: 'Strengthened narrative voice',
    market_readiness: 'Improved commercial appeal',
  };
  
  return explanations[category] || '';
}

/**
 * Attaches explanations to all changes in a novel diff
 */
export function attachExplanationsToNovelDiff(
  diff: NovelDiff,
  actionResults?: Array<{ chapterId?: string; changeMetadata?: { explanation?: string } }>
): NovelDiff {
  const enrichedDiff = { ...diff };
  
  enrichedDiff.chapterDiffs = diff.chapterDiffs.map(chapterDiff => {
    const enrichedChanges = chapterDiff.changes.map(change => {
      // Find matching action result for this chapter
      const actionResult = actionResults?.find(ar => ar.chapterId === change.chapterId);
      const actionExplanation = actionResult?.changeMetadata?.explanation;
      
      // Generate explanation
      const explanation = generateChangeExplanation(
        change,
        diff.category,
        actionExplanation
      );
      
      return {
        ...change,
        explanation,
      };
    });
    
    return {
      ...chapterDiff,
      changes: enrichedChanges,
    };
  });
  
  return enrichedDiff;
}
