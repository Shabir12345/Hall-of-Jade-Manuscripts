/**
 * useLoomManagement Hook
 * 
 * Manages the Heavenly Loom narrative control system state.
 * Provides functions for:
 * - Converting legacy threads to Loom threads
 * - Running Clerk audits after chapters
 * - Generating Director directives before chapters
 * - Manual thread interventions
 */

import { useState, useCallback, useMemo } from 'react';
import { NovelState, Chapter, StoryThread } from '../types';
import {
  LoomThread,
  LoomConfig,
  ClerkAuditResult,
  DirectorDirective,
  DEFAULT_LOOM_CONFIG,
} from '../types/loom';
import {
  storyThreadToLoomThread,
  processChapterEnd,
  getOverallLoomHealth,
  selectThreadsForChapter,
  calculateUrgency,
} from '../services/loom/threadPhysicsEngine';
import { runLoomClerkAudit, applyAuditToThreads } from '../services/loom/loomClerkService';
import { generateDirectorDirective, formatDirectiveForPrompt } from '../services/loom/loomDirectorService';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../services/supabaseService';

interface UseLoomManagementResult {
  loomThreads: LoomThread[];
  loomConfig: LoomConfig;
  overallHealth: number;
  isProcessing: boolean;
  lastAudit: ClerkAuditResult | null;
  lastDirective: DirectorDirective | null;
  
  // Actions
  initializeLoom: (novelState: NovelState) => void;
  runClerkAudit: (chapter: Chapter, novelState: NovelState) => Promise<ClerkAuditResult>;
  generateDirective: (novelState: NovelState, userIntent?: string) => Promise<DirectorDirective>;
  forceAttention: (threadId: string) => void;
  boostKarma: (threadId: string, amount: number) => void;
  markAbandoned: (threadId: string, reason: string) => void;
  updateThread: (thread: LoomThread) => void;
  syncToDatabase: () => Promise<void>;
  getDirectivePrompt: () => string;
}

