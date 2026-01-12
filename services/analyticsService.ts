import { NovelState, Chapter, Scene, Arc } from '../types';
import { analyzeForeshadowing, analyzeEmotionalPayoffs, analyzePacing } from './promptEngine/arcContextAnalyzer';
import * as arcAnalyzerModule from './promptEngine/arcContextAnalyzer';

export interface WordCountStats {
  total: number;
  byChapter: Array<{ chapterNumber: number; chapterTitle: string; wordCount: number }>;
  byScene: Array<{ sceneTitle: string; wordCount: number }>;
  byArc: Array<{ arcTitle: string; wordCount: number }>;
  averagePerChapter: number;
  averagePerScene: number;
}

export interface PacingMetrics {
  chaptersPerArc: number;
  averageWordsPerChapter: number;
  averageWordsPerScene: number;
  tensionLevel: 'low' | 'medium' | 'high' | 'peak';
  pacingPattern: 'fast' | 'medium' | 'slow';
}

export interface WritingVelocity {
  wordsPerDay: number;
  wordsPerWeek: number;
  estimatedCompletionDate?: number;
  progressPercentage: number;
}

export const calculateWordCounts = (novel: NovelState): WordCountStats => {
  let total = 0;
  const byChapter: WordCountStats['byChapter'] = [];
  const byScene: WordCountStats['byScene'] = [];
  const byArc: WordCountStats['byArc'] = [];
  
  const arcWordCounts = new Map<string, number>();
  
  novel.chapters.forEach(chapter => {
    const chapterWords = chapter.content.split(/\s+/).filter(x => x).length;
    total += chapterWords;
    
    byChapter.push({
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      wordCount: chapterWords
    });
    
    // Count scene words
    chapter.scenes.forEach(scene => {
      const sceneWords = scene.wordCount || scene.content.split(/\s+/).filter(x => x).length;
      byScene.push({
        sceneTitle: scene.title || `Scene ${scene.number}`,
        wordCount: sceneWords
      });
    });
    
    // Associate chapters with arcs (simplified - assumes chapters belong to active arc)
    const activeArc = novel.plotLedger.find(a => a.status === 'active');
    if (activeArc) {
      const current = arcWordCounts.get(activeArc.id) || 0;
      arcWordCounts.set(activeArc.id, current + chapterWords);
    }
  });
  
  arcWordCounts.forEach((wordCount, arcId) => {
    const arc = novel.plotLedger.find(a => a.id === arcId);
    if (arc) {
      byArc.push({
        arcTitle: arc.title,
        wordCount
      });
    }
  });
  
  return {
    total,
    byChapter,
    byScene,
    byArc,
    averagePerChapter: novel.chapters.length > 0 ? total / novel.chapters.length : 0,
    averagePerScene: byScene.length > 0 ? byScene.reduce((sum, s) => sum + s.wordCount, 0) / byScene.length : 0
  };
};

export const calculatePacingMetrics = (novel: NovelState): PacingMetrics => {
  const wordCounts = calculateWordCounts(novel);
  const activeArcs = novel.plotLedger.filter(a => a.status === 'active');
  const chaptersPerArc = activeArcs.length > 0 ? novel.chapters.length / activeArcs.length : 0;
  
  // Determine tension level based on recent chapters
  const recentChapters = novel.chapters.slice(-5);
  const hasValueShifts = recentChapters.filter(c => c.logicAudit).length;
  let tensionLevel: 'low' | 'medium' | 'high' | 'peak' = 'low';
  if (hasValueShifts >= 4) tensionLevel = 'peak';
  else if (hasValueShifts >= 2) tensionLevel = 'high';
  else if (hasValueShifts >= 1) tensionLevel = 'medium';
  
  // Determine pacing pattern
  let pacingPattern: 'fast' | 'medium' | 'slow' = 'medium';
  if (wordCounts.averagePerChapter > 3000) pacingPattern = 'slow';
  else if (wordCounts.averagePerChapter < 1500) pacingPattern = 'fast';
  
  return {
    chaptersPerArc,
    averageWordsPerChapter: wordCounts.averagePerChapter,
    averageWordsPerScene: wordCounts.averagePerScene,
    tensionLevel,
    pacingPattern
  };
};

