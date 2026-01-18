/**
 * Story Progression Analyzer
 * Analyzes overall story progression
 * Tracks resolution rates
 * Monitors pacing and tension
 * Provides story health metrics
 */

import { NovelState, StoryThread } from '../types';
import { calculateThreadHealth } from './storyThreadService';

export interface StoryProgressionAnalysis {
  threadHealth: {
    activeThreads: number;
    resolvedThreads: number;
    resolutionRate: number;
    staleThreads: number;
    averageHealthScore: number;
    healthStatus: 'healthy' | 'moderate' | 'unhealthy';
  };
  pacing: {
    currentPacing: 'fast' | 'normal' | 'slow';
    recentTrend: 'accelerating' | 'decelerating' | 'stable';
    recommendation: string;
  };
  tension: {
    currentLevel: 'low' | 'medium' | 'high';
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  storyHealth: {
    overallScore: number; // 0-100
    recommendations: string[];
  };
  formattedContext: string;
}

/**
 * Analyze story progression
 */
export function analyzeProgression(state: NovelState): StoryProgressionAnalysis {
  const currentChapter = state.chapters.length;
  
  // Thread health analysis
  const activeThreads = state.storyThreads.filter(t => 
    t.status === 'active' || t.status === 'paused'
  );
  const resolvedThreads = state.storyThreads.filter(t => t.status === 'resolved');
  const totalThreads = activeThreads.length + resolvedThreads.length;
  
  const resolutionRate = totalThreads > 0 
    ? (resolvedThreads.length / totalThreads) * 100 
    : 0;

  // Calculate stale threads (haven't updated in 10+ chapters)
  const staleThreads = activeThreads.filter(t => 
    currentChapter - t.lastUpdatedChapter >= 10
  );

  // Calculate average health score
  const healthScores = activeThreads.map(t => calculateThreadHealth(t, currentChapter));
  const averageHealthScore = healthScores.length > 0
    ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
    : 100;

  // Determine health status
  let healthStatus: 'healthy' | 'moderate' | 'unhealthy';
  if (averageHealthScore >= 70 && staleThreads.length < activeThreads.length * 0.3) {
    healthStatus = 'healthy';
  } else if (averageHealthScore >= 50 && staleThreads.length < activeThreads.length * 0.5) {
    healthStatus = 'moderate';
  } else {
    healthStatus = 'unhealthy';
  }

  // Pacing analysis
  const recentChapters = state.chapters.slice(-5);
  let currentPacing: 'fast' | 'normal' | 'slow' = 'normal';
  let recentTrend: 'accelerating' | 'decelerating' | 'stable' = 'stable';

  if (recentChapters.length >= 3) {
    // Analyze chapter summaries for pacing indicators
    const pacingKeywords = {
      fast: ['suddenly', 'quickly', 'immediately', 'rushed', 'hurried', 'rapid'],
      slow: ['gradually', 'slowly', 'carefully', 'methodically', 'patiently'],
    };

    let fastCount = 0;
    let slowCount = 0;
    
    recentChapters.forEach(chapter => {
      const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
      pacingKeywords.fast.forEach(kw => {
        if (content.includes(kw)) fastCount++;
      });
      pacingKeywords.slow.forEach(kw => {
        if (content.includes(kw)) slowCount++;
      });
    });

    if (fastCount > slowCount * 2) {
      currentPacing = 'fast';
    } else if (slowCount > fastCount * 2) {
      currentPacing = 'slow';
    }

    // Determine trend by comparing first half to second half
    if (recentChapters.length >= 4) {
      const firstHalf = recentChapters.slice(0, Math.floor(recentChapters.length / 2));
      const secondHalf = recentChapters.slice(Math.floor(recentChapters.length / 2));
      
      let firstHalfFast = 0;
      let secondHalfFast = 0;
      
      [firstHalf, secondHalf].forEach((half, index) => {
        half.forEach(chapter => {
          const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
          pacingKeywords.fast.forEach(kw => {
            if (content.includes(kw)) {
              if (index === 0) firstHalfFast++;
              else secondHalfFast++;
            }
          });
        });
      });

      if (secondHalfFast > firstHalfFast * 1.5) {
        recentTrend = 'accelerating';
      } else if (firstHalfFast > secondHalfFast * 1.5) {
        recentTrend = 'decelerating';
      }
    }
  }

  let pacingRecommendation = 'Maintain current pacing';
  if (currentPacing === 'fast' && recentTrend === 'accelerating') {
    pacingRecommendation = 'Consider slowing down pacing - story may be moving too quickly';
  } else if (currentPacing === 'slow' && recentTrend === 'decelerating') {
    pacingRecommendation = 'Consider increasing pacing - story may need more momentum';
  } else if (currentPacing === 'normal' && recentTrend === 'stable') {
    pacingRecommendation = 'Maintain balanced pacing with variation';
  }

  // Tension analysis
  const tensionKeywords = {
    high: ['danger', 'threat', 'crisis', 'urgent', 'desperate', 'terrified', 'panicked', 'desperate'],
    medium: ['concern', 'worried', 'tension', 'uneasy', 'anxious', 'nervous'],
    low: ['calm', 'peaceful', 'relaxed', 'content', 'safe', 'secure'],
  };

  let tensionCounts = { high: 0, medium: 0, low: 0 };
  const lastThreeChapters = state.chapters.slice(-3);
  
  lastThreeChapters.forEach(chapter => {
    const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
    Object.entries(tensionKeywords).forEach(([level, keywords]) => {
      keywords.forEach(kw => {
        if (content.includes(kw)) {
          tensionCounts[level as keyof typeof tensionCounts]++;
        }
      });
    });
  });

  let currentLevel: 'low' | 'medium' | 'high' = 'medium';
  if (tensionCounts.high > tensionCounts.medium + tensionCounts.low) {
    currentLevel = 'high';
  } else if (tensionCounts.low > tensionCounts.medium + tensionCounts.high) {
    currentLevel = 'low';
  }

  // Determine tension trend
  let tensionTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentChapters.length >= 3) {
    const firstHalf = recentChapters.slice(0, Math.floor(recentChapters.length / 2));
    const secondHalf = recentChapters.slice(Math.floor(recentChapters.length / 2));
    
    let firstHalfHigh = 0;
    let secondHalfHigh = 0;
    
    [firstHalf, secondHalf].forEach((half, index) => {
      half.forEach(chapter => {
        const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
        tensionKeywords.high.forEach(kw => {
          if (content.includes(kw)) {
            if (index === 0) firstHalfHigh++;
            else secondHalfHigh++;
          }
        });
      });
    });

    if (secondHalfHigh > firstHalfHigh * 1.5) {
      tensionTrend = 'increasing';
    } else if (firstHalfHigh > secondHalfHigh * 1.5) {
      tensionTrend = 'decreasing';
    }
  }

