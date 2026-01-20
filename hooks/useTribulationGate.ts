/**
 * useTribulationGate Hook
 * 
 * React hook for managing Tribulation Gate state in the UI.
 * Handles displaying gates, selecting paths, and resuming generation.
 */

import { useState, useCallback, useEffect } from 'react';
import type {
  TribulationGate,
  FatePath,
  TribulationGateConfig,
  TribulationGateHistoryEntry,
} from '../types/tribulationGates';
import {
  getGatesForNovel,
  getGateById,
  getPendingGates,
  getMostRecentGate,
  getGateHistory,
  resolveGate,
  skipGate,
  getGateStatistics,
  getGateConfig,
  saveGateConfig,
  expirePendingGates,
} from '../services/tribulationGateService';
import { logger } from '../services/loggingService';

/**
 * State for the tribulation gate UI
 */
interface TribulationGateState {
  /** Currently active/visible gate */
  activeGate: TribulationGate | null;
  /** Is the gate modal visible */
  isGateVisible: boolean;
  /** Is a path selection being processed */
  isProcessing: boolean;
  /** Selected path (before confirmation) */
  selectedPath: FatePath | null;
  /** Error message if any */
  error: string | null;
  /** Gate configuration */
  config: TribulationGateConfig | null;
  /** Gate history entries */
  history: TribulationGateHistoryEntry[];
  /** Gate statistics */
  stats: {
    totalGates: number;
    resolvedGates: number;
    skippedGates: number;
    pendingGates: number;
  } | null;
}

/**
 * Actions returned by the hook
 */
interface TribulationGateActions {
  /** Show a specific gate */
  showGate: (gate: TribulationGate) => void;
  /** Hide the gate modal */
  hideGate: () => void;
  /** Select a path (preview before confirmation) */
  selectPath: (path: FatePath) => void;
  /** Confirm the selected path */
  confirmSelection: () => Promise<TribulationGate | null>;
  /** Skip the current gate */
  skipCurrentGate: (reason?: string) => Promise<void>;
  /** Update gate configuration */
  updateConfig: (config: Partial<TribulationGateConfig>) => void;
  /** Refresh gate data */
  refresh: () => void;
  /** Check for pending gates */
  checkPendingGates: () => TribulationGate | null;
  /** Clear error */
  clearError: () => void;
}

/**
 * Hook for managing Tribulation Gate UI state
 */
