import { NovelState, Chapter, StoryBeat, Arc } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Story Structure Analyzer
 * Analyzes story structure using three-act structure, Save the Cat beat sheet,
 * and other proven story structures.
 */

export interface ThreeActStructure {
  act1: {
    startChapter: number;
    endChapter: number;
    percentage: number;
    beats: StoryBeat[];
  };
  act2: {
    startChapter: number;
    endChapter: number;
    percentage: number;
    beats: StoryBeat[];
  };
  act3: {
    startChapter: number;
    endChapter: number;
    percentage: number;
    beats: StoryBeat[];
  };
  recommendations: string[];
}

export interface StoryStructureAnalysis {
  totalChapters: number;
  threeActStructure: ThreeActStructure;
  detectedBeats: StoryBeat[];
  overallStructureScore: number; // 0-100
  recommendations: string[];
  // Content-aware metrics
  contentMetrics?: ContentStructureMetrics;
}

/**
 * Content-aware structure metrics for more accurate scoring
 */
export interface ContentStructureMetrics {
  totalWordCount: number;
  act1WordCount: number;
  act2WordCount: number;
  act3WordCount: number;
  act1WordPercentage: number;
  act2WordPercentage: number;
  act3WordPercentage: number;
  narrativeElements: {
    conflictDensity: number; // 0-100: how much conflict is present
    characterMoments: number; // count of character development moments
    tensionShifts: number; // count of tension changes
    sceneTransitions: number; // count of scene/setting changes
  };
  pacing: {
    openingPace: 'slow' | 'medium' | 'fast';
    middlePace: 'slow' | 'medium' | 'fast';
    endingPace: 'slow' | 'medium' | 'fast';
    pacingVariety: number; // 0-100: how varied is the pacing
  };
}

/**
 * Analyzes the story structure of a novel
 * Uses content-aware metrics for accurate scoring
 */
export function analyzeStoryStructure(state: NovelState): StoryStructureAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const totalChapters = chapters.length;

  if (totalChapters === 0) {
    return {
      totalChapters: 0,
      threeActStructure: {
        act1: { startChapter: 0, endChapter: 0, percentage: 0, beats: [] },
        act2: { startChapter: 0, endChapter: 0, percentage: 0, beats: [] },
        act3: { startChapter: 0, endChapter: 0, percentage: 0, beats: [] },
        recommendations: [],
      },
      detectedBeats: [],
      overallStructureScore: 0,
      recommendations: ['No chapters available for analysis'],
    };
  }

  // Analyze three-act structure (chapter-based boundaries)
  const threeActStructure = analyzeThreeActStructure(chapters, totalChapters);

  // Calculate content-aware metrics (word count based)
  const contentMetrics = analyzeContentMetrics(chapters, threeActStructure);

  // Detect story beats with content analysis
  const detectedBeats = detectStoryBeats(chapters, totalChapters, state);

  // Populate act beats from detected beats
  threeActStructure.act1.beats = detectedBeats.filter(beat => 
    beat.chapterNumber && beat.chapterNumber <= threeActStructure.act1.endChapter
  );
  threeActStructure.act2.beats = detectedBeats.filter(beat => 
    beat.chapterNumber && 
    beat.chapterNumber > threeActStructure.act2.startChapter &&
    beat.chapterNumber <= threeActStructure.act2.endChapter
  );
  threeActStructure.act3.beats = detectedBeats.filter(beat => 
    beat.chapterNumber && beat.chapterNumber > threeActStructure.act3.startChapter
  );

  // Calculate overall structure score with content-awareness
  const overallStructureScore = calculateStructureScore(threeActStructure, detectedBeats, contentMetrics);

  // Generate recommendations
  const recommendations = generateStructureRecommendations(
    threeActStructure,
    detectedBeats,
    overallStructureScore,
    contentMetrics
  );

  return {
    totalChapters,
    threeActStructure,
    detectedBeats,
    overallStructureScore,
    recommendations,
    contentMetrics,
  };
}

/**
 * Analyzes content-based metrics for structure scoring
 * Uses word count and content analysis instead of just chapter counts
 */
