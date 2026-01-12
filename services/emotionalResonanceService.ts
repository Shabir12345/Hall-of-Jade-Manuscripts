import { NovelState, Chapter, Scene, EmotionalMoment } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Emotional Resonance Service
 * Analyzes emotional impact scene-by-scene and chapter-by-chapter,
 * tracks emotional moments, and measures emotional payoff effectiveness
 */

export interface EmotionalResonanceAnalysis {
  emotionalMoments: EmotionalMoment[];
  emotionalJourney: Array<{
    chapterNumber: number;
    sceneNumber?: number;
    primaryEmotions: Array<{
      emotion: string;
      intensity: number;
    }>;
    emotionalScore: number; // 0-100
  }>;
  peakEmotionalMoments: EmotionalMoment[];
  emotionalPayoffs: Array<{
    setupMoment: EmotionalMoment;
    payoffMoment: EmotionalMoment;
    effectiveness: number; // 0-100
    chaptersBetween: number;
  }>;
  overallEmotionalScore: number; // 0-100
  recommendations: string[];
}

/**
 * Analyzes emotional resonance across the story
 */
export function analyzeEmotionalResonance(state: NovelState): EmotionalResonanceAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      emotionalMoments: [],
      emotionalJourney: [],
      peakEmotionalMoments: [],
      emotionalPayoffs: [],
      overallEmotionalScore: 0,
      recommendations: ['No chapters available for emotional analysis'],
    };
  }

  // Detect emotional moments
  const emotionalMoments = detectEmotionalMoments(chapters, state);

  // Build emotional journey
  const emotionalJourney = buildEmotionalJourney(chapters, emotionalMoments);

  // Identify peak emotional moments
  const peakEmotionalMoments = identifyPeakEmotionalMoments(emotionalMoments);

  // Analyze emotional payoffs
  const emotionalPayoffs = analyzeEmotionalPayoffs(emotionalMoments, chapters);

  // Calculate overall emotional score
  const overallEmotionalScore = calculateOverallEmotionalScore(emotionalMoments, emotionalJourney);

  // Generate recommendations
  const recommendations = generateEmotionalRecommendations(
    emotionalMoments,
    emotionalPayoffs,
    overallEmotionalScore
  );

  return {
    emotionalMoments,
    emotionalJourney,
    peakEmotionalMoments,
    emotionalPayoffs,
    overallEmotionalScore,
    recommendations,
  };
}

/**
 * Detects emotional moments in chapters and scenes
 */
