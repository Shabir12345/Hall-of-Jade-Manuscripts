/**
 * Auto Connections List Component
 * Displays auto-connections with confidence indicators
 */

import React from 'react';
import type { Connection } from '../services/autoConnectionService';

interface AutoConnectionsListProps {
  connections: Connection[];
  maxItems?: number;
  showConfidence?: boolean;
  onReview?: (connection: Connection) => void;
  onUndo?: (connection: Connection) => void;
  className?: string;
}

export const AutoConnectionsList: React.FC<AutoConnectionsListProps> = ({
  connections,
  maxItems = 10,
  showConfidence = true,
  onReview,
  onUndo,
  className = '',
}) => {
  const displayConnections = connections.slice(0, maxItems);

  const getConnectionIcon = (type: Connection['type']): string => {
    switch (type) {
      case 'character-scene':
        return '👤→🎬';
      case 'character-arc':
        return '👤→🗺️';
      case 'item-arc':
        return '💎→🗺️';
      case 'technique-arc':
        return '⚔️→🗺️';
      case 'relationship':
        return '🔗';
      case 'antagonist-arc':
        return '⚔️→🗺️';
      case 'world-entry-chapter':
        return '🌍→📖';
      default:
        return '🔗';
    }
  };

  const getConnectionTypeLabel = (type: Connection['type']): string => {
    return type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-emerald-400';
    if (confidence >= 0.6) return 'text-amber-400';
    return 'text-red-400';
  };

  const getConfidenceBgColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-emerald-600/20 border-emerald-500/30';
    if (confidence >= 0.6) return 'bg-amber-600/20 border-amber-500/30';
    return 'bg-red-600/20 border-red-500/30';
  };

  if (connections.length === 0) {
    return (
      <div className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 ${className}`}>
        <div className="text-sm text-zinc-400 text-center">No auto-connections</div>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900 border border-zinc-700 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <div className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Auto-Connections
          </div>
          <div className="text-xs text-zinc-500">({connections.length} total)</div>
        </div>
      </div>

      <div className="space-y-2">
        {displayConnections.map((connection, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${getConfidenceBgColor(connection.confidence)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{getConnectionIcon(connection.type)}</span>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                    {getConnectionTypeLabel(connection.type)}
                  </div>
                  {showConfidence && (
                    <span className={`text-xs font-bold ${getConfidenceColor(connection.confidence)}`}>
                      {(connection.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-300 mb-1">
                  <span className="font-semibold">{connection.sourceName}</span>
                  <span className="text-zinc-500 mx-2">→</span>
                  <span className="font-semibold">{connection.targetName}</span>
                </div>
                <div className="text-xs text-zinc-500 italic">{connection.reason}</div>
              </div>
              {(onReview || onUndo) && (
                <div className="flex gap-1">
                  {onReview && (
                    <button
                      onClick={() => onReview(connection)}
                      className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 rounded font-semibold transition-all"
                      title="Review connection"
                    >
                      Review
                    </button>
                  )}
                  {onUndo && (
                    <button
                      onClick={() => onUndo(connection)}
                      className="text-xs px-2 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded font-semibold transition-all"
                      title="Undo connection"
                    >
                      Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {connections.length > maxItems && (
          <div className="text-xs text-zinc-500 text-center py-2">
            +{connections.length - maxItems} more connections...
          </div>
        )}
      </div>
    </div>
  );
};
