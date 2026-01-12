import { NovelState, Chapter, ThemeEvolution, Arc } from '../types';
import { analyzeThemesAndMotifs, getArcChapters } from './promptEngine/arcContextAnalyzer';
import { generateUUID } from '../utils/uuid';

/**
 * Enhanced Theme Analyzer
 * Extends the existing theme analysis with evolution tracking,
 * theme consistency scoring, and philosophical depth analysis
 */

export interface ThemeAnalysis {
  themes: ThemeEvolution[];
  primaryThemes: ThemeEvolution[];
  secondaryThemes: ThemeEvolution[];
  tertiaryThemes: ThemeEvolution[];
  overallConsistencyScore: number; // 0-100
  philosophicalDepthScore: number; // 0-100
  recommendations: string[];
}

/**
 * Analyzes themes with enhanced tracking and evolution
 */
export function analyzeThemeEvolution(state: NovelState): ThemeAnalysis {
  // Get base theme analysis from existing function
  const baseAnalysis = analyzeThemesAndMotifs(state);

  // Check for existing theme evolutions
  let themes: ThemeEvolution[] = [];
  if (state.themeEvolutions && state.themeEvolutions.length > 0) {
    themes = [...state.themeEvolutions];
  } else {
    // Build theme evolutions from base analysis
    themes = buildThemeEvolutions(state, baseAnalysis);
  }

  // Categorize themes
  const primaryThemes = themes.filter(t => t.themeType === 'primary');
  const secondaryThemes = themes.filter(t => t.themeType === 'secondary');
  const tertiaryThemes = themes.filter(t => t.themeType === 'tertiary');

  // Calculate scores
  const overallConsistencyScore = calculateThemeConsistency(themes, state);
  const philosophicalDepthScore = calculatePhilosophicalDepth(themes, state);

  // Generate recommendations
  const recommendations = generateThemeRecommendations(
    themes,
    overallConsistencyScore,
    philosophicalDepthScore,
    state
  );

  return {
    themes,
    primaryThemes,
    secondaryThemes,
    tertiaryThemes,
    overallConsistencyScore,
    philosophicalDepthScore,
    recommendations,
  };
}

/**
 * Builds theme evolution objects from base analysis
 */
function buildThemeEvolutions(
  state: NovelState,
  baseAnalysis: ReturnType<typeof analyzeThemesAndMotifs>
): ThemeEvolution[] {
  const evolutions: ThemeEvolution[] = [];
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const totalChapters = chapters.length;

  // Process recurring themes
  baseAnalysis.recurringThemes.forEach((baseTheme, index) => {
    // Determine theme type based on frequency and position
    let themeType: 'primary' | 'secondary' | 'tertiary' = 'tertiary';
    if (index === 0 || baseTheme.frequency >= state.plotLedger.length * 0.6) {
      themeType = 'primary';
    } else if (index < 3 || baseTheme.frequency >= state.plotLedger.length * 0.3) {
      themeType = 'secondary';
    }

    // Find first appearance
    const firstAppearedChapter = findThemeFirstAppearance(chapters, baseTheme.theme, state);

    // Find setup chapter (where theme is introduced)
    const setupChapter = findThemeSetup(chapters, baseTheme.theme, state);

    // Find resolution chapter (if theme is resolved)
    const resolutionChapter = findThemeResolution(chapters, baseTheme.theme, state);

    // Calculate frequency per chapter
    const frequencyPerChapter = calculateThemeFrequency(chapters, baseTheme.theme, state);

    // Calculate consistency score
    const consistencyScore = calculateThemeConsistencyForTheme(
      baseTheme.theme,
      baseTheme.arcs,
      state
    );

    // Determine depth level
    const depthLevel = determineThemeDepth(chapters, baseTheme.theme, state);

    // Find character connections
    const characterConnections = findCharacterConnections(baseTheme.theme, state);

    // Extract philosophical questions
    const philosophicalQuestions = extractPhilosophicalQuestions(chapters, baseTheme.theme);

    // Build evolution notes
    const evolutionNotes = buildEvolutionNotes(chapters, baseTheme.theme, state);

    evolutions.push({
      id: generateUUID(),
      novelId: state.id,
      themeName: baseTheme.theme,
      themeType,
      firstAppearedChapter,
      setupChapter,
      resolutionChapter,
      arcsInvolved: baseTheme.arcs,
      frequencyPerChapter,
      consistencyScore,
      depthLevel,
      characterConnections,
      philosophicalQuestions,
      evolutionNotes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return evolutions;
}

/**
 * Finds the first chapter where a theme appears
 */
function findThemeFirstAppearance(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): number | undefined {
  const themeKeywords = getThemeKeywords(theme);

  for (const chapter of chapters) {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));

    if (hasTheme) {
      return chapter.number;
    }
  }

  return undefined;
}

/**
 * Finds the chapter where a theme is set up
 */
function findThemeSetup(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): number | undefined {
  const themeKeywords = getThemeKeywords(theme);

  // Setup usually happens in early chapters or when theme is first mentioned significantly
  const earlyChapters = chapters.slice(0, Math.min(10, chapters.length));

  for (const chapter of earlyChapters) {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));

    if (hasTheme && chapter.content.length > 500) {
      // Substantial content suggests setup, not just mention
      return chapter.number;
    }
  }

  return findThemeFirstAppearance(chapters, theme, state);
}

