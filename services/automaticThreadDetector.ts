/**
 * Automatic Thread Detector Service
 * Analyzes chapter content to automatically detect and create story threads
 * Identifies conflicts, relationships, promises, and other narrative threads
 */

import { NovelState, Chapter, StoryThread, StoryThreadType, ThreadPriority } from '../types';
import { logger } from './loggingService';

export interface DetectedThread {
  title: string;
  type: StoryThreadType;
  description: string;
  priority: ThreadPriority;
  confidence: number; // 0-100
  relatedCharacters: string[];
  evidence: string[]; // Text snippets that support this detection
  resolutionIndicators?: string[]; // Text suggesting resolution
}

export interface ThreadDetectionResult {
  detectedThreads: DetectedThread[];
  updatedThreads: Array<{
    threadId: string;
    eventType: 'progressed' | 'resolved';
    evidence: string[];
    confidence: number;
  }>;
  summary: string;
}

/**
 * Analyze chapter content for automatic thread detection
 */
export async function detectThreadsFromChapter(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[] = []
): Promise<ThreadDetectionResult> {
  const startTime = Date.now();
  logger.info(`Starting automatic thread detection for Chapter ${chapter.number}`, 'threadDetector');

  const detectedThreads: DetectedThread[] = [];
  const updatedThreads: ThreadDetectionResult['updatedThreads'] = [];

  try {
    // Analyze content for different thread types
    const conflicts = detectConflicts(chapter, state, existingThreads);
    const relationships = detectRelationships(chapter, state, existingThreads);
    const promises = detectPromises(chapter, state, existingThreads);
    const quests = detectQuests(chapter, state, existingThreads);
    const mysteries = detectMysteries(chapter, state, existingThreads);
    const alliances = detectAlliances(chapter, state, existingThreads);
    const enemies = detectEnemies(chapter, state, existingThreads);
    const powerProgressions = detectPowerProgressions(chapter, state, existingThreads);
    const revelations = detectRevelations(chapter, state, existingThreads);

    detectedThreads.push(...conflicts, ...relationships, ...promises, ...quests, ...mysteries, ...alliances, ...enemies, ...powerProgressions, ...revelations);

    // Check for thread progressions and resolutions
    const progressions = detectThreadProgressions(chapter, existingThreads);
    updatedThreads.push(...progressions);

    // Filter out low-confidence detections
    const filteredThreads = detectedThreads.filter(thread => thread.confidence >= 60);

    // Remove duplicates and merge similar detections
    const deduplicatedThreads = deduplicateThreads(filteredThreads);

    const duration = Date.now() - startTime;
    logger.info(`Thread detection complete: ${deduplicatedThreads.length} new, ${updatedThreads.length} updates`, 'threadDetector', {
      duration,
      newThreads: deduplicatedThreads.length,
      updatedThreads: updatedThreads.length,
    });

    return {
      detectedThreads: deduplicatedThreads,
      updatedThreads,
      summary: generateDetectionSummary(deduplicatedThreads, updatedThreads, chapter.number),
    };

  } catch (error) {
    logger.error('Error in automatic thread detection', 'threadDetector', error instanceof Error ? error : undefined);
    return {
      detectedThreads: [],
      updatedThreads: [],
      summary: `Thread detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Detect conflict threads from chapter content
 */
function detectConflicts(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const conflicts: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Conflict indicators
  const conflictPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:attacked|fought|battled|challenged|confronted|opposed|resisted)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:hated|despised|loathed|detested|disliked)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:argued|quarreled|disputed|debated)\s+with\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:refused|declined|rejected)\s+((?:\w+)(?:\s+\w+)*)'?s?\s+(?:request|demand|offer)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:betrayed|deceived|tricked|fooled)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /(?:conflict|tension|hostility|animosity|rivalry|enmity)\s+between\s+((?:\w+)(?:\s+\w+)*)\s+and\s+((?:\w+)(?:\s+\w+)*)/gi,
  ];

  // Character vs Group/Organization conflicts
  const groupConflictPatterns = [
    /(\w+)\s+(?:opposed|resisted|fought|rebelled\s+against)\s+(?:the\s+)?(\w+(?:\s+\w+)*(?:\s+clan|sect|family|guild|organization))/gi,
    /(\w+(?:\s+\w+)*(?:\s+clan|sect|family|guild|organization))\s+(?:attacked|invaded|raided|conquered)\s+(\w+)/gi,
  ];

  // Extract conflicts
  for (const pattern of conflictPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, char1, char2] = match;
      const characters = [char1, char2].map(name => name.charAt(0).toUpperCase() + name.slice(1));

      // Verify these are actual characters in our story
      const validCharacters = characters.filter(name =>
        state.characterCodex.some(char => char.name.toLowerCase() === name.toLowerCase())
      );

      if (validCharacters.length >= 2) {
        const title = `${validCharacters[0]} vs ${validCharacters[1]} Conflict`;

        // Check if this conflict already exists
        const existingConflict = existingThreads.find(t =>
          t.type === 'conflict' &&
          t.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!existingConflict) {
          conflicts.push({
            title,
            type: 'conflict',
            description: `Conflict between ${validCharacters.join(' and ')}`,
            priority: determineConflictPriority(chapter.content),
            confidence: calculateConflictConfidence(match[0], chapter.content),
            relatedCharacters: validCharacters,
            evidence: [match[0]],
          });
        }
      }
    }
  }

  // Extract group conflicts
  for (const pattern of groupConflictPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, entity1, entity2] = match;
      const entities = [entity1, entity2].map(name => name.charAt(0).toUpperCase() + name.slice(1));

      const title = `${entities[0]} vs ${entities[1]} Conflict`;

      const existingConflict = existingThreads.find(t =>
        t.type === 'conflict' &&
        t.title.toLowerCase().includes(title.toLowerCase())
      );

      if (!existingConflict) {
        conflicts.push({
          title,
          type: 'conflict',
          description: `Conflict between ${entities.join(' and ')}`,
          priority: 'high',
          confidence: 75,
          relatedCharacters: entities.filter(e =>
            state.characterCodex.some(char => char.name.toLowerCase() === e.toLowerCase())
          ),
          evidence: [match[0]],
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect relationship threads from chapter content
 */
function detectRelationships(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const relationships: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Relationship development indicators
  const relationshipPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:loved|adored|cherished|cared\s+for|favored)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:befriended|became\s+friends\s+with|grew\s+close\s+to)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:trusted|relied\s+on|depended\s+on)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:protected|defended|shielded)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:helped|assisted|supported|aided)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+and\s+((?:\w+)(?:\s+\w+)*)\s+(?:grew\s+closer|became\s+friends|formed\s+a\s+bond)/gi,
  ];

  // Romantic relationship indicators
  const romanticPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:fell\s+in\s+love\s+with|developed\s+feelings\s+for|was\s+attracted\s+to)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:kissed|embraced|held)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+and\s+((?:\w+)(?:\s+\w+)*)\s+(?:confessed\s+their\s+feelings|admitted\s+their\s+love)/gi,
  ];

  for (const pattern of [...relationshipPatterns, ...romanticPatterns]) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, char1, char2] = match;
      const characters = [char1, char2].map(name => name.charAt(0).toUpperCase() + name.slice(1));

      const validCharacters = characters.filter(name =>
        state.characterCodex.some(char => char.name.toLowerCase() === name.toLowerCase())
      );

      if (validCharacters.length >= 2) {
        const isRomantic = romanticPatterns.some(p => p.source === pattern.source);
        const title = `${validCharacters[0]}-${validCharacters[1]} ${isRomantic ? 'Romantic' : 'Friendship'} Relationship`;

        const existingRelationship = existingThreads.find(t =>
          t.type === 'relationship' &&
          t.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!existingRelationship) {
          relationships.push({
            title,
            type: 'relationship',
            description: `${isRomantic ? 'Romantic' : 'Platonic'} relationship between ${validCharacters.join(' and ')}`,
            priority: isRomantic ? 'high' : 'medium',
            confidence: calculateRelationshipConfidence(match[0], isRomantic),
            relatedCharacters: validCharacters,
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return relationships;
}

/**
 * Detect promise threads from chapter content
 */
function detectPromises(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const promises: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Promise indicators
  const promisePatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:promised|swore|vowed|pledged|guaranteed|assured)\s+(?:to\s+)?((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:made\s+a\s+promise\s+to|gave\s+their\s+word\s+to)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:promised|vowed|pledged)\s+that\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:swore\s+an\s+oath|took\s+an\s+oath)\s+(?:to\s+)?(.+?)(?:[.!?]|$)/gi,
  ];

  for (const pattern of promisePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, promiser, , promiseContent] = match;
      const characterName = promiser.charAt(0).toUpperCase() + promiser.slice(1);

      const isValidCharacter = state.characterCodex.some(char =>
        char.name.toLowerCase() === characterName.toLowerCase()
      );

      if (isValidCharacter) {
        const title = `${characterName}'s Promise${promiseContent ? `: ${promiseContent.slice(0, 30)}` : ''}`;

        const existingPromise = existingThreads.find(t =>
          t.type === 'promise' &&
          t.title.toLowerCase().includes(characterName.toLowerCase()) &&
          t.title.toLowerCase().includes('promise')
        );

        if (!existingPromise) {
          promises.push({
            title,
            type: 'promise',
            description: promiseContent || `Promise made by ${characterName}`,
            priority: 'high',
            confidence: 85,
            relatedCharacters: [characterName],
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return promises;
}

/**
 * Detect quest threads from chapter content
 */
function detectQuests(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const quests: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Quest indicators
  const questPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:embarked\s+on|began|started|commenced)\s+(?:a\s+)?(?:quest|journey|mission|adventure)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:must|needs|has\s+to)\s+(?:find|seek|locate|obtain|retrieve|deliver)\s+(.+?)(?:[.!?]|$)/gi,
    /(?:new\s+)?(?:quest|mission|task|objective):\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:set\s+out\s+to|decided\s+to)\s+(?:accomplish|achieve|complete|fulfill)\s+(.+?)(?:[.!?]|$)/gi,
  ];

  for (const pattern of questPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, character, questDescription] = match;
      const characterName = character ? character.charAt(0).toUpperCase() + character.slice(1) : 'Unknown';

      const isValidCharacter = !character || state.characterCodex.some(char =>
        char.name.toLowerCase() === characterName.toLowerCase()
      ) || characterName === 'Unknown';

      if (isValidCharacter) {
        const title = `${characterName}'s Quest${questDescription ? `: ${questDescription.slice(0, 30)}` : ''}`;

        const existingQuest = existingThreads.find(t =>
          t.type === 'quest' &&
          t.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!existingQuest) {
          quests.push({
            title,
            type: 'quest',
            description: questDescription || `Quest undertaken by ${characterName}`,
            priority: 'high',
            confidence: 80,
            relatedCharacters: characterName !== 'Unknown' ? [characterName] : [],
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return quests;
}

/**
 * Detect mystery threads from chapter content
 */
function detectMysteries(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const mysteries: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Mystery indicators
  const mysteryPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:wondered|pondered|questioned|was\s+curious\s+about)\s+(.+?)(?:[.!?]|$)/gi,
    /(?:mystery|enigma|puzzle|riddle|secret):\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:discovered|found|uncovered)\s+(?:a\s+)?(?:mysterious|strange|odd|unusual)\s+(.+?)(?:[.!?]|$)/gi,
    /(?:no\s+one|nobody|none)\s+(?:knows|understands|remembers)\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:investigated|looked\s+into|examined)\s+(?:the\s+)?(?:mystery|case|incident)/gi,
  ];

  for (const pattern of mysteryPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, character, mysteryDescription] = match;
      const characterName = character ? character.charAt(0).toUpperCase() + character.slice(1) : 'Unknown';

      const isValidCharacter = !character || state.characterCodex.some(char =>
        char.name.toLowerCase() === characterName.toLowerCase()
      ) || characterName === 'Unknown';

      if (isValidCharacter && mysteryDescription) {
        const title = `Mystery: ${mysteryDescription.slice(0, 40)}`;

        const existingMystery = existingThreads.find(t =>
          t.type === 'mystery' &&
          t.title.toLowerCase().includes(mysteryDescription.slice(0, 20).toLowerCase())
        );

        if (!existingMystery) {
          mysteries.push({
            title,
            type: 'mystery',
            description: mysteryDescription,
            priority: 'medium',
            confidence: 70,
            relatedCharacters: characterName !== 'Unknown' ? [characterName] : [],
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return mysteries;
}

/**
 * Detect alliance threads from chapter content
 */
function detectAlliances(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const alliances: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Alliance indicators
  const alliancePatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:allied\s+with|formed\s+an\s+alliance\s+with|joined\s+forces\s+with)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+and\s+((?:\w+)(?:\s+\w+)*)\s+(?:formed\s+an\s+alliance|became\s+allies|joined\s+forces)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:agreed\s+to\s+cooperate|decided\s+to\s+work\s+together)\s+with\s+((?:\w+)(?:\s+\w+)*)/gi,
    /(?:alliance|coalition|partnership|union)\s+between\s+((?:\w+)(?:\s+\w+)*)\s+and\s+((?:\w+)(?:\s+\w+)*)/gi,
  ];

  for (const pattern of alliancePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, char1, char2] = match;
      const characters = [char1, char2].map(name => name.charAt(0).toUpperCase() + name.slice(1));

      const validCharacters = characters.filter(name =>
        state.characterCodex.some(char => char.name.toLowerCase() === name.toLowerCase())
      );

      if (validCharacters.length >= 2) {
        const title = `${validCharacters[0]}-${validCharacters[1]} Alliance`;

        const existingAlliance = existingThreads.find(t =>
          t.type === 'alliance' &&
          t.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!existingAlliance) {
          alliances.push({
            title,
            type: 'alliance',
            description: `Alliance between ${validCharacters.join(' and ')}`,
            priority: 'high',
            confidence: 85,
            relatedCharacters: validCharacters,
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return alliances;
}

/**
 * Detect enemy threads from chapter content
 */
function detectEnemies(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const enemies: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Enemy indicators
  const enemyPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:became\s+an\s+enemy\s+of|was\s+an\s+enemy\s+of|considered\s+((?:\w+)(?:\s+\w+)*)\s+an\s+enemy)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:swore\s+vengeance\s+on|vowed\s+revenge\s+against|sought\s+revenge\s+from)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:was\s+opposed\s+to|was\s+against)\s+((?:\w+)(?:\s+\w+)*)/gi,
    /(?:archenemy|nemesis|rival|opponent|adversary):\s+((?:\w+)(?:\s+\w+)*)/gi,
  ];

  for (const pattern of enemyPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, char1, char2] = match;
      const characters = [char1, char2].map(name => name.charAt(0).toUpperCase() + name.slice(1));

      const validCharacters = characters.filter(name =>
        state.characterCodex.some(char => char.name.toLowerCase() === name.toLowerCase())
      );

      if (validCharacters.length >= 2) {
        const title = `${validCharacters[0]} vs ${validCharacters[1]} (Enemy)`;

        const existingEnemy = existingThreads.find(t =>
          t.type === 'enemy' &&
          t.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!existingEnemy) {
          enemies.push({
            title,
            type: 'enemy',
            description: `Enmity between ${validCharacters.join(' and ')}`,
            priority: 'high',
            confidence: 85,
            relatedCharacters: validCharacters,
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return enemies;
}

/**
 * Detect power progression threads from chapter content
 */
function detectPowerProgressions(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const powerProgressions: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Power progression indicators
  const powerPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:broke\s+through|advanced\s+to|reached|achieved)\s+(.+?\s+)?(?:realm|stage|level|rank)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:cultivated|trained|practiced)\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:mastered|learned|acquired)\s+(.+?\s+)?(?:technique|skill|ability)/gi,
    /((?:\w+)(?:\s+\w+)*)'?s?\s+(?:power|strength|ability)\s+(?:increased|grew|improved|enhanced)/gi,
    /(?:breakthrough|advancement|progression):\s+(.+?)(?:[.!?]|$)/gi,
  ];

  for (const pattern of powerPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, character, powerDescription] = match;
      const characterName = character ? character.charAt(0).toUpperCase() + character.slice(1) : 'Unknown';

      const isValidCharacter = !character || state.characterCodex.some(char =>
        char.name.toLowerCase() === characterName.toLowerCase()
      ) || characterName === 'Unknown';

      if (isValidCharacter) {
        const title = `${characterName}'s Power Progression${powerDescription ? `: ${powerDescription.slice(0, 30)}` : ''}`;

        const existingPower = existingThreads.find(t =>
          t.type === 'power' &&
          t.title.toLowerCase().includes(characterName.toLowerCase()) &&
          t.title.toLowerCase().includes('power')
        );

        if (!existingPower) {
          powerProgressions.push({
            title,
            type: 'power',
            description: powerDescription || `Power progression for ${characterName}`,
            priority: 'medium',
            confidence: 75,
            relatedCharacters: characterName !== 'Unknown' ? [characterName] : [],
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return powerProgressions;
}

/**
 * Detect revelation threads from chapter content
 */
function detectRevelations(
  chapter: Chapter,
  state: NovelState,
  existingThreads: StoryThread[]
): DetectedThread[] {
  const revelations: DetectedThread[] = [];
  const content = chapter.content.toLowerCase();

  // Revelation indicators
  // Revelation indicators
  const revelationPatterns = [
    /((?:\w+)(?:\s+\w+)*)\s+(?:discovered|found\s+out|learned|realized|uncovered)\s+(?:the\s+truth\s+about|that)\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:revealed|disclosed|exposed)\s+(.+?)(?:[.!?]|$)/gi,
    /(?:revelation|discovery|realization):\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:finally\s+understood|came\s+to\s+realize)\s+(.+?)(?:[.!?]|$)/gi,
    /((?:\w+)(?:\s+\w+)*)\s+(?:was\s+shocked|stunned|surprised)\s+to\s+learn\s+(.+?)(?:[.!?]|$)/gi,
  ];

  for (const pattern of revelationPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const [, character, revelationDescription] = match;
      const characterName = character ? character.charAt(0).toUpperCase() + character.slice(1) : 'Unknown';

      const isValidCharacter = !character || state.characterCodex.some(char =>
        char.name.toLowerCase() === characterName.toLowerCase()
      ) || characterName === 'Unknown';

      if (isValidCharacter && revelationDescription) {
        const title = `Revelation: ${revelationDescription.slice(0, 40)}`;

        const existingRevelation = existingThreads.find(t =>
          t.type === 'revelation' &&
          t.title.toLowerCase().includes(revelationDescription.slice(0, 20).toLowerCase())
        );

        if (!existingRevelation) {
          revelations.push({
            title,
            type: 'revelation',
            description: revelationDescription,
            priority: 'medium',
            confidence: 80,
            relatedCharacters: characterName !== 'Unknown' ? [characterName] : [],
            evidence: [match[0]],
          });
        }
      }
    }
  }

  return revelations;
}

/**
 * Detect thread progressions and resolutions in existing threads
 */
function detectThreadProgressions(
  chapter: Chapter,
  existingThreads: StoryThread[]
): ThreadDetectionResult['updatedThreads'] {
  const progressions: ThreadDetectionResult['updatedThreads'] = [];
  const content = chapter.content.toLowerCase();

  for (const thread of existingThreads) {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      continue;
    }

    // Check for resolution indicators
    const resolutionPatterns = [
      /(?:resolved|settled|concluded|ended|finished|completed)/gi,
      /(?:peace|agreement|truce|reconciliation|forgiveness)/gi,
      /(?:defeated|vanquished|overcome|conquered)/gi,
      /(?:fulfilled|completed|accomplished|achieved)/gi,
      /(?:solved|answered|explained|revealed)/gi,
    ];

    const progressionPatterns = [
      /(?:progressed|advanced|moved\s+forward|developed|evolved)/gi,
      /(?:escalated|intensified|worsened|deteriorated)/gi,
      /(?:improved|bettered|enhanced|strengthened)/gi,
    ];

    // Check for resolution
    for (const pattern of resolutionPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        // Check if the resolution relates to this thread
        const threadKeywords = thread.title.toLowerCase().split(/\s+/);
        const relevantMatches = matches.filter(() =>
          threadKeywords.some(keyword => content.includes(keyword))
        );

        if (relevantMatches.length > 0) {
          progressions.push({
            threadId: thread.id,
            eventType: 'resolved',
            evidence: relevantMatches,
            confidence: 85,
          });
          break;
        }
      }
    }

    // Check for progression (if not resolved)
    if (!progressions.some(p => p.threadId === thread.id)) {
      for (const pattern of progressionPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          const threadKeywords = thread.title.toLowerCase().split(/\s+/);
          const relevantMatches = matches.filter(() =>
            threadKeywords.some(keyword => content.includes(keyword))
          );

          if (relevantMatches.length > 0) {
            progressions.push({
              threadId: thread.id,
              eventType: 'progressed',
              evidence: relevantMatches,
              confidence: 75,
            });
            break;
          }
        }
      }
    }
  }

  return progressions;
}

