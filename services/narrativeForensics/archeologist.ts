/**
 * Archeologist Agent Service
 * 
 * The "Archeologist" is a specialized AI agent that scans chapter content
 * to identify "Narrative Seeds" - forgotten plot elements that need resolution.
 * 
 * This is Pass 1 of the Two-Pass Forensic Logic:
 * - Scans full text looking for "Loose Ends"
 * - Identifies unanswered questions, unused items, missing NPCs, etc.
 * - Extracts the original quote for evidence
 */

import { Chapter, NovelState, StoryThread } from '../../types';
import {
  NarrativeSeed,
  NarrativeSeedType,
  ArcheologistResponse,
} from '../../types/narrativeForensics';
import { deepseekJson } from '../deepseekService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

// ============================================================================
// ARCHEOLOGIST PROMPTS
// ============================================================================

const ARCHEOLOGIST_SYSTEM_PROMPT = `You are the ARCHEOLOGIST AGENT, a narrative forensics specialist.

Your mission is to excavate "Narrative Seeds" from chapter content - these are plot elements that were introduced but may have been forgotten or left unresolved.

## WHAT TO LOOK FOR

1. **UNANSWERED QUESTIONS** - Questions raised in dialogue or narration that weren't answered
   - "Who was the mysterious figure?" / "What did the elder mean by that?"
   - Rhetorical questions that imply future revelation

2. **UNUSED ITEMS (Chekhov's Gun)** - Objects introduced with significance but not yet used
   - Named artifacts, weapons, or treasures
   - Items given as gifts or found mysteriously
   - Objects described with unusual detail

3. **MISSING NPCs** - Named characters who appeared but haven't returned
   - Characters who promised to return
   - Characters who left with unfinished business
   - Mentors, rivals, or allies who disappeared

4. **BROKEN PROMISES** - Explicit or implicit promises not yet fulfilled
   - "I will return for you" / "We shall meet again"
   - Oaths, vows, or sworn duties
   - Debts of gratitude or vengeance

5. **UNRESOLVED CONFLICTS** - Tensions or disputes left hanging
   - Grudges or rivalries established but not concluded
   - Threats made but not acted upon
   - Competitions or challenges left unfinished

6. **FORGOTTEN TECHNIQUES** - Skills or abilities introduced but never used again
   - Techniques learned but not demonstrated
   - Powers hinted at but not developed
   - Training that should have paid off

7. **ABANDONED LOCATIONS** - Places set up as significant but never revisited
   - Secret locations discovered
   - Promised destinations
   - Places with unfinished business

8. **DANGLING MYSTERIES** - Mysteries hinted at but not explored
   - Strange occurrences left unexplained
   - Secrets alluded to but not revealed
   - Prophecies or omens not yet fulfilled

## OUTPUT FORMAT

For each Narrative Seed found, provide:
- seedType: The category from above
- title: A concise title for this seed
- description: What the seed is about and why it matters
- originQuote: The EXACT text from the chapter (verbatim quote)
- originContext: Surrounding context explaining the significance
- confidenceScore: 0-100 how confident you are this is a real narrative seed
- relatedEntities: Names of characters, items, or places involved

## IMPORTANT RULES

1. Only flag SIGNIFICANT narrative elements, not every minor detail
2. The originQuote MUST be an exact quote from the provided text
3. Don't flag things that are clearly resolved within the same chapter
4. Consider the genre (xianxia/cultivation) - some elements are genre conventions
5. Higher confidence for explicit setups (promises, named items, direct questions)
6. Lower confidence for subtle hints or atmospheric details`;