function detectEmotionalMoments(chapters: Chapter[], state: NovelState): EmotionalMoment[] {
  const moments: EmotionalMoment[] = [];

  // Emotion detection patterns
  const emotionPatterns: Record<string, {
    keywords: string[];
    intensityModifiers: string[];
  }> = {
    joy: {
      keywords: ['joy', 'happy', 'happiness', 'elated', 'ecstatic', 'celebrate', 'triumph', 'victory'],
      intensityModifiers: ['overjoyed', 'ecstatic', 'euphoric', 'delighted']
    },
    sadness: {
      keywords: ['sad', 'sadness', 'grief', 'mourn', 'loss', 'heartbreak', 'despair', 'melancholy'],
      intensityModifiers: ['devastated', 'heartbroken', 'crushed', 'despairing']
    },
    anger: {
      keywords: ['anger', 'angry', 'furious', 'rage', 'enraged', 'fuming', 'outraged', 'livid'],
      intensityModifiers: ['furious', 'enraged', 'livid', 'incensed']
    },
    fear: {
      keywords: ['fear', 'afraid', 'scared', 'terrified', 'dread', 'panic', 'horror', 'anxiety'],
      intensityModifiers: ['terrified', 'petrified', 'horrified', 'panic-stricken']
    },
    surprise: {
      keywords: ['surprise', 'surprised', 'shocked', 'stunned', 'amazed', 'astonished', 'bewildered'],
      intensityModifiers: ['stunned', 'shocked', 'astonished', 'dumbfounded']
    },
    disgust: {
      keywords: ['disgust', 'disgusted', 'repulsed', 'revolted', 'sickened', 'appalled'],
      intensityModifiers: ['repulsed', 'revolted', 'appalled', 'sickened']
    },
    anticipation: {
      keywords: ['anticipation', 'eager', 'excited', 'expectant', 'anxious', 'hopeful'],
      intensityModifiers: ['eager', 'excited', 'breathless', 'yearning']
    },
    trust: {
      keywords: ['trust', 'trusting', 'confidence', 'faith', 'reliable', 'loyal', 'dependable'],
      intensityModifiers: ['complete trust', 'absolute faith', 'unwavering']
    },
    contempt: {
      keywords: ['contempt', 'contemptuous', 'scorn', 'disdain', 'derision', 'mockery'],
      intensityModifiers: ['scornful', 'disdainful', 'derisive', 'mocking']
    }
  };

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    
    // Check each emotion pattern
    Object.entries(emotionPatterns).forEach(([emotion, pattern]) => {
      const hasEmotion = pattern.keywords.some(keyword => content.includes(keyword));
      
      if (hasEmotion) {
        // Calculate intensity
        let intensity = 50; // Base intensity
        
        // Check for intensity modifiers
        const hasIntensityModifier = pattern.intensityModifiers.some(modifier => 
          content.includes(modifier)
        );
        if (hasIntensityModifier) intensity = 80;
        
        // Count emotion keywords (more mentions = higher intensity)
        const keywordCount = pattern.keywords.filter(kw => content.includes(kw)).length;
        intensity += Math.min(20, keywordCount * 5);
        
        // Check for emotional language patterns
        const emotionalLanguage = [
          'felt', 'feeling', 'heart', 'soul', 'chest', 'breath',
          'tears', 'smile', 'laugh', 'scream', 'cry'
        ];
        const hasEmotionalLanguage = emotionalLanguage.some(lang => content.includes(lang));
        if (hasEmotionalLanguage) intensity += 10;
        
        // Check for dialogue with emotional content
        const dialogueMatches = content.match(/"[^"]*"/g) || [];
        const hasEmotionalDialogue = dialogueMatches.some(dialogue => 
          pattern.keywords.some(kw => dialogue.includes(kw))
        );
        if (hasEmotionalDialogue) intensity += 10;
        
        // Determine if this is a setup moment (early appearance)
        const isSetup = chapter.number <= Math.ceil(chapters.length * 0.3);
        
        moments.push({
          id: generateUUID(),
          novelId: state.id,
          chapterId: chapter.id,
          emotionType: emotion as EmotionalMoment['emotionType'],
          intensity: Math.min(100, Math.max(0, Math.round(intensity))),
          isSetup,
          description: `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} moment in chapter ${chapter.number}`,
          createdAt: Date.now(),
        });
      }
    });
  });

  // Link setup moments to payoffs
  linkEmotionalPayoffs(moments, chapters);

  return moments;
}

/**
 * Links setup moments to their payoff moments
 */
function linkEmotionalPayoffs(moments: EmotionalMoment[], chapters: Chapter[]): void {
  const setupMoments = moments.filter(m => m.isSetup);
  const payoffMoments = moments.filter(m => !m.isSetup || m.intensity >= 80);

  setupMoments.forEach(setup => {
    // Find matching payoff (same or related emotion, later in story)
    const setupChapter = chapters.find(ch => ch.id === setup.chapterId);
    if (!setupChapter) return;

    const possiblePayoffs = payoffMoments.filter(payoff => {
      const payoffChapter = chapters.find(ch => ch.id === payoff.chapterId);
      if (!payoffChapter) return false;
      
      // Payoff must be after setup
      if (payoffChapter.number <= setupChapter.number) return false;
      
      // Same emotion or related (joy-sadness, fear-anger, etc.)
      const emotionPairs: Record<string, string[]> = {
        joy: ['sadness', 'surprise'],
        sadness: ['joy', 'anger'],
        anger: ['fear', 'sadness'],
        fear: ['anger', 'joy'],
        anticipation: ['surprise', 'joy', 'fear']
      };
      
      const relatedEmotions = emotionPairs[setup.emotionType] || [setup.emotionType];
      return relatedEmotions.includes(payoff.emotionType) || 
             payoff.emotionType === setup.emotionType;
    });

    if (possiblePayoffs.length > 0) {
      // Link to the closest payoff
      const closestPayoff = possiblePayoffs.sort((a, b) => {
        const chapterA = chapters.find(ch => ch.id === a.chapterId);
        const chapterB = chapters.find(ch => ch.id === b.chapterId);
        const setupChapter = chapters.find(ch => ch.id === setup.chapterId);
        if (!chapterA || !chapterB || !setupChapter) return 0;
        return (chapterA.number - setupChapter.number) - (chapterB.number - setupChapter.number);
      })[0];

      if (closestPayoff) {
        closestPayoff.payoffForMomentId = setup.id;
      }
    }
  });
}

