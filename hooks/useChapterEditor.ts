import { useState, useCallback, useRef } from 'react';
import type { Chapter, NovelState } from '../types';

/**
 * Hook for managing chapter editor state
 * Extracted from App.tsx to improve code organization
 */
export function useChapterEditor() {
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const originalContentRef = useRef<string>('');

  const startEditing = useCallback((chapter: Chapter) => {
    setEditingChapter(chapter);
    originalContentRef.current = chapter.content;
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    if (editingChapter) {
      // Restore original content
      setEditingChapter({
        ...editingChapter,
        content: originalContentRef.current,
      });
    }
    setIsEditing(false);
    setEditingChapter(null);
    originalContentRef.current = '';
  }, [editingChapter]);

  const saveEditing = useCallback((updatedChapter: Chapter) => {
    setEditingChapter(updatedChapter);
    setIsEditing(false);
    originalContentRef.current = '';
    return updatedChapter;
  }, []);

  const updateContent = useCallback((content: string) => {
    if (editingChapter) {
      setEditingChapter({
        ...editingChapter,
        content,
      });
    }
  }, [editingChapter]);

  return {
    editingChapter,
    isEditing,
    startEditing,
    cancelEditing,
    saveEditing,
    updateContent,
    hasUnsavedChanges: editingChapter 
      ? editingChapter.content !== originalContentRef.current 
      : false,
  };
}
