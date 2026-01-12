import React, { useState } from 'react';
import { EditorSuggestion } from '../types/editor';

interface ComparisonViewProps {
  originalText: string;
  editedText: string;
  suggestions: EditorSuggestion[];
  onAccept?: (suggestionId: string) => void;
  onReject?: (suggestionId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  className?: string;
}

type ViewMode = 'split' | 'unified';

const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalText,
  editedText,
  suggestions,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  // Simple diff calculation (for display purposes)
  // In a real implementation, you might want to use a diff library
  const calculateDiff = (original: string, edited: string) => {
    // This is a simplified diff - for production, consider using a library like diff-match-patch
    if (original === edited) {
      return { type: 'unchanged', text: original };
    }
    return { type: 'changed', original, edited };
  };

  const diff = calculateDiff(originalText, editedText);

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Compare Versions
          </h3>
          <div className="flex items-center gap-2">
            {pendingSuggestions.length > 0 && (
              <>
                {onAcceptAll && (
                  <button
                    onClick={onAcceptAll}
                    className="px-3 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded transition-all font-semibold"
                  >
                    Accept All ({pendingSuggestions.length})
                  </button>
                )}
                {onRejectAll && (
                  <button
                    onClick={onRejectAll}
                    className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-all font-semibold"
                  >
                    Reject All ({pendingSuggestions.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* View mode selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">View:</span>
            {(['split', 'unified'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {mode === 'split' ? 'Side by Side' : 'Unified'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyChanges}
              onChange={(e) => setShowOnlyChanges(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Show only changes
          </label>
        </div>
      </div>

      {/* Comparison content */}
      <div className="p-4">
        {viewMode === 'split' ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase">Original</h4>
                <span className="text-xs text-zinc-500">
                  {originalText.split(/\s+/).length} words
                </span>
              </div>
              <div className="bg-zinc-950 border border-zinc-700 rounded p-4 max-h-96 overflow-y-auto scrollbar-thin">
                <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">
                  {originalText}
                </pre>
              </div>
            </div>

            {/* Edited */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase">Edited</h4>
                <span className="text-xs text-zinc-500">
                  {editedText.split(/\s+/).length} words
                </span>
              </div>
              <div className="bg-zinc-950 border border-zinc-700 rounded p-4 max-h-96 overflow-y-auto scrollbar-thin">
                <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">
                  {editedText}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Unified view */}
            <div className="bg-zinc-950 border border-zinc-700 rounded p-4 max-h-96 overflow-y-auto scrollbar-thin">
              <div className="space-y-2">
                {/* Show suggestions in unified view */}
                {pendingSuggestions.length > 0 ? (
                  <div className="space-y-4">
                    {pendingSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.id}
                        className="p-3 bg-zinc-800/50 border border-zinc-700 rounded"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-semibold text-zinc-400">
                            {suggestion.suggestionType} ({suggestion.author === 'user' ? 'You' : 'AI'})
                          </span>
                          <div className="flex gap-2">
                            {onAccept && (
                              <button
                                onClick={() => onAccept(suggestion.id)}
                                className="px-2 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded transition-all"
                              >
                                Accept
                              </button>
                            )}
                            {onReject && (
                              <button
                                onClick={() => onReject(suggestion.id)}
                                className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                        {suggestion.originalText && suggestion.suggestionType !== 'insertion' && (
                          <div className="mb-2">
                            <p className="text-xs text-zinc-500 mb-1">Remove:</p>
                            <p className="text-xs text-red-400 line-through bg-red-500/10 p-2 rounded">
                              {suggestion.originalText}
                            </p>
                          </div>
                        )}
                        {suggestion.suggestedText && (
                          <div>
                            <p className="text-xs text-zinc-500 mb-1">
                              {suggestion.suggestionType === 'insertion' ? 'Add:' : 'Change to:'}
                            </p>
                            <p className="text-xs text-green-400 bg-green-500/10 p-2 rounded">
                              {suggestion.suggestedText}
                            </p>
                          </div>
                        )}
                        {suggestion.reason && (
                          <p className="text-xs text-zinc-400 italic mt-2">{suggestion.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">
                    {editedText}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Suggestions summary */}
        {pendingSuggestions.length > 0 && (
          <div className="mt-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded">
            <p className="text-xs text-zinc-400">
              {pendingSuggestions.length} pending suggestion{pendingSuggestions.length !== 1 ? 's' : ''} to review.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonView;
