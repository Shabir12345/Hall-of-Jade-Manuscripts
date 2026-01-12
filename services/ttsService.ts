/**
 * Centralized TTS Service
 * Orchestrates TTS providers, caching, and fallback logic
 */

import { BrowserTTSProvider, BrowserTTSOptions } from './ttsProviders/browserTTS';
import { GeminiTTSProvider, GeminiTTSOptions } from './ttsProviders/geminiTTS';
import { ttsCache } from './ttsProviders/ttsCache';
import { normalizeText } from '../utils/textProcessor';

export type TTSProvider = 'browser' | 'gemini' | 'auto';

export interface TTSOptions {
  provider?: TTSProvider;
  voice?: SpeechSynthesisVoice | string; // Browser voice or Gemini voice name
  rate?: number; // Speed: 0.1 to 10 (browser) or 0.5 to 3.0 (effective)
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
  useCache?: boolean; // Default: true
  onProgress?: (progress: number) => void; // 0 to 1
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
}

export interface TTSResult {
  provider: TTSProvider;
  duration?: number; // Estimated or actual duration in seconds
  audioBuffer?: AudioBuffer; // For Gemini TTS
  utterance?: SpeechSynthesisUtterance; // For Browser TTS
}

export class TTSService {
  private browserTTS: BrowserTTSProvider;
  private geminiTTS: GeminiTTSProvider;
  private currentProvider: TTSProvider = 'auto';

  constructor() {
    this.browserTTS = new BrowserTTSProvider();
    this.geminiTTS = new GeminiTTSProvider();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): TTSProvider[] {
    const providers: TTSProvider[] = [];
    if (this.browserTTS.isAvailable()) {
      providers.push('browser');
    }
    if (this.geminiTTS.isAvailable()) {
      providers.push('gemini');
    }
    return providers;
  }

  /**
   * Select best provider based on availability and preferences
   */
  private selectProvider(preferred: TTSProvider): TTSProvider {
    if (preferred === 'auto') {
      // Prefer Gemini if available, fallback to browser
      if (this.geminiTTS.isAvailable()) {
        return 'gemini';
      }
      if (this.browserTTS.isAvailable()) {
        return 'browser';
      }
      throw new Error('No TTS providers available');
    }

    if (preferred === 'gemini' && !this.geminiTTS.isAvailable()) {
      if (this.browserTTS.isAvailable()) {
        console.warn('Gemini TTS not available, falling back to browser TTS');
        return 'browser';
      }
      throw new Error('Gemini TTS not available');
    }

    if (preferred === 'browser' && !this.browserTTS.isAvailable()) {
      if (this.geminiTTS.isAvailable()) {
        console.warn('Browser TTS not available, falling back to Gemini TTS');
        return 'gemini';
      }
      throw new Error('Browser TTS not available');
    }

    return preferred;
  }

  /**
   * Speak text using the selected provider
   */
  async speak(
    text: string,
    options: TTSOptions = {}
  ): Promise<TTSResult> {
    if (!text || !text.trim()) {
      throw new Error('No text provided');
    }

    const {
      provider = 'auto',
      voice,
      rate = 1.0,
      pitch = 1.0,
      volume = 1.0,
      useCache = true,
      onProgress,
      onChunkComplete
    } = options;

    // Normalize text
    const normalizedText = normalizeText(text);

    // Select provider
    const selectedProvider = this.selectProvider(provider);
    this.currentProvider = selectedProvider;

    // Check cache first (for Gemini TTS)
    if (useCache && selectedProvider === 'gemini') {
      const voiceName = typeof voice === 'string' ? voice : 'Kore';
      const cached = await ttsCache.get(normalizedText, voiceName, rate, 'gemini');
      
      if (cached) {
        // Convert ArrayBuffer to AudioBuffer
        const audioContext = this.geminiTTS.getAudioContext();
        if (audioContext) {
          try {
            const audioBuffer = await audioContext.decodeAudioData(cached.slice(0));
            return {
              provider: 'gemini',
              audioBuffer,
              duration: audioBuffer.length / audioBuffer.sampleRate
            };
          } catch (error) {
            console.warn('Failed to decode cached audio, regenerating:', error);
            // Continue to generate new audio
          }
        }
      }
    }

    try {
      if (selectedProvider === 'gemini') {
        return await this.speakWithGemini(normalizedText, {
          voiceName: typeof voice === 'string' ? voice : 'Kore',
          rate,
          useCache,
          onProgress,
          onChunkComplete
        });
      } else {
        return await this.speakWithBrowser(normalizedText, {
          voice: typeof voice === 'object' ? voice : undefined,
          rate,
          pitch,
          volume,
          onProgress
        });
      }
    } catch (error) {
      // Fallback to browser if Gemini fails
      if (selectedProvider === 'gemini' && this.browserTTS.isAvailable()) {
        console.warn('Gemini TTS failed, falling back to browser TTS:', error);
        return await this.speakWithBrowser(normalizedText, {
          voice: typeof voice === 'object' ? voice : undefined,
          rate,
          pitch,
          volume,
          onProgress
        });
      }
      throw error;
    }
  }

