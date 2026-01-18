import { ImprovementCategory } from '../../types/improvement';
import { NovelState } from '../../types';
import { ImprovementStrategy, ImprovementRequest } from '../../types/improvement';

/**
 * Module Router
 * Routes improvement requests to the correct optimizer module
 */

/**
 * Routes a category to its corresponding optimizer module name
 */
export function routeCategoryToModule(category: ImprovementCategory): string {
  const categoryMap: Record<ImprovementCategory, string> = {
    'structure': 'StructureOptimizer',
    'engagement': 'EngagementOptimizer',
    'tension': 'TensionOptimizer',
    'theme': 'ThemeOptimizer',
    'character': 'PsychologyOptimizer', // Alias: character -> psychology
    'psychology': 'PsychologyOptimizer',
    'literary_devices': 'DeviceOptimizer',
    'devices': 'DeviceOptimizer', // Alias
    'excellence': 'ExcellenceOptimizer',
    'prose': 'ProseOptimizer', // Will use excellence optimizer
    'originality': 'OriginalityOptimizer', // Will use excellence optimizer
    'voice': 'VoiceOptimizer', // Will use excellence optimizer
    'market_readiness': 'MarketReadinessOptimizer', // Will use excellence optimizer
  };

  return categoryMap[category] || 'ExcellenceOptimizer';
}

/**
 * Checks if a category is an alias that should be routed to another optimizer
 */
export function getCategoryAlias(category: ImprovementCategory): ImprovementCategory | null {
  const aliasMap: Record<string, ImprovementCategory> = {
    'character': 'psychology',
    'devices': 'literary_devices',
  };

  return aliasMap[category] || null;
}

/**
 * Normalizes a category (resolves aliases)
 */
export function normalizeCategory(category: ImprovementCategory): ImprovementCategory {
  const alias = getCategoryAlias(category);
  return alias || category;
}
