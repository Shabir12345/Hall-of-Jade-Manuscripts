/**
 * Pre-Generation Validation Panel
 * 
 * Shows validation status before generating a chapter:
 * - Context completeness status
 * - Missing entity states
 * - Power level warnings
 * - Relationship status
 * Allows user to review and approve context.
 */

import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { getPreGenerationValidator } from '../services/preGenerationValidator';
import { getContextCompletenessChecker } from '../services/contextCompletenessChecker';
import { getPowerProgressionValidator } from '../services/powerProgressionValidator';
import { getSemanticContextRetriever } from '../services/semanticContextRetriever';
import { getContextCompiler } from '../services/contextCompiler';

interface PreGenerationValidationPanelProps {
  novel: NovelState;
  onApprove: () => void;
  onCancel: () => void;
}

export const PreGenerationValidationPanel: React.FC<PreGenerationValidationPanelProps> = ({
  novel,
  onApprove,
  onCancel,
}) => {
  const [approved, setApproved] = useState(false);

  const nextChapterNumber = novel.chapters.length + 1;

  // Run validations
  const validationReport = useMemo(() => {
    const validator = getPreGenerationValidator();
    return validator.validateBeforeGeneration(novel, nextChapterNumber);
  }, [novel, nextChapterNumber]);

  // Get characters that will appear
  const charactersToCheck = useMemo(() => {
    const previousChapter = novel.chapters[novel.chapters.length - 1];
    if (!previousChapter) {
      return novel.characterCodex.filter(c => c.isProtagonist).map(c => c.id);
    }

    const text = previousChapter.content.slice(-1000).toLowerCase();
    return novel.characterCodex
      .filter(c => text.includes(c.name.toLowerCase()))
      .map(c => c.id);
  }, [novel]);

  // Check context completeness
  const completenessReport = useMemo(() => {
    const retriever = getSemanticContextRetriever();
    const compiler = getContextCompiler();
    
    const retrieved = retriever.retrieveContext(novel, {
      characters: charactersToCheck,
      recentChapters: 3,
      powerLevelChanges: true,
      relationships: true,
      worldRules: true,
    });

    const compiled = compiler.compileContext(retrieved, {
      maxTokens: 2000,
    });

    const checker = getContextCompletenessChecker();
    return checker.checkCompleteness(novel, compiled, retrieved, charactersToCheck);
  }, [novel, charactersToCheck]);

  // Check power progression
  const powerReport = useMemo(() => {
    const validator = getPowerProgressionValidator();
    return validator.validateProgression(novel, charactersToCheck, nextChapterNumber);
  }, [novel, charactersToCheck, nextChapterNumber]);

  const canProceed = validationReport.valid && completenessReport.complete && powerReport.valid;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Pre-Generation Validation</h2>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Validation Status */}
          <div className="mb-6">
            <div className={`p-4 rounded-lg ${
              validationReport.valid
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                <span className={`text-2xl mr-3 ${
                  validationReport.valid ? 'text-green-600' : 'text-red-600'
                }`}>
                  {validationReport.valid ? '✓' : '✗'}
                </span>
                <div>
                  <div className="font-semibold">
                    {validationReport.valid ? 'Validation Passed' : 'Validation Failed'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {validationReport.summary.critical} critical, {validationReport.summary.warnings} warnings
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Context Completeness */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Context Completeness</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-600">Characters Ready</div>
                  <div className="text-xl font-bold">
                    {completenessReport.summary.completeCharacters} / {completenessReport.summary.totalCharacters}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Power Levels</div>
                  <div className="text-xl font-bold">
                    {completenessReport.summary.totalCharacters - completenessReport.summary.missingPowerLevels} / {completenessReport.summary.totalCharacters}
                  </div>
                </div>
              </div>
              {completenessReport.recommendations.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Recommendations:</div>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {completenessReport.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Power Progression Warnings */}
          {powerReport.warnings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Power Progression Warnings</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {powerReport.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      warning.severity === 'critical'
                        ? 'border-red-500 bg-red-50'
                        : warning.severity === 'warning'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{warning.characterName}</div>
                    <div className="text-xs text-gray-600 mt-1">{warning.message}</div>
                    <div className="text-xs text-gray-500 mt-1">{warning.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Issues */}
          {validationReport.issues.filter(i => i.severity === 'critical').length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-red-600">Critical Issues</h3>
              <div className="space-y-2">
                {validationReport.issues
                  .filter(i => i.severity === 'critical')
                  .map((issue, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                      <div className="font-medium text-sm">{issue.message}</div>
                      <div className="text-xs text-gray-600 mt-1">{issue.suggestion}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 mt-6 pt-6 border-t">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setApproved(true);
                onApprove();
              }}
              disabled={!canProceed}
              className={`px-4 py-2 rounded ${
                canProceed
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {canProceed ? 'Approve & Generate' : 'Fix Issues First'}
            </button>
          </div>

          {!canProceed && (
            <div className="mt-4 text-sm text-red-600">
              Please address critical issues before generating the chapter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
