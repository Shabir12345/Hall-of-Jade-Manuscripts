/**
 * Arc Memory Service
 * 
 * Manages mid-term memory (Episodic Arc layer) for the hierarchical memory system.
 * Generates and maintains arc summaries, character states at arc boundaries,
 * and thread status across arcs.
 */

import { NovelState, Chapter, Arc, Character, StoryThread } from '../../types';
import { logger } from '../loggingService';

/**
 * Character state at an arc boundary
 */
export interface ArcCharacterState {
  characterId: string;
  characterName: string;
  cultivation: string;
  status: 'Alive' | 'Deceased' | 'Unknown';
  location?: string;
  emotionalState?: string;
  majorChanges: string[]; // What changed during this arc
  relationships: {
    targetName: string;
    type: string;
    change?: string; // How relationship changed during arc
  }[];
}

/**
 * Thread state at arc boundary
 */
export interface ArcThreadState {
  threadId: string;
  threadTitle: string;
  type: string;
  statusAtArcStart: string;
  statusAtArcEnd: string;
  progressionDuringArc: string[];
  isResolved: boolean;
}

/**
 * Complete arc memory summary
 */
export interface ArcMemorySummary {
  arcId: string;
  arcTitle: string;
  novelId: string;
  startChapter: number;
  endChapter?: number;
  status: 'active' | 'completed';
  
  /** ~500 word summary of the arc */
  summary: string;
  
  /** Key events that happened during the arc */
  keyEvents: string[];
  
  /** Character states at arc start/end */
  characterStates: ArcCharacterState[];
  
  /** Thread progression during the arc */
  threadStates: ArcThreadState[];
  
  /** Major conflicts resolved or introduced */
  conflictChanges: {
    introduced: string[];
    resolved: string[];
    escalated: string[];
  };
  
  /** Unresolved elements carried to next arc */
  unresolvedElements: string[];
  
  /** Timestamp */
  createdAt: number;
  updatedAt: number;
}

/**
 * Generate a summary for an arc based on its chapters
 */
export function generateArcSummary(
  arc: Arc,
  chapters: Chapter[],
  state: NovelState
): string {
  const arcChapters = chapters.filter(ch => {
    if (!arc.startedAtChapter) return false;
    if (arc.endedAtChapter) {
      return ch.number >= arc.startedAtChapter && ch.number <= arc.endedAtChapter;
    }
    return ch.number >= arc.startedAtChapter;
  });

  if (arcChapters.length === 0) {
    return arc.description || `Arc: ${arc.title}`;
  }

  // Combine chapter summaries
  const chapterSummaries = arcChapters
    .map(ch => ch.summary || ch.title)
    .filter(s => s && s.length > 0);

  // Build summary sections
  const sections: string[] = [];
  
  sections.push(`Arc: "${arc.title}"`);
  sections.push(`Chapters ${arcChapters[0].number}-${arcChapters[arcChapters.length - 1].number}`);
  sections.push('');
  
  if (arc.description) {
    sections.push(`Goal: ${arc.description}`);
    sections.push('');
  }

  // Add key events from chapter summaries
  sections.push('Key Events:');
  const keyEvents = extractKeyEvents(chapterSummaries);
  keyEvents.slice(0, 5).forEach(event => {
    sections.push(`- ${event}`);
  });
  sections.push('');

  // Add arc outcome if completed
  if (arc.status === 'completed') {
    sections.push(`Outcome: Arc completed at Chapter ${arc.endedAtChapter}.`);
    
    // Check for checklist completions
    if (arc.checklist) {
      const completed = arc.checklist.filter(item => item.completed);
      if (completed.length > 0) {
        sections.push(`Completed objectives: ${completed.map(c => c.label).join(', ')}`);
      }
    }
  }

  // Truncate to ~500 words
  let summary = sections.join('\n');
  const words = summary.split(/\s+/);
  if (words.length > 500) {
    summary = words.slice(0, 500).join(' ') + '...';
  }

  return summary;
}

/**
 * Extract key events from chapter summaries
 */
function extractKeyEvents(summaries: string[]): string[] {
  const events: string[] = [];
  
  for (const summary of summaries) {
    // Split into sentences
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Look for action-oriented sentences
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      
      // Skip if too short or too long
      if (trimmed.length < 20 || trimmed.length > 200) continue;
      
      // Prioritize sentences with action verbs or key words
      const actionPatterns = /\b(discovered|revealed|defeated|escaped|arrived|met|learned|received|lost|gained|broke through|confronted|allied|betrayed|rescued|destroyed)\b/i;
      
      if (actionPatterns.test(trimmed)) {
        events.push(trimmed);
      }
    }
  }

  // Deduplicate similar events
  const uniqueEvents: string[] = [];
  for (const event of events) {
    const isDuplicate = uniqueEvents.some(e => 
      e.toLowerCase().includes(event.toLowerCase().substring(0, 30)) ||
      event.toLowerCase().includes(e.toLowerCase().substring(0, 30))
    );
    if (!isDuplicate) {
      uniqueEvents.push(event);
    }
  }

  return uniqueEvents;
}

