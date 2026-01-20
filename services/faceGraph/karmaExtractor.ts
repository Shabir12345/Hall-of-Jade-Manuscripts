/**
 * Karma Extractor Service
 * 
 * Uses AI to automatically extract karma events from chapter content.
 * This service analyzes the narrative to identify:
 * - Who did what to whom
 * - The type of karmic action
 * - The severity and polarity
 * - Witnesses present
 */

import { Chapter, Character, NovelState } from '../../types';
import type {
  KarmaEvent,
  KarmaActionType,
  KarmaSeverity,
  KarmaPolarity,
} from '../../types/faceGraph';
import { KARMA_WEIGHT_BY_ACTION } from '../../types/faceGraph';
import { routeJsonTask } from '../modelOrchestrator';
import { rateLimiter } from '../rateLimiter';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';
import { recordKarmaEvent, upsertSocialLink, createFaceProfile, getFaceProfile } from './faceGraphService';
import { analyzeRippleEffects } from './rippleAnalyzer';
import type { SocialLinkType } from '../../types/faceGraph';

/**
 * AI response structure for karma extraction
 */
interface KarmaExtractionResponse {
  events: Array<{
    actorName: string;
    targetName: string;
    actionType: string;
    description: string;
    severity: string;
    wasWitnessed: boolean;
    witnessNames?: string[];
    isRetaliation: boolean;
    retaliationFor?: string;
  }>;
  reasoning: string;
}

/**
 * Keywords that indicate specific action types
 */
const ACTION_KEYWORDS: Record<KarmaActionType, string[]> = {
  kill: ['killed', 'slain', 'murdered', 'executed', 'slaughtered', 'ended their life', 'death'],
  spare: ['spared', 'showed mercy', 'let live', 'forgave', 'released'],
  humiliate: ['humiliated', 'shamed', 'embarrassed', 'mocked', 'ridiculed', 'face slap', 'lost face'],
  honor: ['honored', 'praised', 'elevated', 'recognized', 'celebrated', 'gave face'],
  betray: ['betrayed', 'backstabbed', 'sold out', 'broke trust', 'turned on'],
  save: ['saved', 'rescued', 'protected from death', 'healed', 'preserved life'],
  steal: ['stole', 'took', 'seized', 'plundered', 'robbed'],
  gift: ['gifted', 'gave', 'bestowed', 'presented', 'offered'],
  defeat: ['defeated', 'beat', 'overpowered', 'bested', 'won against'],
  submit: ['submitted', 'surrendered', 'yielded', 'bowed', 'knelt'],
  offend: ['offended', 'slighted', 'disrespected', 'insulted'],
  protect: ['protected', 'shielded', 'defended', 'guarded'],
  avenge: ['avenged', 'revenged', 'got justice', 'paid back'],
  abandon: ['abandoned', 'left behind', 'deserted', 'forsook'],
  enslave: ['enslaved', 'bound', 'captured', 'imprisoned', 'sealed'],
  liberate: ['freed', 'liberated', 'released', 'broke seal', 'unchained'],
  curse: ['cursed', 'hexed', 'placed restriction', 'poisoned spirit'],
  bless: ['blessed', 'granted boon', 'enhanced', 'awakened'],
  destroy_sect: ['destroyed sect', 'annihilated', 'wiped out sect'],
  cripple_cultivation: ['crippled', 'destroyed cultivation', 'ruined foundation'],
  restore_cultivation: ['restored', 'healed cultivation', 'rebuilt foundation'],
  exterminate_clan: ['exterminated', 'wiped out family', 'clan massacre'],
  elevate_status: ['promoted', 'elevated status', 'raised position'],
};

/**
 * Extract karma events from a chapter
 */
