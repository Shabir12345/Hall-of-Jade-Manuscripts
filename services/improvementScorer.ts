/**
 * Improvement Scorer
 * Uses LLM to validate and score improvements made to the novel.
 * Provides semantic comparison between before/after states.
 * 
 * Uses Gemini Flash ("The Clerk") for analysis tasks.
 */

import { NovelState, Chapter } from '../types';
import { ImprovementCategory } from '../types/improvement';
import { geminiText } from './geminiService';

// Helper function to call Gemini (The Clerk) with validation options
async function callClerk(
  prompt: string, 
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  return geminiText({
    system: 'You are an expert literary analyst. Analyze the given content and respond with JSON.',
    user: prompt,
    maxTokens: options.maxTokens || 2000,
    temperature: options.temperature || 0.3,
  });
}

export interface ImprovementValidation {
  overallScore: number; // 0-100
  scoreChange: number; // Change from before
  categoryScores: {
    [key: string]: {
      before: number;
      after: number;
      change: number;
    };
  };
  qualityAssessment: {
    strengthsAdded: string[];
    weaknessesFixed: string[];
    remainingIssues: string[];
    unexpectedChanges: string[];
  };
  confidence: 'high' | 'medium' | 'low';
  summary: string;
  recommendations: string[];
}

export interface ChapterChangeAnalysis {
  chapterId: string;
  chapterNumber: number;
  changeType: 'improved' | 'neutral' | 'degraded';
  changeScore: number; // -100 to +100
  specificChanges: {
    type: string;
    description: string;
    impact: 'positive' | 'neutral' | 'negative';
  }[];
  explanation: string;
}

/**
 * Validates improvements using LLM analysis
 * Compares before/after states semantically
 */
export async function validateImprovementsWithLLM(
  originalState: NovelState,
  improvedState: NovelState,
  category: ImprovementCategory,
  onProgress?: (message: string, progress: number) => void
): Promise<ImprovementValidation> {
  onProgress?.('Preparing validation analysis...', 10);
  
  try {
    // Get chapters that changed
    const changedChapters = findChangedChapters(originalState, improvedState);
    
    if (changedChapters.length === 0) {
      return {
        overallScore: 50,
        scoreChange: 0,
        categoryScores: {},
        qualityAssessment: {
          strengthsAdded: [],
          weaknessesFixed: [],
          remainingIssues: ['No actual changes detected'],
          unexpectedChanges: [],
        },
        confidence: 'high',
        summary: 'No changes were detected between the original and improved versions.',
        recommendations: ['Verify that improvements were applied correctly'],
      };
    }
    
    onProgress?.('Analyzing changed chapters...', 30);
    
    // Analyze a sample of changed chapters (limit to 3 for token efficiency)
    const sampleSize = Math.min(3, changedChapters.length);
    const sampleChapters = changedChapters.slice(0, sampleSize);
    
    // Build comparison prompt
    const comparisonPrompt = buildComparisonPrompt(
      originalState,
      improvedState,
      sampleChapters,
      category
    );
    
    onProgress?.('Requesting LLM validation...', 50);
    
    // Call LLM for validation (using The Clerk - Gemini)
    const response = await callClerk(comparisonPrompt, {
      maxTokens: 2000,
      temperature: 0.3, // Lower temperature for consistent analysis
    });
    
    onProgress?.('Parsing validation results...', 80);
    
    // Parse the response
    const validation = parseValidationResponse(response, changedChapters.length);
    
    onProgress?.('Validation complete', 100);
    
    return validation;
  } catch (error) {
    console.error('LLM validation failed:', error);
    
    // Return fallback validation based on basic metrics
    return createFallbackValidation(originalState, improvedState, category);
  }
}

/**
 * Analyzes individual chapter changes
 */
