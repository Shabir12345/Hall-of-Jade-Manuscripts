import React, { useState, memo, useCallback, useMemo } from 'react';
import { Scene, NovelState } from '../types';
import VoiceInput from './VoiceInput';

interface SceneEditorProps {
  scene: Scene;
  novelState?: NovelState;
  onSave: (updatedScene: Scene) => void;
  onClose: () => void;
}

const SceneEditor: React.FC<SceneEditorProps> = ({ scene, novelState, onSave, onClose }) => {
  const [content, setContent] = useState(scene.content);
  const [title, setTitle] = useState(scene.title);
  const [summary, setSummary] = useState(scene.summary);

  const handleSave = useCallback(() => {
    const wordCount = content.split(/\s+/).filter(x => x).length;
    onSave({ 
      ...scene, 
      content, 
      title,
      summary,
      wordCount,
      updatedAt: Date.now()
    });
  }, [scene, content, title, summary, onSave]);

  const wordCount = useMemo(
    () => content.split(/\s+/).filter(x => x).length,
    [content]
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-700 bg-zinc-900/50">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 flex-shrink-0"
            aria-label="Close editor"
          >
            ← Back
          </button>
          <div className="relative flex items-center group flex-1 min-w-0">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none text-lg md:text-xl font-fantasy font-bold text-amber-500 focus:ring-0 w-full pr-12 placeholder-zinc-600"
              placeholder="Scene Title..."
              aria-label="Scene title"
            />
            <VoiceInput 
              onResult={(text) => setTitle(text)} 
              className="absolute right-0"
              title="Voice Input: Speak to set scene title"
            />
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-shrink-0">
          <button 
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/20"
            aria-label="Save scene"
          >
            Save Scene
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 relative overflow-y-auto p-6 md:p-8 lg:p-12 scrollbar-thin">
          <div className="absolute top-6 right-6 z-10">
            <VoiceInput 
              onResult={(text) => setContent(prev => prev + "\n" + text)}
              className="shadow-xl bg-zinc-900 border border-zinc-700"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-transparent border-none focus:ring-0 text-zinc-300 font-serif-novel text-base md:text-lg lg:text-xl leading-relaxed resize-none placeholder-zinc-600"
            placeholder="The scene begins here..."
            aria-label="Scene content"
          />
        </div>

        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-700 bg-zinc-900/40 p-4 md:p-6 space-y-6 overflow-y-auto scrollbar-thin">
          <div>
            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-2 block">Scene Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of this scene..."
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 h-24 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all leading-relaxed resize-none"
              aria-label="Scene summary"
            />
          </div>

          <div className="p-4 bg-amber-600/10 border border-amber-600/20 rounded-lg">
            <h4 className="text-xs text-amber-500 font-bold uppercase mb-2">Writer Tip</h4>
            <p className="text-sm text-zinc-400 leading-relaxed italic">
              "Each scene should advance the plot or reveal character. No scene without purpose."
            </p>
          </div>

          <div className="text-xs text-zinc-500 font-semibold">
            Character count: {content.length.toLocaleString()} | Est. Words: {wordCount.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(SceneEditor);
