/**
 * Gemini TTS Provider
 * Uses Gemini API for high-quality text-to-speech
 */

import { reciteChapter } from '../aiService';
import { chunkText } from '../../utils/textProcessor';
import { base64ToAudioBuffer, concatenateAudioBuffers, normalizeAudioBuffer } from '../../utils/audioUtils';

export interface GeminiTTSOptions {
  voiceName?: string; // Default: 'Kore'
  chunkSize?: number; // Default: 2000
  useCrossfade?: boolean; // Default: true
  normalize?: boolean; // Default: true
}

export interface GeminiTTSResult {
  audioBuffer: AudioBuffer;
  duration: number; // in seconds
}

export class GeminiTTSProvider {
  private audioContext: AudioContext | null = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
    }
  }

  isAvailable(): boolean {
    return this.audioContext !== null;
  }

  async generateAudio(
    text: string,
    options: GeminiTTSOptions = {}
  ): Promise<GeminiTTSResult> {
    if (!this.audioContext) {
      throw new Error('AudioContext not available');
    }

    const {
      voiceName = 'Kore',
      chunkSize = 2000,
      useCrossfade = true,
      normalize = true
    } = options;

    // Chunk the text
    const chunks = chunkText(text, chunkSize);
    
    if (chunks.length === 0) {
      throw new Error('No text to generate audio for');
    }

    // Generate audio for each chunk
    const audioBuffers: AudioBuffer[] = [];
    const errors: Error[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const base64 = await this.generateChunkAudio(chunk.text, voiceName);
        if (!base64) {
          throw new Error(`No audio data received for chunk ${i + 1}`);
        }

        const buffer = base64ToAudioBuffer(this.audioContext, base64, 24000);
        audioBuffers.push(buffer);
      } catch (error) {
        console.error(`Error generating audio for chunk ${i + 1}:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
        
        // If we have some audio, continue; otherwise fail
        if (audioBuffers.length === 0) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    // Concatenate all buffers
    let finalBuffer: AudioBuffer;
    if (audioBuffers.length === 1) {
      finalBuffer = audioBuffers[0];
    } else if (useCrossfade && audioBuffers.length > 1) {
      // Concatenate with crossfades
      finalBuffer = audioBuffers[0];
      for (let i = 1; i < audioBuffers.length; i++) {
        const { addCrossfade } = await import('../../utils/audioUtils');
        finalBuffer = addCrossfade(this.audioContext, finalBuffer, audioBuffers[i], 0.05);
      }
    } else {
      finalBuffer = await concatenateAudioBuffers(this.audioContext, audioBuffers);
    }

    // Normalize if requested
    if (normalize) {
      finalBuffer = normalizeAudioBuffer(finalBuffer, 0.95);
    }

    // Calculate duration
    const duration = finalBuffer.length / finalBuffer.sampleRate;

    return {
      audioBuffer: finalBuffer,
      duration
    };
  }

  private async generateChunkAudio(text: string, voiceName: string): Promise<string> {
    // Import reciteChapter dynamically to avoid circular dependencies
    const { reciteChapter } = await import('../geminiService');
    
    // Generate audio for this chunk
    const base64 = await reciteChapter(text, voiceName, 2000);
    
    if (!base64) {
      throw new Error('No audio data received from Gemini');
    }
    
    return base64;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}