const buildArcheologistUserPrompt = (
  chapterNumber: number,
  chapterContent: string,
  existingSeeds: NarrativeSeed[],
  existingThreads: StoryThread[]
): string => {
  const existingSeedTitles = existingSeeds.map(s => s.title).join(', ') || 'None';
  const existingThreadTitles = existingThreads.map(t => t.title).join(', ') || 'None';

  return `## CHAPTER ${chapterNumber} CONTENT

${chapterContent}

---

## EXISTING NARRATIVE SEEDS (already tracked)
${existingSeedTitles}

## EXISTING STORY THREADS (already tracked)
${existingThreadTitles}

---

## YOUR TASK

Analyze Chapter ${chapterNumber} and identify any NEW Narrative Seeds that are NOT already being tracked.

Focus on elements that:
1. Set up future events but might be forgotten
2. Introduce significant items, characters, or locations
3. Raise questions or mysteries
4. Make promises or establish conflicts

Return your findings as a JSON object with this structure:
{
  "discoveredSeeds": [
    {
      "seedType": "unused_item" | "missing_npc" | "broken_promise" | etc.,
      "title": "Concise title",
      "description": "What this seed is about",
      "originQuote": "Exact quote from the chapter",
      "originContext": "Why this matters",
      "confidenceScore": 0-100,
      "relatedEntities": ["Entity1", "Entity2"]
    }
  ],
  "reasoning": ["Step-by-step reasoning for your findings"],
  "warnings": ["Any concerns or notes"]
}

If no new seeds are found, return an empty discoveredSeeds array.`;
};

// ============================================================================
// ARCHEOLOGIST AGENT
// ============================================================================

export interface ArcheologistConfig {
  minConfidence: number;
  maxSeedsPerChapter: number;
  model: 'deepseek-chat' | 'deepseek-reasoner';
  temperature: number;
}

const DEFAULT_ARCHEOLOGIST_CONFIG: ArcheologistConfig = {
  minConfidence: 60,
  maxSeedsPerChapter: 10,
  model: 'deepseek-chat',
  temperature: 0.3,
};

/**
 * Run the Archeologist Agent on a single chapter
 */
