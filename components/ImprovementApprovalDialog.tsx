import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ImprovementActionResult } from '../types/improvement';

interface ImprovementApprovalDialogProps {
  isOpen: boolean;
  improvements: Array<{
    id: string;
    actionResult: ImprovementActionResult;
    actionDescription: string;
  }>;
  onApprove: (approvedIds: string[]) => void;
  onReject: (rejectedIds: string[]) => void;
  onCancel: () => void;
}

const ImprovementApprovalDialog: React.FC<ImprovementApprovalDialogProps> = ({
  isOpen,
  improvements,
  onApprove,
  onReject,
  onCancel,
}) => {
  const [selectedImprovements, setSelectedImprovements] = useState<Set<string>>(new Set(improvements.map(i => i.id)));
  const [rejectedImprovements, setRejectedImprovements] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedImprovements, setExpandedImprovements] = useState<Set<string>>(new Set());

  // Reset state when improvements change
  useEffect(() => {
    if (improvements.length > 0) {
      setSelectedImprovements(new Set(improvements.map(i => i.id)));
      setRejectedImprovements(new Set());
      setCurrentIndex(0);
    }
  }, [improvements]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'a':
        case 'A':
          if (currentImprovement) {
            e.preventDefault();
            toggleSelection(currentImprovement.id);
          }
          break;
        case 'r':
        case 'R':
          if (currentImprovement) {
            e.preventDefault();
            toggleReject(currentImprovement.id);
          }
          break;
        case 'ArrowDown':
        case 'j':
        case 'J':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowUp':
        case 'k':
        case 'K':
          e.preventDefault();
          handlePrevious();
          break;
        case 'Escape':
          e.preventDefault();
          onCancel();
          break;
        case 'Enter':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selectedImprovements.size > 0) {
              handleApprove();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, selectedImprovements, improvements, onCancel]);

  const currentImprovement = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < improvements.length) {
      return improvements[currentIndex];
    }
    return null;
  }, [improvements, currentIndex]);

  const toggleSelection = (id: string) => {
    setSelectedImprovements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        setRejectedImprovements(prevRej => {
          const newRej = new Set(prevRej);
          newRej.delete(id);
          return newRej;
        });
      }
      return newSet;
    });
  };

  const toggleReject = (id: string) => {
    setRejectedImprovements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        setSelectedImprovements(prevSel => {
          const newSel = new Set(prevSel);
          newSel.delete(id);
          return newSel;
        });
      }
      return newSet;
    });
  };

  const handleNext = () => {
    if (currentIndex < improvements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleApprove = () => {
    const approvedIds = Array.from(selectedImprovements);
    onApprove(approvedIds);
  };

  const handleReject = () => {
    const rejectedIds = Array.from(rejectedImprovements);
    onReject(rejectedIds);
  };

  const toggleExpand = (id: string) => {
    setExpandedImprovements(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const approveAll = () => {
    setSelectedImprovements(new Set(improvements.map(i => i.id)));
    setRejectedImprovements(new Set());
  };

  const rejectAll = () => {
    setRejectedImprovements(new Set(improvements.map(i => i.id)));
    setSelectedImprovements(new Set());
  };

  if (!isOpen) return null;
  
  if (improvements.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[70] p-4">
        <div className="bg-zinc-900 border border-amber-500/50 bg-amber-950/20 p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <h3 className="text-xl font-semibold text-amber-400 mb-4">No Improvements to Review</h3>
          <p className="text-zinc-300 mb-6">There are no improvements available for review.</p>
          <button
            onClick={onCancel}
            className="w-full px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isSelected = currentImprovement ? selectedImprovements.has(currentImprovement.id) : false;
  const isRejected = currentImprovement ? rejectedImprovements.has(currentImprovement.id) : false;
  const isExpanded = currentImprovement ? expandedImprovements.has(currentImprovement.id) : false;

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-zinc-900 border border-amber-500/50 bg-amber-950/20 p-6 md:p-8 rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl animate-in scale-in overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-400">
              Review Improvements ({improvements.length} total)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {selectedImprovements.size} approved, {rejectedImprovements.size} rejected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={approveAll}
              className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm font-semibold transition-colors border border-green-600/50"
            >
              Approve All
            </button>
            <button
              onClick={rejectAll}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-semibold transition-colors border border-red-600/50"
            >
              Reject All
            </button>
            <button
              onClick={onCancel}
              className="text-zinc-400 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Navigation */}
        {currentImprovement && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-zinc-400">
                {currentIndex + 1} of {improvements.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === improvements.length - 1}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
            <div className="text-xs text-zinc-500">
              Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">A</kbd> to approve, <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">R</kbd> to reject
            </div>
          </div>
        )}

        {/* Current Improvement Display */}
        {currentImprovement && (
          <div className="flex-1 overflow-y-auto mb-4">
            <div className={`p-4 rounded-lg border-2 ${
              isSelected ? 'border-green-500/50 bg-green-900/20' :
              isRejected ? 'border-red-500/50 bg-red-900/20' :
              'border-zinc-700 bg-zinc-800/50'
            }`}>
              {/* Header with checkbox */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(currentImprovement.id)}
                    className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-2"
                    aria-label={`Select improvement for Chapter ${currentImprovement.actionResult.chapterNumber}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-amber-400">
                        Chapter {currentImprovement.actionResult.chapterNumber}
                        {currentImprovement.actionResult.chapterTitle && (
                          <span className="text-zinc-400 ml-2">: {currentImprovement.actionResult.chapterTitle}</span>
                        )}
                      </span>
                      {currentImprovement.actionResult.sectionAffected && (
                        <span className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-400">
                          {currentImprovement.actionResult.sectionAffected}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-300 mb-2">
                      <strong className="text-amber-400">Problem:</strong> {currentImprovement.actionResult.problemDescription || currentImprovement.actionDescription}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpand(currentImprovement.id)}
                    className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>
              </div>

              {/* Before/After Comparison */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Before */}
                  <div>
                    <h4 className="text-sm font-semibold text-red-400 mb-2">Before</h4>
                    <div className="bg-zinc-950 border border-zinc-700 rounded p-3 max-h-48 overflow-y-auto">
                      {currentImprovement.actionResult.contextBefore && (
                        <p className="text-xs text-zinc-500 mb-2">[... context ...]</p>
                      )}
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">
                        {currentImprovement.actionResult.oldContent?.substring(0, 1000) || 'No content'}
                        {currentImprovement.actionResult.oldContent && currentImprovement.actionResult.oldContent.length > 1000 && '...'}
                      </pre>
                    </div>
                  </div>

                  {/* After */}
                  <div>
                    <h4 className="text-sm font-semibold text-green-400 mb-2">After</h4>
                    <div className="bg-zinc-950 border border-zinc-700 rounded p-3 max-h-48 overflow-y-auto">
                      {currentImprovement.actionResult.contextAfter && (
                        <p className="text-xs text-zinc-500 mb-2">[... context ...]</p>
                      )}
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">
                        {currentImprovement.actionResult.newContent 
                          ? (currentImprovement.actionResult.newContent.length > 1000 
                              ? currentImprovement.actionResult.newContent.substring(0, 1000) + '...'
                              : currentImprovement.actionResult.newContent)
                          : 'No new content available'}
                      </pre>
                    </div>
                  </div>

                  {/* Change Metadata */}
                  {currentImprovement.actionResult.changeMetadata && (
                    <div className="text-xs text-zinc-400">
                      <span>Words: {currentImprovement.actionResult.changeMetadata.wordsBefore} → {currentImprovement.actionResult.changeMetadata.wordsAfter}</span>
                      {currentImprovement.actionResult.changeMetadata.wordChange !== 0 && (
                        <span className={`ml-2 ${currentImprovement.actionResult.changeMetadata.wordChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({currentImprovement.actionResult.changeMetadata.wordChange > 0 ? '+' : ''}{currentImprovement.actionResult.changeMetadata.wordChange})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleReject}
              disabled={rejectedImprovements.size === 0}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                rejectedImprovements.size === 0
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              Reject Selected ({rejectedImprovements.size})
            </button>
            <button
              onClick={handleApprove}
              disabled={selectedImprovements.size === 0}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                selectedImprovements.size === 0
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg hover:scale-105'
              }`}
            >
              Approve Selected ({selectedImprovements.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovementApprovalDialog;
