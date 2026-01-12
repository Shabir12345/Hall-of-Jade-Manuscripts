
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NovelState, Character, Chapter, Arc, ArcChecklistItem, LogicAudit } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";
import { rateLimiter } from "./rateLimiter";
import { buildChapterPrompt } from "./promptEngine/writers/chapterPromptWriter";
import { buildEditPrompt } from "./promptEngine/writers/editPromptWriter";
import { buildExpansionPrompt } from "./promptEngine/writers/expansionPromptWriter";
import { buildArcPrompt } from "./promptEngine/writers/arcPromptWriter";
import { formatChapterContent } from "../utils/chapterFormatter";
import { validateChapterGenerationQuality, validateGeneratedChapter } from "./chapterQualityValidator";

import { env } from '../utils/env';

let ai: GoogleGenAI | null = null;
export function getGeminiClient(): GoogleGenAI {
  if (ai) return ai;
  const apiKey = env.gemini.apiKey;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Gemini is required for this feature. ' +
      'Set GEMINI_API_KEY in your .env.local and restart.'
    );
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

function truncateForExtraction(text: string, maxChars: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + '\n\n[... truncated ...]';
}

export const refineSpokenInput = async (rawText: string): Promise<string> => {
  const ai = getGeminiClient();
  const prompt = `
    You are an expert editor for Xianxia and high-fantasy web novels. 
    The following is a raw, spoken input from an author describing plot points, world details, or character traits.
    
    TASK:
    1. Correct transcription errors (especially genre-specific terms like "qi", "dantian", "cultivation", "realms").
    2. Organize the thoughts into a logical, professionally structured paragraph or list.
    3. Maintain the specific genre jargon.
    4. Keep the output as ONLY the refined text, no preamble or conversation.

    RAW INPUT:
    "${rawText}"
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      temperature: 0.5,
    }
  });

  return response.text || rawText;
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
    contentExcerpt: string;
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
  const ai = getGeminiClient();

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
6) Scenes (break the chapter into logical scenes - typically 2-5 scenes per chapter)
7) Active Arc progress checklist

CRITICAL RULES:
- Prefer UPDATING existing entities rather than creating duplicates.
- For items/techniques: CHECK if an item/technique already exists before creating a new entry. Use fuzzy matching (e.g., "Jade Slip", "jade slip", "Jade-Slip" refer to the same item).
- If an item/technique exists but has new powers/functions, use "update" action with addPowers/addFunctions.
- When unsure, be conservative (fewer, higher-quality updates).
- Return ONLY valid JSON that matches the schema.

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
- Treasure: Magical artifacts, powerful items (e.g., "Jade Slip", "Sword of Heaven")
- Equipment: Tools, weapons, armor (e.g., "Iron Sword", "Storage Ring")
- Consumable: Food, pills, talismans, one-time use (e.g., "Healing Pill", "Spirit Fruit")
- Essential: Basic necessities (e.g., "dried meat", "water skin", "torch")

TECHNIQUE CATEGORIZATION GUIDE:
- Category: Core (fundamental), Important (significant), Standard (common), Basic (entry-level)
- Type: Cultivation (advancing realm), Combat (battle), Support (healing/utility), Secret (hidden), Other
- MasteryLevel: "Novice", "Intermediate", "Expert", "Master"

ITEMS/TECHNIQUES UPDATE LOGIC:
- If name matches existing (fuzzy match): use "update" action with addPowers/addFunctions
- If completely new: use "create" action with full details
- Always include category and characterName

ANTAGONIST EXTRACTION GUIDELINES:
- Identify ANY opposing forces, threats, or conflicts mentioned or hinted at in the chapter
- Check existing antagonists list FIRST - if an antagonist already exists, use "update" action
- Types: individual (single person), group (organization/faction), system (laws/rules), society (cultural), abstract (concept/force)
- Status: active (currently opposing), defeated (resolved), transformed (changed role), dormant (inactive but relevant), hinted (foreshadowed)
- Threat Level: low (minor obstacle), medium (significant challenge), high (major threat), extreme (existential danger)
- Duration Scope: chapter (single chapter), arc (one story arc), novel (entire novel), multi_arc (multiple arcs)
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
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              characterUpserts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    isNew: { type: Type.BOOLEAN },
                    set: {
                      type: Type.OBJECT,
                      properties: {
                        age: { type: Type.STRING },
                        personality: { type: Type.STRING },
                        currentCultivation: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        status: { type: Type.STRING },
                      },
                    },
                    addSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                    addItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                    relationships: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          targetName: { type: Type.STRING },
                          type: { type: Type.STRING },
                          history: { type: Type.STRING },
                          impact: { type: Type.STRING },
                        },
                        required: ["targetName", "type"]
                      }
                    },
                  },
                  required: ["name"]
                }
              },
              worldEntryUpserts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                  required: ["title", "category", "content"]
                }
              },
              territoryUpserts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ["name", "type", "description"]
                }
              },
              itemUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    action: { type: Type.STRING },
                    itemId: { type: Type.STRING },
                    category: { type: Type.STRING },
                    description: { type: Type.STRING },
                    addPowers: { type: Type.ARRAY, items: { type: Type.STRING } },
                    characterName: { type: Type.STRING },
                  },
                  required: ["name", "action", "category", "characterName"]
                }
              },
              techniqueUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    action: { type: Type.STRING },
                    techniqueId: { type: Type.STRING },
                    category: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                    addFunctions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    characterName: { type: Type.STRING },
                    masteryLevel: { type: Type.STRING },
                  },
                  required: ["name", "action", "category", "type", "characterName"]
                }
              },
              arcChecklistProgress: {
                type: Type.OBJECT,
                properties: {
                  arcId: { type: Type.STRING },
                  completedItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  notes: { type: Type.STRING },
                },
                required: ["arcId", "completedItemIds"]
              },
              antagonistUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    action: { type: Type.STRING },
                    antagonistId: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING },
                    motivation: { type: Type.STRING },
                    powerLevel: { type: Type.STRING },
                    status: { type: Type.STRING },
                    threatLevel: { type: Type.STRING },
                    durationScope: { type: Type.STRING },
                    presenceType: { type: Type.STRING },
                    significance: { type: Type.STRING },
                    relationshipWithProtagonist: {
                      type: Type.OBJECT,
                      properties: {
                        relationshipType: { type: Type.STRING },
                        intensity: { type: Type.STRING },
                      },
                    },
                    arcRole: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ["name", "action", "type", "status", "threatLevel", "durationScope"]
                }
              }
            },
            required: ["characterUpserts", "worldEntryUpserts", "territoryUpserts"]
          }
        }
      });

      // arcChecklistProgress is optional; if absent, treat as null.
      const parsed = JSON.parse(response.text || '{}');
      return {
        characterUpserts: parsed.characterUpserts || [],
        worldEntryUpserts: parsed.worldEntryUpserts || [],
        territoryUpserts: parsed.territoryUpserts || [],
        itemUpdates: parsed.itemUpdates || [],
        techniqueUpdates: parsed.techniqueUpdates || [],
        antagonistUpdates: parsed.antagonistUpdates || [],
        scenes: parsed.scenes || [],
        arcChecklistProgress: parsed.arcChecklistProgress ?? null,
      } as PostChapterExtraction;
    },
    `postchapter-extract-${state.id}-${newChapter.number}`
  );
};

export const processLoreDictation = async (rawText: string): Promise<{ title: string, content: string, category: string }> => {
  const ai = getGeminiClient();
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
    
    Return the result as JSON.
  `;

  return rateLimiter.queueRequest('refine', async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["title", "content", "category"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      return { title: 'Untitled Entry', content: rawText, category: 'Other' };
    }
  }, `lore-${rawText.substring(0, 50)}`);
};

