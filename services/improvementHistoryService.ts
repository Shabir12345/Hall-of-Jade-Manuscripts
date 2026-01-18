/**
 * Improvement History Service
 * 
 * Manages the storage, retrieval, and manipulation of improvement history records.
 * Provides full CRUD operations with Supabase as primary storage and localStorage as fallback.
 */

import { NovelState } from '../types';
import { 
  ImprovementCategory,
  ImprovementHistoryRecord, 
  HistoryFilters, 
  ImprovementStats, 
  ScoreDataPoint, 
  ExportedHistory,
  EvaluationData,
  EvaluationStatus,
  NovelDiff,
  ImprovementHistory
} from '../types/improvement';
import { supabase } from './supabaseService';
import { generateNovelDiff } from './changeTracker';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';

// =====================================================
// CONSTANTS
// =====================================================

const STORAGE_KEY = 'improvement_history_v2';
const MAX_LOCAL_RECORDS = 100;
const EXPORT_VERSION = '1.0.0';
const APP_VERSION = '1.0.0';

// Cache for Supabase availability check to avoid repeated queries
let supabaseAvailabilityCache: { available: boolean; checked: number } | null = null;
const AVAILABILITY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let hasShownTableMissingMessage = false;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if Supabase is available and connected
 * Silently handles 404 errors (table doesn't exist) without logging
 * Uses caching to avoid repeated checks
 */
async function isSupabaseAvailable(): Promise<boolean> {
  // Check cache first
  if (supabaseAvailabilityCache) {
    const age = Date.now() - supabaseAvailabilityCache.checked;
    if (age < AVAILABILITY_CACHE_DURATION) {
      return supabaseAvailabilityCache.available;
    }
  }
  
  try {
    const { error } = await supabase.from('improvement_history').select('id').limit(1);
    // 404 means table doesn't exist - this is expected if migration hasn't run yet
    // Check for table not found errors
    if (error) {
      // PGRST116 is PostgREST error for relation not found
      // Also check for common error messages indicating table doesn't exist
      const isTableNotFound = 
        error.code === 'PGRST116' || 
        error.message?.includes('relation') || 
        error.message?.includes('does not exist') ||
        error.message?.includes('not found') ||
        (error as any).status === 404 ||
        (error as any).statusCode === 404;
      
      if (isTableNotFound) {
        // Table doesn't exist yet - this is fine, we'll use localStorage
        // Show helpful message once
        if (!hasShownTableMissingMessage) {
          hasShownTableMissingMessage = true;
          console.info(
            '%c📊 Improvement History Table Missing',
            'color: #f59e0b; font-weight: bold; font-size: 12px;',
            '\n\nThe improvement_history table doesn\'t exist in your Supabase database yet.\n' +
            'The app will use localStorage as a fallback (which is working fine).\n\n' +
            'To enable cloud storage for improvement history:\n' +
            '1. Open your Supabase dashboard\n' +
            '2. Go to SQL Editor\n' +
            '3. Run the migration: DATABASE_MIGRATION_IMPROVEMENT_HISTORY.sql\n\n' +
            'This is optional - the app works fine without it!'
          );
        }
        // Cache the result to avoid repeated checks
        supabaseAvailabilityCache = { available: false, checked: Date.now() };
        return false;
      }
      // Other errors might indicate connection issues
      supabaseAvailabilityCache = { available: false, checked: Date.now() };
      return false;
    }
    // Table exists and query succeeded
    supabaseAvailabilityCache = { available: true, checked: Date.now() };
    return true;
  } catch (error) {
    // Network errors, etc. - fall back to localStorage
    supabaseAvailabilityCache = { available: false, checked: Date.now() };
    return false;
  }
}

/**
 * Get records from localStorage
 */
function getLocalRecords(): ImprovementHistoryRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as ImprovementHistoryRecord[];
  } catch (error) {
    logger.error('Failed to read local improvement history', 'improvementHistory', error as Error);
    return [];
  }
}

/**
 * Save records to localStorage
 */
