/**
 * Loom Director Service
 * 
 * The Narrative Scheduler that outputs CONSTRAINTS, not prose.
 * The Director is a compiler, not an artist.
 * 
 * Responsibilities:
 * - Select threads that MUST be touched
 * - Decide HOW they must be touched (progress/foreshadow/resolve)
 * - Block illegal narrative actions (e.g., killing a character needed later)
 * - Balance pacing (wins vs losses vs mystery)
 */

import { NovelState, Arc, Chapter } from '../../types';
import {
  LoomThread,
  DirectorDirective,
  DirectorConstraint,
  ThreadAnchor,
  LoomConfig,
  DEFAULT_LOOM_CONFIG,
  ConstraintType,
  calculatePayoffHorizon,
} from '../../types/loom';
import { deepseekJson } from '../deepseekService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';
import {
  selectThreadsForChapter,
  calculateUrgency,
  calculateNarrativeGravity,
  getOverallLoomHealth,
} from './threadPhysicsEngine';

// ============================================================================
// Director Prompts
// ============================================================================

const LOOM_DIRECTOR_SYSTEM_PROMPT = `You are the Heavenly Director, a narrative scheduler for a long-form fiction engine.

You do NOT write story content. You output CONSTRAINTS that the Writer must follow.

## YOUR ROLE

Think of yourself as a film director giving instructions to the cinematographer:
- "This scene MUST include a callback to Chapter 12's promise"
- "Do NOT resolve the Sun Family revenge yet - build more tension"
- "Touch the mystery thread with a subtle hint, nothing more"

## OUTPUT FORMAT

You will receive:
1. Thread physics data (urgency, karma, debt)
2. Arc position information
3. Recent chapter summaries
4. User's intent for this chapter

You must output your response as a valid JSON object containing:
1. Thread anchors (what MUST be touched and HOW)
2. Forbidden outcomes (what CANNOT happen)
3. Pacing guidance (intensity, word count, tension curve)
4. Climax protection (if applicable)

## RULES

1. **Select 2-3 primary threads** based on urgency physics
2. **Determine required action** for each:
   - PROGRESS: Move forward materially
   - ESCALATE: Raise stakes significantly  
   - RESOLVE: Complete the thread (only if in payoff window)
   - FORESHADOW: Subtle hint only
   - TOUCH: Acknowledge without progress

3. **Block premature resolutions**
   - SOVEREIGN threads need proper build-up
   - Check payoff_horizon before allowing resolution

4. **Balance the chapter**
   - Don't stack all resolutions in one chapter
   - Don't have 3 escalations without relief
   - Tension should rise and fall

## CRITICAL

Never tell the Writer WHAT to write. Only tell them WHAT MUST HAPPEN and WHAT CANNOT HAPPEN.`;

function buildDirectorPrompt(
  threads: LoomThread[],
  novelState: NovelState,
  userIntent: string,
  currentChapter: number,
  config: LoomConfig
): string {
  // Get arc info
  const activeArc = novelState.plotLedger.find(a => a.status === 'active');
  const arcProgress = activeArc && activeArc.targetChapters
    ? Math.round((currentChapter - (activeArc.startedAtChapter || 1)) / activeArc.targetChapters * 100)
    : 0;

  // Get recent chapters
  const recentChapters = novelState.chapters
    .slice(-3)
    .map(c => `Ch${c.number}: ${c.title} - ${c.summary?.slice(0, 200) || 'No summary'}`)
    .join('\n');

  // Thread physics summary
  const threadSummary = threads
    .filter(t => t.loomStatus !== 'CLOSED' && t.loomStatus !== 'ABANDONED')
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 10)
    .map(t => {
      const horizon = calculatePayoffHorizon(t, currentChapter);
      return `- ${t.signature} [${t.category}/${t.loomStatus}]
    Karma: ${t.karmaWeight}, Urgency: ${t.urgencyScore}, Debt: ${t.payoffDebt}
    Velocity: ${t.velocity}, Entropy: ${t.entropy}
    Payoff Horizon: ${horizon}
    Summary: ${t.summary?.slice(0, 100) || 'No summary'}`;
    })
    .join('\n');

  // Overall health
  const health = getOverallLoomHealth(threads, currentChapter);

  return `## CHAPTER ${currentChapter} DIRECTIVE REQUEST

### USER INTENT
${userIntent || 'Continue the story naturally.'}

### ARC CONTEXT
${activeArc
      ? `"${activeArc.title}" - ${arcProgress}% complete
