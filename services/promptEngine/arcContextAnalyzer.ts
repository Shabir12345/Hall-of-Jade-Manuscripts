import { NovelState, Arc, Chapter, Character, ArcContextSummary, CharacterArcJourney, ArcProgressionAnalysis, LogicAudit, ForeshadowingElement, ForeshadowingType, ForeshadowingStatus, ForeshadowingSubtlety, SymbolicElement, EmotionalPayoffMoment, EmotionalPayoffType, EmotionalIntensity, EmotionalArcTemplate, NarrativeArchetype, NarrativeArchetypeSuggestion } from '../../types';
import { textContainsCharacterName } from '../../utils/characterNameMatching';
import { generateUUID } from '../../utils/uuid';

/**
 * Arc Context Analyzer
 * Analyzes and summarizes previous arcs with tiered detail levels
 * Implements three-tier system: Recent (full detail), Middle (medium detail), Old (summary only)
 * 
 * Features:
 * - Comprehensive error handling for edge cases
 * - Character development tracking across arcs
 * - Arc transition quality analysis
 * - Setup/payoff tracking for foreshadowing
 * - Performance optimizations with memoization
 */

// Simple memoization cache for expensive operations
const analysisCache = new Map<string, {
  timestamp: number;
  arcSummaries?: ArcContextSummary[];
  characterJourneys?: CharacterArcJourney[];
  progression?: ArcProgressionAnalysis;
  foreshadowing?: ReturnType<typeof analyzeForeshadowing>;
  emotionalPayoffs?: ReturnType<typeof analyzeEmotionalPayoffs>;
  pacing?: ReturnType<typeof analyzePacing>;
  symbolism?: ReturnType<typeof analyzeSymbolism>;
}>();

const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get cache key for analysis operations
 */
