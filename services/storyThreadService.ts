/**
 * Story Thread Processing Service
 * Handles intelligent processing of story thread updates from AI extraction
 * Tracks narrative threads to prevent plot holes and ensure satisfying conclusions
 */

import { StoryThread, ThreadStatus, ThreadPriority, StoryThreadType, ThreadProgressionEvent, ThreadEventType, NovelState, ThreadScope } from '../types';
import { generateUUID } from '../utils/uuid';
import { getRecommendedDuration } from './storyProgressionStandards';

/**
 * Resolve entity ID from entity name and type
 */
function resolveEntityId(
  entityName: string,
  entityType: string,
  novelState: Partial<NovelState>
): string | undefined {
  if (!novelState || !entityName) return undefined;

  const nameLower = entityName.toLowerCase().trim();

  switch (entityType.toLowerCase()) {
    case 'character':
      const character = novelState.characterCodex?.find(c =>
        c.name.toLowerCase() === nameLower
      );
      return character?.id;

    case 'territory':
      const territory = novelState.territories?.find(t =>
        t.name.toLowerCase() === nameLower
      );
      return territory?.id;

    case 'worldentry':
    case 'world_entry':
      const worldEntry = novelState.worldBible?.find(w =>
        w.title.toLowerCase() === nameLower
      );
      return worldEntry?.id;

    case 'realm':
      const realm = novelState.realms?.find(r =>
        r.name.toLowerCase() === nameLower
      );
      return realm?.id;

    case 'arc':
      const arc = novelState.plotLedger?.find(a =>
        a.title.toLowerCase() === nameLower
      );
      return arc?.id;

    case 'antagonist':
      const antagonist = novelState.antagonists?.find(a =>
        a.name.toLowerCase() === nameLower
      );
      return antagonist?.id;

    default:
      return undefined;
  }
}

export interface ProcessThreadResult {
  thread: StoryThread;
  wasCreated: boolean;
  wasUpdated: boolean;
  progressionEvent?: ThreadProgressionEvent;
}

/**
 * Process thread updates from AI extraction
 */
