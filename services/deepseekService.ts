import { env } from '../utils/env';
import { recordCacheHit, recordCacheMiss } from './promptCacheMonitor';

/**
 * DeepSeek Service - "The Writer"
 * 
 * DeepSeek-V3.2 is trained on a massive corpus of Chinese web fiction,
 * making it ideal for Xianxia/Xuanhuan novel generation. It natively
 * understands cultivation tropes like:
 *   - Dantian (energy center)
 *   - Tribulation Lightning
 *   - Jade Slips
 *   - Cultivation realms and breakthroughs
 *   - Sect politics and martial arts
 * 
 * This service handles all creative/narrative tasks:
 *   - Chapter generation
 *   - Arc/Saga planning
 *   - Creative expansion
 *   - Prose editing
 */

type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-v3.2';

type DeepSeekRole = 'system' | 'user' | 'assistant';

interface DeepSeekMessage {
  role: DeepSeekRole;
  content: string;
}

interface DeepSeekChatCompletionRequest {
  model: DeepSeekModel;
  messages: DeepSeekMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface DeepSeekChatCompletionResponse {
  choices?: Array<{
    index: number;
    message?: { role: DeepSeekRole; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

function getDeepSeekApiKey(): string {
  const key = env.deepseek.apiKey;
  if (!key) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Please set DEEPSEEK_API_KEY in your .env.local and restart.'
    );
  }
  return key;
}

/**
 * Simple hash function for generating cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

async function deepseekChat(request: DeepSeekChatCompletionRequest): Promise<{ text: string; usage?: DeepSeekChatCompletionResponse['usage'] }> {
  const apiKey = getDeepSeekApiKey();

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`DeepSeek API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as DeepSeekChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  return {
    text: content ?? '',
    usage: data.usage
  };
}

/**
 * Generate text using DeepSeek-V3.2 ("The Writer")
 * 
 * Optimized for creative prose generation, especially Xianxia/Xuanhuan content.
 * DeepSeek-V3.2 has:
 *   - 128K token context window
 *   - Native understanding of Chinese web fiction tropes
 *   - Excellent narrative consistency
 */
export async function deepseekText(opts: {
  model?: DeepSeekModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<string> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system && opts.system.trim() !== '') messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.user });

  // Default to deepseek-chat which uses the latest V3.2 model
  const model = opts.model || 'deepseek-chat';

  // DeepSeek-V3.2 supports up to 8192 output tokens
  const maxTokens = opts.maxTokens ? Math.min(opts.maxTokens, 8192) : undefined;

  const result = await deepseekChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
  });

  // Track cache usage
  if (result.usage) {
    const cacheHit = result.usage.prompt_cache_hit_tokens || 0;
    const totalPromptTokens = result.usage.prompt_tokens;
    const cacheKey = `deepseek:${model}:${simpleHash(opts.user.substring(0, 500))}`;

    if (cacheHit > 0) {
      recordCacheHit('deepseek', cacheKey, cacheHit, totalPromptTokens);
    } else {
      recordCacheMiss('deepseek', cacheKey, totalPromptTokens);
    }
  }

  return result.text;
}

/**
 * Strips markdown code blocks from JSON response
 */
function stripMarkdownCodeBlocks(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text.trim();

  // First, try to match complete markdown code blocks with language identifier
  const completeJsonBlock = /^```\s*json\s*\n?([\s\S]*?)\n?```\s*$/i;
  if (completeJsonBlock.test(cleaned)) {
    const match = cleaned.match(completeJsonBlock);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Try generic code block pattern
  const completeCodeBlock = /^```\s*\n?([\s\S]*?)\n?```\s*$/;
  if (completeCodeBlock.test(cleaned)) {
    const match = cleaned.match(completeCodeBlock);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback removals
  if (/^```json/i.test(cleaned)) {
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
  } else if (/^```/.test(cleaned)) {
    cleaned = cleaned.replace(/^```\s*\n?/, '');
  }

  cleaned = cleaned.replace(/\s*\n?```\s*$/, '');
  cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '');

  return cleaned.trim();
}

/**
 * Fixes control characters in JSON strings
 */
function fixControlCharacters(jsonString: string): string {
  return jsonString.replace(/([^\\]|^)([\x00-\x1F\x7F])/g, (match, prefix, char) => {
    if (prefix === '\\') return match;
    const code = char.charCodeAt(0);
    if (code === 0x0A) return prefix + '\\n';
    if (code === 0x0D) return prefix + '\\r';
    if (code === 0x09) return prefix + '\\t';
    return prefix + '\\u' + ('0000' + code.toString(16)).slice(-4);
  });
}

/**
 * Fixes common JSON issues like trailing commas
 */
function fixCommonJsonIssues(jsonString: string): string {
  let fixed = jsonString;
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  fixed = fixed.replace(/,(\s*])/g, '$1');

  try {
    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        if (!inString) {
          inString = true;
          result += char;
        } else {
          const rest = fixed.substring(i + 1).trim();
          if (rest.startsWith(',') || rest.startsWith('}') || rest.startsWith(']') ||
            rest.startsWith(':') || i === fixed.length - 1) {
            inString = false;
            result += char;
          } else {
            result += '\\"';
          }
        }
      } else {
        result += char;
      }
    }
    return result;
  } catch (e) {
    return fixed;
  }
}

