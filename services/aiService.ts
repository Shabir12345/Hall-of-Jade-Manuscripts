import type { Arc, ArcChecklistItem, Character, Chapter, NovelState, LogicAudit } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';
import { getStoredLlm, type LlmId } from '../contexts/LlmContext';
import { rateLimiter } from './rateLimiter';
import { deepseekJson, deepseekText } from './deepseekService';
import { buildArcPrompt } from './promptEngine/writers/arcPromptWriter';
import { buildChapterPrompt } from './promptEngine/writers/chapterPromptWriter';
import { buildEditPrompt } from './promptEngine/writers/editPromptWriter';
import { buildExpansionPrompt } from './promptEngine/writers/expansionPromptWriter';
import { formatChapterContent } from '../utils/chapterFormatter';
import { validateChapterGenerationQuality, validateGeneratedChapter } from './chapterQualityValidator';
import { AppError, formatErrorMessage } from '../utils/errorHandling';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';

import * as gemini from './geminiService';

export function getActiveLlm(): LlmId {
  // Stored in localStorage by LlmProvider.
  try {
    return getStoredLlm();
  } catch {
    return 'gemini';
  }
}

function deepseekModelFromLlm(llm: LlmId): 'deepseek-chat' | 'deepseek-reasoner' {
  return llm === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
}

function sanitizePlainTextInsight(raw: string): string {
  if (!raw) return raw;
  let text = raw.trim();

  // Strip markdown code fences (``` or ```json ... ```)
  const fenceMatch = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fenceMatch?.[1]) {
    text = fenceMatch[1].trim();
  }

  const extractFromJson = (value: any): string | null => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const strings = value.filter(v => typeof v === 'string').slice(0, 3);
      return strings.length ? strings.join('\n\n') : null;
    }
    if (value && typeof value === 'object') {
      const preferredKeys = ['content', 'text', 'idea', 'insight', 'result', 'message'];
      for (const k of preferredKeys) {
        const v = (value as Record<string, unknown>)[k];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return null;
    }
    return null;
  };

  // If the whole output looks like JSON, try to parse and extract a likely text field.
  const looksJson =
    (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
  if (looksJson) {
    try {
      const parsed = JSON.parse(text);
      const extracted = extractFromJson(parsed);
      if (extracted) return extracted.trim();
    } catch {
      // ignore
    }
  }

  // Best-effort extraction for common `{ "content": "..." }`-style output
  const contentMatch = text.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/);
  if (contentMatch?.[1]) {
    return contentMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();
  }

  // Unwrap single quoted or double quoted full-string outputs
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text.trim();
}

function truncateForExtraction(text: string, maxChars: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + '\n\n[... truncated ...]';
}

export type ChapterGenPhase =
  | 'quality_check'
  | 'quality_validation'
  | 'prompt_build_start'
  | 'prompt_build_end'
  | 'queue_estimate'
  | 'queue_dequeued'
  | 'gemini_request_start'
  | 'gemini_request_end'
  | 'parse_start'
  | 'parse_end';

export const refineSpokenInput = async (rawText: string): Promise<string> => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.refineSpokenInput(rawText);

  const prompt = `
You are an expert editor for Xianxia and high-fantasy web novels.

TASK:
1. Correct transcription errors (especially genre-specific terms like "qi", "dantian", "cultivation", "realms").
2. Organize the thoughts into a logical, professionally structured paragraph or list.
3. Maintain the specific genre jargon.
4. Keep the output as ONLY the refined text, no preamble or conversation.

RAW INPUT:
"${rawText}"
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () =>
      (await deepseekText({
        model: deepseekModelFromLlm(llm),
        user: prompt,
        temperature: 0.5,
      })) || rawText,
    `refine-voice-${rawText.substring(0, 50)}`
  );
};

export const processLoreDictation = async (
  rawText: string
): Promise<{ title: string; content: string; category: string }> => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.processLoreDictation(rawText);

  // Skip API call if input is empty
  if (!rawText || rawText.trim().length < 5) {
    return { title: 'Untitled Entry', content: rawText, category: 'Other' };
  }

  const prompt = `
