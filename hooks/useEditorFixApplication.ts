/**
 * Hook for applying editor fixes to chapters
 * 
 * Handles the complete fix application workflow:
 * - Filtering and validation
 * - Fix application
 * - State updates
 * - Database persistence
 * - Status updates
 * 
 * This hook extracts the duplicate editor fix application logic
 * that was previously duplicated in three places in App.tsx.
 */

import { useState, useCallback } from 'react';
import type { EditorReport, EditorFix } from '../types/editor';
import type { Chapter, NovelState } from '../types';
import { applyApprovedFixes } from '../services/editorService';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { useLoading } from '../contexts/LoadingContext';
import { logger } from '../services/loggingService';

/**
 * Internal properties added to EditorReport (not part of public API)
 */
interface EditorReportWithInternal extends EditorReport {
  _failedAutoFixes?: EditorFix[];
}

/**
 * Options for applying fixes
 */
interface ApplyFixesOptions {
  editorReport: EditorReport;
  editMode?: 'automatic' | 'manual';
  onProgress?: (progress: number) => void;
  onComplete?: (summary: { summary: string; details?: string }) => void;
}

/**
 * Result of fix application
 */
interface FixApplicationResult {
  appliedCount: number;
  failedCount: number;
  updatedChapters: Chapter[];
}

/**
 * Format fix summary for display
 */
function formatFixSummary(
  totalIssues: number,
  autoFixedCount: number,
  failedAutoFixes: EditorFix[],
  appliedInAutoMode: number,
  failedInAutoMode: EditorFix[],
  updatedChapters: number
): { summary: string; details?: string } {
  const parts: string[] = [];
  const details: string[] = [];

  // Summary line
  parts.push(`${totalIssues} issue(s) found.`);

  if (autoFixedCount > 0 || failedAutoFixes.length > 0 || appliedInAutoMode > 0 || failedInAutoMode.length > 0) {
    const fixParts: string[] = [];
    
    if (autoFixedCount > 0) {
      fixParts.push(`${autoFixedCount} auto-fixed during review`);
    }
    if (appliedInAutoMode > 0) {
      fixParts.push(`${appliedInAutoMode} applied in automatic mode`);
    }
    
    const totalFixed = autoFixedCount + appliedInAutoMode;
    if (totalFixed > 0) {
      parts.push(`${totalFixed} fix(es) applied (${autoFixedCount} during review, ${appliedInAutoMode} in auto mode).`);
    }

    if (failedAutoFixes.length > 0 || failedInAutoMode.length > 0) {
      // Prevent double-counting: only count unique failures
      const failedAutoFixIds = new Set(failedAutoFixes.map(f => f.id));
      const uniqueFailedInAutoMode = failedInAutoMode.filter(f => !failedAutoFixIds.has(f.id));
      const totalFailed = failedAutoFixes.length + uniqueFailedInAutoMode.length;
      parts.push(`${totalFailed} fix(es) failed to apply.`);
      
      // Add details about failed fixes
      if (failedAutoFixes.length > 0) {
        details.push(`Failed during review (${failedAutoFixes.length}):`);
        failedAutoFixes.forEach(fix => {
          const failureReason = fix.failureReason || fix.reason || 'Unknown reason';
          details.push(`  - Chapter ${fix.chapterNumber}, ${fix.fixType}: ${failureReason}`);
        });
      }
      if (uniqueFailedInAutoMode.length > 0) {
        details.push(`Failed in automatic mode (${uniqueFailedInAutoMode.length}):`);
        uniqueFailedInAutoMode.forEach(fix => {
          const failureReason = fix.failureReason || 'Could not find text to replace';
          details.push(`  - Chapter ${fix.chapterNumber}, ${fix.fixType}: ${failureReason}`);
        });
      }
      
      // If same fixes failed in both modes, add note
      const duplicatedFails = failedInAutoMode.filter(f => failedAutoFixIds.has(f.id));
      if (duplicatedFails.length > 0) {
        details.push(`\nNote: ${duplicatedFails.length} fix(es) failed in both review and automatic mode (counted once above).`);
      }
    }

    if (updatedChapters > 0) {
      parts.push(`${updatedChapters} chapter(s) updated and saved.`);
    }
  }

  return {
    summary: parts.join(' '),
    details: details.length > 0 ? details.join('\n') : undefined
  };
}