/**
 * Build character states for an arc
 */
export function buildArcCharacterStates(
  arc: Arc,
  chapters: Chapter[],
  state: NovelState
): ArcCharacterState[] {
  const characterStates: ArcCharacterState[] = [];

  // Get protagonist first
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  if (protagonist) {
    characterStates.push(buildCharacterArcState(protagonist, arc, chapters, state));
  }

  // Get other important characters (mentioned in arc chapters)
  const arcChapters = chapters.filter(ch => {
    if (!arc.startedAtChapter) return false;
    return ch.number >= arc.startedAtChapter && 
           (!arc.endedAtChapter || ch.number <= arc.endedAtChapter);
  });

  const arcContent = arcChapters.map(ch => ch.content + ' ' + ch.summary).join(' ').toLowerCase();

  const relevantCharacters = state.characterCodex
    .filter(c => !c.isProtagonist && arcContent.includes(c.name.toLowerCase()))
    .slice(0, 5); // Top 5 non-protagonist characters

  for (const character of relevantCharacters) {
    characterStates.push(buildCharacterArcState(character, arc, chapters, state));
  }

  return characterStates;
}

/**
 * Build state for a single character during an arc
 */
function buildCharacterArcState(
  character: Character,
  arc: Arc,
  chapters: Chapter[],
  state: NovelState
): ArcCharacterState {
  const majorChanges: string[] = [];
  const relationships: ArcCharacterState['relationships'] = [];

  // Extract relationship info
  if (character.relationships) {
    character.relationships.slice(0, 3).forEach(rel => {
      const target = state.characterCodex.find(c => c.id === rel.characterId);
      if (target) {
        relationships.push({
          targetName: target.name,
          type: rel.type,
        });
      }
    });
  }

  // Detect potential changes from update history
  if (character.updateHistory) {
    const arcUpdates = character.updateHistory.filter(update => {
      if (!arc.startedAtChapter) return false;
      return update.chapterNumber >= arc.startedAtChapter &&
             (!arc.endedAtChapter || update.chapterNumber <= arc.endedAtChapter);
    });

    arcUpdates.forEach(update => {
      if (update.changes.includes('cultivation')) {
        majorChanges.push('Cultivation breakthrough');
      }
      if (update.changes.includes('status')) {
        majorChanges.push('Status changed');
      }
      if (update.changes.includes('skills') || update.changes.includes('techniques')) {
        majorChanges.push('Learned new technique');
      }
    });
  }

  return {
    characterId: character.id,
    characterName: character.name,
    cultivation: character.currentCultivation,
    status: character.status,
    majorChanges,
    relationships,
  };
}

/**
 * Build thread states for an arc
 */
export function buildArcThreadStates(
  arc: Arc,
  state: NovelState
): ArcThreadState[] {
  if (!state.storyThreads) {
    return [];
  }

  const threadStates: ArcThreadState[] = [];

  // Get threads that were active during this arc
  const arcThreads = state.storyThreads.filter(thread => {
    if (!arc.startedAtChapter) return false;
    
    // Thread was introduced before or during arc
    if (thread.introducedChapter > (arc.endedAtChapter || arc.startedAtChapter + 100)) {
      return false;
    }
    
    // Thread had activity during arc
    const hasArcActivity = thread.chaptersInvolved?.some(ch => {
      return ch >= arc.startedAtChapter! && 
             (!arc.endedAtChapter || ch <= arc.endedAtChapter);
    });
    
    return hasArcActivity || thread.status === 'active';
  });

  for (const thread of arcThreads.slice(0, 10)) {
    // Get progression notes during arc
    const arcProgression = thread.progressionNotes
      ?.filter(note => {
        return note.chapterNumber >= arc.startedAtChapter! &&
               (!arc.endedAtChapter || note.chapterNumber <= arc.endedAtChapter);
      })
      .map(note => note.note) || [];

    threadStates.push({
      threadId: thread.id,
      threadTitle: thread.title,
      type: thread.type,
      statusAtArcStart: thread.introducedChapter < arc.startedAtChapter! ? 'active' : 'introduced',
      statusAtArcEnd: thread.status,
      progressionDuringArc: arcProgression,
      isResolved: thread.status === 'resolved' && 
                  thread.resolvedChapter !== undefined &&
                  thread.resolvedChapter <= (arc.endedAtChapter || Infinity),
    });
  }

  return threadStates;
}

