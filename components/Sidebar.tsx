
import React, { memo, useCallback, useState, useEffect } from 'react';
import { ViewType } from '../types';
import { useNovel } from '../contexts/NovelContext';
import { useChapterGenerationModel } from '../contexts/ChapterGenerationModelContext';
import { Tooltip } from './Tooltip';

interface SidebarProps {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, isCollapsed = false, onToggleCollapse }) => {
  const {
    currentView,
    setView,
    setActiveChapterId,
    activeNovel,
    isOnline,
    cloudAvailable,
    pendingSyncCount,
    isSaving,
    syncNow,
    lastCloudErrorMessage,
  } = useNovel();
  const { model: chapterModel, setModel: setChapterModel } = useChapterGenerationModel();

  const handleViewChange = useCallback((view: ViewType) => {
    setView(view);
    setActiveChapterId(null);
    onNavigate?.(); // Close mobile sidebar on navigation
  }, [setView, setActiveChapterId, onNavigate]);

  // Collapsible state for Advanced Analysis (persisted in localStorage)
  const [advancedAnalysisExpanded, setAdvancedAnalysisExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-advanced-analysis-expanded');
    return saved !== null ? saved === 'true' : true; // Default to expanded
  });

  useEffect(() => {
    localStorage.setItem('sidebar-advanced-analysis-expanded', String(advancedAnalysisExpanded));
  }, [advancedAnalysisExpanded]);

  // Navigation groups
  const coreWritingItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'chapters', label: 'Chapters', icon: '📖' },
    { id: 'editor', label: 'Editor', icon: '✏️' },
  ];

  const planningItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'planning', label: 'Saga & Arcs', icon: '🗺️' },
    { id: 'storyboard', label: 'Storyboard', icon: '📋' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
    { id: 'beatsheet', label: 'Beat Sheet', icon: '📊' },
    { id: 'matrix', label: 'Matrix', icon: '🔲' },
    { id: 'story-threads', label: 'Story Threads', icon: '🧵' },
  ];

  const worldBuildingItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'world-map', label: 'World Map', icon: '🌍' },
    { id: 'world-bible', label: 'World Bible', icon: '📜' },
    { id: 'characters', label: 'Codex', icon: '👥' },
    { id: 'antagonists', label: 'Opposition', icon: '⚔️' },
    { id: 'character-systems', label: 'Systems', icon: '⚙️' },
  ];

  const analysisItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    { id: 'memory-dashboard', label: 'Memory', icon: '🧠' },
  ];

  const advancedAnalysisItems: { id: ViewType; label: string; icon: string; tooltip: string }[] = [
    { id: 'structure-visualizer', label: 'Structure', icon: '🏛️', tooltip: 'Visualize your story structure, arcs, and chapter organization' },
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', tooltip: 'Track reader engagement metrics and pacing across chapters' },
    { id: 'tension-curve', label: 'Tension', icon: '⚡', tooltip: 'Analyze tension levels and dramatic peaks throughout your story' },
    { id: 'theme-evolution', label: 'Themes', icon: '🎭', tooltip: 'Track how themes develop and evolve across your narrative' },
    { id: 'character-psychology', label: 'Psychology', icon: '🧠', tooltip: 'Deep dive into character motivations, arcs, and psychological depth' },
    { id: 'device-dashboard', label: 'Devices', icon: '✨', tooltip: 'Monitor literary devices, foreshadowing, and narrative techniques' },
    { id: 'draft-comparison', label: 'Drafts', icon: '📝', tooltip: 'Compare different versions of chapters and track improvements' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', tooltip: 'Overall quality metrics and excellence indicators for your novel' },
    { id: 'improvement-history', label: 'History', icon: '📜', tooltip: 'View all novel improvements and changes made over time' },
  ];

  const renderNavGroup = (
    items: { id: ViewType; label: string; icon: string }[],
    groupLabel?: string,
    isGroupCollapsible: boolean = false,
    isExpanded: boolean = true,
    onToggle?: () => void
  ) => (
    <div key={groupLabel || 'ungrouped'} className="space-y-2">
      {groupLabel && !isCollapsed && (
        <div className="px-4 pt-4 pb-2">
          {isGroupCollapsible ? (
            <Tooltip 
              content={isExpanded ? 'Click to collapse Advanced Analysis tools' : 'Click to expand Advanced Analysis tools'} 
              position="right"
              delay={300}
            >
              <button
                onClick={onToggle}
                className="w-full flex items-center justify-between text-xs font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
              >
                <span>{groupLabel}</span>
                <span className={`text-xs transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
              </button>
            </Tooltip>
          ) : (
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{groupLabel}</div>
          )}
        </div>
      )}
      {/* When collapsed, show a separator line for groups */}
      {groupLabel && isCollapsed && (
        <div className="border-t border-zinc-700/50 mx-2 pt-2"></div>
      )}
      {(isGroupCollapsible ? isExpanded : true) && (
        <div className={groupLabel ? 'space-y-1' : 'space-y-1'}>
          {items.map((item) => (
            <Tooltip
              key={item.id}
              content={item.label}
              position="right"
              delay={isCollapsed ? 100 : 1000}
              disabled={!isCollapsed}
            >
              <button
                onClick={() => handleViewChange(item.id)}
                aria-label={`Navigate to ${item.label}`}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2 px-3'} py-2.5 rounded-xl transition-all duration-200 ${
                  currentView === item.id 
                    ? 'bg-amber-600/15 text-amber-500 border border-amber-600/30 shadow-lg shadow-amber-900/10' 
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <span className={`${isCollapsed ? 'text-lg' : 'text-sm'} flex-shrink-0`}>{item.icon}</span>
                {!isCollapsed && (
                  <span className="text-xs font-semibold uppercase tracking-wide truncate">{item.label}</span>
                )}
              </button>
            </Tooltip>
          ))}
        </div>
      )}
      {groupLabel && items.length > 0 && !isGroupCollapsible && !isCollapsed && (
        <div className="border-t border-zinc-700 mt-2"></div>
      )}
    </div>
  );

  return (
    <div 
      className={`${isCollapsed ? 'w-[72px]' : 'w-64'} bg-zinc-900 border-r border-zinc-700 flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out`} 
      role="navigation" 
      aria-label="Main navigation" 
      data-tour="sidebar"
    >
      {/* Header */}
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-b border-zinc-700`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center space-y-2">
            <Tooltip content="APEX FORGE" position="right" delay={100}>
              <h1 className="font-fantasy text-lg font-bold text-amber-500">⚔️</h1>
            </Tooltip>
            {onToggleCollapse && (
              <Tooltip content="Expand sidebar" position="right" delay={100}>
                <button
                  onClick={onToggleCollapse}
                  className="p-2 text-zinc-400 hover:text-amber-500 hover:bg-zinc-800 rounded-lg transition-colors"
                  aria-label="Expand sidebar"
                >
                  <span className="text-sm">»</span>
                </button>
              </Tooltip>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-fantasy text-xl font-bold text-amber-500 tracking-wider break-words">APEX FORGE</h1>
              {onToggleCollapse && (
                <Tooltip content="Collapse sidebar" position="right" delay={300}>
                  <button
                    onClick={onToggleCollapse}
                    className="p-1.5 text-zinc-500 hover:text-amber-500 hover:bg-zinc-800 rounded-lg transition-colors hidden lg:block"
                    aria-label="Collapse sidebar"
                  >
                    <span className="text-xs">«</span>
                  </button>
                </Tooltip>
              )}
            </div>
            <p
              className="text-xs text-zinc-400 mt-2 uppercase tracking-widest truncate font-semibold"
              title={activeNovel?.title || ''}
            >
              {activeNovel?.title || ''}
            </p>
            <div className="mt-4">
              <label className="block text-[10px] text-zinc-500 uppercase font-semibold tracking-widest mb-2">
                Model Strategy
              </label>
              <div className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">All AI Features</span>
                  <span className="text-amber-400 font-medium">Grok-4-1</span>
                </div>
                <div className="pt-1.5 mt-1.5 border-t border-zinc-800 text-[10px] text-zinc-500">
                  All AI features use Grok for optimal performance
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'} overflow-y-auto scrollbar-thin`} aria-label="Navigation menu">
        <div className="space-y-1">
          {renderNavGroup(coreWritingItems, 'CORE WRITING', false, true, undefined)}
          {renderNavGroup(planningItems, 'PLANNING')}
          {renderNavGroup(worldBuildingItems, 'WORLD BUILDING')}
          {renderNavGroup(analysisItems, 'ANALYSIS')}
          {renderNavGroup(
            advancedAnalysisItems,
            'ADVANCED ANALYSIS',
            true,
            advancedAnalysisExpanded,
            () => setAdvancedAnalysisExpanded(!advancedAnalysisExpanded)
          )}
        </div>
      </nav>

      {/* Status Footer */}
      <div className={`${isCollapsed ? 'p-2' : 'p-3'} border-t border-zinc-700`}>
        {isCollapsed ? (
          <Tooltip 
            content={
              !isOnline ? 'Offline' : 
              isSaving ? 'Syncing...' : 
              !cloudAvailable ? 'Cloud Unavailable' : 
              pendingSyncCount > 0 ? `Needs Sync (${pendingSyncCount})` : 
              'Synced'
            } 
            position="right" 
            delay={100}
          >
            <div className={`flex items-center justify-center p-2 rounded-lg ${
              !isOnline ? 'text-zinc-400' :
              isSaving ? 'text-amber-500' :
              !cloudAvailable ? 'text-red-400' :
              pendingSyncCount > 0 ? 'text-amber-500' :
              'text-emerald-400'
            }`}>
              <span className="text-lg">
                {!isOnline ? '📴' : 
                 isSaving ? '🔄' : 
                 !cloudAvailable ? '⚠️' : 
                 pendingSyncCount > 0 ? '⏳' : 
                 '✅'}
              </span>
            </div>
          </Tooltip>
        ) : (
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center border border-zinc-700/50">
            <p className="text-xs text-zinc-500 uppercase font-semibold tracking-widest mb-1">Status</p>
            <p className="text-xs font-bold uppercase">
              {!isOnline ? (
                <span className="text-zinc-300">Offline</span>
              ) : isSaving ? (
                <span className="text-amber-500">Syncing...</span>
              ) : !cloudAvailable ? (
                <span className="text-red-400" title={lastCloudErrorMessage || undefined}>
                  Cloud Unavailable
                </span>
              ) : pendingSyncCount > 0 ? (
                <span className="text-amber-500">Needs Sync ({pendingSyncCount})</span>
              ) : (
                <span className="text-emerald-400">Synced</span>
              )}
            </p>

            {!cloudAvailable && lastCloudErrorMessage && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-800/50 rounded text-left">
                <p className="text-[10px] text-red-400 break-words">
                  {lastCloudErrorMessage}
                </p>
                <p className="text-[9px] text-red-500/70 mt-1">
                  Check console (F12) for details
                </p>
              </div>
            )}

            {isOnline && pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={isSaving}
                className="mt-3 w-full text-[10px] uppercase font-semibold tracking-widest px-3 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 text-amber-400 hover:bg-amber-600/15 hover:border-amber-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Sync now"
                title="Sync pending local changes to cloud"
              >
                Sync now
              </button>
            )}

            {!cloudAvailable && isOnline && (
              <button
                type="button"
                onClick={() => {
                  console.log('Manual sync triggered. Attempting to sync now...');
                  void syncNow();
                }}
                disabled={isSaving}
                className="mt-3 w-full text-[10px] uppercase font-semibold tracking-widest px-3 py-2 rounded-lg border border-red-600/40 bg-red-600/10 text-red-400 hover:bg-red-600/15 hover:border-red-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Retry cloud connection"
                title="Retry cloud connection"
              >
                Retry Cloud
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(Sidebar);