You are the "Omniscient System Clerk".
An author has dictated some lore for a Xianxia/Fantasy world.

RAW SPEECH: "${rawText}"

TASK:
1. Refine the text for clarity, logic, and genre accuracy.
2. Extract a suitable Title.
3. Assign it to one of these categories: Geography, Sects, PowerLevels, Laws, Systems, Techniques, Other.

Return ONLY a JSON object with this shape:
{"title": string, "content": string, "category": string}
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () => {
      const parsed = await deepseekJson<{ title: string; content: string; category: string }>({
        model: deepseekModelFromLlm(llm),
        user: prompt,
        temperature: 0.4,
      });

      return {
        title: parsed?.title || 'Untitled Entry',
        content: parsed?.content || rawText,
        category: parsed?.category || 'Other',
      };
    },
    `lore-${rawText.substring(0, 50)}`
  );
};

export const generateCreativeExpansion = async (
  type: string,
  currentText: string,
  state: NovelState
): Promise<string> => {
  const llm = getActiveLlm();
  if (llm === 'gemini') {
    const out = await gemini.generateCreativeExpansion(type, currentText, state);
    return sanitizePlainTextInsight(out || currentText);
  }

  try {
    const builtPrompt = await buildExpansionPrompt(state, type, currentText);

    const responseText = await rateLimiter.queueRequest(
      'refine',
      async () =>
        deepseekText({
          model: deepseekModelFromLlm(llm),
          system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          user: builtPrompt.userPrompt,
          temperature: 0.95,
          topP: 0.9,
        }),
      `expansion-${type}-${currentText.substring(0, 50)}`
    );

    return sanitizePlainTextInsight(responseText || currentText);
  } catch (error) {
    logger.error('Error in generateCreativeExpansion', 'ai', error instanceof Error ? error : new Error(String(error)));
    return currentText;
  }
};

/**
 * Generates the next chapter for a novel using AI
 * 
 * @param state - The current novel state including all chapters, characters, world, and arcs
 * @param userInstruction - Optional user instructions for the chapter (e.g., "Focus on character development")
 * @param opts - Optional callbacks for phase updates during generation
 * @returns Promise resolving to the generated chapter data including title, content, and updates
 * 
 * @example
 * ```typescript
 * const result = await generateNextChapter(novelState, "Introduce a new antagonist");
 * console.log(result.chapterTitle);
 * ```
 * 
 * @throws {AppError} If chapter generation fails or validation errors occur
 */