/**
 * Finds the chapter where a theme is resolved
 */
function findThemeResolution(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): number | undefined {
  const themeKeywords = getThemeKeywords(theme);
  const resolutionIndicators = ['resolve', 'conclude', 'answer', 'understand', 'realize'];

  // Check late chapters for resolution
  const lateChapters = chapters.slice(Math.max(0, chapters.length - 10));

  for (const chapter of lateChapters.reverse()) {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));
    const hasResolution = resolutionIndicators.some(indicator => content.includes(indicator));

    if (hasTheme && hasResolution) {
      return chapter.number;
    }
  }

  return undefined;
}

/**
 * Calculates how often a theme appears per chapter
 */
function calculateThemeFrequency(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): number {
  const themeKeywords = getThemeKeywords(theme);
  let appearances = 0;

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));

    if (hasTheme) {
      appearances++;
    }
  });

  return chapters.length > 0 ? appearances / chapters.length : 0;
}

/**
 * Calculates consistency score for a single theme (0-100)
 */
function calculateThemeConsistencyForTheme(
  theme: string,
  arcsInvolved: string[],
  state: NovelState
): number {
  const totalArcs = state.plotLedger.length;
  if (totalArcs === 0) return 0;

  // Consistency based on how many arcs include the theme
  const arcCoverage = (arcsInvolved.length / totalArcs) * 100;

  // Boost score if theme appears in multiple arcs consistently
  let consistencyBonus = 0;
  if (arcsInvolved.length >= totalArcs * 0.5) {
    consistencyBonus = 20;
  } else if (arcsInvolved.length >= totalArcs * 0.3) {
    consistencyBonus = 10;
  }

  return Math.min(100, Math.round(arcCoverage + consistencyBonus));
}

/**
 * Calculates overall theme consistency score (0-100)
 */
function calculateThemeConsistency(themes: ThemeEvolution[], state: NovelState): number {
  if (themes.length === 0) return 0;

  const averageConsistency = themes.reduce((sum, theme) => sum + theme.consistencyScore, 0) / themes.length;

  // Bonus for having primary themes
  const hasPrimaryTheme = themes.some(t => t.themeType === 'primary');
  const bonus = hasPrimaryTheme ? 10 : 0;

  return Math.min(100, Math.round(averageConsistency + bonus));
}

/**
 * Determines theme depth level
 */
function determineThemeDepth(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): 'surface' | 'mid' | 'deep' {
  const themeKeywords = getThemeKeywords(theme);
  let deepIndicators = 0;

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));

    if (hasTheme) {
      // Check for depth indicators
      const depthMarkers = [
        'why', 'meaning', 'purpose', 'truth', 'philosophy',
        'question', 'understand', 'realize', 'believe'
      ];

      depthMarkers.forEach(marker => {
        if (content.includes(marker)) {
          deepIndicators++;
        }
      });
    }
  });

  // Count chapters with theme
  const themeChapters = chapters.filter(ch => {
    const content = (ch.content + ' ' + ch.summary).toLowerCase();
    return themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));
  }).length;

  const depthRatio = deepIndicators / Math.max(1, themeChapters);

  if (depthRatio >= 2) return 'deep';
  if (depthRatio >= 1) return 'mid';
  return 'surface';
}

/**
 * Finds characters connected to a theme
 */
function findCharacterConnections(theme: string, state: NovelState): string[] {
  const characterIds: string[] = [];
  const themeKeywords = getThemeKeywords(theme);

  state.characterCodex.forEach(character => {
    const characterContent = (
      character.personality + ' ' + character.notes
    ).toLowerCase();

    const hasTheme = themeKeywords.some(keyword => characterContent.includes(keyword.toLowerCase()));

    if (hasTheme) {
      characterIds.push(character.id);
    }
  });

  return characterIds;
}

/**
 * Extracts philosophical questions raised by a theme
 */
