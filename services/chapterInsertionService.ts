import { NovelState, Chapter, Arc } from '../types';
import { ReferenceUpdate, ContinuityValidation } from '../types/improvement';

/**
 * Chapter Insertion Service
 * Handles inserting new chapters between existing ones with proper renumbering and reference updates
 */

/**
 * Inserts one or more chapters at specified position
 */
export function insertChapters(
  state: NovelState,
  position: number,              // Insert after this chapter number
  chapters: Chapter[],           // Chapters to insert
  options?: {
    updateReferences?: boolean;  // Update plotLedger, arcs, etc.
    validateContinuity?: boolean; // Validate story flow
  }
): {
  updatedState: NovelState;
  insertedChapters: Chapter[];
  updatedReferences: ReferenceUpdate[];
} {
  const updateReferences = options?.updateReferences !== false;
  const validateContinuity = options?.validateContinuity !== false;
  
  // Validate insertion position
  if (position < 0 || position > state.chapters.length) {
    throw new Error(`Invalid insertion position: ${position}. Must be between 0 and ${state.chapters.length}`);
  }
  
  if (chapters.length === 0) {
    return {
      updatedState: state,
      insertedChapters: [],
      updatedReferences: [],
    };
  }
  
  // Sort chapters by number
  const sortedChapters = [...state.chapters].sort((a, b) => a.number - b.number);
  
  // Assign new chapter numbers to inserted chapters
  const chaptersToInsert = chapters.map((chapter, index) => ({
    ...chapter,
    number: position + index + 1,
  }));
  
  // Renumber all subsequent chapters
  const chaptersAfter = sortedChapters.filter(ch => ch.number > position);
  const renumberedChaptersAfter = chaptersAfter.map(ch => ({
    ...ch,
    number: ch.number + chaptersToInsert.length,
  }));
  
  // Combine: chapters before, inserted chapters, renumbered chapters after
  const chaptersBefore = sortedChapters.filter(ch => ch.number <= position);
  const allChapters = [...chaptersBefore, ...chaptersToInsert, ...renumberedChaptersAfter].sort((a, b) => a.number - b.number);
  
  // Build number mapping (old -> new) for reference updates
  const numberMappings = new Map<number, number>();
  chaptersAfter.forEach(ch => {
    numberMappings.set(ch.number, ch.number + chaptersToInsert.length);
  });
  
  // Update references if requested
  let updatedReferences: ReferenceUpdate[] = [];
  let updatedState: NovelState = {
    ...state,
    chapters: allChapters,
  };
  
  if (updateReferences) {
    const referenceUpdates = updateChapterReferences(updatedState, numberMappings, position, chaptersToInsert.length);
    updatedState = referenceUpdates.updatedState;
    updatedReferences = referenceUpdates.updatedReferences;
  }
  
  // Validate continuity if requested
  if (validateContinuity && position > 0 && position < sortedChapters.length) {
    const previousChapter = sortedChapters.find(ch => ch.number === position);
    const nextChapter = sortedChapters.find(ch => ch.number === position + 1);
    
    if (previousChapter && nextChapter && chaptersToInsert.length > 0) {
      const continuityValidation = validateContinuityAfterInsertion(
        previousChapter,
        chaptersToInsert,
        nextChapter
      );
      
      if (!continuityValidation.valid && continuityValidation.issues.length > 0) {
        // Log continuity issues but don't block insertion
        console.warn('Continuity validation issues:', continuityValidation.issues);
      }
    }
  }
  
  return {
    updatedState,
    insertedChapters: chaptersToInsert,
    updatedReferences,
  };
}

/**
 * Updates all references to chapter numbers after insertion
 */
