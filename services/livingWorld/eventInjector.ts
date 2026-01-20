/**
 * Event Injector
 * 
 * Integrates Living World events into the chapter generation context.
 * Creates "return from seclusion" story hooks and ensures events
 * are naturally discovered by the MC in the narrative.
 */

import { NovelState, Chapter } from '../../types';
import { BuiltPrompt } from '../../types';
import {
  GlobalWorldEvent,
  WorldEventInjectionContext,
  SeclusionDetection,
  TimeSkipDetection,
  DEFAULT_WORLD_SIMULATION_CONFIG,
} from '../../types/livingWorld';
import {
  getUndiscoveredEvents,
  getEventsToDiscover,
  markEventsDiscovered,
  generateEventStoryHooks,
  getLivingWorldStatus,
} from './worldStateSimulator';
import {
  detectSeclusion,
  detectTimeSkip,
} from './globalEventGenerator';
import { logger } from '../loggingService';

/**
 * Build injection context for world events
 */
export function buildEventInjectionContext(
  novelId: string,
  currentChapter: number,
  recentChapters: Chapter[] = []
): WorldEventInjectionContext {
  // Get events that should be discovered
  const eventsToDiscover = getEventsToDiscover(novelId, currentChapter, 2);
  
  // Get all undiscovered events for counts
  const allUndiscovered = getUndiscoveredEvents(novelId);
  
  // Get urgent events (immediate urgency or catastrophic impact)
  const urgentEvents = allUndiscovered.filter(
    e => e.urgency === 'immediate' || e.impact === 'catastrophic'
  );
  
  // Build formatted context if there are events to inject
  let formattedContext = '';
  
  if (eventsToDiscover.length > 0 || urgentEvents.length > 0) {
    formattedContext = formatEventsForPrompt(
      eventsToDiscover,
      urgentEvents,
      allUndiscovered.length,
      recentChapters
    );
  }
  
  return {
    eventsToDiscover,
    formattedContext,
    pendingEventCount: allUndiscovered.length,
    urgentEvents,
  };
}

/**
 * Format world events for prompt injection
 */