function extractPhilosophicalQuestions(chapters: Chapter[], theme: string): string[] {
  const questions: string[] = [];
  const themeKeywords = getThemeKeywords(theme);
  const questionPatterns = [
    /\bwhy\b.*\?/gi,
    /\bwhat\b.*\?/gi,
    /\bhow\b.*\?/gi,
    /\bwhat if\b.*\?/gi,
  ];

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary);
    const hasTheme = themeKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));

    if (hasTheme) {
      questionPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          questions.push(...matches.slice(0, 2)); // Limit to 2 per chapter
        }
      });
    }
  });

  // Deduplicate and limit
  return [...new Set(questions)].slice(0, 10);
}

/**
 * Builds evolution notes for a theme
 */
function buildEvolutionNotes(
  chapters: Chapter[],
  theme: string,
  state: NovelState
): Array<{ chapter: number; note: string }> {
  const notes: Array<{ chapter: number; note: string }> = [];
  const themeKeywords = getThemeKeywords(theme);

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    const hasTheme = themeKeywords.some(keyword => content.includes(keyword.toLowerCase()));

    if (hasTheme && chapter.content.length > 300) {
      // Extract a brief note about how theme appears
      const summary = chapter.summary || chapter.content.substring(0, 100) + '...';
      notes.push({
        chapter: chapter.number,
        note: summary,
      });
    }
  });

  return notes.slice(0, 20); // Limit to 20 notes
}

/**
 * Calculates philosophical depth score (0-100)
 */
function calculatePhilosophicalDepth(themes: ThemeEvolution[], state: NovelState): number {
  if (themes.length === 0) return 0;

  let depthScore = 0;

  themes.forEach(theme => {
    // Score based on depth level
    switch (theme.depthLevel) {
      case 'deep':
        depthScore += 100;
        break;
      case 'mid':
        depthScore += 60;
        break;
      case 'surface':
        depthScore += 30;
        break;
    }

    // Bonus for philosophical questions
    if (theme.philosophicalQuestions.length > 0) {
      depthScore += Math.min(20, theme.philosophicalQuestions.length * 2);
    }
  });

  // Average and normalize
  const averageScore = depthScore / themes.length;
  return Math.min(100, Math.round(averageScore));
}

/**
 * Generates theme recommendations
 */
function generateThemeRecommendations(
  themes: ThemeEvolution[],
  consistencyScore: number,
  depthScore: number,
  state: NovelState
): string[] {
  const recommendations: string[] = [];

  // Primary theme recommendations
  const primaryThemes = themes.filter(t => t.themeType === 'primary');
  if (primaryThemes.length === 0) {
    recommendations.push('No primary theme detected. Consider establishing 1-2 primary themes for stronger narrative focus.');
  } else if (primaryThemes.length > 2) {
    recommendations.push('Multiple primary themes detected. Consider focusing on 1-2 core themes for better cohesion.');
  }

  // Consistency recommendations
  if (consistencyScore < 60) {
    recommendations.push(`Theme consistency score is ${consistencyScore}/100. Consider weaving themes more consistently throughout arcs.`);
  }

  // Depth recommendations
  if (depthScore < 50) {
    recommendations.push(`Philosophical depth score is ${depthScore}/100. Consider exploring themes more deeply with questions and meaning.`);
  }

  // Setup-payoff recommendations
  themes.forEach(theme => {
    if (theme.setupChapter && !theme.resolutionChapter && state.chapters.length > 10) {
      recommendations.push(`Theme "${theme.themeName}" was set up but not yet resolved. Consider adding a payoff.`);
    }
  });

  // Positive feedback
  if (consistencyScore >= 80 && depthScore >= 70) {
    recommendations.push('Excellent theme development! Themes are consistent and deeply explored.');
  }

  return recommendations;
}

/**
 * Gets theme keywords for detection
 */
function getThemeKeywords(theme: string): string[] {
  // Common theme keyword mappings
  const themeKeywordMap: Record<string, string[]> = {
    'Power and Corruption': ['power', 'corruption', 'authority', 'tyranny', 'dominance'],
    'Revenge and Justice': ['revenge', 'vengeance', 'justice', 'retribution', 'punishment'],
    'Identity and Self-Discovery': ['identity', 'self', 'who am i', 'discovery', 'purpose'],
    'Sacrifice and Duty': ['sacrifice', 'duty', 'responsibility', 'obligation', 'honor'],
    'Friendship and Betrayal': ['friendship', 'betrayal', 'trust', 'loyalty', 'ally'],
    'Growth and Transformation': ['growth', 'transform', 'evolve', 'change', 'become'],
    'Fate vs Free Will': ['fate', 'destiny', 'free will', 'choice', 'predetermined'],
    'Good vs Evil': ['good', 'evil', 'morality', 'right', 'wrong', 'virtue'],
  };

  return themeKeywordMap[theme] || theme.toLowerCase().split(' ');
}
