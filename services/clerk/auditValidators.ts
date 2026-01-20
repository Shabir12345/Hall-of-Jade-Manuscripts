/**
 * Audit Validators
 * 
 * Validation logic for each audit type to prevent hallucination
 * and ensure Clerk deltas are consistent with existing state.
 */

import { NovelState, Character } from '../../types';
import { LoreBible } from '../../types/loreBible';
import {
  ClerkDelta,
  DeltaValidationResult,
  DeltaValidationError,
  TechniqueUpdate,
  InventoryUpdate,
  CharacterStateUpdate,
  ConflictUpdate,
  KarmaDebtUpdate,
} from '../../types/clerk';
import { logger } from '../loggingService';

/**
 * Validate a complete Clerk delta
 */
export function validateClerkDelta(
  delta: ClerkDelta,
  bible: LoreBible,
  state: NovelState
): DeltaValidationResult {
  const errors: DeltaValidationError[] = [];
  const warnings: string[] = [];

  // Validate protagonist updates
  if (delta.updates.protagonist) {
    const protagonistErrors = validateProtagonistUpdates(
      delta.updates.protagonist,
      bible,
      state
    );
    errors.push(...protagonistErrors);
  }

  // Validate character updates
  if (delta.updates.characters) {
    for (const charUpdate of delta.updates.characters) {
      const charErrors = validateCharacterUpdate(charUpdate, state);
      errors.push(...charErrors);
    }
  }

  // Validate conflict updates
  if (delta.updates.activeConflicts) {
    for (const conflictUpdate of delta.updates.activeConflicts) {
      const conflictErrors = validateConflictUpdate(conflictUpdate, bible);
      errors.push(...conflictErrors);
    }
  }

  // Validate karma debt updates
  if (delta.updates.karmaDebts) {
    for (const karmaUpdate of delta.updates.karmaDebts) {
      const karmaErrors = validateKarmaDebtUpdate(karmaUpdate, bible, state);
      errors.push(...karmaErrors);
    }
  }

  // Validate power system updates
  if (delta.updates.powerSystem) {
    const powerErrors = validatePowerSystemUpdate(delta.updates.powerSystem, bible, state);
    errors.push(...powerErrors);
  }

  // Check for warnings from continuity flags
  if (delta.observations.continuityFlags) {
    for (const flag of delta.observations.continuityFlags) {
      if (flag.severity === 'warning' || flag.severity === 'critical') {
        warnings.push(`[${flag.type}] ${flag.message}`);
      }
    }
  }

  // Create sanitized delta with invalid updates removed
  const sanitizedDelta = createSanitizedDelta(delta, errors);

  const criticalErrors = errors.filter(e => e.severity === 'error');
  
  return {
    valid: criticalErrors.length === 0,
    errors,
    warnings,
    sanitizedDelta,
  };
}

/**
 * Validate protagonist updates
 */
function validateProtagonistUpdates(
  update: ClerkDelta['updates']['protagonist'],
  bible: LoreBible,
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  if (!update) return errors;

  // Validate cultivation updates
  if (update.cultivation) {
    const cultErrors = validateCultivationUpdate(
      update.cultivation,
      bible.protagonist.cultivation,
      state
    );
    errors.push(...cultErrors);
  }

  // Validate technique updates
  if (update.techniques) {
    for (const tech of update.techniques) {
      const techErrors = validateTechniqueUpdate(tech, bible.protagonist.techniques, state);
      errors.push(...techErrors);
    }
  }

  // Validate inventory updates
  if (update.inventory) {
    for (const inv of update.inventory) {
      const invErrors = validateInventoryUpdate(inv, bible.protagonist.inventory, state);
      errors.push(...invErrors);
    }
  }

  return errors;
}

/**
 * Validate cultivation state changes
 */
