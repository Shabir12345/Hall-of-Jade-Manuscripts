import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { NovelState } from '../types';
import { 
  ImprovementHistoryRecord, 
  ImprovementCategory, 
  HistoryFilters, 
  ImprovementStats,
  ScoreDataPoint,
  EvaluationStatus
} from '../types/improvement';
import { 
  getImprovementHistory, 
  computeImprovementStatistics,
  getScoreProgression,
  exportImprovementHistory,
  rollbackImprovement,
} from '../services/novelImprovementService';
import ImprovementHistoryCard from './ImprovementHistoryCard';
import ImprovementTimeline from './ImprovementTimeline';
import { EmptyState } from './EmptyState';
import { LoadingSpinnerCentered } from './LoadingSpinner';

// =====================================================
// TYPES
// =====================================================

type ViewMode = 'list' | 'timeline' | 'grid';

interface FilterState {
  categories: ImprovementCategory[];
  evaluationStatus: EvaluationStatus[];
  dateRange: { start: Date | null; end: Date | null };
  searchQuery: string;
  includeRolledBack: boolean;
}

// =====================================================
// CONSTANTS
// =====================================================

const CATEGORY_OPTIONS: { value: ImprovementCategory; label: string; icon: string }[] = [
  { value: 'structure', label: 'Structure', icon: '🏛️' },
  { value: 'engagement', label: 'Engagement', icon: '📊' },
  { value: 'tension', label: 'Tension', icon: '⚡' },
  { value: 'theme', label: 'Themes', icon: '🎭' },
  { value: 'character', label: 'Psychology', icon: '🧠' },
  { value: 'literary_devices', label: 'Devices', icon: '✨' },
  { value: 'excellence', label: 'Excellence', icon: '⭐' },
  { value: 'prose', label: 'Prose', icon: '✍️' },
  { value: 'originality', label: 'Originality', icon: '💡' },
  { value: 'voice', label: 'Voice', icon: '🎤' },
  { value: 'market_readiness', label: 'Market', icon: '📈' },
];

const EVALUATION_OPTIONS: { value: EvaluationStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-yellow-400' },
  { value: 'approved', label: 'Approved', color: 'text-green-400' },
  { value: 'rejected', label: 'Rejected', color: 'text-red-400' },
];

// =====================================================
// MAIN COMPONENT
// =====================================================

