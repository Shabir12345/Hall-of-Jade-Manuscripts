/**
 * World Management Hook
 * Extracts world entry management logic from App.tsx
 */

import { useState, useCallback } from 'react';
import type { WorldEntry } from '../types';

interface UseWorldManagementResult {
  editingWorld: WorldEntry | null;
  setEditingWorld: (entry: WorldEntry | null) => void;
  handleSaveWorldEntry: (entry: WorldEntry) => void;
  handleDeleteWorldEntry: (entryId: string) => void;
}

export function useWorldManagement(
  activeNovel: any,
  updateActiveNovel: (updater: (prev: any) => any) => void,
  onConfirm: (config: { title: string; message: string; onConfirm: () => void; variant?: string }) => void,
  showSuccess: (message: string) => void,
  showError: (message: string) => void,
  validateWorldEntryInput: (entry: WorldEntry) => { valid: boolean; error?: string }
): UseWorldManagementResult {
  const [editingWorld, setEditingWorld] = useState<WorldEntry | null>(null);

  const handleSaveWorldEntry = useCallback((entry: WorldEntry) => {
    if (!activeNovel) return;

    const validation = validateWorldEntryInput(entry);
    if (!validation.valid) {
      showError(validation.error || 'Invalid world entry');
      return;
    }

    updateActiveNovel((prev) => {
      const existingIndex = prev.worldBible.findIndex((e: WorldEntry) => e.id === entry.id);
      const updatedBible = existingIndex > -1
        ? prev.worldBible.map((e: WorldEntry, idx: number) => idx === existingIndex ? entry : e)
        : [...prev.worldBible, entry];

      return {
        ...prev,
        worldBible: updatedBible,
        updatedAt: Date.now(),
      };
    });

    setEditingWorld(null);
    showSuccess('World entry saved successfully');
  }, [activeNovel, updateActiveNovel, validateWorldEntryInput, showSuccess, showError]);

  const handleDeleteWorldEntry = useCallback((entryId: string) => {
    if (!activeNovel) return;

    const entry = activeNovel.worldBible.find((e: WorldEntry) => e.id === entryId);
    if (!entry) return;

    onConfirm({
      title: 'Delete World Entry',
      message: `Erase "${entry.title}" from the chronicles? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel((prev) => ({
          ...prev,
          worldBible: prev.worldBible.filter((e: WorldEntry) => e.id !== entryId),
          updatedAt: Date.now(),
        }));
        showSuccess('World entry deleted successfully');
      },
    });
  }, [activeNovel, updateActiveNovel, onConfirm, showSuccess]);

  return {
    editingWorld,
    setEditingWorld,
    handleSaveWorldEntry,
    handleDeleteWorldEntry,
  };
}
