/**
 * Browser TTS Provider
 * Uses Web Speech API for text-to-speech
 */

export interface BrowserTTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number; // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
  lang?: string;
}

export interface BrowserTTSResult {
  utterance: SpeechSynthesisUtterance;
  synth: SpeechSynthesis;
}

export class BrowserTTSProvider {
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  isAvailable(): boolean {
    return this.synth !== null;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  speak(
    text: string,
    options: BrowserTTSOptions = {},
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: SpeechSynthesisErrorEvent) => void;
      onBoundary?: (event: SpeechSynthesisEvent) => void;
      onPause?: () => void;
      onResume?: () => void;
    }
  ): SpeechSynthesisUtterance | null {
    if (!this.synth || !text.trim()) {
      return null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (options.voice) {
      utterance.voice = options.voice;
    }
    if (options.rate !== undefined) {
      utterance.rate = Math.max(0.1, Math.min(10, options.rate));
    }
    if (options.pitch !== undefined) {
      utterance.pitch = Math.max(0, Math.min(2, options.pitch));
    }
    if (options.volume !== undefined) {
      utterance.volume = Math.max(0, Math.min(1, options.volume));
    }
    if (options.lang) {
      utterance.lang = options.lang;
    }

    if (callbacks?.onStart) {
      utterance.onstart = callbacks.onStart;
    }
    if (callbacks?.onEnd) {
      utterance.onend = callbacks.onEnd;
    }
    if (callbacks?.onError) {
      utterance.onerror = callbacks.onError;
    }
    if (callbacks?.onBoundary) {
      utterance.onboundary = callbacks.onBoundary;
    }
    if (callbacks?.onPause) {
      utterance.onpause = callbacks.onPause;
    }
    if (callbacks?.onResume) {
      utterance.onresume = callbacks.onResume;
    }

    this.synth.speak(utterance);
    return utterance;
  }

  cancel(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }

  getPending(): boolean {
    return this.synth ? this.synth.pending : false;
  }

  getSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }

  getPaused(): boolean {
    return this.synth ? this.synth.paused : false;
  }
}
