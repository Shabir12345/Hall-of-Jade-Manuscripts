/**
 * Director Agent Prompts
 * 
 * System and user prompts for the Director Agent that controls pacing
 * and generates beat sheets using DeepSeek reasoner mode.
 */

import { Arc, Chapter, StoryThread } from '../../types';
import { ArcPositionAnalysis, DirectorConfig } from '../../types/director';

/**
 * System prompt for the Director Agent
 */
export const DIRECTOR_SYSTEM_PROMPT = `You are the DIRECTOR AGENT for a Xianxia/Xuanhuan novel writing system.

Your role is to sit between the story outline and the writer, creating detailed BEAT SHEETS that control pacing for each chapter.

## YOUR CRITICAL MISSION

AI writers in 2026 have a fatal flaw: they rush climactic moments and drag out filler. A cultivation novel lives or dies by its pacing. Your job is to PREVENT:
- Resolving 50-chapter grudges in 2 paragraphs
- Rushing breakthroughs that should feel earned
- Dragging tension-free scenes that bore readers
- Premature confrontations before proper buildup

## XIANXIA PACING GOLDEN RULES

1. **BREAKTHROUGHS MUST BE EARNED**
   - Never allow a breakthrough in the same chapter it's announced
   - Minimum 1 chapter of buildup, tribulations need 2+
   - Include: internal struggle, external manifestation, world reaction

2. **REVENGE REQUIRES BUILDUP**
   - Major grudges need 10-20 chapters before confrontation
   - Show: investigation, preparation, failed attempts, escalation
   - The confrontation chapter should be the RELEASE, not the buildup

3. **TOURNAMENTS HAVE RHYTHM**
   - Each round deserves 1-2 chapters minimum
   - Build rivalries through matches
   - Save strongest opponents for later rounds
   - Include: trash talk, technique showcases, crowd reactions

4. **TENSION CURVES MATTER**
   - Opening chapters: 20-40% tension
   - Rising action: 40-60% tension  
   - Climax approach: 70-90% tension
   - Climax: 85-100% tension
   - Resolution: Wind down to 30-50%

5. **CLIMAX PROTECTION**
   - When approaching arc climax (85%+), PROTECT major resolutions
   - Do NOT allow premature payoffs
   - Build, build, BUILD until the designated climax chapter

## BEAT TYPES YOU GENERATE

- SETUP: Establish scene, characters, or context
- TENSION: Build suspense or conflict
- RELEASE: Tension relief or comic moment
- CLIFFHANGER: Chapter-ending hook
- REVELATION: New information changes situation
- ACTION: Combat, chase, physical conflict
- REFLECTION: Character introspection
- ESCALATION: Stakes intensifying
- BREAKTHROUGH: Cultivation/skill advancement
- SETBACK: Obstacle or failure
- FORESHADOW: Subtle hints at future

## OUTPUT FORMAT

Return a JSON object with this structure:
{
  "beats": [
    {
      "type": "setup|tension|release|cliffhanger|revelation|action|reflection|escalation|breakthrough|setback|foreshadow",
      "description": "Specific description of what should happen",
      "mandatory": true|false,
      "targetWordCount": 500,
      "charactersInvolved": ["character names"],
      "emotionalTone": "tense|hopeful|desperate|triumphant|melancholic|mysterious|comedic"
    }
  ],
  "pacingGuidance": {
    "overallPace": "slow|moderate|fast|breakneck",
    "targetWordCount": 3000,
    "minimumWordCount": 2000,
    "maximumWordCount": 4500,
    "startingTensionLevel": 50,
    "endingTensionLevel": 70,
    "requiresCliffhanger": true,
    "pacingNotes": ["Specific guidance for the writer"]
  },
  "climaxProtection": {
    "isClimaxProximate": true|false,
    "protectedThreads": ["thread titles that should NOT be resolved"],
    "protectedConflicts": ["conflicts to protect"],
    "minimumChaptersUntilResolution": 3,
    "warningMessage": "Warning for the writer"
  },
  "reasoning": ["Your chain-of-thought reasoning for these decisions"],
  "warnings": ["Any concerns or cautions for the writer"]
}

## THINK STEP BY STEP

Before generating the beat sheet:
1. Analyze arc position - where are we in the story arc?
2. Review recent chapters - what tension level are we at?
3. Check active threads - what needs attention or protection?
4. Consider user instruction - what does the user want to happen?
5. Apply Xianxia rules - what genre conventions apply?
6. Generate beats - create 5-8 beats that serve the pacing

REMEMBER: You are the guardian of pacing. The writer will follow your beats. Make every chapter count.`;