/**
 * Helper functions
 */
function determineConflictPriority(content: string): ThreadPriority {
  const contentLower = content.toLowerCase();

  // Check for high-intensity conflict indicators
  const highIntensityWords = ['killed', 'murdered', 'destroyed', 'annihilated', 'eradicated'];
  const mediumIntensityWords = ['fought', 'battled', 'attacked', 'injured', 'wounded'];

  if (highIntensityWords.some(word => contentLower.includes(word))) {
    return 'critical';
  } else if (mediumIntensityWords.some(word => contentLower.includes(word))) {
    return 'high';
  }

  return 'medium';
}

function calculateConflictConfidence(match: string, content: string): number {
  let confidence = 70; // Base confidence

  // Increase confidence for explicit conflict words
  const explicitWords = ['attacked', 'fought', 'hated', 'betrayed'];
  if (explicitWords.some(word => match.toLowerCase().includes(word))) {
    confidence += 15;
  }

  // Increase confidence if there are multiple conflict indicators
  const conflictCount = (content.match(/conflict|fight|battle|war|hostility/gi) || []).length;
  confidence += Math.min(conflictCount * 5, 15);

  return Math.min(confidence, 100);
}

function calculateRelationshipConfidence(match: string, isRomantic: boolean): number {
  let confidence = isRomantic ? 80 : 70;

  // Increase confidence for explicit relationship words
  const explicitWords = isRomantic ? ['loved', 'kissed', 'fell in love'] : ['friends', 'trusted', 'cared'];
  if (explicitWords.some(word => match.toLowerCase().includes(word))) {
    confidence += 10;
  }

  return Math.min(confidence, 100);
}

