import { 
  NovelState, 
  Reference, 
  ResolvedReference, 
  ReferenceContext, 
  ReferenceType,
  EntitySuggestion,
  Character,
  Territory,
  WorldEntry,
  Realm,
  Arc,
  Tag
} from '../types';

/**
 * Reference Service
 * Handles parsing, resolving, and formatting @ references for AI context
 */

/**
 * Parses all @ references from a text string
 */
export function parseReferences(text: string): Reference[] {
  const references: Reference[] = [];
  const regex = /@([\w\s]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0]; // Includes @
    const name = match[1].trim(); // Without @
    
    if (name.length > 0) {
      references.push({
        type: 'character', // Default, will be resolved later
        name: name,
        matchText: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      });
    }
  }

  return references;
}

/**
 * Finds matching entities for autocomplete
 */
export function findMatchingEntities(
  query: string,
  state: NovelState,
  type?: ReferenceType
): EntitySuggestion[] {
  const suggestions: EntitySuggestion[] = [];
  const queryLower = query.toLowerCase().trim();
  
  if (!queryLower) {
    // Return all entities if no query
    if (!type || type === 'character') {
      state.characterCodex.forEach(char => {
        suggestions.push({
          type: 'character',
          id: char.id,
          name: char.name,
          displayName: char.name,
          description: char.currentCultivation || char.personality?.substring(0, 50),
          matchScore: 0,
        });
      });
    }
    if (!type || type === 'territory') {
      state.territories.forEach(territory => {
        suggestions.push({
          type: 'territory',
          id: territory.id,
          name: territory.name,
          displayName: territory.name,
          description: territory.type,
          matchScore: 0,
        });
      });
    }
    if (!type || type === 'worldEntry') {
      state.worldBible.forEach(entry => {
        suggestions.push({
          type: 'worldEntry',
          id: entry.id,
          name: entry.title,
          displayName: entry.title,
          description: entry.category,
          matchScore: 0,
        });
      });
    }
    if (!type || type === 'realm') {
      state.realms.forEach(realm => {
        suggestions.push({
          type: 'realm',
          id: realm.id,
          name: realm.name,
          displayName: realm.name,
          description: realm.status,
          matchScore: 0,
        });
      });
    }
    if (!type || type === 'arc') {
      state.plotLedger.forEach(arc => {
        suggestions.push({
          type: 'arc',
          id: arc.id,
          name: arc.title,
          displayName: arc.title,
          description: arc.status,
          matchScore: 0,
        });
      });
    }
    if (!type || type === 'tag') {
      state.tags.forEach(tag => {
        suggestions.push({
          type: 'tag',
          id: tag.id,
          name: tag.name,
          displayName: tag.name,
          description: tag.category,
          matchScore: 0,
        });
      });
    }
    
    return suggestions.slice(0, 10);
  }

  // Search characters
  if (!type || type === 'character') {
    state.characterCodex.forEach(char => {
      const nameLower = char.name.toLowerCase();
      let score = 0;
      
      if (nameLower === queryLower) {
        score = 100; // Exact match
      } else if (nameLower.startsWith(queryLower)) {
        score = 80; // Starts with
      } else if (nameLower.includes(queryLower)) {
        score = 60; // Contains
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'character',
          id: char.id,
          name: char.name,
          displayName: char.name,
          description: char.currentCultivation || char.personality?.substring(0, 50),
          matchScore: score,
        });
      }
    });
  }

  // Search territories
  if (!type || type === 'territory') {
    state.territories.forEach(territory => {
      const nameLower = territory.name.toLowerCase();
      let score = 0;
      
      if (nameLower === queryLower) {
        score = 100;
      } else if (nameLower.startsWith(queryLower)) {
        score = 80;
      } else if (nameLower.includes(queryLower)) {
        score = 60;
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'territory',
          id: territory.id,
          name: territory.name,
          displayName: territory.name,
          description: territory.type,
          matchScore: score,
        });
      }
    });
  }

  // Search world entries
  if (!type || type === 'worldEntry') {
    state.worldBible.forEach(entry => {
      const titleLower = entry.title.toLowerCase();
      let score = 0;
      
      if (titleLower === queryLower) {
        score = 100;
      } else if (titleLower.startsWith(queryLower)) {
        score = 80;
      } else if (titleLower.includes(queryLower)) {
        score = 60;
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'worldEntry',
          id: entry.id,
          name: entry.title,
          displayName: entry.title,
          description: entry.category,
          matchScore: score,
        });
      }
    });
  }

  // Search realms
  if (!type || type === 'realm') {
    state.realms.forEach(realm => {
      const nameLower = realm.name.toLowerCase();
      let score = 0;
      
      if (nameLower === queryLower) {
        score = 100;
      } else if (nameLower.startsWith(queryLower)) {
        score = 80;
      } else if (nameLower.includes(queryLower)) {
        score = 60;
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'realm',
          id: realm.id,
          name: realm.name,
          displayName: realm.name,
          description: realm.status,
          matchScore: score,
        });
      }
    });
  }

  // Search arcs
  if (!type || type === 'arc') {
    state.plotLedger.forEach(arc => {
      const titleLower = arc.title.toLowerCase();
      let score = 0;
      
      if (titleLower === queryLower) {
        score = 100;
      } else if (titleLower.startsWith(queryLower)) {
        score = 80;
      } else if (titleLower.includes(queryLower)) {
        score = 60;
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'arc',
          id: arc.id,
          name: arc.title,
          displayName: arc.title,
          description: arc.status,
          matchScore: score,
        });
      }
    });
  }

  // Search tags
  if (!type || type === 'tag') {
    state.tags.forEach(tag => {
      const nameLower = tag.name.toLowerCase();
      let score = 0;
      
      if (nameLower === queryLower) {
        score = 100;
      } else if (nameLower.startsWith(queryLower)) {
        score = 80;
      } else if (nameLower.includes(queryLower)) {
        score = 60;
      }
      
      if (score > 0) {
        suggestions.push({
          type: 'tag',
          id: tag.id,
          name: tag.name,
          displayName: tag.name,
          description: tag.category,
          matchScore: score,
        });
      }
    });
  }

  // Sort by match score (highest first) and return top 10
  return suggestions
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}

