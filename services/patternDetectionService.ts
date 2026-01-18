import { EditorIssue, RecurringIssuePattern, PatternOccurrence, PatternDetectionResult, IssueType } from '../types/editor';
import { getOrCreatePattern, savePatternOccurrence, saveRecurringPattern, getActiveRecurringPatterns, getAllRecurringPatterns, updatePatternStatus } from './supabaseService';

// Export pattern management utilities
export { PatternManagementUtils } from './patternManagementUtils';

/**
 * Pattern Detection Service
 * Detects recurring patterns from editor issues and tracks them in the database
 */

const DEFAULT_THRESHOLD = 5; // Default threshold for considering a pattern recurring
const AUTO_RESOLUTION_THRESHOLD_DAYS = 30; // Auto-resolve patterns not seen in 30 days
const CLEAN_CHAPTERS_FOR_RESOLUTION = 10; // Number of consecutive clean chapters needed for auto-resolution
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache active patterns for 5 minutes

// Simple in-memory cache for active patterns
let activePatternsCache: {
  patterns: RecurringIssuePattern[];
  timestamp: number;
} | null = null;

/**
 * Validates an issue before processing
 */
function validateIssue(issue: EditorIssue): boolean {
  if (!issue || !issue.type || !issue.location) {
    console.warn('[Pattern Detection] Invalid issue: missing type or location', issue);
    return false;
  }

  // Validate issue type
  const validTypes: IssueType[] = ['gap', 'transition', 'grammar', 'continuity', 'time_skip', 
    'character_consistency', 'plot_hole', 'style', 'formatting', 'paragraph_structure', 'sentence_structure'];
  if (!validTypes.includes(issue.type)) {
    console.warn('[Pattern Detection] Invalid issue type:', issue.type);
    return false;
  }

  // Validate location
  const validLocations = ['start', 'middle', 'end', 'transition'];
  if (!validLocations.includes(issue.location)) {
    console.warn('[Pattern Detection] Invalid issue location:', issue.location);
    return false;
  }

  return true;
}

/**
 * Detects recurring patterns from editor issues
 * Groups issues by type + location combinations and tracks occurrences
 */
