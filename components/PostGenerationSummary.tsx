/**
 * Post-Generation Summary Component
 * Shows trust score, auto-connections, and consistency check results after generation
 */

import React, { useEffect, useState } from 'react';
import type { TrustScore } from '../services/trustService';
import type { Connection } from '../services/autoConnectionService';
import { TrustScoreWidget } from './TrustScoreWidget';
import { AutoConnectionsList } from './AutoConnectionsList';

interface ConsistencyIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  chapterNumber?: number;
}

interface PostGenerationSummaryProps {
  trustScore: TrustScore | null;
  autoConnections: Connection[];
  consistencyIssues: ConsistencyIssue[];
  onViewDetails?: () => void;
  onDismiss: () => void;
  autoHideAfter?: number; // seconds
  className?: string;
}

export const PostGenerationSummary: React.FC<PostGenerationSummaryProps> = ({
  trustScore,
  autoConnections,
  consistencyIssues,
  onViewDetails,
  onDismiss,
  autoHideAfter = 30,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (autoHideAfter > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoHideAfter * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [autoHideAfter, onDismiss]);

  const hasIssues = consistencyIssues.length > 0;
  const criticalIssues = consistencyIssues.filter(i => i.severity === 'critical').length;
  const warningIssues = consistencyIssues.filter(i => i.severity === 'warning').length;

  return (
    <div className={`bg-zinc-900 border ${hasIssues && criticalIssues > 0 ? 'border-red-500/30' : hasIssues && warningIssues > 0 ? 'border-amber-500/30' : 'border-emerald-500/30'} rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">{hasIssues && criticalIssues > 0 ? '🔴' : hasIssues ? '⚠️' : '✅'}</span>
          <div className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Generation Complete
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-xs px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 rounded-lg font-semibold transition-all"
            >
              View Details
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label={isExpanded ? 'Collapse summary' : 'Expand summary'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <button
            onClick={onDismiss}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Dismiss summary"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Trust Score */}
          {trustScore && (
            <div>
              <TrustScoreWidget
                trustScore={trustScore}
                size="sm"
                showBreakdown={true}
              />
            </div>
          )}

          {/* Auto-Connections */}
          {autoConnections.length > 0 && (
            <div>
              <AutoConnectionsList
                connections={autoConnections}
                maxItems={5}
                showConfidence={true}
              />
            </div>
          )}

          {/* Consistency Issues */}
          {consistencyIssues.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">
                Consistency Check
              </div>
              <div className="space-y-2">
                {consistencyIssues.slice(0, 3).map((issue, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded border ${
                      issue.severity === 'critical'
                        ? 'bg-red-950/20 border-red-500/30 text-red-300'
                        : issue.severity === 'warning'
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                        : 'bg-blue-950/20 border-blue-500/30 text-blue-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-shrink-0">
                        {issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <span>{issue.message}</span>
                    </div>
                  </div>
                ))}
                {consistencyIssues.length > 3 && (
                  <div className="text-xs text-zinc-500 text-center pt-1">
                    +{consistencyIssues.length - 3} more issue{consistencyIssues.length - 3 !== 1 ? 's' : ''}...
                  </div>
                )}
              </div>
            </div>
          )}

          {trustScore === null && autoConnections.length === 0 && consistencyIssues.length === 0 && (
            <div className="text-sm text-zinc-400 text-center py-4">
              Generation completed successfully
            </div>
          )}
        </div>
      )}
    </div>
  );
};