/**
 * Attempts to fix truncated JSON by closing unclosed strings and brackets
 * More robust version that handles edge cases better
 */
function tryFixTruncatedJson(jsonString: string): string {
  let fixed = jsonString.trim();

  if (!fixed || fixed.length === 0) {
    return '{}';
  }

  // If it doesn't end with }, try to close it
  if (!fixed.endsWith('}') && !fixed.endsWith(']')) {
    // Count unclosed brackets and strings
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;
    let lastStringStart = -1;
    let lastSafePosition = -1; // Last position where we had complete fix entries
    let fixesArrayStart = -1;

    // Find the fixes array if it exists
    const fixesArrayMatch = fixed.match(/"fixes"\s*:\s*\[/);
    if (fixesArrayMatch) {
      fixesArrayStart = fixesArrayMatch.index! + fixesArrayMatch[0].length;
    }

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        if (!inString) {
          lastStringStart = i;
        }
        inString = !inString;

        // If we're closing a string, mark this as a safe position if we're past the fixes array
        if (!inString && fixesArrayStart > 0 && i > fixesArrayStart) {
          // Check if we just closed a fix object
          const beforeString = fixed.substring(Math.max(0, i - 50), i);
          if (beforeString.includes('"reason"') || beforeString.includes('"fixedText"')) {
            // Look ahead to see if we have a complete fix entry
            let j = i + 1;
            while (j < fixed.length && (fixed[j] === ' ' || fixed[j] === '\n' || fixed[j] === '\r' || fixed[j] === '\t')) {
              j++;
            }
            if (j < fixed.length && fixed[j] === '}') {
              // We have a complete fix entry, mark this as safe
              lastSafePosition = j + 1;
            }
          }
        }
        continue;
      }

      if (inString) continue;

      if (char === '{') openBraces++;
      if (char === '}') {
        openBraces--;
        // Mark complete objects as safe positions if in fixes array
        if (fixesArrayStart > 0 && i > fixesArrayStart && openBraces >= 1) {
          lastSafePosition = i + 1;
        }
      }
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // If we're in a string and it's very long (likely truncated chapter content)
    if (inString && fixesArrayStart > 0 && lastStringStart > fixesArrayStart) {
      const stringLength = fixed.length - lastStringStart;
      // If string is longer than 1000 chars, it's likely truncated chapter content
      if (stringLength > 1000) {
        // Try to find the last complete fix entry before the truncated one
        if (lastSafePosition > 0 && lastSafePosition < fixed.length && lastSafePosition > fixesArrayStart) {
          console.warn('[JSON Repair] Detected truncated long string in fixes array. Removing incomplete fix entry.');
          fixed = fixed.substring(0, lastSafePosition);

          // Ensure proper JSON structure
          fixed = fixed.trim();

          // Remove trailing comma if present
          while (fixed.endsWith(',') || fixed.endsWith(' ')) {
            fixed = fixed.slice(0, -1).trim();
          }

          // Close the fixes array if needed
          if (!fixed.endsWith(']')) {
            // Check if we're inside the fixes array by counting brackets
            let bracketDepth = 0;
            for (let i = fixesArrayStart; i < fixed.length; i++) {
              if (fixed[i] === '[') bracketDepth++;
              if (fixed[i] === ']') bracketDepth--;
            }
            if (bracketDepth > 0) {
              fixed += ']';
            }
          }

          // Close the main object if needed
          if (!fixed.endsWith('}')) {
            fixed += '}';
          }
        } else {
          // No safe position found - try to find last complete fix object
          // Look backwards for a complete fix entry pattern: ..."reason":"..."}
          const lastCompleteFixMatch = fixed.substring(fixesArrayStart).match(/("reason"\s*:\s*"[^"]*")\s*}/g);
          if (lastCompleteFixMatch && lastCompleteFixMatch.length > 0) {
            const lastMatch = lastCompleteFixMatch[lastCompleteFixMatch.length - 1];
            const matchEnd = fixed.indexOf(lastMatch) + lastMatch.length;
            if (matchEnd < fixed.length) {
              fixed = fixed.substring(0, matchEnd);
              // Ensure proper closing
              if (!fixed.endsWith(']')) fixed += ']';
              if (!fixed.endsWith('}')) fixed += '}';
              inString = false;
            } else {
              // Just close the string at a reasonable point
              const searchStart = Math.max(lastStringStart, fixed.length - 500);
              const searchArea = fixed.substring(searchStart);
              // Look for sentence boundaries (period + space or escaped newline)
              const lastPeriod = searchArea.lastIndexOf('. ');
              const lastNewline = searchArea.lastIndexOf('\\n');
              const cutPoint = Math.max(lastPeriod, lastNewline);

              if (cutPoint > 50) {
                fixed = fixed.substring(0, searchStart + cutPoint + (cutPoint === lastPeriod ? 1 : 2));
                fixed += '"';
                inString = false;
              } else {
                // Just close it - might lose some data but better than invalid JSON
                if (fixed.endsWith('\\')) {
                  fixed = fixed.slice(0, -1);
                }
                fixed += '"';
                inString = false;
              }
            }
          } else {
            // No complete fix found - close string at reasonable point
            const searchStart = Math.max(lastStringStart, fixed.length - 500);
            const searchArea = fixed.substring(searchStart);
            const lastPeriod = searchArea.lastIndexOf('. ');
            const lastNewline = searchArea.lastIndexOf('\\n');
            const cutPoint = Math.max(lastPeriod, lastNewline);

            if (cutPoint > 50) {
              fixed = fixed.substring(0, searchStart + cutPoint + (cutPoint === lastPeriod ? 1 : 2));
              fixed += '"';
              inString = false;
            } else {
              // Just close it
              if (fixed.endsWith('\\')) {
                fixed = fixed.slice(0, -1);
              }
              fixed += '"';
              inString = false;
            }
          }
        }
      } else {
        // Short string (< 1000 chars), try to close it properly
        // Look for sentence boundary in last 200 chars
        const searchStart = Math.max(lastStringStart, fixed.length - 200);
        const searchArea = fixed.substring(searchStart);
        const lastPeriod = searchArea.lastIndexOf('. ');
        const lastNewline = searchArea.lastIndexOf('\\n');
        const cutPoint = Math.max(lastPeriod, lastNewline);

        if (cutPoint > 20) {
          fixed = fixed.substring(0, searchStart + cutPoint + (cutPoint === lastPeriod ? 1 : 2));
          fixed += '"';
          inString = false;
        } else {
          // Just close it
          if (fixed.endsWith('\\')) {
            fixed = fixed.slice(0, -1);
          }
          fixed += '"';
          inString = false;
        }
      }
    } else if (inString) {
      // We're in a string but it's not in the fixes array
      // Try to find a sentence boundary
      const searchStart = Math.max(0, fixed.length - 300);
      const searchArea = fixed.substring(searchStart);
      const lastPeriod = searchArea.lastIndexOf('. ');
      const lastNewline = searchArea.lastIndexOf('\\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);

      if (cutPoint > 20) {
        fixed = fixed.substring(0, searchStart + cutPoint + (cutPoint === lastPeriod ? 1 : 2));
        fixed += '"';
        inString = false;
      } else {
        // Just close it
        if (fixed.endsWith('\\')) {
          fixed = fixed.slice(0, -1);
        }
        fixed += '"';
        inString = false;
      }
    }

    // Close arrays first (they're inside objects)
    while (openBrackets > 0) {
      fixed += ']';
      openBrackets--;
    }

    // Close objects
    while (openBraces > 0) {
      fixed += '}';
      openBraces--;
    }
  }

  return fixed;
}

/**
 * Attempts to extract partial JSON data from a malformed response
 * This is a fallback when the JSON is too corrupted to fix
 */
function tryExtractPartialJson<T>(jsonString: string): Partial<T> | null {
  try {
    // Strategy 1: Try to find where the fixes array starts and cut before it if truncated
    const fixesArrayMatch = jsonString.match(/"fixes"\s*:\s*\[/);
    if (fixesArrayMatch) {
      const fixesArrayStart = fixesArrayMatch.index! + fixesArrayMatch[0].length;

      // Check if we're in a truncated string within the fixes array
      // If so, try to extract everything before the fixes array and create an empty fixes array
      const beforeFixes = jsonString.substring(0, fixesArrayStart);

      // Try to find the last complete property before fixes array
      let lastCompletePos = -1;
      for (let i = beforeFixes.length - 1; i >= 0; i--) {
        if (beforeFixes[i] === '}') {
          // Found a complete object, check if it's part of issues array
          let depth = 0;
          let foundIssuesStart = false;
          for (let j = i; j >= 0; j--) {
            if (beforeFixes[j] === ']') depth++;
            if (beforeFixes[j] === '[') {
              depth--;
              if (depth === 0) {
                // Check if this is the issues array
                const beforeBracket = beforeFixes.substring(Math.max(0, j - 20), j);
                if (beforeBracket.includes('"issues"')) {
                  foundIssuesStart = true;
                  lastCompletePos = i + 1;
                  break;
                }
              }
            }
            if (depth < 0) break;
          }
          if (foundIssuesStart) break;
        }
      }

      // If we found a good cut point, try to reconstruct
      if (lastCompletePos > 0) {
        const partialJson = jsonString.substring(0, lastCompletePos).trim();
        // Remove trailing comma if present
        const cleaned = partialJson.endsWith(',') ? partialJson.slice(0, -1) : partialJson;

        // Try to add empty fixes array and readiness object if missing
        let reconstructed = cleaned;
        if (!reconstructed.includes('"fixes"')) {
          reconstructed += ',\n  "fixes": []';
        }
        if (!reconstructed.includes('"readiness"')) {
          reconstructed += ',\n  "readiness": {\n    "isReadyForRelease": false,\n    "blockingIssues": [],\n    "suggestedImprovements": []\n  }';
        }
        if (!reconstructed.endsWith('}')) {
          reconstructed += '\n}';
        }

        const fixed = tryFixTruncatedJson(reconstructed);
        return JSON.parse(fixed) as Partial<T>;
      }
    }

    // Strategy 2: Try to find the last complete object/array before the error
    // Look for patterns like: "key": "value" or "key": [ ... ] or "key": { ... }

    // Find the last complete property before truncation
    const lastCompleteMatch = jsonString.match(/"([^"]+)":\s*("[^"]*"|\[[^\]]*\]|\{[^}]*\})/g);
    if (lastCompleteMatch && lastCompleteMatch.length > 0) {
      // Try to reconstruct a minimal valid JSON
      const lastComplete = lastCompleteMatch[lastCompleteMatch.length - 1];
      const beforeLast = jsonString.substring(0, jsonString.lastIndexOf(lastComplete) + lastComplete.length);

      // Try to close it properly
      const fixed = tryFixTruncatedJson(beforeLast);
      return JSON.parse(fixed) as Partial<T>;
    }

    // Strategy 3: Try to extract just the analysis section if it exists
    const analysisMatch = jsonString.match(/"analysis"\s*:\s*(\{[^}]*\})/);
    if (analysisMatch) {
      try {
        const analysisStr = analysisMatch[1];
        const analysis = JSON.parse(analysisStr);
        return {
          analysis,
          issues: [],
          fixes: [],
          readiness: {
            isReadyForRelease: false,
            blockingIssues: [],
            suggestedImprovements: []
          }
        } as unknown as Partial<T>;
      } catch (e) {
        // Analysis parsing failed, continue
      }
    }
  } catch (e) {
    // Extraction failed, return null
  }

  return null;
}