/**
 * Build the user prompt for the Director
 */
export function buildDirectorUserPrompt(params: {
  arc: Arc;
  arcPosition: ArcPositionAnalysis;
  recentChapters: Chapter[];
  activeThreads: StoryThread[];
  nextChapterNumber: number;
  userInstruction?: string;
  config: DirectorConfig;
}): string {
  const {
    arc,
    arcPosition,
    recentChapters,
    activeThreads,
    nextChapterNumber,
    userInstruction,
    config,
  } = params;

  // Build chapter summaries
  const chapterSummaries = recentChapters.map(ch => {
    const summary = ch.summary || ch.content.slice(0, 300) + '...';
    return `Chapter ${ch.number}: "${ch.title}" - ${summary}`;
  }).join('\n');

  // Build thread list
  const threadList = activeThreads.map(t => {
    const staleness = nextChapterNumber - t.lastUpdatedChapter;
    const urgency = staleness > 10 ? '⚠️ STALE' : staleness > 5 ? '⏳ NEEDS ATTENTION' : '';
    return `- [${t.priority.toUpperCase()}] ${t.title} (${t.type}) - Ch.${t.lastUpdatedChapter} ${urgency}`;
  }).join('\n');

  // Build checklist status
  const checklistStatus = (arc.checklist || []).map(item => {
    const status = item.completed ? '✅' : '⬜';
    return `${status} ${item.label}`;
  }).join('\n');

  // Build arc position summary
  const phaseDescriptions: Record<ArcPositionAnalysis['arcPhase'], string> = {
    opening: 'OPENING - Establish stakes and world',
    rising_action: 'RISING ACTION - Build momentum',
    midpoint: 'MIDPOINT - Major shift or revelation',
    escalation: 'ESCALATION - Stakes intensifying',
    climax_approach: 'CLIMAX APPROACH - Build to inevitable confrontation',
    climax: 'CLIMAX - Maximum tension, major confrontations',
    resolution: 'RESOLUTION - Wind down and setup next arc',
  };

  return `=== DIRECTOR ANALYSIS REQUEST ===

GENERATING BEAT SHEET FOR: Chapter ${nextChapterNumber}

=== CURRENT ARC ===
Title: ${arc.title}
Description: ${arc.description}
Target Chapters: ${arcPosition.targetChapters}
Current Progress: ${arcPosition.progressPercent.toFixed(1)}% (Chapter ${arcPosition.currentArcChapter} of ~${arcPosition.targetChapters})

ARC PHASE: ${phaseDescriptions[arcPosition.arcPhase]}

Arc Checklist Status:
${checklistStatus || 'No checklist items defined'}

=== RECENT CHAPTERS (Last 5) ===
${chapterSummaries || 'No previous chapters'}

=== ACTIVE STORY THREADS ===
${threadList || 'No active threads'}

=== USER INSTRUCTION FOR THIS CHAPTER ===
${userInstruction || 'No specific instruction - continue natural story progression'}

=== YOUR TASK ===

Generate a beat sheet for Chapter ${nextChapterNumber} with ${config.minBeatsPerChapter}-${config.maxBeatsPerChapter} beats.

Think through:
1. Where are we in the arc? (${arcPosition.arcPhase})
2. What tension level should we target?
3. Which threads need attention?
4. Should we protect any conflicts from premature resolution?
5. What Xianxia pacing rules apply?

CRITICAL CHECKS:
- If arc is 80%+ complete, activate CLIMAX PROTECTION
- If user mentions breakthrough/tribulation, ensure proper buildup
- If revenge/confrontation mentioned, verify sufficient prior buildup
- If tournament/competition, use proper round pacing

Generate your beat sheet now.`;
}

