import { NovelState, ComparativeAnalysis } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeStoryStructure, StoryStructureAnalysis } from './storyStructureAnalyzer';
import { analyzeHeroJourney } from './heroJourneyTracker';
import { analyzeSaveTheCat } from './beatSheetAnalyzer';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';

/**
 * Comparative Analyzer
 * Compares novel against masterworks and successful novels in the genre
 */

export interface ComparativeAnalysisResult {
  comparisons: ComparativeAnalysis[];
  structureComparison: {
    benchmarkNovel: string;
    similarityScore: number;
    strengths: string[];
    weaknesses: string[];
  };
  pacingComparison: {
    benchmarkNovel: string;
    similarityScore: number;
    strengths: string[];
    weaknesses: string[];
  };
  thematicComparison: {
    benchmarkNovel: string;
    similarityScore: number;
    strengths: string[];
    weaknesses: string[];
  };
  overallComparison: {
    benchmarkNovel: string;
    similarityScore: number;
    overallAssessment: string;
  };
  recommendations: string[];
}

/**
 * Masterworks reference data for Xianxia/Xuanhuan genre
 */
const MASTERWORKS_REFERENCE: Record<string, {
  structure: { avgChapterLength: number; totalChapters: number; threeActStructure: number[] };
  pacing: { avgWordsPerChapter: number; pacingPattern: string };
  themes: string[];
  characteristics: string[];
}> = {
  'Coiling Dragon': {
    structure: { avgChapterLength: 2500, totalChapters: 800, threeActStructure: [25, 50, 25] },
    pacing: { avgWordsPerChapter: 2500, pacingPattern: 'fast' },
    themes: ['Power and Growth', 'Revenge and Justice', 'Friendship'],
    characteristics: ['Reincarnation', 'Training arcs', 'Power progression', 'World exploration']
  },
  'I Shall Seal the Heavens': {
    structure: { avgChapterLength: 3000, totalChapters: 1614, threeActStructure: [20, 60, 20] },
    pacing: { avgWordsPerChapter: 3000, pacingPattern: 'medium' },
    themes: ['Pursuit of Power', 'Identity and Purpose', 'Sacrifice'],
    characteristics: ['Alchemy focus', 'Realm progression', 'Philosophical depth']
  },
  'Against the Gods': {
    structure: { avgChapterLength: 2800, totalChapters: 1958, threeActStructure: [30, 50, 20] },
    pacing: { avgWordsPerChapter: 2800, pacingPattern: 'fast' },
    themes: ['Revenge', 'Power', 'Relationships'],
    characteristics: ['Anti-hero', 'Revenge story', 'Character relationships']
  },
  'Desolate Era': {
    structure: { avgChapterLength: 2700, totalChapters: 1451, threeActStructure: [25, 55, 20] },
    pacing: { avgWordsPerChapter: 2700, pacingPattern: 'medium' },
    themes: ['Growth and Transformation', 'Duty and Sacrifice', 'Eternal Dao'],
    characteristics: ['Dao comprehension', 'Slow burn', 'Philosophical exploration']
  }
};

/**
 * Analyzes novel against masterworks
 */
