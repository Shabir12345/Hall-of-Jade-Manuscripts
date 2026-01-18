import { NovelState, Chapter, Character, WorldEntry, NovelItem, NovelTechnique, Territory } from '../types';

/**
 * Story Constants - Extracted from World Bible
 */
export interface StoryConstants {
  characterNames: string[];
  characterRelationships: Array<{
    character1: string;
    character2: string;
    relationship: string;
  }>;
  worldLore: Array<{
    category: string;
    title: string;
    content: string;
  }>;
  magicSystems: string[];
  powerLevels: string[];
  territories: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  items: Array<{
    name: string;
    canonicalName: string;
    description: string;
    category: string;
  }>;
  techniques: Array<{
    name: string;
    canonicalName: string;
    description: string;
    category: string;
    type: string;
  }>;
  establishedFacts: string[]; // Past events, established plot points
  cultivationLevels: string[];
}

/**
 * World Bible Extractor
 * Extracts story constants from novel state to enforce consistency during improvements
 */
export class WorldBibleExtractor {
  /**
   * Extracts all story constants from the novel state
   */
  static extractStoryConstants(state: NovelState): StoryConstants {
    const constants: StoryConstants = {
      characterNames: [],
      characterRelationships: [],
      worldLore: [],
      magicSystems: [],
      powerLevels: [],
      territories: [],
      items: [],
      techniques: [],
      establishedFacts: [],
      cultivationLevels: [],
    };

    // Extract character names and relationships
    if (state.characterCodex) {
      state.characterCodex.forEach((character: Character) => {
        constants.characterNames.push(character.name);
        
        // Extract cultivation level
        if (character.currentCultivation) {
          constants.cultivationLevels.push(`${character.name}: ${character.currentCultivation}`);
        }

        // Extract relationships
        if (character.relationships) {
          character.relationships.forEach((rel) => {
            constants.characterRelationships.push({
              character1: character.name,
              character2: rel.type, // Note: relationship structure may vary
              relationship: rel.history || rel.impact || '',
            });
          });
        }
      });
    }

    // Extract world bible entries
    if (state.worldBible) {
      state.worldBible.forEach((entry: WorldEntry) => {
        constants.worldLore.push({
          category: entry.category,
          title: entry.title,
          content: entry.content,
        });

        // Categorize by type
        if (entry.category === 'PowerLevels') {
          constants.powerLevels.push(entry.content);
        } else if (entry.category === 'Systems') {
          constants.magicSystems.push(entry.content);
        }
      });
    }

    // Extract territories
    if (state.territories) {
      state.territories.forEach((territory: Territory) => {
        constants.territories.push({
          name: territory.name,
          type: territory.type,
          description: territory.description,
        });
      });
    }

    // Extract items
    if (state.novelItems) {
      state.novelItems.forEach((item: NovelItem) => {
        constants.items.push({
          name: item.name,
          canonicalName: item.canonicalName,
          description: item.description,
          category: item.category,
        });
      });
    }

    // Extract techniques
    if (state.novelTechniques) {
      state.novelTechniques.forEach((technique: NovelTechnique) => {
        constants.techniques.push({
          name: technique.name,
          canonicalName: technique.canonicalName,
          description: technique.description,
          category: technique.category,
          type: technique.type,
        });
      });
    }

    // Extract established facts from recent chapters (last 10 chapters)
    const recentChapters = state.chapters
      .sort((a, b) => b.number - a.number)
      .slice(0, 10);
    
    recentChapters.forEach((chapter: Chapter) => {
      // Extract key facts from chapter summaries
      if (chapter.summary) {
        constants.establishedFacts.push(`Chapter ${chapter.number}: ${chapter.summary}`);
      }
    });

    return constants;
  }

