/**
 * Auto-Connection Service
 * 
 * Automatically connects and links entities across the novel:
 * - Characters to scenes they appear in
 * - Items/techniques to arcs when discovered
 * - Characters to arcs based on appearance
 * - World entries to relevant chapters
 * - Relationship auto-detection when characters appear together
 */

import { Character, Scene, Arc, Item, Technique, WorldEntry, Chapter, Antagonist, NovelState } from '../types';
import { textContainsCharacterName } from '../utils/characterNameMatching';
import { normalize } from '../utils/textProcessor';

export interface AutoConnectionResult {
  success: boolean;
  connections: Connection[];
  warnings: string[];
  suggestions: string[];
}

export interface Connection {
  type: 'character-scene' | 'character-arc' | 'item-arc' | 'technique-arc' | 'world-entry-chapter' | 'relationship' | 'antagonist-arc';
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  confidence: number; // 0-1 confidence score
  reason: string;
}

/**
 * Auto-connect characters to scenes based on text content
 */
export function connectCharactersToScenes(
  characters: Character[],
  scenes: Scene[],
  chapterContent: string
): Connection[] {
  const connections: Connection[] = [];

  for (const scene of scenes) {
    const sceneText = (scene.content || scene.summary || '').toLowerCase();
    if (!sceneText) continue;

    for (const character of characters) {
      // Check if character name appears in scene
      if (textContainsCharacterName(sceneText, character.name)) {
        const confidence = calculateNameMentionConfidence(character.name, sceneText);
        
        connections.push({
          type: 'character-scene',
          sourceId: character.id,
          targetId: scene.id,
          sourceName: character.name,
          targetName: scene.title || `Scene ${scene.number}`,
          confidence,
          reason: `Character "${character.name}" mentioned in scene content`
        });
      }
    }
  }

  return connections;
}

/**
 * Auto-associate characters with arcs based on chapter appearances
 */
export function connectCharactersToArcs(
  characters: Character[],
  arcs: Arc[],
  chapters: Chapter[],
  chapterNumber: number
): Connection[] {
  const connections: Connection[] = [];

  // Find active arc
  const activeArc = arcs.find(a => a.status === 'active');
  if (!activeArc) return connections;

  // Check if arc has started
  if (activeArc.startedAtChapter && chapterNumber >= activeArc.startedAtChapter) {
    // Find characters mentioned in recent chapters of this arc
    const arcChapters = chapters.filter(c => 
      c.number >= (activeArc.startedAtChapter || 0) && 
      c.number <= chapterNumber
    );

    for (const character of characters) {
      let appearanceCount = 0;
      
      for (const chapter of arcChapters) {
        const chapterText = (chapter.content || chapter.summary || '').toLowerCase();
        if (textContainsCharacterName(chapterText, character.name)) {
          appearanceCount++;
        }
      }

      // If character appears in at least 2 chapters of this arc, suggest connection
      if (appearanceCount >= 2) {
        const confidence = Math.min(0.9, 0.6 + (appearanceCount * 0.1));
        
        connections.push({
          type: 'character-arc',
          sourceId: character.id,
          targetId: activeArc.id,
          sourceName: character.name,
          targetName: activeArc.title,
          confidence,
          reason: `Character appears in ${appearanceCount} chapters of this arc`
        });
      }
    }
  }

  return connections;
}

/**
 * Auto-associate items/techniques with active arc when discovered
 */
export function connectItemsToArc(
  items: Item[],
  activeArc: Arc | null,
  chapterNumber: number
): Connection[] {
  const connections: Connection[] = [];

  if (!activeArc) return connections;

  // Items discovered in active arc chapters should be associated with that arc
  for (const item of items) {
    if (item.firstAppearedChapter === chapterNumber || 
        (item.firstAppearedChapter && 
         activeArc.startedAtChapter && 
         item.firstAppearedChapter >= (activeArc.startedAtChapter || 0))) {
      
      connections.push({
        type: 'item-arc',
        sourceId: item.id,
        targetId: activeArc.id,
        sourceName: item.name,
        targetName: activeArc.title,
        confidence: 0.85,
        reason: `Item discovered during active arc`
      });
    }
  }

  return connections;
}

export function connectTechniquesToArc(
  techniques: Technique[],
  activeArc: Arc | null,
  chapterNumber: number
): Connection[] {
  const connections: Connection[] = [];

  if (!activeArc) return connections;

  // Techniques learned in active arc chapters should be associated with that arc
  for (const technique of techniques) {
    if (technique.firstAppearedChapter === chapterNumber ||
        (technique.firstAppearedChapter &&
         activeArc.startedAtChapter &&
         technique.firstAppearedChapter >= (activeArc.startedAtChapter || 0))) {
      
      connections.push({
        type: 'technique-arc',
        sourceId: technique.id,
        targetId: activeArc.id,
        sourceName: technique.name,
        targetName: activeArc.title,
        confidence: 0.85,
        reason: `Technique learned during active arc`
      });
    }
  }

  return connections;
}

/**
 * Auto-detect relationships when characters appear together in chapters
 */