function deduplicateThreads(threads: DetectedThread[]): DetectedThread[] {
  const deduplicated: DetectedThread[] = [];
  const seen = new Set<string>();

  for (const thread of threads) {
    // Create a normalized key for deduplication
    const key = `${thread.type}-${thread.title.toLowerCase().replace(/\s+/g, '-')}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(thread);
    } else {
      // If duplicate, merge evidence and keep higher confidence
      const existing = deduplicated.find(t =>
        `${t.type}-${t.title.toLowerCase().replace(/\s+/g, '-')}` === key
      );
      if (existing) {
        existing.confidence = Math.max(existing.confidence, thread.confidence);
        existing.evidence = [...new Set([...existing.evidence, ...thread.evidence])];
      }
    }
  }

  return deduplicated;
}

function generateDetectionSummary(
  detectedThreads: DetectedThread[],
  updatedThreads: ThreadDetectionResult['updatedThreads'],
  chapterNumber: number
): string {
  const threadTypes = detectedThreads.reduce((acc, thread) => {
    acc[thread.type] = (acc[thread.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summaryParts = [`Chapter ${chapterNumber} thread detection:`];

  if (detectedThreads.length > 0) {
    summaryParts.push(`${detectedThreads.length} new threads detected`);
    const typeSummary = Object.entries(threadTypes)
      .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
      .join(', ');
    summaryParts.push(`(${typeSummary})`);
  }

  if (updatedThreads.length > 0) {
    const progressed = updatedThreads.filter(t => t.eventType === 'progressed').length;
    const resolved = updatedThreads.filter(t => t.eventType === 'resolved').length;
    summaryParts.push(`${progressed} progressed, ${resolved} resolved`);
  }

  return summaryParts.join(' - ') || 'No thread activity detected';
}
