import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NovelState, EntitySuggestion } from '../types';
import { findMatchingEntities } from '../services/referenceService';

interface ReferenceAutocompleteProps {
  query: string;
  state: NovelState;
  position: { top: number; left: number };
  onSelect: (suggestion: EntitySuggestion) => void;
  onClose: () => void;
}

const ReferenceAutocomplete: React.FC<ReferenceAutocompleteProps> = ({
  query,
  state,
  position,
  onSelect,
  onClose,
}) => {
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Get suggestions based on query
  useEffect(() => {
    const matches = findMatchingEntities(query, state);
    setSuggestions(matches);
    setSelectedIndex(0);
  }, [query, state]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        onSelect(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [suggestions, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  if (suggestions.length === 0) {
    return null;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'character':
        return '👤';
      case 'territory':
        return '🗺️';
      case 'worldEntry':
        return '📜';
      case 'realm':
        return '🌌';
      case 'arc':
        return '📖';
      case 'tag':
        return '🏷️';
      default:
        return '•';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'character':
        return 'text-blue-400';
      case 'territory':
        return 'text-green-400';
      case 'worldEntry':
        return 'text-purple-400';
      case 'realm':
        return 'text-amber-400';
      case 'arc':
        return 'text-pink-400';
      case 'tag':
        return 'text-cyan-400';
      default:
        return 'text-zinc-400';
    }
  };

  return (
    <div
      className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto scrollbar-thin"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '280px',
        maxWidth: '400px',
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      ref={listRef}
    >
      <div className="p-2 space-y-1">
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.type}-${suggestion.id}`}
            onClick={() => onSelect(suggestion)}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all
              ${index === selectedIndex 
                ? 'bg-amber-600/20 border border-amber-500/50' 
                : 'hover:bg-zinc-800 border border-transparent'
              }
            `}
          >
            <span className="text-lg flex-shrink-0">{getTypeIcon(suggestion.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-200 truncate">
                  {suggestion.displayName}
                </span>
                <span className={`text-xs ${getTypeColor(suggestion.type)} flex-shrink-0`}>
                  {suggestion.type}
                </span>
              </div>
              {suggestion.description && (
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {suggestion.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferenceAutocomplete;
