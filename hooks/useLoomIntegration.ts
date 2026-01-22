/**
 * useLoomIntegration Hook
 * 
 * Simplified hook for integrating the Heavenly Loom into chapter generation.
 * Provides functions to:
 * - Generate directive before chapter generation
 * - Run audit after chapter generation
 * - Update novel state with Loom thread changes
 */

import { useState, useCallback } from 'react';
import { NovelState, Chapter } from '../types';
import {
  generateLoomDirective,
  runLoomClerkAudit,
  convertLoomToLegacyThreads,
} from '../services/loom/loomIntegrationService';
import { useToast } from '../contexts/ToastContext';

export function useLoomIntegration() {
  const { showSuccess, showError } = useToast();
  const [loomEnabled, setLoomEnabled] = useState(true);

  const generateDirective = useCallback(async (
    novelState: NovelState,
    userIntent: string = ''
  ): Promise<string | null> => {
    if (!loomEnabled) return null;

    try {
      const directive = await generateLoomDirective(novelState, userIntent, {
        enabled: true,
        onPhase: (phase, data) => {
          console.log(`Loom phase: ${phase}`, data);
        },
      });

      if (directive) {
        showSuccess('Loom directive generated');
      }

      return directive;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Directive generation failed';
      showError(msg);
      return null;
    }
  }, [loomEnabled, showSuccess, showError]);

  const runAudit = useCallback(async (
    novelState: NovelState,
    chapter: Chapter
  ): Promise<any[]> => {
    if (!loomEnabled) return [];

    try {
      const updatedThreads = await runLoomClerkAudit(novelState, chapter, {
        enabled: true,
        onPhase: (phase, data) => {
          console.log(`Loom phase: ${phase}`, data);
        },
      });

      // Convert back to legacy format
      const legacyThreads = convertLoomToLegacyThreads(updatedThreads);

      if (updatedThreads.length > 0) {
        showSuccess(`Loom audit: ${updatedThreads.length} threads updated`);
      }

      return legacyThreads;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Clerk audit failed';
      showError(msg);
      return [];
    }
  }, [loomEnabled, showSuccess, showError]);

  const toggleLoom = useCallback(() => {
    setLoomEnabled(prev => {
      const newState = !prev;
      showSuccess(`Heavenly Loom ${newState ? 'enabled' : 'disabled'}`);
      return newState;
    });
  }, [showSuccess]);

  return {
    loomEnabled,
    generateDirective,
    runAudit,
    toggleLoom,
  };
}

export default useLoomIntegration;
