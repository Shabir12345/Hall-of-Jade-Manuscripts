import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeCharacterPsychology } from '../services/characterPsychologyService';
import { analyzeMotivations } from '../services/motivationTracker';
import { analyzeVoiceUniqueness } from '../services/voiceAnalysisService';

interface CharacterPsychologyViewProps {
  novelState: NovelState;
}

const CharacterPsychologyView: React.FC<CharacterPsychologyViewProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'character',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = (result: ImprovementExecutionResult, improvedState: NovelState) => {
    setImprovementDialogOpen(false);
  };

  const psychologyAnalysis = useMemo(() => analyzeCharacterPsychology(novelState), [novelState]);
  const motivationAnalysis = useMemo(() => analyzeMotivations(novelState), [novelState]);
  const voiceAnalysis = useMemo(() => analyzeVoiceUniqueness(novelState), [novelState]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Character Psychology Dashboard
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Deep character insights and psychological development</p>
      </div>

      {/* Character Growth Trajectories */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Character Growth Trajectories</h3>
        <div className="space-y-6">
          {psychologyAnalysis.growthTrajectories.map((trajectory) => {
            const character = novelState.characterCodex.find(c => c.id === trajectory.characterId);
            return (
              <div key={trajectory.characterId} className="bg-zinc-800/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-bold text-amber-400">{trajectory.characterName}</div>
                    {character?.isProtagonist && (
                      <div className="text-xs text-amber-500 mt-1">Protagonist</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(trajectory.overallGrowthScore)}`}>
                      {trajectory.overallGrowthScore}/100
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">Growth Score</div>
                  </div>
                </div>

                {/* Growth Trajectory Visualization */}
                <div className="mt-4">
                  <div className="text-xs text-zinc-500 uppercase mb-2">Growth Over Time</div>
                  <div className="relative h-24 bg-zinc-900 rounded-lg p-3 overflow-x-auto">
                    <div className="flex items-end h-full space-x-1" style={{ minWidth: `${trajectory.trajectory.length * 30}px` }}>
                      {trajectory.trajectory.map((point, index) => {
                        const height = (point.growthScore / 100) * 100;
                        const color = getScoreColor(point.growthScore);
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center justify-end">
                            <div
                              className={`w-full ${color.replace('text-', 'bg-')} rounded-t transition-all duration-300`}
                              style={{ height: `${height}%` }}
                              title={`Ch ${point.chapterNumber}: ${point.psychologicalState} (${point.growthScore}/100)`}
                            ></div>
                            <div className="text-xs text-zinc-600 mt-1">{point.chapterNumber}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Latest Psychology State */}
                {psychologyAnalysis.psychologies
                  .filter(p => p.characterId === trajectory.characterId)
                  .sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0))
                  .slice(0, 1)
                  .map((psychology) => (
                    <div key={psychology.id} className="mt-4 pt-4 border-t border-zinc-700">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-zinc-500 uppercase mb-1">State</div>
                          <div className="text-zinc-300 capitalize">{psychology.psychologicalState}</div>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 uppercase mb-1">Growth Stage</div>
                          <div className="text-zinc-300 capitalize">{psychology.growthStage}</div>
                        </div>
                        {psychology.characterFlaw && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase mb-1">Flaw</div>
                            <div className="text-zinc-300">{psychology.characterFlaw.substring(0, 30)}...</div>
                          </div>
                        )}
                        {psychology.internalConflict && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase mb-1">Internal Conflict</div>
                            <div className="text-zinc-300">{psychology.internalConflict.substring(0, 30)}...</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}

          {psychologyAnalysis.growthTrajectories.length === 0 && (
            <div className="text-center py-8 text-zinc-500">No character psychology data available</div>
          )}
        </div>
      </div>

      {/* Motivation Hierarchies */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Motivation Hierarchies</h3>
        <div className="space-y-6">
          {motivationAnalysis.motivationHierarchies.map((hierarchy) => {
            const character = novelState.characterCodex.find(c => c.id === hierarchy.characterId);
            return (
              <div key={hierarchy.characterId} className="bg-zinc-800/50 rounded-lg p-6">
                <div className="text-lg font-bold text-amber-400 mb-4">{hierarchy.characterName}</div>
                
                {/* Primary Motivation */}
                {hierarchy.primary && (
                  <div className="mb-4 pb-4 border-b border-zinc-700">
                    <div className="text-xs text-zinc-500 uppercase mb-2">Primary Motivation</div>
                    <div className="text-sm text-zinc-300 font-semibold">{hierarchy.primary.motivationDescription}</div>
                    {hierarchy.primary.isConflicted && (
                      <div className="text-xs text-red-400 mt-1">⚠ Conflicted</div>
                    )}
                  </div>
                )}

                {/* Secondary Motivations */}
                {hierarchy.secondary.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-zinc-500 uppercase mb-2">Secondary Motivations</div>
                    <div className="space-y-2">
                      {hierarchy.secondary.map((motivation) => (
                        <div key={motivation.id} className="text-sm text-zinc-300">
                          • {motivation.motivationDescription}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicts */}
                {hierarchy.conflicts.length > 0 && (
                  <div className="pt-4 border-t border-zinc-700">
                    <div className="text-xs text-zinc-500 uppercase mb-2">Motivation Conflicts</div>
                    <div className="space-y-2">
                      {hierarchy.conflicts.map((conflict, index) => (
                        <div key={index} className="text-sm text-amber-400">
                          {conflict.motivation1.motivationDescription} ↔ {conflict.motivation2.motivationDescription}
                          <span className="text-xs text-zinc-500 ml-2">({conflict.conflictType})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice Analysis */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Character Voice Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voiceAnalysis.characterVoices.map((voice) => {
            const character = novelState.characterCodex.find(c => c.id === voice.characterId);
            return (
              <div key={voice.id} className="bg-zinc-800/50 rounded-lg p-4">
                <div className="text-sm font-bold text-amber-400 mb-3">{character?.name || 'Unknown'}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Distinctiveness</span>
                    <span className={`font-bold ${getScoreColor(voice.distinctivenessScore)}`}>
                      {voice.distinctivenessScore}/100
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Consistency</span>
                    <span className={`font-bold ${getScoreColor(voice.voiceConsistencyScore)}`}>
                      {voice.voiceConsistencyScore}/100
                    </span>
                  </div>
                  {voice.averageSentenceLength && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Avg Sentence Length</span>
                      <span className="text-zinc-400">{voice.averageSentenceLength.toFixed(1)} words</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Recommendations</h3>
        <ul className="space-y-2">
          {[...psychologyAnalysis.recommendations, ...motivationAnalysis.recommendations, ...voiceAnalysis.recommendations]
            .slice(0, 8)
            .map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start">
                <span className="text-amber-500 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export default CharacterPsychologyView;