function analyzeContentMetrics(
  chapters: Chapter[],
  threeActStructure: ThreeActStructure
): ContentStructureMetrics {
  // Calculate word counts for each act
  const getWordCount = (text: string) => (text || '').split(/\s+/).filter(w => w.length > 0).length;
  
  const act1Chapters = chapters.filter(ch => ch.number <= threeActStructure.act1.endChapter);
  const act2Chapters = chapters.filter(ch => 
    ch.number > threeActStructure.act1.endChapter && 
    ch.number <= threeActStructure.act2.endChapter
  );
  const act3Chapters = chapters.filter(ch => ch.number > threeActStructure.act2.endChapter);
  
  const act1WordCount = act1Chapters.reduce((sum, ch) => sum + getWordCount(ch.content), 0);
  const act2WordCount = act2Chapters.reduce((sum, ch) => sum + getWordCount(ch.content), 0);
  const act3WordCount = act3Chapters.reduce((sum, ch) => sum + getWordCount(ch.content), 0);
  const totalWordCount = act1WordCount + act2WordCount + act3WordCount;
  
  // Analyze narrative elements across all chapters
  const narrativeElements = analyzeNarrativeElements(chapters);
  
  // Analyze pacing
  const pacing = analyzePacing(act1Chapters, act2Chapters, act3Chapters);
  
  return {
    totalWordCount,
    act1WordCount,
    act2WordCount,
    act3WordCount,
    act1WordPercentage: totalWordCount > 0 ? (act1WordCount / totalWordCount) * 100 : 0,
    act2WordPercentage: totalWordCount > 0 ? (act2WordCount / totalWordCount) * 100 : 0,
    act3WordPercentage: totalWordCount > 0 ? (act3WordCount / totalWordCount) * 100 : 0,
    narrativeElements,
    pacing,
  };
}

/**
 * Analyzes narrative elements in chapters
 */
function analyzeNarrativeElements(chapters: Chapter[]): ContentStructureMetrics['narrativeElements'] {
  let conflictCount = 0;
  let characterMoments = 0;
  let tensionShifts = 0;
  let sceneTransitions = 0;
  
  // Conflict indicators
  const conflictWords = [
    'fight', 'argue', 'conflict', 'battle', 'struggle', 'oppose', 'clash',
    'confront', 'challenge', 'resist', 'defy', 'attack', 'defend', 'threat',
    'danger', 'risk', 'enemy', 'rival', 'antagonist', 'obstacle', 'problem'
  ];
  
  // Character development indicators
  const characterWords = [
    'realize', 'understand', 'feel', 'emotion', 'thought', 'decide',
    'change', 'grow', 'learn', 'remember', 'regret', 'hope', 'fear',
    'love', 'hate', 'trust', 'doubt', 'believe', 'question', 'reflect'
  ];
  
  // Tension shift indicators
  const tensionWords = [
    'suddenly', 'unexpected', 'surprise', 'shock', 'twist', 'reveal',
    'but', 'however', 'although', 'despite', 'yet', 'instead', 'until'
  ];
  
  // Scene transition indicators
  const sceneWords = [
    'later', 'meanwhile', 'elsewhere', 'next day', 'morning', 'evening',
    'arrived', 'left', 'entered', 'walked', 'traveled', 'returned'
  ];
  
  chapters.forEach(chapter => {
    const content = (chapter.content || '').toLowerCase();
    
    // Count conflict density
    conflictCount += conflictWords.filter(word => content.includes(word)).length;
    
    // Count character moments
    characterMoments += characterWords.filter(word => content.includes(word)).length;
    
    // Count tension shifts
    tensionShifts += tensionWords.filter(word => content.includes(word)).length;
    
    // Count scene transitions
    sceneTransitions += sceneWords.filter(word => content.includes(word)).length;
  });
  
  // Normalize conflict density to 0-100
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.content || '').split(/\s+/).length, 0);
  const conflictDensity = totalWords > 0 
    ? Math.min(100, (conflictCount / (totalWords / 1000)) * 10) 
    : 0;
  
  return {
    conflictDensity: Math.round(conflictDensity),
    characterMoments,
    tensionShifts,
    sceneTransitions,
  };
}

/**
 * Analyzes pacing across acts
 */