/**
 * Build a complete arc memory summary
 */
export function buildArcMemorySummary(
  arc: Arc,
  state: NovelState
): ArcMemorySummary {
  logger.debug('Building arc memory summary', 'arcMemoryService', undefined, {
    arcId: arc.id,
    arcTitle: arc.title,
  });

  const summary = generateArcSummary(arc, state.chapters, state);
  const characterStates = buildArcCharacterStates(arc, state.chapters, state);
  const threadStates = buildArcThreadStates(arc, state);

  // Extract key events
  const arcChapters = state.chapters.filter(ch => {
    if (!arc.startedAtChapter) return false;
    return ch.number >= arc.startedAtChapter &&
           (!arc.endedAtChapter || ch.number <= arc.endedAtChapter);
  });
  const keyEvents = extractKeyEvents(arcChapters.map(ch => ch.summary || ''));

  // Determine conflict changes
  const conflictChanges = {
    introduced: threadStates.filter(t => t.statusAtArcStart === 'introduced' && t.type === 'conflict').map(t => t.threadTitle),
    resolved: threadStates.filter(t => t.isResolved && t.type === 'conflict').map(t => t.threadTitle),
    escalated: [], // Would need more detailed tracking
  };

  // Identify unresolved elements
  const unresolvedElements = threadStates
    .filter(t => !t.isResolved && t.type !== 'conflict')
    .map(t => `${t.threadTitle} (${t.type})`);

  return {
    arcId: arc.id,
    arcTitle: arc.title,
    novelId: state.id,
    startChapter: arc.startedAtChapter || 1,
    endChapter: arc.endedAtChapter,
    status: arc.status,
    summary,
    keyEvents,
    characterStates,
    threadStates,
    conflictChanges,
    unresolvedElements,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Build memory summaries for all arcs
 */
export function buildAllArcMemories(state: NovelState): ArcMemorySummary[] {
  const memories: ArcMemorySummary[] = [];

  for (const arc of state.plotLedger) {
    const memory = buildArcMemorySummary(arc, state);
    memories.push(memory);
  }

  return memories;
}

/**
 * Get the most relevant arc memories for chapter generation
 */
export function getRelevantArcMemories(
  state: NovelState,
  currentChapter: number,
  maxArcs: number = 3
): ArcMemorySummary[] {
  const allMemories = buildAllArcMemories(state);

  // Sort by relevance (active arc first, then most recent)
  const sorted = allMemories.sort((a, b) => {
    // Active arc always first
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (b.status === 'active' && a.status !== 'active') return 1;

    // Then by end chapter (most recent first)
    const aEnd = a.endChapter || currentChapter;
    const bEnd = b.endChapter || currentChapter;
    return bEnd - aEnd;
  });

  return sorted.slice(0, maxArcs);
}

/**
 * Format arc memory for prompt inclusion
 */
export function formatArcMemoryForPrompt(memory: ArcMemorySummary): string {
  const sections: string[] = [];

  sections.push(`[ARC MEMORY: "${memory.arcTitle}"]`);
  sections.push(`Chapters ${memory.startChapter}${memory.endChapter ? `-${memory.endChapter}` : '+'}${memory.status === 'active' ? ' (ACTIVE)' : ''}`);
  sections.push('');
  sections.push(memory.summary);
  sections.push('');

  if (memory.keyEvents.length > 0) {
    sections.push('Key Events:');
    memory.keyEvents.slice(0, 3).forEach(event => {
      sections.push(`- ${event}`);
    });
    sections.push('');
  }

  if (memory.unresolvedElements.length > 0) {
    sections.push('Unresolved from this arc:');
    memory.unresolvedElements.slice(0, 3).forEach(elem => {
      sections.push(`- ${elem}`);
    });
  }

  return sections.join('\n');
}

/**
 * Format multiple arc memories compactly
 */
export function formatArcMemoriesCompact(memories: ArcMemorySummary[]): string {
  const sections: string[] = [];
  
  sections.push('[EPISODIC ARC MEMORY]');
  sections.push('');

  for (const memory of memories) {
    const statusTag = memory.status === 'active' ? '[ACTIVE]' : '';
    sections.push(`${memory.arcTitle} (Ch ${memory.startChapter}-${memory.endChapter || 'present'}) ${statusTag}`);
    
    // Truncate summary to ~100 words
    const summaryWords = memory.summary.split(/\s+/).slice(0, 100);
    sections.push(summaryWords.join(' '));
    sections.push('');
  }

  return sections.join('\n');
}
