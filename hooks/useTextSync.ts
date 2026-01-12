/**
 * Hook for text synchronization during TTS playback
 * Tracks current word/sentence being read and provides highlighting data
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getWordBoundaries, getSentenceBoundaries } from '../utils/textProcessor';

export interface TextSyncData {
  currentWordIndex: number;
  currentSentenceIndex: number;
  currentWord: string | null;
  currentSentence: string | null;
  wordStart: number;
  wordEnd: number;
  sentenceStart: number;
  sentenceEnd: number;
}

export interface UseTextSyncOptions {
  text: string;
  isPlaying: boolean;
  progress: number; // 0 to 1
  duration: number | null; // in seconds
  syncGranularity?: 'word' | 'sentence'; // Default: 'sentence'
}

export function useTextSync(options: UseTextSyncOptions): TextSyncData {
  const { text, isPlaying, progress, duration, syncGranularity = 'sentence' } = options;
  
  const [syncData, setSyncData] = useState<TextSyncData>({
    currentWordIndex: -1,
    currentSentenceIndex: -1,
    currentWord: null,
    currentSentence: null,
    wordStart: 0,
    wordEnd: 0,
    sentenceStart: 0,
    sentenceEnd: 0
  });

  const wordsRef = useRef<Array<{ word: string; start: number; end: number }>>([]);
  const sentencesRef = useRef<Array<{ sentence: string; start: number; end: number }>>([]);

  // Calculate word and sentence boundaries
  useEffect(() => {
    if (text) {
      wordsRef.current = getWordBoundaries(text);
      sentencesRef.current = getSentenceBoundaries(text);
    }
  }, [text]);

  // Update sync data based on progress
  useEffect(() => {
    if (!isPlaying || !duration || progress < 0 || progress > 1) {
      return;
    }

    const currentPosition = progress * duration;
    const textLength = text.length;
    const estimatedCharPosition = Math.floor((currentPosition / duration) * textLength);

    // Find current sentence
    let currentSentenceIndex = -1;
    for (let i = 0; i < sentencesRef.current.length; i++) {
      const sentence = sentencesRef.current[i];
      if (estimatedCharPosition >= sentence.start && estimatedCharPosition < sentence.end) {
        currentSentenceIndex = i;
        break;
      }
    }

    // Find current word
    let currentWordIndex = -1;
    for (let i = 0; i < wordsRef.current.length; i++) {
      const word = wordsRef.current[i];
      if (estimatedCharPosition >= word.start && estimatedCharPosition < word.end) {
        currentWordIndex = i;
        break;
      }
    }

    if (currentSentenceIndex >= 0) {
      const sentence = sentencesRef.current[currentSentenceIndex];
      const word = currentWordIndex >= 0 ? wordsRef.current[currentWordIndex] : null;

      setSyncData({
        currentWordIndex,
        currentSentenceIndex,
        currentWord: word?.word || null,
        currentSentence: sentence.sentence,
        wordStart: word?.start || 0,
        wordEnd: word?.end || 0,
        sentenceStart: sentence.start,
        sentenceEnd: sentence.end
      });
    }
  }, [text, isPlaying, progress, duration]);

  return syncData;
}