export function useLoomManagement(initialNovelState?: NovelState): UseLoomManagementResult {
  const { showSuccess, showError } = useToast();
  
  const [loomThreads, setLoomThreads] = useState<LoomThread[]>([]);
  const [loomConfig, setLoomConfig] = useState<LoomConfig>({
    id: '',
    novelId: initialNovelState?.id || '',
    ...DEFAULT_LOOM_CONFIG,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAudit, setLastAudit] = useState<ClerkAuditResult | null>(null);
  const [lastDirective, setLastDirective] = useState<DirectorDirective | null>(null);

  const currentChapter = initialNovelState?.chapters.length || 0;

  const overallHealth = useMemo(() => {
    return getOverallLoomHealth(loomThreads, currentChapter);
  }, [loomThreads, currentChapter]);

  const initializeLoom = useCallback((novelState: NovelState) => {
    const threads = novelState.storyThreads || [];
    const chapter = novelState.chapters.length;
    
    // Convert legacy threads to Loom threads
    const converted = threads.map(t => storyThreadToLoomThread(t, chapter));
    setLoomThreads(converted);
    
    setLoomConfig(prev => ({
      ...prev,
      novelId: novelState.id,
    }));
    
    showSuccess(`Loom initialized with ${converted.length} threads`);
  }, [showSuccess]);

  const runClerkAudit = useCallback(async (
    chapter: Chapter,
    novelState: NovelState
  ): Promise<ClerkAuditResult> => {
    setIsProcessing(true);
    
    try {
      const audit = await runLoomClerkAudit(
        chapter,
        loomThreads,
        novelState,
        loomConfig
      );
      
      // Apply audit results to threads
      const updatedThreads = applyAuditToThreads(
        loomThreads,
        audit,
        novelState.id,
        loomConfig
      );
      
      setLoomThreads(updatedThreads);
      setLastAudit(audit);
      
      showSuccess(`Clerk audit complete: ${audit.threadUpdates.length} updates`);
      
      return audit;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Audit failed';
      showError(msg);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [loomThreads, loomConfig, showSuccess, showError]);

  const generateDirective = useCallback(async (
    novelState: NovelState,
    userIntent?: string
  ): Promise<DirectorDirective> => {
    setIsProcessing(true);
    
    try {
      const directive = await generateDirectorDirective(
        loomThreads,
        novelState,
        userIntent,
        loomConfig
      );
      
      setLastDirective(directive);
      
      showSuccess(`Directive generated: ${directive.threadAnchors.length} thread anchors`);
      
      return directive;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Directive generation failed';
      showError(msg);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [loomThreads, loomConfig, showSuccess, showError]);

  const forceAttention = useCallback((threadId: string) => {
    setLoomThreads(prev => prev.map(t => 
      t.id === threadId 
        ? { ...t, directorAttentionForced: true, updatedAt: Date.now() }
        : t
    ));
    showSuccess('Director attention forced');
  }, [showSuccess]);

  const boostKarma = useCallback((threadId: string, amount: number) => {
    setLoomThreads(prev => prev.map(t => {
      if (t.id !== threadId) return t;
      const newKarma = Math.max(1, Math.min(100, t.karmaWeight + amount));
      return {
        ...t,
        karmaWeight: newKarma,
        urgencyScore: calculateUrgency({ ...t, karmaWeight: newKarma }, currentChapter, loomConfig),
        updatedAt: Date.now(),
      };
    }));
    showSuccess(`Karma adjusted by ${amount > 0 ? '+' : ''}${amount}`);
  }, [currentChapter, loomConfig, showSuccess]);

  const markAbandoned = useCallback((threadId: string, reason: string) => {
    setLoomThreads(prev => prev.map(t => 
      t.id === threadId 
        ? { 
            ...t, 
            intentionalAbandonment: true, 
            abandonmentReason: reason,
            loomStatus: 'ABANDONED' as const,
            updatedAt: Date.now(),
          }
        : t
    ));
    showSuccess('Thread marked as intentionally abandoned');
  }, [showSuccess]);

  const updateThread = useCallback((thread: LoomThread) => {
    setLoomThreads(prev => prev.map(t => 
      t.id === thread.id ? { ...thread, updatedAt: Date.now() } : t
    ));
  }, []);

  const syncToDatabase = useCallback(async () => {
    if (!loomConfig.novelId) return;
    
    setIsProcessing(true);
    
    try {
      // Sync each thread to database
      for (const thread of loomThreads) {
        const { error } = await supabase
          .from('story_threads')
          .update({
            signature: thread.signature,
            category: thread.category,
            loom_status: thread.loomStatus,
            karma_weight: thread.karmaWeight,
            velocity: thread.velocity,
            payoff_debt: thread.payoffDebt,
            entropy: thread.entropy,
            first_chapter: thread.firstChapter,
            last_mentioned_chapter: thread.lastMentionedChapter,
            participants: thread.participants,
            resolution_criteria: thread.resolutionCriteria,
            blooming_chapter: thread.bloomingChapter,
            urgency_score: thread.urgencyScore,
            last_progress_type: thread.lastProgressType,
            mention_count: thread.mentionCount,
            progress_count: thread.progressCount,
            director_attention_forced: thread.directorAttentionForced,
            intentional_abandonment: thread.intentionalAbandonment,
            abandonment_reason: thread.abandonmentReason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', thread.id);
        
        if (error) {
          console.error('Failed to sync thread:', thread.id, error);
        }
      }
      
      showSuccess('Loom state synced to database');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sync failed';
      showError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [loomThreads, loomConfig.novelId, showSuccess, showError]);

  const getDirectivePrompt = useCallback(() => {
    if (!lastDirective) return '';
    return formatDirectiveForPrompt(lastDirective);
  }, [lastDirective]);

  return {
    loomThreads,
    loomConfig,
    overallHealth,
    isProcessing,
    lastAudit,
    lastDirective,
    initializeLoom,
    runClerkAudit,
    generateDirective,
    forceAttention,
    boostKarma,
    markAbandoned,
    updateThread,
    syncToDatabase,
    getDirectivePrompt,
  };
}

export default useLoomManagement;