function analyzePacing(
  act1Chapters: Chapter[],
  act2Chapters: Chapter[],
  act3Chapters: Chapter[]
): ContentStructureMetrics['pacing'] {
  const getPace = (chapters: Chapter[]): 'slow' | 'medium' | 'fast' => {
    if (chapters.length === 0) return 'medium';
    
    // Average words per chapter
    const avgWords = chapters.reduce((sum, ch) => sum + (ch.content || '').split(/\s+/).length, 0) / chapters.length;
    
    // Action word density
    const actionWords = ['run', 'fight', 'chase', 'escape', 'rush', 'attack', 'race'];
    const actionDensity = chapters.reduce((sum, ch) => {
      const content = (ch.content || '').toLowerCase();
      return sum + actionWords.filter(w => content.includes(w)).length;
    }, 0) / chapters.length;
    
    // Short chapters + high action = fast pace
    // Long chapters + low action = slow pace
    if (avgWords < 1500 && actionDensity > 2) return 'fast';
    if (avgWords > 3000 && actionDensity < 1) return 'slow';
    return 'medium';
  };
  
  const openingPace = getPace(act1Chapters);
  const middlePace = getPace(act2Chapters);
  const endingPace = getPace(act3Chapters);
  
  // Calculate pacing variety (how different are the paces)
  const paces = [openingPace, middlePace, endingPace];
  const uniquePaces = new Set(paces).size;
  const pacingVariety = uniquePaces === 3 ? 100 : uniquePaces === 2 ? 60 : 30;
  
  return {
    openingPace,
    middlePace,
    endingPace,
    pacingVariety,
  };
}

/**
 * Analyzes three-act structure
 * Typical proportions: Act 1 (25%), Act 2 (50%), Act 3 (25%)
 */
function analyzeThreeActStructure(
  chapters: Chapter[],
  totalChapters: number
): ThreeActStructure {
  const act1End = Math.ceil(totalChapters * 0.25);
  const act2End = Math.ceil(totalChapters * 0.75);
  const act3End = totalChapters;

  const act1Chapters = chapters.filter(ch => ch.number <= act1End);
  const act2Chapters = chapters.filter(ch => ch.number > act1End && ch.number <= act2End);
  const act3Chapters = chapters.filter(ch => ch.number > act2End);

  return {
    act1: {
      startChapter: 1,
      endChapter: act1End,
      percentage: (act1Chapters.length / totalChapters) * 100,
      beats: [], // Will be populated by filtering detected beats
    },
    act2: {
      startChapter: act1End + 1,
      endChapter: act2End,
      percentage: (act2Chapters.length / totalChapters) * 100,
      beats: [], // Will be populated by filtering detected beats
    },
    act3: {
      startChapter: act2End + 1,
      endChapter: act3End,
      percentage: (act3Chapters.length / totalChapters) * 100,
      beats: [], // Will be populated by filtering detected beats
    },
    recommendations: [],
  };
}

/**
 * Detects story beats across the entire story
 */
function detectStoryBeats(
  chapters: Chapter[],
  totalChapters: number,
  state: NovelState
): StoryBeat[] {
  const beats: StoryBeat[] = [];

  // Check for existing beats from state
  if (state.storyBeats && state.storyBeats.length > 0) {
    return state.storyBeats;
  }

  // Detect key beats based on chapter content and position
  chapters.forEach(chapter => {
    const positionPercentage = (chapter.number / totalChapters) * 100;

    // Inciting Incident (0-10% of story)
    if (positionPercentage >= 0 && positionPercentage <= 10) {
      const isIncitingIncident = detectIncitingIncident(chapter);
      if (isIncitingIncident) {
        beats.push(createBeat(
          state.id,
          chapter,
          'inciting_incident',
          'three_act',
          positionPercentage,
          'The story begins with an event that sets the main plot in motion'
        ));
      }
    }

    // Plot Point 1 (around 25% - end of Act 1)
    if (positionPercentage >= 20 && positionPercentage <= 30) {
      const isPlotPoint1 = detectPlotPoint1(chapter);
      if (isPlotPoint1) {
        beats.push(createBeat(
          state.id,
          chapter,
          'plot_point_1',
          'three_act',
          positionPercentage,
          'First major turning point that propels protagonist into Act 2'
        ));
      }
    }

    // Midpoint (around 50% - middle of Act 2)
    if (positionPercentage >= 45 && positionPercentage <= 55) {
      const isMidpoint = detectMidpoint(chapter);
      if (isMidpoint) {
        beats.push(createBeat(
          state.id,
          chapter,
          'midpoint',
          'three_act',
          positionPercentage,
          'Major revelation or reversal that shifts the story direction'
        ));
      }
    }

    // Plot Point 2 (around 75% - end of Act 2)
    if (positionPercentage >= 70 && positionPercentage <= 80) {
      const isPlotPoint2 = detectPlotPoint2(chapter);
      if (isPlotPoint2) {
        beats.push(createBeat(
          state.id,
          chapter,
          'plot_point_2',
          'three_act',
          positionPercentage,
          'Second major turning point that propels protagonist into Act 3'
        ));
      }
    }

    // Climax (around 85-90%)
    if (positionPercentage >= 85 && positionPercentage <= 95) {
      const isClimax = detectClimax(chapter);
      if (isClimax) {
        beats.push(createBeat(
          state.id,
          chapter,
          'climax',
          'three_act',
          positionPercentage,
          'The ultimate confrontation or final test'
        ));
      }
    }

    // Resolution (90-100%)
    if (positionPercentage >= 90) {
      const isResolution = detectResolution(chapter);
      if (isResolution) {
        beats.push(createBeat(
          state.id,
          chapter,
          'resolution',
          'three_act',
          positionPercentage,
          'The aftermath and conclusion of the story'
        ));
      }
    }
  });

  return beats;
}