function formatEventsForPrompt(
  eventsToDiscover: GlobalWorldEvent[],
  urgentEvents: GlobalWorldEvent[],
  totalPending: number,
  recentChapters: Chapter[]
): string {
  const lines: string[] = [];
  
  // Check if MC just exited seclusion or time skipped
  const recentSeclusion: SeclusionDetection = recentChapters.length > 0 
    ? detectSeclusion(recentChapters[recentChapters.length - 1])
    : { detected: false, chapter: 0 };
  const recentTimeSkip: TimeSkipDetection = recentChapters.length >= 2
    ? detectTimeSkip(recentChapters[recentChapters.length - 1], recentChapters[recentChapters.length - 2])
    : { detected: false, chapter: 0 };
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════════╗');
  lines.push('║  LIVING WORLD - EVENTS TO DISCOVER                               ║');
  lines.push('╚══════════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  if (recentSeclusion.detected || recentTimeSkip.detected) {
    lines.push('⏰ TIME HAS PASSED - THE WORLD HAS CHANGED');
    if (recentSeclusion.detected && recentSeclusion.estimatedDuration) {
      lines.push(`   MC was in seclusion for: ${recentSeclusion.estimatedDuration}`);
    }
    if (recentTimeSkip.detected && recentTimeSkip.yearsSkipped) {
      lines.push(`   Time skip: ${recentTimeSkip.yearsSkipped} years`);
    }
    lines.push('');
  }
  
  lines.push(`📢 ${totalPending} world event(s) await discovery by the MC`);
  lines.push('');
  
  if (eventsToDiscover.length > 0) {
    lines.push('🎯 EVENTS TO WEAVE INTO THIS CHAPTER:');
    lines.push('   (The MC should learn of these events naturally through the narrative)');
    lines.push('');
    
    for (const event of eventsToDiscover) {
      const urgencyIcon = event.urgency === 'immediate' ? '⚡' : '📝';
      const impactBadge = event.impact === 'catastrophic' 
        ? '[CATASTROPHIC]' 
        : event.impact === 'major' 
        ? '[MAJOR]' 
        : '';
      
      lines.push(`${urgencyIcon} ${impactBadge} ${event.summary}`);
      lines.push(`   Type: ${event.eventType.replace(/_/g, ' ')}`);
      lines.push(`   Affected: ${event.affectedEntityNames.join(', ')}`);
      lines.push(`   Story Hook: ${event.storyHook}`);
      if (event.consequences && event.consequences.length > 0) {
        lines.push(`   Consequences: ${event.consequences.slice(0, 2).join('; ')}`);
      }
      lines.push('');
    }
    
    lines.push('DISCOVERY METHODS:');
    lines.push('   • Overheard conversation or gossip');
    lines.push('   • News from a messenger or traveler');
    lines.push('   • Returning to find direct evidence');
    lines.push('   • A character informing the MC');
    lines.push('   • Witnessing aftermath or consequences');
    lines.push('');
  }
  
  if (urgentEvents.length > eventsToDiscover.length) {
    const additionalUrgent = urgentEvents.filter(
      e => !eventsToDiscover.find(ed => ed.id === e.id)
    );
    
    if (additionalUrgent.length > 0) {
      lines.push('⚠️ ADDITIONAL URGENT EVENTS (discover soon):');
      for (const event of additionalUrgent.slice(0, 3)) {
        lines.push(`   • ${event.summary}`);
      }
      lines.push('');
    }
  }
  
  lines.push('════════════════════════════════════════════════════════════════════');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Inject Living World context into a built prompt
 */
export function injectLivingWorldContext(
  builtPrompt: BuiltPrompt,
  novelId: string,
  currentChapter: number,
  recentChapters: Chapter[] = []
): { prompt: BuiltPrompt; injectionContext: WorldEventInjectionContext } {
  const injectionContext = buildEventInjectionContext(
    novelId,
    currentChapter,
    recentChapters
  );
  
  // If no events to inject, return unchanged
  if (!injectionContext.formattedContext) {
    return { prompt: builtPrompt, injectionContext };
  }
  
  // Inject context into system instruction
  const enhancedPrompt: BuiltPrompt = {
    ...builtPrompt,
    systemInstruction: builtPrompt.systemInstruction + injectionContext.formattedContext,
  };
  
  logger.info('Injected Living World context into prompt', 'livingWorld', {
    eventsToDiscover: injectionContext.eventsToDiscover.length,
    totalPending: injectionContext.pendingEventCount,
    urgentCount: injectionContext.urgentEvents.length,
  });
  
  return { prompt: enhancedPrompt, injectionContext };
}

/**
 * Post-generation: Mark events as discovered based on chapter content
 */
export function processChapterForDiscoveries(
  novelId: string,
  chapter: Chapter,
  injectionContext: WorldEventInjectionContext
): {
  discoveredEventIds: string[];
  remainingUndiscovered: number;
} {
  const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
  const discoveredEventIds: string[] = [];
  
  // Check each event that was supposed to be discovered
  for (const event of injectionContext.eventsToDiscover) {
    // Check if the chapter content references this event
    const isReferenced = checkEventReferenced(event, content);
    
    if (isReferenced) {
      discoveredEventIds.push(event.id);
    }
  }
  
  // Mark discovered events
  if (discoveredEventIds.length > 0) {
    markEventsDiscovered(novelId, discoveredEventIds, chapter.number);
    
    logger.info('Marked events as discovered', 'livingWorld', {
      discoveredCount: discoveredEventIds.length,
      chapter: chapter.number,
    });
  }
  
  // Get remaining count
  const allUndiscovered = getUndiscoveredEvents(novelId);
  
  return {
    discoveredEventIds,
    remainingUndiscovered: allUndiscovered.length,
  };
}

/**
 * Check if a chapter references a specific event using enhanced NLP matching
 */
function checkEventReferenced(event: GlobalWorldEvent, content: string): boolean {
  // Calculate a discovery score - need threshold to confirm discovery
  let discoveryScore = 0;
  const matchDetails: string[] = [];

  // 1. Direct entity name mention (highest confidence)
  for (const entityName of event.affectedEntityNames) {
    const entityLower = entityName.toLowerCase();
    if (content.includes(entityLower)) {
      discoveryScore += 40;
      matchDetails.push(`Entity: ${entityName}`);
    }
    
    // Check for partial name matches (e.g., "Azure Sect" matching "Azure Cloud Sect")
    const nameParts = entityLower.split(/\s+/);
    if (nameParts.length > 1) {
      const significantPart = nameParts.find(p => p.length > 3 && !commonWords.has(p));
      if (significantPart && content.includes(significantPart)) {
        discoveryScore += 15;
        matchDetails.push(`Partial: ${significantPart}`);
      }
    }
  }

  // 2. Event type keywords with context
  const typeKeywords = getEventTypeKeywords(event.eventType);
  for (const keyword of typeKeywords.primary) {
    if (content.includes(keyword)) {
      discoveryScore += 20;
      matchDetails.push(`Primary keyword: ${keyword}`);
      
      // Bonus if keyword is near entity mention
      if (isKeywordNearEntity(content, keyword, event.affectedEntityNames)) {
        discoveryScore += 15;
        matchDetails.push('Keyword near entity');
      }
    }
  }
  
  for (const keyword of typeKeywords.secondary) {
    if (content.includes(keyword)) {
      discoveryScore += 10;
      matchDetails.push(`Secondary keyword: ${keyword}`);
    }
  }

  // 3. Semantic similarity to event description
  const descriptionKeywords = extractSignificantWords(event.description);
  let descriptionMatches = 0;
  for (const word of descriptionKeywords) {
    if (content.includes(word.toLowerCase())) {
      descriptionMatches++;
    }
  }
  if (descriptionMatches >= 3) {
    discoveryScore += 15;
    matchDetails.push(`Description match: ${descriptionMatches} words`);
  }

  // 4. Story hook phrase matching
  const hookWords = extractSignificantWords(event.storyHook);
  let hookMatches = 0;
  for (const word of hookWords) {
    if (content.includes(word.toLowerCase())) {
      hookMatches++;
    }
  }
  if (hookMatches >= 2) {
    discoveryScore += 10;
    matchDetails.push(`Hook match: ${hookMatches} words`);
  }

  // 5. Contextual patterns
  const contextPatterns = getContextualPatterns(event.eventType);
  for (const pattern of contextPatterns) {
    if (pattern.test(content)) {
      discoveryScore += 15;
      matchDetails.push('Contextual pattern match');
      break;
    }
  }

  // 6. Information delivery patterns (news, gossip, messenger)
  if (hasInformationDeliveryPattern(content, event.affectedEntityNames)) {
    discoveryScore += 20;
    matchDetails.push('Information delivery pattern');
  }

  // Log detailed match for debugging
  if (discoveryScore >= 30) {
    logger.debug('Event discovery score calculated', 'livingWorld', {
      eventId: event.id,
      eventType: event.eventType,
      score: discoveryScore,
      matches: matchDetails,
    });
  }

  // Threshold for discovery confirmation
  return discoveryScore >= 50;
}

/**
 * Common words to exclude from matching
 */
const commonWords = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'that', 'this',
  'will', 'have', 'been', 'being', 'their', 'there', 'what', 'which',
  'when', 'where', 'sect', 'clan', 'family', 'master', 'elder', 'young'
]);

