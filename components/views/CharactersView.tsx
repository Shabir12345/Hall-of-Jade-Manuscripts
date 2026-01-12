/**
 * Characters View Component
 * Manages the character codex view
 */

import React, { memo } from 'react';
import type { NovelState, Character } from '../../types';

interface CharactersViewProps {
  novel: NovelState;
  onEditCharacter: (character: Character) => void;
  onAddCharacter: () => void;
  onSetProtagonist: (characterId: string) => void;
  onGeneratePortrait: (character: Character) => void;
  isGeneratingPortrait: string | null;
}

export const CharactersView: React.FC<CharactersViewProps> = ({
  novel,
  onEditCharacter,
  onAddCharacter,
  onSetProtagonist,
  onGeneratePortrait,
  isGeneratingPortrait,
}) => {
  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Codex</h2>
        <button 
          onClick={onAddCharacter}
          className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 whitespace-nowrap"
          aria-label="Add new character"
        >
          Add Being
        </button>
      </div>
      {novel.characterCodex.length === 0 ? (
        <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-6xl mb-4">👥</div>
          <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Characters Yet</h3>
          <p className="text-sm text-zinc-500 mb-6">Start building your cast by adding characters to your codex.</p>
          <button
            onClick={onAddCharacter}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
          >
            Add First Character
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:gap-12">
          {novel.characterCodex.map(char => (
            <div key={char.id} className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden flex flex-col md:flex-row group transition-all duration-200 hover:shadow-xl hover:shadow-amber-900/5">
              <div className="w-full md:w-80 bg-zinc-800/50 p-6 md:p-10 flex flex-col items-center justify-center text-center relative border-b md:border-b-0 md:border-r border-zinc-700">
                {char.isProtagonist ? (
                  <span
                    className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-600/15 text-amber-400 shadow-lg"
                    title="This character is the protagonist"
                  >
                    ★ Protagonist
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetProtagonist(char.id)}
                    className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all duration-200 shadow-lg focus-visible:outline-amber-600 focus-visible:outline-2"
                    title="Set as protagonist (main character)"
                    aria-label={`Set ${char.name || 'this character'} as protagonist`}
                  >
                    Set Protagonist
                  </button>
                )}
                <button 
                  onClick={() => onEditCharacter(char)} 
                  className="absolute top-3 right-3 text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 shadow-lg"
                  title="Edit Character"
                  aria-label={`Edit ${char.name}`}
                >
                  Edit
                </button>
                {char.portraitUrl ? (
                  <img 
                    src={char.portraitUrl} 
                    alt={`${char.name} portrait`}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-amber-600/30 mb-4 shadow-xl"
                  />
                ) : (
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-zinc-700/50 border-4 border-amber-600/20 flex items-center justify-center text-4xl md:text-5xl mb-4 shadow-xl">
                    {char.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => onGeneratePortrait(char)}
                  disabled={isGeneratingPortrait === char.id}
                  className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate portrait with AI"
                  aria-label={`Generate portrait for ${char.name}`}
                >
                  {isGeneratingPortrait === char.id ? 'Generating...' : 'Generate Portrait'}
                </button>
                <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-400 mt-4 break-words">{char.name}</h3>
                {char.currentCultivation && (
                  <p className="text-sm text-zinc-400 mt-2">{char.currentCultivation}</p>
                )}
              </div>
              <div className="flex-1 p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {char.age && (
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-wide">Age</label>
                      <p className="text-base text-zinc-300 mt-1">{char.age}</p>
                    </div>
                  )}
                  {char.personality && (
                    <div>
                      <label className="text-xs text-zinc-500 uppercase tracking-wide">Personality</label>
                      <p className="text-base text-zinc-300 mt-1">{char.personality}</p>
                    </div>
                  )}
                </div>
                {char.notes && (
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Fate Summary</label>
                    <p className="text-base md:text-lg text-zinc-300 leading-relaxed italic border-l-2 border-amber-600/30 pl-6 font-serif-novel">"{char.notes}"</p>
                  </div>
                )}
                {/* Character items, techniques, and relationships would go here */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CharactersView = memo(CharactersViewComponent);
