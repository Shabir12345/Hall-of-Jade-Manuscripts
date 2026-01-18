/**
 * Relationship Service
 * Centralized service for managing character relationships (karmic links)
 * Handles bidirectional relationship creation, validation, and strength calculation
 */

import type { Character, Relationship } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Normalize string for comparison
 */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Find character by name (case-insensitive)
 */
function findCharacterByName(characters: Character[], name: string): Character | undefined {
  const normalizedName = normalize(name);
  return characters.find(c => normalize(c.name) === normalizedName);
}

/**
 * Find character by ID
 */
function findCharacterById(characters: Character[], id: string): Character | undefined {
  return characters.find(c => c.id === id);
}

/**
 * Create a bidirectional relationship between two characters
 * If A relates to B, B will also relate to A (with inverse type if applicable)
 */
export function createBidirectionalRelationship(
  characters: Character[],
  sourceCharacterId: string,
  targetCharacterId: string,
  relationshipType: string,
  history?: string,
  impact?: string
): {
  sourceRelationship: Relationship;
  targetRelationship: Relationship | null;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate characters exist
  const sourceCharacter = findCharacterById(characters, sourceCharacterId);
  const targetCharacter = findCharacterById(characters, targetCharacterId);

  if (!sourceCharacter) {
    errors.push(`Source character with ID ${sourceCharacterId} not found`);
  }
  if (!targetCharacter) {
    errors.push(`Target character with ID ${targetCharacterId} not found`);
  }

  if (errors.length > 0) {
    return {
      sourceRelationship: {
        characterId: targetCharacterId,
        type: relationshipType,
        history: history || 'Karma link recorded in chronicle.',
        impact: impact || 'Fate has shifted.'
      },
      targetRelationship: null,
      errors
    };
  }

  // Create source relationship (A -> B)
  const sourceRelationship: Relationship = {
    characterId: targetCharacterId,
    type: relationshipType,
    history: history || 'Karma link recorded in chronicle.',
    impact: impact || 'Fate has shifted.'
  };

  // Determine inverse relationship type
  const inverseType = getInverseRelationshipType(relationshipType);

  // Create target relationship (B -> A) - bidirectional
  const targetRelationship: Relationship = {
    characterId: sourceCharacterId,
    type: inverseType,
    history: history || 'Karma link recorded in chronicle.',
    impact: impact || 'Fate has shifted.'
  };

  return {
    sourceRelationship,
    targetRelationship,
    errors: []
  };
}

/**
 * Get inverse relationship type (e.g., "Mentor" -> "Student", "Enemy" -> "Enemy")
 */
export function getInverseRelationshipType(type: string): string {
  const normalizedType = normalize(type);
  const typeMap: Record<string, string> = {
    'mentor': 'Student',
    'student': 'Mentor',
    'master': 'Disciple',
    'disciple': 'Master',
    'teacher': 'Student',
    'apprentice': 'Master',
    'ally': 'Ally',
    'friend': 'Friend',
    'enemy': 'Enemy',
    'rival': 'Rival',
    'lover': 'Lover',
    'spouse': 'Spouse',
    'parent': 'Child',
    'child': 'Parent',
    'sibling': 'Sibling',
    'guardian': 'Ward',
    'ward': 'Guardian'
  };

  // Check for exact matches
  if (typeMap[normalizedType]) {
    return typeMap[normalizedType];
  }

  // Check for partial matches (e.g., "sworn enemy" contains "enemy")
  for (const [key, value] of Object.entries(typeMap)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return value;
    }
  }

  // Default: same type for symmetric relationships
  return type;
}

/**
 * Validate a relationship - ensures both characters exist
 */
