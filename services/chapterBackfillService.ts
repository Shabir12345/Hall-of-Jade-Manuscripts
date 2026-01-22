/**
 * Chapter Backfill Service
 * Extracts and populates missing data (scenes, world bible, territories, antagonists, arc progress)
 * for existing chapters that were generated before the extraction system was implemented.
 */

import type { 
  NovelState, 
  Chapter, 
  Arc, 
  SystemLog, 
  PostChapterExtraction, 
  Character, 
  Relationship,
  CharacterItemPossession,
  CharacterTechniqueMastery,
} from '../types';
import { extractPostChapterUpdates } from './aiService';
import { saveNovel } from './supabaseService';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';
import { findMatchingAntagonist, mergeAntagonistInfo } from '../utils/antagonistMatching';
import { findOrCreateItem } from './itemTechniqueService';
import { findOrCreateTechnique } from './itemTechniqueService';
import { addOrUpdateRelationship } from './relationshipService';
import { 
  coerceItemCategory, 
  coerceTechniqueCategory, 
  coerceTechniqueType,
  coerceCharStatus,
} from '../utils/typeCoercion';

/**
 * Normalize string for comparison (lowercase, trim)
 */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Coerce world category to valid type
 */
function coerceWorldCategory(category: any): 'Geography' | 'Sects' | 'PowerLevels' | 'Laws' | 'Systems' | 'Techniques' | 'Other' {
  const c = String(category || '').trim();
  const allowed = ['Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other'];
  return (allowed as string[]).includes(c) ? (c as any) : 'Other';
}

/**
 * Coerce territory type to valid type
 */
function coerceTerritoryType(type: any): 'Empire' | 'Kingdom' | 'Neutral' | 'Hidden' {
  const t = String(type || '').trim();
  const allowed = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
  return (allowed as string[]).includes(t) ? (t as any) : 'Neutral';
}

/**
 * Merge append helper for notes/history
 */
