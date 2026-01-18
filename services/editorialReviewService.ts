import { Chapter, Arc, NovelState, ChapterQualityMetrics } from '../types';
import { validateChapterQuality } from './chapterQualityValidator';
import { EditorialSignal, EditorialReview, ArcEditorialReview, EditorialReviewOptions, EditorialSignalCategory, EditorialSignalSeverity, TextRange } from '../types/editor';
import { generateUUID } from '../utils/uuid';
import { extractAuthorialVoiceProfile } from './promptEngine/styleAnalyzer';
import { analyzeNarrativeCraft } from './narrativeCraftAnalyzer';
import { analyzeChapterOriginality } from './originalityDetector';

/**
 * Editorial Review Service
 * Converts quality metrics into editorial feedback for the editing system
 * Acts as a second line of defense, catching issues that passed generation checks
 */

// Cache for editorial reviews
const reviewCache = new Map<string, {
  timestamp: number;
  review: EditorialReview;
}>();
const REVIEW_CACHE_TTL = 300000; // 5 minutes

/**
 * Review a chapter and convert quality metrics to editorial feedback
 */
export async function reviewChapter(
  chapter: Chapter,
  novelState: NovelState,
  options?: EditorialReviewOptions
): Promise<EditorialReview> {
  options?.onProgress?.('Running quality checks...', 10);

  // Check cache if enabled
  if (options?.includeCache !== false) {
    const cacheKey = `${chapter.id}:${chapter.content.length}`;
    const cached = reviewCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < REVIEW_CACHE_TTL) {
      return cached.review;
    }
  }

  // Get quality metrics
  const metrics = await validateChapterQuality(chapter, novelState);
  
  options?.onProgress?.('Converting metrics to editorial feedback...', 50);

  // Convert metrics to editorial signals
  const signals = convertQualityMetricsToEditorialFeedback(metrics, chapter, novelState);

  // Calculate overall score (weighted average)
  const overallScore = calculateOverallScore(signals);

  // Generate summary and recommendations
  const { summary, strengths, recommendations } = generateReviewSummary(signals, metrics);

  const review: EditorialReview = {
    chapterId: chapter.id,
    signals,
    overallScore,
    summary,
    strengths,
    recommendations,
    reviewedAt: Date.now(),
    reviewedBy: 'system',
  };

  // Cache the result
  if (options?.includeCache !== false) {
    const cacheKey = `${chapter.id}:${chapter.content.length}`;
    reviewCache.set(cacheKey, {
      timestamp: Date.now(),
      review,
    });
  }

  options?.onProgress?.('Review complete', 100);

  return review;
}

/**
 * Review an entire arc with cross-chapter analysis
 */
export async function reviewArc(
  arc: Arc,
  chapters: Chapter[],
  novelState: NovelState,
  options?: EditorialReviewOptions
): Promise<ArcEditorialReview> {
  options?.onProgress?.('Analyzing arc chapters...', 10);

  // Get chapters in this arc
  const arcChapters = chapters.filter(ch => {
    if (!arc.startedAtChapter || !arc.endedAtChapter) return false;
    return ch.number >= arc.startedAtChapter && ch.number <= arc.endedAtChapter;
  }).sort((a, b) => a.number - b.number);

  if (arcChapters.length === 0) {
    throw new Error('No chapters found in this arc');
  }

  // Review each chapter
  const chapterReviews = new Map<string, EditorialReview>();
  let totalProgress = 10;
  const progressPerChapter = 60 / arcChapters.length;

  for (const chapter of arcChapters) {
    options?.onProgress?.(`Reviewing chapter ${chapter.number}...`, totalProgress);
    const review = await reviewChapter(chapter, novelState, options);
    chapterReviews.set(chapter.id, review);
    totalProgress += progressPerChapter;
  }

  options?.onProgress?.('Analyzing cross-chapter issues...', 70);

  // Run cross-chapter analysis
  const crossChapterIssues = analyzeCrossChapterIssues(arcChapters, chapterReviews, novelState);
  const arcLevelMetrics = calculateArcLevelMetrics(arcChapters, chapterReviews, novelState);

  // Aggregate signals from all chapters
  const allSignals: EditorialSignal[] = [];
  chapterReviews.forEach(review => {
    allSignals.push(...review.signals);
  });
  allSignals.push(...crossChapterIssues);

  // Calculate overall score
  const overallScore = calculateOverallScore(allSignals);

  // Generate summary
  const { summary, strengths, recommendations } = generateArcReviewSummary(
    chapterReviews,
    crossChapterIssues,
    arcLevelMetrics
  );

  const arcReview: ArcEditorialReview = {
    arcId: arc.id,
    chapterId: undefined,
    signals: allSignals,
    overallScore,
    summary,
    strengths,
    recommendations,
    reviewedAt: Date.now(),
    reviewedBy: 'system',
    chapterReviews,
    crossChapterIssues,
    arcLevelMetrics,
  };

  options?.onProgress?.('Arc review complete', 100);

  return arcReview;
}

