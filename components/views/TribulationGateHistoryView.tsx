/**
 * Tribulation Gate History View
 * 
 * Shows all past Tribulation Gates for a novel with their outcomes,
 * allowing users to review their decisions and understand how they
 * shaped the story.
 */

import React, { useMemo, useState } from 'react';
import { NovelState } from '../../types';
import {
  TribulationGate,
  TribulationTrigger,
  FatePathRisk,
  TRIGGER_DISPLAY_INFO,
} from '../../types/tribulationGates';
import { 
  getGatesForNovel, 
  getGateStatistics, 
  formatGateForDisplay,
  getWhatIfChaptersForGate,
  WhatIfChapter,
} from '../../services/tribulationGateService';

interface TribulationGateHistoryViewProps {
  novel: NovelState;
  onViewChapter?: (chapterNumber: number) => void;
  onClose?: () => void;
  onWhatIfReplay?: (gate: TribulationGate) => void;
}

const RISK_COLORS: Record<FatePathRisk, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-600/30' },
  medium: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-600/30' },
  high: { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-600/30' },
  extreme: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-600/30' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  resolved: { label: 'Resolved', color: 'text-emerald-400' },
  skipped: { label: 'Skipped', color: 'text-amber-400' },
  pending: { label: 'Pending', color: 'text-purple-400' },
  expired: { label: 'Expired', color: 'text-zinc-500' },
};

type FilterStatus = 'all' | 'resolved' | 'skipped' | 'pending' | 'expired';
type SortOrder = 'newest' | 'oldest' | 'chapter';