/**
 * Detects if a chapter contains an inciting incident
 */
function detectIncitingIncident(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Look for keywords and patterns that suggest inciting incident
  const incitingIndicators = [
    'suddenly', 'unexpected', 'strange', 'discovery', 'meeting',
    'arrival', 'change', 'crisis', 'begins', 'starts', 'encounter'
  ];

  const logicAudit = chapter.logicAudit;
  if (logicAudit && logicAudit.causalityType === 'But' && 
      (logicAudit.theFriction.toLowerCase().includes('conflict') ||
       logicAudit.theFriction.toLowerCase().includes('change'))) {
    return true;
  }

  // Check for multiple indicators
  const indicatorCount = incitingIndicators.filter(indicator =>
    content.includes(indicator)
  ).length;

  return indicatorCount >= 2;
}

/**
 * Detects Plot Point 1 (end of Act 1)
 */
function detectPlotPoint1(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const logicAudit = chapter.logicAudit;

  // Plot Point 1 typically involves a major decision or irreversible change
  const plotPoint1Indicators = [
    'decide', 'choice', 'commit', 'leave', 'enter', 'accept',
    'refuse', 'agrees', 'cannot return', 'point of no return'
  ];

  if (logicAudit && logicAudit.causalityType === 'Therefore') {
    const hasIndicators = plotPoint1Indicators.some(indicator =>
      content.includes(indicator)
    );
    if (hasIndicators) return true;
  }

  // Check if chapter marks end of an arc
  const hasMajorChange = content.includes('new world') ||
    content.includes('journey begins') ||
    content.includes('adventure starts');

  return hasMajorChange;
}

/**
 * Detects Midpoint (middle of Act 2)
 */
function detectMidpoint(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Midpoint often involves a major revelation or reversal
  const midpointIndicators = [
    'reveal', 'discover', 'truth', 'secret', 'betrayal',
    'realization', 'understand', 'learn', 'revealed'
  ];

  const logicAudit = chapter.logicAudit;
  if (logicAudit) {
    const hasRevelation = midpointIndicators.some(indicator =>
      content.includes(indicator)
    );

    if (hasRevelation) return true;
  }

  // Check for "false victory" or "false defeat" patterns
  const hasFalseVictory = content.includes('seem to win') ||
    content.includes('appears successful') ||
    content.includes('momentary victory');

  const hasFalseDefeat = content.includes('seems defeated') ||
    content.includes('appears to fail') ||
    content.includes('momentary loss');

  return hasFalseVictory || hasFalseDefeat;
}

/**
 * Detects Plot Point 2 (end of Act 2)
 */
function detectPlotPoint2(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Plot Point 2 typically involves the lowest point or final push toward climax
  const plotPoint2Indicators = [
    'lowest point', 'darkest moment', 'all is lost',
    'final confrontation', 'prepare for battle', 'last chance'
  ];

  const hasIndicators = plotPoint2Indicators.some(indicator =>
    content.includes(indicator)
  );

  if (hasIndicators) return true;

  // Check logic audit for major conflict escalation
  const logicAudit = chapter.logicAudit;
  if (logicAudit && logicAudit.causalityType === 'But') {
    const hasMajorConflict = logicAudit.theFriction.toLowerCase().includes('conflict') ||
      logicAudit.theFriction.toLowerCase().includes('danger') ||
      logicAudit.theFriction.toLowerCase().includes('crisis');

    if (hasMajorConflict) return true;
  }

  return false;
}

