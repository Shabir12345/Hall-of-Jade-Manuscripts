import React, { useState, useMemo } from 'react';
import { EditorReport } from '../types/editor';
import { calculateTrend } from '../utils/chartUtils';

interface ReportComparisonViewProps {
  report1: EditorReport;
  report2: EditorReport;
  onClose: () => void;
}

const ReportComparisonView: React.FC<ReportComparisonViewProps> = ({
  report1,
  report2,
  onClose,
}) => {
  // Calculate differences
  const comparisons = useMemo(() => {
    const continuityTrend = calculateTrend(report1.analysis.continuityScore, report2.analysis.continuityScore);
    const grammarTrend = calculateTrend(report1.analysis.grammarScore, report2.analysis.grammarScore);
    const styleTrend = calculateTrend(report1.analysis.styleScore, report2.analysis.styleScore);
    const issuesDiff = report1.analysis.issues.length - report2.analysis.issues.length;
    const autoFixedDiff = report1.autoFixedCount - report2.autoFixedCount;
    const pendingDiff = report1.pendingFixCount - report2.pendingFixCount;

    // Issue type distribution comparison
    const issueTypes1: Record<string, number> = {};
    const issueTypes2: Record<string, number> = {};
    
    report1.analysis.issues.forEach(issue => {
      issueTypes1[issue.type] = (issueTypes1[issue.type] || 0) + 1;
    });
    report2.analysis.issues.forEach(issue => {
      issueTypes2[issue.type] = (issueTypes2[issue.type] || 0) + 1;
    });

    const allTypes = new Set([...Object.keys(issueTypes1), ...Object.keys(issueTypes2)]);
    const typeComparison = Array.from(allTypes).map(type => ({
      type,
      count1: issueTypes1[type] || 0,
      count2: issueTypes2[type] || 0,
      diff: (issueTypes1[type] || 0) - (issueTypes2[type] || 0),
    }));

    return {
      continuityTrend,
      grammarTrend,
      styleTrend,
      issuesDiff,
      autoFixedDiff,
      pendingDiff,
      typeComparison,
    };
  }, [report1, report2]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getTrendIcon = (trend: ReturnType<typeof calculateTrend>) => {
    if (trend.direction === 'stable') return '→';
    return trend.direction === 'up' ? '↑' : '↓';
  };

  const getTrendColor = (trend: ReturnType<typeof calculateTrend>) => {
    if (trend.direction === 'stable') return 'text-zinc-400';
    return trend.direction === 'up' ? 'text-green-400' : 'text-red-400';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getTriggerTypeLabel = (type: string): string => {
    switch (type) {
      case 'chapter_batch':
        return 'Every 5 Chapters';
      case 'arc_complete':
        return 'Arc Completion';
      case 'manual':
        return 'Manual Review';
      default:
        return type;
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-fantasy font-bold text-zinc-100">Report Comparison</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 px-3 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Report Headers */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">
            {getTriggerTypeLabel(report1.triggerType)}
          </h4>
          <p className="text-xs text-zinc-400">
            Chapters {report1.chaptersAnalyzed.join(', ')}
          </p>
          <p className="text-xs text-zinc-400">
            {formatDate(report1.createdAt)}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">
            {getTriggerTypeLabel(report2.triggerType)}
          </h4>
          <p className="text-xs text-zinc-400">
            Chapters {report2.chaptersAnalyzed.join(', ')}
          </p>
          <p className="text-xs text-zinc-400">
            {formatDate(report2.createdAt)}
          </p>
        </div>
      </div>

      {/* Score Comparison */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-300 mb-3">Score Comparison</h4>
        <div className="space-y-4">
          {/* Continuity */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Continuity</span>
              <span className={`text-sm font-semibold ${getTrendColor(comparisons.continuityTrend)}`}>
                {getTrendIcon(comparisons.continuityTrend)} {Math.abs(comparisons.continuityTrend.change).toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report1.analysis.continuityScore)}`}>
                  {report1.analysis.continuityScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${report1.analysis.continuityScore}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report2.analysis.continuityScore)}`}>
                  {report2.analysis.continuityScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${report2.analysis.continuityScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grammar */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Grammar</span>
              <span className={`text-sm font-semibold ${getTrendColor(comparisons.grammarTrend)}`}>
                {getTrendIcon(comparisons.grammarTrend)} {Math.abs(comparisons.grammarTrend.change).toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report1.analysis.grammarScore)}`}>
                  {report1.analysis.grammarScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${report1.analysis.grammarScore}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report2.analysis.grammarScore)}`}>
                  {report2.analysis.grammarScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${report2.analysis.grammarScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Style */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Style</span>
              <span className={`text-sm font-semibold ${getTrendColor(comparisons.styleTrend)}`}>
                {getTrendIcon(comparisons.styleTrend)} {Math.abs(comparisons.styleTrend.change).toFixed(1)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report1.analysis.styleScore)}`}>
                  {report1.analysis.styleScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${report1.analysis.styleScore}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${getScoreColor(report2.analysis.styleScore)}`}>
                  {report2.analysis.styleScore}
                </p>
                <div className="w-full bg-zinc-800 rounded-full h-2 mt-2">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${report2.analysis.styleScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Comparison */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-300 mb-3">Statistics Comparison</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Total Issues</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-zinc-300">{report1.analysis.issues.length}</p>
              {comparisons.issuesDiff !== 0 && (
                <span className={`text-sm font-semibold ${comparisons.issuesDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {comparisons.issuesDiff > 0 ? '+' : ''}{comparisons.issuesDiff}
                </span>
              )}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Total Issues</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-zinc-300">{report2.analysis.issues.length}</p>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Auto-Fixed</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-400">{report1.autoFixedCount}</p>
              {comparisons.autoFixedDiff !== 0 && (
                <span className={`text-sm font-semibold ${comparisons.autoFixedDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {comparisons.autoFixedDiff > 0 ? '+' : ''}{comparisons.autoFixedDiff}
                </span>
              )}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Auto-Fixed</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-green-400">{report2.autoFixedCount}</p>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Pending</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-yellow-400">{report1.pendingFixCount}</p>
              {comparisons.pendingDiff !== 0 && (
                <span className={`text-sm font-semibold ${comparisons.pendingDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {comparisons.pendingDiff > 0 ? '+' : ''}{comparisons.pendingDiff}
                </span>
              )}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-1">Pending</p>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-yellow-400">{report2.pendingFixCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Issue Type Comparison */}
      {comparisons.typeComparison.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-3">Issue Type Comparison</h4>
          <div className="space-y-2">
            {comparisons.typeComparison.map(({ type, count1, count2, diff }) => (
              <div key={type} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400 capitalize">{type.replace('_', ' ')}</span>
                  {diff !== 0 && (
                    <span className={`text-xs font-semibold ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-zinc-300">{count1}</p>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, (count1 / Math.max(count1, count2, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-zinc-300">{count2}</p>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${Math.min(100, (count2 / Math.max(count1, count2, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportComparisonView;
