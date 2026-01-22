/**
 * Thread Health Panel
 * 
 * Displays thread health with pulse colors, crack effects for high entropy,
 * and gold glow for blooming threads in payoff window.
 */

import React from 'react';
import { LoomThread, ThreadHealthMetrics } from '../../types/loom';
import { calculateThreadHealthMetrics } from '../../services/loom/threadPhysicsEngine';

interface ThreadHealthPanelProps {
  threads: LoomThread[];
  healthMetrics: ThreadHealthMetrics[];
  currentChapter: number;
  selectedThread: LoomThread | null;
  onSelectThread: (thread: LoomThread) => void;
  onForceAttention: (threadId: string) => void;
}

export const ThreadHealthPanel: React.FC<ThreadHealthPanelProps> = ({
  threads,
  healthMetrics,
  currentChapter,
  selectedThread,
  onSelectThread,
  onForceAttention,
}) => {
  const getMetrics = (threadId: string) => {
    return healthMetrics.find(m => m.threadId === threadId);
  };

  const getPulseAnimation = (color: string) => {
    if (color === 'gold') return 'animate-pulse';
    if (color === 'red') return 'animate-ping';
    return '';
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green': return 'bg-emerald-500 shadow-emerald-500/50';
      case 'yellow': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'orange': return 'bg-orange-500 shadow-orange-500/50';
      case 'red': return 'bg-red-500 shadow-red-500/50';
      case 'gold': return 'bg-amber-400 shadow-amber-400/50';
      default: return 'bg-zinc-500';
    }
  };

  const getCrackEffect = (hasCrack: boolean) => {
    if (!hasCrack) return '';
    return 'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-red-500/20 before:to-transparent before:animate-pulse';
  };

  // Group threads by category
  const groupedThreads = threads.reduce((acc, thread) => {
    const category = thread.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(thread);
    return acc;
  }, {} as Record<string, LoomThread[]>);

  const categoryOrder = ['SOVEREIGN', 'MAJOR', 'MINOR', 'SEED'];
  const categoryLabels: Record<string, { label: string; icon: string; color: string }> = {
    SOVEREIGN: { label: 'Sovereign Threads', icon: '👑', color: 'text-purple-400' },
    MAJOR: { label: 'Major Threads', icon: '⭐', color: 'text-blue-400' },
    MINOR: { label: 'Minor Threads', icon: '○', color: 'text-zinc-400' },
    SEED: { label: 'Seed Threads', icon: '🌱', color: 'text-emerald-400' },
  };

  return (
    <div className="space-y-8">
      {categoryOrder.map(category => {
        const threadsInCategory = groupedThreads[category];
        if (!threadsInCategory || threadsInCategory.length === 0) return null;

        const info = categoryLabels[category];
        
        return (
          <div key={category}>
            <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${info.color}`}>
              <span>{info.icon}</span>
              {info.label}
              <span className="text-sm text-zinc-500 font-normal">
                ({threadsInCategory.length})
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {threadsInCategory
                .sort((a, b) => b.urgencyScore - a.urgencyScore)
                .map(thread => {
                  const metrics = getMetrics(thread.id) || calculateThreadHealthMetrics(thread, currentChapter);
                  const isSelected = selectedThread?.id === thread.id;

                  return (
                    <div
                      key={thread.id}
                      onClick={() => onSelectThread(thread)}
                      className={`
                        relative p-4 rounded-xl cursor-pointer transition-all
                        ${isSelected 
                          ? 'bg-amber-600/20 border-2 border-amber-500' 
                          : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-500'
                        }
                        ${getCrackEffect(metrics.crackEffect)}
                        ${metrics.goldGlow ? 'ring-2 ring-amber-400/50' : ''}
                      `}
                    >
                      {/* Pulse Indicator */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <div className={`
                          w-3 h-3 rounded-full shadow-lg
                          ${getColorClasses(metrics.pulseColor)}
                          ${getPulseAnimation(metrics.pulseColor)}
                        `} />
                      </div>

                      {/* Thread Info */}
                      <div className="pr-8">
                        <h4 className="font-semibold text-zinc-200 truncate">
                          {thread.title}
                        </h4>
                        <div className="text-xs text-zinc-500 truncate mt-0.5">
                          {thread.signature}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`
                          px-2 py-0.5 rounded text-xs font-medium
                          ${thread.loomStatus === 'BLOOMING' ? 'bg-amber-600/30 text-amber-300' :
                            thread.loomStatus === 'STALLED' ? 'bg-red-600/30 text-red-300' :
                            thread.loomStatus === 'ACTIVE' ? 'bg-emerald-600/30 text-emerald-300' :
                            'bg-zinc-600/30 text-zinc-400'}
                        `}>
                          {thread.loomStatus}
                        </span>
                        
                        {/* Payoff Horizon Badge */}
                        <span className={`
                          px-2 py-0.5 rounded text-xs
                          ${metrics.payoffHorizon === 'perfect_window' ? 'bg-amber-600/30 text-amber-300' :
                            metrics.payoffHorizon === 'overdue' ? 'bg-red-600/30 text-red-300' :
                            'bg-zinc-600/30 text-zinc-400'}
                        `}>
                          {metrics.payoffHorizon === 'perfect_window' ? '✨ Perfect' :
                           metrics.payoffHorizon === 'overdue' ? '⚠️ Overdue' :
                           '⏳ Building'}
                        </span>
                      </div>

                      {/* Stats Row */}
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-xs text-zinc-500">Health</div>
                          <div className={`text-sm font-bold ${
                            metrics.healthScore >= 70 ? 'text-emerald-400' :
                            metrics.healthScore >= 40 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {metrics.healthScore}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Karma</div>
                          <div className="text-sm font-bold text-amber-400">
                            {thread.karmaWeight}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500">Debt</div>
                          <div className={`text-sm font-bold ${
                            thread.payoffDebt > 100 ? 'text-red-400' :
                            thread.payoffDebt > 50 ? 'text-orange-400' : 'text-zinc-400'
                          }`}>
                            {thread.payoffDebt}
                          </div>
                        </div>
                      </div>

                      {/* Quick Action */}
                      {(thread.loomStatus === 'STALLED' || thread.urgencyScore > 300) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onForceAttention(thread.id);
                          }}
                          className="mt-3 w-full px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 
                                   text-amber-400 rounded text-xs font-medium transition-colors"
                        >
                          ⚡ Force Attention
                        </button>
                      )}

                      {/* Crack Effect Overlay for High Entropy */}
                      {metrics.crackEffect && (
                        <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5" />
                          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
                            <path
                              d="M20,10 L25,30 L15,50 L30,70 L20,90"
                              stroke="rgb(239, 68, 68)"
                              strokeWidth="0.5"
                              fill="none"
                            />
                            <path
                              d="M80,5 L75,25 L85,45 L70,65 L80,85"
                              stroke="rgb(239, 68, 68)"
                              strokeWidth="0.5"
                              fill="none"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Gold Glow for Blooming */}
                      {metrics.goldGlow && (
                        <div className="absolute inset-0 pointer-events-none rounded-xl">
                          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-transparent animate-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      {threads.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <div className="text-4xl mb-4">🧵</div>
          <div>No threads match the current filters</div>
        </div>
      )}
    </div>
  );
};

export default ThreadHealthPanel;
