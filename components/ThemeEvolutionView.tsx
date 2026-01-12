import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeThemeEvolution } from '../services/themeAnalyzer';
import { analyzeThematicResonance } from '../services/thematicResonanceService';

interface ThemeEvolutionViewProps {
  novelState: NovelState;
}

const ThemeEvolutionView: React.FC<ThemeEvolutionViewProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'theme',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = (result: ImprovementExecutionResult, improvedState: NovelState) => {
    setImprovementDialogOpen(false);
  };

  const themeAnalysis = useMemo(() => analyzeThemeEvolution(novelState), [novelState]);
  const resonanceAnalysis = useMemo(() => analyzeThematicResonance(novelState), [novelState]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getDepthColor = (depth: 'surface' | 'mid' | 'deep'): string => {
    if (depth === 'deep') return 'text-emerald-400';
    if (depth === 'mid') return 'text-amber-400';
    return 'text-zinc-400';
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Theme Evolution
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Theme tracking, interweaving, and philosophical depth</p>
      </div>

      {/* Overall Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center">
          <div className={`text-4xl font-fantasy font-bold mb-2 ${getScoreColor(themeAnalysis.overallConsistencyScore)}`}>
            {themeAnalysis.overallConsistencyScore}/100
          </div>
          <div className="text-sm text-zinc-400 uppercase">Theme Consistency</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center">
          <div className={`text-4xl font-fantasy font-bold mb-2 ${getScoreColor(themeAnalysis.philosophicalDepthScore)}`}>
            {themeAnalysis.philosophicalDepthScore}/100
          </div>
          <div className="text-sm text-zinc-400 uppercase">Philosophical Depth</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center">
          <div className={`text-4xl font-fantasy font-bold mb-2 ${getScoreColor(resonanceAnalysis.overallResonanceScore)}`}>
            {resonanceAnalysis.overallResonanceScore}/100
          </div>
          <div className="text-sm text-zinc-400 uppercase">Thematic Resonance</div>
        </div>
      </div>

      {/* Theme Timeline */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Theme Timeline</h3>
        <div className="space-y-6">
          {themeAnalysis.primaryThemes.map((theme) => (
            <div key={theme.id} className="bg-zinc-800/50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-lg font-bold text-amber-400">{theme.themeName}</div>
                  <div className="text-xs text-zinc-500 mt-1">Primary Theme</div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(theme.consistencyScore)}`}>
                    {theme.consistencyScore}/100
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">Consistency</div>
                </div>
              </div>

              {/* Theme Evolution Notes */}
              {theme.evolutionNotes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="text-sm font-bold text-zinc-300 mb-3 uppercase">Evolution</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {theme.evolutionNotes.slice(0, 5).map((note, index) => (
                      <div key={index} className="text-xs text-zinc-400 flex items-start">
                        <span className="text-amber-500 mr-2">Ch {note.chapter}:</span>
                        <span>{note.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Theme Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-700">
                <div>
                  <div className="text-xs text-zinc-500 uppercase mb-1">First Appeared</div>
                  <div className="text-sm text-zinc-300">
                    {theme.firstAppearedChapter ? `Ch ${theme.firstAppearedChapter}` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase mb-1">Setup</div>
                  <div className="text-sm text-zinc-300">
                    {theme.setupChapter ? `Ch ${theme.setupChapter}` : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase mb-1">Resolution</div>
                  <div className="text-sm text-zinc-300">
                    {theme.resolutionChapter ? `Ch ${theme.resolutionChapter}` : 'Pending'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 uppercase mb-1">Depth</div>
                  <div className={`text-sm font-bold ${getDepthColor(theme.depthLevel)}`}>
                    {theme.depthLevel.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Character Connections */}
              {theme.characterConnections.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="text-xs text-zinc-500 uppercase mb-2">Character Connections</div>
                  <div className="flex flex-wrap gap-2">
                    {theme.characterConnections.map((charId, index) => {
                      const character = novelState.characterCodex.find(c => c.id === charId);
                      return character ? (
                        <span key={index} className="text-xs px-2 py-1 bg-amber-600/20 text-amber-400 rounded">
                          {character.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {themeAnalysis.primaryThemes.length === 0 && (
            <div className="text-center py-8 text-zinc-500">
              No primary themes detected. Consider establishing core themes.
            </div>
          )}
        </div>
      </div>

      {/* Thematic Resonance */}
      {resonanceAnalysis.themePairs.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Thematic Resonance</h3>
          <div className="space-y-4">
            {resonanceAnalysis.themePairs.slice(0, 5).map((pair, index) => (
              <div key={index} className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-amber-400">
                    {pair.theme1} ↔ {pair.theme2}
                  </div>
                  <div className={`text-sm font-bold ${getScoreColor(pair.resonanceScore)}`}>
                    {pair.resonanceScore}/100
                  </div>
                </div>
                <div className="text-xs text-zinc-400 mb-2 capitalize">{pair.connectionType} Connection</div>
                <div className="text-sm text-zinc-300">{pair.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Recommendations</h3>
        <ul className="space-y-2">
          {[...themeAnalysis.recommendations, ...resonanceAnalysis.recommendations].map((rec, index) => (
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

export default ThemeEvolutionView;
