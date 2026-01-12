import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeTension } from '../services/tensionAnalyzer';
import { analyzeConflicts } from '../services/conflictTracker';

interface TensionCurveViewProps {
  novelState: NovelState;
}

const TensionCurveView: React.FC<TensionCurveViewProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'tension',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = (result: ImprovementExecutionResult, improvedState: NovelState) => {
    setImprovementDialogOpen(false);
  };

  const tensionAnalysis = useMemo(() => analyzeTension(novelState), [novelState]);
  const conflictAnalysis = useMemo(() => analyzeConflicts(novelState), [novelState]);

  // Get tension color
  const getTensionColor = (level: number): string => {
    if (level >= 80) return 'bg-red-500';
    if (level >= 60) return 'bg-orange-500';
    if (level >= 40) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      {/* Improvement Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleImproveNovel}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
        >
          <span>⚡</span>
          <span>Improve Novel</span>
        </button>
      </div>

      {/* Improvement Dialog */}
      {improvementRequest && (
        <NovelImprovementDialog
          isOpen={improvementDialogOpen}
          novelState={novelState}
          request={improvementRequest}
          onClose={() => setImprovementDialogOpen(false)}
          onComplete={handleImprovementComplete}
        />
      )}
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Tension Curve & Conflict Map
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Visual tension mapping and conflict hierarchy</p>
      </div>

      {/* Overall Tension Score */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-amber-500 rounded-xl p-8 text-center">
          <div className={`text-5xl font-fantasy font-bold mb-2 ${
            tensionAnalysis.overallTensionScore >= 80 ? 'text-red-400' :
            tensionAnalysis.overallTensionScore >= 70 ? 'text-orange-400' :
            tensionAnalysis.overallTensionScore >= 60 ? 'text-amber-400' :
            'text-blue-400'
          }`}>
            {tensionAnalysis.overallTensionScore}/100
          </div>
          <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Tension Score</div>
          <div className="mt-2 text-sm text-zinc-500">
            Pattern: {tensionAnalysis.escalationPattern.toUpperCase()} • Balance: {tensionAnalysis.tensionReleaseBalance}/100
          </div>
        </div>
      </div>

      {/* Tension Curve */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Tension Curve</h3>
        <div className="relative h-80 bg-zinc-800 rounded-lg p-4 overflow-x-auto">
          <div className="flex items-end h-full space-x-1" style={{ minWidth: `${tensionAnalysis.tensionCurve.length * 40}px` }}>
            {tensionAnalysis.tensionCurve.map((point, index) => {
              const height = (point.tensionLevel / 100) * 100;
              const color = getTensionColor(point.tensionLevel);
              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer ${
                      point.isPeak ? 'ring-2 ring-amber-400' : ''
                    }`}
                    style={{ height: `${height}%` }}
                    title={`Ch ${point.chapterNumber}: ${point.tensionLevel}/100 (${point.tensionType}) ${point.isPeak ? 'PEAK' : ''} ${point.isValley ? 'VALLEY' : ''}`}
                  ></div>
                  <div className="text-xs text-zinc-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    Ch {point.chapterNumber}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-zinc-400">High (80-100)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-zinc-400">Medium-High (60-79)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-zinc-400">Medium (40-59)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-zinc-400">Low (0-39)</span>
          </div>
        </div>
      </div>

      {/* Tension Peaks and Valleys */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Peaks */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Tension Peaks</h3>
          <div className="space-y-3">
            {tensionAnalysis.tensionPeaks.slice(0, 5).map((peak, index) => (
              <div key={index} className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-red-400">Chapter {peak.chapterNumber}</div>
                  <div className="text-lg font-bold text-red-400">{peak.tensionLevel}/100</div>
                </div>
                <div className="text-sm text-zinc-300">{peak.description}</div>
              </div>
            ))}
            {tensionAnalysis.tensionPeaks.length === 0 && (
              <div className="text-sm text-zinc-500 italic">No tension peaks detected yet</div>
            )}
          </div>
        </div>

        {/* Valleys */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Tension Valleys</h3>
          <div className="space-y-3">
            {tensionAnalysis.tensionValleys.slice(0, 5).map((valley, index) => (
              <div key={index} className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-blue-400">Chapter {valley.chapterNumber}</div>
                  <div className="text-lg font-bold text-blue-400">{valley.tensionLevel}/100</div>
                </div>
                <div className="text-sm text-zinc-300">{valley.description}</div>
              </div>
            ))}
            {tensionAnalysis.tensionValleys.length === 0 && (
              <div className="text-sm text-zinc-500 italic">No tension valleys detected yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Conflict Hierarchy */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Conflict Hierarchy</h3>
        
        {/* Story-Level Conflicts */}
        {conflictAnalysis.storyLevelConflicts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-zinc-300 mb-3 uppercase">Story-Level Conflicts</h4>
            <div className="space-y-2">
              {conflictAnalysis.storyLevelConflicts.map((conflict) => (
                <div key={conflict.id} className="bg-zinc-800/50 border-l-4 border-amber-500 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-amber-400">{conflict.conflictType?.replace(/_/g, ' ')}</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      conflict.isResolved ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'
                    }`}>
                      {conflict.isResolved ? 'Resolved' : 'Active'}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-300">{conflict.conflictDescription}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arc-Level Conflicts */}
        {conflictAnalysis.arcLevelConflicts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-zinc-300 mb-3 uppercase">Arc-Level Conflicts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {conflictAnalysis.arcLevelConflicts.map((conflict) => (
                <div key={conflict.id} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                  <div className="text-xs font-bold text-amber-400 mb-1">{conflict.conflictType?.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-zinc-300">{conflict.conflictDescription}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conflict Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{conflictAnalysis.conflicts.length}</div>
            <div className="text-xs text-zinc-400 uppercase">Total Conflicts</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{conflictAnalysis.unresolvedConflicts.length}</div>
            <div className="text-xs text-zinc-400 uppercase">Unresolved</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{conflictAnalysis.resolvedConflicts.length}</div>
            <div className="text-xs text-zinc-400 uppercase">Resolved</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">
              {conflictAnalysis.conflicts.length > 0
                ? Math.round((conflictAnalysis.resolvedConflicts.length / conflictAnalysis.conflicts.length) * 100)
                : 0}%
            </div>
            <div className="text-xs text-zinc-400 uppercase">Resolution Rate</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {tensionAnalysis.recommendations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Recommendations</h3>
          <ul className="space-y-2">
            {tensionAnalysis.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start">
                <span className="text-amber-500 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TensionCurveView;
