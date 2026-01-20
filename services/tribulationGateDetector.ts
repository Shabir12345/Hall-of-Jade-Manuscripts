/**
 * Tribulation Gate Detector Service
 * 
 * Analyzes story context to detect when a Tribulation Gate should trigger.
 * Uses a combination of:
 * - Arc phase analysis (climax approach, climax phases)
 * - Beat types from Director (breakthrough, action, revelation)
 * - Story thread status (critical threads approaching resolution)
 * - User instruction keyword detection
 * - Chapter spacing (minimum gap between gates)
 * - Recent chapter content analysis
 */

import { NovelState, Arc, Chapter, StoryThread } from '../types';
import { DirectorBeatSheet, ArcPositionAnalysis } from '../types/director';
import {
  TribulationTrigger,
  TribulationDetectionResult,
  TribulationGateConfig,
  DEFAULT_TRIBULATION_GATE_CONFIG,
  TRIGGER_KEYWORDS,
} from '../types/tribulationGates';
import { logger } from './loggingService';

/**
 * Local storage key for tracking gate history
 */
const GATE_HISTORY_KEY = 'tribulation_gate_history';

/**
 * Get the chapter number of the last triggered gate for a novel
 */
function getLastGateChapter(novelId: string): number {
  try {
    const history = localStorage.getItem(GATE_HISTORY_KEY);
    if (!history) return 0;
    
    const parsed = JSON.parse(history) as Record<string, number>;
    return parsed[novelId] || 0;
  } catch {
    return 0;
  }
}

/**
 * Record that a gate was triggered for a novel at a specific chapter
 */
