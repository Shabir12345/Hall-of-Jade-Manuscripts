import { NovelState, PromptContext, Realm, Territory, Character, Chapter, Arc } from '../../types';
import { analyzeNovelContext } from '../contextAnalysis';
import { getStyleProfile } from './styleAnalyzer';
import { buildStoryStateSummary, formatStoryStateSummary } from './storyStateTracker';
import { generateAntagonistContext, formatAntagonistContextForPrompt } from '../antagonistAnalyzer';
import { analyzeForeshadowing, analyzeEmotionalPayoffs, analyzePacing, analyzeSymbolism, analyzeAllArcContexts, analyzeCharacterArcJourneys, analyzeArcProgression } from './arcContextAnalyzer';

/**
 * Context Gatherer
 * Comprehensively extracts all relevant context for prompt construction
 */

/**
 * Extracts the last N words from a chapter for smooth transitions
 */
export function extractChapterEnding(chapter: Chapter, wordCount: number = 300): string {
  if (!chapter.content || chapter.content.trim().length === 0) {
    return '';
  }

  const words = chapter.content.trim().split(/\s+/);
  if (words.length <= wordCount) {
    return chapter.content.trim();
  }

  // Get the last N words
  const endingWords = words.slice(-wordCount);
  return endingWords.join(' ');
}

/**
 * Extracts character states specifically from the end of a chapter
 * Enhanced analysis of the last portion to determine character locations, emotions, and situations
 */
function extractEndOfChapterCharacterStates(
  chapter: Chapter,
  characters: Character[],
  wordCount: number = 600
): Array<{ characterName: string; location?: string; emotionalState?: string; situation?: string; physicalState?: string }> {
  if (!chapter.content || characters.length === 0) {
    return [];
  }

  // Extract the last portion of the chapter
  const ending = extractChapterEnding(chapter, wordCount);
  const endingLower = ending.toLowerCase();
  const endingSentences = ending.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Build character name variations (full name, first name, common nicknames)
  const characterVariations = new Map<string, string[]>();
  characters.forEach(char => {
    const variations: string[] = [char.name.toLowerCase()];
    const nameParts = char.name.toLowerCase().split(/\s+/);
    if (nameParts.length > 1) {
      variations.push(nameParts[0]); // First name
      variations.push(nameParts[nameParts.length - 1]); // Last name
    }
    characterVariations.set(char.name, variations);
  });

  return characters
    .filter(char => {
      // Check if character or any variation is mentioned in the ending
      const variations = characterVariations.get(char.name) || [];
      return variations.some(variant => endingLower.includes(variant));
    })
    .map(char => {
      const charNameLower = char.name.toLowerCase();
      const variations = characterVariations.get(char.name) || [charNameLower];
      
      // Find sentences mentioning the character (check all variations)
      const relevantSentences = endingSentences.filter(s => {
        const sLower = s.toLowerCase();
        return variations.some(variant => sLower.includes(variant));
      });
      
      if (relevantSentences.length === 0) {
        return {
          characterName: char.name,
        };
      }

      // Focus on the most recent sentences mentioning the character (last 3-5)
      const recentSentences = relevantSentences.slice(-5);
      const recentText = recentSentences.join(' ').toLowerCase();
      
      // Enhanced location extraction - check for multiple patterns
      const locationKeywords = [
        'in the', 'at the', 'within', 'inside', 'outside', 'near', 'beside', 
        'realm', 'sect', 'palace', 'temple', 'forest', 'mountain', 'city', 'village', 
        'room', 'chamber', 'hall', 'courtyard', 'garden', 'library', 'training ground',
        'entrance', 'exit', 'corridor', 'chamber', 'tower', 'peak'
      ];
      
      let location: string | undefined;
      // Check each sentence for location patterns
      for (const sentence of recentSentences.slice(-3)) {
        const words = sentence.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
          const wordLower = words[i].toLowerCase();
          // Check if character is mentioned near this word
          const charMentioned = variations.some(v => {
            const charIndex = sentence.toLowerCase().indexOf(v);
            return charIndex >= 0 && Math.abs(charIndex - sentence.toLowerCase().indexOf(wordLower)) < 50;
          });
          
          if (charMentioned) {
            // Look for location keywords in surrounding context
            const contextStart = Math.max(0, i - 3);
            const contextEnd = Math.min(words.length, i + 8);
            const context = words.slice(contextStart, contextEnd).join(' ').toLowerCase();
            
            for (const keyword of locationKeywords) {
              if (context.includes(keyword)) {
                const keywordIndex = context.indexOf(keyword);
                const afterKeyword = context.substring(keywordIndex + keyword.length).trim();
                // Extract next 2-5 words after location keyword
                const locationWords = afterKeyword.split(/\s+/).slice(0, 5);
                if (locationWords.length > 0) {
                  location = locationWords.join(' ').trim();
                  // Clean up common trailing words
                  location = location.replace(/\s+(where|that|which|when|,).*$/i, '');
                  if (location.length > 3 && location.length < 50) {
                    break;
                  }
                }
              }
            }
            if (location) break;
          }
        }
        if (location) break;
      }

      // Enhanced emotional state extraction with more keywords and context
      const emotionalKeywords: Record<string, string[]> = {
        angry: ['angry', 'furious', 'rage', 'enraged', 'fuming', 'scowling', 'glared', 'snarled', 'seethed'],
        happy: ['happy', 'joy', 'pleased', 'delighted', 'elated', 'smiling', 'grinning', 'laughed', 'cheerful'],
        sad: ['sad', 'depressed', 'melancholy', 'grief', 'sorrow', 'tears', 'wept', 'mournful', 'dejected'],
        anxious: ['anxious', 'worried', 'nervous', 'fearful', 'concerned', 'trembling', 'apprehensive', 'uneasy'],
        determined: ['determined', 'resolved', 'focused', 'committed', 'clenched', 'firm', 'steadfast', 'resolute'],
        confused: ['confused', 'uncertain', 'puzzled', 'bewildered', 'perplexed', 'disoriented'],
        calm: ['calm', 'peaceful', 'serene', 'composed', 'tranquil', 'relaxed'],
        excited: ['excited', 'eager', 'enthusiastic', 'thrilled', 'energized'],
      };

      let emotionalState: string | undefined;
      for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
        if (keywords.some(kw => recentText.includes(kw))) {
          emotionalState = emotion;
          break;
        }
      }

      // Extract physical state indicators
      const physicalKeywords: Record<string, string[]> = {
        injured: ['injured', 'wounded', 'hurt', 'bleeding', 'broken', 'limping'],
        exhausted: ['exhausted', 'tired', 'weary', 'fatigued', 'drained'],
        healthy: ['healthy', 'unharmed', 'unscathed', 'fine'],
        standing: ['standing', 'stood', 'upright'],
        sitting: ['sitting', 'sat', 'seated'],
        moving: ['walking', 'running', 'moving', 'hurried', 'rushed'],
      };

      let physicalState: string | undefined;
      for (const [state, keywords] of Object.entries(physicalKeywords)) {
        if (keywords.some(kw => recentText.includes(kw))) {
          physicalState = state;
          break;
        }
      }

      // Extract situation from most recent sentence mentioning character
      const lastSentence = recentSentences[recentSentences.length - 1];
      let situation: string | undefined;
      if (lastSentence) {
        // Try to extract a more meaningful situation description
        situation = lastSentence.trim();
        // If it's too short, include the sentence before it for context
        if (situation.length < 50 && recentSentences.length > 1) {
          const secondLast = recentSentences[recentSentences.length - 2];
          situation = `${secondLast.trim()}. ${situation}`;
        }
        situation = situation.substring(0, 250).trim();
      }

      return {
        characterName: char.name,
        location,
        emotionalState,
        physicalState,
        situation,
      };
    })
    .filter(charState => charState.characterName); // Filter out any empty entries
}

