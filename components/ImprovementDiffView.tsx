import React, { useState, useMemo, useCallback } from 'react';
import { NovelState, Chapter } from '../types';
import { ImprovementActionResult } from '../types/improvement';
import { generateNovelDiff, generateChapterDiff, NovelDiff, ChapterDiff, ContentChange, attachExplanationsToNovelDiff } from '../services/changeTracker';

interface ImprovementDiffViewProps {
  originalState: NovelState;
  improvedState: NovelState;
  actionResults?: ImprovementActionResult[];
  category: string;
  onClose: () => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onAcceptChange?: (chapterId: string) => void;
  onRejectChange?: (chapterId: string) => void;
}

/**
 * ImprovementDiffView - Shows side-by-side comparison of changes
 */
const ImprovementDiffView: React.FC<ImprovementDiffViewProps> = ({
  originalState,
  improvedState,
  actionResults,
  category,
  onClose,
  onAcceptAll,
  onRejectAll,
  onAcceptChange,
  onRejectChange,
}) => {
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);

  // Generate the diff with explanations
  const novelDiff = useMemo(() => {
    const baseDiff = generateNovelDiff(originalState, improvedState, category);
    // Attach explanations to all changes
    return attachExplanationsToNovelDiff(baseDiff, actionResults);
  }, [originalState, improvedState, category, actionResults]);

  // Get chapters with changes
  const changedChapters = useMemo(() => {
    return novelDiff.chapterDiffs.filter(cd => cd.hasChanges);
  }, [novelDiff]);

  // Get selected chapter diff
  const selectedChapterDiff = useMemo(() => {
    if (!selectedChapter) {
      return changedChapters[0] || null;
    }
    return novelDiff.chapterDiffs.find(cd => cd.chapterId === selectedChapter) || null;
  }, [selectedChapter, novelDiff, changedChapters]);

  // Auto-select first changed chapter
  React.useEffect(() => {
    if (!selectedChapter && changedChapters.length > 0) {
      setSelectedChapter(changedChapters[0].chapterId);
    }
  }, [changedChapters, selectedChapter]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-amber-400">
              Changes Preview - {category.charAt(0).toUpperCase() + category.slice(1)}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {novelDiff.summary.chaptersChanged} chapters modified | 
              {novelDiff.summary.netWordChange > 0 ? ' +' : ' '}{novelDiff.summary.netWordChange} words
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* View mode toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'side-by-side' 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('unified')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'unified' 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Unified
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chapter list sidebar */}
          <div className="w-64 border-r border-zinc-700 overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase">Chapters</h3>
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={showOnlyChanges}
                    onChange={(e) => setShowOnlyChanges(e.target.checked)}
                    className="rounded"
                  />
                  Changed only
                </label>
              </div>
              <div className="space-y-1">
                {novelDiff.chapterDiffs
                  .filter(cd => !showOnlyChanges || cd.hasChanges)
                  .map(cd => (
                    <button
                      key={cd.chapterId}
                      onClick={() => setSelectedChapter(cd.chapterId)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedChapter === cd.chapterId
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-600/50'
                          : cd.hasChanges
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                            : 'text-zinc-500 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>Chapter {cd.chapterNumber}</span>
                        {cd.hasChanges && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            cd.summary.netWordChange > 0 
                              ? 'bg-green-900/50 text-green-400'
                              : cd.summary.netWordChange < 0
                                ? 'bg-red-900/50 text-red-400'
                                : 'bg-yellow-900/50 text-yellow-400'
                          }`}>
                            {cd.summary.netWordChange > 0 ? '+' : ''}{cd.summary.netWordChange}
                          </span>
                        )}
                      </div>
                      {cd.hasChanges && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {cd.summary.changePercentage}% changed
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Diff view */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedChapterDiff ? (
              <>
                {/* Chapter header */}
                <div className="px-6 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Chapter {selectedChapterDiff.chapterNumber}: {selectedChapterDiff.chapterTitle}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-zinc-400 mt-1">
                      <span>
                        {selectedChapterDiff.summary.totalAdditions} additions
                      </span>
                      <span>
                        {selectedChapterDiff.summary.totalDeletions} deletions
                      </span>
                      <span>
                        {selectedChapterDiff.summary.totalModifications} modifications
                      </span>
                    </div>
                  </div>
                  {onAcceptChange && onRejectChange && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onAcceptChange(selectedChapterDiff.chapterId)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                      >
                        Accept This
                      </button>
                      <button
                        onClick={() => onRejectChange(selectedChapterDiff.chapterId)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                      >
                        Reject This
                      </button>
                    </div>
                  )}
                </div>

                {/* Diff content */}
                <div className="flex-1 overflow-auto p-4">
                  {viewMode === 'side-by-side' ? (
                    <SideBySideDiff chapterDiff={selectedChapterDiff} />
                  ) : (
                    <UnifiedDiff chapterDiff={selectedChapterDiff} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                {changedChapters.length === 0 
                  ? 'No changes were made'
                  : 'Select a chapter to view changes'
                }
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-700 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Total: {novelDiff.beforeState.totalWords} → {novelDiff.afterState.totalWords} words
            ({novelDiff.summary.overallChangePercentage}% change)
          </div>
          <div className="flex items-center gap-3">
            {onRejectAll && (
              <button
                onClick={onRejectAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Reject All Changes
              </button>
            )}
            {onAcceptAll && (
              <button
                onClick={onAcceptAll}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Accept All Changes
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Side-by-side diff component
 */
const SideBySideDiff: React.FC<{ chapterDiff: ChapterDiff }> = ({ chapterDiff }) => {
  const beforeParagraphs = chapterDiff.beforeContent.split(/\n\n+/);
  const afterParagraphs = chapterDiff.afterContent.split(/\n\n+/);

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {/* Before column */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-2 bg-red-900/30 border-b border-zinc-700">
          <h4 className="text-sm font-semibold text-red-400">Before</h4>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-zinc-800/30">
          <div className="prose prose-invert prose-sm max-w-none">
            {beforeParagraphs.map((para, idx) => (
              <p key={idx} className="mb-4 text-zinc-300 leading-relaxed">
                {para || <span className="text-zinc-600 italic">(empty paragraph)</span>}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* After column */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-2 bg-green-900/30 border-b border-zinc-700">
          <h4 className="text-sm font-semibold text-green-400">After</h4>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-zinc-800/30">
          <div className="prose prose-invert prose-sm max-w-none">
            {afterParagraphs.map((para, idx) => (
              <p key={idx} className="mb-4 text-zinc-300 leading-relaxed">
                {para || <span className="text-zinc-600 italic">(empty paragraph)</span>}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Unified diff component with explanations
 */
const UnifiedDiff: React.FC<{ chapterDiff: ChapterDiff }> = ({ chapterDiff }) => {
  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
        <h4 className="text-sm font-semibold text-zinc-300">Unified Diff</h4>
      </div>
      <div className="overflow-auto p-4 bg-zinc-800/30 max-h-[calc(100vh-300px)]">
        {chapterDiff.changes.length === 0 ? (
          <p className="text-zinc-500 italic">No changes in this chapter</p>
        ) : (
          <div className="space-y-4">
            {chapterDiff.changes.map((change, idx) => (
              <div key={change.id || idx} className={`border-l-4 pl-4 py-2 ${
                change.type === 'addition' 
                  ? 'border-green-500 bg-green-900/10' 
                  : change.type === 'deletion'
                    ? 'border-red-500 bg-red-900/10'
                    : 'border-yellow-500 bg-yellow-900/10'
              }`}>
                {/* Change header with type and stats */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    change.type === 'addition'
                      ? 'bg-green-600 text-white'
                      : change.type === 'deletion'
                        ? 'bg-red-600 text-white'
                        : 'bg-yellow-600 text-black'
                  }`}>
                    {change.type.toUpperCase()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {change.stats.wordChange > 0 ? '+' : ''}{change.stats.wordChange} words
                  </span>
                  {change.explanation?.confidence && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      change.explanation.confidence === 'high'
                        ? 'bg-blue-600/50 text-blue-300'
                        : change.explanation.confidence === 'medium'
                          ? 'bg-zinc-600/50 text-zinc-300'
                          : 'bg-zinc-700/50 text-zinc-400'
                    }`}>
                      {change.explanation.confidence} confidence
                    </span>
                  )}
                </div>
                
                {/* Explanation section */}
                {change.explanation && (
                  <div className="mb-3 p-2 bg-zinc-800/50 rounded border border-zinc-700">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 text-sm">💡</span>
                      <div className="flex-1">
                        <p className="text-sm text-amber-300 font-medium">
                          {change.explanation.summary}
                        </p>
                        {change.explanation.issueAddressed && (
                          <p className="text-xs text-zinc-400 mt-1">
                            <span className="text-zinc-500">Issue:</span> {change.explanation.issueAddressed}
                          </p>
                        )}
                        <p className="text-xs text-zinc-400 mt-0.5">
                          <span className="text-zinc-500">Benefit:</span> {change.explanation.expectedBenefit}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Content diff */}
                {change.type === 'deletion' && (
                  <div className="bg-red-900/20 p-3 rounded mb-2">
                    <p className="text-red-300 line-through">{change.beforeContent}</p>
                  </div>
                )}
                
                {change.type === 'addition' && (
                  <div className="bg-green-900/20 p-3 rounded">
                    <p className="text-green-300">{change.afterContent}</p>
                  </div>
                )}
                
                {change.type === 'modification' && (
                  <>
                    <div className="bg-red-900/20 p-3 rounded mb-2">
                      <p className="text-red-300 line-through">{change.beforeContent}</p>
                    </div>
                    <div className="bg-green-900/20 p-3 rounded">
                      <p className="text-green-300">{change.afterContent}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImprovementDiffView;
