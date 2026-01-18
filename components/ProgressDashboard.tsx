import React, { memo, useMemo, lazy, Suspense, useState } from 'react';
import { NovelState } from '../types';
import { calculateWordCounts, calculatePacingMetrics, calculateWritingVelocity, calculateNarrativeQualityMetrics } from '../services/analyticsService';
import { PromptCacheDashboard } from './PromptCacheDashboard';

// Helper to safely convert any value to a string
function safeToString(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  
  if (value instanceof Error) {
    return value.message || 'Error (no message)';
  }
  
  // For objects, try JSON.stringify with circular reference handling
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch {
    // If JSON.stringify fails, try basic toString
    try {
      return String(value);
    } catch {
      return '[Unable to convert to string]';
    }
  }
}

// Helper to safely wrap lazy imports with error handling
function safeLazyImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() => {
    return importFn().catch((error) => {
      // DO NOT call console.error here - React's lazy loader will try to log it
      // and if we pass an object that can't be converted, it will crash
      // Instead, silently return a fallback component
      
      // Return a fallback component
      const FallbackComponent: React.FC = () => (
        <div className="p-6 bg-red-950/40 border border-red-900/60 rounded-xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Component Failed to Load</h2>
          <p className="text-red-300">Please refresh the page to try again.</p>
        </div>
      );
      
      return {
        default: FallbackComponent as T
      };
    });
  });
}

const EditorReportsView = safeLazyImport(() => import('./EditorReportsView'));
const AntagonistTracker = safeLazyImport(() => import('./AntagonistTracker'));

