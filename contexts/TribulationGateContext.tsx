/**
 * Tribulation Gate Context
 * 
 * Provides global state for Tribulation Gates across the application.
 * Used to share gate state between chapter generation and UI components.
 */

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type {
  TribulationGate,
  FatePath,
  TribulationGateConfig,
} from '../types/tribulationGates';
import {
  getGateConfig,
  saveGateConfig,
  getPendingGates,
  resolveGate,
  skipGate,
  getGateStatistics,
  expirePendingGates,
} from '../services/tribulationGateService';
import { logger } from '../services/loggingService';

/**
 * Context state type
 */
interface TribulationGateContextState {
  /** Currently active gate (if any) */
  activeGate: TribulationGate | null;
  /** Is the gate modal visible */
  isModalVisible: boolean;
  /** Is processing a selection */
  isProcessing: boolean;
  /** Currently selected path (before confirmation) */
  selectedPath: FatePath | null;
  /** Configuration for the current novel */
  config: TribulationGateConfig | null;
  /** Error message */
  error: string | null;
  /** Is chapter generation waiting for gate resolution */
  isGenerationPaused: boolean;
  /** Callback to resume generation after gate resolution */
  resumeCallback: ((gateId: string | null) => void) | null;
  /** Statistics */
  stats: {
    total: number;
    resolved: number;
    pending: number;
  };
}

/**
 * Context actions type
 */
interface TribulationGateContextActions {
  /** Initialize for a novel */
  initialize: (novelId: string) => void;
  /** Show gate modal with a gate */
  showGate: (gate: TribulationGate, onResolve?: (gateId: string | null) => void) => void;
  /** Hide the gate modal */
  hideGate: () => void;
  /** Select a path */
  selectPath: (path: FatePath | null) => void;
  /** Confirm and resolve the gate */
  confirmPath: () => Promise<TribulationGate | null>;
  /** Skip the gate */
  skipGateAction: (reason?: string) => Promise<void>;
  /** Update configuration */
  updateConfig: (updates: Partial<TribulationGateConfig>) => void;
  /** Check for pending gates */
  checkPending: () => TribulationGate[];
  /** Clear error */
  clearError: () => void;
}

type TribulationGateContextType = TribulationGateContextState & TribulationGateContextActions;

const TribulationGateContext = createContext<TribulationGateContextType | null>(null);

/**
 * Provider component
 */
export function TribulationGateProvider({ children }: { children: React.ReactNode }) {
  const [novelId, setNovelId] = useState<string | null>(null);
  const [state, setState] = useState<TribulationGateContextState>({
    activeGate: null,
    isModalVisible: false,
    isProcessing: false,
    selectedPath: null,
    config: null,
    error: null,
    isGenerationPaused: false,
    resumeCallback: null,
    stats: { total: 0, resolved: 0, pending: 0 },
  });

  // Initialize for a novel
  const initialize = useCallback((id: string) => {
    setNovelId(id);
    
    // Expire old gates
    expirePendingGates(id);
    
    // Load config and stats
    const config = getGateConfig(id);
    const stats = getGateStatistics(id);
    
    setState(prev => ({
      ...prev,
      config,
      stats: {
        total: stats.totalGates,
        resolved: stats.resolvedGates,
        pending: stats.pendingGates,
      },
    }));
  }, []);

  // Show gate
  const showGate = useCallback((gate: TribulationGate, onResolve?: (gateId: string | null) => void) => {
    setState(prev => ({
      ...prev,
      activeGate: gate,
      isModalVisible: true,
      selectedPath: null,
      error: null,
      isGenerationPaused: !!onResolve,
      resumeCallback: onResolve || null,
    }));
  }, []);

  // Hide gate
  const hideGate = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalVisible: false,
      selectedPath: null,
      // Don't clear activeGate or callbacks yet - might still be processing
    }));
  }, []);

  // Select path
  const selectPath = useCallback((path: FatePath | null) => {
    setState(prev => ({ ...prev, selectedPath: path }));
  }, []);

  // Confirm path
  const confirmPath = useCallback(async (): Promise<TribulationGate | null> => {
    const { activeGate, selectedPath, resumeCallback } = state;
    
    if (!activeGate || !selectedPath) {
      setState(prev => ({ ...prev, error: 'No gate or path selected' }));
      return null;
    }

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const resolved = resolveGate(activeGate.id, selectedPath.id);
      
      if (!resolved) {
        throw new Error('Failed to resolve gate');
      }

      logger.info('Gate resolved via context', 'tribulationGate', {
        gateId: activeGate.id,
        pathId: selectedPath.id,
      });

      // Update stats
      if (novelId) {
        const stats = getGateStatistics(novelId);
        
        setState(prev => ({
          ...prev,
          activeGate: resolved,
          isProcessing: false,
          isModalVisible: false,
          isGenerationPaused: false,
          stats: {
            total: stats.totalGates,
            resolved: stats.resolvedGates,
            pending: stats.pendingGates,
          },
        }));
      }

      // Call resume callback if generation was paused
      if (resumeCallback) {
        resumeCallback(resolved.id);
      }

      return resolved;

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: msg,
      }));
      return null;
    }
  }, [state, novelId]);

  // Skip gate
  const skipGateAction = useCallback(async (reason?: string) => {
    const { activeGate, resumeCallback } = state;
    
    if (!activeGate) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      skipGate(activeGate.id, reason || 'User skipped');

      // Update stats
      if (novelId) {
        const stats = getGateStatistics(novelId);
        
        setState(prev => ({
          ...prev,
          activeGate: null,
          isProcessing: false,
          isModalVisible: false,
          selectedPath: null,
          isGenerationPaused: false,
          resumeCallback: null,
          stats: {
            total: stats.totalGates,
            resolved: stats.resolvedGates,
            pending: stats.pendingGates,
          },
        }));
      }

      // Resume generation without gate
      if (resumeCallback) {
        resumeCallback(null);
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: msg,
      }));
    }
  }, [state, novelId]);

  // Update config
  const updateConfig = useCallback((updates: Partial<TribulationGateConfig>) => {
    if (!novelId || !state.config) return;

    const newConfig = { ...state.config, ...updates };
    saveGateConfig(novelId, newConfig);
    
    setState(prev => ({ ...prev, config: newConfig }));
  }, [novelId, state.config]);

  // Check pending
  const checkPending = useCallback((): TribulationGate[] => {
    if (!novelId) return [];
    return getPendingGates(novelId);
  }, [novelId]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const contextValue: TribulationGateContextType = {
    ...state,
    initialize,
    showGate,
    hideGate,
    selectPath,
    confirmPath,
    skipGateAction,
    updateConfig,
    checkPending,
    clearError,
  };

  return (
    <TribulationGateContext.Provider value={contextValue}>
      {children}
    </TribulationGateContext.Provider>
  );
}

/**
 * Hook to use the Tribulation Gate context
 */
export function useTribulationGateContext(): TribulationGateContextType {
  const context = useContext(TribulationGateContext);
  if (!context) {
    throw new Error('useTribulationGateContext must be used within a TribulationGateProvider');
  }
  return context;
}

/**
 * Hook that returns whether a Tribulation Gate is blocking
 */
export function useIsTribulationGateBlocking(): boolean {
  const context = useContext(TribulationGateContext);
  return context?.isGenerationPaused ?? false;
}

export default TribulationGateContext;