function validateCultivationUpdate(
  update: Partial<LoreBible['protagonist']['cultivation']>,
  current: LoreBible['protagonist']['cultivation'],
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  // Check for unreasonable realm jumps (more than 2 major realms at once)
  if (update.realm && current.realm && update.realm !== current.realm) {
    const knownRealms = getKnownRealmHierarchy(state);
    const currentIndex = knownRealms.findIndex(r => 
      current.realm.toLowerCase().includes(r.toLowerCase())
    );
    const newIndex = knownRealms.findIndex(r => 
      update.realm!.toLowerCase().includes(r.toLowerCase())
    );

    if (currentIndex >= 0 && newIndex >= 0) {
      const jump = newIndex - currentIndex;
      
      if (jump > 2) {
        errors.push({
          field: 'protagonist.cultivation.realm',
          message: `Suspicious cultivation jump: ${current.realm} → ${update.realm} (${jump} realms)`,
          severity: 'warning',
          invalidValue: update.realm,
          suggestion: 'Verify this is supported by the chapter text',
        });
      }

      if (jump < -1) {
        errors.push({
          field: 'protagonist.cultivation.realm',
          message: `Cultivation regression: ${current.realm} → ${update.realm}`,
          severity: 'warning',
          invalidValue: update.realm,
          suggestion: 'Ensure regression is explicitly justified (injury, curse, etc.)',
        });
      }
    }
  }

  return errors;
}

/**
 * Validate a technique update
 */
function validateTechniqueUpdate(
  update: TechniqueUpdate,
  currentTechniques: LoreBible['protagonist']['techniques'],
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  // Check if technique exists in novel's technique registry
  const novelTechnique = state.novelTechniques?.find(
    t => t.name.toLowerCase() === update.name.toLowerCase() ||
         t.canonicalName.toLowerCase() === update.name.toLowerCase()
  );

  // For 'update' or 'remove' actions, technique should exist
  if (update.action === 'update' || update.action === 'remove') {
    const exists = currentTechniques.some(
      t => t.name.toLowerCase() === update.name.toLowerCase()
    );
    
    if (!exists) {
      errors.push({
        field: `protagonist.techniques.${update.name}`,
        message: `Cannot ${update.action} unknown technique: ${update.name}`,
        severity: 'error',
        invalidValue: update,
        suggestion: 'Check if the technique name matches an existing one',
      });
    }
  }

  // Warn about completely new techniques that aren't in the novel registry
  if (update.action === 'add' && !novelTechnique) {
    errors.push({
      field: `protagonist.techniques.${update.name}`,
      message: `New technique "${update.name}" is not in the novel's technique registry`,
      severity: 'warning',
      invalidValue: update.name,
      suggestion: 'Consider adding this technique to the novel registry',
    });
  }

  return errors;
}

/**
 * Validate an inventory update
 */
function validateInventoryUpdate(
  update: InventoryUpdate,
  currentInventory: LoreBible['protagonist']['inventory'],
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  const allItems = [...currentInventory.equipped, ...currentInventory.storageRing];
  const existingItem = allItems.find(
    i => i.name.toLowerCase() === update.name.toLowerCase()
  );

  // For consume/lose/upgrade, item must exist
  if (['consume', 'lose', 'upgrade', 'move'].includes(update.action)) {
    if (!existingItem) {
      errors.push({
        field: `protagonist.inventory.${update.name}`,
        message: `Cannot ${update.action} unknown item: ${update.name}`,
        severity: 'error',
        invalidValue: update,
        suggestion: 'Verify the item name matches an existing inventory item',
      });
    }
  }

  // Check quantity for consume action
  if (update.action === 'consume' && existingItem) {
    const currentQty = existingItem.quantity || 1;
    const consumeQty = update.quantityConsumed || 1;
    
    if (consumeQty > currentQty) {
      errors.push({
        field: `protagonist.inventory.${update.name}`,
        message: `Cannot consume ${consumeQty} ${update.name} (only ${currentQty} available)`,
        severity: 'error',
        invalidValue: update,
        suggestion: `Adjust quantity to ${currentQty} or less`,
      });
    }
  }

  // Check if item exists in novel's item registry
  if (update.action === 'add') {
    const novelItem = state.novelItems?.find(
      i => i.name.toLowerCase() === update.name.toLowerCase() ||
           i.canonicalName.toLowerCase() === update.name.toLowerCase()
    );
    
    if (!novelItem) {
      errors.push({
        field: `protagonist.inventory.${update.name}`,
        message: `New item "${update.name}" is not in the novel's item registry`,
        severity: 'warning',
        invalidValue: update.name,
        suggestion: 'Consider adding this item to the novel registry',
      });
    }
  }

  return errors;
}

/**
 * Validate a character update
 */
