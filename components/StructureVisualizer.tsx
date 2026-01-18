import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult, ImprovementHistory } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { EmptyState } from './EmptyState';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { getImprovementHistory } from '../services/novelImprovementService';
import { formatRelativeTime } from '../utils/timeUtils';
import { analyzeStoryStructure } from '../services/storyStructureAnalyzer';
import { analyzeHeroJourney } from '../services/heroJourneyTracker';
import { analyzeSaveTheCat } from '../services/beatSheetAnalyzer';
import { RelatedViews, RELATED_VIEWS_MAP } from './RelatedViews';

interface StructureVisualizerProps {
  novelState: NovelState;
}

const StructureVisualizer: React.FC<StructureVisualizerProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);
  const [improvementHistory, setImprovementHistory] = useState<ImprovementHistory[]>([]);
  const { updateActiveNovel, activeNovel } = useNovel();
  const { showSuccess, showError, showWarning } = useToast();

  const handleImproveNovel = () => {
    // Calculate target score: 90 or current + 30, whichever is lower
    const currentScore = structureAnalysis.overallStructureScore;
    const targetScore = Math.min(90, Math.max(currentScore + 30, currentScore + 10));
    
    setImprovementRequest({
      category: 'structure',
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
        const categoryHistory = history.filter(h => h.category === 'structure');
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

  // Load improvement history on mount
  useEffect(() => {
    getImprovementHistory(novelState.id)
      .then(history => {
        const categoryHistory = history.filter(h => h.category === 'structure');
        setImprovementHistory(categoryHistory);
      })
      .catch(error => {
        console.error('Failed to load improvement history', error);
      });
  }, [novelState.id]);

  const structureAnalysis = useMemo(() => analyzeStoryStructure(novelState), [novelState]);
  const heroJourney = useMemo(() => analyzeHeroJourney(novelState), [novelState]);
  const beatSheet = useMemo(() => analyzeSaveTheCat(novelState), [novelState]);

  const totalChapters = novelState.chapters.length || 0;

  // Empty state - need at least 3 chapters for meaningful structure analysis
  if (totalChapters < 3) {
    return (
      <div className="p-4 md:p-5 lg:p-6 max-w-6xl mx-auto pt-12 md:pt-16">
        <div className="mb-6 border-b border-zinc-700 pb-4">
          <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
            Story Structure Visualizer
          </h2>
          <p className="text-sm text-zinc-400 mt-2">Visual analysis of story structure across multiple frameworks</p>
        </div>
        <EmptyState
          icon="🏛️"
          title="Not Enough Chapters Yet"
          description="Generate at least 3 chapters to enable structure analysis. Story structure visualization works best with multiple chapters to analyze patterns, acts, and beats."
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
          <span>🏛️</span>
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
          Story Structure Visualizer
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Visual analysis of story structure across multiple frameworks</p>
      </div>

      {/* Three-Act Structure Visualization */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Three-Act Structure</h3>
        
        {/* Visual Timeline */}
        <div className="mb-6">
          <div className="relative h-32 bg-zinc-800 rounded-lg overflow-hidden">
            {/* Act 1 */}
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center"
              style={{ width: `${structureAnalysis.threeActStructure.act1.percentage}%` }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 1</div>
                <div className="text-xs text-blue-100">{structureAnalysis.threeActStructure.act1.percentage.toFixed(1)}%</div>
              </div>
            </div>
            
            {/* Act 2 */}
            <div 
              className="absolute top-0 h-full bg-gradient-to-r from-amber-600 to-amber-500 flex items-center justify-center"
              style={{ 
                left: `${structureAnalysis.threeActStructure.act1.percentage}%`,
                width: `${structureAnalysis.threeActStructure.act2.percentage}%` 
              }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 2</div>
                <div className="text-xs text-amber-100">{structureAnalysis.threeActStructure.act2.percentage.toFixed(1)}%</div>
              </div>
            </div>
            
            {/* Act 3 */}
            <div 
              className="absolute top-0 right-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-center"
              style={{ width: `${structureAnalysis.threeActStructure.act3.percentage}%` }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 3</div>
                <div className="text-xs text-emerald-100">{structureAnalysis.threeActStructure.act3.percentage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Structure Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 1 (Setup)</div>
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {structureAnalysis.threeActStructure.act1.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 25%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act1.startChapter}-{structureAnalysis.threeActStructure.act1.endChapter}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 2 (Confrontation)</div>
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {structureAnalysis.threeActStructure.act2.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 50%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act2.startChapter}-{structureAnalysis.threeActStructure.act2.endChapter}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 3 (Resolution)</div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">
              {structureAnalysis.threeActStructure.act3.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 25%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act3.startChapter}-{structureAnalysis.threeActStructure.act3.endChapter}
            </div>
          </div>
        </div>

        {/* Story Beats */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-zinc-300 uppercase mb-3">Story Beats</h4>
          <div className="space-y-2">
            {structureAnalysis.detectedBeats.map((beat, index) => (
              <div key={index} className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    beat.strengthScore >= 70 ? 'bg-emerald-500' :
                    beat.strengthScore >= 50 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="text-sm font-bold text-amber-400">
                      {beat.beatType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-xs text-zinc-500">Ch {beat.chapterNumber} • {beat.positionPercentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-zinc-400">{beat.strengthScore}/100</div>
              </div>
            ))}
            {structureAnalysis.detectedBeats.length === 0 && (
              <div className="text-sm text-zinc-500 italic">No story beats detected yet</div>
            )}
          </div>
        </div>

        {/* Overall Structure Score */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-zinc-300">Overall Structure Score</span>
            <span className={`text-2xl font-bold ${
              structureAnalysis.overallStructureScore >= 80 ? 'text-emerald-400' :
              structureAnalysis.overallStructureScore >= 70 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {structureAnalysis.overallStructureScore}/100
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                structureAnalysis.overallStructureScore >= 80 ? 'bg-emerald-500' :
                structureAnalysis.overallStructureScore >= 70 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${structureAnalysis.overallStructureScore}%` }}
            ></div>
          </div>
        </div>

        {/* Recommendations */}
        {structureAnalysis.recommendations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <h4 className="text-sm font-bold text-zinc-300 uppercase mb-3">Recommendations</h4>
            <ul className="space-y-2">
              {structureAnalysis.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-zinc-300 flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Hero's Journey */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Hero's Journey (12 Stages)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {heroJourney.stages.map((stage) => (
            <div
              key={stage.id}
              className={`p-3 rounded-lg border-2 ${
                stage.isComplete && stage.qualityScore >= 70
                  ? 'bg-emerald-900/20 border-emerald-700'
                  : stage.isComplete
                  ? 'bg-amber-900/20 border-amber-700'
                  : 'bg-zinc-800/50 border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold text-amber-400">{stage.stageNumber}.</div>
                <div className={`text-xs font-bold ${
                  stage.isComplete && stage.qualityScore >= 70 ? 'text-emerald-400' :
                  stage.isComplete ? 'text-amber-400' :
                  'text-zinc-500'
                }`}>
                  {stage.isComplete ? `${stage.qualityScore}/100` : 'Incomplete'}
                </div>
              </div>
              <div className="text-sm text-zinc-300 font-semibold">{stage.stageName}</div>
              {stage.chapterNumber && (
                <div className="text-xs text-zinc-500 mt-1">Ch {stage.chapterNumber}</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-300">Journey Completion</span>
            <span className="text-xl font-bold text-amber-400">
              {heroJourney.completionPercentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mt-2">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${heroJourney.completionPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Save the Cat Beat Sheet */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Save the Cat Beat Sheet</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {beatSheet.beats.map((beat) => (
            <div
              key={beat.beatNumber}
              className={`p-3 rounded-lg border ${
                beat.detected
                  ? beat.strengthScore >= 70
                    ? 'bg-emerald-900/20 border-emerald-700'
                    : 'bg-amber-900/20 border-amber-700'
                  : 'bg-zinc-800/50 border-zinc-700 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold text-amber-400">{beat.beatNumber}.</div>
                {beat.detected ? (
                  <div className={`text-xs font-bold ${
                    beat.strengthScore >= 70 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {beat.strengthScore}/100
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">Not Detected</div>
                )}
              </div>
              <div className="text-sm text-zinc-300 font-semibold">{beat.beatName}</div>
              {beat.chapterNumber && (
                <div className="text-xs text-zinc-500 mt-1">
                  Ch {beat.chapterNumber} • {beat.idealPosition.toFixed(0)}% ideal
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-300">Beat Sheet Score</span>
            <span className={`text-xl font-bold ${
              beatSheet.overallScore >= 80 ? 'text-emerald-400' :
              beatSheet.overallScore >= 70 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {beatSheet.overallScore}/100
            </span>
          </div>
        </div>
      </div>

      {/* Related Views */}
      <div className="mt-8">
        <RelatedViews
          currentView="structure-visualizer"
          relatedViews={RELATED_VIEWS_MAP['structure-visualizer']}
        />
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
    </div>
  );
};

export default StructureVisualizer;
