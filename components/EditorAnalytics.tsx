import React, { useMemo } from 'react';
import { EditorReport } from '../types/editor';
import { formatBarChartData, formatPieChartData, calculateTrend, generateColorPalette, calculateAverage } from '../utils/chartUtils';

interface EditorAnalyticsProps {
  reports: EditorReport[];
}

const EditorAnalytics: React.FC<EditorAnalyticsProps> = ({ reports }) => {
  // Calculate statistics
  const statistics = useMemo(() => {
    if (reports.length === 0) {
      return {
        totalReports: 0,
        averageContinuity: 0,
        averageGrammar: 0,
        averageStyle: 0,
        totalIssues: 0,
        totalAutoFixed: 0,
        totalPending: 0,
        issueTypeDistribution: {} as Record<string, number>,
        scoreTrends: [] as number[],
      };
    }

    const issueTypeDistribution: Record<string, number> = {};
    const continuityScores: number[] = [];
    const grammarScores: number[] = [];
    const styleScores: number[] = [];
    let totalIssues = 0;
    let totalAutoFixed = 0;
    let totalPending = 0;

    reports.forEach(report => {
      continuityScores.push(report.analysis.continuityScore);
      grammarScores.push(report.analysis.grammarScore);
      styleScores.push(report.analysis.styleScore);
      totalIssues += report.analysis.issues.length;
      totalAutoFixed += report.autoFixedCount;
      totalPending += report.pendingFixCount;

      report.analysis.issues.forEach(issue => {
        issueTypeDistribution[issue.type] = (issueTypeDistribution[issue.type] || 0) + 1;
      });
    });

    return {
      totalReports: reports.length,
      averageContinuity: calculateAverage(continuityScores),
      averageGrammar: calculateAverage(grammarScores),
      averageStyle: calculateAverage(styleScores),
      totalIssues,
      totalAutoFixed,
      totalPending,
      issueTypeDistribution,
      scoreTrends: continuityScores,
    };
  }, [reports]);

  // Calculate trends
  const trends = useMemo(() => {
    if (reports.length < 2) {
      return {
        continuity: { direction: 'stable' as const, change: 0, percentage: 0 },
        grammar: { direction: 'stable' as const, change: 0, percentage: 0 },
        style: { direction: 'stable' as const, change: 0, percentage: 0 },
      };
    }

    const latest = reports[reports.length - 1];
    const previous = reports[reports.length - 2];

    return {
      continuity: calculateTrend(latest.analysis.continuityScore, previous.analysis.continuityScore),
      grammar: calculateTrend(latest.analysis.grammarScore, previous.analysis.grammarScore),
      style: calculateTrend(latest.analysis.styleScore, previous.analysis.styleScore),
    };
  }, [reports]);

  // Format chart data
  const issueTypeData = useMemo(() => {
    return formatBarChartData(statistics.issueTypeDistribution);
  }, [statistics.issueTypeDistribution]);

  const colors = generateColorPalette(issueTypeData.length);

  const formatScore = (score: number) => Math.round(score);
  const formatTrend = (trend: ReturnType<typeof calculateTrend>) => {
    if (trend.direction === 'stable') return '→';
    return trend.direction === 'up' ? '↑' : '↓';
  };
  const getTrendColor = (trend: ReturnType<typeof calculateTrend>) => {
    if (trend.direction === 'stable') return 'text-zinc-400';
    return trend.direction === 'up' ? 'text-green-400' : 'text-red-400';
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Analytics Data Yet</h3>
        <p className="text-sm text-zinc-500">
          Analytics will appear here once you have editor reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500">Editor Analytics</h2>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Reports</p>
          <p className="text-2xl font-bold text-zinc-300">{statistics.totalReports}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Total Issues</p>
          <p className="text-2xl font-bold text-zinc-300">{statistics.totalIssues}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Auto-Fixed</p>
          <p className="text-2xl font-bold text-green-400">{statistics.totalAutoFixed}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{statistics.totalPending}</p>
        </div>
      </div>

      {/* Average Scores with Trends */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">Average Continuity</p>
            <span className={`text-lg ${getTrendColor(trends.continuity)}`}>
              {formatTrend(trends.continuity)}
            </span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{formatScore(statistics.averageContinuity)}</p>
          {trends.continuity.change > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              {trends.continuity.direction === 'up' ? '+' : '-'}{trends.continuity.change} from previous
            </p>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">Average Grammar</p>
            <span className={`text-lg ${getTrendColor(trends.grammar)}`}>
              {formatTrend(trends.grammar)}
            </span>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatScore(statistics.averageGrammar)}</p>
          {trends.grammar.change > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              {trends.grammar.direction === 'up' ? '+' : '-'}{trends.grammar.change} from previous
            </p>
          )}
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">Average Style</p>
            <span className={`text-lg ${getTrendColor(trends.style)}`}>
              {formatTrend(trends.style)}
            </span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{formatScore(statistics.averageStyle)}</p>
          {trends.style.change > 0 && (
            <p className="text-xs text-zinc-500 mt-1">
              {trends.style.direction === 'up' ? '+' : '-'}{trends.style.change} from previous
            </p>
          )}
        </div>
      </div>

      {/* Issue Type Distribution */}
      {issueTypeData.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-300 mb-4">Issue Type Distribution</h3>
          <div className="space-y-3">
            {issueTypeData.map((item, index) => {
              const maxValue = Math.max(...issueTypeData.map(d => d.value));
              const percentage = (item.value / maxValue) * 100;
              const totalIssues = statistics.totalIssues;
              const itemPercentage = ((item.value / totalIssues) * 100).toFixed(1);

              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400 capitalize">
                      {item.label.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold text-zinc-300">
                      {item.value} ({itemPercentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: colors[index % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Score Trends Over Time */}
      {reports.length > 1 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-zinc-300 mb-4">Score Trends Over Time</h3>
          <div className="space-y-4">
            {reports.map((report, index) => (
              <div key={report.id} className="flex items-center gap-4">
                <div className="w-24 text-xs text-zinc-500">
                  Report {index + 1}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Continuity</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${report.analysis.continuityScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">
                        {report.analysis.continuityScore}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Grammar</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${report.analysis.grammarScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">
                        {report.analysis.grammarScore}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Style</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${report.analysis.styleScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">
                        {report.analysis.styleScore}
                      </span>
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

export default EditorAnalytics;
