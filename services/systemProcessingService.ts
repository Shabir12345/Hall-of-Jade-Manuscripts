/**
 * System Processing Service
 * Handles intelligent processing of character system updates from AI extraction
 * Similar to antagonistProcessingService but for character systems
 */

import { CharacterSystem, SystemType, SystemCategory, SystemStatus, SystemFeature } from '../types';

export interface ProcessSystemResult {
  system: CharacterSystem;
  wasCreated: boolean;
  wasMerged: boolean;
  similarity?: number;
  chapterAppearance?: {
    presenceType: 'direct' | 'mentioned' | 'hinted' | 'used';
    significance: 'major' | 'minor' | 'foreshadowing';
    featuresUsed?: string[];
    notes?: string;
  };
}

/**
 * Normalize system name for fuzzy matching
 */
function normalizeSystemName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find matching system using fuzzy matching
 */
function findMatchingSystem(
  systemName: string,
  existingSystems: CharacterSystem[],
  threshold: number = 0.85
): { system: CharacterSystem | null; similarity: number } {
  const normalized = normalizeSystemName(systemName);
  
  let bestMatch: CharacterSystem | null = null;
  let bestSimilarity = 0;

  for (const system of existingSystems) {
    const existingNormalized = normalizeSystemName(system.name);
    
    // Exact match
    if (existingNormalized === normalized) {
      return { system, similarity: 1.0 };
    }

    // Check if one contains the other
    if (existingNormalized.includes(normalized) || normalized.includes(existingNormalized)) {
      const similarity = Math.min(
        existingNormalized.length / normalized.length,
        normalized.length / existingNormalized.length
      );
      if (similarity > bestSimilarity && similarity >= threshold) {
        bestSimilarity = similarity;
        bestMatch = system;
      }
      continue;
    }

    // Simple Levenshtein-like similarity
    const longer = normalized.length > existingNormalized.length ? normalized : existingNormalized;
    const shorter = normalized.length > existingNormalized.length ? existingNormalized : normalized;
    
    if (longer.length === 0) continue;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    const similarity = matches / longer.length;
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = system;
    }
  }

  return { system: bestMatch, similarity: bestSimilarity };
}

/**
 * Merge system information intelligently
 */
function mergeSystemInfo(
  existing: CharacterSystem,
  updates: Partial<CharacterSystem>
): CharacterSystem {
  const merged: CharacterSystem = {
    ...existing,
    ...updates,
    features: [...(existing.features || [])],
  };

  // Merge features if new ones are added
  if (updates.features && updates.features.length > 0) {
    const existingFeatureNames = new Set(merged.features.map(f => f.name.toLowerCase()));
    for (const feature of updates.features) {
      if (!existingFeatureNames.has(feature.name.toLowerCase())) {
        merged.features.push(feature);
      }
    }
  }

  // Update timestamps
  merged.updatedAt = Date.now();

  return merged;
}

/**
 * Validate system input
 */
function validateSystemInput(data: {
  name: string;
  type: string;
  category: string;
  status: string;
}): { success: boolean; error?: string } {
  if (!data.name || !data.name.trim()) {
    return { success: false, error: 'System name is required' };
  }

  const validTypes: SystemType[] = ['cultivation', 'game', 'cheat', 'ability', 'interface', 'evolution', 'other'];
  if (data.type && !validTypes.includes(data.type as SystemType)) {
    return { success: false, error: `Invalid system type: ${data.type}` };
  }

  const validCategories: SystemCategory[] = ['core', 'support', 'evolution', 'utility', 'combat', 'passive'];
  if (data.category && !validCategories.includes(data.category as SystemCategory)) {
    return { success: false, error: `Invalid system category: ${data.category}` };
  }

  const validStatuses: SystemStatus[] = ['active', 'dormant', 'upgraded', 'merged', 'deactivated'];
  if (data.status && !validStatuses.includes(data.status as SystemStatus)) {
    return { success: false, error: `Invalid system status: ${data.status}` };
  }

  return { success: true };
}

/**
 * Process a system update from AI extraction
 * Uses fuzzy matching to prevent duplicates and intelligently merges information
 */