function saveLocalRecords(records: ImprovementHistoryRecord[]): void {
  try {
    // Keep only recent records to avoid quota issues
    const recentRecords = records
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_LOCAL_RECORDS);
    
    // Strip large data from localStorage version
    const minimalRecords = recentRecords.map(record => ({
      ...record,
      fullBeforeState: undefined, // Don't store full state in localStorage
      fullAfterState: undefined,
      diffSnapshot: record.diffSnapshot ? {
        ...record.diffSnapshot,
        chapterDiffs: record.diffSnapshot.chapterDiffs.map(cd => ({
          ...cd,
          beforeContent: undefined, // Don't store full content
          afterContent: undefined,
        })),
      } : undefined,
    }));
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalRecords));
  } catch (error) {
    logger.error('Failed to save local improvement history', 'improvementHistory', error as Error);
    // Try with even fewer records
    try {
      const veryMinimal = records.slice(0, 20).map(r => ({
        id: r.id,
        novelId: r.novelId,
        timestamp: r.timestamp,
        category: r.category,
        result: {
          scoreBefore: r.result.scoreBefore,
          scoreAfter: r.result.scoreAfter,
          scoreImprovement: r.result.scoreImprovement,
          chaptersEdited: r.result.chaptersEdited,
          summary: r.result.summary,
        },
        evaluation: r.evaluation,
        rolledBack: r.rolledBack,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(veryMinimal));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Convert database record to ImprovementHistoryRecord
 */
function dbToRecord(dbRecord: any): ImprovementHistoryRecord {
  return {
    id: dbRecord.id,
    novelId: dbRecord.novel_id,
    userId: dbRecord.user_id,
    timestamp: new Date(dbRecord.timestamp).getTime(),
    category: dbRecord.category as ImprovementCategory,
    request: dbRecord.request || {},
    strategy: dbRecord.strategy || {},
    result: {
      strategyId: dbRecord.strategy?.id || '',
      category: dbRecord.category,
      success: true,
      actionsExecuted: dbRecord.actions_executed || 0,
      actionsSucceeded: dbRecord.actions_succeeded || 0,
      actionsFailed: dbRecord.actions_failed || 0,
      chaptersEdited: dbRecord.chapters_edited || 0,
      chaptersInserted: dbRecord.chapters_inserted || 0,
      chaptersRegenerated: dbRecord.chapters_regenerated || 0,
      scoreBefore: dbRecord.score_before || 0,
      scoreAfter: dbRecord.score_after || 0,
      scoreImprovement: dbRecord.score_improvement || 0,
      actionResults: dbRecord.execution_result?.actionResults || [],
      failures: dbRecord.execution_result?.failures || [],
      validationResults: dbRecord.execution_result?.validationResults || {
        improvementsValidated: true,
        scoreImproved: true,
        allGoalsMet: true,
        warnings: [],
      },
      summary: dbRecord.summary || '',
      executionTime: dbRecord.execution_result?.executionTime || 0,
    },
    rolledBack: dbRecord.rolled_back || false,
    rollbackTimestamp: dbRecord.rollback_timestamp ? new Date(dbRecord.rollback_timestamp).getTime() : undefined,
    fullBeforeState: dbRecord.full_before_state,
    fullAfterState: dbRecord.full_after_state,
    diffSnapshot: dbRecord.diff_snapshot,
    evaluation: (dbRecord.evaluation || 'pending') as EvaluationStatus,
    evaluationNotes: dbRecord.evaluation_notes,
    evaluationTimestamp: dbRecord.evaluation_timestamp ? new Date(dbRecord.evaluation_timestamp).getTime() : undefined,
    createdAt: dbRecord.created_at ? new Date(dbRecord.created_at).getTime() : undefined,
    updatedAt: dbRecord.updated_at ? new Date(dbRecord.updated_at).getTime() : undefined,
  };
}

/**
 * Convert ImprovementHistoryRecord to database format
 */
function recordToDb(record: ImprovementHistoryRecord): any {
  return {
    id: record.id,
    novel_id: record.novelId,
    user_id: record.userId,
    timestamp: new Date(record.timestamp).toISOString(),
    category: record.category,
    score_before: record.result.scoreBefore,
    score_after: record.result.scoreAfter,
    chapters_edited: record.result.chaptersEdited,
    chapters_inserted: record.result.chaptersInserted,
    chapters_regenerated: record.result.chaptersRegenerated,
    actions_executed: record.result.actionsExecuted,
    actions_succeeded: record.result.actionsSucceeded,
    actions_failed: record.result.actionsFailed,
    summary: record.result.summary,
    strategy: record.strategy,
    execution_result: record.result,
    request: record.request,
    full_before_state: record.fullBeforeState,
    full_after_state: record.fullAfterState,
    diff_snapshot: record.diffSnapshot,
    evaluation: record.evaluation,
    evaluation_notes: record.evaluationNotes,
    evaluation_timestamp: record.evaluationTimestamp ? new Date(record.evaluationTimestamp).toISOString() : null,
    rolled_back: record.rolledBack,
    rollback_timestamp: record.rollbackTimestamp ? new Date(record.rollbackTimestamp).toISOString() : null,
  };
}

/**
 * Apply filters to records array (for localStorage fallback)
 */
function applyFilters(records: ImprovementHistoryRecord[], filters: HistoryFilters): ImprovementHistoryRecord[] {
  let filtered = [...records];
  
  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(r => filters.categories!.includes(r.category));
  }
  
  // Filter by date range
  if (filters.startDate) {
    filtered = filtered.filter(r => r.timestamp >= filters.startDate!);
  }
  if (filters.endDate) {
    filtered = filtered.filter(r => r.timestamp <= filters.endDate!);
  }
  
  // Filter by evaluation status
  if (filters.evaluationStatus && filters.evaluationStatus.length > 0) {
    filtered = filtered.filter(r => filters.evaluationStatus!.includes(r.evaluation));
  }
  
  // Filter by rollback status
  if (!filters.includeRolledBack) {
    filtered = filtered.filter(r => !r.rolledBack);
  }
  
  // Filter by score improvement
  if (filters.minScoreImprovement !== undefined) {
    filtered = filtered.filter(r => r.result.scoreImprovement >= filters.minScoreImprovement!);
  }
  if (filters.maxScoreImprovement !== undefined) {
    filtered = filtered.filter(r => r.result.scoreImprovement <= filters.maxScoreImprovement!);
  }
  
  // Search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(r => 
      r.result.summary?.toLowerCase().includes(query) ||
      r.category.toLowerCase().includes(query) ||
      r.strategy?.description?.toLowerCase().includes(query)
    );
  }
  
  // Sorting
  const sortBy = filters.sortBy || 'timestamp';
  const sortOrder = filters.sortOrder || 'desc';
  
  filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'timestamp':
        comparison = a.timestamp - b.timestamp;
        break;
      case 'scoreImprovement':
        comparison = a.result.scoreImprovement - b.result.scoreImprovement;
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'evaluation':
        comparison = a.evaluation.localeCompare(b.evaluation);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  // Pagination
  const offset = filters.offset || 0;
  const limit = filters.limit || filtered.length;
  filtered = filtered.slice(offset, offset + limit);
  
  return filtered;
}

// =====================================================
// MAIN SERVICE FUNCTIONS
// =====================================================

/**
 * Save a new improvement record
 */
export async function saveImprovementRecord(
  record: Omit<ImprovementHistoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'evaluation'>
): Promise<ImprovementHistoryRecord> {
  const fullRecord: ImprovementHistoryRecord = {
    ...record,
    id: generateUUID(),
    evaluation: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const dbRecord = recordToDb(fullRecord);
      const { error } = await supabase
        .from('improvement_history')
        .insert(dbRecord);
      
      if (error) {
        logger.error('Failed to save improvement to Supabase', 'improvementHistory', error);
        throw error;
      }
      
      logger.info('Improvement record saved to Supabase', 'improvementHistory', {
        id: fullRecord.id,
        novelId: fullRecord.novelId,
        category: fullRecord.category,
      });
    } catch (error) {
      logger.warn('Falling back to localStorage for improvement history', 'improvementHistory');
      // Fall through to localStorage
    }
  }
  
  // Save to localStorage as backup/primary
  const localRecords = getLocalRecords();
  localRecords.unshift(fullRecord);
  saveLocalRecords(localRecords);
  
  return fullRecord;
}

