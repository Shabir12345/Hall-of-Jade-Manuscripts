/**
 * Gap Detection Service
 * 
 * Proactively detects gaps and missing connections before generation:
 * - Missing character relationships
 * - Orphaned entities (no connections)
 * - Missing antagonist assignments to arcs
 * - Characters without arc associations
 * - Items/techniques without character ownership
 * - Incomplete world entries
 */

import { NovelState, Character, Arc, Item, Technique, Antagonist, Chapter, Scene } from '../types';
import { textContainsCharacterName } from '../utils/characterNameMatching';

export interface Gap {
  type: GapType;
  severity: 'critical' | 'warning' | 'info';
  entityId?: string;
  entityName: string;
  entityType: string;
  message: string;
  suggestion: string;
  autoFixable: boolean;
  confidence: number; // 0-1 confidence that this is indeed a gap
}

export type GapType = 
  | 'missing-relationship'
  | 'orphaned-character'
  | 'orphaned-item'
  | 'orphaned-technique'
  | 'missing-arc-association'
  | 'incomplete-world-entry'
  | 'character-without-arc'
  | 'antagonist-without-arc'
  | 'missing-protagonist'
  | 'orphaned-scene';

export interface GapAnalysis {
  gaps: Gap[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    autoFixable: number;
  };
  recommendations: string[];
}

/**
 * Analyze novel state for gaps and missing connections
 */
