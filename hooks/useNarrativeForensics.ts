/**
 * useNarrativeForensics Hook
 * 
 * React hook for managing narrative forensic scans and recovered threads.
 * Provides state management and actions for the Loom Excavator component.
 */

import { useState, useCallback, useMemo } from 'react';
import { NovelState } from '../types';
import {
  NarrativeSeed,
  ExcavationResult,
  NarrativeDebtBreakdown,
  RecoveredThread,
  DirectorRecoveryPayload,
  calculateNarrativeDebt,
  NEGLECT_THRESHOLDS,
} from '../types/narrativeForensics';
import {
  runExcavation,
  approveSeed,
  rejectSeed,
  getExcavationRecommendations,
  ExcavationProgress,
} from '../services/narrativeForensics';
import {
  createRecoveryDirectives,
  shouldTriggerAutoRecall,
} from '../services/narrativeForensics/directorIntegration';

// ============================================================================
// TYPES
// ============================================================================

export interface NarrativeForensicsState {
  isScanning: boolean;
  progress: ExcavationProgress | null;
  seeds: NarrativeSeed[];
  recoveredThreads: RecoveredThread[];
  lastScanResult: ExcavationResult | null;
  narrativeDebt: NarrativeDebtBreakdown | null;
  directorPayload: DirectorRecoveryPayload | null;
  error: string | null;
}

export interface NarrativeForensicsActions {
  runScan: (startChapter: number, endChapter: number) => Promise<ExcavationResult | null>;
  approveSeed: (seed: NarrativeSeed) => Promise<RecoveredThread | null>;
  rejectSeed: (seed: NarrativeSeed) => void;
  clearSeeds: () => void;
  refreshDirectorPayload: () => void;
  checkAutoRecallTrigger: () => { shouldTrigger: boolean; reason?: string; urgency: string };
}

