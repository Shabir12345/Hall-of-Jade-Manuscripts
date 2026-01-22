/**
 * Thread Physics Card
 * 
 * Displays the physics model for a single thread:
 * - Mass (karma_weight)
 * - Velocity (progression rate)
 * - Entropy (chaos level)
 * - Distance (chapters since interaction)
 * - Gravity (pull toward resolution)
 */

import React from 'react';
import { LoomThread, calculateThreadPhysics, calculatePayoffHorizon } from '../../types/loom';

interface ThreadPhysicsCardProps {
  thread: LoomThread;
  currentChapter: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export const ThreadPhysicsCard: React.FC<ThreadPhysicsCardProps> = ({
  thread,
  currentChapter,
  isSelected = false,
  onClick,
}) => {
  const physics = calculateThreadPhysics(thread, currentChapter);
  const horizon = calculatePayoffHorizon(thread, currentChapter);

  const getVelocityIndicator = () => {
    if (physics.velocity > 5) return { icon: '🚀', label: 'Rapid', color: 'text-emerald-400' };
    if (physics.velocity > 0) return { icon: '📈', label: 'Advancing', color: 'text-emerald-400' };
    if (physics.velocity === 0) return { icon: '⏸️', label: 'Static', color: 'text-zinc-400' };
    if (physics.velocity > -5) return { icon: '📉', label: 'Slowing', color: 'text-amber-400' };
    return { icon: '⬇️', label: 'Regressing', color: 'text-red-400' };
  };

  const getEntropyLevel = () => {
    if (physics.entropy > 80) return { level: 'Critical', color: 'text-red-400', bg: 'bg-red-500' };
    if (physics.entropy > 60) return { level: 'High', color: 'text-orange-400', bg: 'bg-orange-500' };
    if (physics.entropy > 40) return { level: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500' };
    if (physics.entropy > 20) return { level: 'Low', color: 'text-yellow-400', bg: 'bg-yellow-500' };
    return { level: 'Stable', color: 'text-emerald-400', bg: 'bg-emerald-500' };
  };

  const velocity = getVelocityIndicator();
  const entropy = getEntropyLevel();

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all
        ${isSelected 
          ? 'bg-amber-600/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20' 
          : 'bg-zinc-800/50 border border-zinc-700 hover:border-zinc-500'
        }
      `}
    >
      {/* Category Badge */}
      <div className="absolute top-3 right-3">
        <span className={`
          px-2 py-0.5 rounded text-xs font-bold
          ${thread.category === 'SOVEREIGN' ? 'bg-purple-600/30 text-purple-300' :
            thread.category === 'MAJOR' ? 'bg-blue-600/30 text-blue-300' :
            thread.category === 'MINOR' ? 'bg-zinc-600/30 text-zinc-300' :
            'bg-emerald-600/30 text-emerald-300'}
        `}>
          {thread.category}
        </span>
      </div>

      {/* Thread Title */}
      <div className="pr-20 mb-4">
        <h4 className="font-semibold text-zinc-200 truncate">{thread.title}</h4>
        <div className="text-xs text-zinc-500 truncate">{thread.signature}</div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`
          px-2 py-1 rounded text-xs font-medium
          ${thread.loomStatus === 'BLOOMING' ? 'bg-amber-600/30 text-amber-300 animate-pulse' :
            thread.loomStatus === 'STALLED' ? 'bg-red-600/30 text-red-300' :
            thread.loomStatus === 'ACTIVE' ? 'bg-emerald-600/30 text-emerald-300' :
            thread.loomStatus === 'SEED' ? 'bg-emerald-600/30 text-emerald-300' :
            thread.loomStatus === 'CLOSED' ? 'bg-zinc-600/30 text-zinc-400' :
            'bg-zinc-600/30 text-zinc-400'}
        `}>
          {thread.loomStatus}
        </span>
        
        {horizon === 'perfect_window' && (
          <span className="px-2 py-1 rounded text-xs bg-amber-600/30 text-amber-300">
            ✨ Perfect Window
          </span>
        )}
        {horizon === 'overdue' && (
          <span className="px-2 py-1 rounded text-xs bg-red-600/30 text-red-300">
            ⚠️ Overdue
          </span>
        )}
      </div>

      {/* Physics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Mass (Karma Weight) */}
        <div className="bg-zinc-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Mass</span>
            <span className="text-xs text-zinc-600">karma</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <span className="text-xl font-bold text-amber-400">{physics.mass}</span>
          </div>
          <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${physics.mass}%` }}
            />
          </div>
        </div>

