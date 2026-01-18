/**
 * Consistency Constraints
 * 
 * Generates explicit constraints for prompts to ensure consistency.
 * Makes constraints prominent in prompt structure.
 */

import { NovelState, Character } from '../../types';
import { getKnowledgeGraphService } from '../knowledgeGraphService';
import { getPowerLevelSystem } from '../powerLevelSystem';

export interface ConsistencyConstraint {
  type: 'power_level' | 'relationship' | 'world_rule' | 'character_state' | 'location';
  entityId?: string;
  entityName?: string;
  constraint: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface ConsistencyConstraints {
  constraints: ConsistencyConstraint[];
  formattedText: string;
}

/**
 * Generate consistency constraints for prompt
 */
export function generateConsistencyConstraints(
  state: NovelState,
  characterIds: string[]
): ConsistencyConstraints {
  const constraints: ConsistencyConstraint[] = [];
  const graphService = getKnowledgeGraphService();
  const powerSystem = getPowerLevelSystem();

  // Initialize graph if needed
  if (!graphService.getGraph()) {
    graphService.initializeGraph(state);
  }

  // Generate constraints for each character
  characterIds.forEach(characterId => {
    const character = state.characterCodex.find(c => c.id === characterId);
    if (!character) return;

    // Power level constraint
    const currentPowerLevel = graphService.getCharacterPowerLevel(characterId) || character.currentCultivation;
    if (currentPowerLevel && currentPowerLevel !== 'Unknown') {
      const normalizedLevel = powerSystem.normalizePowerLevel(currentPowerLevel);
      const nextStage = powerSystem.getNextStage(normalizedLevel);

      constraints.push({
        type: 'power_level',
        entityId: character.id,
        entityName: character.name,
        constraint: `Character "${character.name}" is currently at ${normalizedLevel}. ` +
          `Do NOT reference ${nextStage || 'a higher stage'} unless a breakthrough event occurs and is explicitly described. ` +
          `If power progression happens, it must be gradual and justified.`,
        severity: 'critical',
      });
    }

    // Relationship constraints
    const relationships = graphService.getCharacterRelationships(characterId);
    relationships.forEach(rel => {
      const targetNodeId = rel.targetId.replace('character_', '');
      const targetChar = state.characterCodex.find(c => c.id === targetNodeId);
      if (!targetChar) return;

      constraints.push({
        type: 'relationship',
        entityId: character.id,
        entityName: character.name,
        constraint: `Character "${character.name}" and "${targetChar.name}" have a "${rel.properties.type}" relationship. ` +
          `Maintain this relationship dynamic unless explicitly changed.`,
        severity: 'warning',
      });
    });

    // Character state constraints
    if (character.status === 'Deceased') {
      constraints.push({
        type: 'character_state',
        entityId: character.id,
        entityName: character.name,
        constraint: `Character "${character.name}" is marked as Deceased. ` +
          `Do NOT have them appear or speak unless this is a flashback or resurrection scene.`,
        severity: 'critical',
      });
    }

    // Location constraint (if we had location tracking)
    // This would be added when location tracking is implemented
  });

  // World rule constraints
  const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
  if (currentRealm) {
    const realmRules = state.worldBible.filter(e => 
      e.realmId === state.currentRealmId && 
      (e.category === 'PowerLevels' || e.category === 'Systems' || e.category === 'Laws')
    );

    realmRules.slice(0, 5).forEach(rule => {
      constraints.push({
        type: 'world_rule',
        constraint: `World Rule [${rule.category}]: ${rule.title} - ${rule.content.substring(0, 200)}. ` +
          `Ensure all events and character actions respect this rule.`,
        severity: 'warning',
      });
    });
  }

  // Format constraints for prompt
  const formattedText = formatConstraintsForPrompt(constraints);

  return {
    constraints,
    formattedText,
  };
}

/**
 * Format constraints for inclusion in prompt
 */
function formatConstraintsForPrompt(constraints: ConsistencyConstraint[]): string {
  const sections: string[] = [];

  sections.push('[CONSISTENCY CONSTRAINTS - CRITICAL]');
  sections.push('These constraints MUST be followed to maintain story consistency:');
  sections.push('');

  // Critical constraints first
  const criticalConstraints = constraints.filter(c => c.severity === 'critical');
  criticalConstraints.forEach(constraint => {
    sections.push(`⚠ CRITICAL: ${constraint.constraint}`);
    sections.push('');
  });

  if (criticalConstraints.length === 0) {
    sections.push('No critical constraints.');
    sections.push('');
  }

  sections.push('[CONSISTENCY CONSTRAINTS - WARNINGS]');
  sections.push('These should be considered to maintain consistency:');
  sections.push('');

  // Warning constraints
  const warningConstraints = constraints.filter(c => c.severity === 'warning');
  warningConstraints.forEach(constraint => {
    sections.push(`⚠ WARNING: ${constraint.constraint}`);
    sections.push('');
  });

  if (warningConstraints.length === 0) {
    sections.push('No warning constraints.');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Generate power level progression constraint
 */
export function generatePowerLevelConstraint(
  character: Character,
  currentLevel: string,
  powerSystem: ReturnType<typeof getPowerLevelSystem>
): string {
  const normalizedLevel = powerSystem.normalizePowerLevel(currentLevel);
  const nextStage = powerSystem.getNextStage(normalizedLevel);

  let constraint = `Character "${character.name}" is currently at ${normalizedLevel}. `;

  if (nextStage) {
    constraint += `The next stage would be ${nextStage}, but progression must be gradual and justified. `;
  }

  constraint += `Do NOT have them suddenly jump to a higher stage without: `;
  constraint += `1) A breakthrough event explicitly described, `;
  constraint += `2) Sufficient narrative buildup, `;
  constraint += `3) Realistic progression timeline. `;
  constraint += `If power increases, show the progression process, not just the result.`;

  return constraint;
}

/**
 * Generate relationship constraint
 */
export function generateRelationshipConstraint(
  character1: Character,
  character2: Character,
  relationshipType: string,
  history?: string
): string {
  let constraint = `Characters "${character1.name}" and "${character2.name}" have a "${relationshipType}" relationship. `;

  if (history) {
    constraint += `History: ${history.substring(0, 150)}. `;
  }

  constraint += `Maintain this relationship dynamic. `;
  constraint += `Their interactions should reflect this relationship type unless explicitly changed.`;

  return constraint;
}