/**
 * Extracts the immediate situation at the end of a chapter
 * Enhanced extraction of scene context: what was happening, who was present, setting
 */
function extractEndOfChapterSituation(chapter: Chapter, wordCount: number = 600): string {
  if (!chapter.content) {
    return '';
  }

  const ending = extractChapterEnding(chapter, wordCount);
  
  // Extract the last paragraph for better context
  const paragraphs = chapter.content.split(/\n\n/).filter(p => p.trim().length > 0);
  const lastParagraph = paragraphs[paragraphs.length - 1] || ending;
  
  // Get last 3-4 sentences for better context
  const sentences = lastParagraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lastSentences = sentences.slice(-4);
  
  // Build situation description with context
  let situation = lastSentences.join('. ').trim();
  
  // Try to identify scene elements
  const sceneIndicators: string[] = [];
  
  // Check for action verbs (what's happening)
  const actionPatterns = /\b(was|were|is|are)\s+(doing|saying|thinking|moving|standing|sitting|looking|waiting|fighting|training|cultivating|discussing|planning|preparing|approaching|leaving|arriving)/gi;
  const actionMatches = situation.match(actionPatterns);
  if (actionMatches) {
    sceneIndicators.push(`Actions: ${actionMatches.slice(0, 2).join(', ')}`);
  }
  
  // Check for dialogue indicators
  const dialoguePatterns = /[""''`]([^""''`]{10,80})[""''`]/g;
  const dialogueMatches = situation.match(dialoguePatterns);
  if (dialogueMatches && dialogueMatches.length > 0) {
    sceneIndicators.push(`Recent dialogue present`);
  }
  
  // Check for time of day/weather/setting
  const settingPatterns = /\b(morning|afternoon|evening|night|dawn|dusk|sunrise|sunset|day|night|bright|dark|wind|rain|snow|cold|warm|quiet|noisy|crowded|empty)\b/gi;
  const settingMatches = situation.match(settingPatterns);
  if (settingMatches) {
    sceneIndicators.push(`Setting context: ${settingMatches.slice(0, 2).join(', ')}`);
  }
  
  // If we have scene indicators, prepend them for clarity
  if (sceneIndicators.length > 0 && situation.length < 300) {
    situation = `${sceneIndicators.join(' | ')}. ${situation}`;
  }
  
  return situation.trim() || ending.split(/[.!?]+/).slice(-2).join('. ').trim();
}

/**
 * Builds a continuity bridge between chapters
 * Creates explicit instructions for how the new chapter should connect to the previous one
 * Enhanced with character states, scene context, and detailed ending information
 */
export function buildContinuityBridge(
  previousChapter: Chapter | null,
  nextChapterNumber: number,
  state: NovelState
): string {
  if (!previousChapter) {
    return 'This is the first chapter. Establish the world, protagonist, and initial conflict.';
  }

  // Extract 600 words for better context
  const ending = extractChapterEnding(previousChapter, 600);
  const audit = previousChapter.logicAudit;

  // Extract character states from the end of the chapter
  const endCharacterStates = extractEndOfChapterCharacterStates(previousChapter, state.characterCodex, 600);
  
  // Extract immediate situation
  const immediateSituation = extractEndOfChapterSituation(previousChapter, 600);
  
  // Identify scene participants (characters present in the ending)
  const sceneParticipants = endCharacterStates
    .map(c => c.characterName)
    .join(', ') || 'Unclear';

  let bridge = `[CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]
=== THIS IS THE MOST IMPORTANT SECTION - READ FIRST ===

Previous Chapter: Chapter ${previousChapter.number} - "${previousChapter.title}"
Previous Chapter Ending (last ~600 words):
"${ending}"

SCENE PARTICIPANTS AT CHAPTER END:
${sceneParticipants}

`;

  // Add character states if available
  if (endCharacterStates.length > 0) {
    bridge += `CHARACTERS AT CHAPTER END (EXACT STATES - MUST BE PRESERVED):\n`;
    endCharacterStates.forEach(charState => {
      const parts: string[] = [charState.characterName];
      if (charState.location) parts.push(`Location: ${charState.location}`);
      if (charState.emotionalState) parts.push(`Emotional: ${charState.emotionalState}`);
      if (charState.physicalState) parts.push(`Physical: ${charState.physicalState}`);
      if (charState.situation) parts.push(`Situation: ${charState.situation.substring(0, 150)}`);
      bridge += `- ${parts.join(' | ')}\n`;
    });
    bridge += `\nIMPORTANT: The next chapter MUST maintain these exact character states. Characters should be in the same locations, have the same emotional/physical states, and continue from the situations described above.\n\n`;
  }

  // Add immediate situation
  if (immediateSituation) {
    bridge += `IMMEDIATE SITUATION AT CHAPTER END:\n${immediateSituation}\n\n`;
  }

  // Add logic audit if available
  if (audit) {
    bridge += `PREVIOUS CHAPTER LOGIC:\n`;
    bridge += `- Starting Value: ${audit.startingValue}\n`;
    bridge += `- The Friction: ${audit.theFriction}\n`;
    bridge += `- The Choice: ${audit.theChoice}\n`;
    bridge += `- Resulting Value: ${audit.resultingValue}\n`;
    bridge += `- Causality Type: ${audit.causalityType}\n\n`;

    if (audit.causalityType === 'But') {
      bridge += `MANDATORY TRANSITION REQUIREMENT:\n`;
      bridge += `Chapter ${nextChapterNumber} MUST begin in the EXACT moment following Chapter ${previousChapter.number}. `;
      bridge += `The previous chapter ended with a disruption (${audit.theFriction}). `;
      bridge += `Do NOT skip time, change location without explanation, or alter character states. `;
      bridge += `Start with the immediate aftermath - show how characters react, what they decide to do next, `;
      bridge += `or how the situation has changed in the next few seconds/minutes. `;
      bridge += `Do NOT repeat the previous chapter's ending - move forward from it.\n`;
    } else {
      bridge += `MANDATORY TRANSITION REQUIREMENT:\n`;
      bridge += `Chapter ${nextChapterNumber} MUST begin in the EXACT moment following Chapter ${previousChapter.number}. `;
      bridge += `The previous chapter ended with a logical progression (${audit.resultingValue}). `;
      bridge += `Do NOT skip time, change location without explanation, or alter character states. `;
      bridge += `Build on that foundation by acknowledging the new state, then showing the immediate next moment - `;
      bridge += `what happens in the next few seconds/minutes. Use "Therefore" logic to show how the previous chapter's outcome leads to new events. `;
      bridge += `Do NOT repeat what already happened - move forward with the consequences.\n`;
    }
  } else {
    bridge += `MANDATORY TRANSITION REQUIREMENT:\n`;
    bridge += `Chapter ${nextChapterNumber} MUST begin in the EXACT moment following Chapter ${previousChapter.number}. `;
    bridge += `Do NOT skip time, change location without explanation, or alter character states. `;
    bridge += `Continue the narrative flow from where the previous chapter ended. `;
    bridge += `Maintain consistency with the ending scene and move the story forward naturally. `;
    bridge += `Show the immediate next moment - what happens in the next few seconds/minutes. `;
    bridge += `Do NOT repeat the previous chapter's content - build upon it.\n`;
  }

  // Add summary section for quick reference
  bridge += `\n=== CONTINUITY SUMMARY ===\n`;
  bridge += `Next chapter must start with:\n`;
  bridge += `1. Same scene/setting as Chapter ${previousChapter.number} ended\n`;
  bridge += `2. Same characters present (${sceneParticipants})\n`;
  if (endCharacterStates.length > 0) {
    bridge += `3. Same character states:\n`;
    endCharacterStates.forEach(charState => {
      const stateParts: string[] = [];
      if (charState.location) stateParts.push(`@ ${charState.location}`);
      if (charState.emotionalState) stateParts.push(`emotion: ${charState.emotionalState}`);
      if (charState.physicalState) stateParts.push(`physical: ${charState.physicalState}`);
      if (stateParts.length > 0) {
        bridge += `   - ${charState.characterName}: ${stateParts.join(', ')}\n`;
      }
    });
  }
  bridge += `4. Immediate next moment - what happens in the next few seconds/minutes\n`;
  bridge += `5. NO time skip, NO location change without transition\n`;
  bridge += `\nThe chapter should feel like a direct continuation, as if you're turning the page in the same scene.\n`;

  return bridge;
}

