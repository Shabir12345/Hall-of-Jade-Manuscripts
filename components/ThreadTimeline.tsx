import React, { useMemo } from 'react';
import { StoryThread, NovelState } from '../types';
import { EntityLink } from './EntityLink';

interface ThreadTimelineProps {
  thread: StoryThread;
  novelState: NovelState;
  currentChapter: number;
}

const ThreadTimeline: React.FC<ThreadTimelineProps> = ({ thread, novelState, currentChapter }) => {
  const timelineData = useMemo(() => {
    const events: Array<{
      chapterNumber: number;
      type: 'introduced' | 'progressed' | 'resolved';
      label: string;
      note?: string;
      significance?: 'major' | 'minor';
    }> = [];

    // Add introduction event
    events.push({
      chapterNumber: thread.introducedChapter,
      type: 'introduced',
      label: 'Introduced',
      note: thread.description,
    });

    // Add progression events
    if (thread.progressionNotes && thread.progressionNotes.length > 0) {
      thread.progressionNotes.forEach(note => {
        events.push({
          chapterNumber: note.chapterNumber,
          type: 'progressed',
          label: 'Progressed',
          note: note.note,
          significance: note.significance,
        });
      });
    }

    // Add resolution event if resolved
    if (thread.resolvedChapter) {
      events.push({
        chapterNumber: thread.resolvedChapter,
        type: 'resolved',
        label: 'Resolved',
        note: thread.resolutionNotes,
      });
    }

    // Sort by chapter number
    events.sort((a, b) => a.chapterNumber - b.chapterNumber);

    // Get chapter range
    const minChapter = Math.min(thread.introducedChapter, ...events.map(e => e.chapterNumber));
    const maxChapter = Math.max(
      thread.resolvedChapter || currentChapter,
      ...events.map(e => e.chapterNumber),
      currentChapter
    );

    return { events, minChapter, maxChapter };
  }, [thread, currentChapter]);

  const getEventColor = (type: 'introduced' | 'progressed' | 'resolved') => {
    switch (type) {
      case 'introduced':
        return 'bg-blue-500';
      case 'progressed':
        return 'bg-amber-500';
      case 'resolved':
        return 'bg-emerald-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const getEventIcon = (type: 'introduced' | 'progressed' | 'resolved') => {
    switch (type) {
      case 'introduced':
        return '✨';
      case 'progressed':
        return '📈';
      case 'resolved':
        return '✅';
      default:
        return '●';
    }
  };

  const { events, minChapter, maxChapter } = timelineData;
  const chapterRange = maxChapter - minChapter + 1;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
      <h3 className="text-lg font-bold text-zinc-200 mb-4">Thread Timeline</h3>
      
      {events.length === 0 ? (
        <p className="text-zinc-400 text-sm">No timeline data available</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-zinc-700" />
          
          {/* Events */}
          <div className="space-y-6 relative">
            {events.map((event, idx) => {
              const chapter = novelState.chapters.find(c => c.number === event.chapterNumber);
              const position = ((event.chapterNumber - minChapter) / chapterRange) * 100;
              
              return (
                <div key={idx} className="relative pl-12">
                  {/* Event marker */}
                  <div className="absolute left-0 top-0">
                    <div className={`w-4 h-4 rounded-full ${getEventColor(event.type)} flex items-center justify-center text-xs`}>
                      <span>{getEventIcon(event.type)}</span>
                    </div>
                  </div>
                  
                  {/* Event content */}
                  <div className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      {chapter ? (
                        <EntityLink
                          type="chapter"
                          id={chapter.id}
                          className="text-sm font-semibold text-amber-500 hover:text-amber-400 hover:underline"
                          title={`View Chapter ${event.chapterNumber}: ${chapter.title}`}
                        >
                          Chapter {event.chapterNumber}
                        </EntityLink>
                      ) : (
                        <span className="text-sm font-semibold text-amber-500">Chapter {event.chapterNumber}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        event.type === 'introduced' 
                          ? 'bg-blue-600/20 text-blue-400'
                          : event.type === 'resolved'
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : 'bg-amber-600/20 text-amber-400'
                      }`}>
                        {event.label}
                      </span>
                      {event.significance === 'major' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-600/20 text-amber-400">
                          Major
                        </span>
                      )}
                    </div>
                    {event.note && (
                      <p className="text-sm text-zinc-300 mt-1">{event.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Chapter range indicator */}
          <div className="mt-6 pt-4 border-t border-zinc-700 flex items-center justify-between text-xs text-zinc-500">
            <span>Chapter {minChapter}</span>
            <span className="text-zinc-400">
              {events.length} event{events.length !== 1 ? 's' : ''} across {chapterRange} chapter{chapterRange !== 1 ? 's' : ''}
            </span>
            <span>Chapter {maxChapter}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadTimeline;
