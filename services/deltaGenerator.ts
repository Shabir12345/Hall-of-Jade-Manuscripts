import { Chapter } from '../types';

/**
 * Delta Change - Represents a specific change to a chapter
 */
export interface DeltaChange {
  type: 'add' | 'modify' | 'delete';
  section: 'beginning' | 'middle' | 'end' | 'specific';
  startIndex?: number; // Character index where change starts
  endIndex?: number; // Character index where change ends
  oldText?: string; // Text to replace
  newText: string; // New text
  context?: string; // Surrounding context for the change
}

/**
 * Chapter Delta - Collection of changes for a single chapter
 */
export interface ChapterDelta {
  chapterId: string;
  chapterNumber: number;
  changes: DeltaChange[];
  fullContent?: string; // Full content if delta is too complex
}

/**
 * Delta Generator
 * Generates delta changes instead of full rewrites for token efficiency
 */
export class DeltaGenerator {
  /**
   * Generates a delta by comparing old and new content
   * Attempts to identify specific sections that changed
   */
  static generateDelta(
    oldContent: string,
    newContent: string,
    chapterId: string,
    chapterNumber: number
  ): ChapterDelta {
    // If content is identical, return empty delta
    if (oldContent === newContent) {
      return {
        chapterId,
        chapterNumber,
        changes: [],
      };
    }

    // If content is completely different or very short, return full content
    if (oldContent.length < 500 || newContent.length < 500) {
      return {
        chapterId,
        chapterNumber,
        changes: [],
        fullContent: newContent, // Use full content for short chapters
      };
    }

    // Calculate similarity to determine if delta is feasible
    const similarity = this.calculateSimilarity(oldContent, newContent);
    
    // If similarity is too low (< 30%), use full content
    if (similarity < 0.3) {
      return {
        chapterId,
        chapterNumber,
        changes: [],
        fullContent: newContent,
      };
    }

    // Try to identify specific changes
    const changes = this.identifyChanges(oldContent, newContent);

    // If too many changes (> 10), use full content
    if (changes.length > 10) {
      return {
        chapterId,
        chapterNumber,
        changes: [],
        fullContent: newContent,
      };
    }

    return {
      chapterId,
      chapterNumber,
      changes,
    };
  }

  /**
   * Identifies specific changes between old and new content
   */
  private static identifyChanges(oldContent: string, newContent: string): DeltaChange[] {
    const changes: DeltaChange[] = [];
    
    // Split into paragraphs for comparison
    const oldParagraphs = oldContent.split(/\n\n+/);
    const newParagraphs = newContent.split(/\n\n+/);

    // Simple diff algorithm: compare paragraphs
    let oldIndex = 0;
    let newIndex = 0;
    let currentOldPos = 0;
    let currentNewPos = 0;

    while (oldIndex < oldParagraphs.length || newIndex < newParagraphs.length) {
      if (oldIndex >= oldParagraphs.length) {
        // New paragraph added
        changes.push({
          type: 'add',
          section: this.determineSection(currentNewPos, newContent.length),
          startIndex: currentNewPos,
          endIndex: currentNewPos,
          newText: newParagraphs[newIndex],
          context: newIndex > 0 ? newParagraphs[newIndex - 1].substring(0, 100) : undefined,
        });
        currentNewPos += newParagraphs[newIndex].length + 2; // +2 for \n\n
        newIndex++;
      } else if (newIndex >= newParagraphs.length) {
        // Paragraph deleted
        changes.push({
          type: 'delete',
          section: this.determineSection(currentOldPos, oldContent.length),
          startIndex: currentOldPos,
          endIndex: currentOldPos + oldParagraphs[oldIndex].length,
          oldText: oldParagraphs[oldIndex],
        });
        currentOldPos += oldParagraphs[oldIndex].length + 2;
        oldIndex++;
      } else if (oldParagraphs[oldIndex] === newParagraphs[newIndex]) {
        // Paragraphs match, move forward
        currentOldPos += oldParagraphs[oldIndex].length + 2;
        currentNewPos += newParagraphs[newIndex].length + 2;
        oldIndex++;
        newIndex++;
      } else {
        // Paragraph modified
        const oldPara = oldParagraphs[oldIndex];
        const newPara = newParagraphs[newIndex];
        
        // Check if it's a minor modification (similarity > 70%)
        const paraSimilarity = this.calculateSimilarity(oldPara, newPara);
        
        if (paraSimilarity > 0.7) {
          // Modified paragraph
          changes.push({
            type: 'modify',
            section: this.determineSection(currentOldPos, oldContent.length),
            startIndex: currentOldPos,
            endIndex: currentOldPos + oldPara.length,
            oldText: oldPara,
            newText: newPara,
            context: oldIndex > 0 ? oldParagraphs[oldIndex - 1].substring(0, 100) : undefined,
          });
        } else {
          // Treat as delete + add
          changes.push({
            type: 'delete',
            section: this.determineSection(currentOldPos, oldContent.length),
            startIndex: currentOldPos,
            endIndex: currentOldPos + oldPara.length,
            oldText: oldPara,
          });
          changes.push({
            type: 'add',
            section: this.determineSection(currentNewPos, newContent.length),
            startIndex: currentNewPos,
            endIndex: currentNewPos,
            newText: newPara,
            context: newIndex > 0 ? newParagraphs[newIndex - 1].substring(0, 100) : undefined,
          });
        }
        
        currentOldPos += oldPara.length + 2;
        currentNewPos += newPara.length + 2;
        oldIndex++;
        newIndex++;
      }
    }

    return changes;
  }