/**
 * Resolves references to actual entities
 */
export function resolveReferences(
  references: Reference[],
  state: NovelState
): ResolvedReference[] {
  const resolved: ResolvedReference[] = [];

  for (const ref of references) {
    const nameLower = ref.name.toLowerCase();
    let entity: Character | Territory | WorldEntry | Realm | Arc | Tag | null = null;
    let resolvedType: ReferenceType = 'character';

    // Try to find exact match first (case-insensitive)
    // Check characters
    const character = state.characterCodex.find(
      c => c.name.toLowerCase() === nameLower
    );
    if (character) {
      entity = character;
      resolvedType = 'character';
    } else {
      // Check territories
      const territory = state.territories.find(
        t => t.name.toLowerCase() === nameLower
      );
      if (territory) {
        entity = territory;
        resolvedType = 'territory';
      } else {
        // Check world entries
        const worldEntry = state.worldBible.find(
          w => w.title.toLowerCase() === nameLower
        );
        if (worldEntry) {
          entity = worldEntry;
          resolvedType = 'worldEntry';
        } else {
          // Check realms
          const realm = state.realms.find(
            r => r.name.toLowerCase() === nameLower
          );
          if (realm) {
            entity = realm;
            resolvedType = 'realm';
          } else {
            // Check arcs
            const arc = state.plotLedger.find(
              a => a.title.toLowerCase() === nameLower
            );
            if (arc) {
              entity = arc;
              resolvedType = 'arc';
            } else {
              // Check tags
              const tag = state.tags.find(
                t => t.name.toLowerCase() === nameLower
              );
              if (tag) {
                entity = tag;
                resolvedType = 'tag';
              }
            }
          }
        }
      }
    }

    // If no exact match, try fuzzy matching (starts with)
    if (!entity) {
      const charStartsWith = state.characterCodex.find(
        c => c.name.toLowerCase().startsWith(nameLower)
      );
      if (charStartsWith) {
        entity = charStartsWith;
        resolvedType = 'character';
      } else {
        const territoryStartsWith = state.territories.find(
          t => t.name.toLowerCase().startsWith(nameLower)
        );
        if (territoryStartsWith) {
          entity = territoryStartsWith;
          resolvedType = 'territory';
        } else {
          const worldEntryStartsWith = state.worldBible.find(
            w => w.title.toLowerCase().startsWith(nameLower)
          );
          if (worldEntryStartsWith) {
            entity = worldEntryStartsWith;
            resolvedType = 'worldEntry';
          }
        }
      }
    }

    resolved.push({
      reference: { ...ref, type: resolvedType, entityId: entity?.id },
      entity,
      context: formatEntityContext(entity, resolvedType, state),
    });
  }

  return resolved;
}

