import { NovelState, Chapter, EngagementMetrics, Scene } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Engagement Analyzer
 * Analyzes reader engagement metrics including hook strength, cliffhanger effectiveness,
 * emotional resonance, tension levels, narrative momentum, and interest curves
 */

export interface EngagementAnalysis {
  metrics: EngagementMetrics[];
  overallEngagementScore: number; // 0-100
  engagementCurve: Array<{
    chapterNumber: number;
    engagementScore: number;
    trend: 'rising' | 'falling' | 'stable';
  }>;
  fatigueChapters: Chapter[];
  peakMoments: Array<{
    chapterNumber: number;
    engagementScore: number;
    description: string;
  }>;
  recommendations: string[];
}

/**
 * Analyzes reader engagement across all chapters
 */
export function analyzeEngagement(state: NovelState): EngagementAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      metrics: [],
      overallEngagementScore: 0,
      engagementCurve: [],
      fatigueChapters: [],
      peakMoments: [],
      recommendations: ['No chapters available for engagement analysis'],
    };
  }

  // Get or build engagement metrics
  let metrics: EngagementMetrics[] = [];
  if (state.engagementMetrics && state.engagementMetrics.length > 0) {
    metrics = [...state.engagementMetrics];
  } else {
    // Build metrics from chapters
    metrics = buildEngagementMetrics(chapters, state);
  }

  // Calculate overall engagement score
  const overallEngagementScore = calculateOverallEngagement(metrics);

  // Build engagement curve
  const engagementCurve = buildEngagementCurve(metrics, chapters);

  // Identify fatigue chapters
  const fatigueChapters = identifyFatigueChapters(chapters, metrics);

  // Identify peak moments
  const peakMoments = identifyPeakMoments(metrics, chapters);

  // Generate recommendations
  const recommendations = generateEngagementRecommendations(
    metrics,
    overallEngagementScore,
    fatigueChapters,
    peakMoments
  );

  return {
    metrics,
    overallEngagementScore,
    engagementCurve,
    fatigueChapters,
    peakMoments,
    recommendations,
  };
}

/**
 * Builds engagement metrics from chapters
 */