const ImprovementHistoryPage: React.FC = () => {
  const { activeNovel, updateActiveNovel } = useNovel();
  const { addToast } = useToast();
  
  // setNovel is used for rollback - wrap updateActiveNovel to accept NovelState directly
  const setNovel = useCallback((novelState: NovelState) => {
    updateActiveNovel(() => novelState);
  }, [updateActiveNovel]);
  
  // State
  const [records, setRecords] = useState<ImprovementHistoryRecord[]>([]);
  const [statistics, setStatistics] = useState<ImprovementStats | null>(null);
  const [scoreProgression, setScoreProgression] = useState<ScoreDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    evaluationStatus: [],
    dateRange: { start: null, end: null },
    searchQuery: '',
    includeRolledBack: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Load data
  const loadData = useCallback(async () => {
    if (!activeNovel?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const historyFilters: HistoryFilters = {
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        evaluationStatus: filters.evaluationStatus.length > 0 ? filters.evaluationStatus : undefined,
        startDate: filters.dateRange.start?.getTime(),
        endDate: filters.dateRange.end?.getTime(),
        searchQuery: filters.searchQuery || undefined,
        includeRolledBack: filters.includeRolledBack,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      };
      
      const [historyData, statsData, progressionData] = await Promise.all([
        getImprovementHistory(activeNovel.id, historyFilters),
        computeImprovementStatistics(activeNovel.id),
        getScoreProgression(activeNovel.id),
      ]);
      
      setRecords(historyData);
      setStatistics(statsData);
      setScoreProgression(progressionData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load improvement history';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeNovel?.id, filters, addToast]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  
  const handleSelectRecord = useCallback((id: string) => {
    setSelectedRecordId(prev => prev === id ? null : id);
  }, []);
  
  const handleRollback = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to rollback this improvement? This will restore the novel to its state before this improvement was applied.')) {
      return;
    }
    
    try {
      const originalState = await rollbackImprovement(id);
      if (originalState && setNovel) {
        setNovel(originalState);
        addToast('Improvement rolled back successfully', 'success');
        loadData(); // Refresh the list
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rollback improvement';
      addToast(errorMessage, 'error');
    }
  }, [setNovel, addToast, loadData]);
  
  const handleExport = useCallback(async () => {
    if (!activeNovel) return;
    
    try {
      const exportData = await exportImprovementHistory(activeNovel.id, activeNovel.title);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `improvement-history-${activeNovel.title.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('History exported successfully', 'success');
    } catch (err) {
      addToast('Failed to export history', 'error');
    }
  }, [activeNovel, addToast]);
  
  const handleFilterChange = useCallback((key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const handleClearFilters = useCallback(() => {
    setFilters({
      categories: [],
      evaluationStatus: [],
      dateRange: { start: null, end: null },
      searchQuery: '',
      includeRolledBack: false,
    });
  }, []);
  
  // Computed values
  const hasActiveFilters = useMemo(() => {
    return (
      filters.categories.length > 0 ||
      filters.evaluationStatus.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.searchQuery !== '' ||
      filters.includeRolledBack
    );
  }, [filters]);
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="p-6 h-full">
        <LoadingSpinnerCentered />
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading History</h2>
          <p className="text-red-300">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!activeNovel) {
    return (
      <div className="p-6">
        <EmptyState
          title="No Novel Selected"
          description="Select a novel from the library to view its improvement history."
          icon="📚"
        />
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">Improvement History</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Track and review all improvements made to "{activeNovel.title}"
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'list' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>
          
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <span>📥</span>
            Export
          </button>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${
              hasActiveFilters 
                ? 'bg-amber-600 text-white' 
                : 'bg-zinc-700 hover:bg-zinc-600 text-white'
            }`}
          >
            <span>🔍</span>
            Filters
            {hasActiveFilters && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">
                Active
              </span>
            )}
          </button>
        </div>
      </div>
      
      {/* Statistics Summary */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            label="Total Improvements"
            value={statistics.totalImprovements}
            icon="📊"
          />
          <StatCard
            label="Avg Score Gain"
            value={`+${statistics.avgScoreImprovement.toFixed(1)}`}
            icon="📈"
            valueColor="text-green-400"
          />
          <StatCard
            label="Chapters Edited"
            value={statistics.totalChaptersEdited}
            icon="✏️"
          />
          <StatCard
            label="Success Rate"
            value={`${(statistics.successRate * 100).toFixed(0)}%`}
            icon="✅"
            valueColor={statistics.successRate > 0.7 ? 'text-green-400' : 'text-yellow-400'}
          />
          <StatCard
            label="Approved"
            value={statistics.approvedCount}
            icon="👍"
            valueColor="text-green-400"
          />
          <StatCard
            label="Pending Review"
            value={statistics.pendingCount}
            icon="⏳"
            valueColor="text-yellow-400"
          />
        </div>
      )}
      
      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Search</label>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                placeholder="Search in summaries..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            
            {/* Categories */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Categories</label>
              <div className="flex flex-wrap gap-1">
                {CATEGORY_OPTIONS.slice(0, 6).map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => {
                      const newCategories = filters.categories.includes(cat.value)
                        ? filters.categories.filter(c => c !== cat.value)
                        : [...filters.categories, cat.value];
                      handleFilterChange('categories', newCategories);
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      filters.categories.includes(cat.value)
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Evaluation Status */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Status</label>
              <div className="flex gap-1">
                {EVALUATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const newStatus = filters.evaluationStatus.includes(opt.value)
                        ? filters.evaluationStatus.filter(s => s !== opt.value)
                        : [...filters.evaluationStatus, opt.value];
                      handleFilterChange('evaluationStatus', newStatus);
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      filters.evaluationStatus.includes(opt.value)
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Include Rolled Back */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Options</label>
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.includeRolledBack}
                  onChange={(e) => handleFilterChange('includeRolledBack', e.target.checked)}
                  className="rounded bg-zinc-700 border-zinc-600"
                />
                Show rolled back
              </label>
            </div>
          </div>
        </div>
      )}
      
      {/* Content */}
      {records.length === 0 ? (
        <EmptyState
          title="No Improvement History"
          description={
            hasActiveFilters
              ? "No improvements match your current filters. Try adjusting the filters."
              : "No improvements have been made to this novel yet. Use the 'Improve Novel' button in the Advanced Analysis pages to get started."
          }
          icon="📜"
        />
      ) : viewMode === 'timeline' ? (
        <ImprovementTimeline
          records={records}
          scoreProgression={scoreProgression}
          expandedIds={expandedIds}
          selectedId={selectedRecordId}
          onToggleExpand={handleToggleExpand}
          onSelect={handleSelectRecord}
          onRollback={handleRollback}
          onRefresh={loadData}
        />
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-4'}>
          {records.map(record => (
            <ImprovementHistoryCard
              key={record.id}
              record={record}
              isExpanded={expandedIds.has(record.id)}
              isSelected={selectedRecordId === record.id}
              onToggleExpand={() => handleToggleExpand(record.id)}
              onSelect={() => handleSelectRecord(record.id)}
              onRollback={() => handleRollback(record.id)}
              onRefresh={loadData}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================
// SUB-COMPONENTS
// =====================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  valueColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, valueColor = 'text-white' }) => (
  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">{icon}</span>
      <span className="text-xs text-zinc-500 uppercase">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
  </div>
);

export default ImprovementHistoryPage;
