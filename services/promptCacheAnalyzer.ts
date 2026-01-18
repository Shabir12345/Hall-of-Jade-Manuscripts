/**
 * Prompt Cache Analyzer
 * Automatically identifies cacheable vs dynamic content in prompts
 */

import type { NovelState, BuiltPrompt } from '../types';
import { estimateTokens } from './promptEngine/tokenEstimator';
import type { CacheablePrompt } from '../types/cache';
import { PROVIDER_CACHE_REQUIREMENTS, type CacheProvider } from '../types/cache';

/**
 * Section markers that indicate cacheable content (stable across requests)
 */
const CACHEABLE_SECTION_MARKERS = [
  '[STORY CONTEXT]',
  '[WORLD BIBLE',
  '[CHARACTER CODEX',
  '[GENRE CONVENTIONS]',
  '[LITERARY PRINCIPLES',
  '[STYLE GUIDELINES]',
  '[COMPLETED ARCS',
  '[CHAPTER SUMMARY - Older Chapters]',
  'ROLE:',
];

/**
 * Section markers that indicate dynamic content (changes per request)
 */
const DYNAMIC_SECTION_MARKERS = [
  '[TASK]',
  '[CHAPTER TRANSITION',
  '[RECENT CHAPTERS]',
  '[CURRENT ARC]',
  '[CURRENT STORY STATE]',
  '[ACTIVE PLOT THREADS]',
  '[HIGH-PRIORITY PLOT THREADS',
  '[CONSTRAINTS & REQUIREMENTS]',
  '[OUTPUT FORMAT]',
  'User Instruction:',
];

/**
 * Analyzes a prompt to determine cacheable vs dynamic content
 */
export function analyzePromptForCaching(
  builtPrompt: BuiltPrompt,
  novelState: NovelState,
  provider: CacheProvider
): CacheablePrompt | null {
  try {
    const userPrompt = builtPrompt.userPrompt || '';
    
    if (!userPrompt || userPrompt.trim().length === 0) {
      return null; // Empty prompt cannot be cached
    }
    
    // Split the prompt into cacheable and dynamic sections
    const { cacheable, dynamic } = splitCacheableAndDynamic(userPrompt);
    
    // Must have cacheable content
    if (!cacheable || cacheable.trim().length === 0) {
      return null; // No cacheable content found
    }
    
    // Estimate tokens for cacheable content
    const cacheableTokens = estimateCacheableTokens(cacheable);
    
    // Check if we meet minimum requirements for this provider
    const requirements = PROVIDER_CACHE_REQUIREMENTS[provider];
    if (!meetsMinimumCacheRequirements(cacheableTokens, provider)) {
      return null; // Not eligible for caching (below minimum token requirement)
    }
    
    // Generate cache key based on novel state
    const cacheKey = generateCacheKey(novelState, cacheable);
    
    return {
      cacheableContent: cacheable,
      dynamicContent: dynamic || '', // Ensure dynamic is at least empty string
      cacheKey,
      estimatedCacheableTokens: cacheableTokens,
      canUseCaching: true,
    };
  } catch (error) {
    // Log error but don't throw - caching is non-critical
    console.warn('[Prompt Cache Analyzer] Error analyzing prompt:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Splits a prompt into cacheable and dynamic sections
 */
export function splitCacheableAndDynamic(userPrompt: string): {
  cacheable: string;
  dynamic: string;
} {
  if (!userPrompt) {
    return { cacheable: '', dynamic: '' };
  }
  
  const lines = userPrompt.split('\n');
  const cacheableLines: string[] = [];
  const dynamicLines: string[] = [];
  
  let currentSection: 'cacheable' | 'dynamic' | 'unknown' = 'unknown';
  let foundDynamicMarker = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperLine = line.toUpperCase();
    
    // Check for cacheable markers (check these first as they appear earlier in prompts)
    const hasCacheableMarker = CACHEABLE_SECTION_MARKERS.some(marker =>
      upperLine.includes(marker.toUpperCase())
    );
    
    // Check for dynamic markers
    const hasDynamicMarker = DYNAMIC_SECTION_MARKERS.some(marker =>
      upperLine.includes(marker.toUpperCase())
    );
    
    // Once we hit a dynamic marker, everything after is dynamic
    if (hasDynamicMarker) {
      foundDynamicMarker = true;
      currentSection = 'dynamic';
    } else if (hasCacheableMarker && !foundDynamicMarker) {
      currentSection = 'cacheable';
    } else if (!foundDynamicMarker && currentSection === 'unknown') {
      // Before any markers, default to cacheable (ROLE: comes first)
      currentSection = 'cacheable';
    }
    
    // Assign line to appropriate section
    if (foundDynamicMarker || hasDynamicMarker) {
      dynamicLines.push(line);
    } else {
      cacheableLines.push(line);
    }
  }
  
  // If we didn't find a clear breakpoint, use a heuristic:
  // First 60% is likely cacheable (World State, Character Codex, etc.)
  // Last 40% is likely dynamic (Task, Recent Chapters, Constraints)
  if (!foundDynamicMarker && lines.length > 10) {
    const splitIndex = Math.floor(lines.length * 0.6);
    return {
      cacheable: lines.slice(0, splitIndex).join('\n'),
      dynamic: lines.slice(splitIndex).join('\n'),
    };
  }
  
  return {
    cacheable: cacheableLines.join('\n'),
    dynamic: dynamicLines.join('\n'),
  };
}

/**
 * Estimates token count for cacheable content
 */
export function estimateCacheableTokens(content: string): number {
  return estimateTokens(content);
}

/**
 * Checks if cacheable content meets minimum token requirements
 */
export function meetsMinimumCacheRequirements(
  cacheableTokens: number,
  provider: CacheProvider
): boolean {
  const requirements = PROVIDER_CACHE_REQUIREMENTS[provider];
  return cacheableTokens >= requirements.minimumTokens;
}

/**
 * Generates a cache key based on novel state and cacheable content
 * This key should be stable across requests when the cacheable content hasn't changed
 */
function generateCacheKey(novelState: NovelState, cacheableContent: string): string {
  // Create a stable key based on:
  // - Novel ID
  // - Number of chapters (affects older chapters summary)
  // - Character codex length (affects character context)
  // - World bible length (affects world context)
  // - Hash of cacheable content
  
  const stateHash = [
    novelState.id,
    novelState.chapters.length.toString(),
    novelState.characterCodex.length.toString(),
    novelState.worldBible.length.toString(),
    novelState.realms.length.toString(),
    novelState.territories.length.toString(),
  ].join('|');
  
  // Simple hash of cacheable content (first 1000 chars + length)
  const contentHash = simpleHash(cacheableContent.substring(0, 1000) + cacheableContent.length);
  
  return `cache:${stateHash}:${contentHash}`;
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
