/**
 * Director Configuration Helper
 * 
 * Provides utility functions for managing Director Agent configuration
 * at the novel level.
 */

import { NovelState } from '../../types';
import { DirectorConfig, DEFAULT_DIRECTOR_CONFIG, XianxiaPacingRules, DEFAULT_XIANXIA_PACING_RULES } from '../../types/director';
import { WorldSimulationConfig, DEFAULT_WORLD_SIMULATION_CONFIG } from '../../types/livingWorld';
import { TribulationGateConfig, DEFAULT_TRIBULATION_GATE_CONFIG } from '../../types/tribulationGates';
import { logger } from '../loggingService';

/**
 * Get the Director configuration for a novel
 * Falls back to defaults if not set
 */
export function getDirectorConfig(state: NovelState): DirectorConfig {
  const novelConfig = state.directorConfig;
  
  if (!novelConfig) {
    return DEFAULT_DIRECTOR_CONFIG;
  }
  
  // Merge with defaults to ensure all fields are present
  return {
    ...DEFAULT_DIRECTOR_CONFIG,
    enabled: novelConfig.enabled ?? DEFAULT_DIRECTOR_CONFIG.enabled,
    minBeatsPerChapter: novelConfig.minBeatsPerChapter ?? DEFAULT_DIRECTOR_CONFIG.minBeatsPerChapter,
    maxBeatsPerChapter: novelConfig.maxBeatsPerChapter ?? DEFAULT_DIRECTOR_CONFIG.maxBeatsPerChapter,
    defaultTargetWordCount: novelConfig.defaultTargetWordCount ?? DEFAULT_DIRECTOR_CONFIG.defaultTargetWordCount,
    enableClimaxProtection: novelConfig.enableClimaxProtection ?? DEFAULT_DIRECTOR_CONFIG.enableClimaxProtection,
    useReasonerMode: novelConfig.useReasonerMode ?? DEFAULT_DIRECTOR_CONFIG.useReasonerMode,
  };
}

/**
 * Get the Living World configuration for a novel
 * Falls back to defaults if not set
 */
export function getLivingWorldConfig(state: NovelState): WorldSimulationConfig {
  const novelConfig = state.livingWorldConfig;
  
  if (!novelConfig) {
    return DEFAULT_WORLD_SIMULATION_CONFIG;
  }
  
  // Merge with defaults to ensure all fields are present
  return {
    ...DEFAULT_WORLD_SIMULATION_CONFIG,
    enabled: novelConfig.enabled ?? DEFAULT_WORLD_SIMULATION_CONFIG.enabled,
    chapterInterval: novelConfig.chapterInterval ?? DEFAULT_WORLD_SIMULATION_CONFIG.chapterInterval,
    seclusionTrigger: novelConfig.seclusionTrigger ?? DEFAULT_WORLD_SIMULATION_CONFIG.seclusionTrigger,
    timeSkipThreshold: novelConfig.timeSkipThreshold ?? DEFAULT_WORLD_SIMULATION_CONFIG.timeSkipThreshold,
    volatilityLevel: novelConfig.volatilityLevel ?? DEFAULT_WORLD_SIMULATION_CONFIG.volatilityLevel,
    maxEventsPerSimulation: novelConfig.maxEventsPerSimulation ?? DEFAULT_WORLD_SIMULATION_CONFIG.maxEventsPerSimulation,
    protectedEntityIds: novelConfig.protectedEntityIds ?? DEFAULT_WORLD_SIMULATION_CONFIG.protectedEntityIds,
  };
}

/**
 * Check if Director is enabled for a novel
 */
export function isDirectorEnabled(state: NovelState): boolean {
  return state.directorConfig?.enabled ?? DEFAULT_DIRECTOR_CONFIG.enabled;
}

/**
 * Check if Living World is enabled for a novel
 */
export function isLivingWorldEnabled(state: NovelState): boolean {
  return state.livingWorldConfig?.enabled ?? DEFAULT_WORLD_SIMULATION_CONFIG.enabled;
}

/**
 * Get the Tribulation Gate configuration for a novel
 * Falls back to defaults if not set
 */
