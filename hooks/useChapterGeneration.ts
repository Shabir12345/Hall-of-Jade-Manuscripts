import { useState, useRef, useCallback } from 'react';
import { NovelState, Chapter, SystemLog } from '../types';
import { generateNextChapter, extractPostChapterUpdates } from '../services/aiService';
import { ChapterGenPhase } from '../services/aiService';

export interface UseChapterGenerationResult {
  isGenerating: boolean;
  generationProgress: number;
  generationStatus: string;
  activeLogs: SystemLog[];
  handleGenerateNext: (state: NovelState, instruction?: string) => Promise<Chapter | null>;
  cancelGeneration: () => void;
}

/**
 * Hook for chapter generation logic.
 * 
 * Manages chapter generation state, progress tracking, and cancellation.
 * Handles the complete workflow from story context analysis to chapter creation.
 * 
 * @returns {UseChapterGenerationResult} Object containing:
 * - isGenerating: Boolean indicating if generation is in progress
 * - generationProgress: Progress percentage (0-100)
 * - generationStatus: Current status message
 * - activeLogs: Array of system logs generated during chapter creation
 * - handleGenerateNext: Function to generate the next chapter
 * - cancelGeneration: Function to cancel ongoing generation
 * 
 * @example
 * ```typescript
 * const { isGenerating, generationProgress, handleGenerateNext, cancelGeneration } = useChapterGeneration();
 * 
 * // Generate next chapter
 * const newChapter = await handleGenerateNext(novelState, 'Focus on character development');
 * 
 * // Cancel if needed
 * if (shouldCancel) {
 *   cancelGeneration();
 * }
 * ```
 */
