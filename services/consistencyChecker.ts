/**
 * Consistency Checker Service
 * 
 * Validates consistency across chapters for:
 * - Power levels and cultivation progression
 * - Character states and status
 * - Timeline continuity
 * - Character relationships
 * - World rules and laws
 */

import { NovelState, Character, Chapter, Arc } from '../types';
import { textContainsCharacterName } from '../utils/characterNameMatching';
import { normalize } from '../utils/textProcessor';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';
import { getEntityStateTracker } from './entityStateTracker';

export interface ConsistencyIssue {
  type: ConsistencyIssueType;
  severity: 'critical' | 'warning' | 'info';
  chapterNumber?: number;
  characterName?: string;
  message: string;
  suggestion: string;
  confidence: number; // 0-1
  evidence?: string[];
}

export type ConsistencyIssueType =
  | 'power-regression'
  | 'status-inconsistency'
  | 'timeline-gap'
  | 'relationship-inconsistency'
  | 'world-rule-violation'
  | 'character-state-mismatch'
  | 'cultivation-jump'
  | 'missing-character'
  | 'duplicate-event';

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  summary: {
    total: number;
    critical: number;
    warnings: number;
    info: number;
    overallScore: number; // 0-100
  };
  recommendations: string[];
}

/**
 * Check power level consistency across chapters
 */
