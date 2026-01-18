import React, { useState, memo, useCallback, useMemo, useEffect } from 'react';
import { NovelState } from '../types';
import { searchNovel, SearchResult } from '../services/searchService';
import { useNavigation } from '../contexts/NavigationContext';
import { SkeletonCard } from './Skeleton';

interface GlobalSearchProps {
  novelState: NovelState;
}

const SEARCH_HISTORY_KEY = 'global-search-history';
const MAX_HISTORY_ITEMS = 10;

const GlobalSearch: React.FC<GlobalSearchProps> = ({ novelState }) => {
  const { navigate } = useNavigation();
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['chapter', 'scene', 'character', 'world']));
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load search history', e);
    }
    return [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [groupResults, setGroupResults] = useState(true);

  // Save search history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch (e) {
      console.error('Failed to save search history', e);
    }
  }, [searchHistory]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchNovel(novelState, {
      query: query.trim(),
      types: Array.from(selectedTypes) as any[],
      limit: 50
    });
  }, [novelState, query, selectedTypes]);

  const groupedResults = useMemo(() => {
    const grouped: Record<string, SearchResult[]> = {
      chapter: [],
      scene: [],
      character: [],
      world: []
    };
    results.forEach(result => {
      if (grouped[result.type]) {
        grouped[result.type].push(result);
      }
    });
    return grouped;
  }, [results]);

  // Add query to history when search is performed
  useEffect(() => {
    if (query.trim() && results.length > 0) {
      setSearchHistory(prev => {
        const trimmed = query.trim();
        const filtered = prev.filter(q => q !== trimmed);
        const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        return updated;
      });
    }
  }, [query, results.length]);

  const toggleType = useCallback((type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleResultClick = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'chapter':
        navigate({ type: 'chapter', chapterId: result.id });
        break;
      case 'scene':
        // Find the chapter that contains this scene
        const chapter = novelState.chapters.find(c => 
          c.scenes?.some(s => s.id === result.id)
        );
        if (chapter) {
          navigate({ type: 'scene', sceneId: result.id, chapterId: chapter.id });
        } else {
          navigate({ type: 'view', view: 'chapters' });
        }
        break;
      case 'character':
        navigate({ type: 'character', characterId: result.id });
        break;
      case 'world':
        navigate({ type: 'world-entry', entryId: result.id });
        break;
      default:
        console.warn('Unknown search result type:', result.type);
    }
  }, [navigate, novelState]);

  const handleHistoryClick = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear search history', e);
    }
  }, []);

  const typeIcons: Record<string, string> = {
    chapter: '📖',
    scene: '🎬',
    character: '👥',
    world: '🌍'
  };

  const typeColors: Record<string, string> = {
    chapter: 'amber',
    scene: 'indigo',
    character: 'emerald',
    world: 'blue'
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Global Search</h2>
        <p className="text-sm text-zinc-400 mt-2">Search across all chapters, scenes, characters, and world entries</p>
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowHistory(e.target.value === '' && searchHistory.length > 0);
          }}
          onFocus={() => {
            if (query === '' && searchHistory.length > 0) {
              setShowHistory(true);
            }
          }}
          onBlur={() => {
            // Delay to allow history item clicks
            setTimeout(() => setShowHistory(false), 200);
          }}
          placeholder="Search for anything..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all pr-20"
          autoFocus
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setShowHistory(searchHistory.length > 0);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-zinc-800"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        {showHistory && searchHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto scrollbar-thin">
            <div className="p-2">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Recent Searches</span>
                <button
                  onClick={clearHistory}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label="Clear history"
                >
                  Clear
                </button>
              </div>
              {searchHistory.map((historyQuery, idx) => (
                <button
                  key={idx}
                  onClick={() => handleHistoryClick(historyQuery)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 text-sm text-zinc-300 transition-colors flex items-center gap-2"
                >
                  <span className="text-zinc-500">🔍</span>
                  <span className="flex-1 truncate">{historyQuery}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 items-center">
        {['chapter', 'scene', 'character', 'world'].map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              selectedTypes.has(type)
                ? `bg-${typeColors[type]}-600/20 text-${typeColors[type]}-400 border border-${typeColors[type]}-600/30`
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <span className="mr-2">{typeIcons[type]}</span>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        {results.length > 0 && (
          <button
            onClick={() => setGroupResults(!groupResults)}
            className={`ml-auto px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              groupResults
                ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            }`}
            title={groupResults ? 'Show ungrouped results' : 'Group results by type'}
          >
            {groupResults ? '📊 Grouped' : '📋 List'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {query.trim() === '' ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">Start Searching</h3>
            <p className="text-sm text-zinc-500">Enter a search query to find content across your novel.</p>
            {searchHistory.length > 0 && (
              <div className="mt-6">
                <p className="text-xs text-zinc-500 mb-2">Or click on a recent search below:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {searchHistory.slice(0, 5).map((historyQuery, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHistoryClick(historyQuery)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs text-zinc-400 hover:text-zinc-300 transition-all"
                    >
                      {historyQuery}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Results Found</h3>
            <p className="text-sm text-zinc-500">Try a different search query or adjust your filters.</p>
          </div>
        ) : groupResults && groupedResults ? (
          // Grouped results
          <div className="space-y-6">
            {(['chapter', 'scene', 'character', 'world'] as const).map(type => {
              const typeResults = groupedResults[type];
              if (typeResults.length === 0) return null;
              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-700">
                    <span className="text-xl">{typeIcons[type]}</span>
                    <h3 className={`text-lg font-fantasy font-bold text-${typeColors[type]}-400`}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}s ({typeResults.length})
                    </h3>
                  </div>
                  {typeResults.map((result, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleResultClick(result)}
                      className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-${typeColors[result.type]}-500/50 transition-all duration-200 cursor-pointer group`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <span className="text-xl">{typeIcons[result.type]}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-base font-fantasy font-bold text-${typeColors[result.type]}-400 mb-1 line-clamp-1`}>
                              {result.title}
                            </h4>
                            <p className="text-sm text-zinc-400 line-clamp-2">{result.content}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded bg-${typeColors[result.type]}-600/20 text-${typeColors[result.type]}-400 border border-${typeColors[result.type]}-600/30`}>
                          {result.type}
                        </span>
                      </div>
                      {result.context && (
                        <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 italic">
                          {result.context}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          ) : (
          // Ungrouped results
          <div className="space-y-2">
            {results.map((result, idx) => (
              <div
                key={idx}
                onClick={() => handleResultClick(result)}
                className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-${typeColors[result.type]}-500/50 hover:shadow-lg hover:shadow-${typeColors[result.type]}-900/10 transition-all duration-200 cursor-pointer group`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-xl">{typeIcons[result.type]}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-base font-fantasy font-bold text-${typeColors[result.type]}-400 mb-1 line-clamp-1 group-hover:text-${typeColors[result.type]}-300 transition-colors`}>
                        {result.title}
                      </h4>
                      <p className="text-sm text-zinc-400 line-clamp-2">{result.content}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded bg-${typeColors[result.type]}-600/20 text-${typeColors[result.type]}-400 border border-${typeColors[result.type]}-600/30 flex-shrink-0`}>
                    {result.type}
                  </span>
                </div>
                {result.context && (
                  <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-400 italic border-l-2 border-${typeColors[result.type]}-600/30 pl-3">
                    {result.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(GlobalSearch);
