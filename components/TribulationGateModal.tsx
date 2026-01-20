/**
 * Tribulation Gate Modal Component
 * 
 * A dramatic, immersive modal presenting fate path choices to the user.
 * Features a Xianxia-themed visual design with lightning effects,
 * heavenly clouds aesthetic, and animated entrance.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TribulationGate,
  FatePath,
  FatePathRisk,
  TRIGGER_DISPLAY_INFO,
} from '../types/tribulationGates';
import {
  playSoundEffect,
  playGateAppearSound,
  playPathSelectSound,
  playFateConfirmedSound,
  playDiceRollSound,
  playSkipSound,
} from '../utils/soundEffects';

interface TribulationGateModalProps {
  /** The gate to display */
  gate: TribulationGate;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when user selects a path */
  onSelectPath: (pathId: string) => void;
  /** Callback when user skips the gate */
  onSkip: () => void;
  /** Callback when user wants to let fate decide (random) */
  onLetFateDecide: () => void;
  /** Whether path selection is in progress */
  isLoading?: boolean;
  /** Optional auto-select timeout in milliseconds */
  autoSelectAfterMs?: number;
}

/**
 * Risk level styling configuration
 */
const RISK_STYLES: Record<FatePathRisk, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  glow: string;
}> = {
  low: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-600/50',
    text: 'text-emerald-400',
    badge: 'bg-emerald-600',
    glow: 'hover:shadow-emerald-500/20',
  },
  medium: {
    bg: 'bg-amber-950/30',
    border: 'border-amber-600/50',
    text: 'text-amber-400',
    badge: 'bg-amber-600',
    glow: 'hover:shadow-amber-500/20',
  },
  high: {
    bg: 'bg-orange-950/30',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    badge: 'bg-orange-600',
    glow: 'hover:shadow-orange-500/20',
  },
  extreme: {
    bg: 'bg-red-950/30',
    border: 'border-red-500/50',
    text: 'text-red-400',
    badge: 'bg-red-600',
    glow: 'hover:shadow-red-500/30',
  },
};

/**
 * Risk level labels
 */
const RISK_LABELS: Record<FatePathRisk, string> = {
  low: 'Safe Path',
  medium: 'Moderate Risk',
  high: 'Dangerous',
  extreme: 'Mortal Peril',
};