export async function extractKarmaFromChapter(
  state: NovelState,
  chapter: Chapter,
  options?: {
    minSeverity?: KarmaSeverity;
    characterIds?: string[];
    skipAIAnalysis?: boolean;
  }
): Promise<KarmaEvent[]> {
  const startTime = Date.now();
  
  logger.info('Extracting karma from chapter', 'faceGraph', {
    chapterNumber: chapter.number,
    novelId: state.id,
  });

  try {
    // Step 1: Quick keyword scan for potential events
    const potentialEvents = quickScanForKarmaEvents(chapter.content, state.characterCodex);
    
    if (potentialEvents.length === 0 && options?.skipAIAnalysis) {
      logger.debug('No potential karma events detected in chapter', 'faceGraph', {
        chapterNumber: chapter.number,
      });
      return [];
    }

    // Step 2: Use AI to analyze and confirm events (if not skipped)
    const aiExtractedEvents = options?.skipAIAnalysis
      ? []
      : await analyzeChapterWithAI(state, chapter, potentialEvents);

    // Step 3: Merge and deduplicate
    const allEvents = [...potentialEvents, ...aiExtractedEvents];
    const uniqueEvents = deduplicateEvents(allEvents);

    // Step 4: Validate and persist events
    const persistedEvents: KarmaEvent[] = [];
    
    for (const eventData of uniqueEvents) {
      // Skip if below minimum severity
      if (options?.minSeverity && !isSeverityAtLeast(eventData.severity, options.minSeverity)) {
        continue;
      }

      // Find character IDs
      const actor = findCharacterByName(state.characterCodex, eventData.actorName);
      const target = findCharacterByName(state.characterCodex, eventData.targetName);
      
      if (!actor || !target) {
        logger.debug('Could not resolve characters for karma event', 'faceGraph', {
          actorName: eventData.actorName,
          targetName: eventData.targetName,
        });
        continue;
      }

      // Skip if character filter is set and neither is in the list
      if (options?.characterIds && options.characterIds.length > 0) {
        if (!options.characterIds.includes(actor.id) && !options.characterIds.includes(target.id)) {
          continue;
        }
      }

      // Find witness IDs
      const witnessIds = (eventData.witnessNames || [])
        .map(name => findCharacterByName(state.characterCodex, name)?.id)
        .filter((id): id is string => id !== undefined);

      // Persist the event
      const persistedEvent = await recordKarmaEvent(
        state.id,
        actor.id,
        actor.name,
        target.id,
        target.name,
        eventData.actionType as KarmaActionType,
        chapter.number,
        chapter.id,
        eventData.description,
        {
          severity: eventData.severity as KarmaSeverity,
          wasWitnessed: eventData.wasWitnessed,
          witnessIds,
          isRetaliation: eventData.isRetaliation,
        }
      );

      if (persistedEvent) {
        persistedEvents.push(persistedEvent);
      }
    }

    logger.info('Karma extraction complete', 'faceGraph', {
      chapterNumber: chapter.number,
      eventsFound: persistedEvents.length,
      durationMs: Date.now() - startTime,
    });

    return persistedEvents;

  } catch (error) {
    logger.error('Error extracting karma from chapter', 'faceGraph',
      error instanceof Error ? error : new Error(String(error)),
      { chapterNumber: chapter.number }
    );
    return [];
  }
}

/**
 * Quick keyword-based scan for potential karma events
 */