const TribulationGateHistoryView: React.FC<TribulationGateHistoryViewProps> = ({
  novel,
  onViewChapter,
  onClose,
  onWhatIfReplay,
}) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTrigger, setFilterTrigger] = useState<TribulationTrigger | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [expandedGateId, setExpandedGateId] = useState<string | null>(null);

  // Get all gates
  const allGates = useMemo(() => getGatesForNovel(novel.id), [novel.id]);
  const stats = useMemo(() => getGateStatistics(novel.id), [novel.id]);

  // Filter and sort gates
  const filteredGates = useMemo(() => {
    let gates = [...allGates];

    // Filter by status
    if (filterStatus !== 'all') {
      gates = gates.filter(g => g.status === filterStatus);
    }

    // Filter by trigger type
    if (filterTrigger !== 'all') {
      gates = gates.filter(g => g.triggerType === filterTrigger);
    }

    // Sort
    switch (sortOrder) {
      case 'newest':
        gates.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        gates.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'chapter':
        gates.sort((a, b) => a.chapterNumber - b.chapterNumber);
        break;
    }

    return gates;
  }, [allGates, filterStatus, filterTrigger, sortOrder]);

  // Get unique trigger types for filter
  const usedTriggerTypes = useMemo(() => {
    const types = new Set(allGates.map(g => g.triggerType));
    return Array.from(types);
  }, [allGates]);

  if (allGates.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">🌌</div>
          <h2 className="text-2xl font-fantasy font-bold text-zinc-200 mb-3">
            No Tribulation Gates Yet
          </h2>
          <p className="text-zinc-400 mb-4">
            Tribulation Gates appear at major plot points in your story.
            Continue writing to encounter your first gate and shape your protagonist's fate.
          </p>
          <p className="text-zinc-500 text-sm">
            Gates can trigger during realm breakthroughs, life-or-death crises,
            major confrontations, and other pivotal moments.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-purple-900/30 via-zinc-900 to-amber-900/30 rounded-2xl p-6 border border-purple-600/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-fantasy font-bold bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
              ⚡ Tribulation Gate History
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Review the fate decisions that shaped your story
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-400">{stats.totalGates}</div>
            <div className="text-zinc-500 text-sm">Total Gates</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-emerald-400">{stats.resolvedGates}</div>
            <div className="text-zinc-500 text-sm">Resolved</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-amber-400">{stats.skippedGates}</div>
            <div className="text-zinc-500 text-sm">Skipped</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-zinc-400">
              {stats.averageResolutionTimeMs > 0 
                ? `${Math.round(stats.averageResolutionTimeMs / 60000)}m`
                : '—'}
            </div>
            <div className="text-zinc-500 text-sm">Avg. Decision Time</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-zinc-500 text-sm">Status:</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-purple-500"
            title="Filter gates by status"
          >
            <option value="all">All</option>
            <option value="resolved">Resolved</option>
            <option value="skipped">Skipped</option>
            <option value="pending">Pending</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Trigger Type Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="trigger-filter" className="text-zinc-500 text-sm">Type:</label>
          <select
            id="trigger-filter"
            value={filterTrigger}
            onChange={(e) => setFilterTrigger(e.target.value as TribulationTrigger | 'all')}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-purple-500"
            title="Filter gates by trigger type"
          >
            <option value="all">All Types</option>
            {usedTriggerTypes.map(type => (
              <option key={type} value={type}>
                {TRIGGER_DISPLAY_INFO[type].icon} {TRIGGER_DISPLAY_INFO[type].title}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Order */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="sort-order" className="text-zinc-500 text-sm">Sort:</label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-purple-500"
            title="Sort order for gates"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="chapter">By Chapter</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-zinc-500 text-sm">
        Showing {filteredGates.length} of {allGates.length} gates
      </p>

      {/* Gate List */}
      <div className="space-y-4">
        {filteredGates.map((gate) => (
          <GateCard
            key={gate.id}
            gate={gate}
            isExpanded={expandedGateId === gate.id}
            onToggleExpand={() => setExpandedGateId(
              expandedGateId === gate.id ? null : gate.id
            )}
            onViewChapter={onViewChapter}
            onWhatIfReplay={onWhatIfReplay}
          />
        ))}
      </div>

      {filteredGates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-zinc-400">No gates match your filters</p>
        </div>
      )}
    </div>
  );
};

/**
 * Individual Gate Card Component
 */
interface GateCardProps {
  gate: TribulationGate;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewChapter?: (chapterNumber: number) => void;
  onWhatIfReplay?: (gate: TribulationGate) => void;
}

const GateCard: React.FC<GateCardProps> = ({
  gate,
  isExpanded,
  onToggleExpand,
  onViewChapter,
  onWhatIfReplay,
}) => {
  const triggerInfo = TRIGGER_DISPLAY_INFO[gate.triggerType];
  const statusInfo = STATUS_LABELS[gate.status];
  const selectedPath = gate.fatePaths.find(p => p.id === gate.selectedPathId);
  const riskColors = selectedPath ? RISK_COLORS[selectedPath.riskLevel] : null;
  
  // Get existing What If chapters for this gate
  const whatIfChapters = useMemo(() => getWhatIfChaptersForGate(gate.id), [gate.id]);
  const hasAlternatePaths = gate.fatePaths.length > 1 && gate.status === 'resolved';

  return (
    <div 
      className={`bg-zinc-900/50 rounded-xl border transition-all ${
        isExpanded ? 'border-purple-600/50' : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {/* Header - Always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full p-4 flex items-start gap-4 text-left"
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
          gate.status === 'resolved' 
            ? 'bg-purple-900/30 border border-purple-600/30' 
            : 'bg-zinc-800 border border-zinc-700'
        }`}>
          {triggerInfo.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-zinc-200">{triggerInfo.title}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 text-sm">Chapter {gate.chapterNumber}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusInfo.color} bg-zinc-800`}>
              {statusInfo.label}
            </span>
          </div>

          <p className="text-zinc-400 text-sm line-clamp-2">{gate.situation}</p>

          {selectedPath && (
            <div className={`mt-2 flex items-center gap-2 ${riskColors?.text}`}>
              <span className={`w-2 h-2 rounded-full ${
                riskColors?.bg.replace('/30', '')
              }`} />
              <span className="text-sm font-medium">{selectedPath.label}</span>
            </div>
          )}
        </div>

        {/* Expand indicator */}
        <span className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-4 space-y-4">
          {/* Protagonist */}
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Protagonist</span>
            <p className="text-zinc-300">{gate.protagonistName}</p>
          </div>

          {/* Situation */}
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wide">Situation</span>
            <p className="text-zinc-300 italic">"{gate.situation}"</p>
          </div>

          {/* Context */}
          {gate.context && (
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-wide">Context</span>
              <p className="text-zinc-400 text-sm">{gate.context}</p>
            </div>
          )}

          {/* All Paths */}
          <div>
            <span className="text-xs text-zinc-500 uppercase tracking-wide mb-2 block">Fate Paths</span>
            <div className="space-y-2">
              {gate.fatePaths.map((path) => {
                const isChosen = path.id === gate.selectedPathId;
                const colors = RISK_COLORS[path.riskLevel];
                
                return (
                  <div 
                    key={path.id}
                    className={`p-3 rounded-lg border ${
                      isChosen 
                        ? `${colors.bg} ${colors.border}` 
                        : 'bg-zinc-800/50 border-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isChosen && <span className="text-purple-400">✓</span>}
                      <span className={`font-medium ${isChosen ? colors.text : 'text-zinc-400'}`}>
                        {path.label}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {path.riskLevel}
                      </span>
                    </div>
                    <p className={`text-sm ${isChosen ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {path.description}
                    </p>
                    {isChosen && path.consequences.length > 0 && (
                      <div className="mt-2 text-xs text-zinc-500">
                        <span className="font-medium">Consequences:</span>
                        <ul className="mt-1 space-y-0.5">
                          {path.consequences.map((c, i) => (
                            <li key={i}>• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skip Reason */}
          {gate.skipReason && (
            <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
              <span className="text-xs text-amber-400 uppercase tracking-wide">Skip Reason</span>
              <p className="text-amber-300 text-sm">{gate.skipReason}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800">
            <span>Created: {new Date(gate.createdAt).toLocaleString()}</span>
            {gate.resolvedAt && (
              <span>Resolved: {new Date(gate.resolvedAt).toLocaleString()}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {onViewChapter && (
              <button
                onClick={() => onViewChapter(gate.chapterNumber)}
                className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 transition-colors"
              >
                View Chapter {gate.chapterNumber} →
              </button>
            )}
            
            {/* What If Button */}
            {hasAlternatePaths && onWhatIfReplay && (
              <button
                onClick={() => onWhatIfReplay(gate)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600/20 to-amber-600/20 text-amber-400 rounded-lg text-sm hover:from-purple-600/30 hover:to-amber-600/30 transition-colors flex items-center gap-2"
              >
                <span>🔮</span> What If...?
              </button>
            )}
          </div>
          
          {/* Existing What If Chapters */}
          {whatIfChapters.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <span className="text-xs text-zinc-500 font-medium">Alternate Timelines Explored:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {whatIfChapters.map((wic) => (
                  <span 
                    key={wic.id}
                    className="text-xs px-2 py-1 bg-purple-900/30 text-purple-400 rounded border border-purple-600/30"
                    title={`Created: ${new Date(wic.createdAt).toLocaleDateString()}`}
                  >
                    🔮 {wic.alternatePathLabel}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TribulationGateHistoryView;