  // Calculate overall story health score
  let overallScore = 100;
  
  // Deduct for unhealthy thread status
  if (healthStatus === 'unhealthy') overallScore -= 20;
  else if (healthStatus === 'moderate') overallScore -= 10;
  
  // Deduct for high stale thread ratio
  if (activeThreads.length > 0) {
    const staleRatio = staleThreads.length / activeThreads.length;
    if (staleRatio > 0.5) overallScore -= 15;
    else if (staleRatio > 0.3) overallScore -= 10;
  }
  
  // Deduct for low resolution rate
  if (resolutionRate < 20 && totalThreads > 5) overallScore -= 10;
  else if (resolutionRate < 30 && totalThreads > 10) overallScore -= 5;
  
  // Deduct for pacing issues
  if (currentPacing === 'fast' && recentTrend === 'accelerating') overallScore -= 5;
  if (currentPacing === 'slow' && recentTrend === 'decelerating') overallScore -= 5;
  
  overallScore = Math.max(0, Math.min(100, overallScore));

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (staleThreads.length > 0) {
    recommendations.push(`Address ${Math.min(staleThreads.length, 3)} stale threads that haven't progressed recently`);
  }
  
  if (resolutionRate < 20 && totalThreads > 5) {
    recommendations.push(`Consider resolving some threads - resolution rate is low (${resolutionRate.toFixed(1)}%)`);
  }
  
  if (healthStatus === 'unhealthy') {
    recommendations.push('Focus on improving thread health - many threads need attention');
  }
  
  if (currentPacing === 'fast' && recentTrend === 'accelerating') {
    recommendations.push('Slow down pacing - story may be moving too quickly');
  } else if (currentPacing === 'slow' && recentTrend === 'decelerating') {
    recommendations.push('Increase pacing - story may need more momentum');
  }
  
  if (currentLevel === 'low' && recentTrend === 'decreasing') {
    recommendations.push('Consider increasing tension - story may need more conflict or stakes');
  }

  // Format comprehensive context
  const sections: string[] = [];
  sections.push('[STORY PROGRESSION ANALYSIS]');
  sections.push('');

  sections.push('THREAD HEALTH:');
  sections.push(`- Active Threads: ${activeThreads.length}`);
  sections.push(`- Resolved Threads: ${resolvedThreads.length}`);
  sections.push(`- Resolution Rate: ${resolutionRate.toFixed(1)}% (${healthStatus})`);
  sections.push(`- Stale Threads: ${staleThreads.length} (need attention)`);
  sections.push(`- Average Health Score: ${averageHealthScore.toFixed(1)}/100`);
  sections.push('');

  sections.push('PACING:');
  sections.push(`- Current Pacing: ${currentPacing}`);
  sections.push(`- Recent Trend: ${recentTrend}`);
  sections.push(`- Recommendation: ${pacingRecommendation}`);
  sections.push('');

  sections.push('TENSION:');
  sections.push(`- Current Tension Level: ${currentLevel}`);
  sections.push(`- Tension Trend: ${recentTrend}`);
  sections.push('');

  sections.push('STORY HEALTH:');
  sections.push(`- Overall Score: ${overallScore}/100`);
  if (recommendations.length > 0) {
    sections.push('- Recommendations:');
    recommendations.forEach(rec => {
      sections.push(`  * ${rec}`);
    });
  } else {
    sections.push('- Story is progressing well - maintain current direction');
  }

  return {
    threadHealth: {
      activeThreads: activeThreads.length,
      resolvedThreads: resolvedThreads.length,
      resolutionRate,
      staleThreads: staleThreads.length,
      averageHealthScore,
      healthStatus,
    },
    pacing: {
      currentPacing,
      recentTrend,
      recommendation: pacingRecommendation,
    },
    tension: {
      currentLevel,
      trend: tensionTrend,
    },
    storyHealth: {
      overallScore,
      recommendations,
    },
    formattedContext: sections.join('\n'),
  };
}