export function detectCharacterRelationships(
  characters: Character[],
  chapters: Chapter[],
  recentChapterCount: number = 5
): Connection[] {
  const connections: Connection[] = [];

  // Get recent chapters
  const recentChapters = chapters
    .sort((a, b) => b.number - a.number)
    .slice(0, recentChapterCount);

  // Check for character pairs appearing together
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const char1 = characters[i];
      const char2 = characters[j];

      // Skip if relationship already exists
      const existingRel = char1.relationships?.find(r => r.targetName === char2.name);
      if (existingRel) continue;

      let coAppearanceCount = 0;

      for (const chapter of recentChapters) {
        const chapterText = (chapter.content || chapter.summary || '').toLowerCase();
        const char1Present = textContainsCharacterName(chapterText, char1.name);
        const char2Present = textContainsCharacterName(chapterText, char2.name);

        if (char1Present && char2Present) {
          coAppearanceCount++;
        }
      }

      // If characters appear together in multiple chapters, suggest relationship
      if (coAppearanceCount >= 2) {
        const confidence = Math.min(0.8, 0.5 + (coAppearanceCount * 0.1));

        connections.push({
          type: 'relationship',
          sourceId: char1.id,
          targetId: char2.id,
          sourceName: char1.name,
          targetName: char2.name,
          confidence,
          reason: `Characters appear together in ${coAppearanceCount} recent chapters`
        });
      }
    }
  }

  return connections;
}

/**
 * Auto-associate antagonists with active arc if not already associated
 */
export function connectAntagonistsToArc(
  antagonists: Antagonist[],
  activeArc: Arc | null,
  chapterNumber: number
): Connection[] {
  const connections: Connection[] = [];

  if (!activeArc) return connections;

  for (const antagonist of antagonists) {
    // Check if already associated with this arc
    const alreadyAssociated = antagonist.arcAssociations?.some(
      assoc => assoc.arcId === activeArc.id
    );

    if (!alreadyAssociated) {
      // If antagonist appeared in arc chapter range, suggest association
      if (antagonist.firstAppearedChapter &&
          activeArc.startedAtChapter &&
          antagonist.firstAppearedChapter >= activeArc.startedAtChapter) {
        
        connections.push({
          type: 'antagonist-arc',
          sourceId: antagonist.id,
          targetId: activeArc.id,
          sourceName: antagonist.name,
          targetName: activeArc.title,
          confidence: 0.9,
          reason: `Antagonist first appeared during active arc`
        });
      } else if (antagonist.lastAppearedChapter === chapterNumber &&
                 activeArc.startedAtChapter &&
                 chapterNumber >= activeArc.startedAtChapter) {
        
        connections.push({
          type: 'antagonist-arc',
          sourceId: antagonist.id,
          targetId: activeArc.id,
          sourceName: antagonist.name,
          targetName: activeArc.title,
          confidence: 0.75,
          reason: `Antagonist appeared in current chapter of active arc`
        });
      }
    }
  }

  return connections;
}

/**
 * Comprehensive auto-connection analysis for a chapter extraction
 */
export function analyzeAutoConnections(
  state: NovelState,
  newChapter: Chapter,
  extractedScenes: Scene[],
  extractedItems: Item[],
  extractedTechniques: Technique[]
): AutoConnectionResult {
  const connections: Connection[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const activeArc = state.plotLedger.find(a => a.status === 'active') || null;

  // 1. Connect characters to scenes
  const characterSceneConnections = connectCharactersToScenes(
    state.characterCodex,
    extractedScenes,
    newChapter.content
  );
  connections.push(...characterSceneConnections);

  // 2. Connect characters to arcs
  const characterArcConnections = connectCharactersToArcs(
    state.characterCodex,
    state.plotLedger,
    state.chapters,
    newChapter.number
  );
  connections.push(...characterArcConnections);

  // 3. Connect items to arc
  const itemArcConnections = connectItemsToArc(
    [...(state.novelItems || []), ...extractedItems],
    activeArc,
    newChapter.number
  );
  connections.push(...itemArcConnections);

  // 4. Connect techniques to arc
  const techniqueArcConnections = connectTechniquesToArc(
    [...(state.novelTechniques || []), ...extractedTechniques],
    activeArc,
    newChapter.number
  );
  connections.push(...techniqueArcConnections);

  // 5. Detect character relationships
  const relationshipConnections = detectCharacterRelationships(
    state.characterCodex,
    state.chapters
  );
  connections.push(...relationshipConnections);

  // 6. Connect antagonists to arc
  if (state.antagonists) {
    const antagonistArcConnections = connectAntagonistsToArc(
      state.antagonists,
      activeArc,
      newChapter.number
    );
    connections.push(...antagonistArcConnections);
  }

  // Generate suggestions based on findings
  if (connections.length === 0) {
    suggestions.push('No automatic connections detected. This may be normal for early chapters.');
  } else {
    suggestions.push(`Found ${connections.length} potential connections to automate.`);
    
    // Group by type
    const byType = connections.reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byType).forEach(([type, count]) => {
      suggestions.push(`- ${count} ${type.replace(/-/g, ' ')} connection(s)`);
    });
  }

  // Check for high-confidence connections that should definitely be applied
  const highConfidenceConnections = connections.filter(c => c.confidence >= 0.8);
  if (highConfidenceConnections.length > 0) {
    suggestions.push(`${highConfidenceConnections.length} high-confidence connection(s) recommended for automatic application.`);
  }

  return {
    success: true,
    connections,
    warnings,
    suggestions
  };
}

/**
 * Calculate confidence score for character name mention in text
 */
function calculateNameMentionConfidence(characterName: string, text: string): number {
  const nameLower = characterName.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Exact match = highest confidence
  if (textLower.includes(nameLower)) {
    // Count occurrences - more mentions = higher confidence
    const matches = textLower.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    const occurrenceCount = matches ? matches.length : 0;
    
    // Base confidence 0.7, increases with mentions (max 0.95)
    return Math.min(0.95, 0.7 + (occurrenceCount * 0.05));
  }
  
  // Partial match = lower confidence
  const nameWords = nameLower.split(/\s+/);
  const matchedWords = nameWords.filter(word => textLower.includes(word));
  
  if (matchedWords.length === nameWords.length) {
    return 0.6; // All words matched but not as phrase
  } else if (matchedWords.length > 0) {
    return 0.4; // Some words matched
  }
  
  return 0.2; // Very low confidence
}