/**
 * Get keywords for each event type
 */
function getEventTypeKeywords(eventType: string): { primary: string[]; secondary: string[] } {
  const keywords: Record<string, { primary: string[]; secondary: string[] }> = {
    sect_destruction: {
      primary: ['destroyed', 'annihilated', 'wiped out', 'massacre', 'fallen', 'no more'],
      secondary: ['ruins', 'ashes', 'survivors', 'remnants', 'devastation', 'obliterated'],
    },
    sect_rise: {
      primary: ['rose to power', 'dominant', 'strongest', 'supreme', 'ascended'],
      secondary: ['growing', 'expanding', 'flourishing', 'prosperous', 'powerful'],
    },
    power_shift: {
      primary: ['power shift', 'balance changed', 'new order', 'hierarchy', 'overthrow'],
      secondary: ['influence', 'control', 'territory', 'dominance', 'succession'],
    },
    npc_death: {
      primary: ['died', 'dead', 'killed', 'perished', 'fallen', 'passed away', 'no longer'],
      secondary: ['funeral', 'mourning', 'successor', 'legacy', 'demise', 'end'],
    },
    npc_advancement: {
      primary: ['breakthrough', 'advanced', 'ascended', 'reached', 'achieved'],
      secondary: ['cultivation', 'realm', 'level', 'power', 'stronger'],
    },
    territory_conquest: {
      primary: ['conquered', 'captured', 'seized', 'occupied', 'fell to'],
      secondary: ['territory', 'land', 'border', 'invasion', 'claimed'],
    },
    alliance_formed: {
      primary: ['alliance', 'united', 'joined forces', 'partnership', 'coalition'],
      secondary: ['cooperation', 'treaty', 'agreement', 'pact', 'together'],
    },
    alliance_broken: {
      primary: ['betrayed', 'broke alliance', 'separated', 'dissolved', 'ended'],
      secondary: ['treachery', 'split', 'hostility', 'former allies', 'backstab'],
    },
    war_outbreak: {
      primary: ['war', 'conflict began', 'hostilities', 'battle', 'fighting'],
      secondary: ['armies', 'mobilize', 'declaration', 'attack', 'invasion'],
    },
    war_conclusion: {
      primary: ['peace', 'war ended', 'victory', 'surrender', 'ceasefire'],
      secondary: ['treaty', 'truce', 'aftermath', 'reconstruction', 'reconciliation'],
    },
    treasure_discovery: {
      primary: ['treasure', 'discovered', 'found', 'unearthed', 'ancient'],
      secondary: ['artifact', 'relic', 'inheritance', 'secret', 'hidden'],
    },
    calamity: {
      primary: ['disaster', 'calamity', 'catastrophe', 'beast tide', 'devastation'],
      secondary: ['destruction', 'survivors', 'refugees', 'aftermath', 'recovery'],
    },
    secret_revealed: {
      primary: ['revealed', 'exposed', 'discovered', 'truth', 'secret'],
      secondary: ['hidden', 'conspiracy', 'unmasked', 'identity', 'scandal'],
    },
  };
  
  return keywords[eventType] || { primary: [], secondary: [] };
}

