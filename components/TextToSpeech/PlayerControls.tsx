/**
 * Player Controls Component
 * Compact control buttons for play, pause, stop, skip
 */

import React from 'react';

export interface PlayerControlsProps {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipBackward?: () => void;
  onSkipForward?: () => void;
  disabled?: boolean;
  showSkip?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  state,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipBackward,
  onSkipForward,
  disabled = false,
  showSkip = false
}) => {
  const handlePlayPause = () => {
    if (state === 'playing') {
      onPause();
    } else if (state === 'paused') {
      onResume();
    } else {
      onPlay();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {showSkip && onSkipBackward && (
        <button
          onClick={onSkipBackward}
          disabled={disabled || state === 'idle'}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          aria-label="Skip backward"
          title="Skip backward 10 seconds"
        >
          ⏪
        </button>
      )}

      <button
        onClick={handlePlayPause}
        disabled={disabled || state === 'error'}
        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[100px] justify-center"
        aria-label={state === 'playing' ? 'Pause' : state === 'paused' ? 'Resume' : 'Play'}
      >
        {state === 'loading' ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></span>
            <span className="hidden sm:inline">Loading</span>
          </>
        ) : state === 'playing' ? (
          <>
            <span>⏸</span>
            <span className="hidden sm:inline">Pause</span>
          </>
        ) : state === 'paused' ? (
          <>
            <span>▶</span>
            <span className="hidden sm:inline">Resume</span>
          </>
        ) : (
          <>
            <span>▶</span>
            <span className="hidden sm:inline">Play</span>
          </>
        )}
      </button>

      {(state === 'playing' || state === 'paused') && (
        <button
          onClick={onStop}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 flex-shrink-0"
          aria-label="Stop"
          title="Stop playback"
        >
          ⏹
        </button>
      )}

      {showSkip && onSkipForward && (
        <button
          onClick={onSkipForward}
          disabled={disabled || state === 'idle'}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2.5 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          aria-label="Skip forward"
          title="Skip forward 10 seconds"
        >
          ⏩
        </button>
      )}
    </div>
  );
};