/**
 * Get improvement history for a novel with optional filters
 */
export async function getImprovementHistory(
  novelId: string,
  filters: HistoryFilters = {}
): Promise<ImprovementHistoryRecord[]> {
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      let query = supabase
        .from('improvement_history')
        .select('*')
        .eq('novel_id', novelId);
      
      // Apply filters
      if (filters.categories && filters.categories.length > 0) {
        query = query.in('category', filters.categories);
      }
      if (filters.startDate) {
        query = query.gte('timestamp', new Date(filters.startDate).toISOString());
      }
      if (filters.endDate) {
        query = query.lte('timestamp', new Date(filters.endDate).toISOString());
      }
      if (filters.evaluationStatus && filters.evaluationStatus.length > 0) {
        query = query.in('evaluation', filters.evaluationStatus);
      }
      if (!filters.includeRolledBack) {
        query = query.eq('rolled_back', false);
      }
      if (filters.minScoreImprovement !== undefined) {
        query = query.gte('score_improvement', filters.minScoreImprovement);
      }
      if (filters.maxScoreImprovement !== undefined) {
        query = query.lte('score_improvement', filters.maxScoreImprovement);
      }
      if (filters.searchQuery) {
        query = query.ilike('summary', `%${filters.searchQuery}%`);
      }
      
      // Sorting
      const sortBy = filters.sortBy || 'timestamp';
      const sortOrder = filters.sortOrder || 'desc';
      const sortColumn = sortBy === 'scoreImprovement' ? 'score_improvement' : sortBy;
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });
      
      // Pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return (data || []).map(dbToRecord);
    } catch (error) {
      logger.warn('Falling back to localStorage for improvement history', 'improvementHistory');
    }
  }
  
  // Fallback to localStorage
  const localRecords = getLocalRecords().filter(r => r.novelId === novelId);
  return applyFilters(localRecords, filters);
}

