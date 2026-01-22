import { NovelState, OriginalityScores, Chapter, ChapterOriginalityScore } from '../types';
import { generateUUID } from '../utils/uuid';
import { detectCliches, detectTropes } from './proseQualityService';
import { analyzeLiteraryDevices } from './literaryDeviceAnalyzer';

/**
 * Originality Detector
 * Analyzes originality of plot, characters, world-building, and concepts
 * Detects clichés, tropes, and identifies unique elements
 */

export interface OriginalityAnalysis {
  originalityScores: OriginalityScores;
  plotOriginality: number; // 0-100
  characterOriginality: number; // 0-100
  worldBuildingOriginality: number; // 0-100
  conceptInnovation: number; // 0-100
  overallOriginality: number; // 0-100
  uniqueElements: string[];
  commonTropesDetected: string[];
  freshAngles: string[];
  marketGaps: string[];
  recommendations: string[];
}

/**
 * Analyzes originality across all dimensions
 */
export function analyzeOriginality(state: NovelState): OriginalityAnalysis {
  if (state.chapters.length === 0) {
    return {
      originalityScores: {
        id: generateUUID(),
        novelId: state.id,
        plotOriginality: 0,
        characterOriginality: 0,
        worldBuildingOriginality: 0,
        conceptInnovation: 0,
        overallOriginality: 0,
        uniqueElements: [],
        commonTropesDetected: [],
        freshAngles: [],
        marketGaps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      plotOriginality: 0,
      characterOriginality: 0,
      worldBuildingOriginality: 0,
      conceptInnovation: 0,
      overallOriginality: 0,
      uniqueElements: [],
      commonTropesDetected: [],
      freshAngles: [],
      marketGaps: [],
      recommendations: ['No chapters available for originality analysis'],
    };
  }

  // Analyze plot originality
  const plotOriginality = analyzePlotOriginality(state);

  // Analyze character originality
  const characterOriginality = analyzeCharacterOriginality(state);

  // Analyze world-building originality
  const worldBuildingOriginality = analyzeWorldBuildingOriginality(state);

  // Analyze concept innovation
  const conceptInnovation = analyzeConceptInnovation(state);

  // Detect unique elements
  const uniqueElements = detectUniqueElements(state);

  // Detect common tropes
  const commonTropesDetected = detectCommonTropes(state);

  // Identify fresh angles
  const freshAngles = identifyFreshAngles(state, commonTropesDetected);

  // Identify market gaps
  const marketGaps = identifyMarketGaps(state);

  // Calculate overall originality
  const overallOriginality = calculateOverallOriginality(
    plotOriginality,
    characterOriginality,
    worldBuildingOriginality,
    conceptInnovation,
    commonTropesDetected.length,
    uniqueElements.length
  );

  // Create originality scores object
  const originalityScores: OriginalityScores = {
    id: generateUUID(),
    novelId: state.id,
    plotOriginality,
    characterOriginality,
    worldBuildingOriginality,
    conceptInnovation,
    overallOriginality,
    uniqueElements,
    commonTropesDetected,
    freshAngles,
    marketGaps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Generate recommendations
  const recommendations = generateOriginalityRecommendations(
    plotOriginality,
    characterOriginality,
    worldBuildingOriginality,
    conceptInnovation,
    overallOriginality,
    commonTropesDetected,
    uniqueElements
  );

  return {
    originalityScores,
    plotOriginality,
    characterOriginality,
    worldBuildingOriginality,
    conceptInnovation,
    overallOriginality,
    uniqueElements,
    commonTropesDetected,
    freshAngles,
    marketGaps,
    recommendations,
  };
}

/**
 * Analyzes plot originality (0-100)
 */
function analyzePlotOriginality(state: NovelState): number {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const allContent = chapters.map(ch => (ch.content + ' ' + ch.summary).toLowerCase()).join(' ');

  let score = 50; // Base score

  // Common plot patterns (penalize)
  const commonPatterns = [
    'chosen one', 'prophecy', 'destiny', 'chosen by fate',
    'save the world', 'destroy the evil', 'find the artifact',
    'rescue the princess', 'revenge story', 'coming of age',
    'hero\'s journey', 'three acts', 'traditional structure'
  ];

  const patternCount = commonPatterns.filter(pattern => allContent.includes(pattern)).length;
  score -= Math.min(30, patternCount * 5); // Penalize for common patterns

  // Check for plot twists
  const twistIndicators = [
    'unexpected', 'surprising', 'twist', 'reveal', 'shocking',
    'never saw', 'couldn\'t predict', 'unforeseen'
  ];

  const hasTwists = twistIndicators.some(indicator => allContent.includes(indicator));
  if (hasTwists) score += 15;

  // Check for non-linear structure
  const structureIndicators = ['flashback', 'flash forward', 'time skip', 'multiple timelines', 'perspective shift'];
  const hasNonLinear = structureIndicators.some(indicator => allContent.includes(indicator));
  if (hasNonLinear) score += 10;

  // Check arcs for variety
  const arcs = state.plotLedger;
  if (arcs.length > 0) {
    const arcTitles = arcs.map(a => a.title.toLowerCase()).join(' ');
    const uniqueArcKeywords = new Set(arcTitles.split(/\s+/));
    const variety = uniqueArcKeywords.size / arcTitles.split(/\s+/).length;
    score += variety * 20; // Bonus for arc variety
  }

  // Check for unique plot elements (check summaries)
  const summaries = chapters.map(ch => ch.summary.toLowerCase()).join(' ');
  const uniqueKeywords = ['unprecedented', 'never before', 'unique', 'original', 'innovative', 'novel approach'];
  const hasUniqueElements = uniqueKeywords.some(keyword => summaries.includes(keyword));
  if (hasUniqueElements) score += 15;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes character originality (0-100)
 */
function analyzeCharacterOriginality(state: NovelState): number {
  const characters = state.characterCodex;

  if (characters.length === 0) return 50;

  let score = 50; // Base score

  // Common character archetypes (penalize)
  const commonArchetypes = [
    'chosen one', 'mentor', 'wise old master', 'damsel in distress',
    'evil overlord', 'tragic hero', 'anti-hero', 'best friend',
    'comic relief', 'love interest', 'rival'
  ];

  const allCharacterContent = characters.map(c =>
    (c.name + ' ' + c.personality + ' ' + c.notes).toLowerCase()
  ).join(' ');

  const archetypeCount = commonArchetypes.filter(archetype =>
    allCharacterContent.includes(archetype)
  ).length;

  score -= Math.min(30, archetypeCount * 4);

  // Check for character complexity (multiple traits, contradictions)
  let complexCharacters = 0;
  characters.forEach(character => {
    const traits = character.personality.split(/,|;|\.|\s+and\s+/).filter(t => t.trim().length > 0);
    if (traits.length >= 4) complexCharacters++;

    // Check for contradictions (complexity indicator)
    const hasContradictions = character.personality.toLowerCase().includes('but') ||
      character.personality.toLowerCase().includes('however') ||
      character.personality.toLowerCase().includes('yet');
    if (hasContradictions) complexCharacters++;
  });

  score += Math.min(20, (complexCharacters / characters.length) * 30);

  // Check for unique character concepts
  const uniqueConcepts = [
    'non-human', 'hybrid', 'transformed', 'reincarnated', 'possessed',
    'cursed', 'blessed', 'unique ability', 'rare talent', 'one of a kind'
  ];

  const hasUniqueConcepts = uniqueConcepts.some(concept => allCharacterContent.includes(concept));
  if (hasUniqueConcepts) score += 15;

  // Check for character growth/transformation
  const hasGrowth = state.characterPsychologies?.some(cp =>
    cp.growthStage === 'transformed' || cp.psychologicalState === 'transformed'
  );
  if (hasGrowth) score += 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes world-building originality (0-100)
 */
function analyzeWorldBuildingOriginality(state: NovelState): number {
  const worldEntries = state.worldBible || [];
  const allContent = worldEntries.map(we => (we.title + ' ' + we.content).toLowerCase()).join(' ');

  let score = 50; // Base score

  // Common world-building elements (penalize for overuse)
  const commonElements = [
    'magic system', 'cultivation system', 'power levels',
    'kingdoms', 'empires', 'realms', 'dimensions',
    'guild', 'academy', 'sect', 'clan',
    'tower', 'dungeon', 'labyrinth'
  ];

  const elementCount = commonElements.filter(element => allContent.includes(element)).length;
  const elementDensity = elementCount / Math.max(1, worldEntries.length);

  if (elementDensity > 0.5) {
    score -= Math.min(20, (elementDensity - 0.5) * 40); // Too common
  }

  // Check for unique world elements
  const uniqueWorldElements = [
    'unique', 'original', 'never seen', 'unprecedented',
    'innovative', 'novel', 'fresh', 'different'
  ];

  const hasUniqueElements = uniqueWorldElements.some(element => allContent.includes(element));
  if (hasUniqueElements) score += 15;

  // Check for detailed world-building (more entries = more originality potential)
  if (worldEntries.length > 10) {
    score += 10; // Extensive world-building
  }

  // Check for innovative systems (check for unique system descriptions)
  const systemEntries = worldEntries.filter(we =>
    we.category === 'Systems' || we.content.toLowerCase().includes('system')
  );

  if (systemEntries.length > 0) {
    const systemDescriptions = systemEntries.map(se => se.content.toLowerCase()).join(' ');
    const innovativeKeywords = ['unique', 'original', 'different', 'novel', 'innovative', 'unprecedented'];
    const hasInnovativeSystems = innovativeKeywords.some(kw => systemDescriptions.includes(kw));
    if (hasInnovativeSystems) score += 15;
  }

  // Check realm variety
  const realms = state.realms || [];
  if (realms.length > 2) {
    score += 10; // Multiple realms shows world-building depth
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes concept innovation (0-100)
 */
function analyzeConceptInnovation(state: NovelState): number {
  const allContent = state.chapters.map(ch =>
    (ch.content + ' ' + ch.summary + ' ' + ch.title).toLowerCase()
  ).join(' ');

  let score = 50; // Base score

  // Check for innovative concepts
  const innovativeIndicators = [
    'unprecedented', 'never before', 'revolutionary', 'groundbreaking',
    'innovative', 'novel', 'original', 'unique', 'unprecedented',
    'new approach', 'fresh perspective', 'original take'
  ];

  const innovationCount = innovativeIndicators.filter(indicator => allContent.includes(indicator)).length;
  score += Math.min(25, innovationCount * 3);

  // Check for unique combinations (genre blending, etc.)
  const genreIndicators = state.genre ? [state.genre.toLowerCase()] : [];
  const hasGenreBlending = genreIndicators.length > 0 &&
    (allContent.includes('mix') || allContent.includes('blend') || allContent.includes('combination'));
  if (hasGenreBlending) score += 15;

  // Check for fresh takes on tropes (trope subversion)
  const subversionIndicators = [
    'subvert', 'invert', 'twist on', 'different take', 'unexpected',
    'defy expectations', 'break the mold', 'not typical'
  ];

  const hasSubversion = subversionIndicators.some(indicator => allContent.includes(indicator));
  if (hasSubversion) score += 20;

  // Check grand saga for unique concepts
  if (state.grandSaga && state.grandSaga.length > 20) {
    const grandSagaLower = state.grandSaga.toLowerCase();
    const hasUniqueGrandSaga = innovativeIndicators.some(ind => grandSagaLower.includes(ind));
    if (hasUniqueGrandSaga) score += 10;
  }

  // Check for philosophical depth (innovation indicator)
  const philosophicalIndicators = [
    'philosophy', 'meaning', 'purpose', 'question', 'explore',
    'examine', 'contemplate', 'reflect', 'deep'
  ];

  const hasPhilosophy = philosophicalIndicators.some(indicator => allContent.includes(indicator));
  if (hasPhilosophy) score += 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Detects unique elements
 */
function detectUniqueElements(state: NovelState): string[] {
  const uniqueElements: string[] = [];
  const allContent = state.chapters.map(ch => (ch.content + ' ' + ch.summary)).join(' ');

  // Look for explicitly mentioned unique elements
  const uniquePatterns = [
    /(unprecedented|unique|original|never before|first of its kind)\s+(\w+\s+){0,3}/gi,
    /(innovative|novel|fresh|groundbreaking)\s+(approach|method|system|way|concept)/gi,
    /(one of a kind|one-of-a-kind|singular|unparalleled|unmatched)/gi
  ];

  uniquePatterns.forEach(pattern => {
    const matches = allContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.trim().substring(0, 100);
        if (!uniqueElements.includes(cleaned)) {
          uniqueElements.push(cleaned);
        }
      });
    }
  });

  // Check world-building for unique elements
  state.worldBible?.forEach(entry => {
    if (entry.content.toLowerCase().includes('unique') ||
      entry.content.toLowerCase().includes('original') ||
      entry.content.toLowerCase().includes('unprecedented')) {
      const element = `${entry.title}: unique ${entry.category.toLowerCase()}`;
      if (!uniqueElements.includes(element)) {
        uniqueElements.push(element);
      }
    }
  });

  return uniqueElements.slice(0, 20); // Limit to 20
}

/**
 * Detects common tropes
 */
function detectCommonTropes(state: NovelState): string[] {
  const allContent = state.chapters.map(ch =>
    (ch.content + ' ' + ch.summary + ' ' + ch.title).toLowerCase()
  ).join(' ');

  // Common tropes in Xianxia/Xuanhuan
  const commonTropes = [
    'reincarnation', 'system', 'cheat ability', 'overpowered mc',
    'hidden master', 'young master', 'face saving', 'trash to treasure',
    'hidden identity', 'pretending to be weak', 'auction scene',
    'tournament arc', 'cultivation breakthrough', 'face slapping',
    'peerless genius', 'heaven defying talent', 'unprecedented breakthrough',
    'shocking discovery', 'realm of cultivation', 'rival becomes friend',
    'enemy becomes ally', 'betrayal', 'redemption arc', 'mentor death',
    'power of friendship', 'training montage', 'false defeat', 'power up'
  ];

  const detectedTropes: string[] = [];

  commonTropes.forEach(trope => {
    if (allContent.includes(trope.toLowerCase())) {
      detectedTropes.push(trope);
    }
  });

  // Also check character archetypes
  const characterArchetypes = [
    'chosen one', 'tragic hero', 'anti-hero', 'mentor',
    'wise old master', 'damsel in distress', 'love interest'
  ];

  const characterContent = state.characterCodex.map(c =>
    (c.name + ' ' + c.personality + ' ' + c.notes).toLowerCase()
  ).join(' ');

  characterArchetypes.forEach(archetype => {
    if (characterContent.includes(archetype) && !detectedTropes.includes(archetype)) {
      detectedTropes.push(archetype);
    }
  });

  return detectedTropes;
}

/**
 * Identifies fresh angles (tropes used in innovative ways)
 */
function identifyFreshAngles(state: NovelState, detectedTropes: string[]): string[] {
  const freshAngles: string[] = [];
  const allContent = state.chapters.map(ch =>
    (ch.content + ' ' + ch.summary).toLowerCase()
  ).join(' ');

  // Check for subversion indicators near trope mentions
  const subversionKeywords = [
    'unexpected', 'surprising', 'different', 'unique', 'original',
    'not typical', 'unusual', 'defy', 'break', 'invert', 'subvert'
  ];

  detectedTropes.forEach(trope => {
    // Find trope mentions
    const tropeIndex = allContent.indexOf(trope.toLowerCase());
    if (tropeIndex !== -1) {
      // Check context around trope (100 chars before and after)
      const context = allContent.substring(
        Math.max(0, tropeIndex - 100),
        Math.min(allContent.length, tropeIndex + trope.length + 100)
      );

      // Check for subversion keywords
      const hasSubversion = subversionKeywords.some(keyword => context.includes(keyword));
      if (hasSubversion) {
        freshAngles.push(`Fresh take on "${trope}"`);
      }
    }
  });

  // Check for unique combinations
  if (detectedTropes.includes('reincarnation') && detectedTropes.includes('system')) {
    if (allContent.includes('unique') || allContent.includes('original')) {
      freshAngles.push('Innovative combination of reincarnation and system');
    }
  }

  return freshAngles.slice(0, 10);
}

/**
 * Identifies market gaps (underrepresented elements)
 */
function identifyMarketGaps(state: NovelState): string[] {
  const marketGaps: string[] = [];
  const allContent = state.chapters.map(ch =>
    (ch.content + ' ' + ch.summary).toLowerCase()
  ).join(' ');

  // Common underrepresented elements in genre
  const underrepresentedElements = [
    'non-human protagonist',
    'female mc',
    'slice of life',
    'romance focus',
    'comedy focus',
    'mystery elements',
    'sci-fi blend',
    'contemporary setting',
    'psychological focus',
    'social commentary'
  ];

  underrepresentedElements.forEach(element => {
    const keywords = element.split(/\s+/);
    const hasElement = keywords.every(kw => allContent.includes(kw.toLowerCase()));

    if (hasElement) {
      marketGaps.push(element);
    }
  });

  // Check for genre-blending (market gap)
  if (state.genre) {
    const genreLower = state.genre.toLowerCase();
    const isXianxia = genreLower.includes('xianxia');
    const isXuanhuan = genreLower.includes('xuanhuan');

    if ((isXianxia || isXuanhuan) &&
      (allContent.includes('modern') || allContent.includes('contemporary') ||
        allContent.includes('sci-fi') || allContent.includes('urban'))) {
      marketGaps.push('Genre-blending: Traditional cultivation with modern/sci-fi elements');
    }
  }

  return marketGaps.slice(0, 10);
}

/**
 * Calculates overall originality score
 */
function calculateOverallOriginality(
  plotOriginality: number,
  characterOriginality: number,
  worldBuildingOriginality: number,
  conceptInnovation: number,
  tropeCount: number,
  uniqueElementCount: number
): number {
  // Weighted average
  const baseScore = (
    plotOriginality * 0.3 +
    characterOriginality * 0.25 +
    worldBuildingOriginality * 0.25 +
    conceptInnovation * 0.2
  );

  // Bonus for unique elements
  const uniqueBonus = Math.min(10, uniqueElementCount * 2);

  // Penalty for too many tropes
  const tropePenalty = Math.min(15, tropeCount * 1.5);

  return Math.min(100, Math.max(0, Math.round(baseScore + uniqueBonus - tropePenalty)));
}

/**
 * Generates originality recommendations
 */
function generateOriginalityRecommendations(
  plotOriginality: number,
  characterOriginality: number,
  worldBuildingOriginality: number,
  conceptInnovation: number,
  overallOriginality: number,
  commonTropes: string[],
  uniqueElements: string[]
): string[] {
  const recommendations: string[] = [];

  if (overallOriginality < 60) {
    recommendations.push(`Overall originality score is ${overallOriginality}/100. Consider adding more unique elements and subverting common tropes.`);
  }

  if (plotOriginality < 50) {
    recommendations.push(`Plot originality is ${plotOriginality}/100. Consider adding unexpected twists or non-linear structure.`);
  }

  if (characterOriginality < 50) {
    recommendations.push(`Character originality is ${characterOriginality}/100. Develop more complex, unique characters beyond common archetypes.`);
  }

  if (worldBuildingOriginality < 50) {
    recommendations.push(`World-building originality is ${worldBuildingOriginality}/100. Add unique systems and elements beyond common fantasy tropes.`);
  }

  if (conceptInnovation < 50) {
    recommendations.push(`Concept innovation is ${conceptInnovation}/100. Consider fresh takes on genre conventions.`);
  }

  // Check for too many tropes
  if (commonTropes.length > 10) {
    recommendations.push(`Many common tropes detected (${commonTropes.length}). Consider subverting some tropes for freshness.`);
  }

  // Check for unique elements
  if (uniqueElements.length < 3) {
    recommendations.push('Few unique elements detected. Consider highlighting what makes your story unique.');
  }

  // Positive feedback
  if (overallOriginality >= 75 && uniqueElements.length >= 5 && commonTropes.length < 5) {
    recommendations.push('Excellent originality! Strong unique elements and fresh perspective.');
  }

  return recommendations;
}

// Cache for chapter originality analysis
const originalityCache = new Map<string, {
  timestamp: number;
  score: ChapterOriginalityScore;
}>();
const ORIGINALITY_CACHE_TTL = 300000; // 5 minutes

/**
 * Analyzes originality for a single chapter
 * Returns comprehensive chapter-level originality score
 * Uses caching for performance optimization
 */
export function analyzeChapterOriginality(
  chapter: Chapter,
  state: NovelState
): ChapterOriginalityScore {
  // Check cache
  const cacheKey = `${chapter.id}:${chapter.content?.length || 0}`;
  const cached = originalityCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ORIGINALITY_CACHE_TTL) {
    return cached.score;
  }

  const content = chapter.content || '';
  const wordCount = content.split(/\s+/).length;

  const creativeDistance = calculateCreativeDistance(chapter, state);
  const novelMetaphorAnalysis = detectNovelMetaphors(content, wordCount);
  const uniqueImageryAnalysis = detectUniqueImagery(content, state, wordCount);
  const sceneConstructionAnalysis = analyzeSceneConstructionOriginality(chapter, state);
  const emotionalBeatAnalysis = analyzeEmotionalBeatOriginality(chapter, state);

  // Detect generic patterns and mechanical structures
  const genericPatterns = detectGenericPatterns(content);
  const mechanicalStructures = detectMechanicalStructures(content);
  const derivativeContent = detectDerivativeContent(content, state);
  const clichePatterns = detectCliches(content);

  // Calculate overall originality score
  const overallOriginality = Math.round(
    creativeDistance * 0.25 +
    novelMetaphorAnalysis.score * 0.20 +
    uniqueImageryAnalysis.score * 0.20 +
    sceneConstructionAnalysis.score * 0.20 +
    emotionalBeatAnalysis.score * 0.15
  );

  const score: ChapterOriginalityScore = {
    id: generateUUID(),
    chapterId: chapter.id,
    novelId: state.id,
    overallOriginality,
    creativeDistance,
    novelMetaphorScore: novelMetaphorAnalysis.score,
    uniqueImageryScore: uniqueImageryAnalysis.score,
    sceneConstructionOriginality: sceneConstructionAnalysis.score,
    emotionalBeatOriginality: emotionalBeatAnalysis.score,
    genericPatternsDetected: genericPatterns,
    mechanicalStructuresDetected: mechanicalStructures,
    derivativeContentFlags: derivativeContent,
    clichePatterns,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Cache the result
  originalityCache.set(cacheKey, {
    timestamp: Date.now(),
    score,
  });

  // Clean old cache entries (keep last 10)
  if (originalityCache.size > 10) {
    const entries = Array.from(originalityCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const toKeep = entries.slice(0, 10);
    originalityCache.clear();
    toKeep.forEach(([key, value]) => originalityCache.set(key, value));
  }

  return score;
}

/**
 * Calculates creative distance from training patterns
 * Higher score = more unique = further from common patterns
 */
function calculateCreativeDistance(chapter: Chapter, state: NovelState): number {
  const content = (chapter.content || '').toLowerCase();
  let score = 50; // Base score

  // Common training data patterns to detect
  const commonPatterns = [
    // Generic openings
    /^(it was|there was|once upon|in a|the sun|the moon|the day)/i,
    // Generic transitions
    /(meanwhile|suddenly|all of a sudden|before long|soon after)/gi,
    // Generic descriptions
    /(beautiful|magnificent|ancient|mysterious|powerful|incredible)/gi,
    // Generic dialogue tags
    /(he said|she said|they said|he asked|she asked)/gi,
    // Generic action
    /(he walked|she walked|they walked|he ran|she ran)/gi,
  ];

  let patternMatches = 0;
  commonPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      patternMatches += matches.length;
    }
  });

  const wordCount = content.split(/\s+/).length;
  const patternDensity = wordCount > 0 ? (patternMatches / wordCount) * 1000 : 0;

  // Penalize high pattern density
  score -= Math.min(40, patternDensity * 2);

  // Bonus for unique word combinations
  const words = content.split(/\s+/).filter(w => w.length > 4);
  const uniqueCombinations = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    const combo = `${words[i]} ${words[i + 1]}`;
    if (combo.length > 8 && combo.length < 30) {
      uniqueCombinations.add(combo);
    }
  }

  const uniqueRatio = words.length > 0 ? uniqueCombinations.size / words.length : 0;
  if (uniqueRatio > 0.1) {
    score += Math.min(20, uniqueRatio * 200);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Detects novel metaphors and imagery
 */
function detectNovelMetaphors(content: string, wordCount: number): {
  count: number;
  examples: string[];
  score: number;
} {
  const examples: string[] = [];

  // Metaphor patterns
  const metaphorPatterns = [
    /(like|as|as if|as though)\s+\w+\s+\w+/gi,
    /(was|were|is|are)\s+\w+\s+(like|as)/gi,
    /(metaphor|simile|comparison)/gi,
  ];

  let metaphorCount = 0;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);

  sentences.forEach(sentence => {
    const hasMetaphor = metaphorPatterns.some(pattern => pattern.test(sentence));
    if (hasMetaphor) {
      metaphorCount++;
      // Check if it's novel (not a common metaphor)
      const isNovel = !isCommonMetaphor(sentence);
      if (isNovel && examples.length < 5) {
        examples.push(sentence.trim().substring(0, 100));
      }
    }
  });

  // Target: 2 metaphors per 1000 words
  const targetMetaphors = (wordCount / 1000) * 2;
  const metaphorRatio = targetMetaphors > 0 ? metaphorCount / targetMetaphors : 0;

  // Score: 0 = no metaphors, 100 = 2+ per 1000 words with novel examples
  let score = Math.min(100, Math.max(0, (metaphorRatio / 1.0) * 100));

  // Bonus for novel metaphors
  if (examples.length > 0) {
    score = Math.min(100, score + (examples.length * 5));
  }

  return {
    count: metaphorCount,
    examples: examples.slice(0, 5),
    score: Math.round(score),
  };
}

/**
 * Checks if a sentence contains a common metaphor
 */
function isCommonMetaphor(sentence: string): boolean {
  const commonMetaphors = [
    /heart (pounded|raced|sank|leaped)/i,
    /(as|like) (a|an) (drum|thunder|lightning|fire|ice|stone|rock)/i,
    /(eyes|gaze) (burned|flashed|sparkled|shone)/i,
    /(time|life) (flew|stood still|crawled)/i,
    /(voice|words) (cut|stung|pierced)/i,
  ];

  return commonMetaphors.some(pattern => pattern.test(sentence));
}

/**
 * Detects unique imagery
 */
function detectUniqueImagery(content: string, state: NovelState, wordCount: number): {
  count: number;
  examples: string[];
  score: number;
} {
  const examples: string[] = [];

  // Unique imagery indicators (sensory details, specific descriptions)
  const imageryPatterns = [
    // Sensory details
    /(smell|scent|odor|aroma|fragrance|stench)/gi,
    /(texture|feel|touch|rough|smooth|coarse|silky)/gi,
    /(taste|flavor|bitter|sweet|sour|salty)/gi,
    /(sound|noise|whisper|roar|rustle|crunch)/gi,
    // Specific visual details
    /(color|hue|shade|tint|gleam|glow|shimmer)/gi,
    // Specific objects/details
    /\b(the|a|an)\s+\w+\s+(of|with|that|which)\s+\w+/gi,
  ];

  let imageryCount = 0;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);

  sentences.forEach(sentence => {
    const hasImagery = imageryPatterns.some(pattern => pattern.test(sentence));
    if (hasImagery) {
      // Check if it's unique (specific, not generic)
      const isUnique = !isGenericImagery(sentence);
      if (isUnique) {
        imageryCount++;
        if (examples.length < 5) {
          examples.push(sentence.trim().substring(0, 100));
        }
      }
    }
  });

  // Target: 5+ unique imagery instances per 1000 words
  const targetImagery = (wordCount / 1000) * 5;
  const imageryRatio = targetImagery > 0 ? imageryCount / targetImagery : 0;

  const score = Math.min(100, Math.max(0, (imageryRatio / 1.0) * 100));

  return {
    count: imageryCount,
    examples: examples.slice(0, 5),
    score: Math.round(score),
  };
}

/**
 * Checks if imagery is generic
 */
function isGenericImagery(sentence: string): boolean {
  const genericImagery = [
    /(beautiful|ugly|nice|good|bad|big|small|large|tiny)/i,
    /(very|really|quite|rather|pretty|somewhat)/i,
    /(looked|appeared|seemed)\s+(nice|good|bad|beautiful|ugly)/i,
  ];

  return genericImagery.some(pattern => pattern.test(sentence));
}

/**
 * Analyzes scene construction originality
 */
function analyzeSceneConstructionOriginality(chapter: Chapter, state: NovelState): {
  score: number;
  patternMatches: string[];
  uniqueElements: string[];
} {
  const content = chapter.content || '';
  const patternMatches: string[] = [];
  const uniqueElements: string[] = [];

  // Common scene patterns
  const commonPatterns = [
    {
      name: 'Training montage',
      pattern: /(training|practice|cultivation|meditation).*?(breakthrough|improvement|progress)/gi,
    },
    {
      name: 'Villain monologue',
      pattern: /(villain|enemy|antagonist).*?(explained|revealed|told|said).*?(plan|scheme|plot)/gi,
    },
    {
      name: 'Power-up sequence',
      pattern: /(power|energy|qi|spiritual).*?(surged|flowed|exploded|burst)/gi,
    },
    {
      name: 'Revelation scene',
      pattern: /(suddenly|realized|understood|discovered).*?(truth|secret|mystery)/gi,
    },
    {
      name: 'Battle preparation',
      pattern: /(prepared|readied|gathered).*?(weapon|technique|strategy)/gi,
    },
  ];

  commonPatterns.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      patternMatches.push(name);
    }
  });

  // Unique elements: non-standard scene structures
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length > 0) {
    // Check for varied scene structures
    const firstWords = paragraphs.slice(0, 5).map(p => {
      const words = p.trim().split(/\s+/);
      return words[0]?.toLowerCase() || '';
    });
    const uniqueBeginnings = new Set(firstWords);
    if (uniqueBeginnings.size > 3) {
      uniqueElements.push('Varied scene openings');
    }

    // Check for non-linear elements
    if (content.match(/(flashback|memory|remembered|recalled|past)/gi)) {
      uniqueElements.push('Non-linear narrative elements');
    }

    // Check for multiple POVs
    const povShifts = content.match(/(meanwhile|elsewhere|at the same time|simultaneously)/gi);
    if (povShifts && povShifts.length > 1) {
      uniqueElements.push('Multiple perspective shifts');
    }
  }

  // Score: penalize common patterns, reward unique elements
  let score = 100;
  score -= patternMatches.length * 15; // Each common pattern = -15
  score += uniqueElements.length * 10; // Each unique element = +10

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    patternMatches,
    uniqueElements,
  };
}