export function validateRelationship(
  characters: Character[],
  sourceCharacterId: string,
  targetCharacterId: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!sourceCharacterId || !targetCharacterId) {
    errors.push('Both source and target character IDs are required');
    return { valid: false, errors };
  }

  if (sourceCharacterId === targetCharacterId) {
    errors.push('Character cannot have a relationship with themselves');
    return { valid: false, errors };
  }

  const sourceCharacter = findCharacterById(characters, sourceCharacterId);
  const targetCharacter = findCharacterById(characters, targetCharacterId);

  if (!sourceCharacter) {
    errors.push(`Source character with ID ${sourceCharacterId} not found`);
  }

  if (!targetCharacter) {
    errors.push(`Target character with ID ${targetCharacterId} not found`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Add or update a relationship for a character
 * If bidirectional is true, also creates the inverse relationship
 */
export function addOrUpdateRelationship(
  characters: Character[],
  sourceCharacterId: string,
  targetCharacterId: string,
  relationshipType: string,
  history?: string,
  impact?: string,
  bidirectional: boolean = true
): {
  success: boolean;
  errors: string[];
  updatedCharacters: Character[];
} {
  const errors: string[] = [];
  const updatedCharacters = [...characters];

  // Validate relationship
  const validation = validateRelationship(characters, sourceCharacterId, targetCharacterId);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      updatedCharacters: characters
    };
  }

  // Create relationships (bidirectional if requested)
  const relationships = createBidirectionalRelationship(
    characters,
    sourceCharacterId,
    targetCharacterId,
    relationshipType,
    history,
    impact
  );

  if (relationships.errors.length > 0) {
    return {
      success: false,
      errors: relationships.errors,
      updatedCharacters: characters
    };
  }

  // Find character indices
  const sourceIndex = updatedCharacters.findIndex(c => c.id === sourceCharacterId);
  const targetIndex = updatedCharacters.findIndex(c => c.id === targetCharacterId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return {
      success: false,
      errors: ['Character not found in array'],
      updatedCharacters: characters
    };
  }

  // Update source character's relationships
  const sourceCharacter = updatedCharacters[sourceIndex];
  const sourceRelationships = sourceCharacter.relationships || [];
  const existingSourceRelIndex = sourceRelationships.findIndex(
    r => r.characterId === targetCharacterId
  );

  const updatedSourceRelationships = existingSourceRelIndex >= 0
    ? sourceRelationships.map((r, idx) => 
        idx === existingSourceRelIndex ? relationships.sourceRelationship : r
      )
    : [...sourceRelationships, relationships.sourceRelationship];

  updatedCharacters[sourceIndex] = {
    ...sourceCharacter,
    relationships: updatedSourceRelationships
  };

  // Update target character's relationships (bidirectional)
  if (bidirectional && relationships.targetRelationship) {
    const targetCharacter = updatedCharacters[targetIndex];
    const targetRelationships = targetCharacter.relationships || [];
    const existingTargetRelIndex = targetRelationships.findIndex(
      r => r.characterId === sourceCharacterId
    );

    const updatedTargetRelationships = existingTargetRelIndex >= 0
      ? targetRelationships.map((r, idx) => 
          idx === existingTargetRelIndex ? relationships.targetRelationship! : r
        )
      : [...targetRelationships, relationships.targetRelationship];

    updatedCharacters[targetIndex] = {
      ...targetCharacter,
      relationships: updatedTargetRelationships
    };
  }

  return {
    success: true,
    errors: [],
    updatedCharacters
  };
}

/**
 * Calculate relationship strength based on various factors
 * Higher number = stronger relationship
 */
export function getRelationshipStrength(relationship: Relationship): number {
  let strength = 50; // Base strength

  const type = normalize(relationship.type);

  // Adjust based on relationship type
  if (type.includes('enemy') || type.includes('rival') || type.includes('nemesis')) {
    strength += 30; // Strong negative relationships
  } else if (type.includes('mentor') || type.includes('master') || type.includes('teacher')) {
    strength += 25; // Strong hierarchical relationships
  } else if (type.includes('ally') || type.includes('friend') || type.includes('companion')) {
    strength += 20; // Positive relationships
  } else if (type.includes('lover') || type.includes('spouse')) {
    strength += 40; // Very strong relationships
  } else if (type.includes('family') || type.includes('parent') || type.includes('child') || type.includes('sibling')) {
    strength += 35; // Family bonds
  }

  // Adjust based on history length (longer history = stronger bond)
  if (relationship.history) {
    const historyLength = relationship.history.length;
    strength += Math.min(historyLength / 10, 20); // Max +20 from history
  }

  // Adjust based on impact description
  if (relationship.impact) {
    const impactLength = relationship.impact.length;
    strength += Math.min(impactLength / 10, 15); // Max +15 from impact
  }

  return Math.min(strength, 100); // Cap at 100
}

