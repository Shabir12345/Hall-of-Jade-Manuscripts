/**
 * Character Detail Panel Component
 * Slide-in panel showing full character details
 */

import React, { useMemo, useState } from 'react';
import type { NovelState, Character, CharacterItemPossession, NovelItem, CharacterTechniqueMastery, NovelTechnique, Chapter, Relationship, CharacterSystem } from '../types';
import { archivePossession, restorePossession, archiveMastery, restoreMastery } from '../services/archiveService';
import { RelatedEntities } from './RelatedEntities';
import { textContainsCharacterName } from '../utils/characterNameMatching';
import { RelationshipEditor } from './RelationshipEditor';
import { getRelationshipStrength } from '../services/relationshipService';

interface CharacterDetailPanelProps {
  character: Character | null;
  novel: NovelState;
  onClose: () => void;
  onEditCharacter: (character: Character) => void;
  onSetProtagonist: (characterId: string) => void;
  onGeneratePortrait: (character: Character) => void;
  isGeneratingPortrait: string | null;
  onUpdateNovel?: (updater: (prev: NovelState) => NovelState) => void;
  onNavigate?: () => void;
  onDeleteCharacter?: (characterId: string) => void;
}

export const CharacterDetailPanel: React.FC<CharacterDetailPanelProps> = ({
  character,
  novel,
  onClose,
  onEditCharacter,
  onSetProtagonist,
  onGeneratePortrait,
  isGeneratingPortrait,
  onUpdateNovel,
  onNavigate,
  onDeleteCharacter,
}) => {
  const [editingRelationship, setEditingRelationship] = useState<{
    relationship: Relationship | null;
    targetCharacter: Character | null;
  } | null>(null);
  const [creatingRelationship, setCreatingRelationship] = useState(false);

  // Sync character with latest from novel state to ensure relationships are up-to-date
  const syncedCharacter = useMemo(() => {
    if (!character) return null;
    return novel.characterCodex.find(c => c.id === character.id) || character;
  }, [character, novel.characterCodex]);

  // Use synced character for display
  const displayCharacter = syncedCharacter || character;

  // Calculate character appearance in chapters
  const chapterAppearances = useMemo(() => {
    if (!displayCharacter) return [];
    return novel.chapters.filter(ch => {
      if (ch.content && textContainsCharacterName(ch.content, displayCharacter.name)) return true;
      if (ch.summary && textContainsCharacterName(ch.summary, displayCharacter.name)) return true;
      if (ch.scenes?.some(scene => 
        (scene.content && textContainsCharacterName(scene.content, displayCharacter.name)) ||
        (scene.summary && textContainsCharacterName(scene.summary, displayCharacter.name))
      )) return true;
      return false;
    });
  }, [displayCharacter, novel.chapters]);

  if (!displayCharacter) return null;

  const activePossessions = (displayCharacter.itemPossessions || []).filter(p => p.status === 'active');
  const archivedPossessions = (displayCharacter.itemPossessions || []).filter(p => p.status !== 'active');
  const activeMasteries = (displayCharacter.techniqueMasteries || []).filter(m => m.status === 'active');
  const archivedMasteries = (displayCharacter.techniqueMasteries || []).filter(m => m.status !== 'active');
  
  // Get character systems
  const characterSystems = (novel.characterSystems || []).filter(s => s.characterId === displayCharacter.id);
  const activeSystems = characterSystems.filter(s => s.status === 'active' || s.status === 'upgraded');

  // Group items by category
  const itemsByCategory: Record<string, Array<{ possession: CharacterItemPossession; item: NovelItem }>> = {};
  activePossessions.forEach(poss => {
    const item = novel.novelItems?.find(i => i.id === poss.itemId);
    if (item) {
      if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
      itemsByCategory[item.category].push({ possession: poss, item });
    }
  });

  // Group techniques by category
  const techniquesByCategory: Record<string, Array<{ mastery: CharacterTechniqueMastery; technique: NovelTechnique }>> = {};
  activeMasteries.forEach(mast => {
    const technique = novel.novelTechniques?.find(t => t.id === mast.techniqueId);
    if (technique) {
      if (!techniquesByCategory[technique.category]) techniquesByCategory[technique.category] = [];
      techniquesByCategory[technique.category].push({ mastery: mast, technique });
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div className="relative w-full md:w-[600px] lg:w-[700px] h-full md:h-[90vh] bg-zinc-900 border-l border-zinc-700 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-700 p-4 md:p-6 flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-400">Character Details</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-6">
          {/* Portrait Section */}
          <div className="flex flex-col items-center text-center pb-6 border-b border-zinc-700">
            <div className="relative mb-4">
              {displayCharacter.portraitUrl ? (
                <img 
                  src={displayCharacter.portraitUrl} 
                  alt={`${displayCharacter.name} portrait`}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-amber-600/30 shadow-xl"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-zinc-700/50 border-4 border-amber-600/20 flex items-center justify-center text-4xl md:text-5xl shadow-xl">
                  {displayCharacter.name.charAt(0).toUpperCase()}
                </div>
              )}
              {displayCharacter.isProtagonist && (
                <span className="absolute -top-2 -right-2 bg-amber-600 text-amber-100 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-amber-500/40 shadow-lg">
                  ★ Protagonist
                </span>
              )}
            </div>
            <h3 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-400 mb-2">{displayCharacter.name}</h3>
            {displayCharacter.currentCultivation && (
              <p className="text-sm text-zinc-400 mb-4">{displayCharacter.currentCultivation}</p>
            )}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                onClick={() => onEditCharacter(character)}
                className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200"
              >
                Edit
              </button>
              <button
                onClick={() => onSetProtagonist(character.id)}
                className={`text-xs uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                  character.isProtagonist
                    ? 'border-amber-500/40 bg-amber-600/15 text-amber-400'
                    : 'border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10'
                }`}
              >
                {character.isProtagonist ? '★ Protagonist' : 'Set Protagonist'}
              </button>
              <button
                onClick={() => onGeneratePortrait(character)}
                disabled={isGeneratingPortrait === character.id}
                className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPortrait === character.id ? 'Generating...' : 'Generate Portrait'}
              </button>
              {onDeleteCharacter && (
                <button
                  onClick={() => {
                    onDeleteCharacter(character.id);
                    onClose();
                  }}
                  className="text-xs text-zinc-400 hover:text-red-500 hover:bg-red-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200"
                  title="Delete character"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b border-zinc-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{activePossessions.length}</div>
              <div className="text-xs text-zinc-500 uppercase">Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{activeMasteries.length}</div>
              <div className="text-xs text-zinc-500 uppercase">Techniques</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{displayCharacter.relationships.length}</div>
              <div className="text-xs text-zinc-500 uppercase">Relationships</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">{chapterAppearances.length}</div>
              <div className="text-xs text-zinc-500 uppercase">Chapters</div>
            </div>
            {characterSystems.length > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">{activeSystems.length}</div>
                <div className="text-xs text-zinc-500 uppercase">Systems</div>
              </div>
            )}
          </div>

          {/* Basic Aspects */}
          <div className="space-y-4 pb-6 border-b border-zinc-700">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Basic Aspects</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayCharacter.age && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">Age</label>
                  <p className="text-base text-zinc-300 mt-1">{displayCharacter.age}</p>
                </div>
              )}
              {displayCharacter.personality && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">Personality</label>
                  <p className="text-base text-zinc-300 mt-1">{displayCharacter.personality}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wide">Status</label>
                <p className="text-base text-zinc-300 mt-1">{displayCharacter.status}</p>
              </div>
            </div>
          </div>

          {/* Character Depth */}
          {(displayCharacter.appearance || displayCharacter.background || displayCharacter.goals || displayCharacter.flaws) && (
            <div className="space-y-4 pb-6 border-b border-zinc-700">
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Character Depth</h4>
              {displayCharacter.appearance && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Appearance</label>
                  <p className="text-base text-zinc-300 leading-relaxed">{displayCharacter.appearance}</p>
                </div>
              )}
              {displayCharacter.background && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Background</label>
                  <p className="text-base text-zinc-300 leading-relaxed">{displayCharacter.background}</p>
                </div>
              )}
              {displayCharacter.goals && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Goals</label>
                  <p className="text-base text-zinc-300 leading-relaxed">{displayCharacter.goals}</p>
                </div>
              )}
              {displayCharacter.flaws && (
                <div>
                  <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Flaws</label>
                  <p className="text-base text-zinc-300 leading-relaxed">{displayCharacter.flaws}</p>
                </div>
              )}
            </div>
          )}

          {/* Fate Summary */}
          {displayCharacter.notes && (
            <div className="pb-6 border-b border-zinc-700">
              <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Fate Summary</label>
              <p className="text-base md:text-lg text-zinc-300 leading-relaxed italic border-l-2 border-amber-600/30 pl-6 font-serif-novel">"{displayCharacter.notes}"</p>
            </div>
          )}

          {/* Items Display */}
          <div className="space-y-4 pb-6 border-b border-zinc-700">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span> Items & Possessions
            </h4>
            {Object.keys(itemsByCategory).length === 0 && archivedPossessions.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No items recorded</p>
            ) : (
              <div className="space-y-4">
                {['Treasure', 'Equipment', 'Consumable', 'Essential'].map(category => {
                  const categoryItems = itemsByCategory[category] || [];
                  if (categoryItems.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-2">
                      <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{category}</h5>
                      <div className="flex flex-wrap gap-2">
                        {categoryItems.map(({ possession, item }) => {
                          const currentChapter = novel.chapters.length;
                          return (
                            <div key={possession.id} className="group relative flex items-center gap-1">
                              <span className="text-xs bg-amber-950/40 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-900/40 font-semibold cursor-help">
                                {item.name}
                                {item.powers.length > 0 && (
                                  <span className="ml-1 text-amber-500/60">⚡</span>
                                )}
                              </span>
                              {onUpdateNovel && (
                                <button
                                  onClick={() => {
                                    const updatedPossession = archivePossession(possession, currentChapter);
                                    onUpdateNovel(prev => ({
                                      ...prev,
                                      characterCodex: prev.characterCodex.map(c => 
                                        c.id === character.id 
                                          ? {
                                              ...c,
                                              itemPossessions: (c.itemPossessions || []).map(p => 
                                                p.id === possession.id ? updatedPossession : p
                                              )
                                            }
                                          : c
                                      ),
                                      updatedAt: Date.now()
                                    }));
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-zinc-800"
                                  title="Archive this item"
                                >
                                  📦
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {archivedPossessions.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-400">
                      Archived ({archivedPossessions.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {archivedPossessions.map(poss => {
                        const item = novel.novelItems?.find(i => i.id === poss.itemId);
                        if (!item) return null;
                        return (
                          <div key={poss.id} className="group relative flex items-center gap-1">
                            <span className="text-xs bg-zinc-800/40 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold line-through">
                              {item.name} ({poss.status})
                            </span>
                            {onUpdateNovel && (
                              <button
                                onClick={() => {
                                  const restoredPossession = restorePossession(poss);
                                  onUpdateNovel(prev => ({
                                    ...prev,
                                    characterCodex: prev.characterCodex.map(c => 
                                      c.id === character.id 
                                        ? {
                                            ...c,
                                            itemPossessions: (c.itemPossessions || []).map(p => 
                                              p.id === poss.id ? restoredPossession : p
                                            )
                                          }
                                        : c
                                    ),
                                    updatedAt: Date.now()
                                  }));
                                }}
                                className="text-[10px] text-emerald-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-emerald-950/20"
                                title="Restore this item"
                              >
                                ↻
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Techniques Display */}
          <div className="space-y-4 pb-6 border-b border-zinc-700">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Techniques & Mastery
            </h4>
            {Object.keys(techniquesByCategory).length === 0 && archivedMasteries.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No techniques recorded</p>
            ) : (
              <div className="space-y-4">
                {['Core', 'Important', 'Standard', 'Basic'].map(category => {
                  const categoryTechniques = techniquesByCategory[category] || [];
                  if (categoryTechniques.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-2">
                      <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{category}</h5>
                      <div className="flex flex-wrap gap-2">
                        {categoryTechniques.map(({ mastery, technique }) => {
                          const currentChapter = novel.chapters.length;
                          return (
                            <div key={mastery.id} className="group relative flex items-center gap-1">
                              <span className="text-xs bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/40 font-semibold cursor-help">
                                {technique.name}
                                <span className="ml-1 text-emerald-500/60">({mastery.masteryLevel || 'Novice'})</span>
                                {technique.functions.length > 0 && (
                                  <span className="ml-1 text-emerald-500/60">⚡</span>
                                )}
                              </span>
                              {onUpdateNovel && (
                                <button
                                  onClick={() => {
                                    const updatedMastery = archiveMastery(mastery, currentChapter);
                                    onUpdateNovel(prev => ({
                                      ...prev,
                                      characterCodex: prev.characterCodex.map(c => 
                                        c.id === character.id 
                                          ? {
                                              ...c,
                                              techniqueMasteries: (c.techniqueMasteries || []).map(m => 
                                                m.id === mastery.id ? updatedMastery : m
                                              )
                                            }
                                          : c
                                      ),
                                      updatedAt: Date.now()
                                    }));
                                  }}
                                  className="text-[10px] text-zinc-500 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-zinc-800"
                                  title="Archive this technique"
                                >
                                  📦
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {archivedMasteries.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-400">
                      Archived ({archivedMasteries.length})
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {archivedMasteries.map(mast => {
                        const technique = novel.novelTechniques?.find(t => t.id === mast.techniqueId);
                        if (!technique) return null;
                        return (
                          <div key={mast.id} className="group relative flex items-center gap-1">
                            <span className="text-xs bg-zinc-800/40 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold line-through">
                              {technique.name} ({mast.status})
                            </span>
                            {onUpdateNovel && (
                              <button
                                onClick={() => {
                                  const restoredMastery = restoreMastery(mast);
                                  onUpdateNovel(prev => ({
                                    ...prev,
                                    characterCodex: prev.characterCodex.map(c => 
                                      c.id === character.id 
                                        ? {
                                            ...c,
                                            techniqueMasteries: (c.techniqueMasteries || []).map(m => 
                                              m.id === mast.id ? restoredMastery : m
                                            )
                                          }
                                        : c
                                    ),
                                    updatedAt: Date.now()
                                  }));
                                }}
                                className="text-[10px] text-emerald-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-emerald-950/20"
                                title="Restore this technique"
                              >
                                ↻
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Character Systems Display */}
          {characterSystems.length > 0 && (
            <div className="space-y-4 pb-6 border-b border-zinc-700">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span> Character Systems
              </h4>
              <div className="flex flex-wrap gap-2">
                {characterSystems.map(system => (
                  <div key={system.id} className="group relative">
                    <button
                      onClick={() => onNavigate?.({ type: 'system', systemId: system.id })}
                      className="text-xs bg-purple-950/40 text-purple-400 px-3 py-1.5 rounded-lg border border-purple-900/40 font-semibold cursor-pointer hover:bg-purple-950/60 hover:border-purple-700/60 transition-all"
                      title={`View ${system.name}`}
                    >
                      {system.name}
                      {system.status === 'active' && (
                        <span className="ml-1 text-purple-500/60">●</span>
                      )}
                      {system.status === 'upgraded' && (
                        <span className="ml-1 text-blue-500/60">↑</span>
                      )}
                      {system.features && system.features.length > 0 && (
                        <span className="ml-1 text-purple-500/60">
                          ({system.features.filter(f => f.isActive).length}/{system.features.length})
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {activeSystems.length > 0 && (
                <div className="mt-3 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-400">Active Systems:</span> {activeSystems.map(s => s.name).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Relationships Display */}
          <div className="space-y-4 pb-6 border-b border-zinc-700">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Karma Links (Relationships)
              </h4>
              {character.relationships.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {character.relationships.length} connection{character.relationships.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {character.relationships.length > 0 ? character.relationships.map((rel, idx) => {
                const target = novel.characterCodex.find(c => c.id === rel.characterId);
                const isEnemy = rel.type.toLowerCase().includes('enemy') || rel.type.toLowerCase().includes('rival');
                const isAlly = rel.type.toLowerCase().includes('ally') || rel.type.toLowerCase().includes('friend');
                const isMentor = rel.type.toLowerCase().includes('mentor') || rel.type.toLowerCase().includes('master');
                
                const relationshipStrength = getRelationshipStrength(rel);
                
                return (
                  <div 
                    key={idx} 
                    className={`bg-zinc-800/40 p-4 rounded-xl border flex flex-col transition-all duration-200 hover:bg-zinc-800/60 hover:scale-[1.02] ${
                      isEnemy ? 'border-red-900/40 hover:border-red-700/60' : 
                      isAlly ? 'border-green-900/40 hover:border-green-700/60' :
                      isMentor ? 'border-blue-900/40 hover:border-blue-700/60' :
                      'border-amber-900/40 hover:border-amber-700/60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded-md ${
                          isEnemy ? 'bg-red-600/20 text-red-400' : 
                          isAlly ? 'bg-green-600/20 text-green-400' :
                          isMentor ? 'bg-blue-600/20 text-blue-400' :
                          'bg-amber-600/20 text-amber-400'
                        }`}>
                          {rel.type}
                        </span>
                        {/* Relationship strength indicator */}
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className={`w-1 h-3 rounded ${
                                i <= Math.floor(relationshipStrength / 20)
                                  ? isEnemy ? 'bg-red-500' : isAlly ? 'bg-green-500' : isMentor ? 'bg-blue-500' : 'bg-amber-500'
                                  : 'bg-zinc-700'
                              }`}
                              title={`Relationship strength: ${relationshipStrength}%`}
                            />
                          ))}
                        </div>
                      </div>
                      {target?.currentCultivation && (
                        <span className="text-xs text-zinc-500 font-semibold">
                          {target.currentCultivation.split(' ')[0] || '?'}
                        </span>
                      )}
                    </div>
                    {onNavigate ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (target) {
                            onNavigate();
                          }
                        }}
                        className="text-base md:text-lg font-fantasy font-bold text-zinc-100 mb-2 hover:text-amber-400 transition-colors text-left"
                        title={`View ${target?.name || 'character'}`}
                      >
                        {target?.name || "Unknown Being"}
                      </button>
                    ) : (
                      <div className="text-base md:text-lg font-fantasy font-bold text-zinc-100 mb-2">
                        {target?.name || "Unknown Being"}
                      </div>
                    )}
                    <div className="mt-2 space-y-2">
                      {rel.history && (
                        <p className="text-xs text-zinc-400 leading-relaxed font-serif-novel">
                          <span className="font-bold text-amber-600/60 uppercase mr-1 text-[10px]">History:</span> {rel.history}
                        </p>
                      )}
                      {rel.impact && (
                        <p className="text-xs text-zinc-400 leading-relaxed font-serif-novel italic">
                          <span className="font-bold text-indigo-400/60 uppercase mr-1 text-[10px]">Impact:</span> {rel.impact}
                        </p>
                      )}
                    </div>
                  </div>
                )
              }) : (
                <p className="text-xs text-zinc-500 italic">No significant karma discovered in this world segment...</p>
              )}
            </div>
          </div>

          {/* Chapter Appearances */}
          {chapterAppearances.length > 0 && (
            <div className="space-y-4 pb-6 border-b border-zinc-700">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></span> Chapter Appearances ({chapterAppearances.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {chapterAppearances.map(ch => (
                  <span key={ch.id} className="text-xs bg-indigo-950/40 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-900/40 font-semibold">
                    Chapter {ch.number}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Entities */}
          <div className="pb-6">
            <RelatedEntities
              novelState={novel}
              entityType="character"
              entityId={character.id}
              maxItems={5}
            />
          </div>
        </div>
      </div>

      {/* Relationship Editor */}
      {(creatingRelationship || editingRelationship) && displayCharacter && onUpdateNovel && (
        <RelationshipEditor
          sourceCharacter={displayCharacter}
          targetCharacter={editingRelationship?.targetCharacter || null}
          existingRelationship={editingRelationship?.relationship || null}
          allCharacters={novel.characterCodex}
          isOpen={true}
          onClose={() => {
            setCreatingRelationship(false);
            setEditingRelationship(null);
          }}
          onSave={(updatedCharacters) => {
            onUpdateNovel(prev => ({
              ...prev,
              characterCodex: updatedCharacters,
              updatedAt: Date.now(),
            }));
            setCreatingRelationship(false);
            setEditingRelationship(null);
          }}
        />
      )}
    </div>
  );
};
