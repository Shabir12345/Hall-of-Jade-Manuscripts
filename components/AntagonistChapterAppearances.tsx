import React, { useState, useEffect } from 'react';
import { Antagonist, AntagonistChapterAppearance, Chapter } from '../types';
import { getAntagonistsForChapter } from '../services/antagonistService';
import { supabase } from '../services/supabaseService';

interface AntagonistChapterAppearancesProps {
  antagonist: Antagonist;
  chapters: Chapter[];
  onChapterClick?: (chapterId: string) => void;
}

const AntagonistChapterAppearances: React.FC<AntagonistChapterAppearancesProps> = ({
  antagonist,
  chapters,
  onChapterClick
}) => {
  const [appearances, setAppearances] = useState<AntagonistChapterAppearance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAppearances = async () => {
      try {
        // Get all chapter appearances for this antagonist
        const { data, error } = await supabase
          .from('antagonist_chapters')
          .select('*')
          .eq('antagonist_id', antagonist.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading chapter appearances:', error);
          setAppearances([]);
        } else {
          setAppearances((data || []).map(a => ({
            id: a.id,
            antagonistId: a.antagonist_id,
            chapterId: a.chapter_id,
            presenceType: a.presence_type as any,
            significance: a.significance as 'major' | 'minor' | 'foreshadowing',
            notes: a.notes || '',
            createdAt: new Date(a.created_at).getTime(),
          })));
        }
      } catch (error) {
        console.error('Error loading chapter appearances:', error);
        setAppearances([]);
      } finally {
        setLoading(false);
      }
    };

    loadAppearances();
  }, [antagonist.id]);

  const getChapter = (chapterId: string): Chapter | undefined => {
    return chapters.find(c => c.id === chapterId);
  };

  const getPresenceTypeColor = (type: string) => {
    switch (type) {
      case 'direct':
        return 'bg-red-950/40 text-red-400 border-red-900/40';
      case 'mentioned':
        return 'bg-orange-950/40 text-orange-400 border-orange-900/40';
      case 'hinted':
        return 'bg-yellow-950/40 text-yellow-400 border-yellow-900/40';
      case 'influence':
        return 'bg-blue-950/40 text-blue-400 border-blue-900/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'major':
        return 'bg-red-950/60 text-red-300 border-red-900/60';
      case 'minor':
        return 'bg-yellow-950/60 text-yellow-300 border-yellow-900/60';
      case 'foreshadowing':
        return 'bg-purple-950/60 text-purple-300 border-purple-900/60';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl">
        <div className="text-sm text-zinc-400">Loading chapter appearances...</div>
      </div>
    );
  }

  if (appearances.length === 0) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl">
        <div className="text-sm text-zinc-400 italic">
          No chapter appearances recorded yet. Appearances will be tracked automatically when this antagonist appears in chapters.
        </div>
      </div>
    );
  }

  // Group appearances by chapter number for better display
  const appearancesByChapter = appearances.reduce((acc, appearance) => {
    const chapter = getChapter(appearance.chapterId);
    const chapterNum = chapter?.number || 0;
    if (!acc[chapterNum]) {
      acc[chapterNum] = [];
    }
    acc[chapterNum].push({ appearance, chapter });
    return acc;
  }, {} as Record<number, Array<{ appearance: AntagonistChapterAppearance; chapter?: Chapter }>>);

  const sortedChapterNumbers = Object.keys(appearancesByChapter)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-fantasy font-bold text-amber-500">Chapter Appearances</h3>
        <div className="text-sm text-zinc-400">
          {appearances.length} appearance{appearances.length !== 1 ? 's' : ''} across {sortedChapterNumbers.length} chapter{sortedChapterNumbers.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-3">
        {sortedChapterNumbers.map(chapterNum => {
          const chapterAppearances = appearancesByChapter[chapterNum];
          const firstAppearance = chapterAppearances[0];
          const chapter = firstAppearance.chapter;

          return (
            <div
              key={chapterNum}
              className={`bg-zinc-900/60 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-colors ${
                onChapterClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => chapter && onChapterClick?.(chapter.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-amber-400">
                    Chapter {chapterNum}
                  </div>
                  {chapter && (
                    <div className="text-sm text-zinc-400 italic">
                      {chapter.title}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {chapterAppearances.map(({ appearance }) => (
                  <React.Fragment key={appearance.id}>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getPresenceTypeColor(appearance.presenceType)}`}>
                      {appearance.presenceType}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${getSignificanceColor(appearance.significance)}`}>
                      {appearance.significance}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {chapterAppearances.some(({ appearance }) => appearance.notes) && (
                <div className="mt-2 pt-2 border-t border-zinc-700">
                  {chapterAppearances
                    .filter(({ appearance }) => appearance.notes)
                    .map(({ appearance }) => (
                      <div key={appearance.id} className="text-xs text-zinc-400 italic mb-1">
                        {appearance.notes}
                      </div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-700">
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Direct</div>
          <div className="text-lg font-bold text-red-400">
            {appearances.filter(a => a.presenceType === 'direct').length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Mentioned</div>
          <div className="text-lg font-bold text-orange-400">
            {appearances.filter(a => a.presenceType === 'mentioned').length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Hinted</div>
          <div className="text-lg font-bold text-yellow-400">
            {appearances.filter(a => a.presenceType === 'hinted').length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Influence</div>
          <div className="text-lg font-bold text-blue-400">
            {appearances.filter(a => a.presenceType === 'influence').length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AntagonistChapterAppearances;