/**
 * Detects Climax
 */
function detectClimax(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Climax typically involves the ultimate confrontation
  const climaxIndicators = [
    'final battle', 'climax', 'ultimate', 'final confrontation',
    'decisive moment', 'final fight', 'showdown', 'confrontation'
  ];

  const hasIndicators = climaxIndicators.some(indicator =>
    content.includes(indicator)
  );

  if (hasIndicators) return true;

  // Check for high tension and resolution patterns
  const logicAudit = chapter.logicAudit;
  if (logicAudit) {
    const hasResolution = logicAudit.resultingValue.toLowerCase().includes('victory') ||
      logicAudit.resultingValue.toLowerCase().includes('defeat') ||
      logicAudit.resultingValue.toLowerCase().includes('resolve');

    if (hasResolution) return true;
  }

  return false;
}

/**
 * Detects Resolution
 */
function detectResolution(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  
  // Resolution typically involves aftermath and conclusion
  const resolutionIndicators = [
    'aftermath', 'after', 'conclusion', 'ending', 'finally',
    'resolve', 'resolved', 'peace', 'new beginning', 'end'
  ];

  const hasIndicators = resolutionIndicators.some(indicator =>
    content.includes(indicator)
  );

  if (hasIndicators) return true;

  // Check logic audit for resolution patterns
  const logicAudit = chapter.logicAudit;
  if (logicAudit && logicAudit.causalityType === 'Therefore') {
    const hasResolution = logicAudit.resultingValue.toLowerCase().includes('resolve') ||
      logicAudit.resultingValue.toLowerCase().includes('conclude') ||
      logicAudit.resultingValue.toLowerCase().includes('peace');

    if (hasResolution) return true;
  }

  return false;
}

/**
 * Creates a story beat object
 */