export function processThreadUpdates(
  threadUpdates: Array<{
    title?: unknown;
    type?: unknown;
    action?: unknown;
    threadId?: unknown;
    description?: unknown;
    priority?: unknown;
    status?: unknown;
    eventType?: unknown;
    eventDescription?: unknown;
    significance?: unknown;
    relatedEntityName?: unknown;
    relatedEntityType?: unknown;
    resolutionNotes?: unknown;
    satisfactionScore?: unknown;
    threadScope?: unknown; // New field for planning
    estimatedDuration?: unknown; // New field for planning
  }>,
  existingThreads: StoryThread[],
  novelId: string,
  chapterNumber: number,
  chapterId: string,
  novelState: Partial<NovelState>
): ProcessThreadResult[] {
  if (!threadUpdates || threadUpdates.length === 0) {
    return [];
  }

  const results: ProcessThreadResult[] = [];

  for (const update of threadUpdates) {
    try {
      const title = String(update?.title || '').trim();
      if (!title) {
        console.warn('Skipping thread update: missing title');
        continue;
      }

      const type = (update?.type || 'enemy') as StoryThreadType;
      const action = String(update?.action || 'create');
      const eventType = (update?.eventType || 'introduced') as ThreadEventType;
      const eventDescription = String(update?.eventDescription || '').trim();
      const significance = (update?.significance || 'minor') as 'major' | 'minor' | 'foreshadowing';

      // Parse scoping fields
      const threadScope = update?.threadScope ? String(update.threadScope) as ThreadScope : undefined;
      let estimatedDuration = update?.estimatedDuration ? Number(update.estimatedDuration) : undefined;

      // Auto-calculate duration if scope provided but duration missing
      if (threadScope && !estimatedDuration) {
        estimatedDuration = getRecommendedDuration(threadScope);
      }

      const resolutionTargetChapter = estimatedDuration ? chapterNumber + estimatedDuration : undefined;

      // Find existing thread by title (improved fuzzy matching)
      // Uses multiple strategies for robust matching
      const titleLower = title.toLowerCase();
      let existingThread = existingThreads.find(
        t => t.title.toLowerCase() === titleLower
      );

      // If no exact match, try partial match (one title contains the other)
      if (!existingThread) {
        existingThread = existingThreads.find(
          t => t.title.toLowerCase().includes(titleLower) ||
            titleLower.includes(t.title.toLowerCase())
        );
      }

      // If no partial match, try keyword-based matching
      // Extract significant keywords (3+ chars, not common words)
      if (!existingThread) {
        const commonWords = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'about', 'that', 'this', 'will', 'have', 'been', 'being', 'their', 'there', 'what', 'which', 'when', 'where', 'quest', 'thread', 'daily']);
        const titleKeywords = titleLower.split(/[\s\-_:]+/)
          .filter(w => w.length >= 3 && !commonWords.has(w));

        if (titleKeywords.length > 0) {
          // Find thread with highest keyword overlap
          let bestMatch: StoryThread | undefined;
          let bestOverlap = 0;
          const minOverlapThreshold = Math.max(1, Math.floor(titleKeywords.length * 0.4)); // At least 40% keyword overlap

          for (const thread of existingThreads) {
            const threadTitleLower = thread.title.toLowerCase();
            const threadKeywords = threadTitleLower.split(/[\s\-_:]+/)
              .filter(w => w.length >= 3 && !commonWords.has(w));

            // Count matching keywords
            let overlap = 0;
            for (const kw of titleKeywords) {
              if (threadKeywords.some(tk => tk.includes(kw) || kw.includes(tk))) {
                overlap++;
              }
            }

            // Also check if any title keyword is in the other thread's title
            for (const kw of titleKeywords) {
              if (threadTitleLower.includes(kw) && !threadKeywords.some(tk => tk.includes(kw) || kw.includes(tk))) {
                overlap += 0.5;
              }
            }

            if (overlap > bestOverlap && overlap >= minOverlapThreshold) {
              bestOverlap = overlap;
              bestMatch = thread;
            }
          }

          if (bestMatch) {
            existingThread = bestMatch;
            console.debug(`[Thread Matching] Fuzzy matched "${title}" to existing thread "${bestMatch.title}" (${bestOverlap}/${titleKeywords.length} keywords)`);
          }
        }
      }

      // Try matching by type + key entity name (for threads like "Azure System Integration")
      if (!existingThread && update.relatedEntityName) {
        const entityName = String(update.relatedEntityName).toLowerCase().trim();
        existingThread = existingThreads.find(t =>
          t.title.toLowerCase().includes(entityName) &&
          t.type === type
        );
      }

      // Last resort: match by threadId if provided
      if (!existingThread && update.threadId) {
        existingThread = existingThreads.find(
          t => t.id === String(update.threadId)
        );
      }

      if (action === 'resolve' || (action === 'update' && eventType === 'resolved')) {
        // Resolve existing thread
        if (!existingThread) {
          console.warn(`Cannot resolve thread "${title}": thread not found`);
          continue;
        }

        const resolvedThread: StoryThread = {
          ...existingThread,
          status: 'resolved',
          resolvedChapter: chapterNumber,
          lastUpdatedChapter: chapterNumber,
          lastActiveChapter: chapterNumber, // Update last active chapter
          resolutionNotes: update.resolutionNotes ? String(update.resolutionNotes).trim() : eventDescription,
          satisfactionScore: update.satisfactionScore !== undefined ? Number(update.satisfactionScore) : undefined,
          chaptersInvolved: [...(existingThread.chaptersInvolved || []), chapterNumber].filter((v, i, a) => a.indexOf(v) === i),
          updatedAt: Date.now(),
        };

        // Add progression note
        if (eventDescription) {
          resolvedThread.progressionNotes = [
            ...(existingThread.progressionNotes || []),
            {
              chapterNumber,
              note: eventDescription,
              significance: significance === 'foreshadowing' ? 'minor' : significance,
            },
          ];
        }

        const progressionEvent: ThreadProgressionEvent = {
          id: generateUUID(),
          threadId: resolvedThread.id,
          chapterNumber,
          chapterId,
          eventType: 'resolved',
          description: eventDescription || resolvedThread.resolutionNotes || 'Thread resolved',
          significance: significance || 'major', // Resolution is major by default
          createdAt: Date.now(),
        };

        results.push({
          thread: resolvedThread,
          wasCreated: false,
          wasUpdated: true,
          progressionEvent,
        });
      } else if (action === 'update' && existingThread) {
        // Update existing thread
        const updatedThread: StoryThread = {
          ...existingThread,
          description: update.description ? String(update.description).trim() : existingThread.description,
          priority: (update.priority || existingThread.priority) as ThreadPriority,
          status: (update.status || existingThread.status) as ThreadStatus,
          lastUpdatedChapter: chapterNumber,
          lastActiveChapter: chapterNumber, // Update last active chapter
          chaptersInvolved: [...(existingThread.chaptersInvolved || []), chapterNumber].filter((v, i, a) => a.indexOf(v) === i),
          updatedAt: Date.now(),
          // Update planning fields if provided
          threadScope: threadScope || existingThread.threadScope,
          estimatedDuration: estimatedDuration || existingThread.estimatedDuration,
          resolutionTargetChapter: resolutionTargetChapter || existingThread.resolutionTargetChapter,
        };

        // Update entity link if provided
        if (update.relatedEntityName && update.relatedEntityType) {
          const entityName = String(update.relatedEntityName).trim();
          const entityType = String(update.relatedEntityType).trim();
          updatedThread.relatedEntityType = entityType;

          const entityId = resolveEntityId(entityName, entityType, novelState);
          if (entityId) {
            updatedThread.relatedEntityId = entityId;
          }
        }

        // Add progression note
        if (eventDescription) {
          updatedThread.progressionNotes = [
            ...(existingThread.progressionNotes || []),
            {
              chapterNumber,
              note: eventDescription,
              significance: significance === 'foreshadowing' ? 'minor' : significance,
            },
          ];
        }

        const progressionEvent: ThreadProgressionEvent = {
          id: generateUUID(),
          threadId: updatedThread.id,
          chapterNumber,
          chapterId,
          eventType: eventType === 'introduced' ? 'progressed' : eventType,
          description: eventDescription,
          significance,
          createdAt: Date.now(),
        };

        results.push({
          thread: updatedThread,
          wasCreated: false,
          wasUpdated: true,
          progressionEvent,
        });
      } else {
        // Create new thread
        const newThread: StoryThread = {
          id: generateUUID(),
          novelId,
          title,
          type,
          status: (update.status || 'active') as ThreadStatus,
          priority: (update.priority || 'medium') as ThreadPriority,
          description: update.description ? String(update.description).trim() : '',
          introducedChapter: chapterNumber,
          lastUpdatedChapter: chapterNumber,
          lastActiveChapter: chapterNumber, // Initialize with current chapter
          progressionNotes: eventDescription ? [{
            chapterNumber,
            note: eventDescription,
            significance: significance === 'foreshadowing' ? 'minor' : significance,
          }] : [],
          chaptersInvolved: [chapterNumber],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // Set planning fields
          threadScope: threadScope || 'medium', // Default to medium if not specified
          estimatedDuration: estimatedDuration || (threadScope ? getRecommendedDuration(threadScope) : getRecommendedDuration('medium')),
          resolutionTargetChapter: resolutionTargetChapter || (chapterNumber + (estimatedDuration || getRecommendedDuration('medium'))),
        };

        // Link to related entity if provided
        if (update.relatedEntityName && update.relatedEntityType) {
          const entityName = String(update.relatedEntityName).trim();
          const entityType = String(update.relatedEntityType).trim();
          newThread.relatedEntityType = entityType;

          // Resolve entity ID from name
          const entityId = resolveEntityId(entityName, entityType, novelState);
          if (entityId) {
            newThread.relatedEntityId = entityId;
          }
        }

        const progressionEvent: ThreadProgressionEvent = {
          id: generateUUID(),
          threadId: newThread.id,
          chapterNumber,
          chapterId,
          eventType: 'introduced',
          description: eventDescription || `Thread "${title}" introduced`,
          significance,
          createdAt: Date.now(),
        };

        results.push({
          thread: newThread,
          wasCreated: true,
          wasUpdated: false,
          progressionEvent,
        });
      }
    } catch (error) {
      console.error('Error processing thread update:', error, update);
    }
  }

  return results;
}

