/**
 * Chapter Store
 * Manages chapter editing state using Zustand
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Chapter, Scene } from '../types';

interface ChapterStore {
  // Chapter editing state
  editingChapterId: string | null;
  editingContent: string;
  editingTitle: string;
  editingScenes: Scene[];
  isAiEditing: boolean;
  aiEditInstruction: string;

  // Actions
  setEditingChapter: (chapter: Chapter) => void;
  updateContent: (content: string) => void;
  updateTitle: (title: string) => void;
  updateScenes: (scenes: Scene[]) => void;
  setAiEditing: (isEditing: boolean) => void;
  setAiEditInstruction: (instruction: string) => void;
  reset: () => void;
}

export const useChapterStore = create<ChapterStore>()(
  devtools(
    (set) => ({
      // Initial State
      editingChapterId: null,
      editingContent: '',
      editingTitle: '',
      editingScenes: [],
      isAiEditing: false,
      aiEditInstruction: '',

      // Actions
      setEditingChapter: (chapter) =>
        set({
          editingChapterId: chapter.id,
          editingContent: chapter.content,
          editingTitle: chapter.title,
          editingScenes: chapter.scenes || [],
        }),

      updateContent: (content) => set({ editingContent: content }),

      updateTitle: (title) => set({ editingTitle: title }),

      updateScenes: (scenes) => set({ editingScenes: scenes }),

      setAiEditing: (isEditing) => set({ isAiEditing: isEditing }),

      setAiEditInstruction: (instruction) => set({ aiEditInstruction: instruction }),

      reset: () =>
        set({
          editingChapterId: null,
          editingContent: '',
          editingTitle: '',
          editingScenes: [],
          isAiEditing: false,
          aiEditInstruction: '',
        }),
    }),
    { name: 'ChapterStore' }
  )
);

// Selectors
export const useEditingChapter = () =>
  useChapterStore((state) => ({
    id: state.editingChapterId,
    content: state.editingContent,
    title: state.editingTitle,
    scenes: state.editingScenes,
  }));