export function recordGateTrigger(novelId: string, chapterNumber: number): void {
  try {
    const history = localStorage.getItem(GATE_HISTORY_KEY);
    const parsed = history ? JSON.parse(history) : {};
    parsed[novelId] = chapterNumber;
    localStorage.setItem(GATE_HISTORY_KEY, JSON.stringify(parsed));
  } catch (error) {
    logger.warn('Failed to record gate trigger', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sensitivity thresholds for trigger detection
 */
const SENSITIVITY_THRESHOLDS: Record<TribulationGateConfig['triggerSensitivity'], {
  minConfidence: number;
  keywordMatchBonus: number;
  arcPhaseBonus: number;
  beatTypeBonus: number;
  threadBonus: number;
}> = {
  low: {
    minConfidence: 80,
    keywordMatchBonus: 20,
    arcPhaseBonus: 25,
    beatTypeBonus: 15,
    threadBonus: 10,
  },
  medium: {
    minConfidence: 60,
    keywordMatchBonus: 25,
    arcPhaseBonus: 30,
    beatTypeBonus: 20,
    threadBonus: 15,
  },
  high: {
    minConfidence: 40,
    keywordMatchBonus: 30,
    arcPhaseBonus: 35,
    beatTypeBonus: 25,
    threadBonus: 20,
  },
};

/**
 * Arc phases that are more likely to trigger gates
 */
const HIGH_TRIGGER_ARC_PHASES: ArcPositionAnalysis['arcPhase'][] = [
  'climax_approach',
  'climax',
  'midpoint',
];

/**
 * Beat types that suggest significant moments
 */
const SIGNIFICANT_BEAT_TYPES = [
  'breakthrough',
  'revelation',
  'action',
  'escalation',
  'cliffhanger',
];

/**
 * Main detection function - determines if a Tribulation Gate should trigger
 */
export function shouldTriggerTribulationGate(
  state: NovelState,
  beatSheet: DirectorBeatSheet | null,
  userInstruction: string,
  config: Partial<TribulationGateConfig> = {}
): TribulationDetectionResult {
  const finalConfig = { ...DEFAULT_TRIBULATION_GATE_CONFIG, ...config };
  
  // If disabled, return immediately
  if (!finalConfig.enabled) {
    return createNoTriggerResult('Tribulation Gates are disabled');
  }
  
  const nextChapterNumber = state.chapters.length + 1;
  const lastGateChapter = getLastGateChapter(state.id);
  const chaptersSinceLastGate = nextChapterNumber - lastGateChapter;
  
  // Check minimum chapter gap
  if (chaptersSinceLastGate < finalConfig.minimumChapterGap && lastGateChapter > 0) {
    return createNoTriggerResult(
      `Only ${chaptersSinceLastGate} chapters since last gate (minimum: ${finalConfig.minimumChapterGap})`
    );
  }
  
  // Get active arc and threads
  const activeArc = state.plotLedger.find(a => a.status === 'active') || null;
  const activeThreads = (state.storyThreads || []).filter(
    t => t.status === 'active' || t.status === 'paused'
  );
  const criticalThreads = activeThreads.filter(t => t.priority === 'critical');
  
  // Get recent chapters for content analysis
  const recentChapters = state.chapters.slice(-3);
  
  // Find protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist) || state.characterCodex[0];
  const protagonistName = protagonist?.name || 'the protagonist';
  
  // Get sensitivity thresholds
  const thresholds = SENSITIVITY_THRESHOLDS[finalConfig.triggerSensitivity];
  
  // Initialize detection scores
  let totalConfidence = 0;
  let detectedTrigger: TribulationTrigger | null = null;
  let situation = '';
  let context = '';
  const reasons: string[] = [];
  const relatedThreadIds: string[] = [];
  let arcId: string | undefined;
  
  // 1. Analyze user instruction for trigger keywords
  const instructionLower = userInstruction.toLowerCase();
  const instructionTrigger = detectTriggerFromText(instructionLower, finalConfig.excludedTriggers);
  
  if (instructionTrigger.trigger) {
    totalConfidence += thresholds.keywordMatchBonus * instructionTrigger.matchCount;
    detectedTrigger = instructionTrigger.trigger;
    reasons.push(`User instruction contains ${instructionTrigger.matchCount} keyword(s) for "${instructionTrigger.trigger}"`);
    situation = generateSituationFromInstruction(userInstruction, instructionTrigger.trigger, protagonistName);
  }
  
  // 2. Analyze arc phase from beat sheet
  if (beatSheet) {
    const arcPhase = beatSheet.arcPosition.arcPhase;
    arcId = beatSheet.arcId;
    
    if (HIGH_TRIGGER_ARC_PHASES.includes(arcPhase)) {
      totalConfidence += thresholds.arcPhaseBonus;
      reasons.push(`Arc is in ${arcPhase} phase`);
      
      // If we haven't detected a trigger yet, infer from arc phase
      if (!detectedTrigger) {
        if (arcPhase === 'climax' || arcPhase === 'climax_approach') {
          detectedTrigger = 'major_confrontation';
        } else if (arcPhase === 'midpoint') {
          detectedTrigger = 'identity_revelation';
        }
      }
    }
    
    // Check beat types
    const significantBeats = beatSheet.beats.filter(b => 
      SIGNIFICANT_BEAT_TYPES.includes(b.type) && b.mandatory
    );
    
    if (significantBeats.length > 0) {
      totalConfidence += thresholds.beatTypeBonus * Math.min(significantBeats.length, 2);
      reasons.push(`Beat sheet contains ${significantBeats.length} significant mandatory beats`);
      
      // Infer trigger from beat type if not already set
      if (!detectedTrigger) {
        const breakthroughBeat = significantBeats.find(b => b.type === 'breakthrough');
        const revelationBeat = significantBeats.find(b => b.type === 'revelation');
        const actionBeat = significantBeats.find(b => b.type === 'action');
        
        if (breakthroughBeat) {
          detectedTrigger = 'realm_breakthrough';
        } else if (revelationBeat) {
          detectedTrigger = 'identity_revelation';
        } else if (actionBeat) {
          detectedTrigger = 'major_confrontation';
        }
      }
    }
    
    // Climax protection suggests major moment
    if (beatSheet.climaxProtection?.isClimaxProximate) {
      totalConfidence += 15;
      reasons.push('Climax protection is active');
    }
  }
  
  // 3. Analyze critical threads
  if (criticalThreads.length > 0) {
    // Check for threads that might be approaching resolution
    const longRunningCritical = criticalThreads.filter(t => {
      const chaptersActive = nextChapterNumber - t.introducedChapter;
      return chaptersActive >= 10; // Been active for at least 10 chapters
    });
    
    if (longRunningCritical.length > 0) {
      totalConfidence += thresholds.threadBonus * Math.min(longRunningCritical.length, 2);
      reasons.push(`${longRunningCritical.length} long-running critical thread(s) may need resolution`);
      relatedThreadIds.push(...longRunningCritical.map(t => t.id));
      
      // Infer trigger from thread type if not already set
      if (!detectedTrigger && longRunningCritical.length > 0) {
        const thread = longRunningCritical[0];
        detectedTrigger = mapThreadTypeToTrigger(thread.type);
      }
    }
  }
  
  // 4. Analyze recent chapter content
  if (recentChapters.length > 0) {
    const recentContent = recentChapters.map(c => c.content).join(' ').toLowerCase();
    const contentTrigger = detectTriggerFromText(recentContent.slice(-5000), finalConfig.excludedTriggers);
    
    if (contentTrigger.trigger && contentTrigger.matchCount >= 3) {
      totalConfidence += thresholds.keywordMatchBonus * 0.5;
      reasons.push(`Recent chapters contain ${contentTrigger.matchCount} keywords for "${contentTrigger.trigger}"`);
      
      if (!detectedTrigger) {
        detectedTrigger = contentTrigger.trigger;
      }
    }
    
    // Check for cliffhanger in last chapter
    const lastChapter = recentChapters[recentChapters.length - 1];
    if (lastChapter) {
      const lastContent = lastChapter.content.toLowerCase();
      const lastParagraph = lastContent.slice(-500);
      
      // Check for dramatic cliffhanger indicators
      const cliffhangerIndicators = [
        'to be continued',
        'what will',
        'the choice',
        'decision',
        'moment of truth',
        'no turning back',
        'point of no return',
        'fate',
        'destiny',
      ];
      
      const hasCliffhanger = cliffhangerIndicators.some(ind => lastParagraph.includes(ind));
      if (hasCliffhanger) {
        totalConfidence += 10;
        reasons.push('Previous chapter ended with cliffhanger indicators');
      }
    }
  }
  
  // 5. Check chapter milestone (every 50 chapters is a good spot for a major decision)
  if (nextChapterNumber % 50 === 0 && nextChapterNumber > 0) {
    totalConfidence += 15;
    reasons.push(`Chapter ${nextChapterNumber} is a milestone chapter`);
  }
  
  // Generate situation and context if we have a trigger
  if (detectedTrigger && !situation) {
    situation = generateDefaultSituation(detectedTrigger, protagonistName, activeArc);
  }
  
  context = generateContext(
    detectedTrigger,
    activeArc,
    criticalThreads,
    beatSheet,
    reasons
  );
  
  // Final decision
  const shouldTrigger = totalConfidence >= thresholds.minConfidence && detectedTrigger !== null;
  
  logger.debug('Tribulation Gate detection result', 'tribulationGate', {
    nextChapterNumber,
    totalConfidence,
    minConfidence: thresholds.minConfidence,
    shouldTrigger,
    detectedTrigger,
    reasons,
  });
  
  return {
    shouldTrigger,
    triggerType: shouldTrigger ? detectedTrigger : null,
    situation,
    context,
    protagonistName,
    confidence: totalConfidence,
    reason: shouldTrigger 
      ? `Gate triggered: ${reasons.join('; ')}`
      : `Not triggered (confidence ${totalConfidence}/${thresholds.minConfidence}): ${reasons.join('; ') || 'No significant triggers detected'}`,
    relatedThreadIds: relatedThreadIds.length > 0 ? relatedThreadIds : undefined,
    arcId,
  };
}

/**
 * Detect trigger type from text content
 */
function detectTriggerFromText(
  text: string,
  excludedTriggers?: TribulationTrigger[]
): { trigger: TribulationTrigger | null; matchCount: number } {
  let bestTrigger: TribulationTrigger | null = null;
  let maxMatches = 0;
  
  for (const [trigger, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
    if (excludedTriggers?.includes(trigger as TribulationTrigger)) {
      continue;
    }
    
    let matchCount = 0;
    for (const keyword of keywords) {
      // Count occurrences of each keyword
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = text.match(regex);
      if (matches) {
        matchCount += matches.length;
      }
    }
    
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      bestTrigger = trigger as TribulationTrigger;
    }
  }
  
  return { trigger: bestTrigger, matchCount: maxMatches };
}

/**
 * Map story thread type to appropriate trigger type
 */
function mapThreadTypeToTrigger(threadType: string): TribulationTrigger {
  const mapping: Record<string, TribulationTrigger> = {
    enemy: 'major_confrontation',
    technique: 'forbidden_technique',
    item: 'treasure_discovery',
    location: 'sect_choice',
    sect: 'sect_choice',
    promise: 'sacrifice_moment',
    mystery: 'identity_revelation',
    relationship: 'marriage_proposal',
    power: 'realm_breakthrough',
    quest: 'treasure_discovery',
    revelation: 'identity_revelation',
    conflict: 'major_confrontation',
    alliance: 'alliance_decision',
  };
  
  return mapping[threadType] || 'major_confrontation';
}

/**
 * Generate situation description from user instruction
 */
function generateSituationFromInstruction(
  instruction: string,
  trigger: TribulationTrigger,
  protagonistName: string
): string {
  // Extract key phrases from instruction
  const cleanInstruction = instruction.trim();
  
  if (cleanInstruction.length > 20) {
    return `${protagonistName} faces a pivotal moment: ${cleanInstruction}`;
  }
  
  return generateDefaultSituation(trigger, protagonistName, null);
}

/**
 * Generate default situation based on trigger type
 */
function generateDefaultSituation(
  trigger: TribulationTrigger,
  protagonistName: string,
  arc: Arc | null
): string {
  const arcContext = arc ? ` during the ${arc.title}` : '';
  
  const situations: Record<TribulationTrigger, string> = {
    realm_breakthrough: `${protagonistName} stands at the threshold of a breakthrough${arcContext}. The heavenly tribulation gathers, and a choice must be made.`,
    life_death_crisis: `${protagonistName} faces mortal danger${arcContext}. Death looms close, but there may be paths to survival.`,
    major_confrontation: `${protagonistName} must face their adversary${arcContext}. The time for the final confrontation has arrived.`,
    alliance_decision: `${protagonistName} must choose their allies${arcContext}. This decision will shape the future of many.`,
    treasure_discovery: `${protagonistName} has discovered a powerful artifact${arcContext}. Its fate—and their own—hangs in the balance.`,
    identity_revelation: `${protagonistName} faces a moment of truth${arcContext}. To reveal or conceal—either choice carries weight.`,
    marriage_proposal: `${protagonistName} stands at a crossroads of the heart${arcContext}. Matters of love and duty intertwine.`,
    sect_choice: `${protagonistName} must decide their path within the cultivation world${arcContext}. Loyalty and ambition clash.`,
    forbidden_technique: `${protagonistName} is tempted by forbidden power${arcContext}. Great power comes with great cost.`,
    sacrifice_moment: `${protagonistName} must consider a sacrifice${arcContext}. What they hold dear may be the price.`,
    dao_comprehension: `${protagonistName} touches the edge of enlightenment${arcContext}. Different paths of understanding beckon.`,
    inheritance_acceptance: `${protagonistName} has been offered a legacy${arcContext}. To accept is to take on a mantle of great responsibility.`,
  };
  
  return situations[trigger] || `${protagonistName} faces a critical decision${arcContext}.`;
}

/**
 * Generate context for the tribulation gate
 */
function generateContext(
  trigger: TribulationTrigger | null,
  arc: Arc | null,
  criticalThreads: StoryThread[],
  beatSheet: DirectorBeatSheet | null,
  reasons: string[]
): string {
  const contextParts: string[] = [];
  
  if (arc) {
    contextParts.push(`Current Arc: ${arc.title}`);
    if (beatSheet) {
      contextParts.push(`Arc Progress: ${beatSheet.arcProgressPercent.toFixed(0)}% (${beatSheet.arcPosition.arcPhase})`);
    }
  }
  
  if (criticalThreads.length > 0) {
    contextParts.push(`Critical Threads: ${criticalThreads.map(t => t.title).slice(0, 3).join(', ')}`);
  }
  
  if (reasons.length > 0) {
    contextParts.push(`Detection Signals: ${reasons.slice(0, 3).join(', ')}`);
  }
  
  return contextParts.join(' | ');
}

/**
 * Create a no-trigger result
 */
function createNoTriggerResult(reason: string): TribulationDetectionResult {
  return {
    shouldTrigger: false,
    triggerType: null,
    situation: '',
    context: '',
    protagonistName: '',
    confidence: 0,
    reason,
  };
}

/**
 * Check if a specific chapter should have a gate based on story analysis
 * This is a more thorough analysis for manual checking
 */
export function analyzeChapterForGate(
  state: NovelState,
  chapterNumber: number,
  config: Partial<TribulationGateConfig> = {}
): TribulationDetectionResult {
  const chapter = state.chapters.find(c => c.number === chapterNumber);
  if (!chapter) {
    return createNoTriggerResult('Chapter not found');
  }
  
  const finalConfig = { ...DEFAULT_TRIBULATION_GATE_CONFIG, ...config };
  const thresholds = SENSITIVITY_THRESHOLDS[finalConfig.triggerSensitivity];
  
  // Analyze chapter content
  const contentLower = chapter.content.toLowerCase();
  const contentTrigger = detectTriggerFromText(contentLower, finalConfig.excludedTriggers);
  
  // Find protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist) || state.characterCodex[0];
  const protagonistName = protagonist?.name || 'the protagonist';
  
  let confidence = 0;
  const reasons: string[] = [];
  
  if (contentTrigger.trigger && contentTrigger.matchCount >= 2) {
    confidence += thresholds.keywordMatchBonus * Math.min(contentTrigger.matchCount / 2, 2);
    reasons.push(`Chapter contains ${contentTrigger.matchCount} keywords for "${contentTrigger.trigger}"`);
  }
  
  // Check chapter ending for cliffhanger
  const lastParagraph = contentLower.slice(-500);
  const hasCliffhanger = [
    'what will', 'decision', 'choice', 'moment of truth',
    'must choose', 'fate', 'destiny', 'no turning back'
  ].some(ind => lastParagraph.includes(ind));
  
  if (hasCliffhanger) {
    confidence += 15;
    reasons.push('Chapter ends with decision/cliffhanger indicators');
  }
  
  const shouldTrigger = confidence >= thresholds.minConfidence && contentTrigger.trigger !== null;
  
  return {
    shouldTrigger,
    triggerType: shouldTrigger ? contentTrigger.trigger : null,
    situation: shouldTrigger 
      ? generateDefaultSituation(contentTrigger.trigger!, protagonistName, null)
      : '',
    context: reasons.join(' | '),
    protagonistName,
    confidence,
    reason: shouldTrigger
      ? `Gate suitable: ${reasons.join('; ')}`
      : `Not suitable (confidence ${confidence}/${thresholds.minConfidence}): ${reasons.join('; ') || 'No significant triggers detected'}`,
  };
}
