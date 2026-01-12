import { NovelState, GenreConvention } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeOriginality } from './originalityDetector';

/**
 * Genre Convention Service
 * Analyzes adherence to genre conventions and identifies innovation opportunities
 */

export interface GenreConventionAnalysis {
  conventions: GenreConvention[];
  adherenceScore: number; // 0-100 (overall adherence)
  innovationScore: number; // 0-100 (how innovative within genre)
  balanceScore: number; // 0-100 (balance between tradition and innovation)
  conventionCategories: {
    structure: GenreConvention[];
    character: GenreConvention[];
    world: GenreConvention[];
    power: GenreConvention[];
  };
  recommendations: string[];
}

/**
 * Xianxia/Xuanhuan genre conventions
 */
const GENRE_CONVENTIONS: Record<string, {
  category: 'structure' | 'character' | 'world' | 'power';
  keywords: string[];
  description: string;
}> = {
  // Structure conventions
  'Cultivation Progression': {
    category: 'structure',
    keywords: ['breakthrough', 'realm', 'level', 'stage', 'cultivation', 'qi', 'spiritual', 'foundation'],
    description: 'Clear power progression system with defined levels'
  },
  'Training Arcs': {
    category: 'structure',
    keywords: ['training', 'practice', 'cultivate', 'meditate', 'exercise', 'refine'],
    description: 'Dedicated training/practice sections'
  },
  'Tournament Arc': {
    category: 'structure',
    keywords: ['tournament', 'competition', 'duel', 'challenge', 'ranking', 'contest'],
    description: 'Tournament or competition arcs'
  },
  'Auction Scene': {
    category: 'structure',
    keywords: ['auction', 'bid', 'treasure', 'artifact', 'spiritual stone'],
    description: 'Auction scenes for rare items'
  },
  
  // Character conventions
  'Young Master Archetype': {
    category: 'character',
    keywords: ['young master', 'young lord', 'noble', 'arrogant', 'spoiled'],
    description: 'Arrogant young master characters'
  },
  'Hidden Master': {
    category: 'character',
    keywords: ['hidden master', 'old master', 'mysterious', 'powerful elder', 'secluded expert'],
    description: 'Powerful but reclusive master characters'
  },
  'Face Saving': {
    category: 'character',
    keywords: ['face', 'reputation', 'honor', 'dignity', 'lose face', 'save face'],
    description: 'Emphasis on face/honor/reputation'
  },
  'Reincarnation': {
    category: 'character',
    keywords: ['reincarnation', 'reincarnated', 'rebirth', 'transmigration', 'soul transfer'],
    description: 'Reincarnation/transmigration protagonist'
  },
  
  // World conventions
  'Multiple Realms': {
    category: 'world',
    keywords: ['realm', 'dimension', 'world', 'plane', 'universe', 'cosmos'],
    description: 'Multiple realms/dimensions/worlds'
  },
  'Sect/Clan System': {
    category: 'world',
    keywords: ['sect', 'clan', 'disciples', 'sect master', 'elder', 'inner disciple', 'outer disciple'],
    description: 'Sect or clan organizational structure'
  },
  'Auction House': {
    category: 'world',
    keywords: ['auction house', 'treasure pavilion', 'commercial hall'],
    description: 'Auction houses or commercial establishments'
  },
  'Secret Realm': {
    category: 'world',
    keywords: ['secret realm', 'trial ground', 'inheritance', 'ancient ruins', 'tomb'],
    description: 'Secret realms or trial grounds'
  },
  
  // Power conventions
  'Cultivation Levels': {
    category: 'power',
    keywords: ['foundation', 'qi condensation', 'core formation', 'nascent soul', 'immortal', 'deity'],
    description: 'Defined cultivation level system'
  },
  'Techniques and Skills': {
    category: 'power',
    keywords: ['technique', 'skill', 'martial art', 'divine ability', 'secret art', 'cultivation method'],
    description: 'Technique/skill system'
  },
  'Treasure/Artifact System': {
    category: 'power',
    keywords: ['treasure', 'artifact', 'spiritual weapon', 'magical equipment', 'pills', 'medicine'],
    description: 'Treasure and artifact collection system'
  },
  'Power Scaling': {
    category: 'power',
    keywords: ['trash', 'genius', 'peerless', 'heaven defying', 'monster talent', 'overpowered'],
    description: 'Clear power scaling and talent hierarchy'
  }
};

/**
 * Analyzes genre convention adherence
 */