export const generateCreativeExpansion = async (type: string, currentText: string, state: NovelState): Promise<string> => {
  const ai = getGeminiClient();
  try {
    // Use the new professional prompt system
    const builtPrompt = await buildExpansionPrompt(state, type, currentText);
    
    const response = await rateLimiter.queueRequest('refine', async () => {
      return await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: builtPrompt.userPrompt,
        config: {
          systemInstruction: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          temperature: 0.95,
          topP: 0.9,
        }
      });
    }, `expansion-${type}-${currentText.substring(0, 50)}`);

    const raw = response.text || currentText;
    // Defensive: Spark insights must be readable prose, never raw JSON.
    const text = (raw || '').trim();
    const fenceMatch = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
    const unfenced = (fenceMatch?.[1] ? fenceMatch[1] : text).trim();
    if ((unfenced.startsWith('{') && unfenced.endsWith('}')) || (unfenced.startsWith('[') && unfenced.endsWith(']'))) {
      try {
        const parsed = JSON.parse(unfenced);
        const candidate =
          (parsed && typeof parsed === 'object' && typeof parsed.content === 'string' && parsed.content) ||
          (parsed && typeof parsed === 'object' && typeof parsed.text === 'string' && parsed.text) ||
          (typeof parsed === 'string' ? parsed : null);
        if (candidate) return String(candidate).trim();
      } catch {
        // ignore
      }
    }
    return unfenced;
  } catch (error) {
    console.error('Error in generateCreativeExpansion:', error);
    return currentText;
  }
};

