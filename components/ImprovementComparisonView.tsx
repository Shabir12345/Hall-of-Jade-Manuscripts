import React, { useState, useMemo } from 'react';
import { NovelState } from '../types';
import { ImprovementExecutionResult } from '../types/improvement';

interface ImprovementComparisonViewProps {
  originalState: NovelState;
  improvedState: NovelState;
  result: ImprovementExecutionResult;
  onClose: () => void;
}

const ImprovementComparisonView: React.FC<ImprovementComparisonViewProps> = ({
  originalState,
  improvedState,
  result,
  onClose,
}) => {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'summary' | 'chapters'>('summary');

  // Find chapters that were edited
  const editedChapters = useMemo(() => {
    const edited: Array<{ original: any; improved: any; number: number }> = [];
    originalState.chapters.forEach((origChapter, idx) => {
      const improvedChapter = improvedState.chapters[idx];
      if (improvedChapter && origChapter.content !== improvedChapter.content) {
        edited.push({
          original: origChapter,
          improved: improvedChapter,
          number: origChapter.number,
        });
      }
    });
    return edited;
  }, [originalState, improvedState]);

  // Find inserted chapters
  const insertedChapters = useMemo(() => {
    const inserted: any[] = [];
    const originalChapterCount = originalState.chapters.length;
    if (improvedState.chapters.length > originalChapterCount) {
      for (let i = originalChapterCount; i < improvedState.chapters.length; i++) {
        inserted.push(improvedState.chapters[i]);
      }
    }
    return inserted;
  }, [originalState, improvedState]);

  // Calculate word count changes
  const wordCountChanges = useMemo(() => {
    const originalWords = originalState.chapters.reduce(
      (sum, ch) => sum + (ch.content?.split(/\s+/).length || 0),
      0
    );
    const improvedWords = improvedState.chapters.reduce(
      (sum, ch) => sum + (ch.content?.split(/\s+/).length || 0),
      0
    );
    return {
      original: originalWords,
      improved: improvedWords,
      change: improvedWords - originalWords,
    };
  }, [originalState, improvedState]);

  const scoreChange = result.scoreAfter - result.scoreBefore;
  const scoreChangeColor = scoreChange > 0 ? 'text-green-400' : scoreChange < 0 ? 'text-red-400' : 'text-zinc-400';

  // Get selected chapter content for detailed view
  const selectedChapterContent = useMemo(() => {
    if (!selectedChapterId) return null;
    const original = originalState.chapters.find(ch => ch.id === selectedChapterId);
    const improved = improvedState.chapters.find(ch => ch.id === selectedChapterId);
    return { original: original?.content || '', improved: improved?.content || '' };
  }, [selectedChapterId, originalState, improvedState]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-amber-400">Improvement Comparison</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="p-4 border-b border-zinc-700 flex items-center gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'summary'
                ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setViewMode('chapters')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'chapters'
                ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            Chapters ({result.chaptersEdited + result.chaptersInserted + result.chaptersRegenerated})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {viewMode === 'summary' ? (
            <>
              {/* Score Comparison */}
              <div className="p-4 bg-zinc-800 rounded-lg">
                <h3 className="text-amber-400 font-semibold mb-4">Score Improvement</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <span className="text-sm text-zinc-400 block mb-1">Before</span>
                    <span className="text-3xl font-bold text-white">{result.scoreBefore}/100</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-zinc-400 block mb-1">After</span>
                    <span className="text-3xl font-bold text-amber-400">{result.scoreAfter}/100</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-zinc-400 block mb-1">Change</span>
                    <span className={`text-3xl font-bold ${scoreChangeColor}`}>
                      {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800 rounded-lg">
                  <h3 className="text-amber-400 font-semibold mb-3">Chapters</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total Chapters</span>
                      <span className="text-white font-semibold">
                        {originalState.chapters.length} → {improvedState.chapters.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Edited</span>
                      <span className="text-blue-400 font-semibold">{result.chaptersEdited}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Inserted</span>
                      <span className="text-green-400 font-semibold">{result.chaptersInserted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Regenerated</span>
                      <span className="text-purple-400 font-semibold">{result.chaptersRegenerated}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-zinc-800 rounded-lg">
                  <h3 className="text-amber-400 font-semibold mb-3">Word Count</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Before</span>
                      <span className="text-white font-semibold">
                        {wordCountChanges.original.toLocaleString()} words
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">After</span>
                      <span className="text-white font-semibold">
                        {wordCountChanges.improved.toLocaleString()} words
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Change</span>
                      <span className={`font-semibold ${wordCountChanges.change > 0 ? 'text-green-400' : wordCountChanges.change < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                        {wordCountChanges.change > 0 ? '+' : ''}{wordCountChanges.change.toLocaleString()} words
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Summary */}
              <div className="p-4 bg-zinc-800 rounded-lg">
                <h3 className="text-amber-400 font-semibold mb-3">Actions Executed</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm text-zinc-400">Total</span>
                    <p className="text-white font-semibold text-xl">{result.actionsExecuted}</p>
                  </div>
                  <div>
                    <span className="text-sm text-zinc-400">Succeeded</span>
                    <p className="text-green-400 font-semibold text-xl">{result.actionsSucceeded}</p>
                  </div>
                  <div>
                    <span className="text-sm text-zinc-400">Failed</span>
                    <p className="text-red-400 font-semibold text-xl">{result.actionsFailed}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Edited Chapters */}
              {editedChapters.length > 0 && (
                <div>
                  <h3 className="text-amber-400 font-semibold mb-3">
                    Edited Chapters ({editedChapters.length})
                  </h3>
                  <div className="space-y-2">
                    {editedChapters.map(({ original, improved, number }) => (
                      <div
                        key={original.id}
                        className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-amber-600/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedChapterId(original.id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">Chapter {number}: {original.title}</span>
                          <span className="text-xs text-zinc-400">Click to view comparison</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inserted Chapters */}
              {insertedChapters.length > 0 && (
                <div>
                  <h3 className="text-green-400 font-semibold mb-3">
                    Inserted Chapters ({insertedChapters.length})
                  </h3>
                  <div className="space-y-2">
                    {insertedChapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg"
                      >
                        <span className="text-white font-semibold">Chapter {chapter.number}: {chapter.title}</span>
                        <p className="text-sm text-zinc-400 mt-1">
                          {chapter.content?.split(/\s+/).length || 0} words
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chapter Detail View */}
              {selectedChapterId && selectedChapterContent && (
                <div className="mt-4 p-4 bg-zinc-800 rounded-lg border border-amber-600/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-amber-400 font-semibold">Chapter Comparison</h4>
                    <button
                      onClick={() => setSelectedChapterId(null)}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      Close
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-400 mb-2 uppercase">Before</h5>
                      <div className="bg-zinc-950 border border-zinc-700 rounded p-3 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-serif">
                          {selectedChapterContent.original || '(Empty)'}
                        </pre>
                      </div>
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-zinc-400 mb-2 uppercase">After</h5>
                      <div className="bg-zinc-950 border border-zinc-700 rounded p-3 max-h-96 overflow-y-auto">
                        <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-serif">
                          {selectedChapterContent.improved || '(Empty)'}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImprovementComparisonView;
