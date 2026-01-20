/**
 * Lore Bible Service
 * 
 * Builds and maintains the Lore Bible - the "Source of Truth" that ensures
 * narrative consistency across thousands of chapters.
 */

import { NovelState, Character, Chapter, Arc, StoryThread, Antagonist } from '../../types';
import {
  LoreBible,
  ProtagonistState,
  CharacterStateSnapshot,
  WorldStateSnapshot,
  NarrativeAnchors,
  PowerSystemState,
  ConflictState,
  KarmaDebt,
  TechniqueMasteryState,
  ItemPossessionState,
  PromiseRecord,
  LoreBibleBuildOptions,
  LoreBibleUpdateResult,
  LoreBibleValidationResult,
  DEFAULT_LORE_BIBLE_OPTIONS,
} from '../../types/loreBible';
import { logger } from '../loggingService';

/**
 * Build a complete Lore Bible from the current novel state
 */
export function buildLoreBible(
  state: NovelState,
  currentChapter: number,
  options: LoreBibleBuildOptions = {}
): LoreBible {
  const opts = { ...DEFAULT_LORE_BIBLE_OPTIONS, ...options };
  
  logger.debug('Building Lore Bible', 'loreBibleService', {
    novelId: state.id,
    currentChapter,
  });

  // Build protagonist state
  const protagonist = buildProtagonistState(state, currentChapter);

  // Build major characters (excluding protagonist)
  const majorCharacters = buildMajorCharacterSnapshots(
    state,
    protagonist?.identity.name,
    opts.maxCharacters || 10
  );

  // Build world state
  const worldState = buildWorldState(state, currentChapter);

  // Build narrative anchors
  const narrativeAnchors = buildNarrativeAnchors(
    state,
    currentChapter,
    opts.includeFulfilledPromises || false
  );

  // Build power system state
  const powerSystem = buildPowerSystemState(state, currentChapter);

  // Build active conflicts
  const activeConflicts = buildActiveConflicts(
    state,
    opts.maxConflicts || 5,
    opts.includeResolvedConflicts || false
  );

  // Build karma debts
  const karmaDebts = buildKarmaDebts(state, opts.maxKarmaDebts || 5);

  // Build economic state (if market data exists)
  const economicState = buildEconomicState(state);

  const loreBible: LoreBible = {
    novelId: state.id,
    asOfChapter: currentChapter,
    protagonist,
    majorCharacters,
    worldState,
    narrativeAnchors,
    powerSystem,
    activeConflicts,
    karmaDebts,
    economicState,
    updatedAt: Date.now(),
    version: 1,
  };

  logger.info('Lore Bible built', 'loreBibleService', {
    novelId: state.id,
    asOfChapter: currentChapter,
    majorCharacters: majorCharacters.length,
    activeConflicts: activeConflicts.length,
    karmaDebts: karmaDebts.length,
    hasEconomicState: !!economicState,
  });

  return loreBible;
}

/**
 * Build protagonist state from novel state
 */
function buildProtagonistState(state: NovelState, currentChapter: number): ProtagonistState {
  // Find protagonist
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  
  if (!protagonist) {
    // Return default state if no protagonist found
    logger.warn('No protagonist found in character codex', 'loreBibleService');
    return {
      identity: {
        name: 'Unknown Protagonist',
        aliases: [],
        sect: 'Unknown',
      },
      cultivation: {
        realm: 'Unknown',
        stage: 'Unknown',
        foundationQuality: 'Unknown',
      },
      techniques: [],
      inventory: {
        equipped: [],
        storageRing: [],
      },
      lastUpdatedChapter: currentChapter,
    };
  }

  // Extract techniques from masteries
  const techniques: TechniqueMasteryState[] = [];
  if (protagonist.techniqueMasteries) {
    protagonist.techniqueMasteries
      .filter(m => m.status === 'active' || m.status === 'mastered')
      .forEach(mastery => {
        const technique = state.novelTechniques?.find(t => t.id === mastery.techniqueId);
        if (technique) {
          techniques.push({
            name: technique.name,
            masteryLevel: mastery.masteryLevel,
            description: technique.description?.substring(0, 100),
            acquiredChapter: mastery.learnedChapter,
          });
        }
      });
  }

  // Extract items from possessions
  const equippedItems: ItemPossessionState[] = [];
  const storageItems: ItemPossessionState[] = [];
  
  if (protagonist.itemPossessions) {
    protagonist.itemPossessions
      .filter(p => p.status === 'active')
      .forEach(possession => {
        const item = state.novelItems?.find(i => i.id === possession.itemId);
        if (item) {
          const itemState: ItemPossessionState = {
            name: item.name,
            category: item.category === 'Equipment' ? 'equipped' : 
                      item.category === 'Consumable' ? 'consumable' : 'storage',
            description: item.description?.substring(0, 80),
            acquiredChapter: possession.acquiredChapter,
          };
          
          if (item.category === 'Equipment') {
            equippedItems.push(itemState);
          } else {
            storageItems.push(itemState);
          }
        }
      });
  }

  // Parse cultivation level
  const cultivation = parseCultivationLevel(protagonist.currentCultivation);

  // Extract sect from relationships or notes
  const sect = extractSectFromCharacter(protagonist, state);

  // Extract aliases if available
  const aliases = extractAliases(protagonist);

  return {
    identity: {
      name: protagonist.name,
      aliases,
      sect,
      title: undefined, // Could be extracted from notes or a dedicated field
    },
    cultivation,
    techniques,
    inventory: {
      equipped: equippedItems,
      storageRing: storageItems,
    },
    emotionalState: undefined, // Would need to be extracted from recent chapter
    physicalState: protagonist.status === 'Deceased' ? 'Deceased' : undefined,
    location: undefined, // Would need to be extracted from recent chapter
    lastUpdatedChapter: currentChapter,
  };
}

