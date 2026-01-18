/**
 * Chapter Antagonists Editor Component
 * Manages antagonists in a chapter
 */

import React from 'react';
import type { NovelState, AntagonistChapterAppearance } from '../../types';
import { getAntagonistsForChapter, addAntagonistToChapter, removeAntagonistFromChapter } from '../../services/antagonistService';

interface ChapterAntagonistsEditorProps {
  chapterId: string;
  novelState: NovelState | undefined;
  antagonists: AntagonistChapterAppearance[];
  isLoading: boolean;
  onRefresh: () => void;
  onAntagonistsChange: (antagonists: AntagonistChapterAppearance[]) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const ChapterAntagonistsEditor: React.FC<ChapterAntagonistsEditorProps> = ({
  chapterId,
  novelState,
  antagonists,
  isLoading,
  onRefresh,
  onAntagonistsChange,
  onSuccess,
  onError,
}) => {
  const handleRemoveAntagonist = async (antagonistId: string) => {
    try {
      await removeAntagonistFromChapter(antagonistId, chapterId);
      const updated = await getAntagonistsForChapter(chapterId);
      onAntagonistsChange(updated);
      onSuccess('Antagonist removed from chapter');
    } catch (error: any) {
      onError(error.message || 'Failed to remove antagonist');
    }
  };

  const handleAddAntagonist = async (antagonistId: string) => {
    const antagonist = novelState?.antagonists?.find(a => a.id === antagonistId);
    if (!antagonist) return;
    
    // Check if already added
    if (antagonists.some(a => a.antagonistId === antagonistId)) {
      onError('Antagonist already added to this chapter');
      return;
    }
    
    try {
      await addAntagonistToChapter(
        antagonistId,
        chapterId,
        'mentioned',
        'minor',
        ''
      );
      const updated = await getAntagonistsForChapter(chapterId);
      onAntagonistsChange(updated);
      onSuccess('Antagonist added to chapter');
    } catch (error: any) {
      onError(error.message || 'Failed to add antagonist');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-fantasy font-bold text-amber-500">Antagonists</h2>
          <button
            onClick={onRefresh}
            className="text-zinc-400 hover:text-zinc-300 px-3 py-2 rounded-lg transition-colors bg-zinc-800 hover:bg-zinc-700"
            title="Refresh antagonists"
            disabled={isLoading}
          >
            {isLoading ? '...' : '↻ Refresh'}
          </button>
        </div>
        <div className="space-y-4">
          {antagonists.length === 0 ? (
            <div className="py-12 text-center bg-zinc-900/50 border border-dashed border-zinc-700 rounded-2xl">
              <p className="text-sm text-zinc-500 italic">No antagonists tracked in this chapter.</p>
            </div>
          ) : (
            antagonists.map(appearance => {
              const antagonist = novelState?.antagonists?.find(a => a.id === appearance.antagonistId);
              if (!antagonist) return null;
              return (
                <div
                  key={appearance.id}
                  className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base font-semibold text-zinc-200">{antagonist.name}</span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          appearance.presenceType === 'direct' ? 'bg-red-500/20 text-red-400' :
                          appearance.presenceType === 'mentioned' ? 'bg-orange-500/20 text-orange-400' :
                          appearance.presenceType === 'hinted' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {appearance.presenceType}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          appearance.significance === 'major' ? 'bg-red-600/30 text-red-300' :
                          appearance.significance === 'minor' ? 'bg-zinc-600/30 text-zinc-300' :
                          'bg-yellow-600/30 text-yellow-300'
                        }`}>
                          {appearance.significance}
                        </span>
                      </div>
                      {appearance.notes && (
                        <p className="text-sm text-zinc-400 italic">{appearance.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAntagonist(appearance.antagonistId)}
                      className="ml-4 text-zinc-500 hover:text-red-400 transition-colors text-lg"
                      title="Remove from chapter"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Add Antagonist Dropdown */}
        {novelState?.antagonists && novelState.antagonists.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2 block">Add Antagonist</label>
            <select
              value=""
              aria-label="Add antagonist to chapter"
              title="Select an antagonist to add to this chapter"
              onChange={(e) => {
                const antagonistId = e.target.value;
                if (!antagonistId) return;
                handleAddAntagonist(antagonistId);
                e.target.value = '';
              }}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            >
              <option value="">+ Add Antagonist</option>
              {novelState.antagonists
                .filter(a => !antagonists.some(ca => ca.antagonistId === a.id))
                .map(ant => (
                  <option key={ant.id} value={ant.id}>
                    {ant.name} ({ant.type})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