function buildEngagementMetrics(chapters: Chapter[], state: NovelState): EngagementMetrics[] {
  const metrics: EngagementMetrics[] = [];

  chapters.forEach(chapter => {
    const hookStrength = analyzeHookStrength(chapter);
    const cliffhangerEffectiveness = analyzeCliffhanger(chapter);
    const emotionalResonance = analyzeEmotionalResonance(chapter);
    const tensionLevel = analyzeTensionLevel(chapter);
    const narrativeMomentum = analyzeNarrativeMomentum(chapter, chapters);
    const interestScore = analyzeInterestScore(chapter);
    
    // Calculate overall engagement score
    const overallEngagementScore = calculateChapterEngagement(
      hookStrength,
      cliffhangerEffectiveness,
      emotionalResonance,
      tensionLevel,
      narrativeMomentum,
      interestScore
    );

    // Detect fatigue
    const fatigueDetected = detectFatigue(chapter, overallEngagementScore, metrics);

    // Detect peak moment
    const peakMoment = detectPeakMoment(overallEngagementScore, metrics);

    metrics.push({
      id: generateUUID(),
      novelId: state.id,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      overallEngagementScore,
      hookStrength,
      cliffhangerEffectiveness,
      emotionalResonance,
      tensionLevel,
      narrativeMomentum,
      interestScore,
      fatigueDetected,
      peakMoment,
      notes: `Engagement analysis for chapter ${chapter.number}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return metrics;
}

/**
 * Analyzes hook strength (first 100-200 words)
 */
function analyzeHookStrength(chapter: Chapter): number {
  const content = chapter.content || '';
  const hook = content.substring(0, 200).toLowerCase();
  
  if (hook.length < 50) return 30; // Too short

  let score = 50; // Base score

  // Hook indicators
  const hookIndicators = [
    'suddenly', 'without warning', 'unexpected', 'shocked',
    'explosion', 'crisis', 'danger', 'urgent', 'critical',
    'question', 'mystery', 'secret', 'hidden'
  ];

  const indicatorCount = hookIndicators.filter(indicator => hook.includes(indicator)).length;
  score += Math.min(30, indicatorCount * 5);

  // Check for action or dialogue (strong hooks)
  const hasDialogue = hook.includes('"') || hook.includes("'");
  const hasAction = hook.match(/\b(ran|jumped|fought|attacked|struck|threw|grabbed)\b/i);

  if (hasDialogue) score += 10;
  if (hasAction) score += 10;

  // Check for questions (engaging hooks)
  const hasQuestion = hook.includes('?');
  if (hasQuestion) score += 5;

  // Check hook length (100-200 words is ideal)
  const wordCount = hook.split(/\s+/).length;
  if (wordCount >= 100 && wordCount <= 200) {
    score += 5;
  } else if (wordCount < 50) {
    score -= 10; // Too short
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes cliffhanger effectiveness
 */
function analyzeCliffhanger(chapter: Chapter): number {
  const content = chapter.content || '';
  const lastParagraph = content.split(/\n\s*\n/).pop() || '';
  const last200Words = content.substring(Math.max(0, content.length - 200)).toLowerCase();

  if (last200Words.length < 50) return 30;

  let score = 40; // Base score

  // Cliffhanger indicators
  const cliffhangerIndicators = [
    'suddenly', 'then', 'but', 'however', 'unexpected',
    'realized', 'understood', 'saw', 'heard', 'felt',
    'before', 'when', 'as', 'while'
  ];

  const indicatorCount = cliffhangerIndicators.filter(indicator => last200Words.includes(indicator)).length;
  score += Math.min(30, indicatorCount * 3);

  // Check for incomplete thoughts or mid-action
  const hasIncompleteThought = lastParagraph.includes('...') || 
                               lastParagraph.trim().endsWith('but') ||
                               lastParagraph.trim().endsWith('when') ||
                               lastParagraph.trim().endsWith('as');
  
  if (hasIncompleteThought) score += 15;

  // Check for questions (create curiosity)
  const hasQuestion = last200Words.includes('?');
  if (hasQuestion) score += 10;

  // Check for revelation indicators
  const hasRevelation = last200Words.includes('realized') ||
                       last200Words.includes('understood') ||
                       last200Words.includes('revealed') ||
                       last200Words.includes('secret');

  if (hasRevelation) score += 10;

  // Check for action/conflict
  const hasAction = last200Words.match(/\b(attacked|fought|ran|jumped|escaped|cornered)\b/i);
  if (hasAction) score += 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes emotional resonance
 */
function analyzeEmotionalResonance(chapter: Chapter): number {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  let score = 40; // Base score

  // Emotional keywords
  const emotionalKeywords = {
    positive: ['joy', 'happiness', 'triumph', 'victory', 'love', 'peace', 'relief', 'hope'],
    negative: ['sadness', 'anger', 'fear', 'despair', 'grief', 'pain', 'loss', 'betrayal'],
    intense: ['shocked', 'devastated', 'ecstatic', 'furious', 'terrified', 'overjoyed']
  };

  // Count emotional words
  let emotionCount = 0;
  Object.values(emotionalKeywords).flat().forEach(keyword => {
    emotionCount += (content.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
  });

  score += Math.min(30, emotionCount * 2);

  // Check for intense emotions
  const intenseCount = emotionalKeywords.intense.filter(kw => content.includes(kw)).length;
  score += Math.min(20, intenseCount * 5);

  // Check for dialogue (emotional expression)
  const dialogueCount = (content.match(/"/g) || []).length;
  if (dialogueCount > 10) score += 10;

  // Check logic audit for emotional shift
  if (chapter.logicAudit) {
    const audit = chapter.logicAudit;
    if (audit.causalityType === 'But' && 
        (audit.theFriction.toLowerCase().includes('emotion') ||
         audit.theFriction.toLowerCase().includes('feeling'))) {
      score += 10;
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes tension level
 */
function analyzeTensionLevel(chapter: Chapter): number {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  let score = 40; // Base score

  // Tension indicators
  const tensionIndicators = [
    'tense', 'anxious', 'nervous', 'worried', 'afraid', 'danger',
    'threat', 'crisis', 'urgent', 'critical', 'desperate',
    'trapped', 'cornered', 'escape', 'fight', 'battle', 'conflict'
  ];

  const indicatorCount = tensionIndicators.filter(indicator => content.includes(indicator)).length;
  score += Math.min(40, indicatorCount * 3);

  // Check for action sequences
  const actionWords = ['ran', 'jumped', 'struck', 'attacked', 'fought', 'defended', 'escaped'];
  const actionCount = actionWords.filter(word => content.includes(word)).length;
  score += Math.min(20, actionCount * 3);

  // Check logic audit for conflict
  if (chapter.logicAudit && chapter.logicAudit.causalityType === 'But') {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes narrative momentum
 */
function analyzeNarrativeMomentum(chapter: Chapter, allChapters: Chapter[]): number {
  const chapterIndex = allChapters.findIndex(ch => ch.id === chapter.id);
  if (chapterIndex === -1 || chapterIndex === 0) return 50;

  const previousChapter = allChapters[chapterIndex - 1];
  const currentContent = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const previousContent = (previousChapter.content + ' ' + previousChapter.summary).toLowerCase();

  let score = 50; // Base score

  // Check for continuity (references to previous chapter)
  const hasContinuity = currentContent.includes('previous') ||
                       currentContent.includes('earlier') ||
                       currentContent.includes('last') ||
                       chapter.number === previousChapter.number + 1; // Sequential

  if (hasContinuity) score += 15;

  // Check for forward momentum (new developments)
  const momentumIndicators = [
    'decided', 'began', 'started', 'continued', 'proceeded',
    'moved forward', 'advanced', 'progressed', 'developed'
  ];

  const hasMomentum = momentumIndicators.some(indicator => currentContent.includes(indicator));
  if (hasMomentum) score += 15;

  // Check for scene changes (new locations/situations)
  const sceneChangeIndicators = ['meanwhile', 'elsewhere', 'later', 'arrived', 'entered', 'reached'];
  const hasSceneChange = sceneChangeIndicators.some(indicator => currentContent.includes(indicator));
  if (hasSceneChange) score += 10;

  // Penalize if chapter is repetitive
  const wordOverlap = calculateWordOverlap(currentContent, previousContent);
  if (wordOverlap > 0.3) score -= 10; // Too much repetition

  // Check chapter length (appropriate length maintains momentum)
  const wordCount = chapter.content.split(/\s+/).length;
  if (wordCount >= 1000 && wordCount <= 3000) {
    score += 10; // Ideal length
  } else if (wordCount < 500) {
    score -= 10; // Too short
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes interest score
 */
function analyzeInterestScore(chapter: Chapter): number {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Combine multiple factors
  const hookStrength = analyzeHookStrength(chapter);
  const cliffhangerEffectiveness = analyzeCliffhanger(chapter);
  const emotionalResonance = analyzeEmotionalResonance(chapter);
  const tensionLevel = analyzeTensionLevel(chapter);

  // Interest score is weighted average
  const interestScore = (
    hookStrength * 0.25 +
    cliffhangerEffectiveness * 0.25 +
    emotionalResonance * 0.25 +
    tensionLevel * 0.25
  );

  return Math.round(interestScore);
}

/**
 * Calculates chapter engagement score
 */
function calculateChapterEngagement(
  hookStrength: number,
  cliffhangerEffectiveness: number,
  emotionalResonance: number,
  tensionLevel: number,
  narrativeMomentum: number,
  interestScore: number
): number {
  // Weighted average
  return Math.round(
    hookStrength * 0.15 +
    cliffhangerEffectiveness * 0.15 +
    emotionalResonance * 0.20 +
    tensionLevel * 0.20 +
    narrativeMomentum * 0.15 +
    interestScore * 0.15
  );
}

/**
 * Calculates overall engagement score
 */
function calculateOverallEngagement(metrics: EngagementMetrics[]): number {
  if (metrics.length === 0) return 0;

  const averageScore = metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / metrics.length;

  // Bonus for consistency (low variance = consistent engagement)
  const variance = calculateVariance(metrics.map(m => m.overallEngagementScore));
  const consistencyBonus = Math.max(0, 10 - variance / 10);

  return Math.min(100, Math.round(averageScore + consistencyBonus));
}

/**
 * Builds engagement curve with trends
 */
function buildEngagementCurve(
  metrics: EngagementMetrics[],
  chapters: Chapter[]
): EngagementAnalysis['engagementCurve'] {
  const curve: EngagementAnalysis['engagementCurve'] = [];

  metrics.forEach((metric, index) => {
    let trend: 'rising' | 'falling' | 'stable' = 'stable';

    if (index > 0) {
      const previousScore = metrics[index - 1].overallEngagementScore;
      const currentScore = metric.overallEngagementScore;
      const difference = currentScore - previousScore;

      if (difference > 5) trend = 'rising';
      else if (difference < -5) trend = 'falling';
      else trend = 'stable';
    }

    curve.push({
      chapterNumber: metric.chapterNumber,
      engagementScore: metric.overallEngagementScore,
      trend,
    });
  });

  return curve;
}

/**
 * Identifies fatigue chapters (low engagement)
 */
function identifyFatigueChapters(chapters: Chapter[], metrics: EngagementMetrics[]): Chapter[] {
  const averageEngagement = metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / metrics.length;
  const fatigueThreshold = averageEngagement * 0.7; // 30% below average

  const fatigueMetrics = metrics.filter(m => 
    m.overallEngagementScore < fatigueThreshold || m.fatigueDetected
  );

  return fatigueMetrics
    .map(metric => chapters.find(ch => ch.id === metric.chapterId))
    .filter((ch): ch is Chapter => ch !== undefined);
}

/**
 * Identifies peak moments (high engagement)
 */
function identifyPeakMoments(
  metrics: EngagementMetrics[],
  chapters: Chapter[]
): EngagementAnalysis['peakMoments'] {
  const averageEngagement = metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / metrics.length;
  const peakThreshold = averageEngagement * 1.2; // 20% above average

  const peakMetrics = metrics.filter(m => 
    (m.overallEngagementScore >= peakThreshold || m.peakMoment) &&
    m.overallEngagementScore >= 70
  );

  return peakMetrics
    .sort((a, b) => b.overallEngagementScore - a.overallEngagementScore)
    .slice(0, 5) // Top 5 peaks
    .map(metric => {
      const chapter = chapters.find(ch => ch.id === metric.chapterId);
      return {
        chapterNumber: metric.chapterNumber,
        engagementScore: metric.overallEngagementScore,
        description: chapter?.title || `Chapter ${metric.chapterNumber}`,
      };
    });
}

/**
 * Detects fatigue in a chapter
 */
function detectFatigue(chapter: Chapter, engagementScore: number, previousMetrics: EngagementMetrics[]): boolean {
  // Check if engagement is consistently low
  if (engagementScore < 40) return true;

  // Check if multiple consecutive low-engagement chapters
  if (previousMetrics.length >= 3) {
    const recentMetrics = previousMetrics.slice(-3);
    const recentAverage = recentMetrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / recentMetrics.length;
    if (recentAverage < 50 && engagementScore < 50) return true;
  }

  // Check for repetitive patterns
  const content = chapter.content.toLowerCase();
  const wordFrequency = new Map<string, number>();
  content.split(/\s+/).forEach(word => {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  });

  // High repetition might indicate fatigue
  const maxFrequency = Math.max(...Array.from(wordFrequency.values()));
  const wordCount = content.split(/\s+/).length;
  if (maxFrequency / wordCount > 0.05) return true; // Same word appears >5% of time

  return false;
}

/**
 * Detects if this is a peak moment
 */
function detectPeakMoment(engagementScore: number, previousMetrics: EngagementMetrics[]): boolean {
  if (engagementScore < 70) return false;

  // Check if this is significantly higher than recent chapters
  if (previousMetrics.length >= 2) {
    const recentAverage = previousMetrics.slice(-2).reduce((sum, m) => sum + m.overallEngagementScore, 0) / 2;
    if (engagementScore > recentAverage + 15) return true;
  }

  // Check if this is one of the top engagement scores
  const allScores = [...previousMetrics.map(m => m.overallEngagementScore), engagementScore];
  allScores.sort((a, b) => b - a);
  return allScores.indexOf(engagementScore) < 3; // Top 3
}

/**
 * Generates engagement recommendations
 */
function generateEngagementRecommendations(
  metrics: EngagementMetrics[],
  overallScore: number,
  fatigueChapters: Chapter[],
  peakMoments: EngagementAnalysis['peakMoments']
): string[] {
  const recommendations: string[] = [];

  if (overallScore < 60) {
    recommendations.push(`Overall engagement score is ${overallScore}/100. Focus on improving hooks, cliffhangers, and emotional resonance.`);
  }

  if (fatigueChapters.length > 0) {
    recommendations.push(
      `Fatigue detected in ${fatigueChapters.length} chapters: ${fatigueChapters.slice(0, 3).map(ch => ch.number).join(', ')}. Consider adding action, conflict, or new developments.`
    );
  }

  // Check engagement curve for patterns
  if (metrics.length >= 5) {
    const recentMetrics = metrics.slice(-5);
    const trend = recentMetrics.map(m => m.overallEngagementScore);
    const isDeclining = trend[trend.length - 1] < trend[0];
    if (isDeclining) {
      recommendations.push('Engagement trend is declining in recent chapters. Consider increasing tension or introducing new conflicts.');
    }
  }

  // Positive feedback
  if (overallScore >= 75 && peakMoments.length >= 3) {
    recommendations.push('Excellent engagement! Multiple peak moments detected. Maintain this momentum.');
  }

  return recommendations;
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Helper: Calculate word overlap between two texts
 */
function calculateWordOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/).map(w => w.toLowerCase()));
  const words2 = new Set(text2.split(/\s+/).map(w => w.toLowerCase()));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}
