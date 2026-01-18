import React, { useMemo } from 'react';
import { ImprovementHistoryRecord, ScoreDataPoint, ImprovementCategory } from '../types/improvement';

// =====================================================
// TYPES
// =====================================================

interface ImprovementTimelineProps {
  records: ImprovementHistoryRecord[];
  scoreProgression: ScoreDataPoint[];
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRollback: (id: string) => void;
  onRefresh: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const CATEGORY_COLORS: Record<ImprovementCategory, string> = {
  structure: 'bg-blue-500',
  engagement: 'bg-purple-500',
  tension: 'bg-yellow-500',
  theme: 'bg-pink-500',
  character: 'bg-cyan-500',
  literary_devices: 'bg-indigo-500',
  excellence: 'bg-amber-500',
  prose: 'bg-emerald-500',
  originality: 'bg-orange-500',
  voice: 'bg-rose-500',
  market_readiness: 'bg-lime-500',
};

const CATEGORY_ICONS: Record<ImprovementCategory, string> = {
  structure: '🏛️',
  engagement: '📊',
  tension: '⚡',
  theme: '🎭',
  character: '🧠',
  literary_devices: '✨',
  excellence: '⭐',
  prose: '✍️',
  originality: '💡',
  voice: '🎤',
  market_readiness: '📈',
};

// =====================================================
// MAIN COMPONENT
// =====================================================

const ImprovementTimeline: React.FC<ImprovementTimelineProps> = ({
  records,
  scoreProgression,
  expandedIds,
  selectedId,
  onToggleExpand,
  onSelect,
  onRollback,
  onRefresh,
}) => {
  // Group records by date
  const groupedRecords = useMemo(() => {
    const groups: Record<string, ImprovementHistoryRecord[]> = {};
    
    records.forEach(record => {
      const date = new Date(record.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    
    return groups;
  }, [records]);
  
  // Calculate score chart data
  const chartData = useMemo(() => {
    if (scoreProgression.length === 0) return null;
    
    const maxScore = Math.max(...scoreProgression.map(d => Math.max(d.scoreBefore, d.scoreAfter)));
    const minScore = Math.min(...scoreProgression.map(d => Math.min(d.scoreBefore, d.scoreAfter)));
    const range = maxScore - minScore || 1;
    
    return {
      points: scoreProgression,
      maxScore,
      minScore,
      range,
    };
  }, [scoreProgression]);
  
  return (
    <div className="space-y-6">
      {/* Score Progression Chart */}
      {chartData && chartData.points.length > 1 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase mb-4">Score Progression</h3>
          <div className="h-48 relative">
            <ScoreProgressionChart data={chartData} />
          </div>
          <div className="flex justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-500"></div>
              <span className="text-xs text-zinc-400">Before</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-xs text-zinc-400">After</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-700"></div>
        
        {Object.entries(groupedRecords).map(([date, dayRecords]) => (
          <div key={date} className="mb-8">
            {/* Date Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-600 flex items-center justify-center z-10">
                <span className="text-lg">📅</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{date}</h3>
              <span className="text-sm text-zinc-500">
                {dayRecords.length} improvement{dayRecords.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {/* Day's Records */}
            <div className="ml-6 pl-10 border-l-2 border-zinc-700 space-y-4">
              {dayRecords.map((record, index) => (
                <TimelineEntry
                  key={record.id}
                  record={record}
                  isExpanded={expandedIds.has(record.id)}
                  isSelected={selectedId === record.id}
                  onToggleExpand={() => onToggleExpand(record.id)}
                  onSelect={() => onSelect(record.id)}
                  onRollback={() => onRollback(record.id)}
                  isLast={index === dayRecords.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =====================================================
// SUB-COMPONENTS
// =====================================================

interface TimelineEntryProps {
  record: ImprovementHistoryRecord;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onRollback: () => void;
  isLast: boolean;
}

const TimelineEntry: React.FC<TimelineEntryProps> = ({
  record,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onRollback,
  isLast,
}) => {
  const time = new Date(record.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const categoryColor = CATEGORY_COLORS[record.category] || 'bg-zinc-500';
  const categoryIcon = CATEGORY_ICONS[record.category] || '📊';
  
  return (
    <div className="relative">
      {/* Connector dot */}
      <div className={`absolute -left-[46px] top-4 w-4 h-4 rounded-full ${categoryColor} border-2 border-zinc-900 z-10`}></div>
      
      {/* Card */}
      <div
        className={`bg-zinc-800/50 border rounded-xl overflow-hidden transition-all ${
          isSelected 
            ? 'border-amber-500 shadow-lg shadow-amber-500/10' 
            : 'border-zinc-700 hover:border-zinc-600'
        }`}
      >
        {/* Header */}
        <div
          className="p-4 cursor-pointer"
          onClick={onSelect}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white capitalize">
                    {record.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-zinc-500">{time}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {/* Score Badge */}
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    record.result.scoreImprovement > 0 
                      ? 'bg-green-900/50 text-green-400' 
                      : record.result.scoreImprovement < 0
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {record.result.scoreImprovement > 0 ? '+' : ''}
                    {record.result.scoreImprovement} pts
                  </span>
                  
                  {/* Chapters Badge */}
                  {record.result.chaptersEdited > 0 && (
                    <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                      {record.result.chaptersEdited} chapters
                    </span>
                  )}
                  
                  {/* Evaluation Badge */}
                  <EvaluationBadge status={record.evaluation} />
                  
                  {/* Rolled Back Badge */}
                  {record.rolledBack && (
                    <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">
                      Rolled Back
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Score display */}
              <div className="text-right">
                <div className="text-xs text-zinc-500">Score</div>
                <div className="text-sm font-mono">
                  <span className="text-zinc-400">{record.result.scoreBefore}</span>
                  <span className="text-zinc-600 mx-1">→</span>
                  <span className="text-amber-400">{record.result.scoreAfter}</span>
                </div>
              </div>
              
              {/* Expand button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
              >
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
            </div>
          </div>
          
          {/* Summary */}
          {record.result.summary && (
            <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
              {record.result.summary}
            </p>
          )}
        </div>
        
        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 pt-0 border-t border-zinc-700">
            {/* Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-xs text-zinc-500">Actions Executed</div>
                <div className="text-sm text-white">{record.result.actionsExecuted}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Actions Succeeded</div>
                <div className="text-sm text-green-400">{record.result.actionsSucceeded}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Actions Failed</div>
                <div className="text-sm text-red-400">{record.result.actionsFailed}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Chapters Inserted</div>
                <div className="text-sm text-white">{record.result.chaptersInserted}</div>
              </div>
            </div>
            
            {/* Strategy Info */}
            {record.strategy?.description && (
              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1">Strategy</div>
                <p className="text-sm text-zinc-300">{record.strategy.description}</p>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Open diff viewer
                }}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded"
              >
                View Diff
              </button>
              
              {!record.rolledBack && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRollback();
                  }}
                  className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-400 text-sm rounded"
                >
                  Rollback
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface EvaluationBadgeProps {
  status: string;
}

const EvaluationBadge: React.FC<EvaluationBadgeProps> = ({ status }) => {
  const config = {
    pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Pending' },
    approved: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Approved' },
    rejected: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Rejected' },
  }[status] || { bg: 'bg-zinc-700', text: 'text-zinc-400', label: status };
  
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

interface ScoreProgressionChartProps {
  data: {
    points: ScoreDataPoint[];
    maxScore: number;
    minScore: number;
    range: number;
  };
}

const ScoreProgressionChart: React.FC<ScoreProgressionChartProps> = ({ data }) => {
  const { points, maxScore, minScore, range } = data;
  
  // Calculate SVG dimensions
  const width = 100;
  const height = 100;
  const padding = 10;
  
  // Generate path points
  const getY = (score: number) => {
    return height - padding - ((score - minScore) / range) * (height - 2 * padding);
  };
  
  const getX = (index: number) => {
    return padding + (index / (points.length - 1)) * (width - 2 * padding);
  };
  
  // Generate paths
  const beforePath = points.map((p, i) => {
    const x = getX(i);
    const y = getY(p.scoreBefore);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
  
  const afterPath = points.map((p, i) => {
    const x = getX(i);
    const y = getY(p.scoreAfter);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
  
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = height - padding - (pct / 100) * (height - 2 * padding);
        return (
          <g key={pct}>
            <line
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="2 2"
              className="text-zinc-500"
            />
            <text
              x={padding - 2}
              y={y + 2}
              fontSize="3"
              fill="currentColor"
              textAnchor="end"
              className="text-zinc-500"
            >
              {Math.round(minScore + (pct / 100) * range)}
            </text>
          </g>
        );
      })}
      
      {/* Before line (gray) */}
      <path
        d={beforePath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity={0.5}
        className="text-zinc-500"
      />
      
      {/* After line (amber) */}
      <path
        d={afterPath}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-amber-500"
      />
      
      {/* Data points */}
      {points.map((p, i) => {
        const x = getX(i);
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={getY(p.scoreBefore)}
              r="1.5"
              fill="currentColor"
              className="text-zinc-500"
            />
            <circle
              cx={x}
              cy={getY(p.scoreAfter)}
              r="2"
              fill="currentColor"
              className="text-amber-500"
            />
          </g>
        );
      })}
    </svg>
  );
};

export default ImprovementTimeline;