export function analyzeGaps(state: NovelState, currentChapterNumber: number): GapAnalysis {
  const gaps: Gap[] = [];

  // 1. Check for missing protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (!protagonist) {
    gaps.push({
      type: 'missing-protagonist',
      severity: 'critical',
      entityName: 'Protagonist',
      entityType: 'character',
      message: 'No protagonist is marked. Every novel needs a protagonist.',
      suggestion: 'Mark one character as the protagonist in the character manager.',
      autoFixable: false,
      confidence: 1.0
    });
  }

  // 2. Check for orphaned characters (no relationships, not protagonist)
  state.characterCodex.forEach(character => {
    if (character.isProtagonist) return; // Protagonist doesn't need relationships to be valid

    const hasRelationships = character.relationships && character.relationships.length > 0;
    const appearsInChapters = state.chapters.some(ch => 
      ch.content?.toLowerCase().includes(character.name.toLowerCase()) ||
      ch.summary?.toLowerCase().includes(character.name.toLowerCase())
    );

    if (!hasRelationships && appearsInChapters) {
      gaps.push({
        type: 'orphaned-character',
        severity: 'warning',
        entityId: character.id,
        entityName: character.name,
        entityType: 'character',
        message: `Character "${character.name}" appears in chapters but has no relationships.`,
        suggestion: `Consider adding relationships to other characters, especially the protagonist.`,
        autoFixable: true,
        confidence: 0.7
      });
    }

    // Check if character appears frequently with another character but no relationship exists
    if (hasRelationships || character.isProtagonist) {
      const coAppearances = findCoAppearingCharacters(character, state.characterCodex, state.chapters);
      coAppearances.forEach(({ character: otherChar, count }) => {
        const hasRelationship = character.relationships?.some(r => r.targetName === otherChar.name);
        if (!hasRelationship && count >= 3) {
          gaps.push({
            type: 'missing-relationship',
            severity: 'info',
            entityId: character.id,
            entityName: `${character.name} ↔ ${otherChar.name}`,
            entityType: 'relationship',
            message: `Characters "${character.name}" and "${otherChar.name}" appear together in ${count} chapters but have no defined relationship.`,
            suggestion: `Consider adding a relationship between these characters.`,
            autoFixable: true,
            confidence: 0.8
          });
        }
      });
    }
  });

  // 3. Check for orphaned items (no character ownership)
  if (state.novelItems) {
    state.novelItems.forEach(item => {
      const hasOwnership = state.characterCodex.some(char => 
        char.itemPossessions?.some(pos => pos.itemId === item.id)
      );

      if (!hasOwnership && item.firstAppearedChapter) {
        gaps.push({
          type: 'orphaned-item',
          severity: 'warning',
          entityId: item.id,
          entityName: item.name,
          entityType: 'item',
          message: `Item "${item.name}" exists but is not owned by any character.`,
          suggestion: `Assign this item to a character who owns it, or archive it if no longer relevant.`,
          autoFixable: false, // Need to know which character
          confidence: 0.9
        });
      }
    });
  }

  // 4. Check for orphaned techniques (no character mastery)
  if (state.novelTechniques) {
    state.novelTechniques.forEach(technique => {
      const hasMastery = state.characterCodex.some(char =>
        char.techniqueMasteries?.some(mast => mast.techniqueId === technique.id)
      );

      if (!hasMastery && technique.firstAppearedChapter) {
        gaps.push({
          type: 'orphaned-technique',
          severity: 'warning',
          entityId: technique.id,
          entityName: technique.name,
          entityType: 'technique',
          message: `Technique "${technique.name}" exists but is not mastered by any character.`,
          suggestion: `Assign this technique to a character who has learned it, or archive it if not used.`,
          autoFixable: false,
          confidence: 0.9
        });
      }
    });
  }

  // 5. Check for characters without arc associations
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc) {
    state.characterCodex.forEach(character => {
      // Skip if character doesn't appear in arc chapters
      const appearsInArc = state.chapters.some(ch =>
        (ch.number >= (activeArc.startedAtChapter || 0)) &&
        (ch.content?.toLowerCase().includes(character.name.toLowerCase()) ||
         ch.summary?.toLowerCase().includes(character.name.toLowerCase()))
      );

      if (appearsInArc && character.name !== protagonist?.name) {
        // Character appears in arc but might not be associated
        // This is more of an info-level gap
        gaps.push({
          type: 'character-without-arc',
          severity: 'info',
          entityId: character.id,
          entityName: character.name,
          entityType: 'character',
          message: `Character "${character.name}" appears in active arc chapters but may not be explicitly associated with the arc.`,
          suggestion: `Consider explicitly associating this character with the active arc if they play a role.`,
          autoFixable: true,
          confidence: 0.6
        });
      }
    });
  }

  // 6. Check for antagonists without arc associations
  if (state.antagonists && activeArc) {
    state.antagonists.forEach(antagonist => {
      const associatedWithArc = antagonist.arcAssociations?.some(assoc => assoc.arcId === activeArc.id);
      
      if (!associatedWithArc && 
          antagonist.status === 'active' &&
          antagonist.firstAppearedChapter &&
          activeArc.startedAtChapter &&
          antagonist.firstAppearedChapter >= activeArc.startedAtChapter) {
        gaps.push({
          type: 'antagonist-without-arc',
          severity: 'warning',
          entityId: antagonist.id,
          entityName: antagonist.name,
          entityType: 'antagonist',
          message: `Antagonist "${antagonist.name}" is active and appeared during the active arc but is not associated with it.`,
          suggestion: `Associate this antagonist with the active arc to track their role better.`,
          autoFixable: true,
          confidence: 0.85
        });
      }
    });
  }

  // 7. Check for incomplete world entries
  state.worldBible.forEach(entry => {
    if (!entry.content || entry.content.trim().length < 50) {
      gaps.push({
        type: 'incomplete-world-entry',
        severity: 'info',
        entityId: entry.id,
        entityName: entry.title,
        entityType: 'world-entry',
        message: `World entry "${entry.title}" has minimal or no content.`,
        suggestion: `Expand this world entry with more details for better world-building.`,
        autoFixable: false,
        confidence: 0.8
      });
    }
  });

  // 8. Check for orphaned scenes (no character mentions)
  state.chapters.forEach(chapter => {
    if (chapter.scenes && chapter.scenes.length > 0) {
      chapter.scenes.forEach(scene => {
        const sceneText = (scene.content || scene.summary || '').toLowerCase();
        const hasCharacterMention = state.characterCodex.some(char =>
          sceneText.includes(char.name.toLowerCase())
        );

        if (!hasCharacterMention && sceneText.length > 100) {
          gaps.push({
            type: 'orphaned-scene',
            severity: 'info',
            entityId: scene.id,
            entityName: scene.title || `Scene ${scene.number}`,
            entityType: 'scene',
            message: `Scene "${scene.title || `Scene ${scene.number}`}" in Chapter ${chapter.number} doesn't mention any known characters.`,
            suggestion: `Consider linking this scene to relevant characters or verify character names are spelled correctly.`,
            autoFixable: true,
            confidence: 0.5 // Low confidence - might be intentional
          });
        }
      });
    }
  });

  // Calculate summary
  const summary = {
    total: gaps.length,
    critical: gaps.filter(g => g.severity === 'critical').length,
    warnings: gaps.filter(g => g.severity === 'warning').length,
    info: gaps.filter(g => g.severity === 'info').length,
    autoFixable: gaps.filter(g => g.autoFixable).length
  };

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (summary.critical > 0) {
    recommendations.push(`Address ${summary.critical} critical gap(s) before generating new chapters.`);
  }

  if (summary.warnings > 0) {
    recommendations.push(`Review ${summary.warnings} warning(s) to improve story coherence.`);
  }

  if (summary.autoFixable > 0) {
    recommendations.push(`${summary.autoFixable} gap(s) can be automatically fixed.`);
  }

  if (summary.total === 0) {
    recommendations.push('No gaps detected. Your novel is well-connected!');
  }

  return {
    gaps,
    summary,
    recommendations
  };
}