export const generateNextChapter = async (
  state: NovelState,
  userInstruction: string = '',
  opts?: {
    onPhase?: (phase: ChapterGenPhase, data?: Record<string, unknown>) => void;
  }
) => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.generateNextChapter(state, userInstruction, opts);

  // Pre-generation quality checks
  const nextChapterNumber = state.chapters.length + 1;
  const qualityCheck = validateChapterGenerationQuality(state, nextChapterNumber);
  
  if (qualityCheck.suggestions.length > 0) {
    opts?.onPhase?.('quality_check', {
      qualityScore: qualityCheck.qualityScore,
      suggestions: qualityCheck.suggestions,
    });
    
    if (qualityCheck.warnings.length > 0) {
      logger.warn('Chapter generation quality warnings', 'ai', {
        warnings: qualityCheck.warnings
      });
    }
  }

  opts?.onPhase?.('prompt_build_start');
  const promptStart = Date.now();
  const builtPrompt = await buildChapterPrompt(state, userInstruction);
  const promptBuildMs = Date.now() - promptStart;
  opts?.onPhase?.('prompt_build_end', { promptBuildMs });

  // Keep the same phase keys so App.tsx logging continues to work (we'll rename UI strings later).
  const estimatedWaitMs = rateLimiter.getEstimatedWaitTime('generate');
  opts?.onPhase?.('queue_estimate', { estimatedWaitMs });

  let queueWaitMs: number | undefined;
  let requestDurationMs: number | undefined;

  const result = await rateLimiter.queueRequest(
    'generate',
    async () => {
      opts?.onPhase?.('gemini_request_start');
      const start = Date.now();
      const json = await deepseekJson<{
        logicAudit?: LogicAudit;
        chapterTitle?: string;
        chapterContent?: string;
        chapterSummary?: string;
        characterUpdates?: Array<{
          name: string;
          updateType: string;
          newValue: string;
          targetName?: string;
        }>;
        worldUpdates?: Array<{
          title: string;
          content: string;
          category: string;
          isNewRealm: boolean;
        }>;
        territoryUpdates?: Array<{
          name: string;
          type: string;
          description: string;
        }>;
      }>({
        model: deepseekModelFromLlm(llm),
        system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
        user:
          builtPrompt.userPrompt +
          '\n\nReturn ONLY a JSON object with this exact shape:\n' +
          '{' +
          '"logicAudit":{"startingValue":string,"theFriction":string,"theChoice":string,"resultingValue":string,"causalityType":string},' +
          '"chapterTitle":string,' +
          '"chapterContent":string,' +
          '"chapterSummary":string,' +
          '"characterUpdates":[{"name":string,"updateType":string,"newValue":string,"targetName":string}],' +
          '"worldUpdates":[{"title":string,"content":string,"category":string,"isNewRealm":boolean}],' +
          '"territoryUpdates":[{"name":string,"type":string,"description":string}]' +
          '}',
        // AI Detection Evasion: Higher temperature and topP for more human-like unpredictability
        temperature: 1.15,
        topP: 0.95,
        // DeepSeek output can be large; allow ample tokens.
        maxTokens: 8192,
      });
      requestDurationMs = Date.now() - start;
      opts?.onPhase?.('gemini_request_end', { requestDurationMs });
      return json;
    },
    `generate-${state.id}-${state.chapters.length + 1}`,
    {
      onDequeued: (info) => {
        queueWaitMs = info.queueWaitMs;
        opts?.onPhase?.('queue_dequeued', { queueWaitMs });
      },
      onFinished: () => {},
      onError: (info) => {
        console.warn('DeepSeek request failed in rate limiter', info);
      },
    }
  );

  opts?.onPhase?.('parse_start');
  // deepseekJson already parses; still validate required fields
  if (!result?.chapterTitle || !result?.chapterContent) {
    throw new Error('LLM response missing required fields (chapterTitle or chapterContent)');
  }
  
  // Format chapter content for professional structure and punctuation
  const originalContent = result.chapterContent;
  result.chapterContent = formatChapterContent(result.chapterContent);
  
  if (originalContent !== result.chapterContent) {
    logger.debug('Chapter content formatted: structure and punctuation improvements applied', 'ai');
  }
  
  // Validate minimum word count (1500 words) - after formatting
  const wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;
  if (wordCount < 1500) {
    logger.warn('Generated chapter below minimum word count', 'ai', {
      wordCount,
      minimum: 1500
    });
    // Note: We'll still return it, but log a warning. The prompt should enforce this.
    // In production, you might want to retry or extend the content here.
  } else {
    logger.debug('Chapter word count meets requirement', 'ai', {
      wordCount,
      minimum: 1500
    });
  }
  
  // Post-generation quality validation
  try {
      const generatedChapter: Chapter = {
        id: generateUUID(),
      number: state.chapters.length + 1,
      title: result.chapterTitle || 'Untitled',
      content: result.chapterContent || '',
      summary: result.chapterSummary || '',
      logicAudit: result.logicAudit,
      scenes: [],
      createdAt: Date.now(),
    };
    
    const qualityCheck = validateGeneratedChapter(generatedChapter, state);
    if (!qualityCheck.isValid || qualityCheck.warnings.length > 0) {
      opts?.onPhase?.('quality_validation', {
        qualityScore: qualityCheck.qualityScore,
        warnings: qualityCheck.warnings,
        errors: qualityCheck.errors,
        suggestions: qualityCheck.suggestions,
      });
      
      if (qualityCheck.errors.length > 0) {
        console.error('Chapter quality validation errors:', qualityCheck.errors);
      }
      if (qualityCheck.warnings.length > 0) {
        console.warn('Chapter quality validation warnings:', qualityCheck.warnings);
      }
    }
  } catch (error) {
    console.warn('Error in post-generation quality validation:', error);
  }
  
  opts?.onPhase?.('parse_end', { parseMs: 0 });

  return result;
};