/**
 * Parse cultivation level string into structured state
 */
function parseCultivationLevel(cultivationString: string): {
  realm: string;
  stage: string;
  foundationQuality: string;
  physique?: string;
} {
  if (!cultivationString) {
    return {
      realm: 'Unknown',
      stage: 'Unknown',
      foundationQuality: 'Unknown',
    };
  }

  // Common cultivation stages
  const stages = ['Early', 'Middle', 'Late', 'Peak'];
  
  // Try to extract stage
  let stage = 'Unknown';
  let realm = cultivationString;
  
  for (const s of stages) {
    if (cultivationString.toLowerCase().includes(s.toLowerCase())) {
      stage = s;
      realm = cultivationString.replace(new RegExp(s, 'i'), '').trim();
      break;
    }
  }

  // Clean up realm name
  realm = realm.replace(/[-–—]/g, '').trim();
  if (realm.startsWith('-') || realm.endsWith('-')) {
    realm = realm.replace(/^-|-$/g, '').trim();
  }

  return {
    realm: realm || cultivationString,
    stage,
    foundationQuality: 'Unknown', // Would need dedicated field
  };
}

/**
 * Extract sect information from character data
 */
function extractSectFromCharacter(character: Character, state: NovelState): string {
  // Check notes for sect information
  const notesSectMatch = character.notes?.match(/sect[:\s]+([^,.\n]+)/i);
  if (notesSectMatch) {
    return notesSectMatch[1].trim();
  }

  // Check background for sect information
  const backgroundSectMatch = character.background?.match(/(?:from|of|joined|member of)\s+(?:the\s+)?([^,.\n]+(?:sect|clan|school))/i);
  if (backgroundSectMatch) {
    return backgroundSectMatch[1].trim();
  }

  // Check world bible for sects
  const sectEntry = state.worldBible.find(e => 
    e.category === 'Sects' && 
    e.content.toLowerCase().includes(character.name.toLowerCase())
  );
  if (sectEntry) {
    return sectEntry.title;
  }

  return 'Unknown';
}

/**
 * Extract character aliases from notes or other fields
 */
function extractAliases(character: Character): string[] {
  const aliases: string[] = [];
  
  // Check for "also known as" patterns in notes
  const aliasMatch = character.notes?.match(/(?:also known as|alias|nicknamed?)\s*[:\s]+([^,.\n]+)/gi);
  if (aliasMatch) {
    aliasMatch.forEach(match => {
      const alias = match.replace(/(?:also known as|alias|nicknamed?)\s*[:\s]+/i, '').trim();
      if (alias && alias !== character.name) {
        aliases.push(alias);
      }
    });
  }

  return aliases;
}

/**
 * Build snapshots of major characters
 */
function buildMajorCharacterSnapshots(
  state: NovelState,
  protagonistName: string | undefined,
  maxCount: number
): CharacterStateSnapshot[] {
  // Filter out protagonist and sort by relevance
  const characters = state.characterCodex
    .filter(c => !c.isProtagonist && c.name !== protagonistName)
    .sort((a, b) => {
      // Prioritize by: status (Alive first), relationships count, cultivation level
      if (a.status === 'Alive' && b.status !== 'Alive') return -1;
      if (b.status === 'Alive' && a.status !== 'Alive') return 1;
      return (b.relationships?.length || 0) - (a.relationships?.length || 0);
    })
    .slice(0, maxCount);

  return characters.map(char => {
    // Find relationship to protagonist
    let relationshipToProtagonist: string | undefined;
    if (protagonistName) {
      const protagonistChar = state.characterCodex.find(c => c.name === protagonistName);
      if (protagonistChar) {
        const rel = char.relationships?.find(r => r.characterId === protagonistChar.id);
        relationshipToProtagonist = rel?.type;
      }
    }

    // Extract key traits
    const keyTraits: string[] = [];
    if (char.personality) {
      const traits = char.personality.split(/[,;]/).slice(0, 3);
      keyTraits.push(...traits.map(t => t.trim()));
    }

    return {
      id: char.id,
      name: char.name,
      status: char.status,
      cultivation: char.currentCultivation,
      relationshipToProtagonist,
      keyTraits,
    };
  });
}

/**
 * Build world state from novel state
 */
function buildWorldState(state: NovelState, currentChapter: number): WorldStateSnapshot {
  // Get current realm
  const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
  
  // Get recent chapter for current situation
  const recentChapter = state.chapters.find(c => c.number === currentChapter) ||
    state.chapters[state.chapters.length - 1];

  // Build current situation from chapter summary or arc description
  let currentSituation = 'Story in progress';
  if (recentChapter?.summary) {
    currentSituation = recentChapter.summary.substring(0, 200);
  }

  // Get active arc for context
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc) {
    currentSituation = `${activeArc.title}: ${currentSituation}`;
  }

  return {
    currentRealm: currentRealm?.name || 'Unknown Realm',
    currentLocation: 'Unknown Location', // Would need location tracking
    currentSituation,
    environmentalConditions: [],
  };
}

/**
 * Build narrative anchors
 */
