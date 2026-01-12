import React, { useEffect, useState, useRef } from 'react';

interface GenerationProgressBarProps {
  isVisible: boolean;
  progress: number; // 0 to 100
  statusMessage: string;
  onCancel?: () => void;
}

// Easing function for smooth animation
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

const GenerationProgressBar: React.FC<GenerationProgressBarProps> = ({ 
  isVisible, 
  progress, 
  statusMessage,
  onCancel 
}) => {
  // Smooth progress animation using requestAnimationFrame
  const [displayProgress, setDisplayProgress] = useState(0);
  const [previousStatus, setPreviousStatus] = useState(statusMessage);
  const animationFrameRef = useRef<number | null>(null);
  const startProgressRef = useRef(0);
  const targetProgressRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentDisplayProgressRef = useRef(0);
  const animationDuration = 500; // 500ms for smooth transitions

  // Track milestone achievements
  const [milestones, setMilestones] = useState<Set<number>>(new Set());
  const milestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!isVisible) {
      setDisplayProgress(0);
      currentDisplayProgressRef.current = 0;
      milestonesRef.current.clear();
      setMilestones(new Set());
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Clamp progress between 0-100 and ensure it never decreases
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const targetProgress = Math.max(clampedProgress, currentDisplayProgressRef.current);
    targetProgressRef.current = targetProgress;

    // Check for milestone achievements (25%, 50%, 75%)
    const milestoneValues = [25, 50, 75];
    milestoneValues.forEach(milestone => {
      if (targetProgress >= milestone && !milestonesRef.current.has(milestone)) {
        milestonesRef.current.add(milestone);
        setMilestones(new Set(milestonesRef.current));
      }
    });

    // Start animation from current display progress
    startProgressRef.current = currentDisplayProgressRef.current;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progressRatio = Math.min(elapsed / animationDuration, 1);
      const easedProgress = easeOutCubic(progressRatio);
      
      const currentProgress = startProgressRef.current + 
        (targetProgressRef.current - startProgressRef.current) * easedProgress;
      
      currentDisplayProgressRef.current = currentProgress;
      setDisplayProgress(currentProgress);

      if (progressRatio < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [progress, isVisible]);

  // Handle status message transitions
  useEffect(() => {
    if (statusMessage !== previousStatus) {
      setPreviousStatus(statusMessage);
    }
  }, [statusMessage, previousStatus]);

  if (!isVisible) return null;

  // Generate particles for visual effect
  const particles = Array.from({ length: 4 }, (_, i) => i);

  return (
    <div className="w-full mt-4 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
      {/* Background gradient animation */}
      <div className="absolute inset-0 opacity-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] animate-[gradient-shift_8s_ease-in-out_infinite] pointer-events-none"></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-2">
          <span 
            key={statusMessage}
            className="text-sm font-medium text-amber-500 font-fantasy tracking-wide animate-in fade-in duration-300"
          >
            {statusMessage}
          </span>
          <span className="text-xs font-mono text-zinc-500 tabular-nums">
            {Math.round(displayProgress)}%
          </span>
        </div>
        
        <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50 relative">
          {/* Progress milestones */}
          {[25, 50, 75].map((milestone) => (
            <div
              key={milestone}
              className={`absolute top-0 bottom-0 w-0.5 ${
                milestones.has(milestone)
                  ? 'bg-amber-400 animate-milestone-pulse'
                  : 'bg-zinc-600/50'
              }`}
              style={{ left: `${milestone}%` }}
            />
          ))}
          
          {/* Progress bar with glow */}
          <div 
            className="h-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500 relative animate-pulse-glow transition-all duration-300 ease-out"
            style={{ width: `${displayProgress}%` }}
          >
            {/* Enhanced shimmer effect */}
            <div 
              className="absolute inset-0 animate-shimmer"
              style={{ 
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                width: '50%',
              }}
            />
            
            {/* Particle effects */}
            {particles.map((particle, index) => (
              <div
                key={particle}
                className="absolute top-1/2 w-1 h-1 bg-white/60 rounded-full animate-particle-float"
                style={{
                  left: `${(displayProgress / 100) * 80 + index * 5}%`,
                  animationDelay: `${index * 0.5}s`,
                  animationDuration: `${2 + index * 0.5}s`,
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <p className="text-xs text-zinc-500 italic">
            Weaving the threads of destiny...
          </p>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerationProgressBar;
