/**
 * Chapter Editor Tabs Component
 * Tab navigation for chapter editor sections
 * Responsive: horizontal scroll on mobile, icons-only on very small screens
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

// Tab configurations with icons for mobile
const tabs: { id: ChapterEditorTab; label: string; shortLabel: string; icon: string }[] = [
  { id: 'content', label: 'Content', shortLabel: 'Content', icon: '📝' },
  { id: 'scenes', label: 'Scenes', shortLabel: 'Scenes', icon: '🎬' },
  { id: 'antagonists', label: 'Antagonists', shortLabel: 'Antag.', icon: '⚔️' },
  { id: 'professional', label: 'Professional Editor', shortLabel: 'Pro', icon: '✨' },
];

export const ChapterEditorTabs: React.FC<ChapterEditorTabsProps> = ({
  activeTab,
  onTabChange,
  scenesCount,
  antagonistsCount,
  professionalEditorBadgeCount,
}) => {
  // Get badge count for a tab
  const getBadgeCount = (tabId: ChapterEditorTab): number => {
    switch (tabId) {
      case 'scenes': return scenesCount;
      case 'antagonists': return antagonistsCount;
      case 'professional': return professionalEditorBadgeCount;
      default: return 0;
    }
  };

  return (
    <div className="px-2 xs:px-3 sm:px-4 md:px-6 py-2 border-b border-zinc-700 bg-zinc-900/40">
      {/* Horizontal scroll container */}
      <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 xs:-mx-3 xs:px-3 sm:mx-0 sm:px-0">
        {tabs.map((tab) => {
          const badgeCount = getBadgeCount(tab.id);
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1 xs:gap-1.5 px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 text-xs xs:text-sm font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon - always visible on mobile, hidden on larger screens */}
              <span className="sm:hidden text-sm">{tab.icon}</span>
              {/* Short label on xs, full label on sm+ */}
              <span className="hidden xs:inline sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {/* Badge */}
              {badgeCount > 0 && (
                <span className={`text-[10px] xs:text-xs px-1 xs:px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-amber-500/30 text-amber-300' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
