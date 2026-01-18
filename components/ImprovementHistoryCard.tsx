import React, { useState, useCallback } from 'react';
import { ImprovementHistoryRecord, ImprovementCategory } from '../types/improvement';
import ImprovementEvaluationPanel from './ImprovementEvaluationPanel';
import ImprovementDiffView from './ImprovementDiffView';

// =====================================================
// TYPES
// =====================================================

interface ImprovementHistoryCardProps {
  record: ImprovementHistoryRecord;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onRollback: () => void;
  onRefresh: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const CATEGORY_CONFIG: Record<ImprovementCategory, { icon: string; color: string; bgColor: string }> = {
  structure: { icon: '🏛️', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  engagement: { icon: '📊', color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  tension: { icon: '⚡', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  theme: { icon: '🎭', color: 'text-pink-400', bgColor: 'bg-pink-500/10' },
  character: { icon: '🧠', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  literary_devices: { icon: '✨', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  excellence: { icon: '⭐', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  prose: { icon: '✍️', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  originality: { icon: '💡', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  voice: { icon: '🎤', color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
  market_readiness: { icon: '📈', color: 'text-lime-400', bgColor: 'bg-lime-500/10' },
};

// =====================================================
// MAIN COMPONENT
// =====================================================

const ImprovementHistoryCard: React.FC<ImprovementHistoryCardProps> = ({
  record,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onRollback,
  onRefresh,
}) => {
  const [showDiff, setShowDiff] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  
  const categoryConfig = CATEGORY_CONFIG[record.category] || { 
    icon: '📊', 
    color: 'text-zinc-400', 
    bgColor: 'bg-zinc-500/10' 
  };
  
  const formattedDate = new Date(record.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const handleCloseDiff = useCallback(() => {
    setShowDiff(false);
  }, []);
  
  const handleCloseEvaluation = useCallback(() => {
    setShowEvaluation(false);
  }, []);
  
  return (
    <>
      <div
        className={`bg-zinc-800/50 border rounded-xl overflow-hidden transition-all ${
          isSelected
            ? 'border-amber-500 shadow-lg shadow-amber-500/10'
            : 'border-zinc-700 hover:border-zinc-600'
        }`}
      >
        {/* Card Header */}
        <div
          className="p-4 cursor-pointer"
          onClick={onSelect}
        >
          <div className="flex items-start gap-4">
            {/* Category Icon */}
            <div className={`w-12 h-12 rounded-xl ${categoryConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
              <span className="text-2xl">{categoryConfig.icon}</span>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className={`text-lg font-semibold capitalize ${categoryConfig.color}`}>
                    {record.category.replace('_', ' ')}
                  </h3>
                  
                  {/* Status Badges */}
                  <div className="flex items-center gap-1">
                    {record.rolledBack && (
                      <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">
                        Rolled Back
                      </span>
                    )}
                    <EvaluationBadge status={record.evaluation} />
                  </div>
                </div>
                
                <span className="text-xs text-zinc-500">{formattedDate}</span>
              </div>
              
              {/* Score Display */}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Score:</span>
                  <span className="text-lg font-mono">
                    <span className="text-zinc-400">{record.result.scoreBefore}</span>
                    <span className="text-zinc-600 mx-2">→</span>
                    <span className="text-amber-400 font-bold">{record.result.scoreAfter}</span>
                  </span>
                  <span className={`text-sm font-semibold ${
                    record.result.scoreImprovement > 0 
                      ? 'text-green-400' 
                      : record.result.scoreImprovement < 0
                        ? 'text-red-400'
                        : 'text-zinc-400'
                  }`}>
                    ({record.result.scoreImprovement > 0 ? '+' : ''}{record.result.scoreImprovement})
                  </span>
                </div>
              </div>
              
              {/* Summary */}
              {record.result.summary && (
                <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                  {record.result.summary}
                </p>
              )}
              
              {/* Quick Stats */}
              <div className="flex items-center gap-4 mt-3">
                <StatPill label="Edited" value={record.result.chaptersEdited} icon="✏️" />
                <StatPill label="Inserted" value={record.result.chaptersInserted} icon="➕" />
                <StatPill label="Actions" value={record.result.actionsExecuted} icon="⚙️" />
                {record.result.actionsFailed > 0 && (
                  <StatPill 
                    label="Failed" 
                    value={record.result.actionsFailed} 
                    icon="⚠️" 
                    variant="error"
                  />
                )}
              </div>
            </div>
            
            {/* Expand Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-zinc-700">
            {/* Detailed Stats */}
            <div className="p-4 bg-zinc-900/50">
              <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-3">Execution Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DetailStat label="Actions Executed" value={record.result.actionsExecuted} />
                <DetailStat label="Actions Succeeded" value={record.result.actionsSucceeded} color="text-green-400" />
                <DetailStat label="Actions Failed" value={record.result.actionsFailed} color="text-red-400" />
                <DetailStat label="Chapters Regenerated" value={record.result.chaptersRegenerated} />
              </div>
            </div>
            
            {/* Strategy Info */}
            {record.strategy && (
              <div className="p-4 border-t border-zinc-700">
                <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Strategy</h4>
                <div className="space-y-2">
                  {record.strategy.description && (
                    <p className="text-sm text-zinc-300">{record.strategy.description}</p>
                  )}
                  {record.strategy.rationale && (
                    <p className="text-sm text-zinc-400 italic">{record.strategy.rationale}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-zinc-500">
                      Type: <span className="text-zinc-400">{record.strategy.strategyType}</span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      Priority: <PriorityBadge priority={record.strategy.priority} />
                    </span>
                    <span className="text-xs text-zinc-500">
                      Impact: <span className="text-zinc-400">{record.strategy.estimatedImpact}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Validation Results */}
            {record.result.validationResults && (
              <div className="p-4 border-t border-zinc-700">
                <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Validation</h4>
                <div className="flex items-center gap-4">
                  <ValidationIndicator 
                    label="Improvements Validated" 
                    passed={record.result.validationResults.improvementsValidated} 
                  />
                  <ValidationIndicator 
                    label="Score Improved" 
                    passed={record.result.validationResults.scoreImproved} 
                  />
                  <ValidationIndicator 
                    label="Goals Met" 
                    passed={record.result.validationResults.allGoalsMet} 
                  />
                </div>
                {record.result.validationResults.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-yellow-400">
                      Warnings: {record.result.validationResults.warnings.join('; ')}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Diff Summary */}
            {record.diffSnapshot && (
              <div className="p-4 border-t border-zinc-700">
                <h4 className="text-xs text-zinc-500 uppercase font-semibold mb-2">Changes Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <DetailStat 
                    label="Chapters Changed" 
                    value={record.diffSnapshot.summary.chaptersChanged} 
                  />
                  <DetailStat 
                    label="Additions" 
                    value={record.diffSnapshot.summary.totalAdditions} 
                    color="text-green-400"
                  />
                  <DetailStat 
                    label="Deletions" 
                    value={record.diffSnapshot.summary.totalDeletions} 
                    color="text-red-400"
                  />
                  <DetailStat 
                    label="Word Change" 
                    value={`${record.diffSnapshot.summary.netWordChange > 0 ? '+' : ''}${record.diffSnapshot.summary.netWordChange}`} 
                    color={record.diffSnapshot.summary.netWordChange >= 0 ? 'text-green-400' : 'text-red-400'}
                  />
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="p-4 border-t border-zinc-700 flex items-center gap-2 flex-wrap">
              {/* View Diff Button */}
              {record.fullBeforeState && record.fullAfterState && (
                <button
                  onClick={() => setShowDiff(true)}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg flex items-center gap-2"
                >
                  <span>📄</span>
                  View Diff
                </button>
              )}
              
              {/* Evaluate Button */}
              <button
                onClick={() => setShowEvaluation(true)}
                className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-sm rounded-lg flex items-center gap-2"
              >
                <span>✅</span>
                Evaluate
              </button>
              
              {/* Rollback Button */}
              {!record.rolledBack && record.fullBeforeState && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRollback();
                  }}
                  className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg flex items-center gap-2"
                >
                  <span>↩️</span>
                  Rollback
                </button>
              )}
              
              {/* Export Button */}
              <button
                onClick={() => {
                  const data = JSON.stringify(record, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `improvement-${record.id.slice(0, 8)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <span>📥</span>
                Export
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Diff Modal */}
      {showDiff && record.fullBeforeState && record.fullAfterState && (
        <ImprovementDiffView
          originalState={record.fullBeforeState}
          improvedState={record.fullAfterState}
          actionResults={record.result.actionResults}
          category={record.category}
          onClose={handleCloseDiff}
        />
      )}
      
      {/* Evaluation Modal */}
      {showEvaluation && (
        <ImprovementEvaluationPanel
          record={record}
          onClose={handleCloseEvaluation}
          onSave={() => {
            handleCloseEvaluation();
            onRefresh();
          }}
        />
      )}
    </>
  );
};

// =====================================================
// SUB-COMPONENTS
// =====================================================

interface StatPillProps {
  label: string;
  value: number;
  icon: string;
  variant?: 'default' | 'error';
}

const StatPill: React.FC<StatPillProps> = ({ label, value, icon, variant = 'default' }) => (
  <div className={`flex items-center gap-1.5 text-xs ${
    variant === 'error' ? 'text-red-400' : 'text-zinc-400'
  }`}>
    <span>{icon}</span>
    <span>{value}</span>
    <span className="text-zinc-500">{label}</span>
  </div>
);

interface DetailStatProps {
  label: string;
  value: string | number;
  color?: string;
}

const DetailStat: React.FC<DetailStatProps> = ({ label, value, color = 'text-white' }) => (
  <div>
    <div className="text-xs text-zinc-500">{label}</div>
    <div className={`text-lg font-semibold ${color}`}>{value}</div>
  </div>
);

interface EvaluationBadgeProps {
  status: string;
}

const EvaluationBadge: React.FC<EvaluationBadgeProps> = ({ status }) => {
  const config = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Pending Review' },
    approved: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Approved' },
    rejected: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Rejected' },
  }[status] || { bg: 'bg-zinc-700', text: 'text-zinc-400', label: status };
  
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

interface PriorityBadgeProps {
  priority: string;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const config = {
    critical: 'text-red-400',
    high: 'text-orange-400',
    medium: 'text-yellow-400',
    low: 'text-zinc-400',
  }[priority] || 'text-zinc-400';
  
  return <span className={config}>{priority}</span>;
};

interface ValidationIndicatorProps {
  label: string;
  passed: boolean;
}

const ValidationIndicator: React.FC<ValidationIndicatorProps> = ({ label, passed }) => (
  <div className="flex items-center gap-1.5">
    <span className={passed ? 'text-green-400' : 'text-red-400'}>
      {passed ? '✓' : '✗'}
    </span>
    <span className="text-xs text-zinc-400">{label}</span>
  </div>
);

export default ImprovementHistoryCard;
