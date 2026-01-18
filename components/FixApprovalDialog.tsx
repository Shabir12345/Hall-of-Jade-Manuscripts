import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EditorFixProposal, IssueType, IssueSeverity } from '../types/editor';
import { getIssueTypeColor } from '../utils/reportUtils';

interface FixApprovalDialogProps {
  isOpen: boolean;
  proposals: EditorFixProposal[];
  onApprove: (approvedFixIds: string[]) => void;
  onReject: (rejectedFixIds: string[]) => void;
  onCancel: () => void;
}

const FixApprovalDialog: React.FC<FixApprovalDialogProps> = ({
  isOpen,
  proposals,
  onApprove,
  onReject,
  onCancel,
}) => {
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set(proposals.map(p => p.fix.id)));
  const [rejectedProposals, setRejectedProposals] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set());
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [filterType, setFilterType] = useState<IssueType | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<IssueSeverity | 'all'>('all');
  const [groupByType, setGroupByType] = useState(false);

  // Filter proposals
  const filteredProposals = useMemo(() => {
    let filtered = proposals;
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.issue.type === filterType);
    }
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(p => p.issue.severity === filterSeverity);
    }
    return filtered;
  }, [proposals, filterType, filterSeverity]);

  // Group proposals if needed
  const groupedProposals = useMemo(() => {
    if (!groupByType) return filteredProposals;
    
    const groups = new Map<IssueType, EditorFixProposal[]>();
    filteredProposals.forEach(proposal => {
      const type = proposal.issue.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(proposal);
    });
    
    return Array.from(groups.entries()).flatMap(([_, proposals]) => proposals);
  }, [filteredProposals, groupByType]);

  // Get current proposal
  const currentProposal = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < groupedProposals.length) {
      return groupedProposals[currentIndex];
    }
    return null;
  }, [groupedProposals, currentIndex]);

  // Reset state when proposals change
  useEffect(() => {
    if (proposals.length > 0) {
      setSelectedProposals(new Set(proposals.map(p => p.fix.id)));
      setRejectedProposals(new Set());
      setCurrentIndex(0);
    }
  }, [proposals]);

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
          if (currentProposal) {
            e.preventDefault();
            toggleSelection(currentProposal.fix.id);
          }
          break;
        case 'r':
        case 'R':
          if (currentProposal) {
            e.preventDefault();
            toggleReject(currentProposal.fix.id);
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
            if (selectedProposals.size > 0) {
              handleApprove();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentProposal, selectedProposals, onCancel]);

  const toggleSelection = (fixId: string) => {
    setSelectedProposals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fixId)) {
        newSet.delete(fixId);
      } else {
        newSet.add(fixId);
        setRejectedProposals(prevRej => {
          const newRej = new Set(prevRej);
          newRej.delete(fixId);
          return newRej;
        });
      }
      return newSet;
    });
  };

  const toggleReject = (fixId: string) => {
    setRejectedProposals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fixId)) {
        newSet.delete(fixId);
      } else {
        newSet.add(fixId);
        setSelectedProposals(prevSel => {
          const newSel = new Set(prevSel);
          newSel.delete(fixId);
          return newSel;
        });
      }
      return newSet;
    });
  };

  const handleNext = () => {
    if (currentIndex < groupedProposals.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleApprove = () => {
    const approvedIds = Array.from(selectedProposals);
    onApprove(approvedIds);
  };

  const handleReject = () => {
    const rejectedIds = Array.from(rejectedProposals);
    onReject(rejectedIds);
  };

  // Batch operations
  const approveAllByType = (type: IssueType) => {
    const ids = filteredProposals
      .filter(p => p.issue.type === type)
      .map(p => p.fix.id);
    setSelectedProposals(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => {
        newSet.add(id);
        setRejectedProposals(prevRej => {
          const newRej = new Set(prevRej);
          newRej.delete(id);
          return newRej;
        });
      });
      return newSet;
    });
  };

  const rejectAllByType = (type: IssueType) => {
    const ids = filteredProposals
      .filter(p => p.issue.type === type)
      .map(p => p.fix.id);
    setRejectedProposals(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => {
        newSet.add(id);
        setSelectedProposals(prevSel => {
          const newSel = new Set(prevSel);
          newSel.delete(id);
          return newSel;
        });
      });
      return newSet;
    });
  };

  const approveAllBySeverity = (severity: IssueSeverity) => {
    const ids = filteredProposals
      .filter(p => p.issue.severity === severity)
      .map(p => p.fix.id);
    setSelectedProposals(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => {
        newSet.add(id);
        setRejectedProposals(prevRej => {
          const newRej = new Set(prevRej);
          newRej.delete(id);
          return newRej;
        });
      });
      return newSet;
    });
  };

  const rejectAllBySeverity = (severity: IssueSeverity) => {
    const ids = filteredProposals
      .filter(p => p.issue.severity === severity)
      .map(p => p.fix.id);
    setRejectedProposals(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => {
        newSet.add(id);
        setSelectedProposals(prevSel => {
          const newSel = new Set(prevSel);
          newSel.delete(id);
          return newSel;
        });
      });
      return newSet;
    });
  };

  const toggleExpand = (fixId: string) => {
    setExpandedProposals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fixId)) {
        newSet.delete(fixId);
      } else {
        newSet.add(fixId);
      }
      return newSet;
    });
  };

  const getIssueTypeColor = (type: string): string => {
    switch (type) {
      case 'gap':
        return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'transition':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'continuity':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'character_consistency':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'plot_hole':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/50';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
    }
  };

  // Get unique types and severities for batch operations
  const uniqueTypes = useMemo(() => {
    const types = new Set(filteredProposals.map(p => p.issue.type));
    return Array.from(types);
  }, [filteredProposals]);

  const getWordDiff = (before: string, after: string): { removed: string[], added: string[] } => {
    const beforeWords = before.split(/\s+/);
    const afterWords = after.split(/\s+/);
    
    // Simple diff - in a real implementation, you'd use a proper diff algorithm
    return {
      removed: beforeWords.filter(w => !afterWords.includes(w)),
      added: afterWords.filter(w => !beforeWords.includes(w)),
    };
  };

  if (!isOpen || proposals.length === 0) return null;

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
            <h3 className="text-xl md:text-2xl font-fantasy font-bold text-zinc-100">
              Editor Found {filteredProposals.length} Issue(s) Requiring Review
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {selectedProposals.size} selected, {rejectedProposals.size} rejected
              {filteredProposals.length < proposals.length && ` (${proposals.length - filteredProposals.length} hidden by filter)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Batch Operations Menu */}
            <div className="relative">
              <button
                onClick={() => setShowBatchMenu(!showBatchMenu)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors"
              >
                Batch Actions
              </button>
              {showBatchMenu && (
                <div className="absolute right-0 top-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 min-w-48">
                  <div className="p-2">
                    <div className="text-xs text-zinc-400 mb-2 px-2">Approve by Type:</div>
                    {uniqueTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          approveAllByType(type);
                          setShowBatchMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
                      >
                        Approve all {type.replace('_', ' ')}
                      </button>
                    ))}
                    <div className="border-t border-zinc-700 my-2" />
                    <div className="text-xs text-zinc-400 mb-2 px-2">Reject by Type:</div>
                    {uniqueTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => {
                          rejectAllByType(type);
                          setShowBatchMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
                      >
                        Reject all {type.replace('_', ' ')}
                      </button>
                    ))}
                    <div className="border-t border-zinc-700 my-2" />
                    <button
                      onClick={() => {
                        approveAllBySeverity('major');
                        setShowBatchMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
                    >
                      Approve all major
                    </button>
                    <button
                      onClick={() => {
                        rejectAllBySeverity('major');
                        setShowBatchMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 rounded"
                    >
                      Reject all major
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={onCancel}
              className="text-zinc-400 hover:text-zinc-200 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-700">
          <label className="text-xs text-zinc-400">Filter:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as IssueType | 'all')}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
            title="Filter by issue type"
            aria-label="Filter by issue type"
          >
            <option value="all">All Types</option>
            {Array.from(new Set(proposals.map(p => p.issue.type))).map(type => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value as IssueSeverity | 'all')}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
            title="Filter by severity"
            aria-label="Filter by severity"
          >
            <option value="all">All Severities</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800"
            />
            Group by type
          </label>
        </div>

        {/* Navigation */}
        {currentProposal && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous fix proposal"
              >
                ← Previous
              </button>
              <span className="text-sm text-zinc-400" aria-live="polite" aria-atomic="true">
                {currentIndex + 1} of {groupedProposals.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === groupedProposals.length - 1}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next fix proposal"
              >
                Next →
              </button>
            </div>
            <div className="text-xs text-zinc-500">
              Keyboard: A=Approve, R=Reject, ↑↓/JK=Navigate, Esc=Cancel
            </div>
          </div>
        )}

        {/* Proposals List */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2">
          {groupedProposals.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No proposals match the current filters
            </div>
          ) : (
            groupedProposals.map((proposal, index) => {
              const isSelected = selectedProposals.has(proposal.fix.id);
              const isRejected = rejectedProposals.has(proposal.fix.id);
              const isCurrent = index === currentIndex;
              const isExpanded = expandedProposals.has(proposal.fix.id);

              return (
                <div
                  key={proposal.fix.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isCurrent
                      ? 'ring-2 ring-blue-500'
                      : ''
                  } ${
                    isSelected
                      ? 'border-green-500/50 bg-green-950/20'
                      : isRejected
                      ? 'border-red-500/50 bg-red-950/20 opacity-50'
                      : 'border-zinc-700 bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(proposal.fix.id)}
                        className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500"
                        aria-label={`Select fix for ${proposal.issue.type} issue in chapter ${proposal.issue.chapterNumber}`}
                      />
                      <span className={`px-3 py-1 rounded text-xs font-semibold border ${getIssueTypeColor(proposal.issue.type)}`}>
                        {proposal.issue.type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-zinc-400 font-semibold">
                        Chapter {proposal.fix.chapterNumber || proposal.issue.chapterNumber} - {proposal.issue.location}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        proposal.issue.severity === 'major' 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {proposal.issue.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(proposal.fix.id)}
                        className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700"
                      >
                        {isExpanded ? '−' : '+'}
                      </button>
                      <button
                        onClick={() => toggleReject(proposal.fix.id)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          isRejected
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-700 text-zinc-300 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        {isRejected ? 'Rejected' : 'Reject'}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-sm text-zinc-300 mb-2 font-semibold">Issue:</p>
                    <p className="text-sm text-zinc-400 mb-2">{proposal.issue.description}</p>
                    {proposal.issue.suggestion && (
                      <p className="text-sm text-zinc-400 italic">{proposal.issue.suggestion}</p>
                    )}
                  </div>

                  {/* Enhanced Preview */}
                  {proposal.preview && (
                    <div className={`space-y-2 ${isExpanded ? '' : 'max-h-64 overflow-hidden'}`}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex-1">
                          <p className="text-xs text-zinc-500 mb-1 font-semibold">ORIGINAL:</p>
                          <div className="bg-red-950/30 border border-red-500/30 rounded p-3 text-sm text-zinc-300 font-mono whitespace-pre-wrap overflow-y-auto max-h-64">
                            {proposal.preview.before}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-zinc-500 mb-1 font-semibold">FIXED:</p>
                          <div className="bg-green-950/30 border border-green-500/30 rounded p-3 text-sm text-zinc-300 font-mono whitespace-pre-wrap overflow-y-auto max-h-64">
                            {proposal.preview.after}
                          </div>
                        </div>
                      </div>
                      {proposal.preview.context && (
                        <div className="mt-2">
                          <p className="text-xs text-zinc-500 mb-1 font-semibold">CONTEXT:</p>
                          <p className="text-xs text-zinc-400 bg-zinc-800/50 rounded p-2">{proposal.preview.context}</p>
                        </div>
                      )}
                      {!isExpanded && (
                        <button
                          onClick={() => toggleExpand(proposal.fix.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                        >
                          Expand preview →
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-zinc-700">
                    <p className="text-xs text-zinc-500">
                      <span className="font-semibold">Reason:</span> {proposal.fix.reason}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
          <div className="text-sm text-zinc-400">
            {selectedProposals.size} selected, {rejectedProposals.size} rejected
          </div>
          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejectedProposals.size === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Selected ({rejectedProposals.size})
            </button>
            <button
              onClick={handleApprove}
              disabled={selectedProposals.size === 0}
              className="px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve & Apply ({selectedProposals.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixApprovalDialog;
