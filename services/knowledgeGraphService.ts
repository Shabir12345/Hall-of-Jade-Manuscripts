/**
 * Knowledge Graph Service
 * 
 * Maintains a structured graph of entities and relationships for narrative consistency.
 * Tracks characters, power levels, relationships, locations, items, techniques, and world rules.
 */

import { NovelState, Character, Relationship, Territory, WorldEntry, NovelItem, NovelTechnique, Antagonist, Chapter } from '../types';

export type EntityType = 'character' | 'item' | 'technique' | 'location' | 'antagonist' | 'world_rule';
export type RelationshipType = 'character_character' | 'character_item' | 'character_technique' | 'character_location' | 'character_antagonist';

export interface GraphNode {
  id: string;
  type: EntityType;
  entityId: string;
  label: string;
  properties: Record<string, any>;
  chapterCreated?: number;
  chapterLastUpdated?: number;
}

export interface GraphEdge {
  id: string;
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
  chapterEstablished?: number;
  chapterLastUpdated?: number;
}

export interface PowerLevelProgression {
  characterId: string;
  characterName: string;
  progression: Array<{
    chapterNumber: number;
    chapterId: string;
    powerLevel: string;
    progressionType: 'breakthrough' | 'gradual' | 'regression' | 'stable';
    eventDescription?: string;
    timestamp: number;
  }>;
  currentLevel: string;
  currentChapter: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  powerProgressions: Map<string, PowerLevelProgression>;
  lastUpdated: number;
  novelId: string;
}

export class KnowledgeGraphService {
  private graph: KnowledgeGraph | null = null;
  private novelId: string | null = null;

