/**
 * Thread Progression Service
 * Tracks thread progression status after each chapter
 * Generates progression instructions for next chapter
 * Identifies stale threads that need attention
 */

import { StoryThread, ThreadStatus, ThreadPriority, StoryThreadType, NovelState } from '../types';
import { detectStaleThreads, calculateThreadHealth } from './storyThreadService';

export interface ThreadProgressionInstructions {
  currentStage: string;
  lastProgress: string;
  nextSteps: string[];
  urgency: 'must address' | 'should address' | 'optional';
  healthScore: number;
}

export interface ThreadContextSection {
  activeThreads: Array<{
    thread: StoryThread;
    instructions: ThreadProgressionInstructions;
    formattedContext: string;
  }>;
  staleThreads: StoryThread[];
  criticalThreads: StoryThread[];
  formattedContext: string;
}

/**
 * Get progression instructions for a thread
 */
export function getThreadProgressionInstructions(
  thread: StoryThread,
  nextChapterNumber: number
): ThreadProgressionInstructions {
  const chaptersSinceUpdate = nextChapterNumber - thread.lastUpdatedChapter;
  const threadAge = nextChapterNumber - thread.introducedChapter;
  
  // Determine current stage based on thread age and updates
  let currentStage: string;
  if (thread.status === 'resolved') {
    currentStage = 'Resolved';
  } else if (thread.status === 'paused') {
    currentStage = 'Paused';
  } else if (thread.status === 'abandoned') {
    currentStage = 'Abandoned';
  } else if (chaptersSinceUpdate === 0) {
    currentStage = 'Just Introduced';
  } else if (chaptersSinceUpdate <= 2) {
    currentStage = 'Recently Active';
  } else if (chaptersSinceUpdate <= 5) {
    currentStage = 'Active';
  } else if (chaptersSinceUpdate <= 10) {
    currentStage = 'Ongoing';
  } else {
    currentStage = 'Stale';
  }

  // Get last progress from progression notes
  const lastProgress = thread.progressionNotes && thread.progressionNotes.length > 0
    ? thread.progressionNotes[thread.progressionNotes.length - 1].note
    : thread.description || 'No recent progress';

  // Generate next steps based on thread type, age, and priority
  const nextSteps: string[] = [];
  
  if (thread.status === 'resolved' || thread.status === 'abandoned') {
    nextSteps.push('Thread is resolved/abandoned - no action needed');
  } else {
    // Type-specific next steps
    switch (thread.type) {
      case 'promise':
        if (chaptersSinceUpdate <= 2) {
          nextSteps.push('Set up circumstances for promise fulfillment');
          nextSteps.push('Show character working toward promise');
        } else if (chaptersSinceUpdate <= 5) {
          nextSteps.push('Progress toward promise fulfillment');
          nextSteps.push('Address obstacles to promise');
        } else {
          nextSteps.push('Fulfill or address the promise soon');
          nextSteps.push('Resolve or acknowledge if promise is broken');
        }
        break;
      case 'quest':
        nextSteps.push('Progress the quest objective');
        nextSteps.push('Show character working toward quest goal');
        if (chaptersSinceUpdate > 8) {
          nextSteps.push('Consider resolving or advancing quest significantly');
        }
        break;
      case 'conflict':
        if (chaptersSinceUpdate <= 3) {
          nextSteps.push('Escalate or develop the conflict');
          nextSteps.push('Show consequences of conflict');
        } else {
          nextSteps.push('Advance toward conflict resolution');
          nextSteps.push('Show turning points in conflict');
        }
        break;
      case 'relationship':
        nextSteps.push('Develop the relationship dynamic');
        nextSteps.push('Show interactions between characters');
        if (chaptersSinceUpdate > 12) {
          nextSteps.push('Progress relationship to new stage');
        }
        break;
      case 'power':
        nextSteps.push('Show power progression or development');
        nextSteps.push('Demonstrate new power capabilities');
        if (chaptersSinceUpdate > 15) {
          nextSteps.push('Consider significant power advancement');
        }
        break;
      case 'mystery':
        if (chaptersSinceUpdate <= 5) {
          nextSteps.push('Add clues or hints about mystery');
          nextSteps.push('Develop mystery complexity');
        } else {
          nextSteps.push('Reveal clues or advance investigation');
          nextSteps.push('Progress toward mystery resolution');
        }
        break;
      case 'enemy':
        nextSteps.push('Show antagonist activity or influence');
        nextSteps.push('Demonstrate threat level');
        if (chaptersSinceUpdate > 15) {
          nextSteps.push('Escalate conflict with enemy or show their plan');
        }
        break;
      default:
        nextSteps.push('Progress the thread meaningfully');
        nextSteps.push('Show thread development or advancement');
    }

    // Priority-based adjustments
    if (thread.priority === 'critical') {
      nextSteps.unshift('CRITICAL: Must address this thread in this chapter');
      nextSteps.push('Ensure thread progresses significantly');
    } else if (thread.priority === 'high') {
      nextSteps.unshift('HIGH PRIORITY: Should address this thread soon');
    }

    // Stale thread adjustments
    if (chaptersSinceUpdate > 10) {
      nextSteps.push(`Thread has been stale for ${chaptersSinceUpdate} chapters - needs attention`);
    }
  }

  // Determine urgency
  let urgency: 'must address' | 'should address' | 'optional';
  if (thread.status === 'resolved' || thread.status === 'abandoned') {
    urgency = 'optional';
  } else if (thread.priority === 'critical') {
    urgency = 'must address';
  } else if (thread.priority === 'high' || chaptersSinceUpdate > 10) {
    urgency = 'should address';
  } else {
    urgency = 'optional';
  }

  const healthScore = calculateThreadHealth(thread, nextChapterNumber);

  return {
    currentStage,
    lastProgress,
    nextSteps,
    urgency,
    healthScore,
  };
}

