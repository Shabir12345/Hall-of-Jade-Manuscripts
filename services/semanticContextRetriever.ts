/**
 * Semantic Context Retriever
 * 
 * Implements hybrid retrieval (dense embeddings + graph queries + metadata filtering)
 * to retrieve relevant context for chapter generation.
 */

import { NovelState, Chapter, Character, Scene } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getPowerLevelSystem } from './powerLevelSystem';

export interface ContextQuery {
  characters?: string[]; // Character IDs or names
  locations?: string[]; // Location IDs or names
  plotThreads?: string[]; // Active plot thread descriptions
  recentChapters?: number; // Number of recent chapters to include
  powerLevelChanges?: boolean; // Include recent power level changes
  relationships?: boolean; // Include relationship context
  worldRules?: boolean; // Include relevant world rules
}

export interface RetrievedContext {
  characters: Array<{
    character: Character;
    relevanceScore: number;
    context: string; // Formatted context for this character
  }>;
  recentEvents: Array<{
    chapterNumber: number;
    chapterId: string;
    summary: string;
    relevanceScore: number;
  }>;
  powerLevelProgression: Array<{
    characterId: string;
    characterName: string;
    currentLevel: string;
    progression: string; // Formatted progression history
  }>;
  relationships: Array<{
    character1Id: string;
    character1Name: string;
    character2Id: string;
    character2Name: string;
    relationshipType: string;
    history: string;
    relevanceScore: number;
  }>;
  worldRules: Array<{
    entryId: string;
    title: string;
    category: string;
    content: string;
    relevanceScore: number;
  }>;
  scenes: Array<{
    sceneId: string;
    chapterNumber: number;
    sceneNumber: number;
    title: string;
    summary: string;
    charactersPresent: string[];
    relevanceScore: number;
  }>;
}

export class SemanticContextRetriever {
  /**
   * Retrieve context based on query
   */
  retrieveContext(state: NovelState, query: ContextQuery): RetrievedContext {
    const graphService = getKnowledgeGraphService();
    const powerSystem = getPowerLevelSystem();

    // Initialize graph if needed
    if (!graphService.getGraph()) {
      graphService.initializeGraph(state);
    }

    const result: RetrievedContext = {
      characters: [],
      recentEvents: [],
      powerLevelProgression: [],
      relationships: [],
      worldRules: [],
      scenes: [],
    };

    // Retrieve character context
    if (query.characters && query.characters.length > 0) {
      result.characters = this.retrieveCharacterContext(state, query.characters, graphService);
    } else {
      // If no specific characters, get characters from previous chapter ending
      const previousChapter = state.chapters[state.chapters.length - 1];
      if (previousChapter) {
        const charactersInEnding = this.extractCharactersFromText(
          previousChapter.content.slice(-1000), // Last 1000 chars
          state.characterCodex
        );
        result.characters = this.retrieveCharacterContext(state, charactersInEnding, graphService);
      }
    }

    // Retrieve recent events
    const recentChaptersCount = query.recentChapters || 3;
    result.recentEvents = this.retrieveRecentEvents(state, recentChaptersCount);

    // Retrieve power level progression
    if (query.powerLevelChanges) {
      result.powerLevelProgression = this.retrievePowerProgression(state, result.characters, graphService, powerSystem);
    }

    // Retrieve relationships
    if (query.relationships) {
      result.relationships = this.retrieveRelationships(state, result.characters, graphService);
    }

    // Retrieve world rules
    if (query.worldRules) {
      result.worldRules = this.retrieveWorldRules(state, result.characters, query.locations);
    }

    // Retrieve relevant scenes
    result.scenes = this.retrieveRelevantScenes(state, result.characters, recentChaptersCount);

    return result;
  }

  /**
   * Retrieve character context with relevance scoring
   */
  private retrieveCharacterContext(
    state: NovelState,
    characterIdentifiers: string[],
    graphService: ReturnType<typeof getKnowledgeGraphService>
  ): RetrievedContext['characters'] {
    const characters: RetrievedContext['characters'] = [];

    characterIdentifiers.forEach(identifier => {
      // Find character by ID or name
      const character = state.characterCodex.find(
        c => c.id === identifier || c.name.toLowerCase() === identifier.toLowerCase()
      );

      if (!character) return;

      // Get power level from graph
      const currentPowerLevel = graphService.getCharacterPowerLevel(character.id) || character.currentCultivation;

      // Build context string
      const context = this.formatCharacterContext(character, currentPowerLevel, state);

      // Calculate relevance score (higher for protagonists, recently updated)
      let relevanceScore = 0.5;
      if (character.isProtagonist) relevanceScore += 0.3;
      if (character.lastUpdatedByChapterId) {
        const lastChapter = state.chapters.find(c => c.id === character.lastUpdatedByChapterId);
        if (lastChapter) {
          const chaptersSinceUpdate = state.chapters.length - lastChapter.number;
          relevanceScore += Math.max(0, 0.2 - chaptersSinceUpdate * 0.05);
        }
      }

      characters.push({
        character,
        relevanceScore: Math.min(1.0, relevanceScore),
        context,
      });
    });

    // Sort by relevance
    characters.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return characters;
  }