  /**
   * Initialize or rebuild graph from novel state
   */
  initializeGraph(novelState: NovelState): KnowledgeGraph {
    this.novelId = novelState.id;
    const graph: KnowledgeGraph = {
      nodes: new Map(),
      edges: new Map(),
      powerProgressions: new Map(),
      lastUpdated: Date.now(),
      novelId: novelState.id,
    };

    // Add character nodes
    novelState.characterCodex.forEach(char => {
      const node: GraphNode = {
        id: `character_${char.id}`,
        type: 'character',
        entityId: char.id,
        label: char.name,
        properties: {
          name: char.name,
          age: char.age,
          personality: char.personality,
          currentCultivation: char.currentCultivation,
          status: char.status,
          isProtagonist: char.isProtagonist || false,
          appearance: char.appearance,
          background: char.background,
          goals: char.goals,
          flaws: char.flaws,
          notes: char.notes,
        },
        chapterCreated: char.createdByChapterId ? this.getChapterNumber(novelState, char.createdByChapterId) : undefined,
        chapterLastUpdated: char.lastUpdatedByChapterId ? this.getChapterNumber(novelState, char.lastUpdatedByChapterId) : undefined,
      };
      graph.nodes.set(node.id, node);

      // Initialize power progression
      const progression: PowerLevelProgression = {
        characterId: char.id,
        characterName: char.name,
        progression: [],
        currentLevel: char.currentCultivation,
        currentChapter: novelState.chapters.length,
      };
      graph.powerProgressions.set(char.id, progression);
    });

    // Add character-to-character relationships
    novelState.characterCodex.forEach(char => {
      char.relationships?.forEach(rel => {
        const edge: GraphEdge = {
          id: `rel_${char.id}_${rel.characterId}`,
          type: 'character_character',
          sourceId: `character_${char.id}`,
          targetId: `character_${rel.characterId}`,
          properties: {
            type: rel.type,
            history: rel.history,
            impact: rel.impact,
          },
        };
        graph.edges.set(edge.id, edge);
      });
    });

    // Add item nodes
    novelState.novelItems?.forEach(item => {
      const node: GraphNode = {
        id: `item_${item.id}`,
        type: 'item',
        entityId: item.id,
        label: item.name,
        properties: {
          name: item.name,
          canonicalName: item.canonicalName,
          description: item.description,
          category: item.category,
          powers: item.powers,
          history: item.history,
          firstAppearedChapter: item.firstAppearedChapter,
          lastReferencedChapter: item.lastReferencedChapter,
        },
        chapterCreated: item.firstAppearedChapter,
      };
      graph.nodes.set(node.id, node);
    });

    // Add technique nodes
    novelState.novelTechniques?.forEach(technique => {
      const node: GraphNode = {
        id: `technique_${technique.id}`,
        type: 'technique',
        entityId: technique.id,
        label: technique.name,
        properties: {
          name: technique.name,
          canonicalName: technique.canonicalName,
          description: technique.description,
          category: technique.category,
          type: technique.type,
          functions: technique.functions,
          history: technique.history,
          firstAppearedChapter: technique.firstAppearedChapter,
          lastReferencedChapter: technique.lastReferencedChapter,
        },
        chapterCreated: technique.firstAppearedChapter,
      };
      graph.nodes.set(node.id, node);
    });

    // Add character-item relationships
    novelState.characterCodex.forEach(char => {
      char.itemPossessions?.forEach(possession => {
        const item = novelState.novelItems?.find(i => i.id === possession.itemId);
        if (item) {
          const edge: GraphEdge = {
            id: `char_item_${char.id}_${possession.itemId}`,
            type: 'character_item',
            sourceId: `character_${char.id}`,
            targetId: `item_${possession.itemId}`,
            properties: {
              status: possession.status,
              acquiredChapter: possession.acquiredChapter,
              archivedChapter: possession.archivedChapter,
              notes: possession.notes,
            },
            chapterEstablished: possession.acquiredChapter,
          };
          graph.edges.set(edge.id, edge);
        }
      });
    });

    // Add character-technique relationships
    novelState.characterCodex.forEach(char => {
      char.techniqueMasteries?.forEach(mastery => {
        const technique = novelState.novelTechniques?.find(t => t.id === mastery.techniqueId);
        if (technique) {
          const edge: GraphEdge = {
            id: `char_technique_${char.id}_${mastery.techniqueId}`,
            type: 'character_technique',
            sourceId: `character_${char.id}`,
            targetId: `technique_${mastery.techniqueId}`,
            properties: {
              status: mastery.status,
              masteryLevel: mastery.masteryLevel,
              learnedChapter: mastery.learnedChapter,
              archivedChapter: mastery.archivedChapter,
              notes: mastery.notes,
            },
            chapterEstablished: mastery.learnedChapter,
          };
          graph.edges.set(edge.id, edge);
        }
      });
    });

    // Add location nodes
    novelState.territories.forEach(territory => {
      const node: GraphNode = {
        id: `location_${territory.id}`,
        type: 'location',
        entityId: territory.id,
        label: territory.name,
        properties: {
          name: territory.name,
          type: territory.type,
          description: territory.description,
          realmId: territory.realmId,
        },
        chapterCreated: territory.createdByChapterId ? this.getChapterNumber(novelState, territory.createdByChapterId) : undefined,
      };
      graph.nodes.set(node.id, node);
    });

    // Add antagonist nodes
    novelState.antagonists?.forEach(antagonist => {
      const node: GraphNode = {
        id: `antagonist_${antagonist.id}`,
        type: 'antagonist',
        entityId: antagonist.id,
        label: antagonist.name,
        properties: {
          name: antagonist.name,
          type: antagonist.type,
          description: antagonist.description,
          motivation: antagonist.motivation,
          powerLevel: antagonist.powerLevel,
          status: antagonist.status,
          threatLevel: antagonist.threatLevel,
          durationScope: antagonist.durationScope,
          firstAppearedChapter: antagonist.firstAppearedChapter,
          lastAppearedChapter: antagonist.lastAppearedChapter,
        },
        chapterCreated: antagonist.firstAppearedChapter,
      };
      graph.nodes.set(node.id, node);
    });

    // Add world rule nodes
    novelState.worldBible.forEach(entry => {
      const node: GraphNode = {
        id: `world_rule_${entry.id}`,
        type: 'world_rule',
        entityId: entry.id,
        label: entry.title,
        properties: {
          title: entry.title,
          category: entry.category,
          content: entry.content,
          realmId: entry.realmId,
        },
      };
      graph.nodes.set(node.id, node);
    });

    this.graph = graph;
    return graph;
  }

  /**
   * Get current graph instance
   */
  getGraph(): KnowledgeGraph | null {
    return this.graph;
  }

  /**
   * Query: Get character's current power level
   */
  getCharacterPowerLevel(characterId: string): string | null {
    if (!this.graph) return null;
    const progression = this.graph.powerProgressions.get(characterId);
    return progression?.currentLevel || null;
  }

  /**
   * Query: Get all characters in a location
   * Enhanced: Uses entity state tracker to find characters at a location
   */
  getCharactersInLocation(locationId: string, state: NovelState): Character[] {
    const { getEntityStateTracker } = require('./entityStateTracker');
    const stateTracker = getEntityStateTracker();
    
    const charactersAtLocation: Character[] = [];
    
    state.characterCodex.forEach(char => {
      const currentState = stateTracker.getCurrentState('character', char.id);
      if (currentState && currentState.location === locationId) {
        charactersAtLocation.push(char);
      }
    });
    
    return charactersAtLocation;
  }

