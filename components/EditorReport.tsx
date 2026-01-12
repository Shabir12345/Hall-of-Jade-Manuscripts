import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EditorReport, EditorIssue } from '../types/editor';
import { NovelState, Chapter } from '../types';
import { filterIssues, sortIssues, getIssueTypeIcon, getIssueTypeColor, getUniqueChapters, getUniqueIssueTypes, IssueFilter, IssueSort } from '../utils/reportUtils';
import IssueFilterPanel from './IssueFilterPanel';
import IssueDetailsView from './IssueDetailsView';

interface EditorReportProps {
  report: EditorReport;
  novelState?: NovelState;
  onViewDetails?: () => void;
  onViewChapter?: (chapterId: string) => void;
}

const EditorReportComponent: React.FC<EditorReportProps> = ({
  report,
  novelState,
  onViewDetails,
  onViewChapter,
}) => {
  const [filter, setFilter] = useState<IssueFilter>({});
  const [sort, setSort] = useState<IssueSort>({ field: 'severity', direction: 'desc' });
  const [selectedIssue, setSelectedIssue] = useState<EditorIssue | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'statistics']));
  const issueListRef = useRef<HTMLDivElement>(null);

  // Get chapters for context
  const getChapterForIssue = useCallback((issue: EditorIssue): Chapter | undefined => {
    if (!novelState) return undefined;
    return novelState.chapters.find(ch => 
      ch.id === issue.chapterId || ch.number === issue.chapterNumber
    );
  }, [novelState]);

  // Filter and sort issues
  const filteredAndSortedIssues = useMemo(() => {
    let result = filterIssues(report.analysis.issues, filter);
    result = sortIssues(result, sort);
    return result;
  }, [report.analysis.issues, filter, sort]);

  // Get unique values for filters
  const availableChapters = useMemo(() => getUniqueChapters(report.analysis.issues), [report.analysis.issues]);
  const availableTypes = useMemo(() => getUniqueIssueTypes(report.analysis.issues), [report.analysis.issues]);

  // Get related issues (issues in the same chapter)
  const getRelatedIssues = useCallback((issue: EditorIssue): EditorIssue[] => {
    return filteredAndSortedIssues.filter(i => 
      i.id !== issue.id && 
      i.chapterNumber === issue.chapterNumber
    ).slice(0, 5);
  }, [filteredAndSortedIssues]);

  // Navigation handlers
  const handleNextIssue = useCallback(() => {
    if (!selectedIssue) {
      if (filteredAndSortedIssues.length > 0) {
        setSelectedIssue(filteredAndSortedIssues[0]);
      }
      return;
    }
    const currentIndex = filteredAndSortedIssues.findIndex(i => i.id === selectedIssue.id);
    if (currentIndex < filteredAndSortedIssues.length - 1) {
      setSelectedIssue(filteredAndSortedIssues[currentIndex + 1]);
    }
  }, [selectedIssue, filteredAndSortedIssues]);

  const handlePreviousIssue = useCallback(() => {
    if (!selectedIssue) return;
    const currentIndex = filteredAndSortedIssues.findIndex(i => i.id === selectedIssue.id);
    if (currentIndex > 0) {
      setSelectedIssue(filteredAndSortedIssues[currentIndex - 1]);
    }
  }, [selectedIssue, filteredAndSortedIssues]);

  const handleJumpToIssue = useCallback((index: number) => {
    if (index >= 0 && index < filteredAndSortedIssues.length) {
      setSelectedIssue(filteredAndSortedIssues[index]);
      issueListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [filteredAndSortedIssues]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't handle if typing in input
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        handleNextIssue();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        handlePreviousIssue();
      } else if (e.key === 'Escape') {
        setSelectedIssue(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextIssue, handlePreviousIssue]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilter({});
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

  const selectedIssueIndex = selectedIssue 
    ? filteredAndSortedIssues.findIndex(i => i.id === selectedIssue.id) 
    : -1;

  // If issue details view is shown
  if (selectedIssue) {
    const chapter = getChapterForIssue(selectedIssue);
    const relatedIssues = getRelatedIssues(selectedIssue);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedIssue(null)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
          >
            ← Back to Report
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousIssue}
              disabled={selectedIssueIndex === 0}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-sm text-zinc-400">
              {selectedIssueIndex + 1} of {filteredAndSortedIssues.length}
            </span>
            <button
              onClick={handleNextIssue}
              disabled={selectedIssueIndex === filteredAndSortedIssues.length - 1}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
        <IssueDetailsView
          issue={selectedIssue}
          fixes={report.fixes}
          chapter={chapter}
          novelState={novelState}
          onViewChapter={onViewChapter}
          relatedIssues={relatedIssues}
        />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-fantasy font-bold text-zinc-100 mb-2">
            Editor Review Report
          </h3>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span>{getTriggerTypeLabel(report.triggerType)}</span>
            <span>•</span>
            <span>{formatDate(report.createdAt)}</span>
            <span>•</span>
            <span>Chapters {report.chaptersAnalyzed.join(', ')}</span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded text-xs font-semibold border ${getFlowRatingColor(report.analysis.overallFlow)}`}>
          {report.analysis.overallFlow.toUpperCase().replace('_', ' ')}
        </span>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1">Continuity</p>
          <p className={`text-2xl font-bold ${getScoreColor(report.analysis.continuityScore)}`}>
            {report.analysis.continuityScore}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1">Grammar</p>
          <p className={`text-2xl font-bold ${getScoreColor(report.analysis.grammarScore)}`}>
            {report.analysis.grammarScore}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
          <p className="text-xs text-zinc-500 mb-1">Style</p>
          <p className={`text-2xl font-bold ${getScoreColor(report.analysis.styleScore)}`}>
            {report.analysis.styleScore}
          </p>
        </div>
      </div>

      {/* Summary - Collapsible */}
      <div>
        <button
          onClick={() => toggleSection('summary')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h4 className="text-sm font-semibold text-zinc-300">Summary</h4>
          <span className="text-zinc-400">{expandedSections.has('summary') ? '−' : '+'}</span>
        </button>
        {expandedSections.has('summary') && (
          <p className="text-sm text-zinc-400 leading-relaxed">{report.analysis.summary}</p>
        )}
      </div>

      {/* Statistics - Collapsible */}
      <div>
        <button
          onClick={() => toggleSection('statistics')}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <h4 className="text-sm font-semibold text-zinc-300">Statistics</h4>
          <span className="text-zinc-400">{expandedSections.has('statistics') ? '−' : '+'}</span>
        </button>
        {expandedSections.has('statistics') && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 text-center">
              <p className="text-2xl font-bold text-zinc-300">{report.analysis.issues.length}</p>
              <p className="text-xs text-zinc-500 mt-1">Issues Found</p>
            </div>
            <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{report.autoFixedCount}</p>
              <p className="text-xs text-zinc-500 mt-1">Auto-Fixed</p>
            </div>
            <div className="bg-yellow-950/30 border border-yellow-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{report.pendingFixCount}</p>
              <p className="text-xs text-zinc-500 mt-1">Pending Review</p>
            </div>
          </div>
        )}
      </div>

      {/* Strengths - Collapsible */}
      {report.analysis.strengths.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('strengths')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h4 className="text-sm font-semibold text-zinc-300">Strengths ({report.analysis.strengths.length})</h4>
            <span className="text-zinc-400">{expandedSections.has('strengths') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('strengths') && (
            <ul className="space-y-1">
              {report.analysis.strengths.map((strength, index) => (
                <li key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Recommendations - Collapsible */}
      {report.analysis.recommendations.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('recommendations')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h4 className="text-sm font-semibold text-zinc-300">Recommendations ({report.analysis.recommendations.length})</h4>
            <span className="text-zinc-400">{expandedSections.has('recommendations') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('recommendations') && (
            <ul className="space-y-1">
              {report.analysis.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Arc Readiness - Collapsible */}
      {'readiness' in report.analysis && report.analysis.readiness && (
        <div>
          <button
            onClick={() => toggleSection('readiness')}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <h4 className="text-sm font-semibold text-zinc-300">Release Readiness</h4>
            <span className="text-zinc-400">{expandedSections.has('readiness') ? '−' : '+'}</span>
          </button>
          {expandedSections.has('readiness') && (
            <div className={`rounded-lg p-4 border ${
              report.analysis.readiness.isReadyForRelease
                ? 'bg-green-950/30 border-green-500/30'
                : 'bg-red-950/30 border-red-500/30'
            }`}>
              <p className={`text-sm font-semibold mb-2 ${
                report.analysis.readiness.isReadyForRelease ? 'text-green-400' : 'text-red-400'
              }`}>
                {report.analysis.readiness.isReadyForRelease ? '✓ Ready for Release' : '⚠ Not Ready for Release'}
              </p>
              {report.analysis.readiness.blockingIssues.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-zinc-500 mb-1">Blocking Issues:</p>
                  <ul className="space-y-1">
                    {report.analysis.readiness.blockingIssues.map((issue, index) => (
                      <li key={index} className="text-xs text-red-400">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.analysis.readiness.suggestedImprovements.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-zinc-500 mb-1">Suggested Improvements:</p>
                  <ul className="space-y-1">
                    {report.analysis.readiness.suggestedImprovements.map((improvement, index) => (
                      <li key={index} className="text-xs text-zinc-400">• {improvement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Issues Section */}
      {report.analysis.issues.length > 0 && (
        <div ref={issueListRef}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-zinc-300">
              Issues ({filteredAndSortedIssues.length} of {report.analysis.issues.length})
            </h4>
            {filteredAndSortedIssues.length < report.analysis.issues.length && (
              <span className="text-xs text-zinc-500">Filtered</span>
            )}
          </div>

          {/* Filter Panel */}
          <div className="mb-4">
            <IssueFilterPanel
              filter={filter}
              sort={sort}
              availableTypes={availableTypes}
              availableChapters={availableChapters}
              onFilterChange={setFilter}
              onSortChange={setSort}
              onClearFilters={clearFilters}
            />
          </div>

          {/* Issues List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredAndSortedIssues.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No issues match the current filters
              </div>
            ) : (
              filteredAndSortedIssues.map((issue, index) => {
                const fix = report.fixes.find(f => f.issueId === issue.id);
                const isSelected = selectedIssue?.id === issue.id;
                
                return (
                  <div
                    key={issue.id || index}
                    onClick={() => setSelectedIssue(issue)}
                    className={`bg-zinc-800/50 rounded-lg p-3 border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/20'
                        : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getIssueTypeIcon(issue.type)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        issue.severity === 'major' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {issue.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getIssueTypeColor(issue.type)}`}>
                        {issue.type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-zinc-500">Ch {issue.chapterNumber}</span>
                      <span className="text-xs text-zinc-500">•</span>
                      <span className="text-xs text-zinc-500">{issue.location}</span>
                      {fix && (
                        <>
                          <span className="text-xs text-zinc-500">•</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            fix.status === 'applied'
                              ? 'bg-green-500/20 text-green-400'
                              : fix.status === 'approved'
                              ? 'bg-blue-500/20 text-blue-400'
                              : fix.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {fix.status}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{issue.description}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIssue(issue);
                      }}
                      className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      View Details →
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* View Details Button */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-semibold"
        >
          View Full Details
        </button>
      )}
    </div>
  );
};

export default EditorReportComponent;
