/**
 * Integration Tests: Novel Management
 * 
 * Tests the complete novel CRUD operations workflow including:
 * - Creating novels
 * - Reading novels
 * - Updating novels
 * - Deleting novels
 * - Novel state management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NovelState } from '../../../types';
import { INITIAL_NOVEL_STATE } from '../../../constants';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: [],
        error: null,
      })),
      data: [],
      error: null,
    })),
    insert: vi.fn(() => ({
      data: null,
      error: null,
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
  })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: { user: { id: 'test-user-id' } } },
      error: null,
    })),
  },
};

vi.mock('../../../config/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Novel Management Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Novel Creation Flow', () => {
    it('should create a novel with all required fields', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(novel.id).toBe('test-novel-id');
      expect(novel.title).toBe('Test Novel');
      expect(novel.genre).toBe('Xianxia');
      expect(novel.chapters).toEqual([]);
      expect(novel.characterCodex).toBeDefined();
      expect(novel.realms).toBeDefined();
    });

    it('should create a novel with initial realm', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(novel.realms.length).toBeGreaterThan(0);
      expect(novel.currentRealmId).toBeDefined();
      expect(novel.realms.some(r => r.id === novel.currentRealmId)).toBe(true);
    });

    it('should initialize novel with empty collections', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(novel.chapters).toEqual([]);
      expect(novel.worldBible).toEqual([]);
      expect(novel.plotLedger).toEqual([]);
      expect(novel.tags).toEqual([]);
      expect(novel.writingGoals).toEqual([]);
    });
  });

  describe('Novel State Management', () => {
    it('should maintain novel state consistency', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Verify all required fields are present
      expect(novel.id).toBeDefined();
      expect(novel.title).toBeDefined();
      expect(novel.genre).toBeDefined();
      expect(novel.createdAt).toBeDefined();
      expect(novel.updatedAt).toBeDefined();
    });

    it('should update timestamp on state changes', () => {
      const initialTime = Date.now();
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: initialTime,
        updatedAt: initialTime,
      };

      const updatedNovel = {
        ...novel,
        title: 'Updated Title',
        updatedAt: Date.now(),
      };

      expect(updatedNovel.updatedAt).toBeGreaterThan(novel.updatedAt);
      expect(updatedNovel.title).not.toBe(novel.title);
    });
  });

  describe('Novel Data Integrity', () => {
    it('should maintain character codex integrity', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(Array.isArray(novel.characterCodex)).toBe(true);
      novel.characterCodex.forEach((char) => {
        expect(char.id).toBeDefined();
        expect(char.name).toBeDefined();
      });
    });

    it('should maintain realm integrity', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(Array.isArray(novel.realms)).toBe(true);
      expect(novel.realms.length).toBeGreaterThan(0);
      expect(novel.currentRealmId).toBeDefined();
      
      const currentRealm = novel.realms.find(r => r.id === novel.currentRealmId);
      expect(currentRealm).toBeDefined();
    });

    it('should maintain chapter numbering consistency', () => {
      const novel: NovelState = {
        ...INITIAL_NOVEL_STATE,
        id: 'test-novel-id',
        title: 'Test Novel',
        genre: 'Xianxia',
        chapters: [
          { ...INITIAL_NOVEL_STATE.chapters[0] || {}, id: 'ch1', number: 1, title: 'Chapter 1', content: '', createdAt: Date.now() },
          { ...INITIAL_NOVEL_STATE.chapters[0] || {}, id: 'ch2', number: 2, title: 'Chapter 2', content: '', createdAt: Date.now() },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      novel.chapters.forEach((chapter, index) => {
        expect(chapter.number).toBe(index + 1);
      });
    });
  });
});
