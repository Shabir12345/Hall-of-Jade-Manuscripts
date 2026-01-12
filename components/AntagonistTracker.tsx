import React, { useMemo, useState, useEffect } from 'react';
import { NovelState, Antagonist } from '../types';
import { validateProtagonistHasEnemy } from '../services/antagonistValidator';
import { generateAntagonistContext } from '../services/antagonistAnalyzer';
import { analyzeAntagonistGaps } from '../services/antagonistAnalyzer';

interface AntagonistTrackerProps {
  novel: NovelState;
  currentChapterNumber: number;
}

const AntagonistTracker: React.FC<AntagonistTrackerProps> = ({ novel, currentChapterNumber }) => {
  const [validation, setValidation] = React.useState<any>(null);
  const [context, setContext] = React.useState<any>(null);
  const [gaps, setGaps] = React.useState<any[]>([]);

  React.useEffect(() => {
    const loadData = async () => {
      const activeArc = novel.plotLedger.find(a => a.status === 'active') || null;
      const val = await validateProtagonistHasEnemy(novel.id, currentChapterNumber, activeArc);
      const ctx = await generateAntagonistContext(novel.id, currentChapterNumber, activeArc);
      const gapAnalysis = await analyzeAntagonistGaps(novel.id, novel.chapters, novel.plotLedger);
      setValidation(val);
      setContext(ctx);
      setGaps(gapAnalysis);
    };
    loadData();
  }, [novel, currentChapterNumber]);

  const antagonists = novel.antagonists || [];
  const activeAntagonists = React.useMemo(() => 
    antagonists.filter(a => a.status === 'active' || a.status === 'hinted'),
    [antagonists]
  );

  if (!validation || !context) {
    return (
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="animate-pulse">Loading antagonist status...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Antagonist Status</h3>

      {/* Validation Warnings/Errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 md:p-6">
          <div className="font-fantasy font-bold text-red-400 mb-3 text-lg">⚔️ Critical Issues</div>
          <ul className="list-disc list-inside space-y-2 text-red-300">
            {validation.errors.map((error: string, idx: number) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="bg-yellow-950/40 border border-yellow-900/60 rounded-xl p-4 md:p-6">
          <div className="font-fantasy font-bold text-yellow-400 mb-3 text-lg">⚠️ Warnings</div>
          <ul className="list-disc list-inside space-y-2 text-yellow-300">
            {validation.warnings.map((warning: string, idx: number) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.suggestions.length > 0 && (
        <div className="bg-blue-950/40 border border-blue-900/60 rounded-xl p-4 md:p-6">
          <div className="font-fantasy font-bold text-blue-400 mb-3 text-lg">💡 Suggestions</div>
          <ul className="list-disc list-inside space-y-2 text-blue-300">
            {validation.suggestions.map((suggestion: string, idx: number) => (
              <li key={idx}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Antagonists */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Active Antagonists ({activeAntagonists.length})
        </h4>
        {activeAntagonists.length === 0 ? (
          <div className="text-zinc-400 text-sm p-4 bg-zinc-950/50 rounded-lg border border-zinc-700/50">
            ⚠️ No active antagonists. This may indicate a gap in opposition.
          </div>
        ) : (
          <div className="space-y-3">
            {activeAntagonists.map(ant => (
              <div key={ant.id} className="border border-zinc-700 rounded-xl p-4 bg-zinc-950/30 hover:bg-zinc-950/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-fantasy font-bold text-amber-400 text-lg">
                        {ant.name}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        ant.threatLevel === 'extreme' ? 'bg-red-950/60 text-red-300 border border-red-900/60' :
                        ant.threatLevel === 'high' ? 'bg-orange-950/60 text-orange-300 border border-orange-900/60' :
                        ant.threatLevel === 'medium' ? 'bg-yellow-950/60 text-yellow-300 border border-yellow-900/60' :
                        'bg-green-950/60 text-green-300 border border-green-900/60'
                      }`}>
                        {ant.threatLevel} threat
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        {ant.type}
                      </span>
                    </div>
                    {ant.description && (
                      <div className="text-sm text-zinc-300 line-clamp-2 font-serif-novel italic">
                        {ant.description}
                      </div>
                    )}
                    <div className="text-xs text-zinc-500 mt-2">
                      Scope: <span className="text-zinc-400 font-semibold">{ant.durationScope}</span>
                      {ant.firstAppearedChapter && (
                        <> • First: <span className="text-zinc-400 font-semibold">Ch {ant.firstAppearedChapter}</span></>
                      )}
                      {ant.lastAppearedChapter && (
                        <> • Last: <span className="text-zinc-400 font-semibold">Ch {ant.lastAppearedChapter}</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary Threat */}
      {context.primaryThreat && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-4 md:p-6">
          <h4 className="font-fantasy font-bold text-red-400 mb-3 text-lg">🎯 Primary Threat</h4>
          <div className="text-red-300">
            <div className="font-semibold text-lg mb-2">{context.primaryThreat.name}</div>
            <div className="text-sm mt-1 font-serif-novel">{context.primaryThreat.description.substring(0, 200)}</div>
          </div>
        </div>
      )}

      {/* Hinted Antagonists */}
      {context.hintedAntagonists.length > 0 && (
        <div className="bg-yellow-950/40 border border-yellow-900/60 rounded-xl p-4 md:p-6">
          <h4 className="font-fantasy font-bold text-yellow-400 mb-3 text-lg">
            🔮 Foreshadowed Antagonists ({context.hintedAntagonists.length})
          </h4>
          <div className="space-y-2">
            {context.hintedAntagonists.map((ant: Antagonist) => (
              <div key={ant.id} className="text-yellow-300 text-sm">
                <span className="font-semibold">{ant.name}</span>
                {ant.description && (
                  <span className="ml-2">- {ant.description.substring(0, 100)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap Analysis */}
      {gaps.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
            Antagonist Gaps Detected ({gaps.length})
          </h4>
          <div className="space-y-2">
            {gaps.slice(0, 5).map((gap, idx) => (
              <div key={idx} className="text-sm text-orange-700 dark:text-orange-300">
                <span className="font-medium">Ch {gap.chapterNumber}:</span> {gap.message}
                {gap.suggestion && (
                  <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 italic">
                    → {gap.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <h4 className="font-semibold text-zinc-200 mb-2">Summary</h4>
        <div className="text-sm text-zinc-300">
          {context.summary || 'No active antagonist context available.'}
        </div>
      </div>
    </div>
  );
};

export default AntagonistTracker;
