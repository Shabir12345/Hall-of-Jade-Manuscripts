import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult, ImprovementHistory } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { EmptyState } from './EmptyState';
import { getDraftManagement, compareDrafts } from '../services/draftManager';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { getImprovementHistory } from '../services/novelImprovementService';
import { formatRelativeTime } from '../utils/timeUtils';
import { RelatedViews, RELATED_VIEWS_MAP } from './RelatedViews';

interface DraftComparisonViewProps {
  novelState: NovelState;
}

const DraftComparisonView: React.FC<DraftComparisonViewProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);
  const [improvementHistory, setImprovementHistory] = useState<ImprovementHistory[]>([]);
  const { updateActiveNovel, activeNovel } = useNovel();
  const { showSuccess, showError, showWarning } = useToast();

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'excellence',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = useCallback((
    result: ImprovementExecutionResult,
    improvedState: NovelState
  ) => {
    try {
      // Validation: Ensure we have an active novel
      if (!activeNovel) {
        showError('No active novel selected. Cannot apply improvements.');
        setImprovementDialogOpen(false);
        return;
      }

      // Validation: Ensure improved state matches active novel ID
      if (improvedState.id !== activeNovel.id) {
        showError('Improved state does not match active novel. Cannot apply improvements.');
        setImprovementDialogOpen(false);
        return;
      }

      // Validation: Check if improvements were successful
      if (!result.success) {
        const errorMessage = result.failures.length > 0
          ? `Improvements failed: ${result.failures[0].error}`
          : 'Improvements did not complete successfully';
        showError(errorMessage);
        setImprovementDialogOpen(false);
        return;
      }

      // Validation: Check if improved state is valid
      if (!improvedState || !improvedState.chapters || improvedState.chapters.length === 0) {
        showError('Improved state is invalid. Cannot apply improvements.');
        setImprovementDialogOpen(false);
        return;
      }

      // Apply the improved state
      updateActiveNovel(() => improvedState);

      // Generate user feedback message based on results
      const changes = [];
      if (result.chaptersEdited > 0) {
        changes.push(`${result.chaptersEdited} chapter${result.chaptersEdited !== 1 ? 's' : ''} edited`);
      }
      if (result.chaptersInserted > 0) {
        changes.push(`${result.chaptersInserted} chapter${result.chaptersInserted !== 1 ? 's' : ''} inserted`);
      }
      if (result.chaptersRegenerated > 0) {
        changes.push(`${result.chaptersRegenerated} chapter${result.chaptersRegenerated !== 1 ? 's' : ''} regenerated`);
      }

      const changeSummary = changes.length > 0
        ? changes.join(', ')
        : 'No changes made';

      // Show success message with details
      const scoreChange = result.scoreImprovement;
      const scoreMessage = scoreChange > 0
        ? `Score improved by ${scoreChange.toFixed(1)} points (${result.scoreBefore.toFixed(1)} → ${result.scoreAfter.toFixed(1)})`
        : scoreChange < 0
        ? `Score changed by ${scoreChange.toFixed(1)} points (${result.scoreBefore.toFixed(1)} → ${result.scoreAfter.toFixed(1)})`
        : `Score remained at ${result.scoreBefore.toFixed(1)}`;

      showSuccess(
        `Improvements applied successfully! ${changeSummary}. ${scoreMessage}.`,
        6000
      );

      // Show warnings if any
      if (result.validationResults.warnings.length > 0) {
        result.validationResults.warnings.slice(0, 3).forEach(warning => {
          showWarning(warning, 5000);
        });
      }

      // Close dialog
      setImprovementDialogOpen(false);

      // Reload improvement history
      getImprovementHistory(novelState.id).then(history => {
        const categoryHistory = history.filter(h => h.category === 'excellence');
        setImprovementHistory(categoryHistory);
      }).catch(error => {
        console.error('Failed to reload improvement history', error);
      });
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error
        ? error.message
        : 'An unexpected error occurred while applying improvements';
      showError(`Failed to apply improvements: ${errorMessage}`);
      setImprovementDialogOpen(false);
    }
  }, [activeNovel, updateActiveNovel, showSuccess, showError, showWarning, novelState.id]);

  const draftManagement = useMemo(() => getDraftManagement(novelState), [novelState]);

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      {/* Improvement Button */}
      <div className="mb-4 flex justify-end items-center gap-3">
        <button
          onClick={handleImproveNovel}
          className="relative px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-amber-900/20 hover:shadow-xl hover:shadow-amber-900/30"
        >
          <span>📝</span>
          <span>Improve Novel</span>
          {improvementHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-zinc-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {improvementHistory.length}
            </span>
          )}
        </button>
        {improvementHistory.length > 0 && improvementHistory[0] && (
          <div className="text-xs text-zinc-400">
            Last: {formatRelativeTime(improvementHistory[0].timestamp)}
          </div>
        )}
      </div>

      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Draft Comparison
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Compare draft versions and track quality progression</p>
      </div>

      {draftManagement.drafts.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No Drafts Yet"
          description="Draft comparison tracks quality progression across different versions of your novel. Create drafts to start tracking improvements."
        />
      ) : (
        <>
          <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase">Draft Progression</h3>
            <div className="space-y-4">
              {draftManagement.draftProgression.map((progression) => (
                <div key={progression.draftNumber} className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-amber-400">Draft {progression.draftNumber}</div>
                    <div className="text-lg font-bold text-zinc-300">{progression.qualityScore}/100</div>
                  </div>
                  {progression.improvement !== 0 && (
                    <div className={`text-xs ${progression.improvement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {progression.improvement > 0 ? '+' : ''}{progression.improvement} points
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {draftManagement.recommendations.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Recommendations</h3>
              <ul className="space-y-2">
                {draftManagement.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-zinc-300 flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Improvement Dialog */}
      {improvementRequest && (
        <NovelImprovementDialog
          isOpen={improvementDialogOpen}
          novelState={novelState}
          request={improvementRequest}
          onClose={() => setImprovementDialogOpen(false)}
          onComplete={handleImprovementComplete}
        />
      )}
    </div>
  );
};

export default DraftComparisonView;