export function getTribulationGateConfig(state: NovelState): TribulationGateConfig {
  const novelConfig = state.tribulationGateConfig;
  
  if (!novelConfig) {
    return DEFAULT_TRIBULATION_GATE_CONFIG;
  }
  
  // Merge with defaults to ensure all fields are present
  return {
    ...DEFAULT_TRIBULATION_GATE_CONFIG,
    enabled: novelConfig.enabled ?? DEFAULT_TRIBULATION_GATE_CONFIG.enabled,
    minimumChapterGap: novelConfig.minimumChapterGap ?? DEFAULT_TRIBULATION_GATE_CONFIG.minimumChapterGap,
    autoSelectAfterMs: novelConfig.autoSelectAfterMs ?? DEFAULT_TRIBULATION_GATE_CONFIG.autoSelectAfterMs,
    triggerSensitivity: novelConfig.triggerSensitivity ?? DEFAULT_TRIBULATION_GATE_CONFIG.triggerSensitivity,
    excludedTriggers: novelConfig.excludedTriggers ?? DEFAULT_TRIBULATION_GATE_CONFIG.excludedTriggers,
    maxPendingGates: novelConfig.maxPendingGates ?? DEFAULT_TRIBULATION_GATE_CONFIG.maxPendingGates,
    showConsequences: novelConfig.showConsequences ?? DEFAULT_TRIBULATION_GATE_CONFIG.showConsequences,
    showRiskLevels: novelConfig.showRiskLevels ?? DEFAULT_TRIBULATION_GATE_CONFIG.showRiskLevels,
  };
}

/**
 * Check if Tribulation Gates are enabled for a novel
 */
export function isTribulationGatesEnabled(state: NovelState): boolean {
  return state.tribulationGateConfig?.enabled ?? DEFAULT_TRIBULATION_GATE_CONFIG.enabled;
}

/**
 * Validate Tribulation Gate configuration
 */
