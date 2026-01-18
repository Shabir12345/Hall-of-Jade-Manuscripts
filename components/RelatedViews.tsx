import React from 'react';
import { ViewType } from '../types';
import { useNavigation } from '../contexts/NavigationContext';

interface RelatedView {
  id: ViewType;
  label: string;
  icon: string;
  description: string;
}

interface RelatedViewsProps {
  currentView: ViewType;
  relatedViews: RelatedView[];
  className?: string;
}

/**
 * Component that displays links to related analysis views.
 * Helps users discover and navigate to related features.
 */
export const RelatedViews: React.FC<RelatedViewsProps> = ({
  currentView,
  relatedViews,
  className = '',
}) => {
  const { navigate } = useNavigation();

  if (relatedViews.length === 0) {
    return null;
  }

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-4 ${className}`}>
      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center">
        <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
        Related Analysis Tools
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {relatedViews
          .filter(view => view.id !== currentView)
          .map(view => (
            <button
              key={view.id}
              onClick={() => navigate({ type: 'view', view: view.id })}
              className="group text-left bg-zinc-800/50 border border-zinc-700/30 rounded-lg p-3 hover:border-amber-600/50 hover:bg-zinc-800/80 transition-all duration-200"
              aria-label={`Navigate to ${view.label}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">{view.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-zinc-300 group-hover:text-amber-400 transition-colors">
                    {view.label}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                    {view.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};

/**
 * Predefined related views for each analysis view
 */
export const RELATED_VIEWS_MAP: Record<ViewType, RelatedView[]> = {
  'structure-visualizer': [
    { id: 'planning', label: 'Saga & Arcs', icon: '🗺️', description: 'Plan and manage story arcs' },
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View all chapters' },
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', description: 'Track reader engagement' },
    { id: 'tension-curve', label: 'Tension', icon: '⚡', description: 'Analyze tension levels' },
  ],
  'engagement-dashboard': [
    { id: 'tension-curve', label: 'Tension', icon: '⚡', description: 'Analyze tension and conflict' },
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapter details' },
    { id: 'structure-visualizer', label: 'Structure', icon: '🏛️', description: 'Story structure analysis' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', description: 'Overall quality metrics' },
  ],
  'tension-curve': [
    { id: 'antagonists', label: 'Antagonists', icon: '⚔️', description: 'View opposition forces' },
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', description: 'Reader engagement metrics' },
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapter details' },
    { id: 'conflict-tracker', label: 'Conflicts', icon: '💥', description: 'Track conflicts' },
  ],
  'theme-evolution': [
    { id: 'planning', label: 'Saga & Arcs', icon: '🗺️', description: 'Arc planning' },
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapters' },
    { id: 'character-psychology', label: 'Psychology', icon: '🧠', description: 'Character depth' },
  ],
  'character-psychology': [
    { id: 'characters', label: 'Characters', icon: '👥', description: 'Character codex' },
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', description: 'Reader engagement' },
    { id: 'theme-evolution', label: 'Themes', icon: '🎭', description: 'Theme tracking' },
  ],
  'device-dashboard': [
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapters' },
    { id: 'editor', label: 'Editor', icon: '✏️', description: 'Edit chapters' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', description: 'Quality metrics' },
  ],
  'draft-comparison': [
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapters' },
    { id: 'improvement-history', label: 'History', icon: '📜', description: 'Change history' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', description: 'Quality metrics' },
  ],
  'excellence-scorecard': [
    { id: 'engagement-dashboard', label: 'Engagement', icon: '📊', description: 'Engagement metrics' },
    { id: 'structure-visualizer', label: 'Structure', icon: '🏛️', description: 'Story structure' },
    { id: 'draft-comparison', label: 'Drafts', icon: '📝', description: 'Compare versions' },
  ],
  'improvement-history': [
    { id: 'draft-comparison', label: 'Drafts', icon: '📝', description: 'Compare versions' },
    { id: 'excellence-scorecard', label: 'Excellence', icon: '⭐', description: 'Quality metrics' },
    { id: 'chapters', label: 'Chapters', icon: '📖', description: 'View chapters' },
  ],
  // Default empty arrays for views that don't have specific related views
  'dashboard': [],
  'world-bible': [],
  'characters': [],
  'chapters': [],
  'editor': [],
  'planning': [],
  'library': [],
  'world-map': [],
  'storyboard': [],
  'timeline': [],
  'beatsheet': [],
  'matrix': [],
  'analytics': [],
  'search': [],
  'goals': [],
  'antagonists': [],
  'story-threads': [],
};