export function processSystemUpdate(
  sysUpdate: {
    name?: unknown;
    action?: unknown;
    systemId?: unknown;
    characterName?: unknown;
    type?: unknown;
    category?: unknown;
    description?: unknown;
    currentLevel?: unknown;
    currentVersion?: unknown;
    status?: unknown;
    addFeatures?: unknown;
    upgradeFeatures?: unknown;
    presenceType?: unknown;
    significance?: unknown;
    notes?: unknown;
  },
  existingSystems: CharacterSystem[],
  novelId: string,
  characterId: string,
  chapterNumber: number
): ProcessSystemResult {
  const sysName = String(sysUpdate?.name || '').trim();
  if (!sysName) {
    throw new Error('System name is required');
  }

  // Validate input
  const validation = validateSystemInput({
    name: sysName,
    type: String(sysUpdate?.type || 'other'),
    category: String(sysUpdate?.category || 'core'),
    status: String(sysUpdate?.status || 'active'),
  });

  if (!validation.success) {
    throw new Error(`Invalid system data: ${validation.error}`);
  }

  // Use fuzzy matching to find existing system
  const matchResult = findMatchingSystem(sysName, existingSystems, 0.85);
  const existingSystem = matchResult.system;

  // Determine if we should update or create
  const shouldUpdate = sysUpdate.action === 'update' || 
                       (existingSystem && matchResult.similarity >= 0.85) ||
                       (sysUpdate.systemId && existingSystems.find(s => s.id === sysUpdate.systemId));

  if (shouldUpdate && existingSystem) {
    // Update existing system with intelligent merging
    const newFeatures: SystemFeature[] = [];
    
    // Process addFeatures
    if (Array.isArray(sysUpdate.addFeatures) && sysUpdate.addFeatures.length > 0) {
      const existingFeatureNames = new Set(existingSystem.features.map(f => f.name.toLowerCase()));
      for (const featureName of sysUpdate.addFeatures) {
        const featureStr = String(featureName).trim();
        if (featureStr && !existingFeatureNames.has(featureStr.toLowerCase())) {
          newFeatures.push({
            id: crypto.randomUUID(),
            systemId: existingSystem.id,
            name: featureStr,
            description: '',
            isActive: true,
            unlockedChapter: chapterNumber,
            notes: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Update upgraded features
    if (Array.isArray(sysUpdate.upgradeFeatures) && sysUpdate.upgradeFeatures.length > 0) {
      const upgradeSet = new Set(sysUpdate.upgradeFeatures.map(f => String(f).toLowerCase()));
      for (const feature of existingSystem.features) {
        if (upgradeSet.has(feature.name.toLowerCase())) {
          // Mark as upgraded or update level
          feature.level = feature.level || 'Upgraded';
          feature.updatedAt = Date.now();
        }
      }
    }

    const updates: Partial<CharacterSystem> = {
      description: sysUpdate.description ? String(sysUpdate.description).trim() : undefined,
      currentLevel: sysUpdate.currentLevel ? String(sysUpdate.currentLevel).trim() : undefined,
      currentVersion: sysUpdate.currentVersion ? String(sysUpdate.currentVersion).trim() : undefined,
      status: (sysUpdate.status || existingSystem.status) as SystemStatus,
      lastUpdatedChapter: chapterNumber,
      history: sysUpdate.addFeatures || sysUpdate.upgradeFeatures ? 
        (existingSystem.history + `\n\nChapter ${chapterNumber}: ` +
         (sysUpdate.addFeatures ? `Added features: ${Array.isArray(sysUpdate.addFeatures) ? sysUpdate.addFeatures.join(', ') : ''}` : '') +
         (sysUpdate.upgradeFeatures ? `Upgraded features: ${Array.isArray(sysUpdate.upgradeFeatures) ? sysUpdate.upgradeFeatures.join(', ') : ''}` : ''))
        : undefined,
      notes: sysUpdate.notes ? String(sysUpdate.notes).trim() : undefined,
      updatedAt: Date.now()
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      const k = key as keyof CharacterSystem;
      if (updates[k] === undefined) {
        delete updates[k];
      }
    });

    const merged = mergeSystemInfo(existingSystem, {
      ...updates,
      features: [...existingSystem.features, ...newFeatures]
    });

    // Determine chapter appearance info from update
    const presenceType = (sysUpdate.presenceType || 'direct') as 'direct' | 'mentioned' | 'hinted' | 'used';
    const significance = (sysUpdate.significance || 
      (presenceType === 'direct' || presenceType === 'used' ? 'major' : presenceType === 'hinted' ? 'foreshadowing' : 'minor')) as 'major' | 'minor' | 'foreshadowing';

    return {
      system: merged,
      wasCreated: false,
      wasMerged: true,
      similarity: matchResult.similarity,
      chapterAppearance: {
        presenceType,
        significance,
        featuresUsed: Array.isArray(sysUpdate.addFeatures) ? sysUpdate.addFeatures.map(f => String(f)) : 
                     Array.isArray(sysUpdate.upgradeFeatures) ? sysUpdate.upgradeFeatures.map(f => String(f)) : undefined,
        notes: sysUpdate.notes ? String(sysUpdate.notes).trim() : undefined
      }
    };
  }

  // Create new system
  const systemId = sysUpdate.systemId || crypto.randomUUID();
  const initialFeatures: SystemFeature[] = [];
  
  // Process addFeatures for new system
  if (Array.isArray(sysUpdate.addFeatures) && sysUpdate.addFeatures.length > 0) {
    for (const featureName of sysUpdate.addFeatures) {
      const featureStr = String(featureName).trim();
      if (featureStr) {
        initialFeatures.push({
          id: crypto.randomUUID(),
          systemId: systemId,
          name: featureStr,
          description: '',
          isActive: true,
          unlockedChapter: chapterNumber,
          notes: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  const newSystem: CharacterSystem = {
    id: systemId,
    novelId: novelId,
    characterId: characterId,
    name: sysName,
    type: (sysUpdate.type || 'other') as SystemType,
    category: (sysUpdate.category || 'core') as SystemCategory,
    description: sysUpdate.description ? String(sysUpdate.description).trim() : '',
    currentLevel: sysUpdate.currentLevel ? String(sysUpdate.currentLevel).trim() : undefined,
    currentVersion: sysUpdate.currentVersion ? String(sysUpdate.currentVersion).trim() : undefined,
    status: (sysUpdate.status || 'active') as SystemStatus,
    features: initialFeatures,
    firstAppearedChapter: chapterNumber,
    lastUpdatedChapter: chapterNumber,
    history: `System discovered in chapter ${chapterNumber}.` +
             (sysUpdate.addFeatures && Array.isArray(sysUpdate.addFeatures) && sysUpdate.addFeatures.length > 0 ?
              ` Initial features: ${sysUpdate.addFeatures.join(', ')}.` : ''),
    notes: sysUpdate.notes ? String(sysUpdate.notes).trim() : '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Determine chapter appearance info from update
  const presenceType = (sysUpdate.presenceType || 'direct') as 'direct' | 'mentioned' | 'hinted' | 'used';
  const significance = (sysUpdate.significance || 
    (presenceType === 'direct' || presenceType === 'used' ? 'major' : presenceType === 'hinted' ? 'foreshadowing' : 'minor')) as 'major' | 'minor' | 'foreshadowing';

  return {
    system: newSystem,
    wasCreated: true,
    wasMerged: false,
    chapterAppearance: {
      presenceType,
      significance,
      featuresUsed: Array.isArray(sysUpdate.addFeatures) ? sysUpdate.addFeatures.map(f => String(f)) : undefined,
      notes: sysUpdate.notes ? String(sysUpdate.notes).trim() : undefined
    }
  };
}

/**
 * Process multiple system updates
 * Returns array of processed systems
 */
export function processSystemUpdates(
  sysUpdates: Array<{
    name?: unknown;
    action?: unknown;
    systemId?: unknown;
    characterName?: unknown;
    type?: unknown;
    category?: unknown;
    description?: unknown;
    currentLevel?: unknown;
    currentVersion?: unknown;
    status?: unknown;
    addFeatures?: unknown;
    upgradeFeatures?: unknown;
    presenceType?: unknown;
    significance?: unknown;
    notes?: unknown;
  }>,
  existingSystems: CharacterSystem[],
  novelId: string,
  characterId: string,
  chapterNumber: number
): ProcessSystemResult[] {
  const results: ProcessSystemResult[] = [];
  const processedNames = new Set<string>();

  for (const sysUpdate of sysUpdates) {
    try {
      const sysName = String(sysUpdate?.name || '').trim();
      if (!sysName || processedNames.has(sysName.toLowerCase())) {
        continue; // Skip empty or duplicate names
      }

      const result = processSystemUpdate(
        sysUpdate,
        existingSystems,
        novelId,
        characterId,
        chapterNumber
      );

      results.push(result);
      processedNames.add(sysName.toLowerCase());

      // Update existingSystems for next iteration (to handle multiple updates to same system)
      if (result.wasCreated) {
        existingSystems.push(result.system);
      } else {
        const index = existingSystems.findIndex(s => s.id === result.system.id);
        if (index >= 0) {
          existingSystems[index] = result.system;
        }
      }
    } catch (error) {
      console.error(`Error processing system update "${sysUpdate?.name}":`, error);
      // Continue processing other systems
    }
  }

  return results;
}
