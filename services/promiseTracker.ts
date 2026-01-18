import { NovelState, Chapter } from '../types';

/**
 * Promise Tracker
 * 
 * Extracts and tracks commitments/promises from chapters:
 * - Meeting arrangements
 * - Character promises ("will investigate", "promised to")
 * - Character intentions ("wanted to see", "trying to get")
 */

export interface PromiseCommitment {
  id: string;
  type: 'meeting' | 'promise' | 'intention' | 'investigation' | 'task';
  description: string;
  introducedInChapter: number;
  introducedInChapterId: string;
  status: 'pending' | 'fulfilled' | 'forgotten';
  chaptersSinceIntroduction: number;
  priority: 'high' | 'medium' | 'low';
  context: string; // Full context of where the promise was made
  involvedCharacters?: string[]; // Character names involved
}

export interface OverduePromise extends PromiseCommitment {
  isOverdue: true;
  overdueByChapters: number;
}

/**
 * Extracts promises and commitments from chapter content
 */
export function extractPromisesFromChapter(
  chapter: Chapter
): PromiseCommitment[] {
  const promises: PromiseCommitment[] = [];
  const content = chapter.content;
  const contentLower = content.toLowerCase();

  // Meeting arrangements
  const meetingPatterns = [
    {
      pattern: /\b(we'll|we will|they'll|they will|he'll|he will|she'll|she will|i'll|i will)\s+(meet|gather|come together|reconvene|assemble|convene)/gi,
      type: 'meeting' as const,
      priority: 'high' as const,
    },
    {
      pattern: /\b(set up|arranged|scheduled|planned|agreed to)\s+(a |an |the )?(meeting|gathering|appointment|rendezvous|conference)/gi,
      type: 'meeting' as const,
      priority: 'high' as const,
    },
    {
      pattern: /\b(meet|meeting|gathering|appointment)\s+(at|in|with|tomorrow|later|soon|next|tomorrow|tonight)/gi,
      type: 'meeting' as const,
      priority: 'high' as const,
    },
  ];

  meetingPatterns.forEach(({ pattern, type, priority }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match, index) => {
        const matchIndex = contentLower.indexOf(match.toLowerCase());
        if (matchIndex >= 0) {
          const contextStart = Math.max(0, matchIndex - 50);
          const contextEnd = Math.min(content.length, matchIndex + match.length + 50);
          const context = content.substring(contextStart, contextEnd).trim();

          // Extract character names from context
          const involvedCharacters: string[] = [];
          // Simple extraction: look for capitalized words that might be names
          const words = context.split(/\s+/);
          words.forEach((word, i) => {
            if (word.length > 2 && 
                word[0] === word[0].toUpperCase() && 
                word[0].match(/[A-Z]/) &&
                i < 20) { // Only check first 20 words around match
              // Filter out common words
              const commonWords = ['The', 'This', 'That', 'There', 'Then', 'When', 'What', 'Where', 'Who', 'How', 'Why', 'Chapter', 'Meeting', 'Gathering'];
              if (!commonWords.includes(word)) {
                involvedCharacters.push(word.replace(/[.,!?;:]/g, ''));
              }
            }
          });

          promises.push({
            id: `meeting-${chapter.id}-${index}`,
            type,
            description: `Meeting arrangement: ${match}`,
            introducedInChapter: chapter.number,
            introducedInChapterId: chapter.id,
            status: 'pending',
            chaptersSinceIntroduction: 0,
            priority,
            context,
            involvedCharacters: involvedCharacters.slice(0, 3), // Limit to 3 characters
          });
        }
      });
    }
  });

  // Character promises and commitments
  const promisePatterns = [
    {
      pattern: /\b(promised|agreed|vowed|committed|swore)\s+(to\s+)?(investigate|find out|discover|learn|explore|check|examine|look into|figure out|determine|help|assist|support|protect|defend|do)/gi,
      type: 'promise' as const,
      priority: 'high' as const,
    },
    {
      pattern: /\b(will|shall|going to|planning to|intend to)\s+(investigate|find out|discover|learn|explore|check|examine|look into|figure out|determine|help|assist|support|protect|defend)/gi,
      type: 'promise' as const,
      priority: 'medium' as const,
    },
  ];

  promisePatterns.forEach(({ pattern, type, priority }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match, index) => {
        const matchIndex = contentLower.indexOf(match.toLowerCase());
        if (matchIndex >= 0) {
          const contextStart = Math.max(0, matchIndex - 60);
          const contextEnd = Math.min(content.length, matchIndex + match.length + 60);
          const context = content.substring(contextStart, contextEnd).trim();

          promises.push({
            id: `promise-${chapter.id}-${index}`,
            type,
            description: `Character promise: ${match}`,
            introducedInChapter: chapter.number,
            introducedInChapterId: chapter.id,
            status: 'pending',
            chaptersSinceIntroduction: 0,
            priority,
            context,
          });
        }
      });
    }
  });

  // Character intentions ("wanted to see", "trying to get")
  const intentionPatterns = [
    {
      pattern: /\b(wanted to|needed to|must|should|ought to)\s+(see|meet|find|discover|investigate|get|learn|know)/gi,
      type: 'intention' as const,
      priority: 'medium' as const,
    },
    {
      pattern: /\b(trying to|attempting to|seeking to)\s+(get|find|discover|learn|investigate|see|meet)/gi,
      type: 'intention' as const,
      priority: 'medium' as const,
    },
  ];

  intentionPatterns.forEach(({ pattern, type, priority }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match, index) => {
        const matchIndex = contentLower.indexOf(match.toLowerCase());
        if (matchIndex >= 0) {
          const contextStart = Math.max(0, matchIndex - 60);
          const contextEnd = Math.min(content.length, matchIndex + match.length + 60);
          const context = content.substring(contextStart, contextEnd).trim();

          promises.push({
            id: `intention-${chapter.id}-${index}`,
            type,
            description: `Character intention: ${match}`,
            introducedInChapter: chapter.number,
            introducedInChapterId: chapter.id,
            status: 'pending',
            chaptersSinceIntroduction: 0,
            priority,
            context,
          });
        }
      });
    }
  });

  return promises;
}

