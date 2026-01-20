/**
 * Sound Effects Utility
 * 
 * Provides simple audio feedback for dramatic moments like Tribulation Gates.
 * Uses the Web Audio API for low-latency sound generation.
 */

// Audio context singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      return null;
    }
  }
  
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  return audioContext;
}

/**
 * Play a simple tone
 */
function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.1,
  type: OscillatorType = 'sine',
  startTime: number = 0
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  
  const now = ctx.currentTime + startTime;
  
  // Envelope: quick attack, sustained, quick release
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
  gainNode.gain.setValueAtTime(volume, now + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, now + duration);
  
  oscillator.start(now);
  oscillator.stop(now + duration);
}

/**
 * Play a chord (multiple tones at once)
 */
function playChord(
  frequencies: number[],
  duration: number,
  volume: number = 0.05,
  type: OscillatorType = 'sine'
): void {
  frequencies.forEach(freq => playTone(freq, duration, volume, type));
}

/**
 * Sound effect: Gate Appearance
 * A dramatic, ethereal sound for when the Tribulation Gate appears
 */
export function playGateAppearSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Create a sweeping pad-like sound
  // Low rumble
  playTone(80, 1.5, 0.1, 'sine');
  playTone(160, 1.5, 0.08, 'sine');
  
  // Rising ethereal tones
  playTone(220, 0.8, 0.05, 'sine', 0.2);
  playTone(330, 0.8, 0.04, 'sine', 0.4);
  playTone(440, 0.6, 0.03, 'sine', 0.6);
  playTone(550, 0.5, 0.02, 'sine', 0.8);
  
  // Mystical chord
  setTimeout(() => {
    playChord([293.66, 369.99, 440], 1.2, 0.04, 'sine'); // D, F#, A - D major
  }, 400);
}

/**
 * Sound effect: Path Selection
 * A confirmation sound when a path is selected
 */
export function playPathSelectSound(): void {
  // Quick ascending tones
  playTone(330, 0.15, 0.06, 'sine');
  playTone(440, 0.15, 0.06, 'sine', 0.08);
  playTone(550, 0.2, 0.05, 'sine', 0.16);
}

/**
 * Sound effect: Fate Confirmed
 * A powerful sound when the user confirms their fate choice
 */
export function playFateConfirmedSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Power chord with shimmer
  playChord([146.83, 220, 293.66], 0.8, 0.06, 'triangle'); // D power chord
  
  // Ascending shimmer
  setTimeout(() => {
    playTone(440, 0.3, 0.04, 'sine');
    playTone(550, 0.3, 0.03, 'sine', 0.05);
    playTone(660, 0.3, 0.02, 'sine', 0.1);
    playTone(880, 0.4, 0.02, 'sine', 0.15);
  }, 100);
}

/**
 * Sound effect: Thunder/Lightning
 * A rumbling thunder sound for dramatic effect
 */
export function playThunderSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Create noise-based thunder using multiple detuned oscillators
  const frequencies = [40, 50, 60, 70, 80, 100];
  
  frequencies.forEach((freq, i) => {
    const delay = Math.random() * 0.1;
    const duration = 0.5 + Math.random() * 0.5;
    playTone(freq + Math.random() * 10, duration, 0.03, 'sawtooth', delay);
  });
}

/**
 * Sound effect: Dice Roll (Let Fate Decide)
 * A mystical randomization sound
 */
export function playDiceRollSound(): void {
  // Quick random-ish tones
  const notes = [262, 294, 330, 349, 392, 440, 494];
  
  for (let i = 0; i < 8; i++) {
    const freq = notes[Math.floor(Math.random() * notes.length)];
    playTone(freq, 0.08, 0.04, 'square', i * 0.06);
  }
  
  // Final resolution
  setTimeout(() => {
    playChord([392, 494, 587], 0.5, 0.05, 'sine'); // G major
  }, 500);
}

/**
 * Sound effect: Skip/Dismiss
 * A subtle descending sound for skipping
 */
export function playSkipSound(): void {
  playTone(440, 0.15, 0.04, 'sine');
  playTone(392, 0.15, 0.03, 'sine', 0.1);
  playTone(330, 0.2, 0.02, 'sine', 0.2);
}

/**
 * Sound effect: Hover/Focus
 * A very subtle sound for hovering over paths
 */
export function playHoverSound(): void {
  playTone(600, 0.05, 0.02, 'sine');
}

/**
 * Check if sound is enabled in user preferences
 */
export function isSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem('tribulation_gate_sound_enabled');
    return stored !== 'false'; // Default to enabled
  } catch {
    return true;
  }
}

/**
 * Set sound enabled/disabled
 */
export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem('tribulation_gate_sound_enabled', String(enabled));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Play a sound effect if sound is enabled
 */
export function playSoundEffect(effect: () => void): void {
  if (isSoundEnabled()) {
    effect();
  }
}
