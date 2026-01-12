/**
 * Main TextToSpeech Component
 * Professional TTS player with all features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTextToSpeech } from '../../hooks/useTextToSpeech';
import { useTextSync } from '../../hooks/useTextSync';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VoiceSelector } from './VoiceSelector';
import { SettingsPanel } from './SettingsPanel';
import { TextHighlighter } from './TextHighlighter';
import { ttsService } from '../../services/ttsService';
import { useToast } from '../../contexts/ToastContext';

interface TextToSpeechProps {
  text: string;
  onClose?: () => void;
  showTextHighlight?: boolean; // Show text highlighting in component
  highlightMode?: 'word' | 'sentence';
}

// List of storytelling voices
const STORYTELLING_VOICES = [
  'Samantha', 'Alex', 'Victoria', 'Karen', 'Daniel', 'Fiona', 'Tessa',
  'Zira', 'David', 'Mark', 'Hazel', 'Susan',
  'Google US English', 'Google UK English Female', 'Google UK English Male',
  'Microsoft Zira', 'Microsoft David', 'Microsoft Mark',
  'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy',
];

const isStorytellingVoice = (voiceName: string): boolean => {
  const nameLower = voiceName.toLowerCase();
  return STORYTELLING_VOICES.some(story => nameLower.includes(story.toLowerCase()));
};

const isEnglishVoice = (voice: SpeechSynthesisVoice): boolean => {
  if (!voice.lang) return false;
  const lang = voice.lang.toLowerCase();
  return lang.startsWith('en') || lang.includes('english');
};

const filterAndSortVoices = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] => {
  const englishVoices = voices.filter(isEnglishVoice);
  return englishVoices.sort((a, b) => {
    const aIsStory = isStorytellingVoice(a.name);
    const bIsStory = isStorytellingVoice(b.name);
    if (aIsStory !== bIsStory) {
      return aIsStory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

const TextToSpeech: React.FC<TextToSpeechProps> = ({
  text,
  onClose,
  showTextHighlight = false,
  highlightMode = 'sentence'
}) => {
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [useGemini, setUseGemini] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [keyboardShortcuts, setKeyboardShortcuts] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const { showToast } = useToast();

  const {
    state,
    play,
    pause,
    resume,
    stop,
    setRate,
    setVoice,
    setVolume: setTTSVolume,
    setPitch: setTTSPitch,
    progress,
    duration,
    currentProvider,
    availableProviders,
    error
  } = useTextToSpeech(text, {
    provider: useGemini ? 'gemini' : 'browser',
    voice: useGemini ? 'Kore' : availableVoices[voiceIndex],
    rate: speed,
    pitch,
    volume,
    useCache: true,
    onError: (err) => {
      showToast(err.message, 'error');
    }
  });

  // Text synchronization
  const syncData = useTextSync({
    text,
    isPlaying: state === 'playing',
    progress,
    duration,
    syncGranularity: highlightMode
  });

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const filtered = filterAndSortVoices(voices);
        setAvailableVoices(filtered);
        
        if (filtered.length > 0) {
          const storytellingIndex = filtered.findIndex(v => isStorytellingVoice(v.name));
          setVoiceIndex(storytellingIndex >= 0 ? storytellingIndex : 0);
        }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // Update TTS settings when they change
  useEffect(() => {
    setTTSVolume(volume);
  }, [volume, setTTSVolume]);

  useEffect(() => {
    setTTSPitch(pitch);
  }, [pitch, setTTSPitch]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state === 'playing') pause();
          else if (state === 'paused') resume();
          else play();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          // Skip backward (implement if needed)
          break;
        case 'ArrowRight':
          e.preventDefault();
          // Skip forward (implement if needed)
          break;
        case 'ArrowUp':
          e.preventDefault();
          // Increase speed
          break;
        case 'ArrowDown':
          e.preventDefault();
          // Decrease speed
          break;
        case 'Escape':
          e.preventDefault();
          stop();
          if (onClose) onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcuts, state, play, pause, resume, stop, onClose]);

  const handleVoiceChange = useCallback((index: number) => {
    setVoiceIndex(index);
    if (!useGemini && availableVoices[index]) {
      setVoice(availableVoices[index]);
    }
  }, [useGemini, availableVoices, setVoice]);

  const handleToggleGemini = useCallback(() => {
    if (state === 'playing' || state === 'paused') {
      stop();
    }
    setUseGemini(!useGemini);
  }, [useGemini, state, stop]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    setRate(newSpeed);
  }, [setRate]);

  const currentTime = duration ? progress * duration : null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg">
      {/* Main Controls Bar */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-700 gap-3">
        <PlayerControls
          state={state}
          onPlay={play}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          disabled={!text.trim()}
        />

        {/* Speed Display - Compact */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-zinc-400 hidden sm:inline">Speed:</span>
          <div className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1">
            <button
              onClick={() => handleSpeedChange(Math.max(0.5, speed - 0.1))}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-1"
              disabled={speed <= 0.5}
              aria-label="Decrease speed"
            >
              −
            </button>
            <span className="text-xs font-semibold text-zinc-300 min-w-[2.5rem] text-center">
              {speed.toFixed(1)}x
            </span>
            <button
              onClick={() => handleSpeedChange(Math.min(3.0, speed + 0.1))}
              className="text-zinc-400 hover:text-zinc-200 text-xs px-1"
              disabled={speed >= 3.0}
              aria-label="Increase speed"
            >
              +
            </button>
          </div>
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 flex-shrink-0"
          aria-label={isExpanded ? 'Collapse settings' : 'Expand settings'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {(state === 'playing' || state === 'paused') && duration && (
        <div className="px-3 pb-2 border-b border-zinc-700">
          <ProgressBar
            progress={progress}
            duration={duration}
            currentTime={currentTime}
            showTime={true}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Text Highlighting (if enabled) */}
      {showTextHighlight && (state === 'playing' || state === 'paused') && (
        <div className="p-4 border-b border-zinc-700 max-h-48 overflow-y-auto">
          <TextHighlighter
            text={text}
            currentWordStart={syncData.wordStart}
            currentWordEnd={syncData.wordEnd}
            currentSentenceStart={syncData.sentenceStart}
            currentSentenceEnd={syncData.sentenceEnd}
            highlightMode={highlightMode}
            scrollIntoView={true}
          />
        </div>
      )}

      {/* Expanded Settings */}
      {isExpanded && (
        <SettingsPanel
          speed={speed}
          onSpeedChange={handleSpeedChange}
          pitch={pitch}
          onPitchChange={setPitch}
          volume={volume}
          onVolumeChange={setVolume}
          useGemini={useGemini}
          onToggleGemini={handleToggleGemini}
          availableProviders={availableProviders}
          keyboardShortcuts={keyboardShortcuts}
          onKeyboardShortcutsChange={setKeyboardShortcuts}
          autoPlay={autoPlay}
          onAutoPlayChange={setAutoPlay}
        />
      )}

      {/* Voice Selection (Browser TTS only) */}
      {isExpanded && !useGemini && availableVoices.length > 0 && (
        <div className="px-4 pb-4 border-t border-zinc-700">
          <VoiceSelector
            voices={availableVoices}
            selectedIndex={voiceIndex}
            onSelect={handleVoiceChange}
            disabled={state === 'playing' || state === 'loading'}
            isStorytellingVoice={isStorytellingVoice}
          />
        </div>
      )}
    </div>
  );
};

export default TextToSpeech;
