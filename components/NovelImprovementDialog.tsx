import React, { useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, ImprovementExecutionResult, ImprovementDialogState, ChapterTargetingOptions, ImprovementMode, ImprovementActionResult } from '../types/improvement';
import { improveNovel } from '../services/novelImprovementService';
import { generateImprovementStrategy } from '../services/improvementStrategyGenerator';
import ConfirmDialog from './ConfirmDialog';
import ImprovementDiffView from './ImprovementDiffView';
import ChapterSelectionDialog from './ChapterSelectionDialog';
import ImprovementApprovalDialog from './ImprovementApprovalDialog';

interface NovelImprovementDialogProps {
  isOpen: boolean;
  novelState: NovelState;
  request: ImprovementRequest;
  onClose: () => void;
  onComplete: (result: ImprovementExecutionResult, improvedState: NovelState) => void;
}

const NovelImprovementDialog: React.FC<NovelImprovementDialogProps> = ({
  isOpen,
  novelState,
  request,
  onClose,
  onComplete,
}) => {
  // Determine initial phase: show chapter selection if no selection provided and novel has > 5 chapters
  const shouldShowChapterSelection = !request.chapterSelection && novelState.chapters.length > 5;
  const [phase, setPhase] = useState<ImprovementDialogState['phase']>(
    shouldShowChapterSelection ? 'chapter_selection' : 'strategy_preview'
  );
  const [currentRequest, setCurrentRequest] = useState<ImprovementRequest>(request);
  const [strategy, setStrategy] = useState<ImprovementStrategy | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<ImprovementExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [improvedState, setImprovedState] = useState<NovelState | null>(null);
  const [originalState, setOriginalState] = useState<NovelState | null>(null);
  const [showDiffView, setShowDiffView] = useState(false);
  const [isStaged, setIsStaged] = useState(false);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);

  // Generate strategy on mount
  useEffect(() => {
    if (isOpen && !strategy && !isLoadingStrategy) {
      setIsLoadingStrategy(true);
      setError(null);
      
      // Use setTimeout to ensure UI updates before heavy computation
      setTimeout(() => {
        try {
          console.log('[NovelImprovementDialog] Generating strategy for:', request.category);
          const generatedStrategy = generateImprovementStrategy(novelState, request);
          console.log('[NovelImprovementDialog] Strategy generated:', generatedStrategy);
          setStrategy(generatedStrategy);
          setIsLoadingStrategy(false);
        } catch (err) {
          console.error('[NovelImprovementDialog] Strategy generation failed:', err);
          setError(err instanceof Error ? err.message : 'Failed to generate strategy');
          setIsLoadingStrategy(false);
        }
      }, 100);
    }
  }, [isOpen, strategy, novelState, request, isLoadingStrategy]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      console.log('[NovelImprovementDialog] Dialog opened, resetting state');
      const shouldShowChapterSelection = !request.chapterSelection && novelState.chapters.length > 5;
      setPhase(shouldShowChapterSelection ? 'chapter_selection' : 'strategy_preview');
      setCurrentRequest(request);
      setProgress(0);
      setProgressMessage('');
      setResult(null);
      setError(null);
      setImprovedState(null);
      setOriginalState(null);
      setStrategy(null);
      setIsLoadingStrategy(false);
      setImprovementMode('manual'); // Reset to manual mode
      setPendingImprovements([]);
    }
  }, [isOpen, request, novelState.chapters.length]);

  const handleExecute = useCallback(async () => {
    if (!strategy) {
      console.error('[NovelImprovementDialog] Cannot execute: no strategy');
      return;
    }
    
    console.log('[NovelImprovementDialog] Starting execution with strategy:', strategy.category, 'mode:', improvementMode);
    
    setPhase('executing');
    setProgress(0);
    setProgressMessage('Initializing Narrative Optimization Engine...');
    setError(null);
    
    try {
      const improvementResult = await improveNovel(
        novelState,
        currentRequest,
        (message, progressValue) => {
          // Cap progress at 100% to avoid display issues
          const cappedProgress = Math.min(Math.max(progressValue, 0), 100);
          console.log(`[NOE Progress] ${cappedProgress.toFixed(0)}%: ${message}`);
          setProgressMessage(message);
          setProgress(cappedProgress);
        }
      );
      
      console.log('[NovelImprovementDialog] Execution complete:', improvementResult.result);
      
      // If manual mode, show approval dialog
      if (improvementMode === 'manual' && improvementResult.result.actionResults.length > 0) {
        // Prepare improvements for approval dialog
        // Use a more stable ID based on chapter and action type
        const improvementsForApproval = improvementResult.result.actionResults
          .filter(ar => ar.success && (ar.newContent || ar.insertedChapters))
          .map((ar, idx) => {
            // Generate stable ID
            const stableId = ar.chapterId 
              ? `improvement-${ar.chapterId}-${ar.chapterNumber || idx}-${ar.newContent ? 'edit' : 'insert'}`
              : `improvement-${idx}-${Date.now()}`;
            
            return {
              id: stableId,
              actionResult: ar,
              actionDescription: ar.problemDescription || ar.changeMetadata?.explanation || `Improvement for Chapter ${ar.chapterNumber || 'unknown'}`,
            };
          });
        
        if (improvementsForApproval.length > 0) {
          setPendingImprovements(improvementsForApproval);
          setResult(improvementResult.result);
          setImprovedState(improvementResult.improvedState);
          setOriginalState(JSON.parse(JSON.stringify(novelState))); // Deep copy
          setPhase('approval');
          return;
        }
      }
      
      // Automatic mode or no improvements to approve - go directly to results
      setResult(improvementResult.result);
      setImprovedState(improvementResult.improvedState);
      setOriginalState(JSON.parse(JSON.stringify(novelState))); // Deep copy
      setPhase('results');
      setIsStaged(true); // Changes are now staged, waiting for commit
      setProgress(100);
    } catch (err) {
      console.error('[NovelImprovementDialog] Execution failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute improvements');
      setPhase('strategy_preview');
    }
  }, [strategy, novelState, currentRequest, improvementMode, onComplete]);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = useCallback(() => {
    if (phase === 'executing') {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  }, [phase, onClose]);

  const confirmCancel = useCallback(() => {
    setShowCancelConfirm(false);
    onClose();
  }, [onClose]);

  // Handle chapter selection
  const handleChapterSelection = useCallback((selection: ChapterTargetingOptions | null) => {
    // Update request with chapter selection
    const updatedRequest: ImprovementRequest = {
      ...currentRequest,
      chapterSelection: selection || undefined,
    };
    setCurrentRequest(updatedRequest);
    // Move to strategy preview phase
    setPhase('strategy_preview');
  }, [currentRequest]);

  if (!isOpen) return null;

  // Show chapter selection as separate dialog
  if (phase === 'chapter_selection') {
    return (
      <ChapterSelectionDialog
        isOpen={true}
        novelState={novelState}
        onConfirm={handleChapterSelection}
        onCancel={onClose}
      />
    );
  }

  // Show approval dialog as separate overlay
  if (phase === 'approval' && pendingImprovements.length > 0) {
    return (
      <ImprovementApprovalDialog
        isOpen={true}
        improvements={pendingImprovements}
        onApprove={handleApproval}
        onReject={handleRejection}
        onCancel={() => {
          setPhase('strategy_preview');
          setPendingImprovements([]);
          setResult(null);
          setImprovedState(null);
          setOriginalState(null);
        }}
      />
    );
  }

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-amber-400">
            Improve Novel - {currentRequest.category.charAt(0).toUpperCase() + currentRequest.category.slice(1)}
            {currentRequest.chapterSelection && (
              <span className="text-sm text-zinc-400 ml-2">
                ({currentRequest.chapterSelection.chapterNumbers?.length || 'selected'} chapters)
              </span>
            )}
          </h2>
          <button
            onClick={handleCancel}
            className="text-zinc-400 hover:text-white transition-colors"
            disabled={phase === 'executing'}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Loading Strategy State */}
          {phase === 'strategy_preview' && isLoadingStrategy && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-zinc-400 text-lg">Analyzing novel and generating strategy...</p>
              <p className="text-zinc-500 text-sm">This may take a moment for large novels</p>
            </div>
          )}

          {phase === 'strategy_preview' && !isLoadingStrategy && strategy && (
            <StrategyPreviewPhase
              strategy={strategy}
              onExecute={handleExecute}
              onCancel={handleCancel}
              chapterSelection={currentRequest.chapterSelection}
              improvementMode={improvementMode}
              onModeChange={setImprovementMode}
            />
          )}

          {/* No strategy generated state */}
          {phase === 'strategy_preview' && !isLoadingStrategy && !strategy && !error && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-6xl">📊</div>
              <p className="text-zinc-400 text-lg">No improvements needed</p>
              <p className="text-zinc-500 text-sm">The novel already meets quality standards for this category</p>
              <button
                onClick={handleCancel}
                className="mt-4 px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {phase === 'executing' && (
            <ExecutionPhase
              progress={progress}
              progressMessage={progressMessage}
              onCancel={handleCancel}
            />
          )}


          {phase === 'results' && result && improvedState && originalState && (
            <ResultsPhase
              result={result}
              request={currentRequest}
              originalState={originalState}
              improvedState={improvedState}
              isStaged={isStaged}
              onCommit={() => {
                setIsStaged(false);
                onComplete(result, improvedState);
                onClose();
              }}
              onDiscard={() => {
                setIsStaged(false);
                setImprovedState(null);
                setResult(null);
                setPhase('strategy_preview');
              }}
              onViewDiff={() => setShowDiffView(true)}
              onClose={onClose}
            />
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <h3 className="text-red-400 font-semibold mb-2">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>

    <ConfirmDialog
      isOpen={showCancelConfirm}
      title="Cancel Improvement"
      message="Are you sure you want to cancel? Progress will be lost."
      variant="warning"
      confirmText="Yes, Cancel"
      onConfirm={confirmCancel}
      onCancel={() => setShowCancelConfirm(false)}
    />

    {showDiffView && result && improvedState && originalState && (
      <ImprovementDiffView
        originalState={originalState}
        improvedState={improvedState}
        actionResults={result.actionResults}
        category={currentRequest.category}
        onClose={() => setShowDiffView(false)}
        onAcceptAll={() => {
          setIsStaged(false);
          onComplete(result, improvedState);
          setShowDiffView(false);
          onClose();
        }}
        onRejectAll={() => {
          setIsStaged(false);
          setImprovedState(null);
          setResult(null);
          setPhase('strategy_preview');
          setShowDiffView(false);
        }}
      />
    )}
    </>
  );
};

