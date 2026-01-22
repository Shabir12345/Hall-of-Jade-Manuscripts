/**
 * Thread Lifecycle Manager
 * Manages the complete lifecycle of story threads from creation to resolution
 * Provides intelligent progression tracking and automatic resolution detection
 */

import { StoryThread, ThreadStatus, ThreadPriority, StoryThreadType, NovelState } from '../types';

export interface ThreadLifecycleEvent {
  threadId: string;
  eventType: 'created' | 'progressed' | 'escalated' | 'deescalated' | 'resolved' | 'abandoned' | 'revived';
  chapterNumber: number;
  chapterId: string;
  description: string;
  confidence: number;
  autoDetected: boolean;
  metadata?: Record<string, any>;
}

export interface ThreadLifecycleAnalysis {
  thread: StoryThread;
  currentStatus: ThreadStatus;
  healthScore: number;
  progressionRate: number;
  recommendedActions: string[];
  resolutionReadiness: number; // 0-100
  nextMilestone?: string;
  riskFactors: string[];
  estimatedResolutionChapter?: number;
}

/**
 * Analyze thread lifecycle and provide management recommendations
 */
export function analyzeThreadLifecycle(
  thread: StoryThread,
  currentChapter: number,
  state: NovelState
): ThreadLifecycleAnalysis {
  const healthScore = calculateThreadHealthScore(thread, currentChapter);
  const progressionRate = calculateProgressionRate(thread, currentChapter);
  const resolutionReadiness = calculateResolutionReadiness(thread, currentChapter);
  const recommendedActions = generateRecommendedActions(thread, healthScore, progressionRate, resolutionReadiness);
  const riskFactors = identifyRiskFactors(thread, currentChapter);
  const nextMilestone = predictNextMilestone(thread, currentChapter);
  const estimatedResolutionChapter = estimateResolutionChapter(thread, currentChapter);

  return {
    thread,
    currentStatus: thread.status,
    healthScore,
    progressionRate,
    recommendedActions,
    resolutionReadiness,
    nextMilestone,
    riskFactors,
    estimatedResolutionChapter,
  };
}

/**
 * Manage thread lifecycle events
 */
export function manageThreadLifecycle(
  thread: StoryThread,
  event: ThreadLifecycleEvent
): StoryThread {
  const updatedThread = { ...thread };

  switch (event.eventType) {
    case 'created':
      updatedThread.status = 'active';
      updatedThread.introducedChapter = event.chapterNumber;
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      break;

    case 'progressed':
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      
      // Add progression note
      if (!updatedThread.progressionNotes) {
        updatedThread.progressionNotes = [];
      }
      updatedThread.progressionNotes.push({
        chapterNumber: event.chapterNumber,
        note: event.description,
        significance: event.confidence > 80 ? 'major' : 'minor',
      });
      break;

    case 'escalated':
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.priority = escalatePriority(updatedThread.priority);
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      
      if (!updatedThread.progressionNotes) {
        updatedThread.progressionNotes = [];
      }
      updatedThread.progressionNotes.push({
        chapterNumber: event.chapterNumber,
        note: `ESCALATED: ${event.description}`,
        significance: 'major',
      });
      break;

    case 'deescalated':
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.priority = deescalatePriority(updatedThread.priority);
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      
      if (!updatedThread.progressionNotes) {
        updatedThread.progressionNotes = [];
      }
      updatedThread.progressionNotes.push({
        chapterNumber: event.chapterNumber,
        note: `DEESCALATED: ${event.description}`,
        significance: 'minor',
      });
      break;

    case 'resolved':
      updatedThread.status = 'resolved';
      updatedThread.resolvedChapter = event.chapterNumber;
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.resolutionNotes = event.description;
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      break;

    case 'abandoned':
      updatedThread.status = 'abandoned';
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      break;

    case 'revived':
      updatedThread.status = 'active';
      updatedThread.lastUpdatedChapter = event.chapterNumber;
      updatedThread.chaptersInvolved = [...(updatedThread.chaptersInvolved || []), event.chapterNumber]
        .filter((v, i, a) => a.indexOf(v) === i);
      
      if (!updatedThread.progressionNotes) {
        updatedThread.progressionNotes = [];
      }
      updatedThread.progressionNotes.push({
        chapterNumber: event.chapterNumber,
        note: `REVIVED: ${event.description}`,
        significance: 'major',
      });
      break;
  }

  updatedThread.updatedAt = Date.now();
  return updatedThread;
}

