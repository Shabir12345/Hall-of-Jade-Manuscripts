import React, { useMemo } from 'react';
import { NovelState, Chapter, Character, Arc, Antagonist, ViewType } from '../types';
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
 * Displays related entities (chapters, characters, arcs, antagonists, etc.) for a given entity.
 * Useful for showing cross-references and improving navigation.
 */
export const RelatedEntities: React.FC<RelatedEntitiesProps> = ({
  novelState,
  entityType,
  entityId,
  maxItems = 5,
}) => {
  const { navigate } = useNavigation();

  // Get related chapters for character, arc, or antagonist
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
    } else if (entityType === 'arc') {
      const arc = novelState.plotLedger.find(a => a.id === entityId);
      if (!arc) return [];

      // Get chapters in arc range
      return novelState.chapters
        .filter(chapter => {
          if (arc.startedAtChapter && chapter.number >= arc.startedAtChapter) {
            if (arc.endedAtChapter) {
              return chapter.number <= arc.endedAtChapter;
            }
            return true;
          }
          return false;
        })
        .slice(0, maxItems)
        .sort((a, b) => a.number - b.number);
    } else if (entityType === 'antagonist') {
      const antagonist = novelState.antagonists?.find(a => a.id === entityId);
      if (!antagonist) return [];

      // Get chapters where antagonist appeared
      return novelState.chapters
        .filter(chapter => {
          if (antagonist.firstAppearedChapter && antagonist.lastAppearedChapter) {
            return chapter.number >= antagonist.firstAppearedChapter &&
                   chapter.number <= antagonist.lastAppearedChapter;
          } else if (antagonist.firstAppearedChapter) {
            return chapter.number >= antagonist.firstAppearedChapter;
          }
          return false;
        })
        .slice(0, maxItems)
        .sort((a, b) => a.number - b.number);
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  // Get related characters for chapter, arc, or antagonist
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
    } else if (entityType === 'arc') {
      const arc = novelState.plotLedger.find(a => a.id === entityId);
      if (!arc) return [];

      // Find characters that appear in arc chapters
      const arcChapters = novelState.chapters.filter(chapter => {
        if (arc.startedAtChapter && chapter.number >= arc.startedAtChapter) {
          if (arc.endedAtChapter) {
            return chapter.number <= arc.endedAtChapter;
          }
          return true;
        }
        return false;
      });

      const mentionedCharacters = new Set<string>();
      arcChapters.forEach(chapter => {
        const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
        novelState.characterCodex.forEach(char => {
          if (textContainsCharacterName(content, char.name)) {
            mentionedCharacters.add(char.id);
          }
        });
      });

      return Array.from(mentionedCharacters)
        .map(id => novelState.characterCodex.find(c => c.id === id))
        .filter((c): c is Character => c !== undefined)
        .slice(0, maxItems);
    } else if (entityType === 'antagonist') {
      const antagonist = novelState.antagonists?.find(a => a.id === entityId);
      if (!antagonist) return [];

      // Get characters from antagonist relationships
      const relatedCharIds = new Set<string>();
      if (antagonist.relationships) {
        antagonist.relationships.forEach(rel => {
          relatedCharIds.add(rel.characterId);
        });
      }

      return Array.from(relatedCharIds)
        .map(id => novelState.characterCodex.find(c => c.id === id))
        .filter((c): c is Character => c !== undefined)
        .slice(0, maxItems);
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  // Get related arcs for chapter, character, or antagonist
  const relatedArcs = useMemo(() => {
    if (entityType === 'chapter') {
      const chapter = novelState.chapters.find(c => c.id === entityId);
      if (!chapter) return [];

      // Find arcs that include this chapter
      return novelState.plotLedger
        .filter(arc => {
          if (arc.startedAtChapter && chapter.number >= arc.startedAtChapter) {
            if (arc.endedAtChapter) {
              return chapter.number <= arc.endedAtChapter;
            }
            return true;
          }
          return false;
        })
        .slice(0, maxItems);
    } else if (entityType === 'character') {
      const character = novelState.characterCodex.find(c => c.id === entityId);
      if (!character) return [];

      // Find arcs where character appears
      const characterChapters = novelState.chapters.filter(chapter => {
        const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
        return textContainsCharacterName(content, character.name);
      });

      const arcIds = new Set<string>();
      characterChapters.forEach(chapter => {
        novelState.plotLedger.forEach(arc => {
          if (arc.startedAtChapter && chapter.number >= arc.startedAtChapter) {
            if (!arc.endedAtChapter || chapter.number <= arc.endedAtChapter) {
              arcIds.add(arc.id);
            }
          }
        });
      });

      return Array.from(arcIds)
        .map(id => novelState.plotLedger.find(a => a.id === id))
        .filter((a): a is Arc => a !== undefined)
        .slice(0, maxItems);
    } else if (entityType === 'antagonist') {
      const antagonist = novelState.antagonists?.find(a => a.id === entityId);
      if (!antagonist) return [];

      // Get arcs from antagonist arc associations
      if (antagonist.arcAssociations) {
        return antagonist.arcAssociations
          .map(assoc => novelState.plotLedger.find(a => a.id === assoc.arcId))
          .filter((a): a is Arc => a !== undefined)
          .slice(0, maxItems);
      }
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  // Get related antagonists for chapter, character, or arc
  const relatedAntagonists = useMemo(() => {
    if (!novelState.antagonists) return [];

    if (entityType === 'chapter') {
      const chapter = novelState.chapters.find(c => c.id === entityId);
      if (!chapter) return [];

      // Find antagonists that appeared in this chapter
      return novelState.antagonists
        .filter(ant => {
          if (ant.firstAppearedChapter && ant.lastAppearedChapter) {
            return chapter.number >= ant.firstAppearedChapter &&
                   chapter.number <= ant.lastAppearedChapter;
          } else if (ant.firstAppearedChapter) {
            return chapter.number >= ant.firstAppearedChapter;
          }
          return false;
        })
        .slice(0, maxItems);
    } else if (entityType === 'character') {
      const character = novelState.characterCodex.find(c => c.id === entityId);
      if (!character) return [];

      // Find antagonists with relationships to this character
      return novelState.antagonists
        .filter(ant => 
          ant.relationships?.some(rel => rel.characterId === character.id)
        )
        .slice(0, maxItems);
    } else if (entityType === 'arc') {
      const arc = novelState.plotLedger.find(a => a.id === entityId);
      if (!arc) return [];

      // Get antagonists from arc associations
      return novelState.antagonists
        .filter(ant => 
          ant.arcAssociations?.some(assoc => assoc.arcId === arc.id)
        )
        .slice(0, maxItems);
    }
    return [];
  }, [novelState, entityType, entityId, maxItems]);

  // Build sections array for all related entities
  const sections = useMemo(() => {
    const sections: Array<{
      title: string;
      icon: string;
      color: string;
      items: Array<{ id: string; label: string; type: 'chapter' | 'character' | 'arc' | 'antagonist' }>;
      viewType?: ViewType;
    }> = [];

    if (relatedChapters.length > 0) {
      sections.push({
        title: 'Related Chapters',
        icon: '📖',
        color: 'amber',
        items: relatedChapters.map(ch => ({
          id: ch.id,
          label: `Ch ${ch.number}`,
          type: 'chapter' as const,
        })),
        viewType: 'chapters' as ViewType,
      });
    }

    if (relatedCharacters.length > 0) {
      sections.push({
        title: 'Related Characters',
        icon: '👥',
        color: 'emerald',
        items: relatedCharacters.map(ch => ({
          id: ch.id,
          label: ch.name,
          type: 'character' as const,
        })),
        viewType: 'characters' as ViewType,
      });
    }

    if (relatedArcs.length > 0) {
      sections.push({
        title: 'Related Arcs',
        icon: '🗺️',
        color: 'blue',
        items: relatedArcs.map(arc => ({
          id: arc.id,
          label: arc.title,
          type: 'arc' as const,
        })),
        viewType: 'planning' as ViewType,
      });
    }

    if (relatedAntagonists.length > 0) {
      sections.push({
        title: 'Related Antagonists',
        icon: '⚔️',
        color: 'red',
        items: relatedAntagonists.map(ant => ({
          id: ant.id,
          label: ant.name,
          type: 'antagonist' as const,
        })),
        viewType: 'antagonists' as ViewType,
      });
    }

    return sections;
  }, [relatedChapters, relatedCharacters, relatedArcs, relatedAntagonists]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-6 border-t border-zinc-700 space-y-6">
      {sections.map((section, idx) => {
        const colorClasses = {
          amber: 'bg-amber-950/40 text-amber-400 border-amber-900/40 hover:bg-amber-950/60',
          emerald: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 hover:bg-emerald-950/60',
          blue: 'bg-blue-950/40 text-blue-400 border-blue-900/40 hover:bg-blue-950/60',
          red: 'bg-red-950/40 text-red-400 border-red-900/40 hover:bg-red-950/60',
        };

        const dotColors = {
          amber: 'bg-amber-500',
          emerald: 'bg-emerald-500',
          blue: 'bg-blue-500',
          red: 'bg-red-500',
        };

        return (
          <div key={idx}>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
              <span className={`w-2 h-2 rounded-full ${dotColors[section.color as keyof typeof dotColors]} mr-2`}></span>
              <span className="mr-2">{section.icon}</span>
              {section.title}
            </h4>
            <div className="flex flex-wrap gap-2">
              {section.items.map(item => (
                <EntityLink
                  key={item.id}
                  type={item.type}
                  id={item.id}
                  className={`text-xs ${colorClasses[section.color as keyof typeof colorClasses]} px-3 py-1.5 rounded-lg border font-semibold`}
                >
                  {item.label}
                </EntityLink>
              ))}
              {section.items.length >= maxItems && section.viewType && (
                <button
                  onClick={() => navigate({ type: 'view', view: section.viewType! })}
                  className="text-xs bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                >
                  View All →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
