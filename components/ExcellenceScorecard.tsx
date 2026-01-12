import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeStoryStructure } from '../services/storyStructureAnalyzer';
import { analyzeHeroJourney } from '../services/heroJourneyTracker';
import { analyzeSaveTheCat } from '../services/beatSheetAnalyzer';
import { analyzeThemeEvolution } from '../services/themeAnalyzer';
import { analyzeCharacterPsychology } from '../services/characterPsychologyService';
import { analyzeEngagement } from '../services/engagementAnalyzer';
import { analyzeProseQuality } from '../services/proseQualityService';
import { analyzeOriginality } from '../services/originalityDetector';
import { analyzeMarketReadiness } from '../services/marketReadinessService';
import { analyzeTension } from '../services/tensionAnalyzer';
import { analyzeLiteraryDevices } from '../services/literaryDeviceAnalyzer';
import { analyzeVoiceUniqueness } from '../services/voiceAnalysisService';

interface ExcellenceScorecardProps {
  novelState: NovelState;
}

const ExcellenceScorecard: React.FC<ExcellenceScorecardProps> = ({ novelState }) => {
  // Perform all analyses
  const structureAnalysis = useMemo(() => analyzeStoryStructure(novelState), [novelState]);
  const heroJourney = useMemo(() => analyzeHeroJourney(novelState), [novelState]);
  const beatSheet = useMemo(() => analyzeSaveTheCat(novelState), [novelState]);
  const themeAnalysis = useMemo(() => analyzeThemeEvolution(novelState), [novelState]);
  const characterAnalysis = useMemo(() => analyzeCharacterPsychology(novelState), [novelState]);
  const engagementAnalysis = useMemo(() => analyzeEngagement(novelState), [novelState]);
  const proseQuality = useMemo(() => analyzeProseQuality(novelState), [novelState]);
  const originality = useMemo(() => analyzeOriginality(novelState), [novelState]);
  const marketReadiness = useMemo(() => analyzeMarketReadiness(novelState), [novelState]);
  const tensionAnalysis = useMemo(() => analyzeTension(novelState), [novelState]);
  const literaryDevices = useMemo(() => analyzeLiteraryDevices(novelState), [novelState]);
  const voiceAnalysis = useMemo(() => analyzeVoiceUniqueness(novelState), [novelState]);

  // Calculate overall excellence score
  const overallScore = useMemo(() => {
    const scores = [
      structureAnalysis.overallStructureScore * 0.15,
      heroJourney.overallJourneyScore * 0.10,
      beatSheet.overallScore * 0.10,
      (themeAnalysis.overallConsistencyScore + themeAnalysis.philosophicalDepthScore) / 2 * 0.15,
      characterAnalysis.growthTrajectories.length > 0
        ? characterAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / characterAnalysis.growthTrajectories.length * 0.10
        : 50 * 0.10,
      engagementAnalysis.overallEngagementScore * 0.15,
      proseQuality.overallProseScore * 0.10,
      originality.overallOriginality * 0.10,
      marketReadiness.overallReadiness * 0.05,
    ];
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0));
  }, [
    structureAnalysis,
    heroJourney,
    beatSheet,
    themeAnalysis,
    characterAnalysis,
    engagementAnalysis,
    proseQuality,
    originality,
    marketReadiness,
  ]);

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Get score bg color
  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-600/20';
    if (score >= 70) return 'bg-amber-600/20';
    if (score >= 60) return 'bg-yellow-600/20';
    return 'bg-red-600/20';
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Excellence Scorecard
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Comprehensive quality metrics across all dimensions</p>
      </div>

      {/* Overall Excellence Score */}
      <div className="mb-8">
        <div className={`bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 ${getScoreBgColor(overallScore)} border-amber-500 rounded-xl p-8 text-center`}>
          <div className={`text-5xl font-fantasy font-bold mb-2 ${getScoreColor(overallScore)}`}>
            {overallScore}/100
          </div>
          <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Excellence</div>
          <div className="mt-4 text-sm text-zinc-500">
            {overallScore >= 80
              ? 'World-Class Quality - Publication Ready'
              : overallScore >= 70
              ? 'High Quality - Excellent Work'
              : overallScore >= 60
              ? 'Good Quality - Solid Foundation'
              : 'Developing - Focus on Key Areas'}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Structure Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Story Structure</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Three-Act Structure</span>
              <span className={`text-lg font-bold ${getScoreColor(structureAnalysis.overallStructureScore)}`}>
                {structureAnalysis.overallStructureScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Hero's Journey</span>
              <span className={`text-lg font-bold ${getScoreColor(heroJourney.overallJourneyScore)}`}>
                {heroJourney.overallJourneyScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Beat Sheet</span>
              <span className={`text-lg font-bold ${getScoreColor(beatSheet.overallScore)}`}>
                {beatSheet.overallScore}/100
              </span>
            </div>
          </div>
        </div>

        {/* Thematic Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Thematic Depth</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Consistency</span>
              <span className={`text-lg font-bold ${getScoreColor(themeAnalysis.overallConsistencyScore)}`}>
                {themeAnalysis.overallConsistencyScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Philosophical Depth</span>
              <span className={`text-lg font-bold ${getScoreColor(themeAnalysis.philosophicalDepthScore)}`}>
                {themeAnalysis.philosophicalDepthScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Primary Themes</span>
              <span className="text-sm text-amber-400">
                {themeAnalysis.primaryThemes.length}
              </span>
            </div>
          </div>
        </div>

        {/* Character Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Character Development</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Growth Trajectories</span>
              <span className="text-sm text-amber-400">
                {characterAnalysis.growthTrajectories.length} characters
              </span>
            </div>
            {characterAnalysis.growthTrajectories.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Avg Growth Score</span>
                <span className={`text-lg font-bold ${getScoreColor(
                  characterAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) /
                  characterAnalysis.growthTrajectories.length
                )}`}>
                  {Math.round(
                    characterAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) /
                    characterAnalysis.growthTrajectories.length
                  )}/100
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Engagement Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Reader Engagement</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Engagement</span>
              <span className={`text-lg font-bold ${getScoreColor(engagementAnalysis.overallEngagementScore)}`}>
                {engagementAnalysis.overallEngagementScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Peak Moments</span>
              <span className="text-sm text-amber-400">
                {engagementAnalysis.peakMoments.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Fatigue Chapters</span>
              <span className={`text-sm ${engagementAnalysis.fatigueChapters.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {engagementAnalysis.fatigueChapters.length}
              </span>
            </div>
          </div>
        </div>

        {/* Prose Quality Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Prose Quality</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Prose</span>
              <span className={`text-lg font-bold ${getScoreColor(proseQuality.overallProseScore)}`}>
                {proseQuality.overallProseScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Show vs Tell</span>
              <span className={`text-sm font-bold ${getScoreColor(proseQuality.showTellBalanceScore)}`}>
                {proseQuality.showTellBalanceScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Cliches Detected</span>
              <span className={`text-sm ${proseQuality.clichesDetected.length > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                {proseQuality.clichesDetected.length}
              </span>
            </div>
          </div>
        </div>

        {/* Originality Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Originality</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Originality</span>
              <span className={`text-lg font-bold ${getScoreColor(originality.overallOriginality)}`}>
                {originality.overallOriginality}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Unique Elements</span>
              <span className="text-sm text-amber-400">
                {originality.uniqueElements.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Common Tropes</span>
              <span className={`text-sm ${originality.commonTropesDetected.length > 10 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {originality.commonTropesDetected.length}
              </span>
            </div>
          </div>
        </div>

        {/* Market Readiness */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Market Readiness</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Readiness</span>
              <span className={`text-lg font-bold ${getScoreColor(marketReadiness.overallReadiness)}`}>
                {marketReadiness.overallReadiness}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Commercial Appeal</span>
              <span className={`text-sm font-bold ${getScoreColor(marketReadiness.commercialAppealScore)}`}>
                {marketReadiness.commercialAppealScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Literary Merit</span>
              <span className={`text-sm font-bold ${getScoreColor(marketReadiness.literaryMeritScore)}`}>
                {marketReadiness.literaryMeritScore}/100
              </span>
            </div>
          </div>
        </div>

        {/* Tension Scores */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Tension Management</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Tension</span>
              <span className={`text-lg font-bold ${getScoreColor(tensionAnalysis.overallTensionScore)}`}>
                {tensionAnalysis.overallTensionScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Tension Peaks</span>
              <span className="text-sm text-amber-400">
                {tensionAnalysis.tensionPeaks.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Release Balance</span>
              <span className={`text-sm font-bold ${getScoreColor(tensionAnalysis.tensionReleaseBalance)}`}>
                {tensionAnalysis.tensionReleaseBalance}/100
              </span>
            </div>
          </div>
        </div>

        {/* Literary Devices */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Literary Devices</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overall Device Score</span>
              <span className={`text-lg font-bold ${getScoreColor(literaryDevices.overallDeviceScore)}`}>
                {literaryDevices.overallDeviceScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Device Types</span>
              <span className="text-sm text-amber-400">
                {Object.keys(literaryDevices.deviceFrequency).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Overused Devices</span>
              <span className={`text-sm ${literaryDevices.overusedDevices.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {literaryDevices.overusedDevices.length}
              </span>
            </div>
          </div>
        </div>

        {/* Voice */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Voice & Style</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Novel Voice</span>
              <span className={`text-lg font-bold ${getScoreColor(voiceAnalysis.novelVoice.distinctivenessScore)}`}>
                {voiceAnalysis.novelVoice.distinctivenessScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Consistency</span>
              <span className={`text-sm font-bold ${getScoreColor(voiceAnalysis.novelVoice.consistencyScore)}`}>
                {voiceAnalysis.novelVoice.consistencyScore}/100
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Character Voices</span>
              <span className="text-sm text-amber-400">
                {voiceAnalysis.characterVoices.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-4">Priority Recommendations</h3>
        <div className="space-y-2">
          {marketReadiness.recommendations.slice(0, 5).map((rec, index) => (
            <div key={index} className="flex items-start text-sm text-zinc-300">
              <span className="text-amber-500 mr-2">•</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide mb-4">Strengths</h3>
          <div className="space-y-2">
            {marketReadiness.strengths.length > 0 ? (
              marketReadiness.strengths.slice(0, 5).map((strength, index) => (
                <div key={index} className="flex items-start text-sm text-emerald-300">
                  <span className="text-emerald-500 mr-2">✓</span>
                  <span>{strength}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">Continue building strengths across all dimensions</div>
            )}
          </div>
        </div>

        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-4">Areas for Improvement</h3>
          <div className="space-y-2">
            {marketReadiness.weaknesses.length > 0 ? (
              marketReadiness.weaknesses.slice(0, 5).map((weakness, index) => (
                <div key={index} className="flex items-start text-sm text-red-300">
                  <span className="text-red-500 mr-2">!</span>
                  <span>{weakness}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-zinc-500">No major weaknesses identified</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcellenceScorecard;
