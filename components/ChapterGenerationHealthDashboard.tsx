/**
 * Chapter Generation Health Dashboard
 * 
 * Visual display of story health metrics, warnings, and recommendations
 * before and during chapter generation.
 */

import React, { useMemo } from 'react';
import {
  ChapterGenerationReport,
  ChapterGenerationWarning,
  WarningSeverity,
} from '../services/chapterGenerationWarningService';

interface HealthDashboardProps {
  report: ChapterGenerationReport;
  isCompact?: boolean;
  onWarningClick?: (warning: ChapterGenerationWarning) => void;
}

// Severity colors and icons
const severityConfig: Record<WarningSeverity, { color: string; bgColor: string; icon: string }> = {
  critical: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: '🚨' },
  high: { color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: '⚠️' },
  medium: { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: '📝' },
  low: { color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: '💡' },
  info: { color: 'text-zinc-400', bgColor: 'bg-zinc-500/20', icon: 'ℹ️' },
};

// Health score color
function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getHealthBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20';
  if (score >= 60) return 'bg-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

function getHealthEmoji(score: number): string {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  if (score >= 40) return '🔶';
  return '❌';
}

// Progress bar component
function ProgressBar({ value, max = 100, color = 'bg-emerald-500' }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-300`} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Warning card component
function WarningCard({ 
  warning, 
  onClick 
}: { 
  warning: ChapterGenerationWarning; 
  onClick?: () => void;
}) {
  const config = severityConfig[warning.severity];
  
  return (
    <div 
      className={`${config.bgColor} border border-zinc-700 rounded-lg p-3 cursor-pointer hover:border-zinc-600 transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${config.color} text-sm`}>
            {warning.title}
          </div>
          <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
            {warning.description}
          </p>
          {warning.recommendation && (
            <p className="text-zinc-500 text-xs mt-1 italic">
              → {warning.recommendation}
            </p>
          )}
          {warning.metric && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Current: {warning.metric.current}{warning.metric.unit ? ` ${warning.metric.unit}` : ''}</span>
                <span>Standard: {warning.metric.standard}</span>
              </div>
              <ProgressBar 
                value={warning.metric.current} 
                max={warning.metric.threshold}
                color={warning.severity === 'critical' ? 'bg-red-500' : 
                       warning.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact health indicator
function CompactHealthIndicator({ report }: { report: ChapterGenerationReport }) {
  const healthColor = getHealthColor(report.overallHealth);
  const healthEmoji = getHealthEmoji(report.overallHealth);
  
  return (
    <div className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg">
      <div className={`text-2xl ${healthColor} font-bold`}>
        {healthEmoji} {report.overallHealth}
      </div>
      <div className="text-xs text-zinc-400">
        <div>{report.arcPositionAnalysis.positionName}</div>
        <div className="flex gap-2">
          {report.blockers.length > 0 && (
            <span className="text-red-400">{report.blockers.length} blockers</span>
          )}
          {report.warnings.filter(w => w.severity === 'high').length > 0 && (
            <span className="text-orange-400">
              {report.warnings.filter(w => w.severity === 'high').length} high
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChapterGenerationHealthDashboard({ 
  report, 
  isCompact = false,
  onWarningClick 
}: HealthDashboardProps) {
  // Group warnings by severity
  const warningsBySeverity = useMemo(() => {
    const all = [...report.blockers, ...report.warnings];
    return {
      critical: all.filter(w => w.severity === 'critical'),
      high: all.filter(w => w.severity === 'high'),
      medium: all.filter(w => w.severity === 'medium'),
      low: all.filter(w => w.severity === 'low'),
      info: all.filter(w => w.severity === 'info'),
    };
  }, [report]);

  if (isCompact) {
    return <CompactHealthIndicator report={report} />;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header with health score */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-200">
          Chapter {report.chapterNumber} Health Report
        </h3>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getHealthBgColor(report.overallHealth)}`}>
          <span className="text-lg">{getHealthEmoji(report.overallHealth)}</span>
          <span className={`font-bold ${getHealthColor(report.overallHealth)}`}>
            {report.overallHealth}/100
          </span>
        </div>
      </div>

      {/* Arc position indicator */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Arc Position:</span>
          <span className="text-zinc-300 font-medium">
            {report.arcPositionAnalysis.positionName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Progress:</span>
          <span className="text-zinc-300">
            {report.arcPositionAnalysis.progressPercentage}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Remaining:</span>
          <span className="text-zinc-300">
            {report.arcPositionAnalysis.chaptersRemaining} chapters
          </span>
        </div>
      </div>

      {/* Thread summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-emerald-400">
            {report.threadProgressionSummary.activeThreads}
          </div>
          <div className="text-xs text-zinc-500">Active Threads</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className={`text-2xl font-bold ${
            report.threadProgressionSummary.stalledThreads > 0 ? 'text-orange-400' : 'text-zinc-400'
          }`}>
            {report.threadProgressionSummary.stalledThreads}
          </div>
          <div className="text-xs text-zinc-500">Stalled</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className={`text-2xl font-bold ${
            report.threadProgressionSummary.atRiskOfPlotHole > 0 ? 'text-red-400' : 'text-zinc-400'
          }`}>
            {report.threadProgressionSummary.atRiskOfPlotHole}
          </div>
          <div className="text-xs text-zinc-500">At Risk</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-400">
            {report.threadProgressionSummary.threadDensity}
          </div>
          <div className="text-xs text-zinc-500">Density/Ch</div>
        </div>
      </div>

      {/* Blockers section */}
      {warningsBySeverity.critical.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
            <span>🚨</span> Blockers ({warningsBySeverity.critical.length})
          </h4>
          <div className="space-y-2">
            {warningsBySeverity.critical.map(warning => (
              <WarningCard 
                key={warning.id} 
                warning={warning} 
                onClick={() => onWarningClick?.(warning)}
              />
            ))}
          </div>
        </div>
      )}

      {/* High priority warnings */}
      {warningsBySeverity.high.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-orange-400 flex items-center gap-2">
            <span>⚠️</span> High Priority ({warningsBySeverity.high.length})
          </h4>
          <div className="space-y-2">
            {warningsBySeverity.high.slice(0, 5).map(warning => (
              <WarningCard 
                key={warning.id} 
                warning={warning}
                onClick={() => onWarningClick?.(warning)}
              />
            ))}
            {warningsBySeverity.high.length > 5 && (
              <div className="text-xs text-zinc-500 text-center">
                +{warningsBySeverity.high.length - 5} more high priority warnings
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medium/Low warnings (collapsed) */}
      {(warningsBySeverity.medium.length > 0 || warningsBySeverity.low.length > 0) && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-zinc-400 hover:text-zinc-300">
            {warningsBySeverity.medium.length + warningsBySeverity.low.length} other warnings
          </summary>
          <div className="mt-2 space-y-2">
            {[...warningsBySeverity.medium, ...warningsBySeverity.low].slice(0, 10).map(warning => (
              <WarningCard 
                key={warning.id} 
                warning={warning}
                onClick={() => onWarningClick?.(warning)}
              />
            ))}
          </div>
        </details>
      )}

      {/* Prompt constraints preview */}
      {report.promptConstraints.length > 0 && (
        <div className="border-t border-zinc-800 pt-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">
            📋 Constraints Added to Prompt ({report.promptConstraints.length})
          </h4>
          <div className="space-y-1">
            {report.promptConstraints.map((constraint, i) => (
              <div key={i} className="text-xs text-zinc-500 bg-zinc-800/30 rounded px-2 py-1">
                {i + 1}. {constraint}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected progressions for current arc position */}
      <div className="border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">
          📍 Expected for {report.arcPositionAnalysis.positionName} Stage
        </h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          {report.arcPositionAnalysis.expectedProgressions.map((exp, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-zinc-600">•</span>
              {exp}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Mini version for sidebar or inline use
export function MiniHealthIndicator({ 
  report,
  showDetails = false 
}: { 
  report: ChapterGenerationReport;
  showDetails?: boolean;
}) {
  const healthColor = getHealthColor(report.overallHealth);
  const healthEmoji = getHealthEmoji(report.overallHealth);
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{healthEmoji}</span>
      <span className={`font-semibold ${healthColor}`}>
        {report.overallHealth}
      </span>
      {showDetails && (
        <span className="text-xs text-zinc-500">
          ({report.blockers.length} blockers, {report.warnings.filter(w => w.severity === 'high').length} warnings)
        </span>
      )}
    </div>
  );
}

export default ChapterGenerationHealthDashboard;
