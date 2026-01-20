
import React, { useState, useMemo, memo } from 'react';
import { NovelState } from '../types';
import { NOVEL_TEMPLATES, type NovelTemplate, applyNovelTemplate } from '../utils/templates';

interface LibraryViewProps {
  novels: NovelState[];
  onSelect: (id: string) => void;
  onCreate: (title: string, genre: string) => void;
  onDelete: (id: string) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ novels, onSelect, onCreate, onDelete }) => {
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('Xianxia');
  const [selectedNovels, setSelectedNovels] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NovelTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const totalWords = useMemo(
    () => novels.reduce((acc, n) => acc + n.chapters.reduce((cAcc, c) => cAcc + c.content.split(/\s+/).length, 0), 0),
    [novels]
  );

  const sortedNovels = useMemo(
    () => [...novels].sort((a, b) => b.updatedAt - a.updatedAt),
    [novels]
  );

  const availableTemplates = useMemo(
    () => NOVEL_TEMPLATES.filter(t => t.genre === newGenre),
    [newGenre]
  );

  const handleTemplateSelect = (template: NovelTemplate) => {
    setSelectedTemplate(template);
    setNewTitle(template.name);
    setShowTemplates(false);
  };

  const handleCreateWithTemplate = () => {
    if (!newTitle.trim()) return;
    
    if (selectedTemplate) {
      const templateData = applyNovelTemplate(selectedTemplate, newTitle.trim());
      // Note: onCreate only accepts title and genre, so we'll need to extend it
      // For now, just use the template's genre
      onCreate(newTitle.trim(), selectedTemplate.genre);
    } else {
      onCreate(newTitle.trim(), newGenre);
    }
    
    setShowModal(false);
    setNewTitle('');
    setSelectedTemplate(null);
    setShowTemplates(false);
  };

  const handleSelectAll = () => {
    if (selectedNovels.size === novels.length) {
      setSelectedNovels(new Set());
    } else {
      setSelectedNovels(new Set(novels.map(n => n.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedNovels.size === 0) return;
    const count = selectedNovels.size;
    if (window.confirm(`Delete ${count} novel${count !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      selectedNovels.forEach(novelId => {
        onDelete(novelId);
      });
      setSelectedNovels(new Set());
      setIsBulkMode(false);
    }
  };

  const handleNovelClick = (novelId: string) => {
    if (isBulkMode) {
      setSelectedNovels(prev => {
        const next = new Set(prev);
        if (next.has(novelId)) {
          next.delete(novelId);
        } else {
          next.add(novelId);
        }
        return next;
      });
    } else {
      onSelect(novelId);
    }
  };

  return (
    <div 
      className="min-h-screen min-h-dvh bg-zinc-950 p-3 xs:p-4 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto scroll-smooth-mobile"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}
    >
      <div className="max-w-5xl mx-auto space-y-4 xs:space-y-6 md:space-y-8">
        {/* Header - mobile-first stack layout */}
        <header className="flex flex-col gap-3 xs:gap-4">
          {/* Title section */}
          <div className="space-y-1 xs:space-y-2">
            <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider break-words">HALL OF JADE MANUSCRIPTS</h1>
            <p className="text-zinc-400 font-medium tracking-tight uppercase text-xs xs:text-sm">The Apex Sovereign's Personal Collection</p>
          </div>
          
          {/* Actions and stats - horizontal scroll on mobile */}
          <div className="flex items-center gap-2 xs:gap-3 md:gap-4 overflow-x-auto pb-1 -mx-3 px-3 xs:-mx-4 xs:px-4 md:mx-0 md:px-0 scrollbar-hide">
            {isBulkMode ? (
              <>
                <button
                  onClick={handleSelectAll}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  aria-label={selectedNovels.size === novels.length ? 'Deselect all' : 'Select all'}
                >
                  {selectedNovels.size === novels.length ? 'Deselect' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedNovels.size === 0}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                  aria-label={`Delete ${selectedNovels.size} selected novels`}
                >
                  <span>🗑️</span>
                  <span className="hidden xs:inline">Delete</span>
                  <span>({selectedNovels.size})</span>
                </button>
                <button
                  onClick={() => {
                    setIsBulkMode(false);
                    setSelectedNovels(new Set());
                  }}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0"
                  aria-label="Cancel bulk mode"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsBulkMode(true)}
                  className="px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-xs xs:text-sm transition-all duration-200 flex items-center gap-1 xs:gap-2 whitespace-nowrap flex-shrink-0"
                  aria-label="Enable bulk selection mode"
                >
                  <span>☑️</span>
                  <span className="hidden xs:inline">Bulk</span>
                </button>
                {/* Stats - compact on mobile */}
                <div className="flex items-center gap-3 xs:gap-4 sm:gap-6 md:gap-8 text-right ml-auto flex-shrink-0">
                  <div className="text-center xs:text-right">
                    <p className="text-xl xs:text-2xl md:text-3xl font-fantasy font-bold text-zinc-100">{novels.length}</p>
                    <p className="text-[10px] xs:text-xs text-zinc-500 font-semibold uppercase mt-0.5 xs:mt-1">Epics</p>
                  </div>
                  <div className="text-center xs:text-right">
                    <p className="text-xl xs:text-2xl md:text-3xl font-fantasy font-bold text-zinc-100">{totalWords.toLocaleString()}</p>
                    <p className="text-[10px] xs:text-xs text-zinc-500 font-semibold uppercase mt-0.5 xs:mt-1">Words</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Novel grid - responsive columns */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 md:gap-6 lg:gap-8">
          {/* Create new button */}
          <button 
            onClick={() => setShowModal(true)}
            aria-label="Create new novel"
            className="group relative h-48 xs:h-56 md:h-64 min-h-[192px] xs:min-h-[224px] md:min-h-[256px] border-2 border-dashed border-zinc-700 rounded-xl xs:rounded-2xl flex flex-col items-center justify-center hover:border-amber-500/50 hover:bg-amber-600/5 transition-all duration-300 focus-visible:outline-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div className="w-12 h-12 xs:w-14 xs:h-14 md:w-16 md:h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 group-hover:text-amber-500 group-hover:scale-110 transition-all duration-300">
              <span className="text-2xl xs:text-3xl md:text-4xl leading-none">+</span>
            </div>
            <p className="mt-2 xs:mt-3 md:mt-4 font-fantasy text-xs xs:text-sm md:text-base font-semibold text-zinc-400 group-hover:text-amber-500 transition-colors">New Seed</p>
          </button>

          {/* Empty state */}
          {novels.length === 0 && (
            <div className="col-span-full py-8 xs:py-12 md:py-16 px-4 xs:px-6 md:px-8 text-center border-2 border-dashed border-zinc-700 rounded-xl xs:rounded-2xl bg-zinc-900/30">
              <div className="text-4xl xs:text-5xl md:text-6xl mb-3 xs:mb-4">📜</div>
              <h3 className="text-base xs:text-lg md:text-xl font-fantasy font-bold text-zinc-300 mb-2">No Manuscripts Yet</h3>
              <p className="text-xs xs:text-sm text-zinc-500 mb-4 xs:mb-6">Begin your epic journey by creating your first novel.</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3 xs:px-4 py-2 rounded-lg xs:rounded-xl font-semibold text-xs xs:text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
              >
                Create Your First Novel
              </button>
            </div>
          )}

          {sortedNovels.map((novel) => {
            const isSelected = selectedNovels.has(novel.id);
            return (
              <div
                key={novel.id}
                className={`group relative h-48 xs:h-56 md:h-64 min-h-[192px] xs:min-h-[224px] md:min-h-[256px] bg-zinc-900/60 border rounded-xl xs:rounded-2xl hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 ${
                  isBulkMode
                    ? isSelected
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-zinc-700 hover:border-zinc-600'
                    : 'border-zinc-700 hover:border-amber-600/50'
                }`}
              >
                {isBulkMode && (
                  <div className="absolute top-3 xs:top-4 md:top-5 left-3 xs:left-4 md:left-5 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleNovelClick(novel.id)}
                      className="w-4 h-4 xs:w-5 xs:h-5 rounded border-zinc-600 bg-zinc-800 text-amber-600 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                      aria-label={`Select ${novel.title}`}
                    />
                  </div>
                )}
                {/* Open button (covers the card) */}
                <button
                  type="button"
                  onClick={() => handleNovelClick(novel.id)}
                  className="w-full h-full p-3 xs:p-4 md:p-6 flex flex-col justify-between text-left cursor-pointer rounded-xl xs:rounded-2xl focus-visible:outline-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={isBulkMode ? `Select ${novel.title}` : `Open ${novel.title}`}
                >
                <div className="space-y-1.5 xs:space-y-2 md:space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] xs:text-xs font-bold text-amber-600 uppercase tracking-wider px-1.5 xs:px-2 py-0.5 xs:py-1 bg-amber-600/10 rounded-md truncate max-w-[70%]">
                      {novel.genre}
                    </span>
                    {/* Spacer so the delete button doesn't overlap content */}
                    <span className="w-6 h-6 xs:w-7 xs:h-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-base xs:text-lg md:text-xl lg:text-2xl font-fantasy font-bold text-zinc-100 group-hover:text-amber-500 transition-colors leading-tight line-clamp-2 break-words">
                    {novel.title}
                  </h3>
                  <p className="text-xs xs:text-sm text-zinc-400 italic line-clamp-2 leading-relaxed hidden xs:block">
                    "{novel.grandSaga || 'No grand saga defined yet...'}"
                  </p>
                </div>

                <div className="flex justify-between items-end border-t border-zinc-700 pt-2 xs:pt-3 md:pt-4 mt-2 xs:mt-3 md:mt-4">
                  <div>
                    <p className="text-base xs:text-lg font-fantasy font-bold text-zinc-300">{novel.chapters.length}</p>
                    <p className="text-[10px] xs:text-xs text-zinc-500 uppercase font-semibold">Ch.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] xs:text-xs text-zinc-500 font-semibold uppercase hidden xs:block">Last Forged</p>
                    <p className="text-[10px] xs:text-xs text-zinc-400 mt-0.5 xs:mt-1">{new Date(novel.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>

              {/* Delete button (separate interactive control; NOT nested inside the open button) */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(novel.id); }}
                className="absolute top-3 xs:top-4 md:top-5 right-3 xs:right-4 md:right-5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full w-6 h-6 xs:w-7 xs:h-7 flex items-center justify-center transition-all duration-200 focus-visible:outline-red-600 focus-visible:outline-2"
                aria-label={`Delete ${novel.title}`}
                title="Delete Novel"
              >
                ×
              </button>

              <div className="absolute top-3 xs:top-4 right-3 xs:right-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
                <span className="text-2xl xs:text-3xl md:text-4xl grayscale brightness-50">📜</span>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {/* Create Modal - mobile-optimized */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-end xs:items-center justify-center z-50 p-0 xs:p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-700 p-4 xs:p-6 md:p-8 lg:p-10 rounded-t-2xl xs:rounded-2xl w-full max-w-lg shadow-2xl space-y-4 xs:space-y-5 md:space-y-6 animate-in slide-in-from-bottom xs:scale-in"
            style={{ maxHeight: 'calc(100dvh - 2rem)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider">NEW STORY SEED</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-300 w-9 h-9 xs:w-10 xs:h-10 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200 text-xl"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 xs:space-y-5 md:space-y-6">
              <div className="space-y-1.5 xs:space-y-2">
                <label className="text-xs xs:text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="novel-title">Manuscript Title</label>
                <input 
                  id="novel-title"
                  autoFocus
                  placeholder="e.g., Renegade Immortal Reborn"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg xs:rounded-xl p-3 xs:p-4 text-sm xs:text-base text-zinc-100 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-required="true"
                  aria-label="Manuscript Title"
                  aria-describedby="title-help"
                />
                <span id="title-help" className="sr-only">Enter a title for your new novel</span>
              </div>
              <div className="space-y-1.5 xs:space-y-2">
                <label className="text-xs xs:text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="novel-genre">Genre Essence</label>
                <span id="genre-help" className="sr-only">Select the genre for your novel</span>
                <select 
                  id="novel-genre"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg xs:rounded-xl p-3 xs:p-4 text-sm xs:text-base text-zinc-100 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all appearance-none cursor-pointer"
                  aria-label="Genre Essence"
                  aria-required="true"
                  aria-describedby="genre-help"
                >
                  <option>Xianxia</option>
                  <option>Xuanhuan</option>
                  <option>LitRPG / System</option>
                  <option>Reincarnation / Isekai</option>
                  <option>Urban Cultivation</option>
                </select>
              </div>
            </div>
            {/* Action buttons - stacked on very small screens */}
            <div className="flex flex-col-reverse xs:flex-row justify-end gap-2 xs:gap-3 md:gap-4 pt-3 xs:pt-4 border-t border-zinc-700">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-4 xs:px-6 py-2.5 xs:py-3 text-zinc-400 hover:text-zinc-200 transition-colors duration-200 uppercase font-semibold text-xs xs:text-sm focus-visible:outline-amber-600 focus-visible:outline-2 rounded-lg hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateWithTemplate}
                disabled={!newTitle.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 xs:px-6 md:px-8 py-2.5 xs:py-3 rounded-lg xs:rounded-xl font-semibold text-xs xs:text-sm transition-all duration-200 shadow-lg shadow-amber-900/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Create Manuscript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(LibraryView);
