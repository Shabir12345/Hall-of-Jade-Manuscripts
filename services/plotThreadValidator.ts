import { NovelState, Chapter } from '../types';
import { extractActivePlotThreads } from './promptEngine/storyStateTracker';
import { PlotThread } from './promptEngine/storyStateTracker';
import { detectMissingCharacters, MissingCharacterWarning } from './characterPresenceTracker';
import { getOverduePromises, OverduePromise } from './promiseTracker';

/**
 * Plot Thread Validator
 * 
 * Validates that plot threads and character continuity are maintained after chapter generation.
 * Checks:
 * - Were high-priority plot threads addressed?
 * - Did characters who should appear actually appear?
 * - Were promised meetings/events fulfilled or referenced?
 */

export interface PlotThreadValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  suggestions: string[];
  highPriorityThreadsAddressed: number;
  highPriorityThreadsIgnored: number;
}

export interface ValidationWarning {
  type: 'missing_character' | 'overdue_promise' | 'thread_not_addressed' | 'promise_not_fulfilled';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  context?: string;
}

export interface ValidationError {
  type: 'critical_thread_ignored' | 'mandatory_character_missing';
  message: string;
  suggestion: string;
  context?: string;
}

/**
 * Validates plot thread resolution after chapter generation
 */
export function validatePlotThreadResolution(
  state: NovelState,
  newChapter: Chapter
): PlotThreadValidationResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];
  const suggestions: string[] = [];

  const currentChapterNumber = newChapter.number;
  const previousChapters = state.chapters.filter(ch => ch.number < currentChapterNumber);
  const allChapters = [...previousChapters, newChapter];

  // Get high-priority plot threads before this chapter
  const previousPlotThreads = extractActivePlotThreads(
    previousChapters,
    state.plotLedger,
    state.characterCodex
  );
  const highPriorityThreads = previousPlotThreads.filter(t => t.priority === 'high');

  // Check if high-priority threads were addressed in the new chapter
  const newChapterContent = (newChapter.content + ' ' + (newChapter.summary || '')).toLowerCase();
  let highPriorityThreadsAddressed = 0;
  let highPriorityThreadsIgnored = 0;

  highPriorityThreads.forEach(thread => {
    const threadKeywords = extractKeywords(thread.description);
    const threadMentioned = threadKeywords.some(keyword => 
      newChapterContent.includes(keyword.toLowerCase())
    );

    if (threadMentioned) {
      highPriorityThreadsAddressed++;
    } else {
      highPriorityThreadsIgnored++;
      
      // Determine if this is critical based on thread type
      const isCritical = thread.threadType === 'meeting' || 
                        thread.threadType === 'commitment' || 
                        thread.threadType === 'checklist';

      if (isCritical) {
        errors.push({
          type: 'critical_thread_ignored',
          message: `Critical high-priority plot thread was not addressed: "${thread.description.substring(0, 100)}"`,
          suggestion: `This thread (${thread.threadType}) was introduced in Chapter ${thread.introducedInChapter} and should be addressed. Consider including it in the next chapter.`,
          context: thread.description,
        });
      } else {
        warnings.push({
          type: 'thread_not_addressed',
          severity: thread.priority === 'high' ? 'high' : 'medium',
          message: `High-priority plot thread was not addressed: "${thread.description.substring(0, 100)}"`,
          suggestion: `This thread was introduced in Chapter ${thread.introducedInChapter}. Consider addressing it soon.`,
          context: thread.description,
        });
      }
    }
  });

  // Check for missing characters who should appear
  const missingCharacterWarnings = detectMissingCharacters(
    allChapters,
    state.characterCodex,
    {
      checkLastChapters: 2,
      maxChaptersSinceAppearance: 5,
    }
  );

  missingCharacterWarnings.forEach(warning => {
    const characterNameLower = warning.characterName.toLowerCase();
    const characterAppeared = newChapterContent.includes(characterNameLower);

    if (!characterAppeared && warning.warningLevel === 'critical') {
      errors.push({
        type: 'mandatory_character_missing',
        message: `Critical character "${warning.characterName}" should appear but hasn't. Last appeared in Chapter ${warning.lastAppearanceChapter}.`,
        suggestion: warning.suggestion,
        context: warning.message,
      });
    } else if (!characterAppeared && warning.warningLevel === 'warning') {
      warnings.push({
        type: 'missing_character',
        severity: 'medium',
        message: warning.message,
        suggestion: warning.suggestion,
        context: warning.message,
      });
    }
  });

  // Check for overdue promises that weren't fulfilled
  const overduePromises = getOverduePromises(state, currentChapterNumber, { overdueThreshold: 3 });
  
  overduePromises.forEach(promise => {
    const promiseKeywords = extractKeywords(promise.description);
    const promiseMentioned = promiseKeywords.some(keyword => 
      newChapterContent.includes(keyword.toLowerCase())
    );

    if (promise.type === 'meeting') {
      // For meetings, check if meeting actually happened
      const meetingKeywords = ['met', 'gathered', 'came together', 'assembled', 'reconvened'];
      const meetingHappened = meetingKeywords.some(kw => newChapterContent.includes(kw));
      
      if (!meetingHappened && !promiseMentioned) {
        warnings.push({
          type: 'promise_not_fulfilled',
          severity: promise.priority === 'high' ? 'high' : 'medium',
          message: `Promised meeting from Chapter ${promise.introducedInChapter} was not fulfilled: "${promise.description.substring(0, 100)}"`,
          suggestion: `This meeting was promised ${promise.chaptersSinceIntroduction} chapter(s) ago. Consider fulfilling it soon or explaining why it didn't happen.`,
          context: promise.context,
        });
      }
    } else if (!promiseMentioned) {
      warnings.push({
        type: 'overdue_promise',
        severity: promise.priority === 'high' ? 'high' : 'medium',
        message: `Overdue promise from Chapter ${promise.introducedInChapter} was not addressed: "${promise.description.substring(0, 100)}"`,
        suggestion: `This promise was made ${promise.chaptersSinceIntroduction} chapter(s) ago (${promise.overdueByChapters} chapter(s) overdue). Consider addressing it.`,
        context: promise.context,
      });
    }
  });

  // Generate suggestions based on validation results
  if (highPriorityThreadsIgnored > 0) {
    suggestions.push(`Address ${highPriorityThreadsIgnored} high-priority plot thread(s) that were not resolved in this chapter.`);
  }

  if (missingCharacterWarnings.length > 0) {
    const criticalMissing = missingCharacterWarnings.filter(w => w.warningLevel === 'critical');
    if (criticalMissing.length > 0) {
      suggestions.push(`Include ${criticalMissing.length} missing character(s) who should appear: ${criticalMissing.map(w => w.characterName).join(', ')}`);
    }
  }

  if (overduePromises.length > 0) {
    const criticalPromises = overduePromises.filter(p => p.priority === 'high' && p.overdueByChapters > 2);
    if (criticalPromises.length > 0) {
      suggestions.push(`Fulfill ${criticalPromises.length} overdue high-priority promise(s) that are more than 2 chapters overdue.`);
    }
  }

  const isValid = errors.length === 0 && warnings.filter(w => w.severity === 'high').length === 0;

  return {
    isValid,
    warnings,
    errors,
    suggestions,
    highPriorityThreadsAddressed,
    highPriorityThreadsIgnored,
  };
}