function buildNarrativeAnchors(
  state: NovelState,
  currentChapter: number,
  includeFulfilled: boolean
): NarrativeAnchors {
  // Get last major event from most recent chapter
  const recentChapter = state.chapters.find(c => c.number === currentChapter) ||
    state.chapters[state.chapters.length - 1];

  let lastMajorEvent = 'Story beginning';
  let lastMajorEventChapter = 1;
  
  if (recentChapter) {
    lastMajorEvent = recentChapter.summary || recentChapter.title;
    lastMajorEventChapter = recentChapter.number;
  }

  // Get current objective from active arc
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  const currentObjective = activeArc?.description || 'Continue the journey';

  // Build active quests from story threads
  const activeQuests: string[] = [];
  if (state.storyThreads) {
    state.storyThreads
      .filter(t => t.status === 'active' && t.type === 'quest')
      .slice(0, 5)
      .forEach(t => activeQuests.push(t.title));
  }

  // Build pending promises from story threads
  const pendingPromises: PromiseRecord[] = [];
  if (state.storyThreads) {
    state.storyThreads
      .filter(t => t.type === 'promise' && (t.status === 'active' || (includeFulfilled && t.status === 'resolved')))
      .slice(0, 5)
      .forEach(t => {
        pendingPromises.push({
          id: t.id,
          description: t.description,
          madeInChapter: t.introducedChapter,
          status: t.status === 'resolved' ? 'fulfilled' : 'pending',
          fulfillmentChapter: t.resolvedChapter,
        });
      });
  }

  return {
    lastMajorEvent,
    lastMajorEventChapter,
    currentObjective,
    activeQuests,
    pendingPromises,
  };
}

/**
 * Build power system state
 */
function buildPowerSystemState(state: NovelState, currentChapter: number): PowerSystemState {
  // Get protagonist's current level
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const currentProtagonistRank = protagonist?.currentCultivation || 'Unknown';

  // Build level hierarchy from world bible
  const knownLevelHierarchy: string[] = [];
  const powerLevelEntry = state.worldBible.find(e => e.category === 'PowerLevels');
  if (powerLevelEntry) {
    // Try to extract levels from content
    const levels = powerLevelEntry.content.match(/\d+\.\s*([^:\n]+)/g);
    if (levels) {
      levels.forEach(level => {
        const name = level.replace(/^\d+\.\s*/, '').trim();
        if (name) knownLevelHierarchy.push(name);
      });
    }
  }

  // Build power gaps (could be enhanced with antagonist comparison)
  const powerGaps: string[] = [];
  if (state.antagonists) {
    state.antagonists
      .filter(a => a.status === 'active')
      .slice(0, 3)
      .forEach(a => {
        if (a.powerLevel && a.powerLevel !== currentProtagonistRank) {
          powerGaps.push(`${a.name}: ${a.powerLevel}`);
        }
      });
  }

  return {
    currentProtagonistRank,
    knownLevelHierarchy,
    powerGaps,
    recentBreakthroughs: [], // Would need chapter-by-chapter tracking
  };
}

/**
 * Build active conflicts
 */
function buildActiveConflicts(
  state: NovelState,
  maxCount: number,
  includeResolved: boolean
): ConflictState[] {
  const conflicts: ConflictState[] = [];

  // Get conflicts from story threads
  if (state.storyThreads) {
    state.storyThreads
      .filter(t => 
        t.type === 'conflict' && 
        (t.status === 'active' || (includeResolved && t.status === 'resolved'))
      )
      .slice(0, maxCount)
      .forEach(t => {
        conflicts.push({
          id: t.id,
          description: t.description,
          parties: [], // Would need parsing from description
          type: 'personal',
          status: t.status === 'resolved' ? 'resolving' : 'active',
          urgency: t.priority === 'critical' ? 'critical' : 
                   t.priority === 'high' ? 'high' : 'medium',
          introducedChapter: t.introducedChapter,
          lastUpdatedChapter: t.lastUpdatedChapter,
        });
      });
  }

  // Get conflicts from antagonists
  if (state.antagonists && conflicts.length < maxCount) {
    state.antagonists
      .filter(a => a.status === 'active')
      .slice(0, maxCount - conflicts.length)
      .forEach(a => {
        conflicts.push({
          id: `antagonist_${a.id}`,
          description: `Conflict with ${a.name}: ${a.motivation || 'Unknown motivation'}`,
          parties: [a.name],
          type: a.durationScope === 'novel' ? 'realm-wide' : 
                a.durationScope === 'arc' ? 'regional' : 'personal',
          status: 'active',
          urgency: a.threatLevel === 'extreme' ? 'critical' :
                   a.threatLevel === 'high' ? 'high' : 'medium',
          introducedChapter: a.firstAppearedChapter || 1,
          lastUpdatedChapter: a.lastAppearedChapter || 1,
        });
      });
  }

  return conflicts;
}

/**
 * Build karma debts
 */