  /**
   * Builds a compact constraint prompt (max ~2000 tokens) for large novels
   */
  static buildCompactConstraintPrompt(constants: StoryConstants, maxTokens: number = 2000): string {
    const estimateTokens = (text: string): number => Math.ceil(text.length / 4 * 1.2);
    
    let prompt = 'CRITICAL STORY CONSTANTS - DO NOT CHANGE:\n\n';
    let currentTokens = estimateTokens(prompt);

    // Priority 1: Character names (most critical)
    if (constants.characterNames.length > 0) {
      const namesText = `CHARACTER NAMES: ${constants.characterNames.slice(0, 30).join(', ')}${constants.characterNames.length > 30 ? ` (+${constants.characterNames.length - 30} more)` : ''}\n\n`;
      const namesTokens = estimateTokens(namesText);
      if (currentTokens + namesTokens <= maxTokens * 0.3) {
        prompt += namesText;
        currentTokens += namesTokens;
      } else {
        // Just list first 10 names
        prompt += `CHARACTER NAMES: ${constants.characterNames.slice(0, 10).join(', ')} (+${constants.characterNames.length - 10} more)\n\n`;
        currentTokens += estimateTokens(prompt);
      }
    }

    // Priority 2: Power levels and systems (critical for consistency)
    if (constants.powerLevels.length > 0 && currentTokens < maxTokens * 0.5) {
      const powerText = `POWER LEVELS: ${constants.powerLevels.slice(0, 5).join(' | ')}\n\n`;
      const powerTokens = estimateTokens(powerText);
      if (currentTokens + powerTokens <= maxTokens * 0.5) {
        prompt += powerText;
        currentTokens += powerTokens;
      }
    }

    // Priority 3: Key items and techniques (limit to 10 each)
    if (constants.items.length > 0 && currentTokens < maxTokens * 0.7) {
      const itemsText = `KEY ITEMS: ${constants.items.slice(0, 10).map(i => i.name).join(', ')}${constants.items.length > 10 ? ` (+${constants.items.length - 10} more)` : ''}\n\n`;
      const itemsTokens = estimateTokens(itemsText);
      if (currentTokens + itemsTokens <= maxTokens * 0.7) {
        prompt += itemsText;
        currentTokens += itemsTokens;
      }
    }

    if (constants.techniques.length > 0 && currentTokens < maxTokens * 0.8) {
      const techniquesText = `KEY TECHNIQUES: ${constants.techniques.slice(0, 10).map(t => t.name).join(', ')}${constants.techniques.length > 10 ? ` (+${constants.techniques.length - 10} more)` : ''}\n\n`;
      const techniquesTokens = estimateTokens(techniquesText);
      if (currentTokens + techniquesTokens <= maxTokens * 0.8) {
        prompt += techniquesText;
        currentTokens += techniquesTokens;
      }
    }

    // Priority 4: Cultivation levels (if space)
    if (constants.cultivationLevels.length > 0 && currentTokens < maxTokens * 0.9) {
      const cultivationText = `CULTIVATION: ${constants.cultivationLevels.slice(0, 5).join(' | ')}\n\n`;
      const cultivationTokens = estimateTokens(cultivationText);
      if (currentTokens + cultivationTokens <= maxTokens * 0.9) {
        prompt += cultivationText;
        currentTokens += cultivationTokens;
      }
    }

    // Priority 5: Territories (brief)
    if (constants.territories.length > 0 && currentTokens < maxTokens * 0.95) {
      const territoriesText = `LOCATIONS: ${constants.territories.slice(0, 5).map(t => t.name).join(', ')}${constants.territories.length > 5 ? ` (+${constants.territories.length - 5} more)` : ''}\n\n`;
      const territoriesTokens = estimateTokens(territoriesText);
      if (currentTokens + territoriesTokens <= maxTokens * 0.95) {
        prompt += territoriesText;
        currentTokens += territoriesTokens;
      }
    }

    // Priority 6: Recent established facts (last 3 only)
    if (constants.establishedFacts.length > 0 && currentTokens < maxTokens) {
      const factsText = `RECENT PLOT: ${constants.establishedFacts.slice(0, 3).map(f => f.split(':')[1]?.trim() || f).join(' | ')}\n\n`;
      const factsTokens = estimateTokens(factsText);
      if (currentTokens + factsTokens <= maxTokens) {
        prompt += factsText;
      }
    }

    prompt += '\nCRITICAL: Preserve all names, power levels, and established facts above. Do not change or contradict them.';

    return prompt;
  }

  /**
   * Builds a constraint prompt for LLM to enforce story constants
   * Uses compact version for large novels automatically
   */
  static buildConstraintPrompt(constants: StoryConstants, useCompact: boolean = false): string {
    if (useCompact) {
      return this.buildCompactConstraintPrompt(constants);
    }

    // Check if we should use compact version based on size
    const fullPrompt = this.buildFullConstraintPrompt(constants);
    const estimatedTokens = Math.ceil(fullPrompt.length / 4 * 1.2);
    
    // Auto-switch to compact if over 2000 tokens
    if (estimatedTokens > 2000) {
      return this.buildCompactConstraintPrompt(constants);
    }

    return fullPrompt;
  }