const TribulationGateModal: React.FC<TribulationGateModalProps> = ({
  gate,
  isOpen,
  onSelectPath,
  onSkip,
  onLetFateDecide,
  isLoading = false,
  autoSelectAfterMs,
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [showConsequences, setShowConsequences] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  const triggerInfo = TRIGGER_DISPLAY_INFO[gate.triggerType];

  // Handle animation on open
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setSelectedPathId(null);
      setShowConsequences(null);
      
      // Play gate appearance sound
      playSoundEffect(playGateAppearSound);
      
      // End entrance animation after delay
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle auto-select countdown
  useEffect(() => {
    if (!isOpen || !autoSelectAfterMs || isLoading) {
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(autoSelectAfterMs);
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1000) {
          clearInterval(interval);
          if (prev !== null) {
            onLetFateDecide();
          }
          return null;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoSelectAfterMs, isLoading, onLetFateDecide]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleSelectPath = useCallback((pathId: string) => {
    if (isLoading) return;
    setSelectedPathId(pathId);
    playSoundEffect(playPathSelectSound);
  }, [isLoading]);

  const handleConfirmSelection = useCallback(() => {
    if (selectedPathId && !isLoading) {
      playSoundEffect(playFateConfirmedSound);
      onSelectPath(selectedPathId);
    }
  }, [selectedPathId, isLoading, onSelectPath]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center transition-all duration-500 ${
        isAnimating ? 'bg-black' : 'bg-black/95'
      }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Lightning Effect Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated lightning bolts */}
        <div 
          className={`absolute top-0 left-1/4 w-1 h-32 bg-gradient-to-b from-purple-400 via-purple-200 to-transparent opacity-0 ${
            isAnimating ? 'animate-lightning' : ''
          }`}
          style={{ animationDelay: '0.2s' }}
        />
        <div 
          className={`absolute top-10 right-1/3 w-1 h-40 bg-gradient-to-b from-blue-400 via-blue-200 to-transparent opacity-0 ${
            isAnimating ? 'animate-lightning' : ''
          }`}
          style={{ animationDelay: '0.5s' }}
        />
        <div 
          className={`absolute top-5 left-1/2 w-1 h-36 bg-gradient-to-b from-amber-400 via-amber-200 to-transparent opacity-0 ${
            isAnimating ? 'animate-lightning' : ''
          }`}
          style={{ animationDelay: '0.8s' }}
        />
        <div 
          className={`absolute top-0 right-1/4 w-1 h-28 bg-gradient-to-b from-purple-300 via-white to-transparent opacity-0 ${
            isAnimating ? 'animate-lightning' : ''
          }`}
          style={{ animationDelay: '1.1s' }}
        />
        <div 
          className={`absolute top-8 left-1/3 w-1 h-44 bg-gradient-to-b from-amber-300 via-amber-100 to-transparent opacity-0 ${
            isAnimating ? 'animate-lightning' : ''
          }`}
          style={{ animationDelay: '1.4s' }}
        />
        
        {/* Heavenly clouds effect */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-purple-900/40 via-purple-950/20 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-amber-900/30 via-amber-950/10 to-transparent" />
        
        {/* Radial glow behind modal */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 animate-glow-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-amber-600/10 animate-glow-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Floating particles */}
        <div className="particle" style={{ top: '20%', left: '10%', animationDelay: '0s' }} />
        <div className="particle" style={{ top: '30%', left: '85%', animationDelay: '0.5s' }} />
        <div className="particle" style={{ top: '60%', left: '15%', animationDelay: '1s' }} />
        <div className="particle" style={{ top: '70%', left: '90%', animationDelay: '1.5s' }} />
        <div className="particle" style={{ top: '40%', left: '5%', animationDelay: '2s' }} />
        <div className="particle" style={{ top: '80%', left: '80%', animationDelay: '2.5s' }} />
        <div className="particle" style={{ top: '15%', left: '75%', animationDelay: '3s' }} />
        <div className="particle" style={{ top: '50%', left: '95%', animationDelay: '3.5s' }} />
      </div>

      {/* Main Modal Content */}
      <div 
        className={`relative w-full max-w-4xl mx-4 ${
          isAnimating ? '' : 'animate-entrance'
        } ${isAnimating ? 'animate-thunder-shake' : ''}`}
      >
        {/* Outer glow border */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 rounded-2xl opacity-50 blur-sm animate-pulse" />
        
        {/* Modal container */}
        <div className="relative bg-zinc-900/95 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
          
          {/* Header */}
          <div className="relative px-6 py-5 bg-gradient-to-r from-purple-950/50 via-zinc-900/50 to-amber-950/50 border-b border-zinc-700/50">
            {/* Trigger icon */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <div className="w-16 h-16 rounded-full bg-gradient-to-b from-purple-600 to-amber-600 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/30 animate-float">
                {triggerInfo.icon}
              </div>
            </div>
            
            <div className="text-center pt-8">
              <h2 className="text-xl sm:text-2xl font-fantasy font-bold bg-gradient-to-r from-purple-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
                ⚡ TRIBULATION GATE ⚡
              </h2>
              <p className="text-amber-400 font-semibold mt-1">
                {triggerInfo.title}
              </p>
              <p className="text-zinc-400 text-sm mt-1">
                {triggerInfo.description}
              </p>
            </div>

            {/* Auto-select countdown */}
            {timeRemaining !== null && (
              <div className="absolute top-4 right-4 text-zinc-400 text-sm">
                <span className="text-amber-400 font-mono">
                  {Math.ceil(timeRemaining / 1000)}s
                </span> until fate decides
              </div>
            )}
          </div>

          {/* Situation */}
          <div className="px-6 py-4 bg-gradient-to-b from-zinc-800/30 to-transparent">
            <div className="max-w-2xl mx-auto">
              <p className="text-zinc-300 text-center leading-relaxed italic">
                "{gate.situation}"
              </p>
              <p className="text-zinc-500 text-center text-sm mt-2">
                — {gate.protagonistName} stands at the crossroads of fate —
              </p>
            </div>
          </div>

          {/* Fate Paths */}
          <div className="px-4 sm:px-6 py-4 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
            {gate.fatePaths.map((path, index) => (
              <FatePathCard
                key={path.id}
                path={path}
                index={index}
                isSelected={selectedPathId === path.id}
                showConsequences={showConsequences === path.id}
                onSelect={() => handleSelectPath(path.id)}
                onToggleConsequences={() => setShowConsequences(
                  showConsequences === path.id ? null : path.id
                )}
                disabled={isLoading}
              />
            ))}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-gradient-to-t from-zinc-800/50 to-transparent border-t border-zinc-700/50">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              {/* Secondary actions */}
              <div className="flex gap-2 order-2 sm:order-1">
                <button
                  onClick={() => {
                    playSoundEffect(playSkipSound);
                    onSkip();
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors disabled:opacity-50"
                >
                  Skip (Let AI Decide)
                </button>
                <button
                  onClick={() => {
                    playSoundEffect(playDiceRollSound);
                    onLetFateDecide();
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-purple-400 hover:text-purple-300 text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <span>🎲</span> Let Fate Decide
                </button>
              </div>

              {/* Primary action */}
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedPathId || isLoading}
                className={`order-1 sm:order-2 px-8 py-3 rounded-xl font-semibold text-white transition-all duration-300 ${
                  selectedPathId
                    ? 'bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 shadow-lg hover:shadow-purple-500/25 hover:scale-105'
                    : 'bg-zinc-700 cursor-not-allowed opacity-50'
                } disabled:hover:scale-100 disabled:hover:shadow-none`}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Weaving Fate...
                  </span>
                ) : selectedPathId ? (
                  'Accept This Fate'
                ) : (
                  'Choose Your Path'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes lightning {
          0%, 100% { opacity: 0; transform: scaleY(1); }
          5% { opacity: 1; transform: scaleY(1.1); }
          10% { opacity: 0.2; }
          15% { opacity: 1; }
          20% { opacity: 0.3; }
          25%, 100% { opacity: 0; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(-50%); }
          50% { transform: translateY(-8px) translateX(-50%); }
        }
        
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; filter: blur(10px); }
          50% { opacity: 0.8; filter: blur(15px); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        @keyframes thunder-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-2px); }
          20% { transform: translateX(2px); }
          30% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          50% { transform: translateX(0); }
        }
        
        @keyframes path-reveal {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes entrance-zoom {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        
        .animate-lightning {
          animation: lightning 2s ease-in-out infinite;
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-glow-pulse {
          animation: glow-pulse 2s ease-in-out infinite;
        }
        
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        
        .animate-thunder-shake {
          animation: thunder-shake 0.5s ease-in-out;
        }
        
        .animate-entrance {
          animation: entrance-zoom 0.6s ease-out forwards;
        }
        
        .animate-path-reveal {
          animation: path-reveal 0.4s ease-out forwards;
        }
        
        .path-delay-0 { animation-delay: 0.1s; }
        .path-delay-1 { animation-delay: 0.2s; }
        .path-delay-2 { animation-delay: 0.3s; }
        
        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.8), transparent);
          border-radius: 50%;
          animation: particle-float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

/**
 * Individual Fate Path Card Component
 */
interface FatePathCardProps {
  path: FatePath;
  index: number;
  isSelected: boolean;
  showConsequences: boolean;
  onSelect: () => void;
  onToggleConsequences: () => void;
  disabled: boolean;
}

const FatePathCard: React.FC<FatePathCardProps> = ({
  path,
  index,
  isSelected,
  showConsequences,
  onSelect,
  onToggleConsequences,
  disabled,
}) => {
  const styles = RISK_STYLES[path.riskLevel];
  const pathLetter = String.fromCharCode(65 + index); // A, B, C

  return (
    <div
      className={`relative rounded-xl border-2 transition-all duration-300 cursor-pointer ${
        isSelected
          ? `${styles.border} ${styles.bg} shadow-lg ${styles.glow} scale-[1.02]`
          : `border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50`
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onSelect()}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-amber-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
          ✓
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            {/* Path letter indicator */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
              isSelected 
                ? 'bg-gradient-to-br from-purple-600 to-amber-600 text-white' 
                : 'bg-zinc-700 text-zinc-400'
            }`}>
              {pathLetter}
            </div>
            
            <div>
              <h3 className={`font-semibold ${isSelected ? styles.text : 'text-zinc-200'}`}>
                {path.label}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded ${styles.badge} text-white`}>
                {RISK_LABELS[path.riskLevel]}
              </span>
            </div>
          </div>

          {/* Emotional tone */}
          <span className="text-zinc-500 text-xs italic capitalize">
            {path.emotionalTone}
          </span>
        </div>

        {/* Description */}
        <p className="text-zinc-300 text-sm leading-relaxed mb-3">
          {path.description}
        </p>

        {/* Consequences toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleConsequences();
          }}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
        >
          {showConsequences ? '▼' : '▶'} View Consequences
        </button>

        {/* Consequences list */}
        {showConsequences && (
          <div className="mt-3 pl-4 border-l-2 border-zinc-700 space-y-1 animate-in slide-in-from-top-2">
            {path.consequences.map((consequence, i) => (
              <p key={i} className="text-xs text-zinc-400">
                • {consequence}
              </p>
            ))}
          </div>
        )}

        {/* Character alignment (if available) */}
        {path.characterAlignment !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Character alignment:</span>
            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  path.characterAlignment >= 70 
                    ? 'bg-emerald-500' 
                    : path.characterAlignment >= 40 
                      ? 'bg-amber-500' 
                      : 'bg-red-500'
                }`}
                style={{ width: `${path.characterAlignment}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400">{path.characterAlignment}%</span>
          </div>
        )}

        {/* Affected characters (if available) */}
        {path.affectedCharacters && path.affectedCharacters.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Affects:</span>
            {path.affectedCharacters.map((char, i) => (
              <span 
                key={i}
                className="text-xs px-2 py-0.5 bg-zinc-700/50 rounded text-zinc-400"
              >
                {char}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TribulationGateModal;
