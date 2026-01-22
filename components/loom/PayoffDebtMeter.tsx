/**
 * Payoff Debt Meter
 * 
 * Visual meter showing accumulated payoff debt for a thread.
 * Glows brighter the longer readers wait for resolution.
 */

import React from 'react';
import { LoomThread } from '../../types/loom';

interface PayoffDebtMeterProps {
  thread: LoomThread;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const PayoffDebtMeter: React.FC<PayoffDebtMeterProps> = ({
  thread,
  size = 'md',
  showLabel = true,
}) => {
  const debt = thread.payoffDebt;
  const maxDebt = 200; // Visual cap
  const percentage = Math.min(100, (debt / maxDebt) * 100);

  const getDebtLevel = () => {
    if (debt > 150) return 'critical';
    if (debt > 100) return 'high';
    if (debt > 50) return 'medium';
    if (debt > 20) return 'low';
    return 'minimal';
  };

  const level = getDebtLevel();

  const colorClasses = {
    critical: 'from-red-600 to-red-400',
    high: 'from-orange-600 to-orange-400',
    medium: 'from-amber-600 to-amber-400',
    low: 'from-yellow-600 to-yellow-400',
    minimal: 'from-emerald-600 to-emerald-400',
  };

  const glowClasses = {
    critical: 'shadow-red-500/50 animate-pulse',
    high: 'shadow-orange-500/40',
    medium: 'shadow-amber-500/30',
    low: 'shadow-yellow-500/20',
    minimal: '',
  };

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const messages = {
    critical: '🔥 Critical debt - readers frustrated!',
    high: '⚠️ High debt - payoff overdue',
    medium: '📈 Growing debt - address soon',
    low: '📊 Manageable debt',
    minimal: '✅ Healthy debt level',
  };

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">Payoff Debt</span>
          <span className={`text-xs font-bold ${
            level === 'critical' ? 'text-red-400' :
            level === 'high' ? 'text-orange-400' :
            level === 'medium' ? 'text-amber-400' :
            'text-zinc-400'
          }`}>
            {debt}
          </span>
        </div>
      )}
      
      <div className={`
        w-full bg-zinc-700 rounded-full overflow-hidden
        ${sizeClasses[size]}
      `}>
        <div
          className={`
            h-full rounded-full transition-all duration-500
            bg-gradient-to-r ${colorClasses[level]}
            ${glowClasses[level]}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {showLabel && (
        <div className={`text-xs mt-1 ${
          level === 'critical' ? 'text-red-400' :
          level === 'high' ? 'text-orange-400' :
          level === 'medium' ? 'text-amber-400' :
          'text-zinc-500'
        }`}>
          {messages[level]}
        </div>
      )}
    </div>
  );
};

export default PayoffDebtMeter;
