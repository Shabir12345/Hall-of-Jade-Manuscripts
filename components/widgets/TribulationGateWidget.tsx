/**
 * Tribulation Gate Dashboard Widget
 * 
 * Displays statistics and history for Tribulation Gates including:
 * - Total gates triggered
 * - User choice patterns (risk preferences)
 * - Recent gate decisions
 * - Quick access to gate history
 */

import React, { useMemo, useState } from 'react';
import { NovelState } from '../../types';
import {
  TribulationGate,
  TribulationGateHistoryEntry,
  FatePathRisk,
  TRIGGER_DISPLAY_INFO,
  TribulationTrigger,
} from '../../types/tribulationGates';
import { getGatesForNovel, getGateHistory, getGateStatistics } from '../../services/tribulationGateService';

interface TribulationGateWidgetProps {
  novel: NovelState;
  onViewGateHistory?: () => void;
  onManualTrigger?: () => void;
}

const RISK_COLORS: Record<FatePathRisk, string> = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  extreme: 'bg-red-500',
};

const RISK_LABELS: Record<FatePathRisk, string> = {
  low: 'Safe',
  medium: 'Moderate',
  high: 'Risky',
  extreme: 'Extreme',
};

const TribulationGateWidget: React.FC<TribulationGateWidgetProps> = ({
  novel,
  onViewGateHistory,
  onManualTrigger,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Get gate data
  const gates = useMemo(() => getGatesForNovel(novel.id), [novel.id]);
  const history = useMemo(() => getGateHistory(novel.id), [novel.id]);
  const stats = useMemo(() => getGateStatistics(novel.id), [novel.id]);

  // Calculate risk preference
  const riskPreference = useMemo(() => {
    const total = stats.riskChoiceCounts.low + stats.riskChoiceCounts.medium + 
                  stats.riskChoiceCounts.high + stats.riskChoiceCounts.extreme;
    if (total === 0) return null;

    // Calculate weighted score (low=1, medium=2, high=3, extreme=4)
    const score = (
      stats.riskChoiceCounts.low * 1 +
      stats.riskChoiceCounts.medium * 2 +
      stats.riskChoiceCounts.high * 3 +
      stats.riskChoiceCounts.extreme * 4
    ) / total;

    if (score < 1.5) return { label: 'Cautious Cultivator', emoji: '🛡️', description: 'You prefer safe, measured choices' };
    if (score < 2.5) return { label: 'Balanced Seeker', emoji: '⚖️', description: 'You weigh risks and rewards carefully' };
    if (score < 3.5) return { label: 'Bold Adventurer', emoji: '⚔️', description: 'You embrace challenge and danger' };
    return { label: 'Fate Defier', emoji: '🔥', description: 'You choose the most extreme paths' };
  }, [stats.riskChoiceCounts]);

  // Get most recent gates
  const recentGates = useMemo(() => 
    gates
      .filter(g => g.status === 'resolved')
      .sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0))
      .slice(0, 3),
    [gates]
  );

  // Calculate trigger type distribution
  const triggerDistribution = useMemo(() => {
    const distribution: Partial<Record<TribulationTrigger, number>> = {};
    for (const gate of gates) {
      distribution[gate.triggerType] = (distribution[gate.triggerType] || 0) + 1;
    }
    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [gates]);

  // Check if feature is enabled
  const isEnabled = novel.tribulationGateConfig?.enabled ?? true;

  if (stats.totalGates === 0) {
    return (
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">⚡</span>
          <h3 className="font-semibold text-zinc-200">Tribulation Gates</h3>
        </div>
        
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🌌</div>
          <p className="text-zinc-400 mb-2">No gates have appeared yet</p>
          <p className="text-zinc-500 text-sm">
            {isEnabled 
              ? 'Continue writing to encounter your first Tribulation Gate'
              : 'Enable Tribulation Gates in settings to experience fate decisions'}
          </p>
          {onManualTrigger && isEnabled && (
            <button
              onClick={onManualTrigger}
              className="mt-4 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 transition-colors"
            >
              ⚡ Test Gate (Debug)
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-semibold text-zinc-200">Tribulation Gates</h3>
            <p className="text-zinc-500 text-xs">Your fate decisions</p>
          </div>
        </div>
        {onViewGateHistory && (
          <button
            onClick={onViewGateHistory}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            View History →
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.totalGates}</div>
          <div className="text-zinc-500 text-xs">Total Gates</div>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.resolvedGates}</div>
          <div className="text-zinc-500 text-xs">Resolved</div>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{stats.skippedGates}</div>
          <div className="text-zinc-500 text-xs">Skipped</div>
        </div>
      </div>

      {/* Risk Preference Badge */}
      {riskPreference && (
        <div className="bg-gradient-to-r from-purple-900/30 to-amber-900/30 rounded-lg p-3 mb-4 border border-purple-600/20">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{riskPreference.emoji}</span>
            <span className="font-medium text-zinc-200">{riskPreference.label}</span>
          </div>
          <p className="text-zinc-400 text-xs">{riskPreference.description}</p>
        </div>
      )}

      {/* Risk Distribution Bar */}
      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-2">Choice Pattern</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-zinc-900">
          {(['low', 'medium', 'high', 'extreme'] as FatePathRisk[]).map((risk) => {
            const count = stats.riskChoiceCounts[risk];
            const total = Object.values(stats.riskChoiceCounts).reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? (count / total) * 100 : 0;
            if (percentage === 0) return null;
            return (
              <div
                key={risk}
                className={`${RISK_COLORS[risk]} transition-all`}
                style={{ width: `${percentage}%` }}
                title={`${RISK_LABELS[risk]}: ${count} (${percentage.toFixed(0)}%)`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-zinc-600 mt-1">
          <span>Safe</span>
          <span>Extreme</span>
        </div>
      </div>

      {/* Toggle Details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-center text-zinc-500 hover:text-zinc-400 text-sm py-2 transition-colors"
      >
        {showDetails ? '▲ Hide Details' : '▼ Show Details'}
      </button>

      {showDetails && (
        <div className="mt-4 space-y-4 border-t border-zinc-700 pt-4">
          {/* Recent Decisions */}
          {recentGates.length > 0 && (
            <div>
              <h4 className="text-zinc-400 text-xs font-medium mb-2">RECENT DECISIONS</h4>
              <div className="space-y-2">
                {recentGates.map((gate) => {
                  const info = TRIGGER_DISPLAY_INFO[gate.triggerType];
                  const selectedPath = gate.fatePaths.find(p => p.id === gate.selectedPathId);
                  return (
                    <div 
                      key={gate.id}
                      className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{info.icon}</span>
                        <span className="text-zinc-300 text-sm font-medium">Ch. {gate.chapterNumber}</span>
                        <span className="text-zinc-600 text-xs">• {info.title}</span>
                      </div>
                      {selectedPath && (
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${RISK_COLORS[selectedPath.riskLevel]}`} />
                          <span className="text-zinc-400 text-xs truncate">{selectedPath.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Most Common Triggers */}
          {triggerDistribution.length > 0 && (
            <div>
              <h4 className="text-zinc-400 text-xs font-medium mb-2">TOP TRIGGER TYPES</h4>
              <div className="space-y-1">
                {triggerDistribution.map(([trigger, count]) => {
                  const info = TRIGGER_DISPLAY_INFO[trigger as TribulationTrigger];
                  return (
                    <div 
                      key={trigger}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span>{info.icon}</span>
                        {info.title}
                      </span>
                      <span className="text-zinc-500">{count}x</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TribulationGateWidget;
