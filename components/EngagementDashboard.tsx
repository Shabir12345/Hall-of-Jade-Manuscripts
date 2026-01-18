import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult, ImprovementHistory } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { EmptyState } from './EmptyState';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { getImprovementHistory } from '../services/novelImprovementService';
import { formatRelativeTime } from '../utils/timeUtils';
import { analyzeEngagement } from '../services/engagementAnalyzer';
import { analyzeEmotionalResonance } from '../services/emotionalResonanceService';
import { RelatedViews, RELATED_VIEWS_MAP } from './RelatedViews';

interface EngagementDashboardProps {
  novelState: NovelState;
}

const EngagementDashboard: React.FC<EngagementDashboardProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);
  const [improvementHistory, setImprovementHistory] = useState<ImprovementHistory[]>([]);
  // Key to force recalculation after improvements are applied
  const [recalculationKey, setRecalculationKey] = useState(0);
  const { updateActiveNovel, activeNovel } = useNovel();
  const { showSuccess, showError, showWarning } = useToast();

  // Load improvement history for this category
  useEffect(() => {
    const loadHistory = async () => {
      if (!novelState.id) return;
      try {
        const history = await getImprovementHistory(novelState.id);
        const categoryHistory = history.filter(h => h.category === 'engagement');
        setImprovementHistory(categoryHistory);
      } catch (error) {
        console.error('Failed to load improvement history', error);
      }
    };
    loadHistory();
  }, [novelState.id]);

  const handleImproveNovel = () => {
    // Calculate target score: 90 or current + 30, whichever is lower
    const currentScore = engagementAnalysis.overallEngagementScore;
    const targetScore = Math.min(90, Math.max(currentScore + 30, currentScore + 10));
    
    setImprovementRequest({
      category: 'engagement',
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
      console.log('[EngagementDashboard] Applying improved state with', improvedState.chapters.length, 'chapters');
      updateActiveNovel(() => improvedState);
      
      // Force recalculation of engagement analysis
      setRecalculationKey(prev => prev + 1);

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
        const categoryHistory = history.filter(h => h.category === 'engagement');
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

  // Memoized analysis that recalculates when novel state changes or after improvements
  const engagementAnalysis = useMemo(() => {
    console.log('[EngagementDashboard] Recalculating engagement analysis (key:', recalculationKey, ')');
    const analysis = analyzeEngagement(novelState);
    console.log('[EngagementDashboard] Engagement score:', analysis.overallEngagementScore);
    return analysis;
  }, [novelState, recalculationKey]);
  
  const emotionalAnalysis = useMemo(() => analyzeEmotionalResonance(novelState), [novelState, recalculationKey]);

  const totalChapters = novelState.chapters.length || 0;

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Empty state - need at least 2 chapters for engagement analysis
  if (totalChapters < 2) {
    return (
      <div className="p-4 md:p-5 lg:p-6 max-w-6xl mx-auto pt-12 md:pt-16">
        <div className="mb-6 border-b border-zinc-700 pb-4">
          <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
            Engagement Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-2">Reader engagement metrics and emotional journey</p>
        </div>
        <EmptyState
          icon="📊"
          title="Not Enough Chapters Yet"
          description="Generate at least 2 chapters to enable engagement analysis. Engagement metrics track how readers connect with your story across chapters."
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
          <span>📊</span>
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
          Engagement Analytics
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Reader engagement metrics and emotional journey</p>
      </div>

      {/* Overall Engagement Score */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-amber-500 rounded-xl p-8 text-center">
          <div className={`text-5xl font-fantasy font-bold mb-2 ${getScoreColor(engagementAnalysis.overallEngagementScore)}`}>
            {engagementAnalysis.overallEngagementScore}/100
          </div>
          <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Engagement</div>
        </div>
      </div>

      {/* Engagement Curve */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Engagement Curve</h3>
        <div className="relative h-64 bg-zinc-800 rounded-lg p-4 overflow-x-auto">
          <div className="flex items-end h-full space-x-1" style={{ minWidth: `${engagementAnalysis.engagementCurve.length * 40}px` }}>
            {engagementAnalysis.engagementCurve.map((point, index) => {
              const height = (point.engagementScore / 100) * 100;
              const color = point.engagementScore >= 80 ? 'bg-emerald-500' :
                           point.engagementScore >= 70 ? 'bg-amber-500' :
                           point.engagementScore >= 60 ? 'bg-yellow-500' :
                           'bg-red-500';
              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer`}
                    style={{ height: `${height}%` }}
                    title={`Ch ${point.chapterNumber}: ${point.engagementScore}/100 (${point.trend})`}
                  ></div>
                  <div className="text-xs text-zinc-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    Ch {point.chapterNumber}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Engagement Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {engagementAnalysis.metrics.slice(-6).map((metric) => (
          <div key={metric.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-zinc-300">Chapter {metric.chapterNumber}</h4>
              <span className={`text-xl font-bold ${getScoreColor(metric.overallEngagementScore)}`}>
                {metric.overallEngagementScore}/100
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Hook</span>
                <span className="text-zinc-400">{metric.hookStrength}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Cliffhanger</span>
                <span className="text-zinc-400">{metric.cliffhangerEffectiveness}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Emotional</span>
                <span className="text-zinc-400">{metric.emotionalResonance}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tension</span>
                <span className="text-zinc-400">{metric.tensionLevel}/100</span>
              </div>
              {metric.fatigueDetected && (
                <div className="mt-2 text-xs text-red-400">⚠ Fatigue Detected</div>
              )}
              {metric.peakMoment && (
                <div className="mt-2 text-xs text-emerald-400">⭐ Peak Moment</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Peak Moments */}
      {engagementAnalysis.peakMoments.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Peak Moments</h3>
          <div className="space-y-3">
            {engagementAnalysis.peakMoments.map((moment, index) => (
              <div key={index} className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-emerald-400">Chapter {moment.chapterNumber}</div>
                  <div className="text-lg font-bold text-emerald-400">{moment.engagementScore}/100</div>
                </div>
                <div className="text-sm text-zinc-300">{moment.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotional Journey */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Emotional Journey</h3>
        <div className="space-y-4">
          {emotionalAnalysis.emotionalJourney.slice(-10).map((journey, index) => (
            <div key={index} className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-400">Chapter {journey.chapterNumber}</span>
                <span className={`text-sm font-bold ${getScoreColor(journey.emotionalScore)}`}>
                  {journey.emotionalScore}/100
                </span>
              </div>
              {journey.primaryEmotions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {journey.primaryEmotions.map((emotion, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-300"
                    >
                      {emotion.emotion} ({emotion.intensity}/100)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {engagementAnalysis.recommendations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Recommendations</h3>
          <ul className="space-y-2">
            {engagementAnalysis.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start">
                <span className="text-amber-500 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Views */}
      <div className="mt-8">
        <RelatedViews
          currentView="engagement-dashboard"
          relatedViews={RELATED_VIEWS_MAP['engagement-dashboard']}
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

export default EngagementDashboard;