/**
 * Builds emotional journey across chapters
 */
function buildEmotionalJourney(
  chapters: Chapter[],
  moments: EmotionalMoment[]
): EmotionalResonanceAnalysis['emotionalJourney'] {
  const journey: EmotionalResonanceAnalysis['emotionalJourney'] = [];

  chapters.forEach(chapter => {
    const chapterMoments = moments.filter(m => m.chapterId === chapter.id);
    
    if (chapterMoments.length === 0) {
      // Neutral chapter
      journey.push({
        chapterNumber: chapter.number,
        primaryEmotions: [],
        emotionalScore: 30,
      });
      return;
    }

    // Group by emotion type and calculate average intensity
    const emotionMap = new Map<string, number[]>();
    chapterMoments.forEach(moment => {
      const intensities = emotionMap.get(moment.emotionType) || [];
      intensities.push(moment.intensity);
      emotionMap.set(moment.emotionType, intensities);
    });

    // Calculate average intensity per emotion
    const primaryEmotions = Array.from(emotionMap.entries())
      .map(([emotion, intensities]) => ({
        emotion,
        intensity: Math.round(intensities.reduce((sum, i) => sum + i, 0) / intensities.length),
      }))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3); // Top 3 emotions

    // Calculate overall emotional score for chapter
    const emotionalScore = calculateChapterEmotionalScore(chapterMoments, primaryEmotions);

    journey.push({
      chapterNumber: chapter.number,
      primaryEmotions,
      emotionalScore,
    });
  });

  return journey;
}

/**
 * Calculates emotional score for a chapter
 */
function calculateChapterEmotionalScore(
  moments: EmotionalMoment[],
  primaryEmotions: Array<{ emotion: string; intensity: number }>
): number {
  if (moments.length === 0) return 30;

  // Average intensity of all emotions
  const averageIntensity = moments.reduce((sum, m) => sum + m.intensity, 0) / moments.length;

  // Bonus for multiple emotions (complexity)
  const emotionVariety = new Set(moments.map(m => m.emotionType)).size;
  const varietyBonus = Math.min(10, emotionVariety * 2);

  // Bonus for high-intensity moments
  const hasHighIntensity = moments.some(m => m.intensity >= 80);
  const intensityBonus = hasHighIntensity ? 10 : 0;

  return Math.min(100, Math.round(averageIntensity + varietyBonus + intensityBonus));
}

/**
 * Identifies peak emotional moments
 */
function identifyPeakEmotionalMoments(moments: EmotionalMoment[]): EmotionalMoment[] {
  return moments
    .filter(m => m.intensity >= 80)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 10); // Top 10 peak moments
}

/**
 * Analyzes emotional payoffs
 */
