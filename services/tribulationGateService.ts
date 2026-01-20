/**
 * Tribulation Gate Service
 * 
 * Handles persistence and history management for Tribulation Gates.
 * Stores gate history locally and in Supabase for analytics and
 * enabling "what if" regeneration from past gates.
 */

import {
  TribulationGate,
  TribulationGateStatus,
  TribulationTrigger,
  FatePath,
  TribulationGateConfig,
  DEFAULT_TRIBULATION_GATE_CONFIG,
  TribulationGateHistoryEntry,
} from '../types/tribulationGates';
import { logger } from './loggingService';
import { generateUUID } from '../utils/uuid';
import { supabase } from './supabaseService';
import { trackGateConsequences } from './gateConsequenceTracker';

// Check if Supabase is configured by checking if the client is valid
function isSupabaseConfigured(): boolean {
  try {
    return !!supabase;
  } catch {
    return false;
  }
}
import { recordGateTrigger } from './tribulationGateDetector';

/**
 * Local storage keys
 */
const GATES_STORAGE_KEY = 'tribulation_gates';
const CONFIG_STORAGE_KEY = 'tribulation_gate_config';
const HISTORY_STORAGE_KEY = 'tribulation_gate_history_entries';

/**
 * Get all gates for a novel from local storage
 */
