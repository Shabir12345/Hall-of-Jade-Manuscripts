/**
 * Karma Calculator Service
 * 
 * Calculates karma weights for actions, applying modifiers based on context.
 * The final karma weight determines how significant an action is in the
 * social network and how it affects Face and relationships.
 */

import type {
  KarmaActionType,
  KarmaPolarity,
  KarmaSeverity,
  KarmaWeightModifier,
  KARMA_WEIGHT_BY_ACTION,
} from '../../types/faceGraph';

/**
 * Base karma weights by action type
 */
const KARMA_WEIGHTS: Record<KarmaActionType, { base: number; polarity: KarmaPolarity }> = {
  kill: { base: 80, polarity: 'negative' },
  spare: { base: 30, polarity: 'positive' },
  humiliate: { base: 50, polarity: 'negative' },
  honor: { base: 40, polarity: 'positive' },
  betray: { base: 70, polarity: 'negative' },
  save: { base: 60, polarity: 'positive' },
  steal: { base: 40, polarity: 'negative' },
  gift: { base: 35, polarity: 'positive' },
  defeat: { base: 30, polarity: 'negative' },
  submit: { base: 20, polarity: 'negative' },
  offend: { base: 15, polarity: 'negative' },
  protect: { base: 45, polarity: 'positive' },
  avenge: { base: 50, polarity: 'neutral' },
  abandon: { base: 55, polarity: 'negative' },
  enslave: { base: 75, polarity: 'negative' },
  liberate: { base: 55, polarity: 'positive' },
  curse: { base: 60, polarity: 'negative' },
  bless: { base: 50, polarity: 'positive' },
  destroy_sect: { base: 95, polarity: 'negative' },
  cripple_cultivation: { base: 85, polarity: 'negative' },
  restore_cultivation: { base: 70, polarity: 'positive' },
  exterminate_clan: { base: 100, polarity: 'negative' },
  elevate_status: { base: 45, polarity: 'positive' },
};

/**
 * Severity multipliers
 */
const SEVERITY_MULTIPLIERS: Record<KarmaSeverity, number> = {
  minor: 0.5,
  moderate: 1.0,
  major: 1.5,
  severe: 2.0,
  extreme: 2.5,
};

/**
 * Calculate the karma weight for an action
 */
export function calculateKarmaWeight(
  actionType: KarmaActionType,
  severity: KarmaSeverity,
  context?: {
    powerDifference?: number; // -100 (actor much weaker) to +100 (actor much stronger)
    wasProvoked?: boolean;
    wasPublic?: boolean;
    targetInnocent?: boolean;
    wasJustified?: boolean;
    involvesClan?: boolean;
    involvesSect?: boolean;
    treasureValue?: 'minor' | 'moderate' | 'major' | 'legendary';
    affectsCultivation?: boolean;
    isBetrayal?: boolean;
  }
): {
  baseWeight: number;
  finalWeight: number;
  polarity: KarmaPolarity;
  modifiers: KarmaWeightModifier[];
} {
  const baseInfo = KARMA_WEIGHTS[actionType];
  const baseWeight = baseInfo.base;
  const polarity = baseInfo.polarity;
  const modifiers: KarmaWeightModifier[] = [];

  let totalMultiplier = SEVERITY_MULTIPLIERS[severity];

  // Apply context modifiers
  if (context) {
    // Power difference modifier
    if (context.powerDifference !== undefined) {
      if (context.powerDifference > 50) {
        // Actor is much stronger - bullying
        totalMultiplier *= 1.3;
        modifiers.push({
          type: 'power_difference',
          modifier: 1.3,
          reason: 'Overwhelming power against weaker target',
        });
      } else if (context.powerDifference < -50) {
        // Actor is much weaker - brave/desperate
        totalMultiplier *= 0.8;
        modifiers.push({
          type: 'power_difference',
          modifier: 0.8,
          reason: 'Acted despite being significantly weaker',
        });
      }
    }

    // Provocation modifier
    if (context.wasProvoked) {
      totalMultiplier *= 0.7;
      modifiers.push({
        type: 'provocation',
        modifier: 0.7,
        reason: 'Action was provoked',
      });
    }

    // Public nature modifier
    if (context.wasPublic) {
      totalMultiplier *= 1.4;
      modifiers.push({
        type: 'public_nature',
        modifier: 1.4,
        reason: 'Action was public, affecting Face significantly',
      });
    }

    // Target innocence modifier
    if (context.targetInnocent) {
      totalMultiplier *= 1.5;
      modifiers.push({
        type: 'innocence',
        modifier: 1.5,
        reason: 'Target was innocent',
      });
    }

    // Justification modifier
    if (context.wasJustified) {
      totalMultiplier *= 0.6;
      modifiers.push({
        type: 'justified',
        modifier: 0.6,
        reason: 'Action was justified',
      });
    }

    // Clan involvement modifier
    if (context.involvesClan) {
      totalMultiplier *= 1.8;
      modifiers.push({
        type: 'clan_involvement',
        modifier: 1.8,
        reason: 'Action involves entire clan',
      });
    }

    // Sect involvement modifier
    if (context.involvesSect) {
      totalMultiplier *= 1.6;
      modifiers.push({
        type: 'sect_involvement',
        modifier: 1.6,
        reason: 'Action involves sect',
      });
    }

    // Treasure value modifier
    if (context.treasureValue) {
      const treasureModifiers = {
        minor: 1.0,
        moderate: 1.2,
        major: 1.5,
        legendary: 2.0,
      };
      const mod = treasureModifiers[context.treasureValue];
      totalMultiplier *= mod;
      modifiers.push({
        type: 'treasure_value',
        modifier: mod,
        reason: `Involves ${context.treasureValue} treasure`,
      });
    }

    // Cultivation impact modifier
    if (context.affectsCultivation) {
      totalMultiplier *= 1.7;
      modifiers.push({
        type: 'cultivation_impact',
        modifier: 1.7,
        reason: 'Affects cultivation path',
      });
    }

    // Betrayal depth modifier
    if (context.isBetrayal) {
      totalMultiplier *= 2.0;
      modifiers.push({
        type: 'betrayal_depth',
        modifier: 2.0,
        reason: 'Involves betrayal of trust',
      });
    }
  }

  // Calculate final weight (cap at 100)
  const finalWeight = Math.min(100, Math.round(baseWeight * totalMultiplier));

  return {
    baseWeight,
    finalWeight,
    polarity,
    modifiers,
  };
}