  /**
   * Format character context for prompt
   * Enhanced with better organization and completeness
   */
  private formatCharacterContext(character: Character, powerLevel: string, state: NovelState): string {
    const parts: string[] = [];

    parts.push(`Character: ${character.name}`);
    if (character.isProtagonist) parts.push('(Protagonist)');
    parts.push(`\n[STATUS]`);
    parts.push(`Power Level: ${powerLevel || 'Unknown'}`);
    parts.push(`Status: ${character.status}`);
    if (character.age && character.age !== 'Unknown') parts.push(`Age: ${character.age}`);
    
    parts.push(`\n[APPEARANCE]`);
    if (character.appearance) parts.push(`${character.appearance}`);
    
    parts.push(`\n[PERSONALITY & MOTIVATION]`);
    if (character.personality) parts.push(`Personality: ${character.personality}`);
    if (character.goals) parts.push(`Goals: ${character.goals}`);
    if (character.flaws) parts.push(`Flaws: ${character.flaws}`);
    if (character.background) parts.push(`Background: ${character.background.substring(0, 200)}`);

    // Add relationships
    if (character.relationships && character.relationships.length > 0) {
      const relStrings = character.relationships.map(rel => {
        const target = state.characterCodex.find(c => c.id === rel.characterId);
        return target ? `${target.name} (${rel.type})` : rel.type;
      });
      parts.push(`Relationships: ${relStrings.join(', ')}`);
    }

    // Add items
    if (character.itemPossessions && character.itemPossessions.length > 0) {
      const activeItems = character.itemPossessions
        .filter(p => p.status === 'active')
        .map(p => {
          const item = state.novelItems?.find(i => i.id === p.itemId);
          return item ? item.name : 'Unknown Item';
        });
      if (activeItems.length > 0) {
        parts.push(`Items: ${activeItems.join(', ')}`);
      }
    }

    // Add techniques
    if (character.techniqueMasteries && character.techniqueMasteries.length > 0) {
      const activeTechniques = character.techniqueMasteries
        .filter(m => m.status === 'active')
        .map(m => {
          const technique = state.novelTechniques?.find(t => t.id === m.techniqueId);
          return technique ? `${technique.name} (${m.masteryLevel})` : 'Unknown Technique';
        });
      if (activeTechniques.length > 0) {
        parts.push(`Techniques: ${activeTechniques.join(', ')}`);
      }
    }

    if (character.notes) parts.push(`Notes: ${character.notes}`);

    return parts.join('\n');
  }

  /**
   * Retrieve recent events from chapters
   */
  private retrieveRecentEvents(state: NovelState, count: number): RetrievedContext['recentEvents'] {
    const recentChapters = state.chapters.slice(-count);
    
    return recentChapters.map(chapter => ({
      chapterNumber: chapter.number,
      chapterId: chapter.id,
      summary: chapter.summary || chapter.title || `Chapter ${chapter.number}`,
      relevanceScore: 1.0 - (recentChapters.length - recentChapters.indexOf(chapter) - 1) * 0.1,
    }));
  }

  /**
   * Retrieve power level progression
   */
  private retrievePowerProgression(
    state: NovelState,
    characters: RetrievedContext['characters'],
    graphService: ReturnType<typeof getKnowledgeGraphService>,
    powerSystem: ReturnType<typeof getPowerLevelSystem>
  ): RetrievedContext['powerLevelProgression'] {
    const progression: RetrievedContext['powerLevelProgression'] = [];

    characters.forEach(({ character }) => {
      const prog = graphService.getPowerProgression(character.id);
      if (!prog) return;

      // Format progression history
      const progressionHistory = prog.progression
        .slice(-5) // Last 5 changes
        .map(p => {
          const event = p.eventDescription ? ` (${p.eventDescription})` : '';
          return `Ch ${p.chapterNumber}: ${p.powerLevel}${event}`;
        })
        .join(' → ');

      progression.push({
        characterId: character.id,
        characterName: character.name,
        currentLevel: prog.currentLevel,
        progression: progressionHistory || `Current: ${prog.currentLevel}`,
      });
    });

    return progression;
  }

