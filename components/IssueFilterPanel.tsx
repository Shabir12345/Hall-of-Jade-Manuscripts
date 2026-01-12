import React, { useState, useCallback } from 'react';
import { IssueFilter, IssueSort, IssueSortOption, SortDirection } from '../utils/reportUtils';
import { IssueType, IssueSeverity } from '../types/editor';

interface IssueFilterPanelProps {
  filter: IssueFilter;
  sort: IssueSort;
  availableTypes: IssueType[];
  availableChapters: number[];
  onFilterChange: (filter: IssueFilter) => void;
  onSortChange: (sort: IssueSort) => void;
  onClearFilters: () => void;
}

const IssueFilterPanel: React.FC<IssueFilterPanelProps> = ({
  filter,
  sort,
  availableTypes,
  availableChapters,
  onFilterChange,
  onSortChange,
  onClearFilters,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleType = useCallback((type: IssueType) => {
    const currentTypes = filter.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    onFilterChange({ ...filter, types: newTypes.length > 0 ? newTypes : undefined });
  }, [filter, onFilterChange]);

  const toggleSeverity = useCallback((severity: IssueSeverity) => {
    const currentSeverities = filter.severities || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [...currentSeverities, severity];
    onFilterChange({ ...filter, severities: newSeverities.length > 0 ? newSeverities : undefined });
  }, [filter, onFilterChange]);

  const toggleChapter = useCallback((chapter: number) => {
    const currentChapters = filter.chapters || [];
    const newChapters = currentChapters.includes(chapter)
      ? currentChapters.filter(c => c !== chapter)
      : [...currentChapters, chapter];
    onFilterChange({ ...filter, chapters: newChapters.length > 0 ? newChapters : undefined });
  }, [filter, onFilterChange]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.trim();
    onFilterChange({ ...filter, searchQuery: query || undefined });
  }, [filter, onFilterChange]);

  const handleSortFieldChange = useCallback((field: IssueSortOption) => {
    onSortChange({ ...sort, field });
  }, [sort, onSortChange]);

  const handleSortDirectionChange = useCallback(() => {
    onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
  }, [sort, onSortChange]);

  const hasActiveFilters = Boolean(
    filter.types?.length ||
    filter.severities?.length ||
    filter.chapters?.length ||
    filter.searchQuery
  );

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-300">Filters & Sorting</h4>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search issues..."
          value={filter.searchQuery || ''}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {isExpanded && (
        <>
          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 whitespace-nowrap">Sort by:</label>
            <select
              value={sort.field}
              onChange={(e) => handleSortFieldChange(e.target.value as IssueSortOption)}
              className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
              title="Sort by field"
              aria-label="Sort by field"
            >
              <option value="severity">Severity</option>
              <option value="chapter">Chapter</option>
              <option value="type">Type</option>
            </select>
            <button
              onClick={handleSortDirectionChange}
              className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-200 text-xs hover:bg-zinc-800 transition-colors"
              title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sort.direction === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Severity:</label>
            <div className="flex gap-2">
              <button
                onClick={() => toggleSeverity('major')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  filter.severities?.includes('major')
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                Major
              </button>
              <button
                onClick={() => toggleSeverity('minor')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  filter.severities?.includes('minor')
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                Minor
              </button>
            </div>
          </div>

          {/* Type Filter */}
          {availableTypes.length > 0 && (
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Types:</label>
              <div className="flex flex-wrap gap-2">
                {availableTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      filter.types?.includes(type)
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Filter */}
          {availableChapters.length > 0 && (
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Chapters:</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {availableChapters.map(chapter => (
                  <button
                    key={chapter}
                    onClick={() => toggleChapter(chapter)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      filter.chapters?.includes(chapter)
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    Ch {chapter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IssueFilterPanel;
