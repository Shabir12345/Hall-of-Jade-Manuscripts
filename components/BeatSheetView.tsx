import React, { memo, useMemo } from 'react';
import { NovelState, Chapter } from '../types';

interface BeatSheetViewProps {
  novelState: NovelState;
}

const BeatSheetView: React.FC<BeatSheetViewProps> = ({ novelState }) => {
  const beats = useMemo(() => {
    const totalChapters = novelState.chapters.length;
    if (totalChapters === 0) return { act1: [], act2: [], act3: [] };
    
    const act1End = Math.ceil(totalChapters * 0.25);
    const act2End = Math.ceil(totalChapters * 0.75);
    
    return {
      act1: novelState.chapters.slice(0, act1End),
      act2: novelState.chapters.slice(act1End, act2End),
      act3: novelState.chapters.slice(act2End)
    };
  }, [novelState.chapters]);

  const renderAct = (chapters: Chapter[], actName: string, actColor: string) => (
    <div className="space-y-4">
      <div className={`${actColor} border-2 rounded-xl p-4`}>
        <h3 className="text-lg font-fantasy font-bold text-amber-500 mb-2">{actName}</h3>
        <p className="text-xs text-zinc-400">{chapters.length} chapters</p>
      </div>
      <div className="space-y-2">
        {chapters.length === 0 ? (
          <p className="text-xs text-zinc-500 italic text-center py-4">No chapters in this act yet</p>
        ) : (
          chapters.map(chapter => (
            <div
              key={chapter.id}
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 hover:border-amber-500/50 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-zinc-500">Chapter {chapter.number}</span>
                {chapter.logicAudit && (
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                    Value Shift
                  </span>
                )}
              </div>
              <h4 className="text-sm font-fantasy font-bold text-amber-400 mb-1">{chapter.title}</h4>
              {chapter.summary && (
                <p className="text-xs text-zinc-400 italic line-clamp-2">{chapter.summary}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-6xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Beat Sheet</h2>
        <p className="text-sm text-zinc-400 mt-2">Three-act structure visualization</p>
      </div>

      {novelState.chapters.length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Chapters Yet</h3>
          <p className="text-sm text-zinc-500">Generate chapters to see the three-act structure.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderAct(beats.act1, 'Act I: Setup', 'bg-emerald-950/20 border-emerald-700/30')}
          {renderAct(beats.act2, 'Act II: Confrontation', 'bg-amber-950/20 border-amber-700/30')}
          {renderAct(beats.act3, 'Act III: Resolution', 'bg-red-950/20 border-red-700/30')}
        </div>
      )}
    </div>
  );
};

export default memo(BeatSheetView);