/**
 * Gathers complete context for prompt construction
 */
export async function gatherPromptContext(
  state: NovelState,
  options: {
    includeFullHistory?: boolean;
    maxRecentChapters?: number;
    includeStyleProfile?: boolean;
    includeCharacterDevelopment?: boolean;
    includeStoryProgression?: boolean;
    includeArcHistory?: boolean;
  } = {}
): Promise<PromptContext> {
  const {
    includeFullHistory = false,
    maxRecentChapters = 5,
    includeStyleProfile = true,
    includeCharacterDevelopment = true,
    includeStoryProgression = true,
    includeArcHistory = false,
  } = options;

  const currentRealm = state.realms.find(r => r.id === state.currentRealmId) || null;
  const realmTerritories = state.territories.filter(t => t.realmId === state.currentRealmId);
  const realmWorldBible = state.worldBible.filter(e => e.realmId === state.currentRealmId);

  // Get recent chapters (full context) and older chapters (summary)
  const recentChapters = state.chapters.slice(-maxRecentChapters);
  const olderChapters = includeFullHistory 
    ? state.chapters.slice(0, -maxRecentChapters)
    : [];

  // Create older chapters summary
  const olderChaptersSummary = olderChapters.length > 0
    ? olderChapters
        .map(c => `Ch ${c.number}: ${c.summary || c.title}`)
        .join('\n')
    : 'No previous chapters.';

  // Get active and completed arcs
  const activeArc = state.plotLedger.find(a => a.status === 'active') || null;
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');

  // Analyze context if needed
  const analysis = (includeStyleProfile || includeCharacterDevelopment || includeStoryProgression)
    ? analyzeNovelContext(state)
    : null;

  // Build character relationship map
  const relationshipMap = new Map<string, Character['relationships']>();
  state.characterCodex.forEach(char => {
    relationshipMap.set(char.id, char.relationships);
  });

  // Get character development metrics
  const characterDevelopmentMetrics = includeCharacterDevelopment && analysis
    ? analysis.characterDevelopment
    : [];

  // Get story progression metrics
  const progressionMetrics = includeStoryProgression && analysis
    ? analysis.storyProgression
    : {
        chapterDeltas: [],
        tensionCurve: { currentLevel: 'medium' as const, trend: 'stable' as const },
        plotBeats: [],
        arcStructure: [],
      };

  // Get style profile
  const styleProfile = includeStyleProfile
    ? (analysis?.styleProfile || getStyleProfile(state))
    : null;

  // Extract recent patterns (from recent chapter summaries)
  const recentPatterns = recentChapters
    .map(c => c.summary || c.title)
    .filter(p => p.length > 0);

  // Extract previous chapter ending for continuity
  const previousChapter = state.chapters.length > 0 
    ? state.chapters[state.chapters.length - 1] 
    : null;
  const previousChapterEnding = previousChapter 
    ? extractChapterEnding(previousChapter, 300)
    : undefined;

  // Build story state summary
  const storyStateSummaryData = buildStoryStateSummary(state);
  const storyStateSummary = formatStoryStateSummary(storyStateSummaryData);

  // Build continuity bridge (with state for momentum analysis)
  const nextChapterNumber = state.chapters.length + 1;
  const continuityBridge = buildContinuityBridge(previousChapter, nextChapterNumber, state);

  // Extract active plot threads
  const activePlotThreads = storyStateSummaryData.activePlotThreads
    .filter(t => t.status === 'active' || t.status === 'pending')
    .map(t => t.description);

  // Analyze arc context if requested
  let arcContext;
  if (includeArcHistory && completedArcs.length > 0) {
    const arcSummaries = analyzeAllArcContexts(state);
    const characterArcJourneys = analyzeCharacterArcJourneys(state);
    const progressionAnalysis = analyzeArcProgression(state);
    
    arcContext = {
      arcSummaries,
      characterArcJourneys,
      progressionAnalysis,
    };
  }

  // Generate antagonist context
  let antagonistContext;
  try {
    const nextChapterNumber = state.chapters.length + 1;
    const context = await generateAntagonistContext(state.id, nextChapterNumber, activeArc);
    antagonistContext = formatAntagonistContextForPrompt(context);
  } catch (error) {
    // Log error if logger is available (imported dynamically to avoid circular dependencies)
    if (typeof window !== 'undefined') {
      import('../../services/loggingService').then(({ logger }) => {
        logger.warn('Error generating antagonist context', 'contextGatherer', {
          error: error instanceof Error ? error.message : String(error)
        });
      }).catch(() => {
        // Fallback if logger import fails
      });
    }
    antagonistContext = undefined;
  }

  // Generate foreshadowing, emotional payoff, pacing, and symbolism context
  let foreshadowingContext: string | undefined;
  let emotionalPayoffContext: string | undefined;
  let pacingContext: string | undefined;
  let symbolismContext: string | undefined;
  try {
    const foreshadowing = analyzeForeshadowing(state);
    const emotionalPayoffs = analyzeEmotionalPayoffs(state);
    const pacing = analyzePacing(state);
    const symbolism = analyzeSymbolism(state);
    const nextChapterNumber = state.chapters.length + 1;
    
    // Foreshadowing context
    if (foreshadowing.activeForeshadowing.length > 0 || foreshadowing.overdueForeshadowing.length > 0) {
      const sections: string[] = [];
      sections.push('[FORESHADOWING CONTEXT]');
      
      const nearPayoff = foreshadowing.activeForeshadowing.filter(f => 
        (nextChapterNumber - f.introducedChapter) >= 5 && (nextChapterNumber - f.introducedChapter) < 10
      );
      if (nearPayoff.length > 0) {
        sections.push('Foreshadowing Ready for Payoff (5-10 chapters old):');
        nearPayoff.slice(0, 3).forEach(f => {
          sections.push(`  - ${f.type}: "${f.content.substring(0, 150)}" (introduced Ch ${f.introducedChapter})`);
        });
      }
      
      if (foreshadowing.overdueForeshadowing.length > 0) {
        sections.push('Overdue Foreshadowing (10+ chapters without payoff):');
        foreshadowing.overdueForeshadowing.slice(0, 3).forEach(f => {
          sections.push(`  - ${f.type}: "${f.content.substring(0, 150)}" (introduced Ch ${f.introducedChapter}, ${nextChapterNumber - f.introducedChapter} chapters ago)`);
        });
        sections.push('Consider paying off at least one overdue element in this chapter.');
      }
      
      const recentForeshadowing = foreshadowing.activeForeshadowing.filter(f => 
        (nextChapterNumber - f.introducedChapter) <= 3
      );
      if (recentForeshadowing.length === 0 && state.chapters.length > 3) {
        sections.push('Foreshadowing Guidance: No recent foreshadowing detected. Consider adding subtle foreshadowing elements.');
      }
      
      foreshadowingContext = sections.join('\n');
    }
    
    // Emotional payoff context
    if (emotionalPayoffs.recentPayoffs.length > 0 || emotionalPayoffs.upcomingPayoffOpportunities.length > 0) {
      const payoffSections: string[] = [];
      payoffSections.push('[EMOTIONAL PAYOFF CONTEXT]');
      payoffSections.push(`Current Emotional Intensity Score: ${emotionalPayoffs.emotionalIntensityScore}/5`);
      
      if (emotionalPayoffs.recentPayoffs.length > 0) {
        payoffSections.push('Recent Emotional Payoffs:');
        emotionalPayoffs.recentPayoffs.slice(-3).forEach(payoff => {
          payoffSections.push(`  - Ch ${payoff.chapterNumber}: ${payoff.type} (intensity: ${payoff.intensity}/5) - "${payoff.description.substring(0, 100)}"`);
        });
      }
      
      if (emotionalPayoffs.upcomingPayoffOpportunities.length > 0) {
        const opportunity = emotionalPayoffs.upcomingPayoffOpportunities[0];
        payoffSections.push(`Upcoming Payoff Opportunity (Arc Stage: ${opportunity.arcStage}):`);
        payoffSections.push(`  - Recommended Type: ${opportunity.recommendedType}`);
        payoffSections.push(`  - Suggested Intensity: ${opportunity.suggestedIntensity}/5`);
        payoffSections.push(`  - Reason: ${opportunity.reason}`);
      }
      
      if (emotionalPayoffs.recommendations.length > 0) {
        payoffSections.push('Emotional Payoff Recommendations:');
        emotionalPayoffs.recommendations.forEach(rec => {
          payoffSections.push(`  - ${rec}`);
        });
      }
      
      emotionalPayoffContext = payoffSections.join('\n');
    }
    
    // Generate pacing context
    if (pacing.sceneLevelPacing.length > 0 || pacing.rhythmPattern.length > 0) {
      const pacingSections: string[] = [];
      pacingSections.push('[PACING CONTEXT]');
      
      if (pacing.sceneLevelPacing.length > 0) {
        const recentPacing = pacing.sceneLevelPacing[pacing.sceneLevelPacing.length - 1];
        pacingSections.push(`Recent Chapter Pacing (Ch ${recentPacing.chapterNumber}):`);
        pacingSections.push(`  - Scene Count: ${recentPacing.sceneCount}`);
        pacingSections.push(`  - Average Scene Length: ~${recentPacing.averageSceneLength} words`);
        pacingSections.push(`  - Dominant Pacing Type: ${recentPacing.dominantPacingType}`);
        pacingSections.push(`  - Pacing Variation: ${recentPacing.pacingVariation}`);
      }
      
      if (pacing.rhythmPattern.length > 0) {
        const recentRhythm = pacing.rhythmPattern[pacing.rhythmPattern.length - 1];
        pacingSections.push(`Recent Rhythm Pattern: ${recentRhythm.pattern}`);
      }
      
      if (activeArc && activeArc.startedAtChapter) {
        const idx = Math.max(0, nextChapterNumber - activeArc.startedAtChapter);
        const positionPacing = idx === 0 ? pacing.arcPositionPacing.beginning :
                                idx <= 2 ? pacing.arcPositionPacing.early :
                                idx <= 5 ? pacing.arcPositionPacing.middle :
                                pacing.arcPositionPacing.late;
        pacingSections.push(`Arc Position Pacing (Arc Stage: ${idx === 0 ? 'Beginning' : idx <= 2 ? 'Early' : idx <= 5 ? 'Middle' : 'Late'}):`);
        pacingSections.push(`  - Recommended Pacing: ${positionPacing.recommendedPacing}`);
        pacingSections.push(`  - Reason: ${positionPacing.reason}`);
      }
      
      if (pacing.recommendations.length > 0) {
        pacingSections.push('Pacing Recommendations:');
        pacing.recommendations.forEach(rec => {
          pacingSections.push(`  - ${rec}`);
        });
      }
      
      pacingContext = pacingSections.join('\n');
    }
    
    // Generate symbolism context
    if (symbolism.symbolicElements.length > 0 || symbolism.motifEvolution.length > 0) {
      const symbolSections: string[] = [];
      symbolSections.push('[SYMBOLISM CONTEXT]');
      symbolSections.push(`Symbolism Density: ${symbolism.symbolismDensity} elements per chapter`);
      
      if (symbolism.motifEvolution.length > 0) {
        symbolSections.push('Active Symbolic Motifs:');
        symbolism.motifEvolution.slice(-5).forEach(motif => {
          symbolSections.push(`  - "${motif.motif}": ${motif.currentMeaning}`);
          if (motif.evolution.length > 1) {
            symbolSections.push(`    Evolution: Appeared in ${motif.chaptersAppeared.length} chapters`);
          }
        });
      }
      
      if (symbolism.recommendations.length > 0) {
        symbolSections.push('Symbolism Recommendations:');
        symbolism.recommendations.forEach(rec => {
          symbolSections.push(`  - ${rec}`);
        });
      }
      
      symbolismContext = symbolSections.join('\n');
    }
  } catch (error) {
    console.warn('Error generating narrative context (foreshadowing/emotional payoff/pacing/symbolism):', error);
    foreshadowingContext = undefined;
    emotionalPayoffContext = undefined;
    pacingContext = undefined;
    symbolismContext = undefined;
  }

  return {
    storyState: {
      title: state.title,
      genre: state.genre,
      grandSaga: state.grandSaga,
      currentRealm: currentRealm,
      territories: realmTerritories,
      worldBible: realmWorldBible,
    },
    characterContext: {
      codex: state.characterCodex,
      developmentMetrics: characterDevelopmentMetrics,
      relationshipMap: relationshipMap,
    },
    styleContext: {
      profile: styleProfile,
      recentPatterns: recentPatterns,
    },
    narrativeContext: {
      recentChapters: recentChapters,
      olderChaptersSummary: olderChaptersSummary,
      activeArc: activeArc,
      completedArcs: completedArcs,
      progressionMetrics: progressionMetrics,
    },
    previousChapterEnding,
    storyStateSummary,
    continuityBridge,
    activePlotThreads,
    foreshadowingContext,
    emotionalPayoffContext,
    pacingContext,
    symbolismContext,
    arcContext,
    antagonistContext,
  };
}