export type PostChapterExtraction = {
  characterUpserts: Array<{
    name: string;
    isNew?: boolean;
    set?: Partial<Pick<Character, 'age' | 'personality' | 'currentCultivation' | 'notes' | 'status'>>;
    addSkills?: string[]; // @deprecated - Use techniqueUpdates instead
    addItems?: string[]; // @deprecated - Use itemUpdates instead
    relationships?: Array<{
      targetName: string;
      type: string;
      history?: string;
      impact?: string;
    }>;
  }>;
  worldEntryUpserts: Array<{
    title: string;
    category: string;
    content: string;
  }>;
  territoryUpserts: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  itemUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    itemId?: string; // If updating existing
    category: 'Treasure' | 'Equipment' | 'Consumable' | 'Essential';
    description?: string;
    addPowers?: string[];
    characterName: string; // Which character possesses it
  }>;
  techniqueUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    techniqueId?: string; // If updating existing
    category: 'Core' | 'Important' | 'Standard' | 'Basic';
    type: 'Cultivation' | 'Combat' | 'Support' | 'Secret' | 'Other';
    description?: string;
    addFunctions?: string[];
    characterName: string;
    masteryLevel?: string;
  }>;
  scenes: Array<{
    number: number;
    title: string;
    summary: string;
    contentExcerpt: string; // First ~500 chars of scene content
  }>;
  arcChecklistProgress: {
    arcId: string | null;
    completedItemIds: string[];
    notes?: string;
  } | null;
  antagonistUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    antagonistId?: string; // If updating existing
    type: 'individual' | 'group' | 'system' | 'society' | 'abstract';
    description?: string;
    motivation?: string;
    powerLevel?: string;
    status: 'active' | 'defeated' | 'transformed' | 'dormant' | 'hinted';
    threatLevel: 'low' | 'medium' | 'high' | 'extreme';
    durationScope: 'chapter' | 'arc' | 'novel' | 'multi_arc';
    presenceType?: 'direct' | 'mentioned' | 'hinted' | 'influence';
    significance?: 'major' | 'minor' | 'foreshadowing';
    relationshipWithProtagonist?: {
      relationshipType: 'primary_target' | 'secondary_target' | 'ally_of_antagonist' | 'neutral';
      intensity: 'rival' | 'enemy' | 'nemesis' | 'opposition';
    };
    arcRole?: 'primary' | 'secondary' | 'background' | 'hinted';
    notes?: string;
  }>;
};

