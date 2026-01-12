/**
 * Dashboard View Component
 * Main dashboard showing novel overview and statistics
 */

import React, { memo } from 'react';
import type { NovelState } from '../../types';
import { RelatedEntities } from '../RelatedEntities';

interface DashboardViewProps {
  novel: NovelState;
  onGenerateChapter: (instruction?: string) => void;
  isGenerating: boolean;
  generationProgress: number;
  generationStatus: string;
  instruction: string;
  onInstructionChange: (value: string) => void;
  onViewChange: (view: string) => void;
  activeChapterId: string | null;
  onChapterSelect: (chapterId: string) => void;
}

const DashboardViewComponent: React.FC<DashboardViewProps> = ({
  novel,
  onGenerateChapter,
  isGenerating,
  generationProgress,
  generationStatus,
  instruction,
  onInstructionChange,
  onViewChange,
  activeChapterId,
  onChapterSelect,
}) => {
  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-300 pt-20 md:pt-24">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-700 pb-6 md:pb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-3xl md:text-4xl font-fantasy font-bold text-amber-500 break-words">{novel.title}</h2>
          <p className="text-zinc-400 mt-3 flex items-center text-sm flex-wrap gap-2">
            <span className="bg-zinc-800 px-3 py-1 rounded-lg border border-zinc-700">{novel.genre}</span>
            <span className="text-zinc-600">•</span>
            <span>{novel.chapters.length} Chapter{novel.chapters.length !== 1 ? 's' : ''}</span>
            <span className="text-zinc-600">•</span>
            <span>{novel.characterCodex.length} Character{novel.characterCodex.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
      </header>

      {/* Generation Section */}
      <section className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 md:p-8 space-y-6">
        <h3 className="text-xl font-fantasy font-bold text-amber-400">Next Chapter Generation</h3>
        <div className="space-y-4">
          <textarea
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            placeholder="Optional: Add specific instructions for this chapter (e.g., 'Focus on character development' or 'Introduce a new antagonist')..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-sm text-zinc-200 h-24 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            disabled={isGenerating}
            aria-label="Chapter generation instructions"
            aria-describedby="instruction-description"
          />
          <span id="instruction-description" className="sr-only">
            Optional instructions to guide the AI in generating the next chapter
          </span>
          <button
            onClick={() => onGenerateChapter(instruction)}
            disabled={isGenerating}
            className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-[1.02] disabled:hover:scale-100"
            aria-label={isGenerating ? `Generating chapter, ${generationProgress}% complete` : 'Generate next chapter'}
            {...(isGenerating && { 'aria-busy': 'true' })}
          >
            {isGenerating ? `Generating... (${generationProgress}%)` : 'Generate Next Chapter'}
          </button>
          {isGenerating && generationStatus && (
            <p className="text-sm text-zinc-400 text-center">{generationStatus}</p>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onViewChange('chapters')}
          className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all duration-200 text-left group"
          aria-label={`View chapters, ${novel.chapters.length} total`}
        >
          <div className="text-3xl mb-2" aria-hidden="true">📖</div>
          <div className="text-2xl font-bold text-amber-500 mb-1">{novel.chapters.length}</div>
          <div className="text-sm text-zinc-400">Chapters</div>
        </button>
        <button
          onClick={() => onViewChange('characters')}
          className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all duration-200 text-left group"
          aria-label={`View characters, ${novel.characterCodex.length} total`}
        >
          <div className="text-3xl mb-2" aria-hidden="true">👥</div>
          <div className="text-2xl font-bold text-amber-500 mb-1">{novel.characterCodex.length}</div>
          <div className="text-sm text-zinc-400">Characters</div>
        </button>
        <button
          onClick={() => onViewChange('world-bible')}
          className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all duration-200 text-left group"
          aria-label={`View world bible, ${novel.worldBible.length} entries`}
        >
          <div className="text-3xl mb-2" aria-hidden="true">📚</div>
          <div className="text-2xl font-bold text-amber-500 mb-1">{novel.worldBible.length}</div>
          <div className="text-sm text-zinc-400">World Entries</div>
        </button>
      </section>

      {/* Recent Chapters */}
      {novel.chapters.length > 0 && (
        <section>
          <h3 className="text-xl font-fantasy font-bold text-amber-400 mb-4">Recent Chapters</h3>
          <div className="space-y-3">
            {novel.chapters.slice(-5).reverse().map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => onChapterSelect(chapter.id)}
                className={`w-full text-left bg-zinc-900 border rounded-xl p-4 hover:border-amber-600/50 hover:shadow-lg hover:shadow-amber-900/10 transition-all duration-200 ${
                  activeChapterId === chapter.id ? 'border-amber-600' : 'border-zinc-700'
                }`}
                aria-label={`Select Chapter ${chapter.number}: ${chapter.title}`}
                aria-current={activeChapterId === chapter.id ? 'true' : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-amber-500 font-semibold mb-1">Chapter {chapter.number}</div>
                    <div className="text-base font-bold text-zinc-200 mb-2 truncate">{chapter.title}</div>
                    {chapter.summary && (
                      <div className="text-sm text-zinc-400 line-clamp-2">{chapter.summary}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewChange('editor');
                      onChapterSelect(chapter.id);
                    }}
                    className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 whitespace-nowrap"
                    aria-label={`Edit Chapter ${chapter.number}: ${chapter.title}`}
                  >
                    Edit
                  </button>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Related Entities */}
      <RelatedEntities novel={novel} />
    </div>
  );
};

export const DashboardView = memo(DashboardViewComponent);