type ChapterGenPhase =
  | 'prompt_build_start'
  | 'prompt_build_end'
  | 'queue_estimate'
  | 'queue_dequeued'
  | 'gemini_request_start'
  | 'gemini_request_end'
  | 'parse_start'
  | 'parse_end';

export const generateNextChapter = async (
  state: NovelState,
  userInstruction: string = "",
  opts?: {
    onPhase?: (phase: ChapterGenPhase, data?: Record<string, unknown>) => void;
  }
) => {
  const ai = getGeminiClient();
  try {
    console.log('Building professional prompt for chapter generation...');
    opts?.onPhase?.('prompt_build_start');
    
    // Use the new professional prompt system
    const promptStart = Date.now();
    const builtPrompt = await buildChapterPrompt(state, userInstruction);
    const promptBuildMs = Date.now() - promptStart;
    opts?.onPhase?.('prompt_build_end', { promptBuildMs });
    
    // Log token estimate for monitoring
    if (process.env.NODE_ENV === 'development') {
      const { estimatePromptTokens, logTokenEstimate } = await import('./promptEngine/tokenEstimator');
      logTokenEstimate(builtPrompt, 'Chapter Generation');
      const est = estimatePromptTokens(builtPrompt);
      opts?.onPhase?.('prompt_build_end', { promptBuildMs, estimatedPromptTokens: est.totalTokens });
    }
    
    console.log('Context summary:', builtPrompt.contextSummary);
    console.log('Calling Gemini API to generate chapter...');

    const estimatedWaitMs = rateLimiter.getEstimatedWaitTime('generate');
    opts?.onPhase?.('queue_estimate', { estimatedWaitMs });
    
    let queueWaitMs: number | undefined;
    let requestDurationMs: number | undefined;
    const response = await rateLimiter.queueRequest('generate', async () => {
      opts?.onPhase?.('gemini_request_start');
      return await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: builtPrompt.userPrompt,
        config: {
          systemInstruction: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          // AI Detection Evasion: Higher temperature and topP for more human-like unpredictability
          temperature: 1.15,
          topP: 0.95,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              logicAudit: {
                type: Type.OBJECT,
                properties: {
                  startingValue: { type: Type.STRING },
                  theFriction: { type: Type.STRING },
                  theChoice: { type: Type.STRING },
                  resultingValue: { type: Type.STRING },
                  causalityType: { type: Type.STRING }
                },
                required: ["startingValue", "theFriction", "theChoice", "resultingValue", "causalityType"]
              },
              chapterTitle: { type: Type.STRING },
              chapterContent: { type: Type.STRING },
              chapterSummary: { type: Type.STRING },
              characterUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    updateType: { type: Type.STRING },
                    newValue: { type: Type.STRING },
                    targetName: { type: Type.STRING }
                  }
                }
              },
              worldUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    category: { type: Type.STRING },
                    isNewRealm: { type: Type.BOOLEAN }
                  }
                }
              },
              territoryUpdates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                }
              }
            },
            required: ["logicAudit", "chapterTitle", "chapterContent", "chapterSummary", "characterUpdates"]
          },
        },
      });
    }, `generate-${state.id}-${state.chapters.length + 1}`, {
      onDequeued: (info) => {
        queueWaitMs = info.queueWaitMs;
        opts?.onPhase?.('queue_dequeued', { queueWaitMs });
      },
      onFinished: (info) => {
        requestDurationMs = info.requestDurationMs;
      },
      onError: (info) => {
        console.warn('Gemini request failed in rate limiter', info);
      },
    });

    console.log('Received response from Gemini API');
    let responseText = response.text || '{}';
    const responseTextLength = responseText.length;
    opts?.onPhase?.('gemini_request_end', { responseTextLength, requestDurationMs, queueWaitMs });
    console.log('Response text length:', responseText.length);
    
    // Try to parse JSON with error recovery
    let parsed;
    const parseStart = Date.now();
    opts?.onPhase?.('parse_start');
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      const errorPos = parseError instanceof SyntaxError && 'position' in parseError 
        ? (parseError as SyntaxError & { position?: number }).position 
        : null;
      
      if (errorPos) {
        console.error(`Error at position ${errorPos}`);
        console.error('Context around error:', responseText.substring(Math.max(0, errorPos - 100), Math.min(responseText.length, errorPos + 100)));
      }
      
      // Try to extract what we can from the malformed JSON
      try {
        // Find the last complete JSON object by looking for closing braces
        let braceCount = 0;
        let lastValidPos = -1;
        for (let i = responseText.length - 1; i >= 0; i--) {
          if (responseText[i] === '}') braceCount++;
          if (responseText[i] === '{') braceCount--;
          if (braceCount === 0 && responseText[i] === '}') {
            lastValidPos = i;
            break;
          }
        }
        
        if (lastValidPos > 0) {
          // Try to find where chapterContent starts and extract it manually
          const contentMatch = responseText.match(/"chapterContent"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
          const titleMatch = responseText.match(/"chapterTitle"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
          const summaryMatch = responseText.match(/"chapterSummary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
          
          if (titleMatch && contentMatch) {
            console.warn('Attempting to extract data from malformed JSON');
            parsed = {
              logicAudit: {
                startingValue: "Extracted from partial response",
                theFriction: "JSON parsing encountered issues",
                theChoice: "Recovered partial chapter content",
                resultingValue: "Partial",
                causalityType: "Recovery"
              },
              chapterTitle: titleMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
              chapterContent: contentMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
              chapterSummary: summaryMatch ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "Summary unavailable",
              characterUpdates: [],
              worldUpdates: [],
              territoryUpdates: []
            };
            console.warn('Successfully extracted partial data from malformed JSON');
          } else {
            throw new Error('Could not extract chapter data from malformed JSON');
          }
        } else {
          throw new Error('Could not find valid JSON structure');
        }
      } catch (recoveryError) {
        console.error('Failed to recover from JSON error:', recoveryError);
        throw new Error(`Failed to parse API response. The response appears to be malformed JSON (possibly due to very long chapter content or special characters). Please try generating the chapter again. Original error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
    opts?.onPhase?.('parse_end', { parseMs: Date.now() - parseStart });
    
    // Validate required fields
    if (!parsed.chapterTitle || !parsed.chapterContent) {
      throw new Error('API response missing required fields (chapterTitle or chapterContent)');
    }
    
    // Format chapter content for professional structure and punctuation
    const originalContent = parsed.chapterContent;
    parsed.chapterContent = formatChapterContent(parsed.chapterContent);
    
    if (originalContent !== parsed.chapterContent) {
      console.log('Chapter content formatted: structure and punctuation improvements applied');
    }
    
    // Validate minimum word count (1500 words) - after formatting
    const wordCount = parsed.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;
    if (wordCount < 1500) {
      console.warn(`Generated chapter has only ${wordCount} words, which is below the 1500 word minimum.`);
      // Note: We'll still return it, but log a warning. The prompt should enforce this.
      // In production, you might want to retry or extend the content here.
    } else {
      console.log(`Chapter word count: ${wordCount} words (meets minimum requirement of 1500)`);
    }
    
    // Post-generation quality validation
    try {
      const generatedChapter: Chapter = {
        id: crypto.randomUUID(),
        number: state.chapters.length + 1,
        title: parsed.chapterTitle || 'Untitled',
        content: parsed.chapterContent || '',
        summary: parsed.chapterSummary || '',
        logicAudit: parsed.logicAudit as LogicAudit | undefined,
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
    
    console.log('Successfully parsed response');
    return parsed;
  } catch (error) {
    console.error('Error in generateNextChapter:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate chapter: ${error.message}`);
    }
    throw error;
  }
};

export const planArc = async (state: NovelState) => {
  const ai = getGeminiClient();
  try {
    // Use the new professional prompt system
    const builtPrompt = await buildArcPrompt(state);
    
    const response = await rateLimiter.queueRequest('plan', async () => {
      return await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: builtPrompt.userPrompt,
        config: {
          systemInstruction: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              arcTitle: { type: Type.STRING },
              arcDescription: { type: Type.STRING },
              targetChapters: { type: Type.NUMBER, description: "Optimal number of chapters for this arc based on complexity and scope (range: 5-30)" }
            },
            required: ["arcTitle", "arcDescription"]
          }
        }
      });
    }, `plan-arc-${state.id}`);

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Error in planArc:', error);
    throw error;
  }
};