/**
 * Hook for applying editor fixes to chapters.
 * 
 * Handles the complete fix application workflow including filtering, validation,
 * fix application, state updates, database persistence, and status updates.
 * 
 * @returns {Object} Object containing:
 * - applyFixes: Function to apply fixes from an editor report
 * - isApplying: Boolean indicating if fixes are currently being applied
 * - error: Error object if an error occurred during fix application
 * 
 * @example
 * ```typescript
 * const { applyFixes, isApplying, error } = useEditorFixApplication();
 * 
 * // Apply fixes from an editor report
 * const result = await applyFixes({
 *   editorReport,
 *   editMode: 'automatic',
 *   onProgress: (progress) => console.log(`Progress: ${progress}%`),
 *   onComplete: (summary) => console.log('Summary:', summary)
 * });
 * 
 * console.log(`Applied ${result.appliedCount} fixes, ${result.failedCount} failed`);
 * ```
 */
export function useEditorFixApplication() {
  const { activeNovel, updateActiveNovel } = useNovel();
  const { showError, showSuccess, showWarning } = useToast();
  const { startLoading, stopLoading, updateProgress } = useLoading();
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const applyFixes = useCallback(async (options: ApplyFixesOptions): Promise<FixApplicationResult> => {
    const {
      editorReport,
      editMode = 'automatic',
      onProgress,
      onComplete,
    } = options;

    if (!activeNovel) {
      throw new Error('No active novel');
    }

    setIsApplying(true);
    setError(null);
    startLoading('Applying fixes...', true);

    try {
      // Step 1: Get failed auto-fix IDs
      const failedAutoFixIds = new Set(
        ((editorReport as EditorReportWithInternal)._failedAutoFixes || [])
          .map((f: EditorFix) => f.id)
      );

      // Step 2: Filter fixes to apply
      const fixesToApply = editorReport.fixes.filter((fix: EditorFix) => 
        fix.status === 'pending' && !failedAutoFixIds.has(fix.id)
      );

      // Log if any fixes were skipped
      const skippedFixes = editorReport.fixes.filter((fix: EditorFix) => 
        fix.status === 'pending' && failedAutoFixIds.has(fix.id)
      );
      if (skippedFixes.length > 0) {
        logger.info('Skipping fixes that already failed during review', 'editor', {
          skippedCount: skippedFixes.length,
          skippedFixIds: skippedFixes.map(f => f.id)
        });
      }

      if (fixesToApply.length === 0) {
        // Handle no fixes case
        const failedAutoFixes = ((editorReport as EditorReportWithInternal)._failedAutoFixes || []);
        const summary = formatFixSummary(
          editorReport.analysis.issues.length,
          editorReport.autoFixedCount || 0,
          failedAutoFixes,
          0,
          [],
          0
        );
        stopLoading();
        setIsApplying(false);
        onComplete?.(summary);
        return { appliedCount: 0, failedCount: failedAutoFixes.length, updatedChapters: [] };
      }

      onProgress?.(10);

      // Step 3: Get chapters to update
      const chaptersToUpdate = activeNovel.chapters.filter(ch => {
        return fixesToApply.some((fix: EditorFix) => 
          fix.chapterId === ch.id || fix.chapterNumber === ch.number
        );
      });

      onProgress?.(20);

      // Step 4: Validate fixes
      const validatedFixes = fixesToApply.filter((fix: EditorFix) => {
        const belongs = chaptersToUpdate.some(ch => 
          fix.chapterId === ch.id || fix.chapterNumber === ch.number
        );
        if (!belongs) {
          logger.error('Fix targets chapter not in update list', 'editor', undefined, {
            fixId: fix.id,
            fixChapterNumber: fix.chapterNumber,
            fixChapterId: fix.chapterId
          });
          return false;
        }
        return true;
      });

      if (validatedFixes.length === 0) {
        throw new Error('No valid fixes to apply');
      }

      onProgress?.(30);

      // Step 5: Apply fixes
      const { updatedChapters, appliedFixes, failedFixes } = applyApprovedFixes(
        chaptersToUpdate,
        validatedFixes
      );

      onProgress?.(50);

      // Get failed auto-fixes from review if available
      const failedAutoFixes = ((editorReport as EditorReportWithInternal)._failedAutoFixes || []);

      // Log failed fixes with details
      if (failedFixes.length > 0) {
        logger.warn(`${failedFixes.length} fix(es) failed to apply in automatic mode`, 'editor', {
          failedCount: failedFixes.length,
          failedFixes: failedFixes.map(f => ({ id: f.id, chapterNumber: f.chapterNumber, failureReason: f.failureReason }))
        });
      }

      onProgress?.(60);

      // Step 6: Update novel state with fixed chapters
      updateActiveNovel(prev => {
        const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
        const updatedNovel = {
          ...prev,
          chapters: prev.chapters.map(ch => {
            const updated = updatedChapterMap.get(ch.id);
            if (updated && updated.content !== ch.content) {
              logger.debug('Updating chapter in novel state', 'editor', {
                chapterNumber: ch.number,
                chapterId: ch.id
              });
              return updated;
            }
            return ch;
          }),
          updatedAt: Date.now(),
        };
        
        // Save to database asynchronously (pattern matches App.tsx)
        import('../services/supabaseService').then(({ saveNovel }) => {
          saveNovel(updatedNovel).then(() => {
            logger.info('Successfully saved updated chapters to database', 'editor', {
              updatedChaptersCount: updatedChapters.length
            });
          }).catch(err => {
            logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err)));
            showError('Failed to save fixed chapters to database. Changes are in memory but not saved.');
          });
        });
        
        return updatedNovel;
      });

      onProgress?.(70);

      // Step 8: Update fix status in database
      const { updateEditorFixStatus } = await import('../services/supabaseService');
      await Promise.all(
        appliedFixes.map(fix => 
          updateEditorFixStatus(fix.id, 'applied', fix.appliedAt).catch(err => {
            logger.error('Failed to update fix status', 'editor', err instanceof Error ? err : new Error(String(err)), {
              fixId: fix.id
            });
          })
        )
      );

      onProgress?.(90);

      // Step 9: Format summary
      const uniqueUpdatedChapters = new Set(updatedChapters.map(ch => ch.id)).size;
      const summary = formatFixSummary(
        editorReport.analysis.issues.length,
        editorReport.autoFixedCount || 0,
        failedAutoFixes,
        appliedFixes.length,
        failedFixes,
        uniqueUpdatedChapters
      );

      onProgress?.(100);
      stopLoading();
      setIsApplying(false);

      // Step 10: Show result
      if (failedFixes.length > 0 || failedAutoFixes.length > 0) {
        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
      } else {
        showSuccess(summary.summary);
      }

      onComplete?.(summary);

      return {
        appliedCount: appliedFixes.length,
        failedCount: failedFixes.length + failedAutoFixes.length,
        updatedChapters
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error applying fixes', 'editor', error);
      setError(error);
      stopLoading();
      setIsApplying(false);
      showError(`Failed to apply fixes: ${error.message}`);
      throw error;
    }
  }, [activeNovel, updateActiveNovel, showError, showSuccess, showWarning, startLoading, stopLoading, updateProgress]);

  return {
    applyFixes,
    isApplying,
    error,
  };
}
