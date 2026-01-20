/**
 * Beat Sheet Generator
 * 
 * Genre-aware beat generation with specific rules for Xianxia/Xuanhuan novels.
 * Manages tension curves and implements climax protection to prevent
 * premature resolution of major plot points.
 */

import { NovelState, Arc, Chapter, StoryThread } from '../../types';
import {
  MicroBeat,
  MicroBeatType,
  PacingGuidance,
  ClimaxProtection,
  ArcPositionAnalysis,
  XianxiaPacingRules,
  DEFAULT_XIANXIA_PACING_RULES,
} from '../../types/director';
import { generateUUID } from '../../utils/uuid';

/**
 * Beat templates for different arc phases
 */
interface PhaseTemplate {
  preferredBeats: MicroBeatType[];
  tensionRange: [number, number];
  pacingRange: [PacingGuidance['overallPace'], PacingGuidance['overallPace']];
  requiresCliffhanger: boolean;
  notes: string[];
}

const PHASE_TEMPLATES: Record<ArcPositionAnalysis['arcPhase'], PhaseTemplate> = {
  opening: {
    preferredBeats: ['setup', 'revelation', 'foreshadow', 'reflection'],
    tensionRange: [20, 40],
    pacingRange: ['slow', 'moderate'],
    requiresCliffhanger: false,
    notes: [
      'Establish setting and stakes',
      'Introduce key players and conflicts',
      'Plant seeds for future developments',
    ],
  },
  rising_action: {
    preferredBeats: ['tension', 'action', 'escalation', 'revelation', 'setback'],
    tensionRange: [40, 60],
    pacingRange: ['moderate', 'fast'],
    requiresCliffhanger: true,
    notes: [
      'Build momentum and stakes',
      'Deepen character relationships',
      'Introduce complications',
    ],
  },
  midpoint: {
    preferredBeats: ['revelation', 'breakthrough', 'escalation', 'setback'],
    tensionRange: [50, 70],
    pacingRange: ['moderate', 'fast'],
    requiresCliffhanger: true,
    notes: [
      'Major revelation or shift in dynamics',
      'Point of no return for characters',
      'Stakes become personal',
    ],
  },
  escalation: {
    preferredBeats: ['escalation', 'tension', 'action', 'setback', 'breakthrough'],
    tensionRange: [60, 80],
    pacingRange: ['fast', 'breakneck'],
    requiresCliffhanger: true,
    notes: [
      'Rapidly escalating conflicts',
      'Characters pushed to limits',
      'Alliances tested',
    ],
  },
  climax_approach: {
    preferredBeats: ['tension', 'escalation', 'revelation', 'action'],
    tensionRange: [70, 90],
    pacingRange: ['fast', 'breakneck'],
    requiresCliffhanger: true,
    notes: [
      'DO NOT RESOLVE MAJOR CONFLICTS YET',
      'Build toward inevitable confrontation',
      'All threads converging',
    ],
  },
  climax: {
    preferredBeats: ['action', 'escalation', 'breakthrough', 'revelation'],
    tensionRange: [85, 100],
    pacingRange: ['breakneck', 'breakneck'],
    requiresCliffhanger: false,
    notes: [
      'Maximum tension and action',
      'Major confrontations occur',
      'Key resolutions begin',
    ],
  },
  resolution: {
    preferredBeats: ['release', 'reflection', 'revelation', 'setup'],
    tensionRange: [30, 50],
    pacingRange: ['slow', 'moderate'],
    requiresCliffhanger: false,
    notes: [
      'Resolve remaining threads',
      'Character processing',
      'Setup for next arc',
    ],
  },
};

/**
 * Xianxia-specific beat patterns for common scenarios
 */
interface XianxiaScenarioPattern {
  triggerKeywords: string[];
  beatSequence: MicroBeatType[];
  minimumChapters: number;
  pacingNotes: string[];
}

