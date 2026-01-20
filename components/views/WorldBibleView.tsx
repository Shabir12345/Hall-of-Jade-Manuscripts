/**
 * World Bible View Component
 * Manages the world knowledge/bible view
 */

import React, { memo, useState } from 'react';
import type { NovelState, WorldEntry } from '../../types';
import type { GlobalMarketState } from '../../types/market';
import { SkeletonCard } from '../Skeleton';
import { MarketPanel } from '../MarketPanel';

interface WorldBibleViewProps {
  novel: NovelState;
  onEditEntry: (entry: WorldEntry) => void;
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  onUpdateMarketState?: (state: GlobalMarketState) => void;
  isLoading?: boolean;
}

const WorldBibleViewComponent: React.FC<WorldBibleViewProps> = ({
  novel,
  onEditEntry,
  onAddEntry,
  onDeleteEntry,
  onUpdateMarketState,
  isLoading = false,
}) => {
  const categories: WorldEntry['category'][] = ['Geography', 'Sects', 'PowerLevels', 'Systems', 'Techniques', 'Laws', 'Other'];
  const currentRealm = novel.realms.find(r => r.id === novel.currentRealmId);
  const [showEconomy, setShowEconomy] = useState(false);

  if (isLoading) {
    return (
      <div 
        className="p-3 xs:p-4 md:p-5 lg:p-6 max-w-4xl mx-auto"
        style={{ paddingTop: 'max(3rem, calc(env(safe-area-inset-top, 1rem) + 2.5rem))' }}
      >
        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3 xs:gap-4 mb-4 xs:mb-6 md:mb-8 border-b border-zinc-700 pb-3 xs:pb-4">
          <div className="h-7 xs:h-8 w-40 xs:w-48 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-9 xs:h-10 w-28 xs:w-32 bg-zinc-800/50 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xs:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="p-3 xs:p-4 md:p-8 lg:p-12 max-w-5xl mx-auto"
      style={{ paddingTop: 'max(4rem, calc(env(safe-area-inset-top, 1rem) + 3.5rem))' }}
    >
      {/* Header - stacks on mobile */}
      <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-3 mb-5 xs:mb-8 md:mb-12 border-b border-zinc-700 pb-4 xs:pb-6">
        <h2 className="text-xl xs:text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">World Bible</h2>
        <div className="flex items-center gap-2 w-full xs:w-auto">
          {/* Economy Toggle Button */}
          <button
            onClick={() => setShowEconomy(!showEconomy)}
            className={`px-3 xs:px-4 py-2 xs:py-2.5 rounded-lg xs:rounded-xl font-semibold text-xs xs:text-sm transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
              showEconomy
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'
            }`}
            aria-label="Toggle Economy Panel"
          >
            <span>💰</span>
            <span className="hidden xs:inline">Economy</span>
            {novel.globalMarketState && novel.globalMarketState.standardItems.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                showEconomy ? 'bg-emerald-600/30' : 'bg-zinc-700'
              }`}>
                {novel.globalMarketState.standardItems.length}
              </span>
            )}
          </button>
          {currentRealm && (
            <button 
              onClick={onAddEntry}
              className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 px-4 xs:px-6 py-2 xs:py-2.5 rounded-lg xs:rounded-xl font-semibold text-xs xs:text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 active:scale-100 whitespace-nowrap flex-1 xs:flex-initial text-center"
              aria-label="Add new world entry"
            >
              + Add Entry
            </button>
          )}
        </div>
      </div>

      {/* Economy Panel - Collapsible */}
      {showEconomy && onUpdateMarketState && (
        <div className="mb-6 xs:mb-8 md:mb-12 bg-zinc-900/50 border border-emerald-900/30 rounded-xl xs:rounded-2xl p-4 xs:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h3 className="text-sm xs:text-base font-bold text-emerald-400">Spirit Stone Market</h3>
            </div>
            <p className="text-[10px] xs:text-xs text-zinc-500 hidden sm:block">
              Track item prices for economic consistency across chapters
            </p>
          </div>
          <MarketPanel
            marketState={novel.globalMarketState}
            onUpdateMarketState={onUpdateMarketState}
            currentChapter={novel.chapters.length}
          />
        </div>
      )}

      {!currentRealm ? (
        <div className="py-10 xs:py-16 px-4 xs:px-8 text-center border-2 border-dashed border-zinc-700 rounded-xl xs:rounded-2xl bg-zinc-900/30">
          <div className="text-3xl xs:text-4xl mb-3">🌍</div>
          <h3 className="text-lg xs:text-xl font-fantasy font-bold text-zinc-300 mb-2">No Current Realm</h3>
          <p className="text-xs xs:text-sm text-zinc-500 mb-6">Select or create a realm to start building your world knowledge.</p>
        </div>
      ) : novel.worldBible.filter(e => e.realmId === novel.currentRealmId).length === 0 ? (
        <div className="py-8 xs:py-12 px-4 xs:px-6 text-center border-2 border-dashed border-zinc-700 rounded-xl xs:rounded-2xl bg-zinc-900/30">
          <div className="text-3xl xs:text-4xl mb-3">📚</div>
          <h3 className="text-base xs:text-lg font-fantasy font-bold text-zinc-300 mb-2">No World Knowledge Yet</h3>
          <p className="text-xs xs:text-sm text-zinc-500 mb-4 xs:mb-6">Start building your world by adding knowledge entries about geography, sects, power levels, and more.</p>
          <button
            onClick={onAddEntry}
            className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white px-4 py-2.5 rounded-lg xs:rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 active:scale-[0.98]"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-8 xs:space-y-12 md:space-y-16">
          {categories.map(cat => {
            const entries = novel.worldBible.filter(e => e.category === cat && e.realmId === novel.currentRealmId);
            if (entries.length === 0) return null;
            return (
              <div key={cat} className="space-y-4 xs:space-y-6">
                <h3 className="text-xs xs:text-sm font-bold text-zinc-400 uppercase tracking-wider border-l-4 border-amber-600 pl-3 xs:pl-4">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4 md:gap-6">
                  {entries.map(entry => (
                    <div key={entry.id} className="bg-zinc-900 border border-zinc-700 p-3 xs:p-4 md:p-5 rounded-xl xs:rounded-2xl relative group hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-200">
                      {/* Action buttons - repositioned for mobile */}
                      <div className="absolute top-2 xs:top-3 right-2 xs:right-3 flex items-center space-x-1.5 xs:space-x-2 z-10">
                        <button 
                          onClick={() => onEditEntry(entry)} 
                          className="text-[10px] xs:text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 active:bg-amber-500/20 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-2 xs:px-3 py-1 xs:py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 shadow-lg"
                          title="Edit World Entry"
                          aria-label={`Edit ${entry.title}`}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => onDeleteEntry(entry.id)} 
                          className="text-[10px] xs:text-xs text-zinc-400 hover:text-red-500 hover:bg-red-500/10 active:bg-red-500/20 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-2 xs:px-3 py-1 xs:py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200 shadow-lg"
                          title="Delete World Entry"
                          aria-label={`Delete ${entry.title}`}
                        >
                          Delete
                        </button>
                      </div>
                      <h4 className="font-fantasy text-base xs:text-lg md:text-xl font-bold text-zinc-200 mb-2 xs:mb-3 md:mb-4 pr-20 xs:pr-28 break-words">{entry.title}</h4>
                      <p className="text-xs xs:text-sm md:text-base text-zinc-400 leading-relaxed font-serif-novel line-clamp-4 xs:line-clamp-none">{entry.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const WorldBibleView = memo(WorldBibleViewComponent);
