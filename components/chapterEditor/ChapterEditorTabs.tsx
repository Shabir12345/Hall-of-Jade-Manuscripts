/**
 * Chapter Editor Tabs Component
 * Tab navigation for chapter editor sections
 */

import React from 'react';

export type ChapterEditorTab = 'content' | 'scenes' | 'antagonists' | 'professional' | 'history';

interface ChapterEditorTabsProps {
  activeTab: ChapterEditorTab;
  onTabChange: (tab: ChapterEditorTab) => void;
  scenesCount: number;
  antagonistsCount: number;
  professionalEditorBadgeCount: number;
}

export const ChapterEditorTabs: React.FC<ChapterEditorTabsProps> = ({
  activeTab,
  onTabChange,
  scenesCount,
  antagonistsCount,
  professionalEditorBadgeCount,
}) => {
  return (
    <div className="px-4 md:px-6 py-2 border-b border-zinc-700 bg-zinc-900/40">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onTabChange('content')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'content'
              ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
          }`}
        >
          Content
        </button>
        <button
          onClick={() => onTabChange('scenes')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'scenes'
              ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
          }`}
        >
          Scenes {scenesCount > 0 && `(${scenesCount})`}
        </button>
        <button
          onClick={() => onTabChange('antagonists')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'antagonists'
              ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
          }`}
        >
          Antagonists {antagonistsCount > 0 && `(${antagonistsCount})`}
        </button>
        <button
          onClick={() => onTabChange('professional')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
            activeTab === 'professional'
              ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
              : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
          }`}
        >
          Professional Editor
          {professionalEditorBadgeCount > 0 && (
            <span className="ml-1 text-xs">({professionalEditorBadgeCount})</span>
          )}
        </button>
      </div>
    </div>
  );
};
