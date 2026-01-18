import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult, ImprovementHistory } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { EmptyState } from './EmptyState';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { getImprovementHistory } from '../services/novelImprovementService';
import { formatRelativeTime } from '../utils/timeUtils';
import { analyzeLiteraryDevices } from '../services/literaryDeviceAnalyzer';
import { RelatedViews, RELATED_VIEWS_MAP } from './RelatedViews';

interface DeviceDashboardProps {
  novelState: NovelState;
}

const DeviceDashboard: React.FC<DeviceDashboardProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);
  const [improvementHistory, setImprovementHistory] = useState<ImprovementHistory[]>([]);
  const { updateActiveNovel, activeNovel } = useNovel();
  const { showSuccess, showError, showWarning } = useToast();

  const handleImproveNovel = () => {
    // Calculate target score: 90 or current + 30, whichever is lower
    const currentScore = literaryDevices.overallDeviceScore;
    const targetScore = Math.min(90, Math.max(currentScore + 30, currentScore + 10));
    
    setImprovementRequest({
      category: 'literary_devices',
      scope: 'comprehensive',
      targetScore,
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
        const categoryHistory = history.filter(h => h.category === 'literary_devices');
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

  const deviceAnalysis = useMemo(() => analyzeLiteraryDevices(novelState), [novelState]);
  const totalChapters = novelState.chapters.length || 0;

  const getScoreColor = (score: number) => 
    score >= 80 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

  // Empty state - need at least 2 chapters for device analysis
  if (totalChapters < 2) {
    return (
      <div className="p-4 md:p-5 lg:p-6 max-w-6xl mx-auto pt-12 md:pt-16">
        <div className="mb-6 border-b border-zinc-700 pb-4">
          <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
            Literary Devices Dashboard
          </h2>
          <p className="text-sm text-zinc-400 mt-2">Literary device usage, effectiveness, and synergy analysis</p>
        </div>
        <EmptyState
          icon="✨"
          title="Not Enough Chapters Yet"
          description="Generate at least 2 chapters to enable literary device analysis. This view tracks metaphors, symbolism, foreshadowing, and other literary techniques across your story."
        />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      {/* Improvement Button */}
      <div className="mb-4 flex justify-end items-center gap-3">
        <button
          onClick={handleImproveNovel}
          className="relative px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg shadow-amber-900/20 hover:shadow-xl hover:shadow-amber-900/30"
        >
          <span>✨</span>
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
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Literary Devices Dashboard
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Literary device usage, effectiveness, and synergy analysis</p>
      </div>

      <div className="mb-8 bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-amber-500 rounded-xl p-8 text-center">
        <div className={`text-3xl font-fantasy font-bold mb-2 ${getScoreColor(deviceAnalysis.overallDeviceScore)}`}>
          {deviceAnalysis.overallDeviceScore}/100
        </div>
        <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Device Score</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(deviceAnalysis.deviceFrequency).slice(0, 12).map(([deviceType, count]) => (
          <div key={deviceType} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="text-sm font-bold text-amber-400 mb-2 capitalize">{deviceType.replace(/_/g, ' ')}</div>
            <div className="text-3xl font-bold text-zinc-300 mb-1">{count}</div>
            <div className="text-xs text-zinc-500">Occurrences</div>
          </div>
        ))}
      </div>

      {deviceAnalysis.effectiveDevices.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Most Effective Devices</h3>
          <div className="space-y-3">
            {deviceAnalysis.effectiveDevices.slice(0, 5).map((device) => (
              <div key={device.id} className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-emerald-400 capitalize">{device.deviceType.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold text-emerald-400">{device.effectivenessScore}/100</div>
                </div>
                <div className="text-xs text-zinc-400">Ch {device.chapterNumber}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deviceAnalysis.recommendations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Recommendations</h3>
          <ul className="space-y-2">
            {deviceAnalysis.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start">
                <span className="text-amber-500 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DeviceDashboard;