export const extractPostChapterUpdates = async (
  state: NovelState,
  newChapter: Chapter,
  activeArc: Arc | null
): Promise<PostChapterExtraction> => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.extractPostChapterUpdates(state, newChapter, activeArc);

  const safeChecklist: ArcChecklistItem[] = activeArc?.checklist || [];

  const prompt = `
You are the "Omniscient System Clerk" for a Xianxia/Fantasy novel writing tool.

TASK:
Given the latest generated chapter, produce structured UPDATES that should be merged into:
1) Character Codex
2) World Bible
3) Territories
4) Items and Techniques (with smart deduplication)
5) Antagonists (opponents, threats, conflicts - with smart recognition)
6) Scenes (break the chapter into logical scenes)
7) Active Arc progress checklist

CRITICAL RULES:
- Prefer UPDATING existing entities rather than creating duplicates.
- For items/techniques: CHECK if an item/technique already exists before creating a new entry. Use fuzzy matching (e.g., "Jade Slip", "jade slip", "Jade-Slip" refer to the same item).
- If an item/technique exists but has new powers/functions, use "update" action with addPowers/addFunctions.
- When unsure, be conservative (fewer, higher-quality updates).
- Return ONLY valid JSON that matches the schema below. No markdown.

ACTIVE ARC:
${activeArc ? `- id: ${activeArc.id}\n- title: ${activeArc.title}\n- description: ${truncateForExtraction(activeArc.description || '', 500)}\n- checklistItems: ${safeChecklist.map(i => `${i.id}::${i.label}::${i.completed ? 'completed' : 'open'}`).join(' | ')}` : 'None'}

LATEST CHAPTER:
- number: ${newChapter.number}
- title: ${newChapter.title}
- summary: ${truncateForExtraction(newChapter.summary || '', 1200)}
- excerpt: ${truncateForExtraction(newChapter.content || '', 1800)}

EXISTING CHARACTERS (names + key fields):
${state.characterCodex
  .slice(0, 80)
  .map(c => `- ${c.name} | cultivation=${truncateForExtraction(c.currentCultivation || '', 40)} | status=${c.status} | notes=${truncateForExtraction(c.notes || '', 120)}`)
  .join('\n')}

EXISTING WORLD BIBLE TITLES:
${state.worldBible
  .slice(0, 120)
  .map(w => `- [${w.category}] ${w.title}`)
  .join('\n')}

EXISTING TERRITORIES:
${state.territories
  .slice(0, 120)
  .map(t => `- ${t.name} (${t.type})`)
  .join('\n')}

EXISTING ITEMS (canonical names for deduplication):
${state.novelItems && state.novelItems.length > 0
  ? state.novelItems
      .slice(0, 100)
      .map(item => `- ${item.name} (${item.category}) | powers: ${item.powers.slice(0, 3).join(', ')}`)
      .join('\n')
  : 'None'}

EXISTING TECHNIQUES (canonical names for deduplication):
${state.novelTechniques && state.novelTechniques.length > 0
  ? state.novelTechniques
      .slice(0, 100)
      .map(tech => `- ${tech.name} (${tech.category} ${tech.type}) | functions: ${tech.functions.slice(0, 3).join(', ')}`)
      .join('\n')
  : 'None'}

EXISTING ANTAGONISTS (for recognition and updates):
${state.antagonists && state.antagonists.length > 0
  ? state.antagonists
      .slice(0, 50)
      .map(ant => `- ${ant.name} (${ant.type}, ${ant.status}, ${ant.threatLevel} threat) | ${ant.motivation ? `motivation: ${ant.motivation.substring(0, 60)}` : ''}`)
      .join('\n')
  : 'None'}

ITEM CATEGORIZATION GUIDE:
- Treasure: Magical artifacts, powerful items with special properties (e.g., "Jade Slip", "Sword of Heaven", "Phoenix Feather")
- Equipment: Tools, weapons, armor, regular items (e.g., "Iron Sword", "Cultivation Robes", "Storage Ring")
- Consumable: Food, pills, talismans, one-time use items (e.g., "Healing Pill", "Spirit Fruit", "Escape Talisman")
- Essential: Basic necessities, mundane items (e.g., "dried meat", "water skin", "torch", "rope")

TECHNIQUE CATEGORIZATION GUIDE:
- Category (importance):
  * Core: Fundamental cultivation methods, signature moves, main techniques (e.g., "Nine Heavens Divine Art", "Phoenix Rebirth Technique")
  * Important: Significant abilities, key skills (e.g., "Wind Sword Art", "Spirit Sense")
  * Standard: Common techniques, widely used (e.g., "Basic Sword Art", "Energy Gathering")
  * Basic: Entry-level skills (e.g., "Qi Circulation", "Meditation")
- Type (function):
  * Cultivation: Methods for advancing cultivation realm
  * Combat: Battle techniques, attacks, defenses
  * Support: Healing, buffs, utility abilities
  * Secret: Hidden techniques, forbidden arts
  * Other: Miscellaneous techniques

ITEMS/TECHNIQUES UPDATE LOGIC:
- If item/technique name matches existing (fuzzy match): use "update" action with addPowers/addFunctions
- If item/technique is completely new: use "create" action with full details
- Always include category and characterName
- For techniques: include type and masteryLevel (e.g., "Novice", "Intermediate", "Expert", "Master")

ANTAGONIST EXTRACTION GUIDELINES:
- Identify ANY opposing forces, threats, or conflicts mentioned or hinted at in the chapter
- Check existing antagonists list FIRST - if an antagonist already exists, use "update" action
- Types: individual (single person), group (organization/faction), system (laws/rules), society (cultural), abstract (concept/force)
- Status: active (currently opposing), defeated (resolved), transformed (changed role), dormant (inactive but relevant), hinted (foreshadowed)
- Threat Level: low (minor obstacle), medium (significant challenge), high (major threat), extreme (existential danger)
- Duration Scope: chapter (single chapter), arc (one story arc), novel (entire novel), multi_arc (multiple arcs but not entire novel)
- For new antagonists: provide description, motivation, power level, and threat assessment
- For existing antagonists appearing: update status, power level if changed, and add chapter appearance notes
- Presence Type: direct (physically present), mentioned (referenced), hinted (subtle foreshadowing), influence (affecting events indirectly)
- Significance: major (primary conflict), minor (secondary), foreshadowing (future threat)
- If antagonist is related to protagonist: specify relationshipWithProtagonist with type and intensity
- If active arc exists: specify arcRole (primary, secondary, background, hinted)

SCENE BREAKDOWN INSTRUCTIONS:
- Break the chapter into 2-5 logical scenes based on location shifts, time jumps, or major plot beats.
- Each scene should have: a clear title, a brief summary, and the first ~500 characters of that scene's content from the chapter.
- Scenes should be numbered sequentially starting from 1.

Return ONLY a JSON object with this exact shape:
{
  "characterUpserts": [
    {
      "name": string,
      "isNew": boolean (optional),
      "set": { "age"?: string, "personality"?: string, "currentCultivation"?: string, "notes"?: string, "status"?: "Alive"|"Deceased"|"Unknown" } (optional),
      "addSkills": string[] (optional),
      "addItems": string[] (optional),
      "relationships": [
        { "targetName": string, "type": string, "history"?: string, "impact"?: string }
      ] (optional)
    }
  ],
  "worldEntryUpserts": [
    { "title": string, "category": string, "content": string }
  ],
  "territoryUpserts": [
    { "name": string, "type": string, "description": string }
  ],
  "itemUpdates": [
    { 
      "name": string, 
      "action": "create"|"update", 
      "itemId": string (optional, if updating existing),
      "category": "Treasure"|"Equipment"|"Consumable"|"Essential",
      "description": string (optional),
      "addPowers": string[] (optional, new abilities discovered),
      "characterName": string
    }
  ] (optional),
  "techniqueUpdates": [
    {
      "name": string,
      "action": "create"|"update",
      "techniqueId": string (optional, if updating existing),
      "category": "Core"|"Important"|"Standard"|"Basic",
      "type": "Cultivation"|"Combat"|"Support"|"Secret"|"Other",
      "description": string (optional),
      "addFunctions": string[] (optional, new abilities discovered),
      "characterName": string,
      "masteryLevel": string (optional, e.g., "Novice", "Expert", "Master")
    }
  ] (optional),
  "scenes": [
    { "number": number (1-based), "title": string, "summary": string, "contentExcerpt": string }
  ],
  "arcChecklistProgress": {
    "arcId": string|null,
    "completedItemIds": string[],
    "notes": string (optional)
  } | null,
  "antagonistUpdates": [
    {
      "name": string,
      "action": "create"|"update",
      "antagonistId": string (optional, if updating existing),
      "type": "individual"|"group"|"system"|"society"|"abstract",
      "description": string (optional),
      "motivation": string (optional),
      "powerLevel": string (optional),
      "status": "active"|"defeated"|"transformed"|"dormant"|"hinted",
      "threatLevel": "low"|"medium"|"high"|"extreme",
      "durationScope": "chapter"|"arc"|"novel"|"multi_arc",
      "presenceType": "direct"|"mentioned"|"hinted"|"influence" (optional),
      "significance": "major"|"minor"|"foreshadowing" (optional),
      "relationshipWithProtagonist": {
        "relationshipType": "primary_target"|"secondary_target"|"ally_of_antagonist"|"neutral",
        "intensity": "rival"|"enemy"|"nemesis"|"opposition"
      } (optional),
      "arcRole": "primary"|"secondary"|"background"|"hinted" (optional),
      "notes": string (optional)
    }
  ] (optional)
}
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () => {
      const parsed = await deepseekJson<PostChapterExtraction>({
        model: deepseekModelFromLlm(llm),
        system: SYSTEM_INSTRUCTION,
        user: prompt,
        temperature: 0.3,
        maxTokens: 8192, // Increased to handle longer responses with scene excerpts
      });

      return {
        characterUpserts: parsed?.characterUpserts || [],
        worldEntryUpserts: parsed?.worldEntryUpserts || [],
        territoryUpserts: parsed?.territoryUpserts || [],
        itemUpdates: parsed?.itemUpdates || [],
        techniqueUpdates: parsed?.techniqueUpdates || [],
        antagonistUpdates: parsed?.antagonistUpdates || [],
        scenes: parsed?.scenes || [],
        arcChecklistProgress: parsed?.arcChecklistProgress ?? null,
      };
    },
    `postchapter-extract-${state.id}-${newChapter.number}`
  );
};

export const planArc = async (state: NovelState) => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.planArc(state);

    const builtPrompt = await buildArcPrompt(state);

  return rateLimiter.queueRequest(
    'plan',
    async () =>
      deepseekJson<{ arcTitle: string; arcDescription: string; targetChapters?: number }>({
        model: deepseekModelFromLlm(llm),
        system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
        user:
          builtPrompt.userPrompt +
          '\n\nReturn ONLY a JSON object with this shape:\n' +
          '{"arcTitle": string, "arcDescription": string, "targetChapters": number (optional, optimal number of chapters for this arc based on complexity and scope, range 5-30)}',
      }),
    `plan-arc-${state.id}`
  );
};

export const editChapter = async (
  chapterContent: string,
  instruction: string,
  state: NovelState,
  chapter: Chapter
) => {
  const llm = getActiveLlm();
  if (llm === 'gemini') return gemini.editChapter(chapterContent, instruction, state, chapter);

  if (!instruction || instruction.trim().length === 0) return chapterContent;

  try {
    const builtPrompt = await buildEditPrompt(state, chapter, instruction);

    // Mirror the Gemini behavior: truncate very long chapters before sending.
    let contentToSend = chapterContent;
    if (chapterContent.length > 10000) {
      const firstPart = chapterContent.substring(0, 4000);
      const lastPart = chapterContent.substring(chapterContent.length - 2000);
      contentToSend = `${firstPart}\n\n[... middle section omitted for token efficiency ...]\n\n${lastPart}`;
    } else if (chapterContent.length > 5000) {
      const firstPart = chapterContent.substring(0, 3000);
      const lastPart = chapterContent.substring(chapterContent.length - 1500);
      contentToSend = `${firstPart}\n\n[... middle section ...]\n\n${lastPart}`;
    }

    const fullPrompt = `${builtPrompt.userPrompt}\n\n[CHAPTER CONTENT TO EDIT]\n${contentToSend}`;

    return rateLimiter.queueRequest(
      'edit',
      async () =>
        (await deepseekText({
          model: deepseekModelFromLlm(llm),
          system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          user: fullPrompt,
          // AI Detection Evasion: Higher temperature for editing to catch and fix any remaining AI-like patterns
          temperature: 1.2,
          topP: 0.95,
        })) || chapterContent,
      `edit-${chapter.id}-${instruction.substring(0, 30)}`
    );
  } catch (error) {
    logger.error('Error in editChapter', 'ai', error instanceof Error ? error : new Error(String(error)));
    if (error instanceof AppError) {
      throw error;
    }
    // For edit operations, return original content on error to allow user to continue
    throw new AppError(
      formatErrorMessage(error) || 'Failed to edit chapter',
      'EDIT_ERROR',
      undefined,
      true
    );
  }
};

// These two are Gemini-only features today.
export const generatePortrait = async (character: Character, worldContext: string) => {
  return gemini.generatePortrait(character, worldContext);
};

export const reciteChapter = async (text: string) => {
  return gemini.reciteChapter(text);
};

