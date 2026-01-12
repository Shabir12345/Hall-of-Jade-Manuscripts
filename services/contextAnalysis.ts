import { NovelState, Chapter, Character, WritingStyleMetrics, CharacterDevelopmentMetrics, StoryProgressionMetrics, StyleProfile, LogicAudit } from '../types';
import { textContainsCharacterName } from '../utils/characterNameMatching';

/**
 * Context Analysis Engine
 * Analyzes existing chapters to extract writing style, character development, and story progression patterns
 */

type NovelContextAnalysis = {
  styleProfile: StyleProfile;
  characterDevelopment: CharacterDevelopmentMetrics[];
  storyProgression: StoryProgressionMetrics;
};

// Simple single-entry memoization (fast + safe, avoids unbounded memory growth)
let lastNovelContextKey: string | null = null;
let lastNovelContextValue: NovelContextAnalysis | null = null;

/**
 * Analyzes writing style from existing chapters
 */
export function analyzeWritingStyle(chapters: Chapter[]): WritingStyleMetrics {
  if (chapters.length === 0) {
    return {
      averageSentenceLength: 15,
      vocabularyComplexity: 0.3,
      genreSpecificTerms: [],
      tone: 'mixed',
      descriptiveRatio: 0.4,
      dialogueRatio: 0.3,
      pacingPattern: 'medium',
      narrativePerspective: 'third',
    };
  }

  const allContent = chapters.map(c => c.content).join(' ');
  const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = allContent.split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  
  // Calculate average sentence length
  const averageSentenceLength = sentences.length > 0 
    ? words.length / sentences.length 
    : 15;

  // Vocabulary complexity (unique words / total words)
  const vocabularyComplexity = words.length > 0 
    ? uniqueWords.size / words.length 
    : 0.3;

  // Extract genre-specific terms (Xianxia/Xuanhuan common terms)
  const genreTerms = [
    'qi', 'cultivation', 'realm', 'dantian', 'meridian', 'tribulation',
    'sect', 'elder', 'disciple', 'immortal', 'dao', 'technique', 'artifact',
    'spiritual', 'essence', 'foundation', 'core', 'nascent', 'divine',
    'celestial', 'heavenly', 'mortal', 'transcend', 'ascend', 'breakthrough'
  ];
  const foundGenreTerms = genreTerms.filter(term => 
    allContent.toLowerCase().includes(term)
  );

  // Determine tone (simplified: check for formal vs casual indicators)
  const formalIndicators = ['thus', 'therefore', 'hence', 'whereas', 'furthermore', 'moreover'];
  const casualIndicators = ["'", "don't", "can't", "won't", "gonna", "wanna"];
  const formalCount = formalIndicators.reduce((count, indicator) => 
    count + (allContent.toLowerCase().includes(indicator) ? 1 : 0), 0
  );
  const casualCount = casualIndicators.reduce((count, indicator) => 
    count + (allContent.toLowerCase().includes(indicator) ? 1 : 0), 0
  );
  const tone: 'formal' | 'casual' | 'mixed' = 
    formalCount > casualCount ? 'formal' : 
    casualCount > formalCount ? 'casual' : 'mixed';

  // Descriptive ratio (sentences with descriptive adjectives/adverbs)
  const descriptiveWords = ['beautiful', 'magnificent', 'ancient', 'ethereal', 'vast', 'towering', 'glowing', 'radiant'];
  const descriptiveSentences = sentences.filter(s => 
    descriptiveWords.some(word => s.toLowerCase().includes(word))
  ).length;
  const descriptiveRatio = sentences.length > 0 ? descriptiveSentences / sentences.length : 0.4;

  // Dialogue ratio (content within quotes)
  const dialogueMatches = allContent.match(/["'""].*?["'"]/g) || [];
  const dialogueLength = dialogueMatches.join('').length;
  const dialogueRatio = allContent.length > 0 ? dialogueLength / allContent.length : 0.3;

  // Pacing pattern (based on sentence length and chapter length)
  const avgChapterLength = chapters.reduce((sum, c) => sum + c.content.length, 0) / chapters.length;
  let pacingPattern: 'fast' | 'medium' | 'slow' = 'medium';
  if (averageSentenceLength < 12 && avgChapterLength < 5000) {
    pacingPattern = 'fast';
  } else if (averageSentenceLength > 20 || avgChapterLength > 10000) {
    pacingPattern = 'slow';
  }

  // Narrative perspective (check for first vs third person)
  const firstPersonIndicators = /\b(I|me|my|mine|we|us|our)\b/gi;
  const thirdPersonIndicators = /\b(he|she|they|him|her|them|his|hers|their)\b/gi;
  const firstPersonCount = (allContent.match(firstPersonIndicators) || []).length;
  const thirdPersonCount = (allContent.match(thirdPersonIndicators) || []).length;
  const narrativePerspective: 'first' | 'third' | 'mixed' = 
    firstPersonCount > thirdPersonCount * 2 ? 'first' :
    thirdPersonCount > firstPersonCount * 2 ? 'third' : 'mixed';

  return {
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    vocabularyComplexity: Math.round(vocabularyComplexity * 100) / 100,
    genreSpecificTerms: foundGenreTerms,
    tone,
    descriptiveRatio: Math.round(descriptiveRatio * 100) / 100,
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    pacingPattern,
    narrativePerspective,
  };
}

/**
 * Analyzes character development across chapters
 */
export function analyzeCharacterDevelopment(
  characters: Character[],
  chapters: Chapter[],
  worldBible: Array<{ category: string; content: string }> = []
): CharacterDevelopmentMetrics[] {
  return characters.map(char => {
    // Find chapters mentioning this character
    // Uses smart name matching that handles both proper names and descriptive names
    const characterMentions = chapters.filter(c => {
      // Check chapter content
      if (c.content && textContainsCharacterName(c.content, char.name)) {
        return true;
      }
      
      // Check chapter summary
      if (c.summary && textContainsCharacterName(c.summary, char.name)) {
        return true;
      }
      
      // Check all scenes in the chapter
      if (c.scenes && c.scenes.length > 0) {
        for (const scene of c.scenes) {
          // Check scene content
          if (scene.content && textContainsCharacterName(scene.content, char.name)) {
            return true;
          }
          // Check scene summary
          if (scene.summary && textContainsCharacterName(scene.summary, char.name)) {
            return true;
          }
        }
      }
      
      return false;
    });

    // Determine arc stage
    const mentionCount = characterMentions.length;
    let stage: 'introduction' | 'development' | 'conflict' | 'resolution' | 'transformation';
    if (mentionCount === 0) {
      stage = 'introduction';
    } else if (mentionCount < 3) {
      stage = 'development';
    } else if (mentionCount < 7) {
      stage = 'conflict';
    } else if (mentionCount < 10) {
      stage = 'resolution';
    } else {
      stage = 'transformation';
    }

    // Extract milestones from summaries
    const milestones = characterMentions
      .slice(0, 5)
      .map(c => c.summary || c.title)
      .filter(s => s.length > 0);

    // Analyze relationship changes
    const relationshipChanges = char.relationships.map(rel => ({
      targetCharacterId: rel.characterId,
      relationshipType: rel.type,
      evolution: rel.history || 'No history recorded',
    }));

    // Analyze power progression
    // Extract cultivation levels from world bible if available, otherwise use generic progression
    const powerLevelsEntry = worldBible.find(e => e.category === 'PowerLevels');
    const cultivationLevels = powerLevelsEntry 
      ? powerLevelsEntry.content.split(/[,;]\s*/).filter(level => level.trim().length > 0)
      : ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6']; // Generic fallback
    const currentLevel = cultivationLevels.findIndex(level => 
      char.currentCultivation.toLowerCase().includes(level.toLowerCase())
    );
    const trajectory: 'rising' | 'plateau' | 'declining' = 
      currentLevel >= 3 ? 'rising' : 
      currentLevel >= 1 ? 'plateau' : 'declining';

    const breakthroughs = char.notes
      .split(/[.!?]/)
      .filter(s => s.toLowerCase().includes('breakthrough') || s.toLowerCase().includes('ascend'))
      .slice(0, 3);

    // Voice consistency (simplified: check if character appears consistently)
    const voiceConsistency = characterMentions.length > 0 
      ? Math.min(1, characterMentions.length / chapters.length * 5)
      : 0;

    return {
      characterId: char.id,
      characterName: char.name,
      arcProgression: {
        stage,
        milestones,
      },
      relationshipChanges,
      powerProgression: {
        current: char.currentCultivation,
        trajectory,
        breakthroughs,
      },
      voiceConsistency: Math.round(voiceConsistency * 100) / 100,
    };
  });
}

/**
 * Analyzes story progression metrics
 */
export function analyzeStoryProgression(
  chapters: Chapter[],
  arcs: { id: string; title: string; description: string; status: string }[]
): StoryProgressionMetrics {
  // Extract chapter deltas from logic audits
  const chapterDeltas = chapters
    .filter(c => c.logicAudit)
    .map(c => ({
      chapterNumber: c.number,
      valueShift: c.logicAudit!.resultingValue || 'Unknown',
      tensionLevel: determineTensionLevel(c.logicAudit!, c.content),
      causalityType: c.logicAudit!.causalityType,
    }));

  // Determine current tension level and trend
  const recentDeltas = chapterDeltas.slice(-5);
  const recentTensionLevels = recentDeltas.map(d => d.tensionLevel);
  const tensionCounts = {
    low: recentTensionLevels.filter(t => t === 'low').length,
    medium: recentTensionLevels.filter(t => t === 'medium').length,
    high: recentTensionLevels.filter(t => t === 'high').length,
    peak: recentTensionLevels.filter(t => t === 'peak').length,
  };
  
  let currentLevel: 'low' | 'medium' | 'high' | 'peak' = 'medium';
  if (tensionCounts.peak > 0) currentLevel = 'peak';
  else if (tensionCounts.high > tensionCounts.low) currentLevel = 'high';
  else if (tensionCounts.low > tensionCounts.high) currentLevel = 'low';

  const trend: 'rising' | 'falling' | 'stable' = 
    recentTensionLevels.length >= 2 && 
    recentTensionLevels[recentTensionLevels.length - 1] === 'peak' &&
    recentTensionLevels[recentTensionLevels.length - 2] !== 'peak'
      ? 'rising'
      : recentTensionLevels.length >= 2 &&
        recentTensionLevels[recentTensionLevels.length - 1] === 'low' &&
        recentTensionLevels[recentTensionLevels.length - 2] !== 'low'
      ? 'falling'
      : 'stable';

  // Identify plot beats
  const plotBeats = chapters
    .filter(c => c.logicAudit)
    .map((c, index) => {
      const audit = c.logicAudit!;
      let type: 'setup' | 'confrontation' | 'climax' | 'resolution';
      
      if (audit.causalityType === 'But' && audit.theFriction.toLowerCase().includes('conflict')) {
        type = 'confrontation';
      } else if (audit.causalityType === 'But' && audit.theFriction.toLowerCase().includes('climax')) {
        type = 'climax';
      } else if (audit.causalityType === 'Therefore' && audit.resultingValue.toLowerCase().includes('resolve')) {
        type = 'resolution';
      } else {
        type = 'setup';
      }

      return {
        type,
        chapterNumber: c.number,
        description: `${audit.startingValue} → ${audit.resultingValue}`,
      };
    })
    .slice(0, 10);

  // Analyze arc structure
  const arcStructure = arcs.map(arc => {
    const arcChapters = chapters.filter(c => 
      c.summary.toLowerCase().includes(arc.title.toLowerCase()) ||
      c.content.toLowerCase().includes(arc.title.toLowerCase())
    );
    const totalChapters = chapters.length;
    const completionPercentage = totalChapters > 0 
      ? Math.min(100, (arcChapters.length / totalChapters) * 100)
      : 0;

    let stage: 'beginning' | 'middle' | 'end';
    if (completionPercentage < 30) {
      stage = 'beginning';
    } else if (completionPercentage < 70) {
      stage = 'middle';
    } else {
      stage = 'end';
    }

    return {
      arcId: arc.id,
      stage,
      completionPercentage: Math.round(completionPercentage),
    };
  });

  return {
    chapterDeltas,
    tensionCurve: {
      currentLevel,
      trend,
    },
    plotBeats,
    arcStructure,
  };
}

/**
 * Determines tension level from logic audit and content
 */
function determineTensionLevel(audit: LogicAudit, content: string): 'low' | 'medium' | 'high' | 'peak' {
  const tensionKeywords = {
    peak: ['death', 'betrayal', 'catastrophe', 'ultimate', 'final', 'doom', 'extinction'],
    high: ['danger', 'threat', 'enemy', 'attack', 'battle', 'crisis', 'conflict'],
    medium: ['challenge', 'obstacle', 'difficulty', 'problem', 'trouble'],
    low: ['peace', 'calm', 'rest', 'training', 'preparation', 'planning'],
  };

  const contentLower = content.toLowerCase();
  const auditText = `${audit.theFriction} ${audit.theChoice}`.toLowerCase();

  for (const keyword of tensionKeywords.peak) {
    if (contentLower.includes(keyword) || auditText.includes(keyword)) {
      return 'peak';
    }
  }
  for (const keyword of tensionKeywords.high) {
    if (contentLower.includes(keyword) || auditText.includes(keyword)) {
      return 'high';
    }
  }
  for (const keyword of tensionKeywords.medium) {
    if (contentLower.includes(keyword) || auditText.includes(keyword)) {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Creates a complete style profile from chapters
 */
export function createStyleProfile(chapters: Chapter[]): StyleProfile {
  const metrics = analyzeWritingStyle(chapters);
  
  // Extract sample passages (first 200 chars of each chapter, up to 5)
  const samplePassages = chapters
    .slice(0, 5)
    .map(c => c.content.substring(0, 200).trim())
    .filter(p => p.length > 0);

  // Generate style guidelines
  const styleGuidelines: string[] = [];
  
  if (metrics.tone === 'formal') {
    styleGuidelines.push('Maintain formal, elevated language throughout');
  } else if (metrics.tone === 'casual') {
    styleGuidelines.push('Use natural, conversational language');
  } else {
    styleGuidelines.push('Balance formal and casual tones appropriately');
  }

  if (metrics.averageSentenceLength < 12) {
    styleGuidelines.push('Use shorter, punchier sentences for action and tension');
  } else if (metrics.averageSentenceLength > 20) {
    styleGuidelines.push('Use longer, more descriptive sentences for world-building and atmosphere');
  }

  if (metrics.descriptiveRatio > 0.5) {
    styleGuidelines.push('Maintain rich descriptive language and vivid imagery');
  }

  if (metrics.dialogueRatio > 0.4) {
    styleGuidelines.push('Keep dialogue-driven scenes balanced with narrative');
  }

  if (metrics.pacingPattern === 'fast') {
    styleGuidelines.push('Maintain quick pacing with rapid scene transitions');
  } else if (metrics.pacingPattern === 'slow') {
    styleGuidelines.push('Allow for slower, more contemplative pacing');
  }

  if (metrics.narrativePerspective === 'first') {
    styleGuidelines.push('Maintain first-person narrative perspective');
  } else if (metrics.narrativePerspective === 'third') {
    styleGuidelines.push('Maintain third-person narrative perspective');
  }

  // Calculate consistency score (simplified: based on chapter count and variance)
  const consistencyScore = chapters.length > 0 
    ? Math.min(1, chapters.length / 10)
    : 0;

  return {
    metrics,
    samplePassages,
    styleGuidelines,
    consistencyScore: Math.round(consistencyScore * 100) / 100,
  };
}

/**
 * Analyzes the complete novel state and returns all context metrics
 */
export function analyzeNovelContext(state: NovelState): {
  styleProfile: StyleProfile;
  characterDevelopment: CharacterDevelopmentMetrics[];
  storyProgression: StoryProgressionMetrics;
} {
  const key = `${state.id}:${state.updatedAt}:${state.chapters.length}:${state.characterCodex.length}:${state.plotLedger.length}`;
  if (lastNovelContextKey === key && lastNovelContextValue) {
    return lastNovelContextValue;
  }

  const styleProfile = createStyleProfile(state.chapters);
  const characterDevelopment = analyzeCharacterDevelopment(state.characterCodex, state.chapters, state.worldBible);
  const storyProgression = analyzeStoryProgression(state.chapters, state.plotLedger);

  const analysis: NovelContextAnalysis = {
    styleProfile,
    characterDevelopment,
    storyProgression,
  };

  lastNovelContextKey = key;
  lastNovelContextValue = analysis;

  return analysis;
}

/**
 * Analyzes how well chapters connect to each other
 * Returns metrics on transition quality and continuity
 */
export function analyzeChapterTransitions(chapters: Chapter[]): {
  transitionScores: Array<{
    fromChapter: number;
    toChapter: number;
    score: number; // 0-1, higher is better
    issues: string[];
  }>;
  averageTransitionScore: number;
  continuityIssues: string[];
} {
  if (chapters.length < 2) {
    return {
      transitionScores: [],
      averageTransitionScore: 1.0,
      continuityIssues: [],
    };
  }

  const transitionScores: Array<{
    fromChapter: number;
    toChapter: number;
    score: number;
    issues: string[];
  }> = [];

  for (let i = 1; i < chapters.length; i++) {
    const prevChapter = chapters[i - 1];
    const currChapter = chapters[i];
    const issues: string[] = [];
    let score = 1.0;

    // Check if current chapter references previous chapter's ending
    const prevEnding = prevChapter.content.split(/\s+/).slice(-50).join(' ').toLowerCase();
    const currBeginning = currChapter.content.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
    
    // Check for character name continuity
    const prevCharacters = extractCharacterNames(prevEnding);
    const currCharacters = extractCharacterNames(currBeginning);
    const characterOverlap = prevCharacters.filter(c => currCharacters.includes(c));
    
    if (characterOverlap.length === 0 && prevCharacters.length > 0) {
      issues.push('No character continuity detected between chapters');
      score -= 0.3;
    }

    // Check for location continuity
    const prevLocations = extractLocations(prevEnding);
    const currLocations = extractLocations(currBeginning);
    const locationOverlap = prevLocations.filter(l => currLocations.includes(l));
    
    if (locationOverlap.length === 0 && prevLocations.length > 0) {
      issues.push('Possible location discontinuity');
      score -= 0.2;
    }

    // Check for logic audit continuity
    if (prevChapter.logicAudit && currChapter.logicAudit) {
      const prevResult = prevChapter.logicAudit.resultingValue.toLowerCase();
      const currStart = currChapter.logicAudit.startingValue.toLowerCase();
      
      // Check if there's semantic overlap
      const prevWords = new Set(prevResult.split(/\s+/));
      const currWords = new Set(currStart.split(/\s+/));
      const overlap = Array.from(prevWords).filter(w => currWords.has(w) && w.length > 3);
      
      if (overlap.length < 2) {
        issues.push('Weak logic audit continuity - starting value doesn\'t clearly connect to previous resulting value');
        score -= 0.2;
      }
    } else if (prevChapter.logicAudit && !currChapter.logicAudit) {
      issues.push('Missing logic audit in current chapter');
      score -= 0.1;
    }

    // Check for repetition (bad sign)
    const prevKeyPhrases = extractKeyPhrases(prevEnding);
    const currKeyPhrases = extractKeyPhrases(currBeginning);
    const repeatedPhrases = prevKeyPhrases.filter(p => currKeyPhrases.includes(p));
    
    if (repeatedPhrases.length > 3) {
      issues.push('Excessive repetition of phrases from previous chapter ending');
      score -= 0.2;
    }

    score = Math.max(0, score); // Ensure score doesn't go below 0

    transitionScores.push({
      fromChapter: prevChapter.number,
      toChapter: currChapter.number,
      score,
      issues,
    });
  }

  const averageTransitionScore = transitionScores.length > 0
    ? transitionScores.reduce((sum, t) => sum + t.score, 0) / transitionScores.length
    : 1.0;

  const continuityIssues: string[] = [];
  transitionScores.forEach(transition => {
    if (transition.score < 0.7) {
      continuityIssues.push(
        `Ch ${transition.fromChapter} → Ch ${transition.toChapter}: ${transition.issues.join('; ')}`
      );
    }
  });

  return {
    transitionScores,
    averageTransitionScore,
    continuityIssues,
  };
}

/**
 * Extracts unresolved plot threads from chapters
 */
export function extractUnresolvedThreads(chapters: Chapter[]): Array<{
  description: string;
  introducedInChapter: number;
  lastMentionedInChapter?: number;
  urgency: 'high' | 'medium' | 'low';
}> {
  const threads: Array<{
    description: string;
    introducedInChapter: number;
    lastMentionedInChapter?: number;
    urgency: 'high' | 'medium' | 'low';
  }> = [];

  chapters.forEach((chapter, index) => {
    const content = chapter.content.toLowerCase();
    
    // Look for question patterns
    const questionPatterns = [
      /what (will|should|might|could) (happen|occur|take place)/gi,
      /how (will|should|can|might)/gi,
      /why (did|does|will|should)/gi,
      /(who|where|when) (will|should|might|could)/gi,
    ];

    questionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          threads.push({
            description: match.trim(),
            introducedInChapter: chapter.number,
            lastMentionedInChapter: chapter.number,
            urgency: index >= chapters.length - 3 ? 'high' : 'medium',
          });
        });
      }
    });

    // Look for unresolved conflicts
    if (chapter.logicAudit && chapter.logicAudit.causalityType === 'But') {
      const conflictKeywords = ['however', 'but', 'yet', 'still', 'unresolved', 'pending', 'uncertain'];
      if (conflictKeywords.some(kw => chapter.logicAudit!.resultingValue.toLowerCase().includes(kw))) {
        threads.push({
          description: chapter.logicAudit.resultingValue,
          introducedInChapter: chapter.number,
          lastMentionedInChapter: chapter.number,
          urgency: index >= chapters.length - 2 ? 'high' : 'medium',
        });
      }
    }
  });

  return threads;
}