/**
 * Get threads that need attention based on lifecycle analysis
 */
export function getThreadsNeedingAttention(
  threads: StoryThread[],
  currentChapter: number
): ThreadLifecycleAnalysis[] {
  const analyses: ThreadLifecycleAnalysis[] = [];

  for (const thread of threads) {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      continue;
    }

    const analysis = analyzeThreadLifecycle(thread, currentChapter, {} as NovelState);
    
    // Include threads that need attention
    if (
      analysis.healthScore < 50 ||
      analysis.progressionRate < 0.3 ||
      analysis.resolutionReadiness > 80 ||
      analysis.riskFactors.length > 0
    ) {
      analyses.push(analysis);
    }
  }

  // Sort by priority (critical threads first)
  return analyses.sort((a, b) => {
    const priorityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
    const aPriority = priorityOrder[a.thread.priority] || 0;
    const bPriority = priorityOrder[b.thread.priority] || 0;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    // Then by health score (worse health first)
    return a.healthScore - b.healthScore;
  });
}

/**
 * Suggest thread resolutions based on story context
 */
export function suggestThreadResolutions(
  thread: StoryThread,
  currentChapter: number
): Array<{
  resolutionType: string;
  description: string;
  confidence: number;
  requirements: string[];
  impact: 'low' | 'medium' | 'high';
}> {
  const resolutions: Array<{
    resolutionType: string;
    description: string;
    confidence: number;
    requirements: string[];
    impact: 'low' | 'medium' | 'high';
  }> = [];

  // Type-specific resolution suggestions
  switch (thread.type) {
    case 'conflict':
      resolutions.push(
        {
          resolutionType: 'peaceful_resolution',
          description: 'Characters resolve their differences through understanding and compromise',
          confidence: 70,
          requirements: ['Character development', 'Mutual understanding', 'Common ground'],
          impact: 'high',
        },
        {
          resolutionType: 'victory',
          description: 'One character defeats the other in conflict',
          confidence: 85,
          requirements: ['Power escalation', 'Final confrontation', 'Clear winner'],
          impact: 'high',
        },
        {
          resolutionType: 'mutual_destruction',
          description: 'Both characters are destroyed or severely weakened',
          confidence: 60,
          requirements: ['Escalation to extreme', 'Tragic circumstances', 'No escape'],
          impact: 'medium',
        }
      );
      break;

    case 'relationship':
      resolutions.push(
        {
          resolutionType: 'commitment',
          description: 'Relationship deepens into committed partnership',
          confidence: 75,
          requirements: ['Emotional vulnerability', 'Shared values', 'Future planning'],
          impact: 'medium',
        },
        {
          resolutionType: 'separation',
          description: 'Characters amicably separate due to circumstances',
          confidence: 65,
          requirements: ['External circumstances', 'Mutual respect', 'Acceptance'],
          impact: 'medium',
        },
        {
          resolutionType: 'betrayal',
          description: 'Relationship ends due to betrayal or broken trust',
          confidence: 80,
          requirements: ['Secret revealed', 'Trust broken', 'Emotional fallout'],
          impact: 'high',
        }
      );
      break;

    case 'promise':
      resolutions.push(
        {
          resolutionType: 'fulfillment',
          description: 'Promise is successfully fulfilled',
          confidence: 90,
          requirements: ['Opportunity arises', 'Character effort', 'Overcoming obstacles'],
          impact: 'medium',
        },
        {
          resolutionType: 'broken_promise',
          description: 'Promise is broken due to circumstances or choice',
          confidence: 70,
          requirements: ['Impossible circumstances', 'Moral conflict', 'Consequences'],
          impact: 'high',
        },
        {
          resolutionType: 'transformation',
          description: 'Promise evolves into something different but meaningful',
          confidence: 60,
          requirements: ['Character growth', 'Changing circumstances', 'New understanding'],
          impact: 'medium',
        }
      );
      break;

    case 'quest':
      resolutions.push(
        {
          resolutionType: 'success',
          description: 'Quest is completed successfully',
          confidence: 85,
          requirements: ['Final challenge', 'Character growth', 'Reward achieved'],
          impact: 'high',
        },
        {
          resolutionType: 'failure_with_lesson',
          description: 'Quest fails but character learns valuable lesson',
          confidence: 75,
          requirements: ['Obstacle overcome', 'Self-realization', 'Character growth'],
          impact: 'medium',
        },
        {
          resolutionType: 'transformation',
          description: 'Quest goal changes but leads to better outcome',
          confidence: 65,
          requirements: ['New understanding', 'Adaptation', 'Unexpected discovery'],
          impact: 'medium',
        }
      );
      break;

    case 'mystery':
      resolutions.push(
        {
          resolutionType: 'revelation',
          description: 'Mystery is solved with clear explanation',
          confidence: 90,
          requirements: ['Clues gathered', 'Deduction', 'Truth revealed'],
          impact: 'high',
        },
        {
          resolutionType: 'red_herring',
          description: 'Mystery solution reveals misdirection',
          confidence: 70,
          requirements: ['False leads', 'True culprit revealed', 'Surprise twist'],
          impact: 'medium',
        },
        {
          resolutionType: 'unsolved',
          description: 'Mystery remains unsolved but character moves on',
          confidence: 50,
          requirements: ['Acceptance', 'Character growth', 'Moving forward'],
          impact: 'low',
        }
      );
      break;

    // Add more types as needed
    default:
      resolutions.push({
        resolutionType: 'natural_conclusion',
        description: 'Thread reaches natural conclusion based on story development',
        confidence: 60,
        requirements: ['Story progression', 'Character readiness', 'Appropriate timing'],
        impact: 'medium',
      });
  }

  return resolutions;
}