export function useChapterGeneration(): UseChapterGenerationResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [activeLogs, setActiveLogs] = useState<SystemLog[]>([]);
  const activeGenerationIdRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cancelGeneration = useCallback(() => {
    activeGenerationIdRef.current = null;
    setIsGenerating(false);
    setGenerationProgress(0);
    setGenerationStatus('');
    // Clear any active progress intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handleGenerateNext = useCallback(async (
    state: NovelState,
    instruction: string = ''
  ): Promise<Chapter | null> => {
    const generationId = crypto.randomUUID();
    activeGenerationIdRef.current = generationId;
    setIsGenerating(true);
    setGenerationProgress(5);
    setGenerationStatus('Analyzing story context...');
    const newLogs: SystemLog[] = [];

    const localAddLog = (msg: string, type: SystemLog['type'] = 'discovery') => {
      const log: SystemLog = { id: crypto.randomUUID(), message: msg, type, timestamp: Date.now() };
      newLogs.push(log);
      setActiveLogs(prev => [...prev, log]);
      setTimeout(() => setActiveLogs(prevLogs => prevLogs.filter(l => l.id !== log.id)), 8000);
    };

    try {
      localAddLog('Building prompt context...', 'discovery');
      
      const result = await generateNextChapter(state, instruction, {
        onPhase: (phase: ChapterGenPhase, data?: Record<string, unknown>) => {
          if (activeGenerationIdRef.current !== generationId) return; // cancelled
          
          if (phase === 'quality_check') {
            setGenerationProgress(8);
            setGenerationStatus('Validating narrative quality...');
            const qualityScore = data?.qualityScore;
            if (typeof qualityScore === 'number') {
              localAddLog(`Pre-generation quality check: ${qualityScore}/100`, 'discovery');
            }
          }
          
          if (phase === 'prompt_build_start') {
            setGenerationProgress(10);
            setGenerationStatus('Constructing narrative context...');
          }
          
          if (phase === 'prompt_build_end') {
            setGenerationProgress(20);
            setGenerationStatus('Context assembled. Preparing request...');
            const ms = data?.promptBuildMs;
            const tokens = data?.estimatedPromptTokens;
            localAddLog(
              `Prompt built in ${typeof ms === 'number' ? ms : '?'}ms${typeof tokens === 'number' ? ` (≈${tokens} tokens)` : ''}.`,
              'discovery'
            );
          }
          
          if (phase === 'queue_estimate') {
            setGenerationProgress(25);
            setGenerationStatus('Checking system load...');
            const estimatedWaitMs = data?.estimatedWaitMs;
            if (typeof estimatedWaitMs === 'number' && estimatedWaitMs > 0) {
              localAddLog(`Waiting for rate limiter (est. ${(estimatedWaitMs / 1000).toFixed(1)}s)...`, 'discovery');
            }
          }
          
          if (phase === 'queue_dequeued') {
            setGenerationProgress(30);
            setGenerationStatus('Starting generation...');
            const queueWaitMs = data?.queueWaitMs;
            if (typeof queueWaitMs === 'number' && queueWaitMs > 0) {
              localAddLog(`Queued for ${(queueWaitMs / 1000).toFixed(1)}s before starting.`, 'discovery');
            }
          }
          
          if (phase === 'llm_request_start') {
            setGenerationProgress(40);
            setGenerationStatus('Consulting the Muse...');
            localAddLog('Calling the selected LLM to write the chapter...', 'discovery');
            
            // Start simulated progress during LLM request
            // This prevents the jarring jump from 40% to 80%
            let simulatedProgress = 40;
            const startTime = Date.now();
            const estimatedDuration = 30000; // Estimate 30 seconds for LLM request
            
            // Clear any existing interval
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
            
            progressIntervalRef.current = setInterval(() => {
              if (activeGenerationIdRef.current !== generationId) {
                // Generation was cancelled
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                return;
              }
              
              // Gradually increase progress from 40% to 75% over estimated duration
              const elapsed = Date.now() - startTime;
              const progressRatio = Math.min(elapsed / estimatedDuration, 1);
              simulatedProgress = 40 + (35 * progressRatio); // 40% to 75%
              
              // Only update if we haven't reached the actual end phase yet
              // This ensures we don't override the real progress update
              setGenerationProgress(prev => {
                // Only update if current progress is still in the simulated range
                if (prev < 80) {
                  return Math.min(simulatedProgress, 75);
                }
                return prev;
              });
            }, 1000); // Update every second
          }
          
          if (phase === 'llm_request_end') {
            // Clear the simulated progress interval
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            
            setGenerationProgress(80);
            setGenerationStatus('Content received. Processing...');
            const len = data?.responseTextLength;
            const requestDurationMs = data?.requestDurationMs;
            localAddLog(
              `LLM returned${typeof requestDurationMs === 'number' ? ` in ${(requestDurationMs / 1000).toFixed(1)}s` : ''}${typeof len === 'number' ? ` (${len.toLocaleString()} chars)` : ''}.`,
              'discovery'
            );
          }
          
          if (phase === 'quality_validation') {
            setGenerationProgress(85);
            setGenerationStatus('Validating generated chapter quality...');
            const qualityScore = data?.qualityScore;
            if (typeof qualityScore === 'number') {
              localAddLog(`Post-generation quality score: ${qualityScore}/100`, 'discovery');
              if (qualityScore < 70) {
                localAddLog('Quality warnings detected. Review chapter content.', 'update');
              }
            }
          }
          
          if (phase === 'parse_start') {
            setGenerationProgress(85);
            setGenerationStatus('Structuring narrative elements...');
            localAddLog('Parsing response...', 'discovery');
          }
          
          if (phase === 'parse_end') {
            setGenerationProgress(90);
            setGenerationStatus('Extracting story elements...');
          }
        },
      });

      if (activeGenerationIdRef.current !== generationId) {
        return null; // Cancelled
      }

      setGenerationProgress(95);
      setGenerationStatus('Processing story updates...');
      
      // The actual chapter creation and extraction logic would be handled by the caller
      // This hook focuses on generation state management
      
      return result ? {
        id: crypto.randomUUID(),
        number: state.chapters.length + 1,
        title: result.chapterTitle || 'Untitled',
        content: result.chapterContent || '',
        summary: result.chapterSummary || '',
        logicAudit: result.logicAudit,
        scenes: [],
        createdAt: Date.now(),
      } : null;

    } catch (error) {
      console.error('Error generating chapter:', error);
      localAddLog(`Generation failed: ${error instanceof Error ? error.message : String(error)}`, 'update');
      throw error;
    } finally {
      // Clear any active progress intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (activeGenerationIdRef.current === generationId) {
        setIsGenerating(false);
        activeGenerationIdRef.current = null;
      }
    }
  }, []);

  return {
    isGenerating,
    generationProgress,
    generationStatus,
    activeLogs,
    handleGenerateNext,
    cancelGeneration,
  };
}