export async function analyzeChapterChanges(
  originalChapter: Chapter,
  improvedChapter: Chapter,
  category: ImprovementCategory
): Promise<ChapterChangeAnalysis> {
  // Quick check: no change
  if (originalChapter.content === improvedChapter.content) {
    return {
      chapterId: originalChapter.id,
      chapterNumber: originalChapter.number,
      changeType: 'neutral',
      changeScore: 0,
      specificChanges: [],
      explanation: 'No changes detected in this chapter.',
    };
  }
  
  // Calculate word count changes
  const originalWords = originalChapter.content.split(/\s+/).length;
  const improvedWords = improvedChapter.content.split(/\s+/).length;
  const wordChange = improvedWords - originalWords;
  const wordChangePercent = ((wordChange / Math.max(1, originalWords)) * 100).toFixed(1);
  
  // Detect specific changes using simple heuristics
  const specificChanges: ChapterChangeAnalysis['specificChanges'] = [];
  
  // Word count change
  if (Math.abs(wordChange) > 50) {
    specificChanges.push({
      type: 'word_count',
      description: `Word count ${wordChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(wordChange)} words (${wordChangePercent}%)`,
      impact: wordChange > 0 ? 'positive' : 'neutral',
    });
  }
  
  // Check for structural improvements
  const structurePatterns = detectStructurePatterns(originalChapter.content, improvedChapter.content);
  specificChanges.push(...structurePatterns);
  
  // Determine overall change type
  const positiveChanges = specificChanges.filter(c => c.impact === 'positive').length;
  const negativeChanges = specificChanges.filter(c => c.impact === 'negative').length;
  
  let changeType: ChapterChangeAnalysis['changeType'] = 'neutral';
  let changeScore = 0;
  
  if (positiveChanges > negativeChanges) {
    changeType = 'improved';
    changeScore = Math.min(100, (positiveChanges - negativeChanges) * 15);
  } else if (negativeChanges > positiveChanges) {
    changeType = 'degraded';
    changeScore = Math.max(-100, (positiveChanges - negativeChanges) * 15);
  }
  
  return {
    chapterId: originalChapter.id,
    chapterNumber: originalChapter.number,
    changeType,
    changeScore,
    specificChanges,
    explanation: generateChangeExplanation(specificChanges, category),
  };
}

/**
 * Finds chapters that have changed between states
 */
function findChangedChapters(
  originalState: NovelState,
  improvedState: NovelState
): Array<{ original: Chapter; improved: Chapter }> {
  const changedChapters: Array<{ original: Chapter; improved: Chapter }> = [];
  
  improvedState.chapters.forEach(improvedChapter => {
    const originalChapter = originalState.chapters.find(ch => ch.id === improvedChapter.id);
    
    if (originalChapter && originalChapter.content !== improvedChapter.content) {
      changedChapters.push({
        original: originalChapter,
        improved: improvedChapter,
      });
    }
  });
  
  return changedChapters;
}

/**
 * Builds comparison prompt for LLM validation
 */
