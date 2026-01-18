import { env } from '../utils/env';

type ClaudeModel = 'claude-sonnet-4-5-20250929' | 'claude-sonnet-4-5' | 'claude-3-5-sonnet-20241022' | 'claude-3-7-sonnet-20250219';

type ClaudeRole = 'user' | 'assistant';

interface ClaudeMessage {
  role: ClaudeRole;
  content: string;
  cache_control?: {
    type: 'ephemeral';
    ttl?: string; // Optional: '1h' for 1-hour cache (beta feature)
  };
}

interface ClaudeChatCompletionRequest {
  model: ClaudeModel;
  messages: ClaudeMessage[];
  system?: string;
  system_cache_control?: {
    type: 'ephemeral';
    ttl?: string;
  };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

interface ClaudeChatCompletionResponse {
  content?: Array<{
    type: string;
    text?: string;
  }>;
  stop_reason?: string;
}

// Proxy server URL - defaults to localhost:3001
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';
const USE_PROXY = import.meta.env.VITE_USE_CLAUDE_PROXY !== 'false'; // Default to true

function getClaudeApiKey(): string {
  const key = env.anthropic.apiKey;
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Please set ANTHROPIC_API_KEY in your .env.local and restart.'
    );
  }
  return key;
}

async function claudeChat(request: ClaudeChatCompletionRequest): Promise<string> {
  // Use proxy server to bypass CORS restrictions
  if (USE_PROXY) {
    try {
      const res = await fetch(`${PROXY_URL}/api/claude/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(`Claude API error (${res.status}): ${errorData.error || res.statusText}`);
      }

      const data = (await res.json()) as ClaudeChatCompletionResponse;
      const textContent = data.content?.find(c => c.type === 'text')?.text;
      return textContent ?? '';
    } catch (error) {
      // If proxy fails, check if it's a connection error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Cannot connect to proxy server at ${PROXY_URL}. ` +
          `Make sure the backend server is running with: npm run server`
        );
      }
      throw error;
    }
  }

  // Fallback to direct API call (will fail due to CORS in browser)
  const apiKey = getClaudeApiKey();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Claude API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as ClaudeChatCompletionResponse;
  const textContent = data.content?.find(c => c.type === 'text')?.text;
  return textContent ?? '';
}

export async function claudeText(opts: {
  model?: ClaudeModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
  cacheTtl?: '5m' | '1h'; // Cache TTL: 5 minutes (default) or 1 hour (beta)
}): Promise<string> {
  const messages: ClaudeMessage[] = [];
  
  // If cache metadata is provided, split into cacheable and dynamic messages
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Cacheable content with cache_control
    const cacheControl: ClaudeMessage['cache_control'] = {
      type: 'ephemeral',
    };
    
    // Add 1-hour TTL if requested (beta feature)
    if (opts.cacheTtl === '1h') {
      cacheControl.ttl = '1h';
    }
    
    messages.push({
      role: 'user',
      content: opts.cacheMetadata.cacheableContent,
      cache_control: cacheControl,
    });
    
    // Dynamic content without cache_control
    if (opts.cacheMetadata.dynamicContent) {
      messages.push({
        role: 'user',
        content: opts.cacheMetadata.dynamicContent,
      });
    }
  } else {
    // Fallback to single message if no cache metadata
    messages.push({ role: 'user', content: opts.user });
  }

  // Claude Sonnet 4.5 is the default for prose generation
  const model = opts.model || 'claude-sonnet-4-5-20250929';
  
  // Claude API has a max_tokens limit of 8192
  const maxTokens = opts.maxTokens ? Math.min(opts.maxTokens, 8192) : 8192;
  
  return claudeChat({
    model,
    messages,
    system: opts.system,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
  });
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

