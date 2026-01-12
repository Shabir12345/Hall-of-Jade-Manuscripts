/**
 * Antagonist Processing Service
 * Handles intelligent processing of antagonist updates from AI extraction
 * Similar to itemTechniqueService but for antagonists
 */

import { Antagonist, AntagonistType, AntagonistStatus, ThreatLevel, AntagonistDuration } from '../types';
import { findMatchingAntagonist, mergeAntagonistInfo, generateAntagonistCanonicalName } from '../utils/antagonistMatching';
import { validateAntagonistInput } from '../utils/antagonistValidation';

export interface ProcessAntagonistResult {
  antagonist: Antagonist;
  wasCreated: boolean;
  wasMerged: boolean;
  similarity?: number;
}

/**
 * Process an antagonist update from AI extraction
 * Uses fuzzy matching to prevent duplicates and intelligently merges information
 */
export function processAntagonistUpdate(
  antUpdate: {
    name?: unknown;
    action?: unknown;
    antagonistId?: unknown;
    type?: unknown;
    description?: unknown;
    motivation?: unknown;
    powerLevel?: unknown;
    status?: unknown;
    threatLevel?: unknown;
    durationScope?: unknown;
    presenceType?: unknown;
    significance?: unknown;
    relationshipWithProtagonist?: {
      relationshipType?: unknown;
      intensity?: unknown;
    };
    arcRole?: unknown;
    notes?: unknown;
  },
  existingAntagonists: Antagonist[],
  novelId: string,
  chapterNumber: number,
  protagonistId?: string,
  activeArcId?: string
): ProcessAntagonistResult {
  const antName = String(antUpdate?.name || '').trim();
  if (!antName) {
    throw new Error('Antagonist name is required');
  }

  // Validate input
  const validation = validateAntagonistInput({
    name: antName,
    type: String(antUpdate?.type || 'individual'),
    status: String(antUpdate?.status || 'active'),
    threatLevel: String(antUpdate?.threatLevel || 'medium'),
    durationScope: String(antUpdate?.durationScope || 'arc'),
  });

  if (!validation.success) {
    throw new Error(`Invalid antagonist data: ${validation.error}`);
  }

  // Use fuzzy matching to find existing antagonist
  const matchResult = findMatchingAntagonist(antName, existingAntagonists, 0.85);
  const existingAntagonist = matchResult.antagonist;

  // Determine if we should update or create
  const shouldUpdate = antUpdate.action === 'update' || 
                       (existingAntagonist && matchResult.similarity >= 0.85) ||
                       (antUpdate.antagonistId && existingAntagonists.find(a => a.id === antUpdate.antagonistId));

  if (shouldUpdate && existingAntagonist) {
    // Update existing antagonist with intelligent merging
    const updates: Partial<Antagonist> = {
      description: antUpdate.description ? String(antUpdate.description).trim() : undefined,
      motivation: antUpdate.motivation ? String(antUpdate.motivation).trim() : undefined,
      powerLevel: antUpdate.powerLevel ? String(antUpdate.powerLevel).trim() : undefined,
      status: (antUpdate.status || existingAntagonist.status) as AntagonistStatus,
      threatLevel: (antUpdate.threatLevel || existingAntagonist.threatLevel) as ThreatLevel,
      lastAppearedChapter: chapterNumber,
      notes: antUpdate.notes ? String(antUpdate.notes).trim() : undefined,
      updatedAt: Date.now()
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      const k = key as keyof Antagonist;
      if (updates[k] === undefined) {
        delete updates[k];
      }
    });

    const merged = mergeAntagonistInfo(existingAntagonist, updates);

    return {
      antagonist: merged,
      wasCreated: false,
      wasMerged: true,
      similarity: matchResult.similarity
    };
  }

  // Create new antagonist
  const antagonistId = antUpdate.antagonistId || crypto.randomUUID();
  const newAntagonist: Antagonist = {
    id: antagonistId,
    novelId: novelId,
    name: antName,
    type: (antUpdate.type || 'individual') as AntagonistType,
    description: antUpdate.description ? String(antUpdate.description).trim() : '',
    motivation: antUpdate.motivation ? String(antUpdate.motivation).trim() : '',
    powerLevel: antUpdate.powerLevel ? String(antUpdate.powerLevel).trim() : '',
    status: (antUpdate.status || 'active') as AntagonistStatus,
    firstAppearedChapter: chapterNumber,
    lastAppearedChapter: chapterNumber,
    durationScope: (antUpdate.durationScope || 'arc') as AntagonistDuration,
    threatLevel: (antUpdate.threatLevel || 'medium') as ThreatLevel,
    notes: antUpdate.notes ? String(antUpdate.notes).trim() : '',
    relationships: protagonistId && antUpdate.relationshipWithProtagonist ? [{
      id: crypto.randomUUID(),
      antagonistId: antagonistId,
      characterId: protagonistId,
      relationshipType: (antUpdate.relationshipWithProtagonist.relationshipType || 'primary_target') as any,
      intensity: (antUpdate.relationshipWithProtagonist.intensity || 'enemy') as any,
      history: '',
      currentState: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }] : [],
    arcAssociations: activeArcId && antUpdate.arcRole ? [{
      id: crypto.randomUUID(),
      antagonistId: antagonistId,
      arcId: activeArcId,
      role: (antUpdate.arcRole || 'secondary') as any,
      introducedInArc: true,
      resolvedInArc: false,
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }] : [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return {
    antagonist: newAntagonist,
    wasCreated: true,
    wasMerged: false
  };
}

/**
 * Process multiple antagonist updates
 * Returns array of processed antagonists
 */
export function processAntagonistUpdates(
  antUpdates: Array<{
    name?: unknown;
    action?: unknown;
    antagonistId?: unknown;
    type?: unknown;
    description?: unknown;
    motivation?: unknown;
    powerLevel?: unknown;
    status?: unknown;
    threatLevel?: unknown;
    durationScope?: unknown;
    presenceType?: unknown;
    significance?: unknown;
    relationshipWithProtagonist?: {
      relationshipType?: unknown;
      intensity?: unknown;
    };
    arcRole?: unknown;
    notes?: unknown;
  }>,
  existingAntagonists: Antagonist[],
  novelId: string,
  chapterNumber: number,
  protagonistId?: string,
  activeArcId?: string
): ProcessAntagonistResult[] {
  const results: ProcessAntagonistResult[] = [];
  const processedNames = new Set<string>();

  for (const antUpdate of antUpdates) {
    try {
      const antName = String(antUpdate?.name || '').trim();
      if (!antName || processedNames.has(antName.toLowerCase())) {
        continue; // Skip empty or duplicate names
      }

      const result = processAntagonistUpdate(
        antUpdate,
        existingAntagonists,
        novelId,
        chapterNumber,
        protagonistId,
        activeArcId
      );

      results.push(result);
      processedNames.add(antName.toLowerCase());

      // Update existingAntagonists for next iteration (to handle multiple updates to same antagonist)
      if (result.wasCreated) {
        existingAntagonists.push(result.antagonist);
      } else {
        const index = existingAntagonists.findIndex(a => a.id === result.antagonist.id);
        if (index >= 0) {
          existingAntagonists[index] = result.antagonist;
        }
      }
    } catch (error) {
      console.error(`Error processing antagonist update "${antUpdate?.name}":`, error);
      // Continue processing other antagonists
    }
  }

  return results;
}
