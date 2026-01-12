import { NovelState, Chapter, Scene, TensionMapping } from '../types';
import { analyzeStoryProgression } from './contextAnalysis';
import { generateUUID } from '../utils/uuid';

/**
 * Tension Analyzer
 * Extends contextAnalysis.ts with detailed tension mapping,
 * tension curve visualization, and tension-release balance analysis
 */

export interface TensionAnalysis {
  tensionMappings: TensionMapping[];
  tensionCurve: Array<{
    chapterNumber: number;
    sceneNumber?: number;
    tensionLevel: number;
    tensionType: TensionMapping['tensionType'];
    isPeak: boolean;
    isValley: boolean;
  }>;
  tensionPeaks: Array<{
    chapterNumber: number;
    tensionLevel: number;
    description: string;
  }>;
  tensionValleys: Array<{
    chapterNumber: number;
    tensionLevel: number;
    description: string;
  }>;
  escalationPattern: 'rising' | 'falling' | 'stable' | 'oscillating';
  tensionReleaseBalance: number; // 0-100 (higher = better balance)
  overallTensionScore: number; // 0-100
  recommendations: string[];
}

/**
 * Analyzes tension across the story
 */
export function analyzeTension(state: NovelState): TensionAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      tensionMappings: [],
      tensionCurve: [],
      tensionPeaks: [],
      tensionValleys: [],
      escalationPattern: 'stable',
      tensionReleaseBalance: 0,
      overallTensionScore: 0,
      recommendations: ['No chapters available for tension analysis'],
    };
  }

  // Get base story progression analysis
  const progressionMetrics = analyzeStoryProgression(state.chapters, state.plotLedger);

  // Get or build tension mappings
  let tensionMappings: TensionMapping[] = [];
  if (state.tensionMappings && state.tensionMappings.length > 0) {
    tensionMappings = [...state.tensionMappings];
  } else {
    tensionMappings = buildTensionMappings(chapters, state, progressionMetrics);
  }

  // Build tension curve
  const tensionCurve = buildTensionCurve(tensionMappings, chapters);

  // Identify peaks and valleys
  const tensionPeaks = identifyTensionPeaks(tensionMappings, chapters);
  const tensionValleys = identifyTensionValleys(tensionMappings, chapters);

  // Analyze escalation pattern
  const escalationPattern = analyzeEscalationPattern(tensionCurve);

  // Analyze tension-release balance
  const tensionReleaseBalance = analyzeTensionReleaseBalance(tensionCurve);

  // Calculate overall tension score
  const overallTensionScore = calculateOverallTensionScore(
    tensionCurve,
    tensionPeaks,
    tensionValleys,
    tensionReleaseBalance
  );

  // Generate recommendations
  const recommendations = generateTensionRecommendations(
    tensionCurve,
    tensionPeaks,
    tensionValleys,
    escalationPattern,
    tensionReleaseBalance,
    overallTensionScore
  );

  return {
    tensionMappings,
    tensionCurve,
    tensionPeaks,
    tensionValleys,
    escalationPattern,
    tensionReleaseBalance,
    overallTensionScore,
    recommendations,
  };
}

/**
 * Builds tension mappings from chapters
 */