function validateCharacterUpdate(
  update: CharacterStateUpdate,
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  // For update/remove, character should exist
  if (update.action === 'update' || update.action === 'remove') {
    const exists = state.characterCodex.some(
      c => c.name.toLowerCase() === update.name.toLowerCase() ||
           c.id === update.characterId
    );
    
    if (!exists) {
      errors.push({
        field: `characters.${update.name}`,
        message: `Cannot ${update.action} unknown character: ${update.name}`,
        severity: 'error',
        invalidValue: update,
        suggestion: 'Verify the character name matches an existing character',
      });
    }
  }

  // Validate relationship type
  if (update.updates.relationshipToProtagonist) {
    const validRelationships = [
      'Sworn Enemy', 'Enemy', 'Rival', 'Neutral', 'Acquaintance',
      'Ally', 'Friend', 'Sworn Brother', 'Mentor', 'Student',
      'Master', 'Disciple', 'Family', 'Lover', 'Unknown'
    ];
    
    const normalized = update.updates.relationshipToProtagonist.toLowerCase();
    const isValid = validRelationships.some(r => r.toLowerCase() === normalized);
    
    if (!isValid) {
      errors.push({
        field: `characters.${update.name}.relationshipToProtagonist`,
        message: `Non-standard relationship type: ${update.updates.relationshipToProtagonist}`,
        severity: 'warning',
        invalidValue: update.updates.relationshipToProtagonist,
        suggestion: `Consider using one of: ${validRelationships.join(', ')}`,
      });
    }
  }

  return errors;
}

/**
 * Validate a conflict update
 */
function validateConflictUpdate(
  update: ConflictUpdate,
  bible: LoreBible
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  // For update/resolve/escalate, conflict should exist (unless creating new)
  if (['update', 'resolve', 'escalate'].includes(update.action)) {
    const exists = bible.activeConflicts.some(
      c => c.id === update.conflictId ||
           (update.description && c.description.toLowerCase().includes(update.description.toLowerCase()))
    );
    
    if (!exists && update.action !== 'add') {
      errors.push({
        field: `activeConflicts.${update.conflictId || update.description}`,
        message: `Cannot ${update.action} unknown conflict`,
        severity: 'warning',
        invalidValue: update,
        suggestion: 'The conflict may need to be created first',
      });
    }
  }

  return errors;
}

/**
 * Validate a karma debt update
 */
function validateKarmaDebtUpdate(
  update: KarmaDebtUpdate,
  bible: LoreBible,
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  // For update/resolve/escalate, debt should exist
  if (['update', 'resolve', 'escalate'].includes(update.action)) {
    const exists = bible.karmaDebts.some(
      k => k.id === update.karmaId ||
           (update.target && k.target.toLowerCase() === update.target.toLowerCase())
    );
    
    if (!exists) {
      errors.push({
        field: `karmaDebts.${update.karmaId || update.target}`,
        message: `Cannot ${update.action} unknown karma debt`,
        severity: 'warning',
        invalidValue: update,
        suggestion: 'The karma debt may need to be created first',
      });
    }
  }

  // For new karma debts, verify target exists
  if (update.action === 'add' && update.target) {
    const targetExists = state.characterCodex.some(
      c => c.name.toLowerCase() === update.target!.toLowerCase()
    ) || state.antagonists?.some(
      a => a.name.toLowerCase() === update.target!.toLowerCase()
    );

    if (!targetExists) {
      errors.push({
        field: `karmaDebts.${update.target}`,
        message: `Karma debt target "${update.target}" is not a known character or antagonist`,
        severity: 'warning',
        invalidValue: update.target,
        suggestion: 'Verify the target name or add them to the character codex',
      });
    }
  }

  return errors;
}

/**
 * Validate power system updates
 */
function validatePowerSystemUpdate(
  update: ClerkDelta['updates']['powerSystem'],
  bible: LoreBible,
  state: NovelState
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];

  if (!update) return errors;

  // Validate breakthrough characters exist
  if (update.recentBreakthroughs) {
    for (const breakthrough of update.recentBreakthroughs) {
      const charExists = state.characterCodex.some(
        c => c.name.toLowerCase() === breakthrough.character.toLowerCase()
      );
      
      if (!charExists) {
        errors.push({
          field: `powerSystem.recentBreakthroughs.${breakthrough.character}`,
          message: `Breakthrough character "${breakthrough.character}" is not in the character codex`,
          severity: 'warning',
          invalidValue: breakthrough,
          suggestion: 'Verify character name spelling',
        });
      }
    }
  }

  return errors;
}

/**
 * Get known realm hierarchy from novel state
 */