export const generatePortrait = async (character: Character, worldContext: string) => {
  const ai = getGeminiClient();
  // Skip if portrait already exists
  if (character.portraitUrl) {
    return character.portraitUrl;
  }

  const prompt = `Xianxia portrait of ${character.name}. ${character.personality}, ${character.currentCultivation}. Style: Webnovel cover art, ethereal, epic.`;
  
  return rateLimiter.queueRequest('portrait', async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });
    if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  }, `portrait-${character.id}`);
};

export const reciteChapter = async (
  text: string,
  voiceName: string = 'Kore',
  maxChunkSize: number = 2000
): Promise<string> => {
  const ai = getGeminiClient();
  
  // If text is short enough, generate directly
  if (text.length <= maxChunkSize) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Dramatic narration: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
  }

  // For longer text, we'll need to chunk it
  // Note: This function now returns only the first chunk's audio
  // Full chunking and concatenation is handled by GeminiTTSProvider
  const chunk = text.slice(0, maxChunkSize);
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Dramatic narration: ${chunk}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
};

export const editChapter = async (chapterContent: string, instruction: string, state: NovelState, chapter: Chapter) => {
  const ai = getGeminiClient();
  // Skip if instruction is empty
  if (!instruction || instruction.trim().length === 0) {
    return chapterContent;
  }

  try {
    // Use the new professional prompt system
    const builtPrompt = await buildEditPrompt(state, chapter, instruction);
    
    // For very long chapters, only send beginning and end to save tokens
    // The AI can work with partial context for editing
    let contentToSend = chapterContent;
    if (chapterContent.length > 10000) {
      // For chapters over 10k chars, send first 4000 and last 2000 chars
      const firstPart = chapterContent.substring(0, 4000);
      const lastPart = chapterContent.substring(chapterContent.length - 2000);
      contentToSend = `${firstPart}\n\n[... middle section omitted for token efficiency ...]\n\n${lastPart}`;
    } else if (chapterContent.length > 5000) {
      // For chapters 5k-10k, send first 3000 and last 1500
      const firstPart = chapterContent.substring(0, 3000);
      const lastPart = chapterContent.substring(chapterContent.length - 1500);
      contentToSend = `${firstPart}\n\n[... middle section ...]\n\n${lastPart}`;
    }
    
    // Combine the prompt with the chapter content
    const fullPrompt = `${builtPrompt.userPrompt}\n\n[CHAPTER CONTENT TO EDIT]\n${contentToSend}`;
    
    return await rateLimiter.queueRequest('edit', async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: fullPrompt,
        config: { 
          systemInstruction: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          // AI Detection Evasion: Higher temperature for editing to catch and fix any remaining AI-like patterns
          temperature: 1.2,
          topP: 0.95,
        },
      });
      return response.text || chapterContent;
    }, `edit-${chapter.id}-${instruction.substring(0, 30)}`);
  } catch (error) {
    console.error('Error in editChapter:', error);
    return chapterContent;
  }
};