/**
 * Helper functions
 */
function calculateThreadHealthScore(thread: StoryThread, currentChapter: number): number {
  if (thread.status === 'resolved') {
    return thread.satisfactionScore || 80;
  }

  if (thread.status === 'abandoned') {
    return 0;
  }

  let score = 50; // Base score

  // Recent activity bonus
  const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
  if (chaptersSinceUpdate <= 3) {
    score += 20;
  } else if (chaptersSinceUpdate <= 5) {
    score += 10;
  } else if (chaptersSinceUpdate <= 10) {
    score += 5;
  } else {
    score -= (chaptersSinceUpdate - 10) * 2;
  }

  // Priority bonus
  if (thread.priority === 'critical') {
    score += 10;
  } else if (thread.priority === 'high') {
    score += 5;
  }

  // Progression notes bonus
  if (thread.progressionNotes && thread.progressionNotes.length > 0) {
    score += Math.min(thread.progressionNotes.length * 2, 10);
  }

  return Math.max(0, Math.min(100, score));
}

function calculateProgressionRate(thread: StoryThread, currentChapter: number): number {
  if (!thread.progressionNotes || thread.progressionNotes.length === 0) {
    return 0;
  }

  const threadAge = currentChapter - thread.introducedChapter;
  if (threadAge === 0) {
    return 1;
  }

  // Calculate progression events per chapter
  const progressionEvents = thread.progressionNotes.length;
  const rate = progressionEvents / threadAge;

  // Normalize to 0-1 scale
  return Math.min(1, rate * 2); // Assume 1 progression every 2 chapters is ideal
}

function calculateResolutionReadiness(thread: StoryThread, currentChapter: number): number {
  let readiness = 50; // Base readiness

  // Thread age factor
  const threadAge = currentChapter - thread.introducedChapter;
  const idealAge = getIdealThreadAge(thread.type);
  
  if (threadAge >= idealAge.min && threadAge <= idealAge.max) {
    readiness += 20;
  } else if (threadAge > idealAge.max) {
    readiness += 15; // Overdue threads are more ready
  } else {
    readiness -= 10; // Too young for resolution
  }

  // Progression density factor
  const progressionRate = calculateProgressionRate(thread, currentChapter);
  readiness += progressionRate * 20;

  // Recent activity factor
  const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
  if (chaptersSinceUpdate <= 3) {
    readiness += 10;
  } else if (chaptersSinceUpdate > 10) {
    readiness -= 15;
  }

  // Priority factor
  if (thread.priority === 'critical') {
    readiness += 10;
  }

  return Math.max(0, Math.min(100, readiness));
}

