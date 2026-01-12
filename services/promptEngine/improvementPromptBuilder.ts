import { NovelState, Chapter, BuiltPrompt } from '../../types';
import { ImprovementAction, CategoryWeaknessAnalysis, ImprovementGuidance } from '../../types/improvement';

/**
 * Improvement Prompt Builder
 * Builds specialized prompts for AI-driven improvements
 */

/**
 * Builds prompt for editing chapter to address weakness
 */
export function buildChapterImprovementPrompt(
  state: NovelState,
  chapter: Chapter,
  weakness: WeaknessAnalysis,
  improvementType: string
): BuiltPrompt {
  const instruction = buildImprovementInstruction(weakness, improvementType, chapter);
  
  // Use existing edit prompt builder with improvement-specific instruction
  // The editPromptWriter will handle context gathering and prompt construction
  return {
    systemInstruction: buildSystemInstruction(),
    userPrompt: instruction,
    contextSummary: `Improving Chapter ${chapter.number} in category: ${weakness.category}`,
  };
}

/**
 * Builds prompt for generating improvement chapter
 */
export function buildImprovementChapterPrompt(
  state: NovelState,
  position: number,
  purpose: string,
  context: {
    previousChapter: Chapter;
    nextChapter?: Chapter;
    improvementGoals: string[];
  }
): BuiltPrompt {
  let instruction = `Generate a new chapter to be inserted after Chapter ${position}.\n\n`;
  
  instruction += `PURPOSE:\n${purpose}\n\n`;
  
  instruction += `IMPROVEMENT GOALS:\n`;
  context.improvementGoals.forEach(goal => {
    instruction += `- ${goal}\n`;
  });
  instruction += `\n`;
  
  instruction += `CONTEXT:\n`;
  instruction += `- Previous chapter: ${context.previousChapter.title}\n`;
  if (context.nextChapter) {
    instruction += `- Next chapter: ${context.nextChapter.title}\n`;
    instruction += `- This chapter should bridge from the previous chapter to the next chapter\n`;
  }
  instruction += `\n`;
  
  instruction += `REQUIREMENTS:\n`;
  instruction += `- Maintain story continuity with previous and next chapters\n`;
  instruction += `- Address the improvement goals listed above\n`;
  instruction += `- Match the novel's style and voice\n`;
  instruction += `- Advance the plot naturally\n`;
  instruction += `- Minimum 1500 words\n`;
  
  return {
    systemInstruction: buildSystemInstruction(),
    userPrompt: instruction,
    contextSummary: `Generating improvement chapter at position ${position}`,
  };
}

/**
 * Builds edit instruction from improvement action
 */
export function buildEditInstruction(
  action: ImprovementAction,
  state: NovelState,
  chapter: Chapter
): string {
  if (!action.editAction) {
    return '';
  }
  
  const editAction = action.editAction;
  
  let instruction = `IMPROVE CHAPTER ${chapter.number}: ${editAction.instruction}\n\n`;
  
  if (editAction.context) {
    instruction += `CONTEXT:\n${editAction.context}\n\n`;
  }
  
  if (editAction.targetSection) {
    instruction += `FOCUS AREA:\n- Target section: ${editAction.targetSection}\n`;
  }
  
  instruction += `\nREQUIREMENTS:\n`;
  instruction += `- Maintain story continuity and plot progression\n`;
  instruction += `- Preserve character consistency\n`;
  instruction += `- Keep author's voice and style\n`;
  instruction += `- Maintain existing themes and motifs\n`;
  instruction += `- Apply the improvement: ${editAction.instruction}\n`;
  
  return instruction;
}

/**
 * Builds improvement instruction from weakness analysis
 */
function buildImprovementInstruction(
  weakness: CategoryWeaknessAnalysis,
  improvementType: string,
  chapter: Chapter
): string {
  let instruction = `IMPROVE CHAPTER ${chapter.number}\n\n`;
  
  instruction += `CATEGORY: ${weakness.category}\n`;
  instruction += `CURRENT SCORE: ${weakness.overallScore}/100\n`;
  instruction += `TARGET SCORE: ${weakness.targetScore}/100\n\n`;
  
  instruction += `WEAKNESSES TO ADDRESS:\n`;
  weakness.weaknesses.forEach(w => {
    instruction += `- ${w.description} (Current: ${w.currentScore}/100, Target: ${w.targetScore}/100)\n`;
  });
  instruction += `\n`;
  
  instruction += `IMPROVEMENT TYPE: ${improvementType}\n\n`;
  
  instruction += `SUGGESTED IMPROVEMENTS:\n`;
  weakness.recommendations.forEach(rec => {
    instruction += `- ${rec}\n`;
  });
  instruction += `\n`;
  
  instruction += `PRESERVE:\n`;
  instruction += `- Story continuity and plot progression\n`;
  instruction += `- Character consistency and voice\n`;
  instruction += `- Author's style and tone\n`;
  instruction += `- Existing themes and motifs\n`;
  instruction += `- Chapter structure and pacing\n`;
  
  return instruction;
}

/**
 * Builds system instruction for improvements
 */
function buildSystemInstruction(): string {
  return `You are an expert novel editor helping to improve a novel chapter.

Your task is to improve the chapter while:
1. Maintaining the author's voice and style
2. Preserving story continuity
3. Keeping character consistency
4. Addressing the specific improvement goals
5. Maintaining high literary quality

Apply improvements thoughtfully and naturally - they should feel like they were always part of the chapter, not added on.`;
}

/**
 * Builds improvement guidance section for future chapter generation
 */
export function buildImprovementGuidanceSection(
  guidance: ImprovementGuidance
): string {
  let section = `IMPROVEMENT FOCUS (Address these areas in this chapter):\n\n`;
  
  guidance.targets.forEach(target => {
    section += `- ${target.category}: ${target.description}\n`;
    section += `  Current score: ${target.currentScore}/100 → Target: ${target.targetScore}/100\n`;
    if (target.specificInstructions) {
      section += `  Instructions: ${target.specificInstructions}\n`;
    }
    section += `\n`;
  });
  
  section += `PRIORITY: ${guidance.priority.toUpperCase()}\n`;
  
  return section;
}
