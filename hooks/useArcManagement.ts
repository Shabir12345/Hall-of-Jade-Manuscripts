/**
 * Arc Management Hook
 * Extracts arc management logic from App.tsx
 */

import { useState, useCallback } from 'react';
import type { Arc, Antagonist } from '../types';

interface UseArcManagementResult {
  editingArc: Arc | null;
  setEditingArc: (arc: Arc | null) => void;
  arcAntagonists: Antagonist[];
  isLoadingArcAntagonists: boolean;
  handleSaveArc: (arc: Arc) => void;
  handleDeleteArc: (arcId: string) => void;
  loadArcAntagonists: (arcId: string) => Promise<void>;
}

export function useArcManagement(
  activeNovel: any,
  updateActiveNovel: (updater: (prev: any) => any) => void,
  onConfirm: (config: { title: string; message: string; onConfirm: () => void; variant?: string }) => void,
  showSuccess: (message: string) => void,
  showError: (message: string) => void,
  getAntagonistsForArc: (arcId: string) => Promise<Antagonist[]>
): UseArcManagementResult {
  const [editingArc, setEditingArc] = useState<Arc | null>(null);
  const [arcAntagonists, setArcAntagonists] = useState<Antagonist[]>([]);
  const [isLoadingArcAntagonists, setIsLoadingArcAntagonists] = useState(false);

  const loadArcAntagonists = useCallback(async (arcId: string) => {
    if (!arcId) {
      setArcAntagonists([]);
      return;
    }

    setIsLoadingArcAntagonists(true);
    try {
      const antagonists = await getAntagonistsForArc(arcId);
      setArcAntagonists(antagonists);
    } catch (error) {
      console.error('Error loading arc antagonists:', error);
      setArcAntagonists([]);
    } finally {
      setIsLoadingArcAntagonists(false);
    }
  }, [getAntagonistsForArc]);

  const handleSaveArc = useCallback((arc: Arc) => {
    if (!activeNovel) return;

    if (!arc.title || arc.title.trim() === '') {
      showError('Arc title is required');
      return;
    }

    updateActiveNovel((prev) => {
      const existingIndex = prev.plotLedger.findIndex((a: Arc) => a.id === arc.id);
      const updatedLedger = existingIndex > -1
        ? prev.plotLedger.map((a: Arc, idx: number) => idx === existingIndex ? arc : a)
        : [...prev.plotLedger, arc];

      // Ensure only one active arc
      const normalizedLedger = arc.status === 'active'
        ? updatedLedger.map((a: Arc) => ({
            ...a,
            status: a.id === arc.id ? 'active' : 'completed',
          }))
        : updatedLedger;

      return {
        ...prev,
        plotLedger: normalizedLedger,
        updatedAt: Date.now(),
      };
    });

    setEditingArc(null);
    showSuccess('Arc saved successfully');
  }, [activeNovel, updateActiveNovel, showSuccess, showError]);

  const handleDeleteArc = useCallback((arcId: string) => {
    if (!activeNovel) return;

    const arc = activeNovel.plotLedger.find((a: Arc) => a.id === arcId);
    if (!arc) return;

    onConfirm({
      title: 'Delete Arc',
      message: `Erase "${arc.title}" from the chronicles? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel((prev) => ({
          ...prev,
          plotLedger: prev.plotLedger.filter((a: Arc) => a.id !== arcId),
          updatedAt: Date.now(),
        }));
        setEditingArc(null);
        showSuccess('Arc deleted successfully');
      },
    });
  }, [activeNovel, updateActiveNovel, onConfirm, showSuccess]);

  return {
    editingArc,
    setEditingArc,
    arcAntagonists,
    isLoadingArcAntagonists,
    handleSaveArc,
    handleDeleteArc,
    loadArcAntagonists,
  };
}
