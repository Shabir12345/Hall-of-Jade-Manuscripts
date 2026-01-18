import { useState, useEffect, useCallback, useRef } from 'react';
import { Chapter, NovelState } from '../types';
import { EditorialReview, EditorialReviewOptions } from '../types/editor';
import { reviewChapter, checkForMissedIssues } from '../services/editorialReviewService';
import { ChapterQualityMetrics } from '../types';

interface UseEditorialReviewOptions {
  autoReviewOnMount?: boolean;
  debounceMs?: number;
}

export function useEditorialReview(
  chapter: Chapter | null,
  novelState: NovelState | undefined,
  options: UseEditorialReviewOptions = {}
) {
  const { autoReviewOnMount = false, debounceMs = 500 } = options;
  
  const [review, setReview] = useState<EditorialReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousMetrics, setPreviousMetrics] = useState<ChapterQualityMetrics | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');

  // Run review
  const runReview = useCallback(async (
    reviewOptions?: EditorialReviewOptions
  ) => {
    if (!chapter || !novelState) {
      setError('Chapter or novel state not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newReview = await reviewChapter(chapter, novelState, {
        ...reviewOptions,
        onProgress: (phase, progress) => {
          reviewOptions?.onProgress?.(phase, progress);
        },
      });

      setReview(newReview);
      
      // Check for missed issues if we have previous metrics
      if (previousMetrics) {
        const missedIssues = await checkForMissedIssues(chapter, previousMetrics, novelState);
        if (missedIssues.length > 0) {
          // Add missed issues to review
          setReview(prev => prev ? {
            ...prev,
            signals: [...prev.signals, ...missedIssues],
          } : null);
        }
      }
    } catch (err) {
      console.error('Error running editorial review:', err);
      setError(err instanceof Error ? err.message : 'Failed to run editorial review');
    } finally {
      setIsLoading(false);
    }
  }, [chapter, novelState, previousMetrics]);

  // Debounced review (for auto-review on content change)
  const runReviewDebounced = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runReview();
    }, debounceMs);
  }, [runReview, debounceMs]);

  // Auto-review on mount if enabled
  useEffect(() => {
    if (autoReviewOnMount && chapter && novelState && !review) {
      runReview();
    }
  }, [autoReviewOnMount, chapter, novelState, review, runReview]);

  // Auto-review on content change (debounced)
  useEffect(() => {
    if (!chapter || !novelState || !autoReviewOnMount) return;

    const currentContent = chapter.content;
    if (currentContent !== lastContentRef.current && lastContentRef.current !== '') {
      // Content changed, run debounced review
      runReviewDebounced();
    }
    lastContentRef.current = currentContent;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [chapter?.content, novelState, autoReviewOnMount, runReviewDebounced]);

  // Store previous metrics when review completes
  useEffect(() => {
    if (review && chapter && novelState) {
      // Import validateChapterQuality to get metrics
      import('../services/chapterQualityValidator').then(module => {
        module.validateChapterQuality(chapter, novelState).then(metrics => {
          setPreviousMetrics(metrics);
        }).catch(err => {
          console.error('Error storing previous metrics:', err);
        });
      });
    }
  }, [review, chapter, novelState]);

  // Clear review when chapter changes
  useEffect(() => {
    if (chapter) {
      // Only clear if it's a different chapter
      if (review?.chapterId !== chapter.id) {
        setReview(null);
        setPreviousMetrics(null);
        lastContentRef.current = '';
      }
    } else {
      setReview(null);
      setPreviousMetrics(null);
      lastContentRef.current = '';
    }
  }, [chapter?.id, review?.chapterId]);

  return {
    review,
    isLoading,
    error,
    runReview,
    clearReview: () => {
      setReview(null);
      setPreviousMetrics(null);
      setError(null);
    },
  };
}
