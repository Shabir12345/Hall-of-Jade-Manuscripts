import { env } from '../utils/env';

type GrokModel = 'grok-4-1-fast-reasoning' | 'grok-4-1-fast-non-reasoning';

type GrokRole = 'system' | 'user' | 'assistant';

interface GrokMessage {
  role: GrokRole;
  content: string;
}

interface GrokChatCompletionRequest {
  model: GrokModel;
  messages: GrokMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  stream?: boolean;
}

interface GrokChatCompletionResponse {
  choices?: Array<{
    index: number;
    message?: { role: GrokRole; content?: string };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
}

function getGrokApiKey(): string {
  const key = env.grok?.apiKey;
  if (!key) {
    throw new Error(
      'XAI_API_KEY is not set. Please set XAI_API_KEY in your .env.local and restart.'
    );
  }
  return key;
}

async function grokChat(request: GrokChatCompletionRequest): Promise<string> {
  const apiKey = getGrokApiKey();

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Grok API error (${res.status}): ${text || res.statusText}`);
  }

  const data = (await res.json()) as GrokChatCompletionResponse;
  
  if (data.error) {
    throw new Error(`Grok API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  return content ?? '';
}

export async function grokText(opts: {
  model?: GrokModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
  cacheTtl?: '5m' | '1h'; // Cache TTL: 5 minutes (default) or 1 hour (for compatibility)
}): Promise<string> {
  const messages: GrokMessage[] = [];
  if (opts.system && opts.system.trim() !== '') {
    messages.push({ role: 'system', content: opts.system });
  }
  
  // If cache metadata is provided, structure messages to leverage Grok's automatic prefix caching
  // Grok uses prefix matching for caching, so putting cacheable content first helps
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Cacheable content goes first to maximize prefix cache hits
    messages.push({ role: 'user', content: opts.cacheMetadata.cacheableContent });
    
    // Dynamic content follows (this part won't be cached but allows cache hits on the prefix)
    if (opts.cacheMetadata.dynamicContent) {
      messages.push({ role: 'user', content: opts.cacheMetadata.dynamicContent });
    }
  } else {
    // Fallback to single message if no cache metadata
    messages.push({ role: 'user', content: opts.user });
  }

  // Grok-4-1-fast-reasoning is the default for chapter generation
  const model = opts.model || 'grok-4-1-fast-reasoning';
  
  // Grok supports up to 2M tokens context window (both input and output combined)
  // For output generation, we use a reasonable default of 8192 tokens
  // For input context, the prompt builder automatically adjusts limits when Grok is detected:
  // - Up to 500K characters (≈125K tokens) for context input
  // - Up to 50 recent full chapters included
  // - Comprehensive character progression and thread tracking across entire novel
  // This allows leveraging the full 2M token window for maintaining novel consistency
  const maxTokens = opts.maxTokens || 8192;
  
  return grokChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
  });
}

/**
 * Strips markdown code blocks from JSON response
 */
function stripMarkdownCodeBlocks(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let cleaned = text.trim();
  
  // Remove markdown code blocks with json identifier
  const completeJsonBlock = /^```\s*json\s*\n?([\s\S]*?)\n?```\s*$/i;
  const match = cleaned.match(completeJsonBlock);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Remove generic code blocks
  const genericBlock = /^```\s*\n?([\s\S]*?)\n?```\s*$/;
  const genericMatch = cleaned.match(genericBlock);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1].trim();
  }
  
  return cleaned;
}

export async function grokJson<T>(opts: {
  model?: GrokModel;
  system?: string;
  user: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
  };
  cacheTtl?: '5m' | '1h'; // Cache TTL: 5 minutes (default) or 1 hour (for compatibility)
}): Promise<T> {
  const messages: GrokMessage[] = [];
  if (opts.system && opts.system.trim() !== '') {
    messages.push({ role: 'system', content: opts.system });
  }
  
  // If cache metadata is provided, structure messages to leverage Grok's automatic prefix caching
  // Grok uses prefix matching for caching, so putting cacheable content first helps
  if (opts.cacheMetadata && opts.cacheMetadata.cacheableContent) {
    // Cacheable content goes first to maximize prefix cache hits
    messages.push({ role: 'user', content: opts.cacheMetadata.cacheableContent });
    
    // Dynamic content follows (this part won't be cached but allows cache hits on the prefix)
    if (opts.cacheMetadata.dynamicContent) {
      messages.push({ role: 'user', content: opts.cacheMetadata.dynamicContent });
    }
  } else {
    // Fallback to single message if no cache metadata
    messages.push({ role: 'user', content: opts.user });
  }

  const model = opts.model || 'grok-4-1-fast-reasoning';
  // Grok supports up to 2M tokens context window (both input and output combined)
  // For JSON output generation, we use a reasonable default of 8192 tokens
  // The prompt builder automatically leverages the large context window when Grok is selected
  // by including comprehensive novel context (up to 500K chars ≈ 125K tokens for input)
  const maxTokens = opts.maxTokens || 8192;

  const raw = await grokChat({
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });

  // Strip markdown code blocks if present
  const cleaned = stripMarkdownCodeBlocks(raw);

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    // If parsing fails, try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        throw new Error(
          `Grok returned invalid JSON. Response: ${raw.substring(0, 200)}`
        );
      }
    }
    
    throw new Error(
      `Grok returned invalid JSON. Response: ${raw.substring(0, 200)}`
    );
  }
}
