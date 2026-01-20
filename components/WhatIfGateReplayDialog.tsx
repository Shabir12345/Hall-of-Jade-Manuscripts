/**
 * What If Gate Replay Dialog
 * 
 * Allows users to replay a past Tribulation Gate with a different choice,
 * exploring alternate narrative paths. This creates a "what if" scenario
 * without affecting the main story timeline.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  TribulationGate,
  FatePath,
  FatePathRisk,
  TRIGGER_DISPLAY_INFO,
} from '../types/tribulationGates';
import { NovelState } from '../types';

interface WhatIfGateReplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gate: TribulationGate;
  novel: NovelState;
  onReplay: (gate: TribulationGate, alternatePathId: string) => Promise<void>;
  isLoading?: boolean;
}

const RISK_STYLES: Record<FatePathRisk, {
  bg: string;
  border: string;
  text: string;
  badge: string;
}> = {
  low: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-600/50',
    text: 'text-emerald-400',
    badge: 'bg-emerald-600',
  },
  medium: {
    bg: 'bg-amber-950/30',
    border: 'border-amber-600/50',
    text: 'text-amber-400',
    badge: 'bg-amber-600',
  },
  high: {
    bg: 'bg-orange-950/30',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    badge: 'bg-orange-600',
  },
  extreme: {
    bg: 'bg-red-950/30',
    border: 'border-red-500/50',
    text: 'text-red-400',
    badge: 'bg-red-600',
  },
};

const WhatIfGateReplayDialog: React.FC<WhatIfGateReplayDialogProps> = ({
  isOpen,
  onClose,
  gate,
  novel,
  onReplay,
  isLoading = false,
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showConsequencePreview, setShowConsequencePreview] = useState(true);

  const triggerInfo = TRIGGER_DISPLAY_INFO[gate.triggerType];
  
  // Get the originally chosen path
  const originalPath = useMemo(() => 
    gate.fatePaths.find(p => p.id === gate.selectedPathId),
    [gate]
  );

  // Get alternate paths (paths not originally chosen)
  const alternatePaths = useMemo(() =>
    gate.fatePaths.filter(p => p.id !== gate.selectedPathId),
    [gate]
  );

  // Get chapter that was generated after this gate
  const resultingChapter = useMemo(() => 
    novel.chapters.find(c => c.number === gate.chapterNumber),
    [novel.chapters, gate.chapterNumber]
  );

  const handleReplay = useCallback(async () => {
    if (!selectedPathId) return;
    await onReplay(gate, selectedPathId);
  }, [gate, selectedPathId, onReplay]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-purple-600/30 rounded-2xl w-full max-w-3xl shadow-2xl shadow-purple-900/30 my-8">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-purple-900/20 via-zinc-900 to-amber-900/20">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-amber-600 flex items-center justify-center text-3xl">
              🔮
            </div>
            <div>
              <h2 className="text-xl font-fantasy font-bold bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">
                What If...?
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Explore an alternate fate from Chapter {gate.chapterNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Original Decision Recap */}
        <div className="p-6 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Original Decision
          </h3>
          
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{triggerInfo.icon}</span>
              <span className="font-semibold text-zinc-200">{triggerInfo.title}</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-400 text-sm">Chapter {gate.chapterNumber}</span>
            </div>
            
            <p className="text-zinc-400 text-sm italic mb-4">
              "{gate.situation}"
            </p>

            {originalPath && (
              <div className={`p-3 rounded-lg border ${RISK_STYLES[originalPath.riskLevel].border} ${RISK_STYLES[originalPath.riskLevel].bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-emerald-400">✓</span>
                  <span className={`font-medium ${RISK_STYLES[originalPath.riskLevel].text}`}>
                    {originalPath.label}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${RISK_STYLES[originalPath.riskLevel].badge} text-white`}>
                    {originalPath.riskLevel}
                  </span>
                </div>
                <p className="text-zinc-400 text-sm">{originalPath.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alternate Path Selection */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Choose an Alternate Path
          </h3>
          
          <p className="text-zinc-400 text-sm mb-4">
            Select a different path to explore what might have happened if you had chosen differently.
          </p>

          <div className="space-y-3">
            {alternatePaths.map((path) => {
              const styles = RISK_STYLES[path.riskLevel];
              const isSelected = selectedPathId === path.id;

              return (
                <button
                  key={path.id}
                  onClick={() => setSelectedPathId(path.id)}
                  disabled={isLoading}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `${styles.border} ${styles.bg} shadow-lg`
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-600 to-amber-600 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                        <span className={`font-medium ${isSelected ? styles.text : 'text-zinc-200'}`}>
                          {path.label}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${styles.badge} text-white`}>
                          {path.riskLevel}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">{path.description}</p>

                      {/* Consequences */}
                      {showConsequencePreview && path.consequences.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-700/50">
                          <span className="text-xs text-zinc-500 font-medium">Potential Consequences:</span>
                          <ul className="mt-1 space-y-0.5">
                            {path.consequences.slice(0, 3).map((c, i) => (
                              <li key={i} className="text-xs text-zinc-500">• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Emotional tone badge */}
                    <span className="text-zinc-600 text-xs italic capitalize whitespace-nowrap">
                      {path.emotionalTone}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Toggle consequences */}
          <button
            onClick={() => setShowConsequencePreview(!showConsequencePreview)}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            {showConsequencePreview ? '▲ Hide consequences' : '▼ Show consequences'}
          </button>
        </div>

        {/* Information Note */}
        <div className="px-6 pb-4">
          <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-purple-400 text-lg">ℹ️</span>
              <div>
                <p className="text-purple-300 text-sm font-medium mb-1">
                  About "What If" Replays
                </p>
                <p className="text-purple-400/70 text-xs">
                  This will generate an alternate version of Chapter {gate.chapterNumber} based on your new choice. 
                  The original chapter and story timeline remain unchanged. You can compare the 
                  alternate version to see how different choices might have affected your story.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex justify-between items-center gap-4">
          <div className="text-zinc-500 text-sm">
            {selectedPathId ? (
              <span>
                Selected: <span className="text-zinc-300">
                  {alternatePaths.find(p => p.id === selectedPathId)?.label}
                </span>
              </span>
            ) : (
              <span>Select an alternate path to explore</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReplay}
              disabled={isLoading || !selectedPathId}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating Alternate Reality...
                </>
              ) : (
                <>
                  <span>🔮</span>
                  Explore This Path
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIfGateReplayDialog;
