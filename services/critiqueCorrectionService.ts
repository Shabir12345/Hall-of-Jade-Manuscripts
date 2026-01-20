/**
 * Critique-Correction Service
 * 
 * Implements the Auto-Critic Agent system that evaluates DeepSeek-generated
 * chapters against a configurable Style Rubric using Gemini Flash, and
 * iteratively refines prose quality until it meets the threshold.
 * 
 * Workflow:
 * 1. DeepSeek generates initial chapter
 * 2. Gemini critiques against style rubric
 * 3. If score < threshold, generate corrections and send back to DeepSeek
 * 4. Repeat until pass or max iterations
 */

import type {
  StyleRubric,
  StyleCriterion,
  CritiqueResult,
  CritiqueIssue,
  CorrectionInstruction,
  CorrectionSet,
  CritiqueCorrectionConfig,
  CritiqueCorrectionResult,
  CritiqueCorrectionCallbacks,
} from '../types/critique';
import { getRubricById, DEFAULT_RUBRICS, calculateWeightedScore } from '../config/styleRubrics';
import { routeJsonTask, routeTextTask } from './modelOrchestrator';
import { logger } from './loggingService';
import { generateUUID } from '../utils/uuid';
import { CRITIQUE_CORRECTION_CONFIG } from '../constants';

/**
 * Critique a chapter against a style rubric using Gemini Flash
 */
export async function critiqueChapter(
  chapterContent: string,
  chapterTitle: string,
  rubric: StyleRubric,
  config: CritiqueCorrectionConfig = CRITIQUE_CORRECTION_CONFIG
): Promise<CritiqueResult> {
  const startTime = Date.now();

  // Build the evaluation prompt for Gemini
  const criteriaPrompts = rubric.criteria.map((criterion, index) => {
    let criterionBlock = `
### Criterion ${index + 1}: ${criterion.name} (Weight: ${criterion.weight}/10)
${criterion.description}

Evaluation Instructions:
${criterion.evaluationPrompt}`;

    if (criterion.examples && criterion.examples.length > 0) {
      criterionBlock += `\n\nExamples:`;
      criterion.examples.forEach(ex => {
        criterionBlock += `\n- GOOD: "${ex.good}"`;
        criterionBlock += `\n- BAD: "${ex.bad}"`;
      });
    }

    return criterionBlock;
  }).join('\n\n');

  const systemPrompt = `You are a professional literary editor and critic specializing in fiction writing quality assessment.
Your task is to evaluate a chapter against specific style criteria and provide detailed, actionable feedback.

Be rigorous but fair. Look for both strengths and weaknesses.
Provide specific examples from the text when identifying issues.
Your goal is to help improve the prose to "published author" quality.`;

  const userPrompt = `# Chapter Critique Request

## Chapter Title: ${chapterTitle}

## Style Rubric: ${rubric.name}
${rubric.description}

## Evaluation Criteria
${criteriaPrompts}

## Chapter Content to Evaluate
<chapter>
${chapterContent}
</chapter>

## Your Task
Evaluate this chapter against ALL criteria listed above. For each criterion:
1. Assign a score from 1-10
2. Identify specific issues with locations in the text
3. Provide actionable suggestions for improvement

Return your evaluation as JSON with this EXACT structure:
{
  "criteriaScores": {
    "${rubric.criteria.map(c => c.id).join('": number,\n    "')}"
  },
  "issues": [
    {
      "criterionId": "criterion_id",
      "criterionName": "Criterion Name",
      "severity": "minor|major|critical",
      "location": {
        "paragraph": 1,
        "excerpt": "the problematic text..."
      },
      "description": "What the issue is",
      "suggestedFix": "Specific suggestion for how to fix"
    }
  ],
  "strengths": ["strength 1", "strength 2"],
  "summary": "Brief overall assessment"
}

Focus on the most impactful issues. Limit to 10 issues maximum, prioritizing by severity.`;

  try {
    const result = await routeJsonTask<{
      criteriaScores: Record<string, number>;
      issues: Array<{
        criterionId: string;
        criterionName: string;
        severity: 'minor' | 'major' | 'critical';
        location?: {
          paragraph?: number;
          sentence?: number;
          excerpt?: string;
        };
        description: string;
        suggestedFix: string;
        betterExample?: string;
      }>;
      strengths: string[];
      summary: string;
    }>('style_critique', {
      system: systemPrompt,
      user: userPrompt,
      temperature: config.critiqueTemperature,
      maxTokens: 4096,
    });

    // Ensure all criteria have scores (default to 5 if missing)
    const criteriaScores: Record<string, number> = {};
    for (const criterion of rubric.criteria) {
      criteriaScores[criterion.id] = result.criteriaScores?.[criterion.id] ?? 5;
    }

    // Calculate weighted overall score
    const overallScore = calculateWeightedScore(rubric, criteriaScores);
    const passesThreshold = overallScore >= rubric.minimumScore;

    // Map issues to proper type
    const issues: CritiqueIssue[] = (result.issues || []).map(issue => ({
      criterionId: issue.criterionId,
      criterionName: issue.criterionName,
      severity: issue.severity,
      location: issue.location ? {
        paragraph: issue.location.paragraph || 1,
        sentence: issue.location.sentence,
        excerpt: issue.location.excerpt,
      } : undefined,
      description: issue.description,
      suggestedFix: issue.suggestedFix,
      betterExample: issue.betterExample,
    }));

    const critiqueResult: CritiqueResult = {
      overallScore: Math.round(overallScore * 10) / 10,
      criteriaScores,
      issues,
      passesThreshold,
      threshold: rubric.minimumScore,
      rubricId: rubric.id,
      summary: result.summary || 'Critique completed.',
      strengths: result.strengths || [],
      critiquedAt: Date.now(),
    };

    logger.info('Chapter critique completed', 'critique', {
      overallScore: critiqueResult.overallScore,
      passesThreshold,
      issueCount: issues.length,
      durationMs: Date.now() - startTime,
    });

    return critiqueResult;
  } catch (error) {
    logger.error('Error during chapter critique', 'critique', error instanceof Error ? error : undefined);
    
    // Return a default result on error to avoid breaking the loop
    return {
      overallScore: 5,
      criteriaScores: Object.fromEntries(rubric.criteria.map(c => [c.id, 5])),
      issues: [],
      passesThreshold: false,
      threshold: rubric.minimumScore,
      rubricId: rubric.id,
      summary: 'Critique failed due to an error. Proceeding with default scores.',
      strengths: [],
      critiquedAt: Date.now(),
    };
  }
}