function createBeat(
  novelId: string,
  chapter: Chapter,
  beatType: StoryBeat['beatType'],
  structureType: StoryBeat['structureType'],
  positionPercentage: number,
  description: string
): StoryBeat {
  // Calculate strength score based on how well the beat matches expected position
  const strengthScore = calculateBeatStrengthScore(beatType, positionPercentage, chapter);

  return {
    id: generateUUID(),
    novelId,
    beatType,
    structureType,
    chapterNumber: chapter.number,
    chapterId: chapter.id,
    description,
    strengthScore,
    positionPercentage,
    notes: `Detected in chapter ${chapter.number}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Calculates strength score for a beat (0-100)
 * Higher score = better positioned and more strongly indicated
 */
function calculateBeatStrengthScore(
  beatType: StoryBeat['beatType'],
  positionPercentage: number,
  chapter: Chapter
): number {
  let score = 50; // Base score

  // Expected position ranges (ideal percentages)
  const expectedPositions: Record<string, { ideal: number; range: number }> = {
    inciting_incident: { ideal: 5, range: 10 },
    plot_point_1: { ideal: 25, range: 5 },
    midpoint: { ideal: 50, range: 5 },
    plot_point_2: { ideal: 75, range: 5 },
    climax: { ideal: 90, range: 5 },
    resolution: { ideal: 95, range: 5 },
  };

  const expected = expectedPositions[beatType];
  if (expected) {
    const distanceFromIdeal = Math.abs(positionPercentage - expected.ideal);
    // Score decreases as distance from ideal increases
    const positionScore = Math.max(0, 100 - (distanceFromIdeal / expected.range) * 50);
    score = (score + positionScore) / 2;
  }

  // Boost score if logic audit supports the beat
  if (chapter.logicAudit) {
    score += 10;
  }

  // Boost score if chapter has strong indicators
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const hasStrongIndicators = content.length > 1000; // Longer chapters often contain more significant beats
  if (hasStrongIndicators) {
    score += 5;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall structure score (0-100)
 * Uses content-aware metrics for more accurate scoring
 */
function calculateStructureScore(
  threeActStructure: ThreeActStructure,
  detectedBeats: StoryBeat[],
  contentMetrics?: ContentStructureMetrics
): number {
  let score = 0;
  
  // If we have content metrics, use word-count based proportions (more accurate)
  // Otherwise fall back to chapter-count proportions
  let act1Percent: number;
  let act2Percent: number;
  let act3Percent: number;
  
  if (contentMetrics && contentMetrics.totalWordCount > 0) {
    // Use word count for proportions (more accurate)
    act1Percent = contentMetrics.act1WordPercentage;
    act2Percent = contentMetrics.act2WordPercentage;
    act3Percent = contentMetrics.act3WordPercentage;
  } else {
    // Fall back to chapter count
    act1Percent = threeActStructure.act1.percentage;
    act2Percent = threeActStructure.act2.percentage;
    act3Percent = threeActStructure.act3.percentage;
  }

  // Score based on act proportions (ideal: 25/50/25) - 25% weight
  const act1Score = calculateActProportionScore(act1Percent, 25);
  const act2Score = calculateActProportionScore(act2Percent, 50);
  const act3Score = calculateActProportionScore(act3Percent, 25);
  const actProportionScore = (act1Score + act2Score + act3Score) / 3;
  score += actProportionScore * 0.25;

  // Score based on beat detection and strength - 25% weight
  const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax'];
  const detectedBeatTypes = detectedBeats.map(b => b.beatType);
  const beatsFound = requiredBeats.filter(beat => detectedBeatTypes.includes(beat as any)).length;
  const beatCoverageScore = (beatsFound / requiredBeats.length) * 100;
  
  let beatStrengthScore = 50; // Base score
  if (detectedBeats.length > 0) {
    beatStrengthScore = detectedBeats.reduce((sum, beat) => sum + beat.strengthScore, 0) / detectedBeats.length;
  }
  const beatScore = (beatCoverageScore * 0.6 + beatStrengthScore * 0.4);
  score += beatScore * 0.25;

  // Score based on narrative elements - 25% weight (NEW - content-aware)
  if (contentMetrics) {
    const { narrativeElements, pacing } = contentMetrics;
    
    // Conflict density score (ideal: 40-70)
    let conflictScore = 0;
    if (narrativeElements.conflictDensity >= 40 && narrativeElements.conflictDensity <= 70) {
      conflictScore = 100;
    } else if (narrativeElements.conflictDensity < 40) {
      conflictScore = (narrativeElements.conflictDensity / 40) * 100;
    } else {
      conflictScore = Math.max(0, 100 - (narrativeElements.conflictDensity - 70) * 2);
    }
    
    // Character moments score (more is better, up to a point)
    const characterScore = Math.min(100, (narrativeElements.characterMoments / 50) * 100);
    
    // Tension shifts score (variety is good)
    const tensionScore = Math.min(100, (narrativeElements.tensionShifts / 30) * 100);
    
    // Pacing variety score
    const pacingScore = pacing.pacingVariety;
    
    const narrativeScore = (conflictScore + characterScore + tensionScore + pacingScore) / 4;
    score += narrativeScore * 0.25;
  } else {
    // Without content metrics, use a base score
    score += 50 * 0.25;
  }

  // Score based on chapter quality indicators - 25% weight
  // Check for logic audits, summaries, and content length
  if (contentMetrics) {
    // Word count adequacy (too short or no content = lower score)
    const avgWordsPerChapter = contentMetrics.totalWordCount / Math.max(1, 
      (threeActStructure.act1.endChapter - 0) + 
      (threeActStructure.act2.endChapter - threeActStructure.act1.endChapter) + 
      (threeActStructure.act3.endChapter - threeActStructure.act2.endChapter)
    );
    
    // Ideal: 1500-4000 words per chapter
    let contentLengthScore = 50;
    if (avgWordsPerChapter >= 1500 && avgWordsPerChapter <= 4000) {
      contentLengthScore = 100;
    } else if (avgWordsPerChapter < 1500) {
      contentLengthScore = (avgWordsPerChapter / 1500) * 100;
    } else {
      contentLengthScore = Math.max(50, 100 - (avgWordsPerChapter - 4000) / 100);
    }
    
    score += contentLengthScore * 0.25;
  } else {
    score += 50 * 0.25;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Calculates score for act proportion (0-100)
 */
function calculateActProportionScore(actualPercentage: number, idealPercentage: number): number {
  const deviation = Math.abs(actualPercentage - idealPercentage);
  // Allow 5% deviation before penalizing
  if (deviation <= 5) return 100;
  // Score decreases with deviation
  return Math.max(0, 100 - deviation * 2);
}

/**
 * Generates structure recommendations
 * Uses content metrics for more specific and actionable recommendations
 */
function generateStructureRecommendations(
  threeActStructure: ThreeActStructure,
  detectedBeats: StoryBeat[],
  overallScore: number,
  contentMetrics?: ContentStructureMetrics
): string[] {
  const recommendations: string[] = [];

  // Use word-based percentages if available (more accurate)
  const act1Percent = contentMetrics?.act1WordPercentage ?? threeActStructure.act1.percentage;
  const act2Percent = contentMetrics?.act2WordPercentage ?? threeActStructure.act2.percentage;
  const act3Percent = contentMetrics?.act3WordPercentage ?? threeActStructure.act3.percentage;

  // Act proportion recommendations (based on word count when available)
  if (act1Percent < 20) {
    recommendations.push(`Act 1 is shorter than ideal (${act1Percent.toFixed(1)}% vs 25% by word count). Consider adding more character introduction and world-building.`);
  } else if (act1Percent > 30) {
    recommendations.push(`Act 1 is longer than ideal (${act1Percent.toFixed(1)}% vs 25% by word count). Consider tightening the opening or moving content to Act 2.`);
  }

  if (act2Percent < 45) {
    recommendations.push(`Act 2 is shorter than ideal (${act2Percent.toFixed(1)}% vs 50% by word count). Consider adding more rising action and complications.`);
  } else if (act2Percent > 60) {
    recommendations.push(`Act 2 is longer than ideal (${act2Percent.toFixed(1)}% vs 50% by word count). Consider condensing the middle or removing filler.`);
  }

  if (act3Percent < 20) {
    recommendations.push(`Act 3 is shorter than ideal (${act3Percent.toFixed(1)}% vs 25% by word count). Consider expanding the climax or resolution.`);
  } else if (act3Percent > 30) {
    recommendations.push(`Act 3 is longer than ideal (${act3Percent.toFixed(1)}% vs 25% by word count). Consider tightening the ending.`);
  }

  // Beat recommendations
  const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax', 'resolution'];
  const detectedBeatTypes = detectedBeats.map(beat => beat.beatType);
  
  requiredBeats.forEach(requiredBeat => {
    if (!detectedBeatTypes.includes(requiredBeat as any)) {
      recommendations.push(`Missing beat: ${requiredBeat.replace(/_/g, ' ')}. Consider adding this story element.`);
    }
  });

  // Content-based recommendations
  if (contentMetrics) {
    const { narrativeElements, pacing } = contentMetrics;
    
    // Conflict density recommendations
    if (narrativeElements.conflictDensity < 30) {
      recommendations.push(`Low conflict density (${narrativeElements.conflictDensity}/100). Add more obstacles, challenges, or tension.`);
    } else if (narrativeElements.conflictDensity > 80) {
      recommendations.push(`Very high conflict density (${narrativeElements.conflictDensity}/100). Consider adding quieter moments for contrast.`);
    }
    
    // Character development recommendations
    if (narrativeElements.characterMoments < 15) {
      recommendations.push(`Limited character development moments. Add more introspection, emotional reactions, and growth.`);
    }
    
    // Pacing recommendations
    if (pacing.pacingVariety < 50) {
      recommendations.push(`Pacing is too uniform. Vary the pace between acts for better rhythm.`);
    }
    
    if (pacing.openingPace === 'slow' && pacing.endingPace === 'slow') {
      recommendations.push(`Both opening and ending are slow-paced. Consider energizing at least one.`);
    }
    
    // Word count recommendations
    const avgWordsPerChapter = contentMetrics.totalWordCount / Math.max(1, threeActStructure.act3.endChapter);
    if (avgWordsPerChapter < 1000) {
      recommendations.push(`Chapters are quite short (avg ${Math.round(avgWordsPerChapter)} words). Consider expanding key scenes.`);
    }
  }

  // Overall score recommendation
  if (overallScore < 40) {
    recommendations.push('Structure needs significant work. Focus on establishing clear act boundaries and key story beats.');
  } else if (overallScore < 60) {
    recommendations.push('Structure is developing. Review act proportions and ensure key beats are clearly defined.');
  } else if (overallScore < 80) {
    recommendations.push('Good structure foundation. Fine-tune proportions and strengthen weaker beats.');
  } else {
    recommendations.push('Strong structure! The story follows proven narrative patterns effectively.');
  }

  return recommendations;
}
