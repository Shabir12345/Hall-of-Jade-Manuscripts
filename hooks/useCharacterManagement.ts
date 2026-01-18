/**
 * Character Management Hook
 * Extracts character management logic from App.tsx
 */

import { useState, useCallback } from 'react';
import type { Character } from '../types';

interface UseCharacterManagementResult {
  editingChar: Character | null;
  setEditingChar: (char: Character | null) => void;
  handleSaveCharacter: (char: Character) => void;
  handleDeleteCharacter: (charId: string) => void;
  handleSetProtagonist: (charId: string) => void;
}

export function useCharacterManagement(
  activeNovel: any,
  updateActiveNovel: (updater: (prev: any) => any) => void,
  onConfirm: (config: { title: string; message: string; onConfirm: () => void; variant?: string }) => void,
  showSuccess: (message: string) => void,
  showError: (message: string) => void
): UseCharacterManagementResult {
  const [editingChar, setEditingChar] = useState<Character | null>(null);

  const handleSaveCharacter = useCallback((char: Character) => {
    if (!activeNovel) return;

    updateActiveNovel((prev) => {
      const existingIndex = prev.characterCodex.findIndex((c: Character) => c.id === char.id);
      const updatedCodex = existingIndex > -1
        ? prev.characterCodex.map((c: Character, idx: number) => idx === existingIndex ? char : c)
        : [...prev.characterCodex, char];

      return {
        ...prev,
        characterCodex: updatedCodex,
        updatedAt: Date.now(),
      };
    });

    setEditingChar(null);
    showSuccess('Character saved successfully');
  }, [activeNovel, updateActiveNovel, showSuccess]);

  const handleDeleteCharacter = useCallback((charId: string) => {
    if (!activeNovel) return;

    const char = activeNovel.characterCodex.find((c: Character) => c.id === charId);
    if (!char) return;

    onConfirm({
      title: 'Delete Character',
      message: `Erase ${char.name} from the chronicles? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel((prev) => ({
          ...prev,
          characterCodex: prev.characterCodex.filter((c: Character) => c.id !== charId),
          updatedAt: Date.now(),
        }));
        setEditingChar(null);
        showSuccess('Character deleted successfully');
      },
    });
  }, [activeNovel, updateActiveNovel, onConfirm, showSuccess]);

  const handleSetProtagonist = useCallback((charId: string) => {
    if (!activeNovel) return;

    updateActiveNovel((prev) => ({
      ...prev,
      characterCodex: prev.characterCodex.map((c: Character) => ({
        ...c,
        isProtagonist: c.id === charId ? !c.isProtagonist : c.isProtagonist,
      })),
      updatedAt: Date.now(),
    }));
  }, [activeNovel, updateActiveNovel]);

  return {
    editingChar,
    setEditingChar,
    handleSaveCharacter,
    handleDeleteCharacter,
    handleSetProtagonist,
  };
}
