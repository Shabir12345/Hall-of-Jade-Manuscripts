/**
 * Trust Score Widget Component
 * Displays trust score with breakdown for automation features
 */

import React from 'react';
import type { TrustScore } from '../services/trustService';

interface TrustScoreWidgetProps {
  trustScore: TrustScore | null;
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const TrustScoreWidget: React.FC<TrustScoreWidgetProps> = ({
  trustScore,
  showBreakdown = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  if (!trustScore) {
    return (
      <div className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 ${className}`}>
        <div className="text-sm text-zinc-500 text-center">No trust score available</div>
      </div>
    );
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-600/20 border-emerald-500/30';
    if (score >= 60) return 'bg-amber-600/20 border-amber-500/30';
    return 'bg-red-600/20 border-red-500/30';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'High';
    if (score >= 60) return 'Moderate';
    return 'Low';
  };

  const sizeClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const scoreSizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const baseClassName = `bg-zinc-900 border ${getScoreBgColor(trustScore.overall)} rounded-xl ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:border-opacity-50 transition-all' : ''} ${className}`;
  const content = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Trust Score</div>
        {onClick && (
          <span className="text-xs text-zinc-500 hover:text-zinc-300">View Details →</span>
        )}
      </div>
      
      <div className="flex items-baseline gap-2 mb-2">
        <div className={`font-fantasy font-bold ${getScoreColor(trustScore.overall)} ${scoreSizeClasses[size]}`}>
          {trustScore.overall}
        </div>
        <div className="text-sm text-zinc-500">/100</div>
        <div className={`ml-auto text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${getScoreBgColor(trustScore.overall)}`}>
          {getScoreLabel(trustScore.overall)}
        </div>
      </div>

      {showBreakdown && (
        <div className="mt-4 space-y-2 pt-4 border-t border-zinc-700">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-zinc-500 mb-1">Extraction Quality</div>
              <div className={`font-bold ${getScoreColor(trustScore.extractionQuality)}`}>
                {trustScore.extractionQuality}/100
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Connection Quality</div>
              <div className={`font-bold ${getScoreColor(trustScore.connectionQuality)}`}>
                {trustScore.connectionQuality}/100
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Data Completeness</div>
              <div className={`font-bold ${getScoreColor(trustScore.dataCompleteness)}`}>
                {trustScore.dataCompleteness}/100
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Consistency</div>
              <div className={`font-bold ${getScoreColor(trustScore.consistencyScore)}`}>
                {trustScore.consistencyScore}/100
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        className={baseClassName}
        onClick={onClick}
        aria-label={`Trust score: ${trustScore.overall}/100 - ${getScoreLabel(trustScore.overall)}. Click to view details.`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={baseClassName}
      aria-label={`Trust score: ${trustScore.overall}/100 - ${getScoreLabel(trustScore.overall)}`}
    >
      {content}
    </div>
  );
};
