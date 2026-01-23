/**
 * Thread Service
 * Handles all CRUD operations for story threads and progression events
 */

import { supabase } from './supabaseService';
import { StoryThread, ThreadProgressionEvent, ThreadStatus, ThreadPriority, StoryThreadType, ThreadEventType } from '../types';
import { withRetry } from '../utils/errorHandling';

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all story threads for a novel
 */
export async function fetchStoryThreads(novelId: string): Promise<StoryThread[]> {
  return withRetry(async () => {
    const { data: threads, error } = await supabase
      .from('story_threads')
      .select('*')
      .eq('novel_id', novelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching story threads:', error);
      throw new Error(`Failed to fetch story threads: ${error.message}`);
    }

    if (!threads || threads.length === 0) {
      return [];
    }

    return threads.map(thread => ({
      id: thread.id,
      novelId: thread.novel_id,
      title: thread.title,
      type: thread.type as StoryThreadType,
      status: thread.status as ThreadStatus,
      priority: thread.priority as ThreadPriority,
      description: thread.description || '',
      introducedChapter: thread.introduced_chapter,
      lastUpdatedChapter: thread.last_updated_chapter,
      lastActiveChapter: thread.last_active_chapter || thread.last_updated_chapter, // detailed tracking
      resolvedChapter: thread.resolved_chapter || undefined,
      relatedEntityId: thread.related_entity_id || undefined,
      relatedEntityType: thread.related_entity_type || undefined,
      progressionNotes: (thread.progression_notes as Array<{
        chapterNumber: number;
        note: string;
        significance: 'major' | 'minor';
      }>) || [],
      resolutionNotes: thread.resolution_notes || undefined,
      satisfactionScore: thread.satisfaction_score || undefined,
      chaptersInvolved: (thread.chapters_involved as number[]) || [],
      createdAt: timestampToNumber(thread.created_at),
      updatedAt: timestampToNumber(thread.updated_at),
    }));
  });
}

/**
 * Save a story thread
 */
export async function saveStoryThread(thread: StoryThread): Promise<StoryThread> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('story_threads')
      .upsert({
        id: thread.id,
        novel_id: thread.novelId,
        title: thread.title,
        type: thread.type,
        status: thread.status,
        priority: thread.priority,
        description: thread.description,
        introduced_chapter: thread.introducedChapter,
        last_updated_chapter: thread.lastUpdatedChapter,
        last_active_chapter: thread.lastActiveChapter,
        resolved_chapter: thread.resolvedChapter || null,
        related_entity_id: thread.relatedEntityId || null,
        related_entity_type: thread.relatedEntityType || null,
        progression_notes: thread.progressionNotes || [],
        resolution_notes: thread.resolutionNotes || null,
        satisfaction_score: thread.satisfactionScore || null,
        chapters_involved: thread.chaptersInvolved || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error saving story thread:', error);
      throw new Error(`Failed to save story thread: ${error.message}`);
    }

    return {
      id: data.id,
      novelId: data.novel_id,
      title: data.title,
      type: data.type as StoryThreadType,
      status: data.status as ThreadStatus,
      priority: data.priority as ThreadPriority,
      description: data.description || '',
      introducedChapter: data.introduced_chapter,
      lastUpdatedChapter: data.last_updated_chapter,
      lastActiveChapter: data.last_active_chapter || data.last_updated_chapter,
      resolvedChapter: data.resolved_chapter || undefined,
      relatedEntityId: data.related_entity_id || undefined,
      relatedEntityType: data.related_entity_type || undefined,
      progressionNotes: (data.progression_notes as Array<{
        chapterNumber: number;
        note: string;
        significance: 'major' | 'minor';
      }>) || [],
      resolutionNotes: data.resolution_notes || undefined,
      satisfactionScore: data.satisfaction_score || undefined,
      chaptersInvolved: (data.chapters_involved as number[]) || [],
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Save a thread progression event
 */
export async function saveThreadProgressionEvent(event: ThreadProgressionEvent): Promise<ThreadProgressionEvent> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('thread_progression_events')
      .insert({
        id: event.id,
        thread_id: event.threadId,
        chapter_number: event.chapterNumber,
        chapter_id: event.chapterId,
        event_type: event.eventType,
        description: event.description,
        significance: event.significance,
        created_at: new Date(event.createdAt).toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Only log unexpected errors. Foreign key constraints are expected during race conditions and handled by retries.
      if (!error.message.includes('violates foreign key constraint') &&
        !error.message.includes('Key is not present')) {
        console.error('Error saving thread progression event:', error);
      }
      throw new Error(`Failed to save thread progression event: ${error.message}`);
    }

    return {
      id: data.id,
      threadId: data.thread_id,
      chapterNumber: data.chapter_number,
      chapterId: data.chapter_id,
      eventType: data.event_type as ThreadEventType,
      description: data.description,
      significance: data.significance as 'major' | 'minor' | 'foreshadowing',
      createdAt: timestampToNumber(data.created_at),
    };
  });
}

/**
 * Load thread progression events for a thread
 */
export async function loadThreadProgressionEvents(threadId: string): Promise<ThreadProgressionEvent[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('thread_progression_events')
      .select('*')
      .eq('thread_id', threadId)
      .order('chapter_number', { ascending: true });

    if (error) {
      console.error('Error loading thread progression events:', error);
      throw new Error(`Failed to load thread progression events: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(event => ({
      id: event.id,
      threadId: event.thread_id,
      chapterNumber: event.chapter_number,
      chapterId: event.chapter_id,
      eventType: event.event_type as ThreadEventType,
      description: event.description,
      significance: event.significance as 'major' | 'minor' | 'foreshadowing',
      createdAt: timestampToNumber(event.created_at),
    }));
  });
}

/**
 * Delete a story thread
 */
export async function deleteStoryThread(threadId: string): Promise<void> {
  return withRetry(async () => {
    // Progression events will be deleted via CASCADE
    const { error } = await supabase
      .from('story_threads')
      .delete()
      .eq('id', threadId);

    if (error) {
      console.error('Error deleting story thread:', error);
      throw new Error(`Failed to delete story thread: ${error.message}`);
    }
  });
}
