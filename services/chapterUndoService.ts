/**
 * Chapter Undo Service
 * Enables undo/redo for individual chapter changes within an improvement session.
 * Tracks changes at the chapter level for granular rollback.
 */

import { NovelState, Chapter } from '../types';
import { generateUUID } from '../utils/uuid';

export interface ChapterSnapshot {
  id: string;
  chapterId: string;
  chapterNumber: number;
  content: string;
  title?: string;
  summary?: string;
  timestamp: number;
  reason: string; // Why this snapshot was created
  metadata?: {
    wordCount: number;
    category?: string;
  };
}

export interface UndoState {
  sessionId: string;
  novelId: string;
  snapshots: Map<string, ChapterSnapshot[]>; // chapterId -> array of snapshots
  currentIndex: Map<string, number>; // chapterId -> current snapshot index
  maxSnapshots: number;
}

// Module-level state management
const undoStates: Map<string, UndoState> = new Map();
const DEFAULT_MAX_SNAPSHOTS = 20;

/**
 * Initializes undo tracking for a novel improvement session
 */
export function initializeUndoSession(
  novelState: NovelState,
  sessionId?: string
): string {
  const id = sessionId || generateUUID();
  
  const state: UndoState = {
    sessionId: id,
    novelId: novelState.id,
    snapshots: new Map(),
    currentIndex: new Map(),
    maxSnapshots: DEFAULT_MAX_SNAPSHOTS,
  };
  
  // Create initial snapshots for all chapters
  novelState.chapters.forEach(chapter => {
    const snapshot = createSnapshot(chapter, 'Initial state');
    state.snapshots.set(chapter.id, [snapshot]);
    state.currentIndex.set(chapter.id, 0);
  });
  
  undoStates.set(id, state);
  
  console.log(`[UndoService] Initialized session ${id} with ${novelState.chapters.length} chapters`);
  
  return id;
}

/**
 * Creates a snapshot of a chapter
 */
function createSnapshot(chapter: Chapter, reason: string): ChapterSnapshot {
  return {
    id: generateUUID(),
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    content: chapter.content,
    title: chapter.title,
    summary: chapter.summary,
    timestamp: Date.now(),
    reason,
    metadata: {
      wordCount: chapter.content.split(/\s+/).filter(w => w.length > 0).length,
    },
  };
}

/**
 * Records a change to a chapter (creates a new snapshot)
 */
export function recordChapterChange(
  sessionId: string,
  chapter: Chapter,
  reason: string,
  category?: string
): void {
  const state = undoStates.get(sessionId);
  if (!state) {
    console.warn(`[UndoService] Session ${sessionId} not found`);
    return;
  }
  
  const chapterSnapshots = state.snapshots.get(chapter.id) || [];
  const currentIdx = state.currentIndex.get(chapter.id) || 0;
  
  // Remove any snapshots after current index (fork in history)
  const trimmedSnapshots = chapterSnapshots.slice(0, currentIdx + 1);
  
  // Create new snapshot
  const snapshot = createSnapshot(chapter, reason);
  if (category) {
    snapshot.metadata = { ...snapshot.metadata, wordCount: snapshot.metadata?.wordCount || 0, category };
  }
  
  trimmedSnapshots.push(snapshot);
  
  // Enforce max snapshots limit
  while (trimmedSnapshots.length > state.maxSnapshots) {
    trimmedSnapshots.shift();
  }
  
  // Update state
  state.snapshots.set(chapter.id, trimmedSnapshots);
  state.currentIndex.set(chapter.id, trimmedSnapshots.length - 1);
  
  console.log(`[UndoService] Recorded change for chapter ${chapter.number}: ${reason}`);
}

/**
 * Undoes the last change to a specific chapter
 */
export function undoChapterChange(
  sessionId: string,
  chapterId: string
): ChapterSnapshot | null {
  const state = undoStates.get(sessionId);
  if (!state) {
    console.warn(`[UndoService] Session ${sessionId} not found`);
    return null;
  }
  
  const snapshots = state.snapshots.get(chapterId);
  const currentIdx = state.currentIndex.get(chapterId);
  
  if (!snapshots || currentIdx === undefined || currentIdx <= 0) {
    console.log(`[UndoService] Nothing to undo for chapter ${chapterId}`);
    return null;
  }
  
  // Move to previous snapshot
  const newIdx = currentIdx - 1;
  state.currentIndex.set(chapterId, newIdx);
  
  const previousSnapshot = snapshots[newIdx];
  console.log(`[UndoService] Undo chapter ${previousSnapshot.chapterNumber}: reverted to "${previousSnapshot.reason}"`);
  
  return previousSnapshot;
}

/**
 * Redoes the next change to a specific chapter
 */
