import React, { useMemo } from 'react';
import { NovelState } from '../types';
import { analyzeStoryStructure } from '../services/storyStructureAnalyzer';
import { analyzeProseQuality } from '../services/proseQualityService';
import { analyzeOriginality } from '../services/originalityDetector';
import { analyzeVoiceUniqueness } from '../services/voiceAnalysisService';
import { analyzeEngagement } from '../services/engagementAnalyzer';
import { analyzeTension } from '../services/tensionAnalyzer';

interface QualityMetricsDashboardProps {
  novelState: NovelState;
  showDetails?: boolean;
  compact?: boolean;
}

interface QualityMetric {
  name: string;
  score: number;
  maxScore: number;
  category: string;
  description: string;
  subMetrics?: Array<{
    name: string;
    score: number;
    maxScore: number;
  }>;
  recommendations?: string[];
}

/**
 * QualityMetricsDashboard - Shows comprehensive quality metrics
 */
const QualityMetricsDashboard: React.FC<QualityMetricsDashboardProps> = ({
  novelState,
  showDetails = true,
  compact = false,
}) => {
  // Calculate all quality metrics
  const metrics = useMemo(() => {
    const metricsArray: QualityMetric[] = [];

    // Structure metrics
    try {
      const structure = analyzeStoryStructure(novelState);
      metricsArray.push({
        name: 'Story Structure',
        score: structure.overallStructureScore,
        maxScore: 100,
        category: 'structure',
        description: 'Three-act structure, story beats, and pacing',
        subMetrics: [
          {
            name: 'Act Proportions',
            score: Math.round(
              (100 - Math.abs(structure.threeActStructure.act1.percentage - 25) * 2 +
               100 - Math.abs(structure.threeActStructure.act2.percentage - 50) * 2 +
               100 - Math.abs(structure.threeActStructure.act3.percentage - 25) * 2) / 3
            ),
            maxScore: 100,
          },
          {
            name: 'Beat Detection',
            score: Math.round((structure.detectedBeats.length / 6) * 100),
            maxScore: 100,
          },
        ],
        recommendations: structure.recommendations.slice(0, 3),
      });
    } catch (e) {
      console.warn('Structure analysis failed:', e);
    }

    // Prose quality metrics
    try {
      const prose = analyzeProseQuality(novelState);
      metricsArray.push({
        name: 'Prose Quality',
        score: prose.overallProseScore,
        maxScore: 100,
        category: 'prose',
        description: 'Writing quality, sentence variety, and vocabulary',
        subMetrics: [
          { name: 'Sentence Variety', score: prose.sentenceVarietyScore, maxScore: 100 },
          { name: 'Vocabulary', score: prose.vocabularySophisticationScore, maxScore: 100 },
          { name: 'Show vs Tell', score: prose.showVsTellScore, maxScore: 100 },
          { name: 'Dialogue', score: prose.dialogueQualityScore, maxScore: 100 },
        ],
        recommendations: prose.recommendations?.slice(0, 3) || [],
      });
    } catch (e) {
      console.warn('Prose analysis failed:', e);
    }

    // Originality metrics
    try {
      const originality = analyzeOriginality(novelState);
      metricsArray.push({
        name: 'Originality',
        score: originality.overallOriginality,
        maxScore: 100,
        category: 'originality',
        description: 'Uniqueness and avoidance of clichés',
        subMetrics: [
          { name: 'Plot Originality', score: originality.plotOriginality || 70, maxScore: 100 },
          { name: 'Character Uniqueness', score: originality.characterOriginality || 70, maxScore: 100 },
          { name: 'Cliché Avoidance', score: Math.max(0, 100 - originality.commonTropesDetected.length * 5), maxScore: 100 },
        ],
        recommendations: originality.recommendations?.slice(0, 3) || [],
      });
    } catch (e) {
      console.warn('Originality analysis failed:', e);
    }

    // Voice uniqueness metrics
    try {
      const voice = analyzeVoiceUniqueness(novelState);
      metricsArray.push({
        name: 'Narrative Voice',
        score: voice.novelVoice.distinctivenessScore,
        maxScore: 100,
        category: 'voice',
        description: 'Unique narrative voice and author style',
        subMetrics: [
          { name: 'Distinctiveness', score: voice.novelVoice.distinctivenessScore, maxScore: 100 },
          { name: 'Consistency', score: voice.novelVoice.consistencyScore, maxScore: 100 },
        ],
        recommendations: voice.recommendations?.slice(0, 3) || [],
      });
    } catch (e) {
      console.warn('Voice analysis failed:', e);
    }

    // Engagement metrics
    try {
      const engagement = analyzeEngagement(novelState);
      metricsArray.push({
        name: 'Reader Engagement',
        score: engagement.overallEngagementScore,
        maxScore: 100,
        category: 'engagement',
        description: 'Hooks, intrigue, and page-turner elements',
        subMetrics: [
          { name: 'Hook Strength', score: engagement.chapterHooks?.averageScore || 70, maxScore: 100 },
          { name: 'Cliffhangers', score: engagement.cliffhangerScore || 70, maxScore: 100 },
          { name: 'Mystery Elements', score: engagement.mysteryScore || 70, maxScore: 100 },
        ],
        recommendations: engagement.recommendations?.slice(0, 3) || [],
      });
    } catch (e) {
      console.warn('Engagement analysis failed:', e);
    }

    // Tension metrics
    try {
      const tension = analyzeTension(novelState);
      metricsArray.push({
        name: 'Tension & Conflict',
        score: tension.overallTensionScore,
        maxScore: 100,
        category: 'tension',
        description: 'Conflict, stakes, and dramatic moments',
        subMetrics: [
          { name: 'Conflict Density', score: tension.conflictDensity || 70, maxScore: 100 },
          { name: 'Stakes Clarity', score: tension.stakesScore || 70, maxScore: 100 },
          { name: 'Tension Progression', score: tension.tensionArcScore || 70, maxScore: 100 },
        ],
        recommendations: tension.recommendations?.slice(0, 3) || [],
      });
    } catch (e) {
      console.warn('Tension analysis failed:', e);
    }

    return metricsArray;
  }, [novelState]);

  // Calculate overall score
  const overallScore = useMemo(() => {
    if (metrics.length === 0) return 0;
    return Math.round(
      metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length
    );
  }, [metrics]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    return 'F';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}
          </span>
          <span className="text-sm text-zinc-400">/100</span>
        </div>
        <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getScoreBarColor(overallScore)} transition-all`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <span className={`text-lg font-semibold ${getScoreColor(overallScore)}`}>
          {getScoreGrade(overallScore)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="bg-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400">Overall Quality Score</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Based on {metrics.length} quality dimensions
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}
              <span className="text-xl text-zinc-500">/100</span>
            </div>
            <div className={`text-lg font-semibold ${getScoreColor(overallScore)}`}>
              Grade: {getScoreGrade(overallScore)}
            </div>
          </div>
        </div>
        <div className="w-full h-3 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${getScoreBarColor(overallScore)} transition-all`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.category}
            metric={metric}
            showDetails={showDetails}
            getScoreColor={getScoreColor}
            getScoreBarColor={getScoreBarColor}
          />
        ))}
      </div>

      {/* Top Recommendations */}
      {showDetails && (
        <div className="bg-zinc-800 rounded-lg p-4">
          <h4 className="text-amber-400 font-semibold mb-3">Top Recommendations</h4>
          <div className="space-y-2">
            {metrics
              .filter(m => m.score < 70 && m.recommendations && m.recommendations.length > 0)
              .sort((a, b) => a.score - b.score)
              .slice(0, 5)
              .flatMap(m => m.recommendations?.slice(0, 1) || [])
              .map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-amber-400">•</span>
                  <span className="text-zinc-300">{rec}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Individual metric card
 */
const MetricCard: React.FC<{
  metric: QualityMetric;
  showDetails: boolean;
  getScoreColor: (score: number) => string;
  getScoreBarColor: (score: number) => string;
}> = ({ metric, showDetails, getScoreColor, getScoreBarColor }) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-white">{metric.name}</h4>
        <span className={`text-xl font-bold ${getScoreColor(metric.score)}`}>
          {metric.score}
        </span>
      </div>
      
      <p className="text-xs text-zinc-400 mb-3">{metric.description}</p>
      
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${getScoreBarColor(metric.score)} transition-all`}
          style={{ width: `${metric.score}%` }}
        />
      </div>

      {showDetails && metric.subMetrics && metric.subMetrics.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-amber-400 hover:text-amber-300 mt-2"
          >
            {expanded ? '▼ Hide details' : '▶ Show details'}
          </button>
          
          {expanded && (
            <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
              {metric.subMetrics.map((sub, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{sub.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreBarColor(sub.score)}`}
                        style={{ width: `${sub.score}%` }}
                      />
                    </div>
                    <span className={`text-xs ${getScoreColor(sub.score)}`}>
                      {sub.score}
                    </span>
                  </div>
                </div>
              ))}
              
              {metric.recommendations && metric.recommendations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-1">Suggestions:</p>
                  {metric.recommendations.slice(0, 2).map((rec, idx) => (
                    <p key={idx} className="text-xs text-zinc-400">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QualityMetricsDashboard;
