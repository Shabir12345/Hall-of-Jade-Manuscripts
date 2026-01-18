/**
 * Dashboard View Component
 * Main dashboard showing novel overview and statistics
 */

import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { NovelState } from '../../types';
import { TrustScoreWidget } from '../TrustScoreWidget';
import { GapAnalysisPanel } from '../widgets/GapAnalysisPanel';
import { PostGenerationSummary } from '../PostGenerationSummary';
import { ApiKeyTester } from '../ApiKeyTester';
import { analyzeGaps } from '../../services/gapDetectionService';
import type { TrustScore } from '../../services/trustService';
import type { Connection } from '../../services/autoConnectionService';
import { Tooltip, HelpIcon } from '../Tooltip';
import { ChapterGenerationHealthDashboard, MiniHealthIndicator } from '../ChapterGenerationHealthDashboard';
import { generateChapterWarnings } from '../../services/chapterGenerationWarningService';

interface DashboardViewProps {
  novel: NovelState;
  onGenerateChapter: (instruction?: string) => void;
  onBatchGenerate?: (instruction?: string) => void;
  isGenerating: boolean;
  generationProgress: number;
  generationStatus: string;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onViewChange: (view: string) => void;
  activeChapterId: string | null;
  onChapterSelect: (chapterId: string) => void;
}