  /**
   * Query: Get all relationships for a character
   */
  getCharacterRelationships(characterId: string): GraphEdge[] {
    if (!this.graph) return [];
    const characterNodeId = `character_${characterId}`;
    const relationships: GraphEdge[] = [];
    
    this.graph.edges.forEach(edge => {
      if (edge.sourceId === characterNodeId || edge.targetId === characterNodeId) {
        relationships.push(edge);
      }
    });
    
    return relationships;
  }

  /**
   * Query: Get power level progression for a character
   */
  getPowerProgression(characterId: string): PowerLevelProgression | null {
    if (!this.graph) return null;
    return this.graph.powerProgressions.get(characterId) || null;
  }

  /**
   * Update character power level
   */
  updatePowerLevel(
    characterId: string,
    newLevel: string,
    chapterId: string,
    chapterNumber: number,
    progressionType: 'breakthrough' | 'gradual' | 'regression' | 'stable' = 'gradual',
    eventDescription?: string
  ): void {
    if (!this.graph) return;
    
    const progression = this.graph.powerProgressions.get(characterId);
    if (!progression) return;

    progression.progression.push({
      chapterNumber,
      chapterId,
      powerLevel: newLevel,
      progressionType,
      eventDescription,
      timestamp: Date.now(),
    });
    
    progression.currentLevel = newLevel;
    progression.currentChapter = chapterNumber;

    // Update character node properties
    const nodeId = `character_${characterId}`;
    const node = this.graph.nodes.get(nodeId);
    if (node) {
      node.properties.currentCultivation = newLevel;
      node.chapterLastUpdated = chapterNumber;
    }

    this.graph.lastUpdated = Date.now();
  }

  /**
   * Add or update relationship
   */
  addOrUpdateRelationship(
    sourceCharacterId: string,
    targetCharacterId: string,
    relationshipType: string,
    history: string,
    impact: string,
    chapterNumber?: number
  ): void {
    if (!this.graph) return;

    const edgeId = `rel_${sourceCharacterId}_${targetCharacterId}`;
    const existingEdge = this.graph.edges.get(edgeId);

    if (existingEdge) {
      existingEdge.properties.type = relationshipType;
      existingEdge.properties.history = history;
      existingEdge.properties.impact = impact;
      if (chapterNumber) {
        existingEdge.chapterLastUpdated = chapterNumber;
      }
    } else {
      const edge: GraphEdge = {
        id: edgeId,
        type: 'character_character',
        sourceId: `character_${sourceCharacterId}`,
        targetId: `character_${targetCharacterId}`,
        properties: {
          type: relationshipType,
          history,
          impact,
        },
        chapterEstablished: chapterNumber,
      };
      this.graph.edges.set(edgeId, edge);
    }

    this.graph.lastUpdated = Date.now();
  }

  /**
   * Get all entities of a type
   */
  getEntitiesByType(type: EntityType): GraphNode[] {
    if (!this.graph) return [];
    const entities: GraphNode[] = [];
    this.graph.nodes.forEach(node => {
      if (node.type === type) {
        entities.push(node);
      }
    });
    return entities;
  }

  /**
   * Find entity by name (fuzzy matching)
   */
  findEntityByName(name: string, type?: EntityType): GraphNode | null {
    if (!this.graph) return null;
    const normalizedName = name.toLowerCase().trim();
    
    for (const node of this.graph.nodes.values()) {
      if (type && node.type !== type) continue;
      if (node.label.toLowerCase().trim() === normalizedName) {
        return node;
      }
    }
    
    return null;
  }

  /**
   * Get graph snapshot for persistence
   */
  getSnapshot(): any {
    if (!this.graph) return null;
    
    return {
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      powerProgressions: Array.from(this.graph.powerProgressions.entries()).map(([id, prog]) => ({
        characterId: id,
        ...prog,
      })),
      lastUpdated: this.graph.lastUpdated,
      novelId: this.graph.novelId,
    };
  }

  /**
   * Helper: Get chapter number from chapter ID
   */
  private getChapterNumber(novelState: NovelState, chapterId: string): number | undefined {
    const chapter = novelState.chapters.find(c => c.id === chapterId);
    return chapter?.number;
  }
}

// Singleton instance
let graphServiceInstance: KnowledgeGraphService | null = null;

export function getKnowledgeGraphService(): KnowledgeGraphService {
  if (!graphServiceInstance) {
    graphServiceInstance = new KnowledgeGraphService();
  }
  return graphServiceInstance;
}