/**
 * Calculate Face change from a karma event
 */
export function calculateFaceChange(
  actionType: KarmaActionType,
  karmaWeight: number,
  polarity: KarmaPolarity,
  context?: {
    wasPublic?: boolean;
    actorReputation?: number; // 0-100
    targetReputation?: number; // 0-100
  }
): {
  actorFaceChange: number;
  targetFaceChange: number;
  publicPerception: string;
} {
  // Base face changes
  let actorChange = 0;
  let targetChange = 0;

  // Actions that affect actor's face
  const actorGainActions: KarmaActionType[] = ['defeat', 'honor', 'save', 'protect', 'liberate', 'avenge'];
  const actorLossActions: KarmaActionType[] = ['betray', 'abandon', 'humiliate'];

  if (polarity === 'positive') {
    // Positive actions generally give actor face
    actorChange = Math.floor(karmaWeight * 0.3);
    targetChange = Math.floor(karmaWeight * 0.5);
  } else if (polarity === 'negative') {
    // Negative actions have complex face implications
    if (actorGainActions.includes(actionType)) {
      actorChange = Math.floor(karmaWeight * 0.4); // Defeating someone gives face
    } else if (actorLossActions.includes(actionType)) {
      actorChange = -Math.floor(karmaWeight * 0.2); // Betrayal loses face
    }
    targetChange = -Math.floor(karmaWeight * 0.6); // Being wronged loses face
  }

  // Public modifier
  if (context?.wasPublic) {
    actorChange = Math.round(actorChange * 1.5);
    targetChange = Math.round(targetChange * 1.5);
  }

  // Reputation modifier (higher rep = more face at stake)
  if (context?.targetReputation !== undefined && context.targetReputation > 500) {
    targetChange = Math.round(targetChange * 1.3);
  }

  // Generate public perception
  let publicPerception: string;
  if (polarity === 'positive') {
    publicPerception = `${actionType.replace('_', ' ')} is viewed favorably`;
  } else if (actorChange > 0) {
    publicPerception = `${actionType.replace('_', ' ')} is seen as a show of strength`;
  } else if (actorChange < 0) {
    publicPerception = `${actionType.replace('_', ' ')} is viewed as dishonorable`;
  } else {
    publicPerception = `${actionType.replace('_', ' ')} may have mixed reception`;
  }

  return {
    actorFaceChange: actorChange,
    targetFaceChange: targetChange,
    publicPerception,
  };
}