/**
 * Generate JSON using DeepSeek-V3.2 ("The Writer")
 * 
 * Returns structured JSON responses, with robust error handling
 * for truncated or malformed responses.
 */
export async function deepseekJson<T>(opts: {
  model?: DeepSeekModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<T> {
  const messages: DeepSeekMessage[] = [];
  if (opts.system && opts.system.trim() !== '') messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: opts.user });

  // Default to deepseek-chat which uses the latest V3.2 model
  const model = opts.model || 'deepseek-chat';

  // DeepSeek-V3.2 supports up to 8192 output tokens
  const maxTokens = opts.maxTokens ? Math.min(opts.maxTokens, 8192) : 8192;

  const result = await deepseekChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  const rawResponse = result.text;

  // Track cache usage
  if (result.usage) {
    const cacheHit = result.usage.prompt_cache_hit_tokens || 0;
    const totalPromptTokens = result.usage.prompt_tokens;
    const cacheKey = `deepseek:${model}:${simpleHash(opts.user.substring(0, 500))}`;

    if (cacheHit > 0) {
      recordCacheHit('deepseek', cacheKey, cacheHit, totalPromptTokens);
    } else {
      recordCacheMiss('deepseek', cacheKey, totalPromptTokens);
    }
  }

  // Strip markdown, fix control characters, and common issues
  const trimmedRaw = rawResponse.trim();

  // First, try to parse raw as-is (DeepSeek in json_object mode is often perfect)
  try {
    return JSON.parse(trimmedRaw) as T;
  } catch (rawError) {
    // If raw fails, try stripping markdown code blocks
    let cleaned = stripMarkdownCodeBlocks(rawResponse);

    try {
      return JSON.parse(cleaned) as T;
    } catch (stripError) {
      // If still fails, try fixing control characters and common issues
      cleaned = fixControlCharacters(cleaned);
      cleaned = fixCommonJsonIssues(cleaned);

      try {
        return JSON.parse(cleaned) as T;
      } catch (e) {
        // Try to fix truncated JSON
        try {
          const fixed = tryFixTruncatedJson(cleaned);
          const parsed = JSON.parse(fixed) as T;

          // Log a warning if we had to fix the JSON
          console.warn('[DeepSeek] JSON response was truncated and required fixing. Consider increasing maxTokens or reducing response size.');

          return parsed;
        } catch (fixError) {
          // Try to extract partial data as last resort
          const partial = tryExtractPartialJson<T>(rawResponse);
          if (partial) {
            console.warn('[DeepSeek] JSON was severely corrupted. Returning partial data. Some fields may be missing.');
            return partial as unknown as T;
          }

          // If all else fails, throw with detailed error
          const posMatch = e instanceof Error ? e.message.match(/position (\d+)/) : null;
          const errorPositionStr = posMatch ? posMatch[1] : 'unknown';
          const errorPosition = errorPositionStr !== 'unknown' ? parseInt(errorPositionStr, 10) : null;

          const preview = errorPosition !== null
            ? rawResponse.substring(Math.max(0, errorPosition - 100), errorPosition + 100)
            : rawResponse.substring(0, 500);

          // Detect if this is likely a truncation issue (response ends mid-string/object)
          const isLikelyTruncation = rawResponse.length > 30000 ||
            (errorPosition !== null && errorPosition > rawResponse.length * 0.95) ||
            (!rawResponse.endsWith('}') && !rawResponse.endsWith(']'));

          let suggestion = '';
          if (isLikelyTruncation) {
            suggestion = `\n\nSUGGESTION: This appears to be a response truncation issue. The response was cut off at ${rawResponse.length} characters. ` +
              `This commonly happens when analyzing too many chapters at once (typically more than 5 chapters). ` +
              `Try analyzing smaller batches of chapters (3-5 chapters at a time) to avoid truncation.`;
          }

          throw new Error(
            `DeepSeek returned invalid JSON.\n` +
            `Parse error: ${e instanceof Error ? e.message : String(e)}\n` +
            `Attempted fix also failed: ${fixError instanceof Error ? fixError.message : String(fixError)}\n` +
            `Response length: ${rawResponse.length} characters\n` +
            `Preview around error: ...${preview}...${suggestion}\n\n` +
            `Full response (first 2000 chars):\n${rawResponse.substring(0, 2000)}...`
          );
        }
      }
    }
  }
}
