import React, { useState, useMemo } from 'react';
import { EditorSuggestion } from '../types/editor';

interface TrackChangesViewProps {
  suggestions: EditorSuggestion[];
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  className?: string;
}

const TrackChangesView: React.FC<TrackChangesViewProps> = ({
  suggestions,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [authorFilter, setAuthorFilter] = useState<'all' | 'user' | 'ai'>('all');

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (authorFilter !== 'all' && s.author !== authorFilter) return false;
      return true;
    });
  }, [suggestions, filter, authorFilter]);

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;
  const acceptedCount = suggestions.filter(s => s.status === 'accepted').length;
  const rejectedCount = suggestions.filter(s => s.status === 'rejected').length;

  const getSuggestionColor = (type: EditorSuggestion['suggestionType'], status: EditorSuggestion['status']) => {
    if (status === 'accepted') return 'text-green-400';
    if (status === 'rejected') return 'text-red-400';
    
    switch (type) {
      case 'insertion':
        return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'deletion':
        return 'text-red-500 bg-red-500/10 border-red-500/30 line-through';
      case 'replacement':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-zinc-400';
    }
  };

  const getSuggestionIcon = (type: EditorSuggestion['suggestionType']) => {
    switch (type) {
      case 'insertion':
        return '➕';
      case 'deletion':
        return '➖';
      case 'replacement':
        return '🔄';
      default:
        return '✏️';
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className={`p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
        <p className="text-sm text-zinc-500 text-center">No suggestions yet.</p>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
      {/* Header with filters and actions */}
      <div className="p-4 border-b border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Track Changes ({suggestions.length})
          </h3>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && onAcceptAll && (
              <button
                onClick={onAcceptAll}
                className="px-3 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 hover:border-green-600/50 rounded transition-all duration-200 font-semibold"
              >
                Accept All ({pendingCount})
              </button>
            )}
            {pendingCount > 0 && onRejectAll && (
              <button
                onClick={onRejectAll}
                className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 hover:border-red-600/50 rounded transition-all duration-200 font-semibold"
              >
                Reject All ({pendingCount})
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Status:</span>
            {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === f
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && ` (${pendingCount})`}
                {f === 'accepted' && ` (${acceptedCount})`}
                {f === 'rejected' && ` (${rejectedCount})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Author:</span>
            {(['all', 'user', 'ai'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAuthorFilter(a)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  authorFilter === a
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {a === 'all' ? 'All' : a === 'user' ? 'You' : 'AI'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {filteredSuggestions.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500">No suggestions match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-700">
            {filteredSuggestions.map((suggestion) => {
              const isPending = suggestion.status === 'pending';
              const colorClass = getSuggestionColor(suggestion.suggestionType, suggestion.status);

              return (
                <div
                  key={suggestion.id}
                  className={`p-4 hover:bg-zinc-800/30 transition-colors ${
                    suggestion.status === 'accepted' ? 'bg-green-500/5' :
                    suggestion.status === 'rejected' ? 'bg-red-500/5' :
                    'bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getSuggestionIcon(suggestion.suggestionType)}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>
                        {suggestion.suggestionType}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {suggestion.author === 'user' ? 'You' : 'AI'}
                      </span>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onAccept(suggestion.id)}
                          className="px-3 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 hover:border-green-600/50 rounded transition-all duration-200 font-semibold"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => onReject(suggestion.id)}
                          className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 hover:border-red-600/50 rounded transition-all duration-200 font-semibold"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {!isPending && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        suggestion.status === 'accepted'
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}>
                        {suggestion.status === 'accepted' ? 'Accepted' : 'Rejected'}
                      </span>
                    )}
                  </div>

                  {suggestion.reason && (
                    <p className="text-xs text-zinc-400 italic mb-2">{suggestion.reason}</p>
                  )}

                  <div className="space-y-2 text-sm">
                    {suggestion.originalText && suggestion.suggestionType !== 'insertion' && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Original:</p>
                        <p className={`text-zinc-300 bg-zinc-800/50 p-2 rounded border border-zinc-700 ${
                          suggestion.suggestionType === 'deletion' ? 'line-through text-zinc-500' : ''
                        }`}>
                          {suggestion.originalText.substring(0, 200)}
                          {suggestion.originalText.length > 200 && '...'}
                        </p>
                      </div>
                    )}

                    {suggestion.suggestedText && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">
                          {suggestion.suggestionType === 'insertion' ? 'Insert:' : 'Suggested:'}
                        </p>
                        <p className={`text-zinc-200 bg-blue-500/10 p-2 rounded border border-blue-500/30 ${
                          suggestion.suggestionType === 'insertion' ? 'text-green-400' : ''
                        }`}>
                          {suggestion.suggestedText.substring(0, 200)}
                          {suggestion.suggestedText.length > 200 && '...'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackChangesView;
