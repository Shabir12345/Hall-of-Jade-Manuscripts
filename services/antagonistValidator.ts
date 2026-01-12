import { Antagonist, NovelState, Chapter, Arc, Character } from '../types';
import { fetchAntagonists, getAntagonistsForArc, getAntagonistsForChapter } from './antagonistService';
import { AntagonistGap } from './antagonistAnalyzer';

/**
 * Antagonist Validator
 * Ensures the protagonist always has active opposition and validates antagonist state
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export interface AntagonistStatusTransition {
  from: string;
  to: string;
  isValid: boolean;
  reason?: string;
}

/**
 * Validate that protagonist has at least one active antagonist
 */
export async function validateProtagonistHasEnemy(
  novelId: string,
  currentChapterNumber: number,
  activeArc: Arc | null
): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  const antagonists = await fetchAntagonists(novelId);
  
  // Get active antagonists
  const activeAntagonists = antagonists.filter(a => 
    a.status === 'active' || a.status === 'hinted'
  );

  // Check novel-level antagonists
  const novelLevelAntagonists = activeAntagonists.filter(a => 
    a.durationScope === 'novel' || a.durationScope === 'multi_arc'
  );

  // Check arc-level antagonists if there's an active arc
  let arcAntagonists: Antagonist[] = [];
  if (activeArc) {
    arcAntagonists = await getAntagonistsForArc(activeArc.id);
    const activeArcAntagonists = arcAntagonists.filter(a => 
      a.status === 'active' || a.status === 'hinted'
    );
    
    if (activeArcAntagonists.length === 0 && novelLevelAntagonists.length === 0) {
      errors.push(`No active antagonists found for the current arc "${activeArc.title}" or novel-level.`);
      suggestions.push('Create a new antagonist for this arc or activate a dormant one.');
      suggestions.push('Consider introducing a hinted antagonist that was foreshadowed earlier.');
    }
  }

  // Overall check
  if (activeAntagonists.length === 0) {
    errors.push('CRITICAL: No active antagonists found. The protagonist currently has no opposition.');
    suggestions.push('Create at least one active antagonist to maintain story tension.');
    suggestions.push('Consider activating a dormant antagonist or introducing a new threat.');
  } else if (activeAntagonists.length === 1 && novelLevelAntagonists.length === 0) {
    warnings.push('Only one active antagonist found. Consider adding secondary antagonists for layered conflict.');
    suggestions.push('Add a secondary antagonist or hint at upcoming threats.');
  }

  // Check for upcoming antagonist transitions
  const resolvedAntagonists = antagonists.filter(a => 
    a.status === 'defeated' || a.status === 'transformed'
  );
  
  if (resolvedAntagonists.length > 0) {
    const recentlyResolved = resolvedAntagonists.filter(a => 
      a.resolvedChapter && a.resolvedChapter >= currentChapterNumber - 3
    );
    
    if (recentlyResolved.length > 0 && activeAntagonists.length === 0) {
      errors.push('An antagonist was recently resolved but no new active antagonist has been introduced.');
      suggestions.push('Introduce a new antagonist to replace the resolved one.');
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    suggestions,
  };
}

/**
 * Validate antagonist status transition
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): AntagonistStatusTransition {
  const validTransitions: Record<string, string[]> = {
    'hinted': ['active', 'dormant'],
    'dormant': ['active', 'hinted'],
    'active': ['defeated', 'transformed', 'dormant'],
    'defeated': [], // Terminal state
    'transformed': ['active', 'dormant'], // Can become active again if transformation allows
  };

  const allowed = validTransitions[currentStatus] || [];
  const isValid = allowed.includes(newStatus);

  return {
    from: currentStatus,
    to: newStatus,
    isValid,
    reason: isValid 
      ? undefined 
      : `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
  };
}

/**
 * Validate antagonist data integrity
 */