function buildKarmaDebts(state: NovelState, maxCount: number): KarmaDebt[] {
  const karmaDebts: KarmaDebt[] = [];

  // Look for karma-related story threads
  if (state.storyThreads) {
    state.storyThreads
      .filter(t => 
        t.type === 'enemy' || 
        (t.description?.toLowerCase().includes('revenge') ||
         t.description?.toLowerCase().includes('debt') ||
         t.description?.toLowerCase().includes('karma'))
      )
      .slice(0, maxCount)
      .forEach(t => {
        karmaDebts.push({
          id: t.id,
          target: t.title,
          action: t.description,
          targetStatus: 'Unknown',
          consequence: t.progressionNotes?.[0]?.note || 'Consequences pending',
          threatLevel: t.priority === 'critical' ? 'severe' :
                       t.priority === 'high' ? 'moderate' : 'minor',
          introducedChapter: t.introducedChapter,
          resolvedChapter: t.resolvedChapter,
        });
      });
  }

  // Add antagonist-related karma
  if (state.antagonists && karmaDebts.length < maxCount) {
    state.antagonists
      .filter(a => a.status === 'defeated' || a.notes?.toLowerCase().includes('revenge'))
      .slice(0, maxCount - karmaDebts.length)
      .forEach(a => {
        karmaDebts.push({
          id: `karma_${a.id}`,
          target: a.name,
          action: `Defeated ${a.name}`,
          targetStatus: a.status === 'defeated' ? 'Deceased' : 'Unknown',
          consequence: a.notes || 'Potential retribution from allies',
          threatLevel: a.threatLevel === 'extreme' ? 'existential' :
                       a.threatLevel === 'high' ? 'severe' : 'moderate',
          introducedChapter: a.firstAppearedChapter || 1,
          resolvedChapter: a.resolvedChapter,
        });
      });
  }

  return karmaDebts;
}

/**
 * Build economic state from global market state
 */
function buildEconomicState(state: NovelState): LoreBible['economicState'] | undefined {
  const marketState = state.globalMarketState;
  
  if (!marketState || marketState.standardItems.length === 0) {
    return undefined;
  }
  
  // Find primary currency
  const primaryCurrency = marketState.currencies.find(c => c.isPrimary) || marketState.currencies[0];
  const primaryCurrencyName = primaryCurrency?.name || 'Spirit Stones';
  
  // Build standard prices (top 10 most relevant items)
  const standardPrices = marketState.standardItems.slice(0, 10).map(item => {
    const currency = marketState.currencies.find(c => c.id === item.currencyId);
    return {
      item: item.name,
      price: item.currentPrice,
      currency: currency?.name || primaryCurrencyName,
      trend: item.trend,
    };
  });
  
  // Build protagonist wealth string
  let protagonistWealth: string | undefined;
  if (marketState.protagonistWealth) {
    const wealthParts: string[] = [];
    for (const [currencyId, amount] of Object.entries(marketState.protagonistWealth.currencies)) {
      const currency = marketState.currencies.find(c => c.id === currencyId);
      if (currency && amount > 0) {
        wealthParts.push(`~${amount.toLocaleString()} ${currency.name}`);
      }
    }
    if (wealthParts.length > 0) {
      protagonistWealth = wealthParts.join(', ');
    }
  }
  
  return {
    primaryCurrency: primaryCurrencyName,
    standardPrices,
    currentCondition: marketState.economicCondition,
    protagonistWealth,
    marketNotes: marketState.marketNotes,
  };
}

/**
 * Update Lore Bible after chapter generation
 */
export function updateLoreBibleFromChapter(
  bible: LoreBible,
  chapter: Chapter,
  state: NovelState
): LoreBibleUpdateResult {
  const changes = {
    protagonist: false,
    characters: [] as string[],
    worldState: false,
    narrativeAnchors: false,
    conflicts: [] as string[],
    karmaDebts: [] as string[],
  };

  // Update asOfChapter
  const updatedBible = {
    ...bible,
    asOfChapter: chapter.number,
    updatedAt: Date.now(),
    version: bible.version + 1,
  };

  // Update narrative anchors with new chapter info
  updatedBible.narrativeAnchors = {
    ...bible.narrativeAnchors,
    lastMajorEvent: chapter.summary || chapter.title,
    lastMajorEventChapter: chapter.number,
  };
  changes.narrativeAnchors = true;

  // Check if protagonist state changed (cultivation update)
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (protagonist && protagonist.currentCultivation !== bible.protagonist.cultivation.realm) {
    updatedBible.protagonist = buildProtagonistState(state, chapter.number);
    changes.protagonist = true;
  }

  // Update character snapshots if new characters appeared
  const newCharacterSnapshots = buildMajorCharacterSnapshots(
    state,
    updatedBible.protagonist.identity.name,
    10
  );
  
  // Check for changes
  newCharacterSnapshots.forEach(newChar => {
    const existing = bible.majorCharacters.find(c => c.id === newChar.id);
    if (!existing || existing.status !== newChar.status || existing.cultivation !== newChar.cultivation) {
      changes.characters.push(newChar.id);
    }
  });
  
  if (changes.characters.length > 0) {
    updatedBible.majorCharacters = newCharacterSnapshots;
  }

  return {
    bible: updatedBible,
    changes,
  };
}

/**
 * Validate Lore Bible for consistency
 */
export function validateLoreBibleConsistency(bible: LoreBible): LoreBibleValidationResult {
  const errors: LoreBibleValidationResult['errors'] = [];
  const warnings: string[] = [];

  // Check protagonist state
  if (!bible.protagonist.identity.name || bible.protagonist.identity.name === 'Unknown Protagonist') {
    errors.push({
      field: 'protagonist.identity.name',
      message: 'Protagonist name is missing or unknown',
      severity: 'error',
    });
  }

  if (bible.protagonist.cultivation.realm === 'Unknown') {
    warnings.push('Protagonist cultivation level is unknown');
  }

  // Check for empty arrays that should have content
  if (bible.majorCharacters.length === 0) {
    warnings.push('No major characters defined in Lore Bible');
  }

  // Check for stale data
  const timeSinceUpdate = Date.now() - bible.updatedAt;
  if (timeSinceUpdate > 24 * 60 * 60 * 1000) { // 24 hours
    warnings.push('Lore Bible has not been updated in over 24 hours');
  }

  // Check narrative anchors
  if (!bible.narrativeAnchors.currentObjective) {
    warnings.push('No current objective defined');
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    warnings,
  };
}

