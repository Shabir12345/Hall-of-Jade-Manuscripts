import React, { useMemo } from 'react';
import { NovelState, Chapter, Character } from '../types';
import { useNavigation } from '../contexts/NavigationContext';
import { textContainsCharacterName } from '../utils/characterNameMatching';
import { EntityLink } from './EntityLink';

interface RelatedEntitiesProps {
  novelState: NovelState;
  entityType: 'character' | 'chapter' | 'arc' | 'antagonist';
  entityId: string;
  maxItems?: number;
}

/**
 * Displays related entities (chapters, characters, etc.) for a given entity.
 * Useful for showing cross-references and improving navigation.
 */
export const RelatedEntities: React.FC<RelatedEntitiesProps> = ({
  novelState,
  entityType,
  entityId,
  maxItems = 5,
}) => {
  const { navigate } = useNavigation();

  const relatedChapters = useMemo(() => {
    if (entityType === 'character') {
      const character = novelState.characterCodex.find(c => c.id === entityId);
      if (!character) return [];

      return novelState.chapters
        .filter(chapter => {
          // Check if character appears in chapter
          if (chapter.content && textContainsCharacterName(chapter.content, character.name)) {
            return true;
          }
          if (chapter.summary && textContainsCharacterName(chapter.summary, character.name)) {
            return true;
          }
          // Check scenes
          if (chapter.scenes?.some(scene => 
            (scene.content && textContainsCharacterName(scene.content, character.name)) ||
            (scene.summary && textContainsCharacterName(scene.summary, character.name))
          )) {
            return true;
          }
          return false;
        })
        .slice(0, maxItems)
        .sort((a, b) => a.number - b.number);
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  const relatedCharacters = useMemo(() => {
    if (entityType === 'chapter') {
      const chapter = novelState.chapters.find(c => c.id === entityId);
      if (!chapter) return [];

      const mentionedCharacters = new Set<string>();
      const content = (chapter.content + ' ' + chapter.summary).toLowerCase();

      novelState.characterCodex.forEach(char => {
        if (textContainsCharacterName(content, char.name)) {
          mentionedCharacters.add(char.id);
        }
      });

      return Array.from(mentionedCharacters)
        .map(id => novelState.characterCodex.find(c => c.id === id))
        .filter((c): c is Character => c !== undefined)
        .slice(0, maxItems);
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  if (entityType === 'character' && relatedChapters.length > 0) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-700">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
          Appears In Chapters
        </h4>
        <div className="flex flex-wrap gap-2">
          {relatedChapters.map(chapter => (
            <EntityLink
              key={chapter.id}
              type="chapter"
              id={chapter.id}
              className="text-xs bg-amber-950/40 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-900/40 font-semibold hover:bg-amber-950/60"
            >
              Ch {chapter.number}
            </EntityLink>
          ))}
          {relatedChapters.length >= maxItems && (
            <button
              onClick={() => navigate({ type: 'view', view: 'chapters' })}
              className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              View All →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (entityType === 'chapter' && relatedCharacters.length > 0) {
    return (
      <div className="mt-6 pt-6 border-t border-zinc-700">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
          Characters Mentioned
        </h4>
        <div className="flex flex-wrap gap-2">
          {relatedCharacters.map(character => (
            <EntityLink
              key={character.id}
              type="character"
              id={character.id}
              className="text-xs bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/40 font-semibold hover:bg-emerald-950/60"
            >
              {character.name}
            </EntityLink>
          ))}
          {relatedCharacters.length >= maxItems && (
            <button
              onClick={() => navigate({ type: 'view', view: 'characters' })}
              className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              View All →
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};