export function getGatesForNovel(novelId: string): TribulationGate[] {
  try {
    const stored = localStorage.getItem(GATES_STORAGE_KEY);
    if (!stored) return [];
    
    const allGates: TribulationGate[] = JSON.parse(stored);
    return allGates.filter(g => g.novelId === novelId);
  } catch (error) {
    logger.warn('Failed to get gates from storage', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get a specific gate by ID
 */
export function getGateById(gateId: string): TribulationGate | null {
  try {
    const stored = localStorage.getItem(GATES_STORAGE_KEY);
    if (!stored) return null;
    
    const allGates: TribulationGate[] = JSON.parse(stored);
    return allGates.find(g => g.id === gateId) || null;
  } catch (error) {
    logger.warn('Failed to get gate by ID', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
      gateId,
    });
    return null;
  }
}

/**
 * Get pending gates for a novel
 */
export function getPendingGates(novelId: string): TribulationGate[] {
  return getGatesForNovel(novelId).filter(g => g.status === 'pending');
}

/**
 * Get the most recent gate for a novel
 */
export function getMostRecentGate(novelId: string): TribulationGate | null {
  const gates = getGatesForNovel(novelId);
  if (gates.length === 0) return null;
  
  return gates.reduce((latest, current) => 
    current.createdAt > latest.createdAt ? current : latest
  );
}

/**
 * Get gate history entries for a novel
 */
export function getGateHistory(novelId: string): TribulationGateHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];
    
    const allHistory: TribulationGateHistoryEntry[] = JSON.parse(stored);
    return allHistory
      .filter(h => h.novelId === novelId)
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    logger.warn('Failed to get gate history', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Create a new tribulation gate
 */
export function createGate(
  novelId: string,
  chapterNumber: number,
  triggerType: TribulationTrigger,
  situation: string,
  context: string,
  protagonistName: string,
  fatePaths: FatePath[],
  arcId?: string,
  relatedThreadIds?: string[]
): TribulationGate {
  const gate: TribulationGate = {
    id: generateUUID(),
    novelId,
    chapterNumber,
    triggerType,
    situation,
    context,
    protagonistName,
    fatePaths,
    status: 'pending',
    createdAt: Date.now(),
    arcId,
    relatedThreadIds,
  };
  
  // Save to local storage
  saveGate(gate);
  
  logger.info('Created tribulation gate', 'tribulationGate', {
    gateId: gate.id,
    novelId,
    chapterNumber,
    triggerType,
    pathCount: fatePaths.length,
  });
  
  return gate;
}

/**
 * Save a gate to local storage
 */
function saveGate(gate: TribulationGate): void {
  try {
    const stored = localStorage.getItem(GATES_STORAGE_KEY);
    const allGates: TribulationGate[] = stored ? JSON.parse(stored) : [];
    
    // Find and update existing or add new
    const existingIndex = allGates.findIndex(g => g.id === gate.id);
    if (existingIndex >= 0) {
      allGates[existingIndex] = gate;
    } else {
      allGates.push(gate);
    }
    
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify(allGates));
  } catch (error) {
    logger.error('Failed to save gate', 'tribulationGate', 
      error instanceof Error ? error : undefined, {
        gateId: gate.id,
      }
    );
  }
}

/**
 * Resolve a tribulation gate with user's choice
 */
export function resolveGate(
  gateId: string,
  selectedPathId: string
): TribulationGate | null {
  const gate = getGateById(gateId);
  if (!gate) {
    logger.error('Gate not found for resolution', 'tribulationGate', undefined, { gateId });
    return null;
  }
  
  const selectedPath = gate.fatePaths.find(p => p.id === selectedPathId);
  if (!selectedPath) {
    logger.error('Selected path not found', 'tribulationGate', undefined, {
      gateId,
      selectedPathId,
      availablePaths: gate.fatePaths.map(p => p.id),
    });
    return null;
  }
  
  // Update gate
  gate.status = 'resolved';
  gate.selectedPathId = selectedPathId;
  gate.selectedPathDescription = selectedPath.description;
  gate.resolvedAt = Date.now();
  
  // Save updated gate
  saveGate(gate);
  
  // Record in gate trigger history (for chapter gap tracking)
  recordGateTrigger(gate.novelId, gate.chapterNumber);
  
  // Add to history
  addHistoryEntry({
    gateId: gate.id,
    novelId: gate.novelId,
    chapterNumber: gate.chapterNumber,
    triggerType: gate.triggerType,
    selectedPathLabel: selectedPath.label,
    selectedPathRisk: selectedPath.riskLevel,
    timestamp: Date.now(),
  });
  
  // Sync to Supabase if configured
  syncGateToSupabase(gate);
  
  // Track consequences from the chosen path
  try {
    const trackedConsequences = trackGateConsequences(gate);
    if (trackedConsequences.length > 0) {
      logger.info('Started tracking gate consequences', 'tribulationGate', {
        gateId,
        consequenceCount: trackedConsequences.length,
      });
    }
  } catch (error) {
    logger.warn('Failed to track gate consequences', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  
  logger.info('Resolved tribulation gate', 'tribulationGate', {
    gateId,
    selectedPathId,
    selectedPathLabel: selectedPath.label,
    riskLevel: selectedPath.riskLevel,
  });
  
  return gate;
}

/**
 * Skip a tribulation gate
 */
export function skipGate(gateId: string, reason: string = 'User skipped'): TribulationGate | null {
  const gate = getGateById(gateId);
  if (!gate) {
    logger.error('Gate not found for skip', 'tribulationGate', undefined, { gateId });
    return null;
  }
  
  gate.status = 'skipped';
  gate.skipReason = reason;
  gate.resolvedAt = Date.now();
  
  saveGate(gate);
  
  logger.info('Skipped tribulation gate', 'tribulationGate', {
    gateId,
    reason,
  });
  
  return gate;
}

/**
 * Expire old pending gates
 */
export function expirePendingGates(novelId: string, maxAge: number = 24 * 60 * 60 * 1000): number {
  const gates = getPendingGates(novelId);
  const now = Date.now();
  let expiredCount = 0;
  
  for (const gate of gates) {
    if (now - gate.createdAt > maxAge) {
      gate.status = 'expired';
      gate.resolvedAt = now;
      gate.skipReason = 'Expired due to inactivity';
      saveGate(gate);
      expiredCount++;
    }
  }
  
  if (expiredCount > 0) {
    logger.info('Expired pending gates', 'tribulationGate', {
      novelId,
      expiredCount,
    });
  }
  
  return expiredCount;
}

/**
 * Add a history entry
 */
function addHistoryEntry(entry: TribulationGateHistoryEntry): void {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    const history: TribulationGateHistoryEntry[] = stored ? JSON.parse(stored) : [];
    
    history.push(entry);
    
    // Keep only last 100 entries per novel
    const novelHistory = history.filter(h => h.novelId === entry.novelId);
    if (novelHistory.length > 100) {
      // Remove oldest entries for this novel
      const toRemove = novelHistory.slice(0, novelHistory.length - 100);
      const toRemoveIds = new Set(toRemove.map(h => h.gateId));
      const filteredHistory = history.filter(h => 
        h.novelId !== entry.novelId || !toRemoveIds.has(h.gateId)
      );
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filteredHistory));
    } else {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    }
  } catch (error) {
    logger.warn('Failed to add history entry', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sync a gate to Supabase for analytics
 */
async function syncGateToSupabase(gate: TribulationGate): Promise<void> {
  if (!isSupabaseConfigured()) return;
  
  try {
    const { error } = await supabase
      .from('tribulation_gates')
      .upsert({
        id: gate.id,
        novel_id: gate.novelId,
        chapter_number: gate.chapterNumber,
        trigger_type: gate.triggerType,
        situation: gate.situation,
        context: gate.context,
        protagonist_name: gate.protagonistName,
        fate_paths: gate.fatePaths,
        selected_path_id: gate.selectedPathId,
        selected_path_description: gate.selectedPathDescription,
        status: gate.status,
        skip_reason: gate.skipReason,
        arc_id: gate.arcId,
        related_thread_ids: gate.relatedThreadIds,
        created_at: new Date(gate.createdAt).toISOString(),
        resolved_at: gate.resolvedAt ? new Date(gate.resolvedAt).toISOString() : null,
      });
    
    if (error) {
      logger.warn('Failed to sync gate to Supabase', 'tribulationGate', {
        error: error.message,
        gateId: gate.id,
      });
    }
  } catch (error) {
    logger.warn('Error syncing gate to Supabase', 'tribulationGate', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get gate statistics for a novel
 */
export function getGateStatistics(novelId: string): {
  totalGates: number;
  resolvedGates: number;
  skippedGates: number;
  pendingGates: number;
  triggerTypeCounts: Record<TribulationTrigger, number>;
  riskChoiceCounts: Record<string, number>;
  averageResolutionTimeMs: number;
} {
  const gates = getGatesForNovel(novelId);
  
  const stats = {
    totalGates: gates.length,
    resolvedGates: gates.filter(g => g.status === 'resolved').length,
    skippedGates: gates.filter(g => g.status === 'skipped').length,
    pendingGates: gates.filter(g => g.status === 'pending').length,
    triggerTypeCounts: {} as Record<TribulationTrigger, number>,
    riskChoiceCounts: { low: 0, medium: 0, high: 0, extreme: 0 },
    averageResolutionTimeMs: 0,
  };
  
  // Count trigger types
  for (const gate of gates) {
    stats.triggerTypeCounts[gate.triggerType] = 
      (stats.triggerTypeCounts[gate.triggerType] || 0) + 1;
  }
  
  // Count risk choices from history
  const history = getGateHistory(novelId);
  for (const entry of history) {
    if (stats.riskChoiceCounts.hasOwnProperty(entry.selectedPathRisk)) {
      stats.riskChoiceCounts[entry.selectedPathRisk]++;
    }
  }
  
  // Calculate average resolution time
  const resolvedWithTimes = gates.filter(g => 
    g.status === 'resolved' && g.resolvedAt
  );
  if (resolvedWithTimes.length > 0) {
    const totalTime = resolvedWithTimes.reduce((sum, g) => 
      sum + (g.resolvedAt! - g.createdAt), 0
    );
    stats.averageResolutionTimeMs = totalTime / resolvedWithTimes.length;
  }
  
  return stats;
}

/**
 * Get or create config for a novel
 */
export function getGateConfig(novelId: string): TribulationGateConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_TRIBULATION_GATE_CONFIG };
    
    const allConfigs: Record<string, TribulationGateConfig> = JSON.parse(stored);
    return allConfigs[novelId] || { ...DEFAULT_TRIBULATION_GATE_CONFIG };
  } catch {
    return { ...DEFAULT_TRIBULATION_GATE_CONFIG };
  }
}

/**
 * Save config for a novel
 */
export function saveGateConfig(novelId: string, config: TribulationGateConfig): void {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    const allConfigs: Record<string, TribulationGateConfig> = stored ? JSON.parse(stored) : {};
    
    allConfigs[novelId] = config;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(allConfigs));
    
    logger.debug('Saved gate config', 'tribulationGate', {
      novelId,
      enabled: config.enabled,
      minimumChapterGap: config.minimumChapterGap,
    });
  } catch (error) {
    logger.error('Failed to save gate config', 'tribulationGate',
      error instanceof Error ? error : undefined, {
        novelId,
      }
    );
  }
}

/**
 * Delete all gates for a novel (for cleanup)
 */
export function deleteGatesForNovel(novelId: string): number {
  try {
    const stored = localStorage.getItem(GATES_STORAGE_KEY);
    if (!stored) return 0;
    
    const allGates: TribulationGate[] = JSON.parse(stored);
    const remaining = allGates.filter(g => g.novelId !== novelId);
    const deletedCount = allGates.length - remaining.length;
    
    localStorage.setItem(GATES_STORAGE_KEY, JSON.stringify(remaining));
    
    logger.info('Deleted gates for novel', 'tribulationGate', {
      novelId,
      deletedCount,
    });
    
    return deletedCount;
  } catch (error) {
    logger.error('Failed to delete gates for novel', 'tribulationGate',
      error instanceof Error ? error : undefined, {
        novelId,
      }
    );
    return 0;
  }
}

/**
 * Format a gate for display
 */
export function formatGateForDisplay(gate: TribulationGate): string {
  const lines: string[] = [];
  
  lines.push(`=== TRIBULATION GATE: ${gate.triggerType.toUpperCase().replace(/_/g, ' ')} ===`);
  lines.push(`Chapter: ${gate.chapterNumber}`);
  lines.push(`Status: ${gate.status}`);
  lines.push('');
  lines.push(`SITUATION: ${gate.situation}`);
  lines.push('');
  lines.push('FATE PATHS:');
  
  for (const path of gate.fatePaths) {
    const selected = path.id === gate.selectedPathId ? ' [CHOSEN]' : '';
    lines.push(`${path.label}${selected}`);
    lines.push(`  ${path.description}`);
    lines.push(`  Risk: ${path.riskLevel} | Tone: ${path.emotionalTone}`);
    lines.push('');
  }
  
  if (gate.selectedPathDescription) {
    lines.push(`CHOSEN PATH: ${gate.selectedPathDescription}`);
  }
  
  return lines.join('\n');
}

/**
 * Check if there's a pending gate that needs resolution
 */
export function hasPendingGate(novelId: string): boolean {
  const pendingGates = getPendingGates(novelId);
  return pendingGates.length > 0;
}

/**
 * Get the most recent pending gate for a novel
 */
export function getPendingGate(novelId: string): TribulationGate | null {
  const pendingGates = getPendingGates(novelId);
  if (pendingGates.length === 0) return null;
  
  // Return the most recently created pending gate
  return pendingGates.reduce((latest, current) =>
    current.createdAt > latest.createdAt ? current : latest
  );
}

/**
 * Manually create a tribulation gate for testing or user-initiated triggers
 */
export async function createManualGate(
  novelId: string,
  chapterNumber: number,
  triggerType: TribulationTrigger,
  protagonistName: string,
  customSituation?: string
): Promise<TribulationGate | null> {
  // Import fate path generator dynamically to avoid circular dependency
  const { generateFatePaths } = await import('./fatePathGenerator');
  
  const situation = customSituation || generateDefaultSituation(triggerType, protagonistName);
  const context = `Manual trigger at Chapter ${chapterNumber}`;
  
  try {
    const fatePaths = await generateFatePaths(
      { id: novelId } as any, // Minimal state for manual trigger
      triggerType,
      situation,
      protagonistName,
      context
    );
    
    const gate = createGate(
      novelId,
      chapterNumber,
      triggerType,
      situation,
      context,
      protagonistName,
      fatePaths
    );
    
    logger.info('Created manual tribulation gate', 'tribulationGate', {
      gateId: gate.id,
      novelId,
      chapterNumber,
      triggerType,
    });
    
    return gate;
  } catch (error) {
    logger.error('Failed to create manual gate', 'tribulationGate',
      error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Generate a default situation description for a trigger type
 */
function generateDefaultSituation(triggerType: TribulationTrigger, protagonistName: string): string {
  const situations: Record<TribulationTrigger, string> = {
    realm_breakthrough: `${protagonistName} stands at the threshold of a breakthrough. The heavenly tribulation gathers, and a choice must be made.`,
    life_death_crisis: `${protagonistName} faces mortal danger. Death looms close, but there may be paths to survival.`,
    major_confrontation: `${protagonistName} must face their adversary. The time for the final confrontation has arrived.`,
    alliance_decision: `${protagonistName} must choose their allies. This decision will shape the future of many.`,
    treasure_discovery: `${protagonistName} has discovered a powerful artifact. Its fate—and their own—hangs in the balance.`,
    identity_revelation: `${protagonistName} faces a moment of truth. To reveal or conceal—either choice carries weight.`,
    marriage_proposal: `${protagonistName} stands at a crossroads of the heart. Matters of love and duty intertwine.`,
    sect_choice: `${protagonistName} must decide their path within the cultivation world. Loyalty and ambition clash.`,
    forbidden_technique: `${protagonistName} is tempted by forbidden power. Great power comes with great cost.`,
    sacrifice_moment: `${protagonistName} must consider a sacrifice. What they hold dear may be the price.`,
    dao_comprehension: `${protagonistName} touches the edge of enlightenment. Different paths of understanding beckon.`,
    inheritance_acceptance: `${protagonistName} has been offered a legacy. To accept is to take on a mantle of great responsibility.`,
  };
  
  return situations[triggerType] || `${protagonistName} faces a critical decision.`;
}

/**
 * Build prompt injection text for a resolved gate
 */
export function buildGatePromptInjection(gate: TribulationGate): string {
  if (gate.status !== 'resolved' || !gate.selectedPathId) {
    return '';
  }
  
  const selectedPath = gate.fatePaths.find(p => p.id === gate.selectedPathId);
  if (!selectedPath) {
    return '';
  }
  
  return `
╔══════════════════════════════════════════════════════════════════╗
║  FATE DECISION: ${gate.triggerType.toUpperCase().replace(/_/g, ' ')}
╚══════════════════════════════════════════════════════════════════╝

The reader has chosen ${gate.protagonistName}'s fate at this critical moment.

SITUATION: ${gate.situation}

CHOSEN PATH: ${selectedPath.label}
${selectedPath.description}

EXPECTED CONSEQUENCES:
${selectedPath.consequences.map(c => `• ${c}`).join('\n')}

EMOTIONAL TONE: ${selectedPath.emotionalTone}
RISK LEVEL: ${selectedPath.riskLevel}

CRITICAL INSTRUCTION: The chapter MUST follow this chosen path. Do not deviate from
the reader's choice. The consequences should begin to manifest in this chapter.
══════════════════════════════════════════════════════════════════════
`;
}

/**
 * Build prompt injection for a "What If" alternate path replay
 */
export function buildWhatIfPromptInjection(
  gate: TribulationGate,
  alternatePathId: string,
  originalChapterContent?: string
): string {
  const alternatePath = gate.fatePaths.find(p => p.id === alternatePathId);
  if (!alternatePath) {
    return '';
  }
  
  const originalPath = gate.fatePaths.find(p => p.id === gate.selectedPathId);
  
  return `
╔══════════════════════════════════════════════════════════════════╗
║  🔮 ALTERNATE REALITY: WHAT IF...?
║  ${gate.triggerType.toUpperCase().replace(/_/g, ' ')}
╚══════════════════════════════════════════════════════════════════╝

This is an ALTERNATE TIMELINE exploration. The reader originally chose 
"${originalPath?.label || 'a different path'}" but now wants to explore 
what would have happened if they had chosen differently.

SITUATION: ${gate.situation}

ALTERNATE PATH CHOSEN: ${alternatePath.label}
${alternatePath.description}

EXPECTED CONSEQUENCES OF THIS ALTERNATE PATH:
${alternatePath.consequences.map(c => `• ${c}`).join('\n')}

EMOTIONAL TONE: ${alternatePath.emotionalTone}
RISK LEVEL: ${alternatePath.riskLevel}

CRITICAL INSTRUCTION: Generate an ALTERNATE VERSION of Chapter ${gate.chapterNumber} 
that follows THIS path instead of the original choice. The chapter should:
1. Follow the alternate path's description and consequences
2. Match the emotional tone specified
3. Show how this different choice leads to different outcomes
4. Be complete and satisfying as a standalone alternate chapter

${originalChapterContent ? `
ORIGINAL CHAPTER CONTEXT (for reference only - do NOT copy):
The original chapter was approximately ${originalChapterContent.split(/\s+/).length} words.
Match similar length and pacing but with the alternate narrative.
` : ''}
══════════════════════════════════════════════════════════════════════
`;
}

/**
 * Store an alternate "What If" chapter
 */
export interface WhatIfChapter {
  id: string;
  gateId: string;
  novelId: string;
  originalChapterNumber: number;
  alternatePathId: string;
  alternatePathLabel: string;
  content: string;
  title: string;
  summary?: string;
  createdAt: number;
}

const WHAT_IF_CHAPTERS_KEY = 'what_if_chapters';

/**
 * Save a What If alternate chapter
 */
export function saveWhatIfChapter(chapter: WhatIfChapter): void {
  try {
    const stored = localStorage.getItem(WHAT_IF_CHAPTERS_KEY);
    const chapters: WhatIfChapter[] = stored ? JSON.parse(stored) : [];
    
    // Check if we already have this alternate for this gate
    const existingIndex = chapters.findIndex(
      c => c.gateId === chapter.gateId && c.alternatePathId === chapter.alternatePathId
    );
    
    if (existingIndex >= 0) {
      chapters[existingIndex] = chapter;
    } else {
      chapters.push(chapter);
    }
    
    // Keep only last 50 what-if chapters to prevent storage bloat
    const trimmed = chapters.slice(-50);
    localStorage.setItem(WHAT_IF_CHAPTERS_KEY, JSON.stringify(trimmed));
    
    logger.info('Saved What If chapter', 'tribulationGate', {
      gateId: chapter.gateId,
      chapterNumber: chapter.originalChapterNumber,
      alternatePath: chapter.alternatePathLabel,
    });
  } catch (error) {
    logger.error('Failed to save What If chapter', 'tribulationGate',
      error instanceof Error ? error : undefined);
  }
}

/**
 * Get all What If chapters for a gate
 */
export function getWhatIfChaptersForGate(gateId: string): WhatIfChapter[] {
  try {
    const stored = localStorage.getItem(WHAT_IF_CHAPTERS_KEY);
    if (!stored) return [];
    
    const chapters: WhatIfChapter[] = JSON.parse(stored);
    return chapters.filter(c => c.gateId === gateId);
  } catch {
    return [];
  }
}

/**
 * Get all What If chapters for a novel
 */
export function getWhatIfChaptersForNovel(novelId: string): WhatIfChapter[] {
  try {
    const stored = localStorage.getItem(WHAT_IF_CHAPTERS_KEY);
    if (!stored) return [];
    
    const chapters: WhatIfChapter[] = JSON.parse(stored);
    return chapters.filter(c => c.novelId === novelId);
  } catch {
    return [];
  }
}

/**
 * Delete a What If chapter
 */
export function deleteWhatIfChapter(id: string): boolean {
  try {
    const stored = localStorage.getItem(WHAT_IF_CHAPTERS_KEY);
    if (!stored) return false;
    
    const chapters: WhatIfChapter[] = JSON.parse(stored);
    const filtered = chapters.filter(c => c.id !== id);
    
    if (filtered.length === chapters.length) return false;
    
    localStorage.setItem(WHAT_IF_CHAPTERS_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}
