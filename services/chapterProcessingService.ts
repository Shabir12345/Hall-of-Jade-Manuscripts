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
    Arc,
} from '../types';
import { extractPostChapterUpdates } from './aiService';
import { findOrCreateItem, findOrCreateTechnique } from './itemTechniqueService';
import { generateUUID } from '../utils/uuid';
import {
    coerceItemCategory,
    coerceTechniqueCategory,
    coerceTechniqueType
} from '../utils/typeCoercion';
import { processAntagonistUpdates } from './antagonistProcessingService';
import { addOrUpdateRelationship } from './relationshipService';
import { addAntagonistToChapter } from './antagonistService';
import { autoManageStatus } from './antagonistStatusManager';
import { analyzeAndTrackProgression as analyzeAndTrackAntagonistProgression } from './antagonistProgressionTracker';
import { processSystemUpdates } from './systemProcessingService';
import { analyzeAndTrackProgression as analyzeAndTrackSystemProgression } from './systemProgressionTracker';
import { trackSystemAppearance } from './systemService';
import { logger } from './loggingService';

/**
 * Normalizes string for comparison
 */
export const normalize = (s: string) => (s || '').trim().toLowerCase();

/**
 * Merge append helper for notes
 */
export const mergeAppend = (existing: string, incoming: string, chapterNum: number) => {
    const cur = (existing || '').trim();
    const inc = (incoming || '').trim();
    if (!inc) return cur;
    if (!cur) return inc;
    if (normalize(cur).includes(normalize(inc))) return cur;
    return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc}`;
};

/**
 * Coerce categories
 */
export const coerceWorldCategory = (category: any): WorldEntry['category'] => {
    const c = String(category || '').trim();
    const allowed: WorldEntry['category'][] = ['Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other'];
    return (allowed as string[]).includes(c) ? (c as WorldEntry['category']) : 'Other';
};

export const coerceTerritoryType = (type: string): Territory['type'] => {
    const t = String(type || '').trim();
    const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
    return (allowed as string[]).includes(t) ? (t as Territory['type']) : 'Neutral';
};

export const coerceCharStatus = (status: any): Character['status'] | undefined => {
    const s = String(status || '').trim();
    const allowed: Character['status'][] = ['Alive', 'Deceased', 'Unknown'];
    return (allowed as string[]).includes(s) ? (s as any) : undefined;
};

/**
 * Find character by name
 */
export const findCharacterByName = (characters: Character[], name: string): Character | undefined => {
    const normalizedName = normalize(name);
    return characters.find(c => normalize(c.name) === normalizedName);
};

/**
 * Standalone function to process post-chapter updates
 * Migrated from useChapterProcessing hook for use in batch generation and other contexts
 */
export async function processPostChapterUpdates(
    novel: NovelState,
    newChapter: Chapter,
    activeArcInput?: Arc | null,
    addLog?: (msg: string, type: SystemLog['type']) => void
): Promise<NovelState> {
    const loggerAddLog = (msg: string, type: SystemLog['type']) => {
        if (addLog) addLog(msg, type);
        else logger.info(msg, 'chapterProcessing');
    };

    // Find active arc if not provided
    const activeArc = activeArcInput || novel.plotLedger.find(a => a.status === 'active') || null;

    // Extract updates from chapter
    const extraction = await extractPostChapterUpdates(novel, newChapter, activeArc);

    // Consistency system processing
    try {
        const { processPostGenerationConsistency } = await import('./consistencyIntegrationService');
        const consistencyResult = await processPostGenerationConsistency(novel, newChapter, extraction);

        if (!consistencyResult.postValidation.passed) {
            const criticalCount = consistencyResult.postValidation.report.issues.filter((i: any) => i.severity === 'critical').length;
            if (criticalCount > 0) loggerAddLog(`⚠️ ${criticalCount} critical consistency issue(s) detected`, 'update');
        }

        if (consistencyResult.postValidation.corrections.length > 0) {
            loggerAddLog(`💡 ${consistencyResult.postValidation.corrections.length} auto-correction(s) suggested`, 'update');
        }
    } catch (error) {
        logger.warn('Consistency system processing failed', 'chapterProcessing');
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

            if (set.age) char.age = set.age;
            if (set.personality) char.personality = set.personality;
            if (set.currentCultivation) char.currentCultivation = set.currentCultivation;
            if (set.appearance) char.appearance = set.appearance;
            if (set.background) char.background = mergeAppend(char.background || '', set.background, newChapter.number);
            if (set.goals) char.goals = set.goals;
            if (set.flaws) char.flaws = set.flaws;
            if (set.notes) char.notes = mergeAppend(char.notes || '', set.notes, newChapter.number);

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

            // Relationships
            const rels = Array.isArray(u?.relationships) ? u.relationships : [];
            rels.forEach((rel: any) => {
                const target = findCharacterByName(mergedCharacters, rel.targetName);
                if (target) {
                    const result = addOrUpdateRelationship(mergedCharacters, char.id, target.id, rel.type, rel.history, rel.impact, true);
                    if (result.success) {
                        mergedCharacters = result.updatedCharacters;
                        const updatedIdx = mergedCharacters.findIndex(c => c.id === char.id);
                        if (updatedIdx >= 0) char = mergedCharacters[updatedIdx];
                    }
                }
            });
            mergedCharacters[idx] = char;
        } else {
            const newChar: Character = {
                id: generateUUID(),
                name: name,
                age: u.set?.age || 0,
                personality: u.set?.personality || 'Unknown',
                currentCultivation: u.set?.currentCultivation || 'Unknown',
                skills: u.addSkills || [],
                items: u.addItems || [],
                notes: u.set?.notes || '',
                status: coerceCharStatus(u.set?.status) || 'Alive',
                relationships: [],
                itemPossessions: [],
                techniqueMasteries: [],
            };
            mergedCharacters.push(newChar);
            loggerAddLog(`New character discovered: ${newChar.name}`, 'discovery');
        }
    });

    // World updates
    const worldBible = [...novel.worldBible];
    const realms = [...novel.realms];
    let newRealmId = novel.currentRealmId;

    extraction.worldEntryUpserts?.forEach((w: any) => {
        if (w.isNewRealm && w.title) {
            const realmName = w.title.trim();
            if (!realms.find(r => normalize(r.name) === normalize(realmName))) {
                realms.forEach(r => r.status = 'archived');
                const newRealm: Realm = { id: generateUUID(), name: realmName, description: w.content || '', status: 'current' };
                realms.push(newRealm);
                newRealmId = newRealm.id;
                loggerAddLog(`Realm ascended: Welcome to ${realmName}!`, 'discovery');
            }
            return;
        }
        const title = String(w.title || '').trim();
        if (title && newRealmId) {
            const existing = worldBible.find(e => normalize(e.title) === normalize(title) && e.realmId === newRealmId);
            if (!existing) {
                worldBible.push({ id: generateUUID(), realmId: newRealmId, category: coerceWorldCategory(w.category), title, content: w.content || '' });
                loggerAddLog(`Lore entry: ${title}`, 'discovery');
            } else if ((w.content || '').length > (existing.content?.length || 0)) {
                existing.content = w.content;
                existing.category = coerceWorldCategory(w.category);
                loggerAddLog(`Lore entry updated: ${title}`, 'update');
            }
        }
    });

    // Territory updates
    const territories = [...novel.territories];
    extraction.territoryUpserts?.forEach((t: any) => {
        const name = String(t.name || '').trim();
        if (name && newRealmId) {
            const existing = territories.find(tr => normalize(tr.name) === normalize(name) && tr.realmId === newRealmId);
            if (!existing) {
                territories.push({ id: generateUUID(), realmId: newRealmId, name, type: coerceTerritoryType(t.type), description: t.description || '' });
                loggerAddLog(`Territory discovered: ${name}`, 'discovery');
            } else if ((t.description || '').length > (existing.description?.length || 0)) {
                existing.description = t.description;
                existing.type = coerceTerritoryType(t.type);
                loggerAddLog(`Territory updated: ${name}`, 'update');
            }
        }
    });

    // Items and techniques
    const items = [...(novel.novelItems || [])];
    const techniques = [...(novel.novelTechniques || [])];

    if (extraction.itemUpdates) {
        for (const iu of extraction.itemUpdates) {
            if (iu.name && (iu.action === 'create' || iu.action === 'update')) {
                const result = findOrCreateItem(iu.name.trim(), items, novel.id, coerceItemCategory(iu.category), newChapter.number, iu.description, iu.addPowers);
                const idx = items.findIndex(i => i.id === result.item.id);
                if (idx >= 0) items[idx] = result.item; else items.push(result.item);

                if (iu.characterName) {
                    const charIdx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(iu.characterName));
                    if (charIdx >= 0) {
                        const char = mergedCharacters[charIdx];
                        const poss = char.itemPossessions || [];
                        if (!poss.find(p => p.itemId === result.item.id)) {
                            mergedCharacters[charIdx] = {
                                ...char, itemPossessions: [...poss, {
                                    id: generateUUID(), characterId: char.id, itemId: result.item.id, status: 'active',
                                    acquiredChapter: newChapter.number, notes: result.wasCreated ? 'Acquired from generation' : 'Updated from generation',
                                    createdAt: Date.now(), updatedAt: Date.now()
                                }]
                            };
                        }
                    }
                }
                loggerAddLog(`Item ${result.wasCreated ? 'discovered' : 'updated'}: ${result.item.name}`, result.wasCreated ? 'discovery' : 'update');
            }
        }
    }

    if (extraction.techniqueUpdates) {
        for (const tu of extraction.techniqueUpdates) {
            if (tu.name && (tu.action === 'create' || tu.action === 'update')) {
                const result = findOrCreateTechnique(tu.name.trim(), techniques, novel.id, coerceTechniqueCategory(tu.category), coerceTechniqueType(tu.type), newChapter.number, tu.description, tu.addFunctions);
                const idx = techniques.findIndex(t => t.id === result.technique.id);
                if (idx >= 0) techniques[idx] = result.technique; else techniques.push(result.technique);

                if (tu.characterName) {
                    const charIdx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(tu.characterName));
                    if (charIdx >= 0) {
                        const char = mergedCharacters[charIdx];
                        const masts = char.techniqueMasteries || [];
                        if (!masts.find(m => m.techniqueId === result.technique.id)) {
                            mergedCharacters[charIdx] = {
                                ...char, techniqueMasteries: [...masts, {
                                    id: generateUUID(), characterId: char.id, techniqueId: result.technique.id, status: 'active',
                                    masteryLevel: tu.masteryLevel || 'Novice', learnedChapter: newChapter.number,
                                    notes: result.wasCreated ? 'Learned from generation' : 'Updated from generation',
                                    createdAt: Date.now(), updatedAt: Date.now()
                                }]
                            };
                        }
                    }
                }
                loggerAddLog(`Technique ${result.wasCreated ? 'discovered' : 'updated'}: ${result.technique.name}`, result.wasCreated ? 'discovery' : 'update');
            }
        }
    }

    // Scenes
    const scenes: Scene[] = [];
    if (extraction.scenes && Array.isArray(extraction.scenes)) {
        extraction.scenes.forEach((sceneData: any) => {
            if (sceneData.number && sceneData.title && sceneData.contentExcerpt) {
                scenes.push({
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
                });
            }
        });
    }

    // Antagonists
    let updatedAntagonists = [...(novel.antagonists || [])];
    const protagonist = mergedCharacters.find(c => c.isProtagonist);
    if (extraction.antagonistUpdates && extraction.antagonistUpdates.length > 0) {
        try {
            const results = processAntagonistUpdates(extraction.antagonistUpdates, updatedAntagonists, novel.id, newChapter.number, protagonist?.id, activeArc?.id);
            results.forEach(res => {
                const idx = updatedAntagonists.findIndex(a => a.id === res.antagonist.id);
                if (idx >= 0) updatedAntagonists[idx] = res.antagonist; else updatedAntagonists.push(res.antagonist);
                loggerAddLog(`Antagonist ${idx >= 0 ? 'updated' : 'discovered'}: ${res.antagonist.name}`, idx >= 0 ? 'update' : 'discovery');
            });
        } catch (error) {
            logger.error('Failed to process antagonist updates', 'chapterProcessing', error instanceof Error ? error : undefined);
        }
    }

    // Story Threads (Dynamic import for now to avoid circular deps if any)
    let updatedThreads = [...(novel.storyThreads || [])];
    if (extraction.threadUpdates && extraction.threadUpdates.length > 0) {
        try {
            const { processThreadUpdates } = await import('./storyThreadService');
            const threadResults = processThreadUpdates(
                extraction.threadUpdates, updatedThreads, novel.id, newChapter.number, newChapter.id,
                { characterCodex: mergedCharacters, novelItems: items, novelTechniques: techniques, territories, antagonists: updatedAntagonists, plotLedger: novel.plotLedger, worldBible, realms }
            );
            threadResults.forEach(res => {
                const idx = updatedThreads.findIndex(t => t.id === res.thread.id);
                if (idx >= 0) updatedThreads[idx] = res.thread; else updatedThreads.push(res.thread);
                loggerAddLog(`Thread ${idx >= 0 ? 'updated' : 'discovered'}: ${res.thread.title}`, res.wasUpdated ? 'update' : 'discovery');
            });
        } catch (error) {
            logger.error('Failed to process thread updates', 'chapterProcessing', error instanceof Error ? error : undefined);
        }
    }

    // Update novel state
    return {
        ...novel,
        characterCodex: mergedCharacters,
        worldBible,
        territories,
        realms,
        currentRealmId: newRealmId,
        novelItems: items,
        novelTechniques: techniques,
        antagonists: updatedAntagonists,
        storyThreads: updatedThreads,
        chapters: novel.chapters.map(c => c.id === newChapter.id ? { ...c, scenes: scenes.length > 0 ? scenes : c.scenes } : c),
        updatedAt: Date.now(),
    };
}
