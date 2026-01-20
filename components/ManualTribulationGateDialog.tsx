/**
 * Manual Tribulation Gate Dialog
 * 
 * Allows users to manually trigger a Tribulation Gate at any point,
 * useful for testing or when they want to insert a decision point.
 */

import React, { useState, useCallback } from 'react';
import {
  TribulationTrigger,
  TRIGGER_DISPLAY_INFO,
} from '../types/tribulationGates';
import { NovelState } from '../types';

interface ManualTribulationGateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerGate: (
    triggerType: TribulationTrigger,
    protagonistName: string,
    customSituation?: string
  ) => Promise<void>;
  novel: NovelState;
  isLoading?: boolean;
}

const ALL_TRIGGER_TYPES: TribulationTrigger[] = [
  'realm_breakthrough',
  'life_death_crisis',
  'major_confrontation',
  'alliance_decision',
  'treasure_discovery',
  'identity_revelation',
  'marriage_proposal',
  'sect_choice',
  'forbidden_technique',
  'sacrifice_moment',
  'dao_comprehension',
  'inheritance_acceptance',
];

const ManualTribulationGateDialog: React.FC<ManualTribulationGateDialogProps> = ({
  isOpen,
  onClose,
  onTriggerGate,
  novel,
  isLoading = false,
}) => {
  const [selectedTrigger, setSelectedTrigger] = useState<TribulationTrigger>('realm_breakthrough');
  const [customSituation, setCustomSituation] = useState('');
  const [selectedProtagonist, setSelectedProtagonist] = useState<string>('');

  // Get protagonist candidates from character codex
  const protagonistCandidates = novel.characterCodex
    .filter(c => c.isProtagonist || c.role === 'protagonist' || c.role === 'main')
    .map(c => c.name);
  
  // Also include first few characters as options
  const allCandidates = [
    ...new Set([
      ...protagonistCandidates,
      ...novel.characterCodex.slice(0, 5).map(c => c.name)
    ])
  ];

  // Set default protagonist
  React.useEffect(() => {
    if (allCandidates.length > 0 && !selectedProtagonist) {
      const protagonist = novel.characterCodex.find(c => c.isProtagonist);
      setSelectedProtagonist(protagonist?.name || allCandidates[0]);
    }
  }, [allCandidates, novel.characterCodex, selectedProtagonist]);

  const handleTrigger = useCallback(async () => {
    if (!selectedProtagonist) return;
    
    await onTriggerGate(
      selectedTrigger,
      selectedProtagonist,
      customSituation.trim() || undefined
    );
  }, [selectedTrigger, selectedProtagonist, customSituation, onTriggerGate]);

  if (!isOpen) return null;

  const triggerInfo = TRIGGER_DISPLAY_INFO[selectedTrigger];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-purple-600/30 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/20">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <div>
              <h2 className="text-xl font-fantasy font-bold text-purple-400">
                Summon a Tribulation Gate
              </h2>
              <p className="text-zinc-500 text-sm">
                Manually trigger a fate decision point
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Trigger Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">
              Gate Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ALL_TRIGGER_TYPES.map((trigger) => {
                const info = TRIGGER_DISPLAY_INFO[trigger];
                const isSelected = selectedTrigger === trigger;
                
                return (
                  <button
                    key={trigger}
                    onClick={() => setSelectedTrigger(trigger)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-600 text-purple-300'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                    title={info.description}
                  >
                    <span className="text-xl">{info.icon}</span>
                    <span className="text-xs text-center leading-tight">{info.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Trigger Description */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{triggerInfo.icon}</span>
              <span className="font-semibold text-zinc-200">{triggerInfo.title}</span>
            </div>
            <p className="text-zinc-400 text-sm">{triggerInfo.description}</p>
          </div>

          {/* Protagonist Selection */}
          <div className="space-y-2">
            <label htmlFor="protagonist-select" className="text-sm font-medium text-zinc-300">
              Protagonist Facing the Gate
            </label>
            {allCandidates.length > 0 ? (
              <select
                id="protagonist-select"
                value={selectedProtagonist}
                onChange={(e) => setSelectedProtagonist(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 focus:outline-none focus:border-purple-500"
                title="Select the protagonist for this gate"
              >
                {allCandidates.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={selectedProtagonist}
                onChange={(e) => setSelectedProtagonist(e.target.value)}
                placeholder="Enter protagonist name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
            )}
          </div>

          {/* Custom Situation (Optional) */}
          <div className="space-y-2">
            <label htmlFor="custom-situation" className="text-sm font-medium text-zinc-300">
              Custom Situation <span className="text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="custom-situation"
              value={customSituation}
              onChange={(e) => setCustomSituation(e.target.value)}
              placeholder={`e.g., "${selectedProtagonist || 'The protagonist'} discovers a hidden chamber containing three ancient artifacts..."`}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
            />
            <p className="text-zinc-600 text-xs">
              Leave blank to use a default situation based on the gate type
            </p>
          </div>

          {/* Warning */}
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
            <p className="text-amber-400 text-sm">
              <strong>Note:</strong> This will create a Tribulation Gate that you'll need to resolve before continuing chapter generation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTrigger}
            disabled={isLoading || !selectedProtagonist}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Summoning Gate...
              </>
            ) : (
              <>
                <span>⚡</span>
                Summon Gate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualTribulationGateDialog;
