import React from 'react';
import { EditorialSignal } from '../types/editor';

interface EditorialNoteProps {
  signal: EditorialSignal;
  onJumpToLocation?: (signal: EditorialSignal) => void;
  onDismiss?: (signalId: string) => void;
}

const EditorialNote: React.FC<EditorialNoteProps> = ({
  signal,
  onJumpToLocation,
  onDismiss,
}) => {
  const getSeverityColor = (severity: EditorialSignal['severity']) => {
    switch (severity) {
      case 'issue':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'concern':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'suggestion':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'info':
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
      default:
        return 'text-zinc-400';
    }
  };

  const getCategoryLabel = (category: EditorialSignal['category']): string => {
    const labels: Record<EditorialSignal['category'], string> = {
      narrative_authenticity: 'Narrative Authenticity',
      voice_consistency: 'Voice Consistency',
      structural_balance: 'Structural Balance',
      dialogue_naturalness: 'Dialogue Naturalness',
      originality_craft: 'Originality & Craft',
      emotional_credibility: 'Emotional Credibility',
    };
    return labels[category];
  };

  const getSeverityIcon = (severity: EditorialSignal['severity']) => {
    switch (severity) {
      case 'issue':
        return '⚠️';
      case 'concern':
        return '⚡';
      case 'suggestion':
        return '💡';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className={`p-3 border rounded-lg ${getSeverityColor(signal.severity)}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm">{getSeverityIcon(signal.severity)}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-zinc-200">{signal.title}</h4>
              <span className="text-xs px-2 py-0.5 bg-zinc-800/50 rounded border border-zinc-700 text-zinc-400">
                {getCategoryLabel(signal.category)}
              </span>
              {signal.score !== undefined && (
                <span className="text-xs text-zinc-500">
                  Score: {signal.score}/100
                </span>
              )}
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(signal.id)}
            className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 hover:bg-zinc-800/50 rounded transition-colors"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-300 mb-2">{signal.description}</p>

      {signal.suggestion && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50">
          <p className="text-xs text-zinc-400 italic">
            <span className="font-semibold">Suggestion:</span> {signal.suggestion}
          </p>
        </div>
      )}

      {signal.context && (
        <div className="mt-2 pt-2 border-t border-zinc-700/50">
          <p className="text-xs text-zinc-500">{signal.context}</p>
        </div>
      )}

      {signal.location && onJumpToLocation && (
        <button
          onClick={() => onJumpToLocation(signal)}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Jump to location
        </button>
      )}
    </div>
  );
};

export default EditorialNote;
