import { NovelState, Chapter, HeroJourneyStage, Character } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Hero's Journey Tracker
 * Tracks the 12 stages of the Hero's Journey (Joseph Campbell's monomyth)
 * adapted for novel writing analysis.
 */

export interface HeroJourneyAnalysis {
  stages: HeroJourneyStage[];
  completionPercentage: number;
  missingStages: number[];
  weakStages: HeroJourneyStage[];
  recommendations: string[];
  overallJourneyScore: number; // 0-100
}

/**
 * The 12 stages of the Hero's Journey
 */
const HERO_JOURNEY_STAGES = [
  { number: 1, name: 'Ordinary World', description: 'The hero\'s normal life before the adventure' },
  { number: 2, name: 'Call to Adventure', description: 'The hero receives a challenge or quest' },
  { number: 3, name: 'Refusal of Call', description: 'The hero hesitates or refuses the call' },
  { number: 4, name: 'Meeting the Mentor', description: 'The hero meets a guide or teacher' },
  { number: 5, name: 'Crossing the Threshold', description: 'The hero leaves the ordinary world' },
  { number: 6, name: 'Tests, Allies, and Enemies', description: 'The hero faces challenges and meets companions' },
  { number: 7, name: 'Approach to the Inmost Cave', description: 'The hero approaches the greatest challenge' },
  { number: 8, name: 'Ordeal', description: 'The hero faces the greatest fear or challenge' },
  { number: 9, name: 'Reward (Seizing the Sword)', description: 'The hero gains something valuable' },
  { number: 10, name: 'The Road Back', description: 'The hero begins the journey home' },
  { number: 11, name: 'Resurrection', description: 'The hero faces a final test' },
  { number: 12, name: 'Return with the Elixir', description: 'The hero returns changed with a gift' },
];

/**
 * Analyzes the hero's journey structure of a novel
 */
export function analyzeHeroJourney(state: NovelState): HeroJourneyAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  
  if (!protagonist) {
    return {
      stages: [],
      completionPercentage: 0,
      missingStages: HERO_JOURNEY_STAGES.map(s => s.number),
      weakStages: [],
      recommendations: ['No protagonist found. The Hero\'s Journey requires a main character.'],
      overallJourneyScore: 0,
    };
  }

  // Check for existing stages in state
  let stages: HeroJourneyStage[] = [];
  if (state.heroJourneyStages && state.heroJourneyStages.length > 0) {
    stages = [...state.heroJourneyStages];
  } else {
    // Detect stages from chapters
    stages = detectHeroJourneyStages(chapters, state, protagonist);
  }

  // Analyze completion
  const completedStages = stages.filter(s => s.isComplete);
  const completionPercentage = (completedStages.length / 12) * 100;

  // Find missing stages
  const detectedStageNumbers = stages.map(s => s.stageNumber);
  const missingStages = HERO_JOURNEY_STAGES
    .filter(s => !detectedStageNumbers.includes(s.number))
    .map(s => s.number);

  // Find weak stages (low quality score)
  const weakStages = stages.filter(s => s.qualityScore < 50);

  // Generate recommendations
  const recommendations = generateHeroJourneyRecommendations(
    stages,
    missingStages,
    weakStages,
    completionPercentage
  );

  // Calculate overall journey score
  const overallJourneyScore = calculateJourneyScore(stages, completionPercentage);

  return {
    stages,
    completionPercentage,
    missingStages,
    weakStages,
    recommendations,
    overallJourneyScore,
  };
}

/**
 * Detects hero's journey stages from chapters
 */