export const calculateWritingVelocity = (
  novel: NovelState,
  targetWordCount?: number
): WritingVelocity => {
  const wordCounts = calculateWordCounts(novel);
  const now = Date.now();
  // Use createdAt if available, otherwise use first chapter's timestamp or current time
  const createdAt = novel.createdAt || (novel.chapters.length > 0 ? novel.chapters[0].createdAt : now);
  const daysSinceStart = (now - createdAt) / (1000 * 60 * 60 * 24);
  const wordsPerDay = daysSinceStart > 0 ? wordCounts.total / daysSinceStart : 0;
  const wordsPerWeek = wordsPerDay * 7;
  
  let estimatedCompletionDate: number | undefined;
  let progressPercentage = 0;
  
  if (targetWordCount && targetWordCount > 0) {
    progressPercentage = (wordCounts.total / targetWordCount) * 100;
    if (wordsPerDay > 0) {
      const remainingWords = targetWordCount - wordCounts.total;
      const daysRemaining = remainingWords / wordsPerDay;
      estimatedCompletionDate = now + (daysRemaining * 24 * 60 * 60 * 1000);
    }
  }
  
  return {
    wordsPerDay,
    wordsPerWeek,
    estimatedCompletionDate,
    progressPercentage
  };
};

export interface NarrativeQualityMetrics {
  foreshadowingPayoffRate: number; // 0-1: percentage of foreshadowing elements that have been paid off
  emotionalIntensityScore: number; // 1-5: average emotional intensity of recent payoffs
  pacingConsistency: number; // 0-1: how consistent pacing is across chapters
  symbolismDepth: number; // 0-1: average number of symbolic elements per chapter
  subtextPresence: number; // 0-1: estimated presence of subtext (based on dialogue patterns)
  povConsistency: number; // 0-1: how consistent POV is across chapters
  overallQualityScore: number; // 0-100: composite quality score
  recommendations: string[];
}

/**
 * Calculates comprehensive narrative quality metrics
 */
