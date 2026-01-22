/**
 * Prompt Cache Dashboard
 * Displays cache performance metrics and cost savings
 */

import React from 'react';
import { getCacheStatistics } from '../services/promptCacheMonitor';
import type { CacheStatistics } from '../types/cache';

interface PromptCacheDashboardProps {
  className?: string;
}

export const PromptCacheDashboard: React.FC<PromptCacheDashboardProps> = ({ className = '' }) => {
  const [stats, setStats] = React.useState<CacheStatistics | null>(null);
  const [deepseekStats, setDeepseekStats] = React.useState<CacheStatistics | null>(null);

  // Update stats every 5 seconds
  React.useEffect(() => {
    const updateStats = () => {
      const allStats = getCacheStatistics();
      const deepseek = getCacheStatistics('deepseek');

      setStats(allStats);
      setDeepseekStats(deepseek);
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!stats || stats.totalRequests === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-xl font-semibold mb-4">Prompt Cache Performance</h2>
        <div className="text-gray-500 dark:text-gray-400">
          No cache statistics yet. Cache metrics will appear here after API calls are made.
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">Prompt Cache Performance</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Overall Statistics */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            Overall Cache Performance
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Hit Rate:</span>
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                {stats.hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Requests:</span>
              <span className="font-semibold">{formatNumber(stats.totalRequests)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cache Hits:</span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatNumber(stats.hits)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cache Misses:</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {formatNumber(stats.misses)}
              </span>
            </div>
          </div>
        </div>

        {/* Cost Savings */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-900 dark:text-green-200 mb-2">
            Estimated Cost Savings
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Savings:</span>
              <span className="font-bold text-green-700 dark:text-green-300 text-lg">
                {formatCurrency(stats.estimatedSavings.dollars)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Savings %:</span>
              <span className="font-semibold text-green-700 dark:text-green-300">
                {stats.estimatedSavings.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cached Tokens:</span>
              <span className="font-semibold">{formatNumber(stats.totalCachedTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Tokens:</span>
              <span className="font-semibold">{formatNumber(stats.totalTokens)}</span>
            </div>
          </div>
        </div>

        {/* Token Statistics */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-900 dark:text-purple-200 mb-2">
            Token Usage
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cached:</span>
              <span className="font-semibold">{formatNumber(stats.totalCachedTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{formatNumber(stats.totalTokens)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Cache Ratio:</span>
              <span className="font-semibold">
                {stats.totalTokens > 0
                  ? ((stats.totalCachedTokens / stats.totalTokens) * 100).toFixed(1)
                  : '0'}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provider-Specific Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* DeepSeek Statistics */}
        {deepseekStats && deepseekStats.totalRequests > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-2">
              DeepSeek-V3
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Hit Rate:</span>
                <span className="font-semibold">{deepseekStats.hitRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Requests:</span>
                <span>{formatNumber(deepseekStats.totalRequests)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Savings:</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatCurrency(deepseekStats.estimatedSavings.dollars)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Text */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Prompt caching reduces API costs by reusing World State and Previous Chapters context (~75% savings on cached tokens).
          <br />
          DeepSeek: Explicit context caching for repeated narrative state.
        </p>
      </div>
    </div>
  );
};