function detectHeroJourneyStages(
  chapters: Chapter[],
  state: NovelState,
  protagonist: Character
): HeroJourneyStage[] {
  const stages: HeroJourneyStage[] = [];
  const totalChapters = chapters.length;

  if (totalChapters === 0) {
    return stages;
  }

  // Stage 1: Ordinary World (first few chapters)
  if (chapters.length > 0) {
    const ordinaryWorldChapter = chapters[0];
    stages.push(createHeroJourneyStage(
      state.id,
      ordinaryWorldChapter,
      protagonist.id,
      1,
      'Ordinary World',
      true,
      calculateStageQuality(ordinaryWorldChapter, 1, totalChapters)
    ));
  }

  // Stage 2: Call to Adventure (early chapters, ~5-10%)
  const callToAdventureRange = Math.ceil(totalChapters * 0.1);
  const callChapters = chapters.slice(1, Math.min(callToAdventureRange + 1, chapters.length));
  for (const chapter of callChapters) {
    if (detectCallToAdventure(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        2,
        'Call to Adventure',
        true,
        calculateStageQuality(chapter, 2, totalChapters)
      ));
      break;
    }
  }

  // Stage 3: Refusal of Call (immediately after call)
  const refusalChapters = chapters.slice(1, Math.min(callToAdventureRange + 3, chapters.length));
  for (const chapter of refusalChapters) {
    if (detectRefusalOfCall(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        3,
        'Refusal of Call',
        true,
        calculateStageQuality(chapter, 3, totalChapters)
      ));
      break;
    }
  }

  // Stage 4: Meeting the Mentor (early-mid story, ~10-25%)
  const mentorRange = { start: Math.ceil(totalChapters * 0.1), end: Math.ceil(totalChapters * 0.25) };
  for (let i = mentorRange.start; i < Math.min(mentorRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectMentorMeeting(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        4,
        'Meeting the Mentor',
        true,
        calculateStageQuality(chapter, 4, totalChapters)
      ));
      break;
    }
  }

  // Stage 5: Crossing the Threshold (end of Act 1, ~25%)
  const thresholdRange = { start: Math.ceil(totalChapters * 0.2), end: Math.ceil(totalChapters * 0.3) };
  for (let i = thresholdRange.start; i < Math.min(thresholdRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectCrossingThreshold(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        5,
        'Crossing the Threshold',
        true,
        calculateStageQuality(chapter, 5, totalChapters)
      ));
      break;
    }
  }

  // Stage 6: Tests, Allies, and Enemies (Act 2, ~25-50%)
  const testsRange = { start: Math.ceil(totalChapters * 0.25), end: Math.ceil(totalChapters * 0.5) };
  for (let i = testsRange.start; i < Math.min(testsRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectTestsAlliesEnemies(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        6,
        'Tests, Allies, and Enemies',
        true,
        calculateStageQuality(chapter, 6, totalChapters)
      ));
      break;
    }
  }

  // Stage 7: Approach to the Inmost Cave (late Act 2, ~45-55%)
  const approachRange = { start: Math.ceil(totalChapters * 0.45), end: Math.ceil(totalChapters * 0.55) };
  for (let i = approachRange.start; i < Math.min(approachRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectApproachInmostCave(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        7,
        'Approach to the Inmost Cave',
        true,
        calculateStageQuality(chapter, 7, totalChapters)
      ));
      break;
    }
  }

  // Stage 8: Ordeal (midpoint, ~50%)
  const ordealRange = { start: Math.ceil(totalChapters * 0.45), end: Math.ceil(totalChapters * 0.55) };
  for (let i = ordealRange.start; i < Math.min(ordealRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectOrdeal(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        8,
        'Ordeal',
        true,
        calculateStageQuality(chapter, 8, totalChapters)
      ));
      break;
    }
  }

  // Stage 9: Reward (after ordeal, ~50-60%)
  const rewardRange = { start: Math.ceil(totalChapters * 0.5), end: Math.ceil(totalChapters * 0.6) };
  for (let i = rewardRange.start; i < Math.min(rewardRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectReward(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        9,
        'Reward (Seizing the Sword)',
        true,
        calculateStageQuality(chapter, 9, totalChapters)
      ));
      break;
    }
  }

  // Stage 10: The Road Back (late Act 2/early Act 3, ~70-80%)
  const roadBackRange = { start: Math.ceil(totalChapters * 0.7), end: Math.ceil(totalChapters * 0.8) };
  for (let i = roadBackRange.start; i < Math.min(roadBackRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectRoadBack(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        10,
        'The Road Back',
        true,
        calculateStageQuality(chapter, 10, totalChapters)
      ));
      break;
    }
  }

  // Stage 11: Resurrection (climax, ~85-90%)
  const resurrectionRange = { start: Math.ceil(totalChapters * 0.85), end: Math.ceil(totalChapters * 0.9) };
  for (let i = resurrectionRange.start; i < Math.min(resurrectionRange.end + 1, chapters.length); i++) {
    const chapter = chapters[i];
    if (detectResurrection(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        11,
        'Resurrection',
        true,
        calculateStageQuality(chapter, 11, totalChapters)
      ));
      break;
    }
  }

  // Stage 12: Return with the Elixir (resolution, ~90-100%)
  const returnRange = { start: Math.ceil(totalChapters * 0.9), end: chapters.length };
  for (let i = returnRange.start; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (detectReturnWithElixir(chapter)) {
      stages.push(createHeroJourneyStage(
        state.id,
        chapter,
        protagonist.id,
        12,
        'Return with the Elixir',
        true,
        calculateStageQuality(chapter, 12, totalChapters)
      ));
      break;
    }
  }

  return stages;
}

