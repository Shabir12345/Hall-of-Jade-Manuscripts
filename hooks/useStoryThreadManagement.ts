/**
 * Story Thread Management Hook
 * Handles CRUD operations for story threads
 */

import { useState, useCallback, useMemo } from 'react';
import type { StoryThread, ThreadStatus, ThreadPriority, StoryThreadType } from '../types';
import { generateUUID } from '../utils/uuid';

interface UseStoryThreadManagementResult {
  editingThread: StoryThread | null;
  setEditingThread: (thread: StoryThread | null) => void;
  handleSaveThread: (thread: StoryThread) => void;
  handleDeleteThread: (threadId: string) => void;
  handleCreateThread: () => StoryThread;
  handleResolveThread: (threadId: string, resolutionNotes: string, satisfactionScore?: number) => void;
  handleUpdateThreadStatus: (threadId: string, status: ThreadStatus) => void;
  handleUpdateThreadPriority: (threadId: string, priority: ThreadPriority) => void;
  filteredThreads: StoryThread[];
  setFilterType: (type: StoryThreadType | 'all') => void;
  setFilterStatus: (status: ThreadStatus | 'all') => void;
  setFilterPriority: (priority: ThreadPriority | 'all') => void;
  setSearchQuery: (query: string) => void;
  setFilterChapterRange: (range: { min: number | null; max: number | null }) => void;
  setFilterHealthRange: (range: { min: number | null; max: number | null }) => void;
  setFilterRelatedEntity: (entity: string) => void;
  filterType: StoryThreadType | 'all';
  filterStatus: ThreadStatus | 'all';
  filterPriority: ThreadPriority | 'all';
  searchQuery: string;
  filterChapterRange: { min: number | null; max: number | null };
  filterHealthRange: { min: number | null; max: number | null };
  filterRelatedEntity: string;
}