/**
 * Format Lore Bible for prompt inclusion
 */
export function formatLoreBibleForPrompt(bible: LoreBible): string {
  const sections: string[] = [];

  sections.push('[CULTIVATION LORE BIBLE - SOURCE OF TRUTH]');
  sections.push(`As of Chapter ${bible.asOfChapter}`);
  sections.push('');

  // Protagonist section
  sections.push('=== PROTAGONIST STATE ===');
  sections.push(`Name: ${bible.protagonist.identity.name}`);
  if (bible.protagonist.identity.aliases.length > 0) {
    sections.push(`Aliases: ${bible.protagonist.identity.aliases.join(', ')}`);
  }
  sections.push(`Sect: ${bible.protagonist.identity.sect}`);
  sections.push(`Cultivation: ${bible.protagonist.cultivation.realm} - ${bible.protagonist.cultivation.stage}`);
  if (bible.protagonist.cultivation.physique) {
    sections.push(`Physique: ${bible.protagonist.cultivation.physique}`);
  }
  
  if (bible.protagonist.techniques.length > 0) {
    sections.push(`Techniques:`);
    bible.protagonist.techniques.forEach(t => {
      sections.push(`  - ${t.name} (${t.masteryLevel})`);
    });
  }
  
  if (bible.protagonist.inventory.equipped.length > 0) {
    sections.push(`Equipped: ${bible.protagonist.inventory.equipped.map(i => i.name).join(', ')}`);
  }
  if (bible.protagonist.inventory.storageRing.length > 0) {
    sections.push(`Storage: ${bible.protagonist.inventory.storageRing.map(i => i.name).join(', ')}`);
  }
  sections.push('');

  // World state
  sections.push('=== WORLD STATE ===');
  sections.push(`Current Realm: ${bible.worldState.currentRealm}`);
  sections.push(`Situation: ${bible.worldState.currentSituation}`);
  sections.push('');

  // Narrative anchors
  sections.push('=== NARRATIVE ANCHORS ===');
  sections.push(`Last Major Event (Ch ${bible.narrativeAnchors.lastMajorEventChapter}): ${bible.narrativeAnchors.lastMajorEvent}`);
  sections.push(`Current Objective: ${bible.narrativeAnchors.currentObjective}`);
  if (bible.narrativeAnchors.activeQuests.length > 0) {
    sections.push(`Active Quests: ${bible.narrativeAnchors.activeQuests.join(', ')}`);
  }
  if (bible.narrativeAnchors.pendingPromises.length > 0) {
    sections.push(`Pending Promises:`);
    bible.narrativeAnchors.pendingPromises.forEach(p => {
      sections.push(`  - ${p.description} (Ch ${p.madeInChapter})`);
    });
  }
  sections.push('');

  // Active conflicts
  if (bible.activeConflicts.length > 0) {
    sections.push('=== ACTIVE CONFLICTS ===');
    bible.activeConflicts.forEach(c => {
      sections.push(`- ${c.description} [${c.urgency.toUpperCase()}]`);
    });
    sections.push('');
  }

  // Karma debts
  if (bible.karmaDebts.length > 0) {
    sections.push('=== KARMA DEBTS ===');
    bible.karmaDebts.forEach(k => {
      sections.push(`- ${k.target} (${k.targetStatus}): ${k.consequence}`);
    });
    sections.push('');
  }

  // Major characters
  if (bible.majorCharacters.length > 0) {
    sections.push('=== KEY CHARACTERS ===');
    bible.majorCharacters.forEach(c => {
      const details = [c.name];
      if (c.cultivation) details.push(c.cultivation);
      if (c.relationshipToProtagonist) details.push(`(${c.relationshipToProtagonist})`);
      sections.push(`- ${details.join(' - ')}`);
    });
    sections.push('');
  }

  // Economic state (if available)
  if (bible.economicState) {
    sections.push('=== ECONOMIC STATE ===');
    sections.push(`Primary Currency: ${bible.economicState.primaryCurrency}`);
    if (bible.economicState.currentCondition) {
      sections.push(`Economic Condition: ${bible.economicState.currentCondition}`);
    }
    if (bible.economicState.standardPrices && bible.economicState.standardPrices.length > 0) {
      sections.push('Standard Prices:');
      bible.economicState.standardPrices.slice(0, 8).forEach(p => {
        const trendIndicator = p.trend === 'rising' ? '↑' : p.trend === 'falling' ? '↓' : '';
        sections.push(`  - ${p.item}: ${p.price.toLocaleString()} ${p.currency}${trendIndicator ? ` (${p.trend}${trendIndicator})` : ''}`);
      });
    }
    if (bible.economicState.protagonistWealth) {
      sections.push(`MC Wealth: ${bible.economicState.protagonistWealth}`);
    }
    if (bible.economicState.marketNotes) {
      sections.push(`Market Notes: ${bible.economicState.marketNotes}`);
    }
    sections.push('');
  }

  sections.push('[END LORE BIBLE]');

  return sections.join('\n');
}

/**
 * Compact format for token-constrained contexts
 */
