/**
 * Custom hook for Text-to-Speech functionality
 * Provides high-level TTS controls and state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ttsService, TTSOptions, TTSResult } from '../services/ttsService';

export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface UseTTSOptions {
  provider?: 'browser' | 'auto';
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStateChange?: (state: PlaybackState) => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export interface UseTTSReturn {
  state: PlaybackState;
  play: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setVoice: (voice: SpeechSynthesisVoice) => void;
  setVolume: (volume: number) => void;
  setPitch: (pitch: number) => void;
  progress: number;
  duration: number | null;
  currentProvider: 'browser' | null;
  availableProviders: ('browser')[];
  error: string | null;
}

export function useTextToSpeech(text: string, options: UseTTSOptions = {}): UseTTSReturn {
  const [state, setState] = useState<PlaybackState>('idle');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentProvider, setCurrentProvider] = useState<'browser' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(options.rate ?? 1.0);
  const [voice, setVoiceState] = useState<SpeechSynthesisVoice | undefined>(options.voice);
  const [volume, setVolumeState] = useState(options.volume ?? 1.0);
  const [pitch, setPitchState] = useState(options.pitch ?? 1.0);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    provider = 'auto',
    onStateChange,
    onProgress,
    onError
  } = options;

  // Update state and notify callback
  const updateState = useCallback((newState: PlaybackState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      audioSourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    utteranceRef.current = null;
    startTimeRef.current = null;
    setProgress(0);
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    ttsService.cancel();
    cleanup();
    updateState('idle');
    setError(null);
  }, [cleanup, updateState]);

  // Pause playback
  const pause = useCallback(() => {
    if (state === 'playing') {
      ttsService.pause();
      updateState('paused');
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [state, updateState]);

  // Resume playback
  const resume = useCallback(() => {
    if (state === 'paused') {
      ttsService.resume();
      updateState('playing');
      startProgressTracking();
    }
  }, [state, updateState, startProgressTracking]);

  // Start progress tracking
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    if (duration && duration > 0) {
      startTimeRef.current = Date.now();
      progressIntervalRef.current = setInterval(() => {
        if (startTimeRef.current && duration) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const newProgress = Math.min(1, elapsed / duration);
          setProgress(newProgress);
          onProgress?.(newProgress);
        }
      }, 100);
    }
  }, [duration, onProgress]);

  // Play text
  const play = useCallback(async () => {
    if (!text || !text.trim()) {
      setError('No text to read');
      return;
    }

    stop(); // Stop any current playback
    updateState('loading');
    setError(null);
    setProgress(0);

    try {
      const result = await ttsService.speak(text, {
        provider,
        voice,
        rate,
        pitch,
        volume,
        onProgress: (prog) => {
          setProgress(prog);
          onProgress?.(prog);
        }
      });

      setCurrentProvider('browser');

      if (result.provider === 'browser' && result.utterance) {
        // Browser TTS is handled by the service
        utteranceRef.current = result.utterance;
        
        if (result.duration) {
          setDuration(result.duration);
          startProgressTracking();
        }

        updateState('playing');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start speech synthesis';
      setError(errorMessage);
      updateState('error');
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [text, provider, voice, rate, pitch, volume, stop, updateState, onProgress, onError, startProgressTracking, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Get available providers
  const availableProviders: ('browser')[] = [];
  if (ttsService.getBrowserTTS().isAvailable()) {
    availableProviders.push('browser');
  }

  const handleSetRate = useCallback((newRate: number) => {
    setRateState(newRate);
    // If playing, restart with new rate
    if (state === 'playing' || state === 'paused') {
      stop();
      setTimeout(() => {
        setRateState(newRate);
        play();
      }, 100);
    }
  }, [state, stop, play]);

  const handleSetVoice = useCallback((newVoice: SpeechSynthesisVoice) => {
    setVoiceState(newVoice);
    // If playing, restart with new voice
    if (state === 'playing' || state === 'paused') {
      stop();
      setTimeout(() => {
        setVoiceState(newVoice);
        play();
      }, 100);
    }
  }, [state, stop, play]);

  const handleSetPitch = useCallback((newPitch: number) => {
    setPitchState(newPitch);
    // If playing, restart with new pitch
    if (state === 'playing' || state === 'paused') {
      stop();
      setTimeout(() => {
        setPitchState(newPitch);
        play();
      }, 100);
    }
  }, [state, stop, play]);

  const handleSetVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    // If playing, restart with new volume
    if (state === 'playing' || state === 'paused') {
      stop();
      setTimeout(() => {
        setVolumeState(newVolume);
        play();
      }, 100);
    }
  }, [state, stop, play]);

  return {
    state,
    play,
    pause,
    resume,
    stop,
    setRate: handleSetRate,
    setVoice: handleSetVoice,
    setVolume: handleSetVolume,
    setPitch: handleSetPitch,
    progress,
    duration,
    currentProvider,
    availableProviders,
    error
  };
}