/**
 * Find characters that frequently appear together with a given character
 */
function findCoAppearingCharacters(
  character: Character,
  allCharacters: Character[],
  chapters: Chapter[]
): Array<{ character: Character; count: number }> {
  const coAppearanceCounts = new Map<string, number>();

  for (const chapter of chapters) {
    const chapterText = chapter.content || chapter.summary || '';
    const charInChapter = textContainsCharacterName(chapterText, character.name);

    if (!charInChapter) continue;

    for (const otherChar of allCharacters) {
      if (otherChar.id === character.id) continue;

      if (textContainsCharacterName(chapterText, otherChar.name)) {
        const currentCount = coAppearanceCounts.get(otherChar.id) || 0;
        coAppearanceCounts.set(otherChar.id, currentCount + 1);
      }
    }
  }

  return Array.from(coAppearanceCounts.entries())
    .map(([charId, count]) => ({
      character: allCharacters.find(c => c.id === charId)!,
      count
    }))
    .filter(item => item.character && item.count >= 2)
    .sort((a, b) => b.count - a.count);
}

/**
 * Generate suggestions before chapter generation
 */
export function generatePreGenerationSuggestions(
  state: NovelState,
  currentChapterNumber: number
): string[] {
  const suggestions: string[] = [];
  const gapAnalysis = analyzeGaps(state, currentChapterNumber);

  // Prioritize critical gaps
  const criticalGaps = gapAnalysis.gaps.filter(g => g.severity === 'critical');
  if (criticalGaps.length > 0) {
    suggestions.push('⚠️ Critical issues detected:');
    criticalGaps.forEach(gap => {
      suggestions.push(`  - ${gap.message}`);
    });
    suggestions.push('');
  }

  // High-confidence auto-fixable gaps
  const highConfidenceAutoFixable = gapAnalysis.gaps.filter(
    g => g.autoFixable && g.confidence >= 0.8 && g.severity !== 'critical'
  );
  
  if (highConfidenceAutoFixable.length > 0) {
    suggestions.push(`✨ ${highConfidenceAutoFixable.length} connection(s) can be automatically made:`);
    highConfidenceAutoFixable.slice(0, 5).forEach(gap => {
      suggestions.push(`  - ${gap.message}`);
    });
  }

  // Check for active arc
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (!activeArc) {
    suggestions.push('ℹ️ No active arc. Consider starting a new story arc for better structure.');
  }

  // Check for antagonist presence
  const activeAntagonists = state.antagonists?.filter(a => a.status === 'active') || [];
  if (activeAntagonists.length === 0) {
    suggestions.push('⚠️ No active antagonists. Consider introducing opposition to maintain tension.');
  }

  return suggestions;
}
