import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeStoryStructure } from '../services/storyStructureAnalyzer';
import { analyzeHeroJourney } from '../services/heroJourneyTracker';
import { analyzeSaveTheCat } from '../services/beatSheetAnalyzer';

interface StructureVisualizerProps {
  novelState: NovelState;
}

const StructureVisualizer: React.FC<StructureVisualizerProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'structure',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = (result: ImprovementExecutionResult, improvedState: NovelState) => {
    setImprovementDialogOpen(false);
  };

  const structureAnalysis = useMemo(() => analyzeStoryStructure(novelState), [novelState]);
  const heroJourney = useMemo(() => analyzeHeroJourney(novelState), [novelState]);
  const beatSheet = useMemo(() => analyzeSaveTheCat(novelState), [novelState]);

  const totalChapters = novelState.chapters.length || 1;

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Story Structure Visualizer
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Visual analysis of story structure across multiple frameworks</p>
      </div>

      {/* Three-Act Structure Visualization */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Three-Act Structure</h3>
        
        {/* Visual Timeline */}
        <div className="mb-6">
          <div className="relative h-32 bg-zinc-800 rounded-lg overflow-hidden">
            {/* Act 1 */}
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center"
              style={{ width: `${structureAnalysis.threeActStructure.act1.percentage}%` }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 1</div>
                <div className="text-xs text-blue-100">{structureAnalysis.threeActStructure.act1.percentage.toFixed(1)}%</div>
              </div>
            </div>
            
            {/* Act 2 */}
            <div 
              className="absolute top-0 h-full bg-gradient-to-r from-amber-600 to-amber-500 flex items-center justify-center"
              style={{ 
                left: `${structureAnalysis.threeActStructure.act1.percentage}%`,
                width: `${structureAnalysis.threeActStructure.act2.percentage}%` 
              }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 2</div>
                <div className="text-xs text-amber-100">{structureAnalysis.threeActStructure.act2.percentage.toFixed(1)}%</div>
              </div>
            </div>
            
            {/* Act 3 */}
            <div 
              className="absolute top-0 right-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-center"
              style={{ width: `${structureAnalysis.threeActStructure.act3.percentage}%` }}
            >
              <div className="text-center">
                <div className="text-sm font-bold text-white">Act 3</div>
                <div className="text-xs text-emerald-100">{structureAnalysis.threeActStructure.act3.percentage.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Structure Scores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 1 (Setup)</div>
            <div className="text-2xl font-bold text-blue-400 mb-1">
              {structureAnalysis.threeActStructure.act1.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 25%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act1.startChapter}-{structureAnalysis.threeActStructure.act1.endChapter}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 2 (Confrontation)</div>
            <div className="text-2xl font-bold text-amber-400 mb-1">
              {structureAnalysis.threeActStructure.act2.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 50%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act2.startChapter}-{structureAnalysis.threeActStructure.act2.endChapter}
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <div className="text-xs text-zinc-400 uppercase mb-2">Act 3 (Resolution)</div>
            <div className="text-2xl font-bold text-emerald-400 mb-1">
              {structureAnalysis.threeActStructure.act3.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-zinc-500">Ideal: 25%</div>
            <div className="text-xs text-zinc-500">
              Ch {structureAnalysis.threeActStructure.act3.startChapter}-{structureAnalysis.threeActStructure.act3.endChapter}
            </div>
          </div>
        </div>

        {/* Story Beats */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-zinc-300 uppercase mb-3">Story Beats</h4>
          <div className="space-y-2">
            {structureAnalysis.detectedBeats.map((beat, index) => (
              <div key={index} className="bg-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    beat.strengthScore >= 70 ? 'bg-emerald-500' :
                    beat.strengthScore >= 50 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="text-sm font-bold text-amber-400">
                      {beat.beatType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-xs text-zinc-500">Ch {beat.chapterNumber} • {beat.positionPercentage.toFixed(1)}%</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-zinc-400">{beat.strengthScore}/100</div>
              </div>
            ))}
            {structureAnalysis.detectedBeats.length === 0 && (
              <div className="text-sm text-zinc-500 italic">No story beats detected yet</div>
            )}
          </div>
        </div>

        {/* Overall Structure Score */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-zinc-300">Overall Structure Score</span>
            <span className={`text-2xl font-bold ${
              structureAnalysis.overallStructureScore >= 80 ? 'text-emerald-400' :
              structureAnalysis.overallStructureScore >= 70 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {structureAnalysis.overallStructureScore}/100
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                structureAnalysis.overallStructureScore >= 80 ? 'bg-emerald-500' :
                structureAnalysis.overallStructureScore >= 70 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${structureAnalysis.overallStructureScore}%` }}
            ></div>
          </div>
        </div>

        {/* Recommendations */}
        {structureAnalysis.recommendations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <h4 className="text-sm font-bold text-zinc-300 uppercase mb-3">Recommendations</h4>
            <ul className="space-y-2">
              {structureAnalysis.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-zinc-300 flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Hero's Journey */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Hero's Journey (12 Stages)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {heroJourney.stages.map((stage) => (
            <div
              key={stage.id}
              className={`p-3 rounded-lg border-2 ${
                stage.isComplete && stage.qualityScore >= 70
                  ? 'bg-emerald-900/20 border-emerald-700'
                  : stage.isComplete
                  ? 'bg-amber-900/20 border-amber-700'
                  : 'bg-zinc-800/50 border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold text-amber-400">{stage.stageNumber}.</div>
                <div className={`text-xs font-bold ${
                  stage.isComplete && stage.qualityScore >= 70 ? 'text-emerald-400' :
                  stage.isComplete ? 'text-amber-400' :
                  'text-zinc-500'
                }`}>
                  {stage.isComplete ? `${stage.qualityScore}/100` : 'Incomplete'}
                </div>
              </div>
              <div className="text-sm text-zinc-300 font-semibold">{stage.stageName}</div>
              {stage.chapterNumber && (
                <div className="text-xs text-zinc-500 mt-1">Ch {stage.chapterNumber}</div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-300">Journey Completion</span>
            <span className="text-xl font-bold text-amber-400">
              {heroJourney.completionPercentage.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-zinc-700 rounded-full overflow-hidden mt-2">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${heroJourney.completionPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Save the Cat Beat Sheet */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Save the Cat Beat Sheet</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {beatSheet.beats.map((beat) => (
            <div
              key={beat.beatNumber}
              className={`p-3 rounded-lg border ${
                beat.detected
                  ? beat.strengthScore >= 70
                    ? 'bg-emerald-900/20 border-emerald-700'
                    : 'bg-amber-900/20 border-amber-700'
                  : 'bg-zinc-800/50 border-zinc-700 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-bold text-amber-400">{beat.beatNumber}.</div>
                {beat.detected ? (
                  <div className={`text-xs font-bold ${
                    beat.strengthScore >= 70 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {beat.strengthScore}/100
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500">Not Detected</div>
                )}
              </div>
              <div className="text-sm text-zinc-300 font-semibold">{beat.beatName}</div>
              {beat.chapterNumber && (
                <div className="text-xs text-zinc-500 mt-1">
                  Ch {beat.chapterNumber} • {beat.idealPosition.toFixed(0)}% ideal
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 bg-zinc-800 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-zinc-300">Beat Sheet Score</span>
            <span className={`text-xl font-bold ${
              beatSheet.overallScore >= 80 ? 'text-emerald-400' :
              beatSheet.overallScore >= 70 ? 'text-amber-400' :
              'text-red-400'
            }`}>
              {beatSheet.overallScore}/100
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructureVisualizer;
