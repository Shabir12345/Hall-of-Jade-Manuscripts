/**
 * Loom Integration Service
 * 
 * Integrates the Heavenly Loom system into the chapter generation pipeline.
 * Handles:
 * - Pre-generation: Generate Director directive and append to prompt
 * - Post-generation: Run Clerk audit and update thread state
 */

import { NovelState, Chapter } from '../../types';
import {
  LoomThread,
  DEFAULT_LOOM_CONFIG,
} from '../../types/loom';
import {
  storyThreadToLoomThread,
  generateDirectorDirective,
  runLoomClerkAudit as runClerkAudit,
  applyAuditToThreads,
} from './index';
import { logger } from '../loggingService';
import { generateLoomThreadsFromStoryThreads } from '../narrativeIntegrationService';

export interface LoomIntegrationOptions {
  enabled?: boolean;
  onPhase?: (phase: string, data?: any) => void;
}

export interface LoomGenerationContext {
  directivePrompt?: string;
  auditResult?: any;
  loomThreads?: LoomThread[];
}

/**
 * Generate Director directive before chapter generation
 * Now enhanced with Story Thread integration
 */
export async function generateLoomDirective(
  novelState: NovelState,
  userIntent: string = '',
  options: LoomIntegrationOptions = {}
): Promise<string | null> {
  if (!options.enabled) return null;

  options.onPhase?.('loom_director_start');

  try {
    const currentChapter = novelState.chapters.length;

    // Use Story Thread integration to get enhanced Loom threads
    // This applies priority multipliers based on thread health and neglect
    const loomThreads = generateLoomThreadsFromStoryThreads(
      novelState.storyThreads || [],
      currentChapter
    );

    logger.debug('Generated Loom threads from Story Threads', 'loom', {
      threadCount: loomThreads.length,
      highPriorityCount: loomThreads.filter(t => t.karmaWeight >= 70).length,
    });

    // Generate directive
    const directive = await generateDirectorDirective(
      loomThreads,
      novelState,
      userIntent,
      DEFAULT_LOOM_CONFIG
    );

    // Format for prompt
    const prompt = formatDirectiveForPrompt(directive);

    logger.info('Loom Director directive generated', 'loom', {
      threadAnchors: directive.threadAnchors.length,
      forbiddenOutcomes: directive.forbiddenOutcomes.length,
      hasClimaxProtection: !!directive.climaxProtection?.isActive,
      storyThreadsUsed: loomThreads.length,
    });

    options.onPhase?.('loom_director_complete', {
      threadAnchors: directive.threadAnchors.length,
      hasClimaxProtection: !!directive.climaxProtection?.isActive,
    });

    return prompt;
  } catch (error) {
    logger.warn('Loom Director failed, continuing without directive', 'loom', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Run Clerk audit after chapter generation
 */
export async function runLoomClerkAudit(
  novelState: NovelState,
  chapter: Chapter,
  options: LoomIntegrationOptions = {}
): Promise<LoomThread[]> {
  if (!options.enabled) return [];

  options.onPhase?.('loom_clerk_start');

  try {
    // Convert legacy threads to Loom threads
    const currentChapter = novelState.chapters.length;
    const loomThreads = (novelState.storyThreads || [])
      .map(t => storyThreadToLoomThread(t, currentChapter));

    // Run audit
    const audit = await runClerkAudit(
      chapter,
      loomThreads,
      novelState,
      DEFAULT_LOOM_CONFIG
    );

    // Apply audit results
    const updatedThreads = applyAuditToThreads(
      loomThreads,
      audit,
      novelState.id,
      DEFAULT_LOOM_CONFIG
    );

    logger.info('Loom Clerk audit completed', 'loom', {
      threadUpdates: audit.threadUpdates.length,
      newThreads: audit.newThreadsCreated,
      progressed: audit.threadsProgressed,
      resolved: audit.threadsResolved,
      warnings: audit.consistencyWarnings.length,
      processingTime: audit.processingTimeMs,
    });

    options.onPhase?.('loom_clerk_complete', {
      threadUpdates: audit.threadUpdates.length,
      newThreads: audit.newThreadsCreated,
      warnings: audit.consistencyWarnings.length,
    });

    return updatedThreads;
  } catch (error) {
    logger.warn('Loom Clerk audit failed', 'loom', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Format directive for Writer prompt
 */
function formatDirectiveForPrompt(directive: any): string {
  const lines: string[] = [];

  lines.push('### HEAVENLY LOOM DIRECTIVE');
  lines.push('');

  if (directive.primaryGoal) {
    lines.push(`**Primary Goal:** ${directive.primaryGoal}`);
    lines.push('');
  }

  if (directive.threadAnchors && directive.threadAnchors.length > 0) {
    lines.push('**Thread Anchors:**');
    directive.threadAnchors.forEach((anchor: any) => {
      lines.push(`1. **${anchor.signature}** — Required Action: ${anchor.requiredAction}`);
      lines.push(`   - ${anchor.mandatoryDetail}`);
    });
    lines.push('');
  }

  if (directive.forbiddenOutcomes && directive.forbiddenOutcomes.length > 0) {
    lines.push('**Forbidden Outcomes:**');
    directive.forbiddenOutcomes.forEach((forbidden: string) => {
      lines.push(`- ${forbidden}`);
    });
    lines.push('');
  }

  if (directive.requiredTone || directive.pacingGuidance) {
    lines.push('**Continuity Guardrails:**');
    if (directive.requiredTone) {
      lines.push(`- Required Tone: ${directive.requiredTone}`);
    }
    if (directive.pacingGuidance) {
      lines.push(`- Pacing: ${directive.pacingGuidance.intensity} intensity`);
      lines.push(`- Target: ~${directive.pacingGuidance.wordCountTarget} words`);
      lines.push(`- Tension: ${directive.pacingGuidance.tensionCurve}`);
    }
    lines.push('');
  }

  if (directive.climaxProtection?.isActive) {
    lines.push('⚠️ **CLIMAX PROTECTION ACTIVE**');
    lines.push(directive.climaxProtection.warningMessage);
    lines.push(`Protected threads: ${directive.climaxProtection.protectedThreads.join(', ')}`);
    lines.push(`Minimum ${directive.climaxProtection.minimumChaptersUntilResolution} chapters until major resolutions.`);
    lines.push('');
  }

  if (directive.warnings && directive.warnings.length > 0) {
    lines.push('**Warnings:**');
    directive.warnings.slice(0, 5).forEach((warning: string) => {
      lines.push(`- ${warning}`);
    });
  }

  return lines.join('\n');
}

/**
 * Convert Loom threads back to legacy format for storage
 */
export function convertLoomToLegacyThreads(loomThreads: LoomThread[]): any[] {
  return loomThreads.map(t => ({
    id: t.id,
    novelId: t.novelId,
    title: t.title,
    type: mapCategoryToType(t.category),
    status: mapLoomStatusToLegacy(t.loomStatus),
    priority: mapKarmaToPriority(t.karmaWeight),
    description: t.summary,
    introducedChapter: t.firstChapter,
    lastUpdatedChapter: t.lastMentionedChapter,
    resolvedChapter: t.loomStatus === 'CLOSED' ? t.lastMentionedChapter : undefined,
    relatedEntityId: undefined,
    relatedEntityType: undefined,
    progressionNotes: [],
    resolutionNotes: t.loomStatus === 'CLOSED' ? 'Resolved via Loom' : undefined,
    satisfactionScore: undefined,
    chaptersInvolved: [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastActiveChapter: t.lastMentionedChapter,
  }));
}

// Helper functions for type conversion
function mapCategoryToType(category: string): string {
  const map: Record<string, string> = {
    SOVEREIGN: 'mystery',
    MAJOR: 'enemy',
    MINOR: 'item',
    SEED: 'quest',
  };
  return map[category] || 'quest';
}

function mapLoomStatusToLegacy(status: string): string {
  const map: Record<string, string> = {
    SEED: 'active',
    OPEN: 'active',
    ACTIVE: 'active',
    BLOOMING: 'active',
    STALLED: 'paused',
    CLOSED: 'resolved',
    ABANDONED: 'abandoned',
  };
  return map[status] || 'active';
}

function mapKarmaToPriority(karma: number): string {
  if (karma >= 80) return 'critical';
  if (karma >= 60) return 'high';
  if (karma >= 40) return 'medium';
  return 'low';
}
