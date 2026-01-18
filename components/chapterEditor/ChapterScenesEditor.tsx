/**
 * Chapter Scenes Editor Component
 * Manages scenes within a chapter
 */

import React from 'react';
import type { Scene } from '../../types';

interface ChapterScenesEditorProps {
  scenes: Scene[];
  onCreateScene: () => void;
  onEditScene: (scene: Scene) => void;
  onDeleteScene: (sceneId: string) => void;
}

export const ChapterScenesEditor: React.FC<ChapterScenesEditorProps> = ({
  scenes,
  onCreateScene,
  onEditScene,
  onDeleteScene,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-fantasy font-bold text-amber-500">Scenes</h2>
          <button
            onClick={onCreateScene}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105"
            aria-label="Create new scene"
          >
            + Create Scene
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenes.length === 0 ? (
            <div className="col-span-2 py-12 text-center bg-zinc-900/50 border border-dashed border-zinc-700 rounded-2xl">
              <p className="text-sm text-zinc-500 italic">No scenes yet. Create one to organize your chapter.</p>
            </div>
          ) : (
            scenes.map((scene) => (
              <div
                key={scene.id}
                className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-bold text-zinc-500">Scene {scene.number}</span>
                      {scene.title && (
                        <span className="text-sm text-amber-400 font-semibold truncate">{scene.title}</span>
                      )}
                    </div>
                    {scene.summary && (
                      <p className="text-sm text-zinc-400 line-clamp-3 italic mb-2">{scene.summary}</p>
                    )}
                    <p className="text-xs text-zinc-500">{scene.wordCount} words</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-3">
                    <button
                      onClick={() => onEditScene(scene)}
                      className="text-zinc-400 hover:text-amber-500 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors"
                      aria-label={`Edit scene ${scene.number}`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeleteScene(scene.id)}
                      className="text-zinc-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      aria-label={`Delete scene ${scene.number}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
