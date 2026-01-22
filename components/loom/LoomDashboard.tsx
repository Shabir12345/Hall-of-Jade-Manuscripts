/**
 * Loom Dashboard - The Heavenly Loom Narrative Command Center
 * 
 * A visual cockpit for controlling narrative threads at scale.
 * Features:
 * - Thread Health Panel with pulse colors
 * - Payoff Debt meters
 * - Vertical chapter timeline with animated thread lines
 * - Intervention controls (Force Attention, Boost Karma, etc.)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { NovelState, StoryThread } from '../../types';
import {
  LoomThread,
  ThreadCategory,
  LoomThreadStatus,
  ThreadHealthMetrics,
  LoomConfig,
  DEFAULT_LOOM_CONFIG,
} from '../../types/loom';
import {
  storyThreadToLoomThread,
  calculateThreadHealthMetrics,
  getOverallLoomHealth,
  selectThreadsForChapter,
} from '../../services/loom/threadPhysicsEngine';
import { useToast } from '../../contexts/ToastContext';
import { ThreadHealthPanel } from './ThreadHealthPanel';
import { PayoffDebtMeter } from './PayoffDebtMeter';
import { LoomTimeline } from './LoomTimeline';
import { InterventionControls } from './InterventionControls';
import { ThreadPhysicsCard } from './ThreadPhysicsCard';

interface LoomDashboardProps {
  novelState: NovelState;
  onUpdateThread?: (thread: LoomThread) => void;
  onForceAttention?: (threadId: string) => void;
  onBoostKarma?: (threadId: string, amount: number) => void;
  onMarkAbandoned?: (threadId: string, reason: string) => void;
  config?: Partial<LoomConfig>;
}

type ViewMode = 'health' | 'timeline' | 'physics' | 'interventions';

export const LoomDashboard: React.FC<LoomDashboardProps> = ({
  novelState,
  onUpdateThread,
  onForceAttention,
  onBoostKarma,
  onMarkAbandoned,
  config = {},
}) => {
  const { showSuccess, showError } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('health');
  const [selectedThread, setSelectedThread] = useState<LoomThread | null>(null);
  const [filterCategory, setFilterCategory] = useState<ThreadCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<LoomThreadStatus | 'all'>('all');

  const loomConfig = useMemo(() => ({
    ...DEFAULT_LOOM_CONFIG,
    ...config,
  }), [config]);

  const currentChapter = novelState.chapters.length;

  // Convert legacy threads to Loom threads
  const loomThreads = useMemo(() => {
    const threads = novelState.storyThreads || [];
    return threads.map(t => storyThreadToLoomThread(t, currentChapter));
  }, [novelState.storyThreads, currentChapter]);

  // Calculate health metrics for all threads
  const healthMetrics = useMemo(() => {
    return loomThreads.map(t => calculateThreadHealthMetrics(t, currentChapter));
  }, [loomThreads, currentChapter]);

  // Overall loom health
  const overallHealth = useMemo(() => {
    return getOverallLoomHealth(loomThreads, currentChapter);
  }, [loomThreads, currentChapter]);

  // Thread selection for next chapter
  const threadSelection = useMemo(() => {
    return selectThreadsForChapter(loomThreads, currentChapter + 1, loomConfig);
  }, [loomThreads, currentChapter, loomConfig]);

  // Filtered threads
  const filteredThreads = useMemo(() => {
    return loomThreads.filter(t => {
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (filterStatus !== 'all' && t.loomStatus !== filterStatus) return false;
      return true;
    });
  }, [loomThreads, filterCategory, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const active = loomThreads.filter(t => t.loomStatus !== 'CLOSED' && t.loomStatus !== 'ABANDONED');
    return {
      total: loomThreads.length,
      active: active.length,
      blooming: loomThreads.filter(t => t.loomStatus === 'BLOOMING').length,
      stalled: loomThreads.filter(t => t.loomStatus === 'STALLED').length,
      urgent: active.filter(t => t.urgencyScore > 300).length,
      avgKarma: active.length > 0 
        ? Math.round(active.reduce((a, t) => a + t.karmaWeight, 0) / active.length)
        : 0,
      totalDebt: active.reduce((a, t) => a + t.payoffDebt, 0),
    };
  }, [loomThreads]);

  const handleForceAttention = useCallback((threadId: string) => {
    onForceAttention?.(threadId);
    showSuccess('Director attention forced for next chapter');
  }, [onForceAttention, showSuccess]);

  const handleBoostKarma = useCallback((threadId: string, amount: number) => {
    onBoostKarma?.(threadId, amount);
    showSuccess(`Karma weight increased by ${amount}`);
  }, [onBoostKarma, showSuccess]);

  const handleMarkAbandoned = useCallback((threadId: string, reason: string) => {
    onMarkAbandoned?.(threadId, reason);
    showSuccess('Thread marked as intentionally abandoned');
  }, [onMarkAbandoned, showSuccess]);

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/20 border-b border-zinc-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-500 flex items-center gap-2">
                <span className="text-3xl">🧵</span>
                The Heavenly Loom
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Narrative Control System • Chapter {currentChapter}
              </p>
            </div>
            
            {/* Overall Health Indicator */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${
                  overallHealth >= 70 ? 'text-emerald-400' :
                  overallHealth >= 40 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {overallHealth}
                </div>
                <div className="text-xs text-zinc-500 uppercase">Loom Health</div>
              </div>
              
              <div className="h-12 w-px bg-zinc-700" />
              
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-zinc-200">{stats.active}</div>
                  <div className="text-xs text-zinc-500">Active</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-400">{stats.blooming}</div>
                  <div className="text-xs text-zinc-500">Blooming</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{stats.stalled}</div>
                  <div className="text-xs text-zinc-500">Stalled</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-400">{stats.urgent}</div>
                  <div className="text-xs text-zinc-500">Urgent</div>
                </div>
              </div>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2 mt-6">
            {(['health', 'timeline', 'physics', 'interventions'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  viewMode === mode
                    ? 'bg-amber-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }`}
              >
                {mode === 'health' && '💓 Health'}
                {mode === 'timeline' && '📊 Timeline'}
                {mode === 'physics' && '⚛️ Physics'}
                {mode === 'interventions' && '🎛️ Interventions'}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as ThreadCategory | 'all')}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200"
            >
              <option value="all">All Categories</option>
              <option value="SOVEREIGN">👑 Sovereign</option>
              <option value="MAJOR">⭐ Major</option>
              <option value="MINOR">○ Minor</option>
              <option value="SEED">🌱 Seed</option>
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as LoomThreadStatus | 'all')}
              className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200"
            >
              <option value="all">All Status</option>
              <option value="SEED">🌱 Seed</option>
              <option value="OPEN">📖 Open</option>
              <option value="ACTIVE">🔥 Active</option>
              <option value="BLOOMING">🌸 Blooming</option>
              <option value="STALLED">⚠️ Stalled</option>
              <option value="CLOSED">✅ Closed</option>
              <option value="ABANDONED">💀 Abandoned</option>
            </select>
            
            <div className="flex-1" />
            
            <div className="text-sm text-zinc-400">
              {filteredThreads.length} of {loomThreads.length} threads
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'health' && (
            <ThreadHealthPanel
              threads={filteredThreads}
              healthMetrics={healthMetrics.filter(m => 
                filteredThreads.some(t => t.id === m.threadId)
              )}
              currentChapter={currentChapter}
              selectedThread={selectedThread}
              onSelectThread={setSelectedThread}
              onForceAttention={handleForceAttention}
            />
          )}

          {viewMode === 'timeline' && (
            <LoomTimeline
              threads={filteredThreads}
              chapters={novelState.chapters}
              currentChapter={currentChapter}
              onSelectThread={setSelectedThread}
            />
          )}

          {viewMode === 'physics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredThreads
                .sort((a, b) => b.urgencyScore - a.urgencyScore)
                .map(thread => (
                  <ThreadPhysicsCard
                    key={thread.id}
                    thread={thread}
                    currentChapter={currentChapter}
                    isSelected={selectedThread?.id === thread.id}
                    onClick={() => setSelectedThread(thread)}
                  />
                ))}
            </div>
          )}

          {viewMode === 'interventions' && (
            <InterventionControls
              threads={filteredThreads}
              threadSelection={threadSelection}
              currentChapter={currentChapter}
              onForceAttention={handleForceAttention}
              onBoostKarma={handleBoostKarma}
              onMarkAbandoned={handleMarkAbandoned}
            />
          )}
        </div>

        {/* Director Preview Panel */}
        {threadSelection.primaryThreads.length > 0 && (
          <div className="border-t border-zinc-700 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500 font-bold">📋 Next Chapter Directive</span>
              <span className="text-xs text-zinc-500">
                (Auto-selected by Thread Physics Engine)
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {threadSelection.primaryThreads.slice(0, 3).map(thread => (
                <div
                  key={thread.id}
                  className="px-3 py-2 bg-zinc-800 border border-amber-600/30 rounded-lg flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${
                    thread.loomStatus === 'BLOOMING' ? 'bg-amber-400 animate-pulse' :
                    thread.loomStatus === 'STALLED' ? 'bg-red-400' : 'bg-emerald-400'
                  }`} />
                  <span className="text-sm font-medium text-zinc-200">{thread.signature}</span>
                  <span className="text-xs text-zinc-500">U:{thread.urgencyScore}</span>
                </div>
              ))}
            </div>
            {threadSelection.reasoning.length > 0 && (
              <div className="mt-2 text-xs text-zinc-500">
                {threadSelection.reasoning[0]}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Sidebar - Selected Thread Details */}
      {selectedThread && (
        <div className="w-96 border-l border-zinc-700 bg-zinc-900 overflow-y-auto">
          <div className="p-4 border-b border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-zinc-200">{selectedThread.title}</h3>
              <button
                onClick={() => setSelectedThread(null)}
                className="p-1 text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-zinc-500 mt-1">{selectedThread.signature}</div>
          </div>

          <div className="p-4 space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                selectedThread.loomStatus === 'BLOOMING' ? 'bg-amber-600/20 text-amber-400' :
                selectedThread.loomStatus === 'STALLED' ? 'bg-red-600/20 text-red-400' :
                selectedThread.loomStatus === 'ACTIVE' ? 'bg-emerald-600/20 text-emerald-400' :
                selectedThread.loomStatus === 'CLOSED' ? 'bg-zinc-600/20 text-zinc-400' :
                'bg-zinc-600/20 text-zinc-400'
              }`}>
                {selectedThread.loomStatus}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                selectedThread.category === 'SOVEREIGN' ? 'bg-purple-600/20 text-purple-400' :
                selectedThread.category === 'MAJOR' ? 'bg-blue-600/20 text-blue-400' :
                'bg-zinc-600/20 text-zinc-400'
              }`}>
                {selectedThread.category}
              </span>
            </div>

            {/* Physics Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Karma Weight</div>
                <div className="text-xl font-bold text-amber-400">{selectedThread.karmaWeight}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Urgency</div>
                <div className={`text-xl font-bold ${
                  selectedThread.urgencyScore > 300 ? 'text-red-400' :
                  selectedThread.urgencyScore > 100 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {selectedThread.urgencyScore}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Velocity</div>
                <div className={`text-xl font-bold ${
                  selectedThread.velocity > 0 ? 'text-emerald-400' :
                  selectedThread.velocity < 0 ? 'text-red-400' : 'text-zinc-400'
                }`}>
                  {selectedThread.velocity > 0 ? '+' : ''}{selectedThread.velocity}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500">Entropy</div>
                <div className={`text-xl font-bold ${
                  selectedThread.entropy > 60 ? 'text-red-400' :
                  selectedThread.entropy > 30 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {selectedThread.entropy}%
                </div>
              </div>
            </div>

            {/* Payoff Debt Meter */}
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500">Payoff Debt</span>
                <span className="text-sm font-bold text-orange-400">{selectedThread.payoffDebt}</span>
              </div>
              <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    selectedThread.payoffDebt > 100 ? 'bg-red-500' :
                    selectedThread.payoffDebt > 50 ? 'bg-orange-500' :
                    selectedThread.payoffDebt > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, selectedThread.payoffDebt)}%` }}
                />
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {selectedThread.payoffDebt > 100 
                  ? '⚠️ Critical debt - resolve soon!'
                  : selectedThread.payoffDebt > 50
                  ? 'High debt - readers are waiting'
                  : 'Debt manageable'}
              </div>
            </div>

            {/* Chapter Info */}
            <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">First Chapter</span>
                <span className="text-zinc-200">{selectedThread.firstChapter}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Last Mentioned</span>
                <span className="text-zinc-200">{selectedThread.lastMentionedChapter}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Mentions</span>
                <span className="text-zinc-200">{selectedThread.mentionCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Progressions</span>
                <span className="text-zinc-200">{selectedThread.progressCount}</span>
              </div>
            </div>

            {/* Summary */}
            {selectedThread.summary && (
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">Summary</div>
                <div className="text-sm text-zinc-300">{selectedThread.summary}</div>
              </div>
            )}

            {/* Resolution Criteria */}
            {selectedThread.resolutionCriteria && (
              <div className="bg-zinc-800 rounded-lg p-3 border border-amber-600/30">
                <div className="text-xs text-amber-500 mb-1">Resolution Criteria</div>
                <div className="text-sm text-zinc-300">{selectedThread.resolutionCriteria}</div>
              </div>
            )}

            {/* Participants */}
            {selectedThread.participants.length > 0 && (
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-2">Participants</div>
                <div className="flex flex-wrap gap-1">
                  {selectedThread.participants.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Intervention Buttons */}
            <div className="space-y-2 pt-4 border-t border-zinc-700">
              <button
                onClick={() => handleForceAttention(selectedThread.id)}
                className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
              >
                Force Director Attention
              </button>
              <button
                onClick={() => handleBoostKarma(selectedThread.id, 10)}
                className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg font-semibold transition-colors"
              >
                Boost Karma Weight (+10)
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Reason for abandonment:');
                  if (reason) handleMarkAbandoned(selectedThread.id, reason);
                }}
                className="w-full px-4 py-2 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 rounded-lg font-semibold transition-colors border border-zinc-700"
              >
                Mark as Intentional Abandonment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoomDashboard;