/**
 * Get a single improvement record by ID
 */
export async function getImprovementById(id: string): Promise<ImprovementHistoryRecord | null> {
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('improvement_history')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      return data ? dbToRecord(data) : null;
    } catch (error) {
      logger.warn('Falling back to localStorage for improvement record', 'improvementHistory');
    }
  }
  
  // Fallback to localStorage
  const localRecords = getLocalRecords();
  return localRecords.find(r => r.id === id) || null;
}

/**
 * Update the evaluation of an improvement
 */
export async function evaluateImprovement(
  id: string,
  evaluation: EvaluationData
): Promise<void> {
  const updateData = {
    evaluation: evaluation.status,
    evaluation_notes: evaluation.notes,
    evaluation_timestamp: new Date().toISOString(),
  };
  
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('improvement_history')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      logger.info('Improvement evaluation updated', 'improvementHistory', {
        id,
        evaluation: evaluation.status,
      });
    } catch (error) {
      logger.warn('Falling back to localStorage for evaluation update', 'improvementHistory');
    }
  }
  
  // Update localStorage
  const localRecords = getLocalRecords();
  const index = localRecords.findIndex(r => r.id === id);
  if (index !== -1) {
    localRecords[index] = {
      ...localRecords[index],
      evaluation: evaluation.status,
      evaluationNotes: evaluation.notes,
      evaluationTimestamp: Date.now(),
      updatedAt: Date.now(),
    };
    saveLocalRecords(localRecords);
  }
}

/**
 * Mark an improvement as rolled back
 */
export async function markAsRolledBack(id: string): Promise<void> {
  const updateData = {
    rolled_back: true,
    rollback_timestamp: new Date().toISOString(),
  };
  
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('improvement_history')
        .update(updateData)
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      logger.info('Improvement marked as rolled back', 'improvementHistory', { id });
    } catch (error) {
      logger.warn('Falling back to localStorage for rollback update', 'improvementHistory');
    }
  }
  
  // Update localStorage
  const localRecords = getLocalRecords();
  const index = localRecords.findIndex(r => r.id === id);
  if (index !== -1) {
    localRecords[index] = {
      ...localRecords[index],
      rolledBack: true,
      rollbackTimestamp: Date.now(),
      updatedAt: Date.now(),
    };
    saveLocalRecords(localRecords);
  }
}

/**
 * Rollback an improvement and return the original state
 */
export async function rollbackImprovement(id: string): Promise<NovelState | null> {
  const record = await getImprovementById(id);
  
  if (!record) {
    throw new Error('Improvement record not found');
  }
  
  if (record.rolledBack) {
    throw new Error('Improvement has already been rolled back');
  }
  
  if (!record.fullBeforeState) {
    throw new Error('Original state not available for rollback');
  }
  
  // Mark as rolled back
  await markAsRolledBack(id);
  
  logger.info('Improvement rolled back', 'improvementHistory', {
    id,
    novelId: record.novelId,
    category: record.category,
  });
  
  return record.fullBeforeState;
}

/**
 * Delete an improvement record
 */
export async function deleteImprovementRecord(id: string): Promise<void> {
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('improvement_history')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      logger.info('Improvement record deleted from Supabase', 'improvementHistory', { id });
    } catch (error) {
      logger.warn('Falling back to localStorage for delete', 'improvementHistory');
    }
  }
  
  // Remove from localStorage
  const localRecords = getLocalRecords();
  const filtered = localRecords.filter(r => r.id !== id);
  saveLocalRecords(filtered);
}