/**
 * Detect stale threads (threads that haven't progressed in X chapters)
 * Uses type-specific thresholds for better detection
 */
export function detectStaleThreads(
  threads: StoryThread[],
  currentChapter: number,
  threshold: number = 10
): StoryThread[] {
  // Type-specific stale thresholds
  const typeThresholds: Record<StoryThreadType, number> = {
    promise: 5,
    quest: 8,
    conflict: 10,
    relationship: 12,
    power: 15,
    mystery: 20,
    revelation: 15,
    alliance: 12,
    enemy: 15,
    technique: 12,
    item: 15,
    location: 20,
    sect: 18,
  };

  return threads.filter(thread => {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      return false;
    }

    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
    const typeThreshold = typeThresholds[thread.type] || threshold;

    // Use type-specific threshold, but also check general threshold for critical/high priority
    const effectiveThreshold = thread.priority === 'critical'
      ? Math.min(typeThreshold, 5) // Critical threads should update more frequently
      : thread.priority === 'high'
        ? Math.min(typeThreshold, 8) // High priority threads should update more frequently
        : typeThreshold;

    return chaptersSinceUpdate >= effectiveThreshold;
  });
}

/**
 * Calculate thread health score (0-100)
 * Higher score = healthier thread
 */
export function calculateThreadHealth(thread: StoryThread, currentChapter: number): number {
  if (thread.status === 'resolved') {
    // Resolved threads get score based on satisfaction
    return thread.satisfactionScore !== undefined ? thread.satisfactionScore : 80;
  }

  if (thread.status === 'abandoned') {
    return 0;
  }

  let score = 50; // Base score

  // Recent activity bonus
  const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
  if (chaptersSinceUpdate <= 3) {
    score += 20; // Very recent
  } else if (chaptersSinceUpdate <= 5) {
    score += 10; // Recent
  } else if (chaptersSinceUpdate <= 10) {
    score += 5; // Somewhat recent
  } else {
    score -= (chaptersSinceUpdate - 10) * 2; // Stale penalty
  }

  // Priority bonus
  if (thread.priority === 'critical') {
    score += 10;
  } else if (thread.priority === 'high') {
    score += 5;
  }

  // Progression notes bonus
  if (thread.progressionNotes && thread.progressionNotes.length > 0) {
    score += Math.min(thread.progressionNotes.length * 2, 10);
  }

  // Check resolution target
  if (thread.resolutionTargetChapter) {
    if (currentChapter >= thread.resolutionTargetChapter) {
      score -= 20; // Penalty for overdue resolution
    } else if (currentChapter >= thread.resolutionTargetChapter - 3) {
      score -= 5; // Slight penalty for approaching deadline
    }
  }

  // Type-specific health adjustments
  // Some thread types naturally progress slower/faster
  switch (thread.type) {
    case 'promise':
      // Promises should be fulfilled relatively quickly
      if (chaptersSinceUpdate > 5) {
        score -= 5; // Penalty for overdue promises
      }
      break;
    case 'mystery':
      // Mysteries can take longer but should have periodic hints
      if (chaptersSinceUpdate > 15 && thread.progressionNotes.length === 0) {
        score -= 10; // Penalty for mysteries with no progression
      }
      break;
    case 'power':
      // Power progression should be regular
      if (chaptersSinceUpdate > 10) {
        score -= 3; // Small penalty for stagnant power threads
      }
      break;
    case 'relationship':
      // Relationships should evolve regularly
      if (chaptersSinceUpdate > 8) {
        score -= 4; // Penalty for stagnant relationships
      }
      break;
    case 'quest':
      // Quests should progress steadily
      if (chaptersSinceUpdate > 7) {
        score -= 5; // Penalty for stalled quests
      }
      break;
    case 'conflict':
      // Conflicts should escalate or resolve
      if (chaptersSinceUpdate > 12) {
        score -= 6; // Penalty for forgotten conflicts
      }
      break;
  }

  // Clamp score
  return Math.max(0, Math.min(100, score));
}