function getCacheKey(state: NovelState, analysisType: string): string {
  return `${state.id}-${analysisType}-${state.chapters.length}-${state.plotLedger.length}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(cacheEntry: { timestamp: number }): boolean {
  return Date.now() - cacheEntry.timestamp < CACHE_TTL;
}

/**
 * Determines the tier of an arc based on its position relative to the most recent completed arc
 */
function determineArcTier(arcIndex: number, totalCompletedArcs: number): 'recent' | 'middle' | 'old' {
  if (arcIndex === totalCompletedArcs - 1) {
    return 'recent'; // Most recent completed arc
  } else if (arcIndex >= totalCompletedArcs - 3 && arcIndex < totalCompletedArcs - 1) {
    return 'middle'; // 2-3 arcs back
  } else {
    return 'old'; // 4+ arcs back
  }
}

/**
 * Gets chapters that belong to a specific arc
 * Handles edge cases where arc boundaries might not be properly set
 */
// Cache for logged warnings to prevent spam
const arcWarningCache = new WeakMap<Arc, boolean>();
// Cache for arc chapter logging to prevent excessive logs
const arcChapterLogCache = new WeakMap<Arc, { chapters: number[]; timestamp: number }>();

export function getArcChapters(arc: Arc, allChapters: Chapter[], allArcs?: Arc[]): Chapter[] {
  if (allChapters.length === 0) {
    return [];
  }

  // Sort chapters by number to ensure proper ordering
  const sortedChapters = [...allChapters].sort((a, b) => a.number - b.number);

  // If arc has no start chapter, try to infer it
  let startChapter = arc.startedAtChapter;
  if (!startChapter || startChapter <= 0) {
    // Try to infer from previous completed arc
    if (allArcs && allArcs.length > 0) {
      const sortedArcs = [...allArcs].sort((a, b) => {
        const aStart = a.startedAtChapter || 0;
        const bStart = b.startedAtChapter || 0;
        return aStart - bStart;
      });

      const currentArcIndex = sortedArcs.findIndex(a => a.id === arc.id);
      if (currentArcIndex > 0) {
        const prevArc = sortedArcs[currentArcIndex - 1];
        // If previous arc is completed, this arc should start after it
        if (prevArc.status === 'completed' && prevArc.endedAtChapter) {
          startChapter = prevArc.endedAtChapter + 1;
        } else if (prevArc.startedAtChapter) {
          // If previous arc is active or incomplete, estimate start
          const prevArcChapters = getArcChapters(prevArc, sortedChapters, allArcs);
          if (prevArcChapters.length > 0) {
            const maxPrevChapter = Math.max(...prevArcChapters.map(ch => ch.number));
            startChapter = maxPrevChapter + 1;
          } else {
            startChapter = (prevArc.startedAtChapter || 1) + 10; // Estimate
          }
        }
      }
    }

    if (!startChapter || startChapter <= 0) {
      startChapter = 1;
    }

    // Only log once per arc to avoid spam (and only in development)
    if (!arcWarningCache.get(arc) && process.env.NODE_ENV === 'development') {
      console.warn(`Arc "${arc.title}" has no startedAtChapter. Inferred start as chapter ${startChapter}.`);
      arcWarningCache.set(arc, true);
    }
  }

  const endChapter = arc.endedAtChapter;

  // Handle completed arcs
  if (arc.status === 'completed') {
    if (endChapter && endChapter > 0) {
      // Arc has explicit end chapter - use it
      return sortedChapters.filter(ch =>
        ch.number >= startChapter && ch.number <= endChapter
      );
    } else {
      // Completed arc without end chapter - infer from next arc's start or use all chapters from start
      if (allArcs && allArcs.length > 0) {
        const sortedArcs = [...allArcs].sort((a, b) => {
          const aStart = a.startedAtChapter || 0;
          const bStart = b.startedAtChapter || 0;
          return aStart - bStart;
        });

        const currentArcIndex = sortedArcs.findIndex(a => a.id === arc.id);
        if (currentArcIndex >= 0 && currentArcIndex < sortedArcs.length - 1) {
          // There's a next arc - end where it starts (minus 1)
          const nextArc = sortedArcs[currentArcIndex + 1];
          if (nextArc.startedAtChapter && nextArc.startedAtChapter > startChapter) {
            const inferredEnd = nextArc.startedAtChapter - 1;
            return sortedChapters.filter(ch =>
              ch.number >= startChapter && ch.number <= inferredEnd
            );
          }
        }
      }

      // No next arc - use all chapters from start to last chapter
      const maxChapterNumber = sortedChapters[sortedChapters.length - 1]?.number || startChapter;
      return sortedChapters.filter(ch =>
        ch.number >= startChapter && ch.number <= maxChapterNumber
      );
    }
  }

  // Handle active arcs (or arcs without explicit status)
  if (!endChapter || endChapter <= 0) {
    // Active arc - return chapters from start to current
    // First, try to determine the end based on other arcs
    let actualStart = startChapter;
    let actualEnd: number | undefined = undefined;

    if (allArcs && allArcs.length > 1) {
      const sortedArcs = [...allArcs].sort((a, b) => {
        const aStart = a.startedAtChapter || 0;
        const bStart = b.startedAtChapter || 0;
        return aStart - bStart;
      });

      const currentArcIndex = sortedArcs.findIndex(a => a.id === arc.id);

      if (currentArcIndex >= 0) {
        // Check if there's a previous completed arc to help determine our start
        if (currentArcIndex > 0) {
          const prevArc = sortedArcs[currentArcIndex - 1];
          const prevArcStart = prevArc.startedAtChapter || 1;

          // If previous arc is completed with an end, ensure we start after it
          if (prevArc.status === 'completed' && prevArc.endedAtChapter && prevArc.endedAtChapter > 0) {
            // Previous arc ends - this arc should start after it
            actualStart = Math.max(actualStart, prevArc.endedAtChapter + 1);
          } else if (prevArc.status === 'completed') {
            // Previous arc is completed but no explicit end - need to infer it
            // Special case: If we're the second arc and our start is at the very end, likely wrong
            if (currentArcIndex === 1 && prevArcStart === 1 && startChapter >= sortedChapters.length - 1 && sortedChapters.length >= 20) {
              // Second arc with start at the end - definitely wrong, estimate based on typical distribution
              // If total is 21 and first arc started at 1, estimate first arc ends at 10, we start at 11
              const estimatedPrevEnd = 10; // Typical first arc length
              actualStart = Math.max(actualStart, estimatedPrevEnd + 1);
              if (process.env.NODE_ENV === 'development') {
                console.log(`Auto-correcting second arc "${arc.title}": startChapter ${startChapter} is too high, adjusting to ${actualStart} based on typical arc distribution`);
              }
            } else {
              // Find chapters that likely belong to prev arc (between prev start and our start, or estimate)
              const chaptersBeforeUs = sortedChapters.filter(ch =>
                ch.number >= prevArcStart && ch.number < startChapter
              );
              if (chaptersBeforeUs.length >= 8 && chaptersBeforeUs.length <= 12) {
                // First arc likely has ~10 chapters, so we should start after it
                const maxPrevChapter = Math.max(...chaptersBeforeUs.map(ch => ch.number));
                actualStart = Math.max(actualStart, maxPrevChapter + 1);
              } else if (prevArcStart > 0) {
                // General case: estimate based on prev arc start + typical length
                const estimatedPrevEnd = prevArcStart + 9; // Estimate 10 chapters for prev arc
                actualStart = Math.max(actualStart, estimatedPrevEnd + 1);
              }
            }
          } else if (prevArc.startedAtChapter) {
            // Previous arc is active - we shouldn't be here (only one active arc), but handle it
            // Use the prev arc's start + estimate
            const estimatedPrevEnd = prevArcStart + 9;
            actualStart = Math.max(actualStart, estimatedPrevEnd + 1);
          }
        }

        // Check if there's a next arc that starts after this one
        if (currentArcIndex < sortedArcs.length - 1) {
          const nextArc = sortedArcs[currentArcIndex + 1];
          // Only end before next arc if next arc has a valid start that's greater than our start
          if (nextArc.startedAtChapter && nextArc.startedAtChapter > actualStart) {
            actualEnd = nextArc.startedAtChapter - 1;
          }
        }
      }
    }

    // Filter chapters based on determined boundaries
    const filtered = sortedChapters.filter(ch => {
      if (actualEnd !== undefined) {
        return ch.number >= actualStart && ch.number <= actualEnd;
      }
      return ch.number >= actualStart;
    });

    // Debug logging for troubleshooting (throttled to prevent spam)
    if (process.env.NODE_ENV === 'development') {
      const chapterNumbers = filtered.map(ch => ch.number);
      const cached = arcChapterLogCache.get(arc);
      const now = Date.now();
      const shouldLog = !cached ||
        JSON.stringify(cached.chapters) !== JSON.stringify(chapterNumbers) ||
        (now - cached.timestamp) > 5000; // Log at most once every 5 seconds

      if (shouldLog) {
        if (filtered.length === 0 && sortedChapters.length > 0) {
          console.warn(`Arc "${arc.title}" (start: ${startChapter}, actualStart: ${actualStart}, actualEnd: ${actualEnd}) returned no chapters. Available chapters: ${sortedChapters.map(ch => ch.number).join(', ')}`);
        } else if (filtered.length > 0) {
          console.log(`Arc "${arc.title}" found ${filtered.length} chapters: ${chapterNumbers.join(', ')} (start: ${startChapter}, actualStart: ${actualStart}, actualEnd: ${actualEnd})`);
        }
        arcChapterLogCache.set(arc, { chapters: chapterNumbers, timestamp: now });
      }
    }

    return filtered;
  }

  // Arc has explicit end chapter - use it
  const filtered = sortedChapters.filter(ch =>
    ch.number >= startChapter && ch.number <= endChapter
  );

  // If we got no chapters but arc has boundaries, there might be a gap - log warning
  if (filtered.length === 0 && endChapter > startChapter) {
    if (!arcWarningCache.get(arc)) {
      console.warn(`Arc "${arc.title}" (Ch ${startChapter}-${endChapter}) has no matching chapters. Available chapters: ${sortedChapters.map(ch => ch.number).join(', ')}`);
      arcWarningCache.set(arc, true);
    }
  }

  return filtered;
}

/**
 * Validates and auto-repairs arc state inconsistencies
 * Returns the validated/repaired arc and a list of issues found
 */
export function validateArcState(
  arc: Arc,
  allChapters: Chapter[],
  allArcs: Arc[]
): { arc: Arc; issues: string[]; wasRepaired: boolean } {
  const issues: string[] = [];
  let repairedArc = { ...arc };
  let wasRepaired = false;

  // Validate startedAtChapter
  if (repairedArc.startedAtChapter) {
    if (repairedArc.startedAtChapter <= 0) {
      issues.push(`Arc "${arc.title}" has invalid startedAtChapter ${arc.startedAtChapter} (must be > 0)`);
      // Auto-repair: find actual start chapter from existing chapters
      const arcChapters = getArcChapters(arc, allChapters, allArcs);
      if (arcChapters.length > 0) {
        const minChapter = Math.min(...arcChapters.map(ch => ch.number));
        repairedArc.startedAtChapter = minChapter;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set startedAtChapter to ${minChapter} (first chapter in arc)`);
      } else {
        // No chapters yet, set to next chapter
        repairedArc.startedAtChapter = allChapters.length + 1;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set startedAtChapter to ${allChapters.length + 1} (next chapter)`);
      }
    } else if (repairedArc.startedAtChapter > allChapters.length + 1) {
      issues.push(`Arc "${arc.title}" has startedAtChapter ${arc.startedAtChapter} but only ${allChapters.length} chapters exist`);
      // Auto-repair: check if there are chapters that should belong to this arc
      const arcChapters = getArcChapters(arc, allChapters, allArcs);
      if (arcChapters.length > 0) {
        const minChapter = Math.min(...arcChapters.map(ch => ch.number));
        repairedArc.startedAtChapter = minChapter;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set startedAtChapter to ${minChapter} (first chapter in arc)`);
      } else {
        // No chapters yet, set to next chapter
        repairedArc.startedAtChapter = allChapters.length + 1;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set startedAtChapter to ${allChapters.length + 1} (next chapter)`);
      }
    }
  }

  // Validate endedAtChapter for completed arcs
  if (repairedArc.status === 'completed' && repairedArc.endedAtChapter) {
    if (repairedArc.endedAtChapter <= 0) {
      issues.push(`Arc "${arc.title}" has invalid endedAtChapter ${arc.endedAtChapter} (must be > 0)`);
      // Auto-repair: find actual end chapter
      const arcChapters = getArcChapters(repairedArc, allChapters, allArcs);
      if (arcChapters.length > 0) {
        const maxChapter = Math.max(...arcChapters.map(ch => ch.number));
        repairedArc.endedAtChapter = maxChapter;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set endedAtChapter to ${maxChapter} (last chapter in arc)`);
      } else {
        repairedArc.endedAtChapter = allChapters.length;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set endedAtChapter to ${allChapters.length} (current chapter count)`);
      }
    } else if (repairedArc.startedAtChapter && repairedArc.endedAtChapter < repairedArc.startedAtChapter) {
      issues.push(`Arc "${arc.title}" has endedAtChapter ${repairedArc.endedAtChapter} < startedAtChapter ${repairedArc.startedAtChapter}`);
      // Auto-repair: swap them or find correct end
      const arcChapters = getArcChapters(repairedArc, allChapters, allArcs);
      if (arcChapters.length > 0) {
        const maxChapter = Math.max(...arcChapters.map(ch => ch.number));
        repairedArc.endedAtChapter = maxChapter;
        wasRepaired = true;
        issues.push(`Auto-repaired: Set endedAtChapter to ${maxChapter} (last chapter in arc)`);
      }
    }
  }

  // Check for overlapping arcs (warning only, don't auto-repair as overlaps might be intentional)
  if (repairedArc.startedAtChapter && repairedArc.endedAtChapter) {
    const overlappingArcs = allArcs.filter(a =>
      a.id !== arc.id &&
      a.startedAtChapter &&
      a.endedAtChapter &&
      !(repairedArc.endedAtChapter! < a.startedAtChapter! || repairedArc.startedAtChapter! > a.endedAtChapter!)
    );

    if (overlappingArcs.length > 0) {
      issues.push(`Arc "${arc.title}" overlaps with: ${overlappingArcs.map(a => `"${a.title}"`).join(', ')}`);
      // Note: We don't auto-repair overlaps as they might be intentional, just warn
    }
  }

  // Validate targetChapters
  if (repairedArc.targetChapters !== undefined && repairedArc.targetChapters <= 0) {
    issues.push(`Arc "${arc.title}" has invalid targetChapters ${arc.targetChapters} (must be > 0)`);
    // Auto-repair: use actual chapter count or default
    const arcChapters = getArcChapters(repairedArc, allChapters, allArcs);
    repairedArc.targetChapters = Math.max(arcChapters.length, 10); // Default to 10 if no chapters
    wasRepaired = true;
    issues.push(`Auto-repaired: Set targetChapters to ${repairedArc.targetChapters}`);
  }

  return { arc: repairedArc, issues, wasRepaired };
}

/**
 * Validates all arcs in a novel state and returns repaired state
 */
export function validateAllArcStates(state: NovelState): {
  novelState: NovelState;
  issues: string[];
  repairsMade: number
} {
  const issues: string[] = [];
  let repairsMade = 0;

  const validatedArcs = state.plotLedger.map(arc => {
    const result = validateArcState(arc, state.chapters, state.plotLedger);
    if (result.wasRepaired) {
      repairsMade++;
    }
    if (result.issues.length > 0) {
      issues.push(...result.issues);
    }
    return result.arc;
  });

  return {
    novelState: {
      ...state,
      plotLedger: validatedArcs,
    },
    issues,
    repairsMade,
  };
}

/**
 * Analyzes tension curve for an arc based on logic audits
 */
function analyzeArcTensionCurve(chapters: Chapter[]): {
  startLevel: 'low' | 'medium' | 'high' | 'peak';
  endLevel: 'low' | 'medium' | 'high' | 'peak';
  peakChapter?: number;
} {
  if (chapters.length === 0) {
    return { startLevel: 'medium', endLevel: 'medium' };
  }

  const tensionKeywords = {
    peak: ['death', 'betrayal', 'catastrophe', 'ultimate', 'final', 'doom', 'extinction', 'climax', 'battle', 'war'],
    high: ['danger', 'threat', 'enemy', 'attack', 'crisis', 'conflict', 'fight'],
    medium: ['challenge', 'obstacle', 'difficulty', 'problem', 'trouble'],
    low: ['peace', 'calm', 'rest', 'training', 'preparation', 'planning', 'recovery'],
  };

  const getTensionLevel = (content: string): 'low' | 'medium' | 'high' | 'peak' => {
    const contentLower = content.toLowerCase();
    for (const keyword of tensionKeywords.peak) {
      if (contentLower.includes(keyword)) return 'peak';
    }
    for (const keyword of tensionKeywords.high) {
      if (contentLower.includes(keyword)) return 'high';
    }
    for (const keyword of tensionKeywords.medium) {
      if (contentLower.includes(keyword)) return 'medium';
    }
    return 'low';
  };

  const startChapter = chapters[0];
  const endChapter = chapters[chapters.length - 1];

  const startContent = (startChapter.content + ' ' + startChapter.summary).toLowerCase();
  const endContent = (endChapter.content + ' ' + endChapter.summary).toLowerCase();

  let startLevel = getTensionLevel(startContent);
  let endLevel = getTensionLevel(endContent);

  // Check logic audits for better tension analysis
  if (startChapter.logicAudit) {
    const auditText = (startChapter.logicAudit.theFriction + ' ' + startChapter.logicAudit.resultingValue).toLowerCase();
    startLevel = getTensionLevel(auditText);
  }
  if (endChapter.logicAudit) {
    const auditText = (endChapter.logicAudit.theFriction + ' ' + endChapter.logicAudit.resultingValue).toLowerCase();
    endLevel = getTensionLevel(auditText);
  }

  // Find peak chapter
  let peakChapter: number | undefined;
  let maxTension: 'low' | 'medium' | 'high' | 'peak' = 'low';

  chapters.forEach(ch => {
    const content = (ch.content + ' ' + ch.summary).toLowerCase();
    const level = getTensionLevel(content);
    if (level === 'peak' || (level === 'high' && maxTension !== 'peak')) {
      maxTension = level;
      peakChapter = ch.number;
    }
  });

  return { startLevel, endLevel, peakChapter };
}

/**
 * Extracts character development for an arc with improved analysis
 */
function extractArcCharacterDevelopment(
  arc: Arc,
  arcChapters: Chapter[],
  characters: Character[]
): Array<{
  characterName: string;
  changes: string[];
  relationships: string[];
  powerProgression?: string;
}> {
  if (!arcChapters || arcChapters.length === 0 || !characters || characters.length === 0) {
    return [];
  }

  const development: Array<{
    characterName: string;
    changes: string[];
    relationships: string[];
    powerProgression?: string;
  }> = [];

  characters.forEach(char => {
    if (!char || !char.name) return;

    try {
      // Find chapters where this character appears with improved matching
      const characterChapters = arcChapters.filter(ch => {
        if (!ch) return false;
        const content = (ch.content || '') + ' ' + (ch.summary || '') + ' ' + (ch.title || '');
        return textContainsCharacterName(content, char.name);
      });

      if (characterChapters.length === 0) {
        return; // Character not in this arc
      }

      const changes: string[] = [];
      const relationships: string[] = [];
      const changeKeywords = [
        'became', 'gained', 'lost', 'learned', 'discovered', 'changed', 'developed',
        'improved', 'grew', 'realized', 'understood', 'decided', 'chose', 'overcame',
        'mastered', 'achieved', 'accepted', 'rejected', 'betrayed', 'forgave'
      ];

      // Extract changes from chapter summaries and logic audits
      characterChapters.forEach(ch => {
        // From summaries
        if (ch.summary) {
          const sentences = ch.summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
          sentences.forEach(sentence => {
            const sentenceLower = sentence.toLowerCase();
            if (textContainsCharacterName(sentence, char.name) &&
              changeKeywords.some(kw => sentenceLower.includes(kw))) {
              const trimmed = sentence.trim().substring(0, 200);
              if (trimmed.length > 20 && !changes.includes(trimmed)) {
                changes.push(trimmed);
              }
            }
          });
        }

        // From logic audits - these often capture character growth
        if (ch.logicAudit) {
          const auditText = `${ch.logicAudit.theChoice} ${ch.logicAudit.resultingValue}`.toLowerCase();
          if (textContainsCharacterName(auditText, char.name) &&
            changeKeywords.some(kw => auditText.includes(kw))) {
            const change = `${ch.logicAudit.resultingValue}`.substring(0, 200);
            if (change.length > 10 && !changes.includes(change)) {
              changes.push(change);
            }
          }
        }
      });

      // Extract relationship changes - improved detection
      const relationshipMentions = new Map<string, number>(); // Track frequency
      characterChapters.forEach(ch => {
        const content = ((ch.content || '') + ' ' + (ch.summary || '')).toLowerCase();
        char.relationships.forEach(rel => {
          const targetChar = characters.find(c => c && c.id === rel.characterId);
          if (targetChar && textContainsCharacterName(content, targetChar.name)) {
            const key = `${rel.type} with ${targetChar.name}`;
            relationshipMentions.set(key, (relationshipMentions.get(key) || 0) + 1);
          }
        });
      });

      // Sort by frequency and take most significant relationships
      const sortedRelationships = Array.from(relationshipMentions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => key);
      relationships.push(...sortedRelationships);

      // Extract power progression (for cultivation novels) - improved detection
      let powerProgression: string | undefined;
      if (char.currentCultivation && char.currentCultivation.trim().length > 0) {
        const allArcContent = arcChapters
          .map(ch => (ch.content || '') + ' ' + (ch.summary || ''))
          .join(' ')
          .toLowerCase();

        const cultivationKeywords = ['breakthrough', 'ascend', 'realm', 'level', 'cultivation', 'power', 'qi', 'dantian'];
        const hasCultivationContent = cultivationKeywords.some(kw => allArcContent.includes(kw));

        if (hasCultivationContent && textContainsCharacterName(allArcContent, char.name)) {
          // Look for breakthrough mentions specifically about this character
          const lastChapter = characterChapters[characterChapters.length - 1];
          if (lastChapter) {
            const lastContent = ((lastChapter.content || '') + ' ' + (lastChapter.summary || '')).toLowerCase();
            const breakthroughSentences = lastContent
              .split(/[.!?]+/)
              .filter(s =>
                textContainsCharacterName(s, char.name) &&
                (s.includes('breakthrough') || s.includes('ascend') || s.includes('realm') || s.includes('level'))
              );

            if (breakthroughSentences.length > 0) {
              powerProgression = breakthroughSentences[0].trim().substring(0, 150);
            } else if (lastChapter.logicAudit && lastChapter.logicAudit.resultingValue.toLowerCase().includes('breakthrough')) {
              powerProgression = lastChapter.logicAudit.resultingValue.substring(0, 150);
            } else {
              powerProgression = `Power progression: ${char.currentCultivation}`;
            }
          }
        }
      }

      // Only include if there's meaningful development
      if (changes.length > 0 || relationships.length > 0 || powerProgression) {
        development.push({
          characterName: char.name,
          changes: changes.slice(0, 5),
          relationships: relationships.slice(0, 5),
          powerProgression,
        });
      }
    } catch (error) {
      console.error(`Error extracting development for character "${char.name}" in arc "${arc.title}":`, error);
      // Continue with other characters
    }
  });

  return development;
}

/**
 * Extracts plot threads for an arc
 */
function extractArcPlotThreads(
  arc: Arc,
  arcChapters: Chapter[]
): Array<{
  description: string;
  status: 'resolved' | 'ongoing' | 'unresolved';
  introducedIn: number;
}> {
  const threads: Array<{
    description: string;
    status: 'resolved' | 'ongoing' | 'unresolved';
    introducedIn: number;
  }> = [];

  // Extract from arc checklist
  if (arc.checklist) {
    arc.checklist.forEach(item => {
      threads.push({
        description: item.label,
        status: item.completed ? 'resolved' : 'unresolved',
        introducedIn: item.sourceChapterNumber || arc.startedAtChapter || 1,
      });
    });
  }

  // Extract unresolved conflicts from logic audits
  arcChapters.forEach(ch => {
    if (ch.logicAudit && ch.logicAudit.causalityType === 'But') {
      const conflictKeywords = ['however', 'but', 'yet', 'still', 'unresolved', 'pending', 'uncertain'];
      if (conflictKeywords.some(kw => ch.logicAudit!.resultingValue.toLowerCase().includes(kw))) {
        threads.push({
          description: ch.logicAudit.resultingValue.substring(0, 200),
          status: 'unresolved',
          introducedIn: ch.number,
        });
      }
    }
  });

  return threads;
}

/**
 * Extracts unresolved elements that should carry over to next arcs
 * Now with priority scoring to identify most critical unresolved elements
 */
function extractUnresolvedElements(
  arc: Arc,
  arcChapters: Chapter[]
): Array<{
  element: string;
  priority: 'high' | 'medium' | 'low';
  source: 'checklist' | 'question' | 'conflict' | 'setup';
}> {
  const unresolved: Array<{
    element: string;
    priority: 'high' | 'medium' | 'low';
    source: 'checklist' | 'question' | 'conflict' | 'setup';
  }> = [];

  // Check checklist for incomplete items - high priority
  if (arc.checklist) {
    arc.checklist
      .filter(item => !item.completed)
      .forEach(item => {
        // Prioritize based on how late in arc it was introduced
        let priority: 'high' | 'medium' | 'low' = 'medium';
        if (item.sourceChapterNumber && arc.endedAtChapter) {
          const arcLength = (arc.endedAtChapter - (arc.startedAtChapter || 1)) + 1;
          const position = item.sourceChapterNumber - (arc.startedAtChapter || 1);
          const ratio = position / arcLength;
          // Later in arc = higher priority (more recent setup)
          priority = ratio > 0.7 ? 'high' : ratio > 0.4 ? 'medium' : 'low';
        }

        unresolved.push({
          element: item.label,
          priority,
          source: 'checklist',
        });
      });
  }

  // Look for question patterns in the last few chapters - medium priority
  const lastChapters = arcChapters.slice(-3);
  lastChapters.forEach((ch, index) => {
    if (!ch || !ch.content) return;

    const content = ch.content.toLowerCase();
    const questionPatterns = [
      /what (will|should|might|could) (happen|occur|take place)/gi,
      /how (will|should|can|might)/gi,
      /why (did|does|will|should)/gi,
    ];

    questionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.slice(0, 2).forEach(match => {
          // Questions in last chapter are higher priority
          const priority = index === lastChapters.length - 1 ? 'high' : 'medium';
          unresolved.push({
            element: match.trim(),
            priority,
            source: 'question',
          });
        });
      }
    });
  });

  // Check for unresolved logic audit conflicts - high priority
  const lastChapter = arcChapters[arcChapters.length - 1];
  if (lastChapter?.logicAudit && lastChapter.logicAudit.causalityType === 'But') {
    const conflictKeywords = ['however', 'but', 'yet', 'still', 'unresolved', 'pending', 'uncertain'];
    if (conflictKeywords.some(kw => lastChapter.logicAudit!.resultingValue.toLowerCase().includes(kw))) {
      unresolved.push({
        element: lastChapter.logicAudit.resultingValue.substring(0, 150),
        priority: 'high',
        source: 'conflict',
      });
    }
  }

  // Look for setup patterns (foreshadowing) that haven't been resolved - medium priority
  const setupKeywords = ['mystery', 'secret', 'will discover', 'promise', 'vow', 'destiny'];
  lastChapters.forEach(ch => {
    if (!ch || !ch.content) return;

    const content = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
    setupKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        const sentences = (ch.summary || ch.content || '').split(/[.!?]+/);
        const setupSentence = sentences.find(s => s.toLowerCase().includes(keyword));
        if (setupSentence && setupSentence.trim().length > 20) {
          unresolved.push({
            element: setupSentence.trim().substring(0, 150),
            priority: 'medium',
            source: 'setup',
          });
        }
      }
    });
  });

  // Sort by priority (high first), then limit
  unresolved.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return unresolved.slice(0, 8); // Return top 8 most important
}

/**
 * Generates arc outcome summary
 */
function generateArcOutcome(
  arc: Arc,
  arcChapters: Chapter[]
): string {
  if (arcChapters.length === 0) {
    return 'Arc completed but no chapters found.';
  }

  const lastChapter = arcChapters[arcChapters.length - 1];

  // Use last chapter's logic audit or summary
  if (lastChapter.logicAudit) {
    return `Arc concluded with: ${lastChapter.logicAudit.resultingValue}. ${lastChapter.summary || ''}`.substring(0, 300);
  }

  if (lastChapter.summary) {
    return lastChapter.summary.substring(0, 300);
  }

  // Fallback to description
  return arc.description.substring(0, 300);
}

/**
 * Creates a comprehensive arc context summary with tiered detail
 */
export function analyzeArcContext(
  arc: Arc,
  allChapters: Chapter[],
  characters: Character[],
  tier: 'recent' | 'middle' | 'old'
): ArcContextSummary {
  const arcChapters = getArcChapters(arc, allChapters);
  const tensionCurve = analyzeArcTensionCurve(arcChapters);

  // Tier-based detail level
  let chapterSummaries: string[] = [];
  let keyEvents: string[] = [];

  if (tier === 'recent') {
    // Full detail: all chapter summaries
    chapterSummaries = arcChapters
      .map(ch => `Ch ${ch.number}: ${ch.summary || ch.title}`)
      .filter(s => s.length > 0);

    // Extract key events from logic audits
    keyEvents = arcChapters
      .filter(ch => ch.logicAudit)
      .map(ch => `${ch.logicAudit!.startingValue} → ${ch.logicAudit!.resultingValue} (${ch.logicAudit!.causalityType})`)
      .slice(0, 10);
  } else if (tier === 'middle') {
    // Medium detail: summaries for first, middle, and last chapters
    if (arcChapters.length > 0) {
      const first = arcChapters[0];
      const last = arcChapters[arcChapters.length - 1];
      const middle = arcChapters[Math.floor(arcChapters.length / 2)];

      chapterSummaries.push(`Ch ${first.number}: ${(first.summary || first.title).substring(0, 150)}`);
      if (middle && middle.number !== first.number && middle.number !== last.number) {
        chapterSummaries.push(`Ch ${middle.number}: ${(middle.summary || middle.title).substring(0, 150)}`);
      }
      chapterSummaries.push(`Ch ${last.number}: ${(last.summary || last.title).substring(0, 150)}`);
    }

    // Extract major events (only "But" conflicts and significant "Therefore" progressions)
    keyEvents = arcChapters
      .filter(ch => ch.logicAudit && (ch.logicAudit.causalityType === 'But' ||
        ch.logicAudit.resultingValue.toLowerCase().includes('breakthrough') ||
        ch.logicAudit.resultingValue.toLowerCase().includes('discover')))
      .map(ch => `${ch.logicAudit!.resultingValue}`)
      .slice(0, 5);
  } else {
    // Old tier: just arc description and chapter count
    chapterSummaries = [`Arc consisted of ${arcChapters.length} chapters.`];
  }

  const characterDevelopment = tier === 'old'
    ? []
    : extractArcCharacterDevelopment(arc, arcChapters, characters);

  const plotThreads = tier === 'old'
    ? []
    : extractArcPlotThreads(arc, arcChapters);

  // Extract unresolved elements (only for recent tier, or summary for middle tier)
  let unresolvedElements: string[] = [];
  if (tier === 'recent') {
    const unresolved = extractUnresolvedElements(arc, arcChapters);
    unresolvedElements = unresolved.map(u => {
      const priorityLabel = u.priority === 'high' ? '[HIGH PRIORITY]' : u.priority === 'medium' ? '[MEDIUM]' : '';
      return `${priorityLabel} ${u.element}`.trim();
    });
  } else if (tier === 'middle') {
    // Just get count and priority summary for middle tier
    const unresolved = extractUnresolvedElements(arc, arcChapters);
    const highPriorityCount = unresolved.filter(u => u.priority === 'high').length;
    if (highPriorityCount > 0) {
      unresolvedElements.push(`${highPriorityCount} high-priority unresolved elements`);
    }
  }

  const arcOutcome = generateArcOutcome(arc, arcChapters);

  return {
    arcId: arc.id,
    title: arc.title,
    tier,
    description: arc.description,
    chapters: {
      count: arcChapters.length,
      summaries: chapterSummaries,
      keyEvents,
    },
    characterDevelopment,
    plotThreads,
    tensionCurve,
    unresolvedElements,
    arcOutcome,
  };
}

/**
 * Analyzes all completed arcs and returns tiered summaries
 * Includes error handling, edge case management, and basic memoization
 */
export function analyzeAllArcContexts(
  state: NovelState
): ArcContextSummary[] {
  if (!state || !state.plotLedger || !state.chapters) {
    console.warn('Invalid state provided to analyzeAllArcContexts');
    return [];
  }

  // Create cache key based on state
  const cacheKey = `arcs-${state.id}-${state.plotLedger.length}-${state.chapters.length}-${state.updatedAt}`;
  const cached = analysisCache.get(cacheKey);
  const now = Date.now();

  // Use cache if valid and recent
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.arcSummaries;
  }

  const completedArcs = state.plotLedger
    .filter(arc => {
      if (!arc || arc.status !== 'completed') return false;
      // Validate arc has at least a title
      if (!arc.title || arc.title.trim().length === 0) {
        console.warn('Found arc with no title, skipping');
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      // If both have no end chapter, sort by start chapter
      if (aEnd === 0 && bEnd === 0) {
        return (a.startedAtChapter || 0) - (b.startedAtChapter || 0);
      }
      return aEnd - bEnd;
    });

  if (completedArcs.length === 0) {
    return [];
  }

  const summaries = completedArcs.map((arc, index) => {
    try {
      const tier = determineArcTier(index, completedArcs.length);
      return analyzeArcContext(arc, state.chapters, state.characterCodex, tier);
    } catch (error) {
      console.error(`Error analyzing arc "${arc.title}":`, error);
      // Return a minimal summary on error
      return {
        arcId: arc.id,
        title: arc.title || 'Untitled Arc',
        tier: determineArcTier(index, completedArcs.length),
        description: arc.description || 'No description available',
        chapters: { count: 0, summaries: [], keyEvents: [] },
        characterDevelopment: [],
        plotThreads: [],
        tensionCurve: { startLevel: 'medium', endLevel: 'medium' },
        unresolvedElements: [],
        arcOutcome: 'Error analyzing arc',
      };
    }
  });

  // Update cache
  if (analysisCache.size > 10) {
    // Clear oldest entries if cache gets too large
    const entries = Array.from(analysisCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 5).forEach(([key]) => analysisCache.delete(key));
  }

  analysisCache.set(cacheKey, {
    timestamp: now,
    arcSummaries: summaries,
    characterJourneys: [], // Will be populated separately
    progression: {} as ArcProgressionAnalysis, // Will be populated separately
  });

  return summaries;
}

/**
 * Tracks character journey across all arcs
 */
export function analyzeCharacterArcJourneys(
  state: NovelState
): CharacterArcJourney[] {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  return state.characterCodex.map(char => {
    const arcJourneys = completedArcs.map(arc => {
      const arcChapters = getArcChapters(arc, state.chapters);
      const startChapter = arcChapters[0];
      const endChapter = arcChapters[arcChapters.length - 1] || startChapter;

      // Extract state at arc start
      const stateAtStart = {
        cultivation: char.currentCultivation,
        relationships: char.relationships
          .map(rel => {
            const targetChar = state.characterCodex.find(c => c.id === rel.characterId);
            return targetChar ? `${rel.type} with ${targetChar.name}` : '';
          })
          .filter(r => r.length > 0),
        goals: extractGoals(char.notes, startChapter),
      };

      // Extract state at arc end (simplified - would need better tracking in real implementation)
      const stateAtEnd = {
        cultivation: char.currentCultivation, // Would need to track historical values
        relationships: char.relationships
          .map(rel => {
            const targetChar = state.characterCodex.find(c => c.id === rel.characterId);
            return targetChar ? `${rel.type} with ${targetChar.name}` : '';
          })
          .filter(r => r.length > 0),
        goals: extractGoals(char.notes, endChapter),
      };

      // Extract key changes in this arc
      const keyChanges: string[] = [];
      arcChapters.forEach(ch => {
        if (textContainsCharacterName(ch.content + ' ' + ch.summary, char.name)) {
          if (ch.logicAudit && ch.logicAudit.causalityType === 'But') {
            keyChanges.push(ch.logicAudit.resultingValue.substring(0, 150));
          }
        }
      });

      return {
        arcId: arc.id,
        arcTitle: arc.title,
        stateAtStart,
        stateAtEnd,
        keyChanges: keyChanges.slice(0, 3),
      };
    });

    // Generate overall progression summary
    const overallProgression = generateOverallProgression(char, arcJourneys);

    return {
      characterId: char.id,
      characterName: char.name,
      arcJourneys,
      overallProgression,
    };
  });
}

/**
 * Extracts goals from character notes or chapter content
 */
function extractGoals(source: string, chapter?: Chapter): string[] {
  const goals: string[] = [];
  const goalKeywords = ['goal', 'plan', 'need', 'must', 'will', 'intend', 'want', 'desire'];

  if (source) {
    const sentences = source.split(/[.!?]+/);
    sentences.forEach(sentence => {
      if (goalKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
        goals.push(sentence.trim().substring(0, 150));
      }
    });
  }

  if (chapter) {
    const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
    goalKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        const sentences = chapter.summary.split(/[.!?]+/);
        sentences.forEach(sentence => {
          if (sentence.toLowerCase().includes(keyword)) {
            goals.push(sentence.trim().substring(0, 150));
          }
        });
      }
    });
  }

  return goals.slice(0, 3);
}

/**
 * Generates overall progression summary for a character
 */
function generateOverallProgression(
  char: Character,
  arcJourneys: Array<{
    arcId: string;
    arcTitle: string;
    stateAtStart: {
      cultivation?: string;
      relationships: string[];
      goals: string[];
    };
    stateAtEnd: {
      cultivation?: string;
      relationships: string[];
      goals: string[];
    };
    keyChanges: string[];
  }>
): string {
  if (arcJourneys.length === 0) {
    return `${char.name} has not yet appeared in any completed arcs.`;
  }

  const totalChanges = arcJourneys.reduce((sum, journey) => sum + journey.keyChanges.length, 0);
  const arcCount = arcJourneys.length;

  let summary = `${char.name} has appeared in ${arcCount} arc(s). `;

  if (char.currentCultivation) {
    summary += `Current cultivation: ${char.currentCultivation}. `;
  }

  if (totalChanges > 0) {
    summary += `Has experienced ${totalChanges} significant developments across these arcs. `;
  }

  const recentJourney = arcJourneys[arcJourneys.length - 1];
  if (recentJourney.keyChanges.length > 0) {
    summary += `Most recently: ${recentJourney.keyChanges[0]}`;
  }

  return summary.substring(0, 400);
}

/**
 * Analyzes story progression across all arcs
 */
export function analyzeArcProgression(
  state: NovelState
): ArcProgressionAnalysis {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  // Tension evolution
  const tensionEvolution = completedArcs.map(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    const tensionCurve = analyzeArcTensionCurve(arcChapters);
    return {
      arcId: arc.id,
      arcTitle: arc.title,
      tensionCurve,
    };
  });

  // Pacing analysis
  const arcLengths = completedArcs.map(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    return arcChapters.length;
  });
  const averageArcLength = arcLengths.length > 0
    ? arcLengths.reduce((sum, len) => sum + len, 0) / arcLengths.length
    : 0;

  const pacingIssues: string[] = [];
  arcLengths.forEach((length, index) => {
    const arc = completedArcs[index];
    if (length < averageArcLength * 0.5) {
      pacingIssues.push(`Arc "${arc.title}" was unusually short (${length} chapters, avg: ${Math.round(averageArcLength)})`);
    } else if (length > averageArcLength * 1.5) {
      pacingIssues.push(`Arc "${arc.title}" was unusually long (${length} chapters, avg: ${Math.round(averageArcLength)})`);
    }
  });

  const recommendations: string[] = [];
  if (pacingIssues.length > 0) {
    recommendations.push('Consider adjusting pacing to maintain consistent arc lengths.');
  }

  // Check if recent arcs have been resolving properly
  const lastArc = completedArcs[completedArcs.length - 1];
  if (lastArc) {
    const lastArcChapters = getArcChapters(lastArc, state.chapters);
    const unresolved = extractUnresolvedElements(lastArc, lastArcChapters);
    if (unresolved.length > 3) {
      recommendations.push(`Recent arc "${lastArc.title}" has ${unresolved.length} unresolved elements. Consider addressing some in the next arc.`);
    }
  }

  // Completion patterns
  let arcsResolvedSatisfyingly = 0;
  let totalUnresolved = 0;
  let highPriorityUnresolved = 0;

  completedArcs.forEach(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    const unresolved = extractUnresolvedElements(arc, arcChapters);
    totalUnresolved += unresolved.length;
    highPriorityUnresolved += unresolved.filter(u => u.priority === 'high').length;

    const lastChapter = arcChapters[arcChapters.length - 1];
    if (lastChapter?.logicAudit && lastChapter.logicAudit.causalityType === 'Therefore') {
      arcsResolvedSatisfyingly++;
    } else if (unresolved.length === 0 && arc.checklist && arc.checklist.every(item => item.completed)) {
      arcsResolvedSatisfyingly++;
    }
  });

  // Add recommendation if there are many high-priority unresolved elements
  if (highPriorityUnresolved > 3) {
    recommendations.push(`There are ${highPriorityUnresolved} high-priority unresolved elements across arcs. Prioritize addressing these in the next arc.`);
  }

  // Power scaling analysis (for cultivation novels)
  let powerScalingPattern: ArcProgressionAnalysis['powerScalingPattern'] | undefined;

  const hasCultivationElements = state.characterCodex.some(char =>
    char.currentCultivation && char.currentCultivation.length > 0
  );

  if (hasCultivationElements) {
    const progression: Array<{
      arcTitle: string;
      powerLevel: string;
      breakthrough: boolean;
    }> = [];

    completedArcs.forEach(arc => {
      const arcChapters = getArcChapters(arc, state.chapters);
      const protagonist = state.characterCodex.find(c => c.isProtagonist);

      if (protagonist) {
        const hasBreakthrough = arcChapters.some(ch => {
          const content = (ch.content + ' ' + ch.summary).toLowerCase();
          return content.includes('breakthrough') || content.includes('ascend') || content.includes('realm');
        });

        progression.push({
          arcTitle: arc.title,
          powerLevel: protagonist.currentCultivation,
          breakthrough: hasBreakthrough,
        });
      }
    });

    const scalingIssues: string[] = [];
    // Check if power progression is consistent
    if (progression.length > 1) {
      const hasProgress = progression.some(p => p.breakthrough);
      if (!hasProgress && progression.length >= 3) {
        scalingIssues.push('No clear power progression across multiple arcs. Consider adding breakthrough moments.');
      }
    }

    powerScalingPattern = {
      progression,
      scalingIssues,
    };
  }

  return {
    tensionEvolution,
    pacingAnalysis: {
      averageArcLength: Math.round(averageArcLength),
      pacingIssues,
      recommendations,
    },
    completionPatterns: {
      arcsResolvedSatisfyingly,
      unresolvedElements: totalUnresolved,
      setupPayoffRatio: completedArcs.length > 0 ? arcsResolvedSatisfyingly / completedArcs.length : 1,
      highPriorityUnresolved,
    },
    powerScalingPattern,
  };
}

/**
 * Determines the likely type of the next arc based on story context
 */
export function detectArcType(
  state: NovelState,
  arcContext?: { progressionAnalysis: ArcProgressionAnalysis; arcSummaries: ArcContextSummary[] }
): 'opening' | 'setup' | 'development' | 'climax' | 'denouement' | 'interlude' | 'transition' {
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');
  const totalChapters = state.chapters.length;

  // Opening arc (first arc)
  if (completedArcs.length === 0) {
    return 'opening';
  }

  // Determine story position (rough estimate based on typical novel structure)
  // Assuming average novel is ~50-100 chapters, we estimate story position
  const estimatedStoryLength = totalChapters > 20
    ? Math.max(60, totalChapters * 2) // Extrapolate from current chapters
    : 60; // Default estimate for early novels

  const storyPosition = totalChapters / estimatedStoryLength;

  // Early story (0-30%): Setup and development arcs
  if (storyPosition < 0.3) {
    if (completedArcs.length === 1) return 'setup';
    return 'development';
  }

  // Mid story (30-70%): Development and build-up arcs
  if (storyPosition < 0.7) {
    // Check tension levels - if tension has been building, might be approaching climax
    if (arcContext && arcContext.progressionAnalysis.tensionEvolution.length > 0) {
      const recentTension = arcContext.progressionAnalysis.tensionEvolution.slice(-2);
      const isBuildingTension = recentTension.some(t =>
        t.tensionCurve.endLevel === 'high' || t.tensionCurve.endLevel === 'peak'
      );
      if (isBuildingTension && storyPosition > 0.5) {
        return 'transition'; // Building toward climax
      }
    }
    return 'development';
  }

  // Late story (70-90%): Climax arcs
  if (storyPosition < 0.9) {
    // Check if we've had a recent major climax
    const recentArcs = completedArcs.slice(-2);
    const hadRecentClimax = recentArcs.some(arc => {
      const chs = getArcChapters(arc, state.chapters);
      const tension = analyzeArcTensionCurve(chs);
      return tension.endLevel === 'peak';
    });

    if (!hadRecentClimax) {
      return 'climax';
    }
    return 'transition'; // After major climax, transitioning to resolution
  }

  // Final story (90-100%): Denouement and resolution
  return 'denouement';
}

/**
 * Analyzes character development needs for the next arc
 */
function analyzeCharacterDevelopmentNeeds(state: NovelState): {
  charactersNeedingFocus: number;
  requiresDeepDevelopment: boolean;
  newCharactersExpected: number;
} {
  const mainCharacters = state.characterCodex.filter(c => c.isProtagonist || c.importance === 'major');
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');

  // Characters who haven't had development recently
  let charactersNeedingFocus = 0;
  let requiresDeepDevelopment = false;

  // If this is early in the story, expect more character introductions
  const newCharactersExpected = completedArcs.length < 3 ? 1 : 0;

  mainCharacters.forEach(char => {
    // Check if character was introduced recently (within last 2 arcs)
    const wasIntroducedRecently = char.introducedChapter && state.chapters.length > 0
      ? (state.chapters.length - char.introducedChapter) < 20
      : false;

    if (wasIntroducedRecently && completedArcs.length > 0) {
      charactersNeedingFocus++;
      // Recent introductions often need deeper development
      if (completedArcs.length <= 2) {
        requiresDeepDevelopment = true;
      }
    }
  });

  // If no recent character focus, we might need to give attention to existing characters
  if (charactersNeedingFocus === 0 && mainCharacters.length > 2) {
    charactersNeedingFocus = 1; // At least one character should get focus
  }

  return {
    charactersNeedingFocus,
    requiresDeepDevelopment,
    newCharactersExpected,
  };
}

/**
 * Analyzes world-building needs (new locations, systems, lore)
 */
function analyzeWorldBuildingNeeds(state: NovelState): {
  newLocationsNeeded: boolean;
  systemExpansionNeeded: boolean;
  loreDeepeningNeeded: boolean;
} {
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');
  const worldEntries = state.worldCodex || [];

  // Early arcs need more world-building
  const isEarlyStory = completedArcs.length <= 2;

  // Check if we have enough locations
  const locations = worldEntries.filter(w => w.category === 'Locations');
  const newLocationsNeeded = isEarlyStory || locations.length < 3;

  // Check if systems have been explored
  const systems = worldEntries.filter(w =>
    w.category === 'PowerLevels' || w.category === 'Systems'
  );
  const systemExpansionNeeded = isEarlyStory || systems.length < 2;

  // Lore deepening - typically needed periodically
  const loreEntries = worldEntries.filter(w =>
    w.category === 'Lore' || w.category === 'History'
  );
  const loreDeepeningNeeded = isEarlyStory || (completedArcs.length % 3 === 0);

  return {
    newLocationsNeeded,
    systemExpansionNeeded,
    loreDeepeningNeeded,
  };
}

/**
 * Calculates appropriate target chapters for a new arc based on complexity and story context
 * Enhanced version that considers: unresolved elements, plot threads, character arcs, 
 * historical arc lengths, story position, arc type, character development needs, 
 * world-building requirements, and antagonist complexity
 */
export function calculateSmartArcTargetChapters(
  state: NovelState,
  arcContext?: { progressionAnalysis: ArcProgressionAnalysis; arcSummaries: ArcContextSummary[] }
): number {
  const MIN_ARC_LENGTH = 5;   // Minimum reasonable arc length (focused arcs)
  const MAX_ARC_LENGTH = 35;  // Maximum reasonable arc length (major arcs can be longer)
  const DEFAULT_ARC_LENGTH = 10; // Fallback default

  // Base target: use historical average if available, otherwise default
  const historicalAverage = arcContext?.progressionAnalysis.pacingAnalysis.averageArcLength || DEFAULT_ARC_LENGTH;
  let targetChapters = historicalAverage;

  // ========== FACTOR 1: Arc Type Detection ==========
  const arcType = detectArcType(state, arcContext);
  const arcTypeModifiers: Record<typeof arcType, number> = {
    'opening': 1.3,      // Opening arcs need more setup (30% longer)
    'setup': 1.2,        // Setup arcs need world-building and character introduction
    'development': 1.0,  // Standard development arcs
    'climax': 1.4,       // Climax arcs need more space for resolution (40% longer)
    'denouement': 0.8,   // Denouement arcs are typically shorter (20% shorter)
    'interlude': 0.7,    // Interludes are brief (30% shorter)
    'transition': 0.9,   // Transition arcs bridge between major arcs (10% shorter)
  };
  targetChapters *= arcTypeModifiers[arcType];

  // ========== FACTOR 2: Unresolved Elements ==========
  if (arcContext) {
    const unresolvedCount = arcContext.progressionAnalysis.completionPatterns.unresolvedElements || 0;
    const highPriorityCount = arcContext.progressionAnalysis.completionPatterns.highPriorityUnresolved || 0;

    // High priority elements require more space to address properly
    // Medium/low priority elements need less space
    const complexityFromUnresolved = (highPriorityCount * 1.8) + ((unresolvedCount - highPriorityCount) * 0.6);
    targetChapters += complexityFromUnresolved;
  }

  // Factor 2b: Most recent arc's unresolved elements (most relevant for next arc)
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');
  if (completedArcs.length > 0) {
    const lastArc = completedArcs[completedArcs.length - 1];
    const lastArcChapters = getArcChapters(lastArc, state.chapters);
    const lastArcUnresolved = extractUnresolvedElements(lastArc, lastArcChapters);

    // Recent unresolved elements are more urgent and need more space
    const recentHighPriority = lastArcUnresolved.filter(u => u.priority === 'high').length;
    const recentMediumLow = lastArcUnresolved.filter(u => u.priority !== 'high').length;
    targetChapters += (recentHighPriority * 2.2) + (recentMediumLow * 0.9);
  }

  // ========== FACTOR 3: Character Development Needs ==========
  const charDevNeeds = analyzeCharacterDevelopmentNeeds(state);
  // Each character needing focus typically needs 1-3 chapters
  targetChapters += charDevNeeds.charactersNeedingFocus * 1.5;
  // Deep development arcs need more space
  if (charDevNeeds.requiresDeepDevelopment) {
    targetChapters += 2;
  }
  // New character introductions need setup space
  targetChapters += charDevNeeds.newCharactersExpected * 2;

  // ========== FACTOR 4: World-Building Needs ==========
  const worldNeeds = analyzeWorldBuildingNeeds(state);
  if (worldNeeds.newLocationsNeeded) targetChapters += 1.5;
  if (worldNeeds.systemExpansionNeeded) targetChapters += 2;
  if (worldNeeds.loreDeepeningNeeded) targetChapters += 1;

  // ========== FACTOR 5: Active Plot Threads ==========
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc && activeArc.checklist) {
    const incompleteChecklistItems = activeArc.checklist.filter(item => !item.completed).length;
    // Each major checklist item typically needs 1-2 chapters to address
    targetChapters += incompleteChecklistItems * 0.9;
  }

  // ========== FACTOR 6: Antagonist Complexity ==========
  // More complex antagonists require more chapters to develop and resolve
  // This is estimated from the story - if we're in a major conflict, expect longer arcs
  if (arcContext && arcContext.progressionAnalysis.tensionEvolution.length > 0) {
    const recentTension = arcContext.progressionAnalysis.tensionEvolution.slice(-2);
    const hasHighTension = recentTension.some(t =>
      t.tensionCurve.endLevel === 'high' || t.tensionCurve.endLevel === 'peak'
    );
    if (hasHighTension) {
      // High tension suggests complex antagonist conflict - needs more resolution space
      targetChapters += 2;
    }
  }

  // ========== FACTOR 7: Pacing Adjustments ==========
  if (arcContext) {
    const recentArcs = completedArcs.slice(-3);
    if (recentArcs.length >= 2) {
      const recentLengths = recentArcs.map(arc => {
        const chs = getArcChapters(arc, state.chapters);
        return chs.length;
      });
      const recentAverage = recentLengths.reduce((sum, len) => sum + len, 0) / recentLengths.length;

      // If recent arcs are consistently shorter/longer than historical average, lean that direction
      if (recentAverage < historicalAverage * 0.75) {
        // Recent arcs have been significantly shorter - might be intentional pacing
        targetChapters *= 0.85; // Reduce more significantly
      } else if (recentAverage > historicalAverage * 1.25) {
        // Recent arcs have been significantly longer - might be building momentum
        targetChapters *= 1.15; // Increase more significantly
      }
    }
  }

  // ========== FACTOR 8: Story Position Adjustments ==========
  // Later in the story, arcs may need to resolve more threads (longer)
  // But denouement arcs should be shorter
  const totalChapters = state.chapters.length;
  const estimatedStoryLength = totalChapters > 20
    ? Math.max(60, totalChapters * 2)
    : 60;
  const storyPosition = totalChapters / estimatedStoryLength;

  if (storyPosition > 0.8 && arcType !== 'denouement') {
    // Late story arcs often need more space to resolve accumulated threads
    targetChapters *= 1.1;
  }

  // ========== FINAL CALCULATION ==========
  // Round to nearest integer and clamp within reasonable bounds
  targetChapters = Math.round(targetChapters);
  targetChapters = Math.max(MIN_ARC_LENGTH, Math.min(MAX_ARC_LENGTH, targetChapters));

  return targetChapters;
}

/**
 * Formats arc context summaries for use in prompts
 */
export function formatArcContextForPrompt(summaries: ArcContextSummary[]): string {
  if (summaries.length === 0) {
    return 'No previous arcs. This is the first arc of the story.';
  }

  const sections: string[] = [];

  // Recent arc (full detail)
  const recentArcs = summaries.filter(s => s.tier === 'recent');
  if (recentArcs.length > 0) {
    sections.push('[PREVIOUS ARC CONTEXT - Full Detail]');
    recentArcs.forEach(summary => {
      sections.push(`ARC: "${summary.title}"`);
      sections.push(`Description: ${summary.description}`);
      sections.push(`Chapters: ${summary.chapters.count}`);

      if (summary.chapters.summaries.length > 0) {
        sections.push('Chapter Summaries:');
        summary.chapters.summaries.forEach(s => sections.push(`  - ${s}`));
      }

      if (summary.chapters.keyEvents.length > 0) {
        sections.push('Key Events:');
        summary.chapters.keyEvents.forEach(e => sections.push(`  - ${e}`));
      }

      if (summary.characterDevelopment.length > 0) {
        sections.push('Character Development:');
        summary.characterDevelopment.forEach(dev => {
          sections.push(`  - ${dev.characterName}:`);
          if (dev.changes.length > 0) {
            sections.push(`    Changes: ${dev.changes.join('; ').substring(0, 200)}`);
          }
          if (dev.powerProgression) {
            sections.push(`    Power: ${dev.powerProgression}`);
          }
        });
      }

      if (summary.plotThreads.length > 0) {
        sections.push('Plot Threads:');
        summary.plotThreads.forEach(thread => {
          sections.push(`  - ${thread.description} (${thread.status}, introduced Ch ${thread.introducedIn})`);
        });
      }

      sections.push(`Tension Curve: ${summary.tensionCurve.startLevel} → ${summary.tensionCurve.endLevel}`);
      if (summary.tensionCurve.peakChapter) {
        sections.push(`Peak tension at Chapter ${summary.tensionCurve.peakChapter}`);
      }

      if (summary.unresolvedElements.length > 0) {
        sections.push('Unresolved Elements (carry forward):');
        // Sort to show high priority first
        const sortedElements = [...summary.unresolvedElements].sort((a, b) => {
          const aHigh = a.includes('[HIGH PRIORITY]');
          const bHigh = b.includes('[HIGH PRIORITY]');
          if (aHigh && !bHigh) return -1;
          if (!aHigh && bHigh) return 1;
          return 0;
        });
        sortedElements.forEach(elem => sections.push(`  - ${elem}`));
      }

      sections.push(`Arc Outcome: ${summary.arcOutcome}`);
      sections.push('');
    });
  }

  // Middle arcs (medium detail)
  const middleArcs = summaries.filter(s => s.tier === 'middle');
  if (middleArcs.length > 0) {
    sections.push('[RECENT ARC PATTERNS - Medium Detail]');
    middleArcs.forEach(summary => {
      sections.push(`"${summary.title}": ${summary.description.substring(0, 200)}`);
      sections.push(`  ${summary.chapters.count} chapters. Tension: ${summary.tensionCurve.startLevel} → ${summary.tensionCurve.endLevel}`);

      if (summary.chapters.keyEvents.length > 0) {
        sections.push(`  Key events: ${summary.chapters.keyEvents.slice(0, 3).join('; ')}`);
      }

      if (summary.characterDevelopment.length > 0) {
        const mainChars = summary.characterDevelopment.slice(0, 3);
        sections.push(`  Main character changes: ${mainChars.map(c => c.characterName).join(', ')}`);
      }

      sections.push('');
    });
  }

  // Old arcs (summary only)
  const oldArcs = summaries.filter(s => s.tier === 'old');
  if (oldArcs.length > 0) {
    sections.push('[HISTORICAL ARC SUMMARY - Brief Overview]');
    oldArcs.forEach(summary => {
      sections.push(`"${summary.title}": ${summary.description.substring(0, 150)} (${summary.chapters.count} chapters, ${summary.tensionCurve.startLevel} → ${summary.tensionCurve.endLevel})`);
    });
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Analyzes the quality of transitions between arcs
 * Identifies how well arcs connect and whether transitions are smooth
 */
export function analyzeArcTransitions(
  state: NovelState
): Array<{
  fromArc: string;
  toArc: string;
  transitionQuality: 'excellent' | 'good' | 'adequate' | 'weak';
  issues: string[];
  recommendations: string[];
}> {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  if (completedArcs.length < 2) {
    return []; // Need at least 2 arcs to analyze transitions
  }

  const transitions: Array<{
    fromArc: string;
    toArc: string;
    transitionQuality: 'excellent' | 'good' | 'adequate' | 'weak';
    issues: string[];
    recommendations: string[];
  }> = [];

  for (let i = 1; i < completedArcs.length; i++) {
    const fromArc = completedArcs[i - 1];
    const toArc = completedArcs[i];

    const fromChapters = getArcChapters(fromArc, state.chapters);
    const toChapters = getArcChapters(toArc, state.chapters);

    if (fromChapters.length === 0 || toChapters.length === 0) {
      continue; // Skip if we can't analyze
    }

    const fromEndChapter = fromChapters[fromChapters.length - 1];
    const toStartChapter = toChapters[0];

    const issues: string[] = [];
    let qualityScore = 100;

    // Check for continuity in logic audits
    if (fromEndChapter.logicAudit && toStartChapter.logicAudit) {
      const fromResult = fromEndChapter.logicAudit.resultingValue.toLowerCase();
      const toStart = toStartChapter.logicAudit.startingValue.toLowerCase();

      // Check if there's semantic connection
      const fromWords = new Set(fromResult.split(/\s+/).filter(w => w.length > 3));
      const toWords = new Set(toStart.split(/\s+/).filter(w => w.length > 3));
      const overlap = Array.from(fromWords).filter(w => toWords.has(w));

      if (overlap.length < 2) {
        issues.push('Weak semantic connection between arc endings and beginnings');
        qualityScore -= 20;
      }

      // Check if ending was a resolution and new arc starts appropriately
      if (fromEndChapter.logicAudit.causalityType === 'Therefore' &&
        fromResult.includes('resolve') &&
        toStartChapter.logicAudit.causalityType === 'But') {
        // Good pattern: previous arc resolved, new arc introduces new conflict
        qualityScore += 10;
      } else if (fromEndChapter.logicAudit.causalityType === 'But' &&
        toStartChapter.logicAudit.causalityType === 'But') {
        // Potential issue: ending on conflict, starting with conflict might be jarring
        issues.push('Both arcs end and start with conflict - consider a brief resolution or transition');
        qualityScore -= 15;
      }
    } else if (!toStartChapter.logicAudit) {
      issues.push('New arc starts without a logic audit, making transition unclear');
      qualityScore -= 15;
    }

    // Check for unresolved elements being addressed
    const fromUnresolved = extractUnresolvedElements(fromArc, fromChapters);
    const toContent = toChapters.map(ch => (ch.content || '') + ' ' + (ch.summary || '')).join(' ').toLowerCase();

    const addressedCount = fromUnresolved.filter(elem => {
      const elemWords = elem.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      return elemWords.some(word => toContent.includes(word));
    }).length;

    if (fromUnresolved.length > 0) {
      const addressRatio = addressedCount / fromUnresolved.length;
      if (addressRatio < 0.3) {
        issues.push(`Only ${Math.round(addressRatio * 100)}% of unresolved elements from previous arc are addressed`);
        qualityScore -= 20;
      } else if (addressRatio >= 0.7) {
        qualityScore += 10; // Good continuity
      }
    }

    // Check character continuity
    const fromEndCharacters = extractCharacterNames(fromEndChapter.content + ' ' + fromEndChapter.summary);
    const toStartCharacters = extractCharacterNames(toStartChapter.content + ' ' + toStartChapter.summary);
    const characterOverlap = fromEndCharacters.filter(c => toStartCharacters.includes(c));

    if (fromEndCharacters.length > 0 && characterOverlap.length === 0) {
      issues.push('No character continuity detected in transition');
      qualityScore -= 15;
    }

    // Determine quality level
    let quality: 'excellent' | 'good' | 'adequate' | 'weak';
    if (qualityScore >= 90) quality = 'excellent';
    else if (qualityScore >= 75) quality = 'good';
    else if (qualityScore >= 60) quality = 'adequate';
    else quality = 'weak';

    const recommendations: string[] = [];
    if (issues.length > 0) {
      if (qualityScore < 75) {
        recommendations.push('Ensure the new arc explicitly references the previous arc\'s conclusion');
        recommendations.push('Address at least some unresolved elements from the previous arc early in the new arc');
      }
      if (characterOverlap.length === 0 && fromEndCharacters.length > 0) {
        recommendations.push('Maintain character presence in transition for better continuity');
      }
    }

    transitions.push({
      fromArc: fromArc.title,
      toArc: toArc.title,
      transitionQuality: quality,
      issues,
      recommendations,
    });
  }

  return transitions;
}

/**
 * Extracts character names from text (simple implementation)
 */
function extractCharacterNames(text: string): string[] {
  // Simple extraction - look for capitalized words that might be names
  // This is a simplified version - could be enhanced with proper NLP
  const words = text.split(/\s+/);
  const names: string[] = [];
  const seen = new Set<string>();

  words.forEach((word, index) => {
    // Remove punctuation
    const cleanWord = word.replace(/[.,!?;:()"'"]/g, '');
    if (cleanWord.length > 2 &&
      cleanWord[0] === cleanWord[0].toUpperCase() &&
      cleanWord[0] !== cleanWord[0].toLowerCase() &&
      index > 0) {
      const prevWord = words[index - 1].replace(/[.,!?;:()"'"]/g, '');
      // Check if it's not at start of sentence
      if (!prevWord.match(/[.!?]$/) && !seen.has(cleanWord.toLowerCase())) {
        names.push(cleanWord.toLowerCase());
        seen.add(cleanWord.toLowerCase());
      }
    }
  });

  return names;
}

/**
 * Tracks setup and payoff patterns across arcs
 * Identifies foreshadowing and whether setups are being paid off
 */
export function analyzeSetupPayoff(
  state: NovelState
): {
  setups: Array<{
    arcTitle: string;
    setup: string;
    introducedInChapter: number;
    paidOff: boolean;
    paidOffInArc?: string;
    paidOffInChapter?: number;
  }>;
  payoffs: Array<{
    arcTitle: string;
    payoff: string;
    chapter: number;
    relatedSetup?: string;
  }>;
  setupPayoffRatio: number;
  recommendations: string[];
} {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  const setups: Array<{
    arcTitle: string;
    setup: string;
    introducedInChapter: number;
    paidOff: boolean;
    paidOffInArc?: string;
    paidOffInChapter?: number;
  }> = [];

  const payoffs: Array<{
    arcTitle: string;
    payoff: string;
    chapter: number;
    relatedSetup?: string;
  }> = [];

  // Look for setup keywords in earlier arcs
  const setupKeywords = ['mystery', 'secret', 'will discover', 'will learn', 'prophecy', 'promise', 'vow', 'destiny', 'fate'];
  const payoffKeywords = ['revealed', 'discovered', 'learned', 'fulfilled', 'understood', 'solved', 'explained'];

  completedArcs.forEach((arc, arcIndex) => {
    const arcChapters = getArcChapters(arc, state.chapters);

    arcChapters.forEach(ch => {
      const content = ((ch.content || '') + ' ' + (ch.summary || '')).toLowerCase();

      // Find setups
      setupKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          // Extract the setup sentence
          const sentences = (ch.summary || ch.content || '').split(/[.!?]+/);
          const setupSentence = sentences.find(s => s.toLowerCase().includes(keyword));
          if (setupSentence && setupSentence.trim().length > 20) {
            setups.push({
              arcTitle: arc.title,
              setup: setupSentence.trim().substring(0, 200),
              introducedInChapter: ch.number,
              paidOff: false,
            });
          }
        }
      });

      // Find payoffs
      payoffKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          const sentences = (ch.summary || ch.content || '').split(/[.!?]+/);
          const payoffSentence = sentences.find(s => s.toLowerCase().includes(keyword));
          if (payoffSentence && payoffSentence.trim().length > 20) {
            payoffs.push({
              arcTitle: arc.title,
              payoff: payoffSentence.trim().substring(0, 200),
              chapter: ch.number,
            });
          }
        }
      });
    });
  });

  // Try to match payoffs to setups
  payoffs.forEach(payoff => {
    const matchingSetup = setups.find((setup, index) => {
      if (setup.paidOff) return false;

      // Simple semantic matching - check for word overlap
      const setupWords = new Set(setup.setup.toLowerCase().split(/\s+/).filter(w => w.length > 4));
      const payoffWords = new Set(payoff.payoff.toLowerCase().split(/\s+/).filter(w => w.length > 4));
      const overlap = Array.from(setupWords).filter(w => payoffWords.has(w));

      return overlap.length >= 2;
    });

    if (matchingSetup) {
      matchingSetup.paidOff = true;
      matchingSetup.paidOffInArc = payoff.arcTitle;
      matchingSetup.paidOffInChapter = payoff.chapter;
      payoff.relatedSetup = matchingSetup.setup;
    }
  });

  const setupPayoffRatio = setups.length > 0
    ? setups.filter(s => s.paidOff).length / setups.length
    : 1;

  const recommendations: string[] = [];
  const unpaidSetups = setups.filter(s => !s.paidOff);
  if (unpaidSetups.length > 3) {
    recommendations.push(`There are ${unpaidSetups.length} unresolved setups. Consider paying off some in the next arc.`);
  }
  if (setupPayoffRatio < 0.5 && setups.length > 0) {
    recommendations.push('Low setup-payoff ratio. Ensure setups from earlier arcs are being resolved.');
  }
  if (payoffs.length > setups.length * 1.5) {
    recommendations.push('More payoffs than setups detected. Consider adding more foreshadowing/setup in future arcs.');
  }

  return {
    setups: setups.slice(0, 20), // Limit to prevent bloat
    payoffs: payoffs.slice(0, 20),
    setupPayoffRatio,
    recommendations,
  };
}

/**
 * Enhanced Foreshadowing Analysis
 * Comprehensive tracking of foreshadowing elements including subtle symbolic foreshadowing
 */
export function analyzeForeshadowing(
  state: NovelState
): {
  activeForeshadowing: ForeshadowingElement[];
  paidOffForeshadowing: ForeshadowingElement[];
  overdueForeshadowing: ForeshadowingElement[]; // Setup for 10+ chapters without payoff
  recommendations: string[];
  foreshadowingDensity: number; // Average foreshadowing elements per chapter
  subtleForeshadowingCount: number;
} {
  // Check cache first
  const cacheKey = getCacheKey(state, 'foreshadowing');
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.foreshadowing && isCacheValid(cached)) {
    return cached.foreshadowing;
  }

  try {
    const existingElements = state.foreshadowingElements || [];

    // Detect new foreshadowing from chapters
    const allChapters = state.chapters;
    const detectedElements: ForeshadowingElement[] = [];

    // Patterns for different types of foreshadowing
    const foreshadowingPatterns: Record<ForeshadowingType, { keywords: string[]; contextClues: string[] }> = {
      prophecy: {
        keywords: ['prophecy', 'prophesied', 'foretold', 'oracle', 'seer', 'vision', 'portent'],
        contextClues: ['will happen', 'shall come to pass', 'fated to', 'destined']
      },
      symbolic_object: {
        keywords: ['ancient', 'mysterious', 'strange', 'glowing', 'cracked', 'broken', 'hidden', 'forgotten'],
        contextClues: ['seemed important', 'felt significant', 'had an aura', 'drew attention']
      },
      repeated_imagery: {
        keywords: ['again', 'once more', 'as before', 'familiar', 'recalled', 'reminded'],
        contextClues: ['the same', 'recurring', 'pattern', 'echoed']
      },
      mystery: {
        keywords: ['mystery', 'secret', 'unknown', 'hidden', 'concealed', 'unexplained'],
        contextClues: ['no one knew', 'remained unclear', 'questions unanswered', 'puzzled']
      },
      omen: {
        keywords: ['omen', 'sign', 'portent', 'warning', 'premonition', 'bad feeling'],
        contextClues: ['dark clouds', 'strange silence', 'chills', 'sense of foreboding']
      },
      dialogue_hint: {
        keywords: ['someday', 'one day', 'you\'ll see', 'remember this', 'mark my words'],
        contextClues: ['spoke cryptically', 'hinted at', 'alluded to', 'suggested without saying']
      },
      action_pattern: {
        keywords: ['always', 'never failed to', 'habit', 'routine', 'pattern'],
        contextClues: ['tendency', 'inclination', 'propensity']
      },
      environmental: {
        keywords: ['ominous', 'foreboding', 'eerie', 'atmospheric', 'charged'],
        contextClues: ['the air felt', 'something was wrong', 'the place seemed']
      }
    };

    // Analyze each chapter for foreshadowing
    allChapters.forEach((chapter, index) => {
      const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();

      // Check for each type of foreshadowing
      Object.entries(foreshadowingPatterns).forEach(([type, patterns]) => {
        const hasKeyword = patterns.keywords.some(kw => content.includes(kw));
        const hasContext = patterns.contextClues.some(cc => content.includes(cc));

        if (hasKeyword || hasContext) {
          // Extract the foreshadowing sentence/context
          const sentences = (chapter.content + ' ' + (chapter.summary || '')).split(/[.!?]+/);
          const relevantSentences = sentences.filter(s => {
            const sLower = s.toLowerCase();
            return patterns.keywords.some(kw => sLower.includes(kw)) ||
              patterns.contextClues.some(cc => sLower.includes(cc));
          });

          if (relevantSentences.length > 0) {
            const element: ForeshadowingElement = {
              id: generateUUID(),
              novelId: state.id,
              type: type as ForeshadowingType,
              content: relevantSentences[0].trim().substring(0, 300),
              introducedChapter: chapter.number,
              status: 'active' as ForeshadowingStatus,
              subtlety: hasKeyword && hasContext ? 'obvious' : hasKeyword ? 'subtle' : 'very_subtle' as ForeshadowingSubtlety,
              chaptersReferenced: [chapter.number],
              notes: `Detected in chapter ${chapter.number}`,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };

            // Check if this element already exists (to avoid duplicates)
            const existing = existingElements.find(e =>
              e.type === element.type &&
              Math.abs(e.introducedChapter - element.introducedChapter) <= 2 &&
              e.content.toLowerCase().includes(element.content.toLowerCase().substring(0, 50)) ||
              element.content.toLowerCase().includes(e.content.toLowerCase().substring(0, 50))
            );

            if (!existing) {
              detectedElements.push(element);
            }
          }
        }
      });
    });

    // Combine existing and detected elements
    const allElements = [...existingElements, ...detectedElements];

    // Check for payoffs
    const activeElements: ForeshadowingElement[] = [];
    const paidOffElements: ForeshadowingElement[] = [];
    const overdueElements: ForeshadowingElement[] = [];

    const currentChapter = allChapters.length;

    allElements.forEach(element => {
      // Check if element has been paid off
      if (element.paidOffChapter) {
        paidOffElements.push(element);
        return;
      }

      // Check if element is overdue (10+ chapters without payoff)
      const chaptersSinceIntroduction = currentChapter - element.introducedChapter;
      if (chaptersSinceIntroduction >= 10 && element.status === 'active') {
        overdueElements.push(element);
        element.status = 'active'; // Keep as active but flag as overdue
      }

      if (element.status === 'active') {
        activeElements.push(element);
      }
    });

    // Calculate metrics
    const foreshadowingDensity = allChapters.length > 0
      ? allElements.length / allChapters.length
      : 0;

    const subtleForeshadowingCount = allElements.filter(e =>
      e.subtlety === 'subtle' || e.subtlety === 'very_subtle'
    ).length;

    // Generate recommendations
    const recommendations: string[] = [];

    if (overdueElements.length > 3) {
      recommendations.push(`There are ${overdueElements.length} foreshadowing elements that have been active for 10+ chapters without payoff. Consider resolving some in the next arc.`);
    }

    if (activeElements.length === 0 && allChapters.length > 5) {
      recommendations.push('No active foreshadowing detected. Consider adding subtle foreshadowing to build anticipation.');
    }

    if (subtleForeshadowingCount < activeElements.length * 0.3) {
      recommendations.push('Most foreshadowing is obvious. Consider adding more subtle foreshadowing (symbolic objects, repeated imagery, environmental cues).');
    }

    if (foreshadowingDensity < 0.5) {
      recommendations.push('Low foreshadowing density. Consider weaving more foreshadowing elements throughout chapters.');
    }

    if (foreshadowingDensity > 2.0) {
      recommendations.push('Very high foreshadowing density. Ensure payoffs are happening regularly to maintain reader trust.');
    }

    const result = {
      activeForeshadowing: activeElements,
      paidOffForeshadowing: paidOffElements,
      overdueForeshadowing: overdueElements,
      recommendations,
      foreshadowingDensity,
      subtleForeshadowingCount,
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      foreshadowing: result,
    });

    return result;
  } catch (error) {
    console.error('Error in analyzeForeshadowing:', error);
    // Return safe defaults on error
    return {
      activeForeshadowing: state.foreshadowingElements?.filter(e => e.status === 'active') || [],
      paidOffForeshadowing: state.foreshadowingElements?.filter(e => e.status === 'paid_off') || [],
      overdueForeshadowing: [],
      recommendations: ['Error analyzing foreshadowing. Please try again.'],
      foreshadowingDensity: 0,
      subtleForeshadowingCount: 0,
    };
  }
}

/**
 * Analyzes conflict escalation patterns across arcs
 * Tracks how conflicts evolve and escalate in complexity/stakes
 */
export function analyzeConflictEscalation(
  state: NovelState
): {
  escalationPattern: Array<{
    arcTitle: string;
    conflictTypes: string[];
    stakesLevel: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
    intensity: 'low' | 'medium' | 'high' | 'peak';
  }>;
  escalationIssues: string[];
  recommendations: string[];
} {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  const escalationPattern: Array<{
    arcTitle: string;
    conflictTypes: string[];
    stakesLevel: 'personal' | 'local' | 'regional' | 'global' | 'cosmic';
    intensity: 'low' | 'medium' | 'high' | 'peak';
  }> = [];

  const conflictKeywords = {
    personal: ['self', 'inner', 'personal', 'individual', 'internal struggle', 'doubt', 'fear'],
    local: ['village', 'town', 'city', 'family', 'clan', 'sect', 'organization'],
    regional: ['kingdom', 'empire', 'region', 'province', 'alliance', 'confederation'],
    global: ['world', 'realm', 'continent', 'civilization', 'all realms'],
    cosmic: ['universe', 'multiverse', 'existence', 'reality', 'cosmic', 'divine order'],
  };

  const intensityKeywords = {
    peak: ['death', 'extinction', 'annihilation', 'end of all', 'ultimate', 'final', 'apocalypse'],
    high: ['war', 'battle', 'invasion', 'conquest', 'destruction', 'catastrophe', 'crisis'],
    medium: ['conflict', 'struggle', 'challenge', 'threat', 'danger', 'opposition'],
    low: ['disagreement', 'tension', 'dispute', 'rivalry', 'competition'],
  };

  completedArcs.forEach(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    if (arcChapters.length === 0) return;

    const allContent = arcChapters
      .map(ch => (ch.content || '') + ' ' + (ch.summary || ''))
      .join(' ')
      .toLowerCase();

    // Detect conflict types
    const conflictTypes: string[] = [];

    // Internal vs external
    if (allContent.includes('internal') || allContent.includes('inner conflict') ||
      allContent.includes('struggle with') || allContent.includes('doubt')) {
      conflictTypes.push('Internal');
    }
    if (allContent.includes('enemy') || allContent.includes('opponent') ||
      allContent.includes('rival') || allContent.includes('antagonist')) {
      conflictTypes.push('External');
    }

    // Character vs Nature/Society/etc
    if (allContent.includes('tribulation') || allContent.includes('natural disaster') ||
      allContent.includes('heaven') || allContent.includes('divine punishment')) {
      conflictTypes.push('Character vs Nature');
    }
    if (allContent.includes('society') || allContent.includes('authorities') ||
      allContent.includes('rules') || allContent.includes('system')) {
      conflictTypes.push('Character vs Society');
    }
    if (conflictTypes.length === 0) {
      conflictTypes.push('Character vs Character'); // Default
    }

    // Determine stakes level
    let stakesLevel: 'personal' | 'local' | 'regional' | 'global' | 'cosmic' = 'personal';
    for (const [level, keywords] of Object.entries(conflictKeywords)) {
      if (keywords.some(kw => allContent.includes(kw))) {
        stakesLevel = level as typeof stakesLevel;
        // Take the highest level found
        const levels = ['personal', 'local', 'regional', 'global', 'cosmic'];
        if (levels.indexOf(level) > levels.indexOf(stakesLevel)) {
          stakesLevel = level as typeof stakesLevel;
        }
      }
    }

    // Determine intensity
    let intensity: 'low' | 'medium' | 'high' | 'peak' = 'medium';
    for (const [level, keywords] of Object.entries(intensityKeywords)) {
      if (keywords.some(kw => allContent.includes(kw))) {
        intensity = level as typeof intensity;
        // Take the highest intensity found
        const intensities = ['low', 'medium', 'high', 'peak'];
        if (intensities.indexOf(level) > intensities.indexOf(intensity)) {
          intensity = level as typeof intensity;
        }
      }
    }

    escalationPattern.push({
      arcTitle: arc.title,
      conflictTypes,
      stakesLevel,
      intensity,
    });
  });

  // Analyze escalation issues
  const escalationIssues: string[] = [];
  const recommendations: string[] = [];

  if (escalationPattern.length > 1) {
    // Check if stakes are escalating appropriately
    const stakesLevels = ['personal', 'local', 'regional', 'global', 'cosmic'];
    for (let i = 1; i < escalationPattern.length; i++) {
      const prevStakes = escalationPattern[i - 1].stakesLevel;
      const currStakes = escalationPattern[i].stakesLevel;
      const prevIndex = stakesLevels.indexOf(prevStakes);
      const currIndex = stakesLevels.indexOf(currStakes);

      if (currIndex < prevIndex) {
        escalationIssues.push(`Arc "${escalationPattern[i].arcTitle}" has lower stakes (${currStakes}) than previous arc (${prevStakes}). This may reduce narrative momentum.`);
      }

      // Check if intensity is appropriate for stakes
      const highStakes = ['global', 'cosmic'].includes(currStakes);
      if (highStakes && escalationPattern[i].intensity === 'low') {
        escalationIssues.push(`Arc "${escalationPattern[i].arcTitle}" has high stakes but low intensity. Consider matching intensity to stakes.`);
      }
    }

    // Check for proper escalation curve
    const hasEscalated = escalationPattern.length >= 3 &&
      stakesLevels.indexOf(escalationPattern[escalationPattern.length - 1].stakesLevel) >
      stakesLevels.indexOf(escalationPattern[0].stakesLevel);

    if (!hasEscalated && escalationPattern.length >= 3) {
      recommendations.push('Consider escalating stakes across arcs to maintain narrative momentum and reader engagement.');
    }

    // Check for diversity in conflict types
    const allConflictTypes = new Set(escalationPattern.flatMap(p => p.conflictTypes));
    if (allConflictTypes.size === 1) {
      recommendations.push('All arcs have similar conflict types. Consider varying conflict types (internal vs external, different opponents) to maintain interest.');
    }
  }

  return {
    escalationPattern,
    escalationIssues,
    recommendations,
  };
}

/**
 * Analyzes emotional arcs across completed arcs
 * Tracks the emotional journey of characters
 */
export function analyzeEmotionalArcs(
  state: NovelState
): {
  protagonistEmotionalJourney: Array<{
    arcTitle: string;
    dominantEmotion: string;
    emotionalShift: string;
  }>;
  emotionalPatternIssues: string[];
  recommendations: string[];
} {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (!protagonist) {
    return {
      protagonistEmotionalJourney: [],
      emotionalPatternIssues: [],
      recommendations: [],
    };
  }

  const emotionalKeywords = {
    hope: ['hope', 'hopeful', 'optimistic', 'confident', 'determined', 'resolved'],
    despair: ['despair', 'hopeless', 'desperate', 'lost', 'defeated', 'crushed'],
    fear: ['afraid', 'fearful', 'terrified', 'dread', 'anxious', 'worried'],
    anger: ['angry', 'furious', 'enraged', 'rage', 'outraged', 'resentful'],
    joy: ['happy', 'joyful', 'elated', 'celebrated', 'triumphant', 'exultant'],
    sadness: ['sad', 'grief', 'sorrow', 'mournful', 'melancholy', 'depressed'],
    determination: ['determined', 'resolved', 'committed', 'steadfast', 'unyielding'],
    doubt: ['doubt', 'uncertain', 'hesitant', 'questioning', 'unsure'],
  };

  const protagonistEmotionalJourney: Array<{
    arcTitle: string;
    dominantEmotion: string;
    emotionalShift: string;
  }> = [];

  completedArcs.forEach(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    if (arcChapters.length === 0) return;

    const allContent = arcChapters
      .map(ch => (ch.content || '') + ' ' + (ch.summary || ''))
      .join(' ')
      .toLowerCase();

    // Only analyze if protagonist is mentioned
    if (!textContainsCharacterName(allContent, protagonist.name)) {
      return;
    }

    // Find dominant emotion
    const emotionScores: Record<string, number> = {};
    for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
      emotionScores[emotion] = keywords.reduce((count, kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        const matches = allContent.match(regex);
        return count + (matches ? matches.length : 0);
      }, 0);
    }

    const dominantEmotion = Object.entries(emotionScores)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    // Determine emotional shift from start to end
    const startChapter = arcChapters[0];
    const endChapter = arcChapters[arcChapters.length - 1];

    const startContent = ((startChapter?.content || '') + ' ' + (startChapter?.summary || '')).toLowerCase();
    const endContent = ((endChapter?.content || '') + ' ' + (endChapter?.summary || '')).toLowerCase();

    const startEmotion = Object.entries(emotionalKeywords).find(([emotion, keywords]) =>
      keywords.some(kw => textContainsCharacterName(startContent, protagonist.name) && startContent.includes(kw))
    )?.[0] || 'neutral';

    const endEmotion = Object.entries(emotionalKeywords).find(([emotion, keywords]) =>
      keywords.some(kw => textContainsCharacterName(endContent, protagonist.name) && endContent.includes(kw))
    )?.[0] || 'neutral';

    const emotionalShift = startEmotion !== endEmotion
      ? `${startEmotion} → ${endEmotion}`
      : `Stable: ${startEmotion}`;

    protagonistEmotionalJourney.push({
      arcTitle: arc.title,
      dominantEmotion,
      emotionalShift,
    });
  });

  // Analyze emotional patterns
  const emotionalPatternIssues: string[] = [];
  const recommendations: string[] = [];

  if (protagonistEmotionalJourney.length > 1) {
    // Check for emotional stagnation (same emotion across multiple arcs)
    const recentEmotions = protagonistEmotionalJourney.slice(-3).map(j => j.dominantEmotion);
    const allSame = recentEmotions.every(e => e === recentEmotions[0]);
    if (allSame && recentEmotions.length >= 3) {
      emotionalPatternIssues.push(`Protagonist has been in "${recentEmotions[0]}" emotional state for ${recentEmotions.length} consecutive arcs. Consider emotional variation.`);
      recommendations.push('Vary the protagonist\'s emotional journey - include moments of hope, despair, growth, and challenge.');
    }

    // Check for lack of emotional growth/change
    const shifts = protagonistEmotionalJourney.filter(j => j.emotionalShift.includes('→'));
    if (shifts.length < protagonistEmotionalJourney.length / 2) {
      emotionalPatternIssues.push('Protagonist shows limited emotional change across arcs. Emotional growth may be stagnant.');
      recommendations.push('Ensure the protagonist experiences emotional growth and change that reflects their journey and development.');
    }

    // Check for appropriate emotional contrast (not constantly in despair)
    const despairCount = protagonistEmotionalJourney.filter(j =>
      j.dominantEmotion === 'despair' || j.dominantEmotion === 'sadness'
    ).length;
    if (despairCount > protagonistEmotionalJourney.length * 0.6) {
      emotionalPatternIssues.push('Protagonist spends too much time in negative emotional states. May need moments of hope or triumph.');
      recommendations.push('Balance negative and positive emotional moments to create a more engaging emotional arc.');
    }
  }

  return {
    protagonistEmotionalJourney,
    emotionalPatternIssues,
    recommendations,
  };
}

/**
 * Enhanced Emotional Payoff Analysis
 * Tracks emotional payoff moments, intensity scoring, and emotional arc templates
 */
export function analyzeEmotionalPayoffs(
  state: NovelState
): {
  recentPayoffs: EmotionalPayoffMoment[];
  upcomingPayoffOpportunities: Array<{
    arcStage: string;
    recommendedType: EmotionalPayoffType;
    suggestedIntensity: EmotionalIntensity;
    reason: string;
  }>;
  emotionalIntensityScore: number; // Average intensity of recent payoffs (1-5)
  recommendations: string[];
  templates: EmotionalArcTemplate[];
} {
  // Check cache first
  const cacheKey = getCacheKey(state, 'emotionalPayoffs');
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.emotionalPayoffs && isCacheValid(cached)) {
    return cached.emotionalPayoffs;
  }

  try {
    const existingPayoffs = state.emotionalPayoffs || [];
    const allChapters = state.chapters;
    const activeArc = state.plotLedger.find(a => a.status === 'active');
    const currentChapter = allChapters.length;

    // Detect new payoff moments from recent chapters
    const detectedPayoffs: EmotionalPayoffMoment[] = [];

    // Patterns for different payoff types
    const payoffPatterns: Record<EmotionalPayoffType, { keywords: string[]; contextClues: string[] }> = {
      revelation: {
        keywords: ['revealed', 'discovered', 'learned', 'understood', 'realized', 'truth', 'secret'],
        contextClues: ['finally knew', 'at last', 'everything made sense', 'the pieces fell into place']
      },
      victory: {
        keywords: ['won', 'triumph', 'victory', 'defeated', 'overcame', 'prevailed', 'conquered'],
        contextClues: ['victorious', 'emerged victorious', 'came out on top', 'crushed']
      },
      loss: {
        keywords: ['lost', 'defeat', 'failure', 'death', 'gone', 'destroyed', 'crushed'],
        contextClues: ['heartbreaking', 'devastating', 'shattered', 'broken']
      },
      transformation: {
        keywords: ['changed', 'transformed', 'evolved', 'became', 'grew', 'emerged', 'arisen'],
        contextClues: ['new person', 'no longer', 'had become', 'was now']
      },
      reunion: {
        keywords: ['reunited', 'met again', 'saw again', 'embraced', 'together'],
        contextClues: ['after so long', 'at last', 'finally', 'once more']
      },
      betrayal: {
        keywords: ['betrayed', 'traitor', 'deceived', 'stabbed in the back', 'lied'],
        contextClues: ['couldn\'t trust', 'wasn\'t who they seemed', 'had been fooled']
      },
      sacrifice: {
        keywords: ['sacrificed', 'gave up', 'laid down', 'for the sake of', 'died for'],
        contextClues: ['selfless act', 'for others', 'great cost', 'everything']
      },
      redemption: {
        keywords: ['redeemed', 'forgiven', 'atoned', 'made amends', 'atonement'],
        contextClues: ['second chance', 'made right', 'proved themselves', 'earned forgiveness']
      }
    };

    // Analyze recent chapters for payoff moments
    const recentChapters = allChapters.slice(-5);
    recentChapters.forEach(chapter => {
      const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();

      Object.entries(payoffPatterns).forEach(([type, patterns]) => {
        const hasKeyword = patterns.keywords.some(kw => content.includes(kw));
        const hasContext = patterns.contextClues.some(cc => content.includes(cc));

        if (hasKeyword || hasContext) {
          // Extract the payoff moment
          const sentences = (chapter.content + ' ' + (chapter.summary || '')).split(/[.!?]+/);
          const relevantSentences = sentences.filter(s => {
            const sLower = s.toLowerCase();
            return patterns.keywords.some(kw => sLower.includes(kw)) ||
              patterns.contextClues.some(cc => sLower.includes(cc));
          });

          if (relevantSentences.length > 0) {
            // Calculate intensity based on context and keywords
            let intensity: EmotionalIntensity = 3; // Default medium
            const intensityIndicators = {
              5: ['ultimate', 'complete', 'absolute', 'devastating', 'triumphant', 'perfect'],
              4: ['major', 'significant', 'huge', 'great', 'massive', 'powerful'],
              2: ['slight', 'minor', 'small', 'little', 'somewhat'],
              1: ['hint', 'trace', 'subtle', 'faint']
            };

            for (const [level, keywords] of Object.entries(intensityIndicators)) {
              if (keywords.some(kw => content.includes(kw))) {
                intensity = parseInt(level) as EmotionalIntensity;
                break;
              }
            }

            // Extract character names involved
            const charactersInvolved = state.characterCodex
              .filter(char => content.includes(char.name.toLowerCase()))
              .map(char => char.name);

            const payoff: EmotionalPayoffMoment = {
              id: generateUUID(),
              novelId: state.id,
              type: type as EmotionalPayoffType,
              description: relevantSentences[0].trim().substring(0, 300),
              chapterNumber: chapter.number,
              intensity,
              charactersInvolved,
              setupChapters: [], // Will be filled by analyzing earlier chapters
              readerImpact: `Expected ${intensity >= 4 ? 'strong' : intensity >= 3 ? 'moderate' : 'mild'} emotional impact`,
              notes: `Detected in chapter ${chapter.number}`,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };

            // Check for duplicates
            const existing = existingPayoffs.find(e =>
              e.type === payoff.type &&
              e.chapterNumber === payoff.chapterNumber &&
              e.description.toLowerCase().includes(payoff.description.toLowerCase().substring(0, 50))
            );

            if (!existing) {
              detectedPayoffs.push(payoff);
            }
          }
        }
      });
    });

    // Combine existing and detected payoffs
    const allPayoffs = [...existingPayoffs, ...detectedPayoffs];
    const recentPayoffs = allPayoffs.filter(p =>
      currentChapter - p.chapterNumber <= 5
    );

    // Calculate average emotional intensity
    const emotionalIntensityScore = recentPayoffs.length > 0
      ? recentPayoffs.reduce((sum, p) => sum + p.intensity, 0) / recentPayoffs.length
      : 3; // Default to medium if no payoffs

    // Identify upcoming payoff opportunities based on arc stage
    const upcomingPayoffOpportunities: Array<{
      arcStage: string;
      recommendedType: EmotionalPayoffType;
      suggestedIntensity: EmotionalIntensity;
      reason: string;
    }> = [];

    if (activeArc) {
      const idx = activeArc.startedAtChapter
        ? Math.max(0, currentChapter - activeArc.startedAtChapter)
        : 0;

      if (idx === 0) {
        // Beginning of arc - setup phase
        upcomingPayoffOpportunities.push({
          arcStage: 'Beginning',
          recommendedType: 'revelation',
          suggestedIntensity: 2,
          reason: 'Early revelations can hook readers and set up emotional journey'
        });
      } else if (idx <= 2) {
        // Early arc - build tension
        upcomingPayoffOpportunities.push({
          arcStage: 'Early',
          recommendedType: 'transformation',
          suggestedIntensity: 3,
          reason: 'Character growth moments create emotional connection in early arc'
        });
      } else if (idx <= 5) {
        // Middle arc - escalation
        upcomingPayoffOpportunities.push({
          arcStage: 'Middle',
          recommendedType: 'victory',
          suggestedIntensity: 4,
          reason: 'Mid-arc victories build momentum, but should be earned and meaningful'
        });
      } else {
        // Late arc - climax preparation
        upcomingPayoffOpportunities.push({
          arcStage: 'Late',
          recommendedType: 'sacrifice',
          suggestedIntensity: 5,
          reason: 'High-intensity payoffs appropriate as arc approaches climax'
        });
      }
    }

    // Generate emotional arc templates based on genre
    const templates: EmotionalArcTemplate[] = [
      {
        name: 'Xianxia Cultivation Arc',
        stages: [
          { stage: 'Humiliation', emotion: 'anger', intensity: 2, description: 'Protagonist faces disrespect or defeat' },
          { stage: 'Determination', emotion: 'determination', intensity: 3, description: 'Resolves to improve through cultivation' },
          { stage: 'Breakthrough', emotion: 'hope', intensity: 4, description: 'Achieves cultivation advancement' },
          { stage: 'Revenge/Recognition', emotion: 'joy', intensity: 5, description: 'Proves worth and gains respect' }
        ],
        genre: ['Xianxia']
      },
      {
        name: 'Standard Hero\'s Journey',
        stages: [
          { stage: 'Call to Adventure', emotion: 'hope', intensity: 2, description: 'Opportunity presents itself' },
          { stage: 'Tests and Trials', emotion: 'determination', intensity: 3, description: 'Faces challenges and grows' },
          { stage: 'Darkest Hour', emotion: 'despair', intensity: 4, description: 'Major setback or loss' },
          { stage: 'Triumph', emotion: 'joy', intensity: 5, description: 'Overcomes adversity through growth' }
        ],
        genre: ['Xianxia', 'Xuanhuan', 'Fantasy']
      }
    ];

    // Generate recommendations
    const recommendations: string[] = [];

    if (recentPayoffs.length === 0 && currentChapter > 5) {
      recommendations.push('No recent emotional payoff moments detected. Consider adding meaningful emotional moments (revelations, victories, losses, transformations) to create reader satisfaction.');
    }

    if (emotionalIntensityScore < 2.5) {
      recommendations.push('Recent emotional payoffs have low intensity. Consider increasing emotional stakes and intensity for stronger reader engagement.');
    }

    if (emotionalIntensityScore > 4.5) {
      recommendations.push('Very high emotional intensity in recent payoffs. Consider varying intensity - include some quieter emotional moments to prevent reader fatigue.');
    }

    const lastPayoff = recentPayoffs[recentPayoffs.length - 1];
    if (lastPayoff && (currentChapter - lastPayoff.chapterNumber) > 8) {
      recommendations.push(`Last emotional payoff was ${currentChapter - lastPayoff.chapterNumber} chapters ago. Consider adding an emotional payoff moment in upcoming chapters to maintain reader engagement.`);
    }

    // Check for emotional diversity
    const recentTypes = new Set(recentPayoffs.map(p => p.type));
    if (recentTypes.size < 3 && recentPayoffs.length >= 5) {
      recommendations.push('Recent payoffs lack diversity. Consider varying payoff types (revelations, victories, losses, transformations) for richer emotional journey.');
    }

    const result = {
      recentPayoffs: recentPayoffs.slice(-5), // Last 5 payoffs
      upcomingPayoffOpportunities,
      emotionalIntensityScore: Math.round(emotionalIntensityScore * 10) / 10,
      recommendations,
      templates: templates.filter(t => t.genre.includes(state.genre) || t.genre.length === 0),
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      emotionalPayoffs: result,
    });

    return result;
  } catch (error) {
    console.error('Error analyzing emotional payoffs:', error);
    // Return default structure on error
    return {
      recentPayoffs: [],
      upcomingPayoffOpportunities: [],
      emotionalIntensityScore: 3,
      recommendations: ['Error analyzing emotional payoffs. Please try again.'],
      templates: [],
    };
  }
}

/**
 * Enhanced Pacing Analysis
 * Analyzes scene-level pacing, rhythm patterns, and arc-position-specific pacing
 */
export function analyzePacing(
  state: NovelState
): {
  sceneLevelPacing: Array<{
    chapterNumber: number;
    sceneCount: number;
    averageSceneLength: number;
    pacingVariation: 'low' | 'medium' | 'high'; // How much pacing varies within chapter
    dominantPacingType: 'action' | 'dialogue' | 'reflection' | 'description' | 'mixed';
  }>;
  rhythmPattern: Array<{
    chapters: string; // e.g., "Ch 1-3"
    pattern: string; // e.g., "fast → slow → fast"
    description: string;
  }>;
  arcPositionPacing: {
    beginning: { recommendedPacing: 'fast' | 'medium' | 'slow'; reason: string };
    early: { recommendedPacing: 'fast' | 'medium' | 'slow'; reason: string };
    middle: { recommendedPacing: 'fast' | 'medium' | 'slow'; reason: string };
    late: { recommendedPacing: 'fast' | 'medium' | 'slow'; reason: string };
  };
  pacingIssues: string[];
  recommendations: string[];
} {
  // Check cache first
  const cacheKey = getCacheKey(state, 'pacing');
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.pacing && isCacheValid(cached)) {
    return cached.pacing;
  }

  try {
    const allChapters = state.chapters;
    const activeArc = state.plotLedger.find(a => a.status === 'active');
    const currentChapter = allChapters.length;

    // Analyze scene-level pacing
    const sceneLevelPacing: Array<{
      chapterNumber: number;
      sceneCount: number;
      averageSceneLength: number;
      pacingVariation: 'low' | 'medium' | 'high';
      dominantPacingType: 'action' | 'dialogue' | 'reflection' | 'description' | 'mixed';
    }> = [];

    // Analyze recent chapters (last 10) for scene-level pacing
    const recentChapters = allChapters.slice(-10);
    recentChapters.forEach(chapter => {
      const scenes = chapter.scenes || [];
      const sceneCount = scenes.length || 1; // At least 1 scene (the chapter itself)

      // Calculate average scene length (words)
      let totalSceneWords = 0;
      if (scenes.length > 0) {
        totalSceneWords = scenes.reduce((sum, scene) => {
          const words = (scene.content || '').split(/\s+/).filter(w => w.length > 0).length;
          return sum + words;
        }, 0);
      } else {
        // If no scenes, use chapter content
        totalSceneWords = chapter.content.split(/\s+/).filter(w => w.length > 0).length;
      }
      const averageSceneLength = sceneCount > 0 ? totalSceneWords / sceneCount : 0;

      // Determine pacing variation within chapter
      let pacingVariation: 'low' | 'medium' | 'high' = 'low';
      if (scenes.length > 2) {
        const sceneLengths = scenes.map(s => {
          return (s.content || '').split(/\s+/).filter(w => w.length > 0).length;
        });
        const min = Math.min(...sceneLengths);
        const max = Math.max(...sceneLengths);
        const variation = (max - min) / averageSceneLength;
        if (variation > 0.5) pacingVariation = 'high';
        else if (variation > 0.2) pacingVariation = 'medium';
      }

      // Determine dominant pacing type
      const chapterContent = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();

      // Count different pacing indicators
      const actionIndicators = ['moved', 'ran', 'fought', 'attacked', 'defended', 'dodged', 'struck', 'jumped', 'charged'];
      const dialogueIndicators = ['said', 'asked', 'replied', 'shouted', 'whispered', 'spoke', 'exclaimed'];
      const reflectionIndicators = ['thought', 'wondered', 'considered', 'realized', 'remembered', 'pondered', 'reflected'];
      const descriptionIndicators = ['was', 'had', 'seemed', 'appeared', 'looked', 'felt like', 'resembled'];

      const actionCount = actionIndicators.reduce((sum, ind) => {
        const matches = chapterContent.match(new RegExp(`\\b${ind}\\b`, 'gi'));
        return sum + (matches ? matches.length : 0);
      }, 0);

      const dialogueCount = dialogueIndicators.reduce((sum, ind) => {
        const matches = chapterContent.match(new RegExp(`\\b${ind}\\b`, 'gi'));
        return sum + (matches ? matches.length : 0);
      }, 0);

      const reflectionCount = reflectionIndicators.reduce((sum, ind) => {
        const matches = chapterContent.match(new RegExp(`\\b${ind}\\b`, 'gi'));
        return sum + (matches ? matches.length : 0);
      }, 0);

      const descriptionCount = descriptionIndicators.reduce((sum, ind) => {
        const matches = chapterContent.match(new RegExp(`\\b${ind}\\b`, 'gi'));
        return sum + (matches ? matches.length : 0);
      }, 0);

      const counts = { action: actionCount, dialogue: dialogueCount, reflection: reflectionCount, description: descriptionCount };
      const maxCount = Math.max(...Object.values(counts));
      const dominantType = Object.entries(counts).find(([_, count]) => count === maxCount)?.[0] || 'mixed';

      // Determine if mixed (if top 2 are within 20% of each other)
      const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const isMixed = sortedCounts.length >= 2 &&
        sortedCounts[0][1] > 0 &&
        sortedCounts[1][1] > 0 &&
        (sortedCounts[0][1] - sortedCounts[1][1]) / sortedCounts[0][1] < 0.2;

      sceneLevelPacing.push({
        chapterNumber: chapter.number,
        sceneCount,
        averageSceneLength: Math.round(averageSceneLength),
        pacingVariation,
        dominantPacingType: isMixed ? 'mixed' : dominantType as 'action' | 'dialogue' | 'reflection' | 'description' | 'mixed',
      });
    });

    // Analyze rhythm patterns (alternating pacing across chapters)
    const rhythmPattern: Array<{
      chapters: string;
      pattern: string;
      description: string;
    }> = [];

    if (allChapters.length >= 3) {
      // Analyze recent 6 chapters for rhythm
      const recent6 = allChapters.slice(-6);
      const pacingSequence: ('fast' | 'medium' | 'slow')[] = [];

      recent6.forEach(chapter => {
        const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
        const wordCount = content.split(/\s+/).length;
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 15;

        let pacing: 'fast' | 'medium' | 'slow' = 'medium';
        if (avgSentenceLength < 12 && wordCount < 3000) pacing = 'fast';
        else if (avgSentenceLength > 20 || wordCount > 6000) pacing = 'slow';

        pacingSequence.push(pacing);
      });

      // Identify patterns
      if (pacingSequence.length >= 3) {
        const patternStr = pacingSequence.join(' → ');
        rhythmPattern.push({
          chapters: `Ch ${recent6[0].number}-${recent6[recent6.length - 1].number}`,
          pattern: patternStr,
          description: pacingSequence.length >= 4
            ? `${pacingSequence.length} chapters analyzed. Pattern: ${patternStr}`
            : `Recent pacing pattern: ${patternStr}`,
        });
      }
    }

    // Arc-position-specific pacing recommendations
    const arcPositionPacing = {
      beginning: {
        recommendedPacing: 'fast' as const,
        reason: 'Opening chapters should hook readers quickly with faster pacing and immediate engagement'
      },
      early: {
        recommendedPacing: 'medium' as const,
        reason: 'Early arc allows for moderate pacing to establish stakes and build tension'
      },
      middle: {
        recommendedPacing: 'medium' as const,
        reason: 'Middle arc benefits from varied pacing - faster for action, slower for character development'
      },
      late: {
        recommendedPacing: 'fast' as const,
        reason: 'Late arc should accelerate toward climax with faster pacing and rising tension'
      }
    };

    // Identify pacing issues
    const pacingIssues: string[] = [];
    const recommendations: string[] = [];

    // Check for pacing stagnation (same pacing for too many chapters)
    if (sceneLevelPacing.length >= 5) {
      const recentTypes = sceneLevelPacing.slice(-5).map(s => s.dominantPacingType);
      const allSame = recentTypes.every(t => t === recentTypes[0]);
      if (allSame) {
        pacingIssues.push(`Last 5 chapters all have "${recentTypes[0]}" pacing type. Consider varying pacing for better rhythm.`);
        recommendations.push('Alternate pacing types: action scenes → dialogue scenes → reflection moments → description/atmosphere.');
      }
    }

    // Check for lack of pacing variation within chapters
    const lowVariationCount = sceneLevelPacing.filter(s => s.pacingVariation === 'low').length;
    if (lowVariationCount > sceneLevelPacing.length * 0.7 && sceneLevelPacing.length >= 3) {
      pacingIssues.push('Most chapters have low pacing variation. Chapters feel flat without rhythm changes.');
      recommendations.push('Vary pacing within chapters: mix fast action beats with slower reflection or dialogue beats.');
    }

    // Check for inappropriate pacing for arc stage
    if (activeArc && activeArc.startedAtChapter) {
      const idx = Math.max(0, currentChapter - activeArc.startedAtChapter);
      const recentPacing = sceneLevelPacing[sceneLevelPacing.length - 1];
      if (recentPacing) {
        const recommendedPacing = idx === 0 ? arcPositionPacing.beginning.recommendedPacing :
          idx <= 2 ? arcPositionPacing.early.recommendedPacing :
            idx <= 5 ? arcPositionPacing.middle.recommendedPacing :
              arcPositionPacing.late.recommendedPacing;

        // This is a simplified check - in reality, we'd need to map dominantPacingType to fast/medium/slow
        // For now, we'll just include this in recommendations
        recommendations.push(`Current arc stage: ${idx === 0 ? 'Beginning' : idx <= 2 ? 'Early' : idx <= 5 ? 'Middle' : 'Late'}. Recommended pacing: ${recommendedPacing}.`);
      }
    }

    // Check for monotonous rhythm (no alternation)
    if (rhythmPattern.length > 0) {
      const pattern = rhythmPattern[rhythmPattern.length - 1].pattern;
      const isMonotonous = pattern.split(' → ').every(p => p === pattern.split(' → ')[0]);
      if (isMonotonous && pattern.split(' → ').length >= 3) {
        pacingIssues.push('Recent chapters show monotonous pacing rhythm. Alternating pacing creates better reader engagement.');
        recommendations.push('Alternate pacing: follow fast chapters with slower ones, action with reflection, tension with release.');
      }
    }

    const result = {
      sceneLevelPacing: sceneLevelPacing.slice(-5), // Last 5 chapters
      rhythmPattern,
      arcPositionPacing,
      pacingIssues,
      recommendations,
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      pacing: result,
    });

    return result;
  } catch (error) {
    console.error('Error in analyzePacing:', error);
    // Return safe defaults on error
    return {
      sceneLevelPacing: [],
      rhythmPattern: [],
      arcPositionPacing: {
        beginning: { recommendedPacing: 'fast', reason: 'Default recommendation' },
        early: { recommendedPacing: 'medium', reason: 'Default recommendation' },
        middle: { recommendedPacing: 'medium', reason: 'Default recommendation' },
        late: { recommendedPacing: 'fast', reason: 'Default recommendation' },
      },
      pacingIssues: ['Error analyzing pacing. Please try again.'],
      recommendations: [],
    };
  }
}

/**
 * Enhanced Symbolism Analysis
 * Deep symbolic analysis with motif evolution tracking
 */
export function analyzeSymbolism(
  state: NovelState
): {
  symbolicElements: SymbolicElement[];
  motifEvolution: Array<{
    motif: string;
    firstAppearedChapter: number;
    chaptersAppeared: number[];
    evolution: string[]; // How meaning evolved
    currentMeaning: string;
    relatedThemes: string[];
  }>;
  symbolismDensity: number; // Average symbolic elements per chapter
  recommendations: string[];
} {
  // Check cache first
  const cacheKey = getCacheKey(state, 'symbolism');
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.symbolism && isCacheValid(cached)) {
    return cached.symbolism;
  }

  try {
    const existingSymbols = state.symbolicElements || [];
    const allChapters = state.chapters;

    // Detect symbolic objects, images, and actions from chapters
    const detectedSymbols: SymbolicElement[] = [];

    // Common symbolic patterns in Xianxia/Xuanhuan
    const symbolicPatterns = {
      objects: ['jade', 'sword', 'pill', 'manual', 'token', 'ring', 'feather', 'crystal', 'slip', 'artifact', 'seal', 'talisman'],
      colors: ['red', 'gold', 'silver', 'black', 'white', 'jade green', 'crimson', 'azure', 'purple'],
      numbers: ['three', 'seven', 'nine', 'eighty-one', 'hundred', 'thousand'],
      natural: ['phoenix', 'dragon', 'tiger', 'crane', 'lotus', 'bamboo', 'plum blossom', 'cloud', 'mountain', 'river'],
      actions: ['ascend', 'descend', 'transcend', 'breakthrough', 'awaken', 'unleash', 'seal', 'release'],
    };

    // Analyze chapters for symbolic elements
    allChapters.forEach(chapter => {
      const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();

      // Check for symbolic objects
      symbolicPatterns.objects.forEach(object => {
        if (content.includes(object)) {
          // Extract context around the object
          const sentences = (chapter.content + ' ' + (chapter.summary || '')).split(/[.!?]+/);
          const relevantSentences = sentences.filter(s => s.toLowerCase().includes(object));

          if (relevantSentences.length > 0) {
            // Determine symbolic meaning based on context
            let symbolicMeaning = '';
            const sentence = relevantSentences[0].toLowerCase();

            if (sentence.includes('ancient') || sentence.includes('mysterious')) {
              symbolicMeaning = 'Represents ancient wisdom or hidden power';
            } else if (sentence.includes('glowing') || sentence.includes('radiant')) {
              symbolicMeaning = 'Represents power, enlightenment, or divine connection';
            } else if (sentence.includes('cracked') || sentence.includes('broken')) {
              symbolicMeaning = 'Represents imperfection, struggle, or transformation';
            } else if (sentence.includes('cold') || sentence.includes('dark')) {
              symbolicMeaning = 'Represents danger, mystery, or hidden threat';
            } else {
              symbolicMeaning = 'Symbolic object with evolving meaning';
            }

            // Check if this symbol already exists
            const existing = existingSymbols.find(s =>
              s.name.toLowerCase() === object &&
              Math.abs(s.firstAppearedChapter - chapter.number) <= 3
            );

            if (!existing) {
              const symbol: SymbolicElement = {
                id: generateUUID(),
                novelId: state.id,
                name: object,
                symbolicMeaning,
                firstAppearedChapter: chapter.number,
                chaptersAppeared: [chapter.number],
                evolutionNotes: [`First appearance in Ch ${chapter.number}: ${symbolicMeaning}`],
                relatedThemes: [],
                notes: `Detected in chapter ${chapter.number}`,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              detectedSymbols.push(symbol);
            } else {
              // Update existing symbol
              if (!existing.chaptersAppeared.includes(chapter.number)) {
                existing.chaptersAppeared.push(chapter.number);
                existing.updatedAt = Date.now();
              }
            }
          }
        }
      });
    });

    // Combine existing and detected symbols
    const allSymbols = [...existingSymbols, ...detectedSymbols];

    // Analyze motif evolution
    const motifEvolution: Array<{
      motif: string;
      firstAppearedChapter: number;
      chaptersAppeared: number[];
      evolution: string[];
      currentMeaning: string;
      relatedThemes: string[];
    }> = [];

    allSymbols.forEach(symbol => {
      // Group by symbolic name/meaning to track evolution
      const evolution: string[] = [];
      symbol.chaptersAppeared.forEach(chNum => {
        const chapter = allChapters.find(c => c.number === chNum);
        if (chapter) {
          const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
          const symbolMention = content.includes(symbol.name.toLowerCase());
          if (symbolMention) {
            evolution.push(`Ch ${chNum}: ${symbol.symbolicMeaning}`);
          }
        }
      });

      motifEvolution.push({
        motif: symbol.name,
        firstAppearedChapter: symbol.firstAppearedChapter,
        chaptersAppeared: symbol.chaptersAppeared,
        evolution: evolution.length > 0 ? evolution : symbol.evolutionNotes,
        currentMeaning: symbol.symbolicMeaning,
        relatedThemes: symbol.relatedThemes,
      });
    });

    // Calculate symbolism density
    const symbolismDensity = allChapters.length > 0
      ? allSymbols.length / allChapters.length
      : 0;

    // Generate recommendations
    const recommendations: string[] = [];

    if (allSymbols.length === 0 && allChapters.length > 5) {
      recommendations.push('No symbolic elements detected. Consider adding symbolic objects, imagery, or actions that carry deeper meaning.');
    }

    if (symbolismDensity < 0.3 && allChapters.length > 5) {
      recommendations.push('Low symbolism density. Consider weaving more symbolic elements (objects, colors, natural imagery) throughout chapters.');
    }

    if (symbolismDensity > 1.5) {
      recommendations.push('High symbolism density. Ensure symbols have clear meaning and evolve over time rather than just appearing frequently.');
    }

    // Check for symbol evolution
    const symbolsWithoutEvolution = motifEvolution.filter(m => m.evolution.length <= 1);
    if (symbolsWithoutEvolution.length > allSymbols.length * 0.5 && allSymbols.length > 0) {
      recommendations.push('Many symbols appear without evolution. Consider having symbols gain new meaning or layers as the story progresses.');
    }

    const result = {
      symbolicElements: allSymbols.slice(-20), // Last 20 symbols
      motifEvolution: motifEvolution.slice(-10), // Last 10 motifs
      symbolismDensity: Math.round(symbolismDensity * 10) / 10,
      recommendations,
    };

    // Cache the result
    analysisCache.set(cacheKey, {
      timestamp: Date.now(),
      symbolism: result,
    });

    return result;
  } catch (error) {
    // Import logger dynamically to avoid circular dependencies
    import('../../services/loggingService').then(({ logger }) => {
      logger.error('Error in analyzeSymbolism', 'arcAnalyzer', error instanceof Error ? error : new Error(String(error)));
    });
    // Return safe defaults on error
    return {
      symbolicElements: state.symbolicElements?.slice(-20) || [],
      motifEvolution: [],
      symbolismDensity: 0,
      recommendations: ['Error analyzing symbolism. Please try again.'],
    };
  }
}

/**
 * Extracts themes and motifs from arcs using tags and content analysis
 */
export function analyzeThemesAndMotifs(
  state: NovelState
): {
  recurringThemes: Array<{
    theme: string;
    frequency: number;
    arcs: string[];
  }>;
  motifs: Array<{
    motif: string;
    frequency: number;
    arcs: string[];
  }>;
  themeConsistency: string[];
} {
  const completedArcs = state.plotLedger
    .filter(arc => arc.status === 'completed')
    .sort((a, b) => {
      const aEnd = a.endedAtChapter || 0;
      const bEnd = b.endedAtChapter || 0;
      return aEnd - bEnd;
    });

  // Extract themes from tags
  const themeTags = state.tags?.filter(tag => tag.category === 'theme') || [];
  const themeFrequency = new Map<string, { count: number; arcs: string[] }>();

  // Common theme keywords for detection
  const themeKeywords: Record<string, string[]> = {
    'Power and Corruption': ['power', 'corruption', 'authority', 'tyranny', 'dominance'],
    'Revenge and Justice': ['revenge', 'vengeance', 'justice', 'retribution', 'punishment'],
    'Identity and Self-Discovery': ['identity', 'self', 'who am i', 'discovery', 'purpose'],
    'Sacrifice and Duty': ['sacrifice', 'duty', 'responsibility', 'obligation', 'honor'],
    'Friendship and Betrayal': ['friendship', 'betrayal', 'trust', 'loyalty', 'ally'],
    'Growth and Transformation': ['growth', 'transform', 'evolve', 'change', 'become'],
    'Fate vs Free Will': ['fate', 'destiny', 'free will', 'choice', 'predetermined'],
    'Good vs Evil': ['good', 'evil', 'morality', 'right', 'wrong', 'virtue'],
  };

  const motifKeywords: Record<string, string[]> = {
    'Redemption': ['redeem', 'redemption', 'forgiven', 'atonement', 'second chance'],
    'Loss and Grief': ['loss', 'grief', 'mourn', 'death', 'gone', 'remember'],
    'Mentorship': ['mentor', 'master', 'teacher', 'student', 'disciple', 'guide'],
    'Hidden Power': ['hidden', 'sealed', 'awaken', 'unlock', 'potential', 'latent'],
    'Rising from Nothing': ['weak', 'nothing', 'zero', 'rise', 'climb', 'underdog'],
  };

  completedArcs.forEach(arc => {
    const arcChapters = getArcChapters(arc, state.chapters);
    if (arcChapters.length === 0) return;

    const allContent = arcChapters
      .map(ch => (ch.content || '') + ' ' + (ch.summary || ''))
      .join(' ')
      .toLowerCase();

    // Check themes
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const matches = keywords.filter(kw => allContent.includes(kw.toLowerCase()));
      if (matches.length >= 2) {
        if (!themeFrequency.has(theme)) {
          themeFrequency.set(theme, { count: 0, arcs: [] });
        }
        const entry = themeFrequency.get(theme)!;
        entry.count++;
        if (!entry.arcs.includes(arc.title)) {
          entry.arcs.push(arc.title);
        }
      }
    }

    // Check motifs
    for (const [motif, keywords] of Object.entries(motifKeywords)) {
      const matches = keywords.filter(kw => allContent.includes(kw.toLowerCase()));
      if (matches.length >= 2) {
        if (!themeFrequency.has(motif)) {
          themeFrequency.set(motif, { count: 0, arcs: [] });
        }
        const entry = themeFrequency.get(motif)!;
        entry.count++;
        if (!entry.arcs.includes(arc.title)) {
          entry.arcs.push(arc.title);
        }
      }
    }
  });

  // Process themes and motifs
  const recurringThemes: Array<{ theme: string; frequency: number; arcs: string[] }> = [];
  const motifs: Array<{ motif: string; frequency: number; arcs: string[] }> = [];

  themeFrequency.forEach((value, key) => {
    if (themeKeywords[key]) {
      recurringThemes.push({
        theme: key,
        frequency: value.count,
        arcs: value.arcs,
      });
    } else if (motifKeywords[key]) {
      motifs.push({
        motif: key,
        frequency: value.count,
        arcs: value.arcs,
      });
    }
  });

  recurringThemes.sort((a, b) => b.frequency - a.frequency);
  motifs.sort((a, b) => b.frequency - a.frequency);

  // Theme consistency analysis
  const themeConsistency: string[] = [];
  if (recurringThemes.length > 0) {
    const dominantTheme = recurringThemes[0];
    if (dominantTheme.frequency >= completedArcs.length * 0.6) {
      themeConsistency.push(`Strong theme consistency: "${dominantTheme.theme}" appears in ${Math.round((dominantTheme.frequency / completedArcs.length) * 100)}% of arcs.`);
    } else if (recurringThemes.length > 3) {
      themeConsistency.push('Multiple themes detected. Consider focusing on 1-2 core themes for stronger narrative cohesion.');
    }
  }

  return {
    recurringThemes: recurringThemes.slice(0, 5),
    motifs: motifs.slice(0, 5),
    themeConsistency,
  };
}

/**
 * Detects suggested narrative archetypes based on story state and context
 */
export function detectSuggestedArchetypes(
  state: NovelState,
  context: ArcContextSummary | { arcSummaries: ArcContextSummary[] }
): NarrativeArchetypeSuggestion[] {
  const suggestions: NarrativeArchetypeSuggestion[] = [];
  const recentChapters = state.chapters.slice(-10);

  // Safe extraction of unresolved threads handling both structure types
  let unresolvedThreads: Array<{ description: string; status: string }> = [];

  if (context && 'plotThreads' in context) {
    // Single ArcContextSummary
    unresolvedThreads = (context as any).plotThreads.filter((t: any) => t.status === 'unresolved');
  } else if (context && 'arcSummaries' in context) {
    // PromptContext.arcContext wrapper
    const summaries = (context as any).arcSummaries as ArcContextSummary[];
    unresolvedThreads = summaries.flatMap(s => s.plotThreads || []).filter(t => t.status === 'unresolved');
  }

  // 1. Check for Tournament/Competition indicators
  const combatThreads = unresolvedThreads.filter(t =>
    t.description.toLowerCase().includes('rival') ||
    t.description.toLowerCase().includes('tournament') ||
    t.description.toLowerCase().includes('competition') ||
    t.description.toLowerCase().includes('ranking')
  );

  if (combatThreads.length > 0) {
    suggestions.push({
      type: 'tournament',
      confidence: 0.8,
      reasoning: 'Several unresolved threads involve rivalry or competition.',
      focus: 'Prove strength against rivals in a structured setting.'
    });
  }

  // 2. Check for Secret Realm/Exploration
  const explorationKeywords = ['map', 'key', 'ruin', 'legacy', 'treasure', 'secret realm', 'dungeon'];
  const explorationThreads = unresolvedThreads.filter(t =>
    explorationKeywords.some(k => t.description.toLowerCase().includes(k))
  );

  if (explorationThreads.length > 0) {
    suggestions.push({
      type: 'secret_realm',
      confidence: 0.75,
      reasoning: 'Threads hint at undiscovered locations or treasures.',
      focus: 'Explore a dangerous new environment to acquire resources.'
    });
  }

  // 3. Check for Sect War/Conflict
  const warKeywords = ['war', 'invasion', 'army', 'sect', 'annihilate', 'attack'];
  const warThreads = unresolvedThreads.filter(t =>
    warKeywords.some(k => t.description.toLowerCase().includes(k))
  );

  if (warThreads.length > 0) {
    suggestions.push({
      type: 'sect_war',
      confidence: 0.85,
      reasoning: 'High-stakes conflict keywords detected in unresolved threads.',
      focus: 'Large scale conflict involving multiple organizations.'
    });
  }

  // 4. Default/Fallback Suggestions based on generic story flow
  if (suggestions.length < 2) {
    suggestions.push({
      type: 'journey',
      confidence: 0.6,
      reasoning: 'A change of setting can drive character growth.',
      focus: 'Travel to a new region (e.g., a city, a new sect) to encounter new opportunities.'
    });

    suggestions.push({
      type: 'training',
      confidence: 0.5,
      reasoning: 'Consolidate gains after recent events.',
      focus: 'Focus on cultivation, learning new techniques, or deep seclusion.'
    });
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