export const calculateNarrativeQualityMetrics = (novel: NovelState): NarrativeQualityMetrics => {
  try {
    const recommendations: string[] = [];
    
    // Foreshadowing payoff rate
    const foreshadowing = analyzeForeshadowing(novel);
  const totalForeshadowing = foreshadowing.activeForeshadowing.length + foreshadowing.paidOffForeshadowing.length;
  const foreshadowingPayoffRate = totalForeshadowing > 0
    ? foreshadowing.paidOffForeshadowing.length / totalForeshadowing
    : 0.5; // Default to medium if no foreshadowing detected
  
  if (foreshadowing.overdueForeshadowing.length > 0) {
    recommendations.push(`Pay off ${foreshadowing.overdueForeshadowing.length} overdue foreshadowing element(s)`);
  }
  
  // Emotional intensity score
  const emotionalPayoffs = analyzeEmotionalPayoffs(novel);
  const emotionalIntensityScore = emotionalPayoffs.emotionalIntensityScore / 5; // Normalize to 0-1
  
  if (emotionalPayoffs.recentPayoffs.length === 0 && novel.chapters.length > 5) {
    recommendations.push('Add emotional payoff moments to maintain reader engagement');
  }
  
  // Pacing consistency
  const pacing = analyzePacing(novel);
  let pacingConsistency = 1.0; // Default to high consistency
  if (pacing.sceneLevelPacing.length >= 3) {
    const pacingTypes = pacing.sceneLevelPacing.slice(-5).map(p => p.dominantPacingType);
    const uniqueTypes = new Set(pacingTypes).size;
    // More variety = lower consistency score (which is good for engagement)
    // But too much variation = inconsistency (which is bad)
    pacingConsistency = uniqueTypes === 1 ? 0.9 : uniqueTypes <= 3 ? 1.0 : 0.8;
  }
  
  if (pacing.pacingIssues.length > 0) {
    recommendations.push(...pacing.pacingIssues.slice(0, 2));
  }
  
  // Symbolism depth
  const symbolism = (arcAnalyzerModule as any).analyzeSymbolism?.(novel) || { symbolicElements: [], motifEvolution: [], symbolismDensity: 0, recommendations: [] };
  const symbolismDepth = Math.min(symbolism.symbolismDensity / 1.0, 1.0); // Normalize to 0-1
  
  if (symbolism.recommendations.length > 0) {
    recommendations.push(...symbolism.recommendations.slice(0, 2));
  }
  
  // Subtext presence (estimated based on dialogue patterns)
  let subtextPresence = 0.5; // Default medium
  if (novel.chapters.length > 0) {
    const recentChapters = novel.chapters.slice(-5);
    const dialoguePatterns = recentChapters.map(ch => {
      const content = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
      // Look for subtext indicators: questions without answers, dialogue tags with emotion, indirect speech
      const questionCount = (content.match(/\?/g) || []).length;
      const dialogueTags = (content.match(/(said|asked|whispered|shouted|replied|exclaimed)/gi) || []).length;
      return { questionCount, dialogueTags };
    });
    
    const avgQuestions = dialoguePatterns.reduce((sum, p) => sum + p.questionCount, 0) / dialoguePatterns.length;
    const avgTags = dialoguePatterns.reduce((sum, p) => sum + p.dialogueTags, 0) / dialoguePatterns.length;
    
    // More questions and varied dialogue tags suggest subtext
    subtextPresence = Math.min((avgQuestions / 10) * 0.5 + (avgTags / 20) * 0.5, 1.0);
  }
  
  // POV consistency (estimated based on narrative perspective analysis)
  let povConsistency = 1.0; // Default to high
  if (novel.chapters.length >= 3) {
    // This is simplified - in reality would track actual POV shifts
    // For now, assume consistency unless there's evidence of shifting
    povConsistency = 0.95;
  }
  
  // Calculate overall quality score (weighted average)
  const weights = {
    foreshadowing: 0.2,
    emotional: 0.2,
    pacing: 0.15,
    symbolism: 0.15,
    subtext: 0.15,
    pov: 0.15,
  };
  
  const overallQualityScore = Math.round(
    (foreshadowingPayoffRate * weights.foreshadowing +
     emotionalIntensityScore * weights.emotional +
     pacingConsistency * weights.pacing +
     symbolismDepth * weights.symbolism +
     subtextPresence * weights.subtext +
     povConsistency * weights.pov) * 100
  );
  
  // Add overall recommendations
  if (overallQualityScore < 70) {
    recommendations.push('Overall narrative quality could be improved. Review recommendations above.');
  }
  
  if (overallQualityScore >= 90) {
    recommendations.push('Excellent narrative quality! Continue maintaining high standards.');
  }
  
    return {
      foreshadowingPayoffRate: Math.round(foreshadowingPayoffRate * 100) / 100,
      emotionalIntensityScore: Math.round(emotionalIntensityScore * 100) / 100,
      pacingConsistency: Math.round(pacingConsistency * 100) / 100,
      symbolismDepth: Math.round(symbolismDepth * 100) / 100,
      subtextPresence: Math.round(subtextPresence * 100) / 100,
      povConsistency: Math.round(povConsistency * 100) / 100,
      overallQualityScore,
      recommendations: [...recommendations, ...foreshadowing.recommendations.slice(0, 2), ...emotionalPayoffs.recommendations.slice(0, 2), ...pacing.recommendations.slice(0, 2), ...symbolism.recommendations.slice(0, 2)].slice(0, 10), // Limit to 10 recommendations
    };
  } catch (error) {
    console.error('Error calculating narrative quality metrics:', error);
    // Return safe defaults on error
    return {
      foreshadowingPayoffRate: 0.5,
      emotionalIntensityScore: 0.5,
      pacingConsistency: 0.8,
      symbolismDepth: 0.3,
      subtextPresence: 0.5,
      povConsistency: 0.9,
      overallQualityScore: 60,
      recommendations: ['Error calculating quality metrics. Please try again.'],
    };
  }
};