function updateChapterReferences(
  state: NovelState,
  numberMappings: Map<number, number>,
  insertionPosition: number,
  chaptersInserted: number
): {
  updatedState: NovelState;
  updatedReferences: ReferenceUpdate[];
} {
  const updatedReferences: ReferenceUpdate[] = [];
  let updatedState = { ...state };
  
  // 1. Update PlotLedger (Arcs)
  updatedState = {
    ...updatedState,
    plotLedger: updatedState.plotLedger.map(arc => {
      let updatedArc = { ...arc };
      let changed = false;
      
      // Update startedAtChapter if insertion happens before arc start
      if (arc.startedAtChapter && arc.startedAtChapter > insertionPosition) {
        const oldValue = arc.startedAtChapter;
        const newValue = arc.startedAtChapter + chaptersInserted;
        updatedArc = {
          ...updatedArc,
          startedAtChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'arc',
          entityId: arc.id,
          field: 'startedAtChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Arc "${arc.title}" start chapter updated due to insertion`,
        });
      }
      
      // Update endedAtChapter if insertion happens before arc end
      if (arc.endedAtChapter && arc.endedAtChapter > insertionPosition) {
        const oldValue = arc.endedAtChapter;
        const newValue = arc.endedAtChapter + chaptersInserted;
        updatedArc = {
          ...updatedArc,
          endedAtChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'arc',
          entityId: arc.id,
          field: 'endedAtChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Arc "${arc.title}" end chapter updated due to insertion`,
        });
      }
      
      return changed ? updatedArc : arc;
    }),
  };
  
  // 2. Update Character Codex (chapter appearances/references)
  updatedState = {
    ...updatedState,
    characters: updatedState.characters.map(character => {
      let updatedCharacter = { ...character };
      let changed = false;
      
      // Update introduction chapter if needed
      if (character.firstAppearedChapter && character.firstAppearedChapter > insertionPosition) {
        const oldValue = character.firstAppearedChapter;
        const newValue = character.firstAppearedChapter + chaptersInserted;
        updatedCharacter = {
          ...updatedCharacter,
          firstAppearedChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'character',
          entityId: character.id,
          field: 'firstAppearedChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Character "${character.name}" introduction chapter updated`,
        });
      }
      
      // Update last referenced chapter if needed
      if (character.lastReferencedChapter && character.lastReferencedChapter > insertionPosition) {
        const oldValue = character.lastReferencedChapter;
        const newValue = character.lastReferencedChapter + chaptersInserted;
        updatedCharacter = {
          ...updatedCharacter,
          lastReferencedChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'character',
          entityId: character.id,
          field: 'lastReferencedChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Character "${character.name}" last referenced chapter updated`,
        });
      }
      
      return changed ? updatedCharacter : character;
    }),
  };
  
  // 3. Update Antagonists
  updatedState = {
    ...updatedState,
    antagonists: updatedState.antagonists.map(antagonist => {
      let updatedAntagonist = { ...antagonist };
      let changed = false;
      
      // Update first appearance if needed
      if (antagonist.firstAppearance && antagonist.firstAppearance > insertionPosition) {
        const oldValue = antagonist.firstAppearance;
        const newValue = antagonist.firstAppearance + chaptersInserted;
        updatedAntagonist = {
          ...updatedAntagonist,
          firstAppearance: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'antagonist',
          entityId: antagonist.id,
          field: 'firstAppearance',
          oldValue: oldValue,
          newValue: newValue,
          description: `Antagonist "${antagonist.name}" first appearance updated`,
        });
      }
      
      // Update last appearance if needed
      if (antagonist.lastAppearance && antagonist.lastAppearance > insertionPosition) {
        const oldValue = antagonist.lastAppearance;
        const newValue = antagonist.lastAppearance + chaptersInserted;
        updatedAntagonist = {
          ...updatedAntagonist,
          lastAppearance: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'antagonist',
          entityId: antagonist.id,
          field: 'lastAppearance',
          oldValue: oldValue,
          newValue: newValue,
          description: `Antagonist "${antagonist.name}" last appearance updated`,
        });
      }
      
      // Update chapter appearances array
      if (antagonist.chapterAppearances && antagonist.chapterAppearances.length > 0) {
        const updatedAppearances = antagonist.chapterAppearances.map(app => {
          if (app.chapterNumber > insertionPosition) {
            return {
              ...app,
              chapterNumber: app.chapterNumber + chaptersInserted,
            };
          }
          return app;
        });
        
        if (JSON.stringify(updatedAppearances) !== JSON.stringify(antagonist.chapterAppearances)) {
          updatedAntagonist = {
            ...updatedAntagonist,
            chapterAppearances: updatedAppearances,
          };
          changed = true;
        }
      }
      
      return changed ? updatedAntagonist : antagonist;
    }),
  };
  
  // 4. Update Foreshadowing Elements
  updatedState = {
    ...updatedState,
    foreshadowing: updatedState.foreshadowing.map(element => {
      let updatedElement = { ...element };
      let changed = false;
      
      // Update introducedChapter if needed
      if (element.introducedChapter && element.introducedChapter > insertionPosition) {
        const oldValue = element.introducedChapter;
        const newValue = element.introducedChapter + chaptersInserted;
        updatedElement = {
          ...updatedElement,
          introducedChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'foreshadowing',
          entityId: element.id,
          field: 'introducedChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Foreshadowing element introduction chapter updated`,
        });
      }
      
      // Update paidOffChapter if needed
      if (element.paidOffChapter && element.paidOffChapter > insertionPosition) {
        const oldValue = element.paidOffChapter;
        const newValue = element.paidOffChapter + chaptersInserted;
        updatedElement = {
          ...updatedElement,
          paidOffChapter: newValue,
        };
        changed = true;
        updatedReferences.push({
          type: 'foreshadowing',
          entityId: element.id,
          field: 'paidOffChapter',
          oldValue: oldValue,
          newValue: newValue,
          description: `Foreshadowing element payoff chapter updated`,
        });
      }
      
      // Update chaptersReferenced array
      if (element.chaptersReferenced && element.chaptersReferenced.length > 0) {
        const updatedChapters = element.chaptersReferenced.map(chNum =>
          chNum > insertionPosition ? chNum + chaptersInserted : chNum
        );
        if (JSON.stringify(updatedChapters) !== JSON.stringify(element.chaptersReferenced)) {
          updatedElement = {
            ...updatedElement,
            chaptersReferenced: updatedChapters,
          };
          changed = true;
        }
      }
      
      return changed ? updatedElement : element;
    }),
  };
  
  // 5. Update World Bible (chapter references in descriptions)
  // Note: World entries may contain chapter references in their content/description strings
  // This is a simplified update - full text search and replacement would be more comprehensive
  updatedState = {
    ...updatedState,
    worldBible: updatedState.worldBible.map(entry => {
      // For now, we don't update text content references
      // This could be enhanced to search and replace chapter references in strings
      return entry;
    }),
  };
  
  // 6. Scenes: Scene chapterId remains same (UUID-based), but chapter numbers in metadata might need update
  // Since scenes use chapterId (UUID), they don't need direct updates
  // However, if scene metadata contains chapter numbers, those would need updating
  // This is left as a placeholder for future enhancement
  
  return {
    updatedState,
    updatedReferences,
  };
}