export function analyzeComparative(state: NovelState): ComparativeAnalysisResult {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      comparisons: [],
      structureComparison: {
        benchmarkNovel: '',
        similarityScore: 0,
        strengths: [],
        weaknesses: [],
      },
      pacingComparison: {
        benchmarkNovel: '',
        similarityScore: 0,
        strengths: [],
        weaknesses: [],
      },
      thematicComparison: {
        benchmarkNovel: '',
        similarityScore: 0,
        strengths: [],
        weaknesses: [],
      },
      overallComparison: {
        benchmarkNovel: '',
        similarityScore: 0,
        overallAssessment: '',
      },
      recommendations: ['No chapters available for comparative analysis'],
    };
  }

  // Perform internal analyses
  const structureAnalysis = analyzeStoryStructure(state);
  const heroJourney = analyzeHeroJourney(state);
  const saveTheCat = analyzeSaveTheCat(state);
  const proseQuality = analyzeProseQuality(state);
  const engagement = analyzeEngagement(state);
  const themes = analyzeThemeEvolution(state);

  // Compare against masterworks
  const structureComparison = compareStructure(structureAnalysis, chapters);
  const pacingComparison = comparePacing(chapters, proseQuality, engagement);
  const thematicComparison = compareThemes(themes, state);
  const overallComparison = compareOverall(
    structureComparison,
    pacingComparison,
    thematicComparison,
    chapters,
    state
  );

  // Build comparison records
  const comparisons: ComparativeAnalysis[] = [
    {
      id: generateUUID(),
      novelId: state.id,
      comparisonType: 'structure',
      benchmarkNovelName: structureComparison.benchmarkNovel,
      similarityScore: structureComparison.similarityScore,
      strengthAreas: structureComparison.strengths,
      improvementAreas: structureComparison.weaknesses,
      detailedComparison: {
        threeActStructure: structureAnalysis.threeActStructure,
        heroJourney: heroJourney,
        beatSheet: saveTheCat,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: generateUUID(),
      novelId: state.id,
      comparisonType: 'pacing',
      benchmarkNovelName: pacingComparison.benchmarkNovel,
      similarityScore: pacingComparison.similarityScore,
      strengthAreas: pacingComparison.strengths,
      improvementAreas: pacingComparison.weaknesses,
      detailedComparison: {
        proseQuality: proseQuality,
        engagement: engagement,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: generateUUID(),
      novelId: state.id,
      comparisonType: 'themes',
      benchmarkNovelName: thematicComparison.benchmarkNovel,
      similarityScore: thematicComparison.similarityScore,
      strengthAreas: thematicComparison.strengths,
      improvementAreas: thematicComparison.weaknesses,
      detailedComparison: {
        themeAnalysis: themes,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: generateUUID(),
      novelId: state.id,
      comparisonType: 'overall',
      benchmarkNovelName: overallComparison.benchmarkNovel,
      similarityScore: overallComparison.similarityScore,
      strengthAreas: [],
      improvementAreas: [],
      detailedComparison: {
        overall: overallComparison.overallAssessment,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  // Generate recommendations
  const recommendations = generateComparativeRecommendations(
    structureComparison,
    pacingComparison,
    thematicComparison,
    overallComparison
  );

  return {
    comparisons,
    structureComparison,
    pacingComparison,
    thematicComparison,
    overallComparison,
    recommendations,
  };
}

/**
 * Compares structure against masterworks
 */
function compareStructure(
  structureAnalysis: StoryStructureAnalysis,
  chapters: Chapter[]
): ComparativeAnalysisResult['structureComparison'] {
  // Find best matching masterwork
  let bestMatch = '';
  let bestSimilarity = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  Object.entries(MASTERWORKS_REFERENCE).forEach(([novelName, benchmark]) => {
    let similarity = 0;

    // Compare chapter count (relative to genre expectations)
    const chapterCount = chapters.length;
    const benchmarkChapters = benchmark.structure.totalChapters;
    
    // Similarity based on chapter count (within reasonable range)
    if (chapterCount > 0) {
      const chapterRatio = Math.min(chapterCount / benchmarkChapters, benchmarkChapters / chapterCount);
      similarity += chapterRatio * 30; // 30% weight on chapter count
    }

    // Compare three-act structure
    const threeAct = structureAnalysis.threeActStructure;
    const act1Deviation = Math.abs(threeAct.act1.percentage - benchmark.structure.threeActStructure[0]);
    const act2Deviation = Math.abs(threeAct.act2.percentage - benchmark.structure.threeActStructure[1]);
    const act3Deviation = Math.abs(threeAct.act3.percentage - benchmark.structure.threeActStructure[2]);

    const avgDeviation = (act1Deviation + act2Deviation + act3Deviation) / 3;
    const structureSimilarity = Math.max(0, 100 - avgDeviation * 2);
    similarity += (structureSimilarity / 100) * 40; // 40% weight on structure

    // Compare story beats (detected beats vs expected)
    const detectedBeats = structureAnalysis.detectedBeats.length;
    const expectedBeats = 6; // Inciting incident, plot points, midpoint, climax, resolution
    const beatRatio = detectedBeats >= expectedBeats ? 100 : (detectedBeats / expectedBeats) * 100;
    similarity += (beatRatio / 100) * 30; // 30% weight on beats

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = novelName;
    }
  });

  // Identify strengths
  if (structureAnalysis.overallStructureScore >= 75) {
    strengths.push('Strong overall structure');
  }
  
  const threeAct = structureAnalysis.threeActStructure;
  if (Math.abs(threeAct.act1.percentage - 25) < 5) {
    strengths.push('Well-proportioned Act 1');
  }
  if (Math.abs(threeAct.act2.percentage - 50) < 5) {
    strengths.push('Well-proportioned Act 2');
  }
  if (structureAnalysis.detectedBeats.length >= 5) {
    strengths.push('Key story beats detected');
  }

  // Identify weaknesses
  if (structureAnalysis.overallStructureScore < 60) {
    weaknesses.push('Structure score below 60 - review act proportions');
  }
  if (structureAnalysis.detectedBeats.length < 4) {
    weaknesses.push('Missing key story beats');
  }
  if (Math.abs(threeAct.act2.percentage - 50) > 10) {
    weaknesses.push(`Act 2 proportion (${threeAct.act2.percentage.toFixed(1)}%) deviates from ideal (50%)`);
  }

  return {
    benchmarkNovel: bestMatch || 'Standard Xianxia/Xuanhuan',
    similarityScore: Math.round(bestSimilarity),
    strengths,
    weaknesses,
  };
}

/**
 * Compares pacing against masterworks
 */
function comparePacing(
  chapters: Chapter[],
  proseQuality: ReturnType<typeof analyzeProseQuality>,
  engagement: ReturnType<typeof analyzeEngagement>
): ComparativeAnalysisResult['pacingComparison'] {
  // Find best matching masterwork
  let bestMatch = '';
  let bestSimilarity = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const avgWordsPerChapter = chapters.length > 0
    ? chapters.reduce((sum, ch) => sum + (ch.content.split(/\s+/).length || 0), 0) / chapters.length
    : 0;

  Object.entries(MASTERWORKS_REFERENCE).forEach(([novelName, benchmark]) => {
    let similarity = 0;

    // Compare average words per chapter
    const wordDiff = Math.abs(avgWordsPerChapter - benchmark.pacing.avgWordsPerChapter);
    const wordSimilarity = Math.max(0, 100 - (wordDiff / benchmark.pacing.avgWordsPerChapter) * 100);
    similarity += wordSimilarity * 0.4; // 40% weight

    // Compare pacing pattern
    const prosePacing = proseQuality.proseQualities.length > 0
      ? analyzePacingPattern(chapters, proseQuality)
      : 'medium';

    if (prosePacing === benchmark.pacing.pacingPattern) {
      similarity += 30; // 30% weight on pacing pattern match
    } else {
      similarity += 15; // Partial match
    }

    // Compare engagement (higher engagement = better pacing)
    const avgEngagement = engagement.metrics.length > 0
      ? engagement.metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / engagement.metrics.length
      : 50;

    similarity += (avgEngagement / 100) * 30; // 30% weight on engagement

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = novelName;
    }
  });

  // Identify strengths
  const avgEngagement = engagement.metrics.length > 0
    ? engagement.metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / engagement.metrics.length
    : 0;

  if (avgEngagement >= 75) {
    strengths.push('High reader engagement (good pacing)');
  }
  if (avgWordsPerChapter >= 2000 && avgWordsPerChapter <= 3500) {
    strengths.push('Optimal chapter length for genre');
  }
  if (engagement.fatigueChapters.length === 0) {
    strengths.push('No fatigue chapters detected');
  }

  // Identify weaknesses
  if (avgEngagement < 60) {
    weaknesses.push(`Low engagement (${avgEngagement.toFixed(0)}/100) - improve pacing`);
  }
  if (engagement.fatigueChapters.length > chapters.length * 0.2) {
    weaknesses.push(`Too many fatigue chapters (${engagement.fatigueChapters.length})`);
  }
  if (avgWordsPerChapter < 1500) {
    weaknesses.push(`Chapters too short (${Math.round(avgWordsPerChapter)} words) - consider expanding`);
  } else if (avgWordsPerChapter > 4000) {
    weaknesses.push(`Chapters too long (${Math.round(avgWordsPerChapter)} words) - consider breaking up`);
  }

  return {
    benchmarkNovel: bestMatch || 'Standard Xianxia/Xuanhuan',
    similarityScore: Math.round(bestSimilarity),
    strengths,
    weaknesses,
  };
}

/**
 * Compares themes against masterworks
 */
function compareThemes(
  themeAnalysis: ReturnType<typeof analyzeThemeEvolution>,
  state: NovelState
): ComparativeAnalysisResult['thematicComparison'] {
  // Find best matching masterwork
  let bestMatch = '';
  let bestSimilarity = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const novelThemes = themeAnalysis.themes.map(t => t.themeName.toLowerCase());

  Object.entries(MASTERWORKS_REFERENCE).forEach(([novelName, benchmark]) => {
    let similarity = 0;

    // Compare themes
    const benchmarkThemes = benchmark.themes.map(t => t.toLowerCase());
    const matchingThemes = benchmarkThemes.filter(bt => 
      novelThemes.some(nt => nt.includes(bt) || bt.includes(nt))
    );

    const themeSimilarity = (matchingThemes.length / Math.max(benchmarkThemes.length, novelThemes.length)) * 100;
    similarity += themeSimilarity * 0.5; // 50% weight on theme matching

    // Compare thematic depth
    const avgDepthScore = themeAnalysis.themes.length > 0
      ? themeAnalysis.themes.reduce((sum, t) => {
          const depthScore = t.depthLevel === 'deep' ? 100 : t.depthLevel === 'mid' ? 60 : 30;
          return sum + depthScore;
        }, 0) / themeAnalysis.themes.length
      : 50;

    similarity += (avgDepthScore / 100) * 0.3; // 30% weight on depth

    // Compare consistency
    similarity += (themeAnalysis.overallConsistencyScore / 100) * 0.2; // 20% weight on consistency

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = novelName;
    }
  });

  // Identify strengths
  if (themeAnalysis.overallConsistencyScore >= 75) {
    strengths.push('Strong theme consistency');
  }
  if (themeAnalysis.philosophicalDepthScore >= 70) {
    strengths.push('Deep thematic exploration');
  }
  if (themeAnalysis.primaryThemes.length > 0) {
    strengths.push(`Clear primary themes: ${themeAnalysis.primaryThemes.map(t => t.themeName).join(', ')}`);
  }

  // Identify weaknesses
  if (themeAnalysis.primaryThemes.length === 0) {
    weaknesses.push('No primary themes detected');
  }
  if (themeAnalysis.overallConsistencyScore < 60) {
    weaknesses.push(`Low theme consistency (${themeAnalysis.overallConsistencyScore}/100)`);
  }
  if (themeAnalysis.philosophicalDepthScore < 50) {
    weaknesses.push(`Shallow thematic exploration (${themeAnalysis.philosophicalDepthScore}/100)`);
  }

  return {
    benchmarkNovel: bestMatch || 'Standard Xianxia/Xuanhuan',
    similarityScore: Math.round(bestSimilarity),
    strengths,
    weaknesses,
  };
}

/**
 * Compares overall against masterworks
 */
function compareOverall(
  structureComparison: ComparativeAnalysisResult['structureComparison'],
  pacingComparison: ComparativeAnalysisResult['pacingComparison'],
  thematicComparison: ComparativeAnalysisResult['thematicComparison'],
  chapters: Chapter[],
  state: NovelState
): ComparativeAnalysisResult['overallComparison'] {
  // Weighted average of all comparisons
  const overallSimilarity = (
    structureComparison.similarityScore * 0.35 +
    pacingComparison.similarityScore * 0.35 +
    thematicComparison.similarityScore * 0.3
  );

  // Determine best matching novel
  const comparisons = [structureComparison, pacingComparison, thematicComparison];
  const novelCounts = new Map<string, number>();
  
  comparisons.forEach(comp => {
    if (comp.benchmarkNovel) {
      novelCounts.set(comp.benchmarkNovel, (novelCounts.get(comp.benchmarkNovel) || 0) + 1);
    }
  });

  let bestNovel = '';
  let maxCount = 0;
  novelCounts.forEach((count, novel) => {
    if (count > maxCount) {
      maxCount = count;
      bestNovel = novel;
    }
  });

  if (!bestNovel) {
    bestNovel = structureComparison.benchmarkNovel || 'Standard Xianxia/Xuanhuan';
  }

  // Generate overall assessment
  let assessment = '';
  if (overallSimilarity >= 80) {
    assessment = `Strong similarity to ${bestNovel}. The novel follows proven structural patterns well while maintaining originality.`;
  } else if (overallSimilarity >= 60) {
    assessment = `Moderate similarity to ${bestNovel}. The novel shares some characteristics with masterworks but has unique elements.`;
  } else {
    assessment = `Lower similarity to traditional masterworks. The novel has a unique approach but may benefit from incorporating proven structural elements.`;
  }

  // Add specific notes
  const allStrengths = [
    ...structureComparison.strengths,
    ...pacingComparison.strengths,
    ...thematicComparison.strengths,
  ];

  const allWeaknesses = [
    ...structureComparison.weaknesses,
    ...pacingComparison.weaknesses,
    ...thematicComparison.weaknesses,
  ];

  if (allStrengths.length > 0) {
    assessment += ` Strengths: ${allStrengths.slice(0, 3).join(', ')}.`;
  }

  if (allWeaknesses.length > 0) {
    assessment += ` Areas for improvement: ${allWeaknesses.slice(0, 3).join(', ')}.`;
  }

  return {
    benchmarkNovel: bestNovel,
    similarityScore: Math.round(overallSimilarity),
    overallAssessment: assessment,
  };
}

/**
 * Analyzes pacing pattern
 */
function analyzePacingPattern(
  chapters: Chapter[],
  proseQuality: ReturnType<typeof analyzeProseQuality>
): 'fast' | 'medium' | 'slow' {
  const avgWordsPerChapter = chapters.length > 0
    ? chapters.reduce((sum, ch) => sum + (ch.content.split(/\s+/).length || 0), 0) / chapters.length
    : 0;

  if (avgWordsPerChapter < 2000) return 'fast';
  if (avgWordsPerChapter > 3500) return 'slow';
  return 'medium';
}

/**
 * Generates comparative recommendations
 */
function generateComparativeRecommendations(
  structureComparison: ComparativeAnalysisResult['structureComparison'],
  pacingComparison: ComparativeAnalysisResult['pacingComparison'],
  thematicComparison: ComparativeAnalysisResult['thematicComparison'],
  overallComparison: ComparativeAnalysisResult['overallComparison']
): string[] {
  const recommendations: string[] = [];

  if (overallComparison.similarityScore < 60) {
    recommendations.push(`Overall similarity to masterworks is ${overallComparison.similarityScore}/100. Consider studying successful novels in your genre.`);
  }

  // Structure recommendations
  if (structureComparison.similarityScore < 60) {
    recommendations.push(`Structure similarity is ${structureComparison.similarityScore}/100. ${structureComparison.benchmarkNovel} achieved ${structureComparison.similarityScore + 40}+ similarity. Study their structural approach.`);
  }

  // Pacing recommendations
  if (pacingComparison.similarityScore < 60) {
    recommendations.push(`Pacing similarity is ${pacingComparison.similarityScore}/100. Consider adjusting pacing to match genre standards.`);
  }

  // Thematic recommendations
  if (thematicComparison.similarityScore < 60) {
    recommendations.push(`Thematic similarity is ${thematicComparison.similarityScore}/100. Consider exploring themes common to successful works in your genre.`);
  }

  // Positive feedback
  if (overallComparison.similarityScore >= 75) {
    recommendations.push(`Excellent similarity to masterworks (${overallComparison.similarityScore}/100)! Your novel follows proven patterns while maintaining originality.`);
  }

  // Specific improvement areas
  if (structureComparison.weaknesses.length > 0) {
    recommendations.push(`Structure improvements: ${structureComparison.weaknesses.slice(0, 2).join(', ')}.`);
  }

  if (pacingComparison.weaknesses.length > 0) {
    recommendations.push(`Pacing improvements: ${pacingComparison.weaknesses.slice(0, 2).join(', ')}.`);
  }

  return recommendations;
}
