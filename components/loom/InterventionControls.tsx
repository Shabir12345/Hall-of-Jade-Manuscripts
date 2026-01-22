/**
 * Intervention Controls
 * 
 * Manual controls for the author to intervene in thread management:
 * - Force Director Attention
 * - Boost/Reduce Karma Weight
 * - Mark as Intentional Abandonment
 * - Convert Thread to Seed (safe retcon)
 */

import React, { useState } from 'react';
import { LoomThread } from '../../types/loom';
import { ThreadSelectionResult } from '../../services/loom/threadPhysicsEngine';

interface InterventionControlsProps {
  threads: LoomThread[];
  threadSelection: ThreadSelectionResult;
  currentChapter: number;
  onForceAttention: (threadId: string) => void;
  onBoostKarma: (threadId: string, amount: number) => void;
  onMarkAbandoned: (threadId: string, reason: string) => void;
}

export const InterventionControls: React.FC<InterventionControlsProps> = ({
  threads,
  threadSelection,
  currentChapter,
  onForceAttention,
  onBoostKarma,
  onMarkAbandoned,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [abandonReason, setAbandonReason] = useState('');
  const [karmaAdjustment, setKarmaAdjustment] = useState(10);

  const urgentThreads = threads.filter(t => t.urgencyScore > 300);
  const stalledThreads = threads.filter(t => t.loomStatus === 'STALLED');
  const bloomingThreads = threads.filter(t => t.loomStatus === 'BLOOMING');

  const selectedThread = threads.find(t => t.id === selectedThreadId);

  return (
    <div className="space-y-8">
      {/* Quick Actions Panel */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
          ⚡ Quick Interventions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Urgent Threads */}
          <div className="bg-red-950/20 border border-red-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-red-400 font-semibold">🔥 Urgent</span>
              <span className="text-red-400/60 text-sm">({urgentThreads.length})</span>
            </div>
            {urgentThreads.length > 0 ? (
              <div className="space-y-2">
                {urgentThreads.slice(0, 3).map(thread => (
                  <div 
                    key={thread.id}
                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
                  >
                    <span className="text-sm text-zinc-300 truncate flex-1">
                      {thread.title}
                    </span>
                    <button
                      onClick={() => onForceAttention(thread.id)}
                      className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                    >
                      Force
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No urgent threads</div>
            )}
          </div>

          {/* Stalled Threads */}
          <div className="bg-orange-950/20 border border-orange-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-orange-400 font-semibold">⚠️ Stalled</span>
              <span className="text-orange-400/60 text-sm">({stalledThreads.length})</span>
            </div>
            {stalledThreads.length > 0 ? (
              <div className="space-y-2">
                {stalledThreads.slice(0, 3).map(thread => (
                  <div 
                    key={thread.id}
                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
                  >
                    <span className="text-sm text-zinc-300 truncate flex-1">
                      {thread.title}
                    </span>
                    <button
                      onClick={() => onForceAttention(thread.id)}
                      className="ml-2 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition-colors"
                    >
                      Revive
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No stalled threads</div>
            )}
          </div>

          {/* Blooming Threads */}
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400 font-semibold">🌸 Blooming</span>
              <span className="text-amber-400/60 text-sm">({bloomingThreads.length})</span>
            </div>
            {bloomingThreads.length > 0 ? (
              <div className="space-y-2">
                {bloomingThreads.slice(0, 3).map(thread => (
                  <div 
                    key={thread.id}
                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded"
                  >
                    <span className="text-sm text-zinc-300 truncate flex-1">
                      {thread.title}
                    </span>
                    <span className="text-xs text-amber-400">Ready!</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">No blooming threads</div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Intervention Panel */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
          🎛️ Thread Intervention Panel
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Thread Selector */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Select Thread</label>
            <select
              value={selectedThreadId || ''}
              onChange={(e) => setSelectedThreadId(e.target.value || null)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200"
              aria-label="Select a thread to modify"
            >
              <option value="">Choose a thread...</option>
              {threads
                .filter(t => t.loomStatus !== 'CLOSED')
                .sort((a, b) => b.urgencyScore - a.urgencyScore)
                .map(thread => (
                  <option key={thread.id} value={thread.id}>
                    [{thread.loomStatus}] {thread.title} (U:{thread.urgencyScore})
                  </option>
                ))}
            </select>
          </div>

          {/* Selected Thread Info */}
          {selectedThread && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-zinc-200">{selectedThread.title}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  selectedThread.loomStatus === 'BLOOMING' ? 'bg-amber-600/30 text-amber-300' :
                  selectedThread.loomStatus === 'STALLED' ? 'bg-red-600/30 text-red-300' :
                  'bg-zinc-600/30 text-zinc-400'
                }`}>
                  {selectedThread.loomStatus}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-zinc-500">Karma</div>
                  <div className="text-amber-400 font-bold">{selectedThread.karmaWeight}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Urgency</div>
                  <div className="text-orange-400 font-bold">{selectedThread.urgencyScore}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Debt</div>
                  <div className="text-red-400 font-bold">{selectedThread.payoffDebt}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Intervention Actions */}
        {selectedThread && (
          <div className="mt-6 space-y-4">
            {/* Force Director Attention */}
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">Force Director Attention</div>
                <div className="text-sm text-zinc-500">
                  Ensure this thread is addressed in the next chapter directive
                </div>
              </div>
              <button
                onClick={() => onForceAttention(selectedThread.id)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
              >
                Force Attention
              </button>
            </div>

            {/* Karma Adjustment */}
            <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">Adjust Karma Weight</div>
                <div className="text-sm text-zinc-500">
                  Current: {selectedThread.karmaWeight} • Higher = more narrative gravity
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={karmaAdjustment}
                  onChange={(e) => setKarmaAdjustment(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200 text-center"
                  min="-50"
                  max="50"
                />
                <button
                  onClick={() => onBoostKarma(selectedThread.id, karmaAdjustment)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Mark as Abandoned */}
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-red-800/30">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-zinc-200">Mark as Intentional Abandonment</div>
                  <div className="text-sm text-zinc-500">
                    Acknowledge this thread won't be resolved (removes from urgency tracking)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={abandonReason}
                  onChange={(e) => setAbandonReason(e.target.value)}
                  placeholder="Reason for abandonment..."
                  className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-200"
                />
                <button
                  onClick={() => {
                    if (abandonReason.trim()) {
                      onMarkAbandoned(selectedThread.id, abandonReason);
                      setAbandonReason('');
                    }
                  }}
                  disabled={!abandonReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                >
                  Abandon
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Next Chapter Preview */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
          📋 Next Chapter Thread Selection
          <span className="text-sm text-zinc-500 font-normal">
            (Auto-selected by Physics Engine)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Threads */}
          <div>
            <div className="text-sm text-zinc-400 mb-2">Primary Threads (Must Address)</div>
            <div className="space-y-2">
              {threadSelection.primaryThreads.map(thread => (
                <div 
                  key={thread.id}
                  className="flex items-center gap-3 p-3 bg-amber-600/10 border border-amber-600/30 rounded-lg"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    thread.loomStatus === 'BLOOMING' ? 'bg-amber-400 animate-pulse' :
                    thread.loomStatus === 'STALLED' ? 'bg-red-400' : 'bg-emerald-400'
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-200">{thread.title}</div>
                    <div className="text-xs text-zinc-500">{thread.signature}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-amber-400">U:{thread.urgencyScore}</div>
                    <div className="text-xs text-zinc-500">K:{thread.karmaWeight}</div>
                  </div>
                </div>
              ))}
              {threadSelection.primaryThreads.length === 0 && (
                <div className="text-sm text-zinc-500 p-3">No primary threads selected</div>
              )}
            </div>
          </div>

          {/* Secondary Threads */}
          <div>
            <div className="text-sm text-zinc-400 mb-2">Secondary Threads (Optional)</div>
            <div className="space-y-2">
              {threadSelection.secondaryThreads.map(thread => (
                <div 
                  key={thread.id}
                  className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    thread.loomStatus === 'BLOOMING' ? 'bg-amber-400' :
                    thread.loomStatus === 'STALLED' ? 'bg-red-400' : 'bg-zinc-400'
                  }`} />
                  <div className="flex-1">
                    <div className="text-sm text-zinc-300">{thread.title}</div>
                  </div>
                  <div className="text-xs text-zinc-500">U:{thread.urgencyScore}</div>
                </div>
              ))}
              {threadSelection.secondaryThreads.length === 0 && (
                <div className="text-sm text-zinc-500 p-3">No secondary threads</div>
              )}
            </div>
          </div>
        </div>

        {/* Selection Reasoning */}
        {threadSelection.reasoning.length > 0 && (
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
            <div className="text-xs text-zinc-500 mb-2">Selection Reasoning</div>
            <div className="space-y-1">
              {threadSelection.reasoning.slice(0, 5).map((reason, i) => (
                <div key={i} className="text-sm text-zinc-400">• {reason}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterventionControls;
