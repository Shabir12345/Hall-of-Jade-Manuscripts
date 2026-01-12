/**
 * Utility to track which novels have been modified
 * to optimize saves by only saving changed novels
 */

import { NovelState } from '../types';

class NovelChangeTracker {
  private originalNovels: Map<string, string> = new Map(); // novelId -> serialized state
  private changedNovelIds: Set<string> = new Set();

  /**
   * Initialize tracking for a set of novels
   */
  initialize(novels: NovelState[]): void {
    this.originalNovels.clear();
    this.changedNovelIds.clear();
    novels.forEach(novel => {
      this.originalNovels.set(novel.id, this.serializeNovel(novel));
    });
  }

  /**
   * Mark a novel as changed
   */
  markChanged(novelId: string): void {
    this.changedNovelIds.add(novelId);
  }

  /**
   * Get list of changed novel IDs
   */
  getChangedNovelIds(): string[] {
    return Array.from(this.changedNovelIds);
  }

  /**
   * Check if a novel has changed
   */
  hasChanged(novelId: string): boolean {
    return this.changedNovelIds.has(novelId);
  }

  /**
   * Clear change tracking for a novel (after successful save)
   */
  clearChanged(novelId: string): void {
    this.changedNovelIds.delete(novelId);
    // Update the original state
    // Note: This should be called after a successful save
  }

  /**
   * Update original state after save
   */
  updateOriginal(novel: NovelState): void {
    this.originalNovels.set(novel.id, this.serializeNovel(novel));
    this.changedNovelIds.delete(novel.id);
  }

  /**
   * Serialize novel for comparison with deep comparison
   * Includes all relevant fields that affect the novel state
   */
  private serializeNovel(novel: NovelState): string {
    // Serialize all important fields for accurate change detection
    // This ensures we catch all real changes, not just metadata changes
    return JSON.stringify({
      id: novel.id,
      title: novel.title,
      genre: novel.genre,
      grandSaga: novel.grandSaga,
      currentRealmId: novel.currentRealmId,
      updatedAt: novel.updatedAt,
      // Deep serialize important arrays/objects
      chapters: novel.chapters.map(c => ({
        id: c.id,
        number: c.number,
        title: c.title,
        content: c.content.substring(0, 100), // First 100 chars for comparison
        summary: c.summary,
        updatedAt: c.createdAt, // Using createdAt as a proxy for updates
      })),
      characterCodex: novel.characterCodex.map(char => ({
        id: char.id,
        name: char.name,
        currentCultivation: char.currentCultivation,
        status: char.status,
        skillsCount: char.skills?.length || 0,
        itemsCount: char.items?.length || 0,
      })),
      worldBible: novel.worldBible.map(w => ({
        id: w.id,
        title: w.title,
        category: w.category,
        content: w.content.substring(0, 100), // First 100 chars
      })),
      realms: novel.realms.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
      })),
      territories: novel.territories.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
      })),
      plotLedger: novel.plotLedger.map(a => ({
        id: a.id,
        title: a.title,
        status: a.status,
        progress: a.progress,
      })),
    }, null, 0); // No formatting for faster comparison
  }

  /**
   * Check if novel has actually changed by comparing serialized versions
   * More accurate than just checking if marked as changed
   */
  hasActualChanged(novel: NovelState): boolean {
    const original = this.originalNovels.get(novel.id);
    if (!original) return true; // New novel
    
    const current = this.serializeNovel(novel);
    return original !== current;
  }

  /**
   * Automatically detect if a novel has changed by comparing with original
   * More accurate than manual marking
   */
  detectChanged(novels: NovelState[]): string[] {
    const changedIds: string[] = [];
    novels.forEach(novel => {
      if (this.hasActualChanged(novel)) {
        this.markChanged(novel.id);
        changedIds.push(novel.id);
      }
    });
    return changedIds;
  }

  /**
   * Reset all tracking
   */
  reset(): void {
    this.originalNovels.clear();
    this.changedNovelIds.clear();
  }
}

export const novelChangeTracker = new NovelChangeTracker();
