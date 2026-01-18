/**
 * Pre-Generation Analysis Panel Component
 * Shows gap analysis results before chapter generation
 */

import React, { useState } from 'react';
import type { GapAnalysis } from '../services/gapDetectionService';
import { GapAnalysisPanel } from './GapAnalysisPanel';

interface PreGenerationAnalysisProps {
  gapAnalysis: GapAnalysis;
  onProceed: () => void;
  onReview: () => void;
  className?: string;
}

export const PreGenerationAnalysis: React.FC<PreGenerationAnalysisProps> = ({
  gapAnalysis,
  onProceed,
  onReview,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasCriticalIssues = gapAnalysis.summary.critical > 0;
  const hasWarnings = gapAnalysis.summary.warnings > 0;

  return (
    <div className={`bg-zinc-900 border ${hasCriticalIssues ? 'border-red-500/30' : hasWarnings ? 'border-amber-500/30' : 'border-blue-500/30'} rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{hasCriticalIssues ? '🔴' : hasWarnings ? '⚠️' : 'ℹ️'}</span>
          <div className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Pre-Generation Analysis
          </div>
          <div className="text-xs text-zinc-500">
            ({gapAnalysis.summary.total} issue{gapAnalysis.summary.total !== 1 ? 's' : ''})
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label={isExpanded ? 'Collapse analysis' : 'Expand analysis'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="mb-4">
            <GapAnalysisPanel
              gapAnalysis={gapAnalysis}
              maxItems={3}
              showActions={false}
              onReviewAll={onReview}
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-zinc-700">
            {hasCriticalIssues && (
              <button
                onClick={onReview}
                className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-lg font-semibold text-sm transition-all"
              >
                Review Issues
              </button>
            )}
            {!hasCriticalIssues && (
              <button
                onClick={onReview}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 rounded-lg font-semibold text-sm transition-all"
              >
                Review All
              </button>
            )}
            <button
              onClick={onProceed}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                hasCriticalIssues
                  ? 'bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400'
                  : 'bg-amber-600 hover:bg-amber-500 border border-amber-500 text-white'
              }`}
            >
              {hasCriticalIssues ? 'Proceed Anyway' : 'Proceed'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
