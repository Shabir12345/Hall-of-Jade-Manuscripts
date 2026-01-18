import { env } from '../utils/env';

type OpenAIModel = 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4' | 'gpt-3.5-turbo' | 'o1-preview' | 'o1-mini';

type OpenAIRole = 'system' | 'user' | 'assistant';

interface OpenAIMessage {
  role: OpenAIRole;
  content: string;
}

interface OpenAIChatCompletionRequest {
  model: OpenAIModel;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    index: number;
    message?: { role: OpenAIRole; content?: string };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
}

function getOpenAIApiKey(): string {
  const key = env.openai.apiKey;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set. Please set OPENAI_API_KEY in your .env.local and restart.'
    );
  }
  return key;
}

async function openaiChat(request: OpenAIChatCompletionRequest): Promise<string> {
  const apiKey = getOpenAIApiKey();

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as OpenAIChatCompletionResponse;
  
  if (data.error) {
    throw new Error(`OpenAI API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  return content ?? '';
}

export async function openaiText(opts: {
  model?: OpenAIModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<string> {
  const messages: OpenAIMessage[] = [];
  if (opts.system && opts.system.trim() !== '') {
    messages.push({ role: 'system', content: opts.system });
  }
  messages.push({ role: 'user', content: opts.user });

  // GPT-4 Turbo is the default for planning tasks
  const model = opts.model || 'gpt-4-turbo';
  
  // OpenAI API has varying max_tokens limits depending on model
  // GPT-4 Turbo: max 4096 completion tokens
  // GPT-4o, GPT-4o-mini: max 4096 completion tokens
  // Other models may have different limits
  const defaultMaxTokens = 8192;
  let maxTokens = opts.maxTokens || defaultMaxTokens;
  
  // Enforce model-specific limits
  if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
    maxTokens = Math.min(maxTokens, 4096); // GPT-4 Turbo/4o max completion tokens
  }
  
  return openaiChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
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
  
  if (!fixed.endsWith('}') && !fixed.endsWith(']')) {
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;
    
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
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
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

export async function openaiJson<T>(opts: {
  model?: OpenAIModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}): Promise<T> {
  const messages: OpenAIMessage[] = [];
  if (opts.system && opts.system.trim() !== '') {
    messages.push({ role: 'system', content: opts.system });
  }
  messages.push({ role: 'user', content: opts.user });

  const model = opts.model || 'gpt-4-turbo';
  
  // OpenAI API has varying max_tokens limits depending on model
  // GPT-4 Turbo: max 4096 completion tokens
  // GPT-4o, GPT-4o-mini: max 4096 completion tokens
  const defaultMaxTokens = 8192;
  let maxTokens = opts.maxTokens || defaultMaxTokens;
  
  // Enforce model-specific limits
  if (model.includes('gpt-4-turbo') || model.includes('gpt-4o')) {
    maxTokens = Math.min(maxTokens, 4096); // GPT-4 Turbo/4o max completion tokens
  }
  
  const raw = await openaiChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  // First, try to parse as-is
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    // Try to fix truncated JSON
    try {
      const fixed = tryFixTruncatedJson(raw);
      const parsed = JSON.parse(fixed) as T;
      
      console.warn('[OpenAI] JSON response was truncated and required fixing. Consider increasing maxTokens or reducing response size.');
      
      return parsed;
    } catch (fixError) {
      throw new Error(
        `OpenAI returned invalid JSON.\n` +
        `Parse error: ${e instanceof Error ? e.message : String(e)}\n` +
        `Attempted fix also failed: ${fixError instanceof Error ? fixError.message : String(fixError)}\n` +
        `Response length: ${raw.length} characters\n` +
        `Preview (first 500 chars):\n${raw.substring(0, 500)}...`
      );
    }
  }
}