/**
 * Generate correction instructions based on critique results
 */
export function generateCorrections(
  critique: CritiqueResult,
  rubric: StyleRubric,
  iteration: number,
  chapterId: string,
  config: CritiqueCorrectionConfig = CRITIQUE_CORRECTION_CONFIG
): CorrectionSet {
  // Sort issues by severity and criterion weight
  const sortedIssues = [...critique.issues].sort((a, b) => {
    // Severity order: critical > major > minor
    const severityOrder = { critical: 0, major: 1, minor: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by criterion weight
    if (config.prioritizeHighWeightCriteria) {
      const aWeight = rubric.criteria.find(c => c.id === a.criterionId)?.weight || 5;
      const bWeight = rubric.criteria.find(c => c.id === b.criterionId)?.weight || 5;
      return bWeight - aWeight;
    }

    return 0;
  });

  // Take top N issues
  const topIssues = sortedIssues.slice(0, config.maxIssuesPerCorrection);

  // Convert issues to correction instructions
  const instructions: CorrectionInstruction[] = topIssues.map((issue, index) => {
    // Determine correction type based on issue
    let type: CorrectionInstruction['type'] = 'rewrite';
    const descLower = issue.description.toLowerCase();
    
    if (descLower.includes('delete') || descLower.includes('remove')) {
      type = 'delete';
    } else if (descLower.includes('expand') || descLower.includes('add more')) {
      type = 'expand';
    } else if (descLower.includes('restructure') || descLower.includes('reorder')) {
      type = 'restructure';
    } else if (descLower.includes('tone') || descLower.includes('voice')) {
      type = 'tone_shift';
    }

    return {
      id: generateUUID(),
      priority: index + 1,
      type,
      target: {
        paragraph: issue.location?.paragraph,
        excerpt: issue.location?.excerpt,
        scope: issue.location?.paragraph ? 'paragraph' : 'chapter',
      },
      issue: issue.description,
      instruction: issue.suggestedFix,
      example: issue.betterExample,
      criterionId: issue.criterionId,
    };
  });

  // Build combined prompt for DeepSeek
  const combinedPrompt = buildCorrectionPrompt(instructions, critique, config);

  return {
    id: generateUUID(),
    chapterId,
    iteration,
    critiqueResult: critique,
    instructions,
    combinedPrompt,
    createdAt: Date.now(),
  };
}

/**
 * Build the correction prompt for DeepSeek
 */
function buildCorrectionPrompt(
  instructions: CorrectionInstruction[],
  critique: CritiqueResult,
  config: CritiqueCorrectionConfig
): string {
  const instructionBlocks = instructions.map((inst, index) => {
    let block = `## Correction ${index + 1} (Priority: ${inst.priority}, Type: ${inst.type})
**Issue:** ${inst.issue}

**Instruction:** ${inst.instruction}`;

    if (inst.target.excerpt) {
      block += `\n\n**Target Text:** "${inst.target.excerpt}"`;
    }

    if (inst.target.paragraph) {
      block += `\n\n**Location:** Paragraph ${inst.target.paragraph}`;
    }

    if (inst.example) {
      block += `\n\n**Example of Better Writing:** "${inst.example}"`;
    }

    return block;
  }).join('\n\n---\n\n');

  let prompt = `# Chapter Revision Request

## Overall Assessment
Score: ${critique.overallScore}/10 (Threshold: ${critique.threshold}/10)
${critique.summary}

## Required Corrections
Apply the following corrections to improve the chapter quality:

${instructionBlocks}

## Important Guidelines
- Apply ALL corrections while maintaining narrative flow
- Do NOT lose any plot points or important story elements
- Maintain the chapter's overall length (${config.preserveWordCount ? 'preserve word count within ' + (config.wordCountTolerance * 100) + '%' : 'length can vary'})
- Keep character voices consistent
- Ensure smooth transitions between changed and unchanged sections

## What to Preserve (Strengths)
${critique.strengths.map(s => `- ${s}`).join('\n')}

Return the COMPLETE revised chapter content. Do not summarize or truncate.`;

  return prompt;
}

/**
 * Apply corrections using DeepSeek
 */
async function applyCorrections(
  originalContent: string,
  corrections: CorrectionSet,
  config: CritiqueCorrectionConfig = CRITIQUE_CORRECTION_CONFIG
): Promise<string> {
  const systemPrompt = `You are an expert prose editor. Your task is to revise a chapter based on specific editorial feedback.

Apply the corrections precisely while maintaining:
- Narrative flow and coherence
- Character voices and consistency
- All plot points and story elements
- Appropriate word count

Return ONLY the revised chapter content. No explanations or meta-commentary.`;

  const userPrompt = `${corrections.combinedPrompt}

## Original Chapter Content
<chapter>
${originalContent}
</chapter>

Now provide the COMPLETE revised chapter:`;

  try {
    const revisedContent = await routeTextTask('prose_editing', {
      system: systemPrompt,
      user: userPrompt,
      temperature: config.correctionTemperature,
      maxTokens: 8192,
    });

    // Validate that we got substantial content back
    if (!revisedContent || revisedContent.trim().length < 500) {
      logger.warn('Correction returned insufficient content, using original', 'critique');
      return originalContent;
    }

    // Check word count if preservation is enabled
    if (config.preserveWordCount) {
      const originalWords = originalContent.split(/\s+/).filter(w => w.length > 0).length;
      const revisedWords = revisedContent.split(/\s+/).filter(w => w.length > 0).length;
      const changeRatio = Math.abs(revisedWords - originalWords) / originalWords;

      if (changeRatio > config.wordCountTolerance) {
        logger.warn('Correction changed word count beyond tolerance', 'critique', {
          originalWords,
          revisedWords,
          changeRatio,
          tolerance: config.wordCountTolerance,
        });
      }
    }

    return revisedContent.trim();
  } catch (error) {
    logger.error('Error applying corrections', 'critique', error instanceof Error ? error : undefined);
    return originalContent; // Return original on error
  }
}

/**
 * Main critique-correction loop
 */
export async function applyCritiqueCorrectionLoop(
  initialContent: string,
  chapterTitle: string,
  chapterSummary: string,
  rubricIdOrRubric: string | StyleRubric,
  callbacks?: CritiqueCorrectionCallbacks,
  config: CritiqueCorrectionConfig = CRITIQUE_CORRECTION_CONFIG
): Promise<CritiqueCorrectionResult> {
  const startTime = Date.now();
  
  // Get the rubric
  let rubric: StyleRubric;
  if (typeof rubricIdOrRubric === 'string') {
    const foundRubric = getRubricById(rubricIdOrRubric);
    if (!foundRubric) {
      // Use default literary xianxia rubric
      rubric = DEFAULT_RUBRICS[0];
      logger.warn(`Rubric ${rubricIdOrRubric} not found, using default`, 'critique');
    } else {
      rubric = foundRubric;
    }
  } else {
    rubric = rubricIdOrRubric;
  }

  // Check if critique-correction is enabled
  if (!config.enabled) {
    logger.info('Critique-correction loop is disabled, skipping', 'critique');
    return {
      success: true,
      finalContent: initialContent,
      finalTitle: chapterTitle,
      finalSummary: chapterSummary,
      iterations: 0,
      finalCritique: {
        overallScore: 10,
        criteriaScores: {},
        issues: [],
        passesThreshold: true,
        threshold: rubric.minimumScore,
        rubricId: rubric.id,
        summary: 'Critique-correction loop disabled.',
        strengths: [],
        critiquedAt: Date.now(),
      },
      history: [],
      totalTimeMs: 0,
      estimatedCost: 0,
    };
  }

  const history: CritiqueCorrectionResult['history'] = [];
  let currentContent = initialContent;
  let iteration = 0;
  let finalCritique: CritiqueResult | null = null;
  let estimatedCost = 0;

  const maxIterations = Math.min(rubric.maxIterations, config.maxIterations);

  logger.info('Starting critique-correction loop', 'critique', {
    rubricId: rubric.id,
    rubricName: rubric.name,
    minimumScore: rubric.minimumScore,
    maxIterations,
  });

  callbacks?.onPhase?.('critique_start', { rubricId: rubric.id, rubricName: rubric.name });

  while (iteration < maxIterations) {
    iteration++;

    // Step 1: Critique the current content
    callbacks?.onPhase?.('critique_evaluation', { iteration });
    callbacks?.onProgress?.(`Evaluating chapter (iteration ${iteration})...`, (iteration - 1) / maxIterations * 100);

    const critique = await critiqueChapter(currentContent, chapterTitle, rubric, config);
    finalCritique = critique;

    // Estimate cost: ~$0.001 per critique (Gemini Flash)
    estimatedCost += 0.001;

    callbacks?.onCritiqueResult?.(critique, iteration);

    if (config.verboseLogging) {
      logger.debug('Critique result', 'critique', {
        iteration,
        overallScore: critique.overallScore,
        issueCount: critique.issues.length,
        passesThreshold: critique.passesThreshold,
      });
    }

    // Check if we pass the threshold
    if (critique.passesThreshold) {
      logger.info('Chapter passed quality threshold', 'critique', {
        iteration,
        finalScore: critique.overallScore,
        threshold: rubric.minimumScore,
      });

      history.push({
        iteration,
        critique,
        contentAfter: currentContent,
      });

      callbacks?.onPhase?.('critique_complete', {
        passed: true,
        finalScore: critique.overallScore,
        iterations: iteration,
      });

      break;
    }

    // Step 2: Generate corrections
    callbacks?.onPhase?.('correction_start', { iteration, issueCount: critique.issues.length });

    const corrections = generateCorrections(critique, rubric, iteration, generateUUID(), config);

    // Step 3: Apply corrections
    callbacks?.onPhase?.('correction_application', { iteration, instructionCount: corrections.instructions.length });
    callbacks?.onProgress?.(`Applying corrections (iteration ${iteration})...`, (iteration - 0.5) / maxIterations * 100);

    const previousContent = currentContent;
    currentContent = await applyCorrections(currentContent, corrections, config);

    // Estimate cost: ~$0.001 per correction (DeepSeek)
    estimatedCost += 0.001;

    callbacks?.onCorrectionApplied?.(corrections, currentContent);

    history.push({
      iteration,
      critique,
      corrections,
      contentAfter: currentContent,
    });

    callbacks?.onPhase?.('correction_complete', { iteration });

    // Log progress
    logger.info('Completed correction iteration', 'critique', {
      iteration,
      scoreBefore: critique.overallScore,
      issuesAddressed: corrections.instructions.length,
    });
  }

  // Final result
  const totalTimeMs = Date.now() - startTime;
  const success = finalCritique?.passesThreshold || iteration >= maxIterations;

  const result: CritiqueCorrectionResult = {
    success,
    finalContent: currentContent,
    finalTitle: chapterTitle,
    finalSummary: chapterSummary, // Summary unchanged in critique loop
    iterations: iteration,
    finalCritique: finalCritique!,
    history,
    totalTimeMs,
    estimatedCost,
  };

  callbacks?.onPhase?.('loop_complete', {
    success,
    iterations: iteration,
    finalScore: finalCritique?.overallScore,
    totalTimeMs,
    estimatedCost,
  });

  logger.info('Critique-correction loop completed', 'critique', {
    success,
    iterations: iteration,
    finalScore: finalCritique?.overallScore,
    totalTimeMs,
    estimatedCost: `$${estimatedCost.toFixed(4)}`,
  });

  return result;
}

/**
 * Quick critique without correction loop (for preview/analysis)
 */
export async function quickCritique(
  chapterContent: string,
  chapterTitle: string,
  rubricId: string = 'literary_xianxia'
): Promise<CritiqueResult> {
  const rubric = getRubricById(rubricId) || DEFAULT_RUBRICS[0];
  return critiqueChapter(chapterContent, chapterTitle, rubric);
}

/**
 * Get available rubrics for UI display
 */
export function getAvailableRubrics(): StyleRubric[] {
  return DEFAULT_RUBRICS.filter(r => r.enabled);
}
