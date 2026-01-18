/**
 * Gap Analysis Panel Component
 * Displays gap analysis with severity grouping and actions
 */

import React, { useState, useMemo } from 'react';
import type { GapAnalysis, Gap } from '../services/gapDetectionService';

interface GapAnalysisPanelProps {
  gapAnalysis: GapAnalysis | null;
  onFix?: (gap: Gap) => void;
  onDismiss?: (gap: Gap) => void;
  onReviewAll?: () => void;
  maxItems?: number;
  showActions?: boolean;
  className?: string;
}

export const GapAnalysisPanel: React.FC<GapAnalysisPanelProps> = ({
  gapAnalysis,
  onFix,
  onDismiss,
  onReviewAll,
  maxItems = 5,
  showActions = true,
  className = '',
}) => {
  const [expandedSeverity, setExpandedSeverity] = useState<'critical' | 'warning' | 'info' | null>('critical');

  if (!gapAnalysis || gapAnalysis.gaps.length === 0) {
    return (
      <div className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 ${className}`}>
        <div className="text-sm text-zinc-400 text-center">No gaps detected</div>
        <div className="text-xs text-zinc-500 text-center mt-1">Your novel is well-connected!</div>
      </div>
    );
  }

  const groupedGaps = useMemo(() => {
    const critical = gapAnalysis.gaps.filter(g => g.severity === 'critical');
    const warnings = gapAnalysis.gaps.filter(g => g.severity === 'warning');
    const info = gapAnalysis.gaps.filter(g => g.severity === 'info');
    return { critical, warnings, info };
  }, [gapAnalysis.gaps]);

  const getSeverityColor = (severity: 'critical' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/30 bg-red-950/20';
      case 'warning':
        return 'border-amber-500/30 bg-amber-950/20';
      case 'info':
        return 'border-blue-500/30 bg-blue-950/20';
    }
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
    }
  };

  const getSeverityTextColor = (severity: 'critical' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-400';
      case 'warning':
        return 'text-amber-400';
      case 'info':
        return 'text-blue-400';
    }
  };

  const highestSeverity = gapAnalysis.summary.critical > 0 
    ? 'critical' 
    : gapAnalysis.summary.warnings > 0 
    ? 'warning' 
    : 'info';

  const renderGapGroup = (severity: 'critical' | 'warning' | 'info', gaps: Gap[]) => {
    if (gaps.length === 0) return null;
    
    const isExpanded = expandedSeverity === severity;
    const displayGaps = isExpanded ? gaps : gaps.slice(0, maxItems);

    return (
      <div key={severity} className="space-y-2">
        <button
          onClick={() => setExpandedSeverity(isExpanded ? null : severity)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{getSeverityIcon(severity)}</span>
            <span className={`text-sm font-bold uppercase tracking-wide ${getSeverityTextColor(severity)}`}>
              {severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warnings' : 'Info'}
            </span>
            <span className="text-xs text-zinc-500">({gaps.length})</span>
          </div>
          <span className="text-xs text-zinc-500">
            {isExpanded ? '▼' : '▶'}
          </span>
        </button>
        
        {isExpanded && (
          <div className="space-y-2 pl-6">
            {displayGaps.map((gap, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-zinc-300 mb-1">
                      {gap.entityName}
                    </div>
                    <div className="text-xs text-zinc-400 mb-2">{gap.message}</div>
                    <div className="text-xs text-zinc-500 italic">{gap.suggestion}</div>
                  </div>
                  {gap.autoFixable && (
                    <span className="text-xs text-emerald-400 font-bold uppercase">Auto-fixable</span>
                  )}
                </div>
                {showActions && (onFix || onDismiss) && (
                  <div className="flex gap-2 mt-3">
                    {onFix && gap.autoFixable && (
                      <button
                        onClick={() => onFix(gap)}
                        className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg font-semibold transition-all"
                      >
                        Fix
                      </button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => onDismiss(gap)}
                        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 rounded-lg font-semibold transition-all"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {gaps.length > maxItems && !isExpanded && (
              <div className="text-xs text-zinc-500 text-center py-2">
                +{gaps.length - maxItems} more...
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-zinc-900 border ${getSeverityColor(highestSeverity)} rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{getSeverityIcon(highestSeverity)}</span>
          <div className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Gap Analysis
          </div>
          <div className="text-xs text-zinc-500">
            ({gapAnalysis.summary.total} total)
          </div>
        </div>
        {onReviewAll && gapAnalysis.summary.total > 0 && (
          <button
            onClick={onReviewAll}
            className="text-xs px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 rounded-lg font-semibold transition-all"
          >
            Review All
          </button>
        )}
      </div>

      <div className="space-y-3">
        {renderGapGroup('critical', groupedGaps.critical)}
        {renderGapGroup('warning', groupedGaps.warnings)}
        {renderGapGroup('info', groupedGaps.info)}
      </div>

      {gapAnalysis.recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-700">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
            Recommendations
          </div>
          <ul className="space-y-1">
            {gapAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
              <li key={idx} className="text-xs text-zinc-400 flex items-start gap-2">
                <span className="text-zinc-600 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
