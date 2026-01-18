import { NovelState, Chapter, Character, Arc } from '../../types';

/**
 * Story State Tracker
 * Tracks current story state including character locations, active plot threads,
 * and unresolved questions to ensure smooth continuity between chapters
 */

export interface CharacterState {
  characterId: string;
  characterName: string;
  currentLocation?: string;
  emotionalState?: string;
  activeGoals?: string[];
  recentActions?: string[];
  currentSituation?: string;
}

export interface PlotThread {
  id: string;
  description: string;
  introducedInChapter?: number;
  status: 'active' | 'resolved' | 'pending';
  relatedArcId?: string;
  priority?: 'high' | 'medium' | 'low'; // Priority for resolution enforcement
  threadType?: 'meeting' | 'commitment' | 'pursuit' | 'question' | 'conflict' | 'checklist' | 'character_arc' | 'antagonist';
}

export interface StoryStateSummary {
  characterStates: CharacterState[];
  activePlotThreads: PlotThread[];
  currentLocations: string[];
  temporalContext: string;
  unresolvedQuestions: string[];
}

/**
 * Extracts character states from recent chapters
 * Analyzes where characters are, what they're doing, and their current situation
 */
export function extractCharacterStates(
  chapters: Chapter[],
  characters: Character[]
): CharacterState[] {
  if (chapters.length === 0 || characters.length === 0) {
    return [];
  }

  // Focus on the most recent 3-5 chapters for current state
  const recentChapters = chapters.slice(-5);
  const allContent = recentChapters.map(c => c.content + ' ' + c.summary).join(' ').toLowerCase();

  return characters.map(char => {
    const charNameLower = char.name.toLowerCase();
    
    // Find chapters where this character appears
    const characterChapters = recentChapters.filter(ch => {
      const content = (ch.content + ' ' + ch.summary).toLowerCase();
      return content.includes(charNameLower);
    });

    if (characterChapters.length === 0) {
      return {
        characterId: char.id,
        characterName: char.name,
      };
    }

    // Extract location mentions (look for location indicators)
    const locationKeywords = ['in', 'at', 'within', 'inside', 'outside', 'near', 'beside', 'realm', 'sect', 'palace', 'temple', 'forest', 'mountain', 'city', 'village'];
    const locationMatches: string[] = [];
    characterChapters.forEach(ch => {
      const sentences = ch.content.split(/[.!?]+/);
      sentences.forEach(sentence => {
        if (sentence.toLowerCase().includes(charNameLower)) {
          // Look for location patterns after character name
          const words = sentence.split(/\s+/);
          const charIndex = words.findIndex(w => w.toLowerCase().includes(charNameLower));
          if (charIndex >= 0 && charIndex < words.length - 2) {
            const followingWords = words.slice(charIndex + 1, charIndex + 5);
            const locationPhrase = followingWords.join(' ');
            if (locationKeywords.some(kw => locationPhrase.toLowerCase().includes(kw))) {
              // Extract potential location (next 3-5 words after location keyword)
              const locationStart = locationPhrase.toLowerCase().indexOf(locationKeywords.find(kw => locationPhrase.toLowerCase().includes(kw)) || '');
              if (locationStart >= 0) {
                const locationText = locationPhrase.substring(locationStart).split(/\s+/).slice(0, 4).join(' ');
                if (locationText.length > 3 && !locationMatches.includes(locationText)) {
                  locationMatches.push(locationText);
                }
              }
            }
          }
        }
      });
    });

    // Extract emotional state indicators
    const emotionalKeywords = {
      angry: ['angry', 'furious', 'rage', 'enraged', 'fuming'],
      happy: ['happy', 'joy', 'pleased', 'delighted', 'elated'],
      sad: ['sad', 'depressed', 'melancholy', 'grief', 'sorrow'],
      anxious: ['anxious', 'worried', 'nervous', 'fearful', 'concerned'],
      determined: ['determined', 'resolved', 'focused', 'committed'],
      confused: ['confused', 'uncertain', 'puzzled', 'bewildered'],
    };

    let emotionalState: string | undefined;
    const charContent = characterChapters.map(c => c.content + ' ' + c.summary).join(' ').toLowerCase();
    for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
      if (keywords.some(kw => charContent.includes(kw))) {
        emotionalState = emotion;
        break;
      }
    }

    // Extract recent actions (from most recent chapter mentioning character)
    const mostRecentChapter = characterChapters[characterChapters.length - 1];
    const recentActions: string[] = [];
    if (mostRecentChapter) {
      const sentences = mostRecentChapter.content.split(/[.!?]+/);
      const charSentences = sentences.filter(s => s.toLowerCase().includes(charNameLower));
      charSentences.slice(-3).forEach(sentence => {
        // Extract action verbs
        const actionVerbs = ['went', 'did', 'said', 'thought', 'decided', 'moved', 'fought', 'trained', 'cultivated', 'met', 'left', 'arrived', 'discovered'];
        const words = sentence.split(/\s+/);
        actionVerbs.forEach(verb => {
          const verbIndex = words.findIndex(w => w.toLowerCase() === verb);
          if (verbIndex >= 0 && verbIndex < words.length - 1) {
            const actionPhrase = words.slice(Math.max(0, verbIndex - 2), verbIndex + 4).join(' ');
            if (actionPhrase.length > 10 && actionPhrase.length < 100) {
              recentActions.push(actionPhrase.trim());
            }
          }
        });
      });
    }

    // Extract current situation from summary or last paragraph
    let currentSituation: string | undefined;
    if (mostRecentChapter) {
      const lastParagraph = mostRecentChapter.content.split(/\n\n/).pop() || '';
      if (lastParagraph.toLowerCase().includes(charNameLower)) {
        currentSituation = lastParagraph.substring(0, 200).trim();
      } else if (mostRecentChapter.summary) {
        currentSituation = mostRecentChapter.summary.substring(0, 200).trim();
      }
    }

    // Extract active goals (from character notes or recent mentions of goals/plans)
    const activeGoals: string[] = [];
    if (char.notes) {
      const goalKeywords = ['goal', 'plan', 'need', 'must', 'will', 'intend', 'want'];
      const noteSentences = char.notes.split(/[.!?]+/);
      noteSentences.forEach(sentence => {
        if (goalKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
          activeGoals.push(sentence.trim().substring(0, 150));
        }
      });
    }

    return {
      characterId: char.id,
      characterName: char.name,
      currentLocation: locationMatches[0] || undefined,
      emotionalState,
      activeGoals: activeGoals.length > 0 ? activeGoals.slice(0, 3) : undefined,
      recentActions: recentActions.length > 0 ? recentActions.slice(0, 3) : undefined,
      currentSituation,
    };
  });
}