/**
 * Detection functions for each stage
 */
function detectCallToAdventure(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'call', 'quest', 'mission', 'invitation', 'summons',
    'challenge', 'adventure', 'journey begins', 'must go'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectRefusalOfCall(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'refuse', 'hesitate', 'decline', 'doubt', 'uncertain',
    'not ready', 'cannot', 'unwilling', 'afraid to'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectMentorMeeting(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'mentor', 'teacher', 'master', 'guide', 'elder',
    'wise', 'instructor', 'training', 'learn from'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectCrossingThreshold(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'leaves', 'enters', 'new world', 'unknown', 'beyond',
    'cross', 'threshold', 'point of no return', 'journey begins'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectTestsAlliesEnemies(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const hasTests = ['test', 'challenge', 'trial', 'obstacle'].some(i => content.includes(i));
  const hasAllies = ['ally', 'friend', 'companion', 'partner', 'team'].some(i => content.includes(i));
  const hasEnemies = ['enemy', 'foe', 'opponent', 'antagonist'].some(i => content.includes(i));
  return hasTests || hasAllies || hasEnemies;
}

function detectApproachInmostCave(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'approaching', 'nearing', 'final challenge', 'greatest danger',
    'innermost', 'deepest', 'ultimate test', 'prepare for battle'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectOrdeal(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'ordeal', 'greatest fear', 'darkest moment', 'all is lost',
    'final test', 'ultimate challenge', 'life or death'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectReward(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'reward', 'gain', 'achieve', 'obtain', 'treasure',
    'power', 'knowledge', 'victory', 'elixir', 'sword'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectRoadBack(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'return', 'journey home', 'back', 'going back',
    'heading back', 'retreat', 'withdraw'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectResurrection(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'resurrect', 'reborn', 'transformed', 'final test',
    'last challenge', 'rise again', 'final battle'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

function detectReturnWithElixir(chapter: Chapter): boolean {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const indicators = [
    'return', 'home', 'changed', 'gift', 'elixir',
    'wisdom', 'power', 'blessing', 'transformation'
  ];
  return indicators.some(indicator => content.includes(indicator));
}

/**
 * Creates a hero journey stage object
 */
function createHeroJourneyStage(
  novelId: string,
  chapter: Chapter,
  characterId: string,
  stageNumber: number,
  stageName: string,
  isComplete: boolean,
  qualityScore: number
): HeroJourneyStage {
  return {
    id: generateUUID(),
    novelId,
    stageNumber,
    stageName,
    chapterNumber: chapter.number,
    chapterId: chapter.id,
    characterId,
    isComplete,
    qualityScore,
    notes: `Detected in chapter ${chapter.number}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Calculates quality score for a stage (0-100)
 */
function calculateStageQuality(
  chapter: Chapter,
  stageNumber: number,
  totalChapters: number
): number {
  let score = 50; // Base score

  // Expected positions for stages (as percentage of story)
  const expectedPositions: Record<number, number> = {
    1: 2,   // Ordinary World - very early
    2: 8,   // Call to Adventure - early
    3: 10,  // Refusal - immediately after call
    4: 15,  // Mentor - early-mid
    5: 25,  // Threshold - end of Act 1
    6: 37,  // Tests - mid Act 2
    7: 50,  // Approach - midpoint
    8: 50,  // Ordeal - midpoint
    9: 55,  // Reward - after ordeal
    10: 75, // Road Back - late Act 2
    11: 87, // Resurrection - climax
    12: 95, // Return - resolution
  };

  const expectedPosition = expectedPositions[stageNumber];
  if (expectedPosition) {
    const actualPosition = (chapter.number / totalChapters) * 100;
    const distance = Math.abs(actualPosition - expectedPosition);
    
    // Score decreases with distance from expected position
    // Allow 10% deviation before significant penalty
    if (distance <= 10) {
      score += 30;
    } else if (distance <= 20) {
      score += 20;
    } else {
      score += Math.max(0, 10 - (distance - 20) / 2);
    }
  }

  // Boost score if chapter has logic audit
  if (chapter.logicAudit) {
    score += 10;
  }

  // Boost score if chapter has substantial content
  if (chapter.content.length > 1000) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall journey score (0-100)
 */
function calculateJourneyScore(
  stages: HeroJourneyStage[],
  completionPercentage: number
): number {
  if (stages.length === 0) return 0;

  // Average quality score of detected stages
  const averageQuality = stages.reduce((sum, stage) => sum + stage.qualityScore, 0) / stages.length;

  // Completion factor (how many stages found)
  const completionFactor = completionPercentage / 100;

  // Combine quality and completion
  return Math.round(averageQuality * 0.7 + completionFactor * 100 * 0.3);
}

/**
 * Generates recommendations for hero's journey
 */
function generateHeroJourneyRecommendations(
  stages: HeroJourneyStage[],
  missingStages: number[],
  weakStages: HeroJourneyStage[],
  completionPercentage: number
): string[] {
  const recommendations: string[] = [];

  if (completionPercentage < 50) {
    recommendations.push(`Only ${completionPercentage.toFixed(0)}% of hero's journey stages detected. Consider adding missing stages.`);
  }

  if (missingStages.length > 0) {
    const missingNames = missingStages.map(num => {
      const stage = HERO_JOURNEY_STAGES.find(s => s.number === num);
      return stage ? stage.name : `Stage ${num}`;
    });
    recommendations.push(`Missing stages: ${missingNames.join(', ')}. Consider incorporating these elements.`);
  }

  if (weakStages.length > 0) {
    const weakNames = weakStages.map(s => s.stageName);
    recommendations.push(`Weak stages detected: ${weakNames.join(', ')}. Consider strengthening these moments.`);
  }

  if (completionPercentage >= 80 && stages.every(s => s.qualityScore >= 70)) {
    recommendations.push('Excellent hero\'s journey structure! The story follows the classic pattern well.');
  }

  return recommendations;
}

/**
 * Gets hero journey stage information by number
 */
export function getHeroJourneyStageInfo(stageNumber: number) {
  return HERO_JOURNEY_STAGES.find(s => s.number === stageNumber);
}

/**
 * Gets all hero journey stage information
 */
export function getAllHeroJourneyStages() {
  return HERO_JOURNEY_STAGES;
}