/**
 * Analyzes emotional beat originality
 */
function analyzeEmotionalBeatOriginality(chapter: Chapter, state: NovelState): {
  score: number;
  standardTropesDetected: string[];
  uniqueBeats: string[];
} {
  const content = (chapter.content || '').toLowerCase();
  const standardTropes: string[] = [];
  const uniqueBeats: string[] = [];

  // Standard emotional tropes
  const standardTropePatterns = [
    {
      name: 'Anger powers up',
      pattern: /(angry|furious|rage).*?(power|strength|energy|qi).*?(surged|increased|grew)/gi,
    },
    {
      name: 'Friendship victory',
      pattern: /(friend|ally|companion).*?(helped|supported|saved).*?(victory|win|success)/gi,
    },
    {
      name: 'Love interest rescue',
      pattern: /(love|beloved|crush).*?(danger|threat|attack).*?(saved|rescued|protected)/gi,
    },
    {
      name: 'Vengeance motivation',
      pattern: /(revenge|vengeance|avenge).*?(killed|murdered|destroyed).*?(family|friend|loved one)/gi,
    },
    {
      name: 'Training breakthrough',
      pattern: /(training|practice).*?(breakthrough|realization|understanding).*?(power|strength|level)/gi,
    },
  ];

  standardTropePatterns.forEach(({ name, pattern }) => {
    if (pattern.test(content)) {
      standardTropes.push(name);
    }
  });

  // Unique beats: unexpected emotional moments
  const uniqueBeatPatterns = [
    /(unexpected|surprising|unforeseen).*?(emotion|feeling|reaction)/gi,
    /(contrary|opposite|unlike).*?(expected|usual|normal)/gi,
    /(complex|nuanced|layered).*?(emotion|feeling|response)/gi,
  ];

  uniqueBeatPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      uniqueBeats.push(`Unexpected emotional complexity: ${matches.length} instances`);
    }
  });

  // Check for emotional contradictions (more interesting)
  if (content.match(/(but|however|yet|still).*?(felt|emotion|feeling)/gi)) {
    uniqueBeats.push('Emotional contradictions present');
  }

  // Score: penalize standard tropes, reward unique beats
  let score = 100;
  score -= standardTropes.length * 20; // Each standard trope = -20
  score += uniqueBeats.length * 15; // Each unique beat = +15

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    standardTropesDetected: standardTropes,
    uniqueBeats,
  };
}