/**
 * Convert quality metrics to editorial feedback signals
 */
function convertQualityMetricsToEditorialFeedback(
  metrics: ChapterQualityMetrics,
  chapter: Chapter,
  novelState: NovelState
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  // Narrative Authenticity signals
  signals.push(...convertNarrativeCraftToSignals(metrics.narrativeCraftScore, chapter));
  
  // Originality & Craft signals
  signals.push(...convertOriginalityToSignals(metrics.originalityScore, chapter));
  
  // Voice Consistency signals
  signals.push(...convertVoiceConsistencyToSignals(metrics.voiceConsistencyScore, metrics, chapter));
  
  // Structural Balance & Emotional Credibility signals
  signals.push(...convertEditorialQualityToSignals(metrics.editorialScore, chapter));

  // Convert warnings to signals
  metrics.warnings.forEach((warning, index) => {
    signals.push({
      id: `warning-${index}`,
      category: determineCategoryFromWarning(warning),
      severity: 'concern',
      title: 'Quality Warning',
      description: warning,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  return signals;
}

/**
 * Convert narrative craft metrics to signals
 */
function convertNarrativeCraftToSignals(
  craftScore: any,
  chapter: Chapter
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  // Burstiness (sentence variation)
  if (craftScore.burstinessScore < 60) {
    signals.push({
      id: `burstiness-${chapter.id}`,
      category: 'narrative_authenticity',
      severity: craftScore.burstinessScore < 40 ? 'issue' : 'concern',
      title: 'Sentence Length Variation',
      description: `Burstiness score is ${craftScore.burstinessScore}/100. Sentence lengths may be too uniform, creating an AI-like pattern.`,
      suggestion: 'Vary sentence lengths more dramatically. Mix very short sentences (3-5 words) with longer, complex sentences (25-30+ words).',
      score: craftScore.burstinessScore,
      threshold: 60,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Perplexity (vocabulary unpredictability)
  if (craftScore.perplexityScore < 60) {
    signals.push({
      id: `perplexity-${chapter.id}`,
      category: 'narrative_authenticity',
      severity: craftScore.perplexityScore < 40 ? 'issue' : 'concern',
      title: 'Vocabulary Predictability',
      description: `Perplexity score is ${craftScore.perplexityScore}/100. Vocabulary may be too predictable or repetitive.`,
      suggestion: 'Use synonyms instead of repeating the same words. Occasionally choose slightly less common words where they fit naturally.',
      score: craftScore.perplexityScore,
      threshold: 60,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Subtext
  if (craftScore.subtextScore < 50) {
    signals.push({
      id: `subtext-${chapter.id}`,
      category: 'dialogue_naturalness',
      severity: craftScore.subtextScore < 30 ? 'issue' : 'suggestion',
      title: 'Subtext in Dialogue',
      description: `Subtext score is ${craftScore.subtextScore}/100. Dialogue may be too direct, lacking hidden meaning.`,
      suggestion: 'Add subtext to dialogue - what characters say vs. what they mean. Use ambiguity, questions, and indirect statements.',
      score: craftScore.subtextScore,
      threshold: 50,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Interiority
  if (craftScore.interiorityScore < 50) {
    signals.push({
      id: `interiority-${chapter.id}`,
      category: 'emotional_credibility',
      severity: craftScore.interiorityScore < 30 ? 'issue' : 'suggestion',
      title: 'Character Interiority',
      description: `Interiority score is ${craftScore.interiorityScore}/100. Insufficient character thoughts and internal experience.`,
      suggestion: 'Increase character interiority - show what characters are thinking, feeling, and experiencing internally. Target 40%+ paragraphs with interiority.',
      score: craftScore.interiorityScore,
      threshold: 50,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Scene Intent
  if (craftScore.sceneIntentScore < 60) {
    signals.push({
      id: `scene-intent-${chapter.id}`,
      category: 'structural_balance',
      severity: craftScore.sceneIntentScore < 40 ? 'issue' : 'concern',
      title: 'Scene Purpose Clarity',
      description: `Scene intent score is ${craftScore.sceneIntentScore}/100. Scene purpose or value shift may be unclear.`,
      suggestion: 'Ensure each scene has a clear purpose and value shift. Characters should end the scene in a different emotional or tactical state.',
      score: craftScore.sceneIntentScore,
      threshold: 60,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Dialogue Naturalness
  if (craftScore.dialogueNaturalnessScore < 50) {
    signals.push({
      id: `dialogue-naturalness-${chapter.id}`,
      category: 'dialogue_naturalness',
      severity: craftScore.dialogueNaturalnessScore < 30 ? 'issue' : 'suggestion',
      title: 'Dialogue Naturalness',
      description: `Dialogue naturalness score is ${craftScore.dialogueNaturalnessScore}/100. Dialogue may be too formal or lack natural patterns.`,
      suggestion: 'Add interruptions, ambiguity, and subtext to dialogue. Include natural speech patterns like incomplete thoughts and questions.',
      score: craftScore.dialogueNaturalnessScore,
      threshold: 50,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Repetitive patterns
  craftScore.repetitivePatterns?.forEach((pattern: string, index: number) => {
    signals.push({
      id: `repetitive-${chapter.id}-${index}`,
      category: 'narrative_authenticity',
      severity: 'concern',
      title: 'Repetitive Pattern',
      description: pattern,
      suggestion: 'Vary sentence beginnings and phrases to avoid repetition.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  // Overexplanation flags
  craftScore.overexplanationFlags?.forEach((flag: string, index: number) => {
    signals.push({
      id: `overexplanation-${chapter.id}-${index}`,
      category: 'narrative_authenticity',
      severity: 'suggestion',
      title: 'Overexplanation',
      description: flag,
      suggestion: 'Consider showing rather than explaining. Trust readers to infer meaning.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  // Neutral prose flags
  craftScore.neutralProseFlags?.forEach((flag: string, index: number) => {
    signals.push({
      id: `neutral-prose-${chapter.id}-${index}`,
      category: 'narrative_authenticity',
      severity: 'suggestion',
      title: 'Neutral Prose',
      description: flag,
      suggestion: 'Add more emotional language and specific details. Avoid encyclopedic or neutral constructions.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  return signals;
}

/**
 * Convert originality metrics to signals
 */
function convertOriginalityToSignals(
  originalityScore: any,
  chapter: Chapter
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  // Overall originality
  if (originalityScore.overallOriginality < 60) {
    signals.push({
      id: `originality-${chapter.id}`,
      category: 'originality_craft',
      severity: originalityScore.overallOriginality < 40 ? 'issue' : 'concern',
      title: 'Overall Originality',
      description: `Originality score is ${originalityScore.overallOriginality}/100. Content may be too generic or derivative.`,
      suggestion: 'Increase creative distance from common patterns. Add unique metaphors, imagery, and scene constructions.',
      score: originalityScore.overallOriginality,
      threshold: 60,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Generic patterns
  originalityScore.genericPatternsDetected?.forEach((pattern: string, index: number) => {
    signals.push({
      id: `generic-pattern-${chapter.id}-${index}`,
      category: 'originality_craft',
      severity: 'concern',
      title: 'Generic Pattern Detected',
      description: pattern,
      suggestion: 'Consider subverting or refreshing this pattern to increase originality.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  // Mechanical structures
  originalityScore.mechanicalStructuresDetected?.forEach((structure: string, index: number) => {
    signals.push({
      id: `mechanical-structure-${chapter.id}-${index}`,
      category: 'originality_craft',
      severity: 'concern',
      title: 'Mechanical Structure',
      description: structure,
      suggestion: 'Vary structure to avoid formulaic patterns. Add natural variation and unpredictability.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  // Derivative content
  originalityScore.derivativeContentFlags?.forEach((flag: string, index: number) => {
    signals.push({
      id: `derivative-${chapter.id}-${index}`,
      category: 'originality_craft',
      severity: 'concern',
      title: 'Derivative Content',
      description: flag,
      suggestion: 'Add unique elements to distinguish this from similar works.',
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  });

  return signals;
}

/**
 * Convert voice consistency metrics to signals
 */
function convertVoiceConsistencyToSignals(
  voiceScore: number,
  metrics: ChapterQualityMetrics,
  chapter: Chapter
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  if (voiceScore < 70) {
    signals.push({
      id: `voice-consistency-${chapter.id}`,
      category: 'voice_consistency',
      severity: voiceScore < 50 ? 'issue' : 'concern',
      title: 'Voice Consistency',
      description: `Voice consistency score is ${voiceScore}/100. Chapter may not match established authorial voice.`,
      suggestion: 'Review previous chapters to match sentence complexity, tone, and stylistic patterns. Preserve authorial voice characteristics.',
      score: voiceScore,
      threshold: 70,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  return signals;
}

/**
 * Convert editorial quality metrics to signals
 */
function convertEditorialQualityToSignals(
  editorialScore: any,
  chapter: Chapter
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  // Readability
  if (editorialScore.readability < 75) {
    signals.push({
      id: `readability-${chapter.id}`,
      category: 'structural_balance',
      severity: editorialScore.readability < 60 ? 'concern' : 'suggestion',
      title: 'Readability',
      description: `Readability score is ${editorialScore.readability}/100. Sentence structure may be too complex or too simple.`,
      suggestion: 'Aim for 15-20 words per sentence on average. Mix simple and complex sentences for natural rhythm.',
      score: editorialScore.readability,
      threshold: 75,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Flow
  if (editorialScore.flow < 80) {
    signals.push({
      id: `flow-${chapter.id}`,
      category: 'structural_balance',
      severity: editorialScore.flow < 60 ? 'concern' : 'suggestion',
      title: 'Narrative Flow',
      description: `Flow score is ${editorialScore.flow}/100. Transitions between paragraphs or scenes may need improvement.`,
      suggestion: 'Add transition words and ensure smooth flow between paragraphs. Check for abrupt jumps or missing connections.',
      score: editorialScore.flow,
      threshold: 80,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Emotional Authenticity
  if (editorialScore.emotionalAuthenticity < 50) {
    signals.push({
      id: `emotional-authenticity-${chapter.id}`,
      category: 'emotional_credibility',
      severity: editorialScore.emotionalAuthenticity < 30 ? 'issue' : 'suggestion',
      title: 'Emotional Authenticity',
      description: `Emotional authenticity score is ${editorialScore.emotionalAuthenticity}/100. Emotional language may be insufficient.`,
      suggestion: 'Increase emotional language density. Show character emotions through specific details and authentic reactions.',
      score: editorialScore.emotionalAuthenticity,
      threshold: 50,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Narrative Coherence
  if (editorialScore.narrativeCoherence < 75) {
    signals.push({
      id: `coherence-${chapter.id}`,
      category: 'structural_balance',
      severity: editorialScore.narrativeCoherence < 60 ? 'concern' : 'suggestion',
      title: 'Narrative Coherence',
      description: `Narrative coherence score is ${editorialScore.narrativeCoherence}/100. Story logic or continuity may need attention.`,
      suggestion: 'Review story logic, character consistency, and world-building continuity. Ensure events follow logically.',
      score: editorialScore.narrativeCoherence,
      threshold: 75,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  // Structural Balance
  if (editorialScore.structuralBalance < 75) {
    signals.push({
      id: `structural-balance-${chapter.id}`,
      category: 'structural_balance',
      severity: editorialScore.structuralBalance < 60 ? 'concern' : 'suggestion',
      title: 'Structural Balance',
      description: `Structural balance score is ${editorialScore.structuralBalance}/100. Chapter structure may be unbalanced.`,
      suggestion: 'Review paragraph lengths, scene pacing, and overall chapter structure. Ensure balanced rhythm.',
      score: editorialScore.structuralBalance,
      threshold: 75,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
  }

  return signals;
}

/**
 * Analyze cross-chapter issues for arc review
 */
function analyzeCrossChapterIssues(
  chapters: Chapter[],
  chapterReviews: Map<string, EditorialReview>,
  novelState: NovelState
): EditorialSignal[] {
  const signals: EditorialSignal[] = [];

  // Voice drift detection
  const voiceScores: number[] = [];
  chapterReviews.forEach(review => {
    const voiceSignal = review.signals.find(s => s.category === 'voice_consistency');
    if (voiceSignal?.score !== undefined) {
      voiceScores.push(voiceSignal.score);
    }
  });

  if (voiceScores.length > 1) {
    const avgVoice = voiceScores.reduce((a, b) => a + b, 0) / voiceScores.length;
    const variance = voiceScores.reduce((sum, score) => sum + Math.pow(score - avgVoice, 2), 0) / voiceScores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 15) {
      signals.push({
        id: `voice-drift-arc`,
        category: 'voice_consistency',
        severity: 'concern',
        title: 'Voice Drift Across Arc',
        description: `Voice consistency varies significantly across chapters (std dev: ${stdDev.toFixed(1)}). Authorial voice may be drifting.`,
        suggestion: 'Review voice consistency across all chapters in this arc. Ensure consistent sentence complexity, tone, and stylistic patterns.',
        arcId: chapters[0] ? (novelState.plotLedger.find(a => 
          a.startedAtChapter && a.endedAtChapter &&
          chapters[0].number >= a.startedAtChapter &&
          chapters[0].number <= a.endedAtChapter
        )?.id) : undefined,
      });
    }
  }

  // Emotional beat repetition
  const emotionalSignals = Array.from(chapterReviews.values())
    .flatMap(review => review.signals.filter(s => s.category === 'emotional_credibility'));
  
  if (emotionalSignals.length > chapters.length * 0.5) {
    signals.push({
      id: `emotional-repetition-arc`,
      category: 'emotional_credibility',
      severity: 'suggestion',
      title: 'Repetitive Emotional Beats',
      description: `Similar emotional patterns detected across multiple chapters. Consider varying emotional beats.`,
      suggestion: 'Vary emotional moments and character reactions. Avoid repeating the same emotional patterns.',
      arcId: chapters[0] ? (novelState.plotLedger.find(a => 
        a.startedAtChapter && a.endedAtChapter &&
        chapters[0].number >= a.startedAtChapter &&
        chapters[0].number <= a.endedAtChapter
      )?.id) : undefined,
    });
  }

  return signals;
}

/**
 * Calculate arc-level metrics
 */
function calculateArcLevelMetrics(
  chapters: Chapter[],
  chapterReviews: Map<string, EditorialReview>,
  novelState: NovelState
): ArcEditorialReview['arcLevelMetrics'] {
  // Voice consistency
  const voiceScores: number[] = [];
  chapterReviews.forEach(review => {
    const voiceSignal = review.signals.find(s => s.category === 'voice_consistency');
    if (voiceSignal?.score !== undefined) {
      voiceScores.push(voiceSignal.score);
    }
  });
  const voiceConsistency = voiceScores.length > 0
    ? voiceScores.reduce((a, b) => a + b, 0) / voiceScores.length
    : 75;

  // Emotional variation (inverse of repetition)
  const emotionalSignals = Array.from(chapterReviews.values())
    .flatMap(review => review.signals.filter(s => s.category === 'emotional_credibility'));
  const emotionalVariation = Math.max(0, 100 - (emotionalSignals.length * 10));

  // Scene variety (placeholder - would need scene analysis)
  const sceneVariety = 75; // TODO: Implement scene variety analysis

  // Character development consistency (placeholder)
  const characterDevelopmentConsistency = 75; // TODO: Implement character development tracking

  // Pacing balance
  const pacingSignals = Array.from(chapterReviews.values())
    .flatMap(review => review.signals.filter(s => s.category === 'structural_balance'));
  const pacingBalance = pacingSignals.length > 0
    ? Math.max(0, 100 - (pacingSignals.length * 5))
    : 75;

  return {
    voiceConsistency: Math.round(voiceConsistency),
    emotionalVariation: Math.round(emotionalVariation),
    sceneVariety: Math.round(sceneVariety),
    characterDevelopmentConsistency: Math.round(characterDevelopmentConsistency),
    pacingBalance: Math.round(pacingBalance),
  };
}

/**
 * Calculate overall score from signals
 */
function calculateOverallScore(signals: EditorialSignal[]): number {
  if (signals.length === 0) return 100;

  const scoredSignals = signals.filter(s => s.score !== undefined);
  if (scoredSignals.length === 0) return 75;

  // Weight by severity
  const weights: Record<EditorialSignalSeverity, number> = {
    info: 0.1,
    suggestion: 0.3,
    concern: 0.6,
    issue: 1.0,
  };

  let totalWeightedScore = 0;
  let totalWeight = 0;

  scoredSignals.forEach(signal => {
    const weight = weights[signal.severity] || 0.5;
    totalWeightedScore += (signal.score || 75) * weight;
    totalWeight += weight;
  });

  return Math.round(totalWeight > 0 ? totalWeightedScore / totalWeight : 75);
}

/**
 * Generate review summary
 */
function generateReviewSummary(
  signals: EditorialSignal[],
  metrics: ChapterQualityMetrics
): { summary: string; strengths: string[]; recommendations: string[] } {
  const strengths: string[] = [];
  const recommendations: string[] = [];

  // Identify strengths (signals with high scores or no issues)
  const highScoringSignals = signals.filter(s => s.score !== undefined && s.score >= 80);
  if (highScoringSignals.length > 0) {
    strengths.push(`${highScoringSignals.length} quality metrics scored 80+`);
  }

  if (metrics.narrativeCraftScore.overallCraftScore >= 75) {
    strengths.push('Strong narrative craft');
  }
  if (metrics.originalityScore.overallOriginality >= 75) {
    strengths.push('Good originality');
  }
  if (metrics.voiceConsistencyScore >= 80) {
    strengths.push('Consistent authorial voice');
  }

  // Generate recommendations from signals
  const issueSignals = signals.filter(s => s.severity === 'issue');
  const concernSignals = signals.filter(s => s.severity === 'concern');

  if (issueSignals.length > 0) {
    recommendations.push(`${issueSignals.length} issue(s) need attention`);
  }
  if (concernSignals.length > 0) {
    recommendations.push(`${concernSignals.length} concern(s) should be addressed`);
  }

  // Add specific recommendations from top signals
  const topSignals = signals
    .filter(s => s.severity === 'issue' || s.severity === 'concern')
    .slice(0, 3);
  
  topSignals.forEach(signal => {
    if (signal.suggestion) {
      recommendations.push(signal.suggestion);
    }
  });

  const summary = `Overall quality score: ${metrics.narrativeCraftScore.overallCraftScore}/100. ` +
    `${signals.length} editorial signal(s) identified. ` +
    `${issueSignals.length} issue(s), ${concernSignals.length} concern(s), ` +
    `${signals.filter(s => s.severity === 'suggestion').length} suggestion(s).`;

  return { summary, strengths, recommendations };
}

/**
 * Generate arc review summary
 */
function generateArcReviewSummary(
  chapterReviews: Map<string, EditorialReview>,
  crossChapterIssues: EditorialSignal[],
  arcLevelMetrics: ArcEditorialReview['arcLevelMetrics']
): { summary: string; strengths: string[]; recommendations: string[] } {
  const strengths: string[] = [];
  const recommendations: string[] = [];

  // Aggregate chapter strengths
  chapterReviews.forEach(review => {
    if (review.strengths.length > 0) {
      strengths.push(...review.strengths.slice(0, 2));
    }
  });

  // Arc-level strengths
  if (arcLevelMetrics.voiceConsistency >= 80) {
    strengths.push('Consistent voice across arc');
  }
  if (arcLevelMetrics.emotionalVariation >= 70) {
    strengths.push('Good emotional variation');
  }

  // Cross-chapter issues
  if (crossChapterIssues.length > 0) {
    recommendations.push(`${crossChapterIssues.length} cross-chapter issue(s) detected`);
  }

  // Arc-level recommendations
  if (arcLevelMetrics.voiceConsistency < 70) {
    recommendations.push('Address voice consistency across chapters');
  }
  if (arcLevelMetrics.emotionalVariation < 60) {
    recommendations.push('Vary emotional beats to avoid repetition');
  }

  const totalSignals = Array.from(chapterReviews.values())
    .reduce((sum, review) => sum + review.signals.length, 0) + crossChapterIssues.length;

  const summary = `Arc review: ${chapterReviews.size} chapter(s) analyzed. ` +
    `${totalSignals} editorial signal(s) identified. ` +
    `Voice consistency: ${arcLevelMetrics.voiceConsistency}/100, ` +
    `Emotional variation: ${arcLevelMetrics.emotionalVariation}/100.`;

  return { summary, strengths, recommendations };
}

/**
 * Determine category from warning text
 */
function determineCategoryFromWarning(warning: string): EditorialSignalCategory {
  const lower = warning.toLowerCase();
  if (lower.includes('burstiness') || lower.includes('perplexity') || lower.includes('repetitive')) {
    return 'narrative_authenticity';
  }
  if (lower.includes('voice') || lower.includes('tone') || lower.includes('style')) {
    return 'voice_consistency';
  }
  if (lower.includes('dialogue') || lower.includes('subtext')) {
    return 'dialogue_naturalness';
  }
  if (lower.includes('originality') || lower.includes('generic') || lower.includes('derivative')) {
    return 'originality_craft';
  }
  if (lower.includes('emotional') || lower.includes('interiority')) {
    return 'emotional_credibility';
  }
  return 'structural_balance';
}

/**
 * Check for missed issues by comparing with previous metrics
 */
export async function checkForMissedIssues(
  chapter: Chapter,
  previousMetrics: ChapterQualityMetrics | null,
  novelState: NovelState
): Promise<EditorialSignal[]> {
  if (!previousMetrics) return [];

  const signals: EditorialSignal[] = [];

  try {
    // Get current metrics
    const currentMetrics = await validateChapterQuality(chapter, novelState);
    
    // Compare scores
    const scoreDiff = currentMetrics.narrativeCraftScore.overallCraftScore - 
                     previousMetrics.narrativeCraftScore.overallCraftScore;
    
    if (scoreDiff < -10) {
      signals.push({
        id: `regression-${chapter.id}`,
        category: 'narrative_authenticity',
        severity: 'concern',
        title: 'Quality Regression',
        description: `Quality score decreased by ${Math.abs(scoreDiff)} points after edits.`,
        suggestion: 'Review recent changes to identify what may have caused the quality decrease.',
        chapterId: chapter.id,
        chapterNumber: chapter.number,
      });
    }

    // Check for new issues
    const previousIssues = previousMetrics.warnings.length;
    const currentIssues = currentMetrics.warnings.length;
    
    if (currentIssues > previousIssues) {
      signals.push({
        id: `new-issues-${chapter.id}`,
        category: 'structural_balance',
        severity: 'info',
        title: 'New Issues Detected',
        description: `${currentIssues - previousIssues} new issue(s) detected after edits.`,
        suggestion: 'Review new warnings to address any issues introduced during editing.',
        chapterId: chapter.id,
        chapterNumber: chapter.number,
      });
    }

    return signals;
  } catch (error) {
    console.error('Error checking for missed issues:', error);
    return [];
  }
}