export function analyzeGenreConventions(state: NovelState): GenreConventionAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      conventions: [],
      adherenceScore: 0,
      innovationScore: 0,
      balanceScore: 0,
      conventionCategories: {
        structure: [],
        character: [],
        world: [],
        power: [],
      },
      recommendations: ['No chapters available for genre convention analysis'],
    };
  }

  // Build conventions
  const conventions = buildGenreConventions(chapters, state);

  // Calculate scores
  const adherenceScore = calculateAdherenceScore(conventions);
  const innovationScore = calculateInnovationScore(conventions, state);
  const balanceScore = calculateBalanceScore(adherenceScore, innovationScore);

  // Categorize conventions
  const conventionCategories = {
    structure: conventions.filter(c => c.conventionCategory === 'structure'),
    character: conventions.filter(c => c.conventionCategory === 'character'),
    world: conventions.filter(c => c.conventionCategory === 'world'),
    power: conventions.filter(c => c.conventionCategory === 'power'),
  };

  // Generate recommendations
  const recommendations = generateGenreRecommendations(
    conventions,
    adherenceScore,
    innovationScore,
    balanceScore,
    state
  );

  return {
    conventions,
    adherenceScore,
    innovationScore,
    balanceScore,
    conventionCategories,
    recommendations,
  };
}

/**
 * Builds genre conventions from content
 */