function buildComparisonPrompt(
  originalState: NovelState,
  improvedState: NovelState,
  sampleChapters: Array<{ original: Chapter; improved: Chapter }>,
  category: ImprovementCategory
): string {
  const categoryDescriptions: Record<ImprovementCategory, string> = {
    structure: 'story structure, pacing, act proportions, and narrative beats',
    engagement: 'reader engagement, hooks, page-turner elements, and intrigue',
    tension: 'tension arcs, conflict, stakes, and dramatic moments',
    theme: 'thematic development, symbolism, and meaning',
    character: 'character psychology, development, and authenticity',
    literary_devices: 'literary devices, metaphors, and prose craft',
    excellence: 'overall writing quality, prose, and polish',
    prose: 'prose quality, sentence variety, and vocabulary',
    originality: 'originality, uniqueness, and avoiding clichés',
    voice: 'narrative voice and author style',
    market_readiness: 'market readiness and commercial appeal',
  };
  
  const categoryFocus = categoryDescriptions[category] || 'overall quality';
  
  let prompt = `You are a professional literary editor analyzing improvements made to a novel.

TASK: Evaluate whether the changes improved the novel's ${categoryFocus}.

NOVEL: "${improvedState.title}"

CHANGED CHAPTERS (${sampleChapters.length} of ${improvedState.chapters.length} total):
`;

  sampleChapters.forEach(({ original, improved }, idx) => {
    // Truncate content for token efficiency
    const maxChars = 1500;
    const originalExcerpt = original.content.substring(0, maxChars) + (original.content.length > maxChars ? '...' : '');
    const improvedExcerpt = improved.content.substring(0, maxChars) + (improved.content.length > maxChars ? '...' : '');
    
    prompt += `
--- CHAPTER ${original.number}: "${original.title || 'Untitled'}" ---

BEFORE:
${originalExcerpt}

AFTER:
${improvedExcerpt}

`;
  });

  prompt += `
ANALYZE THE CHANGES AND RESPOND IN THIS EXACT JSON FORMAT:
{
  "overallScore": <number 0-100, where 50 is no change, >50 is improvement>,
  "scoreChange": <number -50 to +50, the change in quality>,
  "strengthsAdded": ["<list of improvements made>"],
  "weaknessesFixed": ["<list of issues that were resolved>"],
  "remainingIssues": ["<list of issues still present>"],
  "confidence": "<high|medium|low>",
  "summary": "<2-3 sentence summary of the changes>",
  "recommendations": ["<next steps for further improvement>"]
}

IMPORTANT:
- Focus specifically on ${categoryFocus}
- Be objective and specific
- Score of 50 means no improvement, 60+ means moderate improvement, 75+ means significant improvement
- Only output valid JSON, nothing else`;

  return prompt;
}

/**
 * Parses LLM validation response
 */
function parseValidationResponse(
  response: string,
  totalChangedChapters: number
): ImprovementValidation {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      overallScore: Math.max(0, Math.min(100, parsed.overallScore || 50)),
      scoreChange: Math.max(-50, Math.min(50, parsed.scoreChange || 0)),
      categoryScores: {},
      qualityAssessment: {
        strengthsAdded: parsed.strengthsAdded || [],
        weaknessesFixed: parsed.weaknessesFixed || [],
        remainingIssues: parsed.remainingIssues || [],
        unexpectedChanges: parsed.unexpectedChanges || [],
      },
      confidence: parsed.confidence || 'medium',
      summary: parsed.summary || 'Analysis complete.',
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error('Failed to parse validation response:', error);
    
    // Return neutral validation
    return {
      overallScore: 50,
      scoreChange: 0,
      categoryScores: {},
      qualityAssessment: {
        strengthsAdded: [],
        weaknessesFixed: [],
        remainingIssues: ['Unable to parse LLM response'],
        unexpectedChanges: [],
      },
      confidence: 'low',
      summary: 'Validation analysis could not be completed.',
      recommendations: ['Review changes manually'],
    };
  }
}

/**
 * Creates fallback validation without LLM
 */
function createFallbackValidation(
  originalState: NovelState,
  improvedState: NovelState,
  category: ImprovementCategory
): ImprovementValidation {
  const changedChapters = findChangedChapters(originalState, improvedState);
  
  // Calculate basic metrics
  let totalWordChange = 0;
  changedChapters.forEach(({ original, improved }) => {
    const originalWords = original.content.split(/\s+/).length;
    const improvedWords = improved.content.split(/\s+/).length;
    totalWordChange += improvedWords - originalWords;
  });
  
  // Estimate score based on word count changes (simple heuristic)
  const avgWordChange = changedChapters.length > 0 ? totalWordChange / changedChapters.length : 0;
  let scoreChange = 0;
  
  if (avgWordChange > 100) {
    scoreChange = Math.min(15, Math.floor(avgWordChange / 50));
  } else if (avgWordChange < -100) {
    scoreChange = Math.max(-10, Math.floor(avgWordChange / 75));
  }
  
  return {
    overallScore: 50 + scoreChange,
    scoreChange,
    categoryScores: {},
    qualityAssessment: {
      strengthsAdded: totalWordChange > 0 ? ['Added content to chapters'] : [],
      weaknessesFixed: [],
      remainingIssues: ['LLM validation unavailable - using basic metrics'],
      unexpectedChanges: [],
    },
    confidence: 'low',
    summary: `${changedChapters.length} chapters modified. ${totalWordChange > 0 ? 'Content expanded' : totalWordChange < 0 ? 'Content condensed' : 'Minor edits made'}.`,
    recommendations: ['Run full LLM validation for detailed analysis'],
  };
}

