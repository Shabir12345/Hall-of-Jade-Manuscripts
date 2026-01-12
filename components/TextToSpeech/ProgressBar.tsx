/**
 * Progress Bar Component
 * Shows playback progress with time remaining
 */

import React from 'react';

export interface ProgressBarProps {
  progress: number; // 0 to 1
  duration: number | null; // in seconds
  currentTime: number | null; // in seconds
  onSeek?: (progress: number) => void;
  showTime?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  duration,
  currentTime,
  onSeek,
  showTime = true,
  className = ''
}) => {
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(1, x / rect.width));
    onSeek(newProgress);
  };

  const remainingTime = duration && currentTime ? duration - currentTime : null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showTime && (
        <span className="text-xs text-zinc-400 font-mono min-w-[3rem] text-right">
          {formatTime(currentTime)}
        </span>
      )}
      
      <div
        className="flex-1 h-2 bg-zinc-800 rounded-full cursor-pointer relative group"
        onClick={handleSeek}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress * 100}
        aria-label="Playback progress"
      >
        <div className="h-full bg-amber-600 rounded-full transition-all duration-100" style={{ width: `${progress * 100}%` }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress * 100}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {showTime && (
        <span className="text-xs text-zinc-400 font-mono min-w-[3rem]">
          {remainingTime !== null ? `-${formatTime(remainingTime)}` : formatTime(duration)}
        </span>
      )}
    </div>
  );
};