/**
 * Formats entity context for AI prompts
 */
function formatEntityContext(
  entity: Character | Territory | WorldEntry | Realm | Arc | Tag | null,
  type: ReferenceType,
  state: NovelState
): string {
  if (!entity) {
    return 'Entity not found in codex.';
  }

  switch (type) {
    case 'character': {
      const char = entity as Character;
      const realm = state.realms.find(r => r.id === state.currentRealmId);
      const relationships = char.relationships.map(rel => {
        const targetChar = state.characterCodex.find(c => c.id === rel.characterId);
        return `  - ${targetChar?.name || 'Unknown'}: ${rel.type} (${rel.history || 'No history'})`;
      }).join('\n');

      return `Character: ${char.name}
- Age: ${char.age || 'Unknown'}
- Cultivation Level: ${char.currentCultivation || 'Unknown'}
- Personality: ${char.personality || 'Not specified'}
- Status: ${char.status}
- Skills: ${char.skills.length > 0 ? char.skills.join(', ') : 'None'}
- Items: ${char.items.length > 0 ? char.items.join(', ') : 'None'}
${relationships ? `- Relationships:\n${relationships}` : ''}
- Notes: ${char.notes || 'None'}`;
    }

    case 'territory': {
      const territory = entity as Territory;
      const realm = state.realms.find(r => r.id === territory.realmId);
      return `Territory: ${territory.name}
- Type: ${territory.type}
- Realm: ${realm?.name || 'Unknown'}
- Description: ${territory.description || 'No description'}`;
    }

    case 'worldEntry': {
      const entry = entity as WorldEntry;
      const realm = state.realms.find(r => r.id === entry.realmId);
      const contentPreview = entry.content.length > 300 
        ? entry.content.substring(0, 300) + '...' 
        : entry.content;
      return `World Entry: ${entry.title}
- Category: ${entry.category}
- Realm: ${realm?.name || 'Unknown'}
- Content: ${contentPreview || 'No content'}`;
    }

    case 'realm': {
      const realm = entity as Realm;
      return `Realm: ${realm.name}
- Status: ${realm.status}
- Description: ${realm.description || 'No description'}`;
    }

    case 'arc': {
      const arc = entity as Arc;
      return `Arc: ${arc.title}
- Status: ${arc.status}
- Description: ${arc.description || 'No description'}`;
    }

    case 'tag': {
      const tag = entity as Tag;
      return `Tag: ${tag.name}
- Category: ${tag.category || 'Uncategorized'}
- Color: ${tag.color || 'None'}`;
    }

    default:
      return 'Unknown entity type.';
  }
}

/**
 * Builds complete reference context for AI prompts
 */
export function buildReferenceContext(
  resolved: ResolvedReference[]
): ReferenceContext {
  if (resolved.length === 0) {
    return {
      references: [],
      formattedContext: '',
    };
  }

  // Group by reference name to avoid duplicates
  const uniqueRefs = new Map<string, ResolvedReference>();
  for (const ref of resolved) {
    const key = ref.reference.matchText.toLowerCase();
    if (!uniqueRefs.has(key) || ref.entity) {
      uniqueRefs.set(key, ref);
    }
  }

  const uniqueResolved = Array.from(uniqueRefs.values());

  const contextLines: string[] = [];
  contextLines.push('REFERENCE CONTEXT:');
  contextLines.push('The following @ references in your instructions refer to specific entities:');
  contextLines.push('');

  for (const resolvedRef of uniqueResolved) {
    contextLines.push(`${resolvedRef.reference.matchText} refers to:`);
    contextLines.push(resolvedRef.context);
    contextLines.push('');
  }

  return {
    references: uniqueResolved,
    formattedContext: contextLines.join('\n'),
  };
}

/**
 * Main function to parse and resolve references from text
 */
export function parseAndResolveReferences(
  text: string,
  state: NovelState
): ReferenceContext {
  const references = parseReferences(text);
  const resolved = resolveReferences(references, state);
  return buildReferenceContext(resolved);
}
