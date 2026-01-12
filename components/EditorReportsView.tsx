import React, { useState, useEffect, useMemo } from 'react';
import { NovelState } from '../types';
import { EditorReport, EditorTriggerType } from '../types/editor';
import { fetchEditorReports } from '../services/supabaseService';
import EditorReportComponent from './EditorReport';
import EditorAnalytics from './EditorAnalytics';
import { exportReport } from '../services/exportService';
import { calculateTrend } from '../utils/chartUtils';

interface EditorReportsViewProps {
  novelState: NovelState;
}

type SortOption = 'date' | 'score' | 'issues' | 'type';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'analytics';

const EditorReportsView: React.FC<EditorReportsViewProps> = ({ novelState }) => {
  const [reports, setReports] = useState<EditorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<EditorReport | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<EditorTriggerType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    loadReports();
  }, [novelState.id]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const fetchedReports = await fetchEditorReports(novelState.id);
      setReports(fetchedReports);
    } catch (error) {
      console.error('Error loading editor reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort reports
  const filteredAndSortedReports = useMemo(() => {
    let filtered = reports;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.triggerType === filterType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.analysis.summary.toLowerCase().includes(query) ||
        r.chaptersAnalyzed.some(ch => ch.toString().includes(query)) ||
        r.analysis.issues.some(i => i.description.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortOption) {
        case 'date':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'score':
          const aScore = (a.analysis.continuityScore + a.analysis.grammarScore + a.analysis.styleScore) / 3;
          const bScore = (b.analysis.continuityScore + b.analysis.grammarScore + b.analysis.styleScore) / 3;
          comparison = aScore - bScore;
          break;
        case 'issues':
          comparison = a.analysis.issues.length - b.analysis.issues.length;
          break;
        case 'type':
          comparison = a.triggerType.localeCompare(b.triggerType);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [reports, filterType, searchQuery, sortOption, sortDirection]);

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
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

  const getFlowRatingColor = (rating: string): string => {
    switch (rating) {
      case 'excellent':
        return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'good':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/50';
      case 'adequate':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'needs_work':
        return 'text-red-400 bg-red-500/20 border-red-500/50';
      default:
        return 'text-zinc-400 bg-zinc-500/20 border-zinc-500/50';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleExport = (report: EditorReport, format: 'json' | 'csv' | 'html' | 'markdown') => {
    exportReport(report, format);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div>
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedReport(null)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
          >
            ← Back to Reports
          </button>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors">
                Export
              </button>
              <div className="absolute right-0 top-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 min-w-32 hidden group-hover:block">
                <button
                  onClick={() => handleExport(selectedReport, 'json')}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-t-lg"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => handleExport(selectedReport, 'csv')}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport(selectedReport, 'html')}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  Export as HTML
                </button>
                <button
                  onClick={() => handleExport(selectedReport, 'markdown')}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded-b-lg"
                >
                  Export as Markdown
                </button>
              </div>
            </div>
          </div>
        </div>
        <EditorReportComponent
          report={selectedReport}
          novelState={novelState}
          onViewDetails={() => {}}
        />
      </div>
    );
  }

  if (showAnalytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500">Editor Analytics</h2>
          <button
            onClick={() => setShowAnalytics(false)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-semibold"
          >
            ← Back to Reports
          </button>
        </div>
        <EditorAnalytics reports={reports} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500">Editor Reports</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-sm font-semibold"
          >
            Analytics
          </button>
          <button
            onClick={loadReports}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter by Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as EditorTriggerType | 'all')}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
            title="Filter by trigger type"
            aria-label="Filter by trigger type"
          >
            <option value="all">All Types</option>
            <option value="chapter_batch">Every 5 Chapters</option>
            <option value="arc_complete">Arc Completion</option>
            <option value="manual">Manual Review</option>
          </select>

          {/* Sort */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
            title="Sort reports"
            aria-label="Sort reports"
          >
            <option value="date">Sort by Date</option>
            <option value="score">Sort by Score</option>
            <option value="issues">Sort by Issues</option>
            <option value="type">Sort by Type</option>
          </select>

          <button
            onClick={toggleSortDirection}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm hover:bg-zinc-800 transition-colors"
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Results count */}
        {filteredAndSortedReports.length < reports.length && (
          <div className="text-xs text-zinc-500">
            Showing {filteredAndSortedReports.length} of {reports.length} reports
          </div>
        )}
      </div>

      {/* Reports List */}
      {filteredAndSortedReports.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">
            {reports.length === 0 ? 'No Editor Reports Yet' : 'No Reports Match Filters'}
          </h3>
          <p className="text-sm text-zinc-500">
            {reports.length === 0
              ? 'Editor reports will appear here after the editor runs (every 5 chapters or arc completion).'
              : 'Try adjusting your filters or search query.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedReports.map((report, index) => {
            const previousReport = index > 0 ? filteredAndSortedReports[index - 1] : null;
            const avgScore = (report.analysis.continuityScore + report.analysis.grammarScore + report.analysis.styleScore) / 3;
            const prevAvgScore = previousReport
              ? (previousReport.analysis.continuityScore + previousReport.analysis.grammarScore + previousReport.analysis.styleScore) / 3
              : null;
            const trend = prevAvgScore !== null ? calculateTrend(avgScore, prevAvgScore) : null;

            return (
              <div
                key={report.id}
                className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 hover:border-amber-500/50 transition-all cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-zinc-200">
                        {getTriggerTypeLabel(report.triggerType)}
                      </h3>
                      {trend && trend.change > 0 && (
                        <span className={`text-sm ${trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                          {trend.direction === 'up' ? '↑' : '↓'} {trend.change.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400">
                      Chapters {report.chaptersAnalyzed.join(', ')} • {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-xs font-semibold border ${getFlowRatingColor(report.analysis.overallFlow)}`}>
                      {report.analysis.overallFlow.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    <p className="text-xs text-zinc-500 mb-1">Issues</p>
                    <p className="text-xl font-bold text-zinc-300">{report.analysis.issues.length}</p>
                  </div>
                  <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Auto-Fixed</p>
                    <p className="text-xl font-bold text-green-400">{report.autoFixedCount}</p>
                  </div>
                  <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Pending</p>
                    <p className="text-xl font-bold text-yellow-400">{report.pendingFixCount}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                    <p className="text-xs text-zinc-500 mb-1">Avg Score</p>
                    <p className={`text-xl font-bold ${getScoreColor(avgScore)}`}>
                      {avgScore.toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Mini score bars */}
                <div className="mb-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Continuity</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${report.analysis.continuityScore}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right ${getScoreColor(report.analysis.continuityScore)}`}>
                      {report.analysis.continuityScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Grammar</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${report.analysis.grammarScore}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right ${getScoreColor(report.analysis.grammarScore)}`}>
                      {report.analysis.grammarScore}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-20">Style</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${report.analysis.styleScore}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right ${getScoreColor(report.analysis.styleScore)}`}>
                      {report.analysis.styleScore}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-zinc-400 line-clamp-2">{report.analysis.summary}</p>

                <div className="flex items-center justify-between mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedReport(report);
                    }}
                    className="text-sm text-amber-500 hover:text-amber-400 font-semibold"
                  >
                    View Full Report →
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(report, 'json');
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EditorReportsView;