export async function claudeJson<T>(opts: {
  model?: ClaudeModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
  cacheTtl?: '5m' | '1h'; // Cache TTL: 5 minutes (default) or 1 hour (beta)
}): Promise<T> {
  const messages: ClaudeMessage[] = [];
  
  // If cache metadata is provided, split into cacheable and dynamic messages
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Cacheable content with cache_control
    const cacheControl: ClaudeMessage['cache_control'] = {
      type: 'ephemeral',
    };
    
    // Add 1-hour TTL if requested (beta feature)
    if (opts.cacheTtl === '1h') {
      cacheControl.ttl = '1h';
    }
    
    messages.push({
      role: 'user',
      content: opts.cacheMetadata.cacheableContent,
      cache_control: cacheControl,
    });
    
    // Dynamic content with JSON instruction
    const dynamicContent = opts.cacheMetadata.dynamicContent || '';
    const jsonInstruction = '\n\nReturn ONLY a JSON object. No markdown, no code fences, just valid JSON.';
    const fullDynamicContent = dynamicContent + jsonInstruction;
    
    if (fullDynamicContent.trim()) {
      messages.push({
        role: 'user',
        content: fullDynamicContent,
      });
    }
  } else {
    // Fallback to single message if no cache metadata
    const userMessage = opts.user + '\n\nReturn ONLY a JSON object. No markdown, no code fences, just valid JSON.';
    messages.push({ role: 'user', content: userMessage });
  }

  const model = opts.model || 'claude-sonnet-4-5-20250929';
  const maxTokens = opts.maxTokens ? Math.min(opts.maxTokens, 8192) : 8192;
  
  const raw = await claudeChat({
    model,
    messages,
    system: opts.system,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
  });

  // Check if response is suspiciously short (likely truncated or stopped early)
  // For chapter generation, we expect substantial responses (typically 2000+ tokens)
  const estimatedTokens = Math.ceil(raw.length / 4);
  if (raw.length < 1000 && estimatedTokens < 250) {
    // Warn for short responses - likely truncated for chapter generation
    console.warn(
      `[Claude] Response is unusually short (${raw.length} chars, ~${estimatedTokens} tokens). ` +
      `This may indicate truncation. Max tokens: ${maxTokens}. ` +
      `Expected ~2000+ tokens for chapter generation.`
    );
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
    const parsed = JSON.parse(cleaned) as T;
    
    // Validate parsed JSON for chapter generation (common pattern)
    // If we only get logicAudit, likely truncated (regardless of token count)
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      const estimatedTokens = Math.round(raw.length / 4);
      
      // Check if only logicAudit is present - this indicates truncation for chapter generation
      if (keys.length === 1 && keys[0] === 'logicAudit') {
        throw new Error(
          `Claude response appears truncated. Only received logicAudit field.\n` +
          `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
          `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
          `This typically indicates the response hit max_tokens limit or was truncated.\n` +
          `Max tokens requested: ${maxTokens}\n` +
          `Try increasing maxTokens or reducing prompt size.`
        );
      }
      
      // Check for chapter generation response missing required fields
      if (keys.includes('logicAudit') && (!keys.includes('chapterTitle') || !keys.includes('chapterContent'))) {
        throw new Error(
          `Claude response appears truncated. Has logicAudit but missing required fields.\n` +
          `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
          `Fields received: ${keys.join(', ')}\n` +
          `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
          `This typically indicates the response hit max_tokens limit or was truncated.\n` +
          `Max tokens requested: ${maxTokens}\n` +
          `Try increasing maxTokens or reducing prompt size.`
        );
      }
    }
    
    return parsed;
  } catch (e) {
    // Try fixing control characters
    try {
      const fixedControl = fixControlCharacters(cleaned);
      const parsed = JSON.parse(fixedControl) as T;
      
      // Same validation for control-character-fixed JSON
      if (typeof parsed === 'object' && parsed !== null) {
        const keys = Object.keys(parsed);
        const estimatedTokens = Math.round(raw.length / 4);
        
        // Check if only logicAudit is present - this indicates truncation for chapter generation
        if (keys.length === 1 && keys[0] === 'logicAudit') {
          throw new Error(
            `Claude response appears truncated. Only received logicAudit field.\n` +
            `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
            `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
            `This typically indicates the response hit max_tokens limit or was truncated.\n` +
            `Max tokens requested: ${maxTokens}\n` +
            `Try increasing maxTokens or reducing prompt size.`
          );
        }
        
        // Check for chapter generation response missing required fields
        if (keys.includes('logicAudit') && (!keys.includes('chapterTitle') || !keys.includes('chapterContent'))) {
          throw new Error(
            `Claude response appears truncated. Has logicAudit but missing required fields.\n` +
            `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
            `Fields received: ${keys.join(', ')}\n` +
            `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
            `This typically indicates the response hit max_tokens limit or was truncated.\n` +
            `Max tokens requested: ${maxTokens}\n` +
            `Try increasing maxTokens or reducing prompt size.`
          );
        }
      }
      
      return parsed;
    } catch (controlError) {
      // Try to fix truncated JSON
      try {
        const fixed = tryFixTruncatedJson(cleaned);
        const parsed = JSON.parse(fixed) as T;
        
        console.warn('[Claude] JSON response required fixing. Consider increasing maxTokens or reducing response size.');
        
        // Validate that fixed JSON still has expected structure
        // For chapter generation, if we only get logicAudit, it's likely truncated
        if (typeof parsed === 'object' && parsed !== null) {
          const keys = Object.keys(parsed);
          const estimatedTokens = Math.round(raw.length / 4);
          
          // Check if only logicAudit is present - this indicates truncation for chapter generation
          if (keys.length === 1 && keys[0] === 'logicAudit') {
            throw new Error(
              `Claude response appears truncated. Only received logicAudit field.\n` +
              `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
              `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
              `This typically indicates the response hit max_tokens limit or was truncated.\n` +
              `Max tokens requested: ${maxTokens}\n` +
              `Try increasing maxTokens or reducing prompt size.`
            );
          }
          
          // Check for chapter generation response missing required fields
          if (keys.includes('logicAudit') && (!keys.includes('chapterTitle') || !keys.includes('chapterContent'))) {
            throw new Error(
              `Claude response appears truncated. Has logicAudit but missing required fields.\n` +
              `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
              `Fields received: ${keys.join(', ')}\n` +
              `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
              `This typically indicates the response hit max_tokens limit or was truncated.\n` +
              `Max tokens requested: ${maxTokens}\n` +
              `Try increasing maxTokens or reducing prompt size.`
            );
          }
          
          // If object has only 1-2 fields and is short, likely truncated
          if (keys.length < 2 && cleaned.length < 500 && estimatedTokens < 150) {
            throw new Error(
              `Claude response appears truncated. JSON is valid but missing required fields.\n` +
              `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
              `Fields found: ${keys.join(', ') || 'none'}\n` +
              `This typically indicates truncation. Max tokens requested: ${maxTokens}`
            );
          }
        }
        
        return parsed;
      } catch (fixError) {
        // Check if it's our truncation error - rethrow it
        if (fixError instanceof Error && fixError.message.includes('truncated')) {
          throw fixError;
        }
        
        // Last attempt: fix control characters AND truncation
        try {
          const fixedControl = fixControlCharacters(cleaned);
          const fixed = tryFixTruncatedJson(fixedControl);
          const parsed = JSON.parse(fixed) as T;
          
          console.warn('[Claude] JSON response required extensive fixing. Consider increasing maxTokens or reducing response size.');
          
          // Same validation for extensively fixed JSON
          if (typeof parsed === 'object' && parsed !== null) {
            const keys = Object.keys(parsed);
            const estimatedTokens = Math.round(raw.length / 4);
            
            // Check if only logicAudit is present - this indicates truncation for chapter generation
            if (keys.length === 1 && keys[0] === 'logicAudit') {
              throw new Error(
                `Claude response appears truncated. Only received logicAudit field.\n` +
                `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
                `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
                `This typically indicates the response hit max_tokens limit or was truncated.\n` +
                `Max tokens requested: ${maxTokens}\n` +
                `Try increasing maxTokens or reducing prompt size.`
              );
            }
            
            // Check for chapter generation response missing required fields
            if (keys.includes('logicAudit') && (!keys.includes('chapterTitle') || !keys.includes('chapterContent'))) {
              throw new Error(
                `Claude response appears truncated. Has logicAudit but missing required fields.\n` +
                `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
                `Fields received: ${keys.join(', ')}\n` +
                `Expected fields: logicAudit, chapterTitle, chapterContent, chapterSummary, etc.\n` +
                `This typically indicates the response hit max_tokens limit or was truncated.\n` +
                `Max tokens requested: ${maxTokens}\n` +
                `Try increasing maxTokens or reducing prompt size.`
              );
            }
            
            if (keys.length < 2 && cleaned.length < 500 && estimatedTokens < 150) {
              throw new Error(
                `Claude response appears truncated. JSON is valid but missing required fields.\n` +
                `Response length: ${raw.length} characters (~${estimatedTokens} tokens)\n` +
                `Fields found: ${keys.join(', ') || 'none'}\n` +
                `This typically indicates truncation. Max tokens requested: ${maxTokens}`
              );
            }
          }
          
          return parsed;
        } catch (finalError) {
          // Check if it's our truncation error - rethrow it
          if (finalError instanceof Error && finalError.message.includes('truncated')) {
            throw finalError;
          }
          
          throw new Error(
            `Claude returned invalid JSON.\n` +
            `Parse error: ${e instanceof Error ? e.message : String(e)}\n` +
            `Attempted fixes also failed.\n` +
            `Response length: ${raw.length} characters (${Math.round(raw.length / 4)} tokens estimated)\n` +
            `Preview (first 500 chars):\n${raw.substring(0, 500)}...`
          );
        }
      }
    }
  }
}
