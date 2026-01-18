import React, { useState, useMemo } from 'react';
import { EditorialReview, EditorialSignal, EditorialSignalCategory, EditorialSignalSeverity } from '../types/editor';
import QualitySignalCard from './QualitySignalCard';

interface EditorialReviewPanelProps {
  review: EditorialReview | null;
  isLoading?: boolean;
  onRecheck?: () => void;
  onJumpToLocation?: (signal: EditorialSignal) => void;
  onDismissSignal?: (signalId: string) => void;
  className?: string;
}

const EditorialReviewPanel: React.FC<EditorialReviewPanelProps> = ({
  review,
  isLoading = false,
  onRecheck,
  onJumpToLocation,
  onDismissSignal,
  className = '',
}) => {
  const [categoryFilter, setCategoryFilter] = useState<EditorialSignalCategory | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<EditorialSignalSeverity | 'all'>('all');
  const [dismissedSignals, setDismissedSignals] = useState<Set<string>>(new Set());

  const categories: EditorialSignalCategory[] = [
    'narrative_authenticity',
    'voice_consistency',
    'structural_balance',
    'dialogue_naturalness',
    'originality_craft',
    'emotional_credibility',
  ];

  const filteredSignals = useMemo(() => {
    if (!review) return [];
    
    return review.signals.filter(signal => {
      if (dismissedSignals.has(signal.id)) return false;
      if (categoryFilter !== 'all' && signal.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && signal.severity !== severityFilter) return false;
      return true;
    });
  }, [review, categoryFilter, severityFilter, dismissedSignals]);

  const signalsByCategory = useMemo(() => {
    const grouped: Partial<Record<EditorialSignalCategory, EditorialSignal[]>> = {};
    filteredSignals.forEach(signal => {
      if (!grouped[signal.category]) {
        grouped[signal.category] = [];
      }
      grouped[signal.category]!.push(signal);
    });
    return grouped;
  }, [filteredSignals]);

  const handleDismiss = (signalId: string) => {
    setDismissedSignals(prev => new Set(prev).add(signalId));
    onDismissSignal?.(signalId);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Work';
    return 'Poor';
  };

  if (isLoading) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          <span className="ml-3 text-sm text-zinc-400">Running quality review...</span>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <p className="text-sm text-zinc-500 mb-4">
            No review available. Click "Review Quality" to run editorial checks.
          </p>
          {onRecheck && (
            <button
              onClick={onRecheck}
              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 hover:border-amber-600/50 rounded transition-all duration-200 font-semibold"
            >
              Review Quality
            </button>
          )}
        </div>
      </div>
    );
  }

  const severityCounts = {
    issue: review.signals.filter(s => s.severity === 'issue').length,
    concern: review.signals.filter(s => s.severity === 'concern').length,
    suggestion: review.signals.filter(s => s.severity === 'suggestion').length,
    info: review.signals.filter(s => s.severity === 'info').length,
  };

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Quality Review
          </h3>
          {onRecheck && (
            <button
              onClick={onRecheck}
              className="px-3 py-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 hover:border-amber-600/50 rounded transition-all duration-200 font-semibold"
            >
              Re-check
            </button>
          )}
        </div>

        {/* Overall Score */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Overall Quality Score</span>
            <span className={`text-lg font-bold ${getScoreColor(review.overallScore)}`}>
              {review.overallScore}/100
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 relative overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all absolute top-0 left-0 ${
                review.overallScore >= 80 ? 'bg-green-500' :
                review.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${review.overallScore}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">{getScoreLabel(review.overallScore)}</p>
        </div>

        {/* Summary */}
        <p className="text-sm text-zinc-300 mb-3">{review.summary}</p>

        {/* Severity counts */}
        <div className="flex items-center gap-2 flex-wrap">
          {severityCounts.issue > 0 && (
            <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/30">
              {severityCounts.issue} Issue{severityCounts.issue !== 1 ? 's' : ''}
            </span>
          )}
          {severityCounts.concern > 0 && (
            <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
              {severityCounts.concern} Concern{severityCounts.concern !== 1 ? 's' : ''}
            </span>
          )}
          {severityCounts.suggestion > 0 && (
            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
              {severityCounts.suggestion} Suggestion{severityCounts.suggestion !== 1 ? 's' : ''}
            </span>
          )}
          {severityCounts.info > 0 && (
            <span className="text-xs px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded border border-zinc-500/30">
              {severityCounts.info} Info
            </span>
          )}
        </div>
      </div>

      {/* Strengths */}
      {review.strengths.length > 0 && (
        <div className="p-4 border-b border-zinc-700 bg-green-500/5">
          <h4 className="text-xs font-bold text-green-400 uppercase tracking-wide mb-2">
            Strengths
          </h4>
          <ul className="space-y-1">
            {review.strengths.map((strength, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start gap-2">
                <span className="text-green-400 mt-0.5">✓</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {review.recommendations.length > 0 && (
        <div className="p-4 border-b border-zinc-700">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">
            Recommendations
          </h4>
          <ul className="space-y-1">
            {review.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      {filteredSignals.length > 0 && (
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs text-zinc-500">Filter by category:</span>
            {(['all', ...categories] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  categoryFilter === cat
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {cat === 'all' ? 'All' : cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Filter by severity:</span>
            {(['all', 'issue', 'concern', 'suggestion', 'info'] as const).map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  severityFilter === sev
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Signals by Category */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
        {filteredSignals.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No signals match the current filters.
          </p>
        ) : (
          categories.map(category => {
            const categorySignals = signalsByCategory[category];
            if (!categorySignals || categorySignals.length === 0) return null;
            
            return (
              <QualitySignalCard
                key={category}
                category={category}
                signals={categorySignals}
                onJumpToLocation={onJumpToLocation}
                onDismiss={handleDismiss}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default EditorialReviewPanel;
