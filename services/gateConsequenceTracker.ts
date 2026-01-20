/**
 * Gate Consequence Tracker Service
 * 
 * Tracks the expected consequences from Tribulation Gate choices and monitors
 * when they manifest in subsequent chapters. This creates a feedback loop
 * showing readers how their decisions shaped the story.
 */

import { NovelState, Chapter } from '../types';
import {
  TribulationGate,
  FatePath,
  TribulationTrigger,
} from '../types/tribulationGates';
import { getGatesForNovel } from './tribulationGateService';
import { logger } from './loggingService';
import { generateUUID } from '../utils/uuid';

/**
 * Consequence tracking status
 */
export type ConsequenceStatus = 
  | 'pending'      // Expected but not yet manifested
  | 'manifesting'  // Starting to appear in the story
  | 'fulfilled'    // Fully realized in the narrative
  | 'subverted'    // Deliberately went a different direction
  | 'forgotten';   // Never addressed (potential plot hole)

/**
 * A tracked consequence from a gate choice
 */
export interface TrackedConsequence {
  id: string;
  gateId: string;
  novelId: string;
  /** The original chapter where the gate occurred */
  sourceChapterNumber: number;
  /** The consequence text from the FatePath */
  consequenceText: string;
  /** Which path this consequence came from */
  pathId: string;
  pathLabel: string;
  /** Type of consequence */
  consequenceType: 'positive' | 'negative' | 'neutral' | 'unknown';
  /** Current tracking status */
  status: ConsequenceStatus;
  /** Chapters where this consequence was detected */
  manifestationChapters: number[];
  /** Brief descriptions of how it manifested */
  manifestationNotes: string[];
  /** When this was created */
  createdAt: number;
  /** When it was last updated */
  updatedAt: number;
  /** Confidence score (0-100) for manifestation detection */
  manifestationConfidence?: number;
}

/**
 * Summary of consequence tracking for a novel
 */
export interface ConsequenceTrackingSummary {
  totalConsequences: number;
  pendingConsequences: number;
  manifestingConsequences: number;
  fulfilledConsequences: number;
  subvertedConsequences: number;
  forgottenConsequences: number;
  /** Consequences that might need attention */
  overduePending: TrackedConsequence[];
  /** Recently manifested consequences */
  recentManifestations: TrackedConsequence[];
}

const CONSEQUENCES_STORAGE_KEY = 'tribulation_gate_consequences';

/**
 * Get all tracked consequences for a novel
 */
export function getTrackedConsequences(novelId: string): TrackedConsequence[] {
  try {
    const stored = localStorage.getItem(CONSEQUENCES_STORAGE_KEY);
    if (!stored) return [];
    
    const all: TrackedConsequence[] = JSON.parse(stored);
    return all.filter(c => c.novelId === novelId);
  } catch {
    return [];
  }
}

/**
 * Save tracked consequences
 */
function saveTrackedConsequences(consequences: TrackedConsequence[]): void {
  try {
    // Merge with existing consequences from other novels
    const stored = localStorage.getItem(CONSEQUENCES_STORAGE_KEY);
    const existing: TrackedConsequence[] = stored ? JSON.parse(stored) : [];
    
    // Get novel IDs in new consequences
    const novelIds = new Set(consequences.map(c => c.novelId));
    
    // Keep consequences from other novels
    const otherNovelConsequences = existing.filter(c => !novelIds.has(c.novelId));
    
    // Combine and save
    const combined = [...otherNovelConsequences, ...consequences];
    localStorage.setItem(CONSEQUENCES_STORAGE_KEY, JSON.stringify(combined));
  } catch (error) {
    logger.error('Failed to save tracked consequences', 'consequenceTracker',
      error instanceof Error ? error : undefined);
  }
}

/**
 * Extract consequences from a resolved gate and start tracking them
 */