/**
 * Extracts active plot threads from chapters and arcs
 * Identifies unresolved questions, conflicts, pending consequences, promises, and character pursuits
 * Enhanced to detect: promised meetings, character commitments, character pursuits, ongoing arcs
 */
export function extractActivePlotThreads(
  chapters: Chapter[],
  arcs: Arc[],
  characters?: Character[]
): PlotThread[] {
  const threads: PlotThread[] = [];

  // Extract threads from active arcs
  const activeArcs = arcs.filter(a => a.status === 'active');
  activeArcs.forEach(arc => {
    threads.push({
      id: `arc-${arc.id}`,
      description: arc.description,
      introducedInChapter: arc.startedAtChapter,
      status: 'active',
      relatedArcId: arc.id,
      priority: 'medium',
      threadType: 'conflict',
    });

    // Extract unresolved checklist items as threads
    if (arc.checklist) {
      arc.checklist.filter(item => !item.completed).forEach(item => {
        threads.push({
          id: `checklist-${item.id}`,
          description: item.label,
          introducedInChapter: item.sourceChapterNumber,
          status: 'pending',
          relatedArcId: arc.id,
          priority: 'high', // Checklist items are high priority
          threadType: 'checklist',
        });
      });
    }
  });

  // Extract unresolved questions from recent chapters (increased window from 5 to 10)
  const recentChapters = chapters.slice(-10);
  recentChapters.forEach((chapter, index) => {
    const content = chapter.content.toLowerCase();
    const fullContent = chapter.content;
    
    // Look for question patterns
    const questionPatterns = [
      /what (will|should|might|could) (happen|occur|take place)/gi,
      /how (will|should|can|might) (.*?)(\?|\.)/gi,
      /why (did|does|will|should)/gi,
      /(who|where|when) (will|should|might|could)/gi,
    ];

    questionPatterns.forEach(pattern => {
      const matches = fullContent.match(pattern);
      if (matches) {
        matches.slice(0, 2).forEach(match => {
          threads.push({
            id: `question-${chapter.id}-${threads.length}`,
            description: match.trim(),
            introducedInChapter: chapter.number,
            status: 'active',
            priority: 'medium',
            threadType: 'question',
          });
        });
      }
    });

    // Look for unresolved conflicts or tensions
    if (chapter.logicAudit) {
      const audit = chapter.logicAudit;
      if (audit.causalityType === 'But' && audit.resultingValue) {
        // A "But" often introduces an unresolved conflict
        const conflictKeywords = ['however', 'but', 'yet', 'still', 'unresolved', 'pending', 'uncertain'];
        if (conflictKeywords.some(kw => audit.resultingValue.toLowerCase().includes(kw))) {
          threads.push({
            id: `conflict-${chapter.id}`,
            description: audit.resultingValue,
            introducedInChapter: chapter.number,
            status: 'active',
            priority: 'medium',
            threadType: 'conflict',
          });
        }
      }
    }

    // NEW: Detect promised meetings and arrangements
    const meetingPatterns = [
      /\b(we'll|we will|they'll|they will|he'll|he will|she'll|she will|i'll|i will)\s+(meet|gather|come together|reconvene|assemble|convene)/gi,
      /\b(set up|arranged|scheduled|planned|agreed to)\s+(a |an |the )?(meeting|gathering|appointment|rendezvous|conference)/gi,
      /\b(meet|meeting|gathering|appointment)\s+(at|in|with|tomorrow|later|soon|next)/gi,
      /\b(promised|agreed|vowed|swore|committed)\s+(to\s+)?(meet|gather|see|visit)/gi,
    ];

    meetingPatterns.forEach(pattern => {
      const matches = fullContent.match(pattern);
      if (matches) {
        matches.slice(0, 2).forEach(match => {
          // Extract context around the match (previous and next 30 chars)
          const matchIndex = fullContent.toLowerCase().indexOf(match.toLowerCase());
          if (matchIndex >= 0) {
            const contextStart = Math.max(0, matchIndex - 30);
            const contextEnd = Math.min(fullContent.length, matchIndex + match.length + 30);
            const context = fullContent.substring(contextStart, contextEnd).trim();
            
            threads.push({
              id: `meeting-${chapter.id}-${threads.length}`,
              description: `Meeting/arrangement: ${context.substring(0, 150)}`,
              introducedInChapter: chapter.number,
              status: 'pending',
              priority: 'high', // Promised meetings are high priority
              threadType: 'meeting',
            });
          }
        });
      }
    });

    // NEW: Detect character commitments and promises
    const commitmentPatterns = [
      /\b(will|shall|going to|planning to|intend to|promised to|agreed to|vowed to|swore to)\s+(investigate|find out|discover|learn|explore|check|examine|look into|figure out|determine)/gi,
      /\b(promised|agreed|vowed|committed|swore)\s+(to\s+)?(investigate|find|discover|help|assist|support|protect|defend|do)/gi,
      /\b(commitment|promise|vow|oath|pledge)\s+(to\s+)?(investigate|find|discover|help|do)/gi,
    ];

    commitmentPatterns.forEach(pattern => {
      const matches = fullContent.match(pattern);
      if (matches) {
        matches.slice(0, 2).forEach(match => {
          const matchIndex = fullContent.toLowerCase().indexOf(match.toLowerCase());
          if (matchIndex >= 0) {
            const contextStart = Math.max(0, matchIndex - 40);
            const contextEnd = Math.min(fullContent.length, matchIndex + match.length + 40);
            const context = fullContent.substring(contextStart, contextEnd).trim();
            
            threads.push({
              id: `commitment-${chapter.id}-${threads.length}`,
              description: `Character commitment: ${context.substring(0, 150)}`,
              introducedInChapter: chapter.number,
              status: 'pending',
              priority: 'high', // Character commitments are high priority
              threadType: 'commitment',
            });
          }
        });
      }
    });

    // NEW: Detect character pursuits and tracking
    const pursuitPatterns = [
      /\b(following|following around|trying to get|trying to find|trying to discover|attempting to|seeking to|pursuing|tracking|hunting|stalking)/gi,
      /\b(wanted to see|needs to see|must see|should meet|needs to meet|must meet)/gi,
      /\b(after|pursuing|chasing|tracking|investigating)\s+(him|her|them|the\s+main\s+character|the\s+protagonist)/gi,
    ];

    pursuitPatterns.forEach(pattern => {
      const matches = fullContent.match(pattern);
      if (matches) {
        matches.slice(0, 2).forEach(match => {
          const matchIndex = fullContent.toLowerCase().indexOf(match.toLowerCase());
          if (matchIndex >= 0) {
            const contextStart = Math.max(0, matchIndex - 40);
            const contextEnd = Math.min(fullContent.length, matchIndex + match.length + 40);
            const context = fullContent.substring(contextStart, contextEnd).trim();
            
            threads.push({
              id: `pursuit-${chapter.id}-${threads.length}`,
              description: `Character pursuit/tracking: ${context.substring(0, 150)}`,
              introducedInChapter: chapter.number,
              status: 'active',
              priority: 'high', // Character pursuits are high priority
              threadType: 'pursuit',
            });
          }
        });
      }
    });
  });

  // NEW: Detect ongoing character arcs (characters who appeared 2-5 chapters ago but not recently)
  if (characters && chapters.length >= 3) {
    const lastChapterNumber = chapters[chapters.length - 1]?.number || 0;
    characters.forEach(char => {
      const charNameLower = char.name.toLowerCase();
      
      // Find chapters where character appeared
      const appearanceChapters: number[] = [];
      chapters.forEach(ch => {
        const chContent = (ch.content + ' ' + ch.summary).toLowerCase();
        if (chContent.includes(charNameLower)) {
          appearanceChapters.push(ch.number);
        }
      });

      if (appearanceChapters.length > 0) {
        const lastAppearance = Math.max(...appearanceChapters);
        const chaptersSinceAppearance = lastChapterNumber - lastAppearance;
        
        // Character was active 2-5 chapters ago but hasn't appeared since
        if (chaptersSinceAppearance >= 2 && chaptersSinceAppearance <= 5) {
          // Check if character was mentioned as active or pursuing something
          const recentMentionChapters = chapters.slice(-6);
          const wasActiveRecently = recentMentionChapters.some(ch => {
            const chContent = (ch.content + ' ' + ch.summary).toLowerCase();
            const activeKeywords = ['active', 'pursuing', 'following', 'investigating', 'trying', 'wanted', 'needed'];
            return chContent.includes(charNameLower) && 
                   activeKeywords.some(kw => {
                     const charIndex = chContent.indexOf(charNameLower);
                     const keywordIndex = chContent.indexOf(kw);
                     return keywordIndex >= 0 && Math.abs(charIndex - keywordIndex) < 100;
                   });
          });

          if (wasActiveRecently) {
            threads.push({
              id: `character-arc-${char.id}`,
              description: `Character "${char.name}" was active ${chaptersSinceAppearance} chapter(s) ago but hasn't appeared since. Follow up on their storyline.`,
              introducedInChapter: lastAppearance,
              status: 'active',
              priority: 'medium',
              threadType: 'character_arc',
            });
          }
        }
      }
    });
  }

  // Remove duplicates and return (prioritized by priority: high > medium > low)
  const uniqueThreads = new Map<string, PlotThread>();
  threads.forEach(thread => {
    const existing = uniqueThreads.get(thread.id);
    if (!existing || (thread.priority === 'high' && existing.priority !== 'high')) {
      uniqueThreads.set(thread.id, thread);
    }
  });

  // Sort by priority (high first) and limit to 15 most relevant (increased from 10)
  const sortedThreads = Array.from(uniqueThreads.values()).sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority || 'medium'];
    const bPriority = priorityOrder[b.priority || 'medium'];
    if (aPriority !== bPriority) return bPriority - aPriority;
    return (a.introducedInChapter || 0) - (b.introducedInChapter || 0); // More recent first within same priority
  });

  return sortedThreads.slice(0, 15);
}