export async function detectRecurringPatterns(
  issues: EditorIssue[],
  novelId: string,
  reportId?: string
): Promise<PatternDetectionResult> {
  if (!issues || issues.length === 0) {
    return {
      detectedPatterns: [],
      updatedPatterns: [],
      occurrenceCount: 0,
    };
  }

  // Validate and group issues by type + location combination
  const issueGroups = new Map<string, EditorIssue[]>();
  
  for (const issue of issues) {
    // Validate issue before processing
    if (!validateIssue(issue)) {
      continue; // Skip invalid issues
    }

    const key = `${issue.type}|${issue.location}`;
    if (!issueGroups.has(key)) {
      issueGroups.set(key, []);
    }
    issueGroups.get(key)!.push(issue);
  }

  const detectedPatterns: RecurringIssuePattern[] = [];
  const updatedPatterns: RecurringIssuePattern[] = [];
  let totalOccurrences = 0;

  // Process each group
  for (const [key, groupIssues] of issueGroups.entries()) {
    if (groupIssues.length === 0) continue;

    const [issueType, location] = key.split('|');
    const firstIssue = groupIssues[0];
    
    // Create pattern description
    const patternDescription = buildPatternDescription(firstIssue.type, firstIssue.location, groupIssues.length);
    
    // Get or create pattern
    let pattern = await getOrCreatePattern(
      issueType,
      location,
      patternDescription,
      DEFAULT_THRESHOLD
    );

    // Save occurrences for each issue in this group
    // Note: reportId is optional - pattern occurrences can be saved without it
    // This allows pattern detection to run even if the report hasn't been saved yet
    for (const issue of groupIssues) {
      // If reportId is provided but might not exist yet, save without it to avoid FK constraint errors
      // We'll save without report_id first, then update it later if the report gets saved
      const occurrence: PatternOccurrence = {
        id: crypto.randomUUID(),
        patternId: pattern.id,
        chapterId: issue.chapterId,
        chapterNumber: issue.chapterNumber,
        reportId: undefined, // Don't include report_id initially to avoid FK constraint violations
        issueId: issue.id,
        novelId: novelId,
        detectedAt: Date.now(),
        createdAt: Date.now(),
      };

      try {
        await savePatternOccurrence(occurrence);
        totalOccurrences++;
      } catch (error: any) {
        // Log error but continue with other occurrences
        if (process.env.NODE_ENV === 'development') {
          console.error('[Pattern Detection] Failed to save pattern occurrence:', error);
        }
        // Continue with other occurrences - pattern detection should not fail completely
      }
    }

    // Refresh pattern from database to get updated count from trigger
    // The database trigger updates occurrence_count and last_seen_at automatically
    const updatedPattern = await getOrCreatePattern(
      issueType,
      location,
      patternDescription,
      DEFAULT_THRESHOLD
    );
    
    // Update pattern description with actual count from database
    const updatedDescription = buildPatternDescription(issueType as any, location as any, updatedPattern.occurrenceCount);
    
    // Update pattern metadata (the count is already updated by trigger)
    updatedPattern.lastSeenAt = Date.now();
    updatedPattern.isActive = true; // Reactivate if it was resolved
    updatedPattern.updatedAt = Date.now();
    updatedPattern.patternDescription = updatedDescription; // Update description with actual count from DB

    // Check if pattern exceeded threshold (using updated count)
    const exceededThreshold = updatedPattern.occurrenceCount >= updatedPattern.thresholdCount;
    const previousCount = pattern.occurrenceCount;
    const wasBelowThreshold = previousCount < pattern.thresholdCount;

    // If pattern just exceeded threshold, mark as newly detected
    if (exceededThreshold && wasBelowThreshold) {
      detectedPatterns.push(updatedPattern);
      console.log(`[Pattern Detection] New recurring pattern detected: ${updatedPattern.issueType} at ${updatedPattern.location} (${updatedPattern.occurrenceCount} occurrences)`);
    } else if (exceededThreshold) {
      updatedPatterns.push(updatedPattern);
    }

    // Save updated pattern (with latest metadata)
    await saveRecurringPattern(updatedPattern);
    
    // Update pattern reference for next iteration
    pattern = updatedPattern;
  }

  // Clear cache after pattern updates to ensure fresh data on next fetch
  if (detectedPatterns.length > 0 || updatedPatterns.length > 0) {
    clearActivePatternsCache();
  }

  return {
    detectedPatterns,
    updatedPatterns,
    occurrenceCount: totalOccurrences,
  };
}

/**
 * Builds a human-readable description for a pattern
 */
function buildPatternDescription(
  issueType: EditorIssue['type'],
  location: EditorIssue['location'],
  count: number
): string {
  const locationDesc = location === 'start' ? 'at chapter start' :
                       location === 'end' ? 'at chapter end' :
                       location === 'transition' ? 'in transitions' :
                       'in middle sections';

  const typeDesc = issueType === 'transition' ? 'transition/flow issues' :
                   issueType === 'gap' ? 'narrative gaps' :
                   issueType === 'continuity' ? 'continuity issues' :
                   issueType === 'time_skip' ? 'unexplained time skips' :
                   issueType === 'character_consistency' ? 'character consistency issues' :
                   issueType === 'plot_hole' ? 'plot holes' :
                   issueType === 'grammar' ? 'grammar issues' :
                   issueType === 'style' ? 'style inconsistencies' :
                   issueType === 'formatting' ? 'formatting issues' :
                   issueType === 'paragraph_structure' ? 'paragraph structure issues' :
                   issueType === 'sentence_structure' ? 'sentence structure issues' :
                   'issues';

  return `${typeDesc} ${locationDesc} (${count} occurrences)`;
}

/**
 * Get active recurring patterns that should be used for prompt enhancement
 * Uses caching to reduce database queries
 */