const XIANXIA_SCENARIO_PATTERNS: Record<string, XianxiaScenarioPattern> = {
  breakthrough: {
    triggerKeywords: ['breakthrough', 'advance', 'realm', 'tribulation', 'ascend'],
    beatSequence: ['setup', 'tension', 'escalation', 'action', 'breakthrough', 'release'],
    minimumChapters: 2,
    pacingNotes: [
      'Breakthroughs should feel earned, not rushed',
      'Include internal struggle and external manifestation',
      'Show world reaction to breakthrough',
    ],
  },
  tribulation: {
    triggerKeywords: ['tribulation', 'lightning', 'heavenly punishment', 'divine trial'],
    beatSequence: ['setup', 'tension', 'escalation', 'action', 'setback', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Tribulations must feel life-threatening',
      'Multiple waves of escalating difficulty',
      'Near-death moment before breakthrough',
    ],
  },
  tournament: {
    triggerKeywords: ['tournament', 'competition', 'trial', 'contest', 'sect exam'],
    beatSequence: ['setup', 'action', 'tension', 'revelation', 'escalation'],
    minimumChapters: 3,
    pacingNotes: [
      'Each round deserves proper attention',
      'Build rivalries through matches',
      'Reserve strongest opponents for later rounds',
    ],
  },
  alchemy: {
    triggerKeywords: ['alchemy', 'pill', 'concoct', 'refine', 'cauldron', 'elixir'],
    beatSequence: ['setup', 'tension', 'escalation', 'setback', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Show the technical process',
      'Include unexpected complications',
      'Build suspense around success/failure',
    ],
  },
  pill_refining: {
    triggerKeywords: ['pill furnace', 'medicinal herbs', 'refining pill', 'concoction', 'pill cauldron', 'flame control'],
    beatSequence: ['setup', 'tension', 'setback', 'escalation', 'breakthrough', 'release'],
    minimumChapters: 2,
    pacingNotes: [
      'Detail the preparation of ingredients',
      'Show the delicate flame control required',
      'Include a near-failure moment that tests skill',
      'Reveal the quality of the result dramatically',
    ],
  },
  auction: {
    triggerKeywords: ['auction', 'bid', 'auction house', 'highest bidder', 'going once'],
    beatSequence: ['setup', 'tension', 'escalation', 'revelation', 'action', 'cliffhanger'],
    minimumChapters: 2,
    pacingNotes: [
      'Build anticipation for key items before they appear',
      'Introduce wealthy/powerful competitors',
      'Create bidding wars with meaningful stakes',
      'Include unexpected valuable items',
      'End with consequences of winning/losing bids',
    ],
  },
  formation_battle: {
    triggerKeywords: ['formation', 'array', 'barrier', 'seal', 'formation master', 'break the formation'],
    beatSequence: ['setup', 'tension', 'revelation', 'action', 'setback', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Describe the formation visually and mechanically',
      'Show the danger of wrong moves',
      'Include discovery of formation weaknesses',
      'Build to a dramatic breakthrough moment',
    ],
  },
  inheritance: {
    triggerKeywords: ['inheritance', 'legacy', 'ancient master', 'cave dwelling', 'secret technique', 'remnant will'],
    beatSequence: ['setup', 'tension', 'revelation', 'escalation', 'breakthrough', 'foreshadow'],
    minimumChapters: 3,
    pacingNotes: [
      'Create sense of ancient power and mystery',
      'Include trials to prove worthiness',
      'Reveal tragic backstory of the master',
      'The inheritance should come with responsibility or danger',
    ],
  },
  beast_taming: {
    triggerKeywords: ['spirit beast', 'tame', 'contract', 'beast companion', 'monster', 'demonic beast'],
    beatSequence: ['setup', 'action', 'setback', 'revelation', 'tension', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Show the beast\'s power and danger',
      'Include failed attempts at taming',
      'Create mutual respect between beast and cultivator',
      'The bond should feel earned, not given',
    ],
  },
  dual_cultivation: {
    triggerKeywords: ['dual cultivation', 'yin yang', 'partner cultivation', 'cultivation partner'],
    beatSequence: ['setup', 'tension', 'reflection', 'escalation', 'breakthrough', 'release'],
    minimumChapters: 2,
    pacingNotes: [
      'Build emotional connection first',
      'Show vulnerability and trust',
      'Include the synchronization of energies',
      'Mutual benefit should be clear',
    ],
  },
  revenge: {
    triggerKeywords: ['revenge', 'grudge', 'enemy', 'avenge', 'payback'],
    beatSequence: ['setup', 'tension', 'revelation', 'escalation', 'action'],
    minimumChapters: 5,
    pacingNotes: [
      'DO NOT rush to confrontation',
      'Build the grudge over multiple chapters',
      'Show preparation and planning',
      'Confrontation should feel earned',
    ],
  },
  seclusion: {
    triggerKeywords: ['seclusion', 'closed-door', 'cultivation', 'meditat', 'retreat'],
    beatSequence: ['setup', 'reflection', 'tension', 'breakthrough'],
    minimumChapters: 1,
    pacingNotes: [
      'Internal struggle and growth',
      'Time skip handled gracefully',
      'Show concrete gains from seclusion',
    ],
  },
  exploration: {
    triggerKeywords: ['secret realm', 'ancient tomb', 'forbidden zone', 'explore', 'dungeon', 'mystic realm'],
    beatSequence: ['setup', 'tension', 'revelation', 'action', 'setback', 'breakthrough'],
    minimumChapters: 4,
    pacingNotes: [
      'Progressive discovery of dangers',
      'Layer mysteries and rewards',
      'Include rival explorers',
      'Ancient secrets should unfold gradually',
    ],
  },
  sect_conflict: {
    triggerKeywords: ['sect war', 'sect conflict', 'inter-sect', 'enemy sect', 'sect battle', 'faction war'],
    beatSequence: ['setup', 'tension', 'escalation', 'action', 'setback', 'revelation'],
    minimumChapters: 5,
    pacingNotes: [
      'Establish stakes for both sides',
      'Show the political maneuvering',
      'Include betrayals and alliances',
      'Personal stakes amid larger conflict',
      'Victory should feel costly',
    ],
  },
  face_slapping: {
    triggerKeywords: ['face slap', 'humiliate', 'arrogant', 'young master', 'courting death', 'trash'],
    beatSequence: ['setup', 'tension', 'revelation', 'action', 'release'],
    minimumChapters: 1,
    pacingNotes: [
      'Build up the arrogant antagonist properly',
      'Show their mockery and disdain',
      'The reversal should be satisfying but not instant',
      'Include crowd reaction for maximum effect',
    ],
  },
  contract_spirit: {
    triggerKeywords: ['artifact spirit', 'weapon spirit', 'tool spirit', 'ring spirit', 'sentient artifact'],
    beatSequence: ['setup', 'revelation', 'tension', 'reflection', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Reveal the spirit\'s personality gradually',
      'Include tests of character',
      'Build a unique dynamic between MC and spirit',
      'The spirit should have its own agenda',
    ],
  },
  marriage_alliance: {
    triggerKeywords: ['marriage', 'engagement', 'betrothal', 'wedding', 'political marriage', 'arranged marriage'],
    beatSequence: ['setup', 'tension', 'revelation', 'escalation', 'action', 'cliffhanger'],
    minimumChapters: 3,
    pacingNotes: [
      'Explore the political implications',
      'Character feelings should conflict with duty',
      'Include opposition from various parties',
      'Build romantic tension if applicable',
    ],
  },
  poison_crisis: {
    triggerKeywords: ['poison', 'toxin', 'antidote', 'poisoned', 'venom', 'detoxify'],
    beatSequence: ['setup', 'tension', 'escalation', 'setback', 'revelation', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Create urgency with time limit',
      'Show symptoms worsening',
      'Quest for cure should have obstacles',
      'Resolution should advance character or plot',
    ],
  },
  identity_reveal: {
    triggerKeywords: ['true identity', 'hidden identity', 'secret past', 'reveal himself', 'unmask', 'disguise'],
    beatSequence: ['setup', 'tension', 'foreshadow', 'escalation', 'revelation', 'release'],
    minimumChapters: 2,
    pacingNotes: [
      'Build anticipation for the reveal',
      'Plant clues beforehand',
      'Show multiple characters\' reactions',
      'The reveal should change relationships',
    ],
  },
  treasure_awakening: {
    triggerKeywords: ['treasure awakening', 'artifact awakening', 'weapon upgrade', 'evolve', 'transform'],
    beatSequence: ['setup', 'tension', 'revelation', 'breakthrough', 'foreshadow'],
    minimumChapters: 1,
    pacingNotes: [
      'Show the trigger for awakening',
      'Describe the transformation vividly',
      'New abilities should have narrative weight',
      'Hint at further potential',
    ],
  },
  life_death_battle: {
    triggerKeywords: ['life and death', 'mortal combat', 'death match', 'fight to the death', 'no retreat'],
    beatSequence: ['setup', 'tension', 'action', 'setback', 'escalation', 'breakthrough'],
    minimumChapters: 2,
    pacingNotes: [
      'Stakes must be absolute - no easy escape',
      'Both sides should show full power',
      'Include moments where defeat seems certain',
      'Victory should come at a cost',
    ],
  },
  dao_comprehension: {
    triggerKeywords: ['comprehend', 'dao', 'enlightenment', 'insight', 'epiphany', 'laws of heaven'],
    beatSequence: ['setup', 'reflection', 'tension', 'revelation', 'breakthrough'],
    minimumChapters: 1,
    pacingNotes: [
      'Show the struggle to understand',
      'Use vivid imagery for abstract concepts',
      'Connect comprehension to character journey',
      'The insight should feel profound, not exposition',
    ],
  },
  merchant_negotiation: {
    triggerKeywords: ['merchant', 'trade', 'negotiate', 'purchase', 'shop', 'seller', 'buyer'],
    beatSequence: ['setup', 'tension', 'revelation', 'action'],
    minimumChapters: 1,
    pacingNotes: [
      'Show the value of what\'s being traded',
      'Include negotiation tactics',
      'Potential for deception or hidden value',
      'Consequences of the deal',
    ],
  },
};