export function validateAntagonistData(antagonist: Antagonist): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Required fields
  if (!antagonist.name || antagonist.name.trim() === '') {
    errors.push('Antagonist name is required.');
  }

  if (!antagonist.type) {
    errors.push('Antagonist type is required.');
  }

  if (!antagonist.durationScope) {
    errors.push('Duration scope is required.');
  }

  if (!antagonist.threatLevel) {
    errors.push('Threat level is required.');
  }

  // Logical validations
  if (antagonist.resolvedChapter && antagonist.firstAppearedChapter) {
    if (antagonist.resolvedChapter < antagonist.firstAppearedChapter) {
      errors.push('Resolved chapter cannot be before first appeared chapter.');
    }
  }

  if (antagonist.lastAppearedChapter && antagonist.firstAppearedChapter) {
    if (antagonist.lastAppearedChapter < antagonist.firstAppearedChapter) {
      errors.push('Last appeared chapter cannot be before first appeared chapter.');
    }
  }

  if (antagonist.status === 'defeated' && !antagonist.resolvedChapter) {
    warnings.push('Antagonist is marked as defeated but has no resolved chapter.');
    suggestions.push('Set the resolved chapter to indicate when this antagonist was defeated.');
  }

  if (antagonist.status === 'active' && antagonist.resolvedChapter) {
    warnings.push('Antagonist is marked as active but has a resolved chapter.');
    suggestions.push('Change status to "defeated" or remove the resolved chapter.');
  }

  // Group antagonist validation
  if (antagonist.type === 'group' && (!antagonist.groupMembers || antagonist.groupMembers.length === 0)) {
    warnings.push('Group antagonist has no members.');
    suggestions.push('Add at least one character as a member of this group.');
  }

  // Relationship validation
  if (antagonist.type === 'individual' && antagonist.relationships) {
    const primaryTargets = antagonist.relationships.filter(r => 
      r.relationshipType === 'primary_target'
    );
    
    if (primaryTargets.length === 0) {
      warnings.push('Individual antagonist has no primary target relationship.');
      suggestions.push('Add a relationship to the protagonist or another key character.');
    }
  }

  // Duration scope validation
  if (antagonist.durationScope === 'chapter' && antagonist.status === 'active') {
    warnings.push('Chapter-level antagonist is marked as active. Consider if this should be arc or novel level.');
  }

  if (antagonist.durationScope === 'novel' && antagonist.resolvedChapter) {
    warnings.push('Novel-level antagonist has a resolved chapter. Consider if this should be arc or multi-arc level.');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    suggestions,
  };
}

/**
 * Validate antagonist arc associations
 */
export async function validateArcAssociations(
  novelId: string,
  arcId: string
): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  const arcAntagonists = await getAntagonistsForArc(arcId);
  
  if (arcAntagonists.length === 0) {
    warnings.push('Arc has no associated antagonists.');
    suggestions.push('Add at least one antagonist to this arc to provide conflict.');
  }

  const primaryAntagonists = arcAntagonists.filter(a => 
    a.arcAssociations?.some(aa => aa.arcId === arcId && aa.role === 'primary')
  );

  if (primaryAntagonists.length === 0 && arcAntagonists.length > 0) {
    warnings.push('Arc has antagonists but no primary antagonist.');
    suggestions.push('Designate at least one antagonist as the primary threat for this arc.');
  }

  if (primaryAntagonists.length > 1) {
    warnings.push('Arc has multiple primary antagonists. Consider if one should be secondary.');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    suggestions,
  };
}

/**
 * Check for antagonist gaps in upcoming chapters
 */
export async function checkUpcomingGaps(
  novelId: string,
  currentChapterNumber: number,
  plannedChapters: number
): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  const antagonists = await fetchAntagonists(novelId);
  const activeAntagonists = antagonists.filter(a => a.status === 'active');
  
  // Check novel-level antagonists
  const novelLevel = activeAntagonists.filter(a => 
    a.durationScope === 'novel' || a.durationScope === 'multi_arc'
  );

  // Check if any active antagonists are ending soon
  const endingSoon = activeAntagonists.filter(a => {
    if (a.durationScope === 'arc') {
      // Would need arc end chapter info - simplified for now
      return false;
    }
    return false;
  });

  if (novelLevel.length === 0 && activeAntagonists.length > 0) {
    warnings.push('No novel-level antagonists found. Consider if current antagonists will sustain the full story.');
    suggestions.push('Introduce a long-term antagonist or elevate an existing one to novel-level.');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    suggestions,
  };
}

/**
 * Comprehensive validation of antagonist system
 */
export async function validateAntagonistSystem(
  novel: NovelState,
  currentChapterNumber: number
): Promise<ValidationResult> {
  const allWarnings: string[] = [];
  const allErrors: string[] = [];
  const allSuggestions: string[] = [];

  const activeArc = novel.plotLedger.find(a => a.status === 'active') || null;

  // Validate protagonist has enemy
  const enemyValidation = await validateProtagonistHasEnemy(
    novel.id,
    currentChapterNumber,
    activeArc
  );
  allWarnings.push(...enemyValidation.warnings);
  allErrors.push(...enemyValidation.errors);
  allSuggestions.push(...enemyValidation.suggestions);

  // Validate each antagonist
  if (novel.antagonists) {
    for (const antagonist of novel.antagonists) {
      const dataValidation = validateAntagonistData(antagonist);
      allWarnings.push(...dataValidation.warnings.map(w => `${antagonist.name}: ${w}`));
      allErrors.push(...dataValidation.errors.map(e => `${antagonist.name}: ${e}`));
      allSuggestions.push(...dataValidation.suggestions.map(s => `${antagonist.name}: ${s}`));
    }
  }

  // Validate arc associations
  if (activeArc) {
    const arcValidation = await validateArcAssociations(novel.id, activeArc.id);
    allWarnings.push(...arcValidation.warnings);
    allErrors.push(...arcValidation.errors);
    allSuggestions.push(...arcValidation.suggestions);
  }

  return {
    isValid: allErrors.length === 0,
    warnings: allWarnings,
    errors: allErrors,
    suggestions: allSuggestions,
  };
}