function buildTensionMappings(
  chapters: Chapter[],
  state: NovelState,
  progressionMetrics: ReturnType<typeof analyzeStoryProgression>
): TensionMapping[] {
  const mappings: TensionMapping[] = [];

  chapters.forEach(chapter => {
    // Get tension level from progression metrics if available
    const chapterDelta = progressionMetrics.chapterDeltas.find(
      d => d.chapterNumber === chapter.number
    );

    let tensionLevel = chapterDelta?.tensionLevel === 'peak' ? 90 :
                      chapterDelta?.tensionLevel === 'high' ? 75 :
                      chapterDelta?.tensionLevel === 'medium' ? 50 :
                      chapterDelta?.tensionLevel === 'low' ? 25 : 50;

    // Analyze chapter content for more accurate tension
    tensionLevel = analyzeChapterTension(chapter, tensionLevel);

    // Determine tension type
    const tensionType = determineTensionType(chapter);

    // Check if peak or valley
    const isPeak = detectTensionPeak(chapter, tensionLevel, mappings);
    const isValley = detectTensionValley(chapter, tensionLevel, mappings);

    // Determine escalation pattern
    const escalationPattern = determineEscalationPattern(chapter, mappings);

    // Check for tension release
    const releaseAfterTension = detectTensionRelease(chapter, mappings);

    mappings.push({
      id: generateUUID(),
      novelId: state.id,
      chapterId: chapter.id,
      tensionLevel: Math.min(100, Math.max(0, Math.round(tensionLevel))),
      tensionType,
      isPeak,
      isValley,
      escalationPattern,
      releaseAfterTension,
      notes: `Tension analysis for chapter ${chapter.number}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return mappings;
}

/**
 * Analyzes chapter tension level
 */
function analyzeChapterTension(chapter: Chapter, baseLevel: number): number {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  let tensionLevel = baseLevel;

  // Tension indicators
  const tensionIndicators = {
    high: ['tense', 'anxious', 'nervous', 'worried', 'afraid', 'danger', 'threat', 'crisis', 'urgent', 'critical', 'desperate'],
    medium: ['concerned', 'uneasy', 'apprehensive', 'uncertain', 'doubtful'],
    low: ['calm', 'peaceful', 'relaxed', 'safe', 'secure', 'content']
  };

  // Count high tension indicators
  const highCount = tensionIndicators.high.filter(indicator => content.includes(indicator)).length;
  tensionLevel += Math.min(30, highCount * 3);

  // Count medium tension indicators
  const mediumCount = tensionIndicators.medium.filter(indicator => content.includes(indicator)).length;
  tensionLevel += Math.min(15, mediumCount * 2);

  // Count low tension indicators (reduce tension)
  const lowCount = tensionIndicators.low.filter(indicator => content.includes(indicator)).length;
  tensionLevel -= Math.min(20, lowCount * 2);

  // Action words increase tension
  const actionWords = ['ran', 'jumped', 'struck', 'attacked', 'fought', 'defended', 'escaped', 'trapped', 'cornered'];
  const actionCount = actionWords.filter(word => content.includes(word)).length;
  tensionLevel += Math.min(20, actionCount * 3);

  // Conflict indicators
  const conflictIndicators = ['battle', 'fight', 'conflict', 'opponent', 'enemy', 'antagonist', 'danger', 'threat'];
  const conflictCount = conflictIndicators.filter(indicator => content.includes(indicator)).length;
  tensionLevel += Math.min(15, conflictCount * 2);

  // Check logic audit for conflict
  if (chapter.logicAudit && chapter.logicAudit.causalityType === 'But') {
    tensionLevel += 10;
  }

  // Dialogue can indicate tension (subtext, conflict)
  const dialogueMatches = content.match(/"[^"]*"/g) || [];
  if (dialogueMatches.length > 5) {
    tensionLevel += 5; // More dialogue might indicate interpersonal tension
  }

  return Math.min(100, Math.max(0, Math.round(tensionLevel)));
}

/**
 * Determines tension type
 */
function determineTensionType(chapter: Chapter): TensionMapping['tensionType'] {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();

  // Check for physical tension
  const physicalIndicators = ['battle', 'fight', 'attack', 'physical', 'injury', 'pain', 'combat'];
  if (physicalIndicators.some(indicator => content.includes(indicator))) {
    return 'physical';
  }

  // Check for psychological tension
  const psychologicalIndicators = ['doubt', 'fear', 'anxiety', 'paranoia', 'mind', 'thought', 'internal'];
  if (psychologicalIndicators.some(indicator => content.includes(indicator))) {
    return 'psychological';
  }

  // Check for social tension
  const socialIndicators = ['betrayal', 'conflict', 'disagreement', 'argument', 'tension', 'relationship'];
  if (socialIndicators.some(indicator => content.includes(indicator))) {
    return 'social';
  }

  // Default to emotional
  return 'emotional';
}

/**
 * Detects if this is a tension peak
 */
function detectTensionPeak(chapter: Chapter, tensionLevel: number, previousMappings: TensionMapping[]): boolean {
  if (tensionLevel < 70) return false;

  // Check if this is significantly higher than recent chapters
  if (previousMappings.length >= 2) {
    const recentAverage = previousMappings.slice(-2).reduce((sum, m) => sum + m.tensionLevel, 0) / 2;
    if (tensionLevel > recentAverage + 15) return true;
  }

  // Check if this is among the highest tension levels
  const allLevels = [...previousMappings.map(m => m.tensionLevel), tensionLevel];
  allLevels.sort((a, b) => b - a);
  return allLevels.indexOf(tensionLevel) < 3; // Top 3
}

/**
 * Detects if this is a tension valley
 */
function detectTensionValley(chapter: Chapter, tensionLevel: number, previousMappings: TensionMapping[]): boolean {
  if (tensionLevel > 40) return false;

  // Check if this is significantly lower than recent chapters
  if (previousMappings.length >= 2) {
    const recentAverage = previousMappings.slice(-2).reduce((sum, m) => sum + m.tensionLevel, 0) / 2;
    if (tensionLevel < recentAverage - 15) return true;
  }

  return tensionLevel < 30; // Very low tension
}

/**
 * Determines escalation pattern
 */
function determineEscalationPattern(chapter: Chapter, previousMappings: TensionMapping[]): TensionMapping['escalationPattern'] {
  if (previousMappings.length < 3) return 'stable';

  const recentLevels = previousMappings.slice(-3).map(m => m.tensionLevel);
  const currentLevel = recentLevels[recentLevels.length - 1];
  const firstLevel = recentLevels[0];

  const trend = currentLevel - firstLevel;

  if (trend > 15) return 'rising';
  if (trend < -15) return 'falling';

  // Check for oscillation
  const increases = recentLevels.filter((level, i) => i > 0 && level > recentLevels[i - 1]).length;
  const decreases = recentLevels.filter((level, i) => i > 0 && level < recentLevels[i - 1]).length;
  
  if (increases >= 1 && decreases >= 1) return 'oscillating';

  return 'stable';
}

/**
 * Detects tension release
 */
function detectTensionRelease(chapter: Chapter, previousMappings: TensionMapping[]): boolean {
  if (previousMappings.length === 0) return false;

  const previousMapping = previousMappings[previousMappings.length - 1];
  const currentContent = (chapter.content + ' ' + chapter.summary).toLowerCase();

  // Check if previous chapter had high tension
  if (previousMapping.tensionLevel < 70) return false;

  // Check for release indicators
  const releaseIndicators = [
    'relieved', 'relief', 'safe', 'peaceful', 'calm', 'resolved',
    'victory', 'success', 'won', 'saved', 'rescued', 'survived'
  ];

  const hasRelease = releaseIndicators.some(indicator => currentContent.includes(indicator));

  // Check if tension dropped significantly
  const tensionDrop = previousMapping.tensionLevel - analyzeChapterTension(chapter, 50);
  
  return hasRelease || tensionDrop > 20;
}

/**
 * Builds tension curve
 */
function buildTensionCurve(
  mappings: TensionMapping[],
  chapters: Chapter[]
): TensionAnalysis['tensionCurve'] {
  return mappings
    .sort((a, b) => {
      const chapterA = chapters.find(ch => ch.id === a.chapterId);
      const chapterB = chapters.find(ch => ch.id === b.chapterId);
      if (!chapterA || !chapterB) return 0;
      return chapterA.number - chapterB.number;
    })
    .map(mapping => {
      const chapter = chapters.find(ch => ch.id === mapping.chapterId);
      return {
        chapterNumber: chapter?.number || 0,
        sceneNumber: mapping.sceneId ? undefined : undefined,
        tensionLevel: mapping.tensionLevel,
        tensionType: mapping.tensionType,
        isPeak: mapping.isPeak,
        isValley: mapping.isValley,
      };
    });
}

/**
 * Identifies tension peaks
 */
function identifyTensionPeaks(
  mappings: TensionMapping[],
  chapters: Chapter[]
): TensionAnalysis['tensionPeaks'] {
  return mappings
    .filter(m => m.isPeak && m.tensionLevel >= 70)
    .sort((a, b) => b.tensionLevel - a.tensionLevel)
    .slice(0, 10) // Top 10 peaks
    .map(mapping => {
      const chapter = chapters.find(ch => ch.id === mapping.chapterId);
      return {
        chapterNumber: chapter?.number || 0,
        tensionLevel: mapping.tensionLevel,
        description: chapter?.title || `Chapter ${chapter?.number || 0}`,
      };
    });
}

/**
 * Identifies tension valleys
 */
function identifyTensionValleys(
  mappings: TensionMapping[],
  chapters: Chapter[]
): TensionAnalysis['tensionValleys'] {
  return mappings
    .filter(m => m.isValley && m.tensionLevel <= 40)
    .sort((a, b) => a.tensionLevel - b.tensionLevel)
    .slice(0, 10) // Top 10 valleys
    .map(mapping => {
      const chapter = chapters.find(ch => ch.id === mapping.chapterId);
      return {
        chapterNumber: chapter?.number || 0,
        tensionLevel: mapping.tensionLevel,
        description: chapter?.title || `Chapter ${chapter?.number || 0}`,
      };
    });
}

/**
 * Analyzes escalation pattern
 */
function analyzeEscalationPattern(curve: TensionAnalysis['tensionCurve']): TensionAnalysis['escalationPattern'] {
  if (curve.length < 3) return 'stable';

  // Analyze overall trend
  const firstThird = curve.slice(0, Math.ceil(curve.length / 3));
  const lastThird = curve.slice(-Math.ceil(curve.length / 3));

  const firstAverage = firstThird.reduce((sum, p) => sum + p.tensionLevel, 0) / firstThird.length;
  const lastAverage = lastThird.reduce((sum, p) => sum + p.tensionLevel, 0) / lastThird.length;

  const trend = lastAverage - firstAverage;

  if (trend > 15) return 'rising';
  if (trend < -15) return 'falling';

  // Check for oscillation
  let oscillations = 0;
  for (let i = 1; i < curve.length - 1; i++) {
    const prev = curve[i - 1].tensionLevel;
    const curr = curve[i].tensionLevel;
    const next = curve[i + 1].tensionLevel;
    
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      oscillations++;
    }
  }

  if (oscillations > curve.length * 0.3) return 'oscillating';

  return 'stable';
}

/**
 * Analyzes tension-release balance
 */
function analyzeTensionReleaseBalance(curve: TensionAnalysis['tensionCurve']): number {
  if (curve.length < 5) return 50;

  let score = 50; // Base score

  // Check for proper peaks followed by valleys (good balance)
  let properBalance = 0;
  for (let i = 1; i < curve.length - 1; i++) {
    const prev = curve[i - 1].tensionLevel;
    const curr = curve[i].tensionLevel;
    const next = curve[i + 1].tensionLevel;

    // Peak followed by release
    if (curr > prev + 10 && curr > next + 10) {
      properBalance++;
    }
    // Valley after peak (release)
    if (curr < prev - 10 && prev > 60) {
      properBalance++;
    }
  }

  // Good balance has peaks and valleys
  const balanceRatio = properBalance / curve.length;
  score += Math.min(30, balanceRatio * 100);

  // Check for variety (not all high or all low)
  const avgTension = curve.reduce((sum, p) => sum + p.tensionLevel, 0) / curve.length;
  if (avgTension >= 40 && avgTension <= 70) {
    score += 20; // Good average tension
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall tension score
 */
function calculateOverallTensionScore(
  curve: TensionAnalysis['tensionCurve'],
  peaks: TensionAnalysis['tensionPeaks'],
  valleys: TensionAnalysis['tensionValleys'],
  balance: number
): number {
  if (curve.length === 0) return 0;

  // Average tension level
  const avgTension = curve.reduce((sum, p) => sum + p.tensionLevel, 0) / curve.length;

  // Bonus for having peaks (high tension moments)
  const peakBonus = Math.min(15, peaks.length * 2);

  // Bonus for proper balance
  const balanceBonus = balance * 0.3;

  // Bonus for variety (peaks and valleys)
  const varietyBonus = (peaks.length > 0 && valleys.length > 0) ? 10 : 0;

  return Math.min(100, Math.round(avgTension * 0.5 + peakBonus + balanceBonus + varietyBonus));
}

/**
 * Generates tension recommendations
 */
function generateTensionRecommendations(
  curve: TensionAnalysis['tensionCurve'],
  peaks: TensionAnalysis['tensionPeaks'],
  valleys: TensionAnalysis['tensionValleys'],
  escalationPattern: TensionAnalysis['escalationPattern'],
  balance: number,
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  if (overallScore < 60) {
    recommendations.push(`Overall tension score is ${overallScore}/100. Consider increasing tension levels and adding more conflict.`);
  }

  // Check for escalation pattern
  if (escalationPattern === 'falling' && curve.length > 10) {
    recommendations.push('Tension trend is falling. Consider building tension toward the climax.');
  }

  // Check for too many valleys
  if (valleys.length > peaks.length * 1.5) {
    recommendations.push(`Too many tension valleys (${valleys.length} vs ${peaks.length} peaks). Consider reducing low-tension sections.`);
  }

  // Check for lack of peaks
  if (peaks.length < 3 && curve.length >= 10) {
    recommendations.push(`Only ${peaks.length} tension peaks detected. Consider adding more high-tension moments.`);
  }

  // Check tension-release balance
  if (balance < 60) {
    recommendations.push(`Tension-release balance is ${balance}/100. Consider adding more release moments after high tension.`);
  }

  // Check for sustained high tension (fatigue)
  const recentHighTension = curve.slice(-5).filter(p => p.tensionLevel > 80).length;
  if (recentHighTension >= 4) {
    recommendations.push('Sustained high tension detected in recent chapters. Consider adding a release moment to prevent fatigue.');
  }

  // Positive feedback
  if (overallScore >= 75 && balance >= 70 && peaks.length >= 3) {
    recommendations.push('Excellent tension management! Good balance between peaks and valleys, proper escalation pattern.');
  }

  return recommendations;
}
