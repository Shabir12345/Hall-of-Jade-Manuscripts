/**
 * Pattern Management Utilities
 * Utility functions for managing and debugging recurring issue patterns
 * These can be called from the browser console or UI components
 */

import { 
  getActivePatterns, 
  getAllPatterns, 
  getPatternStatistics,
  autoResolveStalePatterns,
  markPatternResolved,
  reactivatePattern,
  clearActivePatternsCache
} from './patternDetectionService';
import { RecurringIssuePattern } from '../types/editor';

/**
 * Pattern Management API
 * Expose functions to window for console access
 */
export const PatternManagementUtils = {
  /**
   * Get all active patterns
   */
  async getActivePatterns(): Promise<RecurringIssuePattern[]> {
    return await getActivePatterns();
  },

  /**
   * Get all patterns (active and resolved)
   */
  async getAllPatterns(): Promise<RecurringIssuePattern[]> {
    return await getAllPatterns();
  },

  /**
   * Get pattern statistics
   */
  async getStatistics() {
    return await getPatternStatistics();
  },

  /**
   * Auto-resolve stale patterns
   */
  async autoResolveStale(): Promise<number> {
    return await autoResolveStalePatterns();
  },

  /**
   * Mark a pattern as resolved
   */
  async resolvePattern(patternId: string): Promise<void> {
    return await markPatternResolved(patternId);
  },

  /**
   * Reactivate a pattern
   */
  async reactivatePattern(patternId: string): Promise<void> {
    return await reactivatePattern(patternId);
  },

  /**
   * Clear the active patterns cache
   */
  clearCache(): void {
    clearActivePatternsCache();
  },

  /**
   * Print pattern statistics to console
   */
  async printStatistics(): Promise<void> {
    const stats = await getPatternStatistics();
    console.log('📊 Pattern Statistics:');
    console.log(`  Total Patterns: ${stats.totalPatterns}`);
    console.log(`  Active Patterns: ${stats.activePatterns}`);
    console.log(`  Resolved Patterns: ${stats.resolvedPatterns}`);
    console.log(`  Patterns Above Threshold: ${stats.patternsAboveThreshold}`);
    console.log(`  Most Common Type: ${stats.mostCommonType || 'N/A'}`);
    console.log(`  Most Common Location: ${stats.mostCommonLocation || 'N/A'}`);
    if (stats.oldestPattern) {
      const daysOld = Math.round((Date.now() - stats.oldestPattern.firstDetectedAt) / (24 * 60 * 60 * 1000));
      console.log(`  Oldest Pattern: ${stats.oldestPattern.issueType} at ${stats.oldestPattern.location} (${daysOld} days old)`);
    }
    if (stats.newestPattern) {
      const daysOld = Math.round((Date.now() - stats.newestPattern.firstDetectedAt) / (24 * 60 * 60 * 1000));
      console.log(`  Newest Pattern: ${stats.newestPattern.issueType} at ${stats.newestPattern.location} (${daysOld} days old)`);
    }
  },

  /**
   * Print active patterns to console
   */
  async printActivePatterns(): Promise<void> {
    const patterns = await getActivePatterns();
    console.log(`📋 Active Patterns (${patterns.length}):`);
    if (patterns.length === 0) {
      console.log('  No active patterns found');
      return;
    }
    
    patterns.forEach((pattern, index) => {
      const daysSinceLastSeen = Math.round((Date.now() - pattern.lastSeenAt) / (24 * 60 * 60 * 1000));
      const status = pattern.occurrenceCount >= pattern.thresholdCount ? '✅ Above Threshold' : '⚠️ Below Threshold';
      console.log(`  ${index + 1}. ${pattern.issueType} at ${pattern.location}`);
      console.log(`     Occurrences: ${pattern.occurrenceCount}/${pattern.thresholdCount} ${status}`);
      console.log(`     Last Seen: ${daysSinceLastSeen} days ago`);
      console.log(`     Pattern ID: ${pattern.id}`);
      if (pattern.promptConstraintAdded) {
        console.log(`     Constraint: ${pattern.promptConstraintAdded.substring(0, 100)}...`);
      }
      console.log('');
    });
  },

  /**
   * Find patterns by type and location
   */
  async findPattern(issueType: string, location: string): Promise<RecurringIssuePattern | null> {
    const patterns = await getAllPatterns();
    return patterns.find(p => p.issueType === issueType && p.location === location) || null;
  },

  /**
   * Get patterns above threshold
   */
  async getPatternsAboveThreshold(): Promise<RecurringIssuePattern[]> {
    const patterns = await getActivePatterns();
    return patterns.filter(p => p.occurrenceCount >= p.thresholdCount);
  },
};

// Expose to window for console access (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).PatternManagement = PatternManagementUtils;
  console.log('🔧 Pattern Management Utils available at: window.PatternManagement');
  console.log('   Try: await PatternManagement.printStatistics()');
  console.log('   Or: await PatternManagement.printActivePatterns()');
}
