import { NovelState, ThemeEvolution } from '../types';

/**
 * Thematic Resonance Service
 * Analyzes how themes interweave, reinforce each other, and create thematic depth
 */

export interface ThematicResonance {
  themePairs: Array<{
    theme1: string;
    theme2: string;
    resonanceScore: number; // 0-100
    connectionType: 'reinforcing' | 'contrasting' | 'complementary' | 'conflicting';
    description: string;
  }>;
  overallResonanceScore: number; // 0-100
  themeLayering: {
    primaryThemes: ThemeEvolution[];
    secondaryThemes: ThemeEvolution[];
    tertiaryThemes: ThemeEvolution[];
    layeringQuality: number; // 0-100
  };
  recommendations: string[];
}

/**
 * Analyzes thematic resonance and interweaving
 */
export function analyzeThematicResonance(state: NovelState): ThematicResonance {
  const themes = state.themeEvolutions || [];

  if (themes.length === 0) {
    return {
      themePairs: [],
      overallResonanceScore: 0,
      themeLayering: {
        primaryThemes: [],
        secondaryThemes: [],
        tertiaryThemes: [],
        layeringQuality: 0,
      },
      recommendations: ['No themes detected. Consider adding thematic depth to your story.'],
    };
  }

  // Analyze theme pairs
  const themePairs = analyzeThemePairs(themes, state);

  // Analyze theme layering
  const themeLayering = analyzeThemeLayering(themes);

  // Calculate overall resonance score
  const overallResonanceScore = calculateOverallResonance(themePairs, themeLayering);

  // Generate recommendations
  const recommendations = generateResonanceRecommendations(
    themePairs,
    themeLayering,
    overallResonanceScore
  );

  return {
    themePairs,
    overallResonanceScore,
    themeLayering,
    recommendations,
  };
}

/**
 * Analyzes pairs of themes for resonance
 */
function analyzeThemePairs(
  themes: ThemeEvolution[],
  state: NovelState
): ThematicResonance['themePairs'] {
  const pairs: ThematicResonance['themePairs'] = [];

  // Compare each theme with every other theme
  for (let i = 0; i < themes.length; i++) {
    for (let j = i + 1; j < themes.length; j++) {
      const theme1 = themes[i];
      const theme2 = themes[j];

      // Calculate resonance score based on shared arcs, chapters, and character connections
      const resonanceScore = calculatePairResonance(theme1, theme2, state);

      // Determine connection type
      const connectionType = determineConnectionType(theme1, theme2);

      // Generate description
      const description = generatePairDescription(theme1, theme2, connectionType);

      pairs.push({
        theme1: theme1.themeName,
        theme2: theme2.themeName,
        resonanceScore,
        connectionType,
        description,
      });
    }
  }

  // Sort by resonance score (highest first)
  pairs.sort((a, b) => b.resonanceScore - a.resonanceScore);

  return pairs;
}

/**
 * Calculates resonance score for a theme pair (0-100)
 */
