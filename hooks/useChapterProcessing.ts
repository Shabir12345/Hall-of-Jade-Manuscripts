import { useCallback } from 'react';
import type { 
  NovelState, 
  Chapter, 
  Character, 
  WorldEntry, 
  Territory, 
  SystemLog, 
  CharacterItemPossession,
  CharacterTechniqueMastery,
  Scene,
  Realm,
} from '../types';
import { extractPostChapterUpdates } from '../services/aiService';
import { findOrCreateItem, findOrCreateTechnique } from '../services/itemTechniqueService';
import { generateUUID } from '../utils/uuid';
import { 
  coerceItemCategory, 
  coerceTechniqueCategory, 
  coerceTechniqueType 
} from '../utils/typeCoercion';
import { processAntagonistUpdates } from '../services/antagonistProcessingService';
import { addOrUpdateRelationship } from '../services/relationshipService';
import { addAntagonistToChapter } from '../services/antagonistService';
import { autoManageStatus } from '../services/antagonistStatusManager';
import { analyzeAndTrackProgression as analyzeAndTrackAntagonistProgression } from '../services/antagonistProgressionTracker';
import { processSystemUpdates } from '../services/systemProcessingService';
import { analyzeAndTrackProgression as analyzeAndTrackSystemProgression } from '../services/systemProgressionTracker';
import { trackSystemAppearance } from '../services/systemService';

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
   * Find character by name (case-insensitive)
   */
  const findCharacterByName = useCallback((characters: Character[], name: string): Character | undefined => {
    const normalizedName = normalize(name);
    return characters.find(c => normalize(c.name) === normalizedName);
  }, [normalize]);

  /**
   * Process post-chapter extraction updates
   */
  const processPostChapterUpdates = useCallback(async (
    novel: NovelState,
    newChapter: Chapter,
    activeArcInput: any,
    addLog: (msg: string, type: SystemLog['type']) => void
  ): Promise<NovelState> => {
    // Extract updates from chapter
    const extraction = await extractPostChapterUpdates(novel, newChapter, activeArcInput);
    
    // Enhanced: Process consistency system updates
    try {
      const { processPostGenerationConsistency } = await import('../services/consistencyIntegrationService');
      const consistencyResult = await processPostGenerationConsistency(novel, newChapter, extraction);
      
      if (!consistencyResult.postValidation.passed) {
        const criticalIssues = consistencyResult.postValidation.report.issues.filter(
          (i: any) => i.severity === 'critical'
        );
        if (criticalIssues.length > 0) {
          addLog(`⚠️ ${criticalIssues.length} critical consistency issue(s) detected`, 'update');
        }
      }
      
      if (consistencyResult.postValidation.corrections.length > 0) {
        addLog(`💡 ${consistencyResult.postValidation.corrections.length} auto-correction(s) suggested`, 'update');
      }
    } catch (error) {
      console.error('Consistency system processing failed:', error);
      // Don't fail the whole process if consistency check fails
    }

    // Process character upserts
    let mergedCharacters = [...novel.characterCodex];
    extraction.characterUpserts?.forEach((u: any) => {
      const name = String(u?.name || '').trim();
      if (!name) return;
      const idx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(name));

      if (idx > -1) {
        let char = { ...mergedCharacters[idx] };
        const set = u?.set || {};
        
        if (typeof set.age === 'number' && set.age) char.age = set.age;
        if (typeof set.personality === 'string' && set.personality.trim()) char.personality = set.personality;
        if (typeof set.currentCultivation === 'string' && set.currentCultivation.trim()) {
          char.currentCultivation = set.currentCultivation;
        }
        if (typeof set.appearance === 'string' && set.appearance.trim()) {
          char.appearance = set.appearance;
        }
        if (typeof set.background === 'string' && set.background.trim()) {
          char.background = mergeAppend(char.background || '', set.background, newChapter.number);
        }
        if (typeof set.goals === 'string' && set.goals.trim()) {
          char.goals = set.goals;
        }
        if (typeof set.flaws === 'string' && set.flaws.trim()) {
          char.flaws = set.flaws;
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

        // Process relationships (karma links) using relationship service for bidirectional creation
        const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
        if (rels.length) {
          for (const rel of rels) {
            const targetName = String(rel?.targetName || '').trim();
            const type = String(rel?.type || '').trim();
            if (!targetName || !type) continue;
            const target = findCharacterByName(mergedCharacters, targetName);
            if (!target) continue;
            
            // Use relationship service to create bidirectional relationship
            const result = addOrUpdateRelationship(
              mergedCharacters,
              char.id,
              target.id,
              type,
              String(rel?.history || 'Karma link recorded in chronicle.'),
              String(rel?.impact || 'Fate has shifted.'),
              true // bidirectional
            );
            
            if (result.success) {
              mergedCharacters = result.updatedCharacters;
              // Update char reference to the updated character
              const updatedCharIndex = mergedCharacters.findIndex(c => c.id === char.id);
              if (updatedCharIndex >= 0) {
                char = mergedCharacters[updatedCharIndex];
              }
            }
          }
        }

        mergedCharacters[idx] = char;
      } else if (u?.name) {
        // New character
        const newChar: Character = {
          id: generateUUID(),
          name: String(u.name),
          age: typeof u?.set?.age === 'number' ? u.set.age : 0,
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
        
        // Process relationships for new character using relationship service
        // First add the character to the array so relationships can be created
        mergedCharacters.push(newChar);
        
        const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
        if (rels.length) {
          for (const rel of rels) {
            const targetName = String(rel?.targetName || '').trim();
            const type = String(rel?.type || '').trim();
            if (!targetName || !type) continue;
            const target = findCharacterByName(mergedCharacters, targetName);
            if (!target) continue;
            
            // Use relationship service to create bidirectional relationship
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
            }
          }
        }
        
        // Get final character state after relationship updates
        const finalCharIndex = mergedCharacters.findIndex(c => c.id === newChar.id);
        const finalChar = finalCharIndex >= 0 ? mergedCharacters[finalCharIndex] : newChar;
        
        addLog(
          rels.length > 0 
            ? `New character discovered: ${finalChar.name} with ${rels.length} relationship(s)` 
            : `New character discovered: ${finalChar.name}`,
          'discovery'
        );
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
              const characterIndex = mergedCharacters.findIndex(c => 
                normalize(c.name) === normalize(itemUpdate.characterName)
              );
              if (characterIndex >= 0) {
                const character = mergedCharacters[characterIndex];
                const existingPossessions = character.itemPossessions || [];
                const existingPossessionIndex = existingPossessions.findIndex(
                  p => p.itemId === result.item.id
                );
                
                if (existingPossessionIndex === -1) {
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
                  
                  // Create new character object with updated possessions (immutable update)
                  mergedCharacters[characterIndex] = {
                    ...character,
                    itemPossessions: [...existingPossessions, possession]
                  };
                } else {
                  // Update existing possession
                  const existingPossession = existingPossessions[existingPossessionIndex];
                  const updatedPossession = {
                    ...existingPossession,
                    status: 'active' as const,
                    acquiredChapter: newChapter.number,
                    updatedAt: Date.now()
                  };
                  
                  // Update in tracking array
                  const trackingIndex = allCharacterItemPossessions.findIndex(
                    p => p.characterId === character.id && p.itemId === result.item.id
                  );
                  if (trackingIndex >= 0) {
                    allCharacterItemPossessions[trackingIndex] = updatedPossession;
                  } else {
                    allCharacterItemPossessions.push(updatedPossession);
                  }
                  
                  // Create new character object with updated possession (immutable update)
                  const updatedPossessions = existingPossessions.map((p, idx) => 
                    idx === existingPossessionIndex ? updatedPossession : p
                  );
                  mergedCharacters[characterIndex] = {
                    ...character,
                    itemPossessions: updatedPossessions
                  };
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
              const characterIndex = mergedCharacters.findIndex(c => 
                normalize(c.name) === normalize(techniqueUpdate.characterName)
              );
              if (characterIndex >= 0) {
                const character = mergedCharacters[characterIndex];
                const existingMasteries = character.techniqueMasteries || [];
                const existingMasteryIndex = existingMasteries.findIndex(
                  m => m.techniqueId === result.technique.id
                );
                
                if (existingMasteryIndex === -1) {
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
                  
                  // Create new character object with updated masteries (immutable update)
                  mergedCharacters[characterIndex] = {
                    ...character,
                    techniqueMasteries: [...existingMasteries, mastery]
                  };
                } else {
                  // Update existing mastery
                  const existingMastery = existingMasteries[existingMasteryIndex];
                  const updatedMastery = {
                    ...existingMastery,
                    status: 'active' as const,
                    masteryLevel: techniqueUpdate.masteryLevel || existingMastery.masteryLevel,
                    learnedChapter: newChapter.number,
                    updatedAt: Date.now()
                  };
                  
                  // Update in tracking array
                  const trackingIndex = allCharacterTechniqueMasteries.findIndex(
                    m => m.characterId === character.id && m.techniqueId === result.technique.id
                  );
                  if (trackingIndex >= 0) {
                    allCharacterTechniqueMasteries[trackingIndex] = updatedMastery;
                  } else {
                    allCharacterTechniqueMasteries.push(updatedMastery);
                  }
                  
                  // Create new character object with updated mastery (immutable update)
                  const updatedMasteries = existingMasteries.map((m, idx) => 
                    idx === existingMasteryIndex ? updatedMastery : m
                  );
                  mergedCharacters[characterIndex] = {
                    ...character,
                    techniqueMasteries: updatedMasteries
                  };
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
    const protagonistCharacter = mergedCharacters.find(c => c.isProtagonist);
    const activeArcRecord = updatedArcs.find(a => a.status === 'active');
    
    if (extraction.antagonistUpdates && Array.isArray(extraction.antagonistUpdates) && extraction.antagonistUpdates.length > 0) {
      try {
        const antagonistResults = processAntagonistUpdates(
          extraction.antagonistUpdates,
          updatedAntagonists,
          novel.id,
          newChapter.number,
          protagonistCharacter?.id,
          activeArcRecord?.id
        );
        
        // Track chapter appearances to create after antagonist is saved
        const chapterAppearancesToCreate: Array<{
          antagonistId: string;
          presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence';
          significance: 'major' | 'minor' | 'foreshadowing';
          notes?: string;
        }> = [];

        for (const result of antagonistResults) {
          const existingIndex = updatedAntagonists.findIndex(a => a.id === result.antagonist.id);
          const oldAntagonist = existingIndex >= 0 ? updatedAntagonists[existingIndex] : null;
          
          // Auto-manage status based on story context
          let finalAntagonist = result.antagonist;
          try {
            finalAntagonist = await autoManageStatus(
              result.antagonist,
              newChapter.number,
              result.chapterAppearance?.presenceType,
              true // hasRecentAppearance
            );
          } catch (error) {
            console.debug('Failed to auto-manage antagonist status:', error);
          }
          
          if (existingIndex >= 0) {
            updatedAntagonists[existingIndex] = finalAntagonist;
            addLog(`Antagonist updated: ${finalAntagonist.name}`, 'update');
          } else {
            updatedAntagonists.push(finalAntagonist);
            addLog(`Antagonist discovered: ${finalAntagonist.name}`, 'discovery');
          }

          // Track chapter appearance if provided
          if (result.chapterAppearance && newChapter.id) {
            chapterAppearancesToCreate.push({
              antagonistId: finalAntagonist.id,
              presenceType: result.chapterAppearance.presenceType,
              significance: result.chapterAppearance.significance,
              notes: result.chapterAppearance.notes
            });
          }

          // Track progression automatically
          try {
            await analyzeAndTrackAntagonistProgression(
              oldAntagonist,
              finalAntagonist,
              newChapter.number,
              result.chapterAppearance?.presenceType,
              result.chapterAppearance?.significance
            );
          } catch (error) {
            // Log but don't fail - progression tracking is non-critical
            console.debug('Failed to track antagonist progression:', error);
          }
        }

        // Automatically create chapter appearances (fire and forget - will be saved when novel is saved)
        if (chapterAppearancesToCreate.length > 0 && newChapter.id) {
          // Create appearances asynchronously - they'll be saved when the novel is saved
          // Using skipValidation=true since antagonist may not be in DB yet
          chapterAppearancesToCreate.forEach(async (appearance) => {
            try {
              await addAntagonistToChapter(
                appearance.antagonistId,
                newChapter.id,
                appearance.presenceType,
                appearance.significance,
                appearance.notes || '',
                true // skipValidation - will be saved via saveNovel
              );
            } catch (error) {
              // Log but don't fail - appearance will be created when novel is saved
              console.debug('Could not create chapter appearance immediately (will be saved with novel):', error);
            }
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing antagonist updates:', errorMessage);
        addLog(`Failed to process antagonist updates: ${errorMessage}`, 'update');
      }
    }

    // Process system updates
    let updatedSystems = [...(novel.characterSystems || [])];
    const protagonistForSystems = protagonistCharacter;
    
    if (extraction.systemUpdates && Array.isArray(extraction.systemUpdates) && extraction.systemUpdates.length > 0 && protagonistForSystems) {
      try {
        // Find protagonist character by name from system update
        const systemResults = processSystemUpdates(
          extraction.systemUpdates,
          updatedSystems,
          novel.id,
          protagonistForSystems.id,
          newChapter.number
        );
        
        // Track chapter appearances to create after system is saved
        const chapterAppearancesToCreate: Array<{
          systemId: string;
          presenceType: 'direct' | 'mentioned' | 'hinted' | 'used';
          significance: 'major' | 'minor' | 'foreshadowing';
          featuresUsed?: string[];
          notes?: string;
        }> = [];

        for (const result of systemResults) {
          const existingIndex = updatedSystems.findIndex(s => s.id === result.system.id);
          const oldSystem = existingIndex >= 0 ? updatedSystems[existingIndex] : null;
          
          if (existingIndex >= 0) {
            updatedSystems[existingIndex] = result.system;
            addLog(`System updated: ${result.system.name}`, 'update');
          } else {
            updatedSystems.push(result.system);
            addLog(`System discovered: ${result.system.name}`, 'discovery');
          }

          // Track chapter appearance if provided
          if (result.chapterAppearance && newChapter.id) {
            chapterAppearancesToCreate.push({
              systemId: result.system.id,
              presenceType: result.chapterAppearance.presenceType,
              significance: result.chapterAppearance.significance,
              featuresUsed: result.chapterAppearance.featuresUsed,
              notes: result.chapterAppearance.notes
            });
          }

          // Track progression automatically
          try {
            await analyzeAndTrackSystemProgression(
              oldSystem,
              result.system,
              newChapter.number,
              result.chapterAppearance?.presenceType,
              result.chapterAppearance?.significance
            );
          } catch (error) {
            // Log but don't fail - progression tracking is non-critical
            console.debug('Failed to track system progression:', error);
          }
        }

        // Automatically create chapter appearances (fire and forget - will be saved when novel is saved)
        if (chapterAppearancesToCreate.length > 0 && newChapter.id) {
          // Create appearances asynchronously
          chapterAppearancesToCreate.forEach(async (appearance) => {
            try {
              await trackSystemAppearance({
                systemId: appearance.systemId,
                chapterId: newChapter.id!,
                presenceType: appearance.presenceType,
                significance: appearance.significance,
                featuresUsed: appearance.featuresUsed || [],
                notes: appearance.notes || '',
              });
            } catch (error) {
              // Log but don't fail - appearance will be created when novel is saved
              console.debug('Could not create chapter appearance immediately (will be saved with novel):', error);
            }
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing system updates:', errorMessage);
        addLog(`Failed to process system updates: ${errorMessage}`, 'update');
      }
    }

    // Update chapter with scenes
    const updatedChapter: Chapter = {
      ...newChapter,
      scenes: scenes.length > 0 ? scenes : newChapter.scenes,
    };

    // 6) Story Threads
    let updatedThreads = [...(novel.storyThreads || [])];
    if (extraction.threadUpdates && Array.isArray(extraction.threadUpdates) && extraction.threadUpdates.length > 0) {
      try {
        const { processThreadUpdates } = await import('../services/storyThreadService');
        const threadResults = processThreadUpdates(
          extraction.threadUpdates,
          updatedThreads,
          novel.id,
          newChapter.number,
          newChapter.id,
          {
            characterCodex: mergedCharacters,
            novelItems: items,
            novelTechniques: techniques,
            territories,
            antagonists: updatedAntagonists,
            plotLedger: updatedArcs,
            worldBible: novel.worldBible,
            realms: novel.realms,
          }
        );

        for (const result of threadResults) {
          const existingIndex = updatedThreads.findIndex(t => t.id === result.thread.id);
          if (existingIndex >= 0) {
            updatedThreads[existingIndex] = result.thread;
            if (result.wasUpdated) {
              addLog(`Thread updated: ${result.thread.title}`, 'update');
            }
          } else {
            updatedThreads.push(result.thread);
            addLog(`Thread discovered: ${result.thread.title}`, 'discovery');
          }

          // Save progression event if available
          if (result.progressionEvent) {
            try {
              const { saveThreadProgressionEvent } = await import('../services/threadService');
              await saveThreadProgressionEvent(result.progressionEvent);
            } catch (error) {
              console.warn('Failed to save thread progression event:', error);
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error processing thread updates:', errorMessage);
        addLog(`Failed to process thread updates: ${errorMessage}`, 'update');
      }
    }

    // Update comprehensive context tracking after chapter generation
    try {
      const { updateContextAfterChapter } = await import('../services/chapterContextUpdater');
      await updateContextAfterChapter(novel, newChapter, extraction);
      addLog('Context tracking updated', 'update');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error updating context after chapter:', errorMessage);
      // Don't fail if context update fails - non-critical
    }

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
      characterSystems: updatedSystems.length > 0 ? updatedSystems : novel.characterSystems,
      storyThreads: updatedThreads.length > 0 ? updatedThreads : novel.storyThreads,
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