/**
 * Remove a relationship (and optionally its inverse)
 */
export function removeRelationship(
  characters: Character[],
  sourceCharacterId: string,
  targetCharacterId: string,
  bidirectional: boolean = true
): {
  success: boolean;
  errors: string[];
  updatedCharacters: Character[];
} {
  const errors: string[] = [];
  const updatedCharacters = [...characters];

  const validation = validateRelationship(characters, sourceCharacterId, targetCharacterId);
  if (!validation.valid && !validation.errors.includes('Character cannot have a relationship with themselves')) {
    // Allow removal even if validation fails (might be cleaning up)
    const sourceIndex = updatedCharacters.findIndex(c => c.id === sourceCharacterId);
    const targetIndex = updatedCharacters.findIndex(c => c.id === targetCharacterId);

    if (sourceIndex === -1 || targetIndex === -1) {
      return {
        success: false,
        errors: ['Character not found'],
        updatedCharacters: characters
      };
    }
  }

  const sourceIndex = updatedCharacters.findIndex(c => c.id === sourceCharacterId);
  const targetIndex = updatedCharacters.findIndex(c => c.id === targetCharacterId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return {
      success: false,
      errors: ['Character not found in array'],
      updatedCharacters: characters
    };
  }

  // Remove from source character
  const sourceCharacter = updatedCharacters[sourceIndex];
  const sourceRelationships = (sourceCharacter.relationships || []).filter(
    r => r.characterId !== targetCharacterId
  );
  updatedCharacters[sourceIndex] = {
    ...sourceCharacter,
    relationships: sourceRelationships
  };

  // Remove from target character (bidirectional)
  if (bidirectional) {
    const targetCharacter = updatedCharacters[targetIndex];
    const targetRelationships = (targetCharacter.relationships || []).filter(
      r => r.characterId !== sourceCharacterId
    );
    updatedCharacters[targetIndex] = {
      ...targetCharacter,
      relationships: targetRelationships
    };
  }

  return {
    success: true,
    errors: [],
    updatedCharacters
  };
}

/**
 * Get all relationships for a character
 */
export function getCharacterRelationships(
  characters: Character[],
  characterId: string
): Relationship[] {
  const character = findCharacterById(characters, characterId);
  return character?.relationships || [];
}

/**
 * Find characters connected to a given character (directly related)
 */
export function getConnectedCharacters(
  characters: Character[],
  characterId: string
): Character[] {
  const character = findCharacterById(characters, characterId);
  if (!character || !character.relationships) {
    return [];
  }

  const connectedIds = character.relationships.map(r => r.characterId);
  return characters.filter(c => connectedIds.includes(c.id));
}

/**
 * Calculate degree centrality for all characters
 * Degree centrality = number of direct connections
 */
export function calculateDegreeCentrality(characters: Character[]): Map<string, number> {
  const centrality = new Map<string, number>();
  
  characters.forEach(char => {
    const connections = char.relationships?.length || 0;
    centrality.set(char.id, connections);
  });
  
  return centrality;
}

/**
 * Calculate betweenness centrality (simplified - counts paths through character)
 * This is a simplified version that counts how many pairs of characters
 * have this character in their shortest path
 */
export function calculateBetweennessCentrality(characters: Character[]): Map<string, number> {
  const centrality = new Map<string, number>();
  const characterMap = new Map(characters.map(c => [c.id, c]));
  
  // Initialize all to 0
  characters.forEach(char => {
    centrality.set(char.id, 0);
  });
  
  // For each pair of characters, find shortest path
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const source = characters[i];
      const target = characters[j];
      
      // Find shortest path using BFS
      const path = findShortestPath(source.id, target.id, characterMap);
      if (path && path.length > 2) {
        // Count intermediate nodes (not source or target)
        for (let k = 1; k < path.length - 1; k++) {
          const currentCentrality = centrality.get(path[k]) || 0;
          centrality.set(path[k], currentCentrality + 1);
        }
      }
    }
  }
  
  return centrality;
}

/**
 * Find shortest path between two characters using BFS
 */
