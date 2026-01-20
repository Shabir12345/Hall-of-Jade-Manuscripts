/**
 * Director Agent Service
 * 
 * The "Director" sits between the Arc outline and the Writer (DeepSeek)
 * to generate detailed beat sheets that control pacing.
 * 
 * Uses DeepSeek-V3.2 reasoner mode for chain-of-thought analysis of:
 * - Arc position and progress
 * - Tension curve management
 * - Climax protection (prevents premature resolution)
 * 
 * This prevents the AI from:
 * - Rushing climactic moments (resolving 50-chapter grudges in 2 paragraphs)
 * - Dragging out filler content
 * - Pacing inconsistencies
 */

import { NovelState, Arc, Chapter, StoryThread } from '../../types';
import {
  DirectorBeatSheet,
  DirectorConfig,
  DirectorResult,
  DirectorRawResponse,
  MicroBeat,
  MicroBeatType,
  PacingGuidance,
  ClimaxProtection,
  ArcPositionAnalysis,
  DEFAULT_DIRECTOR_CONFIG,
  DEFAULT_XIANXIA_PACING_RULES,
} from '../../types/director';
import { deepseekJson } from '../deepseekService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';
import { DIRECTOR_SYSTEM_PROMPT, buildDirectorUserPrompt } from './directorPrompts';

/**
 * Run the Director Agent to generate a beat sheet for the next chapter
 */