/**
 * Detects structural patterns in content changes
 */
function detectStructurePatterns(
  original: string,
  improved: string
): ChapterChangeAnalysis['specificChanges'] {
  const changes: ChapterChangeAnalysis['specificChanges'] = [];
  
  // Check for dialogue improvements
  const originalDialogue = (original.match(/"/g) || []).length;
  const improvedDialogue = (improved.match(/"/g) || []).length;
  
  if (improvedDialogue > originalDialogue * 1.2) {
    changes.push({
      type: 'dialogue',
      description: 'Increased dialogue presence',
      impact: 'positive',
    });
  }
  
  // Check for paragraph variety
  const originalParagraphs = original.split(/\n\n+/).length;
  const improvedParagraphs = improved.split(/\n\n+/).length;
  
  if (improvedParagraphs > originalParagraphs * 1.2) {
    changes.push({
      type: 'paragraphs',
      description: 'More paragraph breaks for better pacing',
      impact: 'positive',
    });
  }
  
  // Check for sentence variety
  const originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const improvedSentences = improved.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const originalAvgLength = originalSentences.reduce((sum, s) => sum + s.length, 0) / Math.max(1, originalSentences.length);
  const improvedAvgLength = improvedSentences.reduce((sum, s) => sum + s.length, 0) / Math.max(1, improvedSentences.length);
  
  // Check for variance in sentence length
  const originalVariance = calculateVariance(originalSentences.map(s => s.length));
  const improvedVariance = calculateVariance(improvedSentences.map(s => s.length));
  
  if (improvedVariance > originalVariance * 1.3) {
    changes.push({
      type: 'sentence_variety',
      description: 'Improved sentence length variety',
      impact: 'positive',
    });
  }
  
  return changes;
}

/**
 * Calculates variance of an array
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
}

/**
 * Generates explanation for changes
 */
function generateChangeExplanation(
  changes: ChapterChangeAnalysis['specificChanges'],
  category: ImprovementCategory
): string {
  if (changes.length === 0) {
    return 'Minor text adjustments made.';
  }
  
  const positiveChanges = changes.filter(c => c.impact === 'positive');
  const negativeChanges = changes.filter(c => c.impact === 'negative');
  
  let explanation = '';
  
  if (positiveChanges.length > 0) {
    explanation += `Improvements: ${positiveChanges.map(c => c.description).join(', ')}. `;
  }
  
  if (negativeChanges.length > 0) {
    explanation += `Concerns: ${negativeChanges.map(c => c.description).join(', ')}.`;
  }
  
  return explanation.trim() || 'Changes made to improve ' + category;
}

/**
 * Quick validation without LLM (for progress feedback)
 */
export function quickValidateChanges(
  originalState: NovelState,
  improvedState: NovelState
): { chaptersChanged: number; totalWordChange: number; estimatedImprovement: number } {
  const changedChapters = findChangedChapters(originalState, improvedState);
  
  let totalWordChange = 0;
  changedChapters.forEach(({ original, improved }) => {
    const originalWords = original.content.split(/\s+/).length;
    const improvedWords = improved.content.split(/\s+/).length;
    totalWordChange += improvedWords - originalWords;
  });
  
  // Estimate improvement based on changes
  let estimatedImprovement = 0;
  if (changedChapters.length > 0) {
    // Base improvement for making changes
    estimatedImprovement = Math.min(10, changedChapters.length * 2);
    
    // Bonus for adding content
    if (totalWordChange > 500) {
      estimatedImprovement += Math.min(10, Math.floor(totalWordChange / 200));
    }
  }
  
  return {
    chaptersChanged: changedChapters.length,
    totalWordChange,
    estimatedImprovement,
  };
}