/**
 * Generate beats based on arc phase and context
 */
export function generatePhaseBeats(
  arcPosition: ArcPositionAnalysis,
  recentChapters: Chapter[],
  activeThreads: StoryThread[],
  userInstruction?: string
): MicroBeat[] {
  const template = PHASE_TEMPLATES[arcPosition.arcPhase];
  const beats: MicroBeat[] = [];
  
  // Detect if we're in a specific Xianxia scenario
  const detectedScenario = detectXianxiaScenario(userInstruction, recentChapters);
  const scenarioPattern = detectedScenario ? XIANXIA_SCENARIO_PATTERNS[detectedScenario] : null;
  
  // Use scenario pattern if detected, otherwise use phase template
  const beatSequence = scenarioPattern?.beatSequence || selectBeatSequence(template, arcPosition);
  
  // Generate beats from sequence
  for (let i = 0; i < beatSequence.length; i++) {
    const beatType = beatSequence[i];
    beats.push({
      id: generateUUID(),
      order: i + 1,
      type: beatType,
      description: generateBeatDescription(beatType, arcPosition, i, beatSequence.length),
      mandatory: i < 3, // First 3 beats are mandatory
      targetWordCount: calculateBeatWordCount(beatType, i, beatSequence.length),
      emotionalTone: selectEmotionalTone(beatType, arcPosition.arcPhase),
    });
  }
  
  // Ensure cliffhanger if required
  if (template.requiresCliffhanger && beats[beats.length - 1]?.type !== 'cliffhanger') {
    beats.push({
      id: generateUUID(),
      order: beats.length + 1,
      type: 'cliffhanger',
      description: 'End with a compelling hook for the next chapter',
      mandatory: true,
      targetWordCount: 200,
      emotionalTone: 'tense',
    });
  }
  
  return beats;
}