export async function runDirectorAgent(
  state: NovelState,
  userInstruction?: string,
  config: Partial<DirectorConfig> = {}
): Promise<DirectorResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_DIRECTOR_CONFIG, ...config };

  // Check if Director is enabled
  if (!finalConfig.enabled) {
    logger.debug('Director agent disabled, skipping beat sheet generation', 'director');
    return {
      success: true,
      beatSheet: null,
      durationMs: Date.now() - startTime,
    };
  }

  const nextChapterNumber = state.chapters.length + 1;
  
  logger.info(`Running Director for Chapter ${nextChapterNumber}`, 'director', {
    chapterNumber: nextChapterNumber,
    useReasonerMode: finalConfig.useReasonerMode,
  });

  try {
    // Get active arc
    const activeArc = state.plotLedger.find(a => a.status === 'active');
    if (!activeArc) {
      logger.warn('No active arc found, Director will use default pacing', 'director');
      return {
        success: true,
        beatSheet: generateDefaultBeatSheet(state, nextChapterNumber),
        durationMs: Date.now() - startTime,
      };
    }

    // Analyze arc position
    const arcPosition = analyzeArcPosition(activeArc, state, nextChapterNumber);

    // Get recent chapters for context
    const recentChapters = state.chapters
      .slice(-5)
      .sort((a, b) => a.number - b.number);

    // Get active threads
    const activeThreads = (state.storyThreads || [])
      .filter(t => t.status === 'active' || t.status === 'paused')
      .slice(0, 10);

    // Build prompt
    const userPrompt = buildDirectorUserPrompt({
      arc: activeArc,
      arcPosition,
      recentChapters,
      activeThreads,
      nextChapterNumber,
      userInstruction,
      config: finalConfig,
    });

    // Call DeepSeek
    const rawResponse = await deepseekJson<DirectorRawResponse>({
      model: finalConfig.useReasonerMode ? 'deepseek-reasoner' : 'deepseek-chat',
      system: DIRECTOR_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: finalConfig.temperature,
      maxTokens: finalConfig.maxTokens,
    });

    // Process response into beat sheet
    const beatSheet = processDirectorResponse(
      rawResponse,
      activeArc,
      arcPosition,
      nextChapterNumber,
      activeThreads,
      finalConfig
    );

    const durationMs = Date.now() - startTime;
    
    logger.info(`Director completed beat sheet in ${durationMs}ms`, 'director', {
      chapterNumber: nextChapterNumber,
      beatCount: beatSheet.beats.length,
      arcPhase: arcPosition.arcPhase,
      hasClimaxProtection: !!beatSheet.climaxProtection?.isClimaxProximate,
    });

    return {
      success: true,
      beatSheet,
      durationMs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Director agent failed', 'director', error instanceof Error ? error : undefined, {
      chapterNumber: nextChapterNumber,
      error: errorMessage,
    });

    return {
      success: false,
      beatSheet: null,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze arc position and phase
 */
export function analyzeArcPosition(
  arc: Arc,
  state: NovelState,
  nextChapterNumber: number
): ArcPositionAnalysis {
  const arcStartChapter = arc.startedAtChapter || 1;
  const targetChapters = arc.targetChapters || 20;
  const currentArcChapter = nextChapterNumber - arcStartChapter + 1;
  const progressPercent = Math.min(100, (currentArcChapter / targetChapters) * 100);

  // Determine arc phase based on progress
  let arcPhase: ArcPositionAnalysis['arcPhase'];
  if (progressPercent <= 10) {
    arcPhase = 'opening';
  } else if (progressPercent <= 30) {
    arcPhase = 'rising_action';
  } else if (progressPercent <= 50) {
    arcPhase = 'midpoint';
  } else if (progressPercent <= 70) {
    arcPhase = 'escalation';
  } else if (progressPercent <= 85) {
    arcPhase = 'climax_approach';
  } else if (progressPercent <= 95) {
    arcPhase = 'climax';
  } else {
    arcPhase = 'resolution';
  }

  // Extract checklist items
  const completedChecklistItems = (arc.checklist || [])
    .filter(item => item.completed)
    .map(item => item.label);
  const remainingChecklistItems = (arc.checklist || [])
    .filter(item => !item.completed)
    .map(item => item.label);

  return {
    arcId: arc.id,
    arcTitle: arc.title,
    targetChapters,
    currentArcChapter,
    progressPercent,
    arcPhase,
    completedChecklistItems,
    remainingChecklistItems,
  };
}

/**
 * Process raw Director response into a structured beat sheet
 */
function processDirectorResponse(
  raw: DirectorRawResponse,
  arc: Arc,
  arcPosition: ArcPositionAnalysis,
  chapterNumber: number,
  activeThreads: StoryThread[],
  config: DirectorConfig
): DirectorBeatSheet {
  // Process beats
  const beats: MicroBeat[] = (raw.beats || []).map((beat, index) => ({
    id: generateUUID(),
    order: index + 1,
    type: normalizeBeatType(beat.type),
    description: beat.description || '',
    mandatory: beat.mandatory ?? index < 3, // First 3 beats are mandatory by default
    targetWordCount: beat.targetWordCount,
    charactersInvolved: beat.charactersInvolved,
    emotionalTone: normalizeEmotionalTone(beat.emotionalTone),
  }));

  // Ensure we have minimum beats
  while (beats.length < config.minBeatsPerChapter) {
    beats.push({
      id: generateUUID(),
      order: beats.length + 1,
      type: 'reflection',
      description: 'Additional scene as needed',
      mandatory: false,
    });
  }

  // Trim to max beats
  const finalBeats = beats.slice(0, config.maxBeatsPerChapter);

  // Process pacing guidance
  const pacingGuidance: PacingGuidance = {
    overallPace: normalizePace(raw.pacingGuidance?.overallPace),
    targetWordCount: raw.pacingGuidance?.targetWordCount || config.defaultTargetWordCount,
    minimumWordCount: raw.pacingGuidance?.minimumWordCount || Math.floor(config.defaultTargetWordCount * 0.7),
    maximumWordCount: raw.pacingGuidance?.maximumWordCount || Math.floor(config.defaultTargetWordCount * 1.5),
    startingTensionLevel: raw.pacingGuidance?.startingTensionLevel ?? 50,
    endingTensionLevel: raw.pacingGuidance?.endingTensionLevel ?? 60,
    requiresCliffhanger: raw.pacingGuidance?.requiresCliffhanger ?? false,
    pacingNotes: raw.pacingGuidance?.pacingNotes || [],
  };

  // Process climax protection
  let climaxProtection: ClimaxProtection | undefined;
  if (raw.climaxProtection?.isClimaxProximate || arcPosition.arcPhase === 'climax_approach') {
    climaxProtection = {
      isClimaxProximate: true,
      protectedThreadIds: raw.climaxProtection?.protectedThreads || 
        activeThreads.filter(t => t.priority === 'critical').map(t => t.id),
      protectedConflicts: raw.climaxProtection?.protectedConflicts || [],
      minimumChaptersUntilResolution: raw.climaxProtection?.minimumChaptersUntilResolution || 
        Math.max(1, Math.ceil((100 - arcPosition.progressPercent) / 100 * arcPosition.targetChapters)),
      warningMessage: raw.climaxProtection?.warningMessage || 
        'CLIMAX PROTECTION: Do not resolve major conflicts prematurely. Build tension toward the arc climax.',
    };
  }

  return {
    arcId: arc.id,
    arcTitle: arc.title,
    chapterNumber,
    arcProgressPercent: arcPosition.progressPercent,
    arcPosition,
    beats: finalBeats,
    pacingGuidance,
    climaxProtection,
    directorReasoning: raw.reasoning || [],
    warnings: raw.warnings || [],
    createdAt: Date.now(),
  };
}

/**
 * Generate a default beat sheet when no arc is active
 */
function generateDefaultBeatSheet(state: NovelState, chapterNumber: number): DirectorBeatSheet {
  const defaultBeats: MicroBeat[] = [
    {
      id: generateUUID(),
      order: 1,
      type: 'setup',
      description: 'Establish scene and current situation',
      mandatory: true,
      targetWordCount: 500,
    },
    {
      id: generateUUID(),
      order: 2,
      type: 'tension',
      description: 'Introduce or escalate conflict',
      mandatory: true,
      targetWordCount: 600,
    },
    {
      id: generateUUID(),
      order: 3,
      type: 'action',
      description: 'Main action or confrontation',
      mandatory: true,
      targetWordCount: 800,
    },
    {
      id: generateUUID(),
      order: 4,
      type: 'revelation',
      description: 'New information or development',
      mandatory: false,
      targetWordCount: 500,
    },
    {
      id: generateUUID(),
      order: 5,
      type: 'reflection',
      description: 'Character processing and planning',
      mandatory: false,
      targetWordCount: 400,
    },
    {
      id: generateUUID(),
      order: 6,
      type: 'cliffhanger',
      description: 'End with hook for next chapter',
      mandatory: true,
      targetWordCount: 200,
    },
  ];

  return {
    arcId: '',
    arcTitle: 'No Active Arc',
    chapterNumber,
    arcProgressPercent: 0,
    arcPosition: {
      arcId: '',
      arcTitle: 'No Active Arc',
      targetChapters: 20,
      currentArcChapter: chapterNumber,
      progressPercent: 0,
      arcPhase: 'opening',
      completedChecklistItems: [],
      remainingChecklistItems: [],
    },
    beats: defaultBeats,
    pacingGuidance: {
      overallPace: 'moderate',
      targetWordCount: 3000,
      minimumWordCount: 2000,
      maximumWordCount: 4500,
      startingTensionLevel: 40,
      endingTensionLevel: 60,
      requiresCliffhanger: true,
      pacingNotes: ['Maintain steady pacing without active arc guidance'],
    },
    directorReasoning: ['No active arc found, using default beat structure'],
    warnings: ['Consider activating an arc for better pacing control'],
    createdAt: Date.now(),
  };
}

/**
 * Normalize beat type from raw response
 */
function normalizeBeatType(type: string | undefined): MicroBeatType {
  const validTypes: MicroBeatType[] = [
    'setup', 'tension', 'release', 'cliffhanger', 'revelation',
    'action', 'reflection', 'escalation', 'breakthrough', 'setback', 'foreshadow'
  ];
  
  const normalized = (type || '').toLowerCase().replace(/[^a-z]/g, '_');
  
  if (validTypes.includes(normalized as MicroBeatType)) {
    return normalized as MicroBeatType;
  }
  
  // Map common variations
  if (normalized.includes('fight') || normalized.includes('combat') || normalized.includes('battle')) {
    return 'action';
  }
  if (normalized.includes('reveal') || normalized.includes('discover')) {
    return 'revelation';
  }
  if (normalized.includes('cliff') || normalized.includes('hook')) {
    return 'cliffhanger';
  }
  if (normalized.includes('think') || normalized.includes('ponder') || normalized.includes('meditat')) {
    return 'reflection';
  }
  if (normalized.includes('rise') || normalized.includes('escalat') || normalized.includes('intensif')) {
    return 'escalation';
  }
  if (normalized.includes('break') || normalized.includes('advanc') || normalized.includes('level')) {
    return 'breakthrough';
  }
  
  return 'action'; // Default fallback
}

/**
 * Normalize emotional tone from raw response
 */
function normalizeEmotionalTone(tone: string | undefined): MicroBeat['emotionalTone'] | undefined {
  if (!tone) return undefined;
  
  const validTones: NonNullable<MicroBeat['emotionalTone']>[] = [
    'tense', 'hopeful', 'desperate', 'triumphant', 'melancholic', 'mysterious', 'comedic'
  ];
  
  const normalized = tone.toLowerCase();
  
  for (const validTone of validTones) {
    if (normalized.includes(validTone)) {
      return validTone;
    }
  }
  
  // Map variations
  if (normalized.includes('anxi') || normalized.includes('suspense')) return 'tense';
  if (normalized.includes('sad') || normalized.includes('grief')) return 'melancholic';
  if (normalized.includes('win') || normalized.includes('victory')) return 'triumphant';
  if (normalized.includes('fun') || normalized.includes('humor')) return 'comedic';
  if (normalized.includes('dark') || normalized.includes('grim')) return 'desperate';
  
  return undefined;
}

/**
 * Normalize pace from raw response
 */
function normalizePace(pace: string | undefined): PacingGuidance['overallPace'] {
  if (!pace) return 'moderate';
  
  const normalized = pace.toLowerCase();
  
  if (normalized.includes('slow')) return 'slow';
  if (normalized.includes('fast')) return 'fast';
  if (normalized.includes('breakneck') || normalized.includes('rapid') || normalized.includes('intense')) {
    return 'breakneck';
  }
  
  return 'moderate';
}

/**
 * Format beat sheet for injection into Writer prompt
 */
export function formatBeatSheetForPrompt(beatSheet: DirectorBeatSheet): string {
  const lines: string[] = [];
  
  lines.push('=== DIRECTOR BEAT SHEET ===');
  lines.push(`Arc: ${beatSheet.arcTitle} (${beatSheet.arcProgressPercent.toFixed(0)}% complete)`);
  lines.push(`Phase: ${beatSheet.arcPosition.arcPhase.replace(/_/g, ' ').toUpperCase()}`);
  lines.push('');
  
  lines.push('REQUIRED BEATS FOR THIS CHAPTER:');
  for (const beat of beatSheet.beats) {
    const mandatory = beat.mandatory ? '[REQUIRED]' : '[OPTIONAL]';
    const tone = beat.emotionalTone ? ` (${beat.emotionalTone} tone)` : '';
    const words = beat.targetWordCount ? ` (~${beat.targetWordCount} words)` : '';
    lines.push(`${beat.order}. ${mandatory} ${beat.type.toUpperCase()}${tone}${words}`);
    lines.push(`   ${beat.description}`);
  }
  lines.push('');
  
  lines.push('PACING GUIDANCE:');
  lines.push(`- Overall Pace: ${beatSheet.pacingGuidance.overallPace.toUpperCase()}`);
  lines.push(`- Target Word Count: ${beatSheet.pacingGuidance.targetWordCount} words (min: ${beatSheet.pacingGuidance.minimumWordCount}, max: ${beatSheet.pacingGuidance.maximumWordCount})`);
  lines.push(`- Tension: Start at ${beatSheet.pacingGuidance.startingTensionLevel}%, end at ${beatSheet.pacingGuidance.endingTensionLevel}%`);
  if (beatSheet.pacingGuidance.requiresCliffhanger) {
    lines.push('- CLIFFHANGER REQUIRED: End chapter with a hook');
  }
  for (const note of beatSheet.pacingGuidance.pacingNotes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  
  if (beatSheet.climaxProtection?.isClimaxProximate) {
    lines.push('⚠️ CLIMAX PROTECTION ACTIVE:');
    lines.push(beatSheet.climaxProtection.warningMessage);
    if (beatSheet.climaxProtection.protectedConflicts.length > 0) {
      lines.push(`Protected conflicts: ${beatSheet.climaxProtection.protectedConflicts.join(', ')}`);
    }
    lines.push(`Minimum ${beatSheet.climaxProtection.minimumChaptersUntilResolution} chapters until major resolutions allowed.`);
    lines.push('');
  }
  
  if (beatSheet.warnings.length > 0) {
    lines.push('DIRECTOR WARNINGS:');
    for (const warning of beatSheet.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Check if Director should run for this chapter
 */
export function shouldRunDirector(state: NovelState, config: Partial<DirectorConfig> = {}): boolean {
  const finalConfig = { ...DEFAULT_DIRECTOR_CONFIG, ...config };
  
  if (!finalConfig.enabled) {
    return false;
  }
  
  // Always run if we have an active arc
  const hasActiveArc = state.plotLedger.some(a => a.status === 'active');
  
  return hasActiveArc;
}
