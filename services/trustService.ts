/**
 * Trust Service
 * 
 * Builds trust in automation through:
 * - Preview of extractions before applying
 * - Confidence scores for all automated actions
 * - Validation with actionable feedback
 * - Undo/redo capabilities
 * - Better error messages with guidance
 */

import { PostChapterExtraction, Character, NovelItem as Item, NovelTechnique as Technique, Antagonist, Scene, Arc, NovelState, Chapter } from '../types';
import { analyzeAutoConnections, Connection } from './autoConnectionService';

export interface ExtractionPreview {
  characters: CharacterPreview[];
  items: ItemPreview[];
  techniques: TechniquePreview[];
  antagonists: AntagonistPreview[];
  scenes: ScenePreview[];
  worldEntries: WorldEntryPreview[];
  connections: ConnectionPreview[];
  overallConfidence: number;
  warnings: string[];
  suggestions: string[];
}

export interface CharacterPreview {
  name: string;
  action: 'create' | 'update' | 'merge';
  confidence: number;
  existingCharacter?: Character;
  newData: Partial<Character>;
  warnings: string[];
  canAutoApply: boolean;
}

export interface ItemPreview {
  name: string;
  action: 'create' | 'update' | 'merge';
  confidence: number;
  existingItem?: Item;
  newData: Partial<Item>;
  warnings: string[];
  canAutoApply: boolean;
}

export interface TechniquePreview {
  name: string;
  action: 'create' | 'update' | 'merge';
  confidence: number;
  existingTechnique?: Technique;
  newData: Partial<Technique>;
  warnings: string[];
  canAutoApply: boolean;
}

export interface AntagonistPreview {
  name: string;
  action: 'create' | 'update' | 'merge';
  confidence: number;
  existingAntagonist?: Antagonist;
  newData: Partial<Antagonist>;
  warnings: string[];
  canAutoApply: boolean;
}

export interface ScenePreview {
  number: number;
  title: string;
  confidence: number;
  wordCount?: number;
  warnings: string[];
  canAutoApply: boolean;
}

export interface WorldEntryPreview {
  title: string;
  category: string;
  action: 'create' | 'update';
  confidence: number;
  warnings: string[];
  canAutoApply: boolean;
}

export interface ConnectionPreview {
  connection: Connection;
  canAutoApply: boolean;
  reason: string;
}

export interface TrustScore {
  overall: number; // 0-100
  extractionQuality: number; // 0-100
  connectionQuality: number; // 0-100
  dataCompleteness: number; // 0-100
  consistencyScore: number; // 0-100
  factors: {
    highConfidenceExtractions: number;
    lowConfidenceExtractions: number;
    missingRequiredFields: number;
    inconsistencies: number;
    warnings: number;
  };
}

/**
 * Generate preview of extraction before applying
 */
