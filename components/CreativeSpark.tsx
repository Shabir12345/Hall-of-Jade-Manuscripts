
import React, { useState, useRef } from 'react';
import { NovelState } from '../types';
import { generateCreativeExpansion } from '../services/aiService';

interface CreativeSparkProps {
  type: string;
  currentValue: string;
  state: NovelState;
  onIdea: (idea: string) => void;
  className?: string;
  label?: string;
}

const CreativeSpark: React.FC<CreativeSparkProps> = ({ 
  type, 
  currentValue, 
  state, 
  onIdea, 
  className = "",
  label = "Spark Insight"
}) => {
  const [isSparking, setIsSparking] = useState(false);
  const lastClickTime = useRef<number>(0);
  const DEBOUNCE_MS = 2000; // 2 seconds between clicks

  const handleSpark = async () => {
    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickTime.current < DEBOUNCE_MS) {
      console.log('Request ignored - too soon after last request');
      return;
    }
    lastClickTime.current = now;

    setIsSparking(true);
    try {
      const idea = await generateCreativeExpansion(type, currentValue, state);
      onIdea(idea);
    } catch (e) {
      console.error("The Muse is silent...", e);
    } finally {
      setIsSparking(false);
    }
  };

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSpark(); }}
      disabled={isSparking}
      className={`group relative px-2.5 md:px-3 py-1.5 rounded-lg transition-all duration-300 border shadow-sm flex items-center space-x-1.5 md:space-x-2 flex-shrink-0 ${
        isSparking 
          ? 'bg-indigo-600/20 border-indigo-500/50 cursor-wait' 
          : 'bg-zinc-800 border-zinc-700 hover:bg-indigo-600/10 hover:border-indigo-500/50 text-zinc-400 hover:text-indigo-400'
      } ${className}`}
      title={`AI Inspiration: Expansion for ${type}`}
      aria-label={label}
    >
      <div className={`flex items-center space-x-1.5 md:space-x-2 ${isSparking ? 'animate-pulse' : ''}`}>
        <span className="text-sm flex-shrink-0">✨</span>
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">{isSparking ? "Manifesting..." : label}</span>
      </div>
      
      {isSparking && (
        <span className="absolute inset-0 rounded-lg bg-indigo-600/20 animate-ping pointer-events-none"></span>
      )}
    </button>
  );
};

export default CreativeSpark;
