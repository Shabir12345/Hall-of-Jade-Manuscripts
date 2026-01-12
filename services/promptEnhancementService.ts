import { RecurringIssuePattern } from '../types/editor';
import { BuiltPrompt } from '../types';
import { saveRecurringPattern } from './supabaseService';

/**
 * Prompt Enhancement Service
 * Converts recurring issue patterns into prompt constraints
 */

/**
 * Builds issue prevention constraints from recurring patterns
 * Also updates the pattern's prompt_constraint_added field in the database
 */
export async function buildIssuePreventionConstraints(patterns: RecurringIssuePattern[]): Promise<string[]> {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  const constraints: string[] = [];
  const constraintMap = new Map<string, string>(); // Key: type+location, Value: constraint
  const patternsToUpdate: RecurringIssuePattern[] = [];

  for (const pattern of patterns) {
    if (!pattern.isActive || pattern.occurrenceCount < pattern.thresholdCount) {
      continue; // Skip inactive or below-threshold patterns
    }

    const key = `${pattern.issueType}|${pattern.location}`;
    
    // Skip if we already have a constraint for this type+location
    if (constraintMap.has(key)) {
      continue;
    }

    const constraint = buildConstraintForPattern(pattern);
    if (constraint) {
      constraintMap.set(key, constraint);
      constraints.push(constraint);
      
      // Store the constraint in the pattern if it's not already stored
      if (pattern.promptConstraintAdded !== constraint) {
        pattern.promptConstraintAdded = constraint;
        patternsToUpdate.push(pattern);
      }
    }
  }

  // Update patterns with their constraints asynchronously (don't block)
  if (patternsToUpdate.length > 0) {
    Promise.all(patternsToUpdate.map(p => saveRecurringPattern(p)))
      .then(() => {
        console.log(`[Prompt Enhancement] Updated ${patternsToUpdate.length} patterns with prompt constraints`);
      })
      .catch(error => {
        console.error('[Prompt Enhancement] Failed to update patterns with constraints:', error);
      });
  }

  return constraints;
}

/**
 * Builds a specific constraint for a pattern
 */