function getIdealThreadAge(threadType: StoryThreadType): { min: number; max: number } {
  const ageRanges: Record<StoryThreadType, { min: number; max: number }> = {
    promise: { min: 3, max: 15 },
    quest: { min: 5, max: 30 },
    conflict: { min: 5, max: 25 },
    relationship: { min: 8, max: 40 },
    power: { min: 10, max: 50 },
    mystery: { min: 10, max: 60 },
    revelation: { min: 2, max: 20 },
    alliance: { min: 5, max: 30 },
    enemy: { min: 8, max: 40 },
    technique: { min: 5, max: 25 },
    item: { min: 3, max: 20 },
    location: { min: 10, max: 50 },
    sect: { min: 15, max: 60 },
  };

  return ageRanges[threadType] || { min: 10, max: 30 };
}

function generateRecommendedActions(
  thread: StoryThread,
  healthScore: number,
  progressionRate: number,
  resolutionReadiness: number
): string[] {
  const actions: string[] = [];

  if (healthScore < 30) {
    actions.push('CRITICAL: Thread health is very low. Immediate attention required.');
  } else if (healthScore < 50) {
    actions.push('Thread health is declining. Consider progressing or resolving soon.');
  }

  if (progressionRate < 0.2) {
    actions.push('Thread progression is stagnant. Add development or resolution.');
  } else if (progressionRate < 0.4) {
    actions.push('Thread progression is slow. Consider adding progression events.');
  }

  if (resolutionReadiness > 80) {
    actions.push('Thread is ready for resolution. Consider wrapping it up.');
  } else if (resolutionReadiness > 60) {
    actions.push('Thread is approaching resolution readiness. Plan resolution arc.');
  }

  if (thread.priority === 'critical' && healthScore < 70) {
    actions.push('Critical thread needs attention. Prioritize in upcoming chapters.');
  }

  return actions;
}

function identifyRiskFactors(thread: StoryThread, currentChapter: number): string[] {
  const risks: string[] = [];

  // Staleness risk
  const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
  if (chaptersSinceUpdate > 15) {
    risks.push(`Thread hasn't progressed in ${chaptersSinceUpdate} chapters`);
  }

  // Age risk
  const threadAge = currentChapter - thread.introducedChapter;
  const idealAge = getIdealThreadAge(thread.type);
  if (threadAge > idealAge.max * 1.5) {
    risks.push(`Thread is significantly older than ideal resolution age (${threadAge} vs ${idealAge.max})`);
  }

  // Priority risk
  if (thread.priority === 'critical' && chaptersSinceUpdate > 10) {
    risks.push('Critical thread is becoming stale');
  }

  // Low progression risk
  const progressionRate = calculateProgressionRate(thread, currentChapter);
  if (progressionRate < 0.1 && threadAge > 10) {
    risks.push('Thread has very low progression rate for its age');
  }

  return risks;
}

function predictNextMilestone(thread: StoryThread, currentChapter: number): string | undefined {
  const progressionRate = calculateProgressionRate(thread, currentChapter);
  const resolutionReadiness = calculateResolutionReadiness(thread, currentChapter);

  if (resolutionReadiness > 80) {
    return 'Resolution';
  } else if (resolutionReadiness > 60) {
    return 'Final Development';
  } else if (progressionRate < 0.2) {
    return 'Progression Event';
  } else if (thread.priority === 'critical') {
    return 'Escalation';
  } else {
    return 'Development';
  }
}

function estimateResolutionChapter(thread: StoryThread, currentChapter: number): number | undefined {
  const resolutionReadiness = calculateResolutionReadiness(thread, currentChapter);
  const progressionRate = calculateProgressionRate(thread, currentChapter);
  const idealAge = getIdealThreadAge(thread.type);

  if (resolutionReadiness > 80) {
    return currentChapter + 1;
  } else if (resolutionReadiness > 60) {
    return currentChapter + Math.ceil(5 / (progressionRate + 0.1));
  } else {
    // Estimate based on ideal age and current progression
    const remainingAge = idealAge.max - (currentChapter - thread.introducedChapter);
    if (remainingAge > 0) {
      return currentChapter + Math.ceil(remainingAge / (progressionRate + 0.1));
    }
  }

  return undefined;
}

function escalatePriority(priority: ThreadPriority): ThreadPriority {
  const escalationMap: Record<ThreadPriority, ThreadPriority> = {
    low: 'medium',
    medium: 'high',
    high: 'critical',
    critical: 'critical',
  };
  return escalationMap[priority];
}

function deescalatePriority(priority: ThreadPriority): ThreadPriority {
  const deescalationMap: Record<ThreadPriority, ThreadPriority> = {
    critical: 'high',
    high: 'medium',
    medium: 'low',
    low: 'low',
  };
  return deescalationMap[priority];
}