/**
 * Extracts keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && 
                   !['this', 'that', 'with', 'from', 'into', 'them', 'they', 'their', 'there', 'then', 'were', 'will', 'would', 'could', 'should', 'might', 'been', 'have', 'been', 'been', 'meet', 'meeting', 'gather', 'promised', 'agreed'].includes(word));
  
  // Return unique words
  return [...new Set(words)];
}

/**
 * Validates character presence after chapter generation
 */
export function validateCharacterPresence(
  state: NovelState,
  newChapter: Chapter
): MissingCharacterWarning[] {
  const allChapters = [...state.chapters, newChapter];
  return detectMissingCharacters(allChapters, state.characterCodex, {
    checkLastChapters: 2,
    maxChaptersSinceAppearance: 5,
  });
}

/**
 * Gets a summary of validation issues for display
 */
export function getValidationSummary(
  result: PlotThreadValidationResult
): string {
  const sections: string[] = [];

  if (result.errors.length > 0) {
    sections.push(`❌ ERRORS (${result.errors.length}):`);
    result.errors.forEach((error, index) => {
      sections.push(`  ${index + 1}. ${error.message}`);
      sections.push(`     → ${error.suggestion}`);
    });
  }

  if (result.warnings.length > 0) {
    sections.push(`⚠️ WARNINGS (${result.warnings.length}):`);
    result.warnings.slice(0, 5).forEach((warning, index) => {
      sections.push(`  ${index + 1}. [${warning.severity.toUpperCase()}] ${warning.message}`);
      sections.push(`     → ${warning.suggestion}`);
    });
  }

  if (result.suggestions.length > 0) {
    sections.push(`💡 SUGGESTIONS:`);
    result.suggestions.forEach((suggestion, index) => {
      sections.push(`  ${index + 1}. ${suggestion}`);
    });
  }

  sections.push(`\n📊 SUMMARY:`);
  sections.push(`  • High-priority threads addressed: ${result.highPriorityThreadsAddressed}`);
  sections.push(`  • High-priority threads ignored: ${result.highPriorityThreadsIgnored}`);
  sections.push(`  • Validation status: ${result.isValid ? '✅ PASSED' : '❌ FAILED'}`);

  return sections.join('\n');
}