/**
 * Check if a keyword appears near any entity name
 */
function isKeywordNearEntity(
  content: string,
  keyword: string,
  entityNames: string[]
): boolean {
  const keywordIndex = content.indexOf(keyword);
  if (keywordIndex === -1) return false;
  
  // Check 150 characters before and after
  const contextStart = Math.max(0, keywordIndex - 150);
  const contextEnd = Math.min(content.length, keywordIndex + keyword.length + 150);
  const context = content.substring(contextStart, contextEnd);
  
  for (const name of entityNames) {
    if (context.includes(name.toLowerCase())) {
      return true;
    }
    // Also check significant parts of multi-word names
    const parts = name.split(/\s+/);
    for (const part of parts) {
      if (part.length > 3 && !commonWords.has(part.toLowerCase()) && context.includes(part.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract significant words from text for matching
 */
function extractSignificantWords(text: string): string[] {
  if (!text) return [];
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !commonWords.has(w));
  
  // Return unique words
  return Array.from(new Set(words));
}

/**
 * Get contextual regex patterns for event types
 */
function getContextualPatterns(eventType: string): RegExp[] {
  const patterns: Record<string, RegExp[]> = {
    sect_destruction: [
      /\b(heard|news|told|said).{0,50}(destroyed|fallen|annihilated)/i,
      /\b(no longer|doesn't exist|wiped out)/i,
      /\bonly.{0,30}(survivors|remnants)/i,
    ],
    npc_death: [
      /\b(heard|news|told|learned).{0,50}(died|dead|killed|passed)/i,
      /\b(mourning|funeral|successor)/i,
      /\bthe late\b/i,
    ],
    npc_advancement: [
      /\b(heard|news|learned).{0,50}(breakthrough|advanced|reached)/i,
      /\b(now|became).{0,30}(nascent soul|golden core|foundation)/i,
    ],
    war_outbreak: [
      /\b(war|conflict|battle).{0,30}(begun|started|broke out)/i,
      /\b(armies|troops).{0,30}(mobiliz|march|attack)/i,
    ],
    alliance_formed: [
      /\b(alliance|pact|agreement).{0,30}(formed|signed|agreed)/i,
      /\bjoined forces\b/i,
    ],
    treasure_discovery: [
      /\b(treasure|artifact|relic).{0,30}(found|discovered|appeared)/i,
      /\bancient.{0,30}(opened|revealed)/i,
    ],
  };
  
  return patterns[eventType] || [];
}

/**
 * Check for information delivery patterns (news, gossip, messenger)
 */
function hasInformationDeliveryPattern(content: string, entityNames: string[]): boolean {
  const deliveryPatterns = [
    /\b(heard|news|told|said|mentioned|rumor|gossip).{0,100}/i,
    /\b(messenger|traveler|visitor|guest).{0,100}(said|told|reported|brought news)/i,
    /\b(did you hear|have you heard|word is|they say)/i,
    /\b(shocked|surprised|stunned).{0,50}(to hear|to learn|by the news)/i,
    /\bapparently\b.{0,100}/i,
  ];
  
  for (const pattern of deliveryPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Check if any entity is mentioned near the delivery pattern
      const matchIndex = match.index || 0;
      const context = content.substring(
        Math.max(0, matchIndex - 50),
        Math.min(content.length, matchIndex + match[0].length + 150)
      );
      
      for (const name of entityNames) {
        const nameLower = name.toLowerCase();
        if (context.includes(nameLower)) {
          return true;
        }
        // Check significant name parts
        const parts = name.split(/\s+/);
        for (const part of parts) {
          if (part.length > 3 && !commonWords.has(part.toLowerCase()) && context.includes(part.toLowerCase())) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Generate a "world has changed" notification for UI
 */
export function generateWorldChangeNotification(
  injectionContext: WorldEventInjectionContext
): string | null {
  if (injectionContext.pendingEventCount === 0) {
    return null;
  }
  
  const urgentCount = injectionContext.urgentEvents.length;
  
  if (urgentCount > 0) {
    return `⚡ ${urgentCount} urgent world event(s) await discovery. The world has changed while the MC was away.`;
  }
  
  return `📢 ${injectionContext.pendingEventCount} world event(s) have occurred. Consider revealing them naturally in upcoming chapters.`;
}

/**
 * Get story hooks from pending events for display
 */
export function getPendingStoryHooks(novelId: string, maxHooks: number = 5): string[] {
  const undiscovered = getUndiscoveredEvents(novelId);
  return generateEventStoryHooks(undiscovered.slice(0, maxHooks));
}

/**
 * Check if Living World has content to inject
 */
export function hasLivingWorldContent(novelId: string): boolean {
  const status = getLivingWorldStatus(novelId);
  return status.enabled && status.undiscoveredEvents > 0;
}

/**
 * Generate a concise summary of pending world events for quick reference
 */
export function getPendingEventsSummary(novelId: string): {
  total: number;
  urgent: number;
  byType: Record<string, number>;
  topEvents: Array<{ summary: string; urgency: string; impact: string }>;
} {
  const undiscovered = getUndiscoveredEvents(novelId);
  const urgent = undiscovered.filter(e => e.urgency === 'immediate');
  
  // Count by type
  const byType: Record<string, number> = {};
  for (const event of undiscovered) {
    byType[event.eventType] = (byType[event.eventType] || 0) + 1;
  }
  
  // Top events
  const topEvents = undiscovered.slice(0, 5).map(e => ({
    summary: e.summary,
    urgency: e.urgency,
    impact: e.impact,
  }));
  
  return {
    total: undiscovered.length,
    urgent: urgent.length,
    byType,
    topEvents,
  };
}
