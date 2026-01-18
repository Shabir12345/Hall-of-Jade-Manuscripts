/**
 * Gap Analysis Panel Component
 * Displays gap analysis with severity grouping and actions
 */

import React, { memo, useState } from 'react';
import type { GapAnalysis, Gap } from '../../services/gapDetectionService';

interface GapAnalysisPanelProps {
  gapAnalysis: GapAnalysis;
  onFix?: (gap: Gap) => void;
  onReview?: () => void;
  onDismiss?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const GapAnalysisPanel: React.FC<GapAnalysisPanelProps> = memo(({
  gapAnalysis,
  onFix,
  onReview,
  onDismiss,
  collapsible = false,
  defaultExpanded = true,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedSeverities, setExpandedSeverities] = useState<Set<string>>(
    new Set(['critical', 'warning'])
  );

  const criticalGaps = gapAnalysis.gaps.filter(g => g.severity === 'critical');
  const warningGaps = gapAnalysis.gaps.filter(g => g.severity === 'warning');
  const infoGaps = gapAnalysis.gaps.filter(g => g.severity === 'info');

  const toggleSeverity = (severity: string) => {
    setExpandedSeverities(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 border-red-600/30 bg-red-600/10';
      case 'warning':
        return 'text-amber-400 border-amber-600/30 bg-amber-600/10';
      case 'info':
        return 'text-blue-400 border-blue-600/30 bg-blue-600/10';
      default:
        return 'text-zinc-400 border-zinc-600/30 bg-zinc-600/10';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const renderGapList = (gaps: Gap[], severity: string) => {
    if (gaps.length === 0) return null;

    const isExpanded = expandedSeverities.has(severity);
    const MAX_DISPLAY = 10; // Limit display to prevent overwhelming UI
    const displayGaps = gaps.slice(0, MAX_DISPLAY);
    const remainingCount = gaps.length - MAX_DISPLAY;

    return (
      <div className="space-y-2">
        <button
          onClick={() => toggleSeverity(severity)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${getSeverityColor(severity)} transition-all hover:shadow-lg`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{getSeverityIcon(severity)}</span>
            <div className="text-left">
              <span className="text-sm font-bold uppercase tracking-wide block">
                {severity === 'critical' ? 'Critical Issues' : severity === 'warning' ? 'Warnings' : 'Suggestions'}
              </span>
              <span className="text-xs text-zinc-500 mt-0.5">
                {gaps.length} {gaps.length === 1 ? 'issue' : 'issues'}
              </span>
            </div>
            <span className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-zinc-800/70 font-bold">
              {gaps.length}
            </span>
          </div>
          <span className={`ml-3 text-sm transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
        {isExpanded && (
          <div className="space-y-2 pl-2">
            {displayGaps.map((gap, idx) => (
              <div
                key={idx}
                className="bg-zinc-950/50 border border-zinc-700/50 rounded-lg p-3 space-y-2 hover:border-zinc-600/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-zinc-300">{gap.entityName}</span>
                      <span className="text-xs text-zinc-600">({gap.entityType})</span>
                    </div>
                    <p className="text-sm text-zinc-400 mb-1.5 leading-relaxed">{gap.message}</p>
                    <p className="text-xs text-zinc-500 italic leading-relaxed">{gap.suggestion}</p>
                  </div>
                  {gap.autoFixable && (
                    <span className="text-xs px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 whitespace-nowrap flex-shrink-0">
                      Auto-fix
                    </span>
                  )}
                </div>
                {onFix && gap.autoFixable && (
                  <button
                    onClick={() => onFix(gap)}
                    className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/30 rounded-lg transition-all font-semibold"
                  >
                    Fix Automatically
                  </button>
                )}
              </div>
            ))}
            {remainingCount > 0 && (
              <div className="text-center py-2 text-xs text-zinc-500 italic">
                +{remainingCount} more {remainingCount === 1 ? 'issue' : 'issues'} (showing first {MAX_DISPLAY})
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const highestSeverity = criticalGaps.length > 0 ? 'critical' : warningGaps.length > 0 ? 'warning' : 'info';
  const borderColor = getSeverityColor(highestSeverity).split(' ')[2]; // Extract border color

  if (!expanded && collapsible) {
    return (
      <div className={`bg-zinc-900 border ${borderColor} rounded-xl p-4 ${className}`}>
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{getSeverityIcon(highestSeverity)}</span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Gap Analysis</h3>
              <p className="text-xs text-zinc-500 mt-1">
                {gapAnalysis.summary.total} gap{gapAnalysis.summary.total !== 1 ? 's' : ''} detected
                {gapAnalysis.summary.critical > 0 && ` • ${gapAnalysis.summary.critical} critical`}
              </p>
            </div>
          </div>
          <span className="text-xs">▶</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 border ${borderColor} rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getSeverityIcon(highestSeverity)}</span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Gap Analysis</h3>
            <p className="text-xs text-zinc-500 mt-1">
              {gapAnalysis.summary.total} gap{gapAnalysis.summary.total !== 1 ? 's' : ''} detected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onReview && gapAnalysis.summary.total > 0 && (
            <button
              onClick={onReview}
              className="text-xs text-zinc-400 hover:text-amber-400 uppercase font-semibold tracking-wide transition-colors"
            >
              Review All
            </button>
          )}
          {collapsible && (
            <button
              onClick={() => setExpanded(false)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Collapse"
            >
              ×
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {gapAnalysis.summary.total === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-sm text-zinc-400">No gaps detected. Your novel is well-connected!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderGapList(criticalGaps, 'critical')}
          {renderGapList(warningGaps, 'warning')}
          {renderGapList(infoGaps, 'info')}

          {gapAnalysis.recommendations.length > 0 && (
            <div className="pt-4 border-t border-zinc-700">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {gapAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs text-zinc-400 flex items-start gap-2">
                    <span className="text-zinc-600">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

GapAnalysisPanel.displayName = 'GapAnalysisPanel';