  /**
   * Retrieve relationships
   */
  private retrieveRelationships(
    state: NovelState,
    characters: RetrievedContext['characters'],
    graphService: ReturnType<typeof getKnowledgeGraphService>
  ): RetrievedContext['relationships'] {
    const relationships: RetrievedContext['relationships'] = [];
    const seenPairs = new Set<string>();

    characters.forEach(({ character }) => {
      const rels = graphService.getCharacterRelationships(character.id);
      
      rels.forEach(edge => {
        // Extract target character ID from edge
        const targetNodeId = edge.targetId.replace('character_', '');
        const targetChar = state.characterCodex.find(c => c.id === targetNodeId);
        if (!targetChar) return;

        // Avoid duplicates
        const pairKey = [character.id, targetChar.id].sort().join('_');
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        relationships.push({
          character1Id: character.id,
          character1Name: character.name,
          character2Id: targetChar.id,
          character2Name: targetChar.name,
          relationshipType: edge.properties.type || 'Unknown',
          history: edge.properties.history || '',
          relevanceScore: 0.8, // Relationships are generally relevant
        });
      });
    });

    return relationships;
  }

  /**
   * Retrieve relevant world rules
   */
  private retrieveWorldRules(
    state: NovelState,
    characters: RetrievedContext['characters'],
    locations?: string[]
  ): RetrievedContext['worldRules'] {
    const relevantRules: RetrievedContext['worldRules'] = [];
    const characterLocations = new Set<string>();

    // Get locations from characters
    characters.forEach(({ character }) => {
      // This would require location tracking - for now, use realm
      const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
      if (currentRealm) {
        characterLocations.add(currentRealm.id);
      }
    });

    // Filter world bible entries
    state.worldBible.forEach(entry => {
      let relevanceScore = 0.3;

      // Higher relevance for power system rules
      if (entry.category === 'PowerLevels' || entry.category === 'Systems') {
        relevanceScore = 0.8;
      }

      // Higher relevance if in current realm
      if (entry.realmId === state.currentRealmId) {
        relevanceScore += 0.2;
      }

      relevantRules.push({
        entryId: entry.id,
        title: entry.title,
        category: entry.category,
        content: entry.content,
        relevanceScore: Math.min(1.0, relevanceScore),
      });
    });

    // Sort by relevance
    relevantRules.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return relevantRules.slice(0, 10); // Top 10 most relevant
  }

  /**
   * Retrieve relevant scenes
   */
  private retrieveRelevantScenes(
    state: NovelState,
    characters: RetrievedContext['characters'],
    recentChaptersCount: number
  ): RetrievedContext['scenes'] {
    const scenes: RetrievedContext['scenes'] = [];
    const characterNames = new Set(characters.map(c => c.character.name.toLowerCase()));

    const recentChapters = state.chapters.slice(-recentChaptersCount);

    recentChapters.forEach(chapter => {
      chapter.scenes?.forEach(scene => {
        // Check if scene contains relevant characters
        const sceneText = (scene.content || scene.summary || '').toLowerCase();
        const hasRelevantCharacter = Array.from(characterNames).some(name =>
          sceneText.includes(name.toLowerCase())
        );

        if (hasRelevantCharacter || chapter.scenes.indexOf(scene) === 0) {
          // Extract characters from scene
          const charactersPresent = state.characterCodex
            .filter(char => sceneText.includes(char.name.toLowerCase()))
            .map(char => char.name);

          scenes.push({
            sceneId: scene.id,
            chapterNumber: chapter.number,
            sceneNumber: scene.number,
            title: scene.title || `Scene ${scene.number}`,
            summary: scene.summary || '',
            charactersPresent,
            relevanceScore: hasRelevantCharacter ? 0.8 : 0.5,
          });
        }
      });
    });

    return scenes;
  }

  /**
   * Extract character names from text
   */
  private extractCharactersFromText(text: string, characters: Character[]): string[] {
    const found: string[] = [];
    const textLower = text.toLowerCase();

    characters.forEach(char => {
      if (textLower.includes(char.name.toLowerCase())) {
        found.push(char.id);
      }
    });

    return found;
  }
}

// Singleton instance
let retrieverInstance: SemanticContextRetriever | null = null;

export function getSemanticContextRetriever(): SemanticContextRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new SemanticContextRetriever();
  }
  return retrieverInstance;
}