  /**
   * Determines which section of the chapter a position is in
   */
  private static determineSection(position: number, totalLength: number): 'beginning' | 'middle' | 'end' | 'specific' {
    const ratio = position / totalLength;
    if (ratio < 0.2) return 'beginning';
    if (ratio > 0.8) return 'end';
    return 'middle';
  }

  /**
   * Calculates similarity between two strings (0-1)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Use Levenshtein distance for similarity
    const maxLength = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculates Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Applies delta changes to original content
   */
  static applyDelta(originalContent: string, delta: ChapterDelta): string {
    if (delta.fullContent) {
      return delta.fullContent;
    }

    if (delta.changes.length === 0) {
      return originalContent;
    }

    // Sort changes by position (reverse order to maintain indices)
    const sortedChanges = [...delta.changes].sort((a, b) => (b.startIndex || 0) - (a.startIndex || 0));

    let result = originalContent;

    for (const change of sortedChanges) {
      if (change.type === 'delete' && change.startIndex !== undefined && change.endIndex !== undefined) {
        // Delete text
        result = result.substring(0, change.startIndex) + result.substring(change.endIndex);
      } else if (change.type === 'add' && change.startIndex !== undefined) {
        // Insert text
        result = result.substring(0, change.startIndex) + change.newText + result.substring(change.startIndex);
      } else if (change.type === 'modify' && change.startIndex !== undefined && change.endIndex !== undefined) {
        // Replace text
        result = result.substring(0, change.startIndex) + change.newText + result.substring(change.endIndex);
      }
    }

    return result;
  }

  /**
   * Merges multiple deltas for the same chapter
   */
  static mergeDeltas(deltas: ChapterDelta[]): ChapterDelta {
    if (deltas.length === 0) {
      throw new Error('Cannot merge empty deltas array');
    }

    if (deltas.length === 1) {
      return deltas[0];
    }

    const firstDelta = deltas[0];
    
    // If any delta has fullContent, use the last one
    const fullContentDelta = deltas.find(d => d.fullContent);
    if (fullContentDelta) {
      return fullContentDelta;
    }

    // Merge all changes
    const allChanges: DeltaChange[] = [];
    deltas.forEach(delta => {
      allChanges.push(...delta.changes);
    });

    return {
      chapterId: firstDelta.chapterId,
      chapterNumber: firstDelta.chapterNumber,
      changes: allChanges,
    };
  }
}
