/**
 * Loom Timeline
 * 
 * Vertical chapter timeline with animated thread lines showing
 * when threads are introduced, progressed, and resolved.
 */

import React, { useMemo } from 'react';
import { LoomThread } from '../../types/loom';
import { Chapter } from '../../types';

interface LoomTimelineProps {
  threads: LoomThread[];
  chapters: Chapter[];
  currentChapter: number;
  onSelectThread: (thread: LoomThread) => void;
}

interface TimelineEvent {
  chapterNumber: number;
  threadId: string;
  threadSignature: string;
  eventType: 'introduced' | 'mentioned' | 'blooming' | 'resolved';
  threadStatus: string;
}

export const LoomTimeline: React.FC<LoomTimelineProps> = ({
  threads,
  chapters,
  currentChapter,
  onSelectThread,
}) => {
  // Build timeline events
  const timelineData = useMemo(() => {
    const events: TimelineEvent[] = [];
    
    threads.forEach(thread => {
      // Introduction event
      events.push({
        chapterNumber: thread.firstChapter,
        threadId: thread.id,
        threadSignature: thread.signature,
        eventType: 'introduced',
        threadStatus: thread.loomStatus,
      });
      
      // Blooming event
      if (thread.bloomingChapter) {
        events.push({
          chapterNumber: thread.bloomingChapter,
          threadId: thread.id,
          threadSignature: thread.signature,
          eventType: 'blooming',
          threadStatus: thread.loomStatus,
        });
      }
      
      // Resolution event (for closed threads)
      if (thread.loomStatus === 'CLOSED') {
        events.push({
          chapterNumber: thread.lastMentionedChapter,
          threadId: thread.id,
          threadSignature: thread.signature,
          eventType: 'resolved',
          threadStatus: thread.loomStatus,
        });
      }
    });
    
    // Sort by chapter
    events.sort((a, b) => a.chapterNumber - b.chapterNumber);
    
    return events;
  }, [threads]);

  // Get chapter range to display
  const displayRange = useMemo(() => {
    const start = Math.max(1, currentChapter - 20);
    const end = currentChapter;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentChapter]);

  // Get active threads for each chapter in range
  const chapterThreads = useMemo(() => {
    const result: Record<number, LoomThread[]> = {};
    
    displayRange.forEach(chNum => {
      result[chNum] = threads.filter(t => 
        t.firstChapter <= chNum && 
        (t.loomStatus !== 'CLOSED' || t.lastMentionedChapter >= chNum)
      );
    });
    
    return result;
  }, [threads, displayRange]);

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'introduced': return 'bg-blue-500';
      case 'blooming': return 'bg-amber-400';
      case 'resolved': return 'bg-emerald-500';
      default: return 'bg-zinc-500';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'introduced': return '✨';
      case 'blooming': return '🌸';
      case 'resolved': return '✅';
      default: return '•';
    }
  };

  return (
    <div className="relative">
      {/* Timeline Legend */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Introduced</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-zinc-400">Blooming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Resolved</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-gradient-to-r from-zinc-500 to-zinc-700" />
          <span className="text-zinc-400">Thread Lifespan</span>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="relative overflow-x-auto pb-4">
        <div className="min-w-max">
          {/* Chapter Headers */}
          <div className="flex items-end mb-4 pl-48">
            {displayRange.map(chNum => (
              <div
                key={chNum}
                className={`w-12 text-center flex-shrink-0 ${
                  chNum === currentChapter ? 'text-amber-400 font-bold' : 'text-zinc-500'
                }`}
              >
                <div className="text-xs">{chNum}</div>
              </div>
            ))}
          </div>

          {/* Thread Lines */}
          <div className="space-y-2">
            {threads
              .filter(t => t.loomStatus !== 'ABANDONED' || !t.intentionalAbandonment)
              .sort((a, b) => a.firstChapter - b.firstChapter)
              .map(thread => {
                const startOffset = Math.max(0, thread.firstChapter - displayRange[0]);
                const endOffset = Math.min(
                  displayRange.length - 1,
                  thread.lastMentionedChapter - displayRange[0]
                );
                const width = Math.max(1, endOffset - startOffset + 1);
                
                // Check if thread is visible in range
                if (thread.firstChapter > displayRange[displayRange.length - 1]) return null;
                if (thread.lastMentionedChapter < displayRange[0]) return null;

                const getThreadColor = () => {
                  if (thread.loomStatus === 'BLOOMING') return 'from-amber-500 to-amber-600';
                  if (thread.loomStatus === 'STALLED') return 'from-red-500 to-red-600';
                  if (thread.loomStatus === 'CLOSED') return 'from-emerald-500 to-emerald-600';
                  if (thread.category === 'SOVEREIGN') return 'from-purple-500 to-purple-600';
                  if (thread.category === 'MAJOR') return 'from-blue-500 to-blue-600';
                  return 'from-zinc-500 to-zinc-600';
                };

                return (
                  <div
                    key={thread.id}
                    className="flex items-center h-8 group cursor-pointer"
                    onClick={() => onSelectThread(thread)}
                  >
                    {/* Thread Label */}
                    <div className="w-48 pr-4 flex-shrink-0">
                      <div className="truncate text-sm text-zinc-300 group-hover:text-amber-400 transition-colors">
                        {thread.title}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {thread.signature}
                      </div>
                    </div>

                    {/* Timeline Bar */}
                    <div className="flex-1 relative h-full flex items-center">
                      {/* Spacer for chapters before thread starts */}
                      <div style={{ width: `${startOffset * 48}px` }} className="flex-shrink-0" />
                      
                      {/* Thread bar */}
                      <div
                        className={`
                          h-3 rounded-full bg-gradient-to-r ${getThreadColor()}
                          group-hover:h-4 transition-all shadow-lg
                          ${thread.loomStatus === 'BLOOMING' ? 'animate-pulse' : ''}
                        `}
                        style={{ width: `${width * 48 - 8}px` }}
                      >
                        {/* Start marker */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400" />
                        
                        {/* End marker */}
                        {thread.loomStatus === 'CLOSED' ? (
                          <div 
                            className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400"
                            style={{ left: `${width * 48 - 12}px` }}
                          />
                        ) : (
                          <div 
                            className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                              thread.loomStatus === 'BLOOMING' ? 'bg-amber-400 animate-ping' :
                              thread.loomStatus === 'STALLED' ? 'bg-red-400' : 'bg-zinc-400'
                            }`}
                            style={{ left: `${width * 48 - 12}px` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Current Chapter Marker */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-amber-500/50"
            style={{ 
              left: `${192 + (currentChapter - displayRange[0]) * 48 + 24}px` 
            }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-600 rounded text-xs font-bold">
              NOW
            </div>
          </div>
        </div>
      </div>

      {/* No threads message */}
      {threads.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <div className="text-4xl mb-4">📊</div>
          <div>No threads to display on timeline</div>
        </div>
      )}
    </div>
  );
};

export default LoomTimeline;
