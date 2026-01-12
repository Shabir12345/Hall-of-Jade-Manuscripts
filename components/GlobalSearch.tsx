import React, { useState, memo, useCallback, useMemo } from 'react';
import { NovelState } from '../types';
import { searchNovel, SearchResult } from '../services/searchService';
import { useNavigation } from '../contexts/NavigationContext';

interface GlobalSearchProps {
  novelState: NovelState;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ novelState }) => {
  const { navigate } = useNavigation();
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['chapter', 'scene', 'character', 'world']));

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchNovel(novelState, {
      query: query.trim(),
      types: Array.from(selectedTypes) as any[],
      limit: 50
    });
  }, [novelState, query, selectedTypes]);

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

      <div className="mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for anything..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          autoFocus
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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
      </div>

      <div className="space-y-3">
        {query.trim() === '' ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">Start Searching</h3>
            <p className="text-sm text-zinc-500">Enter a search query to find content across your novel.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Results Found</h3>
            <p className="text-sm text-zinc-500">Try a different search query or adjust your filters.</p>
          </div>
        ) : (
          results.map((result, idx) => (
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
          ))
        )}
      </div>
    </div>
  );
};

export default memo(GlobalSearch);