function calculatePairResonance(
  theme1: ThemeEvolution,
  theme2: ThemeEvolution,
  state: NovelState
): number {
  let score = 0;

  // Shared arcs boost resonance
  const sharedArcs = theme1.arcsInvolved.filter(arc => theme2.arcsInvolved.includes(arc));
  const arcResonance = sharedArcs.length > 0
    ? (sharedArcs.length / Math.max(theme1.arcsInvolved.length, theme2.arcsInvolved.length)) * 40
    : 0;
  score += arcResonance;

  // Shared character connections boost resonance
  const sharedCharacters = theme1.characterConnections.filter(char =>
    theme2.characterConnections.includes(char)
  );
  const characterResonance = sharedCharacters.length > 0
    ? (sharedCharacters.length / Math.max(theme1.characterConnections.length, theme2.characterConnections.length)) * 30
    : 0;
  score += characterResonance;

  // Similar depth level boosts resonance
  if (theme1.depthLevel === theme2.depthLevel) {
    score += 15;
  }

  // Philosophical questions overlap boosts resonance
  const sharedQuestions = theme1.philosophicalQuestions.filter(q =>
    theme2.philosophicalQuestions.includes(q)
  );
  if (sharedQuestions.length > 0) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Determines connection type between themes
 */
function determineConnectionType(
  theme1: ThemeEvolution,
  theme2: ThemeEvolution
): 'reinforcing' | 'contrasting' | 'complementary' | 'conflicting' {
  // Check for contrasting themes (e.g., Good vs Evil, Fate vs Free Will)
  const contrastingPairs = [
    ['good', 'evil'],
    ['fate', 'free will'],
    ['power', 'corruption'],
    ['friendship', 'betrayal'],
  ];

  const theme1Lower = theme1.themeName.toLowerCase();
  const theme2Lower = theme2.themeName.toLowerCase();

  for (const pair of contrastingPairs) {
    if (
      (theme1Lower.includes(pair[0]) && theme2Lower.includes(pair[1])) ||
      (theme1Lower.includes(pair[1]) && theme2Lower.includes(pair[0]))
    ) {
      return 'contrasting';
    }
  }

  // Check for conflicting themes (different values)
  if (theme1Lower.includes('power') && theme2Lower.includes('sacrifice')) {
    return 'conflicting';
  }

  // Check for complementary themes (work together)
  if (
    (theme1Lower.includes('growth') && theme2Lower.includes('identity')) ||
    (theme1Lower.includes('friendship') && theme2Lower.includes('sacrifice'))
  ) {
    return 'complementary';
  }

  // Default to reinforcing (themes that support each other)
  return 'reinforcing';
}

/**
 * Generates description for theme pair
 */
function generatePairDescription(
  theme1: ThemeEvolution,
  theme2: ThemeEvolution,
  connectionType: ThematicResonance['themePairs'][0]['connectionType']
): string {
  switch (connectionType) {
    case 'contrasting':
      return `${theme1.themeName} and ${theme2.themeName} create a powerful contrast, highlighting different values and perspectives.`;
    case 'conflicting':
      return `${theme1.themeName} and ${theme2.themeName} create internal conflict, forcing characters to choose between competing values.`;
    case 'complementary':
      return `${theme1.themeName} and ${theme2.themeName} work together to create richer thematic depth.`;
    case 'reinforcing':
      return `${theme1.themeName} and ${theme2.themeName} reinforce each other, strengthening the overall thematic message.`;
  }
}

/**
 * Analyzes theme layering
 */
function analyzeThemeLayering(themes: ThemeEvolution[]): ThematicResonance['themeLayering'] {
  const primaryThemes = themes.filter(t => t.themeType === 'primary');
  const secondaryThemes = themes.filter(t => t.themeType === 'secondary');
  const tertiaryThemes = themes.filter(t => t.themeType === 'tertiary');

  // Calculate layering quality
  let layeringQuality = 0;

  // Ideal: 1-2 primary, 2-3 secondary, 3-5 tertiary
  if (primaryThemes.length >= 1 && primaryThemes.length <= 2) {
    layeringQuality += 30;
  } else if (primaryThemes.length === 0) {
    layeringQuality += 0;
  } else {
    layeringQuality += 10; // Too many primary themes
  }

  if (secondaryThemes.length >= 2 && secondaryThemes.length <= 3) {
    layeringQuality += 30;
  } else if (secondaryThemes.length === 0 || secondaryThemes.length === 1) {
    layeringQuality += 15;
  } else {
    layeringQuality += 20; // Too many secondary themes
  }

  if (tertiaryThemes.length >= 1 && tertiaryThemes.length <= 5) {
    layeringQuality += 20;
  } else if (tertiaryThemes.length === 0) {
    layeringQuality += 10;
  } else {
    layeringQuality += 15; // Too many tertiary themes
  }

  // Bonus for having all three layers
  if (primaryThemes.length > 0 && secondaryThemes.length > 0) {
    layeringQuality += 20;
  }

  return {
    primaryThemes,
    secondaryThemes,
    tertiaryThemes,
    layeringQuality: Math.min(100, layeringQuality),
  };
}

/**
 * Calculates overall resonance score (0-100)
 */
function calculateOverallResonance(
  themePairs: ThematicResonance['themePairs'],
  themeLayering: ThematicResonance['themeLayering']
): number {
  if (themePairs.length === 0) return 0;

  // Average resonance of top theme pairs
  const topPairs = themePairs.slice(0, 3);
  const averagePairResonance = topPairs.reduce((sum, pair) => sum + pair.resonanceScore, 0) / topPairs.length;

  // Combine with layering quality (60% pairs, 40% layering)
  return Math.round(averagePairResonance * 0.6 + themeLayering.layeringQuality * 0.4);
}

/**
 * Generates resonance recommendations
 */
function generateResonanceRecommendations(
  themePairs: ThematicResonance['themePairs'],
  themeLayering: ThematicResonance['themeLayering'],
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  // Layering recommendations
  if (themeLayering.primaryThemes.length === 0) {
    recommendations.push('No primary themes detected. Establish 1-2 primary themes as the core of your story.');
  } else if (themeLayering.primaryThemes.length > 2) {
    recommendations.push('Too many primary themes. Consider consolidating to 1-2 primary themes for better focus.');
  }

  if (themeLayering.secondaryThemes.length < 2) {
    recommendations.push('Consider adding more secondary themes to create thematic depth and layering.');
  }

  // Pair resonance recommendations
  const lowResonancePairs = themePairs.filter(pair => pair.resonanceScore < 30);
  if (lowResonancePairs.length > 0) {
    recommendations.push(
      `Some theme pairs have low resonance: ${lowResonancePairs.slice(0, 2).map(p => `${p.theme1}/${p.theme2}`).join(', ')}. Consider weaving these themes together more.`
    );
  }

  // Overall score recommendations
  if (overallScore < 60) {
    recommendations.push('Overall thematic resonance is below 60. Work on interweaving themes more effectively.');
  } else if (overallScore >= 80) {
    recommendations.push('Excellent thematic resonance! Themes work together beautifully.');
  }

  return recommendations;
}