/**
 * Validates continuity after insertion
 */
function validateContinuityAfterInsertion(
  previousChapter: Chapter,
  insertedChapters: Chapter[],
  nextChapter: Chapter
): ContinuityValidation {
  const issues: string[] = [];
  
  if (insertedChapters.length === 0) {
    return { valid: true, issues: [] };
  }
  
  const firstInserted = insertedChapters[0];
  const lastInserted = insertedChapters[insertedChapters.length - 1];
  
  // Validate previous chapter -> first inserted chapter continuity
  const previousContinuity = validateChapterTransition(previousChapter, firstInserted);
  if (!previousContinuity.valid) {
    issues.push(`Continuity issue between Chapter ${previousChapter.number} and inserted Chapter ${firstInserted.number}: ${previousContinuity.issues.join(', ')}`);
  }
  
  // Validate last inserted chapter -> next chapter continuity
  const nextContinuity = validateChapterTransition(lastInserted, nextChapter);
  if (!nextContinuity.valid) {
    issues.push(`Continuity issue between inserted Chapter ${lastInserted.number} and Chapter ${nextChapter.number}: ${nextContinuity.issues.join(', ')}`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    previousChapterContinuity: previousContinuity,
    nextChapterContinuity: nextContinuity,
  };
}

/**
 * Validates transition between two chapters
 */
function validateChapterTransition(from: Chapter, to: Chapter): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Basic validation: check if chapters are sequential
  if (to.number !== from.number + 1) {
    issues.push(`Chapter numbers are not sequential (${from.number} -> ${to.number})`);
  }
  
  // Check if content endings/beginnings are coherent
  // This is a simplified check - a full implementation would analyze content semantics
  const fromEnding = from.content.trim().slice(-200).toLowerCase();
  const toBeginning = to.content.trim().slice(0, 200).toLowerCase();
  
  // Basic checks (can be enhanced)
  if (fromEnding.length < 50 && toBeginning.length < 50) {
    issues.push('Both chapters have very short content - may indicate missing context');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Renumbers chapters starting from a specific position
 */
export function renumberChapters(
  chapters: Chapter[],
  startFromNumber: number,
  increment: number
): Chapter[] {
  return chapters.map(chapter => {
    if (chapter.number >= startFromNumber) {
      return {
        ...chapter,
        number: chapter.number + increment,
      };
    }
    return chapter;
  });
}