/**
 * Detects generic prose patterns
 */
function detectGenericPatterns(content: string): string[] {
  const patterns: string[] = [];

  // Generic sentence structures
  const genericStructures = [
    /(it was|there was|there were|it is|there is|there are)/gi,
    /(he was|she was|they were|he is|she is|they are)/gi,
    /(he had|she had|they had|he has|she has|they have)/gi,
  ];

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const genericCount = sentences.filter(sentence => {
    return genericStructures.some(pattern => pattern.test(sentence));
  }).length;

  const genericRatio = sentences.length > 0 ? genericCount / sentences.length : 0;
  if (genericRatio > 0.3) {
    patterns.push(`High generic sentence structures: ${Math.round(genericRatio * 100)}%`);
  }

  // Generic adjectives
  const genericAdjectives = ['beautiful', 'nice', 'good', 'bad', 'big', 'small', 'very', 'really'];
  const adjectiveCount = genericAdjectives.reduce((count, adj) => {
    const regex = new RegExp(`\\b${adj}\\w*`, 'gi');
    return count + (content.match(regex) || []).length;
  }, 0);

  const wordCount = content.split(/\s+/).length;
  const adjectiveDensity = wordCount > 0 ? (adjectiveCount / wordCount) * 1000 : 0;
  if (adjectiveDensity > 10) {
    patterns.push(`High generic adjective density: ${Math.round(adjectiveDensity)} per 1000 words`);
  }

  return patterns;
}

