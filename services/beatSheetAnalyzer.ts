import { NovelState, Chapter, StoryBeat } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Save the Cat Beat Sheet Analyzer
 * Analyzes story structure using Blake Snyder's 15-beat structure for genre fiction
 * Adapted for novel chapters and Xianxia/Xuanhuan genres
 */

export interface SaveTheCatBeat {
  beatNumber: number;
  beatName: string;
  description: string;
  idealPosition: number; // Percentage of story (0-100)
  idealPage: number; // Page number (assuming 250 pages = 100%)
  chapterNumber?: number;
  chapterId?: string;
  detected: boolean;
  strengthScore: number; // 0-100
  notes?: string;
}

export interface SaveTheCatAnalysis {
  beats: SaveTheCatBeat[];
  overallScore: number; // 0-100
  missingBeats: SaveTheCatBeat[];
  recommendations: string[];
}

/**
 * Save the Cat 15-beat structure
 * Adapted for novels (chapter-based instead of page-based)
 */
const SAVE_THE_CAT_BEATS = [
  { number: 1, name: 'Opening Image', position: 0, page: 1, description: 'First impression, sets the tone' },
  { number: 2, name: 'Theme Stated', position: 5, page: 5, description: 'Theme or lesson is stated' },
  { number: 3, name: 'Setup', position: 1, page: 1, description: 'Introduce hero and world' },
  { number: 4, name: 'Catalyst', position: 10, page: 12, description: 'Inciting incident - life changes' },
  { number: 5, name: 'Debate', position: 12, page: 25, description: 'Hero debates what to do' },
  { number: 6, name: 'Break into Two', position: 25, page: 25, description: 'Hero commits to adventure' },
  { number: 7, name: 'B Story', position: 30, page: 30, description: 'Subplot or love story introduced' },
  { number: 8, name: 'Fun and Games', position: 20, page: 30, description: 'Promise of the premise - adventure' },
  { number: 9, name: 'Midpoint', position: 50, page: 55, description: 'False victory or false defeat' },
  { number: 10, name: 'Bad Guys Close In', position: 55, page: 75, description: 'Opposition gets stronger' },
  { number: 11, name: 'All Is Lost', position: 75, page: 85, description: 'Darkest moment - appears defeated' },
  { number: 12, name: 'Dark Night of the Soul', position: 75, page: 85, description: 'Hero at lowest point' },
  { number: 13, name: 'Break into Three', position: 85, page: 85, description: 'Hero finds solution' },
  { number: 14, name: 'Finale', position: 85, page: 85, description: 'Hero confronts final challenge' },
  { number: 15, name: 'Final Image', position: 100, page: 110, description: 'Opposite of opening image' },
];

/**
 * Analyzes story using Save the Cat beat sheet
 */
export function analyzeSaveTheCat(state: NovelState): SaveTheCatAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const totalChapters = chapters.length;

  if (totalChapters === 0) {
    return {
      beats: SAVE_THE_CAT_BEATS.map(beat => ({
        beatNumber: beat.number,
        beatName: beat.name,
        description: beat.description,
        idealPosition: beat.position,
        idealPage: beat.page,
        detected: false,
        strengthScore: 0,
      })),
      overallScore: 0,
      missingBeats: [],
      recommendations: ['No chapters available for analysis'],
    };
  }

  // Detect beats
  const beats = detectSaveTheCatBeats(chapters, totalChapters, state);

  // Calculate overall score
  const overallScore = calculateBeatSheetScore(beats);

  // Find missing beats
  const missingBeats = beats.filter(beat => !beat.detected);

  // Generate recommendations
  const recommendations = generateBeatSheetRecommendations(beats, missingBeats, overallScore);

  return {
    beats,
    overallScore,
    missingBeats,
    recommendations,
  };
}

/**
 * Detects Save the Cat beats in chapters
 */
function detectSaveTheCatBeats(
  chapters: Chapter[],
  totalChapters: number,
  state: NovelState
): SaveTheCatBeat[] {
  const beats: SaveTheCatBeat[] = [];

  SAVE_THE_CAT_BEATS.forEach(beatTemplate => {
    const idealChapter = Math.ceil((beatTemplate.position / 100) * totalChapters);
    const searchRange = Math.max(1, Math.ceil(totalChapters * 0.1)); // 10% range

    let detected = false;
    let detectedChapter: Chapter | null = null;
    let strengthScore = 0;

    // Search in range around ideal position
    const startChapter = Math.max(1, idealChapter - searchRange);
    const endChapter = Math.min(totalChapters, idealChapter + searchRange);

    for (let i = startChapter - 1; i < Math.min(endChapter, chapters.length); i++) {
      const chapter = chapters[i];
      if (detectBeatInChapter(chapter, beatTemplate.number, state)) {
        detected = true;
        detectedChapter = chapter;
        strengthScore = calculateBeatStrength(chapter, beatTemplate.position, totalChapters);
        break;
      }
    }

    beats.push({
      beatNumber: beatTemplate.number,
      beatName: beatTemplate.name,
      description: beatTemplate.description,
      idealPosition: beatTemplate.position,
      idealPage: beatTemplate.page,
      chapterNumber: detectedChapter?.number,
      chapterId: detectedChapter?.id,
      detected,
      strengthScore,
      notes: detectedChapter ? `Detected in chapter ${detectedChapter.number}` : undefined,
    });
  });

  return beats;
}

