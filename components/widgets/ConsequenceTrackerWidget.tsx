/**
 * Consequence Tracker Widget
 * 
 * Displays tracked consequences from Tribulation Gate decisions,
 * showing which have manifested and which are still pending.
 */

import React, { useMemo, useState } from 'react';
import { NovelState } from '../../types';
import {
  TrackedConsequence,
  ConsequenceTrackingSummary,
  getTrackedConsequences,
  getConsequenceTrackingSummary,
  markConsequenceSubverted,
  markConsequenceForgotten,
} from '../../services/gateConsequenceTracker';

interface ConsequenceTrackerWidgetProps {
  novel: NovelState;
  onViewGate?: (gateId: string) => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-zinc-800', text: 'text-zinc-400', icon: '⏳' },
  manifesting: { bg: 'bg-amber-900/30', text: 'text-amber-400', icon: '✨' },
  fulfilled: { bg: 'bg-emerald-900/30', text: 'text-emerald-400', icon: '✓' },
  subverted: { bg: 'bg-purple-900/30', text: 'text-purple-400', icon: '↩️' },
  forgotten: { bg: 'bg-zinc-800/50', text: 'text-zinc-500', icon: '💨' },
};

const TYPE_STYLES: Record<string, { text: string; icon: string }> = {
  positive: { text: 'text-emerald-400', icon: '+' },
  negative: { text: 'text-red-400', icon: '-' },
  neutral: { text: 'text-zinc-400', icon: '~' },
  unknown: { text: 'text-zinc-500', icon: '?' },
};

