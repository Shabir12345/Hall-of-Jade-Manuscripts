import React, { useState, useCallback, useMemo, useRef } from 'react';
import { StoryThread, NovelState, ThreadStatus, ThreadPriority, StoryThreadType } from '../types';
import { useStoryThreadManagement } from '../hooks/useStoryThreadManagement';
import { useNovel } from '../contexts/NovelContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '../contexts/NavigationContext';
import { analyzeThreadHealth, detectPlotHoles, suggestThreadPacing } from '../services/threadAnalyzer';
import { calculateThreadHealth } from '../services/storyThreadService';
import ConfirmDialog from './ConfirmDialog';
import { EntityLink } from './EntityLink';
import ThreadTimeline from './ThreadTimeline';
import { threadTemplates, createThreadFromTemplate } from '../utils/threadTemplates';

interface StoryThreadsViewProps {
  novelState: NovelState;
}

const StoryThreadsView: React.FC<StoryThreadsViewProps> = ({ novelState }) => {
  const { updateActiveNovel } = useNovel();
  const { showSuccess, showError } = useToast();
  const { navigate } = useNavigation();
  const [selectedThread, setSelectedThread] = useState<StoryThread | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; threadId: string | null }>({ 
    isOpen: false, 
    threadId: null 
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const pendingDeleteRef = useRef<(() => void) | null>(null);

  const handleConfirmDelete = useCallback((config: { title: string; message: string; onConfirm: () => void; variant?: string }) => {
    if (config.variant === 'danger') {
      // Store the delete function to call when confirmed
      pendingDeleteRef.current = config.onConfirm;
      setConfirmDelete({ 
        isOpen: true, 
        threadId: selectedThread?.id || null 
      });
    }
  }, [selectedThread]);

  const {
    editingThread,
    setEditingThread,
    handleSaveThread,
    handleDeleteThread,
    handleCreateThread,
    handleResolveThread,
    handleUpdateThreadStatus,
    handleUpdateThreadPriority,
    filteredThreads,
    setFilterType,
    setFilterStatus,
    setFilterPriority,
    setSearchQuery,
    setFilterChapterRange,
    setFilterHealthRange,
    setFilterRelatedEntity,
    filterType,
    filterStatus,
    filterPriority,
    searchQuery,
    filterChapterRange,
    filterHealthRange,
    filterRelatedEntity,
  } = useStoryThreadManagement(
    novelState,
    updateActiveNovel,
    handleConfirmDelete,
    showSuccess,
    showError
  );

  const currentChapter = novelState.chapters.length;

  // Thread analytics
  const analytics = useMemo(() => {
    return analyzeThreadHealth(novelState.storyThreads || [], currentChapter);
  }, [novelState.storyThreads, currentChapter]);

  const plotHoles = useMemo(() => {
    return detectPlotHoles(novelState.storyThreads || [], currentChapter);
  }, [novelState.storyThreads, currentChapter]);

  const pacingSuggestions = useMemo(() => {
    return suggestThreadPacing(novelState.storyThreads || [], currentChapter);
  }, [novelState.storyThreads, currentChapter]);

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const handleCreateNew = useCallback(() => {
    try {
      const newThread = handleCreateThread();
      setEditingThread(newThread);
      setShowCreateDialog(true);
    } catch (error) {
      showError('Failed to create thread');
    }
  }, [handleCreateThread, setEditingThread, showError]);

  const handleCreateFromTemplate = useCallback((templateId: string) => {
    try {
      const template = threadTemplates.find(t => t.id === templateId);
      if (!template) {
        showError('Template not found');
        return;
      }
      const newThread = createThreadFromTemplate(template, novelState.id, currentChapter);
      setEditingThread(newThread);
      setShowCreateDialog(true);
      setShowTemplateDialog(false);
    } catch (error) {
      showError('Failed to create thread from template');
    }
  }, [novelState.id, currentChapter, setEditingThread, showError]);

  const handleSave = useCallback((thread: StoryThread) => {
    handleSaveThread(thread);
    setShowCreateDialog(false);
    setEditingThread(null);
  }, [handleSaveThread]);

  const handleDelete = useCallback((threadId: string) => {
    if (pendingDeleteRef.current) {
      pendingDeleteRef.current();
      pendingDeleteRef.current = null;
    }
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
    setConfirmDelete({ isOpen: false, threadId: null });
  }, [selectedThread]);

  const getStatusColor = (status: ThreadStatus) => {
    switch (status) {
      case 'active': return 'text-emerald-400';
      case 'paused': return 'text-amber-400';
      case 'resolved': return 'text-zinc-400';
      case 'abandoned': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  const getPriorityColor = (priority: ThreadPriority) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-zinc-400';
      default: return 'text-zinc-400';
    }
  };

  const getTypeIcon = (type: StoryThreadType) => {
    switch (type) {
      case 'enemy': return '⚔️';
      case 'technique': return '✨';
      case 'item': return '💎';
      case 'location': return '📍';
      case 'sect': return '🏛️';
      case 'promise': return '🤝';
      case 'mystery': return '🔍';
      case 'relationship': return '💕';
      case 'power': return '⚡';
      case 'quest': return '🗺️';
      case 'revelation': return '💡';
      case 'conflict': return '🔥';
      case 'alliance': return '🤝';
      default: return '🧵';
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-500 mb-2">Story Threads</h1>
              <p className="text-sm text-zinc-400">Track narrative threads to prevent plot holes</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBulkMode(!bulkMode);
                  if (bulkMode) {
                    setSelectedThreadIds(new Set());
                    setShowBulkActions(false);
                  }
                }}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  bulkMode
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                }`}
              >
                {bulkMode ? 'Cancel Selection' : 'Bulk Select'}
              </button>
              <div className="relative">
                <button
                  onClick={() => {
                    const threadsToExport = filteredThreads.length > 0 && selectedThreadIds.size > 0
                      ? filteredThreads.filter(t => selectedThreadIds.has(t.id))
                      : filteredThreads;
                    
                    // Export as JSON
                    const dataStr = JSON.stringify(threadsToExport, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `story-threads-${Date.now()}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                    showSuccess(`Exported ${threadsToExport.length} thread${threadsToExport.length !== 1 ? 's' : ''}`);
                  }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg font-semibold transition-colors"
                >
                  Export
                </button>
              </div>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        try {
                          const imported = JSON.parse(event.target?.result as string) as StoryThread[];
                          if (Array.isArray(imported)) {
                            imported.forEach(thread => {
                              // Generate new IDs for imported threads to avoid conflicts
                              const newThread = {
                                ...thread,
                                id: thread.id + '_imported_' + Date.now(),
                                novelId: novelState.id,
                              };
                              handleSaveThread(newThread);
                            });
                            showSuccess(`Imported ${imported.length} thread${imported.length !== 1 ? 's' : ''}`);
                          } else {
                            showError('Invalid file format');
                          }
                        } catch (error) {
                          showError('Failed to parse JSON file');
                        }
                      };
                      reader.readAsText(file);
                    }
                  };
                  input.click();
                }}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg font-semibold transition-colors"
              >
                Import
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowTemplateDialog(true)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
                >
                  + New Thread ▼
                </button>
                {showTemplateDialog && (
                  <div className="absolute right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 min-w-[300px] max-h-[400px] overflow-y-auto">
                    <div className="p-2">
                      <div className="text-xs text-zinc-400 uppercase mb-2 px-2">Create from Template</div>
                      <button
                        onClick={handleCreateNew}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 rounded transition-colors mb-1"
                      >
                        + Blank Thread
                      </button>
                      <div className="border-t border-zinc-700 my-2" />
                      {threadTemplates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => handleCreateFromTemplate(template.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-700 rounded transition-colors mb-1"
                        >
                          <div className="font-semibold text-amber-400">{template.name}</div>
                          <div className="text-xs text-zinc-400 mt-1">{template.description}</div>
                          <div className="text-xs text-zinc-500 mt-1 italic">{template.pacingGuidelines}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {bulkMode && selectedThreadIds.size > 0 && (
            <div className="mt-4 p-4 bg-amber-600/20 border border-amber-600/50 rounded-lg flex items-center justify-between">
              <div className="text-sm text-amber-400 font-semibold">
                {selectedThreadIds.size} thread{selectedThreadIds.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-semibold transition-colors"
                >
                  Actions ▼
                </button>
                {showBulkActions && (
                  <div className="absolute right-6 mt-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 min-w-[200px]">
                    <div className="p-2">
                      <div className="text-xs text-zinc-400 uppercase mb-2 px-2">Change Status</div>
                      {(['active', 'paused', 'resolved', 'abandoned'] as ThreadStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => {
                            selectedThreadIds.forEach(id => {
                              handleUpdateThreadStatus(id, status);
                            });
                            setSelectedThreadIds(new Set());
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                        >
                          Set to {status}
                        </button>
                      ))}
                      <div className="border-t border-zinc-700 my-2" />
                      <div className="text-xs text-zinc-400 uppercase mb-2 px-2">Change Priority</div>
                      {(['critical', 'high', 'medium', 'low'] as ThreadPriority[]).map(priority => (
                        <button
                          key={priority}
                          onClick={() => {
                            selectedThreadIds.forEach(id => {
                              handleUpdateThreadPriority(id, priority);
                            });
                            setSelectedThreadIds(new Set());
                            setShowBulkActions(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 rounded transition-colors"
                        >
                          Set to {priority}
                        </button>
                      ))}
                      <div className="border-t border-zinc-700 my-2" />
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete ${selectedThreadIds.size} thread${selectedThreadIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
                            selectedThreadIds.forEach(id => {
                              handleDeleteThread(id);
                            });
                            setSelectedThreadIds(new Set());
                            setShowBulkActions(false);
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/20 rounded transition-colors"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search threads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
              </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as StoryThreadType | 'all')}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
              aria-label="Filter by thread type"
            >
              <option value="all">All Types</option>
              <option value="enemy">⚔️ Enemy</option>
              <option value="technique">✨ Technique</option>
              <option value="item">💎 Item</option>
              <option value="location">📍 Location</option>
              <option value="sect">🏛️ Sect</option>
              <option value="promise">🤝 Promise</option>
              <option value="mystery">🔍 Mystery</option>
              <option value="relationship">💕 Relationship</option>
              <option value="power">⚡ Power</option>
              <option value="quest">🗺️ Quest</option>
              <option value="revelation">💡 Revelation</option>
              <option value="conflict">🔥 Conflict</option>
              <option value="alliance">🤝 Alliance</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ThreadStatus | 'all')}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
              aria-label="Filter by thread status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="resolved">Resolved</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as ThreadPriority | 'all')}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
              aria-label="Filter by thread priority"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            </div>
            
            {/* Advanced Filters */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-xs">Chapter Range:</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filterChapterRange.min || ''}
                  onChange={(e) => setFilterChapterRange({
                    ...filterChapterRange,
                    min: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
                <span className="text-zinc-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filterChapterRange.max || ''}
                  onChange={(e) => setFilterChapterRange({
                    ...filterChapterRange,
                    max: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-xs">Health Score:</label>
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="100"
                  value={filterHealthRange.min || ''}
                  onChange={(e) => setFilterHealthRange({
                    ...filterHealthRange,
                    min: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
                <span className="text-zinc-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="100"
                  value={filterHealthRange.max || ''}
                  onChange={(e) => setFilterHealthRange({
                    ...filterHealthRange,
                    max: e.target.value ? parseInt(e.target.value) : null
                  })}
                  className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-zinc-400 text-xs">Related Entity:</label>
                <input
                  type="text"
                  placeholder="Entity type..."
                  value={filterRelatedEntity}
                  onChange={(e) => setFilterRelatedEntity(e.target.value)}
                  className="w-32 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
              </div>
              {(filterChapterRange.min !== null || filterChapterRange.max !== null || 
                filterHealthRange.min !== null || filterHealthRange.max !== null || 
                filterRelatedEntity.trim()) && (
                <button
                  onClick={() => {
                    setFilterChapterRange({ min: null, max: null });
                    setFilterHealthRange({ min: null, max: null });
                    setFilterRelatedEntity('');
                  }}
                  className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
                >
                  Clear Advanced
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Thread List */}
          <div className="w-1/3 border-r border-zinc-700 overflow-y-auto">
            {/* Analytics Summary */}
            <div className="p-4 bg-zinc-900 border-b border-zinc-700">
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Total Threads</div>
                  <div className="text-xl font-bold text-zinc-200">{filteredThreads.length}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Health Score</div>
                  <div className="text-xl font-bold text-amber-500">{analytics.overallHealth}/100</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Resolution Rate</div>
                  <div className="text-lg font-semibold text-emerald-400">{analytics.resolutionRate}%</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Thread Density</div>
                  <div className="text-lg font-semibold text-blue-400">{analytics.threadDensity}/chapter</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Active</div>
                  <div className="text-lg font-semibold text-emerald-400">{analytics.healthyThreads}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs uppercase mb-1">Plot Holes</div>
                  <div className="text-lg font-semibold text-red-400">{plotHoles.length}</div>
                </div>
              </div>
              
              {/* Completion Forecast */}
              {analytics.completionForecast.threadsNeedingResolution > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="text-zinc-500 text-xs uppercase mb-2">Completion Forecast</div>
                  <div className="text-sm text-zinc-300 space-y-1">
                    <div>
                      <span className="text-zinc-400">{analytics.completionForecast.threadsNeedingResolution}</span> threads need resolution
                    </div>
                    {analytics.completionForecast.estimatedChaptersToComplete > 0 && (
                      <div>
                        Estimated: <span className="text-amber-400 font-semibold">{analytics.completionForecast.estimatedChaptersToComplete}</span> chapters to complete
                      </div>
                    )}
                    {analytics.completionForecast.averageChaptersPerResolution > 0 && (
                      <div className="text-xs text-zinc-500">
                        Avg: {analytics.completionForecast.averageChaptersPerResolution} chapters per resolution
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Threads by Type */}
              {Object.keys(analytics.threadsByType).length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <div className="text-zinc-500 text-xs uppercase mb-2">Threads by Type</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(analytics.threadsByType).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded text-xs">
                        <span>{getTypeIcon(type as StoryThreadType)}</span>
                        <span className="text-zinc-300">{type}</span>
                        <span className="text-zinc-500">({count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Critical Issues Banner */}
            {(plotHoles.filter(h => h.severity === 'critical').length > 0 || 
              pacingSuggestions.filter(s => s.urgency === 'high').length > 0) && (
              <div className="p-4 bg-red-950/20 border-b border-red-500/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="text-sm font-bold text-red-400 uppercase">Critical Issues</h3>
                </div>
                <div className="space-y-1 text-xs text-zinc-300">
                  {plotHoles.filter(h => h.severity === 'critical').slice(0, 2).map((hole, idx) => (
                    <p key={idx}>• {hole.thread.title}</p>
                  ))}
                  {pacingSuggestions.filter(s => s.urgency === 'high').slice(0, 2).map((sug, idx) => (
                    <p key={idx}>• {sug.thread.title}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Thread List */}
            <div className="p-4 space-y-2">
              {bulkMode && filteredThreads.length > 0 && (
                <div className="mb-4 flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <button
                    onClick={() => {
                      if (selectedThreadIds.size === filteredThreads.length) {
                        setSelectedThreadIds(new Set());
                      } else {
                        setSelectedThreadIds(new Set(filteredThreads.map(t => t.id)));
                      }
                    }}
                    className="text-sm text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    {selectedThreadIds.size === filteredThreads.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-zinc-400">
                    {selectedThreadIds.size} of {filteredThreads.length} selected
                  </span>
                </div>
              )}
              {filteredThreads.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p className="mb-2">No threads found</p>
                  <p className="text-sm">Create a new thread or adjust filters</p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const health = calculateThreadHealth(thread, currentChapter);
                  const isStale = currentChapter - thread.lastUpdatedChapter > 10;
                  const isSelected = selectedThreadIds.has(thread.id);
                  
                  return (
                    <div
                      key={thread.id}
                      onClick={() => {
                        if (bulkMode) {
                          setSelectedThreadIds(prev => {
                            const next = new Set(prev);
                            if (next.has(thread.id)) {
                              next.delete(thread.id);
                            } else {
                              next.add(thread.id);
                            }
                            return next;
                          });
                        } else {
                          setSelectedThread(thread);
                        }
                      }}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        bulkMode && isSelected
                          ? 'bg-amber-600/30 border-amber-600'
                          : selectedThread?.id === thread.id && !bulkMode
                          ? 'bg-amber-600/20 border-amber-600/50'
                          : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {bulkMode && (
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedThreadIds(prev => {
                                const next = new Set(prev);
                                if (next.has(thread.id)) {
                                  next.delete(thread.id);
                                } else {
                                  next.add(thread.id);
                                }
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-amber-600 bg-zinc-700 border-zinc-600 rounded focus:ring-amber-500"
                            aria-label={`Select thread ${thread.title}`}
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getTypeIcon(thread.type)}</span>
                          <h3 className="font-semibold text-zinc-200">{thread.title}</h3>
                        </div>
                        <span className={`text-xs font-bold ${getStatusColor(thread.status)}`}>
                          {thread.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mb-2">
                        <span className={getPriorityColor(thread.priority)}>{thread.priority}</span>
                        <span>•</span>
                        <span>Ch {thread.introducedChapter}</span>
                        {thread.lastUpdatedChapter !== thread.introducedChapter && (
                          <>
                            <span>•</span>
                            <span>Updated Ch {thread.lastUpdatedChapter}</span>
                          </>
                        )}
                        {thread.resolvedChapter && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">Resolved Ch {thread.resolvedChapter}</span>
                          </>
                        )}
                      </div>
                      {thread.description && (
                        <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{thread.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                health >= 70 ? 'bg-emerald-500' : health >= 40 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${health}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{health}%</span>
                        </div>
                        {isStale && (
                          <span className="text-xs text-red-400 font-semibold">⚠️ Stale</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread Detail Panel */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedThread ? (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getTypeIcon(selectedThread.type)}</span>
                        <h2 className="text-2xl font-bold text-amber-500">{selectedThread.title}</h2>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400 flex-wrap">
                        <span className={getStatusColor(selectedThread.status)}>{selectedThread.status}</span>
                        <span className={getPriorityColor(selectedThread.priority)}>{selectedThread.priority}</span>
                        {(() => {
                          const introChapter = novelState.chapters.find(c => c.number === selectedThread.introducedChapter);
                          return introChapter ? (
                            <EntityLink
                              type="chapter"
                              id={introChapter.id}
                              className="hover:text-amber-400 hover:underline"
                              title={`View Chapter ${selectedThread.introducedChapter}: ${introChapter.title}`}
                            >
                              Introduced: Chapter {selectedThread.introducedChapter}
                            </EntityLink>
                          ) : (
                            <span>Introduced: Chapter {selectedThread.introducedChapter}</span>
                          );
                        })()}
                        {(() => {
                          const lastChapter = novelState.chapters.find(c => c.number === selectedThread.lastUpdatedChapter);
                          return lastChapter ? (
                            <EntityLink
                              type="chapter"
                              id={lastChapter.id}
                              className="hover:text-amber-400 hover:underline"
                              title={`View Chapter ${selectedThread.lastUpdatedChapter}: ${lastChapter.title}`}
                            >
                              Last Updated: Chapter {selectedThread.lastUpdatedChapter}
                            </EntityLink>
                          ) : (
                            <span>Last Updated: Chapter {selectedThread.lastUpdatedChapter}</span>
                          );
                        })()}
                        {selectedThread.resolvedChapter && (() => {
                          const resolvedChapter = novelState.chapters.find(c => c.number === selectedThread.resolvedChapter);
                          return resolvedChapter ? (
                            <EntityLink
                              type="chapter"
                              id={resolvedChapter.id}
                              className="text-emerald-400 hover:text-emerald-300 hover:underline"
                              title={`View Chapter ${selectedThread.resolvedChapter}: ${resolvedChapter.title}`}
                            >
                              Resolved: Chapter {selectedThread.resolvedChapter}
                            </EntityLink>
                          ) : (
                            <span className="text-emerald-400">Resolved: Chapter {selectedThread.resolvedChapter}</span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setEditingThread(selectedThread)}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Edit
                      </button>
                      {selectedThread.status !== 'resolved' && (
                        <button
                          onClick={() => {
                            const resolutionNotes = prompt('Enter resolution notes:');
                            if (resolutionNotes !== null) {
                              const satisfactionScore = prompt('Enter satisfaction score (0-100, or leave blank):');
                              handleResolveThread(
                                selectedThread.id,
                                resolutionNotes,
                                satisfactionScore ? parseInt(satisfactionScore) : undefined
                              );
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Quick Resolve
                        </button>
                      )}
                      <div className="relative">
                        <button
                          onClick={() => {
                            const newStatus = selectedThread.status === 'active' ? 'paused' : 'active';
                            handleUpdateThreadStatus(selectedThread.id, newStatus);
                          }}
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-sm font-semibold transition-colors"
                        >
                          {selectedThread.status === 'active' ? 'Pause' : 'Resume'}
                        </button>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => {
                            const priorities: ThreadPriority[] = ['low', 'medium', 'high', 'critical'];
                            const currentIndex = priorities.indexOf(selectedThread.priority);
                            const nextPriority = priorities[(currentIndex + 1) % priorities.length];
                            handleUpdateThreadPriority(selectedThread.id, nextPriority);
                          }}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Priority: {selectedThread.priority}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          const note = prompt('Enter progression note:');
                          if (note) {
                            const updatedThread = {
                              ...selectedThread,
                              progressionNotes: [
                                ...(selectedThread.progressionNotes || []),
                                {
                                  chapterNumber: currentChapter,
                                  note,
                                  significance: 'minor' as const,
                                },
                              ],
                              lastUpdatedChapter: currentChapter,
                              chaptersInvolved: [
                                ...(selectedThread.chaptersInvolved || []),
                                currentChapter,
                              ].filter((v, i, a) => a.indexOf(v) === i),
                              updatedAt: Date.now(),
                            };
                            handleSaveThread(updatedThread);
                            setSelectedThread(updatedThread);
                          }
                        }}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Add Note
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ isOpen: true, threadId: selectedThread.id })}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {selectedThread.description && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-2">Description</h3>
                      <p className="text-zinc-300">{selectedThread.description}</p>
                    </div>
                  )}

                  {/* Progression Notes */}
                  {selectedThread.progressionNotes && selectedThread.progressionNotes.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-2">Progression Timeline</h3>
                      <div className="space-y-2">
                        {selectedThread.progressionNotes.map((note, idx) => {
                          const chapter = novelState.chapters.find(c => c.number === note.chapterNumber);
                          return (
                            <div key={idx} className="pl-4 border-l-2 border-zinc-700">
                              <div className="flex items-center gap-2 mb-1">
                                {chapter ? (
                                  <EntityLink
                                    type="chapter"
                                    id={chapter.id}
                                    className="text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline"
                                    title={`View Chapter ${note.chapterNumber}: ${chapter.title}`}
                                  >
                                    Ch {note.chapterNumber}
                                  </EntityLink>
                                ) : (
                                  <span className="text-xs font-semibold text-amber-500">Ch {note.chapterNumber}</span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  note.significance === 'major' ? 'bg-amber-600/20 text-amber-400' : 'bg-zinc-700 text-zinc-400'
                                }`}>
                                  {note.significance}
                                </span>
                              </div>
                              <p className="text-sm text-zinc-300">{note.note}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  {selectedThread.resolutionNotes && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-2">Resolution</h3>
                      <p className="text-zinc-300">{selectedThread.resolutionNotes}</p>
                      {selectedThread.satisfactionScore !== undefined && (
                        <div className="mt-2">
                          <span className="text-sm text-zinc-400">Satisfaction Score: </span>
                          <span className="text-sm font-semibold text-amber-500">{selectedThread.satisfactionScore}/100</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Related Entity */}
                  {selectedThread.relatedEntityId && selectedThread.relatedEntityType && (
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-2">Related Entity</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 uppercase">{selectedThread.relatedEntityType}:</span>
                        <span className="text-sm text-amber-400 font-semibold">
                          {(() => {
                            const entityType = selectedThread.relatedEntityType?.toLowerCase();
                            if (entityType === 'character') {
                              const char = novelState.characterCodex.find(c => c.id === selectedThread.relatedEntityId);
                              return char?.name || 'Unknown';
                            } else if (entityType === 'item') {
                              const item = novelState.novelItems?.find(i => i.id === selectedThread.relatedEntityId);
                              return item?.name || 'Unknown';
                            } else if (entityType === 'technique') {
                              const tech = novelState.novelTechniques?.find(t => t.id === selectedThread.relatedEntityId);
                              return tech?.name || 'Unknown';
                            } else if (entityType === 'location' || entityType === 'territory') {
                              const territory = novelState.territories.find(t => t.id === selectedThread.relatedEntityId);
                              return territory?.name || 'Unknown';
                            } else if (entityType === 'antagonist' || entityType === 'enemy') {
                              const ant = novelState.antagonists?.find(a => a.id === selectedThread.relatedEntityId);
                              return ant?.name || 'Unknown';
                            }
                            return 'Unknown';
                          })()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Related Threads */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase">Related Threads</h3>
                      <button
                        onClick={() => {
                          const relatedThreads = (selectedThread as any).relatedThreadIds || [];
                          const availableThreads = novelState.storyThreads?.filter(t => t.id !== selectedThread.id) || [];
                          const threadId = prompt(
                            `Enter thread ID to link, or choose from:\n${availableThreads.slice(0, 10).map(t => `- ${t.id}: ${t.title}`).join('\n')}`
                          );
                          if (threadId) {
                            const thread = novelState.storyThreads?.find(t => t.id === threadId.trim());
                            if (thread) {
                              const updatedThread = {
                                ...selectedThread,
                                relatedThreadIds: [...relatedThreads, thread.id].filter((v, i, a) => a.indexOf(v) === i),
                                updatedAt: Date.now(),
                              };
                              handleSaveThread(updatedThread);
                              setSelectedThread(updatedThread);
                            } else {
                              showError('Thread not found');
                            }
                          }
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        + Link Thread
                      </button>
                    </div>
                    {((selectedThread as any).relatedThreadIds || []).length > 0 ? (
                      <div className="space-y-2">
                        {((selectedThread as any).relatedThreadIds || []).map((relatedId: string) => {
                          const relatedThread = novelState.storyThreads?.find(t => t.id === relatedId);
                          if (relatedThread) {
                            return (
                              <div key={relatedId} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                                <div className="flex items-center gap-2">
                                  <span>{getTypeIcon(relatedThread.type)}</span>
                                  <button
                                    onClick={() => setSelectedThread(relatedThread)}
                                    className="text-sm text-amber-400 hover:text-amber-300 hover:underline"
                                  >
                                    {relatedThread.title}
                                  </button>
                                  <span className="text-xs text-zinc-500">({relatedThread.type})</span>
                                </div>
                                <button
                                  onClick={() => {
                                    const updatedThread = {
                                      ...selectedThread,
                                      relatedThreadIds: ((selectedThread as any).relatedThreadIds || []).filter((id: string) => id !== relatedId),
                                      updatedAt: Date.now(),
                                    };
                                    handleSaveThread(updatedThread);
                                    setSelectedThread(updatedThread);
                                  }}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 italic">No related threads</p>
                    )}
                  </div>

                  {/* Chapters Involved */}
                  {selectedThread.chaptersInvolved && selectedThread.chaptersInvolved.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-zinc-400 uppercase mb-2">Chapters Involved</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedThread.chaptersInvolved.map((chNum) => {
                          const chapter = novelState.chapters.find(c => c.number === chNum);
                          if (chapter) {
                            return (
                              <EntityLink
                                key={chNum}
                                type="chapter"
                                id={chapter.id}
                                className="px-2 py-1 bg-zinc-800 hover:bg-amber-600/20 text-zinc-300 hover:text-amber-400 rounded text-xs transition-colors cursor-pointer"
                                title={`View Chapter ${chNum}: ${chapter.title}`}
                              >
                                Ch {chNum}
                              </EntityLink>
                            );
                          }
                          return (
                            <span
                              key={chNum}
                              className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs"
                            >
                              Ch {chNum}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Thread Timeline */}
                <ThreadTimeline 
                  thread={selectedThread} 
                  novelState={novelState} 
                  currentChapter={currentChapter} 
                />

                {/* Health Analysis */}
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-zinc-200 mb-4">Thread Health</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-400">Health Score</span>
                        <span className="font-semibold text-amber-500">
                          {calculateThreadHealth(selectedThread, currentChapter)}/100
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            calculateThreadHealth(selectedThread, currentChapter) >= 70
                              ? 'bg-emerald-500'
                              : calculateThreadHealth(selectedThread, currentChapter) >= 40
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${calculateThreadHealth(selectedThread, currentChapter)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-sm text-zinc-400">
                      <p>Chapters since last update: {currentChapter - selectedThread.lastUpdatedChapter}</p>
                      <p>Thread age: {currentChapter - selectedThread.introducedChapter} chapters</p>
                    </div>
                  </div>
                </div>

                {/* Plot Holes & Suggestions */}
                {(plotHoles.length > 0 || pacingSuggestions.length > 0) && (
                  <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-zinc-200 mb-4">Warnings & Suggestions</h3>
                    <div className="space-y-4">
                      {/* Plot Holes */}
                      {plotHoles.filter(hole => hole.thread.id === selectedThread.id).map((hole, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            hole.severity === 'critical'
                              ? 'bg-red-950/20 border-red-500/50'
                              : hole.severity === 'high'
                              ? 'bg-orange-950/20 border-orange-500/50'
                              : 'bg-amber-950/20 border-amber-500/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">
                              {hole.severity === 'critical' ? '🔴' : hole.severity === 'high' ? '🟠' : '🟡'}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-zinc-200 mb-1">
                                {hole.severity === 'critical' ? 'Critical Plot Hole' : hole.severity === 'high' ? 'High Priority Issue' : 'Potential Issue'}
                              </p>
                              <p className="text-xs text-zinc-400">{hole.issue}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Pacing Suggestions */}
                      {pacingSuggestions.filter(s => s.thread.id === selectedThread.id).map((suggestion, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border ${
                            suggestion.urgency === 'high'
                              ? 'bg-amber-950/20 border-amber-500/50'
                              : suggestion.urgency === 'medium'
                              ? 'bg-yellow-950/20 border-yellow-500/50'
                              : 'bg-blue-950/20 border-blue-500/50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">💡</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-zinc-200 mb-1">Pacing Suggestion</p>
                              <p className="text-xs text-zinc-400">{suggestion.suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                <div className="text-center">
                  <p className="text-xl mb-2">Select a thread to view details</p>
                  <p className="text-sm">Or create a new thread to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {editingThread && showCreateDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-amber-500 mb-4">
              {editingThread.id ? 'Edit Thread' : 'Create Thread'}
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="thread-title-input" className="block text-sm font-semibold text-zinc-400 mb-1">Title</label>
                <input
                  id="thread-title-input"
                  type="text"
                  value={editingThread.title}
                  onChange={(e) => setEditingThread({ ...editingThread, title: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                  aria-label="Thread title"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-1">Type</label>
                <select
                  value={editingThread.type}
                  onChange={(e) => setEditingThread({ ...editingThread, type: e.target.value as StoryThreadType })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                  aria-label="Thread type"
                >
                  <option value="enemy">⚔️ Enemy</option>
                  <option value="technique">✨ Technique</option>
                  <option value="item">💎 Item</option>
                  <option value="location">📍 Location</option>
                  <option value="sect">🏛️ Sect</option>
                  <option value="promise">🤝 Promise</option>
                  <option value="mystery">🔍 Mystery</option>
                  <option value="relationship">💕 Relationship</option>
                  <option value="power">⚡ Power</option>
                  <option value="quest">🗺️ Quest</option>
                  <option value="revelation">💡 Revelation</option>
                  <option value="conflict">🔥 Conflict</option>
                  <option value="alliance">🤝 Alliance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-1">Status</label>
                <select
                  value={editingThread.status}
                  onChange={(e) => setEditingThread({ ...editingThread, status: e.target.value as ThreadStatus })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                  aria-label="Thread status"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="resolved">Resolved</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-1">Priority</label>
                <select
                  value={editingThread.priority}
                  onChange={(e) => setEditingThread({ ...editingThread, priority: e.target.value as ThreadPriority })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                  aria-label="Thread priority"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label htmlFor="thread-description-textarea" className="block text-sm font-semibold text-zinc-400 mb-1">Description</label>
                <textarea
                  id="thread-description-textarea"
                  value={editingThread.description}
                  onChange={(e) => setEditingThread({ ...editingThread, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                  aria-label="Thread description"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingThread(null);
                  }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSave(editingThread)}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Dialog Click Outside Handler */}
      {showTemplateDialog && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowTemplateDialog(false)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title="Delete Thread"
        message={`Are you sure you want to delete this thread? This action cannot be undone.`}
        variant="danger"
        onConfirm={() => {
          if (confirmDelete.threadId) {
            handleDelete(confirmDelete.threadId);
          }
        }}
        onCancel={() => {
          pendingDeleteRef.current = null;
          setConfirmDelete({ isOpen: false, threadId: null });
        }}
      />
    </div>
  );
};

export default StoryThreadsView;