/**
 * Detects if a specific beat is present in a chapter
 */
function detectBeatInChapter(
  chapter: Chapter,
  beatNumber: number,
  state: NovelState
): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const logicAudit = chapter.logicAudit;

  switch (beatNumber) {
    case 1: // Opening Image
      return chapter.number === 1;

    case 2: // Theme Stated
      return detectThemeStated(content, logicAudit);

    case 3: // Setup
      return chapter.number <= 3 && detectSetup(content);

    case 4: // Catalyst
      return detectCatalyst(content, logicAudit);

    case 5: // Debate
      return detectDebate(content, logicAudit);

    case 6: // Break into Two
      return detectBreakIntoTwo(content, logicAudit);

    case 7: // B Story
      return detectBStory(content);

    case 8: // Fun and Games
      return detectFunAndGames(content);

    case 9: // Midpoint
      return detectMidpoint(content, logicAudit);

    case 10: // Bad Guys Close In
      return detectBadGuysCloseIn(content);

    case 11: // All Is Lost
      return detectAllIsLost(content, logicAudit);

    case 12: // Dark Night of the Soul
      return detectDarkNight(content, logicAudit);

    case 13: // Break into Three
      return detectBreakIntoThree(content, logicAudit);

    case 14: // Finale
      return detectFinale(content);

    case 15: // Final Image
      return detectFinalImage(content, state);

    default:
      return false;
  }
}

/**
 * Beat detection functions
 */
function detectThemeStated(content: string, logicAudit?: any): boolean {
  const themeIndicators = ['theme', 'lesson', 'learn', 'truth', 'realize', 'understand'];
  return themeIndicators.some(indicator => content.includes(indicator)) ||
    (logicAudit?.resultingValue?.toLowerCase().includes('realize') ?? false);
}

function detectSetup(content: string): boolean {
  const setupIndicators = ['introduce', 'meet', 'first', 'beginning', 'world', 'character'];
  return setupIndicators.some(indicator => content.includes(indicator));
}

function detectCatalyst(content: string, logicAudit?: any): boolean {
  const catalystIndicators = ['suddenly', 'unexpected', 'change', 'crisis', 'call', 'quest'];
  return catalystIndicators.some(indicator => content.includes(indicator)) ||
    (logicAudit?.causalityType === 'But');
}

function detectDebate(content: string, logicAudit?: any): boolean {
  const debateIndicators = ['debate', 'hesitate', 'doubt', 'wonder', 'consider', 'think about'];
  return debateIndicators.some(indicator => content.includes(indicator));
}

function detectBreakIntoTwo(content: string, logicAudit?: any): boolean {
    const breakIndicators = ['decide', 'commit', 'journey begins', 'leaves', 'enters new'];
    return breakIndicators.some(indicator => content.includes(indicator)) ||
      ((logicAudit?.causalityType === 'Therefore' && content.includes('begin')) ?? false);
}

function detectBStory(content: string): boolean {
  const bStoryIndicators = ['meet', 'love', 'friendship', 'relationship', 'ally', 'companion'];
  return bStoryIndicators.some(indicator => content.includes(indicator));
}

function detectFunAndGames(content: string): boolean {
  const funIndicators = ['adventure', 'explore', 'discover', 'battle', 'challenge', 'triumph'];
  return funIndicators.some(indicator => content.includes(indicator));
}

function detectMidpoint(content: string, logicAudit?: any): boolean {
  const midpointIndicators = ['reveal', 'discover', 'realize', 'truth', 'secret', 'turning point'];
  return midpointIndicators.some(indicator => content.includes(indicator));
}

function detectBadGuysCloseIn(content: string): boolean {
  const badGuysIndicators = ['enemy', 'opponent', 'stronger', 'pursue', 'hunt', 'danger'];
  return badGuysIndicators.some(indicator => content.includes(indicator));
}

function detectAllIsLost(content: string, logicAudit?: any): boolean {
  const allLostIndicators = ['all is lost', 'defeated', 'failed', 'darkest', 'lowest', 'hopeless'];
  return allLostIndicators.some(indicator => content.includes(indicator)) ||
    (logicAudit?.resultingValue?.toLowerCase().includes('defeat') ?? false);
}

