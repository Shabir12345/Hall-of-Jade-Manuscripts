
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
    <div className="min-h-screen bg-zinc-950 p-4 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider">HALL OF JADE MANUSCRIPTS</h1>
            <p className="text-zinc-400 font-medium tracking-tight uppercase text-sm">The Apex Sovereign's Personal Collection</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {isBulkMode ? (
              <>
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-sm transition-all duration-200"
                  aria-label={selectedNovels.size === novels.length ? 'Deselect all' : 'Select all'}
                >
                  {selectedNovels.size === novels.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedNovels.size === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
                  aria-label={`Delete ${selectedNovels.size} selected novels`}
                >
                  <span>🗑️</span>
                  <span>Delete ({selectedNovels.size})</span>
                </button>
                <button
                  onClick={() => {
                    setIsBulkMode(false);
                    setSelectedNovels(new Set());
                  }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-sm transition-all duration-200"
                  aria-label="Cancel bulk mode"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsBulkMode(true)}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
                  aria-label="Enable bulk selection mode"
                >
                  <span>☑️</span>
                  <span>Bulk Select</span>
                </button>
                <div className="flex items-center space-x-6 md:space-x-8 text-right">
                  <div>
                    <p className="text-2xl md:text-3xl font-fantasy font-bold text-zinc-100">{novels.length}</p>
                    <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Active Epics</p>
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-fantasy font-bold text-zinc-100">{totalWords.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Total Words Formed</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <button 
            onClick={() => setShowModal(true)}
            aria-label="Create new novel"
            className="group relative h-64 min-h-[256px] border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center hover:border-amber-500/50 hover:bg-amber-600/5 transition-all duration-300 focus-visible:outline-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 group-hover:text-amber-500 group-hover:scale-110 transition-all duration-300">
              <span className="text-4xl leading-none">+</span>
            </div>
            <p className="mt-4 font-fantasy text-base font-semibold text-zinc-400 group-hover:text-amber-500 transition-colors">Condense New Seed</p>
          </button>

          {novels.length === 0 && (
            <div className="col-span-full py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
              <div className="text-6xl mb-4">📜</div>
              <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Manuscripts Yet</h3>
              <p className="text-sm text-zinc-500 mb-6">Begin your epic journey by creating your first novel.</p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
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
                className={`group relative h-64 min-h-[256px] bg-zinc-900/60 border rounded-2xl hover:shadow-xl hover:shadow-amber-900/10 transition-all duration-300 ${
                  isBulkMode
                    ? isSelected
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-zinc-700 hover:border-zinc-600'
                    : 'border-zinc-700 hover:border-amber-600/50'
                }`}
              >
                {isBulkMode && (
                  <div className="absolute top-5 left-5 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleNovelClick(novel.id)}
                      className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-amber-600 focus:ring-amber-500 focus:ring-2 cursor-pointer"
                      aria-label={`Select ${novel.title}`}
                    />
                  </div>
                )}
                {/* Open button (covers the card) */}
                <button
                  type="button"
                  onClick={() => handleNovelClick(novel.id)}
                  className="w-full h-full p-6 flex flex-col justify-between text-left cursor-pointer rounded-2xl focus-visible:outline-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={isBulkMode ? `Select ${novel.title}` : `Open ${novel.title}`}
                >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider px-2 py-1 bg-amber-600/10 rounded-md">
                      {novel.genre}
                    </span>
                    {/* Spacer so the delete button doesn't overlap content */}
                    <span className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-fantasy font-bold text-zinc-100 group-hover:text-amber-500 transition-colors leading-tight">
                    {novel.title}
                  </h3>
                  <p className="text-sm text-zinc-400 italic line-clamp-2 leading-relaxed">
                    "{novel.grandSaga || 'No grand saga defined yet...'}"
                  </p>
                </div>

                <div className="flex justify-between items-end border-t border-zinc-700 pt-4 mt-4">
                  <div>
                    <p className="text-lg font-fantasy font-bold text-zinc-300">{novel.chapters.length}</p>
                    <p className="text-xs text-zinc-500 uppercase font-semibold">Chapters</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-semibold uppercase">Last Forged</p>
                    <p className="text-xs text-zinc-400 mt-1">{new Date(novel.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>

              {/* Delete button (separate interactive control; NOT nested inside the open button) */}
              <button
                type="button"
                onClick={() => onDelete(novel.id)}
                className="absolute top-5 right-5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-full w-7 h-7 flex items-center justify-center transition-all duration-200 focus-visible:outline-red-600 focus-visible:outline-2"
                aria-label={`Delete ${novel.title}`}
                title="Delete Novel"
              >
                ×
              </button>

              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none">
                <span className="text-4xl grayscale brightness-50">📜</span>
              </div>
            </div>
          );
          })}
        </div>
      </div>

      {showModal && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-zinc-900 border border-zinc-700 p-8 md:p-10 rounded-2xl w-full max-w-lg shadow-2xl space-y-6 animate-in scale-in">
            <div className="flex justify-between items-center">
              <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider">REFINING A NEW STORY SEED</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="novel-title">Manuscript Title</label>
                <input 
                  id="novel-title"
                  autoFocus
                  placeholder="e.g., Renegade Immortal Reborn"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-100 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-required="true"
                  aria-label="Manuscript Title"
                  aria-describedby="title-help"
                />
                <span id="title-help" className="sr-only">Enter a title for your new novel</span>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="novel-genre">Genre Essence</label>
                <span id="genre-help" className="sr-only">Select the genre for your novel</span>
                <select 
                  id="novel-genre"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-100 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all appearance-none cursor-pointer"
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
            <div className="flex justify-end space-x-4 pt-4 border-t border-zinc-700">
              <button 
                onClick={() => setShowModal(false)} 
                className="px-6 py-2.5 text-zinc-400 hover:text-zinc-200 transition-colors duration-200 uppercase font-semibold text-sm focus-visible:outline-amber-600 focus-visible:outline-2"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateWithTemplate}
                disabled={!newTitle.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Manifest Manuscript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(LibraryView);
