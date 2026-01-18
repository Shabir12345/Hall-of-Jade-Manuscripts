/**
 * Centralized TTS Service
 * Orchestrates TTS providers, caching, and fallback logic
 */

import { BrowserTTSProvider, BrowserTTSOptions } from './ttsProviders/browserTTS';
import { normalizeText } from '../utils/textProcessor';

export type TTSProvider = 'browser' | 'auto';

export interface TTSOptions {
  provider?: TTSProvider;
  voice?: SpeechSynthesisVoice;
  rate?: number; // Speed: 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
  onProgress?: (progress: number) => void; // 0 to 1
}

export interface TTSResult {
  provider: TTSProvider;
  duration?: number; // Estimated or actual duration in seconds
  utterance?: SpeechSynthesisUtterance; // For Browser TTS
}

export class TTSService {
  private browserTTS: BrowserTTSProvider;
  private currentProvider: TTSProvider = 'auto';

  constructor() {
    this.browserTTS = new BrowserTTSProvider();
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): TTSProvider[] {
    const providers: TTSProvider[] = [];
    if (this.browserTTS.isAvailable()) {
      providers.push('browser');
    }
    return providers;
  }

  /**
   * Select best provider based on availability and preferences
   */
  private selectProvider(preferred: TTSProvider): TTSProvider {
    if (preferred === 'auto') {
      if (this.browserTTS.isAvailable()) {
        return 'browser';
      }
      throw new Error('No TTS providers available');
    }

    if (preferred === 'browser' && !this.browserTTS.isAvailable()) {
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
      onProgress
    } = options;

    // Normalize text
    const normalizedText = normalizeText(text);

    // Select provider
    const selectedProvider = this.selectProvider(provider);
    this.currentProvider = selectedProvider;

    return await this.speakWithBrowser(normalizedText, {
      voice: typeof voice === 'object' ? voice : undefined,
      rate,
      pitch,
      volume,
      onProgress
    });
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
  }

  /**
   * Pause current speech
   */
  pause(): void {
    this.browserTTS.pause();
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    this.browserTTS.resume();
  }

  /**
   * Get browser TTS provider (for direct access if needed)
   */
  getBrowserTTS(): BrowserTTSProvider {
    return this.browserTTS;
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