function buildGenreConventions(chapters: Chapter[], state: NovelState): GenreConvention[] {
  const conventions: GenreConvention[] = [];
  const allContent = chapters.map(ch => (ch.content + ' ' + ch.summary + ' ' + ch.title).toLowerCase()).join(' ');

  // Check each convention
  Object.entries(GENRE_CONVENTIONS).forEach(([conventionName, conventionData]) => {
    const hasConvention = conventionData.keywords.some(keyword => 
      allContent.includes(keyword.toLowerCase())
    );

    if (hasConvention) {
      // Calculate adherence score (how well it's implemented)
      const adherenceScore = calculateConventionAdherence(
        conventionName,
        conventionData,
        allContent,
        chapters,
        state
      );

      // Check for innovation (subversion or unique take)
      const isInnovative = detectInnovation(conventionName, conventionData, allContent, state);
      const innovationDescription = isInnovative 
        ? `Unique or subverted take on ${conventionName}`
        : undefined;

      conventions.push({
        id: generateUUID(),
        novelId: state.id,
        conventionName,
        conventionCategory: conventionData.category,
        adherenceScore,
        isInnovative,
        innovationDescription,
        notes: conventionData.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  });

  return conventions;
}

/**
 * Calculates adherence score for a convention (0-100)
 */
function calculateConventionAdherence(
  conventionName: string,
  conventionData: { keywords: string[]; category: string },
  content: string,
  chapters: Chapter[],
  state: NovelState
): number {
  let score = 50; // Base score

  // Count keyword occurrences
  const keywordCounts = conventionData.keywords.map(kw => {
    const matches = content.match(new RegExp(kw.toLowerCase(), 'g')) || [];
    return matches.length;
  });

  const totalOccurrences = keywordCounts.reduce((sum, count) => sum + count, 0);
  const uniqueKeywordsFound = keywordCounts.filter(count => count > 0).length;

  // Score based on frequency and variety
  const frequencyScore = Math.min(40, totalOccurrences * 5);
  const varietyScore = Math.min(30, uniqueKeywordsFound * 5);

  score = frequencyScore * 0.6 + varietyScore * 0.4;

  // Check category-specific implementation
  switch (conventionData.category) {
    case 'structure':
      // Check if it's integrated into story structure
      const structureAnalysis = analyzeStoryStructure(state);
      if (conventionName === 'Cultivation Progression' && state.characterCodex.some(c => c.currentCultivation)) {
        score += 10;
      }
      break;

    case 'character':
      // Check if characters exhibit this convention
      const characterContent = state.characterCodex.map(c => 
        (c.name + ' ' + c.personality + ' ' + c.notes).toLowerCase()
      ).join(' ');
      if (characterContent.includes(conventionData.keywords[0].toLowerCase())) {
        score += 10;
      }
      break;

    case 'world':
      // Check world-building entries
      const worldContent = state.worldBible.map(we => 
        (we.title + ' ' + we.content).toLowerCase()
      ).join(' ');
      if (worldContent.includes(conventionData.keywords[0].toLowerCase())) {
        score += 10;
      }
      break;

    case 'power':
      // Check power system implementation
      if (state.novelTechniques && state.novelTechniques.length > 0) {
        if (conventionName === 'Techniques and Skills') {
          score += 15;
        }
      }
      if (state.novelItems && state.novelItems.length > 0) {
        if (conventionName === 'Treasure/Artifact System') {
          score += 15;
        }
      }
      break;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Detects innovation in convention usage
 */
function detectInnovation(
  conventionName: string,
  conventionData: { keywords: string[] },
  content: string,
  state: NovelState
): boolean {
  // Check for subversion keywords
  const subversionKeywords = [
    'unexpected', 'unique', 'different', 'innovative', 'original',
    'not typical', 'unusual', 'subvert', 'invert', 'defy'
  ];

  // Find convention mentions
  const conventionMentions = conventionData.keywords
    .map(kw => content.indexOf(kw.toLowerCase()))
    .filter(index => index !== -1);

  if (conventionMentions.length === 0) return false;

  // Check context around mentions for subversion
  for (const mentionIndex of conventionMentions) {
    const context = content.substring(
      Math.max(0, mentionIndex - 100),
      Math.min(content.length, mentionIndex + 200)
    );

    const hasSubversion = subversionKeywords.some(kw => context.includes(kw.toLowerCase()));
    if (hasSubversion) {
      return true;
    }
  }

  // Check originality analysis
  const originality = analyzeOriginality(state);
  if (originality.freshAngles.some(angle => angle.toLowerCase().includes(conventionName.toLowerCase()))) {
    return true;
  }

  return false;
}

/**
 * Calculates overall adherence score (0-100)
 */
function calculateAdherenceScore(conventions: GenreConvention[]): number {
  if (conventions.length === 0) return 0;

  // Average adherence score
  const avgAdherence = conventions.reduce((sum, c) => sum + c.adherenceScore, 0) / conventions.length;

  // Bonus for covering all major convention categories
  const categories = new Set(conventions.map(c => c.conventionCategory));
  const categoryBonus = categories.size >= 3 ? 10 : 0;

  // Bonus for having expected conventions
  const expectedConventions = [
    'Cultivation Progression',
    'Cultivation Levels',
    'Sect/Clan System',
    'Techniques and Skills'
  ];

  const hasExpected = expectedConventions.filter(ec => 
    conventions.some(c => c.conventionName === ec)
  ).length;

  const expectedBonus = (hasExpected / expectedConventions.length) * 10;

  return Math.min(100, Math.round(avgAdherence + categoryBonus + expectedBonus));
}

/**
 * Calculates innovation score (0-100)
 */
function calculateInnovationScore(conventions: GenreConvention[], state: NovelState): number {
  if (conventions.length === 0) return 0;

  let score = 50; // Base score

  // Bonus for innovative conventions
  const innovativeConventions = conventions.filter(c => c.isInnovative);
  score += Math.min(30, innovativeConventions.length * 5);

  // Check originality analysis
  const originality = analyzeOriginality(state);
  score += (originality.overallOriginality / 100) * 0.2 * 100; // 20% weight

  // Bonus for fresh angles
  if (originality.freshAngles.length > 0) {
    score += Math.min(20, originality.freshAngles.length * 4);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates balance score (0-100)
 */
function calculateBalanceScore(adherenceScore: number, innovationScore: number): number {
  // Ideal balance: 70-80% adherence, 60-70% innovation
  const idealAdherence = 75;
  const idealInnovation = 65;

  const adherenceDeviation = Math.abs(adherenceScore - idealAdherence);
  const innovationDeviation = Math.abs(innovationScore - idealInnovation);

  // Score decreases with deviation from ideal
  const adherenceScore_component = Math.max(0, 50 - adherenceDeviation);
  const innovationScore_component = Math.max(0, 50 - innovationDeviation);

  return Math.round(adherenceScore_component + innovationScore_component);
}

/**
 * Generates genre recommendations
 */
function generateGenreRecommendations(
  conventions: GenreConvention[],
  adherenceScore: number,
  innovationScore: number,
  balanceScore: number,
  state: NovelState
): string[] {
  const recommendations: string[] = [];

  if (adherenceScore < 60) {
    recommendations.push(`Genre adherence score is ${adherenceScore}/100. Consider incorporating more genre conventions for better market fit.`);
  }

  // Check for missing key conventions
  const expectedConventions = [
    'Cultivation Progression',
    'Cultivation Levels',
    'Sect/Clan System',
    'Techniques and Skills'
  ];

  const presentConventions = conventions.map(c => c.conventionName);
  const missingConventions = expectedConventions.filter(ec => !presentConventions.includes(ec));

  if (missingConventions.length > 0) {
    recommendations.push(`Missing key genre conventions: ${missingConventions.join(', ')}. Consider adding these for genre authenticity.`);
  }

  // Check for innovation
  if (innovationScore < 40) {
    recommendations.push(`Innovation score is ${innovationScore}/100. Consider adding unique twists to genre conventions.`);
  }

  // Check balance
  if (balanceScore < 60) {
    if (adherenceScore > innovationScore + 20) {
      recommendations.push('Too much adherence, not enough innovation. Consider adding unique elements.');
    } else if (innovationScore > adherenceScore + 20) {
      recommendations.push('Too much innovation, not enough adherence. Consider incorporating more genre conventions.');
    }
  }

  // Positive feedback
  if (balanceScore >= 75 && adherenceScore >= 70 && innovationScore >= 60) {
    recommendations.push('Excellent genre convention balance! Good adherence with innovative elements.');
  }

  // Highlight innovative conventions
  const innovativeConventions = conventions.filter(c => c.isInnovative);
  if (innovativeConventions.length > 0) {
    recommendations.push(
      `Innovative conventions detected: ${innovativeConventions.map(c => c.conventionName).join(', ')}. Great use of subversion!`
    );
  }

  return recommendations;
}