${activeArc.description}`
      : 'No active arc.'}

### RECENT CHAPTERS
${recentChapters || 'First chapter.'}

### THREAD PHYSICS (Top 10 by Urgency)
${threadSummary || 'No active threads.'}

### LOOM HEALTH: ${health}/100
${health < 50 ? '⚠️ WARNING: Narrative health is low. Address stalled threads.' : ''}

### CONFIG
- Max constraints per chapter: ${config.directorConstraintsPerChapter}
- Stall threshold: ${config.stallThresholdChapters} chapters
- Bloom karma threshold: ${config.bloomThresholdKarma}

---

Generate the Chapter Directive. Remember: CONSTRAINTS only, no prose.`;
}

// ============================================================================
// Main Director Function
// ============================================================================

export interface LoomDirectorConfig {
  enabled: boolean;
  useReasonerMode: boolean;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_DIRECTOR_CONFIG: LoomDirectorConfig = {
  enabled: true,
  useReasonerMode: false,
  temperature: 0.4,
  maxTokens: 4096,
};

export async function generateDirectorDirective(
  threads: LoomThread[],
  novelState: NovelState,
  userIntent: string = '',
  loomConfig: Partial<LoomConfig> = {},
  directorConfig: Partial<LoomDirectorConfig> = {}
): Promise<DirectorDirective> {
  const loom = { ...DEFAULT_LOOM_CONFIG, ...loomConfig };
  const config = { ...DEFAULT_DIRECTOR_CONFIG, ...directorConfig };
  const currentChapter = novelState.chapters.length + 1;

  // Build full config with defaults
  const fullLoom: LoomConfig = {
    id: '',
    novelId: novelState.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...DEFAULT_LOOM_CONFIG,
    ...loom,
  };

  if (!config.enabled) {
    return generateMinimalDirective(threads, currentChapter, userIntent, fullLoom);
  }

  logger.info(`Generating Director Directive for Chapter ${currentChapter}`, 'loom-director');

  try {
    // First, use physics engine to pre-select threads
    const selection = selectThreadsForChapter(threads, currentChapter, loom);

    const userPrompt = buildDirectorPrompt(
      threads,
      novelState,
      userIntent,
      currentChapter,
      fullLoom
    );

    const rawResponse = await deepseekJson<{
      primary_goal: string;
      thread_anchors: Array<{
        signature: string;
        required_action: string;
        mandatory_detail: string;
      }>;
      forbidden_outcomes: string[];
      required_tone: string;
      pacing: {
        intensity: string;
        word_count_target: number;
        tension_curve: string;
      };
      climax_protection?: {
        is_active: boolean;
        protected_threads: string[];
        minimum_chapters: number;
        warning: string;
      };
      warnings: string[];
      reasoning: string[];
    }>({
      model: config.useReasonerMode ? 'deepseek-reasoner' : 'deepseek-chat',
      system: LOOM_DIRECTOR_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Build thread anchors from response + physics selection
    const threadAnchors: ThreadAnchor[] = [];
    const threadMap = new Map(threads.map(t => [t.signature, t]));

    // Add AI-selected anchors
    for (const anchor of rawResponse.thread_anchors || []) {
      const thread = threadMap.get(anchor.signature);
      if (thread) {
        threadAnchors.push({
          signature: anchor.signature,
          threadId: thread.id,
          requiredAction: normalizeAction(anchor.required_action),
          mandatoryDetail: anchor.mandatory_detail,
          currentUrgency: thread.urgencyScore,
          karmaWeight: thread.karmaWeight,
        });
      }
    }

    // Ensure physics-selected primary threads are included
    for (const thread of selection.primaryThreads) {
      if (!threadAnchors.find(a => a.signature === thread.signature)) {
        threadAnchors.push({
          signature: thread.signature,
          threadId: thread.id,
          requiredAction: determineRequiredAction(thread, currentChapter),
          mandatoryDetail: `Physics-selected: urgency ${thread.urgencyScore}, karma ${thread.karmaWeight}`,
          currentUrgency: thread.urgencyScore,
          karmaWeight: thread.karmaWeight,
        });
      }
    }

    // Limit to max constraints
    const finalAnchors = threadAnchors.slice(0, loom.directorConstraintsPerChapter);

    // Build forbidden outcomes
    const forbiddenOutcomes = [
      ...(rawResponse.forbidden_outcomes || []),
      // Add physics-derived forbidden resolutions
      ...selection.forbiddenResolutions.map(t =>
        `Do NOT resolve "${t.signature}" - payoff window not yet reached`
      ),
    ];

    const directive: DirectorDirective = {
      chapterNumber: currentChapter,
      primaryGoal: rawResponse.primary_goal || userIntent || 'Continue the narrative naturally',
      threadAnchors: finalAnchors,
      forbiddenOutcomes,
      requiredTone: rawResponse.required_tone || 'balanced',
      pacingGuidance: {
        intensity: normalizeIntensity(rawResponse.pacing?.intensity),
        wordCountTarget: rawResponse.pacing?.word_count_target || 3000,
        tensionCurve: normalizeTensionCurve(rawResponse.pacing?.tension_curve),
      },
      climaxProtection: rawResponse.climax_protection?.is_active ? {
        isActive: true,
        protectedThreads: rawResponse.climax_protection.protected_threads || [],
        minimumChaptersUntilResolution: rawResponse.climax_protection.minimum_chapters || 3,
        warningMessage: rawResponse.climax_protection.warning || 'Climax protection active',
      } : undefined,
      warnings: [...selection.reasoning, ...(rawResponse.warnings || [])],
      reasoning: rawResponse.reasoning || [],
    };

    logger.info(`Director Directive generated: ${finalAnchors.length} anchors, ${forbiddenOutcomes.length} forbidden`, 'loom-director');

    return directive;

  } catch (error) {
    logger.error('Director Directive generation failed', 'loom-director', error instanceof Error ? error : undefined);
    return generateMinimalDirective(threads, currentChapter, userIntent, loom);
  }
}

// ============================================================================
// Fallback Directive
// ============================================================================

function generateMinimalDirective(
  threads: LoomThread[],
  currentChapter: number,
  userIntent: string,
  loom: LoomConfig | Partial<LoomConfig>
): DirectorDirective {
  const config: LoomConfig = {
    id: '',
    novelId: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...DEFAULT_LOOM_CONFIG,
    ...(loom as Partial<LoomConfig>),
  };
  const selection = selectThreadsForChapter(threads, currentChapter, loom);

  const threadAnchors: ThreadAnchor[] = selection.primaryThreads
    .slice(0, loom.directorConstraintsPerChapter)
    .map(t => ({
      signature: t.signature,
      threadId: t.id,
      requiredAction: determineRequiredAction(t, currentChapter),
      mandatoryDetail: `Physics-selected: urgency ${t.urgencyScore}`,
      currentUrgency: t.urgencyScore,
      karmaWeight: t.karmaWeight,
    }));

  return {
    chapterNumber: currentChapter,
    primaryGoal: userIntent || 'Continue the narrative naturally',
    threadAnchors,
    forbiddenOutcomes: selection.forbiddenResolutions.map(t =>
      `Do NOT resolve "${t.signature}" prematurely`
    ),
    requiredTone: 'balanced',
    pacingGuidance: {
      intensity: 'medium',
      wordCountTarget: 3000,
      tensionCurve: 'rising',
    },
    warnings: selection.reasoning,
    reasoning: ['Generated from physics engine (AI unavailable)'],
  };
}

// ============================================================================
// Convert Directive to Constraints
// ============================================================================

export function directiveToConstraints(
  directive: DirectorDirective,
  novelId: string
): DirectorConstraint[] {
  const constraints: DirectorConstraint[] = [];

  // Thread anchor constraints
  for (const anchor of directive.threadAnchors) {
    constraints.push({
      id: generateUUID(),
      novelId,
      chapterNumber: directive.chapterNumber,
      threadId: anchor.threadId,
      threadSignature: anchor.signature,
      constraintType: actionToConstraintType(anchor.requiredAction),
      mandatoryDetail: anchor.mandatoryDetail,
      wasSatisfied: false,
      createdAt: Date.now(),
    });
  }

  // Forbidden outcome constraints
  for (const forbidden of directive.forbiddenOutcomes) {
    constraints.push({
      id: generateUUID(),
      novelId,
      chapterNumber: directive.chapterNumber,
      constraintType: 'FORBIDDEN_OUTCOME',
      mandatoryDetail: forbidden,
      wasSatisfied: false,
      createdAt: Date.now(),
    });
  }

  // Climax protection constraints
  if (directive.climaxProtection?.isActive) {
    for (const threadSig of directive.climaxProtection.protectedThreads) {
      constraints.push({
        id: generateUUID(),
        novelId,
        chapterNumber: directive.chapterNumber,
        threadSignature: threadSig,
        constraintType: 'FORBIDDEN_RESOLUTION',
        mandatoryDetail: directive.climaxProtection.warningMessage,
        wasSatisfied: false,
        createdAt: Date.now(),
      });
    }
  }

  return constraints;
}

// ============================================================================
// Format Directive for Writer Prompt
// ============================================================================

export function formatDirectiveForPrompt(directive: DirectorDirective): string {
  const lines: string[] = [];

  lines.push('### CHAPTER DIRECTIVE');
  lines.push(`**Primary Goal:** ${directive.primaryGoal}`);
  lines.push('');

  lines.push('**Thread Anchors:**');
  for (const anchor of directive.threadAnchors) {
    lines.push(`1. **${anchor.signature}** — Required Action: ${anchor.requiredAction}`);
    lines.push(`   - ${anchor.mandatoryDetail}`);
  }
  lines.push('');

  if (directive.forbiddenOutcomes.length > 0) {
    lines.push('**Forbidden Outcomes:**');
    for (const forbidden of directive.forbiddenOutcomes) {
      lines.push(`- ${forbidden}`);
    }
    lines.push('');
  }

  lines.push('**Continuity Guardrails:**');
  lines.push(`- Required Tone: ${directive.requiredTone}`);
  lines.push(`- Pacing: ${directive.pacingGuidance.intensity} intensity`);
  lines.push(`- Target: ~${directive.pacingGuidance.wordCountTarget} words`);
  lines.push(`- Tension: ${directive.pacingGuidance.tensionCurve}`);
  lines.push('');

  if (directive.climaxProtection?.isActive) {
    lines.push('⚠️ **CLIMAX PROTECTION ACTIVE**');
    lines.push(directive.climaxProtection.warningMessage);
    lines.push(`Protected threads: ${directive.climaxProtection.protectedThreads.join(', ')}`);
    lines.push(`Minimum ${directive.climaxProtection.minimumChaptersUntilResolution} chapters until major resolutions.`);
    lines.push('');
  }

  if (directive.warnings.length > 0) {
    lines.push('**Warnings:**');
    for (const warning of directive.warnings.slice(0, 5)) {
      lines.push(`- ${warning}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function determineRequiredAction(
  thread: LoomThread,
  currentChapter: number
): 'PROGRESS' | 'ESCALATE' | 'RESOLVE' | 'FORESHADOW' | 'TOUCH' {
  const horizon = calculatePayoffHorizon(thread, currentChapter);

  // Blooming threads should be resolved
  if (thread.loomStatus === 'BLOOMING' && horizon === 'perfect_window') {
    return 'RESOLVE';
  }

  // Stalled threads need progress
  if (thread.loomStatus === 'STALLED') {
    return 'PROGRESS';
  }

  // High urgency threads need escalation
  if (thread.urgencyScore > 300) {
    return 'ESCALATE';
  }

  // SEED threads get foreshadowing
  if (thread.loomStatus === 'SEED') {
    return 'FORESHADOW';
  }

  // Default to progress
  return 'PROGRESS';
}

function normalizeAction(action: string): 'PROGRESS' | 'ESCALATE' | 'RESOLVE' | 'FORESHADOW' | 'TOUCH' {
  const normalized = action?.toUpperCase();
  if (['PROGRESS', 'ESCALATE', 'RESOLVE', 'FORESHADOW', 'TOUCH'].includes(normalized)) {
    return normalized as 'PROGRESS' | 'ESCALATE' | 'RESOLVE' | 'FORESHADOW' | 'TOUCH';
  }
  return 'PROGRESS';
}

function actionToConstraintType(action: string): ConstraintType {
  const map: Record<string, ConstraintType> = {
    PROGRESS: 'MUST_PROGRESS',
    ESCALATE: 'MUST_ESCALATE',
    RESOLVE: 'MUST_RESOLVE',
    FORESHADOW: 'FORESHADOW',
    TOUCH: 'TOUCH',
  };
  return map[action] || 'MUST_PROGRESS';
}

function normalizeIntensity(intensity: string | undefined): 'low' | 'medium' | 'high' | 'climactic' {
  const normalized = intensity?.toLowerCase();
  if (['low', 'medium', 'high', 'climactic'].includes(normalized || '')) {
    return normalized as 'low' | 'medium' | 'high' | 'climactic';
  }
  return 'medium';
}

function normalizeTensionCurve(curve: string | undefined): 'rising' | 'falling' | 'plateau' | 'spike' {
  const normalized = curve?.toLowerCase();
  if (['rising', 'falling', 'plateau', 'spike'].includes(normalized || '')) {
    return normalized as 'rising' | 'falling' | 'plateau' | 'spike';
  }
  return 'rising';
}