export function formatLoreBibleCompact(bible: LoreBible): string {
  const parts: string[] = [];

  parts.push(`[LORE BIBLE Ch${bible.asOfChapter}]`);
  parts.push(`MC: ${bible.protagonist.identity.name} | ${bible.protagonist.cultivation.realm}-${bible.protagonist.cultivation.stage} | ${bible.protagonist.identity.sect}`);
  
  if (bible.protagonist.techniques.length > 0) {
    parts.push(`Tech: ${bible.protagonist.techniques.map(t => `${t.name}(${t.masteryLevel})`).join(', ')}`);
  }
  
  parts.push(`Objective: ${bible.narrativeAnchors.currentObjective}`);
  
  if (bible.activeConflicts.length > 0) {
    parts.push(`Conflicts: ${bible.activeConflicts.map(c => c.description.substring(0, 50)).join('; ')}`);
  }

  // Compact economic info
  if (bible.economicState) {
    const topPrices = bible.economicState.standardPrices.slice(0, 3)
      .map(p => `${p.item}:${p.price}`)
      .join(', ');
    parts.push(`Economy: ${bible.economicState.primaryCurrency} | ${topPrices}`);
  }

  return parts.join('\n');
}

// ============================================================================
// CLERK INTEGRATION - Delta Application and Persistence
// ============================================================================

import {
  LoreBibleWithHistory,
  LoreBibleDeltaEntry,
  LoreBibleSnapshot,
  LoreBibleDiff,
  LoreBibleDiffOptions,
  LoreBiblePersistOptions,
  LoreBibleLoadResult,
} from '../../types/loreBible';
import { ClerkDelta } from '../../types/clerk';
import { applyClerkDelta, DeltaApplyResult } from '../clerk/deltaApplicator';
import { generateUUID } from '../../utils/uuid';

// In-memory cache for the current Lore Bible
let currentLoreBibleCache: LoreBibleWithHistory | null = null;
let currentNovelId: string | null = null;

/**
 * Get the current Lore Bible for a novel, building it if necessary
 */
export function getOrBuildLoreBible(state: NovelState): LoreBibleWithHistory {
  // Check cache
  if (currentLoreBibleCache && currentNovelId === state.id) {
    // Verify it's up to date
    if (currentLoreBibleCache.asOfChapter === state.chapters.length) {
      return currentLoreBibleCache;
    }
  }

  // Build fresh
  const currentChapter = state.chapters.length;
  const bible = buildLoreBible(state, currentChapter);
  
  // Convert to history-enabled version
  const bibleWithHistory: LoreBibleWithHistory = {
    ...bible,
    deltaHistory: [],
    lastUpdateSource: 'rebuild',
  };

  // Update cache
  currentLoreBibleCache = bibleWithHistory;
  currentNovelId = state.id;

  return bibleWithHistory;
}

/**
 * Apply a Clerk delta to the Lore Bible and track history
 */
export function applyDeltaToLoreBible(
  bible: LoreBibleWithHistory,
  delta: ClerkDelta
): { bible: LoreBibleWithHistory; result: DeltaApplyResult } {
  // Apply the delta
  const result = applyClerkDelta(bible, delta);

  if (!result.success) {
    logger.warn('Delta application had errors', 'loreBibleService', {
      errors: result.errors,
    });
  }

  // Create history entry
  const historyEntry: LoreBibleDeltaEntry = {
    id: generateUUID(),
    chapterNumber: delta.chapterNumber,
    appliedAt: Date.now(),
    changesSummary: result.changesApplied,
    confidence: calculateDeltaConfidence(delta),
    warnings: delta.observations.warnings.length > 0 ? delta.observations.warnings : undefined,
    rawDelta: delta,
  };

  // Update the bible with history
  const updatedBible: LoreBibleWithHistory = {
    ...result.updatedBible,
    deltaHistory: [...(bible.deltaHistory || []), historyEntry],
    lastUpdateSource: 'clerk',
  };

  // Trim history if needed
  const maxHistory = updatedBible.maxHistoryEntries || 50;
  if (updatedBible.deltaHistory.length > maxHistory) {
    updatedBible.deltaHistory = updatedBible.deltaHistory.slice(-maxHistory);
  }

  // Update cache
  currentLoreBibleCache = updatedBible;

  logger.info('Applied Clerk delta to Lore Bible', 'loreBibleService', {
    chapterNumber: delta.chapterNumber,
    changesCount: result.changesApplied.length,
    historySize: updatedBible.deltaHistory.length,
  });

  return { bible: updatedBible, result };
}

/**
 * Calculate confidence score from delta observations
 */
function calculateDeltaConfidence(delta: ClerkDelta): number {
  const warnings = delta.observations.warnings.length;
  const criticalFlags = delta.observations.continuityFlags.filter(f => f.severity === 'critical').length;
  const warningFlags = delta.observations.continuityFlags.filter(f => f.severity === 'warning').length;

  // Start with 1.0 and deduct for issues
  let confidence = 1.0;
  confidence -= warnings * 0.05;
  confidence -= criticalFlags * 0.15;
  confidence -= warningFlags * 0.05;

  return Math.max(0.3, Math.min(1.0, confidence));
}

/**
 * Create a snapshot of the current Lore Bible
 */
export function createLoreBibleSnapshot(
  bible: LoreBible,
  reason: LoreBibleSnapshot['reason'] = 'auto'
): LoreBibleSnapshot {
  return {
    id: generateUUID(),
    chapterNumber: bible.asOfChapter,
    createdAt: Date.now(),
    reason,
    state: JSON.parse(JSON.stringify(bible)), // Deep clone
  };
}

/**
 * Restore Lore Bible from a snapshot
 */
