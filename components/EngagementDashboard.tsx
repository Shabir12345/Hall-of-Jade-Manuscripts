import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeEngagement } from '../services/engagementAnalyzer';
import { analyzeEmotionalResonance } from '../services/emotionalResonanceService';

interface EngagementDashboardProps {
  novelState: NovelState;
}

const EngagementDashboard: React.FC<EngagementDashboardProps> = ({ novelState }) => {
  const [improvementDialogOpen, setImprovementDialogOpen] = useState(false);
  const [improvementRequest, setImprovementRequest] = useState<ImprovementRequest | null>(null);

  const handleImproveNovel = () => {
    setImprovementRequest({
      category: 'engagement',
      scope: 'comprehensive',
    });
    setImprovementDialogOpen(true);
  };

  const handleImprovementComplete = (result: ImprovementExecutionResult, improvedState: NovelState) => {
    setImprovementDialogOpen(false);
  };

  const engagementAnalysis = useMemo(() => analyzeEngagement(novelState), [novelState]);
  const emotionalAnalysis = useMemo(() => analyzeEmotionalResonance(novelState), [novelState]);

  // Get score color
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
          Engagement Analytics
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Reader engagement metrics and emotional journey</p>
      </div>

      {/* Overall Engagement Score */}
      <div className="mb-8">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-amber-500 rounded-xl p-8 text-center">
          <div className={`text-5xl font-fantasy font-bold mb-2 ${getScoreColor(engagementAnalysis.overallEngagementScore)}`}>
            {engagementAnalysis.overallEngagementScore}/100
          </div>
          <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Engagement</div>
        </div>
      </div>

      {/* Engagement Curve */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Engagement Curve</h3>
        <div className="relative h-64 bg-zinc-800 rounded-lg p-4 overflow-x-auto">
          <div className="flex items-end h-full space-x-1" style={{ minWidth: `${engagementAnalysis.engagementCurve.length * 40}px` }}>
            {engagementAnalysis.engagementCurve.map((point, index) => {
              const height = (point.engagementScore / 100) * 100;
              const color = point.engagementScore >= 80 ? 'bg-emerald-500' :
                           point.engagementScore >= 70 ? 'bg-amber-500' :
                           point.engagementScore >= 60 ? 'bg-yellow-500' :
                           'bg-red-500';
              return (
                <div key={index} className="flex-1 flex flex-col items-center justify-end group relative">
                  <div
                    className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer`}
                    style={{ height: `${height}%` }}
                    title={`Ch ${point.chapterNumber}: ${point.engagementScore}/100 (${point.trend})`}
                  ></div>
                  <div className="text-xs text-zinc-500 mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                    Ch {point.chapterNumber}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Engagement Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {engagementAnalysis.metrics.slice(-6).map((metric) => (
          <div key={metric.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-zinc-300">Chapter {metric.chapterNumber}</h4>
              <span className={`text-xl font-bold ${getScoreColor(metric.overallEngagementScore)}`}>
                {metric.overallEngagementScore}/100
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Hook</span>
                <span className="text-zinc-400">{metric.hookStrength}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Cliffhanger</span>
                <span className="text-zinc-400">{metric.cliffhangerEffectiveness}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Emotional</span>
                <span className="text-zinc-400">{metric.emotionalResonance}/100</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tension</span>
                <span className="text-zinc-400">{metric.tensionLevel}/100</span>
              </div>
              {metric.fatigueDetected && (
                <div className="mt-2 text-xs text-red-400">⚠ Fatigue Detected</div>
              )}
              {metric.peakMoment && (
                <div className="mt-2 text-xs text-emerald-400">⭐ Peak Moment</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Peak Moments */}
      {engagementAnalysis.peakMoments.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Peak Moments</h3>
          <div className="space-y-3">
            {engagementAnalysis.peakMoments.map((moment, index) => (
              <div key={index} className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-emerald-400">Chapter {moment.chapterNumber}</div>
                  <div className="text-lg font-bold text-emerald-400">{moment.engagementScore}/100</div>
                </div>
                <div className="text-sm text-zinc-300">{moment.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emotional Journey */}
      <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase tracking-wide">Emotional Journey</h3>
        <div className="space-y-4">
          {emotionalAnalysis.emotionalJourney.slice(-10).map((journey, index) => (
            <div key={index} className="bg-zinc-800/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-amber-400">Chapter {journey.chapterNumber}</span>
                <span className={`text-sm font-bold ${getScoreColor(journey.emotionalScore)}`}>
                  {journey.emotionalScore}/100
                </span>
              </div>
              {journey.primaryEmotions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {journey.primaryEmotions.map((emotion, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-300"
                    >
                      {emotion.emotion} ({emotion.intensity}/100)
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {engagementAnalysis.recommendations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase tracking-wide">Recommendations</h3>
          <ul className="space-y-2">
            {engagementAnalysis.recommendations.map((rec, index) => (
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

export default EngagementDashboard;
