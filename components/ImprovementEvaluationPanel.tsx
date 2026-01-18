import React, { useState, useCallback } from 'react';
import { ImprovementHistoryRecord, EvaluationStatus } from '../types/improvement';
import { evaluateImprovement } from '../services/novelImprovementService';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './Modal';

// =====================================================
// TYPES
// =====================================================

interface ImprovementEvaluationPanelProps {
  record: ImprovementHistoryRecord;
  onClose: () => void;
  onSave: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const EVALUATION_OPTIONS: { value: EvaluationStatus; label: string; description: string; icon: string; color: string }[] = [
  { 
    value: 'approved', 
    label: 'Approve', 
    description: 'This improvement successfully enhanced the novel',
    icon: '✅',
    color: 'bg-green-600 hover:bg-green-500 border-green-500'
  },
  { 
    value: 'rejected', 
    label: 'Reject', 
    description: 'This improvement did not meet expectations',
    icon: '❌',
    color: 'bg-red-600 hover:bg-red-500 border-red-500'
  },
  { 
    value: 'pending', 
    label: 'Keep Pending', 
    description: 'Need more time to evaluate this improvement',
    icon: '⏳',
    color: 'bg-yellow-600 hover:bg-yellow-500 border-yellow-500'
  },
];

const QUALITY_INDICATORS = [
  { id: 'prose_improved', label: 'Prose quality improved', category: 'positive' },
  { id: 'structure_better', label: 'Better narrative structure', category: 'positive' },
  { id: 'engagement_higher', label: 'More engaging to read', category: 'positive' },
  { id: 'voice_consistent', label: 'Voice remains consistent', category: 'positive' },
  { id: 'natural_flow', label: 'Changes feel natural', category: 'positive' },
  { id: 'ai_detectable', label: 'Changes feel AI-generated', category: 'negative' },
  { id: 'lost_voice', label: 'Lost original voice/style', category: 'negative' },
  { id: 'broke_continuity', label: 'Continuity issues introduced', category: 'negative' },
  { id: 'too_verbose', label: 'Too verbose/wordy', category: 'negative' },
  { id: 'needs_editing', label: 'Requires additional editing', category: 'neutral' },
];

// =====================================================
// MAIN COMPONENT
// =====================================================

const ImprovementEvaluationPanel: React.FC<ImprovementEvaluationPanelProps> = ({
  record,
  onClose,
  onSave,
}) => {
  const { addToast } = useToast();
  
  // State
  const [status, setStatus] = useState<EvaluationStatus>(record.evaluation);
  const [notes, setNotes] = useState(record.evaluationNotes || '');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Handlers
  const handleToggleIndicator = useCallback((id: string) => {
    setSelectedIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  }, []);
  
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    
    try {
      // Build the full notes including indicators
      const indicatorNotes = selectedIndicators.length > 0
        ? `Quality indicators: ${selectedIndicators.map(id => 
            QUALITY_INDICATORS.find(q => q.id === id)?.label
          ).filter(Boolean).join(', ')}`
        : '';
      
      const fullNotes = [notes.trim(), indicatorNotes].filter(Boolean).join('\n\n');
      
      await evaluateImprovement(record.id, {
        status,
        notes: fullNotes,
      });
      
      addToast('Evaluation saved successfully', 'success');
      onSave();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save evaluation';
      addToast(errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [record.id, status, notes, selectedIndicators, addToast, onSave]);
  
  // Calculate improvement metrics
  const metrics = {
    scoreChange: record.result.scoreImprovement,
    chaptersAffected: record.result.chaptersEdited + record.result.chaptersInserted,
    successRate: record.result.actionsExecuted > 0 
      ? Math.round((record.result.actionsSucceeded / record.result.actionsExecuted) * 100)
      : 0,
  };
  
  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-amber-400">Evaluate Improvement</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Rate the quality of this {record.category.replace('_', ' ')} improvement
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close evaluation panel"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Improvement Summary */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-zinc-500 uppercase">Score Change</div>
              <div className={`text-2xl font-bold ${
                metrics.scoreChange > 0 ? 'text-green-400' : 
                metrics.scoreChange < 0 ? 'text-red-400' : 'text-zinc-400'
              }`}>
                {metrics.scoreChange > 0 ? '+' : ''}{metrics.scoreChange}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase">Chapters Affected</div>
              <div className="text-2xl font-bold text-white">{metrics.chaptersAffected}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase">Success Rate</div>
              <div className={`text-2xl font-bold ${
                metrics.successRate >= 80 ? 'text-green-400' :
                metrics.successRate >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {metrics.successRate}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Evaluation Status */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-3">
            Evaluation Decision
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EVALUATION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setStatus(option.value)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === option.value
                    ? option.color + ' text-white'
                    : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600'
                }`}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <div className="font-semibold">{option.label}</div>
                <div className="text-xs mt-1 opacity-75">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Quality Indicators */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-3">
            Quality Indicators (optional)
          </label>
          <div className="space-y-3">
            {/* Positive indicators */}
            <div>
              <div className="text-xs text-green-400 uppercase mb-2">Positive Aspects</div>
              <div className="flex flex-wrap gap-2">
                {QUALITY_INDICATORS.filter(q => q.category === 'positive').map(indicator => (
                  <button
                    key={indicator.id}
                    onClick={() => handleToggleIndicator(indicator.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedIndicators.includes(indicator.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {indicator.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Negative indicators */}
            <div>
              <div className="text-xs text-red-400 uppercase mb-2">Issues Found</div>
              <div className="flex flex-wrap gap-2">
                {QUALITY_INDICATORS.filter(q => q.category === 'negative').map(indicator => (
                  <button
                    key={indicator.id}
                    onClick={() => handleToggleIndicator(indicator.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedIndicators.includes(indicator.id)
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {indicator.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Neutral indicators */}
            <div>
              <div className="text-xs text-zinc-400 uppercase mb-2">Other Notes</div>
              <div className="flex flex-wrap gap-2">
                {QUALITY_INDICATORS.filter(q => q.category === 'neutral').map(indicator => (
                  <button
                    key={indicator.id}
                    onClick={() => handleToggleIndicator(indicator.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedIndicators.includes(indicator.id)
                        ? 'bg-zinc-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {indicator.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-2">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional comments about this improvement..."
            rows={4}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
        
        {/* Current Status Display */}
        {record.evaluationTimestamp && (
          <div className="bg-zinc-800/30 rounded-lg p-3 mb-6">
            <div className="text-xs text-zinc-500">
              Previous evaluation: {record.evaluation} on{' '}
              {new Date(record.evaluationTimestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 ${
              status === 'approved'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : status === 'rejected'
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⏳</span>
                Saving...
              </>
            ) : (
              <>
                Save Evaluation
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ImprovementEvaluationPanel;