/**
 * Build a minimal prompt for quick beat generation
 */
export function buildQuickDirectorPrompt(
  arc: Arc,
  nextChapterNumber: number,
  userInstruction?: string
): string {
  const arcStart = arc.startedAtChapter || 1;
  const targetChapters = arc.targetChapters || 20;
  const currentArcChapter = nextChapterNumber - arcStart + 1;
  const progress = Math.min(100, (currentArcChapter / targetChapters) * 100);

  return `Quick beat sheet for Chapter ${nextChapterNumber}.

Arc: "${arc.title}" - ${progress.toFixed(0)}% complete
${userInstruction ? `Instruction: ${userInstruction}` : ''}

Generate 5-6 beats with pacing guidance. Focus on:
- Appropriate tension for ${progress > 80 ? 'CLIMAX APPROACH' : progress > 50 ? 'ESCALATION' : 'RISING ACTION'}
- ${progress > 85 ? 'CLIMAX PROTECTION ACTIVE - do not resolve major conflicts' : 'Build toward arc goals'}

JSON response with beats, pacingGuidance, reasoning.`;
}

/**
 * Generate arc phase description for prompts
 */
export function getArcPhaseDescription(phase: ArcPositionAnalysis['arcPhase']): string {
  const descriptions: Record<ArcPositionAnalysis['arcPhase'], string> = {
    opening: 'The opening phase establishes the stakes, introduces key players, and plants seeds for future conflicts. Pacing should be measured, allowing readers to absorb the new situation.',
    rising_action: 'Rising action builds momentum and deepens involvement. Each chapter should raise stakes and complicate the situation. Hooks and cliffhangers become important.',
    midpoint: 'The midpoint marks a major shift - a revelation, betrayal, or turning point. This changes the nature of the conflict and raises personal stakes.',
    escalation: 'Escalation phase rapidly intensifies conflicts. Characters are pushed to their limits. Multiple threads converge. Pacing becomes faster.',
    climax_approach: 'CRITICAL PHASE: We are approaching the arc climax. DO NOT resolve major conflicts. Build maximum tension. Every chapter should increase anticipation.',
    climax: 'The climax delivers maximum tension and major confrontations. Key resolutions occur. Pacing is intense and relentless.',
    resolution: 'Resolution winds down tension, processes what happened, and sets up the next arc. Some threads close while others open.',
  };

  return descriptions[phase];
}

/**
 * Generate Xianxia-specific pacing warnings based on content
 */
export function generateXianxiaPacingWarnings(
  userInstruction: string | undefined,
  arcPosition: ArcPositionAnalysis
): string[] {
  const warnings: string[] = [];
  const instruction = (userInstruction || '').toLowerCase();

  // Breakthrough warnings
  if (instruction.includes('breakthrough') || instruction.includes('advance') || instruction.includes('tribulation')) {
    warnings.push('⚡ BREAKTHROUGH DETECTED: Ensure proper buildup. Do NOT rush. Include: preparation, internal struggle, external manifestation.');
    if (instruction.includes('tribulation')) {
      warnings.push('⛈️ TRIBULATION: Minimum 2 chapters. Multiple waves of escalating difficulty. Near-death moment required.');
    }
  }

  // Revenge warnings
  if (instruction.includes('revenge') || instruction.includes('confront') || instruction.includes('payback')) {
    warnings.push('🗡️ CONFRONTATION DETECTED: Verify sufficient buildup chapters. If this is the first confrontation mention, DO NOT allow immediate payoff.');
  }

  // Tournament warnings
  if (instruction.includes('tournament') || instruction.includes('competition') || instruction.includes('round')) {
    warnings.push('🏆 TOURNAMENT: Maintain proper round pacing (1-2 chapters per round). Build rivalries. Save best opponents for later.');
  }

  // Climax approach warnings
  if (arcPosition.arcPhase === 'climax_approach') {
    warnings.push('🔥 CLIMAX APPROACH: PROTECT all major conflicts from resolution. Build tension relentlessly.');
  }

  return warnings;
}
