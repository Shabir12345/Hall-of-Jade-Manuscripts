import React, { memo, useMemo, useState, useEffect } from 'react';
import { NovelState, Chapter, Scene, Antagonist } from '../types';
import { getAntagonistsForChapter } from '../services/antagonistService';

interface TimelineViewProps {
  novelState: NovelState;
}

const TimelineView: React.FC<TimelineViewProps> = ({ novelState }) => {
  const [chapterAntagonists, setChapterAntagonists] = useState<Map<string, Antagonist[]>>(new Map());

  useEffect(() => {
    const loadAntagonists = async () => {
      const antagonistMap = new Map<string, Antagonist[]>();
      
      for (const chapter of novelState.chapters) {
        try {
          const appearances = await getAntagonistsForChapter(chapter.id);
          // Convert appearances to antagonists
          const antagonists = appearances
            .map(app => novelState.antagonists?.find(a => a.id === app.antagonistId))
            .filter((a): a is Antagonist => a !== undefined);
          antagonistMap.set(chapter.id, antagonists);
        } catch (error) {
          console.error(`Error loading antagonists for chapter ${chapter.id}:`, error);
          antagonistMap.set(chapter.id, []);
        }
      }
      
      setChapterAntagonists(antagonistMap);
    };
    
    if (novelState.chapters.length > 0) {
      loadAntagonists();
    }
  }, [novelState.id, novelState.chapters]);

  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'chapter' | 'scene'; data: Chapter | Scene; chapter?: Chapter; timestamp: number }> = [];
    
    novelState.chapters.forEach(chapter => {
      items.push({
        type: 'chapter',
        data: chapter,
        timestamp: chapter.createdAt
      });
      
      chapter.scenes.forEach(scene => {
        items.push({
          type: 'scene',
          data: scene,
          chapter,
          timestamp: scene.createdAt
        });
      });
    });
    
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [novelState.chapters]);

  return (
    <div className="p-4 md:p-5 lg:p-6 max-w-4xl mx-auto pt-12 md:pt-16">
      <div className="mb-6 border-b border-zinc-700 pb-4">
        <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Timeline</h2>
        <p className="text-sm text-zinc-400 mt-2">Chronological view of story events</p>
      </div>

      {timelineItems.length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">⏱️</div>
          <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Timeline Data</h3>
          <p className="text-sm text-zinc-500">Chapters and scenes will appear here chronologically.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-700"></div>
          <div className="space-y-8">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="relative flex items-start space-x-6">
                <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                  item.type === 'chapter' 
                    ? 'bg-amber-600/20 border-amber-600' 
                    : 'bg-zinc-800 border-zinc-600'
                }`}>
                  <span className="text-2xl">
                    {item.type === 'chapter' ? '📖' : '🎬'}
                  </span>
                </div>
                <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-all duration-200">
                  {item.type === 'chapter' ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-amber-600 uppercase">Chapter {(item.data as Chapter).number}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date((item.data as Chapter).createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-lg font-fantasy font-bold text-amber-400 mb-2">
                        {(item.data as Chapter).title}
                      </h4>
                      {(item.data as Chapter).summary && (
                        <p className="text-sm text-zinc-400 italic line-clamp-2">
                          {(item.data as Chapter).summary}
                        </p>
                      )}
                      {chapterAntagonists.get((item.data as Chapter).id) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {chapterAntagonists.get((item.data as Chapter).id)?.map(ant => (
                            <span
                              key={ant.id}
                              className={`px-2 py-1 text-xs rounded ${
                                ant.status === 'active' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                ant.status === 'hinted' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'bg-zinc-700/50 text-zinc-400 border border-zinc-600/50'
                              }`}
                              title={ant.description}
                            >
                              {ant.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-500 uppercase">
                          Scene {(item.data as Scene).number} • Ch {item.chapter?.number}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date((item.data as Scene).createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {(item.data as Scene).title && (
                        <h4 className="text-base font-fantasy font-bold text-zinc-300 mb-2">
                          {(item.data as Scene).title}
                        </h4>
                      )}
                      {(item.data as Scene).summary && (
                        <p className="text-sm text-zinc-400 italic line-clamp-2">
                          {(item.data as Scene).summary}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(TimelineView);
