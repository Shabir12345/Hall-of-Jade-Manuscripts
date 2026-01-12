import React, { useState } from 'react';
import { NovelState, Arc, Chapter } from '../types';
import { useLoading } from '../contexts/LoadingContext';

interface ManualEditorDialogProps {
  isOpen: boolean;
  novelState: NovelState;
  onSelectArc: (arc: Arc, editMode: 'manual' | 'automatic') => void | Promise<void>;
  onSelectChapters: (startChapter: number, endChapter: number, editMode: 'manual' | 'automatic') => void | Promise<void>;
  onSelectSpecificChapters: (chapterNumbers: number[], editMode: 'manual' | 'automatic') => void | Promise<void>;
  onCancel: () => void;
}

const ManualEditorDialog: React.FC<ManualEditorDialogProps> = ({
  isOpen,
  novelState,
  onSelectArc,
  onSelectChapters,
  onSelectSpecificChapters,
  onCancel,
}) => {
  const { loadingState } = useLoading();
  const [mode, setMode] = useState<'arc' | 'range' | 'specific'>('arc');
  const [editMode, setEditMode] = useState<'manual' | 'automatic'>('manual');
  const [selectedArcId, setSelectedArcId] = useState<string>('');
  const [startChapter, setStartChapter] = useState<number>(1);
  const [endChapter, setEndChapter] = useState<number>(5);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  // Use global loading state instead of local state
  const isProcessing = loadingState.isLoading;

  if (!isOpen) return null;

  // Filter for completed arcs with valid chapter ranges
  // An arc is valid for review if:
  // 1. It's marked as completed
  // 2. It has both start and end chapter numbers (and they're valid numbers > 0)
  // 3. There are actually chapters in that range
  // 
  // If chapter numbers are missing, try to infer them from other arcs
  const completedArcs = novelState.plotLedger
    .filter(a => a.status === 'completed')
    .map(a => {
      let startChapter = a.startedAtChapter;
      let endChapter = a.endedAtChapter;
      let needsInference = false;
      
      // If start is missing, try to infer from previous completed arc's end
      if (!startChapter || startChapter <= 0) {
        const sortedArcs = novelState.plotLedger
          .filter(arc => arc.id !== a.id && arc.status === 'completed' && arc.endedAtChapter)
          .sort((x, y) => (x.endedAtChapter || 0) - (y.endedAtChapter || 0));
        
        const previousArc = sortedArcs
          .filter(arc => (arc.endedAtChapter || 0) < (endChapter || Infinity))
          .pop(); // Get the last one (highest end chapter before this arc)
        
        startChapter = previousArc ? (previousArc.endedAtChapter! + 1) : 1;
        needsInference = true;
      }
      
      // If end is missing, try to infer from next arc's start or use last chapter
      if (!endChapter || endChapter <= 0) {
        const sortedArcs = novelState.plotLedger
          .filter(arc => arc.id !== a.id && arc.startedAtChapter)
          .sort((x, y) => (x.startedAtChapter || 0) - (y.startedAtChapter || 0));
        
        const nextArc = sortedArcs.find(arc => (arc.startedAtChapter || 0) > (startChapter || 0));
        
        endChapter = nextArc ? (nextArc.startedAtChapter! - 1) : (novelState.chapters.length || 0);
        needsInference = true;
      }
      
      // Validate the values
      if (!startChapter || startChapter <= 0 || !endChapter || endChapter <= 0) {
        console.warn(`Arc "${a.title}" cannot be reviewed: invalid chapter range (${startChapter}-${endChapter})`);
        return null;
      }
      
      if (startChapter > endChapter) {
        console.warn(`Arc "${a.title}" cannot be reviewed: start (${startChapter}) > end (${endChapter})`);
        return null;
      }
      
      // Verify there are chapters in this range
      const chaptersInRange = novelState.chapters.filter(
        ch => ch.number >= startChapter! && ch.number <= endChapter!
      );
      
      if (chaptersInRange.length === 0) {
        console.warn(`Arc "${a.title}" has no chapters in range ${startChapter}-${endChapter}`);
        return null;
      }
      
      if (needsInference) {
        console.log(`Arc "${a.title}": inferred chapter range ${startChapter}-${endChapter} (original: ${a.startedAtChapter || 'missing'}-${a.endedAtChapter || 'missing'})`);
      }
      
      // Return arc with inferred values if needed
      return needsInference ? {
        ...a,
        startedAtChapter: startChapter,
        endedAtChapter: endChapter,
      } : a;
    })
    .filter((a): a is Arc => a !== null);
  
  const allChapters = novelState.chapters.sort((a, b) => a.number - b.number);

  const handleArcSelect = () => {
    const arc = completedArcs.find(a => a.id === selectedArcId);
    if (arc) {
      // The onSelectArc handler in App.tsx will close the dialog and start the review
      // The global loading state will be set there
      onSelectArc(arc, editMode).catch((error) => {
        console.error('Error starting arc review:', error);
      });
    }
  };

  const handleRangeSelect = () => {
    if (startChapter <= endChapter && startChapter > 0 && endChapter <= allChapters.length) {
      // The onSelectChapters handler in App.tsx will close the dialog and start the review
      // The global loading state will be set there
      onSelectChapters(startChapter, endChapter, editMode).catch((error) => {
        console.error('Error starting range review:', error);
      });
    }
  };

  const handleSpecificSelect = () => {
    if (selectedChapters.size > 0) {
      // The onSelectSpecificChapters handler in App.tsx will close the dialog and start the review
      // The global loading state will be set there
      onSelectSpecificChapters(Array.from(selectedChapters).sort((a, b) => a - b), editMode).catch((error) => {
        console.error('Error starting specific chapters review:', error);
      });
    }
  };

  const toggleChapterSelection = (chapterNumber: number) => {
    const newSet = new Set(selectedChapters);
    if (newSet.has(chapterNumber)) {
      newSet.delete(chapterNumber);
    } else {
      newSet.add(chapterNumber);
    }
    setSelectedChapters(newSet);
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-zinc-900 border border-blue-500/50 bg-blue-950/20 p-6 md:p-8 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl animate-in scale-in overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl md:text-2xl font-fantasy font-bold text-zinc-100 mb-4">
          Manual Editor Review
        </h3>
        
        <p className="text-sm text-zinc-400 mb-6">
          Select what you want the editor to review and analyze.
        </p>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-950/30 border border-blue-500/50 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-400">Starting review...</p>
                <p className="text-xs text-zinc-400 mt-1">Preparing analysis. This may take a moment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Mode Selection */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setMode('arc')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              mode === 'arc'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Review Arc
          </button>
          <button
            onClick={() => setMode('range')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              mode === 'range'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Chapter Range
          </button>
          <button
            onClick={() => setMode('specific')}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
              mode === 'specific'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Specific Chapters
          </button>
        </div>

        {/* Editing Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-2">
            Editing Mode
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setEditMode('manual')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                editMode === 'manual'
                  ? 'bg-amber-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Manual (Review & Approve)
            </button>
            <button
              onClick={() => setEditMode('automatic')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                editMode === 'automatic'
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Automatic (Apply All)
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {editMode === 'manual' 
              ? 'You will review and approve each fix before it is applied.'
              : 'All fixes will be applied automatically without confirmation.'}
          </p>
        </div>

        {/* Arc Selection Mode */}
        {mode === 'arc' && (
          <div className="flex-1 overflow-y-auto mb-6">
            {completedArcs.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">
                No completed arcs available for review.
              </p>
            ) : (
              <div className="space-y-3">
                {completedArcs.map((arc) => (
                  <button
                    key={arc.id}
                    onClick={() => setSelectedArcId(arc.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedArcId === arc.id
                        ? 'border-blue-500 bg-blue-950/30'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-zinc-200">{arc.title}</h4>
                      <span className="text-xs text-zinc-500">
                        Ch {arc.startedAtChapter}-{arc.endedAtChapter}
                      </span>
                    </div>
                    {arc.description && (
                      <p className="text-sm text-zinc-400 line-clamp-2">{arc.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Range Selection Mode */}
        {mode === 'range' && (
          <div className="flex-1 overflow-y-auto mb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">
                Start Chapter (1-{allChapters.length})
              </label>
              <input
                type="number"
                min="1"
                max={allChapters.length}
                value={startChapter}
                onChange={(e) => setStartChapter(Math.max(1, Math.min(allChapters.length, parseInt(e.target.value) || 1)))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                aria-label="Start chapter number"
                title="Start chapter number"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">
                End Chapter ({startChapter}-{allChapters.length})
              </label>
              <input
                type="number"
                min={startChapter}
                max={allChapters.length}
                value={endChapter}
                onChange={(e) => setEndChapter(Math.max(startChapter, Math.min(allChapters.length, parseInt(e.target.value) || startChapter)))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:border-blue-500"
                aria-label="End chapter number"
                title="End chapter number"
              />
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
              <p className="text-xs text-zinc-500 mb-1">Chapters to review:</p>
              <p className="text-sm text-zinc-300 font-semibold">
                {startChapter} - {endChapter} ({endChapter - startChapter + 1} chapters)
              </p>
            </div>
          </div>
        )}

        {/* Specific Chapters Selection Mode */}
        {mode === 'specific' && (
          <div className="flex-1 overflow-y-auto mb-6">
            <p className="text-sm text-zinc-400 mb-4">
              Select specific chapters to review (click to toggle):
            </p>
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
              {allChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => toggleChapterSelection(chapter.number)}
                  className={`p-2 rounded-lg text-sm font-semibold transition-all ${
                    selectedChapters.has(chapter.number)
                      ? 'bg-blue-600 text-white border-2 border-blue-400'
                      : 'bg-zinc-800 text-zinc-400 border-2 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  {chapter.number}
                </button>
              ))}
            </div>
            {selectedChapters.size > 0 && (
              <div className="mt-4 bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                <p className="text-xs text-zinc-500 mb-1">Selected chapters:</p>
                <p className="text-sm text-zinc-300 font-semibold">
                  {Array.from(selectedChapters).sort((a, b) => a - b).join(', ')} ({selectedChapters.size} chapters)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-zinc-700">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200"
            aria-label="Cancel editor review"
          >
            Cancel
          </button>
          {mode === 'arc' && (
            <button
              onClick={handleArcSelect}
              disabled={!selectedArcId || isProcessing}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label={isProcessing ? 'Starting arc review' : 'Review selected arc'}
              {...(isProcessing && { 'aria-busy': 'true' })}
            >
              {isProcessing && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true"></div>
              )}
              {isProcessing ? 'Starting Review...' : 'Review Arc'}
            </button>
          )}
          {mode === 'range' && (
            <button
              onClick={handleRangeSelect}
              disabled={startChapter > endChapter || startChapter < 1 || endChapter > allChapters.length || isProcessing}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label={isProcessing ? 'Starting chapter range review' : `Review chapters ${startChapter} to ${endChapter}`}
              {...(isProcessing && { 'aria-busy': 'true' })}
            >
              {isProcessing && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true"></div>
              )}
              {isProcessing ? 'Starting Review...' : 'Review Range'}
            </button>
          )}
          {mode === 'specific' && (
            <button
              onClick={handleSpecificSelect}
              disabled={selectedChapters.size === 0 || isProcessing}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              aria-label={isProcessing ? 'Starting review' : `Review ${selectedChapters.size} selected chapter${selectedChapters.size !== 1 ? 's' : ''}`}
              {...(isProcessing && { 'aria-busy': 'true' })}
            >
              {isProcessing && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" aria-hidden="true"></div>
              )}
              {isProcessing ? 'Starting Review...' : `Review Selected (${selectedChapters.size})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualEditorDialog;
