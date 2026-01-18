import React, { useState } from 'react';
import { EditorialSignal, EditorialSignalCategory } from '../types/editor';
import EditorialNote from './EditorialNote';

interface QualitySignalCardProps {
  category: EditorialSignalCategory;
  signals: EditorialSignal[];
  onJumpToLocation?: (signal: EditorialSignal) => void;
  onDismiss?: (signalId: string) => void;
  className?: string;
}

const QualitySignalCard: React.FC<QualitySignalCardProps> = ({
  category,
  signals,
  onJumpToLocation,
  onDismiss,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getCategoryLabel = (cat: EditorialSignalCategory): string => {
    const labels: Record<EditorialSignalCategory, string> = {
      narrative_authenticity: 'Narrative Authenticity',
      voice_consistency: 'Voice Consistency',
      structural_balance: 'Structural Balance',
      dialogue_naturalness: 'Dialogue Naturalness',
      originality_craft: 'Originality & Craft',
      emotional_credibility: 'Emotional Credibility',
    };
    return labels[cat];
  };

  const getCategoryIcon = (cat: EditorialSignalCategory): string => {
    const icons: Record<EditorialSignalCategory, string> = {
      narrative_authenticity: '📝',
      voice_consistency: '🎭',
      structural_balance: '⚖️',
      dialogue_naturalness: '💬',
      originality_craft: '✨',
      emotional_credibility: '❤️',
    };
    return icons[cat];
  };

  const getCategoryColor = (cat: EditorialSignalCategory): string => {
    const colors: Record<EditorialSignalCategory, string> = {
      narrative_authenticity: 'border-blue-500/30 bg-blue-500/5',
      voice_consistency: 'border-purple-500/30 bg-purple-500/5',
      structural_balance: 'border-amber-500/30 bg-amber-500/5',
      dialogue_naturalness: 'border-green-500/30 bg-green-500/5',
      originality_craft: 'border-pink-500/30 bg-pink-500/5',
      emotional_credibility: 'border-red-500/30 bg-red-500/5',
    };
    return colors[cat];
  };

  const severityCounts = {
    issue: signals.filter(s => s.severity === 'issue').length,
    concern: signals.filter(s => s.severity === 'concern').length,
    suggestion: signals.filter(s => s.severity === 'suggestion').length,
    info: signals.filter(s => s.severity === 'info').length,
  };

  const avgScore = signals.length > 0 && signals.some(s => s.score !== undefined)
    ? Math.round(
        signals
          .filter(s => s.score !== undefined)
          .reduce((sum, s) => sum + (s.score || 0), 0) /
        signals.filter(s => s.score !== undefined).length
      )
    : null;

  if (signals.length === 0) {
    return null;
  }

  return (
    <div className={`border rounded-lg ${getCategoryColor(category)} ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{getCategoryIcon(category)}</span>
          <h3 className="text-sm font-bold text-zinc-300">
            {getCategoryLabel(category)}
          </h3>
          <span className="text-xs text-zinc-500">({signals.length})</span>
        </div>
        <div className="flex items-center gap-3">
          {avgScore !== null && (
            <span className="text-xs text-zinc-400">
              Avg: {avgScore}/100
            </span>
          )}
          <div className="flex items-center gap-1">
            {severityCounts.issue > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30">
                {severityCounts.issue}
              </span>
            )}
            {severityCounts.concern > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
                {severityCounts.concern}
              </span>
            )}
            {severityCounts.suggestion > 0 && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                {severityCounts.suggestion}
              </span>
            )}
          </div>
          <span className="text-zinc-500 text-xs">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {/* Signals list */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-2 border-t border-zinc-700/50">
          {signals.map(signal => (
            <EditorialNote
              key={signal.id}
              signal={signal}
              onJumpToLocation={onJumpToLocation}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default QualitySignalCard;
