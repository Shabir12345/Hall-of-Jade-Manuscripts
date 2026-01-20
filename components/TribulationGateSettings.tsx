/**
 * Tribulation Gate Settings Component
 * 
 * Provides configuration UI for the Tribulation Gates feature including:
 * - Enable/disable toggle
 * - Trigger sensitivity
 * - Minimum chapter gap
 * - Excluded trigger types
 * - Auto-select timeout
 * - Display options
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  TribulationGateConfig,
  TribulationTrigger,
  DEFAULT_TRIBULATION_GATE_CONFIG,
  TRIGGER_DISPLAY_INFO,
} from '../types/tribulationGates';
import { isSoundEnabled, setSoundEnabled as setGlobalSoundEnabled } from '../utils/soundEffects';

interface TribulationGateSettingsProps {
  config: Partial<TribulationGateConfig> | undefined;
  onConfigChange: (config: TribulationGateConfig) => void;
  /** Whether to show as a collapsible panel */
  collapsible?: boolean;
  /** Initial collapsed state */
  initialCollapsed?: boolean;
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

const TribulationGateSettings: React.FC<TribulationGateSettingsProps> = ({
  config,
  onConfigChange,
  collapsible = true,
  initialCollapsed = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  
  // Load sound preference
  useEffect(() => {
    setSoundEnabledState(isSoundEnabled());
  }, []);
  
  // Handle sound toggle
  const handleToggleSound = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabledState(newValue);
    setGlobalSoundEnabled(newValue);
  }, [soundEnabled]);
  
  // Merge config with defaults
  const currentConfig: TribulationGateConfig = useMemo(() => ({
    ...DEFAULT_TRIBULATION_GATE_CONFIG,
    ...config,
  }), [config]);

  // Handle toggle enable/disable
  const handleToggleEnabled = useCallback(() => {
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  }, [currentConfig, onConfigChange]);

  // Handle sensitivity change
  const handleSensitivityChange = useCallback((sensitivity: 'low' | 'medium' | 'high') => {
    onConfigChange({
      ...currentConfig,
      triggerSensitivity: sensitivity,
    });
  }, [currentConfig, onConfigChange]);

  // Handle chapter gap change
  const handleChapterGapChange = useCallback((gap: number) => {
    onConfigChange({
      ...currentConfig,
      minimumChapterGap: Math.max(5, Math.min(100, gap)),
    });
  }, [currentConfig, onConfigChange]);

  // Handle trigger exclusion toggle
  const handleToggleTrigger = useCallback((trigger: TribulationTrigger) => {
    const currentExcluded = currentConfig.excludedTriggers || [];
    const isExcluded = currentExcluded.includes(trigger);
    
    onConfigChange({
      ...currentConfig,
      excludedTriggers: isExcluded
        ? currentExcluded.filter(t => t !== trigger)
        : [...currentExcluded, trigger],
    });
  }, [currentConfig, onConfigChange]);

  // Handle auto-select timeout change
  const handleAutoSelectChange = useCallback((ms: number | undefined) => {
    onConfigChange({
      ...currentConfig,
      autoSelectAfterMs: ms,
    });
  }, [currentConfig, onConfigChange]);

  // Handle display options
  const handleShowConsequencesChange = useCallback((show: boolean) => {
    onConfigChange({
      ...currentConfig,
      showConsequences: show,
    });
  }, [currentConfig, onConfigChange]);

  const handleShowRiskLevelsChange = useCallback((show: boolean) => {
    onConfigChange({
      ...currentConfig,
      showRiskLevels: show,
    });
  }, [currentConfig, onConfigChange]);

  const excludedSet = useMemo(() => 
    new Set(currentConfig.excludedTriggers || []), 
    [currentConfig.excludedTriggers]
  );

  const content = (
    <div className="space-y-6">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-zinc-200 font-medium">Enable Tribulation Gates</h4>
          <p className="text-zinc-500 text-sm">
            Pause at major plot points to choose your fate
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={`relative w-14 h-7 rounded-full transition-colors ${
            currentConfig.enabled 
              ? 'bg-purple-600' 
              : 'bg-zinc-700'
          }`}
          aria-label={currentConfig.enabled ? 'Disable Tribulation Gates' : 'Enable Tribulation Gates'}
        >
          <div
            className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
              currentConfig.enabled ? 'left-8' : 'left-1'
            }`}
          />
        </button>
      </div>

      {currentConfig.enabled && (
        <>
          {/* Trigger Sensitivity */}
          <div className="space-y-2">
            <h4 className="text-zinc-200 font-medium">Trigger Sensitivity</h4>
            <p className="text-zinc-500 text-sm">
              How often gates appear based on story context
            </p>
            <div className="flex gap-2 mt-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => handleSensitivityChange(level)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    currentConfig.triggerSensitivity === level
                      ? level === 'low'
                        ? 'bg-emerald-600 text-white'
                        : level === 'medium'
                          ? 'bg-amber-600 text-white'
                          : 'bg-orange-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {level === 'low' && '🌊 Low'}
                  {level === 'medium' && '⚡ Medium'}
                  {level === 'high' && '🔥 High'}
                </button>
              ))}
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {currentConfig.triggerSensitivity === 'low' && 'Gates appear only at major climactic moments'}
              {currentConfig.triggerSensitivity === 'medium' && 'Balanced frequency for engaging decisions'}
              {currentConfig.triggerSensitivity === 'high' && 'Frequent gates for maximum reader agency'}
            </p>
          </div>

          {/* Minimum Chapter Gap */}
          <div className="space-y-2">
            <h4 className="text-zinc-200 font-medium">Minimum Chapter Gap</h4>
            <p className="text-zinc-500 text-sm">
              Minimum chapters between gates ({currentConfig.minimumChapterGap} chapters)
            </p>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={currentConfig.minimumChapterGap}
              onChange={(e) => handleChapterGapChange(parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-600"
              aria-label="Minimum chapter gap between gates"
              title={`${currentConfig.minimumChapterGap} chapters`}
            />
            <div className="flex justify-between text-xs text-zinc-600">
              <span>5 (frequent)</span>
              <span>50 (rare)</span>
            </div>
          </div>

          {/* Auto-Select Timeout */}
          <div className="space-y-2">
            <h4 className="text-zinc-200 font-medium">Auto-Select Timeout</h4>
            <p className="text-zinc-500 text-sm">
              Automatically select a random path after timeout
            </p>
            <div className="flex gap-2 mt-2">
              {[
                { label: 'Off', value: undefined },
                { label: '30s', value: 30000 },
                { label: '1m', value: 60000 },
                { label: '2m', value: 120000 },
                { label: '5m', value: 300000 },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => handleAutoSelectChange(value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                    currentConfig.autoSelectAfterMs === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-3">
            <h4 className="text-zinc-200 font-medium">Display Options</h4>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={currentConfig.showConsequences}
                onChange={(e) => handleShowConsequencesChange(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-zinc-300 text-sm">Show consequence previews</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={currentConfig.showRiskLevels}
                onChange={(e) => handleShowRiskLevelsChange(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-zinc-300 text-sm">Show risk level indicators</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={handleToggleSound}
                className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-zinc-300 text-sm">🔊 Enable sound effects</span>
            </label>
          </div>

          {/* Excluded Triggers */}
          <div className="space-y-2">
            <h4 className="text-zinc-200 font-medium">Trigger Types</h4>
            <p className="text-zinc-500 text-sm">
              Select which story moments can trigger gates
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {ALL_TRIGGER_TYPES.map((trigger) => {
                const info = TRIGGER_DISPLAY_INFO[trigger];
                const isExcluded = excludedSet.has(trigger);
                
                return (
                  <button
                    key={trigger}
                    onClick={() => handleToggleTrigger(trigger)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      isExcluded
                        ? 'bg-zinc-800/50 text-zinc-600 border border-zinc-800'
                        : 'bg-zinc-800 text-zinc-300 border border-purple-600/30 hover:bg-zinc-700'
                    }`}
                    title={info.description}
                  >
                    <span>{info.icon}</span>
                    <span className="truncate">{info.title}</span>
                    {!isExcluded && (
                      <span className="ml-auto text-purple-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-zinc-600 text-xs mt-1">
              {excludedSet.size > 0 
                ? `${ALL_TRIGGER_TYPES.length - excludedSet.size} of ${ALL_TRIGGER_TYPES.length} trigger types enabled`
                : 'All trigger types enabled'}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (!collapsible) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
        {content}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-200">Tribulation Gates</h3>
            <p className="text-zinc-500 text-sm">
              {currentConfig.enabled 
                ? `Active • ${currentConfig.triggerSensitivity} sensitivity • ${currentConfig.minimumChapterGap} chapter gap`
                : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            currentConfig.enabled 
              ? 'bg-purple-600/20 text-purple-400' 
              : 'bg-zinc-800 text-zinc-500'
          }`}>
            {currentConfig.enabled ? 'ON' : 'OFF'}
          </span>
          <span className={`text-zinc-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
            ▼
          </span>
        </div>
      </button>
      
      {!isCollapsed && (
        <div className="p-4 pt-0 border-t border-zinc-800">
          {content}
        </div>
      )}
    </div>
  );
};

export default TribulationGateSettings;