/**
 * Detects mechanical structures
 */
function detectMechanicalStructures(content: string): string[] {
  const structures: string[] = [];

  // Check for repetitive sentence patterns
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length > 10) {
    const firstWords = sentences.slice(0, 20).map(s => {
      const words = s.trim().split(/\s+/);
      return words[0]?.toLowerCase() || '';
    });

    const wordFreq: Record<string, number> = {};
    firstWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const repeated = Object.entries(wordFreq)
      .filter(([_, count]) => count >= 4)
      .map(([word]) => word);

    if (repeated.length > 0) {
      structures.push(`Repetitive sentence beginnings: ${repeated.join(', ')}`);
    }
  }

  // Check for uniform paragraph lengths
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length > 5) {
    const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
    const avgLength = paragraphLengths.reduce((sum, len) => sum + len, 0) / paragraphLengths.length;
    const variance = paragraphLengths.reduce((sum, len) => {
      const diff = len - avgLength;
      return sum + (diff * diff);
    }, 0) / paragraphLengths.length;

    if (variance < 100) { // Low variance = uniform lengths
      structures.push('Uniform paragraph lengths detected');
    }
  }

  return structures;
}

/**
 * Detects derivative content
 */
function detectDerivativeContent(content: string, state: NovelState): string[] {
  const flags: string[] = [];
  const contentLower = content.toLowerCase();

  // Common derivative phrases from training data
  const derivativePhrases = [
    'in a world where',
    'little did they know',
    'it was then that',
    'as fate would have it',
    'the moment of truth',
    'time seemed to stand still',
    'his heart pounded like a drum',
    'her eyes burned with',
    'a chill ran down his spine',
  ];

  derivativePhrases.forEach(phrase => {
    if (contentLower.includes(phrase)) {
      flags.push(`Derivative phrase detected: "${phrase}"`);
    }
  });

  // Check for overused genre-specific phrases
  const genrePhrases = [
    'cultivation breakthrough',
    'spiritual energy surged',
    'realm of cultivation',
    'ancient technique',
    'hidden realm',
  ];

  const genreMatches = genrePhrases.filter(phrase => contentLower.includes(phrase));
  if (genreMatches.length > 3) {
    flags.push(`Multiple overused genre phrases: ${genreMatches.length} instances`);
  }

  return flags;
}