/**
 * Calculates character relevance score based on multiple factors
 * Improved semantic analysis for better context selection
 */
function calculateCharacterRelevanceScore(
  character: Character,
  recentChapters: Chapter[],
  allCharacters: Character[]
): number {
  let score = 0;
  
  // Base score for protagonist
  if (character.isProtagonist) {
    score += 100;
  }
  
  if (recentChapters.length === 0) {
    // If no chapters, prioritize protagonist and characters with relationships
    return score + (character.relationships.length * 5);
  }
  
  const recentContent = recentChapters.map(c => c.content + ' ' + c.summary).join(' ').toLowerCase();
  const nameLower = character.name.toLowerCase();
  
  // Direct name mentions (weighted by frequency and recency)
  const nameMatches = recentContent.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  const mentionCount = nameMatches ? nameMatches.length : 0;
  score += mentionCount * 10; // Each mention adds 10 points
  
  // Recent chapter mentions (more recent = higher weight)
  recentChapters.forEach((chapter, index) => {
    const chapterContent = (chapter.content + ' ' + chapter.summary).toLowerCase();
    if (chapterContent.includes(nameLower)) {
      // Most recent chapter gets highest weight
      const recencyWeight = (recentChapters.length - index) * 5;
      score += recencyWeight;
    }
  });
  
  // Relationship relevance: if related characters are mentioned, this character is more relevant
  character.relationships.forEach(rel => {
    const relatedChar = allCharacters.find(c => c.id === rel.characterId);
    if (relatedChar && recentContent.includes(relatedChar.name.toLowerCase())) {
      score += 15; // Related character mentioned = higher relevance
    }
  });
  
  // Skills/items mentioned in recent chapters (semantic relevance)
  const skillMentions = character.skills.filter(skill => 
    recentContent.includes(skill.toLowerCase())
  ).length;
  score += skillMentions * 5;
  
  const itemMentions = character.items.filter(item => 
    recentContent.includes(item.toLowerCase())
  ).length;
  score += itemMentions * 5;
  
  // Status relevance (if character status is mentioned)
  if (character.status && recentContent.includes(character.status.toLowerCase())) {
    score += 10;
  }
  
  // Cultivation level relevance (if mentioned)
  if (character.currentCultivation && recentContent.includes(character.currentCultivation.toLowerCase())) {
    score += 10;
  }
  
  return score;
}

