/**
 * Voice Selector Component
 * Enhanced voice selection with previews
 */

import React, { useState, useCallback } from 'react';

export interface VoiceSelectorProps {
  voices: SpeechSynthesisVoice[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  isStorytellingVoice?: (name: string) => boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedIndex,
  onSelect,
  disabled = false,
  isStorytellingVoice
}) => {
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);

  const handlePreview = useCallback((index: number) => {
    if (disabled || previewingIndex === index) return;

    const voice = voices[index];
    if (!voice) return;

    setPreviewingIndex(index);

    const utterance = new SpeechSynthesisUtterance(
      'This is a preview of how this voice sounds. It is optimized for storytelling and narration.'
    );
    utterance.voice = voice;
    utterance.rate = 1.0;
    utterance.onend = () => setPreviewingIndex(null);
    utterance.onerror = () => setPreviewingIndex(null);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [disabled, voices, previewingIndex]);

  const cleanVoiceName = (name: string): string => {
    return name
      .replace(/\s*\(en[^)]*\)/gi, '')
      .replace(/\s*\[en[^\]]*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || name;
  };

  return (
    <div className="space-y-2">
      <label htmlFor="tts-voice-select" className="text-xs font-semibold text-zinc-400 uppercase tracking-wide block">
        Voice
        {voices[selectedIndex] && isStorytellingVoice && isStorytellingVoice(voices[selectedIndex].name) && (
          <span className="text-amber-500 text-[10px] normal-case ml-1">✨ Storytelling</span>
        )}
      </label>
      
      <select
        id="tts-voice-select"
        value={selectedIndex}
        onChange={(e) => onSelect(parseInt(e.target.value))}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
        disabled={disabled}
        aria-label="Select voice"
      >
        {voices.map((voice, idx) => {
          const isStory = isStorytellingVoice ? isStorytellingVoice(voice.name) : false;
          const displayName = cleanVoiceName(voice.name);
          
          return (
            <option key={idx} value={idx}>
              {isStory ? '✨ ' : ''}{displayName}
            </option>
          );
        })}
      </select>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handlePreview(selectedIndex)}
          disabled={disabled || previewingIndex === selectedIndex}
          className="text-xs text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
          aria-label="Preview voice"
        >
          {previewingIndex === selectedIndex ? '⏸ Previewing...' : '▶ Preview Voice'}
        </button>
        
        {voices[selectedIndex] && isStorytellingVoice && isStorytellingVoice(voices[selectedIndex].name) && (
          <span className="text-xs text-amber-500/80 italic">
            High-quality storytelling voice
          </span>
        )}
      </div>

      {voices.length > 0 && (
        <p className="text-xs text-zinc-500 italic">
          {voices.length} English voice{voices.length !== 1 ? 's' : ''} available
        </p>
      )}
    </div>
  );
};