/**
 * Tracks a character's journey through chapters
 */
export function trackCharacterJourney(
  chapters: Chapter[],
  character: Character
): {
  chaptersAppeared: number[];
  progression: Array<{
    chapterNumber: number;
    context: string;
    keyEvents: string[];
  }>;
  gaps: Array<{
    fromChapter: number;
    toChapter: number;
    gapSize: number;
  }>;
} {
  const characterNameLower = character.name.toLowerCase();
  const chaptersAppeared: number[] = [];
  const progression: Array<{
    chapterNumber: number;
    context: string;
    keyEvents: string[];
  }> = [];

  chapters.forEach(chapter => {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    if (content.includes(characterNameLower)) {
      chaptersAppeared.push(chapter.number);

      // Extract key events (sentences mentioning the character)
      const sentences = chapter.content.split(/[.!?]+/);
      const characterSentences = sentences.filter(s => s.toLowerCase().includes(characterNameLower));
      const keyEvents = characterSentences.slice(0, 3).map(s => s.trim().substring(0, 150));

      progression.push({
        chapterNumber: chapter.number,
        context: chapter.summary || chapter.title,
        keyEvents,
      });
    }
  });

  // Find gaps in character appearance
  const gaps: Array<{
    fromChapter: number;
    toChapter: number;
    gapSize: number;
  }> = [];

  for (let i = 1; i < chaptersAppeared.length; i++) {
    const gapSize = chaptersAppeared[i] - chaptersAppeared[i - 1];
    if (gapSize > 1) {
      gaps.push({
        fromChapter: chaptersAppeared[i - 1],
        toChapter: chaptersAppeared[i],
        gapSize: gapSize - 1,
      });
    }
  }

  return {
    chaptersAppeared,
    progression,
    gaps,
  };
}

// Helper functions for transition analysis
function extractCharacterNames(text: string): string[] {
  // Simple extraction - look for capitalized words that might be names
  const words = text.split(/\s+/);
  const names: string[] = [];
  words.forEach((word, index) => {
    if (word.length > 2 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      // Check if it's not at start of sentence
      if (index > 0) {
        const prevWord = words[index - 1];
        if (!prevWord.match(/[.!?]$/)) {
          names.push(word.toLowerCase());
        }
      }
    }
  });
  return Array.from(new Set(names));
}

function extractLocations(text: string): string[] {
  const locationKeywords = ['realm', 'sect', 'palace', 'temple', 'forest', 'mountain', 'city', 'village', 'territory'];
  const locations: string[] = [];
  locationKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\s+\\w+`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      locations.push(...matches.map(m => m.toLowerCase()));
    }
  });
  return Array.from(new Set(locations));
}

function extractKeyPhrases(text: string): string[] {
  // Extract 3-4 word phrases
  const words = text.split(/\s+/);
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ').toLowerCase();
    if (phrase.length > 10 && phrase.length < 50) {
      phrases.push(phrase);
    }
  }
  return phrases;
}