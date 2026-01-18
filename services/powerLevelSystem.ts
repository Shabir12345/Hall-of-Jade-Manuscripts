/**
 * Power Level System
 * 
 * Defines power level hierarchies for Xianxia/Xuanhuan genres and validates progression.
 * Prevents regressions and unrealistic advancement speeds.
 */

export type PowerLevelCategory = 'cultivation' | 'combat' | 'spiritual' | 'body_refinement';

export interface PowerLevelStage {
  name: string;
  order: number; // Lower number = lower stage
  category: PowerLevelCategory;
  description?: string;
  typicalBreakthroughTime?: string; // e.g., "3-5 chapters"
}

export interface PowerLevelHierarchy {
  category: PowerLevelCategory;
  stages: PowerLevelStage[];
}

export interface PowerLevelProgressionRule {
  maxChaptersPerStage: number; // Maximum chapters to advance one stage
  minChaptersForBreakthrough: number; // Minimum chapters before breakthrough
  allowRegression: boolean; // Whether power loss is allowed
  requireBreakthroughEvent: boolean; // Whether breakthrough must be explicitly described
}

export class PowerLevelSystem {
  private hierarchies: Map<PowerLevelCategory, PowerLevelHierarchy> = new Map();
  private defaultRules: PowerLevelProgressionRule = {
    maxChaptersPerStage: 10,
    minChaptersForBreakthrough: 2,
    allowRegression: false,
    requireBreakthroughEvent: true,
  };

  constructor() {
    this.initializeDefaultHierarchies();
  }

  /**
   * Initialize default Xianxia/Xuanhuan power level hierarchies
   */
  private initializeDefaultHierarchies(): void {
    // Cultivation Realm Hierarchy (most common)
    const cultivationHierarchy: PowerLevelHierarchy = {
      category: 'cultivation',
      stages: [
        { name: 'Qi Refining', order: 1, category: 'cultivation', description: 'Initial stage of cultivation', typicalBreakthroughTime: '2-3 chapters' },
        { name: 'Foundation Building', order: 2, category: 'cultivation', description: 'Building foundation for future growth', typicalBreakthroughTime: '3-5 chapters' },
        { name: 'Core Formation', order: 3, category: 'cultivation', description: 'Forming core within dantian', typicalBreakthroughTime: '5-8 chapters' },
        { name: 'Nascent Soul', order: 4, category: 'cultivation', description: 'Soul begins to form', typicalBreakthroughTime: '8-12 chapters' },
        { name: 'Soul Transformation', order: 5, category: 'cultivation', description: 'Soul fully transforms', typicalBreakthroughTime: '10-15 chapters' },
        { name: 'Void Refinement', order: 6, category: 'cultivation', description: 'Refining void energy', typicalBreakthroughTime: '15-20 chapters' },
        { name: 'Immortal Ascension', order: 7, category: 'cultivation', description: 'Ascending to immortality', typicalBreakthroughTime: '20+ chapters' },
      ],
    };

    // Combat Power Hierarchy
    const combatHierarchy: PowerLevelHierarchy = {
      category: 'combat',
      stages: [
        { name: 'Mortal', order: 1, category: 'combat', description: 'Normal human combat ability' },
        { name: 'Warrior', order: 2, category: 'combat', description: 'Trained warrior' },
        { name: 'Expert', order: 3, category: 'combat', description: 'Combat expert' },
        { name: 'Master', order: 4, category: 'combat', description: 'Master level' },
        { name: 'Grandmaster', order: 5, category: 'combat', description: 'Grandmaster level' },
        { name: 'Sage', order: 6, category: 'combat', description: 'Sage level combat' },
      ],
    };

    this.hierarchies.set('cultivation', cultivationHierarchy);
    this.hierarchies.set('combat', combatHierarchy);
  }

  /**
   * Get hierarchy for a category
   */
  getHierarchy(category: PowerLevelCategory): PowerLevelHierarchy | null {
    return this.hierarchies.get(category) || null;
  }