/**
 * Tracks all promises across chapters and updates their status
 */
export function trackPromises(
  chapters: Chapter[],
  currentChapterNumber: number
): PromiseCommitment[] {
  const allPromises: PromiseCommitment[] = [];

  // Extract promises from all chapters
  chapters.forEach(chapter => {
    const chapterPromises = extractPromisesFromChapter(chapter);
    allPromises.push(...chapterPromises);
  });

  // Update status: check if promises were fulfilled in later chapters
  allPromises.forEach(promise => {
    const chaptersSinceIntroduction = currentChapterNumber - promise.introducedInChapter;
    promise.chaptersSinceIntroduction = chaptersSinceIntroduction;

    // Check if promise was fulfilled in subsequent chapters
    const subsequentChapters = chapters.filter(
      ch => ch.number > promise.introducedInChapter && ch.number <= currentChapterNumber
    );

    let isFulfilled = false;
    const promiseKeywords = promise.description.toLowerCase();
    const keyTerms = promiseKeywords.split(/\s+/).filter(
      term => term.length > 3 && !['the', 'and', 'but', 'was', 'were', 'that', 'this'].includes(term)
    );

    subsequentChapters.forEach(ch => {
      const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
      
      // Check if promise fulfillment is mentioned
      // For meetings: look for actual meeting happening
      if (promise.type === 'meeting') {
        const meetingHappened = chContent.includes('met') || 
                                chContent.includes('gathered') || 
                                chContent.includes('came together') ||
                                chContent.includes('assembled');
        if (meetingHappened && promise.involvedCharacters) {
          // Check if involved characters appear together
          const allCharactersPresent = promise.involvedCharacters.every(char => 
            chContent.includes(char.toLowerCase())
          );
          if (allCharactersPresent) {
            isFulfilled = true;
          }
        }
      } else {
        // For other promises: check if key terms appear in context of completion
        const keyTermsFound = keyTerms.some(term => chContent.includes(term));
        const completionKeywords = ['completed', 'finished', 'done', 'accomplished', 'fulfilled', 'solved', 'found', 'discovered'];
        const hasCompletion = completionKeywords.some(kw => chContent.includes(kw));
        
        if (keyTermsFound && hasCompletion) {
          isFulfilled = true;
        }
      }
    });

    if (isFulfilled) {
      promise.status = 'fulfilled';
    } else if (chaptersSinceIntroduction > 5) {
      promise.status = 'forgotten';
    } else {
      promise.status = 'pending';
    }
  });

  return allPromises;
}

/**
 * Gets overdue promises that should be addressed
 */
export function getOverduePromises(
  state: NovelState,
  currentChapterNumber: number,
  options: {
    overdueThreshold?: number; // Chapters since introduction before considered overdue (default: 3)
  } = {}
): OverduePromise[] {
  const { overdueThreshold = 3 } = options;

  const allPromises = trackPromises(state.chapters, currentChapterNumber);
  const pendingPromises = allPromises.filter(p => p.status === 'pending');

  const overdue: OverduePromise[] = pendingPromises
    .filter(promise => promise.chaptersSinceIntroduction >= overdueThreshold)
    .map(promise => ({
      ...promise,
      isOverdue: true as const,
      overdueByChapters: promise.chaptersSinceIntroduction - overdueThreshold,
    }))
    .sort((a, b) => {
      // Sort by priority first, then by how overdue
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.overdueByChapters - a.overdueByChapters; // More overdue first
    });

  return overdue;
}

/**
 * Gets high-priority pending promises that should be addressed soon
 */
export function getHighPriorityPendingPromises(
  state: NovelState,
  currentChapterNumber: number
): PromiseCommitment[] {
  const allPromises = trackPromises(state.chapters, currentChapterNumber);
  
  return allPromises
    .filter(promise => promise.status === 'pending' && promise.priority === 'high')
    .sort((a, b) => b.chaptersSinceIntroduction - a.chaptersSinceIntroduction); // Older first
}
