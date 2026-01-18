/**
 * Chapter Flow Enhancer
 * 
 * Analyzes chapter-to-chapter flow to provide guidance for smooth transitions
 * and consistency. Designed for models with large context windows (e.g., Grok 2M tokens)
 * where multiple chapters can be included in context.
 */

import { NovelState, Chapter } from '../types';

export interface ChapterFlowContext {
  /** Analysis of pacing and tone across recent chapters */
  pacingAnalysis: PacingAnalysis;
  /** Character arcs that span multiple chapters */
  spanningCharacterArcs: CharacterArcSpan[];
  /** Plot thread development across chapter boundaries */
  threadProgression: ThreadProgression[];
  /** Emotional beats and tension curves across chapters */
  emotionalArc: EmotionalArc;
  /** Transition guidance based on recent chapter patterns */
  transitionGuidance: string;
}

export interface PacingAnalysis {
  /** Average words per chapter in recent chapters */
  averageWordsPerChapter: number;
  /** Pacing trend: 'accelerating', 'steady', 'decelerating' */
  pacingTrend: 'accelerating' | 'steady' | 'decelerating';
  /** Dominant scene count pattern */
  sceneCountPattern: {
    average: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  /** Pacing recommendations */
  recommendations: string[];
}

export interface CharacterArcSpan {
  characterId: string;
  characterName: string;
  /** First chapter number where character appeared in recent chapters */
  firstChapter: number;
  /** Last chapter number where character appeared */
  lastChapter: number;
  /** Character's development arc description */
  arcDescription: string;
  /** Key events in character's progression */
  keyEvents: Array<{ chapterNumber: number; event: string }>;
}

export interface ThreadProgression {
  threadId: string;
  threadDescription: string;
  /** Chapters where this thread was active */
  activeChapters: number[];
  /** Progression status: 'advancing', 'stagnant', 'resolving' */
  status: 'advancing' | 'stagnant' | 'resolving';
  /** Last significant development */
  lastDevelopment?: { chapterNumber: number; development: string };
}

export interface EmotionalArc {
  /** Emotional intensity scores per chapter */
  intensityByChapter: Array<{ chapterNumber: number; intensity: number }>;
  /** Current emotional trend */
  trend: 'rising' | 'plateau' | 'falling';
  /** Recommended emotional tone for next chapter */
  recommendedTone: string;
  /** Tension curve analysis */
  tensionCurve: {
    currentLevel: number;
    peakChapter: number | null;
    recommendedDirection: 'build' | 'maintain' | 'release';
  };
}

/**
 * Builds comprehensive chapter flow context from recent chapters
 * 
 * @param state - The current novel state
 * @param recentChapters - Recent chapters to analyze (can be many for large context windows)
 * @param options - Options for analysis
 * @returns Chapter flow context with analysis and guidance
 */
export function buildChapterFlowContext(
  state: NovelState,
  recentChapters: Chapter[],
  options: { includeFullText?: boolean } = {}
): ChapterFlowContext {
  if (recentChapters.length === 0) {
    return {
      pacingAnalysis: {
        averageWordsPerChapter: 0,
        pacingTrend: 'steady',
        sceneCountPattern: { average: 0, trend: 'stable' },
        recommendations: [],
      },
      spanningCharacterArcs: [],
      threadProgression: [],
      emotionalArc: {
        intensityByChapter: [],
        trend: 'plateau',
        recommendedTone: 'neutral',
        tensionCurve: {
          currentLevel: 0,
          peakChapter: null,
          recommendedDirection: 'build',
        },
      },
      transitionGuidance: 'This is the beginning of the story. Establish setting and introduce main characters.',
    };
  }

  const pacingAnalysis = analyzePacing(recentChapters);
  const spanningCharacterArcs = analyzeSpanningCharacterArcs(state, recentChapters);
  const threadProgression = analyzeThreadProgression(state, recentChapters);
  const emotionalArc = analyzeEmotionalArc(recentChapters);
  const transitionGuidance = generateTransitionGuidance(
    recentChapters,
    pacingAnalysis,
    spanningCharacterArcs,
    threadProgression,
    emotionalArc
  );

  return {
    pacingAnalysis,
    spanningCharacterArcs,
    threadProgression,
    emotionalArc,
    transitionGuidance,
  };
}

/**
 * Analyzes pacing patterns across recent chapters
 */
function analyzePacing(chapters: Chapter[]): PacingAnalysis {
  if (chapters.length === 0) {
    return {
      averageWordsPerChapter: 0,
      pacingTrend: 'steady',
      sceneCountPattern: { average: 0, trend: 'stable' },
      recommendations: [],
    };
  }

  // Calculate word counts
  const wordCounts = chapters.map(ch => ch.content.split(/\s+/).length);
  const averageWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);