const DashboardViewComponent: React.FC<DashboardViewProps> = ({
  novel,
  onGenerateChapter,
  onBatchGenerate,
  isGenerating,
  generationProgress,
  generationStatus,
  instruction,
  onInstructionChange,
  onViewChange,
  activeChapterId,
  onChapterSelect,
}) => {
  const [showPreGenerationAnalysis, setShowPreGenerationAnalysis] = useState(false);
  const [showPostGenerationSummary, setShowPostGenerationSummary] = useState(false);
  const prevGeneratingRef = useRef(isGenerating);

  // Track when generation completes to show summary
  useEffect(() => {
    if (prevGeneratingRef.current && !isGenerating) {
      // Generation just completed
      setShowPostGenerationSummary(true);
    }
    prevGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Get last trust score from novel state (stored directly, not parsed from logs)
  const lastTrustScore = useMemo((): TrustScore | null => {
    if (novel.lastTrustScore) {
      return novel.lastTrustScore as TrustScore;
    }
    return null;
  }, [novel.lastTrustScore]);

  // Calculate gap analysis
  const gapAnalysis = useMemo(() => {
    const nextChapterNumber = novel.chapters.length > 0 
      ? Math.max(...novel.chapters.map(c => c.number)) + 1 
      : 1;
    return analyzeGaps(novel, nextChapterNumber);
  }, [novel]);

  // Calculate story health report
  const storyHealthReport = useMemo(() => {
    const nextChapterNumber = novel.chapters.length > 0 
      ? Math.max(...novel.chapters.map(c => c.number)) + 1 
      : 1;
    return generateChapterWarnings(novel, nextChapterNumber);
  }, [novel]);

  // State for showing full health dashboard
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);

  // Get recent auto-connections from novel state (stored directly, not parsed from logs)
  const recentAutoConnections = useMemo((): Connection[] => {
    if (novel.recentAutoConnections && Array.isArray(novel.recentAutoConnections)) {
      return novel.recentAutoConnections.slice(0, 10);
    }
    return [];
  }, [novel.recentAutoConnections]);

  // Extract consistency issues from logs
  const consistencyIssues = useMemo(() => {
    const consistencyLogs = novel.systemLogs
      .slice()
      .reverse()
      .filter(log => log.message.toLowerCase().includes('consistency') || log.message.toLowerCase().includes('inconsistency'))
      .slice(0, 5);
    return consistencyLogs.map(log => ({
      severity: (log.type === 'error' ? 'critical' : 'warning') as 'critical' | 'warning' | 'info',
      message: log.message,
    }));
  }, [novel.systemLogs]);

  // Extract recent automation activity (last 3-5 events)
  const recentAutomationActivity = useMemo(() => {
    const automationLogs = novel.systemLogs
      .slice()
      .reverse()
      .filter(log => {
        const msg = log.message.toLowerCase();
        return msg.includes('auto-connected') || 
               msg.includes('trust score') || 
               msg.includes('consistency check') ||
               msg.includes('gap') ||
               msg.includes('extraction');
      })
      .slice(0, 5);
    
    return automationLogs.map(log => {
      let icon = '✨';
      let type = 'update';
      if (log.message.toLowerCase().includes('trust score')) {
        icon = '✅';
        type = 'trust';
      } else if (log.message.toLowerCase().includes('auto-connected')) {
        icon = '🔗';
        type = 'connection';
      } else if (log.message.toLowerCase().includes('consistency')) {
        icon = '🔍';
        type = 'consistency';
      } else if (log.message.toLowerCase().includes('gap')) {
        icon = '⚠️';
        type = 'gap';
      }
      
      return {
        icon,
        type,
        message: log.message,
        timestamp: log.timestamp,
        logType: log.type,
      };
    });
  }, [novel.systemLogs]);

  // Calculate consistency score from recent logs
  const consistencyScore = useMemo(() => {
    const consistencyLogs = novel.systemLogs
      .slice()
      .reverse()
      .filter(log => log.message.toLowerCase().includes('consistency score'))
      .slice(0, 1);
    
    if (consistencyLogs.length > 0) {
      const match = consistencyLogs[0].message.match(/(\d+)\/100/);
      if (match) return parseInt(match[1], 10);
    }
    return null;
  }, [novel.systemLogs]);

  // Calculate total auto-connections count from stored connections
  const totalAutoConnections = useMemo(() => {
    return novel.recentAutoConnections?.length || 0;
  }, [novel.recentAutoConnections]);

  // Recent connections are already filtered to recent ones
  const recentAutoConnectionsCount = useMemo(() => {
    return recentAutoConnections.length;
  }, [recentAutoConnections]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" data-tour="dashboard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8 lg:space-y-12">
        {/* API Key Tester - Show at top for easy access */}
        <ApiKeyTester />

        {/* Header Section */}
        <header className="space-y-4 pb-8 border-b border-zinc-800/50">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-fantasy font-bold text-amber-500 tracking-tight leading-tight">
                {novel.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 font-medium">
                  {novel.genre}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">
                  {novel.chapters.length} Chapter{novel.chapters.length !== 1 ? 's' : ''}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">
                  {novel.characterCodex.length} Character{novel.characterCodex.length !== 1 ? 's' : ''}
                </span>
                {novel.currentRealmId && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-400">
                      Realm: {novel.realms.find(r => r.id === novel.currentRealmId)?.name || 'Unknown'}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Automation Status Badges */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {lastTrustScore && (
                <button
                  onClick={() => onViewChange('analytics')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold text-sm transition-all shadow-md hover:shadow-lg ${
                    lastTrustScore.overall >= 80
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                      : lastTrustScore.overall >= 60
                      ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
                      : 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                  }`}
                  title={`Trust Score: ${lastTrustScore.overall}/100 - Click to view details`}
                >
                  <span>✅</span>
                  <span>Trust: {lastTrustScore.overall}/100</span>
                </button>
              )}
              {gapAnalysis.summary.total > 0 && (
                <button
                  onClick={() => setShowPreGenerationAnalysis(true)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-semibold text-sm transition-all shadow-md hover:shadow-lg ${
                    gapAnalysis.summary.critical > 0
                      ? 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                      : gapAnalysis.summary.warning > 0
                      ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
                      : 'bg-blue-600/20 text-blue-400 border-blue-500/40 hover:bg-blue-600/30'
                  }`}
                  title={`${gapAnalysis.summary.total} gap${gapAnalysis.summary.total !== 1 ? 's' : ''} detected - Click to review`}
                >
                  <span>{gapAnalysis.summary.critical > 0 ? '🔴' : gapAnalysis.summary.warning > 0 ? '⚠️' : 'ℹ️'}</span>
                  <span>{gapAnalysis.summary.total} Gap{gapAnalysis.summary.total !== 1 ? 's' : ''}</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Recent Automation Activity Summary */}
          {recentAutomationActivity.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/30">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Recent Activity:</span>
              {recentAutomationActivity.slice(0, 3).map((activity, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/40 border border-zinc-700/30 text-xs text-zinc-400"
                  title={activity.message}
                >
                  <span>{activity.icon}</span>
                  <span className="truncate max-w-[200px]">{activity.message.substring(0, 40)}...</span>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Key Metrics Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <button
            onClick={() => onViewChange('chapters')}
            className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6 lg:p-8 hover:border-amber-600/50 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 text-left overflow-hidden"
            aria-label={`View chapters, ${novel.chapters.length} total`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-amber-600/0 transition-all duration-300" />
            <div className="relative">
              <div className="text-4xl mb-3" aria-hidden="true">📖</div>
              <div className="text-3xl lg:text-4xl font-bold text-amber-500 mb-2">{novel.chapters.length}</div>
              <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Chapters</div>
            </div>
          </button>
          <button
            onClick={() => onViewChange('characters')}
            className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6 lg:p-8 hover:border-amber-600/50 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 text-left overflow-hidden"
            aria-label={`View characters, ${novel.characterCodex.length} total`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-amber-600/0 transition-all duration-300" />
            <div className="relative">
              <div className="text-4xl mb-3" aria-hidden="true">👥</div>
              <div className="text-3xl lg:text-4xl font-bold text-amber-500 mb-2">{novel.characterCodex.length}</div>
              <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Characters</div>
            </div>
          </button>
          <button
            onClick={() => onViewChange('world-bible')}
            className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6 lg:p-8 hover:border-amber-600/50 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 text-left overflow-hidden"
            aria-label={`View world bible, ${novel.worldBible.length} entries`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-amber-600/0 transition-all duration-300" />
            <div className="relative">
              <div className="text-4xl mb-3" aria-hidden="true">📚</div>
              <div className="text-3xl lg:text-4xl font-bold text-amber-500 mb-2">{novel.worldBible.length}</div>
              <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">World Entries</div>
            </div>
          </button>
        </section>

        {/* Automation Insights Cards */}
        {(lastTrustScore || gapAnalysis.summary.total > 0 || totalAutoConnections > 0 || consistencyScore !== null) && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Automation Status Card */}
            {(lastTrustScore || totalAutoConnections > 0 || consistencyScore !== null) && (
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-900 border border-amber-600/30 rounded-2xl p-6 lg:p-8 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-fantasy font-bold text-amber-400 uppercase tracking-wide">Automation Status</h3>
                  <button
                    onClick={() => onViewChange('analytics')}
                    className="text-xs text-zinc-500 hover:text-amber-400 uppercase font-semibold tracking-wide transition-colors"
                  >
                    View Details →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {lastTrustScore && (
                    <Tooltip
                      content="Measures the reliability of extracted story data. Higher scores indicate better extraction quality, connections, and consistency."
                      position="top"
                      delay={300}
                    >
                      <div className="space-y-1 cursor-help" data-tour="trust-score">
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide">Trust Score</div>
                          <HelpIcon content="Measures extraction quality, connections, data completeness, and consistency" />
                        </div>
                        <div className={`text-3xl font-fantasy font-bold ${
                          lastTrustScore.overall >= 80 ? 'text-emerald-400' : 
                          lastTrustScore.overall >= 60 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {lastTrustScore.overall}
                        </div>
                        <div className="text-xs text-zinc-600">/100</div>
                      </div>
                    </Tooltip>
                  )}
                  {totalAutoConnections > 0 && (
                    <Tooltip
                      content="Automatically detected connections between story elements (characters, scenes, items, techniques). The AI analyzes your chapters to find these relationships."
                      position="top"
                      delay={300}
                    >
                      <div className="space-y-1 cursor-help" data-tour="auto-connections">
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide">Auto-Connections</div>
                          <HelpIcon content="AI automatically detects relationships between characters, scenes, items, and techniques from your chapters" />
                        </div>
                        <div className="text-3xl font-fantasy font-bold text-blue-400">
                          {totalAutoConnections}
                        </div>
                        {recentAutoConnectionsCount > 0 && (
                          <div className="text-xs text-emerald-400">+{recentAutoConnectionsCount} last 24h</div>
                        )}
                      </div>
                    </Tooltip>
                  )}
                  {consistencyScore !== null && (
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500 uppercase tracking-wide">Consistency</div>
                      <div className={`text-3xl font-fantasy font-bold ${
                        consistencyScore >= 80 ? 'text-emerald-400' : 
                        consistencyScore >= 60 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {consistencyScore}
                      </div>
                      <div className="text-xs text-zinc-600">/100</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Gap Analysis Card */}
            {gapAnalysis.summary.total > 0 && (
              <GapAnalysisPanel
                gapAnalysis={gapAnalysis}
                collapsible={true}
                defaultExpanded={false}
                onReview={() => setShowPreGenerationAnalysis(true)}
                className="shadow-xl"
              />
            )}
          </section>
        )}

        {/* Pre-Generation Gap Analysis Modal */}
        {showPreGenerationAnalysis && gapAnalysis.summary.total > 0 && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-600/30 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-zinc-700/50 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-xl font-fantasy font-bold text-amber-400">Pre-Generation Analysis</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      {gapAnalysis.summary.total} gap{gapAnalysis.summary.total !== 1 ? 's' : ''} detected before generation
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreGenerationAnalysis(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800"
                  aria-label="Close analysis"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <GapAnalysisPanel
                  gapAnalysis={gapAnalysis}
                  collapsible={false}
                  defaultExpanded={true}
                />
              </div>
              <div className="flex gap-3 p-6 border-t border-zinc-700/50 bg-zinc-900/30">
                <button
                  onClick={() => {
                    setShowPreGenerationAnalysis(false);
                    onGenerateChapter(instruction);
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-[1.02]"
                >
                  Proceed Anyway
                </button>
                <button
                  onClick={() => setShowPreGenerationAnalysis(false)}
                  className="px-6 py-3 text-zinc-400 hover:text-zinc-200 font-semibold transition-colors rounded-xl hover:bg-zinc-800/50"
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Generation Section */}
        <section className="bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-900 border border-zinc-700/50 rounded-2xl p-8 lg:p-10 shadow-xl space-y-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-2xl font-fantasy font-bold text-amber-400 mb-1">Chapter Generation</h3>
              <p className="text-sm text-zinc-400">Create the next chapter of your story</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Story Health Indicator */}
              {novel.chapters.length > 0 && (
                <button
                  onClick={() => setShowHealthDashboard(!showHealthDashboard)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all shadow-lg ${
                    storyHealthReport.overallHealth >= 80
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                      : storyHealthReport.overallHealth >= 60
                      ? 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
                      : 'bg-red-600/20 text-red-400 border-red-500/40 hover:bg-red-600/30'
                  }`}
                  title={`Story Health: ${storyHealthReport.overallHealth}/100 - Click to ${showHealthDashboard ? 'hide' : 'view'} details`}
                >
                  <MiniHealthIndicator report={storyHealthReport} />
                </button>
              )}
              {gapAnalysis.summary.total > 0 && !showPreGenerationAnalysis && (
                <button
                  onClick={() => setShowPreGenerationAnalysis(true)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm transition-all shadow-lg ${
                    gapAnalysis.summary.critical > 0
                      ? 'bg-red-600/20 text-red-400 border-red-600/40 hover:bg-red-600/30 hover:border-red-600/60'
                      : 'bg-amber-600/20 text-amber-400 border-amber-600/40 hover:bg-amber-600/30 hover:border-amber-600/60'
                  }`}
                >
                  <span>{gapAnalysis.summary.critical > 0 ? '🔴' : '⚠️'}</span>
                  <span>{gapAnalysis.summary.total} Gap{gapAnalysis.summary.total !== 1 ? 's' : ''}</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Story Health Dashboard - Expandable */}
          {showHealthDashboard && novel.chapters.length > 0 && (
            <div className="animate-in slide-in-from-top duration-200">
              <ChapterGenerationHealthDashboard 
                report={storyHealthReport}
                onWarningClick={(warning) => {
                  console.log('[Health Dashboard] Warning clicked:', warning);
                  // Could navigate to relevant entity or show details
                }}
              />
            </div>
          )}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                Optional Instructions
              </label>
              <textarea
                value={instruction}
                onChange={(e) => onInstructionChange(e.target.value)}
                placeholder="Add specific instructions for this chapter (e.g., 'Focus on character development' or 'Introduce a new antagonist')..."
                className="w-full bg-zinc-950/50 border border-zinc-700/50 rounded-xl p-4 text-sm text-zinc-200 h-28 font-serif-novel resize-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all placeholder:text-zinc-600"
                disabled={isGenerating}
                aria-label="Chapter generation instructions"
                aria-describedby="instruction-description"
              />
              <span id="instruction-description" className="sr-only">
                Optional instructions to guide the AI in generating the next chapter
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onGenerateChapter(instruction)}
                disabled={isGenerating || (gapAnalysis.summary.critical > 0 && !showPreGenerationAnalysis)}
                className="flex-1 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-xl shadow-amber-900/30 hover:shadow-2xl hover:shadow-amber-900/40 hover:scale-[1.01] disabled:hover:scale-100 text-lg"
                aria-label={isGenerating ? `Generating chapter, ${generationProgress}% complete` : 'Generate next chapter'}
                {...(isGenerating && { 'aria-busy': 'true' })}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></span>
                    <span>Generating... ({generationProgress}%)</span>
                  </span>
                ) : (
                  'Generate Next Chapter'
                )}
              </button>
              {onBatchGenerate && (
                <button
                  onClick={() => onBatchGenerate(instruction)}
                  disabled={isGenerating || (gapAnalysis.summary.critical > 0 && !showPreGenerationAnalysis)}
                  className="flex-1 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-xl shadow-amber-900/30 hover:shadow-2xl hover:shadow-amber-900/40 hover:scale-[1.01] disabled:hover:scale-100 text-lg"
                  aria-label={isGenerating ? `Generating batch, ${generationProgress}% complete` : 'Generate batch of 5 chapters'}
                  {...(isGenerating && { 'aria-busy': 'true' })}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></span>
                      <span>Generating... ({generationProgress}%)</span>
                    </span>
                  ) : (
                    'Generate Batch (5 Chapters)'
                  )}
                </button>
              )}
            </div>
            {isGenerating && generationStatus && (
              <p className="text-sm text-zinc-400 text-center font-medium">{generationStatus}</p>
            )}
            {gapAnalysis.summary.critical > 0 && !showPreGenerationAnalysis && (
              <div className="bg-red-950/20 border border-red-600/30 rounded-xl p-3 flex items-start gap-2">
                <span className="text-red-400 text-lg">⚠️</span>
                <p className="text-sm text-red-300 flex-1">
                  {gapAnalysis.summary.critical} critical gap{gapAnalysis.summary.critical !== 1 ? 's' : ''} detected. Review before generating.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Post-Generation Summary */}
        {showPostGenerationSummary && !isGenerating && (
          <PostGenerationSummary
            trustScore={lastTrustScore}
            autoConnections={Array.isArray(recentAutoConnections) ? recentAutoConnections : []}
            consistencyIssues={Array.isArray(consistencyIssues) ? consistencyIssues : []}
            onViewDetails={() => onViewChange('analytics')}
            onDismiss={() => setShowPostGenerationSummary(false)}
            autoHideAfter={30}
          />
        )}

        {/* Quick Access to Core Features */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-fantasy font-bold text-amber-400">Quick Access</h3>
              <p className="text-sm text-zinc-500 mt-1">Navigate to main features</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 'planning', label: 'Saga & Arcs', icon: '🗺️', desc: 'Arc planning' },
              { id: 'characters', label: 'Characters', icon: '👥', desc: 'Character codex' },
              { id: 'world-bible', label: 'World Bible', icon: '📜', desc: 'World building' },
              { id: 'antagonists', label: 'Antagonists', icon: '⚔️', desc: 'Opposition' },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => onViewChange(tool.id as any)}
                className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-5 hover:border-amber-600/50 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 text-center overflow-hidden"
                aria-label={`Navigate to ${tool.label}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-amber-600/0 transition-all duration-300" />
                <div className="relative">
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">{tool.icon}</div>
                  <div className="text-sm font-bold text-zinc-300 mb-1">{tool.label}</div>
                  <div className="text-xs text-zinc-500">{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Quick Access to World-Class Enhancements */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-fantasy font-bold text-amber-400">Analysis Tools</h3>
              <p className="text-sm text-zinc-500 mt-1">World-class writing analysis and insights</p>
            </div>
          </div>
          {novel.chapters.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h4 className="text-lg font-semibold text-zinc-300 mb-2">No Analysis Data Yet</h4>
              <p className="text-sm text-zinc-500 mb-4">Generate chapters to unlock world-class analysis tools</p>
              <button
                onClick={() => onGenerateChapter()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-sm transition-all"
              >
                Generate First Chapter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[
                { id: 'structure-visualizer', label: 'Structure', icon: '🏛️', desc: 'Story frameworks' },
                { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', desc: 'Reader engagement' },
                { id: 'tension-curve', label: 'Tension', icon: '⚡', desc: 'Conflict mapping' },
                { id: 'theme-evolution', label: 'Themes', icon: '🎭', desc: 'Theme tracking' },
                { id: 'character-psychology', label: 'Psychology', icon: '🧠', desc: 'Character depth' },
                { id: 'device-dashboard', label: 'Devices', icon: '✨', desc: 'Literary devices' },
                { id: 'draft-comparison', label: 'Drafts', icon: '📝', desc: 'Version compare' },
                { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', desc: 'Quality metrics' },
                { id: 'improvement-history', label: 'History', icon: '📜', desc: 'Change history' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onViewChange(tool.id as any)}
                  className="group relative bg-gradient-to-br from-zinc-900 to-zinc-900/80 border border-zinc-700/50 rounded-xl p-5 hover:border-amber-600/50 hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 text-center overflow-hidden"
                  aria-label={`View ${tool.label} analysis`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-600/0 to-amber-600/0 group-hover:from-amber-600/5 group-hover:to-amber-600/0 transition-all duration-300" />
                  <div className="relative">
                    <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">{tool.icon}</div>
                    <div className="text-sm font-bold text-zinc-300 mb-1">{tool.label}</div>
                    <div className="text-xs text-zinc-500">{tool.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

      {/* Recent Chapters */}
      {novel.chapters.length > 0 && (
        <section>
          <h3 className="text-xl font-fantasy font-bold text-amber-400 mb-4">Recent Chapters</h3>
          <div className="space-y-3">
            {novel.chapters.slice(-5).reverse().map((chapter) => (
              <div
                key={chapter.id}
                className={`w-full text-left bg-zinc-900 border rounded-xl p-4 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all duration-200 cursor-pointer ${
                  activeChapterId === chapter.id ? 'border-amber-600' : 'border-zinc-700'
                }`}
                onClick={() => onChapterSelect(chapter.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChapterSelect(chapter.id);
                  }
                }}
                aria-label={`Select Chapter ${chapter.number}: ${chapter.title}`}
                aria-current={activeChapterId === chapter.id ? 'true' : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-amber-500 font-semibold mb-1">Chapter {chapter.number}</div>
                    <div className="text-base font-bold text-zinc-200 mb-2 truncate">{chapter.title}</div>
                    {chapter.summary && (
                      <div className="text-sm text-zinc-400 line-clamp-2">{chapter.summary}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewChange('editor');
                      onChapterSelect(chapter.id);
                    }}
                    className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 whitespace-nowrap flex-shrink-0"
                    aria-label={`Edit Chapter ${chapter.number}: ${chapter.title}`}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
};

const DashboardView = memo(DashboardViewComponent);
export default DashboardView;