/**
 * Gets truncated character codex for prompts (to save tokens)
 * Improved: Uses semantic relevance scoring instead of just name mentions
 * Only includes characters that are relevant (mentioned in recent chapters, related to mentioned characters, or are main characters)
 */
export function getTruncatedCharacterCodex(
  characters: Character[],
  recentChapters: Chapter[] = [],
  maxCharacters: number = 10
): Array<{
  name: string;
  isProtagonist?: boolean;
  currentCultivation: string;
  status: string;
  skills: string[];
  items: string[];
  personality: string;
  notes: string;
  relationships: Array<{
    targetName: string;
    type: string;
    history: string;
    impact: string;
  }>;
}> {
  // Calculate relevance scores for all characters
  const charactersWithScores = characters.map(char => ({
    character: char,
    score: calculateCharacterRelevanceScore(char, recentChapters, characters),
  }));
  
  // Sort by relevance score (highest first)
  charactersWithScores.sort((a, b) => b.score - a.score);
  
  // Always include protagonist if exists, even if low score
  const protagonist = characters.find(c => c.isProtagonist);
  if (protagonist) {
    const protagonistIndex = charactersWithScores.findIndex(c => c.character.id === protagonist.id);
    if (protagonistIndex > 0) {
      // Move protagonist to front if not already there
      const [protagonistEntry] = charactersWithScores.splice(protagonistIndex, 1);
      charactersWithScores.unshift(protagonistEntry);
    }
  }
  
  // Take top N most relevant characters
  const relevantCharacters = charactersWithScores
    .slice(0, maxCharacters)
    .map(entry => entry.character);

  return relevantCharacters.map(char => ({
    name: char.name,
    isProtagonist: char.isProtagonist,
    currentCultivation: char.currentCultivation,
    status: char.status,
    skills: char.skills.slice(0, 5), // Increased from 3 to 5
    items: char.items.slice(0, 5), // Increased from 3 to 5
    personality: char.personality?.substring(0, 250) || '', // Increased from 150 to 250
    notes: char.notes?.substring(0, 300) || '', // Increased from 200 to 300
    relationships: char.relationships.slice(0, 4).map(rel => { // Increased from 3 to 4 relationships
      const targetChar = characters.find(c => c.id === rel.characterId);
      return {
        targetName: targetChar?.name || 'Unknown',
        type: rel.type,
        history: rel.history?.substring(0, 150) || '', // Increased from 100 to 150
        impact: rel.impact?.substring(0, 150) || '', // Increased from 100 to 150
      };
    }),
  }));
}

