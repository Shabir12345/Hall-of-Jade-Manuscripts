/**
 * Open Plot Points Tracker
 * Tracks all open plot points/storylines
 * Identifies unresolved questions
 * Tracks pending promises and commitments
 * Monitors story completeness
 */

import { NovelState, StoryThread, Chapter } from '../types';
import { extractActivePlotThreads } from './promptEngine/storyStateTracker';

export interface OpenPlotPoint {
  id: string;
  type: 'question' | 'promise' | 'commitment' | 'conflict' | 'pursuit' | 'thread' | 'mystery';
  description: string;
  introducedChapter: number;
  age: number; // Chapters since introduction
  priority: 'high' | 'medium' | 'low';
  urgency: 'must address' | 'should address' | 'optional';
  relatedEntity?: {
    type: string;
    name: string;
  };
}

export interface OpenPlotPointsContext {
  highPriority: OpenPlotPoint[];
  mediumPriority: OpenPlotPoint[];
  lowPriority: OpenPlotPoint[];
  formattedContext: string;
  recommendations: string[];
}

/**
 * Get all open plot points from the story
 */
export function getOpenPlotPoints(state: NovelState): OpenPlotPointsContext {
  const currentChapter = state.chapters.length;
  const plotPoints: OpenPlotPoint[] = [];

  // Extract from active plot threads (from storyStateTracker)
  const activePlotThreads = extractActivePlotThreads(
    state.chapters,
    state.plotLedger,
    state.characterCodex
  );

  activePlotThreads.forEach(thread => {
    const age = currentChapter - (thread.introducedInChapter || 1);
    let type: OpenPlotPoint['type'] = 'thread';
    
    if (thread.threadType === 'question') type = 'question';
    else if (thread.threadType === 'commitment') type = 'commitment';
    else if (thread.threadType === 'conflict') type = 'conflict';
    else if (thread.threadType === 'pursuit') type = 'pursuit';
    else if (thread.threadType === 'meeting') type = 'promise';

    plotPoints.push({
      id: thread.id,
      type,
      description: thread.description,
      introducedChapter: thread.introducedInChapter || 1,
      age,
      priority: thread.priority || 'medium',
      urgency: thread.priority === 'high' ? 'should address' : age > 10 ? 'should address' : 'optional',
    });
  });

  // Extract from story threads
  state.storyThreads
    .filter(t => t.status === 'active' || t.status === 'paused')
    .forEach(thread => {
      const age = currentChapter - thread.introducedChapter;
      let type: OpenPlotPoint['type'] = 'thread';
      
      if (thread.type === 'promise') type = 'promise';
      else if (thread.type === 'mystery') type = 'mystery';
      else if (thread.type === 'conflict') type = 'conflict';
      else if (thread.type === 'quest') type = 'pursuit';

      plotPoints.push({
        id: thread.id,
        type,
        description: thread.description || thread.title,
        introducedChapter: thread.introducedChapter,
        age,
        priority: thread.priority,
        urgency: thread.priority === 'critical' ? 'must address' :
                thread.priority === 'high' ? 'should address' :
                age > 15 ? 'should address' : 'optional',
        relatedEntity: thread.relatedEntityId && thread.relatedEntityType
          ? {
              type: thread.relatedEntityType,
              name: `Entity ${thread.relatedEntityId.substring(0, 8)}`,
            }
          : undefined,
      });
    });

  // Extract unresolved questions from recent chapters
  const recentChapters = state.chapters.slice(-10);
  recentChapters.forEach(chapter => {
    const content = chapter.content;
    const questionMatches = content.match(/[^.!?]*\?/g);
    
    if (questionMatches) {
      questionMatches.slice(0, 3).forEach((question, index) => {
        const trimmed = question.trim();
        if (trimmed.length > 10 && trimmed.length < 200) {
          const age = currentChapter - chapter.number;
          plotPoints.push({
            id: `question-${chapter.id}-${index}`,
            type: 'question',
            description: trimmed,
            introducedChapter: chapter.number,
            age,
            priority: age > 5 ? 'medium' : 'low',
            urgency: age > 10 ? 'should address' : 'optional',
          });
        }
      });
    }
  });

  // Extract from arcs (unresolved checklist items)
  state.plotLedger
    .filter(arc => arc.status === 'active' && arc.checklist)
    .forEach(arc => {
      arc.checklist
        ?.filter(item => !item.completed)
        .forEach(item => {
          const age = currentChapter - (item.sourceChapterNumber || arc.startedAtChapter || 1);
          plotPoints.push({
            id: `checklist-${arc.id}-${item.id}`,
            type: 'commitment',
            description: item.label,
            introducedChapter: item.sourceChapterNumber || arc.startedAtChapter || 1,
            age,
            priority: 'high', // Checklist items are high priority
            urgency: age > 3 ? 'should address' : 'optional',
            relatedEntity: {
              type: 'arc',
              name: arc.title,
            },
          });
        });
    });

  // Sort and categorize by priority
  const highPriority = plotPoints.filter(p => p.priority === 'high' || p.priority === 'critical');
  const mediumPriority = plotPoints.filter(p => p.priority === 'medium');
  const lowPriority = plotPoints.filter(p => p.priority === 'low');

  // Sort by urgency and age within each priority
  const sortByUrgency = (a: OpenPlotPoint, b: OpenPlotPoint) => {
    const urgencyOrder = { 'must address': 3, 'should address': 2, 'optional': 1 };
    const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.age - a.age; // Older first
  };

  highPriority.sort(sortByUrgency);
  mediumPriority.sort(sortByUrgency);
  lowPriority.sort(sortByUrgency);

  // Generate recommendations
  const recommendations: string[] = [];
  
  const mustAddressCount = plotPoints.filter(p => p.urgency === 'must address').length;
  const shouldAddressCount = plotPoints.filter(p => p.urgency === 'should address').length;
  
  if (mustAddressCount > 0) {
    recommendations.push(`Address at least ${Math.min(mustAddressCount, 2)} critical/high-priority plot points this chapter`);
  }
  
  if (shouldAddressCount > 0) {
    recommendations.push(`Consider addressing ${Math.min(shouldAddressCount, 3)} medium-priority plot points`);
  }
  
  if (highPriority.length > 5) {
    recommendations.push(`Warning: ${highPriority.length} high-priority plot points pending - consider resolving some soon`);
  }
  
  const oldPlotPoints = plotPoints.filter(p => p.age > 15);
  if (oldPlotPoints.length > 0) {
    recommendations.push(`${oldPlotPoints.length} plot points are over 15 chapters old - review for resolution`);
  }

  // Format comprehensive context
  const sections: string[] = [];
  sections.push('[OPEN PLOT POINTS - Unresolved Storylines]');
  sections.push('');

  if (highPriority.length > 0) {
    sections.push('HIGH PRIORITY:');
    highPriority.slice(0, 8).forEach((point, index) => {
      sections.push(`${index + 1}. [${point.type.toUpperCase()}] ${point.description.substring(0, 200)}`);
      sections.push(`   - Introduced: Ch ${point.introducedChapter}, ${point.age} chapters ago`);
      sections.push(`   - Urgency: ${point.urgency.toUpperCase()}`);
      if (point.relatedEntity) {
        sections.push(`   - Related to: ${point.relatedEntity.type} - ${point.relatedEntity.name}`);
      }
      sections.push('');
    });
  }

  if (mediumPriority.length > 0) {
    sections.push('MEDIUM PRIORITY:');
    mediumPriority.slice(0, 5).forEach((point, index) => {
      sections.push(`${index + 1}. [${point.type.toUpperCase()}] ${point.description.substring(0, 150)} (Ch ${point.introducedChapter}, ${point.age} chapters ago)`);
    });
    sections.push('');
  }

  if (lowPriority.length > 0 && lowPriority.length <= 5) {
    sections.push('LOW PRIORITY:');
    lowPriority.slice(0, 3).forEach((point, index) => {
      sections.push(`${index + 1}. [${point.type.toUpperCase()}] ${point.description.substring(0, 100)} (Ch ${point.introducedChapter})`);
    });
    sections.push('');
  }

  if (recommendations.length > 0) {
    sections.push('RECOMMENDATIONS:');
    recommendations.forEach(rec => {
      sections.push(`- ${rec}`);
    });
    sections.push('');
  }

  if (plotPoints.length === 0) {
    sections.push('No open plot points detected.');
  }

  return {
    highPriority: highPriority.slice(0, 10),
    mediumPriority: mediumPriority.slice(0, 10),
    lowPriority: lowPriority.slice(0, 10),
    formattedContext: sections.join('\n'),
    recommendations,
  };
}
