import { useCallback, useMemo } from 'react';
import type { 
  NovelState, 
  Chapter, 
  Character, 
  WorldEntry, 
  Territory, 
  SystemLog, 
  ItemCategory, 
  TechniqueCategory, 
  TechniqueType,
  CharacterItemPossession,
  CharacterTechniqueMastery,
  Scene,
  Arc,
  Realm,
} from '../types';
import { extractPostChapterUpdates } from '../services/aiService';
import { findOrCreateItem, findOrCreateTechnique } from '../services/itemTechniqueService';
import { generateUUID } from '../utils/uuid';

/**
 * Custom hook for processing chapter updates (character, world, items, techniques)
 * Extracted from App.tsx to improve code organization
 */
export function useChapterProcessing() {
  /**
   * Normalize string for comparison (lowercase, trim)
   */
  const normalize = useCallback((s: string) => (s || '').trim().toLowerCase(), []);

  /**
   * Merge append helper for notes/history
   */
  const mergeAppend = useCallback((existing: string, incoming: string, chapterNum: number) => {
    const cur = (existing || '').trim();
    const inc = (incoming || '').trim();
    if (!inc) return cur;
    if (!cur) return inc;
    // Avoid repeated appends
    if (normalize(cur).includes(normalize(inc))) return cur;
    return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc}`;
  }, [normalize]);

  /**
   * Coerce world category to valid type
   */
  const coerceWorldCategory = useCallback((category: any): WorldEntry['category'] => {
    const c = String(category || '').trim();
    const allowed: WorldEntry['category'][] = [
      'Geography',
      'Sects',
      'PowerLevels',
      'Laws',
      'Systems',
      'Techniques',
      'Other',
    ];
    return (allowed as string[]).includes(c) ? (c as WorldEntry['category']) : 'Other';
  }, []);

  /**
   * Coerce territory type to valid type
   */
  const coerceTerritoryType = useCallback((type: string): Territory['type'] => {
    const t = String(type || '').trim();
    const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
    return (allowed as string[]).includes(t) ? (t as Territory['type']) : 'Neutral';
  }, []);

  /**
   * Coerce character status to valid type
   */
  const coerceCharStatus = useCallback((status: any): Character['status'] | undefined => {
    const s = String(status || '').trim();
    const allowed: Character['status'][] = ['Alive', 'Deceased', 'Unknown'];
    return (allowed as string[]).includes(s) ? (s as any) : undefined;
  }, []);

  /**
   * Process post-chapter extraction updates
   */
  const processPostChapterUpdates = useCallback(async (
    novel: NovelState,
    newChapter: Chapter,
    activeArc: any,
    addLog: (msg: string, type: SystemLog['type']) => void
  ): Promise<NovelState> => {
    let workingNovelState = novel;

    // Extract updates from chapter
    const extraction = await extractPostChapterUpdates(novel, newChapter, activeArc);

    // Process character upserts
    const mergedCharacters = [...novel.characterCodex];
    extraction.characterUpserts?.forEach((u: any) => {
      const name = String(u?.name || '').trim();
      if (!name) return;
      const idx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(name));

      if (idx > -1) {
        const char = { ...mergedCharacters[idx] };
        const set = u?.set || {};
        
        if (typeof set.age === 'string' && set.age.trim()) char.age = set.age;
        if (typeof set.personality === 'string' && set.personality.trim()) char.personality = set.personality;
        if (typeof set.currentCultivation === 'string' && set.currentCultivation.trim()) {
          char.currentCultivation = set.currentCultivation;
        }
        if (typeof set.notes === 'string' && set.notes.trim()) {
          char.notes = mergeAppend(char.notes || '', set.notes, newChapter.number);
        }
        
        const status = coerceCharStatus(set.status);
        if (status) char.status = status;

        const addSkills: string[] = Array.isArray(u?.addSkills) ? u.addSkills : [];
        const addItems: string[] = Array.isArray(u?.addItems) ? u.addItems : [];
        if (addSkills.length) {
          char.skills = [...new Set([...(char.skills || []), ...addSkills.filter((s: any) => String(s).trim())])];
        }
        if (addItems.length) {
          char.items = [...new Set([...(char.items || []), ...addItems.filter((s: any) => String(s).trim())])];
        }

        mergedCharacters[idx] = char;
      } else if (u?.name) {
        // New character
        const newChar: Character = {
          id: generateUUID(),
          name: String(u.name),
          age: String(u?.set?.age || 'Unknown'),
          personality: String(u?.set?.personality || 'Unknown'),
          currentCultivation: String(u?.set?.currentCultivation || 'Unknown'),
          skills: Array.isArray(u?.addSkills) ? u.addSkills.filter((s: any) => String(s).trim()) : [],
          items: Array.isArray(u?.addItems) ? u.addItems.filter((s: any) => String(s).trim()) : [],
          notes: String(u?.set?.notes || ''),
          status: coerceCharStatus(u?.set?.status) || 'Alive',
          relationships: [],
        };
        mergedCharacters.push(newChar);
        addLog(`New character discovered: ${newChar.name}`, 'discovery');
      }
    });

    // Process world updates (including realm creation)
    const worldBible = [...novel.worldBible];
    const realms = [...novel.realms];
    let newRealmId = novel.currentRealmId;

    // Handle realm creation first (if any)
    extraction.worldEntryUpserts?.forEach((w: any) => {
      // Check if this is a new realm
      if (w.isNewRealm && w.title) {
        try {
          const realmName = String(w.title || '').trim();
          const realmDescription = String(w.content || '').trim();
          
          // Check if realm already exists
          const existingRealm = realms.find(r => 
            normalize(r.name) === normalize(realmName)
          );
          
          if (!existingRealm && realmName) {
            // Archive all existing realms
            realms.forEach(r => { r.status = 'archived'; });
            
            // Create new realm
            const newRealm: Realm = {
              id: generateUUID(),
              name: realmName,
              description: realmDescription,
              status: 'current',
            };
            realms.push(newRealm);
            newRealmId = newRealm.id;
            addLog(`Realm ascended: Welcome to ${realmName}!`, 'discovery');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error processing realm creation:', errorMessage);
          addLog(`Failed to process realm creation: ${errorMessage}`, 'update');
        }
        return; // Skip world entry processing for realm creation
      }
      try {
        // Validate required fields
        if (!w || typeof w !== 'object') {
          console.warn('Skipping invalid world entry update');
          return;
        }
        
        const title = String(w.title || '').trim();
        const content = String(w.content || '').trim();
        
        if (title && content && newRealmId) {
          // Check for duplicates before adding
          const existing = worldBible.find(entry => 
            entry.title.toLowerCase() === title.toLowerCase() && 
            entry.realmId === newRealmId
          );
          
          if (!existing) {
            worldBible.push({
              id: generateUUID(),
              realmId: newRealmId,
              category: coerceWorldCategory(w.category),
              title,
              content,
            });
            addLog(`Lore entry: ${title}`, 'discovery');
          } else {
            // Update existing entry if new content is longer
            if (content.length > (existing.content?.length || 0)) {
              existing.content = content;
              existing.category = coerceWorldCategory(w.category);
              addLog(`Lore entry updated: ${title}`, 'update');
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing world entry:', errorMessage);
        addLog(`Failed to process world entry: ${errorMessage}`, 'update');
      }
    });

    // Process territory updates
    const territories = [...novel.territories];
    extraction.territoryUpserts?.forEach((t: any) => {
      try {
        // Validate required fields
        if (!t || typeof t !== 'object') {
          console.warn('Skipping invalid territory update');
          return;
        }
        
        const name = String(t.name || '').trim();
        const description = String(t.description || '').trim();
        
        if (name && newRealmId) {
          // Check for duplicates before adding
          const existing = territories.find(territory => 
            territory.name.toLowerCase() === name.toLowerCase() && 
            territory.realmId === newRealmId
          );
          
          if (!existing) {
            territories.push({
              id: generateUUID(),
              realmId: newRealmId,
              name,
              type: coerceTerritoryType(t.type),
              description,
            });
            addLog(`Territory discovered: ${name}`, 'discovery');
          } else {
            // Update existing territory if new description is longer
            if (description.length > (existing.description?.length || 0)) {
              existing.description = description;
              existing.type = coerceTerritoryType(t.type);
              addLog(`Territory updated: ${name}`, 'update');
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing territory:', errorMessage);
        addLog(`Failed to process territory: ${errorMessage}`, 'update');
      }
    });

    // Process items and techniques
    const items = [...(novel.novelItems || [])];
    const techniques = [...(novel.novelTechniques || [])];
    
    // Track character-item and character-technique relationships
    const allCharacterItemPossessions: CharacterItemPossession[] = [];
    const allCharacterTechniqueMasteries: CharacterTechniqueMastery[] = [];

    if (extraction.itemUpdates && Array.isArray(extraction.itemUpdates)) {
      for (const itemUpdate of extraction.itemUpdates) {
        try {
          // Validate required fields before processing
          if (!itemUpdate.name || typeof itemUpdate.name !== 'string' || itemUpdate.name.trim() === '') {
            console.warn('Skipping item update: missing or invalid name');
            continue;
          }
          
          if (itemUpdate.action === 'create' || itemUpdate.action === 'update') {
            // Validate and coerce category
            const category = coerceItemCategory(itemUpdate.category);
            
            const result = findOrCreateItem(
              itemUpdate.name.trim(),
              items,
              novel.id,
              category,
              newChapter.number,
              itemUpdate.description,
              itemUpdate.addPowers
            );
            
            // Update or add item
            const existingIndex = items.findIndex(i => i.id === result.item.id);
            if (existingIndex >= 0) {
              items[existingIndex] = result.item;
            } else {
              items.push(result.item);
            }
            
            // Link item to character if characterName is provided
            if (itemUpdate.characterName) {
              const character = findCharacterByName(mergedCharacters, itemUpdate.characterName);
              if (character) {
                // Check if relationship already exists
                const existingPossession = allCharacterItemPossessions.find(
                  p => p.characterId === character.id && p.itemId === result.item.id
                );
                
                if (!existingPossession) {
                  const possession: CharacterItemPossession = {
                    id: generateUUID(),
                    characterId: character.id,
                    itemId: result.item.id,
                    status: 'active',
                    acquiredChapter: newChapter.number,
                    notes: result.wasCreated ? 'Acquired from chapter generation' : 'Updated from chapter generation',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  allCharacterItemPossessions.push(possession);
                  
                  // Also update character's itemPossessions array
                  if (!character.itemPossessions) {
                    character.itemPossessions = [];
                  }
                  character.itemPossessions.push(possession);
                } else {
                  // Update existing possession
                  existingPossession.status = 'active';
                  existingPossession.acquiredChapter = newChapter.number;
                  existingPossession.updatedAt = Date.now();
                }
              }
            }
            
            if (result.wasCreated) {
              addLog(`Item discovered: ${result.item.name}`, 'discovery');
            } else {
              addLog(`Item updated: ${result.item.name}`, 'update');
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error processing item:', errorMessage);
          addLog(`Failed to process item: ${errorMessage}`, 'update');
        }
      }
    }

    if (extraction.techniqueUpdates && Array.isArray(extraction.techniqueUpdates)) {
      for (const techniqueUpdate of extraction.techniqueUpdates) {
        try {
          // Validate required fields before processing
          if (!techniqueUpdate.name || typeof techniqueUpdate.name !== 'string' || techniqueUpdate.name.trim() === '') {
            console.warn('Skipping technique update: missing or invalid name');
            continue;
          }
          
          if (techniqueUpdate.action === 'create' || techniqueUpdate.action === 'update') {
            // Validate and coerce category and type
            const category = coerceTechniqueCategory(techniqueUpdate.category);
            const type = coerceTechniqueType(techniqueUpdate.type);
            
            const result = findOrCreateTechnique(
              techniqueUpdate.name.trim(),
              techniques,
              novel.id,
              category,
              type,
              newChapter.number,
              techniqueUpdate.description,
              techniqueUpdate.addFunctions
            );
            
            // Update or add technique
            const existingIndex = techniques.findIndex(t => t.id === result.technique.id);
            if (existingIndex >= 0) {
              techniques[existingIndex] = result.technique;
            } else {
              techniques.push(result.technique);
            }
            
            // Link technique to character if characterName is provided
            if (techniqueUpdate.characterName) {
              const character = findCharacterByName(mergedCharacters, techniqueUpdate.characterName);
              if (character) {
                // Check if relationship already exists
                const existingMastery = allCharacterTechniqueMasteries.find(
                  m => m.characterId === character.id && m.techniqueId === result.technique.id
                );
                
                if (!existingMastery) {
                  const mastery: CharacterTechniqueMastery = {
                    id: generateUUID(),
                    characterId: character.id,
                    techniqueId: result.technique.id,
                    status: 'active',
                    masteryLevel: techniqueUpdate.masteryLevel || 'Novice',
                    learnedChapter: newChapter.number,
                    notes: result.wasCreated ? 'Learned from chapter generation' : 'Updated from chapter generation',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  allCharacterTechniqueMasteries.push(mastery);
                  
                  // Also update character's techniqueMasteries array
                  if (!character.techniqueMasteries) {
                    character.techniqueMasteries = [];
                  }
                  character.techniqueMasteries.push(mastery);
                } else {
                  // Update existing mastery
                  existingMastery.status = 'active';
                  existingMastery.masteryLevel = techniqueUpdate.masteryLevel || existingMastery.masteryLevel;
                  existingMastery.learnedChapter = newChapter.number;
                  existingMastery.updatedAt = Date.now();
                }
              }
            }
            
            if (result.wasCreated) {
              addLog(`Technique discovered: ${result.technique.name}`, 'discovery');
            } else {
              addLog(`Technique updated: ${result.technique.name}`, 'update');
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error processing technique:', errorMessage);
          addLog(`Failed to process technique: ${errorMessage}`, 'update');
        }
      }
    }

    // Process scenes
    const scenes: Scene[] = [];
    if (extraction.scenes && Array.isArray(extraction.scenes)) {
      extraction.scenes.forEach((sceneData: any) => {
        try {
          if (sceneData.number && sceneData.title && sceneData.contentExcerpt) {
            const scene: Scene = {
              id: generateUUID(),
              chapterId: newChapter.id,
              number: Number(sceneData.number) || scenes.length + 1,
              title: String(sceneData.title).trim(),
              content: String(sceneData.contentExcerpt).trim(),
              summary: String(sceneData.summary || '').trim(),
              wordCount: String(sceneData.contentExcerpt).split(/\s+/).filter(w => w.length > 0).length,
              tags: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            scenes.push(scene);
            addLog(`Scene created: ${scene.title}`, 'discovery');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error processing scene:', errorMessage);
        }
      });
    }

    // Process arc checklist progress
    let updatedArcs = [...novel.plotLedger];
    if (extraction.arcChecklistProgress && extraction.arcChecklistProgress.arcId) {
      const arcIndex = updatedArcs.findIndex(a => a.id === extraction.arcChecklistProgress!.arcId);
      if (arcIndex >= 0) {
        const arc = { ...updatedArcs[arcIndex] };
        
        // Initialize checklist if it doesn't exist
        if (!arc.checklist) {
          arc.checklist = [];
        }
        
        // Mark items as completed
        if (extraction.arcChecklistProgress.completedItemIds) {
          extraction.arcChecklistProgress.completedItemIds.forEach((itemId: string) => {
            const checklistItem = arc.checklist!.find(item => item.id === itemId);
            if (checklistItem && !checklistItem.completed) {
              checklistItem.completed = true;
              checklistItem.completedAt = Date.now();
              checklistItem.sourceChapterNumber = newChapter.number;
              addLog(`Arc checklist item completed: ${checklistItem.label}`, 'update');
            }
          });
        }
        
        updatedArcs[arcIndex] = arc;
      }
    }

    // Process antagonist updates
    let updatedAntagonists = [...(novel.antagonists || [])];
    const protagonist = mergedCharacters.find(c => c.isProtagonist);
    const activeArc = updatedArcs.find(a => a.status === 'active');
    
    if (extraction.antagonistUpdates && Array.isArray(extraction.antagonistUpdates) && extraction.antagonistUpdates.length > 0) {
      try {
        const antagonistResults = processAntagonistUpdates(
          extraction.antagonistUpdates,
          updatedAntagonists,
          novel.id,
          newChapter.number,
          protagonist?.id,
          activeArc?.id
        );
        
        antagonistResults.forEach(result => {
          const existingIndex = updatedAntagonists.findIndex(a => a.id === result.antagonist.id);
          if (existingIndex >= 0) {
            updatedAntagonists[existingIndex] = result.antagonist;
            addLog(`Antagonist updated: ${result.antagonist.name}`, 'update');
          } else {
            updatedAntagonists.push(result.antagonist);
            addLog(`Antagonist discovered: ${result.antagonist.name}`, 'discovery');
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing antagonist updates:', errorMessage);
        addLog(`Failed to process antagonist updates: ${errorMessage}`, 'update');
      }
    }

    // Update chapter with scenes
    const updatedChapter: Chapter = {
      ...newChapter,
      scenes: scenes.length > 0 ? scenes : newChapter.scenes,
    };

    // Return updated novel state
    return {
      ...novel,
      characterCodex: mergedCharacters,
      worldBible,
      territories,
      realms,
      currentRealmId: newRealmId,
      novelItems: items,
      novelTechniques: techniques,
      plotLedger: updatedArcs,
      antagonists: updatedAntagonists.length > 0 ? updatedAntagonists : novel.antagonists,
      chapters: novel.chapters.map(c => c.id === newChapter.id ? updatedChapter : c),
      updatedAt: Date.now(),
    };
  }, [
    normalize, 
    mergeAppend, 
    coerceWorldCategory, 
    coerceTerritoryType, 
    coerceCharStatus,
    coerceItemCategory,
    coerceTechniqueCategory,
    coerceTechniqueType,
    findCharacterByName,
  ]);

  return {
    processPostChapterUpdates,
    normalize,
    mergeAppend,
    coerceWorldCategory,
    coerceTerritoryType,
    coerceCharStatus,
    coerceItemCategory,
    coerceTechniqueCategory,
    coerceTechniqueType,
    findCharacterByName,
  };
}