export async function runArcheologistAgent(
  chapter: Chapter,
  novelState: NovelState,
  existingSeeds: NarrativeSeed[] = [],
  config: Partial<ArcheologistConfig> = {}
): Promise<{
  seeds: NarrativeSeed[];
  reasoning: string[];
  warnings: string[];
  durationMs: number;
}> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_ARCHEOLOGIST_CONFIG, ...config };

  logger.info(`Running Archeologist Agent on Chapter ${chapter.number}`, 'archeologist');

  try {
    // Get existing threads for context
    const existingThreads = novelState.storyThreads || [];

    // Build prompt
    const userPrompt = buildArcheologistUserPrompt(
      chapter.number,
      chapter.content,
      existingSeeds,
      existingThreads
    );

    // Call DeepSeek
    const response = await deepseekJson<ArcheologistResponse>({
      model: finalConfig.model,
      system: ARCHEOLOGIST_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: finalConfig.temperature,
    });

    // Process discovered seeds
    const seeds: NarrativeSeed[] = [];

    for (const discovered of response.discoveredSeeds || []) {
      // Skip low confidence seeds
      if (discovered.confidenceScore < finalConfig.minConfidence) {
        continue;
      }

      // Validate seed type
      const validSeedTypes: NarrativeSeedType[] = [
        'unanswered_question', 'unused_item', 'missing_npc',
        'broken_promise', 'unresolved_conflict', 'forgotten_technique',
        'abandoned_location', 'dangling_mystery', 'chekhov_gun'
      ];

      const seedType = validSeedTypes.includes(discovered.seedType as NarrativeSeedType)
        ? discovered.seedType as NarrativeSeedType
        : 'chekhov_gun';

      // Create seed
      const seed: NarrativeSeed = {
        id: generateUUID(),
        novelId: novelState.id,
        seedType,
        title: discovered.title || 'Untitled Seed',
        description: discovered.description || '',
        originChapter: chapter.number,
        originQuote: discovered.originQuote || '',
        originContext: discovered.originContext,
        discoveredAt: Date.now(),
        confidenceScore: Math.min(100, Math.max(0, discovered.confidenceScore)),
        lastMentionedChapter: undefined,
        mentionCount: 0,
        chaptersMentioned: [],
        status: 'discovered',
        neglectScore: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      seeds.push(seed);

      // Limit seeds per chapter
      if (seeds.length >= finalConfig.maxSeedsPerChapter) {
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    logger.info(`Archeologist found ${seeds.length} seeds in Chapter ${chapter.number}`, 'archeologist');

    return {
      seeds,
      reasoning: response.reasoning || [],
      warnings: response.warnings || [],
      durationMs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Archeologist Agent failed', 'archeologist', error instanceof Error ? error : undefined);

    return {
      seeds: [],
      reasoning: [],
      warnings: [`Archeologist failed: ${errorMessage}`],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Run the Archeologist Agent on a range of chapters (batch processing)
 */
export async function runArcheologistBatch(
  chapters: Chapter[],
  novelState: NovelState,
  existingSeeds: NarrativeSeed[] = [],
  config: Partial<ArcheologistConfig> = {},
  onProgress?: (progress: { current: number; total: number; chapter: number }) => void
): Promise<{
  allSeeds: NarrativeSeed[];
  seedsByChapter: Map<number, NarrativeSeed[]>;
  totalDurationMs: number;
  warnings: string[];
}> {
  const startTime = Date.now();
  const allSeeds: NarrativeSeed[] = [];
  const seedsByChapter = new Map<number, NarrativeSeed[]>();
  const warnings: string[] = [];

  // Sort chapters by number
  const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

  logger.info(`Starting Archeologist batch scan on ${sortedChapters.length} chapters`, 'archeologist');

  // Process chapters sequentially to avoid rate limits
  // Accumulate seeds as we go so later chapters can see earlier discoveries
  let accumulatedSeeds = [...existingSeeds];

  for (let i = 0; i < sortedChapters.length; i++) {
    const chapter = sortedChapters[i];

    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: sortedChapters.length,
        chapter: chapter.number,
      });
    }

    // Run archeologist on this chapter
    const result = await runArcheologistAgent(
      chapter,
      novelState,
      accumulatedSeeds,
      config
    );

    // Store results
    seedsByChapter.set(chapter.number, result.seeds);
    allSeeds.push(...result.seeds);
    accumulatedSeeds.push(...result.seeds);
    warnings.push(...result.warnings);

    // Small delay between chapters to avoid rate limits
    if (i < sortedChapters.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const totalDurationMs = Date.now() - startTime;

  logger.info(`Archeologist batch scan complete`, 'archeologist');

  return {
    allSeeds,
    seedsByChapter,
    totalDurationMs,
    warnings,
  };
}

/**
 * Validate that a quote exists in the chapter content
 */
export function validateQuoteInChapter(quote: string, chapterContent: string): boolean {
  if (!quote || !chapterContent) return false;

  // Normalize whitespace for comparison
  const normalizedQuote = quote.replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedContent = chapterContent.replace(/\s+/g, ' ').toLowerCase();

  return normalizedContent.includes(normalizedQuote);
}

/**
 * Extract a snippet of context around a quote
 */
export function extractQuoteContext(
  quote: string,
  chapterContent: string,
  contextChars: number = 200
): string | undefined {
  if (!quote || !chapterContent) return undefined;

  const normalizedQuote = quote.replace(/\s+/g, ' ').trim();
  const index = chapterContent.indexOf(normalizedQuote);

  if (index === -1) {
    // Try case-insensitive search
    const lowerContent = chapterContent.toLowerCase();
    const lowerQuote = normalizedQuote.toLowerCase();
    const lowerIndex = lowerContent.indexOf(lowerQuote);

    if (lowerIndex === -1) return undefined;

    const start = Math.max(0, lowerIndex - contextChars);
    const end = Math.min(chapterContent.length, lowerIndex + normalizedQuote.length + contextChars);
    return chapterContent.slice(start, end);
  }

  const start = Math.max(0, index - contextChars);
  const end = Math.min(chapterContent.length, index + normalizedQuote.length + contextChars);
  return chapterContent.slice(start, end);
}
