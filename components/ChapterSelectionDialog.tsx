import React, { useState, useMemo, useCallback } from 'react';
import { NovelState, Chapter } from '../types';
import { ChapterTargetingOptions } from '../types/improvement';

interface ChapterSelectionDialogProps {
  isOpen: boolean;
  novelState: NovelState;
  onConfirm: (selection: ChapterTargetingOptions | null) => void;
  onCancel: () => void;
}

const ChapterSelectionDialog: React.FC<ChapterSelectionDialogProps> = ({
  isOpen,
  novelState,
  onConfirm,
  onCancel,
}) => {
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Get sorted chapters
  const chapters = useMemo(() => {
    return [...novelState.chapters].sort((a, b) => a.number - b.number);
  }, [novelState.chapters]);

  // Filter chapters based on search
  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return chapters;
    const query = searchQuery.toLowerCase();
    return chapters.filter(ch => 
      ch.title?.toLowerCase().includes(query) ||
      ch.number.toString().includes(query) ||
      ch.content?.toLowerCase().includes(query)
    );
  }, [chapters, searchQuery]);

  // Calculate estimated savings
  const estimatedSavings = useMemo(() => {
    const totalChapters = chapters.length;
    const selectedCount = selectedChapters.size;
    if (totalChapters === 0 || selectedCount === 0) return null;
    
    const percentage = ((totalChapters - selectedCount) / totalChapters) * 100;
    const timeSavings = Math.round(percentage);
    return {
      chaptersAnalyzed: selectedCount,
      totalChapters,
      timeSavings,
      percentageSaved: percentage,
    };
  }, [chapters.length, selectedChapters.size]);

  // Toggle chapter selection
  const toggleChapter = useCallback((chapterNumber: number) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber);
      } else {
        next.add(chapterNumber);
      }
      return next;
    });
  }, []);

  // Quick select functions
  const selectAll = useCallback(() => {
    setSelectedChapters(new Set(chapters.map(ch => ch.number)));
  }, [chapters]);

  const selectNone = useCallback(() => {
    setSelectedChapters(new Set());
  }, []);

  const selectRecent = useCallback((count: number) => {
    const recentChapters = chapters.slice(-count);
    setSelectedChapters(new Set(recentChapters.map(ch => ch.number)));
  }, [chapters]);

  const selectFirst = useCallback((count: number) => {
    const firstChapters = chapters.slice(0, count);
    setSelectedChapters(new Set(firstChapters.map(ch => ch.number)));
  }, [chapters]);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedChapters.size === 0) {
      // No selection means analyze all (backward compatible)
      onConfirm(null);
      return;
    }

    const chapterNumbers = Array.from(selectedChapters).sort((a, b) => a - b);
    onConfirm({ chapterNumbers });
  }, [selectedChapters, onConfirm]);

  // Handle analyze all
  const handleAnalyzeAll = useCallback(() => {
    onConfirm(null);
  }, [onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-selection-title"
    >
      <div
        className="bg-zinc-900 border border-amber-500/50 bg-amber-950/20 p-6 md:p-8 rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl animate-in scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6">
          <h3
            id="chapter-selection-title"
            className="text-xl md:text-2xl font-fantasy font-bold text-amber-400 mb-2"
          >
            Select Chapters to Analyze
          </h3>
          <p className="text-sm text-zinc-400">
            Choose which chapters to include in the improvement analysis. This will make the process faster and reduce API costs.
          </p>
        </div>

        {/* Search and Quick Select */}
        <div className="mb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search chapters by title or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              Deselect All
            </button>
            <button
              onClick={() => selectRecent(5)}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              Recent 5
            </button>
            <button
              onClick={() => selectRecent(10)}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              Recent 10
            </button>
            <button
              onClick={() => selectFirst(10)}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
            >
              First 10
            </button>
          </div>
        </div>

        {/* Estimated Savings */}
        {estimatedSavings && estimatedSavings.chaptersAnalyzed > 0 && (
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <p className="text-sm text-amber-300">
              <strong>Analyzing {estimatedSavings.chaptersAnalyzed} of {estimatedSavings.totalChapters} chapters</strong>
              {estimatedSavings.percentageSaved > 0 && (
                <span className="ml-2">
                  (~{estimatedSavings.timeSavings}% faster, ~{estimatedSavings.timeSavings}% cost reduction)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto mb-6 border border-zinc-800 rounded-lg bg-zinc-950/50">
          <div className="p-4 space-y-2">
            {filteredChapters.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                {searchQuery ? 'No chapters found matching your search.' : 'No chapters available.'}
              </div>
            ) : (
              filteredChapters.map((chapter) => {
                const isSelected = selectedChapters.has(chapter.number);
                return (
                  <label
                    key={chapter.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-900/20 border border-amber-700/50'
                        : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChapter(chapter.number)}
                      className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-2"
                      aria-label={`Select chapter ${chapter.number}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-amber-400">
                          Chapter {chapter.number}
                        </span>
                        {chapter.title && (
                          <span className="text-sm text-zinc-300 truncate">
                            {chapter.title}
                          </span>
                        )}
                      </div>
                      {chapter.content && (
                        <p className="text-xs text-zinc-500 line-clamp-2">
                          {chapter.content.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Selection Summary */}
        <div className="mb-6 text-sm text-zinc-400">
          {selectedChapters.size === 0 ? (
            <span>No chapters selected. Click "Analyze All" to analyze all chapters.</span>
          ) : (
            <span>
              <strong className="text-amber-400">{selectedChapters.size}</strong> chapter{selectedChapters.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleAnalyzeAll}
              className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-semibold transition-all duration-200"
            >
              Analyze All
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedChapters.size === 0}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                selectedChapters.size === 0
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white shadow-lg hover:scale-105'
              }`}
            >
              Continue with Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChapterSelectionDialog;
