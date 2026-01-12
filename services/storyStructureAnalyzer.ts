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
}

/**
 * Analyzes the story structure of a novel
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

  // Analyze three-act structure
  const threeActStructure = analyzeThreeActStructure(chapters, totalChapters);

  // Detect story beats
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

  // Calculate overall structure score
  const overallStructureScore = calculateStructureScore(threeActStructure, detectedBeats);

  // Generate recommendations
  const recommendations = generateStructureRecommendations(
    threeActStructure,
    detectedBeats,
    overallStructureScore
  );

  return {
    totalChapters,
    threeActStructure,
    detectedBeats,
    overallStructureScore,
    recommendations,
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
 */
function calculateStructureScore(
  threeActStructure: ThreeActStructure,
  detectedBeats: StoryBeat[]
): number {
  let score = 0;

  // Score based on act proportions (ideal: 25/50/25)
  const act1Score = calculateActProportionScore(threeActStructure.act1.percentage, 25);
  const act2Score = calculateActProportionScore(threeActStructure.act2.percentage, 50);
  const act3Score = calculateActProportionScore(threeActStructure.act3.percentage, 25);

  score += (act1Score + act2Score + act3Score) / 3 * 0.5; // 50% weight on act proportions

  // Score based on beat detection and strength
  if (detectedBeats.length > 0) {
    const averageBeatStrength = detectedBeats.reduce((sum, beat) => sum + beat.strengthScore, 0) / detectedBeats.length;
    score += (averageBeatStrength / 100) * 0.5; // 50% weight on beat strength
  }

  return Math.round(score);
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
 */
function generateStructureRecommendations(
  threeActStructure: ThreeActStructure,
  detectedBeats: StoryBeat[],
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  // Act proportion recommendations
  if (threeActStructure.act1.percentage < 20) {
    recommendations.push(`Act 1 is shorter than ideal (${threeActStructure.act1.percentage.toFixed(1)}% vs 25%). Consider adding more setup.`);
  } else if (threeActStructure.act1.percentage > 30) {
    recommendations.push(`Act 1 is longer than ideal (${threeActStructure.act1.percentage.toFixed(1)}% vs 25%). Consider tightening the opening.`);
  }

  if (threeActStructure.act2.percentage < 45) {
    recommendations.push(`Act 2 is shorter than ideal (${threeActStructure.act2.percentage.toFixed(1)}% vs 50%). Consider adding more development.`);
  } else if (threeActStructure.act2.percentage > 60) {
    recommendations.push(`Act 2 is longer than ideal (${threeActStructure.act2.percentage.toFixed(1)}% vs 50%). Consider condensing the middle section.`);
  }

  if (threeActStructure.act3.percentage < 20) {
    recommendations.push(`Act 3 is shorter than ideal (${threeActStructure.act3.percentage.toFixed(1)}% vs 25%). Consider adding more resolution.`);
  } else if (threeActStructure.act3.percentage > 30) {
    recommendations.push(`Act 3 is longer than ideal (${threeActStructure.act3.percentage.toFixed(1)}% vs 25%). Consider tightening the ending.`);
  }

  // Beat recommendations
  const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax', 'resolution'];
  const detectedBeatTypes = detectedBeats.map(beat => beat.beatType);
  
  requiredBeats.forEach(requiredBeat => {
    if (!detectedBeatTypes.includes(requiredBeat as any)) {
      recommendations.push(`Missing beat: ${requiredBeat.replace(/_/g, ' ')}. Consider adding this story element.`);
    }
  });

  // Overall score recommendation
  if (overallScore < 60) {
    recommendations.push('Overall structure score is below 60. Review act proportions and key story beats.');
  } else if (overallScore >= 80) {
    recommendations.push('Excellent structure! The story follows proven structural patterns well.');
  }

  return recommendations;
}