export function validateTribulationGateConfig(config: Partial<TribulationGateConfig>): {
  valid: boolean;
  errors: string[];
  normalized: TribulationGateConfig;
} {
  const errors: string[] = [];
  
  if (config.minimumChapterGap !== undefined) {
    if (config.minimumChapterGap < 5) {
      errors.push('Minimum chapter gap must be at least 5');
    }
    if (config.minimumChapterGap > 100) {
      errors.push('Minimum chapter gap cannot exceed 100');
    }
  }
  
  if (config.autoSelectAfterMs !== undefined && config.autoSelectAfterMs !== null) {
    if (config.autoSelectAfterMs < 10000) {
      errors.push('Auto-select timeout must be at least 10 seconds (10000ms)');
    }
    if (config.autoSelectAfterMs > 600000) {
      errors.push('Auto-select timeout cannot exceed 10 minutes (600000ms)');
    }
  }
  
  if (config.maxPendingGates !== undefined) {
    if (config.maxPendingGates < 1) {
      errors.push('Maximum pending gates must be at least 1');
    }
    if (config.maxPendingGates > 10) {
      errors.push('Maximum pending gates cannot exceed 10');
    }
  }
  
  // Normalize the config
  const normalized: TribulationGateConfig = {
    ...DEFAULT_TRIBULATION_GATE_CONFIG,
    ...config,
    minimumChapterGap: Math.max(5, Math.min(100, config.minimumChapterGap ?? DEFAULT_TRIBULATION_GATE_CONFIG.minimumChapterGap)),
    maxPendingGates: Math.max(1, Math.min(10, config.maxPendingGates ?? DEFAULT_TRIBULATION_GATE_CONFIG.maxPendingGates)),
  };
  
  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

/**
 * Get Xianxia-specific pacing rules
 * Can be customized per novel in the future
 */
export function getXianxiaPacingRules(_state: NovelState): XianxiaPacingRules {
  // Future: could check state.genre or custom rules
  return DEFAULT_XIANXIA_PACING_RULES;
}

/**
 * Validate Director configuration
 */
export function validateDirectorConfig(config: Partial<DirectorConfig>): {
  valid: boolean;
  errors: string[];
  normalized: DirectorConfig;
} {
  const errors: string[] = [];
  
  // Validate ranges
  if (config.minBeatsPerChapter !== undefined) {
    if (config.minBeatsPerChapter < 1) {
      errors.push('Minimum beats per chapter must be at least 1');
    }
    if (config.minBeatsPerChapter > 15) {
      errors.push('Minimum beats per chapter cannot exceed 15');
    }
  }
  
  if (config.maxBeatsPerChapter !== undefined) {
    if (config.maxBeatsPerChapter < 1) {
      errors.push('Maximum beats per chapter must be at least 1');
    }
    if (config.maxBeatsPerChapter > 20) {
      errors.push('Maximum beats per chapter cannot exceed 20');
    }
  }
  
  if (config.minBeatsPerChapter !== undefined && 
      config.maxBeatsPerChapter !== undefined &&
      config.minBeatsPerChapter > config.maxBeatsPerChapter) {
    errors.push('Minimum beats cannot exceed maximum beats');
  }
  
  if (config.defaultTargetWordCount !== undefined) {
    if (config.defaultTargetWordCount < 500) {
      errors.push('Target word count must be at least 500');
    }
    if (config.defaultTargetWordCount > 10000) {
      errors.push('Target word count cannot exceed 10000');
    }
  }
  
  // Normalize the config
  const normalized: DirectorConfig = {
    ...DEFAULT_DIRECTOR_CONFIG,
    ...config,
    minBeatsPerChapter: Math.max(1, Math.min(15, config.minBeatsPerChapter ?? DEFAULT_DIRECTOR_CONFIG.minBeatsPerChapter)),
    maxBeatsPerChapter: Math.max(1, Math.min(20, config.maxBeatsPerChapter ?? DEFAULT_DIRECTOR_CONFIG.maxBeatsPerChapter)),
    defaultTargetWordCount: Math.max(500, Math.min(10000, config.defaultTargetWordCount ?? DEFAULT_DIRECTOR_CONFIG.defaultTargetWordCount)),
  };
  
  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

/**
 * Validate Living World configuration
 */
export function validateLivingWorldConfig(config: Partial<WorldSimulationConfig>): {
  valid: boolean;
  errors: string[];
  normalized: WorldSimulationConfig;
} {
  const errors: string[] = [];
  
  if (config.chapterInterval !== undefined) {
    if (config.chapterInterval < 10) {
      errors.push('Chapter interval must be at least 10');
    }
    if (config.chapterInterval > 200) {
      errors.push('Chapter interval cannot exceed 200');
    }
  }
  
  if (config.maxEventsPerSimulation !== undefined) {
    if (config.maxEventsPerSimulation < 1) {
      errors.push('Maximum events per simulation must be at least 1');
    }
    if (config.maxEventsPerSimulation > 10) {
      errors.push('Maximum events per simulation cannot exceed 10');
    }
  }
  
  if (config.timeSkipThreshold !== undefined) {
    if (config.timeSkipThreshold < 0.5) {
      errors.push('Time skip threshold must be at least 0.5 years');
    }
  }
  
  // Normalize the config
  const normalized: WorldSimulationConfig = {
    ...DEFAULT_WORLD_SIMULATION_CONFIG,
    ...config,
    chapterInterval: Math.max(10, Math.min(200, config.chapterInterval ?? DEFAULT_WORLD_SIMULATION_CONFIG.chapterInterval)),
    maxEventsPerSimulation: Math.max(1, Math.min(10, config.maxEventsPerSimulation ?? DEFAULT_WORLD_SIMULATION_CONFIG.maxEventsPerSimulation)),
  };
  
  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

/**
 * Get recommended Director settings based on genre
 */
export function getRecommendedSettings(genre: string): {
  director: Partial<DirectorConfig>;
  livingWorld: Partial<WorldSimulationConfig>;
  tribulationGates: Partial<TribulationGateConfig>;
  notes: string[];
} {
  const notes: string[] = [];
  
  // Default recommendations
  let director: Partial<DirectorConfig> = {};
  let livingWorld: Partial<WorldSimulationConfig> = {};
  let tribulationGates: Partial<TribulationGateConfig> = {};
  
  const lowerGenre = genre.toLowerCase();
  
  if (lowerGenre.includes('xianxia') || lowerGenre.includes('cultivation') || lowerGenre.includes('wuxia')) {
    director = {
      minBeatsPerChapter: 5,
      maxBeatsPerChapter: 8,
      defaultTargetWordCount: 3000,
      enableClimaxProtection: true,
    };
    livingWorld = {
      chapterInterval: 50,
      volatilityLevel: 'moderate',
      maxEventsPerSimulation: 3,
    };
    tribulationGates = {
      enabled: true,
      minimumChapterGap: 15,
      triggerSensitivity: 'medium',
      showConsequences: true,
      showRiskLevels: true,
    };
    notes.push('Cultivation novels benefit from longer chapters with detailed progression');
    notes.push('Consider enabling seclusion triggers for realistic world simulation');
    notes.push('Tribulation Gates work perfectly with breakthrough and confrontation moments');
  } else if (lowerGenre.includes('romance')) {
    director = {
      minBeatsPerChapter: 4,
      maxBeatsPerChapter: 6,
      defaultTargetWordCount: 2500,
      enableClimaxProtection: true,
    };
    livingWorld = {
      volatilityLevel: 'stable',
      maxEventsPerSimulation: 2,
    };
    tribulationGates = {
      enabled: true,
      minimumChapterGap: 20,
      triggerSensitivity: 'low',
      excludedTriggers: ['realm_breakthrough', 'forbidden_technique', 'dao_comprehension'],
      showConsequences: true,
      showRiskLevels: false,
    };
    notes.push('Romance novels work well with moderate chapter lengths');
    notes.push('Stable world volatility keeps focus on character relationships');
    notes.push('Gates focus on relationship and identity decisions');
  } else if (lowerGenre.includes('action') || lowerGenre.includes('thriller')) {
    director = {
      minBeatsPerChapter: 6,
      maxBeatsPerChapter: 10,
      defaultTargetWordCount: 3500,
      enableClimaxProtection: true,
    };
    livingWorld = {
      volatilityLevel: 'chaotic',
      maxEventsPerSimulation: 5,
    };
    tribulationGates = {
      enabled: true,
      minimumChapterGap: 10,
      triggerSensitivity: 'high',
      showConsequences: true,
      showRiskLevels: true,
    };
    notes.push('Action genres benefit from more beats per chapter');
    notes.push('Chaotic volatility creates more plot hooks');
    notes.push('Frequent gates keep readers engaged with life-or-death decisions');
  } else if (lowerGenre.includes('slice of life') || lowerGenre.includes('comedy')) {
    director = {
      minBeatsPerChapter: 3,
      maxBeatsPerChapter: 5,
      defaultTargetWordCount: 2000,
      enableClimaxProtection: false,
    };
    livingWorld = {
      volatilityLevel: 'stable',
      chapterInterval: 100,
      maxEventsPerSimulation: 1,
    };
    tribulationGates = {
      enabled: false, // Typically not needed for slice of life
      minimumChapterGap: 30,
      triggerSensitivity: 'low',
    };
    notes.push('Slice of life works better with fewer, more focused beats');
    notes.push('Lower world event frequency for character-focused stories');
    notes.push('Tribulation Gates optional for low-stakes narratives');
  }
  
  return { director, livingWorld, tribulationGates, notes };
}

/**
 * Log current configuration for debugging
 */
export function logConfiguration(state: NovelState): void {
  const directorConfig = getDirectorConfig(state);
  const livingWorldConfig = getLivingWorldConfig(state);
  const tribulationGateConfig = getTribulationGateConfig(state);
  
  logger.debug('Current Director/Living World/Tribulation Gate configuration', 'config', {
    novelId: state.id,
    director: {
      enabled: directorConfig.enabled,
      beatsRange: `${directorConfig.minBeatsPerChapter}-${directorConfig.maxBeatsPerChapter}`,
      targetWordCount: directorConfig.defaultTargetWordCount,
      climaxProtection: directorConfig.enableClimaxProtection,
    },
    livingWorld: {
      enabled: livingWorldConfig.enabled,
      chapterInterval: livingWorldConfig.chapterInterval,
      volatility: livingWorldConfig.volatilityLevel,
      maxEvents: livingWorldConfig.maxEventsPerSimulation,
    },
    tribulationGates: {
      enabled: tribulationGateConfig.enabled,
      minimumChapterGap: tribulationGateConfig.minimumChapterGap,
      sensitivity: tribulationGateConfig.triggerSensitivity,
      excludedCount: tribulationGateConfig.excludedTriggers?.length || 0,
    },
  });
}