export function redoChapterChange(
  sessionId: string,
  chapterId: string
): ChapterSnapshot | null {
  const state = undoStates.get(sessionId);
  if (!state) {
    console.warn(`[UndoService] Session ${sessionId} not found`);
    return null;
  }
  
  const snapshots = state.snapshots.get(chapterId);
  const currentIdx = state.currentIndex.get(chapterId);
  
  if (!snapshots || currentIdx === undefined || currentIdx >= snapshots.length - 1) {
    console.log(`[UndoService] Nothing to redo for chapter ${chapterId}`);
    return null;
  }
  
  // Move to next snapshot
  const newIdx = currentIdx + 1;
  state.currentIndex.set(chapterId, newIdx);
  
  const nextSnapshot = snapshots[newIdx];
  console.log(`[UndoService] Redo chapter ${nextSnapshot.chapterNumber}: restored "${nextSnapshot.reason}"`);
  
  return nextSnapshot;
}

/**
 * Gets the undo/redo status for a chapter
 */
export function getChapterUndoStatus(
  sessionId: string,
  chapterId: string
): { canUndo: boolean; canRedo: boolean; historyCount: number; currentIndex: number } {
  const state = undoStates.get(sessionId);
  if (!state) {
    return { canUndo: false, canRedo: false, historyCount: 0, currentIndex: 0 };
  }
  
  const snapshots = state.snapshots.get(chapterId) || [];
  const currentIdx = state.currentIndex.get(chapterId) || 0;
  
  return {
    canUndo: currentIdx > 0,
    canRedo: currentIdx < snapshots.length - 1,
    historyCount: snapshots.length,
    currentIndex: currentIdx,
  };
}

/**
 * Gets the change history for a chapter
 */
export function getChapterHistory(
  sessionId: string,
  chapterId: string
): ChapterSnapshot[] {
  const state = undoStates.get(sessionId);
  if (!state) {
    return [];
  }
  
  return state.snapshots.get(chapterId) || [];
}

/**
 * Reverts a chapter to a specific snapshot
 */
export function revertToSnapshot(
  sessionId: string,
  chapterId: string,
  snapshotId: string
): ChapterSnapshot | null {
  const state = undoStates.get(sessionId);
  if (!state) {
    return null;
  }
  
  const snapshots = state.snapshots.get(chapterId);
  if (!snapshots) {
    return null;
  }
  
  const snapshotIdx = snapshots.findIndex(s => s.id === snapshotId);
  if (snapshotIdx === -1) {
    return null;
  }
  
  state.currentIndex.set(chapterId, snapshotIdx);
  
  console.log(`[UndoService] Reverted chapter ${chapterId} to snapshot ${snapshotId}`);
  
  return snapshots[snapshotIdx];
}

/**
 * Applies a snapshot to a novel state (creates updated state)
 */
export function applySnapshot(
  novelState: NovelState,
  snapshot: ChapterSnapshot
): NovelState {
  return {
    ...novelState,
    chapters: novelState.chapters.map(ch =>
      ch.id === snapshot.chapterId
        ? {
            ...ch,
            content: snapshot.content,
            title: snapshot.title || ch.title,
            summary: snapshot.summary || ch.summary,
          }
        : ch
    ),
  };
}

/**
 * Bulk undo all changes in a session
 */
export function undoAllChanges(sessionId: string): Map<string, ChapterSnapshot> {
  const state = undoStates.get(sessionId);
  const reverted = new Map<string, ChapterSnapshot>();
  
  if (!state) {
    return reverted;
  }
  
  // Revert all chapters to their initial state
  state.snapshots.forEach((snapshots, chapterId) => {
    if (snapshots.length > 0) {
      state.currentIndex.set(chapterId, 0);
      reverted.set(chapterId, snapshots[0]);
    }
  });
  
  console.log(`[UndoService] Reverted all changes in session ${sessionId}`);
  
  return reverted;
}

/**
 * Clears the undo session
 */
export function clearUndoSession(sessionId: string): void {
  undoStates.delete(sessionId);
  console.log(`[UndoService] Cleared session ${sessionId}`);
}

/**
 * Gets all active undo sessions
 */
export function getActiveSessions(): string[] {
  return Array.from(undoStates.keys());
}

/**
 * Gets session info
 */
export function getSessionInfo(sessionId: string): {
  novelId: string;
  chaptersTracked: number;
  totalSnapshots: number;
} | null {
  const state = undoStates.get(sessionId);
  if (!state) {
    return null;
  }
  
  let totalSnapshots = 0;
  state.snapshots.forEach(snapshots => {
    totalSnapshots += snapshots.length;
  });
  
  return {
    novelId: state.novelId,
    chaptersTracked: state.snapshots.size,
    totalSnapshots,
  };
}
