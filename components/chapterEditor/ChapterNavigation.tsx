/**
 * Chapter Navigation Component
 * Previous/Next chapter navigation buttons
 */

import React from 'react';
import type { Chapter } from '../../types';

interface ChapterNavigationProps {
  previousChapter: Chapter | null;
  nextChapter: Chapter | null;
  currentChapterNumber: number;
  totalChapters: number;
  onNavigate: (chapterId: string) => void;
  variant?: 'top' | 'bottom';
}

export const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  previousChapter,
  nextChapter,
  currentChapterNumber,
  totalChapters,
  onNavigate,
  variant = 'top',
}) => {
  if (!previousChapter && !nextChapter) {
    return null;
  }

  const buttonClass = (enabled: boolean) =>
    enabled
      ? 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 hover:shadow-amber-900/20 border border-zinc-700 hover:border-amber-500/50'
      : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800';

  const labelText = variant === 'top' ? 'Previous' : 'Previous Chapter';
  const nextLabelText = variant === 'top' ? 'Next' : 'Next Chapter';

  return (
    <div className={`flex items-center justify-between px-4 md:px-6 py-3 border-${variant === 'top' ? 'b' : 't'} border-zinc-700 bg-zinc-900/30 backdrop-blur-sm`}>
      <button
        onClick={() => previousChapter && onNavigate(previousChapter.id)}
        disabled={!previousChapter}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${buttonClass(!!previousChapter)}`}
        aria-label={previousChapter ? `Go to previous chapter: ${previousChapter.title}` : 'No previous chapter'}
        title={previousChapter ? `Previous: Chapter ${previousChapter.number} - ${previousChapter.title}` : 'No previous chapter'}
      >
        <span className="text-lg">←</span>
        <span>{labelText}</span>
        {previousChapter && (
          <span className={`text-xs text-zinc-400 font-normal ${variant === 'top' ? '' : ''}`}>
            {variant === 'top' ? `Ch. ${previousChapter.number}` : `(${previousChapter.number})`}
          </span>
        )}
      </button>
      <div className="flex items-center gap-2 text-xs text-zinc-500 px-4">
        <span className="font-semibold">Chapter {currentChapterNumber}</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400">{totalChapters} total</span>
      </div>
      <button
        onClick={() => nextChapter && onNavigate(nextChapter.id)}
        disabled={!nextChapter}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${buttonClass(!!nextChapter)}`}
        aria-label={nextChapter ? `Go to next chapter: ${nextChapter.title}` : 'No next chapter'}
        title={nextChapter ? `Next: Chapter ${nextChapter.number} - ${nextChapter.title}` : 'No next chapter'}
      >
        {nextChapter && (
          <span className={`text-xs text-zinc-400 font-normal ${variant === 'top' ? '' : ''}`}>
            {variant === 'top' ? `Ch. ${nextChapter.number}` : `(${nextChapter.number})`}
          </span>
        )}
        <span>{nextLabelText}</span>
        <span className="text-lg">→</span>
      </button>
    </div>
  );
};
