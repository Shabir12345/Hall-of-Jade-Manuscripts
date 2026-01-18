import { env } from '../utils/env';
import { recordCacheHit, recordCacheMiss } from './promptCacheMonitor';

type GeminiModel = 'gemini-1.5-flash' | 'gemini-2.0-flash' | 'gemini-2.0-flash-001' | 'gemini-2.5-flash';

interface GeminiContent {
  parts: Array<{ text: string }>;
  role?: string;
}

interface GeminiChatCompletionRequest {
  contents: GeminiContent[];
  systemInstruction?: string | { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiChatCompletionResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number; // Tokens served from cache
  };
  error?: {
    message: string;
    code: number;
  };
}

function getGeminiApiKey(): string {
  const key = env.gemini.apiKey;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please set GEMINI_API_KEY in your .env.local and restart.'
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

async function geminiChat(
  request: GeminiChatCompletionRequest,
  model: GeminiModel
): Promise<{ text: string; cachedTokens?: number }> {
  const apiKey = getGeminiApiKey();

  // Gemini API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as GeminiChatCompletionResponse;
  
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cachedTokens = data.usageMetadata?.cachedContentTokenCount;
  
  return {
    text: textContent,
    cachedTokens,
  };
}

export async function geminiText(opts: {
  model?: GeminiModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
}): Promise<string> {
  // Gemini 2.0 Flash is the default (latest stable version)
  const model = opts.model || 'gemini-2.0-flash';
  
  // For implicit caching: static content first, dynamic content last
  // Gemini will automatically cache the prefix if it matches previous requests
  let userContent: string;
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Structure: cacheable content first, then dynamic content
    userContent = opts.cacheMetadata.cacheableContent;
    if (opts.cacheMetadata.dynamicContent) {
      userContent += '\n\n' + opts.cacheMetadata.dynamicContent;
    }
  } else {
    // Fallback to single content if no cache metadata
    userContent = opts.user;
  }
  
  const contents: GeminiContent[] = [
    {
      parts: [{ text: userContent }],
    },
  ];

  // Gemini 2.0 Flash has 1M token input context window and 8,192 token output limit
  // Default to maximum output tokens to prevent truncation of large JSON responses
  const maxOutputTokens = opts.maxTokens || 8192;
  
  const request: GeminiChatCompletionRequest = {
    contents,
    systemInstruction: opts.system ? {
      parts: [{ text: opts.system }]
    } : undefined,
    generationConfig: {
      temperature: opts.temperature,
      topP: opts.topP,
      maxOutputTokens: Math.min(maxOutputTokens, 8192), // Gemini 2.0 Flash API maximum (8,192 tokens) // Gemini 2.0 Flash API maximum
    },
  };

  const result = await geminiChat(request, model);
  
  // Track cache usage (Gemini provides cachedContentTokenCount in response)
  const totalTokens = Math.ceil(userContent.length / 4); // Rough estimate
  if (result.cachedTokens && result.cachedTokens > 0) {
    // Cache hit
    recordCacheHit('gemini', `gemini:${model}:${simpleHash(userContent.substring(0, 500))}`, result.cachedTokens, totalTokens);
    console.log(`[Gemini] Cache hit: ${result.cachedTokens} tokens served from cache`);
  } else if (opts.cacheMetadata) {
    // Cache miss (we tried to use cache but didn't get cached tokens)
    recordCacheMiss('gemini', `gemini:${model}:${simpleHash(userContent.substring(0, 500))}`, totalTokens);
  }
  
  return result.text;
}

/**
 * Strips markdown code blocks from JSON response
 * Handles both ```json ... ``` and ``` ... ``` formats, including multiline
 */