function checkPowerLevelConsistency(
  character: Character,
  chapters: Chapter[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const powerMentions: Array<{ chapterNumber: number; level: string; context: string }> = [];

  // Extract power level mentions from chapters
  chapters.forEach(chapter => {
    const chapterText = (chapter.content || chapter.summary || '').toLowerCase();
    if (textContainsCharacterName(chapterText, character.name)) {
      // Look for cultivation level mentions near character name
      const nameIndex = chapterText.indexOf(character.name.toLowerCase());
      if (nameIndex !== -1) {
        const context = chapterText.substring(
          Math.max(0, nameIndex - 100),
          Math.min(chapterText.length, nameIndex + 200)
        );
        
        // Try to extract cultivation level from context
        const cultivationMatch = context.match(/(?:cultivation|realm|level|stage|rank)\s*(?:of\s*)?([a-z\s]+(?:\s+(?:realm|stage|level))?)/i);
        if (cultivationMatch) {
          powerMentions.push({
            chapterNumber: chapter.number,
            level: cultivationMatch[1].trim(),
            context: context.substring(0, 150)
          });
        }
      }
    }
  });

  // Check for power regressions
  if (powerMentions.length >= 2) {
    // Simple check: if character's current cultivation is lower than mentioned earlier
    const sortedMentions = powerMentions.sort((a, b) => a.chapterNumber - b.chapterNumber);
    const currentLevel = (character.currentCultivation || '').toLowerCase();
    
    // Check if earlier chapters mention higher levels
    for (let i = 0; i < sortedMentions.length - 1; i++) {
      const earlier = sortedMentions[i];
      const later = sortedMentions[i + 1];
      
      // If current cultivation is lower than what was mentioned earlier, flag it
      if (currentLevel && earlier.level && 
          currentLevel.includes('lower') || earlier.level.includes('higher')) {
        // This is a simplified check - in reality, you'd need a power level hierarchy
        issues.push({
          type: 'power-regression',
          severity: 'warning',
          chapterNumber: later.chapterNumber,
          characterName: character.name,
          message: `Possible power level regression: ${character.name} may have regressed between chapters ${earlier.chapterNumber} and ${later.chapterNumber}.`,
          suggestion: `Review cultivation progression for ${character.name}. Power levels should generally increase or remain stable.`,
          confidence: 0.6,
          evidence: [earlier.context, later.context]
        });
      }
    }
  }

  // Check for sudden cultivation jumps (unrealistic progression)
  if (character.currentCultivation && powerMentions.length >= 2) {
    const sortedMentions = powerMentions.sort((a, b) => a.chapterNumber - b.chapterNumber);
    const firstMention = sortedMentions[0];
    const lastMention = sortedMentions[sortedMentions.length - 1];
    const chaptersBetween = lastMention.chapterNumber - firstMention.chapterNumber;
    
    // If character jumps multiple realms in very few chapters, flag it
    if (chaptersBetween <= 3 && sortedMentions.length >= 3) {
      issues.push({
        type: 'cultivation-jump',
        severity: 'warning',
        chapterNumber: lastMention.chapterNumber,
        characterName: character.name,
        message: `Rapid cultivation progression: ${character.name} may have advanced too quickly between chapters ${firstMention.chapterNumber} and ${lastMention.chapterNumber}.`,
        suggestion: `Consider slowing down cultivation progression or adding more intermediate steps for realism.`,
        confidence: 0.7,
        evidence: sortedMentions.map(m => `Ch ${m.chapterNumber}: ${m.level}`)
      });
    }
  }

  return issues;
}

/**
 * Check character status consistency
 */
function checkStatusConsistency(
  character: Character,
  chapters: Chapter[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  
  // Check if character appears after being marked as deceased
  if (character.status === 'Deceased') {
    const lastAppearance = chapters
      .filter(ch => {
        const text = (ch.content || ch.summary || '').toLowerCase();
        return textContainsCharacterName(text, character.name);
      })
      .sort((a, b) => b.number - a.number)[0];

    if (lastAppearance && lastAppearance.number > 0) {
      // Character marked as deceased but appears in later chapters
      issues.push({
        type: 'status-inconsistency',
        severity: 'critical',
        chapterNumber: lastAppearance.number,
        characterName: character.name,
        message: `Character "${character.name}" is marked as Deceased but appears in Chapter ${lastAppearance.number}.`,
        suggestion: `Either update the character status to "Alive" or remove their appearance from later chapters.`,
        confidence: 0.95
      });
    }
  }

  return issues;
}

/**
 * Check timeline continuity
 */
function checkTimelineContinuity(
  chapters: Chapter[],
  arcs: Arc[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  
  if (chapters.length < 2) return issues;

  // Check for large gaps in chapter numbers
  for (let i = 1; i < chapters.length; i++) {
    const prevChapter = chapters[i - 1];
    const currChapter = chapters[i];
    const gap = currChapter.number - prevChapter.number;
    
    if (gap > 1) {
      issues.push({
        type: 'timeline-gap',
        severity: 'info',
        chapterNumber: currChapter.number,
        message: `Gap in chapter numbering: Jump from Chapter ${prevChapter.number} to Chapter ${currChapter.number}.`,
        suggestion: `Consider if this gap is intentional (time skip) or if chapters are missing.`,
        confidence: 1.0
      });
    }
  }

  // Check arc timeline consistency
  arcs.forEach(arc => {
    if (arc.startedAtChapter && arc.endedAtChapter) {
      if (arc.endedAtChapter < arc.startedAtChapter) {
        issues.push({
          type: 'timeline-gap',
          severity: 'critical',
          message: `Arc "${arc.title}" has invalid timeline: ended at Chapter ${arc.endedAtChapter} but started at Chapter ${arc.startedAtChapter}.`,
          suggestion: `Fix the arc start/end chapter numbers.`,
          confidence: 1.0
        });
      }
    }
  });

  return issues;
}

/**
 * Check for missing characters in expected chapters
 */
function checkMissingCharacters(
  state: NovelState,
  chapters: Chapter[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const protagonists = state.characterCodex.filter(c => c.isProtagonist);
  
  if (protagonists.length === 0) return issues;

  // Check if at least one protagonist appears in each chapter
  chapters.forEach(chapter => {
    const chapterText = (chapter.content || chapter.summary || '').toLowerCase();
    const protagonistPresent = protagonists.some(p => textContainsCharacterName(chapterText, p.name));
    
    if (!protagonistPresent && chapter.number > 0) {
      const protagonistNames = protagonists.map(p => p.name).join(', ');
      issues.push({
        type: 'missing-character',
        severity: 'warning',
        chapterNumber: chapter.number,
        characterName: protagonistNames,
        message: `No protagonist${protagonists.length > 1 ? 's' : ''} (${protagonistNames}) appear${protagonists.length > 1 ? '' : 's'} in Chapter ${chapter.number}.`,
        suggestion: `Consider if this is intentional (POV shift) or if at least one protagonist should be present.`,
        confidence: 0.8
      });
    }
  });

  return issues;
}

/**
 * Check relationship consistency
 */
function checkRelationshipConsistency(
  characters: Character[]
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check for one-way relationships
  characters.forEach(char => {
    if (!char.relationships) return;
    
    char.relationships.forEach(rel => {
      const targetChar = characters.find(c => c.id === rel.characterId);
      if (!targetChar) return;

      // Check if relationship is mutual
      const reverseRel = targetChar.relationships?.find(r => r.characterId === char.id);
      if (!reverseRel && rel.type !== 'Unknown') {
        issues.push({
          type: 'relationship-inconsistency',
          severity: 'info',
          characterName: `${char.name} ↔ ${targetChar.name}`,
          message: `One-way relationship: ${char.name} has relationship "${rel.type}" with ${targetChar.name}, but reverse relationship is not defined.`,
          suggestion: `Consider adding the reverse relationship for ${targetChar.name}.`,
          confidence: 0.6
        });
      }
    });
  });

  return issues;
}

/**
 * Comprehensive consistency check
 * Enhanced with knowledge graph-based validation
 */
export function checkConsistency(state: NovelState): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];
  const graphService = getKnowledgeGraphService();
  const powerSystem = getPowerLevelSystem();
  const stateTracker = getEntityStateTracker();

  // Initialize graph if needed
  if (!graphService.getGraph()) {
    graphService.initializeGraph(state);
  }

  // 1. Check power level consistency for each character (enhanced with graph)
  state.characterCodex.forEach(character => {
    issues.push(...checkPowerLevelConsistency(character, state.chapters));
    issues.push(...checkStatusConsistency(character, state.chapters));
    
    // Enhanced: Check power progression using graph
    const progression = graphService.getPowerProgression(character.id);
    if (progression && progression.progression.length > 1) {
      const lastProg = progression.progression[progression.progression.length - 1];
      const prevProg = progression.progression[progression.progression.length - 2];
      const chaptersBetween = lastProg.chapterNumber - prevProg.chapterNumber;
      
      const validation = powerSystem.validateProgression(
        prevProg.powerLevel,
        lastProg.powerLevel,
        chaptersBetween,
        !!lastProg.eventDescription
      );

      if (!validation.valid) {
        validation.issues.forEach(issue => {
          issues.push({
            type: 'power-regression',
            severity: 'critical',
            chapterNumber: lastProg.chapterNumber,
            characterName: character.name,
            message: issue,
            suggestion: 'Review power level progression and ensure it follows established rules.',
            confidence: 0.9,
            evidence: [
              `Previous: ${prevProg.powerLevel} (Ch ${prevProg.chapterNumber})`,
              `Current: ${lastProg.powerLevel} (Ch ${lastProg.chapterNumber})`,
            ],
          });
        });
      }
    }
  });

  // 2. Check timeline continuity
  issues.push(...checkTimelineContinuity(state.chapters, state.plotLedger));

  // 3. Check for missing characters
  issues.push(...checkMissingCharacters(state, state.chapters));

  // 4. Check relationship consistency (enhanced with graph)
  issues.push(...checkRelationshipConsistency(state.characterCodex));
  
  // Enhanced: Cross-chapter state validation
  issues.push(...checkCrossChapterStateConsistency(state, graphService, stateTracker));

  // Calculate summary
  const critical = issues.filter(i => i.severity === 'critical').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;

  // Calculate overall score (100 - penalties)
  const criticalPenalty = critical * 20;
  const warningPenalty = warnings * 5;
  const infoPenalty = info * 1;
  const overallScore = Math.max(0, 100 - criticalPenalty - warningPenalty - infoPenalty);

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (critical > 0) {
    recommendations.push(`Address ${critical} critical consistency issue(s) immediately.`);
  }
  
  if (warnings > 0) {
    recommendations.push(`Review ${warnings} warning(s) to maintain story coherence.`);
  }

  if (overallScore >= 90) {
    recommendations.push('Excellent consistency! Your story maintains good continuity.');
  } else if (overallScore >= 75) {
    recommendations.push('Good consistency with minor issues to review.');
  } else if (overallScore >= 60) {
    recommendations.push('Moderate consistency issues detected. Review recommended.');
  } else {
    recommendations.push('Significant consistency issues found. Review and fix before continuing.');
  }

  return {
    issues,
    summary: {
      total: issues.length,
      critical,
      warnings,
      info,
      overallScore
    },
    recommendations
  };
}

/**
 * Check consistency for a specific chapter
 */
export function checkChapterConsistency(
  state: NovelState,
  chapterNumber: number
): ConsistencyIssue[] {
  const chapter = state.chapters.find(c => c.number === chapterNumber);
  if (!chapter) return [];

  const issues: ConsistencyIssue[] = [];
  const previousChapter = state.chapters
    .filter(c => c.number < chapterNumber)
    .sort((a, b) => b.number - a.number)[0];

  // Check 1: Chapter has minimum required content
  const wordCount = chapter.content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 1000) {
    issues.push({
      type: 'character-state-mismatch',
      severity: 'warning',
      chapterNumber,
      message: `Chapter ${chapterNumber} is very short (${wordCount} words). Consider expanding the content.`,
      suggestion: `Aim for at least 1500 words per chapter for better narrative depth.`,
      confidence: 0.9
    });
  }

  // Check 2: Chapter has a summary
  if (!chapter.summary || chapter.summary.trim().length < 20) {
    issues.push({
      type: 'character-state-mismatch',
      severity: 'info',
      chapterNumber,
      message: `Chapter ${chapterNumber} is missing or has a very short summary.`,
      suggestion: `Add a summary to help maintain story continuity and track plot progression.`,
      confidence: 0.8
    });
  }

  // Check 3: Logic audit presence
  if (!chapter.logicAudit) {
    issues.push({
      type: 'character-state-mismatch',
      severity: 'warning',
      chapterNumber,
      message: `Chapter ${chapterNumber} is missing a logic audit (starting value, friction, choice, resulting value).`,
      suggestion: `Add a logic audit to track narrative structure and value shifts.`,
      confidence: 0.85
    });
  } else {
    // Validate logic audit completeness
    const audit = chapter.logicAudit;
    if (!audit.startingValue || !audit.theFriction || !audit.theChoice || !audit.resultingValue) {
      issues.push({
        type: 'character-state-mismatch',
        severity: 'warning',
        chapterNumber,
        message: `Chapter ${chapterNumber} has an incomplete logic audit.`,
        suggestion: `Complete all logic audit fields (starting value, friction, choice, resulting value).`,
        confidence: 0.9
      });
    }
  }

  // Check 4: Continuity with previous chapter
  if (previousChapter) {
    const prevEnding = previousChapter.content.split(/\s+/).slice(-50).join(' ').toLowerCase();
    const currBeginning = chapter.content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
    
    // Check for character continuity
    const prevCharacters = state.characterCodex.filter(char =>
      textContainsCharacterName(prevEnding, char.name)
    );
    const currCharacters = state.characterCodex.filter(char =>
      textContainsCharacterName(currBeginning, char.name)
    );
    
    if (prevCharacters.length > 0 && currCharacters.length === 0) {
      issues.push({
        type: 'character-state-mismatch',
        severity: 'warning',
        chapterNumber,
        message: `No character continuity detected between Chapter ${previousChapter.number} and Chapter ${chapterNumber}.`,
        suggestion: `Consider referencing characters from the previous chapter for better continuity.`,
        confidence: 0.7
      });
    }
    
    // Check for location/context continuity
    const prevContext = prevEnding;
    const currContext = currBeginning;
    
    // Simple check: if previous chapter ended with action/dialogue, current should acknowledge it
    const prevEndsWithAction = prevContext.match(/(said|shouted|ran|jumped|attacked|fought|battled)/);
    const currStartsWithAction = currContext.match(/(said|shouted|ran|jumped|attacked|fought|battled)/);
    
    if (prevEndsWithAction && !currStartsWithAction && !currContext.match(/(hours?|days?|weeks?|later|meanwhile|after)/)) {
      issues.push({
        type: 'timeline-gap',
        severity: 'info',
        chapterNumber,
        message: `Possible timeline gap: Previous chapter ended with action, but current chapter doesn't immediately continue it.`,
        suggestion: `If this is intentional (time skip), consider adding a transition phrase. Otherwise, continue the action.`,
        confidence: 0.6
      });
    }
  }

  // Check 5: Chapter title presence
  if (!chapter.title || chapter.title.trim().length < 3) {
    issues.push({
      type: 'character-state-mismatch',
      severity: 'info',
      chapterNumber,
      message: `Chapter ${chapterNumber} has a very short or missing title.`,
      suggestion: `Add a descriptive title to help readers navigate the story.`,
      confidence: 0.7
    });
  }

  return issues;
}

/**
 * Check cross-chapter state consistency using knowledge graph
 */
function checkCrossChapterStateConsistency(
  state: NovelState,
  graphService: ReturnType<typeof getKnowledgeGraphService>,
  stateTracker: ReturnType<typeof getEntityStateTracker>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check if entity states are tracked
  state.characterCodex.forEach(character => {
    const currentState = stateTracker.getCurrentState('character', character.id);
    if (!currentState) {
      issues.push({
        type: 'character-state-mismatch',
        severity: 'info',
        characterName: character.name,
        message: `Character "${character.name}" has no tracked state history.`,
        suggestion: 'State tracking will help maintain consistency across chapters.',
        confidence: 0.5,
      });
    }
  });

  return issues;
}