/**
 * Compile comprehensive thread context for prompts
 */
export function compileThreadContext(
  state: NovelState,
  nextChapterNumber: number
): ThreadContextSection {
  const activeThreads = state.storyThreads
    .filter(t => t.status === 'active' || t.status === 'paused')
    .map(thread => {
      const instructions = getThreadProgressionInstructions(thread, nextChapterNumber);
      const priorityLabel = thread.priority === 'critical' ? '[CRITICAL]' :
                           thread.priority === 'high' ? '[HIGH PRIORITY]' : '';
      
      const formattedContext = `${priorityLabel} "${thread.title}" (Type: ${thread.type})
   - Status: ${thread.status}
   - Introduced: Chapter ${thread.introducedChapter}
   - Last Updated: Chapter ${thread.lastUpdatedChapter} (${nextChapterNumber - thread.lastUpdatedChapter} chapters ago)
   - Current Stage: ${instructions.currentStage}
   - Last Progress: ${instructions.lastProgress.substring(0, 200)}
   ${thread.progressionNotes && thread.progressionNotes.length > 0 ? `   - Progression Notes:\n${thread.progressionNotes.slice(-3).map(pn => `     * Ch ${pn.chapterNumber}: ${pn.note.substring(0, 150)}`).join('\n')}` : ''}
   - NEXT STEPS:\n${instructions.nextSteps.map(step => `     * ${step}`).join('\n')}
   - Urgency: ${instructions.urgency.toUpperCase()}
   - Health Score: ${instructions.healthScore}/100`;

      return {
        thread,
        instructions,
        formattedContext,
      };
    });

  const staleThreads = detectStaleThreads(state.storyThreads, nextChapterNumber);
  const criticalThreads = activeThreads
    .filter(item => item.thread.priority === 'critical' || item.thread.priority === 'high')
    .map(item => item.thread);

  // Format comprehensive context
  const sections: string[] = [];
  sections.push('[STORY THREADS CONTEXT]');
  sections.push('');

  if (activeThreads.length > 0) {
    sections.push('ACTIVE THREADS:');
    activeThreads.forEach((item, index) => {
      sections.push(`${index + 1}. ${item.formattedContext}`);
      sections.push('');
    });
  }

  if (staleThreads.length > 0) {
    sections.push('STALE THREADS (Need Attention):');
    staleThreads.forEach(thread => {
      sections.push(`- "${thread.title}" (Type: ${thread.type}) - Last updated ${nextChapterNumber - thread.lastUpdatedChapter} chapters ago`);
    });
    sections.push('');
  }

  if (criticalThreads.length > 0) {
    sections.push('CRITICAL THREADS (Must Address Soon):');
    criticalThreads.forEach(thread => {
      sections.push(`- "${thread.title}" (Type: ${thread.type}, Priority: ${thread.priority}) - Introduced Ch ${thread.introducedChapter}, Last updated Ch ${thread.lastUpdatedChapter}`);
    });
    sections.push('');
  }

  if (activeThreads.length === 0 && staleThreads.length === 0 && criticalThreads.length === 0) {
    sections.push('No active story threads to track.');
  }

  return {
    activeThreads,
    staleThreads,
    criticalThreads,
    formattedContext: sections.join('\n'),
  };
}