interface StrategyPreviewPhaseProps {
  strategy: ImprovementStrategy;
  onExecute: () => void;
  onCancel: () => void;
  chapterSelection?: ChapterTargetingOptions;
}

const StrategyPreviewPhase: React.FC<StrategyPreviewPhaseProps> = ({
  strategy,
  onExecute,
  onCancel,
  chapterSelection,
  improvementMode,
  onModeChange,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-amber-400 mb-4">Improvement Strategy</h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Category</span>
              <span className="text-amber-400 font-semibold capitalize">{strategy.category}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Priority</span>
              <span className={`font-semibold ${
                strategy.priority === 'critical' ? 'text-red-400' :
                strategy.priority === 'high' ? 'text-orange-400' :
                strategy.priority === 'medium' ? 'text-yellow-400' :
                'text-zinc-400'
              }`}>
                {strategy.priority.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Current Score</span>
              <span className="text-white font-semibold">{strategy.targetScore}/100</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Target Score</span>
              <span className="text-amber-400 font-semibold">{strategy.goalScore}/100</span>
            </div>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-2">Description</h4>
            <p className="text-zinc-300">{strategy.description}</p>
          </div>

          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-2">Rationale</h4>
            <p className="text-zinc-300">{strategy.rationale}</p>
          </div>

          {strategy.editActions && strategy.editActions.length > 0 && (
            <div className="p-4 bg-zinc-800 rounded-lg">
              <h4 className="text-amber-400 font-semibold mb-2">
                Edit Actions ({strategy.editActions.length})
              </h4>
              <ul className="space-y-2">
                {strategy.editActions.slice(0, 5).map((action, idx) => (
                  <li key={idx} className="text-zinc-300 text-sm">
                    • Chapter {action.chapterNumber}: {action.description}
                  </li>
                ))}
                {strategy.editActions.length > 5 && (
                  <li className="text-zinc-500 text-sm">
                    ... and {strategy.editActions.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {strategy.insertActions && strategy.insertActions.length > 0 && (
            <div className="p-4 bg-zinc-800 rounded-lg">
              <h4 className="text-amber-400 font-semibold mb-2">
                Insert Actions ({strategy.insertActions.length})
              </h4>
              <ul className="space-y-2">
                {strategy.insertActions.map((action, idx) => (
                  <li key={idx} className="text-zinc-300 text-sm">
                    • Insert {action.chapterCount} chapter(s) after Chapter {action.position}: {action.purpose}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-4 bg-zinc-800 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-zinc-400">Estimated Impact</span>
                <p className={`font-semibold ${
                  strategy.estimatedImpact === 'high' ? 'text-green-400' :
                  strategy.estimatedImpact === 'medium' ? 'text-yellow-400' :
                  'text-zinc-400'
                }`}>
                  {strategy.estimatedImpact.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Estimated Effort</span>
                <p className={`font-semibold ${
                  strategy.estimatedEffort === 'low' ? 'text-green-400' :
                  strategy.estimatedEffort === 'medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {strategy.estimatedEffort.toUpperCase()}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Chapters Affected</span>
                <p className="text-white font-semibold">
                  {strategy.chaptersAffected.length}
                  {chapterSelection && (
                    <span className="text-xs text-zinc-500 ml-1">
                      (selected: {chapterSelection.chapterNumbers?.length || chapterSelection.chapterIds?.length || 'range'})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Expected Improvement</span>
                <p className="text-amber-400 font-semibold">+{strategy.expectedImprovement.toFixed(1)} points</p>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-3">Execution Mode</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="improvementMode"
                  value="manual"
                  checked={improvementMode === 'manual'}
                  onChange={() => onModeChange('manual')}
                  className="w-5 h-5 text-amber-500 focus:ring-amber-500 focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-zinc-200">Manual (Review Each Change)</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Review and approve each improvement before it's applied. Recommended for important changes.
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="improvementMode"
                  value="automatic"
                  checked={improvementMode === 'automatic'}
                  onChange={() => onModeChange('automatic')}
                  className="w-5 h-5 text-amber-500 focus:ring-amber-500 focus:ring-2"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-zinc-200">Automatic (Apply All)</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Apply all improvements automatically without review. Faster but less control.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-end pt-4 border-t border-zinc-700">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onExecute}
          className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all"
        >
          Execute Improvements
        </button>
      </div>
    </div>
  );
};

interface ExecutionPhaseProps {
  progress: number;
  progressMessage: string;
  onCancel: () => void;
}

const ExecutionPhase: React.FC<ExecutionPhaseProps> = ({
  progress,
  progressMessage,
  onCancel,
}) => {
  // Determine current stage based on progress
  const getStage = () => {
    if (progress < 15) return { name: 'Analyzing', icon: '🔍' };
    if (progress < 30) return { name: 'Planning', icon: '📋' };
    if (progress < 85) return { name: 'Transforming', icon: '✨' };
    return { name: 'Validating', icon: '✅' };
  };
  
  const stage = getStage();
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-amber-400 mb-6">Executing Improvements</h3>
        
        {/* Main Progress Display */}
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          {/* Animated spinner with stage icon */}
          <div className="relative">
            <div className="w-24 h-24 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              {stage.icon}
            </div>
          </div>
          
          {/* Stage name */}
          <div className="text-center">
            <p className="text-amber-400 text-lg font-semibold">{stage.name}</p>
            <p className="text-zinc-400 text-sm mt-1">{progressMessage || 'Working...'}</p>
          </div>
          
          {/* Progress bar */}
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-sm">Progress</span>
              <span className="text-amber-400 font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {/* Stage indicators */}
          <div className="flex items-center justify-center space-x-2 mt-4">
            <div className={`w-3 h-3 rounded-full ${progress >= 0 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-8 h-0.5 ${progress >= 15 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-3 h-3 rounded-full ${progress >= 15 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-8 h-0.5 ${progress >= 30 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-3 h-3 rounded-full ${progress >= 30 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-8 h-0.5 ${progress >= 85 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
            <div className={`w-3 h-3 rounded-full ${progress >= 85 ? 'bg-amber-500' : 'bg-zinc-700'}`}></div>
          </div>
          <div className="flex items-center justify-center space-x-4 text-xs text-zinc-500">
            <span>Analyze</span>
            <span>Plan</span>
            <span>Transform</span>
            <span>Validate</span>
          </div>
        </div>
        
        {/* Info message */}
        <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <p className="text-zinc-400 text-sm text-center">
            💡 The Narrative Optimization Engine is analyzing and improving your novel. 
            This may take a few minutes depending on novel size.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-700">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

interface ResultsPhaseProps {
  result: ImprovementExecutionResult;
  request: ImprovementRequest;
  originalState: NovelState;
  improvedState: NovelState;
  isStaged: boolean;
  onCommit: () => void;
  onDiscard: () => void;
  onViewDiff: () => void;
  onClose: () => void;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  result,
  request,
  originalState,
  improvedState,
  isStaged,
  onCommit,
  onDiscard,
  onViewDiff,
  onClose,
}) => {
  const scoreChange = result.scoreAfter - result.scoreBefore;
  const scoreChangeColor = scoreChange > 0 ? 'text-green-400' : scoreChange < 0 ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-amber-400 mb-4">Improvement Results</h3>
        
        <div className="space-y-4">
          {/* Score Comparison */}
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-4">Score Improvement</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <span className="text-sm text-zinc-400 block mb-1">Before</span>
                <span className="text-2xl font-bold text-white">{result.scoreBefore}/100</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-zinc-400 block mb-1">After</span>
                <span className="text-2xl font-bold text-amber-400">{result.scoreAfter}/100</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-zinc-400 block mb-1">Change</span>
                <span className={`text-2xl font-bold ${scoreChangeColor}`}>
                  {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-2">Summary</h4>
            <p className="text-zinc-300">{result.summary}</p>
          </div>

          {/* Actions Executed */}
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-2">Actions Executed</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-zinc-400">Total Actions</span>
                <p className="text-white font-semibold">{result.actionsExecuted}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Succeeded</span>
                <p className="text-green-400 font-semibold">{result.actionsSucceeded}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Failed</span>
                <p className="text-red-400 font-semibold">{result.actionsFailed}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Execution Time</span>
                <p className="text-zinc-300 font-semibold">{(result.executionTime / 1000).toFixed(1)}s</p>
              </div>
            </div>
          </div>

          {/* Chapters Modified */}
          <div className="p-4 bg-zinc-800 rounded-lg">
            <h4 className="text-amber-400 font-semibold mb-2">Chapters Modified</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-zinc-400">Edited</span>
                <p className="text-white font-semibold">{result.chaptersEdited}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Inserted</span>
                <p className="text-green-400 font-semibold">{result.chaptersInserted}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Regenerated</span>
                <p className="text-blue-400 font-semibold">{result.chaptersRegenerated}</p>
              </div>
            </div>
          </div>

          {/* Validation Results */}
          {result.validationResults.warnings.length > 0 && (
            <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <h4 className="text-yellow-400 font-semibold mb-2">Warnings</h4>
              <ul className="space-y-1">
                {result.validationResults.warnings.map((warning, idx) => (
                  <li key={idx} className="text-yellow-300 text-sm">• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Failures */}
          {result.failures.length > 0 && (
            <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <h4 className="text-red-400 font-semibold mb-2">Failures</h4>
              <ul className="space-y-1">
                {result.failures.map((failure, idx) => (
                  <li key={idx} className="text-red-300 text-sm">
                    • Action {failure.actionId}: {failure.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Staging Notice */}
      {isStaged && (
        <div className="p-4 bg-amber-900/20 border border-amber-700 rounded-lg">
          <p className="text-amber-300 text-sm">
            <strong>Changes are staged.</strong> Review the improvements above, then commit to apply them or discard to cancel.
          </p>
        </div>
      )}

      {/* History Notice */}
      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <p className="text-blue-300 text-sm">
          <strong>Tip:</strong> All improvements are automatically saved to <span className="text-amber-400 font-semibold">History</span> (in the sidebar under Advanced Analysis). 
          You can review, compare, or rollback changes there anytime.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4 border-t border-zinc-700">
        <div className="flex gap-4">
          <button
            onClick={onViewDiff}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold transition-all"
          >
            View Diff
          </button>
          {isStaged && (
            <button
              onClick={onDiscard}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
            >
              Discard
            </button>
          )}
        </div>
        <div className="flex gap-4">
          {isStaged ? (
            <button
              onClick={onCommit}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-semibold transition-all"
            >
              Commit Changes
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NovelImprovementDialog;