export function trackGateConsequences(gate: TribulationGate): TrackedConsequence[] {
  if (gate.status !== 'resolved' || !gate.selectedPathId) {
    return [];
  }
  
  const selectedPath = gate.fatePaths.find(p => p.id === gate.selectedPathId);
  if (!selectedPath || !selectedPath.consequences || selectedPath.consequences.length === 0) {
    return [];
  }
  
  const existingConsequences = getTrackedConsequences(gate.novelId);
  const newConsequences: TrackedConsequence[] = [];
  
  for (const consequenceText of selectedPath.consequences) {
    // Check if we're already tracking this
    const existing = existingConsequences.find(
      c => c.gateId === gate.id && c.consequenceText === consequenceText
    );
    
    if (!existing) {
      const consequence: TrackedConsequence = {
        id: generateUUID(),
        gateId: gate.id,
        novelId: gate.novelId,
        sourceChapterNumber: gate.chapterNumber,
        consequenceText,
        pathId: selectedPath.id,
        pathLabel: selectedPath.label,
        consequenceType: categorizeConsequence(consequenceText),
        status: 'pending',
        manifestationChapters: [],
        manifestationNotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      newConsequences.push(consequence);
    }
  }
  
  if (newConsequences.length > 0) {
    saveTrackedConsequences([...existingConsequences, ...newConsequences]);
    
    logger.info('Started tracking gate consequences', 'consequenceTracker', {
      gateId: gate.id,
      consequenceCount: newConsequences.length,
      pathLabel: selectedPath.label,
    });
  }
  
  return newConsequences;
}

/**
 * Categorize a consequence as positive, negative, or neutral
 */
function categorizeConsequence(text: string): 'positive' | 'negative' | 'neutral' | 'unknown' {
  const lowerText = text.toLowerCase();
  
  const positiveIndicators = [
    'gain', 'improve', 'strengthen', 'ally', 'support', 'reward',
    'success', 'breakthrough', 'advance', 'achieve', 'victory',
    'friendship', 'trust', 'power', 'wealth', 'honor', 'recognition'
  ];
  
  const negativeIndicators = [
    'lose', 'damage', 'weaken', 'enemy', 'danger', 'risk',
    'injury', 'death', 'betray', 'fail', 'cost', 'sacrifice',
    'corruption', 'debt', 'curse', 'revenge', 'hatred', 'isolation'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const indicator of positiveIndicators) {
    if (lowerText.includes(indicator)) positiveScore++;
  }
  
  for (const indicator of negativeIndicators) {
    if (lowerText.includes(indicator)) negativeScore++;
  }
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  if (positiveScore > 0 || negativeScore > 0) return 'neutral';
  return 'unknown';
}

/**
 * Check a chapter for consequence manifestations
 */
export function checkChapterForConsequences(
  novelId: string,
  chapter: Chapter
): { updated: TrackedConsequence[]; detected: string[] } {
  const consequences = getTrackedConsequences(novelId);
  const pendingConsequences = consequences.filter(
    c => c.status === 'pending' || c.status === 'manifesting'
  );
  
  if (pendingConsequences.length === 0) {
    return { updated: [], detected: [] };
  }
  
  const chapterLower = chapter.content.toLowerCase();
  const summaryLower = (chapter.summary || '').toLowerCase();
  const combinedText = `${chapterLower} ${summaryLower}`;
  
  const updated: TrackedConsequence[] = [];
  const detected: string[] = [];
  
  for (const consequence of pendingConsequences) {
    // Skip if this chapter is before the gate
    if (chapter.number <= consequence.sourceChapterNumber) continue;
    
    // Check if already detected in this chapter
    if (consequence.manifestationChapters.includes(chapter.number)) continue;
    
    // Check for manifestation
    const detection = detectConsequenceManifestation(
      consequence.consequenceText,
      combinedText,
      consequence.consequenceType
    );
    
    if (detection.detected) {
      // Update the consequence
      consequence.manifestationChapters.push(chapter.number);
      consequence.manifestationNotes.push(
        `Ch.${chapter.number}: ${detection.note}`
      );
      consequence.manifestationConfidence = detection.confidence;
      consequence.updatedAt = Date.now();
      
      // Update status based on confidence and count
      if (consequence.manifestationChapters.length >= 2 || detection.confidence >= 80) {
        consequence.status = 'fulfilled';
      } else {
        consequence.status = 'manifesting';
      }
      
      updated.push(consequence);
      detected.push(`"${consequence.consequenceText}" → ${detection.note}`);
      
      logger.info('Consequence manifestation detected', 'consequenceTracker', {
        consequenceId: consequence.id,
        chapterNumber: chapter.number,
        confidence: detection.confidence,
        status: consequence.status,
      });
    }
  }
  
  if (updated.length > 0) {
    // Save updated consequences
    const allConsequences = getTrackedConsequences(novelId);
    const updatedMap = new Map(updated.map(c => [c.id, c]));
    
    const merged = allConsequences.map(c => updatedMap.get(c.id) || c);
    saveTrackedConsequences(merged);
  }
  
  return { updated, detected };
}

/**
 * Detect if a consequence is manifesting in chapter text
 */
function detectConsequenceManifestation(
  consequenceText: string,
  chapterText: string,
  consequenceType: string
): { detected: boolean; confidence: number; note: string } {
  // Extract key terms from the consequence
  const keywords = extractKeywords(consequenceText);
  
  if (keywords.length === 0) {
    return { detected: false, confidence: 0, note: '' };
  }
  
  // Count keyword matches
  let matchCount = 0;
  const matchedKeywords: string[] = [];
  
  for (const keyword of keywords) {
    if (chapterText.includes(keyword.toLowerCase())) {
      matchCount++;
      matchedKeywords.push(keyword);
    }
  }
  
  // Calculate confidence based on match ratio
  const matchRatio = matchCount / keywords.length;
  const confidence = Math.min(100, Math.round(matchRatio * 100 + (matchCount * 10)));
  
  // Determine if detected (at least 30% match or 2+ keywords)
  const detected = matchRatio >= 0.3 || matchCount >= 2;
  
  if (!detected) {
    return { detected: false, confidence: 0, note: '' };
  }
  
  return {
    detected,
    confidence,
    note: `Keywords matched: ${matchedKeywords.join(', ')}`,
  };
}

/**
 * Extract important keywords from consequence text
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'he', 'she', 'him', 'her', 'his', 'hers', 'we', 'us', 'our', 'you',
    'your', 'i', 'me', 'my', 'mine', 'who', 'what', 'which', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'not', 'only', 'same', 'than',
    'too', 'very', 'just', 'as', 'if', 'so', 'also', 'into', 'through'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  // Return unique keywords
  return [...new Set(words)];
}

/**
 * Get a summary of consequence tracking for a novel
 */
export function getConsequenceTrackingSummary(
  novelId: string,
  currentChapterNumber: number
): ConsequenceTrackingSummary {
  const consequences = getTrackedConsequences(novelId);
  
  const pendingConsequences = consequences.filter(c => c.status === 'pending');
  const manifestingConsequences = consequences.filter(c => c.status === 'manifesting');
  const fulfilledConsequences = consequences.filter(c => c.status === 'fulfilled');
  const subvertedConsequences = consequences.filter(c => c.status === 'subverted');
  const forgottenConsequences = consequences.filter(c => c.status === 'forgotten');
  
  // Find overdue pending consequences (more than 20 chapters without manifestation)
  const overduePending = pendingConsequences.filter(
    c => currentChapterNumber - c.sourceChapterNumber > 20
  );
  
  // Find recently manifested consequences (within last 5 chapters)
  const recentManifestations = [...manifestingConsequences, ...fulfilledConsequences]
    .filter(c => {
      const lastManifestation = Math.max(...c.manifestationChapters, 0);
      return lastManifestation > 0 && currentChapterNumber - lastManifestation <= 5;
    })
    .sort((a, b) => {
      const aLast = Math.max(...a.manifestationChapters, 0);
      const bLast = Math.max(...b.manifestationChapters, 0);
      return bLast - aLast;
    });
  
  return {
    totalConsequences: consequences.length,
    pendingConsequences: pendingConsequences.length,
    manifestingConsequences: manifestingConsequences.length,
    fulfilledConsequences: fulfilledConsequences.length,
    subvertedConsequences: subvertedConsequences.length,
    forgottenConsequences: forgottenConsequences.length,
    overduePending,
    recentManifestations,
  };
}

/**
 * Mark a consequence as subverted (deliberately went a different direction)
 */
export function markConsequenceSubverted(consequenceId: string, note?: string): boolean {
  try {
    const stored = localStorage.getItem(CONSEQUENCES_STORAGE_KEY);
    if (!stored) return false;
    
    const consequences: TrackedConsequence[] = JSON.parse(stored);
    const consequence = consequences.find(c => c.id === consequenceId);
    
    if (!consequence) return false;
    
    consequence.status = 'subverted';
    consequence.updatedAt = Date.now();
    if (note) {
      consequence.manifestationNotes.push(`Subverted: ${note}`);
    }
    
    localStorage.setItem(CONSEQUENCES_STORAGE_KEY, JSON.stringify(consequences));
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark a consequence as forgotten (intentionally dropping the thread)
 */
export function markConsequenceForgotten(consequenceId: string): boolean {
  try {
    const stored = localStorage.getItem(CONSEQUENCES_STORAGE_KEY);
    if (!stored) return false;
    
    const consequences: TrackedConsequence[] = JSON.parse(stored);
    const consequence = consequences.find(c => c.id === consequenceId);
    
    if (!consequence) return false;
    
    consequence.status = 'forgotten';
    consequence.updatedAt = Date.now();
    
    localStorage.setItem(CONSEQUENCES_STORAGE_KEY, JSON.stringify(consequences));
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a prompt reminder for pending consequences
 * This can be injected into chapter generation prompts
 */
export function buildConsequenceReminder(novelId: string): string {
  const consequences = getTrackedConsequences(novelId);
  const pendingOrManifesting = consequences.filter(
    c => c.status === 'pending' || c.status === 'manifesting'
  );
  
  if (pendingOrManifesting.length === 0) {
    return '';
  }
  
  const lines = [
    '╔══════════════════════════════════════════════════════════════════╗',
    '║  PENDING FATE CONSEQUENCES - Consider Weaving These In',
    '╚══════════════════════════════════════════════════════════════════╝',
    '',
    'The following consequences from past Tribulation Gate decisions',
    'are expected to manifest. Consider incorporating them naturally:',
    '',
  ];
  
  for (const c of pendingOrManifesting.slice(0, 5)) {
    const status = c.status === 'manifesting' ? '(manifesting)' : '(pending)';
    lines.push(`• [Ch.${c.sourceChapterNumber}] "${c.pathLabel}": ${c.consequenceText} ${status}`);
  }
  
  if (pendingOrManifesting.length > 5) {
    lines.push(`... and ${pendingOrManifesting.length - 5} more`);
  }
  
  lines.push('');
  lines.push('══════════════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