  private async speakWithGemini(
    text: string,
    options: {
      voiceName: string;
      rate: number;
      useCache: boolean;
      onProgress?: (progress: number) => void;
      onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
    }
  ): Promise<TTSResult> {
    const { voiceName, rate, useCache, onProgress, onChunkComplete } = options;

    const result = await this.geminiTTS.generateAudio(text, {
      voiceName,
      chunkSize: 2000,
      useCrossfade: true,
      normalize: true
    });

    // Cache the audio
    if (useCache && result.audioBuffer) {
      try {
        // Convert AudioBuffer to ArrayBuffer for caching
        const { audioBufferToArrayBuffer } = await import('../utils/audioUtils');
        const audioData = audioBufferToArrayBuffer(result.audioBuffer);
        await ttsCache.set(text, voiceName, rate, 'gemini', audioData, result.duration);
      } catch (error) {
        console.warn('Failed to cache audio:', error);
        // Continue without caching
      }
    }

    // Apply speed adjustment
    if (rate !== 1.0 && result.audioBuffer) {
      // Speed adjustment will be handled by AudioBufferSourceNode.playbackRate
      // when playing the audio
    }

    return {
      provider: 'gemini',
      audioBuffer: result.audioBuffer,
      duration: result.duration
    };
  }

  private async speakWithBrowser(
    text: string,
    options: {
      voice?: SpeechSynthesisVoice;
      rate: number;
      pitch: number;
      volume: number;
      onProgress?: (progress: number) => void;
    }
  ): Promise<TTSResult> {
    const { voice, rate, pitch, volume, onProgress } = options;

    let progress = 0;
    const estimatedDuration = text.length / 150; // Rough estimate: 150 chars per second at 1x speed
    const startTime = Date.now();

    const utterance = this.browserTTS.speak(text, {
      voice,
      rate: Math.max(0.1, Math.min(10, rate)),
      pitch: Math.max(0, Math.min(2, pitch)),
      volume: Math.max(0, Math.min(1, volume))
    }, {
      onStart: () => {
        if (onProgress) onProgress(0);
      },
      onEnd: () => {
        if (onProgress) onProgress(1);
      },
      onBoundary: (event) => {
        if (onProgress && estimatedDuration > 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          progress = Math.min(1, elapsed / estimatedDuration);
          onProgress(progress);
        }
      }
    });

    if (!utterance) {
      throw new Error('Failed to create speech utterance');
    }

    return {
      provider: 'browser',
      utterance,
      duration: estimatedDuration
    };
  }

  /**
   * Cancel current speech
   */
  cancel(): void {
    this.browserTTS.cancel();
    // Note: Gemini TTS cancellation is handled by the audio source
  }

  /**
   * Pause current speech
   */
  pause(): void {
    this.browserTTS.pause();
    // Note: Gemini TTS pause is handled by AudioContext.suspend()
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    this.browserTTS.resume();
    // Note: Gemini TTS resume is handled by AudioContext.resume()
  }

  /**
   * Get browser TTS provider (for direct access if needed)
   */
  getBrowserTTS(): BrowserTTSProvider {
    return this.browserTTS;
  }

  /**
   * Get Gemini TTS provider (for direct access if needed)
   */
  getGeminiTTS(): GeminiTTSProvider {
    return this.geminiTTS;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): TTSProvider {
    return this.currentProvider;
  }
}

// Singleton instance
export const ttsService = new TTSService();