function mergeAppend(existing: string, incoming: string, chapterNum: number): string {
  const cur = (existing || '').trim();
  const inc = (incoming || '').trim();
  if (!inc) return cur;
  if (!cur) return inc;
  // Avoid repeated appends
  if (normalize(cur).includes(normalize(inc))) return cur;
  return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc}`;
}

/**
 * Backfills a single chapter by extracting and merging data
 */
export async function backfillChapter(
  chapter: Chapter,
  novelState: NovelState,
  activeArc: Arc | null = null
): Promise<{ success: boolean; extracted: PostChapterExtraction | null; error?: string }> {
  try {
    // Find active arc if not provided
    if (!activeArc) {
      activeArc = novelState.plotLedger.find(a => a.status === 'active') || null;
    }

    // Extract data from chapter
    const extraction = await extractPostChapterUpdates(novelState, chapter, activeArc);

    if (!extraction) {
      return {
        success: false,
        extracted: null,
        error: 'Extraction returned null',
      };
    }

    return {
      success: true,
      extracted: extraction,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Backfill chapter failed', 'backfill', error instanceof Error ? error : new Error(errorMessage), {
      chapterId: chapter.id,
      chapterNumber: chapter.number,
    });
    return {
      success: false,
      extracted: null,
      error: errorMessage,
    };
  }
}

/**
 * Helper function to find character by name
 */
function findCharacterByName(characters: Character[], name: string): Character | undefined {
  const normalizedName = normalize(name);
  return characters.find(c => normalize(c.name) === normalizedName);
}

export async function mergeExtractedData(
  novelState: NovelState,
  chapter: Chapter,
  extraction: PostChapterExtraction,
  activeArc: Arc | null = null
): Promise<NovelState> {
  const now = Date.now();
  let updatedState = { ...novelState };

  // 0) Process character upserts (including relationships, items, techniques)
  let mergedCharacters = [...updatedState.characterCodex];
  
  if (extraction.characterUpserts && extraction.characterUpserts.length > 0) {
    console.log(`[Backfill] Processing ${extraction.characterUpserts.length} character upsert(s) for chapter ${chapter.number}`);
    extraction.characterUpserts.forEach((u: any) => {
      const name = String(u?.name || '').trim();
      if (!name) return;
      const idx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(name));

      if (idx > -1) {
        // Update existing character - create new object for React state updates
        const existingChar = mergedCharacters[idx];
        const set = u?.set || {};
        
        console.log(`[Backfill] Updating existing character "${name}" with:`, Object.keys(set));
        
        const updatedChar: Character = {
          ...existingChar,
          age: typeof set.age === 'string' && set.age.trim() ? set.age : existingChar.age,
          personality: typeof set.personality === 'string' && set.personality.trim() ? set.personality : existingChar.personality,
          currentCultivation: typeof set.currentCultivation === 'string' && set.currentCultivation.trim() 
            ? set.currentCultivation 
            : existingChar.currentCultivation,
          appearance: typeof set.appearance === 'string' && set.appearance.trim() 
            ? set.appearance 
            : existingChar.appearance,
          background: typeof set.background === 'string' && set.background.trim()
            ? mergeAppend(existingChar.background || '', set.background, chapter.number)
            : existingChar.background,
          goals: typeof set.goals === 'string' && set.goals.trim()
            ? set.goals
            : existingChar.goals,
          flaws: typeof set.flaws === 'string' && set.flaws.trim()
            ? set.flaws
            : existingChar.flaws,
          notes: typeof set.notes === 'string' && set.notes.trim() 
            ? mergeAppend(existingChar.notes || '', set.notes, chapter.number)
            : existingChar.notes,
          status: coerceCharStatus(set.status) || existingChar.status,
          skills: (() => {
            const addSkills: string[] = Array.isArray(u?.addSkills) ? u.addSkills : [];
            if (addSkills.length) {
              return [...new Set([...(existingChar.skills || []), ...addSkills.filter((s: any) => String(s).trim())])];
            }
            return existingChar.skills || [];
          })(),
          items: (() => {
            const addItems: string[] = Array.isArray(u?.addItems) ? u.addItems : [];
            if (addItems.length) {
              return [...new Set([...(existingChar.items || []), ...addItems.filter((s: any) => String(s).trim())])];
            }
            return existingChar.items || [];
          })(),
          relationships: existingChar.relationships || [], // Will be updated via relationship service below
        };

        mergedCharacters[idx] = updatedChar;
        
        // Process relationships using relationship service for bidirectional relationships
        const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
        if (rels.length) {
          console.log(`[Backfill] Processing ${rels.length} relationship(s) for character "${u.name}"`);
          let processedCount = 0;
          let skippedCount = 0;
          
          for (const rel of rels) {
            // Validate relationship data
            const targetName = String(rel?.targetName || '').trim();
            const type = String(rel?.type || '').trim();
            
            // Skip invalid relationships
            if (!targetName) {
              logger.warn(`[Backfill] Skipping relationship for "${u.name}": missing targetName`, 'backfill');
              skippedCount++;
              continue;
            }
            
            if (!type) {
              logger.warn(`[Backfill] Skipping relationship from "${u.name}" to "${targetName}": missing type`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Validate character exists
            if (updatedChar.id === undefined || updatedChar.id === null || updatedChar.id === '') {
              logger.error(`[Backfill] Invalid character ID for "${u.name}"`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Find target character
            const target = findCharacterByName(mergedCharacters, targetName);
            if (!target) {
              logger.warn(`[Backfill] Target character "${targetName}" not found for relationship from "${u.name}"`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Prevent self-relationships
            if (updatedChar.id === target.id) {
              logger.warn(`[Backfill] Skipping self-relationship for "${u.name}" (character cannot relate to themselves)`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Use relationship service to ensure bidirectional relationships
            const result = addOrUpdateRelationship(
              mergedCharacters,
              updatedChar.id,
              target.id,
              type,
              String(rel?.history || 'Karma link recorded in chronicle.'),
              String(rel?.impact || 'Fate has shifted.'),
              true // bidirectional
            );
            
            if (result.success) {
              mergedCharacters = result.updatedCharacters;
              processedCount++;
              // Relationships are now updated in mergedCharacters via addOrUpdateRelationship
            } else {
              logger.warn(`[Backfill] Failed to create relationship from "${u.name}" to "${targetName}": ${result.errors.join(', ')}`, 'backfill', {
                sourceCharacterId: updatedChar.id,
                targetCharacterId: target.id,
                relationshipType: type,
                errors: result.errors
              });
              skippedCount++;
            }
          }
          
          if (processedCount > 0) {
            logger.info(`[Backfill] Successfully processed ${processedCount} relationship(s) for character "${u.name}"`, 'backfill');
          }
          if (skippedCount > 0) {
            logger.warn(`[Backfill] Skipped ${skippedCount} invalid or failed relationship(s) for character "${u.name}"`, 'backfill');
          }
        }
      } else if (u?.name) {
        // Create new character
        console.log(`[Backfill] Creating new character "${u.name}"`);
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
          itemPossessions: [],
          techniqueMasteries: [],
        };
        
        mergedCharacters.push(newChar);
        
        // Process relationships using relationship service for bidirectional relationships
        const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
        if (rels.length) {
          console.log(`[Backfill] Processing ${rels.length} relationship(s) for new character "${u.name}"`);
          let processedCount = 0;
          let skippedCount = 0;
          
          for (const rel of rels) {
            // Validate relationship data
            const targetName = String(rel?.targetName || '').trim();
            const type = String(rel?.type || '').trim();
            
            // Skip invalid relationships
            if (!targetName) {
              logger.warn(`[Backfill] Skipping relationship for new character "${u.name}": missing targetName`, 'backfill');
              skippedCount++;
              continue;
            }
            
            if (!type) {
              logger.warn(`[Backfill] Skipping relationship from new character "${u.name}" to "${targetName}": missing type`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Validate character exists
            if (newChar.id === undefined || newChar.id === null || newChar.id === '') {
              logger.error(`[Backfill] Invalid character ID for new character "${u.name}"`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Find target character
            const target = findCharacterByName(mergedCharacters, targetName);
            if (!target) {
              logger.warn(`[Backfill] Target character "${targetName}" not found for relationship from new character "${u.name}"`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Prevent self-relationships
            if (newChar.id === target.id) {
              logger.warn(`[Backfill] Skipping self-relationship for new character "${u.name}" (character cannot relate to themselves)`, 'backfill');
              skippedCount++;
              continue;
            }
            
            // Use relationship service to ensure bidirectional relationships
            const result = addOrUpdateRelationship(
              mergedCharacters,
              newChar.id,
              target.id,
              type,
              String(rel?.history || 'Karma link recorded in chronicle.'),
              String(rel?.impact || 'Fate has shifted.'),
              true // bidirectional
            );
            
            if (result.success) {
              mergedCharacters = result.updatedCharacters;
              processedCount++;
            } else {
              logger.warn(`[Backfill] Failed to create relationship from new character "${u.name}" to "${targetName}": ${result.errors.join(', ')}`, 'backfill', {
                sourceCharacterId: newChar.id,
                targetCharacterId: target.id,
                relationshipType: type,
                errors: result.errors
              });
              skippedCount++;
            }
          }
          
          if (processedCount > 0) {
            logger.info(`[Backfill] Successfully processed ${processedCount} relationship(s) for new character "${u.name}"`, 'backfill');
          }
          if (skippedCount > 0) {
            logger.warn(`[Backfill] Skipped ${skippedCount} invalid or failed relationship(s) for new character "${u.name}"`, 'backfill');
          }
        }
      }
    });
  }

  // Process items and techniques with character linking
  const items = [...(updatedState.novelItems || [])];
  const techniques = [...(updatedState.novelTechniques || [])];
  const allCharacterItemPossessions: CharacterItemPossession[] = [];
  const allCharacterTechniqueMasteries: CharacterTechniqueMastery[] = [];

  if (extraction.itemUpdates && Array.isArray(extraction.itemUpdates)) {
    console.log(`[Backfill] Processing ${extraction.itemUpdates.length} item update(s) for chapter ${chapter.number}`);
    for (const itemUpdate of extraction.itemUpdates) {
      try {
        if (!itemUpdate.name || typeof itemUpdate.name !== 'string' || itemUpdate.name.trim() === '') {
          continue;
        }
        
        if (itemUpdate.action === 'create' || itemUpdate.action === 'update') {
          const category = coerceItemCategory(itemUpdate.category);
          
          const result = findOrCreateItem(
            itemUpdate.name.trim(),
            items,
            updatedState.id,
            category,
            chapter.number,
            itemUpdate.description,
            itemUpdate.addPowers
          );
          
          const existingIndex = items.findIndex(i => i.id === result.item.id);
          if (existingIndex >= 0) {
            items[existingIndex] = result.item;
          } else {
            items.push(result.item);
          }
          
          // Link item to character if characterName is provided
          if (itemUpdate.characterName) {
            const charIndex = mergedCharacters.findIndex(c => normalize(c.name) === normalize(itemUpdate.characterName));
            if (charIndex >= 0) {
              console.log(`[Backfill] Linking item "${itemUpdate.name}" to character "${itemUpdate.characterName}"`);
              const character = mergedCharacters[charIndex];
              
              // Check if possession already exists in character's array
              const existingPossession = character.itemPossessions?.find(
                p => p.itemId === result.item.id
              );
              
              if (!existingPossession) {
                const possession: CharacterItemPossession = {
                  id: generateUUID(),
                  characterId: character.id,
                  itemId: result.item.id,
                  status: 'active',
                  acquiredChapter: chapter.number,
                  notes: result.wasCreated ? 'Acquired from chapter backfill' : 'Updated from chapter backfill',
                  createdAt: now,
                  updatedAt: now,
                };
                
                // Create new character object with updated itemPossessions
                mergedCharacters[charIndex] = {
                  ...character,
                  itemPossessions: [...(character.itemPossessions || []), possession],
                };
                
                allCharacterItemPossessions.push(possession);
              } else {
                // Update existing possession
                const updatedPossession = {
                  ...existingPossession,
                  status: 'active',
                  acquiredChapter: chapter.number,
                  updatedAt: now,
                };
                const posIndex = character.itemPossessions!.findIndex(p => p.id === existingPossession.id);
                const updatedPossessions = [...(character.itemPossessions || [])];
                updatedPossessions[posIndex] = updatedPossession;
                
                mergedCharacters[charIndex] = {
                  ...character,
                  itemPossessions: updatedPossessions,
                };
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing item in backfill:', error);
      }
    }
  }

  if (extraction.techniqueUpdates && Array.isArray(extraction.techniqueUpdates)) {
    console.log(`[Backfill] Processing ${extraction.techniqueUpdates.length} technique update(s) for chapter ${chapter.number}`);
    for (const techniqueUpdate of extraction.techniqueUpdates) {
      try {
        if (!techniqueUpdate.name || typeof techniqueUpdate.name !== 'string' || techniqueUpdate.name.trim() === '') {
          continue;
        }
        
        if (techniqueUpdate.action === 'create' || techniqueUpdate.action === 'update') {
          const category = coerceTechniqueCategory(techniqueUpdate.category);
          const type = coerceTechniqueType(techniqueUpdate.type);
          
          const result = findOrCreateTechnique(
            techniqueUpdate.name.trim(),
            techniques,
            updatedState.id,
            category,
            type,
            chapter.number,
            techniqueUpdate.description,
            techniqueUpdate.addFunctions
          );
          
          const existingIndex = techniques.findIndex(t => t.id === result.technique.id);
          if (existingIndex >= 0) {
            techniques[existingIndex] = result.technique;
          } else {
            techniques.push(result.technique);
          }
          
          // Link technique to character if characterName is provided
          if (techniqueUpdate.characterName) {
            const charIndex = mergedCharacters.findIndex(c => normalize(c.name) === normalize(techniqueUpdate.characterName));
            if (charIndex >= 0) {
              const character = mergedCharacters[charIndex];
              
              // Check if mastery already exists in character's array
              const existingMastery = character.techniqueMasteries?.find(
                m => m.techniqueId === result.technique.id
              );
              
              if (!existingMastery) {
                const mastery: CharacterTechniqueMastery = {
                  id: generateUUID(),
                  characterId: character.id,
                  techniqueId: result.technique.id,
                  status: 'active',
                  masteryLevel: techniqueUpdate.masteryLevel || 'Novice',
                  learnedChapter: chapter.number,
                  notes: result.wasCreated ? 'Learned from chapter backfill' : 'Updated from chapter backfill',
                  createdAt: now,
                  updatedAt: now,
                };
                
                // Create new character object with updated techniqueMasteries
                mergedCharacters[charIndex] = {
                  ...character,
                  techniqueMasteries: [...(character.techniqueMasteries || []), mastery],
                };
                
                allCharacterTechniqueMasteries.push(mastery);
              } else {
                // Update existing mastery
                const updatedMastery = {
                  ...existingMastery,
                  status: 'active',
                  masteryLevel: techniqueUpdate.masteryLevel || existingMastery.masteryLevel,
                  learnedChapter: chapter.number,
                  updatedAt: now,
                };
                const mastIndex = character.techniqueMasteries!.findIndex(m => m.id === existingMastery.id);
                const updatedMasteries = [...(character.techniqueMasteries || [])];
                updatedMasteries[mastIndex] = updatedMastery;
                
                mergedCharacters[charIndex] = {
                  ...character,
                  techniqueMasteries: updatedMasteries,
                };
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing technique in backfill:', error);
      }
    }
  }

  // 1) World Bible entries
  const mergedWorldBible = [...updatedState.worldBible];
  if (extraction.worldEntryUpserts && extraction.worldEntryUpserts.length > 0) {
    extraction.worldEntryUpserts.forEach((w) => {
      const title = String(w?.title || '').trim();
      const content = String(w?.content || '').trim();
      if (!title || !content) return;
      const category = coerceWorldCategory(w?.category);
      
      // Use currentRealmId, fallback to first realm
      let realmId = updatedState.currentRealmId;
      if (!realmId || realmId.trim() === '' || !updatedState.realms.some(r => r.id === realmId)) {
        realmId = updatedState.realms.length > 0 ? updatedState.realms[0].id : '';
      }
      if (!realmId || realmId.trim() === '') return;
      
      const idx = mergedWorldBible.findIndex(
        (e) => e.realmId === realmId && e.category === category && normalize(e.title) === normalize(title)
      );
      
      if (idx > -1) {
            mergedWorldBible[idx] = {
              ...mergedWorldBible[idx],
              content: mergeAppend(mergedWorldBible[idx].content || '', content, chapter.number),
            };
          } else {
            // Validate basic world entry input
            const newId = generateUUID();
            mergedWorldBible.push({
              id: newId,
              realmId,
              category,
              title,
              content,
            });
          }
    });
  }

  // 2) Territories
  const mergedTerritories = [...updatedState.territories];
  if (extraction.territoryUpserts && extraction.territoryUpserts.length > 0) {
    extraction.territoryUpserts.forEach((t) => {
      const name = String(t?.name || '').trim();
      const description = String(t?.description || '').trim();
      if (!name || !description) return;
      const realmId = updatedState.currentRealmId;
      
      const idx = mergedTerritories.findIndex(
        (e) => e.realmId === realmId && normalize(e.name) === normalize(name)
      );
      
      if (idx > -1) {
        mergedTerritories[idx] = {
          ...mergedTerritories[idx],
          type: coerceTerritoryType(t?.type),
          description: mergeAppend(mergedTerritories[idx].description || '', description, chapter.number),
        };
      } else {
        mergedTerritories.push({
          id: generateUUID(),
          realmId,
          name,
          type: coerceTerritoryType(t?.type),
          description,
        });
      }
    });
  }

  // 3) Antagonists - Initialize before threads since threads reference antagonists
  let mergedAntagonists = [...(updatedState.antagonists || [])];
  if (extraction.antagonistUpdates && extraction.antagonistUpdates.length > 0) {
    extraction.antagonistUpdates.forEach((antUpdate) => {
      const antName = String(antUpdate?.name || '').trim();
      if (!antName) return;

      const matchResult = findMatchingAntagonist(antName, mergedAntagonists, 0.85);
      const existingAntagonist = matchResult.antagonist;
      const existingIndex = existingAntagonist 
        ? mergedAntagonists.findIndex(a => a.id === existingAntagonist.id)
        : -1;

      const shouldUpdate = antUpdate.action === 'update' || (existingAntagonist && matchResult.similarity >= 0.85);
      
      if (shouldUpdate && existingIndex >= 0 && existingAntagonist) {
        const updates: Partial<typeof existingAntagonist> = {
          description: antUpdate.description,
          motivation: antUpdate.motivation,
          powerLevel: antUpdate.powerLevel,
          status: antUpdate.status,
          threatLevel: antUpdate.threatLevel,
          lastAppearedChapter: chapter.number,
          notes: antUpdate.notes,
          updatedAt: Date.now()
        };

        Object.keys(updates).forEach(key => {
          if (updates[key as keyof typeof updates] === undefined) {
            delete updates[key as keyof typeof updates];
          }
        });

        mergedAntagonists[existingIndex] = mergeAntagonistInfo(existingAntagonist, updates);
      } else if (antUpdate.action === 'create' || !existingAntagonist) {
        const protagonist = updatedState.characterCodex.find(c => c.isProtagonist);
        const antagonistId = generateUUID();
        
        const newAntagonist = {
          id: antagonistId,
          novelId: updatedState.id,
          name: antName,
          type: (antUpdate.type || 'individual') as any,
          description: antUpdate.description || '',
          motivation: antUpdate.motivation || '',
          powerLevel: antUpdate.powerLevel || '',
          status: (antUpdate.status || 'active') as any,
          firstAppearedChapter: chapter.number,
          lastAppearedChapter: chapter.number,
          durationScope: (antUpdate.durationScope || 'arc') as any,
          threatLevel: (antUpdate.threatLevel || 'medium') as any,
          notes: antUpdate.notes || '',
          relationships: protagonist && antUpdate.relationshipWithProtagonist ? [{
            id: generateUUID(),
            antagonistId: antagonistId,
            characterId: protagonist.id,
            relationshipType: (antUpdate.relationshipWithProtagonist.relationshipType || 'primary_target') as any,
            intensity: (antUpdate.relationshipWithProtagonist.intensity || 'enemy') as any,
            history: '',
            currentState: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }] : [],
          arcAssociations: activeArc && antUpdate.arcRole ? [{
            id: generateUUID(),
            antagonistId: antagonistId,
            arcId: activeArc.id,
            role: (antUpdate.arcRole || 'secondary') as any,
            introducedInArc: true,
            resolvedInArc: false,
            notes: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }] : [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        mergedAntagonists.push(newAntagonist as any);
      }
    });
  }

  // 4) Story Threads
  let mergedThreads = [...(updatedState.storyThreads || [])];
  if (extraction.threadUpdates && extraction.threadUpdates.length > 0) {
    try {
      const { processThreadUpdates } = await import('./storyThreadService');
      const threadResults = processThreadUpdates(
        extraction.threadUpdates,
        mergedThreads,
        updatedState.id,
        chapter.number,
        chapter.id,
        {
          characterCodex: mergedCharacters,
          novelItems: updatedState.novelItems,
          novelTechniques: updatedState.novelTechniques,
          territories: mergedTerritories,
          antagonists: mergedAntagonists,
          plotLedger: updatedState.plotLedger,
          worldBible: updatedState.worldBible,
          realms: updatedState.realms,
        }
      );

      for (const result of threadResults) {
        const existingIndex = mergedThreads.findIndex(t => t.id === result.thread.id);
        if (existingIndex >= 0) {
          mergedThreads[existingIndex] = result.thread;
        } else {
          mergedThreads.push(result.thread);
        }
      }
    } catch (error) {
      console.error('Error processing threads in backfill:', error);
    }
  }

  // 5) Scenes - only extract if chapter doesn't already have scenes
  // Character data (relationships, items, techniques) is always processed regardless
  const extractedScenes: any[] = [];
  if (!chapter.scenes || chapter.scenes.length === 0) {
    // Only extract scenes if chapter doesn't already have them
    if (extraction.scenes && extraction.scenes.length > 0) {
      extraction.scenes.forEach((s) => {
        const sceneNum = typeof s?.number === 'number' && s.number > 0 ? s.number : extractedScenes.length + 1;
        const sceneTitle = String(s?.title || '').trim() || `Scene ${sceneNum}`;
        const sceneSummary = String(s?.summary || '').trim() || '';
        const contentExcerpt = String(s?.contentExcerpt || '').trim() || '';
        
        let sceneContent = contentExcerpt;
        if (!sceneContent && chapter.content) {
          const paragraphs = chapter.content.split(/\n\n+/).filter(p => p.trim().length > 50);
          const scenesCount = extraction.scenes.length;
          const parasPerScene = Math.max(1, Math.ceil(paragraphs.length / scenesCount));
          const startIdx = (sceneNum - 1) * parasPerScene;
          const endIdx = Math.min(startIdx + parasPerScene, paragraphs.length);
          sceneContent = paragraphs.slice(startIdx, endIdx).join('\n\n') || chapter.content.substring(0, 1000);
        }
        
        if (sceneTitle || sceneSummary || sceneContent) {
          extractedScenes.push({
            id: generateUUID(),
            chapterId: chapter.id,
            number: sceneNum,
            title: sceneTitle,
            summary: sceneSummary,
            content: sceneContent,
            wordCount: sceneContent.split(/\s+/).filter((w: string) => w.length > 0).length,
            tags: [],
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    }
  }

  // 6) Arc checklist progress
  let mergedLedger = [...updatedState.plotLedger];
  const completedItemIds: string[] = extraction.arcChecklistProgress?.completedItemIds || [];
  const progressArcId = extraction.arcChecklistProgress?.arcId || activeArc?.id || null;
  if (progressArcId && completedItemIds.length) {
    mergedLedger = mergedLedger.map(a => {
      if (a.id !== progressArcId) return a;
      const checklist = (a.checklist || []).map(item => {
        if (!completedItemIds.includes(item.id)) return item;
        if (item.completed) return item;
        return { ...item, completed: true, completedAt: now, sourceChapterNumber: chapter.number };
      });
      return { ...a, checklist };
    });
  }

  // Update chapter with scenes
  const updatedChapter: Chapter = extractedScenes.length > 0
    ? { ...chapter, scenes: extractedScenes }
    : chapter;

  // Update chapters in state
  const updatedChapters = updatedState.chapters.map(c => 
    c.id === chapter.id ? updatedChapter : c
  );

  console.log(`[Backfill] Merge complete for chapter ${chapter.number}. Final state:`, {
    totalCharacters: mergedCharacters.length,
    newCharacters: mergedCharacters.length - updatedState.characterCodex.length,
    totalItems: items.length,
    totalTechniques: techniques.length,
    totalWorldBible: mergedWorldBible.length,
    totalTerritories: mergedTerritories.length
  });

  return {
    ...updatedState,
    characterCodex: mergedCharacters,
    novelItems: items,
    novelTechniques: techniques,
    chapters: updatedChapters,
    worldBible: mergedWorldBible,
    territories: mergedTerritories,
    antagonists: mergedAntagonists,
    storyThreads: mergedThreads,
    plotLedger: mergedLedger,
    updatedAt: now,
  };
}

/**
 * Backfills all chapters in a novel
 */
export async function backfillAllChapters(
  novelState: NovelState,
  onProgress?: (chapterNumber: number, total: number, chapter: Chapter) => void,
  onLog?: (message: string) => void
): Promise<{ 
  success: boolean; 
  processed: number; 
  errors: Array<{ chapter: number; error: string }>;
  updatedState: NovelState | null;
}> {
  const errors: Array<{ chapter: number; error: string }> = [];
  let currentState = { ...novelState };
  const sortedChapters = [...novelState.chapters].sort((a, b) => a.number - b.number);
  let processed = 0;

  onLog?.(`Starting backfill for ${sortedChapters.length} chapters...`);

  for (const chapter of sortedChapters) {
    try {
      onProgress?.(chapter.number, sortedChapters.length, chapter);
      onLog?.(`Processing chapter ${chapter.number}: ${chapter.title}`);

      // Find active arc at the time this chapter would have been generated
      // Use the first active arc or the arc that contains this chapter number
      let activeArc = currentState.plotLedger.find(a => a.status === 'active') || null;
      if (!activeArc) {
        activeArc = currentState.plotLedger.find(a => 
          a.startedAtChapter && 
          a.endedAtChapter && 
          chapter.number >= a.startedAtChapter && 
          chapter.number <= a.endedAtChapter
        ) || null;
      }

      // Note: We always extract character data even if scenes already exist
      // Scenes will only be created if the chapter doesn't already have them
      const hasExistingScenes = chapter.scenes && chapter.scenes.length > 0;
      if (hasExistingScenes) {
        onLog?.(`Chapter ${chapter.number} already has ${chapter.scenes.length} scene(s), but processing character data...`);
      }

      // Extract data
      const result = await backfillChapter(chapter, currentState, activeArc);

      if (!result.success || !result.extracted) {
        errors.push({
          chapter: chapter.number,
          error: result.error || 'Extraction failed',
        });
        onLog?.(`⚠️ Chapter ${chapter.number} extraction failed: ${result.error}`);
        continue;
      }

      // Merge extracted data into state
      currentState = await mergeExtractedData(currentState, chapter, result.extracted, activeArc);
      
      const charCount = result.extracted.characterUpserts?.length || 0;
      const itemCount = result.extracted.itemUpdates?.length || 0;
      const techCount = result.extracted.techniqueUpdates?.length || 0;
      const sceneCount = hasExistingScenes ? 0 : (result.extracted.scenes?.length || 0);
      const sceneNote = hasExistingScenes ? ' (scenes skipped - already exist)' : '';
      
      onLog?.(`✅ Chapter ${chapter.number} processed${sceneNote}: ${sceneCount} scene(s), ${result.extracted.worldEntryUpserts?.length || 0} world entry(ies), ${result.extracted.territoryUpserts?.length || 0} territory(ies), ${result.extracted.antagonistUpdates?.length || 0} antagonist(s), ${charCount} character update(s), ${itemCount} item(s), ${techCount} technique(s)`);
      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        chapter: chapter.number,
        error: errorMessage,
      });
      onLog?.(`❌ Chapter ${chapter.number} failed: ${errorMessage}`);
      logger.error('Backfill chapter error', 'backfill', error instanceof Error ? error : new Error(errorMessage), {
        chapterNumber: chapter.number,
      });
    }
  }

  // Save updated state if there were any changes
  if (processed > 0 && errors.length < sortedChapters.length) {
    try {
      onLog?.(`Saving updated novel state...`);
      console.log(`[Backfill] Final save. State before save:`, {
        characterCount: currentState.characterCodex.length,
        itemCount: currentState.novelItems?.length || 0,
        techniqueCount: currentState.novelTechniques?.length || 0
      });
      await saveNovel(currentState);
      onLog?.(`✅ Novel state saved successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onLog?.(`⚠️ Failed to save novel state: ${errorMessage}`);
      logger.error('Failed to save novel state after backfill', 'backfill', error instanceof Error ? error : new Error(errorMessage));
    }
  }

  console.log(`[Backfill] Operation complete. Returning:`, {
    success: errors.length === 0,
    processed,
    errorCount: errors.length,
    hasUpdatedState: !!currentState
  });

  return {
    success: errors.length === 0,
    processed,
    errors,
    updatedState: processed > 0 ? currentState : null,
  };
}