/**
 * Detect if user instruction or recent content suggests a Xianxia scenario
 */
function detectXianxiaScenario(
  userInstruction: string | undefined,
  recentChapters: Chapter[]
): string | null {
  const textToAnalyze = [
    userInstruction || '',
    ...recentChapters.slice(-2).map(ch => ch.summary || ch.content.slice(-500)),
  ].join(' ').toLowerCase();
  
  for (const [scenario, pattern] of Object.entries(XIANXIA_SCENARIO_PATTERNS)) {
    for (const keyword of pattern.triggerKeywords) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        return scenario;
      }
    }
  }
  
  return null;
}

/**
 * Select beat sequence based on phase template
 */
function selectBeatSequence(
  template: PhaseTemplate,
  arcPosition: ArcPositionAnalysis
): MicroBeatType[] {
  const sequence: MicroBeatType[] = [];
  const availableBeats = [...template.preferredBeats];
  
  // Start with setup for opening phases, tension for later phases
  if (arcPosition.arcPhase === 'opening' || arcPosition.arcPhase === 'resolution') {
    sequence.push('setup');
  } else {
    sequence.push(availableBeats[0] || 'tension');
  }
  
  // Add 4-6 more beats from preferred beats
  const targetBeats = Math.min(6, availableBeats.length + 2);
  while (sequence.length < targetBeats) {
    const nextBeat = availableBeats[sequence.length % availableBeats.length];
    // Avoid immediate repetition
    if (nextBeat !== sequence[sequence.length - 1]) {
      sequence.push(nextBeat);
    } else {
      const alternative = availableBeats[(sequence.length + 1) % availableBeats.length];
      sequence.push(alternative);
    }
  }
  
  return sequence;
}