  /**
   * Parse power level string and determine stage order
   * Handles various formats: "Qi Refining Stage 3", "Foundation Building", "Core Formation Peak"
   * Enhanced with better pattern matching
   */
  parsePowerLevel(levelString: string, category: PowerLevelCategory = 'cultivation'): {
    stageName: string;
    order: number;
    subStage?: string; // e.g., "Early", "Mid", "Late", "Peak"
  } | null {
    if (!levelString || levelString.trim() === '') return null;

    const hierarchy = this.getHierarchy(category);
    if (!hierarchy) return null;

    const normalized = levelString.trim();
    const normalizedLower = normalized.toLowerCase();
    
    // Try to match against known stages (enhanced matching)
    for (const stage of hierarchy.stages) {
      const stageNameLower = stage.name.toLowerCase();
      
      // Exact match
      if (normalizedLower === stageNameLower) {
        return {
          stageName: stage.name,
          order: stage.order,
        };
      }

      // Contains stage name (with word boundaries for better matching)
      const stagePattern = new RegExp(`\\b${stageNameLower.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (stagePattern.test(normalized)) {
        // Extract sub-stage if present
        const subStagePatterns = [
          /\b(initial|beginner)\b/i,
          /\b(early)\b/i,
          /\b(mid|middle)\b/i,
          /\b(late|advanced)\b/i,
          /\b(peak|perfected|perfection)\b/i,
        ];
        
        let subStage: string | undefined;
        for (const pattern of subStagePatterns) {
          const match = normalized.match(pattern);
          if (match) {
            subStage = match[1].toLowerCase();
            break;
          }
        }

        return {
          stageName: stage.name,
          order: stage.order,
          subStage,
        };
      }
    }

    // Enhanced: Try partial matching for common variations
    for (const stage of hierarchy.stages) {
      const stageWords = stage.name.toLowerCase().split(/\s+/);
      const normalizedWords = normalizedLower.split(/\s+/);
      
      // Check if all stage words appear in normalized string
      const allWordsMatch = stageWords.every(word => 
        normalizedWords.some(nw => nw.includes(word) || word.includes(nw))
      );
      
      if (allWordsMatch && stageWords.length > 0) {
        const subStageMatch = normalized.match(/\b(early|mid|middle|late|peak|initial|beginner|advanced|perfected)\b/i);
        return {
          stageName: stage.name,
          order: stage.order,
          subStage: subStageMatch ? subStageMatch[1] : undefined,
        };
      }
    }

    // If no match found, try to infer order from common patterns
    // This is a fallback for custom power levels
    return {
      stageName: normalized,
      order: 0, // Unknown order
    };
  }

  /**
   * Compare two power levels
   * Returns: -1 if level1 < level2, 0 if equal, 1 if level1 > level2
   */
  comparePowerLevels(
    level1: string,
    level2: string,
    category: PowerLevelCategory = 'cultivation'
  ): number {
    const parsed1 = this.parsePowerLevel(level1, category);
    const parsed2 = this.parsePowerLevel(level2, category);

    if (!parsed1 || !parsed2) return 0; // Can't compare

    if (parsed1.order < parsed2.order) return -1;
    if (parsed1.order > parsed2.order) return 1;

    // Same stage, compare sub-stages
    if (parsed1.subStage && parsed2.subStage) {
      const subStageOrder: Record<string, number> = {
        'initial': 1,
        'beginner': 1,
        'early': 2,
        'mid': 3,
        'middle': 3,
        'late': 4,
        'advanced': 4,
        'peak': 5,
        'perfected': 5,
      };

      const order1 = subStageOrder[parsed1.subStage.toLowerCase()] || 0;
      const order2 = subStageOrder[parsed2.subStage.toLowerCase()] || 0;

      if (order1 < order2) return -1;
      if (order1 > order2) return 1;
    }

    return 0;
  }

  /**
   * Validate power level progression
   */
  validateProgression(
    previousLevel: string,
    currentLevel: string,
    chaptersSinceLastChange: number,
    hasBreakthroughEvent: boolean,
    category: PowerLevelCategory = 'cultivation'
  ): {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    const comparison = this.comparePowerLevels(previousLevel, currentLevel, category);

    // Check for regression
    if (comparison > 0) {
      // Current is lower than previous
      if (!this.defaultRules.allowRegression) {
        issues.push(
          `Power level regression detected: ${previousLevel} → ${currentLevel}. ` +
          `Regression is not allowed unless explicitly justified.`
        );
      } else {
        warnings.push(
          `Power level regression: ${previousLevel} → ${currentLevel}. ` +
          `Ensure this is intentional and explained.`
        );
      }
    }

    // Check for sudden jumps
    if (comparison < 0) {
      const parsedPrev = this.parsePowerLevel(previousLevel, category);
      const parsedCurr = this.parsePowerLevel(currentLevel, category);

      if (parsedPrev && parsedCurr) {
        const stageJump = parsedCurr.order - parsedPrev.order;
        
        if (stageJump > 1) {
          // Jumped multiple stages
          if (chaptersSinceLastChange < this.defaultRules.minChaptersForBreakthrough * stageJump) {
            issues.push(
              `Unrealistic power progression: Jumped ${stageJump} stage(s) in ${chaptersSinceLastChange} chapter(s). ` +
              `Expected at least ${this.defaultRules.minChaptersForBreakthrough * stageJump} chapters for such progression.`
            );
          } else {
            warnings.push(
              `Rapid power progression: Jumped ${stageJump} stage(s) in ${chaptersSinceLastChange} chapter(s). ` +
              `Ensure this is well-justified in the narrative.`
            );
          }
        }

        // Check if breakthrough event is required
        if (this.defaultRules.requireBreakthroughEvent && stageJump >= 1 && !hasBreakthroughEvent) {
          issues.push(
            `Power level advancement requires a breakthrough event. ` +
            `Current: ${currentLevel}, Previous: ${previousLevel}. ` +
            `Add a breakthrough scene or description.`
          );
        }
      }
    }

    // Check advancement speed
    if (comparison < 0 && chaptersSinceLastChange > this.defaultRules.maxChaptersPerStage) {
      warnings.push(
        `Slow power progression: ${chaptersSinceLastChange} chapters since last change. ` +
        `Consider advancing the character's power level or adding progression events.`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Get next expected power level
   */
  getNextStage(currentLevel: string, category: PowerLevelCategory = 'cultivation'): string | null {
    const parsed = this.parsePowerLevel(currentLevel, category);
    if (!parsed) return null;

    const hierarchy = this.getHierarchy(category);
    if (!hierarchy) return null;

    // Find next stage
    const nextStage = hierarchy.stages.find(s => s.order === parsed.order + 1);
    return nextStage?.name || null;
  }

  /**
   * Check if a power level string is valid for the category
   */
  isValidPowerLevel(levelString: string, category: PowerLevelCategory = 'cultivation'): boolean {
    const parsed = this.parsePowerLevel(levelString, category);
    return parsed !== null && parsed.order > 0;
  }

  /**
   * Normalize power level string to canonical form
   */
  normalizePowerLevel(levelString: string, category: PowerLevelCategory = 'cultivation'): string {
    const parsed = this.parsePowerLevel(levelString, category);
    if (!parsed) return levelString;

    if (parsed.subStage) {
      return `${parsed.stageName} ${parsed.subStage}`;
    }
    return parsed.stageName;
  }
}

// Singleton instance
let powerLevelSystemInstance: PowerLevelSystem | null = null;

export function getPowerLevelSystem(): PowerLevelSystem {
  if (!powerLevelSystemInstance) {
    powerLevelSystemInstance = new PowerLevelSystem();
  }
  return powerLevelSystemInstance;
}
