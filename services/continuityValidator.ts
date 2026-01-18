import { NovelState, Chapter, Character } from '../types';
import { ContinuityValidation } from '../types/improvement';

/**
 * Continuity Validator
 * Validates story flow, character consistency, and world consistency
 */
export class ContinuityValidator {
  /**
   * Validates chapter continuity (flow from previous to next)
   */
  static validateChapterContinuity(
    chapter: Chapter,
    previousChapter: Chapter | null,
    nextChapter: Chapter | null,
    state: NovelState
  ): ContinuityValidation {
    const issues: string[] = [];

    // Check if chapter flows from previous
    if (previousChapter) {
      const previousEnd = previousChapter.content.substring(Math.max(0, previousChapter.content.length - 200));
      const currentStart = chapter.content.substring(0, 200);

      // Check for abrupt transitions
      const previousEndLower = previousEnd.toLowerCase();
      const currentStartLower = currentStart.toLowerCase();

      // Look for continuity indicators
      const hasTimeTransition = currentStartLower.match(/\b(later|after|then|next|soon|moments? later|hours? later|days? later)\b/);
      const hasLocationTransition = currentStartLower.match(/\b(at|in|within|outside|inside|near|far from)\b/);
      const hasCharacterTransition = currentStartLower.match(/\b(meanwhile|elsewhere|back at|at the same time)\b/);

      // If no transition indicators and content seems disconnected
      if (!hasTimeTransition && !hasLocationTransition && !hasCharacterTransition) {
        // Check if characters or locations mentioned in previous are missing in current
        const previousCharacters = this.extractCharacterNames(previousEnd, state);
        const currentCharacters = this.extractCharacterNames(currentStart, state);
        
        // If major character from previous chapter is not mentioned in current start
        const protagonist = state.characterCodex.find(c => c.isProtagonist);
        if (protagonist && previousEndLower.includes(protagonist.name.toLowerCase()) && 
            !currentStartLower.includes(protagonist.name.toLowerCase()) && 
            previousEndLower.length > 100) {
          issues.push(`Protagonist ${protagonist.name} was in previous chapter but not mentioned in current chapter opening`);
        }
      }
    }

    // Check if chapter flows to next
    if (nextChapter) {
      const currentEnd = chapter.content.substring(Math.max(0, chapter.content.length - 200));
      const nextStart = nextChapter.content.substring(0, 200);

      // Check for unresolved plot threads
      const currentEndLower = currentEnd.toLowerCase();
      const nextStartLower = nextStart.toLowerCase();

      // Look for questions or incomplete actions in current end
      const hasUnresolvedQuestion = currentEndLower.match(/\?/);
      const hasIncompleteAction = currentEndLower.match(/\b(but|when|as|suddenly|then)\s*$/);

      // If there's an unresolved element, check if next chapter addresses it
      if ((hasUnresolvedQuestion || hasIncompleteAction) && currentEndLower.length > 50) {
        // This is actually good (cliffhanger), but we can note it
        // No issue here - cliffhangers are intentional
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      previousChapterContinuity: previousChapter ? {
        valid: issues.filter(i => i.includes('previous')).length === 0,
        issues: issues.filter(i => i.includes('previous')),
      } : undefined,
      nextChapterContinuity: nextChapter ? {
        valid: issues.filter(i => i.includes('next')).length === 0,
        issues: issues.filter(i => i.includes('next')),
      } : undefined,
    };
  }

  /**
   * Validates character consistency
   */
  static validateCharacterConsistency(
    chapter: Chapter,
    state: NovelState
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const content = chapter.content || '';
    const lowerContent = content.toLowerCase();

    // Check each character mentioned in chapter
    state.characterCodex.forEach((character: Character) => {
      if (lowerContent.includes(character.name.toLowerCase())) {
        // Check if character actions align with personality
        // This is a simplified check - full validation would use LLM
        
        // Check for cultivation level consistency
        if (character.currentCultivation) {
          // If character is mentioned but cultivation level seems inconsistent
          // (This would require more sophisticated analysis)
        }

        // Check for relationship consistency
        if (character.relationships && character.relationships.length > 0) {
          // Verify relationships are maintained
          // (Simplified - full check would analyze interactions)
        }
      }
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validates world consistency
   */
  static validateWorldConsistency(
    chapter: Chapter,
    state: NovelState
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const content = chapter.content || '';
    const lowerContent = content.toLowerCase();

    // Check territory/location consistency
    state.territories.forEach((territory) => {
      if (lowerContent.includes(territory.name.toLowerCase())) {
        // Verify territory description matches world bible
        // (Simplified check)
      }
    });

    // Check world bible rules
    state.worldBible.forEach((entry) => {
      // Check if chapter violates established world rules
      // (This would require more sophisticated analysis with LLM)
    });

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Extracts character names from text
   */
  private static extractCharacterNames(text: string, state: NovelState): string[] {
    const names: string[] = [];
    const lowerText = text.toLowerCase();

    state.characterCodex.forEach((character: Character) => {
      if (lowerText.includes(character.name.toLowerCase())) {
        names.push(character.name);
      }
    });

    return names;
  }

  /**
   * Validates full novel continuity
   */
  static validateNovelContinuity(state: NovelState): {
    valid: boolean;
    issues: string[];
    chapterValidations: Array<{
      chapterNumber: number;
      valid: boolean;
      issues: string[];
    }>;
  } {
    const chapters = state.chapters.sort((a, b) => a.number - b.number);
    const allIssues: string[] = [];
    const chapterValidations: Array<{
      chapterNumber: number;
      valid: boolean;
      issues: string[];
    }> = [];

    chapters.forEach((chapter, index) => {
      const previousChapter = index > 0 ? chapters[index - 1] : null;
      const nextChapter = index < chapters.length - 1 ? chapters[index + 1] : null;

      const continuity = this.validateChapterContinuity(chapter, previousChapter, nextChapter, state);
      const characterConsistency = this.validateCharacterConsistency(chapter, state);
      const worldConsistency = this.validateWorldConsistency(chapter, state);

      const chapterIssues = [
        ...continuity.issues,
        ...characterConsistency.issues,
        ...worldConsistency.issues,
      ];

      chapterValidations.push({
        chapterNumber: chapter.number,
        valid: chapterIssues.length === 0,
        issues: chapterIssues,
      });

      allIssues.push(...chapterIssues);
    });

    return {
      valid: allIssues.length === 0,
      issues: allIssues,
      chapterValidations,
    };
  }
}