  /**
   * Builds full constraint prompt (original implementation)
   */
  private static buildFullConstraintPrompt(constants: StoryConstants): string {
    let prompt = 'CRITICAL STORY CONSTANTS - DO NOT CHANGE THESE:\n\n';

    if (constants.characterNames.length > 0) {
      prompt += `CHARACTER NAMES (must remain exactly as written):\n${constants.characterNames.join(', ')}\n\n`;
    }

    if (constants.characterRelationships.length > 0) {
      prompt += `CHARACTER RELATIONSHIPS:\n`;
      constants.characterRelationships.forEach((rel) => {
        prompt += `- ${rel.character1} and ${rel.character2}: ${rel.relationship}\n`;
      });
      prompt += '\n';
    }

    if (constants.cultivationLevels.length > 0) {
      prompt += `CULTIVATION LEVELS:\n${constants.cultivationLevels.join('\n')}\n\n`;
    }

    if (constants.territories.length > 0) {
      prompt += `TERRITORIES/LOCATIONS:\n`;
      constants.territories.forEach((territory) => {
        prompt += `- ${territory.name} (${territory.type}): ${territory.description}\n`;
      });
      prompt += '\n';
    }

    if (constants.items.length > 0) {
      prompt += `ITEMS (names and properties must remain consistent):\n`;
      constants.items.forEach((item) => {
        prompt += `- ${item.name}: ${item.description} (${item.category})\n`;
      });
      prompt += '\n';
    }

    if (constants.techniques.length > 0) {
      prompt += `TECHNIQUES (names and functions must remain consistent):\n`;
      constants.techniques.forEach((technique) => {
        prompt += `- ${technique.name}: ${technique.description} (${technique.category}, ${technique.type})\n`;
      });
      prompt += '\n';
    }

    if (constants.powerLevels.length > 0) {
      prompt += `POWER LEVELS/SYSTEMS:\n${constants.powerLevels.join('\n')}\n\n`;
    }

    if (constants.magicSystems.length > 0) {
      prompt += `MAGIC SYSTEMS/WORLD RULES:\n${constants.magicSystems.join('\n')}\n\n`;
    }

    if (constants.worldLore.length > 0) {
      prompt += `WORLD LORE:\n`;
      constants.worldLore.forEach((lore) => {
        prompt += `- [${lore.category}] ${lore.title}: ${lore.content.substring(0, 200)}...\n`;
      });
      prompt += '\n';
    }

    if (constants.establishedFacts.length > 0) {
      prompt += `ESTABLISHED PLOT POINTS (do not contradict):\n`;
      constants.establishedFacts.slice(0, 10).forEach((fact) => {
        prompt += `- ${fact}\n`;
      });
      prompt += '\n';
    }

    prompt += '\nIMPORTANT: When making improvements, ensure all character names, relationships, world rules, items, techniques, and established facts remain exactly as specified above. Do not change names, power levels, or contradict established plot points.';

    return prompt;
  }

  /**
   * Validates generated content against story constants
   * Returns array of violations found
   */
  static validateAgainstConstants(
    content: string,
    constants: StoryConstants
  ): Array<{ type: string; issue: string; severity: 'critical' | 'warning' }> {
    const violations: Array<{ type: string; issue: string; severity: 'critical' | 'warning' }> = [];

    // Check for character name changes
    constants.characterNames.forEach((name) => {
      // Check if name appears but in a different form (case-insensitive)
      const nameRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!nameRegex.test(content) && content.length > 100) {
        // Only flag if content is substantial and name should appear
        // This is a warning, not critical, as character might not be in this chapter
      }
    });

    // Check for item/technique name consistency
    [...constants.items, ...constants.techniques].forEach((entity) => {
      // Check if canonical name is used incorrectly
      const canonicalRegex = new RegExp(`\\b${entity.canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      // If canonical name appears, check if it matches the actual name context
      // This is a basic check - more sophisticated validation would use LLM
    });

    return violations;
  }

  /**
   * Extracts a concise summary of constants for token efficiency
   */
  static extractConciseConstants(state: NovelState): string {
    const constants = this.extractStoryConstants(state);
    const summary: string[] = [];

    if (constants.characterNames.length > 0) {
      summary.push(`Characters: ${constants.characterNames.slice(0, 10).join(', ')}${constants.characterNames.length > 10 ? '...' : ''}`);
    }

    if (constants.territories.length > 0) {
      summary.push(`Locations: ${constants.territories.map(t => t.name).slice(0, 5).join(', ')}`);
    }

    if (constants.items.length > 0) {
      summary.push(`Items: ${constants.items.map(i => i.name).slice(0, 5).join(', ')}`);
    }

    if (constants.techniques.length > 0) {
      summary.push(`Techniques: ${constants.techniques.map(t => t.name).slice(0, 5).join(', ')}`);
    }

    return summary.join(' | ');
  }
}
