/**
 * Characters View Component
 * Manages the character codex view with card grid and detail panel
 */

import React, { memo, useState, useMemo, useCallback } from 'react';
import type { NovelState, Character, Chapter } from '../../types';
import { SkeletonList } from '../Skeleton';
import { CharacterDetailPanel } from '../CharacterDetailPanel';
import { RelationshipNetworkGraph } from '../RelationshipNetworkGraph';
import { textContainsCharacterName } from '../../utils/characterNameMatching';
import { backfillAllChapters } from '../../services/chapterBackfillService';
import { useToast } from '../../contexts/ToastContext';

interface CharactersViewProps {
  novel: NovelState;
  onEditCharacter: (character: Character) => void;
  onAddCharacter: () => void;
  onSetProtagonist: (characterId: string) => void;
  onGeneratePortrait: (character: Character) => void;
  isGeneratingPortrait: string | null;
  onUpdateNovel?: (updater: (prev: NovelState) => NovelState) => void;
  onNavigate?: () => void;
  onDeleteCharacter?: (characterId: string) => void;
  isLoading?: boolean;
}

type SortOption = 'name' | 'realm' | 'protagonist' | 'status';
type FilterStatus = 'all' | 'Alive' | 'Deceased' | 'Unknown';
type FilterProtagonist = 'all' | 'protagonist' | 'non-protagonist';
type ViewMode = 'grid' | 'list' | 'network';