/**
 * Suggest thread resolutions based on thread age, priority, and type
 */
export function suggestThreadResolutions(
  threads: StoryThread[],
  currentChapter: number
): Array<{ thread: StoryThread; suggestion: string; urgency: 'high' | 'medium' | 'low' }> {
  const suggestions: Array<{ thread: StoryThread; suggestion: string; urgency: 'high' | 'medium' | 'low' }> = [];

  for (const thread of threads) {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      continue;
    }

    const threadAge = currentChapter - thread.introducedChapter;
    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;

    // Check resolution target
    if (thread.resolutionTargetChapter) {
      const chaptersToTarget = thread.resolutionTargetChapter - currentChapter;

      if (chaptersToTarget <= 0) {
        suggestions.push({
          thread,
          suggestion: `Thread "${thread.title}" is OVERDUE for resolution (Target: Ch ${thread.resolutionTargetChapter}). Wrap it up immediately to provide closure.`,
          urgency: 'high'
        });
        continue; // Skip other checks if overdue
      } else if (chaptersToTarget <= 3) {
        suggestions.push({
          thread,
          suggestion: `Thread "${thread.title}" approaching resolution target in ${chaptersToTarget} chapters. Begin climax/resolution sequence.`,
          urgency: 'high'
        });
      }
    }

    // Type-specific thresholds
    const typeThresholds: Record<StoryThreadType, { maxAge: number; maxStale: number }> = {
      promise: { maxAge: 10, maxStale: 5 },
      quest: { maxAge: 20, maxStale: 8 },
      conflict: { maxAge: 25, maxStale: 10 },
      relationship: { maxAge: 30, maxStale: 12 },
      power: { maxAge: 40, maxStale: 15 },
      mystery: { maxAge: 50, maxStale: 20 },
      revelation: { maxAge: 35, maxStale: 15 },
      alliance: { maxAge: 30, maxStale: 12 },
      enemy: { maxAge: 40, maxStale: 15 },
      technique: { maxAge: 35, maxStale: 12 },
      item: { maxAge: 40, maxStale: 15 },
      location: { maxAge: 50, maxStale: 20 },
      sect: { maxAge: 45, maxStale: 18 },
    };

    const thresholds = typeThresholds[thread.type] || { maxAge: 40, maxStale: 15 };

    // Critical priority threads that are old
    if (thread.priority === 'critical' && (threadAge > 15 || chaptersSinceUpdate > 5)) {
      suggestions.push({
        thread,
        suggestion: `Critical ${thread.type} thread "${thread.title}" is ${threadAge} chapters old and hasn't progressed in ${chaptersSinceUpdate} chapters. Consider resolving soon.`,
        urgency: 'high',
      });
    }
    // High priority threads that exceed type-specific thresholds
    else if (thread.priority === 'high' && (threadAge > thresholds.maxAge * 0.75 || chaptersSinceUpdate > thresholds.maxStale * 0.75)) {
      suggestions.push({
        thread,
        suggestion: `High priority ${thread.type} thread "${thread.title}" is ${threadAge} chapters old. Consider progressing or resolving.`,
        urgency: 'high',
      });
    }
    // Threads that exceed type-specific thresholds
    else if (threadAge > thresholds.maxAge || chaptersSinceUpdate > thresholds.maxStale) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" has been active for ${threadAge} chapters and hasn't progressed in ${chaptersSinceUpdate} chapters. Consider wrapping it up.`,
        urgency: thread.priority === 'critical' ? 'high' : 'medium',
      });
    }
    // Stale threads (general threshold)
    else if (chaptersSinceUpdate > 20) {
      suggestions.push({
        thread,
        suggestion: `Thread "${thread.title}" hasn't progressed in ${chaptersSinceUpdate} chapters. Review if it should be resolved or abandoned.`,
        urgency: 'medium',
      });
    }
  }

  return suggestions;
}

/**
 * Link thread to related entity
 */
export function linkThreadToEntity(
  thread: StoryThread,
  entityId: string,
  entityType: string
): StoryThread {
  return {
    ...thread,
    relatedEntityId: entityId,
    relatedEntityType: entityType,
    updatedAt: Date.now(),
  };
}