export async function getActivePatterns(forceRefresh: boolean = false): Promise<RecurringIssuePattern[]> {
  try {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && activePatternsCache && (now - activePatternsCache.timestamp) < CACHE_TTL_MS) {
      return activePatternsCache.patterns;
    }

    // Fetch from database
    const patterns = await getActiveRecurringPatterns();
    
    // Update cache
    activePatternsCache = {
      patterns,
      timestamp: now,
    };

    return patterns;
  } catch (error) {
    console.error('Error fetching active patterns:', error);
    // Return cached patterns if available, even if stale
    if (activePatternsCache) {
      console.warn('[Pattern Detection] Using stale cached patterns due to fetch error');
      return activePatternsCache.patterns;
    }
    return [];
  }
}

/**
 * Clear the active patterns cache (useful after pattern updates)
 */
export function clearActivePatternsCache(): void {
  activePatternsCache = null;
  console.log('[Pattern Detection] Cleared active patterns cache');
}

/**
 * Get all recurring patterns (active and resolved)
 */
export async function getAllPatterns(): Promise<RecurringIssuePattern[]> {
  try {
    return await getAllRecurringPatterns();
  } catch (error) {
    console.error('Error fetching all patterns:', error);
    return [];
  }
}

/**
 * Mark a pattern as resolved (no longer occurring)
 */
export async function markPatternResolved(patternId: string): Promise<void> {
  try {
    await updatePatternStatus(patternId, false);
    clearActivePatternsCache(); // Clear cache after status change
  } catch (error) {
    console.error('Error marking pattern as resolved:', error);
    throw error;
  }
}

/**
 * Reactivate a pattern (if it starts occurring again)
 */
export async function reactivatePattern(patternId: string): Promise<void> {
  try {
    await updatePatternStatus(patternId, true);
    clearActivePatternsCache(); // Clear cache after status change
  } catch (error) {
    console.error('Error reactivating pattern:', error);
    throw error;
  }
}

/**
 * Auto-resolve patterns that haven't been seen for a long time
 * This checks for patterns that haven't occurred in the last AUTO_RESOLUTION_THRESHOLD_DAYS days
 */
export async function autoResolveStalePatterns(): Promise<number> {
  try {
    const allPatterns = await getAllPatterns();
    const now = Date.now();
    const thresholdMs = AUTO_RESOLUTION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    
    let resolvedCount = 0;
    
    for (const pattern of allPatterns) {
      if (!pattern.isActive) {
        continue; // Already resolved
      }

      const daysSinceLastSeen = (now - pattern.lastSeenAt) / (24 * 60 * 60 * 1000);
      
      if (daysSinceLastSeen >= AUTO_RESOLUTION_THRESHOLD_DAYS) {
        console.log(`[Pattern Detection] Auto-resolving stale pattern: ${pattern.issueType} at ${pattern.location} (not seen for ${Math.round(daysSinceLastSeen)} days)`);
        await markPatternResolved(pattern.id);
        resolvedCount++;
      }
    }
    
    if (resolvedCount > 0) {
      console.log(`[Pattern Detection] Auto-resolved ${resolvedCount} stale patterns`);
    }
    
    return resolvedCount;
  } catch (error) {
    console.error('[Pattern Detection] Error auto-resolving stale patterns:', error);
    return 0;
  }
}

/**
 * Check if patterns should be resolved based on clean chapter analysis
 * If no issues of a specific type+location are found in recent chapters, consider resolving the pattern
 */
