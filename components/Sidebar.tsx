
import React, { memo, useCallback } from 'react';
import { ViewType } from '../types';
import { useLlm, type LlmId } from '../contexts/LlmContext';
import { useNovel } from '../contexts/NovelContext';

const Sidebar: React.FC = () => {
  const { llm, setLlm } = useLlm();
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

  const handleViewChange = useCallback((view: ViewType) => {
    setView(view);
    setActiveChapterId(null);
  }, [setView]);
  const navItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'planning', label: 'Saga & Arcs', icon: '🗺️' },
    { id: 'world-map', label: 'World Map', icon: '🌍' },
    { id: 'chapters', label: 'Chapters', icon: '📖' },
    { id: 'world-bible', label: 'World Bible', icon: '📜' },
    { id: 'characters', label: 'Codex', icon: '👥' },
    { id: 'antagonists', label: 'Opposition', icon: '⚔️' },
    { id: 'storyboard', label: 'Storyboard', icon: '📋' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
    { id: 'beatsheet', label: 'Beat Sheet', icon: '📊' },
    { id: 'matrix', label: 'Matrix', icon: '🔲' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'goals', label: 'Goals', icon: '🎯' },
    // World-Class Enhancements Views
    { id: 'structure-visualizer', label: 'Structure', icon: '🏛️' },
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊' },
    { id: 'tension-curve', label: 'Tension', icon: '⚡' },
    { id: 'theme-evolution', label: 'Themes', icon: '🎭' },
    { id: 'character-psychology', label: 'Psychology', icon: '🧠' },
    { id: 'device-dashboard', label: 'Devices', icon: '✨' },
    { id: 'draft-comparison', label: 'Drafts', icon: '📝' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐' },
  ];

  return (
    <aside id="sidebar" className="w-64 bg-zinc-900 border-r border-zinc-700 flex flex-col h-full flex-shrink-0" role="navigation" aria-label="Main navigation">
      <div className="p-6 border-b border-zinc-700">
        <h1 className="font-fantasy text-2xl font-bold text-amber-500 tracking-wider break-words">APEX FORGE</h1>
        <p
          className="text-xs text-zinc-400 mt-2 uppercase tracking-widest truncate font-semibold"
          title={activeNovel?.title || ''}
        >
          {activeNovel?.title || ''}
        </p>
        <div className="mt-4">
          <label className="block text-[10px] text-zinc-500 uppercase font-semibold tracking-widest mb-2">
            LLM
          </label>
          <select
            value={llm}
            onChange={(e) => setLlm(e.target.value as LlmId)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all cursor-pointer"
            aria-label="Select LLM"
          >
            <option value="gemini">Gemini</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
            <option value="deepseek-reasoner">DeepSeek Reasoner</option>
          </select>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin" aria-label="Navigation menu">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleViewChange(item.id)}
            aria-label={`Navigate to ${item.label}`}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-amber-600/15 text-amber-500 border border-amber-600/30 shadow-lg shadow-amber-900/10' 
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <span className="text-base">{item.icon}</span>
            <span className="text-sm font-semibold uppercase tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-700">
        <div className="bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-700/50">
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
      </div>
    </aside>
  );
};

export default memo(Sidebar);
