/**
 * Prompt Cache Service
 * Manages cache operations and cache keys
 */

import type { NovelState } from '../types';
import type { CacheMetadata, CacheProvider } from '../types/cache';

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

/**
 * Generates a stable cache key based on novel state
 */
export function generateCacheKey(novelState: NovelState, cacheableContent: string): string {
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
 * Checks if cache should be invalidated based on state changes
 */
export function shouldInvalidateCache(
  previousState: NovelState | null,
  currentState: NovelState
): boolean {
  if (!previousState) {
    return false; // No previous state, no invalidation needed
  }
  
  // Check if key components changed that affect cacheable content
  return (
    previousState.id !== currentState.id || // Different novel
    previousState.chapters.length !== currentState.chapters.length || // New chapter added
    previousState.characterCodex.length !== currentState.characterCodex.length || // Characters changed
    previousState.worldBible.length !== currentState.worldBible.length || // World bible changed
    previousState.realms.length !== currentState.realms.length || // Realms changed
    previousState.territories.length !== currentState.territories.length || // Territories changed
    hasWorldStateChanged(previousState, currentState) || // World state content changed
    hasCharacterCodexChanged(previousState, currentState) // Character codex content changed
  );
}

/**
 * Checks if world state content has changed
 */
function hasWorldStateChanged(previousState: NovelState, currentState: NovelState): boolean {
  // Check if world bible entries changed (beyond just length)
  if (previousState.worldBible.length !== currentState.worldBible.length) {
    return true;
  }
  
  // Check if any world bible entries were modified
  for (let i = 0; i < Math.min(previousState.worldBible.length, currentState.worldBible.length); i++) {
    const prev = previousState.worldBible[i];
    const curr = currentState.worldBible[i];
    if (prev.id !== curr.id || prev.title !== curr.title || prev.content !== curr.content) {
      return true;
    }
  }
  
  // Check realms and territories
  if (previousState.realms.length !== currentState.realms.length) {
    return true;
  }
  if (previousState.territories.length !== currentState.territories.length) {
    return true;
  }
  
  return false;
}

/**
 * Checks if character codex content has changed
 */
function hasCharacterCodexChanged(previousState: NovelState, currentState: NovelState): boolean {
  if (previousState.characterCodex.length !== currentState.characterCodex.length) {
    return true;
  }
  
  // Check if any character entries were modified (key fields that affect prompts)
  for (let i = 0; i < Math.min(previousState.characterCodex.length, currentState.characterCodex.length); i++) {
    const prev = previousState.characterCodex[i];
    const curr = currentState.characterCodex[i];
    
    // Check key fields that appear in cacheable prompts
    if (
      prev.id !== curr.id ||
      prev.name !== curr.name ||
      prev.personality !== curr.personality ||
      prev.currentCultivation !== curr.currentCultivation ||
      prev.background !== curr.background
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Creates cache metadata for a novel state
 */
export function createCacheMetadata(
  novelState: NovelState,
  cacheableContent: string,
  dynamicContent: string,
  provider: CacheProvider
): CacheMetadata | null {
  const cacheKey = generateCacheKey(novelState, cacheableContent);
  
  // Estimate tokens (rough: 1 token ≈ 4 characters)
  const estimatedCacheableTokens = Math.ceil(cacheableContent.length / 4);
  
  // Check minimum requirements
  const { PROVIDER_CACHE_REQUIREMENTS } = require('../types/cache');
  const requirements = PROVIDER_CACHE_REQUIREMENTS[provider];
  const canUseCaching = estimatedCacheableTokens >= requirements.minimumTokens;
  
  if (!canUseCaching) {
    return null;
  }
  
  return {
    cacheableContent,
    dynamicContent,
    cacheKey,
    estimatedCacheableTokens,
    canUseCaching: true,
    provider,
  };
}
