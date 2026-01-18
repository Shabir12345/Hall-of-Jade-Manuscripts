import React, { memo, useMemo } from 'react';
import { NovelState, Chapter, Scene } from '../types';

interface StoryboardViewProps {
  novelState: NovelState;
}

const StoryboardView: React.FC<StoryboardViewProps> = ({ novelState }) => {
  const allScenes = useMemo(() => {
    const scenes: Array<{ scene: Scene; chapter: Chapter }> = [];
    novelState.chapters.forEach(chapter => {
      chapter.scenes.forEach(scene => {
        scenes.push({ scene, chapter });
      });
    });
    return scenes.sort((a, b) => {
      if (a.chapter.number !== b.chapter.number) {
        return a.chapter.number - b.chapter.number;
      }
      return a.scene.number - b.scene.number;
    });
  }, [novelState.chapters]);

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Storyboard</h2>
        <p className="text-sm text-zinc-400 mt-2">Visual grid layout of all scenes and chapters</p>
      </div>

      {allScenes.length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Scenes Yet</h3>
          <p className="text-sm text-zinc-500">Create scenes in your chapters to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allScenes.map(({ scene, chapter }) => (
            <div
              key={scene.id}
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-500 uppercase">
                  Ch {chapter.number} • Scene {scene.number}
                </span>
              </div>
              {scene.title && (
                <h4 className="text-sm font-fantasy font-bold text-amber-400 mb-2 line-clamp-1">
                  {scene.title}
                </h4>
              )}
              {scene.summary && (
                <p className="text-xs text-zinc-400 line-clamp-3 italic mb-3">
                  {scene.summary}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{scene.wordCount} words</span>
                <span className="text-amber-600/60">{chapter.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(StoryboardView);
