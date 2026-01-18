/**
 * World Bible View Component
 * Manages the world knowledge/bible view
 */

import React, { memo } from 'react';
import type { NovelState, WorldEntry } from '../../types';
import { SkeletonCard } from '../Skeleton';

interface WorldBibleViewProps {
  novel: NovelState;
  onEditEntry: (entry: WorldEntry) => void;
  onAddEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  isLoading?: boolean;
}

const WorldBibleViewComponent: React.FC<WorldBibleViewProps> = ({
  novel,
  onEditEntry,
  onAddEntry,
  onDeleteEntry,
  isLoading = false,
}) => {
  const categories: WorldEntry['category'][] = ['Geography', 'Sects', 'PowerLevels', 'Systems', 'Techniques', 'Laws', 'Other'];
  const currentRealm = novel.realms.find(r => r.id === novel.currentRealmId);

  if (isLoading) {
    return (
      <div className="p-4 md:p-5 lg:p-6 max-w-4xl mx-auto pt-12 md:pt-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 border-b border-zinc-700 pb-4">
          <div className="h-8 w-48 bg-zinc-800/50 rounded animate-pulse" />
          <div className="h-10 w-32 bg-zinc-800/50 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} lines={3} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">World Bible</h2>
        {currentRealm && (
          <button 
            onClick={onAddEntry}
            className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 whitespace-nowrap"
            aria-label="Add new world entry"
          >
            Add Entry
          </button>
        )}
      </div>

      {!currentRealm ? (
        <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">🌍</div>
          <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Current Realm</h3>
          <p className="text-sm text-zinc-500 mb-6">Select or create a realm to start building your world knowledge.</p>
        </div>
      ) : novel.worldBible.filter(e => e.realmId === novel.currentRealmId).length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">📚</div>
          <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No World Knowledge Yet</h3>
          <p className="text-sm text-zinc-500 mb-6">Start building your world by adding knowledge entries about geography, sects, power levels, and more.</p>
          <button
            onClick={onAddEntry}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div className="space-y-12 md:space-y-16">
          {categories.map(cat => {
            const entries = novel.worldBible.filter(e => e.category === cat && e.realmId === novel.currentRealmId);
            if (entries.length === 0) return null;
            return (
              <div key={cat} className="space-y-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider border-l-4 border-amber-600 pl-4">{cat}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {entries.map(entry => (
                    <div key={entry.id} className="bg-zinc-900 border border-zinc-700 p-4 md:p-5 rounded-2xl relative group hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-200">
                      <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
                        <button 
                          onClick={() => onEditEntry(entry)} 
                          className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 shadow-lg"
                          title="Edit World Entry"
                          aria-label={`Edit ${entry.title}`}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => onDeleteEntry(entry.id)} 
                          className="text-xs text-zinc-400 hover:text-red-500 hover:bg-red-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200 focus-visible:outline-red-600 focus-visible:outline-2 shadow-lg"
                          title="Delete World Entry"
                          aria-label={`Delete ${entry.title}`}
                        >
                          Delete
                        </button>
                      </div>
                      <h4 className="font-fantasy text-lg md:text-xl font-bold text-zinc-200 mb-4 pr-28 break-words">{entry.title}</h4>
                      <p className="text-sm md:text-base text-zinc-400 leading-relaxed font-serif-novel">{entry.content}</p>
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