function quickScanForKarmaEvents(
  content: string,
  characters: Character[]
): Array<{
  actorName: string;
  targetName: string;
  actionType: string;
  description: string;
  severity: string;
  wasWitnessed: boolean;
  witnessNames?: string[];
  isRetaliation: boolean;
}> {
  const events: Array<{
    actorName: string;
    targetName: string;
    actionType: string;
    description: string;
    severity: string;
    wasWitnessed: boolean;
    witnessNames?: string[];
    isRetaliation: boolean;
  }> = [];

  const contentLower = content.toLowerCase();
  const characterNames = characters.map(c => c.name);

  // Check for each action type
  for (const [actionType, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        // Find the sentence containing the keyword
        const keywordIndex = contentLower.indexOf(keyword.toLowerCase());
        const sentenceStart = Math.max(0, contentLower.lastIndexOf('.', keywordIndex) + 1);
        const sentenceEnd = contentLower.indexOf('.', keywordIndex);
        const sentence = content.substring(sentenceStart, sentenceEnd > 0 ? sentenceEnd : sentenceStart + 200).trim();

        // Try to identify actor and target from the sentence
        const sentenceLower = sentence.toLowerCase();
        let actor: string | undefined;
        let target: string | undefined;

        for (const name of characterNames) {
          const nameLower = name.toLowerCase();
          if (sentenceLower.includes(nameLower)) {
            // Simple heuristic: character before the keyword is actor, after is target
            const nameIndex = sentenceLower.indexOf(nameLower);
            const kwIndex = sentenceLower.indexOf(keyword.toLowerCase());

            if (nameIndex < kwIndex && !actor) {
              actor = name;
            } else if (!target) {
              target = name;
            }
          }
        }

        if (actor && target && actor !== target) {
          // Determine severity based on action type
          const baseKarma = KARMA_WEIGHT_BY_ACTION[actionType as KarmaActionType];
          let severity: KarmaSeverity = 'moderate';
          if (baseKarma) {
            if (baseKarma.base >= 80) severity = 'extreme';
            else if (baseKarma.base >= 60) severity = 'severe';
            else if (baseKarma.base >= 40) severity = 'major';
            else if (baseKarma.base >= 20) severity = 'moderate';
            else severity = 'minor';
          }

          // Check for witnesses (other characters in the sentence)
          const witnesses = characterNames.filter(name => 
            name !== actor && name !== target && sentenceLower.includes(name.toLowerCase())
          );

          events.push({
            actorName: actor,
            targetName: target,
            actionType: actionType as KarmaActionType,
            description: sentence.slice(0, 200),
            severity,
            wasWitnessed: witnesses.length > 0,
            witnessNames: witnesses.length > 0 ? witnesses : undefined,
            isRetaliation: sentenceLower.includes('revenge') || sentenceLower.includes('aveng'),
          });
        }
      }
    }
  }

  return events;
}

/**
 * Use AI to analyze chapter for karma events
 */