/**
 * Generate description for a beat type
 */
function generateBeatDescription(
  beatType: MicroBeatType,
  arcPosition: ArcPositionAnalysis,
  beatIndex: number,
  totalBeats: number
): string {
  const isFirst = beatIndex === 0;
  const isLast = beatIndex === totalBeats - 1;
  
  const descriptions: Record<MicroBeatType, () => string> = {
    setup: () => isFirst 
      ? 'Establish the scene and current situation' 
      : 'Set up the next development',
    tension: () => `Build ${arcPosition.arcPhase === 'climax' ? 'maximum' : 'rising'} tension`,
    release: () => 'Provide momentary relief from tension',
    cliffhanger: () => 'End with a compelling hook',
    revelation: () => 'Reveal new information that changes the situation',
    action: () => 'Dynamic action sequence advancing the conflict',
    reflection: () => 'Character processing recent events',
    escalation: () => `Escalate stakes ${isLast ? 'dramatically' : 'significantly'}`,
    breakthrough: () => 'Major advancement or achievement moment',
    setback: () => 'Obstacle or failure that increases tension',
    foreshadow: () => 'Plant subtle seeds for future developments',
  };
  
  return descriptions[beatType]();
}

/**
 * Calculate target word count for a beat
 */
function calculateBeatWordCount(
  beatType: MicroBeatType,
  beatIndex: number,
  totalBeats: number
): number {
  const baseWordCounts: Record<MicroBeatType, number> = {
    setup: 500,
    tension: 600,
    release: 300,
    cliffhanger: 200,
    revelation: 500,
    action: 800,
    reflection: 400,
    escalation: 600,
    breakthrough: 700,
    setback: 500,
    foreshadow: 300,
  };
  
  // Main beats in the middle get more words
  const positionMultiplier = (beatIndex > 0 && beatIndex < totalBeats - 1) ? 1.2 : 1.0;
  
  return Math.round(baseWordCounts[beatType] * positionMultiplier);
}

/**
 * Select emotional tone based on beat type and arc phase
 */
function selectEmotionalTone(
  beatType: MicroBeatType,
  arcPhase: ArcPositionAnalysis['arcPhase']
): MicroBeat['emotionalTone'] | undefined {
  const toneMap: Record<MicroBeatType, Record<string, MicroBeat['emotionalTone']>> = {
    setup: { default: undefined, resolution: 'hopeful' },
    tension: { default: 'tense', climax: 'desperate' },
    release: { default: undefined, climax: 'hopeful' },
    cliffhanger: { default: 'tense', opening: 'mysterious' },
    revelation: { default: 'mysterious', climax: 'triumphant' },
    action: { default: 'tense', climax: 'desperate' },
    reflection: { default: 'melancholic', resolution: 'hopeful' },
    escalation: { default: 'tense', climax_approach: 'desperate' },
    breakthrough: { default: 'triumphant' },
    setback: { default: 'desperate', opening: 'tense' },
    foreshadow: { default: 'mysterious' },
  };
  
  const beatTones = toneMap[beatType];
  return beatTones[arcPhase] || beatTones.default;
}

/**
 * Generate pacing guidance based on arc phase
 */
export function generatePacingGuidance(
  arcPosition: ArcPositionAnalysis,
  beats: MicroBeat[],
  rules: XianxiaPacingRules = DEFAULT_XIANXIA_PACING_RULES
): PacingGuidance {
  const template = PHASE_TEMPLATES[arcPosition.arcPhase];
  
  // Calculate total target words from beats
  const beatsWordCount = beats.reduce((sum, beat) => sum + (beat.targetWordCount || 400), 0);
  const targetWordCount = Math.max(2500, beatsWordCount);
  
  // Select pace based on phase
  const paceIndex = Math.min(1, Math.floor(arcPosition.progressPercent / 50));
  const overallPace = template.pacingRange[paceIndex];
  
  // Calculate tension levels
  const [minTension, maxTension] = template.tensionRange;
  const tensionProgress = arcPosition.progressPercent / 100;
  const startingTensionLevel = Math.round(minTension + (maxTension - minTension) * tensionProgress * 0.8);
  const endingTensionLevel = Math.round(minTension + (maxTension - minTension) * Math.min(1, tensionProgress + 0.1));
  
  return {
    overallPace,
    targetWordCount,
    minimumWordCount: Math.floor(targetWordCount * 0.7),
    maximumWordCount: Math.floor(targetWordCount * 1.4),
    startingTensionLevel,
    endingTensionLevel,
    requiresCliffhanger: template.requiresCliffhanger,
    pacingNotes: [...template.notes],
  };
}