export function generateExtractionPreview(
  extraction: PostChapterExtraction,
  existingState: {
    characters: Character[];
    items: Item[];
    techniques: Technique[];
    antagonists: Antagonist[];
    arcs: Arc[];
  },
  novelState?: NovelState,
  newChapter?: Chapter,
  extractedScenes?: Scene[]
): ExtractionPreview {
  const characterPreviews: CharacterPreview[] = [];
  const itemPreviews: ItemPreview[] = [];
  const techniquePreviews: TechniquePreview[] = [];
  const antagonistPreviews: AntagonistPreview[] = [];
  const scenePreviews: ScenePreview[] = [];
  const worldEntryPreviews: WorldEntryPreview[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Preview characters
  if (extraction.characterUpserts) {
    for (const charUpsert of extraction.characterUpserts) {
      const name = String(charUpsert.name || '').trim();
      if (!name) continue;

      const existing = existingState.characters.find(c => 
        normalizeName(c.name) === normalizeName(name)
      );

      const confidence = calculateCharacterConfidence(charUpsert, existing);
      const charWarnings: string[] = [];
      
      // Validate required fields
      if (!charUpsert.set?.personality && !existing) {
        charWarnings.push('Missing personality information');
      }
      
      const canAutoApply = confidence >= 0.7 && charWarnings.length === 0;

      characterPreviews.push({
        name,
        action: existing ? (charUpsert.isNew ? 'merge' : 'update') : 'create',
        confidence,
        existingCharacter: existing,
        newData: charUpsert.set || {},
        warnings: charWarnings,
        canAutoApply
      });
    }
  }

  // Preview items
  if (extraction.itemUpdates) {
    for (const itemUpdate of extraction.itemUpdates) {
      const name = String(itemUpdate.name || '').trim();
      if (!name) continue;

      const existing = existingState.items.find(i =>
        normalizeName(i.name) === normalizeName(name)
      );

      const confidence = calculateItemConfidence(itemUpdate, existing);
      const itemWarnings: string[] = [];

      if (!itemUpdate.category) {
        itemWarnings.push('Missing category');
      }
      if (!itemUpdate.characterName) {
        itemWarnings.push('Missing character association');
      }

      const canAutoApply = confidence >= 0.75 && itemWarnings.length === 0;

      itemPreviews.push({
        name,
        action: existing || itemUpdate.action === 'update' ? 'update' : 'create',
        confidence,
        existingItem: existing,
        newData: {
          category: itemUpdate.category as any,
          description: itemUpdate.description,
        },
        warnings: itemWarnings,
        canAutoApply
      });
    }
  }

  // Preview techniques
  if (extraction.techniqueUpdates) {
    for (const techUpdate of extraction.techniqueUpdates) {
      const name = String(techUpdate.name || '').trim();
      if (!name) continue;

      const existing = existingState.techniques.find(t =>
        normalizeName(t.name) === normalizeName(name)
      );

      const confidence = calculateTechniqueConfidence(techUpdate, existing);
      const techWarnings: string[] = [];

      if (!techUpdate.category) {
        techWarnings.push('Missing category');
      }
      if (!techUpdate.type) {
        techWarnings.push('Missing type');
      }

      const canAutoApply = confidence >= 0.75 && techWarnings.length === 0;

      techniquePreviews.push({
        name,
        action: existing || techUpdate.action === 'update' ? 'update' : 'create',
        confidence,
        existingTechnique: existing,
        newData: {
          category: techUpdate.category as any,
          type: techUpdate.type as any,
          description: techUpdate.description,
        },
        warnings: techWarnings,
        canAutoApply
      });
    }
  }

  // Preview antagonists
  if (extraction.antagonistUpdates) {
    for (const antUpdate of extraction.antagonistUpdates) {
      const name = String(antUpdate.name || '').trim();
      if (!name) continue;

      const existing = existingState.antagonists.find(a =>
        normalizeName(a.name) === normalizeName(name)
      );

      const confidence = calculateAntagonistConfidence(antUpdate, existing);
      const antWarnings: string[] = [];

      if (!antUpdate.type) {
        antWarnings.push('Missing antagonist type');
      }
      if (!antUpdate.threatLevel) {
        antWarnings.push('Missing threat level');
      }

      const canAutoApply = confidence >= 0.8 && antWarnings.length === 0;

      antagonistPreviews.push({
        name,
        action: existing || antUpdate.action === 'update' ? 'update' : 'create',
        confidence,
        existingAntagonist: existing,
        newData: {
          type: antUpdate.type as any,
          threatLevel: antUpdate.threatLevel as any,
          description: antUpdate.description,
          motivation: antUpdate.motivation,
        },
        warnings: antWarnings,
        canAutoApply
      });
    }
  }

  // Preview scenes
  if (extraction.scenes) {
    for (const scene of extraction.scenes) {
      const sceneNum = typeof scene.number === 'number' ? scene.number : 0;
      const title = String(scene.title || '').trim();
      const contentExcerpt = String(scene.contentExcerpt || '').trim();
      
      const confidence = calculateSceneConfidence(scene);
      const sceneWarnings: string[] = [];

      if (!title && !contentExcerpt) {
        sceneWarnings.push('Missing both title and content excerpt');
      }
      if (sceneNum <= 0) {
        sceneWarnings.push('Invalid scene number');
      }

      const canAutoApply = confidence >= 0.6 && sceneWarnings.length === 0;

      scenePreviews.push({
        number: sceneNum,
        title: title || `Scene ${sceneNum}`,
        confidence,
        wordCount: contentExcerpt.split(/\s+/).filter(w => w.length > 0).length,
        warnings: sceneWarnings,
        canAutoApply
      });
    }
  }

  // Preview world entries
  if (extraction.worldEntryUpserts) {
    for (const worldEntry of extraction.worldEntryUpserts) {
      const title = String(worldEntry.title || '').trim();
      const content = String(worldEntry.content || '').trim();
      
      if (!title || !content) continue;

      const confidence = calculateWorldEntryConfidence(worldEntry);
      const entryWarnings: string[] = [];

      if (!worldEntry.category) {
        entryWarnings.push('Missing category');
      }
      if (content.length < 50) {
        entryWarnings.push('Content too short');
      }

      const canAutoApply = confidence >= 0.7 && entryWarnings.length === 0;

      worldEntryPreviews.push({
        title,
        category: worldEntry.category || 'Other',
        action: 'create', // Could check for existing but usually world entries are unique
        confidence,
        warnings: entryWarnings,
        canAutoApply
      });
    }
  }

  // Generate connection previews
  const connectionPreviews: ConnectionPreview[] = [];
  if (novelState && newChapter) {
    try {
      // Extract items and techniques that are being updated/created
      const extractedItems: Item[] = extraction.itemUpdates
        ? extraction.itemUpdates
            .map(itemUpdate => {
              const name = String(itemUpdate.name || '').trim();
              if (!name) return null;
              // Find existing item or create a new one based on update
              const existing = existingState.items.find(i =>
                normalizeName(i.name) === normalizeName(name)
              );
              return existing || {
                id: '',
                novelId: novelState.novel.id,
                name,
                category: (itemUpdate.category as any) || 'other',
                description: itemUpdate.description || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
            })
            .filter((item): item is Item => item !== null)
        : [];

      const extractedTechniques: Technique[] = extraction.techniqueUpdates
        ? extraction.techniqueUpdates
            .map(techUpdate => {
              const name = String(techUpdate.name || '').trim();
              if (!name) return null;
              // Find existing technique or create a new one based on update
              const existing = existingState.techniques.find(t =>
                normalizeName(t.name) === normalizeName(name)
              );
              return existing || {
                id: '',
                novelId: novelState.novel.id,
                name,
                category: (techUpdate.category as any) || 'other',
                type: (techUpdate.type as any) || 'basic',
                description: techUpdate.description || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
            })
            .filter((tech): tech is Technique => tech !== null)
        : [];

      const connectionAnalysis = analyzeAutoConnections(
        novelState,
        newChapter,
        extractedScenes || [],
        extractedItems,
        extractedTechniques
      );
      
      connectionAnalysis.connections.forEach(conn => {
        connectionPreviews.push({
          connection: conn,
          canAutoApply: conn.confidence >= 0.8,
          reason: conn.reason
        });
      });
    } catch (error) {
      console.warn('Error analyzing connections for preview:', error);
    }
  }

  // Calculate overall confidence
  const allConfidences = [
    ...characterPreviews.map(c => c.confidence),
    ...itemPreviews.map(i => i.confidence),
    ...techniquePreviews.map(t => t.confidence),
    ...antagonistPreviews.map(a => a.confidence),
    ...scenePreviews.map(s => s.confidence),
    ...worldEntryPreviews.map(w => w.confidence)
  ];

  const overallConfidence = allConfidences.length > 0
    ? allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length
    : 0;

  // Generate suggestions
  const autoApplicableCount = [
    ...characterPreviews.filter(c => c.canAutoApply),
    ...itemPreviews.filter(i => i.canAutoApply),
    ...techniquePreviews.filter(t => t.canAutoApply),
    ...antagonistPreviews.filter(a => a.canAutoApply),
    ...scenePreviews.filter(s => s.canAutoApply),
    ...worldEntryPreviews.filter(w => w.canAutoApply)
  ].length;

  if (autoApplicableCount > 0) {
    suggestions.push(`${autoApplicableCount} extraction(s) can be automatically applied with high confidence.`);
  }

  const needsReviewCount = [
    ...characterPreviews.filter(c => !c.canAutoApply),
    ...itemPreviews.filter(i => !i.canAutoApply),
    ...techniquePreviews.filter(t => !t.canAutoApply),
    ...antagonistPreviews.filter(a => !a.canAutoApply),
    ...scenePreviews.filter(s => !s.canAutoApply),
    ...worldEntryPreviews.filter(w => !w.canAutoApply)
  ].length;

  if (needsReviewCount > 0) {
    warnings.push(`${needsReviewCount} extraction(s) need review before applying.`);
  }

  return {
    characters: characterPreviews,
    items: itemPreviews,
    techniques: techniquePreviews,
    antagonists: antagonistPreviews,
    scenes: scenePreviews,
    worldEntries: worldEntryPreviews,
    connections: connectionPreviews,
    overallConfidence,
    warnings,
    suggestions
  };
}

/**
 * Calculate trust score for extraction
 */
export function calculateTrustScore(preview: ExtractionPreview): TrustScore {
  const allExtractions = [
    ...preview.characters,
    ...preview.items,
    ...preview.techniques,
    ...preview.antagonists,
    ...preview.scenes,
    ...preview.worldEntries
  ];

  // Calculate extraction quality (average confidence)
  const extractionQuality = allExtractions.length > 0
    ? allExtractions.reduce((sum, ext) => sum + ext.confidence, 0) / allExtractions.length * 100
    : 0;

  // Calculate connection quality
  const connectionQuality = preview.connections.length > 0
    ? preview.connections.reduce((sum, conn) => sum + conn.connection.confidence, 0) / preview.connections.length * 100
    : 100; // Default to 100 if no connections

  // Calculate data completeness
  const totalWarnings = allExtractions.reduce((sum, ext) => sum + ext.warnings.length, 0);
  const dataCompleteness = Math.max(0, 100 - (totalWarnings * 10));

  // Count factors
  const highConfidenceExtractions = allExtractions.filter(ext => ext.confidence >= 0.8).length;
  const lowConfidenceExtractions = allExtractions.filter(ext => ext.confidence < 0.6).length;
  const missingRequiredFields = totalWarnings;
  const inconsistencies = preview.warnings.length;
  const warnings = preview.warnings.length;

  // Consistency score (based on warnings and inconsistencies)
  const consistencyScore = Math.max(0, 100 - (inconsistencies * 15) - (totalWarnings * 5));

  // Overall score (weighted average)
  const overall = (
    extractionQuality * 0.35 +
    connectionQuality * 0.25 +
    dataCompleteness * 0.25 +
    consistencyScore * 0.15
  );

  return {
    overall: Math.round(overall),
    extractionQuality: Math.round(extractionQuality),
    connectionQuality: Math.round(connectionQuality),
    dataCompleteness: Math.round(dataCompleteness),
    consistencyScore: Math.round(consistencyScore),
    factors: {
      highConfidenceExtractions,
      lowConfidenceExtractions,
      missingRequiredFields,
      inconsistencies,
      warnings
    }
  };
}

/**
 * Generate user-friendly explanation of trust score
 */
export function explainTrustScore(score: TrustScore): string[] {
  const explanations: string[] = [];

  if (score.overall >= 90) {
    explanations.push('Excellent: All extractions have high confidence and can be safely automated.');
  } else if (score.overall >= 75) {
    explanations.push('Good: Most extractions are reliable. Review low-confidence items.');
  } else if (score.overall >= 60) {
    explanations.push('Moderate: Some extractions need review. Check warnings before applying.');
  } else {
    explanations.push('Low: Many extractions need manual review. Check all warnings carefully.');
  }

  if (score.factors.lowConfidenceExtractions > 0) {
    explanations.push(`${score.factors.lowConfidenceExtractions} extraction(s) have low confidence and should be reviewed.`);
  }

  if (score.factors.missingRequiredFields > 0) {
    explanations.push(`${score.factors.missingRequiredFields} field(s) are missing. These should be filled before applying.`);
  }

  if (score.factors.inconsistencies > 0) {
    explanations.push(`${score.factors.inconsistencies} inconsistency(ies) detected. Review before proceeding.`);
  }

  return explanations;
}

// Helper functions for confidence calculation
function calculateCharacterConfidence(upsert: any, existing?: Character): number {
  let confidence = 0.7; // Base confidence

  if (upsert.set?.personality) confidence += 0.1;
  if (upsert.set?.currentCultivation) confidence += 0.05;
  if (upsert.set?.age) confidence += 0.05;
  if (upsert.relationships && upsert.relationships.length > 0) confidence += 0.1;

  if (existing) {
    confidence += 0.1; // Higher confidence for updates vs creates
  }

  return Math.min(0.95, confidence);
}

function calculateItemConfidence(update: any, existing?: Item): number {
  let confidence = 0.75;

  if (update.category) confidence += 0.1;
  if (update.description) confidence += 0.05;
  if (update.characterName) confidence += 0.1;

  if (existing) confidence += 0.05;

  return Math.min(0.95, confidence);
}

function calculateTechniqueConfidence(update: any, existing?: Technique): number {
  let confidence = 0.75;

  if (update.category) confidence += 0.1;
  if (update.type) confidence += 0.1;
  if (update.description) confidence += 0.05;

  if (existing) confidence += 0.05;

  return Math.min(0.95, confidence);
}

function calculateAntagonistConfidence(update: any, existing?: Antagonist): number {
  let confidence = 0.8;

  if (update.type) confidence += 0.05;
  if (update.threatLevel) confidence += 0.05;
  if (update.description) confidence += 0.05;
  if (update.motivation) confidence += 0.05;

  if (existing) confidence += 0.05;

  return Math.min(0.95, confidence);
}

function calculateSceneConfidence(scene: any): number {
  let confidence = 0.6;

  if (scene.title) confidence += 0.1;
  if (scene.summary) confidence += 0.1;
  if (scene.contentExcerpt && scene.contentExcerpt.length > 100) confidence += 0.2;

  return Math.min(0.95, confidence);
}

function calculateWorldEntryConfidence(entry: any): number {
  let confidence = 0.7;

  if (entry.category) confidence += 0.1;
  if (entry.content && entry.content.length > 100) confidence += 0.15;
  if (entry.title && entry.title.length > 5) confidence += 0.05;

  return Math.min(0.95, confidence);
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}
