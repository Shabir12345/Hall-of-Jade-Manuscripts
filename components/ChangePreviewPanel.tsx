import React, { useState, useMemo } from 'react';
import { ImprovementStrategy, EditAction, InsertAction, RegenerateAction } from '../types/improvement';
import { NovelState, Chapter } from '../types';

interface ChangePreviewPanelProps {
  strategy: ImprovementStrategy;
  novelState: NovelState;
  onAcceptAll: () => void;
  onExecuteSelected: (selectedActions: string[]) => void;
  onCancel: () => void;
}

interface ActionPreview {
  id: string;
  type: 'edit' | 'insert' | 'regenerate';
  chapterNumber?: number;
  chapterTitle?: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedWords?: number;
  selected: boolean;
}

/**
 * ChangePreviewPanel - Shows proposed changes before execution
 * Allows users to select which changes to apply
 */
const ChangePreviewPanel: React.FC<ChangePreviewPanelProps> = ({
  strategy,
  novelState,
  onAcceptAll,
  onExecuteSelected,
  onCancel,
}) => {
  // Convert strategy actions to preview items
  const actionPreviews = useMemo(() => {
    const previews: ActionPreview[] = [];
    let actionId = 0;

    // Edit actions
    strategy.editActions?.forEach((action) => {
      const chapter = novelState.chapters.find(ch => ch.id === action.chapterId);
      previews.push({
        id: `edit-${actionId++}`,
        type: 'edit',
        chapterNumber: action.chapterNumber,
        chapterTitle: chapter?.title || `Chapter ${action.chapterNumber}`,
        description: action.description,
        impact: action.estimatedWordCount && action.estimatedWordCount > 500 ? 'high' : 'medium',
        estimatedWords: action.estimatedWordCount,
        selected: true,
      });
    });

    // Insert actions
    strategy.insertActions?.forEach((action) => {
      previews.push({
        id: `insert-${actionId++}`,
        type: 'insert',
        chapterNumber: action.position,
        description: `Insert ${action.chapterCount} chapter(s) after Chapter ${action.position}: ${action.purpose}`,
        impact: 'high',
        estimatedWords: action.estimatedWordCount,
        selected: true,
      });
    });

    // Regenerate actions
    strategy.regenerateActions?.forEach((action) => {
      const chapter = novelState.chapters.find(ch => ch.id === action.chapterId);
      previews.push({
        id: `regenerate-${actionId++}`,
        type: 'regenerate',
        chapterNumber: action.chapterNumber,
        chapterTitle: chapter?.title || `Chapter ${action.chapterNumber}`,
        description: `Regenerate chapter with focus on: ${action.focusAreas.join(', ')}`,
        impact: 'high',
        estimatedWords: chapter?.content.split(/\s+/).length,
        selected: true,
      });
    });

    return previews;
  }, [strategy, novelState]);

  const [selections, setSelections] = useState<Record<string, boolean>>(
    Object.fromEntries(actionPreviews.map(a => [a.id, a.selected]))
  );

  const selectedCount = Object.values(selections).filter(Boolean).length;
  const totalCount = actionPreviews.length;

  const handleToggle = (id: string) => {
    setSelections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAll = () => {
    setSelections(Object.fromEntries(actionPreviews.map(a => [a.id, true])));
  };

  const handleDeselectAll = () => {
    setSelections(Object.fromEntries(actionPreviews.map(a => [a.id, false])));
  };

  const handleExecute = () => {
    const selectedIds = Object.entries(selections)
      .filter(([_, selected]) => selected)
      .map(([id]) => id);
    onExecuteSelected(selectedIds);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-900/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30';
      case 'low': return 'text-green-400 bg-green-900/30';
      default: return 'text-zinc-400 bg-zinc-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'edit': return '✏️';
      case 'insert': return '➕';
      case 'regenerate': return '🔄';
      default: return '📝';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'edit': return 'bg-blue-600';
      case 'insert': return 'bg-green-600';
      case 'regenerate': return 'bg-purple-600';
      default: return 'bg-zinc-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-amber-400 mb-2">
          Preview Proposed Changes
        </h3>
        <p className="text-zinc-400 text-sm">
          Review and select which changes to apply. You can deselect any changes you don't want.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{totalCount}</div>
          <div className="text-sm text-zinc-400">Total Changes</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-amber-400">{selectedCount}</div>
          <div className="text-sm text-zinc-400">Selected</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">
            {actionPreviews.filter(a => a.type === 'edit').length}
          </div>
          <div className="text-sm text-zinc-400">Edits</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">
            {actionPreviews.filter(a => a.type === 'insert').length}
          </div>
          <div className="text-sm text-zinc-400">Insertions</div>
        </div>
      </div>

      {/* Selection controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1 text-sm bg-zinc-700 hover:bg-zinc-600 text-white rounded"
          >
            Deselect All
          </button>
        </div>
        <div className="text-sm text-zinc-400">
          {selectedCount} of {totalCount} changes selected
        </div>
      </div>

      {/* Action list */}
      <div className="border border-zinc-700 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {actionPreviews.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No changes proposed for this category.
            </div>
          ) : (
            <div className="divide-y divide-zinc-700">
              {actionPreviews.map((action) => (
                <div
                  key={action.id}
                  className={`p-4 transition-colors ${
                    selections[action.id] 
                      ? 'bg-zinc-800/50' 
                      : 'bg-zinc-900/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selections[action.id]}
                      onChange={() => handleToggle(action.id)}
                      className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500"
                      aria-label={`Select ${action.type} action for Chapter ${action.chapterNumber || 'N/A'}`}
                      title={`Toggle ${action.type} action`}
                    />

                    {/* Action details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Type badge */}
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${getTypeColor(action.type)}`}>
                          {getTypeIcon(action.type)} {action.type.toUpperCase()}
                        </span>
                        
                        {/* Impact badge */}
                        <span className={`px-2 py-0.5 rounded text-xs ${getImpactColor(action.impact)}`}>
                          {action.impact} impact
                        </span>

                        {/* Chapter info */}
                        {action.chapterNumber && (
                          <span className="text-sm text-zinc-400">
                            Chapter {action.chapterNumber}
                            {action.chapterTitle && `: ${action.chapterTitle}`}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-zinc-300 text-sm">
                        {action.description}
                      </p>

                      {/* Estimated words */}
                      {action.estimatedWords && (
                        <p className="text-xs text-zinc-500 mt-1">
                          ~{action.estimatedWords} words
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expected improvement */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-amber-400 font-semibold">Expected Improvement</h4>
            <p className="text-zinc-400 text-sm mt-1">
              Based on selected changes: +{Math.round(strategy.expectedImprovement * (selectedCount / totalCount))} points estimated
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {strategy.targetScore} → {Math.min(100, strategy.goalScore || strategy.targetScore + strategy.expectedImprovement)}
            </div>
            <div className="text-sm text-zinc-400">Score target</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleExecute}
          disabled={selectedCount === 0}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            selectedCount > 0
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          Execute {selectedCount} Change{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
};

export default ChangePreviewPanel;