function buildConstraintForPattern(pattern: RecurringIssuePattern): string | null {
  const { issueType, location, occurrenceCount } = pattern;

  // Transition issues at chapter start (most common issue)
  if (issueType === 'transition' && location === 'start') {
    return `CRITICAL: Start the chapter exactly where the previous chapter ended. Do NOT repeat the previous chapter's ending - begin with the immediate next moment or consequence. Ensure smooth narrative flow between chapters. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Gap issues at chapter start
  if (issueType === 'gap' && location === 'start') {
    return `CRITICAL: Ensure no narrative gaps between chapters. The new chapter must directly continue from where the previous chapter ended, maintaining continuity of time, location, and character state. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Time skip issues
  if (issueType === 'time_skip') {
    return `CRITICAL: Avoid unexplained time skips. If time passes between chapters, explicitly establish the temporal transition with clear markers (e.g., 'Three days later...', 'The next morning...', 'After several weeks...'). Ensure the reader understands what happened during the skipped time. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Character consistency issues
  if (issueType === 'character_consistency') {
    return `CRITICAL: Maintain strict character consistency. Characters must act according to their established personalities, knowledge, and motivations. Review character codex before writing character actions or dialogue. Characters should not suddenly change behavior without justification. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Continuity issues
  if (issueType === 'continuity') {
    if (location === 'start') {
      return `CRITICAL: Maintain story continuity at chapter start. Ensure characters are in the correct locations, know what they knew, and are in the emotional/physical state they were in at the end of the previous chapter. This is a recurring issue (detected ${occurrenceCount} times).`;
    }
    return `CRITICAL: Maintain story continuity throughout the chapter. Ensure consistency in character knowledge, locations, world state, and established facts. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Plot hole issues
  if (issueType === 'plot_hole') {
    return `CRITICAL: Avoid plot holes. Ensure all character actions, events, and story elements are logically consistent with established world rules, character motivations, and previous story events. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Paragraph structure issues
  if (issueType === 'paragraph_structure') {
    return `CRITICAL: Use proper paragraph structure. Break paragraphs at natural transition points (topic shifts, time/location changes, character focus shifts). Each paragraph should be 2-6 sentences. Never write one continuous paragraph. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Sentence structure issues
  if (issueType === 'sentence_structure') {
    return `CRITICAL: Vary sentence structure and beginnings. Avoid repetitive patterns like "He... He... He..." or "The... The... The...". Combine choppy sentences where appropriate. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Style issues
  if (issueType === 'style') {
    return `CRITICAL: Maintain consistent writing style throughout the chapter. Match the established narrative voice, tone, and descriptive style from previous chapters. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Formatting issues
  if (issueType === 'formatting') {
    return `CRITICAL: Follow proper formatting guidelines. Use double newlines (\\n\\n) to separate paragraphs. Ensure proper punctuation and varied paragraph lengths. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Grammar issues (general)
  if (issueType === 'grammar') {
    return `CRITICAL: Ensure proper grammar and punctuation throughout the chapter. Use commas for lists, clauses, and pauses. Use periods only for complete sentence endings. Avoid run-on sentences. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Gap issues in other locations
  if (issueType === 'gap' && location !== 'start') {
    return `CRITICAL: Avoid narrative gaps. Ensure smooth transitions between scenes and ideas. Fill in any logical gaps that would confuse the reader. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Transition issues in other locations
  if (issueType === 'transition' && location !== 'start') {
    return `CRITICAL: Ensure smooth transitions between scenes, ideas, and time periods. Use clear transition markers when moving between different narrative elements. This is a recurring issue (detected ${occurrenceCount} times).`;
  }

  // Generic fallback for unhandled patterns
  return `IMPORTANT: Pay special attention to ${issueType} issues ${location === 'start' ? 'at chapter start' : location === 'end' ? 'at chapter end' : 'in transitions'}. This is a recurring issue (detected ${occurrenceCount} times).`;
}

/**
 * Adds pattern-based constraints to a built prompt
 */
export async function addPatternConstraintsToPrompt(
  basePrompt: BuiltPrompt,
  patterns: RecurringIssuePattern[]
): Promise<BuiltPrompt> {
  if (!patterns || patterns.length === 0) {
    return basePrompt;
  }

  const constraints = await buildIssuePreventionConstraints(patterns);
  
  if (constraints.length === 0) {
    return basePrompt;
  }

  // Clone the prompt to avoid mutations
  const enhancedPrompt: BuiltPrompt = {
    ...basePrompt,
    userPrompt: basePrompt.userPrompt, // Keep original user prompt
  };

  // Add constraints to the existing constraints array
  // Priority: pattern constraints come first (most critical)
  if (enhancedPrompt.specificConstraints) {
    enhancedPrompt.specificConstraints = [...constraints, ...enhancedPrompt.specificConstraints];
  } else {
    enhancedPrompt.specificConstraints = constraints;
  }

  // Also add to task description if needed (optional enhancement)
  if (constraints.length > 0 && enhancedPrompt.taskDescription) {
    const constraintSummary = constraints.map(c => `  - ${c}`).join('\n');
    enhancedPrompt.taskDescription = `${enhancedPrompt.taskDescription}\n\nRECURRING ISSUE PREVENTIONS:\n${constraintSummary}`;
  }

  return enhancedPrompt;
}

/**
 * Gets constraint text for a specific pattern
 * Useful for storing in the database
 */
export async function getConstraintTextForPattern(pattern: RecurringIssuePattern): Promise<string> {
  const constraints = await buildIssuePreventionConstraints([pattern]);
  return constraints.length > 0 ? constraints[0] : '';
}

/**
 * Gets constraint text for a specific pattern (synchronous version)
 * Uses the cached prompt_constraint_added from the database if available
 */
export function getConstraintTextForPatternSync(pattern: RecurringIssuePattern): string {
  // Return cached constraint if available
  if (pattern.promptConstraintAdded) {
    return pattern.promptConstraintAdded;
  }
  
  // Fallback to building constraint (but this won't save to DB)
  // Note: This is a fallback - ideally patterns should have prompt_constraint_added populated
  return buildConstraintForPattern(pattern) || '';
}