function stripMarkdownCodeBlocks(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let cleaned = text.trim();
  
  // First, try to match complete markdown code blocks with language identifier
  // Pattern: ```json\n...``` or ```json ...```
  const completeJsonBlock = /^```\s*json\s*\n?([\s\S]*?)\n?```\s*$/i;
  if (completeJsonBlock.test(cleaned)) {
    const match = cleaned.match(completeJsonBlock);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Try generic code block pattern: ```\n...```
  const completeCodeBlock = /^```\s*\n?([\s\S]*?)\n?```\s*$/;
  if (completeCodeBlock.test(cleaned)) {
    const match = cleaned.match(completeCodeBlock);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: Remove opening ```json or ``` at start
  if (/^```json/i.test(cleaned)) {
    cleaned = cleaned.replace(/^```json\s*\n?/i, '');
  } else if (/^```/.test(cleaned)) {
    cleaned = cleaned.replace(/^```\s*\n?/, '');
  }
  
  // Remove closing ``` at end
  cleaned = cleaned.replace(/\s*\n?```\s*$/, '');
  
  // Also handle cases where there might be extra backticks or newlines
  cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '');
  
  return cleaned.trim();
}

/**
 * Fixes control characters in JSON strings by escaping them
 */
function fixControlCharacters(jsonString: string): string {
  // Replace unescaped control characters (except already escaped ones)
  return jsonString.replace(/([^\\]|^)([\x00-\x1F\x7F])/g, (match, prefix, char) => {
    // Skip if it's already escaped
    if (prefix === '\\') return match;
    
    // Escape the control character
    const code = char.charCodeAt(0);
    if (code === 0x0A) return prefix + '\\n'; // \n
    if (code === 0x0D) return prefix + '\\r'; // \r
    if (code === 0x09) return prefix + '\\t'; // \t
    // For other control characters, use \uXXXX format
    return prefix + '\\u' + ('0000' + code.toString(16)).slice(-4);
  });
}

/**
 * Fixes common JSON issues like unescaped quotes, trailing commas
 */
function fixCommonJsonIssues(jsonString: string): string {
  let fixed = jsonString;
  
  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Remove trailing commas in arrays
  fixed = fixed.replace(/,(\s*])/g, '$1');
  
  // Fix common pattern: missing comma between properties
  // Pattern: "key": value" (missing comma)
  fixed = fixed.replace(/("(?:[^"\\]|\\.)*"\s*:\s*[^,}\]]+?)("(?:[^"\\]|\\.)*"\s*:)/g, '$1,$2');
  
  // Try to fix unescaped quotes in string values by using a more careful parser
  // Look for patterns like: "key": "value with "unclosed quote"
  // This regex finds string values that might have issues
  // We'll be conservative and only fix obvious cases
  try {
    // Fix pattern: "text "more text" - where quotes inside strings aren't escaped
    // This pattern looks for: "key": "value with "problematic quote"
    // The fix: escape quotes that appear to be inside string values
    let result = '';
    let inString = false;
    let escapeNext = false;
    let depth = 0; // Track object/array depth
    
    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];
      const nextChars = fixed.substring(i, Math.min(i + 5, fixed.length));
      
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
        // Check if this starts or ends a string
        if (!inString) {
          // Starting a string
          inString = true;
          result += char;
        } else {
          // Could be end of string - check if followed by structural chars
          // If next non-whitespace char is : , } ], it's likely string end
          const rest = fixed.substring(i + 1).trim();
          if (rest.startsWith(',') || rest.startsWith('}') || rest.startsWith(']') || 
              rest.startsWith(':') || i === fixed.length - 1) {
            // End of string
            inString = false;
            result += char;
          } else {
            // Likely unescaped quote in string - escape it
            result += '\\"';
          }
        }
      } else {
        if (!inString) {
          // Track depth for objects/arrays
          if (char === '{' || char === '[') depth++;
          if (char === '}' || char === ']') depth--;
        }
        result += char;
      }
    }
    
    // If still in string at end, try to close it (but this might indicate truncation)
    if (inString && depth === 0) {
      result += '"';
    }
    
    return result;
  } catch (e) {
    // If fix fails, return original
    return fixed;
  }
}

/**
 * Attempts to fix truncated JSON by closing unclosed strings and brackets
 */
function tryFixTruncatedJson(jsonString: string): string {
  let fixed = jsonString.trim();
  
  if (!fixed || fixed.length === 0) {
    return '{}';
  }
  
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;
  let lastStringStart = -1;
  
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
      continue;
    }
    
    if (inString) continue;
    
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }
  
  // If we're still in a string, close it
  if (inString && lastStringStart >= 0) {
    // Find the position where the string should end (before any trailing content)
    // Just close it at the end
    fixed += '"';
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
  
  return fixed;
}

export async function geminiJson<T>(opts: {
  model?: GeminiModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
}): Promise<T> {
  const model = opts.model || 'gemini-2.0-flash';
  const maxOutputTokens = opts.maxTokens || 8192;
  
  // For implicit caching: static content first, dynamic content last
  let userContent: string;
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Structure: cacheable content first, then dynamic content + JSON instruction
    userContent = opts.cacheMetadata.cacheableContent;
    const dynamicContent = opts.cacheMetadata.dynamicContent || '';
    const jsonInstruction = '\n\nReturn ONLY a JSON object. No markdown, no code fences, just valid JSON.';
    userContent += '\n\n' + dynamicContent + jsonInstruction;
  } else {
    // Fallback to single content with JSON instruction if no cache metadata
    userContent = opts.user + '\n\nReturn ONLY a JSON object. No markdown, no code fences, just valid JSON.';
  }
  
  const contents: GeminiContent[] = [
    {
      parts: [{ text: userContent }],
    },
  ];

  const request: GeminiChatCompletionRequest = {
    contents,
    systemInstruction: opts.system ? {
      parts: [{ text: opts.system }]
    } : undefined,
    generationConfig: {
      temperature: opts.temperature,
      topP: opts.topP,
      maxOutputTokens: Math.min(maxOutputTokens, 8192), // Gemini 2.0 Flash API maximum (8,192 tokens)
    },
  };

  const result = await geminiChat(request, model);
  const raw = result.text;
  
  // Track cache usage (Gemini provides cachedContentTokenCount in response)
  const totalTokens = Math.ceil(userContent.length / 4); // Rough estimate
  if (result.cachedTokens && result.cachedTokens > 0) {
    // Cache hit
    recordCacheHit('gemini', `gemini:${model}:${simpleHash(userContent.substring(0, 500))}`, result.cachedTokens, totalTokens);
    console.log(`[Gemini] Cache hit: ${result.cachedTokens} tokens served from cache`);
  } else if (opts.cacheMetadata) {
    // Cache miss (we tried to use cache but didn't get cached tokens)
    recordCacheMiss('gemini', `gemini:${model}:${simpleHash(userContent.substring(0, 500))}`, totalTokens);
  }

  // Strip markdown code blocks if present
  let cleaned = stripMarkdownCodeBlocks(raw);
  
  // Try to extract JSON from text if it's embedded
  // Use non-greedy match first, then greedy if needed
  let jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
  if (!jsonMatch || jsonMatch[0] === cleaned) {
    // Try greedy match if non-greedy didn't find a complete JSON object
    jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  }
  if (jsonMatch && jsonMatch[0] && jsonMatch[0] !== cleaned) {
    cleaned = jsonMatch[0];
  }

  // First, try to parse cleaned JSON
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    // Try fixing common JSON issues (unescaped quotes, trailing commas, etc.)
    try {
      const fixedCommon = fixCommonJsonIssues(cleaned);
      return JSON.parse(fixedCommon) as T;
    } catch (commonError) {
      // Try fixing control characters
      try {
        const fixedControl = fixControlCharacters(cleaned);
        return JSON.parse(fixedControl) as T;
      } catch (controlError) {
        // Try fixing common issues AND control characters
        try {
          const fixedCommon = fixCommonJsonIssues(cleaned);
          const fixedControl = fixControlCharacters(fixedCommon);
          return JSON.parse(fixedControl) as T;
        } catch (combinedError) {
          // Try to fix truncated JSON
          try {
            const fixed = tryFixTruncatedJson(cleaned);
            const parsed = JSON.parse(fixed) as T;
            
            console.warn('[Gemini] JSON response required fixing. Consider increasing maxTokens or reducing response size.');
            
            return parsed;
          } catch (fixError) {
            // Last attempt: fix control characters, common issues, AND truncation
            try {
              const fixedCommon = fixCommonJsonIssues(cleaned);
              const fixedControl = fixControlCharacters(fixedCommon);
              const fixed = tryFixTruncatedJson(fixedControl);
              const parsed = JSON.parse(fixed) as T;
              
              console.warn('[Gemini] JSON response required extensive fixing. Consider increasing maxTokens or reducing response size.');
              
              return parsed;
            } catch (finalError) {
              // Try to extract a valid JSON object by finding the largest valid substring
              try {
                // Find all potential JSON object boundaries
                const jsonObjects: string[] = [];
                let depth = 0;
                let start = -1;
                
                for (let i = 0; i < cleaned.length; i++) {
                  if (cleaned[i] === '{') {
                    if (depth === 0) start = i;
                    depth++;
                  } else if (cleaned[i] === '}') {
                    depth--;
                    if (depth === 0 && start >= 0) {
                      const candidate = cleaned.substring(start, i + 1);
                      try {
                        JSON.parse(candidate);
                        jsonObjects.push(candidate);
                      } catch {
                        // Not valid JSON
                      }
                      start = -1;
                    }
                  }
                }
                
                if (jsonObjects.length > 0) {
                  // Try the largest valid JSON object
                  jsonObjects.sort((a, b) => b.length - a.length);
                  return JSON.parse(jsonObjects[0]) as T;
                }
              } catch {
                // Fall through to error
              }
              
              throw new Error(
                `Gemini returned invalid JSON.\n` +
                `Parse error: ${e instanceof Error ? e.message : String(e)}\n` +
                `Attempted fixes also failed.\n` +
                `Response length: ${raw.length} characters\n` +
                `Preview (first 500 chars):\n${raw.substring(0, 500)}...`
              );
            }
          }
        }
      }
    }
  }
}