/**
 * Get score progression data for charts
 */
export async function getScoreProgression(
  novelId: string,
  category?: ImprovementCategory
): Promise<ScoreDataPoint[]> {
  const filters: HistoryFilters = {
    includeRolledBack: false,
    sortBy: 'timestamp',
    sortOrder: 'asc',
  };
  
  if (category) {
    filters.categories = [category];
  }
  
  const records = await getImprovementHistory(novelId, filters);
  
  // Calculate cumulative improvement per category
  const cumulativeByCategory: Record<string, number> = {};
  
  return records.map(record => {
    const cat = record.category;
    cumulativeByCategory[cat] = (cumulativeByCategory[cat] || 0) + record.result.scoreImprovement;
    
    return {
      timestamp: record.timestamp,
      category: record.category,
      scoreBefore: record.result.scoreBefore,
      scoreAfter: record.result.scoreAfter,
      scoreImprovement: record.result.scoreImprovement,
      cumulativeImprovement: cumulativeByCategory[cat],
      improvementId: record.id,
    };
  });
}

/**
 * Compute statistics for a novel's improvement history
 */
export async function computeImprovementStatistics(novelId: string): Promise<ImprovementStats> {
  const allRecords = await getImprovementHistory(novelId, { includeRolledBack: true });
  const activeRecords = allRecords.filter(r => !r.rolledBack);
  
  // Initialize category breakdown
  const categories: ImprovementCategory[] = [
    'excellence', 'structure', 'engagement', 'character', 'theme',
    'tension', 'prose', 'originality', 'voice', 'literary_devices', 'market_readiness'
  ];
  
  const categoryBreakdown: Record<ImprovementCategory, { count: number; avgImprovement: number; totalImprovement: number }> = 
    {} as Record<ImprovementCategory, { count: number; avgImprovement: number; totalImprovement: number }>;
  
  categories.forEach(cat => {
    const catRecords = activeRecords.filter(r => r.category === cat);
    const totalImprovement = catRecords.reduce((sum, r) => sum + r.result.scoreImprovement, 0);
    categoryBreakdown[cat] = {
      count: catRecords.length,
      avgImprovement: catRecords.length > 0 ? totalImprovement / catRecords.length : 0,
      totalImprovement,
    };
  });
  
  // Calculate overall stats
  const totalScoreImprovement = activeRecords.reduce((sum, r) => sum + r.result.scoreImprovement, 0);
  const avgScoreImprovement = activeRecords.length > 0 ? totalScoreImprovement / activeRecords.length : 0;
  const maxScoreImprovement = activeRecords.length > 0 
    ? Math.max(...activeRecords.map(r => r.result.scoreImprovement))
    : 0;
  
  const successfulRecords = activeRecords.filter(r => r.result.scoreImprovement > 0);
  const successRate = activeRecords.length > 0 ? successfulRecords.length / activeRecords.length : 0;
  
  return {
    totalImprovements: allRecords.length,
    activeImprovements: activeRecords.length,
    rolledBackCount: allRecords.filter(r => r.rolledBack).length,
    
    approvedCount: allRecords.filter(r => r.evaluation === 'approved').length,
    rejectedCount: allRecords.filter(r => r.evaluation === 'rejected').length,
    pendingCount: allRecords.filter(r => r.evaluation === 'pending').length,
    
    avgScoreImprovement,
    maxScoreImprovement,
    totalScoreImprovement,
    
    totalChaptersEdited: activeRecords.reduce((sum, r) => sum + r.result.chaptersEdited, 0),
    totalChaptersInserted: activeRecords.reduce((sum, r) => sum + r.result.chaptersInserted, 0),
    totalActionsExecuted: activeRecords.reduce((sum, r) => sum + r.result.actionsExecuted, 0),
    
    categoryBreakdown,
    
    firstImprovement: allRecords.length > 0 ? Math.min(...allRecords.map(r => r.timestamp)) : undefined,
    lastImprovement: allRecords.length > 0 ? Math.max(...allRecords.map(r => r.timestamp)) : undefined,
    
    successRate,
  };
}

/**
 * Export improvement history for a novel
 */