        {/* Velocity */}
        <div className="bg-zinc-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Velocity</span>
            <span className={`text-xs ${velocity.color}`}>{velocity.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{velocity.icon}</span>
            <span className={`text-xl font-bold ${velocity.color}`}>
              {physics.velocity > 0 ? '+' : ''}{physics.velocity}
            </span>
          </div>
          <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                physics.velocity >= 0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.abs(physics.velocity) * 10}%`,
                marginLeft: physics.velocity < 0 ? 'auto' : 0,
              }}
            />
          </div>
        </div>

        {/* Entropy */}
        <div className="bg-zinc-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Entropy</span>
            <span className={`text-xs ${entropy.color}`}>{entropy.level}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌀</span>
            <span className={`text-xl font-bold ${entropy.color}`}>{physics.entropy}%</span>
          </div>
          <div className="mt-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className={`h-full ${entropy.bg} rounded-full`}
              style={{ width: `${physics.entropy}%` }}
            />
          </div>
        </div>

        {/* Distance */}
        <div className="bg-zinc-900/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-500">Distance</span>
            <span className="text-xs text-zinc-600">chapters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📏</span>
            <span className={`text-xl font-bold ${
              physics.distance > 10 ? 'text-red-400' :
              physics.distance > 5 ? 'text-amber-400' : 'text-zinc-300'
            }`}>
              {physics.distance}
            </span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Since Ch. {thread.lastMentionedChapter}
          </div>
        </div>
      </div>

      {/* Gravity & Urgency */}
      <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-xs text-zinc-500 mb-1">Narrative Gravity</div>
          <div className="text-2xl font-bold text-purple-400">
            {physics.gravity.toFixed(1)}
          </div>
          <div className="text-xs text-zinc-600">pull toward resolution</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-zinc-500 mb-1">Urgency Score</div>
          <div className={`text-2xl font-bold ${
            physics.urgency > 500 ? 'text-red-400' :
            physics.urgency > 300 ? 'text-orange-400' :
            physics.urgency > 100 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {physics.urgency}
          </div>
          <div className="text-xs text-zinc-600">
            {physics.urgency > 500 ? '🔥 Critical' :
             physics.urgency > 300 ? '⚠️ High' :
             physics.urgency > 100 ? '📈 Moderate' : '✅ Normal'}
          </div>
        </div>
      </div>

      {/* Payoff Debt */}
      <div className="mt-4 pt-4 border-t border-zinc-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">Payoff Debt</span>
          <span className={`text-sm font-bold ${
            thread.payoffDebt > 100 ? 'text-red-400' :
            thread.payoffDebt > 50 ? 'text-orange-400' :
            thread.payoffDebt > 20 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {thread.payoffDebt}
          </span>
        </div>
        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              thread.payoffDebt > 100 ? 'bg-red-500' :
              thread.payoffDebt > 50 ? 'bg-orange-500' :
              thread.payoffDebt > 20 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, thread.payoffDebt / 2)}%` }}
          />
        </div>
        <div className="text-xs text-zinc-600 mt-1">
          {thread.payoffDebt > 100 ? 'Readers frustrated - resolve soon!' :
           thread.payoffDebt > 50 ? 'Growing expectation' :
           thread.payoffDebt > 20 ? 'Healthy anticipation' : 'Freshly planted'}
        </div>
      </div>
    </div>
  );
};

export default ThreadPhysicsCard;