function getKnownRealmHierarchy(state: NovelState): string[] {
  // Try to get from world bible
  const powerLevelEntry = state.worldBible.find(e => e.category === 'PowerLevels');
  
  if (powerLevelEntry) {
    const levels = powerLevelEntry.content.match(/\d+\.\s*([^:\n,]+)/g);
    if (levels) {
      return levels.map(l => l.replace(/^\d+\.\s*/, '').trim());
    }
  }

  // Default Xianxia cultivation hierarchy
  return [
    'Mortal',
    'Qi Condensation',
    'Foundation Establishment',
    'Core Formation',
    'Nascent Soul',
    'Soul Transformation',
    'Void Refinement',
    'Body Integration',
    'Mahayana',
    'Tribulation',
    'Immortal Ascension',
    'True Immortal',
    'Golden Immortal',
    'Dao Lord',
    'Dao Ancestor',
  ];
}

/**
 * Create a sanitized delta with invalid updates removed
 */
function createSanitizedDelta(
  delta: ClerkDelta,
  errors: DeltaValidationError[]
): ClerkDelta {
  // Deep clone
  const sanitized: ClerkDelta = JSON.parse(JSON.stringify(delta));

  // Get fields with errors
  const errorFields = new Set(
    errors
      .filter(e => e.severity === 'error')
      .map(e => e.field)
  );

  // Remove protagonist technique/inventory updates that have errors
  if (sanitized.updates.protagonist) {
    if (sanitized.updates.protagonist.techniques) {
      sanitized.updates.protagonist.techniques = sanitized.updates.protagonist.techniques.filter(
        t => !errorFields.has(`protagonist.techniques.${t.name}`)
      );
      if (sanitized.updates.protagonist.techniques.length === 0) {
        delete sanitized.updates.protagonist.techniques;
      }
    }

    if (sanitized.updates.protagonist.inventory) {
      sanitized.updates.protagonist.inventory = sanitized.updates.protagonist.inventory.filter(
        i => !errorFields.has(`protagonist.inventory.${i.name}`)
      );
      if (sanitized.updates.protagonist.inventory.length === 0) {
        delete sanitized.updates.protagonist.inventory;
      }
    }
  }

  // Remove character updates with errors
  if (sanitized.updates.characters) {
    sanitized.updates.characters = sanitized.updates.characters.filter(
      c => !errorFields.has(`characters.${c.name}`)
    );
    if (sanitized.updates.characters.length === 0) {
      delete sanitized.updates.characters;
    }
  }

  return sanitized;
}

/**
 * Validate that a delta doesn't contain hallucinated content
 * by checking against the chapter text
 */
export function validateAgainstChapterText(
  delta: ClerkDelta,
  chapterContent: string
): DeltaValidationError[] {
  const errors: DeltaValidationError[] = [];
  const contentLower = chapterContent.toLowerCase();

  // Check technique names are mentioned in chapter
  if (delta.updates.protagonist?.techniques) {
    for (const tech of delta.updates.protagonist.techniques) {
      if (tech.action === 'add') {
        // Technique name should appear in some form in the chapter
        const techNameParts = tech.name.toLowerCase().split(/\s+/);
        const anyPartMentioned = techNameParts.some(part => 
          part.length > 3 && contentLower.includes(part)
        );
        
        if (!anyPartMentioned) {
          errors.push({
            field: `protagonist.techniques.${tech.name}`,
            message: `Technique "${tech.name}" may be hallucinated - not found in chapter text`,
            severity: 'warning',
            invalidValue: tech.name,
            suggestion: 'Verify this technique is actually mentioned in the chapter',
          });
        }
      }
    }
  }

  // Check item names are mentioned in chapter
  if (delta.updates.protagonist?.inventory) {
    for (const item of delta.updates.protagonist.inventory) {
      if (item.action === 'add') {
        const itemNameParts = item.name.toLowerCase().split(/\s+/);
        const anyPartMentioned = itemNameParts.some(part => 
          part.length > 3 && contentLower.includes(part)
        );
        
        if (!anyPartMentioned) {
          errors.push({
            field: `protagonist.inventory.${item.name}`,
            message: `Item "${item.name}" may be hallucinated - not found in chapter text`,
            severity: 'warning',
            invalidValue: item.name,
            suggestion: 'Verify this item is actually mentioned in the chapter',
          });
        }
      }
    }
  }

  return errors;
}
