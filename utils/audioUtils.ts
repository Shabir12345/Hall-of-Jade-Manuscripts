/**
 * Audio manipulation utilities for TTS
 * Handles audio buffer concatenation, normalization, and processing
 */

/**
 * Concatenate multiple audio buffers into one
 */
export async function concatenateAudioBuffers(
  audioContext: AudioContext,
  buffers: AudioBuffer[]
): Promise<AudioBuffer> {
  if (buffers.length === 0) {
    throw new Error('No audio buffers to concatenate');
  }

  if (buffers.length === 1) {
    return buffers[0];
  }

  // Get the first buffer's properties
  const sampleRate = buffers[0].sampleRate;
  const numberOfChannels = buffers[0].numberOfChannels;

  // Verify all buffers have the same properties
  for (const buffer of buffers) {
    if (buffer.sampleRate !== sampleRate) {
      throw new Error('All buffers must have the same sample rate');
    }
    if (buffer.numberOfChannels !== numberOfChannels) {
      throw new Error('All buffers must have the same number of channels');
    }
  }

  // Calculate total length
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);

  // Create new buffer
  const concatenatedBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  // Copy data from each buffer
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel);
      const targetData = concatenatedBuffer.getChannelData(channel);
      targetData.set(sourceData, offset);
    }
    offset += buffer.length;
  }

  return concatenatedBuffer;
}

/**
 * Add crossfade between two audio buffers
 */
export function addCrossfade(
  audioContext: AudioContext,
  buffer1: AudioBuffer,
  buffer2: AudioBuffer,
  fadeDuration: number = 0.05 // 50ms default
): AudioBuffer {
  const sampleRate = buffer1.sampleRate;
  const numberOfChannels = buffer1.numberOfChannels;
  const fadeSamples = Math.floor(fadeDuration * sampleRate);
  const totalLength = buffer1.length + buffer2.length - fadeSamples;

  const crossfadedBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalLength,
    sampleRate
  );

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData1 = buffer1.getChannelData(channel);
    const channelData2 = buffer2.getChannelData(channel);
    const outputData = crossfadedBuffer.getChannelData(channel);

    // Copy first buffer (with fade out at the end)
    for (let i = 0; i < buffer1.length - fadeSamples; i++) {
      outputData[i] = channelData1[i];
    }

    // Crossfade section
    for (let i = 0; i < fadeSamples; i++) {
      const fadeOut = 1 - (i / fadeSamples);
      const fadeIn = i / fadeSamples;
      const index1 = buffer1.length - fadeSamples + i;
      const index2 = i;
      outputData[buffer1.length - fadeSamples + i] = 
        channelData1[index1] * fadeOut + channelData2[index2] * fadeIn;
    }

    // Copy second buffer (with fade in at the start)
    for (let i = fadeSamples; i < buffer2.length; i++) {
      outputData[buffer1.length - fadeSamples + i] = channelData2[i];
    }
  }

  return crossfadedBuffer;
}

/**
 * Normalize audio buffer to a target peak level
 */
export function normalizeAudioBuffer(
  buffer: AudioBuffer,
  targetPeak: number = 0.95
): AudioBuffer {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;

  // Find peak across all channels
  let peak = 0;
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const absValue = Math.abs(channelData[i]);
      if (absValue > peak) {
        peak = absValue;
      }
    }
  }

  // If already at or below target, return original
  if (peak <= targetPeak) {
    return buffer;
  }

  // Calculate gain factor
  const gainFactor = targetPeak / peak;

  // Create normalized buffer
  const normalizedBuffer = buffer.context.createBuffer(
    numberOfChannels,
    length,
    sampleRate
  );

  // Apply gain
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const targetData = normalizedBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      targetData[i] = sourceData[i] * gainFactor;
    }
  }

  return normalizedBuffer;
}

/**
 * Convert base64 PCM16 audio to AudioBuffer
 */
export function base64ToAudioBuffer(
  audioContext: AudioContext,
  base64: string,
  sampleRate: number = 24000
): AudioBuffer {
  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Convert to Int16Array (PCM16)
  const int16Data = new Int16Array(bytes.buffer);
  
  // Convert to Float32Array (normalized to -1 to 1)
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }

  // Create audio buffer
  const buffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
  buffer.getChannelData(0).set(float32Data);

  return buffer;
}

/**
 * Estimate audio duration from text length (rough approximation)
 */
export function estimateAudioDuration(textLength: number, wordsPerMinute: number = 150): number {
  // Average word length is about 5 characters
  const words = textLength / 5;
  const minutes = words / wordsPerMinute;
  return minutes * 60; // Return in seconds
}

/**
 * Convert AudioBuffer to ArrayBuffer for storage
 */
export function audioBufferToArrayBuffer(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  
  // For PCM16, we need to convert Float32 to Int16
  const int16Data = new Int16Array(length);
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  
  for (let i = 0; i < length; i++) {
    // Clamp and convert to Int16
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  
  return int16Data.buffer;
}