export function restoreFromSnapshot(snapshot: LoreBibleSnapshot): LoreBibleWithHistory {
  const restored: LoreBibleWithHistory = {
    ...snapshot.state,
    deltaHistory: [{
      id: generateUUID(),
      chapterNumber: snapshot.chapterNumber,
      appliedAt: Date.now(),
      changesSummary: [`Restored from snapshot ${snapshot.id} (${snapshot.reason})`],
      confidence: 1.0,
    }],
    lastUpdateSource: 'manual',
  };

  currentLoreBibleCache = restored;
  
  logger.info('Restored Lore Bible from snapshot', 'loreBibleService', {
    snapshotId: snapshot.id,
    snapshotChapter: snapshot.chapterNumber,
    reason: snapshot.reason,
  });

  return restored;
}

/**
 * Compute diff between two Lore Bible versions
 */
export function computeLoreBibleDiff(
  oldBible: LoreBible,
  newBible: LoreBible,
  options: LoreBibleDiffOptions = {}
): LoreBibleDiff {
  const changes: LoreBibleDiff['changes'] = [];
  const includeValues = options.includeValues ?? false;
  const categories = options.categories || [
    'protagonist', 'characters', 'worldState', 'narrativeAnchors', 'conflicts', 'karmaDebts', 'powerSystem'
  ];

  // Compare protagonist
  if (categories.includes('protagonist')) {
    const oldProt = oldBible.protagonist;
    const newProt = newBible.protagonist;

    if (oldProt.cultivation.realm !== newProt.cultivation.realm) {
      changes.push({
        category: 'protagonist',
        type: 'modified',
        description: `Cultivation realm: ${oldProt.cultivation.realm} → ${newProt.cultivation.realm}`,
        oldValue: includeValues ? oldProt.cultivation.realm : undefined,
        newValue: includeValues ? newProt.cultivation.realm : undefined,
      });
    }

    if (oldProt.cultivation.stage !== newProt.cultivation.stage) {
      changes.push({
        category: 'protagonist',
        type: 'modified',
        description: `Cultivation stage: ${oldProt.cultivation.stage} → ${newProt.cultivation.stage}`,
      });
    }

    // Check techniques
    const oldTechs = new Set(oldProt.techniques.map(t => t.name));
    const newTechs = new Set(newProt.techniques.map(t => t.name));
    
    for (const tech of newProt.techniques) {
      if (!oldTechs.has(tech.name)) {
        changes.push({
          category: 'protagonist',
          type: 'added',
          description: `Learned technique: ${tech.name}`,
        });
      }
    }

    for (const tech of oldProt.techniques) {
      if (!newTechs.has(tech.name)) {
        changes.push({
          category: 'protagonist',
          type: 'removed',
          description: `Lost technique: ${tech.name}`,
        });
      }
    }
  }

  // Compare characters
  if (categories.includes('characters')) {
    const oldChars = new Map(oldBible.majorCharacters.map(c => [c.id, c]));
    const newChars = new Map(newBible.majorCharacters.map(c => [c.id, c]));

    Array.from(newChars.entries()).forEach(([id, newChar]) => {
      const oldChar = oldChars.get(id);
      if (!oldChar) {
        changes.push({
          category: 'characters',
          type: 'added',
          description: `New character: ${newChar.name}`,
        });
      } else if (oldChar.status !== newChar.status) {
        changes.push({
          category: 'characters',
          type: 'modified',
          description: `${newChar.name} status: ${oldChar.status} → ${newChar.status}`,
        });
      }
    });
  }

  // Compare conflicts
  if (categories.includes('conflicts')) {
    const oldConflicts = new Map(oldBible.activeConflicts.map(c => [c.id, c]));
    const newConflicts = new Map(newBible.activeConflicts.map(c => [c.id, c]));

    Array.from(newConflicts.entries()).forEach(([id, newConflict]) => {
      const oldConflict = oldConflicts.get(id);
      if (!oldConflict) {
        changes.push({
          category: 'conflicts',
          type: 'added',
          description: `New conflict: ${newConflict.description.substring(0, 50)}`,
        });
      } else if (oldConflict.status !== newConflict.status) {
        changes.push({
          category: 'conflicts',
          type: 'modified',
          description: `Conflict status: ${oldConflict.status} → ${newConflict.status}`,
        });
      }
    });
  }

  return {
    fromVersion: oldBible.version,
    toVersion: newBible.version,
    fromChapter: oldBible.asOfChapter,
    toChapter: newBible.asOfChapter,
    changes,
  };
}

/**
 * Get delta history for the current Lore Bible
 */
export function getLoreBibleHistory(): LoreBibleDeltaEntry[] {
  return currentLoreBibleCache?.deltaHistory || [];
}

/**
 * Clear the Lore Bible cache (useful for testing or switching novels)
 */
export function clearLoreBibleCache(): void {
  currentLoreBibleCache = null;
  currentNovelId = null;
  logger.debug('Lore Bible cache cleared', 'loreBibleService');
}

/**
 * Get summary statistics for the Lore Bible
 */
export function getLoreBibleStats(bible: LoreBible): {
  protagonistTechniques: number;
  protagonistItems: number;
  majorCharacters: number;
  activeConflicts: number;
  karmaDebts: number;
  pendingPromises: number;
  version: number;
  lastUpdated: string;
} {
  return {
    protagonistTechniques: bible.protagonist.techniques.length,
    protagonistItems: bible.protagonist.inventory.equipped.length + bible.protagonist.inventory.storageRing.length,
    majorCharacters: bible.majorCharacters.length,
    activeConflicts: bible.activeConflicts.length,
    karmaDebts: bible.karmaDebts.length,
    pendingPromises: bible.narrativeAnchors.pendingPromises.length,
    version: bible.version,
    lastUpdated: new Date(bible.updatedAt).toISOString(),
  };
}