function findShortestPath(
  sourceId: string,
  targetId: string,
  characterMap: Map<string, Character>
): string[] | null {
  if (sourceId === targetId) return [sourceId];
  
  const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];
  const visited = new Set<string>([sourceId]);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const character = characterMap.get(current.id);
    
    if (!character || !character.relationships) continue;
    
    for (const rel of character.relationships) {
      if (rel.characterId === targetId) {
        return [...current.path, targetId];
      }
      
      if (!visited.has(rel.characterId)) {
        visited.add(rel.characterId);
        queue.push({ id: rel.characterId, path: [...current.path, rel.characterId] });
      }
    }
  }
  
  return null; // No path found
}

/**
 * Find relationship clusters (communities) using a simple algorithm
 * Groups characters that are more connected to each other than to the rest
 */
export function findRelationshipClusters(characters: Character[]): Map<string, number> {
  const clusters = new Map<string, number>();
  const characterMap = new Map(characters.map(c => [c.id, c]));
  let clusterId = 0;
  const visited = new Set<string>();
  
  characters.forEach(char => {
    if (visited.has(char.id)) return;
    
    // BFS to find connected component
    const cluster: string[] = [];
    const queue: string[] = [char.id];
    visited.add(char.id);
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      cluster.push(currentId);
      const current = characterMap.get(currentId);
      
      if (!current || !current.relationships) continue;
      
      current.relationships.forEach(rel => {
        if (!visited.has(rel.characterId)) {
          visited.add(rel.characterId);
          queue.push(rel.characterId);
        }
      });
    }
    
    // Assign cluster ID to all characters in this component
    cluster.forEach(charId => {
      clusters.set(charId, clusterId);
    });
    
    clusterId++;
  });
  
  return clusters;
}

/**
 * Get relationship timeline - when relationships were formed/changed
 * This would ideally come from chapter tracking, but for now we'll use
 * a placeholder that could be enhanced with actual timeline data
 */
export interface RelationshipTimelineEntry {
  characterId: string;
  targetCharacterId: string;
  relationshipType: string;
  chapterNumber?: number;
  timestamp?: number;
  action: 'formed' | 'changed' | 'strengthened' | 'weakened';
}

export function getRelationshipTimeline(
  characters: Character[],
  chapters: Array<{ id: string; number: number; updatedAt: number }>
): RelationshipTimelineEntry[] {
  const timeline: RelationshipTimelineEntry[] = [];
  
  characters.forEach(char => {
    if (char.updateHistory) {
      char.updateHistory.forEach(history => {
        // If character was updated and has relationships, we could infer
        // when relationships were added/changed
        // This is a simplified version - could be enhanced with actual tracking
      });
    }
  });
  
  // For now, return empty timeline - would need actual relationship change tracking
  return timeline;
}

/**
 * Get relationship statistics for a character or all characters
 */
export interface RelationshipStats {
  totalRelationships: number;
  byType: Map<string, number>;
  averageStrength: number;
  strongestRelationship?: { targetId: string; type: string; strength: number };
  weakestRelationship?: { targetId: string; type: string; strength: number };
}

export function getRelationshipStats(
  characters: Character[],
  characterId?: string
): RelationshipStats {
  const targetCharacters = characterId
    ? characters.filter(c => c.id === characterId)
    : characters;
  
  let totalRelationships = 0;
  const byType = new Map<string, number>();
  let totalStrength = 0;
  let maxStrength = 0;
  let minStrength = 100;
  let strongestRelationship: { targetId: string; type: string; strength: number } | undefined;
  let weakestRelationship: { targetId: string; type: string; strength: number } | undefined;
  
  targetCharacters.forEach(char => {
    if (!char.relationships) return;
    
    char.relationships.forEach(rel => {
      totalRelationships++;
      
      const typeCount = byType.get(rel.type) || 0;
      byType.set(rel.type, typeCount + 1);
      
      const strength = getRelationshipStrength(rel);
      totalStrength += strength;
      
      if (strength > maxStrength) {
        maxStrength = strength;
        strongestRelationship = {
          targetId: rel.characterId,
          type: rel.type,
          strength,
        };
      }
      
      if (strength < minStrength) {
        minStrength = strength;
        weakestRelationship = {
          targetId: rel.characterId,
          type: rel.type,
          strength,
        };
      }
    });
  });
  
  return {
    totalRelationships,
    byType,
    averageStrength: totalRelationships > 0 ? totalStrength / totalRelationships : 0,
    strongestRelationship,
    weakestRelationship,
  };
}