export interface UseNarrativeForensicsResult {
  state: NarrativeForensicsState;
  actions: NarrativeForensicsActions;
  computed: {
    activeSeeds: NarrativeSeed[];
    staleSeeds: NarrativeSeed[];
    criticalSeeds: NarrativeSeed[];
    recommendations: string[];
    hasHighDebt: boolean;
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useNarrativeForensics(
  novelState: NovelState,
  onThreadRecovered?: (thread: RecoveredThread) => void
): UseNarrativeForensicsResult {
  // State
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ExcavationProgress | null>(null);
  const [seeds, setSeeds] = useState<NarrativeSeed[]>([]);
  const [recoveredThreads, setRecoveredThreads] = useState<RecoveredThread[]>([]);
  const [lastScanResult, setLastScanResult] = useState<ExcavationResult | null>(null);
  const [narrativeDebt, setNarrativeDebt] = useState<NarrativeDebtBreakdown | null>(null);
  const [directorPayload, setDirectorPayload] = useState<DirectorRecoveryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Run excavation scan
  const runScan = useCallback(async (
    startChapter: number,
    endChapter: number
  ): Promise<ExcavationResult | null> => {
    if (isScanning) return null;

    setIsScanning(true);
    setProgress({ phase: 'discovery', current: 0, total: 1, message: 'Initializing...' });
    setError(null);

    try {
      const result = await runExcavation(
        novelState,
        {
          novelId: novelState.id,
          startChapter,
          endChapter,
        },
        {},
        (prog) => setProgress(prog)
      );

      if (result.success) {
        setSeeds(result.seeds);
        setLastScanResult(result);
        setNarrativeDebt(result.narrativeDebt);
      } else {
        setError(result.summary);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [novelState, isScanning]);

  // Approve a seed and convert to thread
  const handleApproveSeed = useCallback(async (
    seed: NarrativeSeed
  ): Promise<RecoveredThread | null> => {
    try {
      const { thread, updatedSeed } = await approveSeed(seed, novelState);
      
      // Update seeds list
      setSeeds(prev => prev.map(s => s.id === seed.id ? updatedSeed : s));
      
      // Add to recovered threads
      setRecoveredThreads(prev => [...prev, thread]);
      
      // Recalculate narrative debt
      const updatedSeeds = seeds.map(s => s.id === seed.id ? updatedSeed : s);
      const newDebt = calculateNarrativeDebt(updatedSeeds);
      setNarrativeDebt(newDebt);
      
      // Notify callback
      onThreadRecovered?.(thread);
      
      return thread;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      return null;
    }
  }, [novelState, seeds, onThreadRecovered]);

  // Reject a seed
  const handleRejectSeed = useCallback((seed: NarrativeSeed) => {
    const rejected = rejectSeed(seed);
    setSeeds(prev => prev.map(s => s.id === seed.id ? rejected : s));
    
    // Recalculate narrative debt
    const updatedSeeds = seeds.map(s => s.id === seed.id ? rejected : s);
    const newDebt = calculateNarrativeDebt(updatedSeeds);
    setNarrativeDebt(newDebt);
  }, [seeds]);

  // Clear all seeds
  const clearSeeds = useCallback(() => {
    setSeeds([]);
    setLastScanResult(null);
    setNarrativeDebt(null);
    setDirectorPayload(null);
  }, []);

  // Refresh director payload
  const refreshDirectorPayload = useCallback(() => {
    if (recoveredThreads.length === 0) {
      setDirectorPayload(null);
      return;
    }

    const payload = createRecoveryDirectives(recoveredThreads, novelState);
    setDirectorPayload(payload);
  }, [recoveredThreads, novelState]);

  // Check if auto-recall should be triggered
  const checkAutoRecallTrigger = useCallback(() => {
    return shouldTriggerAutoRecall(novelState, narrativeDebt || undefined);
  }, [novelState, narrativeDebt]);

  // Computed values
  const computed = useMemo(() => {
    const activeSeeds = seeds.filter(s => 
      s.status !== 'rejected' && s.status !== 'converted'
    );
    
    const staleSeeds = activeSeeds.filter(s => 
      s.neglectScore >= NEGLECT_THRESHOLDS.stale
    );
    
    const criticalSeeds = activeSeeds.filter(s => 
      s.neglectScore >= NEGLECT_THRESHOLDS.critical
    );
    
    const recommendations = narrativeDebt 
      ? getExcavationRecommendations(seeds, narrativeDebt)
      : [];
    
    const hasHighDebt = narrativeDebt 
      ? narrativeDebt.weightedDebtScore > 15
      : false;

    return {
      activeSeeds,
      staleSeeds,
      criticalSeeds,
      recommendations,
      hasHighDebt,
    };
  }, [seeds, narrativeDebt]);

  // Build state object
  const state: NarrativeForensicsState = {
    isScanning,
    progress,
    seeds,
    recoveredThreads,
    lastScanResult,
    narrativeDebt,
    directorPayload,
    error,
  };

  // Build actions object
  const actions: NarrativeForensicsActions = {
    runScan,
    approveSeed: handleApproveSeed,
    rejectSeed: handleRejectSeed,
    clearSeeds,
    refreshDirectorPayload,
    checkAutoRecallTrigger,
  };

  return { state, actions, computed };
}

/**
 * Get recovered threads that should be prioritized in the next chapter
 */
export function getRecoveredThreadsForNextChapter(
  recoveredThreads: RecoveredThread[],
  maxThreads: number = 3
): RecoveredThread[] {
  // Filter to threads that are approved or being reintroduced
  const activeRecovered = recoveredThreads.filter(t => 
    t.recoveryStatus === 'approved' || t.recoveryStatus === 'reintroducing'
  );

  // Sort by neglect score (highest first) and priority multiplier
  const sorted = [...activeRecovered].sort((a, b) => {
    const scoreA = a.neglectScore * a.priorityMultiplier;
    const scoreB = b.neglectScore * b.priorityMultiplier;
    return scoreB - scoreA;
  });

  return sorted.slice(0, maxThreads);
}

/**
 * Format recovered threads for inclusion in chapter generation prompt
 */
export function formatRecoveredThreadsForPrompt(
  threads: RecoveredThread[]
): string {
  if (threads.length === 0) return '';

  const lines: string[] = [];
  lines.push('=== RECOVERED NARRATIVE THREADS ===');
  lines.push('The following plot elements have been forgotten and MUST be reintroduced:');
  lines.push('');

  for (const thread of threads) {
    const evidence = thread.historicalEvidence;
    lines.push(`📜 "${thread.title}" (${thread.type})`);
    lines.push(`   Origin: Chapter ${evidence.originChapter}`);
    lines.push(`   Gap: ${thread.neglectScore} chapters without mention`);
    lines.push(`   Priority: ${thread.priorityMultiplier}x`);
    if (evidence.originQuote) {
      lines.push(`   Original: "${evidence.originQuote.slice(0, 100)}..."`);
    }
    lines.push('');
  }

  lines.push('⚠️ Weave these elements back into the narrative naturally.');
  lines.push('===================================');

  return lines.join('\n');
}

export default useNarrativeForensics;
