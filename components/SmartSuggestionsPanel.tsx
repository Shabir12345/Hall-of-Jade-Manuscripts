import React, { useState, useEffect, useMemo } from 'react';
import { NovelState } from '../types';
import { ImprovementCategory } from '../types/improvement';
import { analyzeCategoryWeaknesses } from '../services/improvementStrategyGenerator';
import ConfidenceIndicator from './ConfidenceIndicator';

interface SmartSuggestionsPanelProps {
  novelState: NovelState;
  onImproveCategory: (category: ImprovementCategory) => void;
  onImproveAll?: () => void;
  compact?: boolean;
}

interface CategorySuggestion {
  category: ImprovementCategory;
  score: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  topIssues: string[];
  estimatedImprovement: number;
  confidence: 'high' | 'medium' | 'low';
  quickFix?: string;
}

const CATEGORIES: ImprovementCategory[] = [
  'structure',
  'engagement',
  'tension',
  'theme',
  'character',
  'prose',
  'originality',
  'voice',
  'literary_devices',
  'excellence',
];

/**
 * SmartSuggestionsPanel - Proactive suggestions for novel improvement
 */
const SmartSuggestionsPanel: React.FC<SmartSuggestionsPanelProps> = ({
  novelState,
  onImproveCategory,
  onImproveAll,
  compact = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Analyze all categories
  useEffect(() => {
    async function analyzeSuggestions() {
      setLoading(true);
      
      const results: CategorySuggestion[] = [];
      
      for (const category of CATEGORIES) {
        try {
          const analysis = analyzeCategoryWeaknesses(novelState, category);
          
          // Determine priority based on score
          let priority: 'critical' | 'high' | 'medium' | 'low';
          if (analysis.overallScore < 40) priority = 'critical';
          else if (analysis.overallScore < 55) priority = 'high';
          else if (analysis.overallScore < 70) priority = 'medium';
          else priority = 'low';
          
          // Determine confidence
          let confidence: 'high' | 'medium' | 'low';
          const issueCount = analysis.weaknesses.filter(w => w.severity === 'critical' || w.severity === 'high').length;
          if (issueCount > 3) confidence = 'high';
          else if (issueCount > 1) confidence = 'medium';
          else confidence = 'low';
          
          // Estimate improvement potential
          const estimatedImprovement = Math.min(30, Math.max(5, 100 - analysis.overallScore) * 0.4);
          
          // Get top issues
          const topIssues = analysis.weaknesses
            .sort((a, b) => {
              const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            })
            .slice(0, 3)
            .map(w => w.improvements?.[0] || w.description);
          
          // Quick fix suggestion
          const quickFix = analysis.recommendations?.[0] || 
            analysis.weaknesses?.[0]?.improvements?.[0] ||
            `Improve ${category} quality`;
          
          results.push({
            category,
            score: analysis.overallScore,
            priority,
            topIssues,
            estimatedImprovement: Math.round(estimatedImprovement),
            confidence,
            quickFix,
          });
        } catch (error) {
          console.warn(`Failed to analyze ${category}:`, error);
        }
      }
      
      // Sort by priority (critical first, then by score)
      results.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.score - b.score;
      });
      
      setSuggestions(results);
      setLoading(false);
    }
    
    analyzeSuggestions();
  }, [novelState]);

  // Get critical/high priority suggestions
  const prioritySuggestions = useMemo(() => {
    return suggestions.filter(s => s.priority === 'critical' || s.priority === 'high');
  }, [suggestions]);

  // Get overall health
  const overallHealth = useMemo(() => {
    if (suggestions.length === 0) return 0;
    return Math.round(suggestions.reduce((sum, s) => sum + s.score, 0) / suggestions.length);
  }, [suggestions]);

  const displaySuggestions = showAll ? suggestions : suggestions.slice(0, 5);

  const getCategoryIcon = (category: ImprovementCategory) => {
    const icons: Record<ImprovementCategory, string> = {
      structure: '🏗️',
      engagement: '🎯',
      tension: '⚡',
      theme: '🎨',
      character: '👤',
      literary_devices: '✨',
      excellence: '🌟',
      prose: '✍️',
      originality: '💡',
      voice: '🗣️',
      market_readiness: '📈',
    };
    return icons[category] || '📝';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'medium': return 'bg-yellow-600 text-black';
      case 'low': return 'bg-green-600 text-white';
      default: return 'bg-zinc-600 text-white';
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-zinc-400">Analyzing your novel...</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-amber-400">Smart Suggestions</h4>
          <span className="text-sm text-zinc-400">
            {prioritySuggestions.length} priority items
          </span>
        </div>
        
        {prioritySuggestions.length === 0 ? (
          <p className="text-green-400 text-sm">
            ✓ Your novel is in good shape! No critical issues found.
          </p>
        ) : (
          <div className="space-y-2">
            {prioritySuggestions.slice(0, 3).map(s => (
              <button
                key={s.category}
                onClick={() => onImproveCategory(s.category)}
                className="w-full flex items-center justify-between p-2 bg-zinc-700/50 hover:bg-zinc-700 rounded transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span>{getCategoryIcon(s.category)}</span>
                  <span className="text-white text-sm capitalize">
                    {s.category.replace('_', ' ')}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(s.priority)}`}>
                  {s.priority}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with overall health */}
      <div className="bg-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-amber-400">Smart Suggestions</h3>
            <p className="text-sm text-zinc-400 mt-1">
              AI-powered recommendations to improve your novel
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{overallHealth}/100</div>
            <div className="text-sm text-zinc-400">Overall Health</div>
          </div>
        </div>

        {/* Priority alert */}
        {prioritySuggestions.length > 0 && (
          <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-400 text-lg">⚠️</span>
              <span className="font-semibold text-orange-300">
                {prioritySuggestions.length} area{prioritySuggestions.length > 1 ? 's' : ''} need attention
              </span>
            </div>
            <p className="text-sm text-orange-200/80">
              Focus on these areas first for the biggest improvement in quality.
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex items-center gap-3">
          {prioritySuggestions.length > 0 && (
            <button
              onClick={() => onImproveCategory(prioritySuggestions[0].category)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
            >
              Fix Top Issue: {prioritySuggestions[0].category.replace('_', ' ')}
            </button>
          )}
          {onImproveAll && (
            <button
              onClick={onImproveAll}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              Improve All
            </button>
          )}
        </div>
      </div>

      {/* Suggestions list */}
      <div className="space-y-3">
        {displaySuggestions.map(suggestion => (
          <SuggestionCard
            key={suggestion.category}
            suggestion={suggestion}
            onImprove={() => onImproveCategory(suggestion.category)}
            getCategoryIcon={getCategoryIcon}
            getPriorityColor={getPriorityColor}
          />
        ))}
      </div>

      {/* Show more/less */}
      {suggestions.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-center text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {showAll ? '▲ Show Less' : `▼ Show ${suggestions.length - 5} More Categories`}
        </button>
      )}
    </div>
  );
};

/**
 * Individual suggestion card
 */
const SuggestionCard: React.FC<{
  suggestion: CategorySuggestion;
  onImprove: () => void;
  getCategoryIcon: (category: ImprovementCategory) => string;
  getPriorityColor: (priority: string) => string;
}> = ({ suggestion, onImprove, getCategoryIcon, getPriorityColor }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-zinc-800 rounded-lg overflow-hidden ${
      suggestion.priority === 'critical' ? 'ring-1 ring-red-500/50' : ''
    }`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getCategoryIcon(suggestion.category)}</span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-white capitalize">
                  {suggestion.category.replace('_', ' ')}
                </h4>
                <span className={`px-2 py-0.5 text-xs rounded ${getPriorityColor(suggestion.priority)}`}>
                  {suggestion.priority}
                </span>
                <ConfidenceIndicator confidence={suggestion.confidence} size="sm" showLabel={false} />
              </div>
              <div className="text-sm text-zinc-400">
                Score: {suggestion.score}/100 • Potential: +{suggestion.estimatedImprovement} points
              </div>
            </div>
          </div>
          
          <button
            onClick={onImprove}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Improve
          </button>
        </div>

        {/* Quick fix */}
        {suggestion.quickFix && (
          <div className="mt-3 p-2 bg-zinc-700/50 rounded text-sm text-zinc-300">
            💡 {suggestion.quickFix}
          </div>
        )}

        {/* Expand button */}
        {suggestion.topIssues.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300"
          >
            {expanded ? '▼ Hide Details' : '▶ Show Issues'}
          </button>
        )}
      </div>

      {/* Expanded issues */}
      {expanded && suggestion.topIssues.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-700">
          <h5 className="text-sm font-semibold text-zinc-400 mb-2">Top Issues</h5>
          <ul className="space-y-1">
            {suggestion.topIssues.map((issue, idx) => (
              <li key={idx} className="text-sm text-zinc-300 flex items-start gap-2">
                <span className="text-amber-400">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SmartSuggestionsPanel;