export function useStoryThreadManagement(
  activeNovel: any,
  updateActiveNovel: (updater: (prev: any) => any) => void,
  onConfirm: (config: { title: string; message: string; onConfirm: () => void; variant?: string }) => void,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): UseStoryThreadManagementResult {
  const [editingThread, setEditingThread] = useState<StoryThread | null>(null);
  const [filterType, setFilterType] = useState<StoryThreadType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ThreadStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<ThreadPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterChapterRange, setFilterChapterRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [filterHealthRange, setFilterHealthRange] = useState<{ min: number | null; max: number | null }>({ min: null, max: null });
  const [filterRelatedEntity, setFilterRelatedEntity] = useState<string>('');

  const threads = activeNovel?.storyThreads || [];

  const filteredThreads = useMemo(() => {
    const currentChapter = activeNovel?.chapters?.length || 0;
    return threads.filter((thread: StoryThread) => {
      // Type filter
      if (filterType !== 'all' && thread.type !== filterType) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && thread.status !== filterStatus) {
        return false;
      }

      // Priority filter
      if (filterPriority !== 'all' && thread.priority !== filterPriority) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = thread.title.toLowerCase().includes(query);
        const matchesDescription = thread.description.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }

      // Chapter range filter
      if (filterChapterRange.min !== null && thread.introducedChapter < filterChapterRange.min) {
        return false;
      }
      if (filterChapterRange.max !== null && thread.introducedChapter > filterChapterRange.max) {
        return false;
      }

      // Health range filter
      if (filterHealthRange.min !== null || filterHealthRange.max !== null) {
        // Import calculateThreadHealth dynamically to avoid circular dependency
        const { calculateThreadHealth } = require('../services/storyThreadService');
        const health = calculateThreadHealth(thread, currentChapter);
        if (filterHealthRange.min !== null && health < filterHealthRange.min) {
          return false;
        }
        if (filterHealthRange.max !== null && health > filterHealthRange.max) {
          return false;
        }
      }

      // Related entity filter
      if (filterRelatedEntity.trim()) {
        const entityQuery = filterRelatedEntity.toLowerCase().trim();
        if (!thread.relatedEntityId && !thread.relatedEntityType) {
          return false;
        }
        // We can't easily match entity name here without full state, so we'll match by type
        if (thread.relatedEntityType && !thread.relatedEntityType.toLowerCase().includes(entityQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [threads, filterType, filterStatus, filterPriority, searchQuery, filterChapterRange, filterHealthRange, filterRelatedEntity, activeNovel]);

  const handleSaveThread = useCallback((thread: StoryThread) => {
    if (!activeNovel) return;

    updateActiveNovel((prev) => {
      const existingThreads = prev.storyThreads || [];
      const existingIndex = existingThreads.findIndex((t: StoryThread) => t.id === thread.id);
      const updatedThreads = existingIndex > -1
        ? existingThreads.map((t: StoryThread, idx: number) => idx === existingIndex ? thread : t)
        : [...existingThreads, thread];

      return {
        ...prev,
        storyThreads: updatedThreads,
        updatedAt: Date.now(),
      };
    });

    setEditingThread(null);
    showSuccess('Thread saved successfully');
  }, [activeNovel, updateActiveNovel, showSuccess]);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (!activeNovel) return;

    const thread = threads.find((t: StoryThread) => t.id === threadId);
    if (!thread) return;

    onConfirm({
      title: 'Delete Thread',
      message: `Delete thread "${thread.title}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel((prev) => ({
          ...prev,
          storyThreads: (prev.storyThreads || []).filter((t: StoryThread) => t.id !== threadId),
          updatedAt: Date.now(),
        }));
        setEditingThread(null);
        showSuccess('Thread deleted successfully');
      },
    } as any);
  }, [activeNovel, threads, updateActiveNovel, onConfirm, showSuccess]);

  const handleCreateThread = useCallback((): StoryThread => {
    if (!activeNovel) {
      throw new Error('No active novel');
    }

    const currentChapter = activeNovel.chapters.length;
    // Smart default: choose thread type based on what's most common in the novel
    const existingThreads = activeNovel.storyThreads || [];
    const typeCounts: Record<StoryThreadType, number> = {
      enemy: 0, technique: 0, item: 0, location: 0, sect: 0,
      promise: 0, mystery: 0, relationship: 0, power: 0, quest: 0,
      revelation: 0, conflict: 0, alliance: 0,
    };
    existingThreads.forEach(t => { typeCounts[t.type] = (typeCounts[t.type] || 0) + 1; });
    
    // Default to most common type, or 'mystery' if no threads exist
    const defaultType = existingThreads.length > 0
      ? (Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0] as StoryThreadType)
      : 'mystery';
    
    const newThread: StoryThread = {
      id: generateUUID(),
      novelId: activeNovel.id,
      title: 'New Thread',
      type: defaultType,
      status: 'active',
      priority: 'medium',
      description: '',
      introducedChapter: currentChapter,
      lastUpdatedChapter: currentChapter,
      progressionNotes: [],
      chaptersInvolved: [currentChapter],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setEditingThread(newThread);
    return newThread;
  }, [activeNovel]);

  const handleResolveThread = useCallback((threadId: string, resolutionNotes: string, satisfactionScore?: number) => {
    if (!activeNovel) return;

    const thread = threads.find((t: StoryThread) => t.id === threadId);
    if (!thread) return;

    const currentChapter = activeNovel.chapters.length;
    const resolvedThread: StoryThread = {
      ...thread,
      status: 'resolved',
      resolvedChapter: currentChapter,
      lastUpdatedChapter: currentChapter,
      resolutionNotes,
      satisfactionScore: satisfactionScore !== undefined ? satisfactionScore : undefined,
      updatedAt: Date.now(),
    };

    handleSaveThread(resolvedThread);
  }, [activeNovel, threads, handleSaveThread]);

  const handleUpdateThreadStatus = useCallback((threadId: string, status: ThreadStatus) => {
    if (!activeNovel) return;

    const thread = threads.find((t: StoryThread) => t.id === threadId);
    if (!thread) return;

    const updatedThread: StoryThread = {
      ...thread,
      status,
      updatedAt: Date.now(),
    };

    handleSaveThread(updatedThread);
  }, [activeNovel, threads, handleSaveThread]);

  const handleUpdateThreadPriority = useCallback((threadId: string, priority: ThreadPriority) => {
    if (!activeNovel) return;

    const thread = threads.find((t: StoryThread) => t.id === threadId);
    if (!thread) return;

    const updatedThread: StoryThread = {
      ...thread,
      priority,
      updatedAt: Date.now(),
    };

    handleSaveThread(updatedThread);
  }, [activeNovel, threads, handleSaveThread]);

  return {
    editingThread,
    setEditingThread,
    handleSaveThread,
    handleDeleteThread,
    handleCreateThread,
    handleResolveThread,
    handleUpdateThreadStatus,
    handleUpdateThreadPriority,
    filteredThreads,
    setFilterType,
    setFilterStatus,
    setFilterPriority,
    setSearchQuery,
    setFilterChapterRange,
    setFilterHealthRange,
    setFilterRelatedEntity,
    filterType,
    filterStatus,
    filterPriority,
    searchQuery,
    filterChapterRange,
    filterHealthRange,
    filterRelatedEntity,
  };
}