export async function exportImprovementHistory(novelId: string, novelTitle: string): Promise<ExportedHistory> {
  const records = await getImprovementHistory(novelId, { includeRolledBack: true });
  const statistics = await computeImprovementStatistics(novelId);
  
  return {
    exportedAt: Date.now(),
    novelId,
    novelTitle,
    totalRecords: records.length,
    records,
    statistics,
    metadata: {
      exportVersion: EXPORT_VERSION,
      appVersion: APP_VERSION,
    },
  };
}

/**
 * Import improvement history from exported data
 */
export async function importImprovementHistory(
  exportedData: ExportedHistory,
  targetNovelId?: string
): Promise<number> {
  const novelId = targetNovelId || exportedData.novelId;
  let importedCount = 0;
  
  for (const record of exportedData.records) {
    try {
      await saveImprovementRecord({
        ...record,
        novelId,
        // Generate new ID on import
        id: undefined as any,
      });
      importedCount++;
    } catch (error) {
      logger.error('Failed to import improvement record', 'improvementHistory', error as Error);
    }
  }
  
  return importedCount;
}

/**
 * Create an improvement record from the improvement process
 * This is the main function called by novelImprovementService
 */
export async function createImprovementRecord(
  novelId: string,
  userId: string | undefined,
  beforeState: NovelState,
  afterState: NovelState,
  history: ImprovementHistory
): Promise<ImprovementHistoryRecord> {
  // Generate diff snapshot
  const diffSnapshot = generateNovelDiff(beforeState, afterState, history.category) as NovelDiff;
  
  const record: Omit<ImprovementHistoryRecord, 'id' | 'createdAt' | 'updatedAt' | 'evaluation'> = {
    novelId,
    userId,
    timestamp: history.timestamp,
    category: history.category,
    request: history.request,
    strategy: history.strategy,
    result: history.result,
    rolledBack: history.rolledBack,
    rollbackTimestamp: history.rollbackTimestamp,
    fullBeforeState: beforeState,
    fullAfterState: afterState,
    diffSnapshot,
  };
  
  return saveImprovementRecord(record);
}

/**
 * Clear all improvement history for a novel (use with caution)
 */
export async function clearImprovementHistory(novelId: string): Promise<void> {
  // Try Supabase first
  if (await isSupabaseAvailable()) {
    try {
      const { error } = await supabase
        .from('improvement_history')
        .delete()
        .eq('novel_id', novelId);
      
      if (error) {
        throw error;
      }
      
      logger.info('Improvement history cleared from Supabase', 'improvementHistory', { novelId });
    } catch (error) {
      logger.warn('Falling back to localStorage for clear', 'improvementHistory');
    }
  }
  
  // Clear from localStorage
  const localRecords = getLocalRecords();
  const filtered = localRecords.filter(r => r.novelId !== novelId);
  saveLocalRecords(filtered);
}

/**
 * Get the most recent improvement for a novel and category
 */
export async function getMostRecentImprovement(
  novelId: string,
  category?: ImprovementCategory
): Promise<ImprovementHistoryRecord | null> {
  const filters: HistoryFilters = {
    includeRolledBack: false,
    sortBy: 'timestamp',
    sortOrder: 'desc',
    limit: 1,
  };
  
  if (category) {
    filters.categories = [category];
  }
  
  const records = await getImprovementHistory(novelId, filters);
  return records[0] || null;
}

/**
 * Check if an improvement can be rolled back
 * (i.e., it hasn't been superseded by another improvement)
 */
export async function canRollback(id: string): Promise<{ canRollback: boolean; reason?: string }> {
  const record = await getImprovementById(id);
  
  if (!record) {
    return { canRollback: false, reason: 'Improvement record not found' };
  }
  
  if (record.rolledBack) {
    return { canRollback: false, reason: 'Already rolled back' };
  }
  
  if (!record.fullBeforeState) {
    return { canRollback: false, reason: 'Original state not available' };
  }
  
  // Check if there are newer improvements that would be affected
  const newerImprovements = await getImprovementHistory(record.novelId, {
    includeRolledBack: false,
    sortBy: 'timestamp',
    sortOrder: 'asc',
  });
  
  const newerCount = newerImprovements.filter(r => r.timestamp > record.timestamp).length;
  
  if (newerCount > 0) {
    return { 
      canRollback: true, 
      reason: `Warning: ${newerCount} newer improvement(s) may be affected by this rollback` 
    };
  }
  
  return { canRollback: true };
}