// ============================================================================
// PERSISTENCE - LocalStorage and IndexedDB support
// ============================================================================

const LORE_BIBLE_STORAGE_KEY = 'loreBible';
const LORE_BIBLE_HISTORY_KEY = 'loreBibleHistory';

/**
 * Persist Lore Bible to localStorage
 * For larger data or offline support, consider using IndexedDB
 */
export async function persistLoreBibleToStorage(
  bible: LoreBibleWithHistory,
  options: LoreBiblePersistOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const includeHistory = options.includeHistory ?? true;
    const maxSize = options.maxUncompressedSize ?? 500000; // 500KB

    // Prepare data
    const bibleData = includeHistory ? bible : {
      ...bible,
      deltaHistory: [], // Exclude history to save space
    };

    const jsonData = JSON.stringify(bibleData);

    // Check size
    if (jsonData.length > maxSize) {
      logger.warn('Lore Bible data exceeds recommended size', 'loreBibleService', {
        size: jsonData.length,
        maxSize,
      });
      
      // Try saving without history
      if (includeHistory) {
        const compactData = JSON.stringify({
          ...bible,
          deltaHistory: bible.deltaHistory.slice(-10), // Keep only last 10
        });
        
        localStorage.setItem(`${LORE_BIBLE_STORAGE_KEY}_${bible.novelId}`, compactData);
        logger.info('Persisted Lore Bible with reduced history', 'loreBibleService', {
          novelId: bible.novelId,
          size: compactData.length,
        });
        return { success: true };
      }
    }

    // Save to localStorage
    localStorage.setItem(`${LORE_BIBLE_STORAGE_KEY}_${bible.novelId}`, jsonData);

    logger.info('Persisted Lore Bible to localStorage', 'loreBibleService', {
      novelId: bible.novelId,
      version: bible.version,
      size: jsonData.length,
    });

    return { success: true };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to persist Lore Bible', 'loreBibleService', error instanceof Error ? error : undefined);
    return { success: false, error: errorMessage };
  }
}

/**
 * Load Lore Bible from localStorage
 */
export async function loadLoreBibleFromStorage(
  novelId: string
): Promise<LoreBibleLoadResult> {
  try {
    const key = `${LORE_BIBLE_STORAGE_KEY}_${novelId}`;
    const data = localStorage.getItem(key);

    if (!data) {
      logger.debug('No persisted Lore Bible found', 'loreBibleService', { novelId });
      return {
        bible: null,
        loadedFromStorage: false,
        wasCompressed: false,
      };
    }

    const parsed = JSON.parse(data) as LoreBibleWithHistory;

    // Validate basic structure
    if (!parsed.novelId || !parsed.protagonist || !parsed.version) {
      logger.warn('Persisted Lore Bible has invalid structure', 'loreBibleService', { novelId });
      return {
        bible: null,
        loadedFromStorage: false,
        wasCompressed: false,
        error: 'Invalid Lore Bible structure',
      };
    }

    // Update cache
    currentLoreBibleCache = parsed;
    currentNovelId = novelId;

    logger.info('Loaded Lore Bible from localStorage', 'loreBibleService', {
      novelId,
      version: parsed.version,
      asOfChapter: parsed.asOfChapter,
      historySize: parsed.deltaHistory?.length || 0,
    });

    return {
      bible: parsed,
      history: parsed.deltaHistory,
      loadedFromStorage: true,
      wasCompressed: false,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load Lore Bible from storage', 'loreBibleService', error instanceof Error ? error : undefined);
    return {
      bible: null,
      loadedFromStorage: false,
      wasCompressed: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete persisted Lore Bible
 */
export function deleteLoreBibleFromStorage(novelId: string): void {
  const key = `${LORE_BIBLE_STORAGE_KEY}_${novelId}`;
  localStorage.removeItem(key);
  logger.debug('Deleted Lore Bible from localStorage', 'loreBibleService', { novelId });
}

/**
 * Check if a persisted Lore Bible exists
 */
export function hasPersistedLoreBible(novelId: string): boolean {
  const key = `${LORE_BIBLE_STORAGE_KEY}_${novelId}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Get metadata about persisted Lore Bible without loading full data
 */
export function getPersistedLoreBibleMetadata(novelId: string): {
  exists: boolean;
  size?: number;
  version?: number;
  asOfChapter?: number;
  lastUpdated?: string;
} | null {
  try {
    const key = `${LORE_BIBLE_STORAGE_KEY}_${novelId}`;
    const data = localStorage.getItem(key);

    if (!data) {
      return { exists: false };
    }

    // Parse just enough to get metadata
    const parsed = JSON.parse(data);

    return {
      exists: true,
      size: data.length,
      version: parsed.version,
      asOfChapter: parsed.asOfChapter,
      lastUpdated: parsed.updatedAt ? new Date(parsed.updatedAt).toISOString() : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Auto-persist Lore Bible after updates (debounced)
 * Call this in applyDeltaToLoreBible for automatic persistence
 */
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleLoreBiblePersistence(bible: LoreBibleWithHistory, delayMs: number = 5000): void {
  // Clear existing timeout
  if (persistTimeout) {
    clearTimeout(persistTimeout);
  }

  // Schedule new persistence
  persistTimeout = setTimeout(async () => {
    await persistLoreBibleToStorage(bible);
    persistTimeout = null;
  }, delayMs);
}
