/**
 * Text Highlighter Component
 * Highlights text being read during TTS playback
 */

import React, { useEffect, useRef } from 'react';

export interface TextHighlighterProps {
  text: string;
  currentWordStart: number;
  currentWordEnd: number;
  currentSentenceStart: number;
  currentSentenceEnd: number;
  highlightMode?: 'word' | 'sentence'; // Default: 'sentence'
  className?: string;
  scrollIntoView?: boolean;
}

export const TextHighlighter: React.FC<TextHighlighterProps> = ({
  text,
  currentWordStart,
  currentWordEnd,
  currentSentenceStart,
  currentSentenceEnd,
  highlightMode = 'sentence',
  className = '',
  scrollIntoView = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  // Scroll highlighted text into view
  useEffect(() => {
    if (scrollIntoView && highlightRef.current) {
      highlightRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [currentSentenceStart, scrollIntoView]);

  const renderHighlightedText = () => {
    if (highlightMode === 'word' && currentWordStart >= 0 && currentWordEnd > currentWordStart) {
      // Highlight word
      const before = text.substring(0, currentWordStart);
      const word = text.substring(currentWordStart, currentWordEnd);
      const after = text.substring(currentWordEnd);

      return (
        <>
          {before}
          <span
            ref={highlightRef}
            className="bg-amber-500/30 text-amber-200 px-1 rounded"
          >
            {word}
          </span>
          {after}
        </>
      );
    } else if (currentSentenceStart >= 0 && currentSentenceEnd > currentSentenceStart) {
      // Highlight sentence
      const before = text.substring(0, currentSentenceStart);
      const sentence = text.substring(currentSentenceStart, currentSentenceEnd);
      const after = text.substring(currentSentenceEnd);

      return (
        <>
          {before}
          <span
            ref={highlightRef}
            className="bg-amber-500/20 text-amber-100 px-1 rounded"
          >
            {sentence}
          </span>
          {after}
        </>
      );
    }

    return text;
  };

  return (
    <div
      ref={containerRef}
      className={`text-zinc-300 leading-relaxed ${className}`}
      style={{ whiteSpace: 'pre-wrap' }}
    >
      {renderHighlightedText()}
    </div>
  );
};