/**
 * Determine if a karma event should trigger a blood feud
 */
export function shouldTriggerBloodFeud(
  actionType: KarmaActionType,
  severity: KarmaSeverity,
  finalKarmaWeight: number,
  involvesClan: boolean = false,
  targetIsImportant: boolean = false
): {
  shouldTrigger: boolean;
  suggestedIntensity: number;
  reason: string;
} {
  // Blood feud triggers
  const feudTriggerActions: KarmaActionType[] = [
    'kill', 'exterminate_clan', 'destroy_sect', 'cripple_cultivation', 'betray', 'humiliate'
  ];

  if (!feudTriggerActions.includes(actionType)) {
    return {
      shouldTrigger: false,
      suggestedIntensity: 0,
      reason: 'Action type does not typically trigger blood feud',
    };
  }

  // Calculate if it should trigger
  const severityScores: Record<KarmaSeverity, number> = {
    minor: 0,
    moderate: 20,
    major: 40,
    severe: 60,
    extreme: 80,
  };

  let feudScore = severityScores[severity] + Math.floor(finalKarmaWeight * 0.5);
  
  if (involvesClan) feudScore += 30;
  if (targetIsImportant) feudScore += 20;

  // Instant triggers
  if (actionType === 'exterminate_clan') {
    return {
      shouldTrigger: true,
      suggestedIntensity: 100,
      reason: 'Clan extermination automatically creates blood feud',
    };
  }

  if (actionType === 'kill' && (involvesClan || targetIsImportant)) {
    return {
      shouldTrigger: feudScore >= 50,
      suggestedIntensity: Math.min(100, feudScore + 20),
      reason: 'Killing clan member or important figure',
    };
  }

  return {
    shouldTrigger: feudScore >= 70,
    suggestedIntensity: Math.min(100, feudScore),
    reason: feudScore >= 70 
      ? `High karma weight (${finalKarmaWeight}) and severity (${severity}) warrant blood feud`
      : 'Karma weight not significant enough for blood feud',
  };
}

/**
 * Determine if a karma event creates a debt
 */
export function shouldCreateDebt(
  actionType: KarmaActionType,
  polarity: KarmaPolarity,
  finalKarmaWeight: number
): {
  shouldCreate: boolean;
  debtType: 'life_saving' | 'treasure' | 'teaching' | 'protection' | 'political' | 'other';
  suggestedWeight: number;
  reason: string;
} {
  // Only positive actions create debts
  if (polarity !== 'positive') {
    return {
      shouldCreate: false,
      debtType: 'other',
      suggestedWeight: 0,
      reason: 'Only positive actions create debts',
    };
  }

  // Map action types to debt types
  const debtTypeMap: Partial<Record<KarmaActionType, 'life_saving' | 'treasure' | 'teaching' | 'protection' | 'political' | 'other'>> = {
    save: 'life_saving',
    gift: 'treasure',
    bless: 'teaching',
    protect: 'protection',
    elevate_status: 'political',
    restore_cultivation: 'teaching',
    liberate: 'life_saving',
  };

  const debtType = debtTypeMap[actionType];
  
  if (!debtType) {
    return {
      shouldCreate: false,
      debtType: 'other',
      suggestedWeight: 0,
      reason: 'Action type does not typically create debt',
    };
  }

  return {
    shouldCreate: finalKarmaWeight >= 30,
    debtType,
    suggestedWeight: finalKarmaWeight,
    reason: finalKarmaWeight >= 30
      ? `${actionType.replace('_', ' ')} with weight ${finalKarmaWeight} creates a ${debtType} debt`
      : 'Karma weight too low for significant debt',
  };
}

/**
 * Calculate sentiment change from karma
 */
export function calculateSentimentChange(
  actionType: KarmaActionType,
  polarity: KarmaPolarity,
  finalKarmaWeight: number,
  isRetaliation: boolean = false
): number {
  // Base sentiment change (from target's perspective toward actor)
  let change = 0;

  if (polarity === 'positive') {
    // Positive actions improve sentiment
    change = Math.floor(finalKarmaWeight * 0.7);
  } else if (polarity === 'negative') {
    // Negative actions worsen sentiment
    change = -Math.floor(finalKarmaWeight * 0.8);
  }

  // Retaliation modifier (expected, so less impact)
  if (isRetaliation) {
    change = Math.floor(change * 0.6);
  }

  // Cap at -100 to +100
  return Math.max(-100, Math.min(100, change));
}