export function useTribulationGate(novelId: string | undefined): [TribulationGateState, TribulationGateActions] {
  const [state, setState] = useState<TribulationGateState>({
    activeGate: null,
    isGateVisible: false,
    isProcessing: false,
    selectedPath: null,
    error: null,
    config: null,
    history: [],
    stats: null,
  });

  // Load initial data
  useEffect(() => {
    if (!novelId) return;

    // Expire old pending gates
    expirePendingGates(novelId);

    // Load config
    const config = getGateConfig(novelId);
    
    // Load history
    const history = getGateHistory(novelId);
    
    // Load stats
    const stats = getGateStatistics(novelId);

    setState(prev => ({
      ...prev,
      config,
      history,
      stats: {
        totalGates: stats.totalGates,
        resolvedGates: stats.resolvedGates,
        skippedGates: stats.skippedGates,
        pendingGates: stats.pendingGates,
      },
    }));
  }, [novelId]);

  // Show a gate
  const showGate = useCallback((gate: TribulationGate) => {
    setState(prev => ({
      ...prev,
      activeGate: gate,
      isGateVisible: true,
      selectedPath: null,
      error: null,
    }));
  }, []);

  // Hide the gate modal
  const hideGate = useCallback(() => {
    setState(prev => ({
      ...prev,
      isGateVisible: false,
      selectedPath: null,
    }));
  }, []);

  // Select a path (preview)
  const selectPath = useCallback((path: FatePath) => {
    setState(prev => ({
      ...prev,
      selectedPath: path,
    }));
  }, []);

  // Confirm selection
  const confirmSelection = useCallback(async (): Promise<TribulationGate | null> => {
    const { activeGate, selectedPath } = state;
    
    if (!activeGate || !selectedPath) {
      setState(prev => ({ ...prev, error: 'No gate or path selected' }));
      return null;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const resolvedGate = resolveGate(activeGate.id, selectedPath.id);
      
      if (!resolvedGate) {
        throw new Error('Failed to resolve gate');
      }

      logger.info('Tribulation Gate path confirmed', 'tribulationGate', {
        gateId: activeGate.id,
        pathId: selectedPath.id,
        pathLabel: selectedPath.label,
      });

      // Refresh stats
      if (novelId) {
        const stats = getGateStatistics(novelId);
        const history = getGateHistory(novelId);
        
        setState(prev => ({
          ...prev,
          activeGate: resolvedGate,
          isProcessing: false,
          isGateVisible: false,
          history,
          stats: {
            totalGates: stats.totalGates,
            resolvedGates: stats.resolvedGates,
            skippedGates: stats.skippedGates,
            pendingGates: stats.pendingGates,
          },
        }));
      }

      return resolvedGate;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMsg,
      }));
      return null;
    }
  }, [state, novelId]);

  // Skip gate
  const skipCurrentGate = useCallback(async (reason?: string) => {
    const { activeGate } = state;
    
    if (!activeGate) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      skipGate(activeGate.id, reason || 'User skipped');

      logger.info('Tribulation Gate skipped', 'tribulationGate', {
        gateId: activeGate.id,
        reason,
      });

      // Refresh
      if (novelId) {
        const stats = getGateStatistics(novelId);
        
        setState(prev => ({
          ...prev,
          activeGate: null,
          isProcessing: false,
          isGateVisible: false,
          selectedPath: null,
          stats: {
            totalGates: stats.totalGates,
            resolvedGates: stats.resolvedGates,
            skippedGates: stats.skippedGates,
            pendingGates: stats.pendingGates,
          },
        }));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: errorMsg,
      }));
    }
  }, [state, novelId]);

  // Update config
  const updateConfig = useCallback((configUpdates: Partial<TribulationGateConfig>) => {
    if (!novelId || !state.config) return;

    const newConfig = { ...state.config, ...configUpdates };
    saveGateConfig(novelId, newConfig);
    
    setState(prev => ({ ...prev, config: newConfig }));
  }, [novelId, state.config]);

  // Refresh data
  const refresh = useCallback(() => {
    if (!novelId) return;

    const config = getGateConfig(novelId);
    const history = getGateHistory(novelId);
    const stats = getGateStatistics(novelId);

    setState(prev => ({
      ...prev,
      config,
      history,
      stats: {
        totalGates: stats.totalGates,
        resolvedGates: stats.resolvedGates,
        skippedGates: stats.skippedGates,
        pendingGates: stats.pendingGates,
      },
    }));
  }, [novelId]);

  // Check for pending gates
  const checkPendingGates = useCallback((): TribulationGate | null => {
    if (!novelId) return null;

    const pending = getPendingGates(novelId);
    if (pending.length > 0) {
      return pending[0]; // Return most recent pending gate
    }
    return null;
  }, [novelId]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: TribulationGateActions = {
    showGate,
    hideGate,
    selectPath,
    confirmSelection,
    skipCurrentGate,
    updateConfig,
    refresh,
    checkPendingGates,
    clearError,
  };

  return [state, actions];
}

/**
 * Hook for handling Tribulation Gate generation flow
 * Used when a gate interrupts chapter generation
 */
export function useTribulationGateFlow(novelId: string | undefined) {
  const [gateState, gateActions] = useTribulationGate(novelId);
  const [isAwaitingResolution, setIsAwaitingResolution] = useState(false);
  const [resolvedGateId, setResolvedGateId] = useState<string | null>(null);

  /**
   * Handle a gate interrupt from chapter generation
   */
  const handleGateInterrupt = useCallback((gate: TribulationGate) => {
    setIsAwaitingResolution(true);
    setResolvedGateId(null);
    gateActions.showGate(gate);
  }, [gateActions]);

  /**
   * Resolve the gate and prepare to resume generation
   */
  const resolveAndResume = useCallback(async (): Promise<{ gateId: string; success: boolean }> => {
    const resolvedGate = await gateActions.confirmSelection();
    
    if (resolvedGate) {
      setResolvedGateId(resolvedGate.id);
      setIsAwaitingResolution(false);
      return { gateId: resolvedGate.id, success: true };
    }
    
    return { gateId: '', success: false };
  }, [gateActions]);

  /**
   * Skip the gate and prepare to resume generation
   */
  const skipAndResume = useCallback(async (): Promise<{ success: boolean }> => {
    await gateActions.skipCurrentGate('User skipped to continue generation');
    setIsAwaitingResolution(false);
    setResolvedGateId(null);
    return { success: true };
  }, [gateActions]);

  /**
   * Get the resolved gate ID for continuing generation
   */
  const getResolvedGateId = useCallback((): string | null => {
    return resolvedGateId;
  }, [resolvedGateId]);

  /**
   * Clear the flow state
   */
  const clearFlow = useCallback(() => {
    setIsAwaitingResolution(false);
    setResolvedGateId(null);
    gateActions.hideGate();
  }, [gateActions]);

  return {
    gateState,
    gateActions,
    isAwaitingResolution,
    resolvedGateId,
    handleGateInterrupt,
    resolveAndResume,
    skipAndResume,
    getResolvedGateId,
    clearFlow,
  };
}

export type { TribulationGateState, TribulationGateActions };