  // Determine pacing trend
  let pacingTrend: 'accelerating' | 'steady' | 'decelerating' = 'steady';
  if (chapters.length >= 3) {
    const firstHalf = wordCounts.slice(0, Math.ceil(chapters.length / 2));
    const secondHalf = wordCounts.slice(Math.ceil(chapters.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.1) {
      pacingTrend = 'accelerating';
    } else if (secondAvg < firstAvg * 0.9) {
      pacingTrend = 'decelerating';
    }
  }

  // Analyze scene count patterns (estimate based on chapter structure)
  const estimatedSceneCounts = chapters.map(ch => {
    // Rough estimate: count major scene breaks (paragraph breaks, dialogue patterns)
    const paragraphs = ch.content.split(/\n\n+/).length;
    return Math.max(1, Math.round(paragraphs / 10));
  });
  const averageScenes = Math.round(
    estimatedSceneCounts.reduce((a, b) => a + b, 0) / estimatedSceneCounts.length
  );
  
  let sceneTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (chapters.length >= 3) {
    const firstHalf = estimatedSceneCounts.slice(0, Math.ceil(chapters.length / 2));
    const secondHalf = estimatedSceneCounts.slice(Math.ceil(chapters.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.2) {
      sceneTrend = 'increasing';
    } else if (secondAvg < firstAvg * 0.8) {
      sceneTrend = 'decreasing';
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (pacingTrend === 'accelerating' && averageWords > 2000) {
    recommendations.push('Pacing is accelerating. Consider a moment of reflection or slower scene to balance the rhythm.');
  } else if (pacingTrend === 'decelerating' && averageWords < 1500) {
    recommendations.push('Pacing has slowed. Consider increasing action or tension to maintain reader engagement.');
  }
  
  if (averageWords < 1500) {
    recommendations.push('Chapters are below the 1500-word minimum. Ensure sufficient depth and detail.');
  }

  return {
    averageWordsPerChapter: averageWords,
    pacingTrend,
    sceneCountPattern: {
      average: averageScenes,
      trend: sceneTrend,
    },
    recommendations,
  };
}

/**
 * Analyzes character arcs that span multiple recent chapters
 */
function analyzeSpanningCharacterArcs(
  state: NovelState,
  chapters: Chapter[]
): CharacterArcSpan[] {
  const arcs: Map<string, CharacterArcSpan> = new Map();

  state.characterCodex.forEach(char => {
    const appearances: number[] = [];
    
    // Find all chapters where this character appears
    chapters.forEach(ch => {
      const charNameLower = char.name.toLowerCase();
      const contentLower = ch.content.toLowerCase();
      if (contentLower.includes(charNameLower)) {
        appearances.push(ch.number);
      }
    });

    if (appearances.length >= 2) {
      // Character spans multiple chapters - analyze their arc
      const keyEvents: Array<{ chapterNumber: number; event: string }> = [];
      
      // Extract character mentions and context from each chapter
      appearances.forEach(chNum => {
        const ch = chapters.find(c => c.number === chNum);
        if (ch) {
          const charIndex = ch.content.toLowerCase().indexOf(char.name.toLowerCase());
          if (charIndex >= 0) {
            const context = ch.content.substring(
              Math.max(0, charIndex - 100),
              Math.min(ch.content.length, charIndex + 200)
            );
            keyEvents.push({
              chapterNumber: chNum,
              event: context.substring(0, 150).trim() + '...',
            });
          }
        }
      });

      arcs.set(char.id, {
        characterId: char.id,
        characterName: char.name,
        firstChapter: Math.min(...appearances),
        lastChapter: Math.max(...appearances),
        arcDescription: `${char.name} appears across chapters ${Math.min(...appearances)}-${Math.max(...appearances)}`,
        keyEvents,
      });
    }
  });

  return Array.from(arcs.values());
}

/**
 * Analyzes plot thread progression across chapter boundaries
 */
function analyzeThreadProgression(
  state: NovelState,
  chapters: Chapter[]
): ThreadProgression[] {
  const progressions: ThreadProgression[] = [];

  // Use story threads from state if available
  if (state.storyThreads) {
    state.storyThreads
      .filter(t => t.status === 'active' || t.status === 'paused')
      .forEach(thread => {
        const activeChapters: number[] = [];
        let lastDevelopment: { chapterNumber: number; development: string } | undefined;

        // Find chapters where this thread is mentioned
        chapters.forEach(ch => {
          const threadText = (thread.title + ' ' + (thread.description || '')).toLowerCase();
          const chContent = ch.content.toLowerCase();
          
          // Simple keyword matching (can be enhanced)
          if (threadText.split(' ').some(word => 
            word.length > 3 && chContent.includes(word)
          )) {
            activeChapters.push(ch.number);
            lastDevelopment = {
              chapterNumber: ch.number,
              development: `Thread mentioned in Chapter ${ch.number}`,
            };
          }
        });

        if (activeChapters.length >= 2) {
          // Determine progression status
          const recentAppearances = activeChapters.slice(-3);
          const status: 'advancing' | 'stagnant' | 'resolving' = 
            recentAppearances.length >= 2 ? 'advancing' :
            activeChapters.length > 3 ? 'resolving' :
            'stagnant';

          progressions.push({
            threadId: thread.id,
            threadDescription: thread.title || thread.description || 'Unknown thread',
            activeChapters,
            status,
            lastDevelopment,
          });
        }
      });
  }

  return progressions;
}

/**
 * Analyzes emotional arc and tension curve across recent chapters
 */
function analyzeEmotionalArc(chapters: Chapter[]): EmotionalArc {
  if (chapters.length === 0) {
    return {
      intensityByChapter: [],
      trend: 'plateau',
      recommendedTone: 'neutral',
      tensionCurve: {
        currentLevel: 0,
        peakChapter: null,
        recommendedDirection: 'build',
      },
    };
  }

  // Estimate emotional intensity based on chapter content (simple heuristic)
  const intensityByChapter = chapters.map(ch => {
    const content = ch.content.toLowerCase();
    
    // Count intensity indicators
    const highIntensityWords = ['fury', 'rage', 'terror', 'despair', 'triumph', 'desperate', 'frantic', 'overwhelming'];
    const mediumIntensityWords = ['worried', 'excited', 'angry', 'sad', 'happy', 'nervous', 'relieved'];
    const lowIntensityWords = ['calm', 'peaceful', 'relaxed', 'content', 'satisfied'];
    
    const highCount = highIntensityWords.filter(word => content.includes(word)).length;
    const mediumCount = mediumIntensityWords.filter(word => content.includes(word)).length;
    const lowCount = lowIntensityWords.filter(word => content.includes(word)).length;
    
    // Calculate intensity score (0-5 scale)
    const intensity = Math.min(5, 
      (highCount * 3 + mediumCount * 1.5 - lowCount * 1) / (ch.content.split(/\s+/).length / 500) + 2
    );
    
    return {
      chapterNumber: ch.number,
      intensity: Math.max(0, Math.min(5, Math.round(intensity * 10) / 10)),
    };
  });

  // Determine trend
  let trend: 'rising' | 'plateau' | 'falling' = 'plateau';
  if (chapters.length >= 3) {
    const firstHalf = intensityByChapter.slice(0, Math.ceil(chapters.length / 2));
    const secondHalf = intensityByChapter.slice(Math.ceil(chapters.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b.intensity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b.intensity, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 0.3) {
      trend = 'rising';
    } else if (secondAvg < firstAvg - 0.3) {
      trend = 'falling';
    }
  }

  // Find peak chapter
  const peakChapter = intensityByChapter.reduce((max, curr) => 
    curr.intensity > max.intensity ? curr : max
  );
  
  const currentLevel = intensityByChapter[intensityByChapter.length - 1]?.intensity || 0;
  
  // Determine recommended direction
  let recommendedDirection: 'build' | 'maintain' | 'release' = 'build';
  if (currentLevel >= 4.5) {
    recommendedDirection = 'release';
  } else if (currentLevel >= 3) {
    recommendedDirection = 'maintain';
  }

  // Determine recommended tone
  let recommendedTone = 'neutral';
  if (currentLevel >= 4) {
    recommendedTone = trend === 'rising' ? 'climactic' : 'intense';
  } else if (currentLevel >= 2.5) {
    recommendedTone = 'moderate';
  } else {
    recommendedTone = trend === 'rising' ? 'building' : 'calm';
  }

  return {
    intensityByChapter,
    trend,
    recommendedTone,
    tensionCurve: {
      currentLevel,
      peakChapter: peakChapter.chapterNumber,
      recommendedDirection,
    },
  };
}

/**
 * Generates transition guidance based on analysis
 */
function generateTransitionGuidance(
  recentChapters: Chapter[],
  pacingAnalysis: PacingAnalysis,
  spanningCharacterArcs: CharacterArcSpan[],
  threadProgression: ThreadProgression[],
  emotionalArc: EmotionalArc
): string {
  const guidance: string[] = [];
  
  const lastChapter = recentChapters[recentChapters.length - 1];
  
  guidance.push(`Continue from Chapter ${lastChapter.number}: "${lastChapter.title}"`);
  guidance.push('');
  
  // Pacing guidance
  if (pacingAnalysis.recommendations.length > 0) {
    guidance.push('Pacing Guidance:');
    pacingAnalysis.recommendations.forEach(rec => {
      guidance.push(`  - ${rec}`);
    });
    guidance.push('');
  }
  
  // Character arc guidance
  if (spanningCharacterArcs.length > 0) {
    guidance.push('Character Arc Continuity:');
    spanningCharacterArcs.slice(0, 5).forEach(arc => {
      if (arc.lastChapter === lastChapter.number) {
        guidance.push(`  - ${arc.characterName} was active in recent chapters. Continue their development naturally.`);
      }
    });
    guidance.push('');
  }
  
  // Thread progression guidance
  if (threadProgression.length > 0) {
    guidance.push('Plot Thread Continuity:');
    threadProgression
      .filter(t => t.activeChapters.includes(lastChapter.number))
      .slice(0, 3)
      .forEach(thread => {
        guidance.push(`  - "${thread.threadDescription}" is advancing. Continue this thread.`);
      });
    guidance.push('');
  }
  
  // Emotional arc guidance
  guidance.push('Emotional Tone:');
  guidance.push(`  - Current emotional intensity: ${emotionalArc.tensionCurve.currentLevel}/5`);
  guidance.push(`  - Trend: ${emotionalArc.trend}`);
  guidance.push(`  - Recommended tone: ${emotionalArc.recommendedTone}`);
  guidance.push(`  - Recommended direction: ${emotionalArc.tensionCurve.recommendedDirection} tension`);
  
  return guidance.join('\n');
}
