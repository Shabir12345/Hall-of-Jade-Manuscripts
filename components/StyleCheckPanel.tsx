import React, { useState, useMemo } from 'react';
import { StyleCheck, StyleCheckType, StyleCheckSeverity } from '../types/editor';

interface StyleCheckPanelProps {
  checks: StyleCheck[];
  onJumpToIssue?: (check: StyleCheck) => void;
  className?: string;
}

const StyleCheckPanel: React.FC<StyleCheckPanelProps> = ({
  checks,
  onJumpToIssue,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | StyleCheckType>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | StyleCheckSeverity>('all');

  const filteredChecks = useMemo(() => {
    return checks.filter(c => {
      if (filter !== 'all' && c.checkType !== filter) return false;
      if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
      return true;
    });
  }, [checks, filter, severityFilter]);

  const checksByType = useMemo(() => {
    const grouped: Record<StyleCheckType, number> = {
      pov: 0,
      dialogue: 0,
      pacing: 0,
      sentence_variety: 0,
      structure: 0,
      consistency: 0,
    };
    checks.forEach(c => {
      grouped[c.checkType]++;
    });
    return grouped;
  }, [checks]);

  const checksBySeverity = useMemo(() => {
    const grouped: Record<StyleCheckSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };
    checks.forEach(c => {
      grouped[c.severity]++;
    });
    return grouped;
  }, [checks]);

  const getSeverityColor = (severity: StyleCheckSeverity) => {
    switch (severity) {
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-zinc-400';
    }
  };

  const getTypeLabel = (type: StyleCheckType): string => {
    const labels: Record<StyleCheckType, string> = {
      pov: 'POV',
      dialogue: 'Dialogue',
      pacing: 'Pacing',
      sentence_variety: 'Sentence Variety',
      structure: 'Structure',
      consistency: 'Consistency',
    };
    return labels[type];
  };

  const typeOptions: StyleCheckType[] = ['pov', 'dialogue', 'pacing', 'sentence_variety', 'structure', 'consistency'];

  if (checks.length === 0) {
    return (
      <div className={`p-4 bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
        <p className="text-sm text-zinc-500 text-center">
          No style issues found. Great work!
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide mb-3">
          Style Checks ({checks.length})
        </h3>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Type:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === 'all'
                  ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              All ({checks.length})
            </button>
            {typeOptions.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  filter === type
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {getTypeLabel(type)} ({checksByType[type]})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Severity:</span>
            {(['all', 'error', 'warning', 'info'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  severityFilter === s
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && ` (${checksBySeverity[s]})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Checks list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {filteredChecks.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500">No issues match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-700">
            {filteredChecks.map((check) => (
              <div
                key={check.id}
                className="p-4 hover:bg-zinc-800/30 transition-colors bg-zinc-900/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getSeverityColor(check.severity)}`}>
                      {check.severity}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {getTypeLabel(check.checkType)}
                    </span>
                  </div>

                  {onJumpToIssue && (
                    <button
                      onClick={() => onJumpToIssue(check)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      title="Jump to location"
                    >
                      📍 Jump
                    </button>
                  )}
                </div>

                <p className="text-sm text-zinc-300 mb-2">{check.message}</p>

                {check.suggestion && (
                  <div className="mt-2 p-2 bg-zinc-800/50 border border-zinc-700 rounded">
                    <p className="text-xs text-zinc-500 mb-1">Suggestion:</p>
                    <p className="text-xs text-zinc-400">{check.suggestion}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleCheckPanel;
