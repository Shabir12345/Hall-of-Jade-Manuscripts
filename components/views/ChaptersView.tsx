/**
 * Chapters View Component
 * Displays list of chapters with actions
 */

import React, { memo, useCallback, useState } from 'react';
import type { NovelState, Chapter } from '../../types';

interface ChaptersViewProps {
  novel: NovelState;
  onChapterSelect: (chapterId: string) => void;
  onChapterDelete: (chapterId: string) => void;
  onChapterExport: (chapter: Chapter) => void;
  onFixChapters: () => void;
  onEditorReview: () => void;
  onViewChange: (view: string) => void;
}

const ChaptersViewComponent: React.FC<ChaptersViewProps> = ({
  novel,
  onChapterSelect,
  onChapterDelete,
  onChapterExport,
  onFixChapters,
  onEditorReview,
  onViewChange,
}) => {
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const formatChapterTitleForDisplay = useCallback((chapter: Chapter): string => {
    // If title already starts with "Chapter X", return as-is
    if (/^Chapter\s+\d+/i.test(chapter.title)) {
      return chapter.title;
    }
    // Has "Chapter X" but weird format, try to fix
    return chapter.title.replace(/^Chapter\s+\d+/i, `Chapter ${chapter.number}`);
  }, []);

  const handleChapterClick = useCallback((chapterId: string) => {
    if (isBulkMode) {
      setSelectedChapters(prev => {
        const next = new Set(prev);
        if (next.has(chapterId)) {
          next.delete(chapterId);
        } else {
          next.add(chapterId);
        }
        return next;
      });
    } else {
      onChapterSelect(chapterId);
      onViewChange('editor');
    }
  }, [isBulkMode, onChapterSelect, onViewChange]);

  const handleSelectAll = useCallback(() => {
    if (selectedChapters.size === novel.chapters.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(novel.chapters.map(c => c.id)));
    }
  }, [selectedChapters.size, novel.chapters]);

  const handleBulkDelete = useCallback(() => {
    if (selectedChapters.size === 0) return;
    const count = selectedChapters.size;
    if (window.confirm(`Delete ${count} chapter${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      selectedChapters.forEach(chapterId => {
        onChapterDelete(chapterId);
      });
      setSelectedChapters(new Set());
      setIsBulkMode(false);
    }
  }, [selectedChapters, onChapterDelete]);

  const handleBulkExport = useCallback(() => {
    if (selectedChapters.size === 0) return;
    selectedChapters.forEach(chapterId => {
      const chapter = novel.chapters.find(c => c.id === chapterId);
      if (chapter) {
        onChapterExport(chapter);
      }
    });
    setSelectedChapters(new Set());
    setIsBulkMode(false);
  }, [selectedChapters, novel.chapters, onChapterExport]);

  return (
    <div 
      className="p-3 xs:p-4 sm:p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-4 xs:space-y-6 md:space-y-8" 
      style={{ paddingTop: 'max(4rem, calc(env(safe-area-inset-top, 1rem) + 3.5rem))' }}
      data-tour="chapters-view"
    >
      {/* Header - stack on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 xs:mb-6 md:mb-8 border-b border-zinc-700 pb-3 xs:pb-4 md:pb-6 gap-3 xs:gap-4">
        <h2 className="text-xl xs:text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Chronicles</h2>
        {/* Action buttons - horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          {isBulkMode ? (
            <>
              <button
                onClick={handleSelectAll}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0"
                aria-label={selectedChapters.size === novel.chapters.length ? 'Deselect all' : 'Select all'}
              >
                {selectedChapters.size === novel.chapters.length ? 'Deselect' : 'Select All'}
              </button>
              <button
                onClick={handleBulkExport}
                disabled={selectedChapters.size === 0}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                aria-label={`Export ${selectedChapters.size} selected chapters`}
              >
                <span>📤</span>
                <span className="hidden xs:inline">Export</span>
                <span>({selectedChapters.size})</span>
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedChapters.size === 0}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                aria-label={`Delete ${selectedChapters.size} selected chapters`}
              >
                <span>🗑️</span>
                <span className="hidden xs:inline">Delete</span>
                <span>({selectedChapters.size})</span>
              </button>
              <button
                onClick={() => {
                  setIsBulkMode(false);
                  setSelectedChapters(new Set());
                }}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0"
                aria-label="Cancel bulk mode"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsBulkMode(true)}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                aria-label="Enable bulk selection mode"
              >
                <span>☑️</span>
                <span className="hidden xs:inline">Bulk</span>
              </button>
              <button
                onClick={onFixChapters}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                title="Fix duplicate chapter numbers and normalize titles (adds 'Chapter X: ' prefix if missing)"
                aria-label="Fix chapter numbers and titles"
              >
                <span>🔧</span>
                <span className="hidden xs:inline">Fix</span>
              </button>
              <button
                onClick={onEditorReview}
                className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                title="Manually trigger editor review for chapters"
                aria-label="Trigger editor review"
              >
                <span>✏️</span>
                <span className="hidden xs:inline">Review</span>
              </button>
            </>
          )}
        </div>
      </div>
      
      {novel.chapters.length === 0 ? (
        <div className="py-8 xs:py-12 md:py-16 px-4 xs:px-6 md:px-8 text-center border-2 border-dashed border-zinc-700 rounded-xl xs:rounded-2xl bg-zinc-900/30">
          <div className="text-4xl xs:text-5xl md:text-6xl mb-3 xs:mb-4">📖</div>
          <h3 className="text-lg xs:text-xl font-fantasy font-bold text-zinc-300 mb-2">No Chapters Yet</h3>
          <p className="text-xs xs:text-sm text-zinc-500 mb-4 xs:mb-6">Start writing your epic by generating your first chapter from the Dashboard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xs:gap-4 md:gap-6">
          {[...novel.chapters].reverse().map(chapter => {
            const isSelected = selectedChapters.has(chapter.id);
            return (
              <div
                key={chapter.id}
                className={`bg-zinc-900/60 border p-3 xs:p-4 sm:p-6 md:p-8 rounded-xl xs:rounded-2xl transition-all duration-200 group relative hover:shadow-xl hover:shadow-amber-900/10 ${
                  isBulkMode
                    ? isSelected
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-zinc-700 hover:border-zinc-600'
                    : 'border-zinc-700 hover:border-amber-500/50'
                }`}
              >
                {/* Bulk mode checkbox */}
                {isBulkMode && (
                  <div className="absolute top-3 xs:top-4 left-3 xs:left-4 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleChapterClick(chapter.id)}
                      className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-amber-600 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                      aria-label={`Select chapter ${chapter.number}`}
                    />
                  </div>
                )}
                
                {/* Action buttons - bottom on mobile, top-right on desktop */}
                {!isBulkMode && (
                  <div className="flex items-center gap-1.5 xs:gap-2 mt-3 xs:mt-0 sm:absolute sm:top-4 sm:right-4 z-10">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onChapterExport(chapter); }}
                      className="flex-1 sm:flex-none text-xs text-zinc-500 hover:text-emerald-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-2 xs:px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-emerald-500/50 transition-all duration-200 hover:bg-emerald-950/20 focus-visible:outline-emerald-600 focus-visible:outline-2 shadow-lg text-center"
                      aria-label={`Export chapter ${chapter.number}`}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onChapterDelete(chapter.id); }}
                      className="flex-1 sm:flex-none text-xs text-zinc-500 hover:text-red-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-2 xs:px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200 hover:bg-red-950/20 focus-visible:outline-red-600 focus-visible:outline-2 shadow-lg text-center"
                      aria-label={`Delete chapter ${chapter.number}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
                
                {/* Chapter info */}
                <div className={`flex items-center flex-wrap gap-1.5 xs:gap-2 mb-2 xs:mb-3 ${isBulkMode ? 'pl-8 xs:pl-10' : 'sm:pr-24 md:pr-32'}`}>
                  <span className="text-[10px] xs:text-xs font-bold text-zinc-500 uppercase tracking-wider px-1.5 xs:px-2 py-0.5 xs:py-1 bg-zinc-800/50 rounded-md">Seq {chapter.number}</span>
                  {chapter.logicAudit && (
                    <span className="text-[10px] xs:text-xs bg-indigo-500/20 text-indigo-400 px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-md border border-indigo-500/30 uppercase font-bold">Value Shifted</span>
                  )}
                </div>
                
                {/* Clickable content area */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleChapterClick(chapter.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChapterClick(chapter.id);
                    }
                  }}
                  className={`block text-left w-full focus-visible:outline-amber-600 focus-visible:outline-2 rounded-lg cursor-pointer ${isBulkMode ? 'pl-8 xs:pl-10' : 'sm:pr-24 md:pr-32'}`}
                  aria-label={`Open chapter ${chapter.number}: ${chapter.title}`}
                >
                  <h3 className="text-base xs:text-lg sm:text-xl md:text-2xl font-fantasy font-bold text-zinc-200 group-hover:text-amber-500 transition-colors mt-1 break-words line-clamp-2">
                    {formatChapterTitleForDisplay(chapter)}
                  </h3>
                  <p className="text-xs xs:text-sm md:text-base text-zinc-400 mt-2 xs:mt-3 md:mt-4 italic line-clamp-2 leading-relaxed font-serif-novel">
                    "{chapter.summary || 'No summary available...'}"
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ChaptersView = memo(ChaptersViewComponent);
export default ChaptersView;