interface ProgressDashboardProps {
  novelState: NovelState;
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ novelState }) => {
  const [showEditorReports, setShowEditorReports] = useState(false);
  const wordCounts = useMemo(() => calculateWordCounts(novelState), [novelState]);
  const pacingMetrics = useMemo(() => calculatePacingMetrics(novelState), [novelState]);
  const writingVelocity = useMemo(() => {
    const totalGoal = novelState.writingGoals.find(g => g.type === 'total');
    return calculateWritingVelocity(novelState, totalGoal?.target);
  }, [novelState]);
  const qualityMetrics = useMemo(() => calculateNarrativeQualityMetrics(novelState), [novelState]);

  return (
    <div className="p-4 md:p-5 lg:p-6 max-w-6xl mx-auto pt-12 md:pt-16">
      <div className="mb-6 border-b border-zinc-700 pb-4">
        <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Progress Dashboard</h2>
        <p className="text-sm text-zinc-400 mt-2">Comprehensive analytics and progress tracking</p>
      </div>

      {/* Prompt Cache Performance */}
      <div className="mb-8">
        <PromptCacheDashboard />
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${novelState.antagonists && novelState.antagonists.length > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-4'} gap-6 mb-8`}>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="text-3xl font-fantasy font-bold text-amber-500 mb-2">
            {wordCounts.total.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 uppercase font-semibold">Total Words</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="text-3xl font-fantasy font-bold text-emerald-500 mb-2">
            {novelState.chapters.length}
          </div>
          <div className="text-xs text-zinc-400 uppercase font-semibold">Chapters</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="text-3xl font-fantasy font-bold text-indigo-500 mb-2">
            {wordCounts.byScene.length}
          </div>
          <div className="text-xs text-zinc-400 uppercase font-semibold">Scenes</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <div className="text-3xl font-fantasy font-bold text-red-500 mb-2">
            {Math.round(wordCounts.averagePerChapter).toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 uppercase font-semibold">Avg Words/Chapter</div>
        </div>
        {novelState.antagonists && novelState.antagonists.length > 0 && (
          <>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <div className="text-3xl font-fantasy font-bold text-red-600 mb-2">
                {novelState.antagonists.filter(a => a.status === 'active').length}
              </div>
              <div className="text-xs text-zinc-400 uppercase font-semibold">Active Threats</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <div className="text-3xl font-fantasy font-bold text-amber-500 mb-2">
                {novelState.antagonists.length}
              </div>
              <div className="text-xs text-zinc-400 uppercase font-semibold">Total Antagonists</div>
            </div>
          </>
        )}
      </div>

      {/* Antagonist Tracker Section - Only show if there are antagonists */}
      {novelState.antagonists && novelState.antagonists.length > 0 && (
        <div className="mb-8">
          <Suspense fallback={<div className="text-zinc-400 text-sm p-4">Loading antagonist status...</div>}>
            <AntagonistTracker 
              novel={novelState} 
              currentChapterNumber={novelState.chapters.length} 
            />
          </Suspense>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Pacing Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Pacing Pattern</span>
              <span className={`text-sm font-bold px-3 py-1 rounded ${
                pacingMetrics.pacingPattern === 'fast' ? 'bg-emerald-600/20 text-emerald-400' :
                pacingMetrics.pacingPattern === 'slow' ? 'bg-amber-600/20 text-amber-400' :
                'bg-blue-600/20 text-blue-400'
              }`}>
                {pacingMetrics.pacingPattern.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Tension Level</span>
              <span className={`text-sm font-bold px-3 py-1 rounded ${
                pacingMetrics.tensionLevel === 'peak' ? 'bg-red-600/20 text-red-400' :
                pacingMetrics.tensionLevel === 'high' ? 'bg-orange-600/20 text-orange-400' :
                pacingMetrics.tensionLevel === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                'bg-zinc-600/20 text-zinc-400'
              }`}>
                {pacingMetrics.tensionLevel.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Avg Words/Scene</span>
              <span className="text-sm font-bold text-amber-400">
                {Math.round(pacingMetrics.averageWordsPerScene).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Writing Velocity</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Words/Day</span>
              <span className="text-sm font-bold text-emerald-400">
                {Math.round(writingVelocity.wordsPerDay).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Words/Week</span>
              <span className="text-sm font-bold text-emerald-400">
                {Math.round(writingVelocity.wordsPerWeek).toLocaleString()}
              </span>
            </div>
            {writingVelocity.progressPercentage > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-zinc-400">Progress</span>
                  <span className="text-sm font-bold text-amber-400">
                    {Math.round(writingVelocity.progressPercentage)}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300"
                    style={{ width: `${Math.min(writingVelocity.progressPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {qualityMetrics && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Narrative Quality Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-zinc-400">Overall Quality Score</span>
                <span className={`text-2xl font-bold ${
                  qualityMetrics.overallQualityScore >= 90 ? 'text-emerald-400' :
                  qualityMetrics.overallQualityScore >= 70 ? 'text-amber-400' :
                  'text-red-400'
                }`}>
                  {qualityMetrics.overallQualityScore}/100
                </span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    qualityMetrics.overallQualityScore >= 90 ? 'bg-gradient-to-r from-emerald-600 to-emerald-500' :
                    qualityMetrics.overallQualityScore >= 70 ? 'bg-gradient-to-r from-amber-600 to-amber-500' :
                    'bg-gradient-to-r from-red-600 to-red-500'
                  }`}
                  style={{ width: `${qualityMetrics.overallQualityScore}%` }}
                ></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">Foreshadowing</div>
                <div className="text-lg font-bold text-amber-400">
                  {Math.round(qualityMetrics.foreshadowingPayoffRate * 100)}%
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">Emotional Intensity</div>
                <div className="text-lg font-bold text-emerald-400">
                  {Math.round(qualityMetrics.emotionalIntensityScore * 100)}%
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">Pacing</div>
                <div className="text-lg font-bold text-indigo-400">
                  {Math.round(qualityMetrics.pacingConsistency * 100)}%
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">Symbolism</div>
                <div className="text-lg font-bold text-purple-400">
                  {Math.round(qualityMetrics.symbolismDepth * 100)}%
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">Subtext</div>
                <div className="text-lg font-bold text-cyan-400">
                  {Math.round(qualityMetrics.subtextPresence * 100)}%
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <div className="text-xs text-zinc-500 uppercase mb-1">POV Consistency</div>
                <div className="text-lg font-bold text-rose-400">
                  {Math.round(qualityMetrics.povConsistency * 100)}%
                </div>
              </div>
            </div>
            
            {qualityMetrics.recommendations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Recommendations</div>
                <ul className="space-y-2">
                  {qualityMetrics.recommendations.slice(0, 5).map((rec, idx) => (
                    <li key={idx} className="text-sm text-zinc-300 flex items-start">
                      <span className="text-amber-500 mr-2">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Word Count by Chapter</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {wordCounts.byChapter.length === 0 ? (
            <p className="text-sm text-zinc-500 italic text-center py-4">No chapters yet</p>
          ) : (
            wordCounts.byChapter.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-zinc-500">Ch {item.chapterNumber}</span>
                  <span className="text-sm text-zinc-300">{item.chapterTitle}</span>
                </div>
                <span className="text-sm font-bold text-amber-400">{item.wordCount.toLocaleString()} words</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Reports Section */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">Editor Reports</h3>
          <button
            onClick={() => setShowEditorReports(!showEditorReports)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            {showEditorReports ? 'Hide' : 'View Reports'}
          </button>
        </div>
        {showEditorReports && (
          <div className="mt-4">
            <Suspense fallback={<div className="text-zinc-400 text-sm p-4">Loading editor reports...</div>}>
              <EditorReportsView novelState={novelState} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ProgressDashboard);
