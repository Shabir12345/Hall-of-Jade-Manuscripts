import { useState, useCallback } from 'react';

/**
 * Hook for batch operations (delete, move, etc.)
 * Useful for managing multiple items at once
 * 
 * @param onBatchComplete - Callback when batch operation completes
 * @returns [selectedIds, toggleSelection, clearSelection, selectAll, isSelected, selectedCount, executeBatch]
 */
export function useBatchOperations<T extends { id: string }>(
  onBatchComplete?: (ids: string[]) => void
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map(item => item.id)));
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const selectedCount = selectedIds.size;

  const executeBatch = useCallback(
    async <R>(
      operation: (ids: string[]) => Promise<R>,
      items?: T[]
    ): Promise<R> => {
      const ids = items 
        ? items.filter(item => selectedIds.has(item.id)).map(item => item.id)
        : Array.from(selectedIds);

      if (ids.length === 0) {
        throw new Error('No items selected');
      }

      try {
        const result = await operation(ids);
        clearSelection();
        onBatchComplete?.(ids);
        return result;
      } catch (error) {
        throw error;
      }
    },
    [selectedIds, clearSelection, onBatchComplete]
  );

  return {
    selectedIds: Array.from(selectedIds),
    toggleSelection,
    clearSelection,
    selectAll,
    isSelected,
    selectedCount,
    executeBatch,
  };
}