async function analyzeChapterWithAI(
  state: NovelState,
  chapter: Chapter,
  potentialEvents: Array<{ actorName: string; targetName: string; actionType: string; description: string }>
): Promise<Array<{
  actorName: string;
  targetName: string;
  actionType: string;
  description: string;
  severity: string;
  wasWitnessed: boolean;
  witnessNames?: string[];
  isRetaliation: boolean;
}>> {
  try {
    const characterNames = state.characterCodex
      .slice(0, 20)
      .map(c => c.name)
      .join(', ');

    const prompt = buildKarmaExtractionPrompt(chapter, characterNames, potentialEvents);

    const response = await rateLimiter.queueRequest(
      'analyze',
      async () => routeJsonTask<KarmaExtractionResponse>('metadata_extraction', {
        system: KARMA_EXTRACTION_SYSTEM_PROMPT,
        user: prompt,
        temperature: 0.3, // Low temperature for accurate extraction
        maxTokens: 2048,
      }),
      `karma-extract-${chapter.id}`
    );

    if (!response || !response.events) {
      return [];
    }

    // Validate and normalize the response
    return response.events
      .filter(e => e.actorName && e.targetName && e.actionType)
      .map(e => ({
        actorName: e.actorName,
        targetName: e.targetName,
        actionType: normalizeActionType(e.actionType),
        description: e.description || '',
        severity: normalizeSeverity(e.severity),
        wasWitnessed: e.wasWitnessed || false,
        witnessNames: e.witnessNames,
        isRetaliation: e.isRetaliation || false,
      }));

  } catch (error) {
    logger.warn('AI karma extraction failed, using keyword results only', 'faceGraph', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * System prompt for karma extraction
 */
const KARMA_EXTRACTION_SYSTEM_PROMPT = `You are analyzing a chapter from a cultivation/Xianxia novel to extract "karma events" - significant interactions between characters that create debts, grudges, or social obligations.

KARMA EVENTS to look for:
- KILLS: One character kills another
- SPARES: One character shows mercy and spares another
- HUMILIATES: Public shaming, face slaps, or embarrassment
- HONORS: Public praise or elevation
- BETRAYS: Breaking trust, backstabbing, selling out
- SAVES: Rescuing from death or danger
- STEALS: Taking treasures, techniques, or resources
- GIFTS: Giving valuable items or teachings
- DEFEATS: Winning in combat (non-lethal)
- PROTECTS: Defending from threats
- ABANDONS: Leaving someone to die or deserting them
- CRIPPLES CULTIVATION: Ruining someone's cultivation
- DESTROYS SECT: Destroying an organization

IMPORTANT:
- Only extract SIGNIFICANT events that would create lasting karma
- Minor insults or brief fights without consequence don't count
- Focus on events involving named characters
- Note if the event was witnessed by others (increases karma weight)
- Identify if this is retaliation for a previous event

Return a JSON object with:
{
  "events": [
    {
      "actorName": "Character who did the action",
      "targetName": "Character who received the action",
      "actionType": "kill|spare|humiliate|honor|betray|save|steal|gift|defeat|protect|abandon|cripple_cultivation|destroy_sect|etc",
      "description": "Brief description of what happened",
      "severity": "minor|moderate|major|severe|extreme",
      "wasWitnessed": boolean,
      "witnessNames": ["List of witness names"] (optional),
      "isRetaliation": boolean,
      "retaliationFor": "What this is revenge for" (optional)
    }
  ],
  "reasoning": "Brief explanation of your analysis"
}

If no significant karma events are found, return { "events": [], "reasoning": "explanation" }`;

/**
 * Build the user prompt for karma extraction
 */
function buildKarmaExtractionPrompt(
  chapter: Chapter,
  characterNames: string,
  potentialEvents: Array<{ actorName: string; targetName: string; actionType: string; description: string }>
): string {
  const potentialEventsStr = potentialEvents.length > 0
    ? `\n\nPOTENTIAL EVENTS DETECTED (verify these):\n${potentialEvents.map(e => 
        `- ${e.actorName} ${e.actionType} ${e.targetName}: "${e.description}"`
      ).join('\n')}`
    : '';

  return `CHAPTER ${chapter.number}: ${chapter.title || ''}

KNOWN CHARACTERS: ${characterNames}
${potentialEventsStr}

=== CHAPTER CONTENT ===
${chapter.content.slice(0, 8000)}

=== TASK ===
Extract all significant karma events from this chapter. Verify any potential events detected and identify any additional events.`;
}

/**
 * Normalize action type from AI response
 */
function normalizeActionType(actionType: string): KarmaActionType {
  const normalized = actionType.toLowerCase().replace(/[^a-z_]/g, '');
  
  const validTypes: KarmaActionType[] = [
    'kill', 'spare', 'humiliate', 'honor', 'betray', 'save', 'steal', 'gift',
    'defeat', 'submit', 'offend', 'protect', 'avenge', 'abandon', 'enslave',
    'liberate', 'curse', 'bless', 'destroy_sect', 'cripple_cultivation',
    'restore_cultivation', 'exterminate_clan', 'elevate_status'
  ];
  
  if (validTypes.includes(normalized as KarmaActionType)) {
    return normalized as KarmaActionType;
  }
  
  // Try to map common variations
  if (normalized.includes('kill') || normalized.includes('murder')) return 'kill';
  if (normalized.includes('spare') || normalized.includes('mercy')) return 'spare';
  if (normalized.includes('humili') || normalized.includes('shame')) return 'humiliate';
  if (normalized.includes('honor') || normalized.includes('praise')) return 'honor';
  if (normalized.includes('betray')) return 'betray';
  if (normalized.includes('save') || normalized.includes('rescue')) return 'save';
  if (normalized.includes('steal') || normalized.includes('rob')) return 'steal';
  if (normalized.includes('gift') || normalized.includes('give')) return 'gift';
  if (normalized.includes('defeat') || normalized.includes('beat')) return 'defeat';
  if (normalized.includes('protect') || normalized.includes('defend')) return 'protect';
  
  return 'offend'; // Default to minor action
}

/**
 * Normalize severity from AI response
 */
function normalizeSeverity(severity: string | undefined): KarmaSeverity {
  if (!severity) return 'moderate';
  
  const normalized = severity.toLowerCase();
  
  if (normalized.includes('extreme') || normalized.includes('catastroph')) return 'extreme';
  if (normalized.includes('severe') || normalized.includes('serious')) return 'severe';
  if (normalized.includes('major') || normalized.includes('significant')) return 'major';
  if (normalized.includes('minor') || normalized.includes('small')) return 'minor';
  
  return 'moderate';
}

/**
 * Check if severity meets minimum
 */
function isSeverityAtLeast(severity: string, minimum: KarmaSeverity): boolean {
  const severityOrder: KarmaSeverity[] = ['minor', 'moderate', 'major', 'severe', 'extreme'];
  return severityOrder.indexOf(severity as KarmaSeverity) >= severityOrder.indexOf(minimum);
}

/**
 * Find character by name (case-insensitive, partial match)
 */
function findCharacterByName(characters: Character[], name: string): Character | undefined {
  const nameLower = name.toLowerCase();
  
  // Exact match first
  const exact = characters.find(c => c.name.toLowerCase() === nameLower);
  if (exact) return exact;
  
  // Partial match (name contains or is contained)
  return characters.find(c => 
    c.name.toLowerCase().includes(nameLower) || 
    nameLower.includes(c.name.toLowerCase())
  );
}

/**
 * Deduplicate events (same actor, target, and action type)
 */
function deduplicateEvents<T extends { actorName: string; targetName: string; actionType: string }>(
  events: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  
  for (const event of events) {
    const key = `${event.actorName.toLowerCase()}-${event.targetName.toLowerCase()}-${event.actionType}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }
  
  return unique;
}

/**
 * Batch extract karma from multiple chapters
 */
export async function batchExtractKarma(
  state: NovelState,
  chapters: Chapter[],
  options?: {
    minSeverity?: KarmaSeverity;
    maxChaptersPerBatch?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{ totalEvents: number; byChapter: Record<number, number> }> {
  const maxPerBatch = options?.maxChaptersPerBatch || 5;
  const results: Record<number, number> = {};
  let totalEvents = 0;
  let completed = 0;

  // Process in batches
  for (let i = 0; i < chapters.length; i += maxPerBatch) {
    const batch = chapters.slice(i, i + maxPerBatch);
    
    const batchResults = await Promise.all(
      batch.map(async chapter => {
        const events = await extractKarmaFromChapter(state, chapter, {
          minSeverity: options?.minSeverity,
        });
        return { chapterNumber: chapter.number, count: events.length };
      })
    );

    for (const result of batchResults) {
      results[result.chapterNumber] = result.count;
      totalEvents += result.count;
      completed++;
      options?.onProgress?.(completed, chapters.length);
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + maxPerBatch < chapters.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { totalEvents, byChapter: results };
}

/**
 * Extract karma from chapter AND process ripple effects
 * This is a convenience function that combines extraction and processing
 */
export async function extractAndProcessKarma(
  state: NovelState,
  chapter: Chapter,
  options?: {
    minSeverity?: KarmaSeverity;
    characterIds?: string[];
    skipAIAnalysis?: boolean;
    calculateRipples?: boolean;
  }
): Promise<{
  events: KarmaEvent[];
  rippleCount: number;
}> {
  // Extract events
  const events = await extractKarmaFromChapter(state, chapter, options);
  
  // Process ripples for significant events (if enabled)
  let rippleCount = 0;
  if (options?.calculateRipples !== false) {
    for (const event of events) {
      // Only calculate ripples for major+ severity
      if (isSeverityAtLeast(event.severity, 'major')) {
        try {
          const ripples = await analyzeRippleEffects(
            state.id,
            event,
            { maxDegrees: 2 }
          );
          rippleCount += ripples.length;
        } catch (error) {
          logger.warn('Failed to analyze ripples for karma event', 'faceGraph', {
            eventId: event.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  return { events, rippleCount };
}

/**
 * Process already-extracted karma events (useful when events were detected elsewhere)
 */
export async function processExtractedKarma(
  state: NovelState,
  extractedEvents: Array<{
    actorName: string;
    targetName: string;
    actionType: KarmaActionType;
    description: string;
    severity: KarmaSeverity;
    chapterNumber: number;
    chapterId: string;
    wasWitnessed?: boolean;
    witnessNames?: string[];
    isRetaliation?: boolean;
  }>
): Promise<KarmaEvent[]> {
  const persistedEvents: KarmaEvent[] = [];

  for (const eventData of extractedEvents) {
    // Find character IDs
    const actor = findCharacterByName(state.characterCodex, eventData.actorName);
    const target = findCharacterByName(state.characterCodex, eventData.targetName);
    
    if (!actor || !target) {
      logger.debug('Could not resolve characters for karma event', 'faceGraph', {
        actorName: eventData.actorName,
        targetName: eventData.targetName,
      });
      continue;
    }

    // Find witness IDs
    const witnessIds = (eventData.witnessNames || [])
      .map(name => findCharacterByName(state.characterCodex, name)?.id)
      .filter((id): id is string => id !== undefined);

    // Persist the event
    const persistedEvent = await recordKarmaEvent(
      state.id,
      actor.id,
      actor.name,
      target.id,
      target.name,
      eventData.actionType,
      eventData.chapterNumber,
      eventData.chapterId,
      eventData.description,
      {
        severity: eventData.severity,
        wasWitnessed: eventData.wasWitnessed || false,
        witnessIds,
        isRetaliation: eventData.isRetaliation || false,
      }
    );

    if (persistedEvent) {
      persistedEvents.push(persistedEvent);
    }
  }

  return persistedEvents;
}

/**
 * Initialize social links from existing character relationships
 * This bootstraps the Face Graph from existing character data
 */
export async function initializeSocialLinksFromRelationships(
  state: NovelState,
  options?: {
    overwriteExisting?: boolean;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<{
  linksCreated: number;
  profilesCreated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let linksCreated = 0;
  let profilesCreated = 0;

  const characters = state.characterCodex;
  const totalCharacters = characters.length;
  let processed = 0;

  logger.info('Initializing Face Graph from existing relationships', 'faceGraph', {
    novelId: state.id,
    characterCount: totalCharacters,
  });

  // First, ensure all characters have Face Profiles
  for (const character of characters) {
    try {
      const existingProfile = await getFaceProfile(state.id, character.id);
      
      if (!existingProfile) {
        // Calculate initial face based on character status
        let initialFace = 0;
        if (character.isProtagonist) initialFace = 100;
        else if (character.role === 'antagonist') initialFace = 80;
        else if (character.role === 'supporting') initialFace = 30;
        
        await createFaceProfile(state.id, character, initialFace);
        profilesCreated++;
      }
    } catch (error) {
      errors.push(`Failed to create profile for ${character.name}: ${error instanceof Error ? error.message : String(error)}`);
    }

    processed++;
    options?.onProgress?.(processed, totalCharacters);
  }

  // Now create social links from relationships
  for (const character of characters) {
    if (character.relationships && character.relationships.length > 0) {
      for (const relationship of character.relationships) {
        try {
          // Find the target character
          const targetCharacter = findCharacterByName(characters, relationship.targetName || relationship.targetCharacter || '');
          
          if (!targetCharacter) {
            logger.debug('Could not find target character for relationship', 'faceGraph', {
              sourceCharacter: character.name,
              targetName: relationship.targetName || relationship.targetCharacter,
            });
            continue;
          }

          // Map relationship type to SocialLinkType
          const linkType = mapRelationshipToLinkType(relationship.type || relationship.relationshipType || '');
          const sentiment = mapRelationshipToSentiment(relationship.type || relationship.relationshipType || '');

          await upsertSocialLink(
            state.id,
            character.id,
            character.name,
            targetCharacter.id,
            targetCharacter.name,
            linkType,
            {
              strength: 'moderate',
              sentiment,
              sentimentScore: sentiment === 'positive' ? 30 : sentiment === 'negative' ? -30 : 0,
              establishedChapter: 1,
              isKnownToBoth: true,
            }
          );
          
          linksCreated++;
        } catch (error) {
          errors.push(`Failed to create link for ${character.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  logger.info('Face Graph initialization complete', 'faceGraph', {
    novelId: state.id,
    profilesCreated,
    linksCreated,
    errorCount: errors.length,
  });

  return { linksCreated, profilesCreated, errors };
}

/**
 * Map generic relationship types to SocialLinkType
 */
function mapRelationshipToLinkType(relationshipType: string): SocialLinkType {
  const normalized = relationshipType.toLowerCase();
  
  // Family relations
  if (normalized.includes('father') || normalized.includes('mother') || normalized.includes('parent')) return 'parent';
  if (normalized.includes('child') || normalized.includes('son') || normalized.includes('daughter')) return 'parent'; // Reverse
  if (normalized.includes('sibling') || normalized.includes('brother') || normalized.includes('sister')) return 'sibling';
  if (normalized.includes('spouse') || normalized.includes('wife') || normalized.includes('husband') || normalized.includes('married')) return 'spouse';
  
  // Cultivation relations
  if (normalized.includes('master') || normalized.includes('teacher') || normalized.includes('shifu')) return 'master';
  if (normalized.includes('disciple') || normalized.includes('student') || normalized.includes('apprentice')) return 'disciple';
  if (normalized.includes('martial brother') || normalized.includes('senior brother') || normalized.includes('junior brother')) return 'martial_brother';
  if (normalized.includes('martial sister') || normalized.includes('senior sister') || normalized.includes('junior sister')) return 'martial_sister';
  if (normalized.includes('dao companion') || normalized.includes('cultivation partner')) return 'dao_companion';
  
  // Organization relations
  if (normalized.includes('sect') && normalized.includes('leader')) return 'sect_leader';
  if (normalized.includes('sect') && normalized.includes('elder')) return 'sect_elder';
  if (normalized.includes('sect')) return 'sect_member';
  if (normalized.includes('clan') && normalized.includes('elder')) return 'clan_elder';
  if (normalized.includes('clan')) return 'clan_member';
  
  // Hostile relations
  if (normalized.includes('enemy') || normalized.includes('foe') || normalized.includes('rival')) return 'enemy';
  if (normalized.includes('nemesis') || normalized.includes('arch')) return 'nemesis';
  if (normalized.includes('blood feud') || normalized.includes('mortal enemy')) return 'blood_feud_target';
  
  // Positive relations
  if (normalized.includes('friend') || normalized.includes('companion')) return 'friend';
  if (normalized.includes('ally') || normalized.includes('alliance')) return 'ally';
  if (normalized.includes('benefactor') || normalized.includes('patron')) return 'benefactor';
  if (normalized.includes('protector') || normalized.includes('guardian')) return 'protector';
  
  // Neutral/other
  if (normalized.includes('acquaintance')) return 'acquaintance';
  if (normalized.includes('servant') || normalized.includes('subordinate')) return 'subordinate';
  if (normalized.includes('competitor')) return 'competitor';
  
  return 'acquaintance'; // Default
}

/**
 * Map relationship type to sentiment
 */
function mapRelationshipToSentiment(relationshipType: string): 'positive' | 'negative' | 'neutral' | 'complex' {
  const normalized = relationshipType.toLowerCase();
  
  // Positive relationships
  if (normalized.includes('friend') || normalized.includes('ally') || 
      normalized.includes('spouse') || normalized.includes('dao companion') ||
      normalized.includes('benefactor') || normalized.includes('protector') ||
      normalized.includes('master') || normalized.includes('disciple')) {
    return 'positive';
  }
  
  // Negative relationships
  if (normalized.includes('enemy') || normalized.includes('nemesis') ||
      normalized.includes('rival') || normalized.includes('foe') ||
      normalized.includes('blood feud')) {
    return 'negative';
  }
  
  // Complex relationships (family can be complicated)
  if (normalized.includes('parent') || normalized.includes('sibling') ||
      normalized.includes('martial brother') || normalized.includes('martial sister')) {
    return 'complex';
  }
  
  return 'neutral';
}
