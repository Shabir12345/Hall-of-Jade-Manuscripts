import React, { useState, useCallback, useEffect } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, ImprovementExecutionResult, ImprovementDialogState } from '../types/improvement';
import { improveNovel } from '../services/novelImprovementService';
import { generateImprovementStrategy } from '../services/improvementStrategyGenerator';

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
  const [phase, setPhase] = useState<ImprovementDialogState['phase']>('strategy_preview');
  const [strategy, setStrategy] = useState<ImprovementStrategy | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<ImprovementExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [improvedState, setImprovedState] = useState<NovelState | null>(null);

  // Generate strategy on mount
  useEffect(() => {
    if (isOpen && !strategy) {
      try {
        const generatedStrategy = generateImprovementStrategy(novelState, request);
        setStrategy(generatedStrategy);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate strategy');
      }
    }
  }, [isOpen, strategy, novelState, request]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPhase('strategy_preview');
      setProgress(0);
      setProgressMessage('');
      setResult(null);
      setError(null);
      setImprovedState(null);
      setStrategy(null);
    }
  }, [isOpen]);

  const handleExecute = useCallback(async () => {
    if (!strategy) return;
    
    setPhase('executing');
    setProgress(0);
    setProgressMessage('Starting improvement execution...');
    setError(null);
    
    try {
      const improvementResult = await improveNovel(
        novelState,
        request,
        (message, progressValue) => {
          setProgressMessage(message);
          setProgress(progressValue);
        }
      );
      
      setResult(improvementResult.result);
      setImprovedState(improvementResult.improvedState);
      setPhase('results');
      setProgress(100);
      
      // Auto-complete after a short delay
      setTimeout(() => {
        onComplete(improvementResult.result, improvementResult.improvedState);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute improvements');
      setPhase('strategy_preview');
    }
  }, [strategy, novelState, request, onComplete]);

  const handleCancel = useCallback(() => {
    if (phase === 'executing') {
      if (confirm('Are you sure you want to cancel? Progress will be lost.')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [phase, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-amber-400">
            Improve Novel - {request.category.charAt(0).toUpperCase() + request.category.slice(1)}
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
          {phase === 'strategy_preview' && strategy && (
            <StrategyPreviewPhase
              strategy={strategy}
              onExecute={handleExecute}
              onCancel={handleCancel}
            />
          )}

          {phase === 'executing' && (
            <ExecutionPhase
              progress={progress}
              progressMessage={progressMessage}
              onCancel={handleCancel}
            />
          )}

          {phase === 'results' && result && (
            <ResultsPhase
              result={result}
              request={request}
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
  );
};

interface StrategyPreviewPhaseProps {
  strategy: ImprovementStrategy;
  onExecute: () => void;
  onCancel: () => void;
}

const StrategyPreviewPhase: React.FC<StrategyPreviewPhaseProps> = ({
  strategy,
  onExecute,
  onCancel,
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
                <p className="text-white font-semibold">{strategy.chaptersAffected.length}</p>
              </div>
              <div>
                <span className="text-sm text-zinc-400">Expected Improvement</span>
                <p className="text-amber-400 font-semibold">+{strategy.expectedImprovement.toFixed(1)} points</p>
              </div>
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-amber-400 mb-4">Executing Improvements</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400">{progressMessage}</span>
              <span className="text-amber-400 font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
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
  onClose: () => void;
}

const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  result,
  request,
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

      {/* Actions */}
      <div className="flex justify-end pt-4 border-t border-zinc-700">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default NovelImprovementDialog;