const CharactersViewComponent: React.FC<CharactersViewProps> = ({
  novel,
  onEditCharacter,
  onAddCharacter,
  onSetProtagonist,
  onGeneratePortrait,
  isGeneratingPortrait,
  onUpdateNovel,
  onNavigate,
  onDeleteCharacter,
  isLoading = false,
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterProtagonist, setFilterProtagonist] = useState<FilterProtagonist>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isBackfilling, setIsBackfilling] = useState(false);
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  // Calculate character appearances in chapters
  const characterAppearances = useMemo(() => {
    const appearances = new Map<string, number>();
    novel.characterCodex.forEach(char => {
      const count = novel.chapters.filter(ch => {
        if (ch.content && textContainsCharacterName(ch.content, char.name)) return true;
        if (ch.summary && textContainsCharacterName(ch.summary, char.name)) return true;
        if (ch.scenes?.some(scene => 
          (scene.content && textContainsCharacterName(scene.content, char.name)) ||
          (scene.summary && textContainsCharacterName(scene.summary, char.name))
        )) return true;
        return false;
      }).length;
      appearances.set(char.id, count);
    });
    return appearances;
  }, [novel.characterCodex, novel.chapters]);

  // Filter and sort characters
  const filteredAndSortedCharacters = useMemo(() => {
    let filtered = [...novel.characterCodex];

    // Enhanced search filter (includes items, techniques, relationships)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(char => {
        // Basic fields
        if (char.name.toLowerCase().includes(query) ||
            char.currentCultivation?.toLowerCase().includes(query) ||
            char.age?.toLowerCase().includes(query) ||
            char.personality?.toLowerCase().includes(query) ||
            char.background?.toLowerCase().includes(query) ||
            char.goals?.toLowerCase().includes(query)) {
          return true;
        }
        
        // Search in items
        if (char.itemPossessions) {
          const hasMatchingItem = char.itemPossessions.some(poss => {
            const item = novel.novelItems?.find(i => i.id === poss.itemId);
            return item && item.name.toLowerCase().includes(query);
          });
          if (hasMatchingItem) return true;
        }
        
        // Search in techniques
        if (char.techniqueMasteries) {
          const hasMatchingTechnique = char.techniqueMasteries.some(mast => {
            const technique = novel.novelTechniques?.find(t => t.id === mast.techniqueId);
            return technique && technique.name.toLowerCase().includes(query);
          });
          if (hasMatchingTechnique) return true;
        }
        
        // Search in relationships
        if (char.relationships) {
          const hasMatchingRelationship = char.relationships.some(rel => {
            const target = novel.characterCodex.find(c => c.id === rel.characterId);
            return rel.type.toLowerCase().includes(query) ||
                   target?.name.toLowerCase().includes(query);
          });
          if (hasMatchingRelationship) return true;
        }
        
        return false;
      });
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(char => char.status === filterStatus);
    }

    // Protagonist filter
    if (filterProtagonist === 'protagonist') {
      filtered = filtered.filter(char => char.isProtagonist);
    } else if (filterProtagonist === 'non-protagonist') {
      filtered = filtered.filter(char => !char.isProtagonist);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'realm':
          return (a.currentCultivation || '').localeCompare(b.currentCultivation || '');
        case 'protagonist':
          if (a.isProtagonist && !b.isProtagonist) return -1;
          if (!a.isProtagonist && b.isProtagonist) return 1;
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [novel.characterCodex, searchQuery, filterStatus, filterProtagonist, sortBy]);

  const handleCardClick = (character: Character) => {
    setSelectedCharacter(character);
  };

  const handleClosePanel = () => {
    setSelectedCharacter(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterProtagonist('all');
    setSortBy('name');
  };

  const handleBackfillChapters = useCallback(async () => {
    if (!onUpdateNovel) {
      showError('Cannot update novel state. Please refresh the page and try again.');
      return;
    }

    if (novel.chapters.length === 0) {
      showError('No chapters found to backfill.');
      return;
    }

    const confirmed = window.confirm(
      `This will analyze all ${novel.chapters.length} chapter(s) and extract character details (relationships, items, techniques, karma links) into the codex.\n\n` +
      `This may take several minutes depending on the number of chapters.\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setIsBackfilling(true);
    showInfo('Starting backfill process... This may take a few minutes.');

    try {
      const result = await backfillAllChapters(
        novel,
        (chapterNumber, total, chapter) => {
          showInfo(`Processing chapter ${chapterNumber}/${total}: ${chapter.title}`, 3000);
        },
        (message) => {
          // Log progress messages (these are already shown via showInfo above)
          console.log(`[Backfill] ${message}`);
        }
      );

      if (result.success) {
        if (result.updatedState) {
          // Update the novel state with backfilled data
          onUpdateNovel((prev) => result.updatedState || prev);
          showSuccess(
            `Backfill complete! Processed ${result.processed} chapter(s). ` +
            `Characters, relationships, items, and techniques have been updated in the codex.`
          );
        } else {
          showWarning('Backfill completed but no changes were made. Chapters may already be processed.');
        }
      } else {
        if (result.errors.length > 0) {
          const errorCount = result.errors.length;
          const successCount = result.processed - errorCount;
          showError(
            `Backfill completed with errors. ${successCount} chapter(s) processed successfully, ${errorCount} failed.`,
            8000
          );
          console.error('Backfill errors:', result.errors);
        } else {
          showError('Backfill failed. Please try again or check the console for details.');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showError(`Backfill failed: ${errorMessage}`, 8000);
      console.error('Backfill error:', error);
    } finally {
      setIsBackfilling(false);
    }
  }, [novel, onUpdateNovel, showSuccess, showError, showInfo, showWarning]);

  if (isLoading) {
    return (
      <div 
        className="p-3 xs:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto"
        style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top, 1rem) + 2.5rem))' }}
      >
        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3 xs:gap-4 mb-4 xs:mb-6 md:mb-8 border-b border-zinc-700 pb-3 xs:pb-4">
          <div className="h-7 xs:h-8 w-32 xs:w-48 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-9 xs:h-10 w-24 xs:w-32 bg-zinc-800/50 rounded animate-pulse" />
        </div>
        <SkeletonList items={5} showAvatar={true} />
      </div>
    );
  }

  return (
    <>
      <div 
        className="p-3 xs:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
        style={{ paddingTop: 'max(4rem, calc(env(safe-area-inset-top, 1rem) + 3.5rem))' }}
      >
        {/* Header */}
        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3 xs:gap-4 mb-4 xs:mb-6 md:mb-8 border-b border-zinc-700 pb-3 xs:pb-4 md:pb-6">
          <h2 className="text-xl xs:text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Codex</h2>
          {/* Action buttons - horizontal scroll on mobile */}
          <div className="flex gap-2 xs:gap-3 flex-nowrap items-center overflow-x-auto scrollbar-hide -mx-3 xs:mx-0 px-3 xs:px-0 pb-1 xs:pb-0 w-full xs:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1 border border-zinc-700">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-amber-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                aria-label="Grid view"
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-amber-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                aria-label="List view"
                title="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('network')}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                  viewMode === 'network'
                    ? 'bg-amber-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                aria-label="Network view"
                title="Relationship network view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>
            
            {/* Export Button */}
            <button
              onClick={() => {
                const exportData = {
                  characters: filteredAndSortedCharacters.map(char => ({
                    name: char.name,
                    cultivation: char.currentCultivation,
                    status: char.status,
                    items: (char.itemPossessions || [])
                      .filter(p => p.status === 'active')
                      .map(p => {
                        const item = novel.novelItems?.find(i => i.id === p.itemId);
                        return item?.name || 'Unknown';
                      }),
                    techniques: (char.techniqueMasteries || [])
                      .filter(m => m.status === 'active')
                      .map(m => {
                        const tech = novel.novelTechniques?.find(t => t.id === m.techniqueId);
                        return `${tech?.name || 'Unknown'} (${m.masteryLevel || 'Novice'})`;
                      }),
                    relationships: (char.relationships || []).map(rel => {
                      const target = novel.characterCodex.find(c => c.id === rel.characterId);
                      return {
                        target: target?.name || 'Unknown',
                        type: rel.type
                      };
                    })
                  })),
                  exportedAt: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `codex-export-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showSuccess('Codex exported successfully');
              }}
              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-green-900/20 hover:scale-105 whitespace-nowrap"
              title="Export filtered characters to JSON"
            >
              Export
            </button>
            
            <button 
              onClick={handleBackfillChapters}
              disabled={isBackfilling || !onUpdateNovel || novel.chapters.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-900/20 hover:scale-105 whitespace-nowrap disabled:opacity-50"
              aria-label="Backfill character data from chapters"
              title="Extract character details (relationships, items, techniques) from all chapters into the codex"
            >
              {isBackfilling ? 'Backfilling...' : 'Backfill Codex'}
            </button>
            <button 
              onClick={onAddCharacter}
              className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 whitespace-nowrap"
              aria-label="Add new character"
            >
              Add Being
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, realm, age, personality, items, techniques..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 pl-10 text-zinc-200 placeholder-zinc-500 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            />
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters and Sort */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-status" className="text-xs text-zinc-400 uppercase tracking-wide">Status:</label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                aria-label="Filter by character status"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              >
                <option value="all">All</option>
                <option value="Alive">Alive</option>
                <option value="Deceased">Deceased</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-protagonist" className="text-xs text-zinc-400 uppercase tracking-wide">Type:</label>
              <select
                id="filter-protagonist"
                value={filterProtagonist}
                onChange={(e) => setFilterProtagonist(e.target.value as FilterProtagonist)}
                aria-label="Filter by protagonist status"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              >
                <option value="all">All</option>
                <option value="protagonist">Protagonists</option>
                <option value="non-protagonist">Others</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-by" className="text-xs text-zinc-400 uppercase tracking-wide">Sort:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort characters"
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              >
                <option value="name">Name</option>
                <option value="realm">Realm</option>
                <option value="protagonist">Protagonist</option>
                <option value="status">Status</option>
              </select>
            </div>

            {(searchQuery || filterStatus !== 'all' || filterProtagonist !== 'all') && (
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-400 hover:text-amber-400 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all"
              >
                Clear Filters
              </button>
            )}

            <div className="ml-auto text-xs text-zinc-500">
              {filteredAndSortedCharacters.length} of {novel.characterCodex.length} characters
            </div>
          </div>
        </div>

        {/* Character View Content */}
        {viewMode === 'network' ? (
          <div className="h-[calc(100vh-300px)] min-h-[500px] relative">
            <RelationshipNetworkGraph
              characters={filteredAndSortedCharacters}
              selectedCharacterId={selectedCharacter?.id}
              onCharacterClick={(characterId) => {
                const char = filteredAndSortedCharacters.find(c => c.id === characterId);
                if (char) {
                  setSelectedCharacter(char);
                }
              }}
              width={typeof window !== 'undefined' ? window.innerWidth - 100 : 800}
              height={600}
            />
          </div>
        ) : novel.characterCodex.length === 0 ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Characters Yet</h3>
            <p className="text-sm text-zinc-500 mb-6">Start building your cast by adding characters to your codex.</p>
            <button
              onClick={onAddCharacter}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
            >
              Add First Character
            </button>
          </div>
        ) : filteredAndSortedCharacters.length === 0 ? (
          <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Characters Found</h3>
            <p className="text-sm text-zinc-500 mb-6">Try adjusting your search or filters.</p>
            <button
              onClick={clearFilters}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
            >
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredAndSortedCharacters.map(char => {
              const appearanceCount = characterAppearances.get(char.id) || 0;
              const activeItems = (char.itemPossessions || []).filter(p => p.status === 'active').length;
              const activeTechniques = (char.techniqueMasteries || []).filter(m => m.status === 'active').length;

              return (
                <div
                  key={char.id}
                  onClick={() => handleCardClick(char)}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:bg-zinc-800 hover:border-amber-500/50"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {char.portraitUrl ? (
                      <img 
                        src={char.portraitUrl} 
                        alt={`${char.name} portrait`}
                        className="w-16 h-16 rounded-full object-cover border-2 border-amber-600/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-zinc-700/50 border-2 border-amber-600/20 flex items-center justify-center text-2xl">
                        {char.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-fantasy font-bold text-amber-400 truncate">{char.name}</h3>
                      {char.isProtagonist && (
                        <span className="text-amber-500 text-xs">★</span>
                      )}
                    </div>
                    {char.currentCultivation && (
                      <p className="text-xs text-zinc-400 truncate mb-2">{char.currentCultivation}</p>
                    )}
                    <div className="flex gap-4 text-xs text-zinc-500">
                      <span>{activeItems} Items</span>
                      <span>{activeTechniques} Techniques</span>
                      <span>{char.relationships.length} Links</span>
                      <span>{appearanceCount} Chapters</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCharacter(char);
                      }}
                      className="text-xs text-zinc-400 hover:text-amber-500 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredAndSortedCharacters.map(char => {
              const appearanceCount = characterAppearances.get(char.id) || 0;
              const activeItems = (char.itemPossessions || []).filter(p => p.status === 'active').length;
              const activeTechniques = (char.techniqueMasteries || []).filter(m => m.status === 'active').length;
              // #region agent log
              if (char.name === 'ALEX' || char.name === 'MEI LIN' || char.name === 'ZHAO') {
                fetch('http://127.0.0.1:7242/ingest/4a979e19-e727-4c92-a2e3-96a9b90ccf64',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CharactersView.tsx:567',message:'Character display data',data:{characterName:char.name,activeItems,activeTechniques,relationshipsCount:char.relationships?.length||0,appearanceCount,itemPossessionsCount:char.itemPossessions?.length||0,itemPossessionsRaw:char.itemPossessions,techniqueMasteriesCount:char.techniqueMasteries?.length||0,techniqueMasteriesRaw:char.techniqueMasteries},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              }
              // #endregion

              return (
                <div
                  key={char.id}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden group transition-all duration-200 hover:shadow-xl hover:shadow-amber-900/10 hover:border-amber-500/50 hover:scale-[1.02]"
                >
                  {/* Clickable Card Area */}
                  <div
                    onClick={() => handleCardClick(char)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(char);
                      }
                    }}
                    aria-label={`View details for ${char.name}`}
                  >
                    {/* Card Header */}
                    <div className="relative bg-zinc-800/50 p-4 flex flex-col items-center text-center border-b border-zinc-700">
                      {char.isProtagonist && (
                        <span className="absolute top-2 left-2 text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-amber-500/40 bg-amber-600/15 text-amber-400">
                          ★
                        </span>
                      )}
                      <div className="relative mb-3">
                        {char.portraitUrl ? (
                          <img 
                            src={char.portraitUrl} 
                            alt={`${char.name} portrait`}
                            className="w-20 h-20 rounded-full object-cover border-2 border-amber-600/30 shadow-lg"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-zinc-700/50 border-2 border-amber-600/20 flex items-center justify-center text-3xl shadow-lg">
                            {char.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-fantasy font-bold text-amber-400 mb-1 break-words line-clamp-2">{char.name}</h3>
                      {char.currentCultivation && (
                        <p className="text-xs text-zinc-400 mb-2 line-clamp-1">{char.currentCultivation}</p>
                      )}
                      <div className="flex gap-1 flex-wrap justify-center mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${
                          char.status === 'Alive' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' :
                          char.status === 'Deceased' ? 'bg-red-950/40 text-red-400 border-red-900/40' :
                          'bg-zinc-800/40 text-zinc-500 border-zinc-700'
                        }`}>
                          {char.status}
                        </span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      {/* Quick Info */}
                      <div className="space-y-2">
                        {char.age && (
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Age</label>
                            <p className="text-xs text-zinc-300 mt-0.5 line-clamp-1">{char.age}</p>
                          </div>
                        )}
                        {char.personality && (
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Personality</label>
                            <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">{char.personality}</p>
                          </div>
                        )}
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-700">
                        <div className="text-center">
                          <div className="text-sm font-bold text-amber-400">{activeItems}</div>
                          <div className="text-[9px] text-zinc-500 uppercase">Items</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-emerald-400">{activeTechniques}</div>
                          <div className="text-[9px] text-zinc-500 uppercase">Tech</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-red-400">{char.relationships.length}</div>
                          <div className="text-[9px] text-zinc-500 uppercase">Links</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold text-indigo-400">{appearanceCount}</div>
                          <div className="text-[9px] text-zinc-500 uppercase">Chapters</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer - Separate from clickable area */}
                  <div className="px-4 pb-4 pt-2 border-t border-zinc-700 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCharacter(char);
                      }}
                      className="flex-1 text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200"
                      aria-label={`Edit ${char.name}`}
                    >
                      Edit
                    </button>
                    {onDeleteCharacter && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCharacter(char.id);
                        }}
                        className="text-xs text-zinc-400 hover:text-red-500 hover:bg-red-500/10 uppercase font-semibold bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200"
                        aria-label={`Delete ${char.name}`}
                        title="Delete character"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedCharacter && (
        <CharacterDetailPanel
          character={selectedCharacter}
          novel={novel}
          onClose={handleClosePanel}
          onEditCharacter={(char) => {
            handleClosePanel();
            onEditCharacter(char);
          }}
          onSetProtagonist={onSetProtagonist}
          onGeneratePortrait={onGeneratePortrait}
          isGeneratingPortrait={isGeneratingPortrait}
          onUpdateNovel={onUpdateNovel}
          onNavigate={onNavigate}
          onDeleteCharacter={onDeleteCharacter ? (charId) => {
            handleClosePanel();
            onDeleteCharacter(charId);
          } : undefined}
        />
      )}
    </>
  );
};

export const CharactersView = memo(CharactersViewComponent);

// Default export for lazy loading
export default CharactersView;
