/**
 * Settings Panel Component
 * Advanced settings for TTS
 */

import React from 'react';

export interface SettingsPanelProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  useGemini: boolean;
  onToggleGemini: () => void;
  availableProviders: ('browser' | 'gemini')[];
  keyboardShortcuts?: boolean;
  onKeyboardShortcutsChange?: (enabled: boolean) => void;
  autoPlay?: boolean;
  onAutoPlayChange?: (enabled: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  speed,
  onSpeedChange,
  pitch,
  onPitchChange,
  volume,
  onVolumeChange,
  useGemini,
  onToggleGemini,
  availableProviders,
  keyboardShortcuts = true,
  onKeyboardShortcutsChange,
  autoPlay = false,
  onAutoPlayChange
}) => {
  const speedPresets = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

  return (
    <div className="p-4 space-y-4 border-t border-zinc-700">
      {/* Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Speed: {speed.toFixed(1)}x
          </label>
          <div className="flex gap-1 flex-wrap">
            {speedPresets.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                  speed === s
                    ? 'bg-amber-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
          aria-label="Speech speed"
        />
      </div>

      {/* Pitch Control */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block">
          Pitch: {pitch.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={pitch}
          onChange={(e) => onPitchChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
          aria-label="Voice pitch"
        />
      </div>

      {/* Volume Control */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block">
          Volume: {Math.round(volume * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
          aria-label="Volume"
        />
      </div>

      {/* TTS Engine Toggle */}
      {availableProviders.includes('gemini') && (
        <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block">
              Use Gemini TTS
            </label>
            <p className="text-xs text-zinc-500 mt-1">
              Higher quality narration (requires GEMINI_API_KEY)
            </p>
          </div>
          <button
            onClick={onToggleGemini}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              useGemini ? 'bg-amber-600' : 'bg-zinc-700'
            }`}
            aria-label="Toggle Gemini TTS"
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                useGemini ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      {/* Additional Options */}
      <div className="space-y-2 pt-2 border-t border-zinc-700">
        {onKeyboardShortcutsChange && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Keyboard Shortcuts
            </label>
            <button
              onClick={() => onKeyboardShortcutsChange(!keyboardShortcuts)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                keyboardShortcuts ? 'bg-amber-600' : 'bg-zinc-700'
              }`}
              aria-label="Toggle keyboard shortcuts"
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  keyboardShortcuts ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {onAutoPlayChange && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
              Auto-play Next Chapter
            </label>
            <button
              onClick={() => onAutoPlayChange(!autoPlay)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                autoPlay ? 'bg-amber-600' : 'bg-zinc-700'
              }`}
              aria-label="Toggle auto-play"
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  autoPlay ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