/**
 * Calculates world bible entry relevance score based on recent chapter content
 * Improved: Uses semantic analysis to find entries mentioned or related to recent content
 */
function calculateWorldBibleRelevanceScore(
  entry: { title: string; content: string; category: string },
  recentChapters: Chapter[],
  activePlotThreads: string[] = []
): number {
  let score = 0;
  
  if (recentChapters.length === 0) {
    // If no chapters, use category priority only
    const priorityOrder = ['PowerLevels', 'Systems', 'Sects', 'Techniques', 'Laws', 'Geography', 'Other'];
    const categoryPriority = priorityOrder.indexOf(entry.category);
    return categoryPriority === -1 ? 999 : (100 - categoryPriority * 10);
  }
  
  const recentContent = recentChapters.map(c => c.content + ' ' + c.summary).join(' ').toLowerCase();
  const entryTitleLower = entry.title.toLowerCase();
  const entryContentLower = entry.content.toLowerCase();
  
  // Title mentions in recent chapters (high weight)
  const titleMatches = recentContent.match(new RegExp(entryTitleLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
  if (titleMatches) {
    score += titleMatches.length * 20; // Each title mention = 20 points
  }
  
  // Content keywords mentioned (extract key terms from entry content)
  const entryKeywords = entryContentLower
    .split(/\s+/)
    .filter(word => word.length > 4) // Only meaningful words
    .slice(0, 10); // Top 10 keywords
  
  const keywordMatches = entryKeywords.filter(keyword => 
    recentContent.includes(keyword)
  ).length;
  score += keywordMatches * 5; // Each keyword match = 5 points
  
  // Category priority (important categories get base score)
  const priorityOrder = ['PowerLevels', 'Systems', 'Sects', 'Techniques', 'Laws', 'Geography', 'Other'];
  const categoryPriority = priorityOrder.indexOf(entry.category);
  if (categoryPriority !== -1) {
    score += (100 - categoryPriority * 10); // Higher priority = higher base score
  }
  
  // Active plot thread relevance
  const plotThreadText = activePlotThreads.join(' ').toLowerCase();
  if (plotThreadText.includes(entryTitleLower) || 
      entryKeywords.some(keyword => plotThreadText.includes(keyword))) {
    score += 30; // Mentioned in active plot threads = high relevance
  }
  
  // Recency: entries mentioned in most recent chapter get bonus
  if (recentChapters.length > 0) {
    const mostRecentContent = (recentChapters[recentChapters.length - 1].content + ' ' + 
                               recentChapters[recentChapters.length - 1].summary).toLowerCase();
    if (mostRecentContent.includes(entryTitleLower)) {
      score += 25; // Bonus for most recent chapter mention
    }
  }
  
  return score;
}

/**
 * Gets truncated world bible entries for prompts
 * Improved: Uses semantic relevance scoring based on recent chapter content and active plot threads
 * Prioritizes entries that are mentioned or related to recent narrative content
 */
export function getTruncatedWorldBible(
  entries: Array<{ title: string; content: string; category: string }>,
  maxEntries: number = 8,
  recentChapters: Chapter[] = [],
  activePlotThreads: string[] = []
): Array<{
  title: string;
  category: string;
  content: string;
}> {
  // Calculate relevance scores for all entries
  const entriesWithScores = entries.map(entry => ({
    entry,
    score: calculateWorldBibleRelevanceScore(entry, recentChapters, activePlotThreads),
  }));
  
  // Sort by relevance score (highest first)
  entriesWithScores.sort((a, b) => b.score - a.score);
  
  // Take top N most relevant entries
  const relevantEntries = entriesWithScores
    .slice(0, maxEntries)
    .map(entry => entry.entry);

  return relevantEntries.map(e => ({
    title: e.title,
    category: e.category,
    content: e.content.substring(0, 500), // Increased from 300 to 500 chars
  }));
}

/**
 * Gets context summary for logging/debugging
 */
export function getContextSummary(context: PromptContext): string {
  const summary: string[] = [];
  
  summary.push(`Novel: ${context.storyState.title} (${context.storyState.genre})`);
  summary.push(`Realm: ${context.storyState.currentRealm?.name || 'None'}`);
  summary.push(`Characters: ${context.characterContext.codex.length}`);
  summary.push(`Recent Chapters: ${context.narrativeContext.recentChapters.length}`);
  summary.push(`Active Arc: ${context.narrativeContext.activeArc?.title || 'None'}`);
  summary.push(`Style Profile: ${context.styleContext.profile ? 'Available' : 'Not available'}`);
  
  return summary.join(' | ');
}