function detectDarkNight(content: string, logicAudit?: any): boolean {
  const darkNightIndicators = ['despair', 'lonely', 'broken', 'gives up', 'darkness', 'alone'];
  return darkNightIndicators.some(indicator => content.includes(indicator));
}

function detectBreakIntoThree(content: string, logicAudit?: any): boolean {
    const breakIndicators = ['solution', 'answer', 'realize', 'understand', 'new plan', 'strategy'];
    return breakIndicators.some(indicator => content.includes(indicator)) ||
      ((logicAudit?.causalityType === 'Therefore' && content.includes('solution')) ?? false);
}

function detectFinale(content: string): boolean {
  const finaleIndicators = ['final', 'climax', 'battle', 'confrontation', 'showdown', 'ultimate'];
  return finaleIndicators.some(indicator => content.includes(indicator));
}

function detectFinalImage(content: string, state: NovelState): boolean {
  // Check if this is the last or second-to-last chapter
  const lastChapterNumber = state.chapters.length > 0
    ? Math.max(...state.chapters.map(c => c.number))
    : 0;
  
  // Check if chapter content suggests resolution/ending
  const finalIndicators = ['end', 'conclusion', 'finally', 'aftermath', 'return', 'home'];
  return (state.chapters.some(c => c.number === lastChapterNumber || c.number === lastChapterNumber - 1)) &&
    finalIndicators.some(indicator => content.includes(indicator));
}

/**
 * Calculates strength score for a beat (0-100)
 */
function calculateBeatStrength(
  chapter: Chapter,
  idealPosition: number,
  totalChapters: number
): number {
  const actualPosition = (chapter.number / totalChapters) * 100;
  const distance = Math.abs(actualPosition - idealPosition);
  
  let score = 50; // Base score

  // Score decreases with distance from ideal position
  if (distance <= 5) {
    score = 100;
  } else if (distance <= 10) {
    score = 85;
  } else if (distance <= 20) {
    score = 70;
  } else if (distance <= 30) {
    score = 50;
  } else {
    score = Math.max(20, 50 - (distance - 30) / 2);
  }

  // Boost if logic audit supports beat
  if (chapter.logicAudit) {
    score += 10;
  }

  // Boost if substantial content
  if (chapter.content.length > 1000) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall beat sheet score (0-100)
 */
function calculateBeatSheetScore(beats: SaveTheCatBeat[]): number {
  if (beats.length === 0) return 0;

  const detectedBeats = beats.filter(b => b.detected);
  const detectionRate = detectedBeats.length / beats.length;
  const averageStrength = detectedBeats.length > 0
    ? detectedBeats.reduce((sum, beat) => sum + beat.strengthScore, 0) / detectedBeats.length
    : 0;

  // Combine detection rate (60%) and average strength (40%)
  return Math.round(detectionRate * 60 + (averageStrength / 100) * 40);
}

/**
 * Generates recommendations for beat sheet
 */
function generateBeatSheetRecommendations(
  beats: SaveTheCatBeat[],
  missingBeats: SaveTheCatBeat[],
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  if (missingBeats.length > 0) {
    const criticalMissing = missingBeats.filter(b => [4, 6, 9, 11, 14].includes(b.beatNumber));
    if (criticalMissing.length > 0) {
      recommendations.push(`Critical beats missing: ${criticalMissing.map(b => b.beatName).join(', ')}. These are essential for story structure.`);
    }

    if (missingBeats.length > criticalMissing.length) {
      const otherMissing = missingBeats.filter(b => !criticalMissing.includes(b));
      recommendations.push(`Additional missing beats: ${otherMissing.map(b => b.beatName).join(', ')}.`);
    }
  }

  // Check beat timing
  beats.forEach(beat => {
    if (beat.detected && beat.chapterNumber) {
      const distance = Math.abs(beat.idealPosition - ((beat.chapterNumber / (beats.length > 0 ? Math.max(...beats.filter(b => b.chapterNumber).map(b => b.chapterNumber!)) : 100)) * 100));
      if (distance > 20) {
        recommendations.push(`${beat.beatName} detected at ${beat.idealPosition.toFixed(0)}% but ideally at ${beat.idealPosition.toFixed(0)}%. Consider adjusting timing.`);
      }
    }
  });

  if (overallScore < 60) {
    recommendations.push('Overall beat sheet score is below 60. Review story structure and ensure key beats are present.');
  } else if (overallScore >= 80) {
    recommendations.push('Excellent beat sheet structure! The story follows Save the Cat principles well.');
  }

  return recommendations;
}