/**
 * Builds a comprehensive story state summary
 * Combines character states, plot threads, and narrative context
 */
export function buildStoryStateSummary(state: NovelState): StoryStateSummary {
  const recentChapters = state.chapters.slice(-5);
  
  const characterStates = extractCharacterStates(recentChapters, state.characterCodex);
  const activePlotThreads = extractActivePlotThreads(state.chapters, state.plotLedger, state.characterCodex);

  // Extract current locations
  const currentLocations: string[] = [];
  const locationKeywords = ['realm', 'sect', 'palace', 'temple', 'forest', 'mountain', 'city', 'village', 'territory'];
  recentChapters.forEach(chapter => {
    const content = chapter.content.toLowerCase();
    locationKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\s+\\w+`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        matches.forEach(match => {
          if (!currentLocations.includes(match)) {
            currentLocations.push(match);
          }
        });
      }
    });
  });

  // Determine temporal context
  let temporalContext = 'Recent events';
  if (recentChapters.length > 0) {
    const lastChapter = recentChapters[recentChapters.length - 1];
    if (lastChapter.logicAudit) {
      const timeKeywords = {
        immediate: ['immediately', 'now', 'at once', 'instantly'],
        soon: ['soon', 'shortly', 'moment', 'brief'],
        later: ['later', 'after', 'then', 'subsequently'],
      };
      
      const auditText = (lastChapter.logicAudit.resultingValue + ' ' + lastChapter.summary).toLowerCase();
      if (timeKeywords.immediate.some(kw => auditText.includes(kw))) {
        temporalContext = 'Immediate aftermath';
      } else if (timeKeywords.soon.some(kw => auditText.includes(kw))) {
        temporalContext = 'Shortly after recent events';
      } else if (timeKeywords.later.some(kw => auditText.includes(kw))) {
        temporalContext = 'Some time after recent events';
      }
    }
  }

  // Extract unresolved questions
  const unresolvedQuestions: string[] = [];
  recentChapters.forEach(chapter => {
    const content = chapter.content;
    // Look for explicit questions
    const questionMatches = content.match(/[^.!?]*\?/g);
    if (questionMatches) {
      questionMatches.slice(0, 2).forEach(q => {
        if (q.trim().length > 10 && q.trim().length < 150) {
          unresolvedQuestions.push(q.trim());
        }
      });
    }
  });

  return {
    characterStates,
    activePlotThreads,
    currentLocations: currentLocations.slice(0, 5), // Limit to 5 locations
    temporalContext,
    unresolvedQuestions: unresolvedQuestions.slice(0, 5), // Limit to 5 questions
  };
}

/**
 * Formats story state summary as a readable string for prompts
 */
export function formatStoryStateSummary(summary: StoryStateSummary): string {
  const sections: string[] = [];

  // Character states
  if (summary.characterStates.length > 0) {
    sections.push('CHARACTER STATES:');
    summary.characterStates.slice(0, 5).forEach(state => {
      const parts: string[] = [state.characterName];
      if (state.currentLocation) parts.push(`Location: ${state.currentLocation}`);
      if (state.emotionalState) parts.push(`Emotional State: ${state.emotionalState}`);
      if (state.currentSituation) parts.push(`Situation: ${state.currentSituation.substring(0, 100)}`);
      sections.push(`- ${parts.join(' | ')}`);
    });
  }

  // Active plot threads
  if (summary.activePlotThreads.length > 0) {
    sections.push('\nACTIVE PLOT THREADS:');
    summary.activePlotThreads.slice(0, 5).forEach(thread => {
      sections.push(`- ${thread.description.substring(0, 150)}${thread.introducedInChapter ? ` (Introduced Ch ${thread.introducedInChapter})` : ''}`);
    });
  }

  // Current locations
  if (summary.currentLocations.length > 0) {
    sections.push(`\nCURRENT LOCATIONS: ${summary.currentLocations.join(', ')}`);
  }

  // Temporal context
  sections.push(`\nTEMPORAL CONTEXT: ${summary.temporalContext}`);

  // Unresolved questions
  if (summary.unresolvedQuestions.length > 0) {
    sections.push('\nUNRESOLVED QUESTIONS:');
    summary.unresolvedQuestions.forEach(q => {
      sections.push(`- ${q}`);
    });
  }

  return sections.join('\n');
}