export async function checkPatternResolution(
  analyzedIssues: EditorIssue[],
  chapterNumbers: number[]
): Promise<number> {
  try {
    // Get all active patterns
    const activePatterns = await getActivePatterns();
    
    if (activePatterns.length === 0) {
      return 0; // No active patterns to check
    }

    // Group analyzed issues by type+location
    const foundIssueKeys = new Set<string>();
    analyzedIssues.forEach(issue => {
      if (validateIssue(issue)) {
        foundIssueKeys.add(`${issue.type}|${issue.location}`);
      }
    });

    let resolvedCount = 0;
    const now = Date.now();
    const DAYS_PER_CHAPTER = 1; // Approximate: assume 1 chapter per day
    const RESOLUTION_DAY_THRESHOLD = CLEAN_CHAPTERS_FOR_RESOLUTION * DAYS_PER_CHAPTER;

    // Check each active pattern
    for (const pattern of activePatterns) {
      const patternKey = `${pattern.issueType}|${pattern.location}`;
      
      // If this pattern was NOT found in the analyzed issues
      if (!foundIssueKeys.has(patternKey)) {
        const daysSinceLastSeen = (now - pattern.lastSeenAt) / (24 * 60 * 60 * 1000);
        
        // If pattern hasn't been seen for enough time and wasn't found in recent analysis, consider resolving
        if (daysSinceLastSeen >= RESOLUTION_DAY_THRESHOLD) {
          console.log(`[Pattern Detection] Pattern ${pattern.issueType} at ${pattern.location} hasn't been seen for ${Math.round(daysSinceLastSeen)} days and wasn't found in recent analysis. Marking for potential resolution.`);
          
          // For now, we'll only mark patterns that haven't been seen for a very long time
          // This prevents false positives from short-term clean periods
          if (daysSinceLastSeen >= AUTO_RESOLUTION_THRESHOLD_DAYS) {
            await markPatternResolved(pattern.id);
            resolvedCount++;
          }
        }
      }
    }

    if (resolvedCount > 0) {
      console.log(`[Pattern Detection] Resolved ${resolvedCount} patterns that haven't been seen in recent clean analysis`);
    }

    return resolvedCount;
  } catch (error) {
    console.error('[Pattern Detection] Error checking pattern resolution:', error);
    return 0;
  }
}

/**
 * Get pattern statistics for monitoring and analytics
 */
export async function getPatternStatistics(): Promise<{
  totalPatterns: number;
  activePatterns: number;
  resolvedPatterns: number;
  patternsAboveThreshold: number;
  mostCommonType: string | null;
  mostCommonLocation: string | null;
  oldestPattern: RecurringIssuePattern | null;
  newestPattern: RecurringIssuePattern | null;
}> {
  try {
    const allPatterns = await getAllPatterns();
    const activePatterns = allPatterns.filter(p => p.isActive);
    const resolvedPatterns = allPatterns.filter(p => !p.isActive);
    const patternsAboveThreshold = activePatterns.filter(p => p.occurrenceCount >= p.thresholdCount);

    // Find most common type
    const typeCounts = new Map<string, number>();
    allPatterns.forEach(p => {
      typeCounts.set(p.issueType, (typeCounts.get(p.issueType) || 0) + 1);
    });
    const mostCommonType = typeCounts.size > 0 
      ? Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // Find most common location
    const locationCounts = new Map<string, number>();
    allPatterns.forEach(p => {
      locationCounts.set(p.location, (locationCounts.get(p.location) || 0) + 1);
    });
    const mostCommonLocation = locationCounts.size > 0
      ? Array.from(locationCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // Find oldest and newest patterns
    const sortedByAge = [...allPatterns].sort((a, b) => a.firstDetectedAt - b.firstDetectedAt);
    const oldestPattern = sortedByAge[0] || null;
    const newestPattern = sortedByAge[sortedByAge.length - 1] || null;

    return {
      totalPatterns: allPatterns.length,
      activePatterns: activePatterns.length,
      resolvedPatterns: resolvedPatterns.length,
      patternsAboveThreshold: patternsAboveThreshold.length,
      mostCommonType,
      mostCommonLocation,
      oldestPattern,
      newestPattern,
    };
  } catch (error) {
    console.error('[Pattern Detection] Error getting pattern statistics:', error);
    return {
      totalPatterns: 0,
      activePatterns: 0,
      resolvedPatterns: 0,
      patternsAboveThreshold: 0,
      mostCommonType: null,
      mostCommonLocation: null,
      oldestPattern: null,
      newestPattern: null,
    };
  }
}