/**
 * Generate climax protection rules
 */
export function generateClimaxProtection(
  arcPosition: ArcPositionAnalysis,
  activeThreads: StoryThread[],
  rules: XianxiaPacingRules = DEFAULT_XIANXIA_PACING_RULES
): ClimaxProtection | undefined {
  // Only activate climax protection in approach and climax phases
  if (!['climax_approach', 'escalation'].includes(arcPosition.arcPhase)) {
    return undefined;
  }
  
  // Calculate chapters until climax
  const chaptersUntilClimax = Math.ceil(
    (100 - arcPosition.progressPercent) / 100 * arcPosition.targetChapters
  );
  
  // Identify critical threads that should not be resolved yet
  const protectedThreadIds = activeThreads
    .filter(t => t.priority === 'critical' || t.priority === 'high')
    .map(t => t.id);
  
  // Build protected conflicts list from remaining checklist items
  const protectedConflicts = arcPosition.remainingChecklistItems.slice(0, 5);
  
  return {
    isClimaxProximate: true,
    protectedThreadIds,
    protectedConflicts,
    minimumChaptersUntilResolution: Math.max(1, chaptersUntilClimax - 1),
    warningMessage: generateClimaxWarning(arcPosition, chaptersUntilClimax),
  };
}

/**
 * Generate warning message for climax protection
 */
function generateClimaxWarning(
  arcPosition: ArcPositionAnalysis,
  chaptersUntilClimax: number
): string {
  if (chaptersUntilClimax <= 2) {
    return `⚠️ CLIMAX IMMINENT (${chaptersUntilClimax} chapters). DO NOT resolve major conflicts yet. Build maximum tension.`;
  }
  
  if (arcPosition.arcPhase === 'climax_approach') {
    return `🎭 CLIMAX APPROACHING. Maintain tension escalation. Major resolutions in ${chaptersUntilClimax}+ chapters.`;
  }
  
  return `📈 ESCALATION PHASE. Continue building stakes. Avoid premature resolutions.`;
}

/**
 * Get Xianxia scenario pacing notes if applicable
 */
export function getXianxiaScenarioNotes(
  userInstruction: string | undefined,
  recentChapters: Chapter[]
): string[] {
  const scenario = detectXianxiaScenario(userInstruction, recentChapters);
  
  if (scenario && XIANXIA_SCENARIO_PATTERNS[scenario]) {
    return [
      `XIANXIA SCENARIO DETECTED: ${scenario.toUpperCase()}`,
      `Minimum chapters for this scenario: ${XIANXIA_SCENARIO_PATTERNS[scenario].minimumChapters}`,
      ...XIANXIA_SCENARIO_PATTERNS[scenario].pacingNotes,
    ];
  }
  
  return [];
}

/**
 * Validate beat sheet against Xianxia pacing rules
 */
export function validateBeatSheet(
  beats: MicroBeat[],
  arcPosition: ArcPositionAnalysis,
  rules: XianxiaPacingRules = DEFAULT_XIANXIA_PACING_RULES
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Check for breakthrough protection
  if (rules.protectBreakthroughs) {
    const hasBreakthrough = beats.some(b => b.type === 'breakthrough');
    const hasProperSetup = beats.slice(0, -1).some(b => b.type === 'tension' || b.type === 'escalation');
    
    if (hasBreakthrough && !hasProperSetup) {
      warnings.push('Breakthrough detected without proper tension buildup');
    }
  }
  
  // Check for action overload
  const actionCount = beats.filter(b => b.type === 'action').length;
  if (actionCount > 3) {
    warnings.push('Too many action beats - consider adding reflection or tension');
  }
  
  // Check for cliffhanger in climax phases
  if (['climax_approach', 'escalation'].includes(arcPosition.arcPhase)) {
    const hasCliffhanger = beats.some(b => b.type === 'cliffhanger');
    if (!hasCliffhanger) {
      warnings.push('Climax approach phase should end with cliffhanger');
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
  };
}