function analyzeEmotionalPayoffs(
  moments: EmotionalMoment[],
  chapters: Chapter[]
): EmotionalResonanceAnalysis['emotionalPayoffs'] {
  const payoffs: EmotionalResonanceAnalysis['emotionalPayoffs'] = [];

  const setupMoments = moments.filter(m => m.isSetup);
  const payoffMoments = moments.filter(m => m.payoffForMomentId);

  payoffMoments.forEach(payoff => {
    const setup = setupMoments.find(s => s.id === payoff.payoffForMomentId);
    if (!setup) return;

    const setupChapter = chapters.find(ch => ch.id === setup.chapterId);
    const payoffChapter = chapters.find(ch => ch.id === payoff.chapterId);
    if (!setupChapter || !payoffChapter) return;

    const chaptersBetween = payoffChapter.number - setupChapter.number;

    // Calculate effectiveness based on:
    // - Intensity of payoff (higher = better)
    // - Distance between setup and payoff (optimal: 5-15 chapters)
    // - Intensity increase from setup to payoff
    let effectiveness = payoff.intensity * 0.7; // 70% weight on payoff intensity

    // Optimal distance bonus/penalty
    if (chaptersBetween >= 5 && chaptersBetween <= 15) {
      effectiveness += 20; // Optimal distance
    } else if (chaptersBetween < 5) {
      effectiveness += 10 - (5 - chaptersBetween) * 2; // Too soon
    } else if (chaptersBetween > 15) {
      effectiveness += Math.max(0, 20 - (chaptersBetween - 15) * 1); // Too late
    }

    // Intensity increase bonus
    const intensityIncrease = payoff.intensity - setup.intensity;
    if (intensityIncrease > 0) {
      effectiveness += Math.min(10, intensityIncrease / 2);
    }

    payoffs.push({
      setupMoment: setup,
      payoffMoment: payoff,
      effectiveness: Math.min(100, Math.max(0, Math.round(effectiveness))),
      chaptersBetween,
    });
  });

  return payoffs.sort((a, b) => b.effectiveness - a.effectiveness);
}

/**
 * Calculates overall emotional score
 */
function calculateOverallEmotionalScore(
  moments: EmotionalMoment[],
  journey: EmotionalResonanceAnalysis['emotionalJourney']
): number {
  if (moments.length === 0 || journey.length === 0) return 0;

  // Average emotional score across journey
  const averageJourneyScore = journey.reduce((sum, j) => sum + j.emotionalScore, 0) / journey.length;

  // Bonus for peak moments
  const peakCount = moments.filter(m => m.intensity >= 80).length;
  const peakBonus = Math.min(15, peakCount * 2);

  // Bonus for emotional variety
  const emotionVariety = new Set(moments.map(m => m.emotionType)).size;
  const varietyBonus = Math.min(10, emotionVariety);

  return Math.min(100, Math.round(averageJourneyScore + peakBonus + varietyBonus));
}

/**
 * Generates emotional recommendations
 */
function generateEmotionalRecommendations(
  moments: EmotionalMoment[],
  payoffs: EmotionalResonanceAnalysis['emotionalPayoffs'],
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  if (overallScore < 60) {
    recommendations.push(`Overall emotional score is ${overallScore}/100. Consider adding more emotional moments and depth.`);
  }

  // Check for emotional variety
  const emotionVariety = new Set(moments.map(m => m.emotionType)).size;
  if (emotionVariety < 4) {
    recommendations.push(`Limited emotional variety (${emotionVariety} emotions). Consider incorporating more diverse emotions.`);
  }

  // Check for emotional payoffs
  if (payoffs.length === 0 && moments.filter(m => m.isSetup).length > 0) {
    recommendations.push('Setup moments detected but no payoffs found. Consider adding emotional payoffs for set-up moments.');
  }

  // Check payoff effectiveness
  const lowEffectivenessPayoffs = payoffs.filter(p => p.effectiveness < 60);
  if (lowEffectivenessPayoffs.length > 0) {
    recommendations.push(`${lowEffectivenessPayoffs.length} emotional payoffs have low effectiveness. Consider strengthening payoff moments or adjusting timing.`);
  }

  // Check for emotional peaks
  const peakMoments = moments.filter(m => m.intensity >= 80);
  if (peakMoments.length < 3) {
    recommendations.push(`Only ${peakMoments.length} peak emotional moments detected. Consider adding more high-intensity emotional scenes.`);
  }

  // Positive feedback
  if (overallScore >= 75 && payoffs.length >= 3 && emotionVariety >= 6) {
    recommendations.push('Excellent emotional resonance! Strong variety, effective payoffs, and consistent emotional depth.');
  }

  return recommendations;
}