const ConsequenceTrackerWidget: React.FC<ConsequenceTrackerWidgetProps> = ({
  novel,
  onViewGate,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedConsequenceId, setSelectedConsequenceId] = useState<string | null>(null);

  const currentChapter = novel.chapters.length;
  const consequences = useMemo(() => getTrackedConsequences(novel.id), [novel.id]);
  const summary = useMemo(() => 
    getConsequenceTrackingSummary(novel.id, currentChapter),
    [novel.id, currentChapter]
  );

  // Handle marking consequence as subverted
  const handleSubvert = (id: string) => {
    if (markConsequenceSubverted(id, 'Manually marked as subverted')) {
      setSelectedConsequenceId(null);
      // Trigger re-render by toggling showAll
      setShowAll(prev => !prev);
      setShowAll(prev => !prev);
    }
  };

  // Handle marking consequence as forgotten
  const handleForget = (id: string) => {
    if (markConsequenceForgotten(id)) {
      setSelectedConsequenceId(null);
      setShowAll(prev => !prev);
      setShowAll(prev => !prev);
    }
  };

  if (summary.totalConsequences === 0) {
    return (
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📜</span>
          <h3 className="font-semibold text-zinc-200">Fate Consequences</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-zinc-500 text-sm">
            No consequences being tracked yet.
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Consequences will appear after you make decisions at Tribulation Gates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <div>
            <h3 className="font-semibold text-zinc-200">Fate Consequences</h3>
            <p className="text-zinc-500 text-xs">Tracking how your choices manifest</p>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <div className="text-center p-2 bg-zinc-900/50 rounded-lg">
          <div className="text-lg font-bold text-zinc-400">{summary.pendingConsequences}</div>
          <div className="text-xs text-zinc-600">Pending</div>
        </div>
        <div className="text-center p-2 bg-amber-900/20 rounded-lg">
          <div className="text-lg font-bold text-amber-400">{summary.manifestingConsequences}</div>
          <div className="text-xs text-amber-600">Manifesting</div>
        </div>
        <div className="text-center p-2 bg-emerald-900/20 rounded-lg">
          <div className="text-lg font-bold text-emerald-400">{summary.fulfilledConsequences}</div>
          <div className="text-xs text-emerald-600">Fulfilled</div>
        </div>
        <div className="text-center p-2 bg-purple-900/20 rounded-lg">
          <div className="text-lg font-bold text-purple-400">{summary.subvertedConsequences}</div>
          <div className="text-xs text-purple-600">Subverted</div>
        </div>
        <div className="text-center p-2 bg-zinc-900/50 rounded-lg">
          <div className="text-lg font-bold text-zinc-500">{summary.forgottenConsequences}</div>
          <div className="text-xs text-zinc-600">Forgotten</div>
        </div>
      </div>

      {/* Overdue Warning */}
      {summary.overduePending.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <span>⚠️</span>
            <span>{summary.overduePending.length} consequence(s) may be overdue</span>
          </div>
          <p className="text-amber-400/70 text-xs mt-1">
            These consequences haven't manifested after 20+ chapters
          </p>
        </div>
      )}

      {/* Recent Manifestations */}
      {summary.recentManifestations.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Recent Manifestations
          </h4>
          <div className="space-y-2">
            {summary.recentManifestations.slice(0, 3).map((c) => (
              <div 
                key={c.id}
                className={`p-2 rounded-lg ${STATUS_STYLES[c.status].bg} border border-zinc-700/50`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{STATUS_STYLES[c.status].icon}</span>
                  <span className={TYPE_STYLES[c.consequenceType].text}>
                    {TYPE_STYLES[c.consequenceType].icon}
                  </span>
                  <span className="text-zinc-300 flex-1 truncate">{c.consequenceText}</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1 pl-6">
                  From Ch.{c.sourceChapterNumber} • 
                  {c.manifestationNotes.length > 0 && ` ${c.manifestationNotes[c.manifestationNotes.length - 1]}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show All Toggle */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="w-full text-center text-zinc-500 hover:text-zinc-400 text-sm py-2 transition-colors"
      >
        {showAll ? '▲ Show Less' : `▼ Show All (${summary.totalConsequences})`}
      </button>

      {/* All Consequences */}
      {showAll && (
        <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {consequences.map((c) => (
            <div
              key={c.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedConsequenceId === c.id
                  ? 'border-purple-600/50 bg-zinc-800'
                  : 'border-zinc-700/50 bg-zinc-900/30 hover:bg-zinc-900/50'
              }`}
              onClick={() => setSelectedConsequenceId(
                selectedConsequenceId === c.id ? null : c.id
              )}
            >
              <div className="flex items-center gap-2">
                <span className={`${STATUS_STYLES[c.status].text}`}>
                  {STATUS_STYLES[c.status].icon}
                </span>
                <span className={TYPE_STYLES[c.consequenceType].text}>
                  {TYPE_STYLES[c.consequenceType].icon}
                </span>
                <span className="text-zinc-300 text-sm flex-1">{c.consequenceText}</span>
                <span className="text-xs text-zinc-600">Ch.{c.sourceChapterNumber}</span>
              </div>

              {/* Expanded Details */}
              {selectedConsequenceId === c.id && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2">
                  <div className="text-xs text-zinc-500">
                    From: "{c.pathLabel}"
                  </div>
                  
                  {c.manifestationChapters.length > 0 && (
                    <div className="text-xs text-zinc-500">
                      Manifested in: Ch.{c.manifestationChapters.join(', Ch.')}
                    </div>
                  )}
                  
                  {c.manifestationNotes.length > 0 && (
                    <div className="text-xs text-zinc-400 bg-zinc-800/50 p-2 rounded">
                      {c.manifestationNotes.map((note, i) => (
                        <div key={i}>• {note}</div>
                      ))}
                    </div>
                  )}

                  {/* Actions for pending/manifesting */}
                  {(c.status === 'pending' || c.status === 'manifesting') && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSubvert(c.id);
                        }}
                        className="text-xs px-2 py-1 bg-purple-600/20 text-purple-400 rounded hover:bg-purple-600/30 transition-colors"
                      >
                        Mark Subverted
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleForget(c.id);
                        }}
                        className="text-xs px-2 py-1 bg-zinc-700 text-zinc-400 rounded hover:bg-zinc-600 transition-colors"
                      >
                        Mark Forgotten
                      </button>
                    </div>
                  )}

                  {onViewGate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewGate(c.gateId);
                      }}
                      className="text-xs text-purple-400 hover:text-purple-300 mt-1"
                    >
                      View Original Gate →
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsequenceTrackerWidget;
