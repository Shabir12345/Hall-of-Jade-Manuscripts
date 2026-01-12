import { NovelState, BuiltPrompt } from '../../../types';
import { buildPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';
import { parseAndResolveReferences } from '../../referenceService';
import { analyzeForeshadowing, getArcChapters } from '../arcContextAnalyzer';
import { getActivePatterns } from '../../patternDetectionService';
import { buildIssuePreventionConstraints } from '../../promptEnhancementService';

/**
 * Chapter Prompt Writer
 * 
 * Creates professionally structured prompts for chapter generation
 * that consider story progression, character development, and writing style.
 * 
 * Features:
 * - Continuity bridge from previous chapter
 * - Character development context
 * - Arc progression tracking
 * - Recurring issue pattern prevention
 * - Style consistency maintenance
 */

/**
 * Builds a prompt for generating the next chapter
 * 
 * @param state - The current novel state
 * @param userInstruction - Optional user instructions for the chapter
 * @returns Promise resolving to built prompt with system and user instructions
 * 
 * @example
 * ```typescript
 * const prompt = await buildChapterPrompt(novelState, "Focus on protagonist's power breakthrough");
 * ```
 */
export async function buildChapterPrompt(
  state: NovelState,
  userInstruction: string = ''
): Promise<BuiltPrompt> {
  const nextChapterNumber = state.chapters.length + 1;
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  const protagonist = findProtagonist(state);
  
  // Parse and resolve @ references from user instruction
  const referenceContext = parseAndResolveReferences(userInstruction, state);
  
  // Determine narrative momentum based on recent chapters
  const recentChapters = state.chapters.slice(-3);
  const narrativeMomentum = determineNarrativeMomentum(state, recentChapters);
  
  // Determine appropriate chapter structure
  const chapterStructure = determineChapterStructure(state, nextChapterNumber);
  
  // Build character development needs
  const characterNeeds = identifyCharacterDevelopmentNeeds(state);
  const arcStageHint = (() => {
    if (!activeArc) return '';
    
    // Get actual arc chapters to determine position
    const arcChapters = getArcChapters(activeArc, state.chapters, state.plotLedger);
    
    // Calculate position in arc (0-indexed from start)
    let idx: number;
    if (activeArc.startedAtChapter && activeArc.startedAtChapter > 0 && activeArc.startedAtChapter <= state.chapters.length + 1) {
      // Use startedAtChapter if valid (preferred method for accuracy)
      idx = Math.max(0, nextChapterNumber - activeArc.startedAtChapter);
    } else if (arcChapters.length > 0) {
      // Fallback: use actual chapter count (next chapter will be chaptersInArc + 1, 0-indexed is chaptersInArc)
      idx = arcChapters.length;
    } else {
      // No chapters yet and no valid startedAtChapter - treat as beginning
      idx = 0;
    }
    
    // Determine stage based on position
    if (idx === 0) return 'Arc Stage: BEGINNING (set-up, stakes, first irreversible step).';
    if (idx <= 2) return 'Arc Stage: EARLY (complications, rising pressure, lines drawn).';
    if (idx <= 5) return 'Arc Stage: MIDDLE (escalation, reversals, hard choices).';
    return 'Arc Stage: LATE (turning point, climax pressure, resolution approaches).';
  })();

  const arcDirective = activeArc
    ? `ACTIVE ARC FOCUS: "${activeArc.title}"\nArc intent: ${activeArc.description}\n${arcStageHint}\nThis chapter MUST advance this arc in a concrete way (new obstacle, new leverage, a decisive choice, or a measurable escalation of stakes).`
    : 'ACTIVE ARC FOCUS: None. Advance the Grand Saga through meaningful plot and character movement.';

  const protagonistDirective = protagonist
    ? `PROTAGONIST ANCHOR: ${protagonist.name}\nKeep POV/scene focus centered on the protagonist’s goals, pressures, and consequential choices (unless the user instruction explicitly demands otherwise).`
    : 'PROTAGONIST ANCHOR: None specified.';

  const antagonistDirective = 'ANTAGONIST CONTEXT: Consider active antagonists and opposing forces. Advance conflicts meaningfully.';

  // Get continuity bridge context for task description
  const previousChapter = state.chapters.length > 0 ? state.chapters[state.chapters.length - 1] : null;
  const continuityInstruction = previousChapter
    ? `⛔ CRITICAL: CHAPTER CONTINUITY REQUIREMENT ⛔
This is the MOST IMPORTANT requirement for this chapter generation. Failure to follow this will result in a broken story flow.

YOU MUST:
1. Begin EXACTLY where Chapter ${previousChapter.number} ended - no time skip, no location change, same scene
2. Match ALL character states exactly (location, emotions, physical state, knowledge) as described in [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]
3. Continue the IMMEDIATE situation from where it left off - show what happens in the next few seconds/minutes
4. Reference the [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT] section above for the exact ending, character states, and immediate situation
5. Show the immediate next moment - what happens in the next few seconds/minutes after the previous chapter ended

DO NOT:
- Start with a time skip ("Later that day...", "The next morning...", "Hours later...")
- Change locations without showing the transition ("Meanwhile, in another city...")
- Change character emotional/physical states without explanation
- Repeat the previous chapter's ending - move forward from it
- Introduce new scenes without resolving the ending scene first
- Skip the immediate consequences or reactions

Example of GOOD transition:
Previous chapter ends: "He stared at the door, heart pounding. This was it. The moment of truth had arrived."
This chapter should start: "His hand trembled as he reached for the doorknob. The cold metal felt heavier than he remembered. Taking a deep breath, he..."

Example of BAD transition (DO NOT DO THIS):
Previous chapter ends: "He stared at the door, heart pounding. This was it."
This chapter starts: "The next morning, he found himself in a different city, contemplating his next move..." [This skips time and location - WRONG]

Reference the [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT] section above. It contains:
- The exact ending of Chapter ${previousChapter.number} (last ~600 words)
- Character states at chapter end (location, emotions, situation)
- The immediate situation that was happening as the chapter closed
- Mandatory transition requirements specific to the previous chapter's ending

`
    : '';

  const taskDescription = `Write Chapter ${nextChapterNumber} of "${state.title}".

${continuityInstruction}${narrativeMomentum}

${chapterStructure}

${characterNeeds}

${protagonistDirective}

${arcDirective}

${antagonistDirective}

The chapter must:
- Be AT LEAST 1500 words in length (this is a strict minimum requirement)
- Follow the established writing style and narrative voice
- Advance the plot or character development meaningfully
- Include a clear value shift (Delta principle) from start to end
- Maintain consistency with established world rules and character personalities
- End with a hook or question that maintains reader engagement (CLIFFHANGER STRATEGY: Vary cliffhanger types based on arc stage - action for middle arcs, emotional/mystery for early arcs, tension escalation for late arcs. Each chapter ending should create an unresolved question or tension that compels the reader to continue.)
- Apply the Law of Causality: connect to previous chapters with "BUT" or "THEREFORE"
- Use specific, sensory details (Show, Don't Tell)
- Maintain appropriate pacing for the current story tension level
- Use micro-tension: every scene beat should contain a want, resistance, and consequence (no flat exposition blocks)
- Make character choices costly and specific (pressure → choice → consequence)
- Avoid clichés and vague abstractions; prefer concrete images, actions, and sharp interiority
- Maintain story state consistency: reference the [CURRENT STORY STATE] section to ensure characters are in the correct locations and emotional states
- FORESHADOWING: Weave subtle hints of future events throughout the chapter. Reference [FORESHADOWING CONTEXT] if provided. Add new subtle foreshadowing (symbolic objects, repeated imagery, dialogue hints, environmental cues) where appropriate. Consider paying off overdue foreshadowing elements if indicated.
- EMOTIONAL PAYOFF: Create meaningful emotional moments (revelations, victories, losses, transformations). Reference [EMOTIONAL PAYOFF CONTEXT] if provided. Ensure emotional intensity matches arc stage and story tension. Balance positive and negative emotional moments. Provide satisfying emotional payoffs that feel earned.
- PACING: Maintain appropriate pacing for arc stage and story tension. Reference [PACING CONTEXT] if provided. Vary pacing within chapters (mix fast action with slower reflection/dialogue). Follow rhythm patterns (alternate fast and slow chapters). Ensure pacing matches the emotional intensity and narrative needs of the current arc stage.
- SYMBOLISM: Weave symbolic elements (objects, colors, imagery, actions) throughout the chapter that carry deeper meaning. Reference [SYMBOLISM CONTEXT] if provided. Evolve existing symbols (add layers of meaning, show how they gain significance). Use symbolism to reinforce themes and character development. Symbols should feel organic, not forced.
- SUBTEXT: Layer dialogue and scenes with hidden meaning. Characters rarely say exactly what they mean - their words carry subtext. Actions and descriptions can represent deeper meanings. Create layers: surface action + hidden meaning. Gradually reveal subtext rather than explaining it all at once. Track subtext elements for later revelation.

HUMAN-LIKE WRITING PATTERNS FOR AI DETECTION EVASION (CRITICAL):
The following techniques are essential to create prose that reads as authentically human-written:

- SENTENCE VARIATION (BURSTINESS): Dramatically vary sentence length throughout the chapter. Mix very short sentences (3-5 words) for impact with longer sentences (25-30+ words) for complex thoughts. Use sentence fragments strategically for emphasis or rhythm. Alternate between simple, compound, and complex sentences. Occasionally break conventional patterns - start sentences unconventionally when it serves the narrative. Avoid sequences of similar-length sentences.

- VOCABULARY UNPREDICTABILITY (PERPLEXITY): Use synonyms instead of repeating the same word repeatedly. Occasionally choose slightly less common words where they fit naturally. Vary formality levels within scenes - not every sentence needs perfect formal grammar. Include occasional genre-specific colloquialisms or phrases that feel authentic to the setting. Avoid overly polished, predictable word choices.

- NATURAL WRITING IMPERFECTIONS: Add subtle imperfections that feel human: occasional intentional sentence fragments for emphasis, strategic comma usage that feels natural rather than strictly grammatical, varied pacing that creates natural rhythm. Avoid making every sentence perfectly structured - human writing has natural variation.

- PARAGRAPH STRUCTURE VARIETY: Vary paragraph lengths dramatically - some paragraphs should be very short (1-2 sentences) for emphasis or quick pacing, others should be medium-length (4-6 sentences), and occasionally use longer paragraphs (7-8 sentences) for detailed scenes. This variation creates natural rhythm and prevents uniform, AI-like patterns.

- RHYTHM AND PACING: Create natural rhythm through varied pacing. Alternate between fast-paced action sequences (shorter sentences, shorter paragraphs) and slower reflection or description (longer sentences, longer paragraphs). This variation should feel organic, not mechanical.

- CHARACTER VOICE VARIETY: Each character's dialogue and internal thoughts should have unique rhythm and vocabulary patterns. Avoid making all characters speak with the same level of formality or sentence structure. This adds authenticity and prevents repetitive patterns.

- ADVANCED AI EVASION TECHNIQUES:
  * Strategic repetition: Occasionally repeat a word or phrase for emphasis (but not excessively - this creates natural variation)
  * Irregular punctuation: Use dashes, ellipses, and other punctuation creatively to create natural pauses and emphasis
  * Thought interruptions: Show characters' thoughts being interrupted mid-sentence, creating natural breaks
  * Sensory details: Include specific, unexpected sensory details that add authenticity (the smell of old wood, the texture of worn fabric, the taste of dust)
  * Time markers variation: Use varied time markers ("moments later", "after what felt like hours", "before he could react") instead of uniform patterns
  * Action/description interweaving: Alternate between action and description at irregular intervals, not in predictable patterns
  * Emotional beats: Vary how emotions are expressed - sometimes direct ("He was angry"), sometimes shown ("His knuckles whitened"), sometimes implied
  * Unpredictable transitions: Use varied transition words and phrases, occasionally starting sentences with conjunctions or unexpected words
  * Natural dialogue tags: Vary dialogue tags naturally - not always "he said" but mix in action beats and varied tags
  * Organic flow: Allow sentences to flow naturally rather than forcing perfect structure - let the narrative breath

PROFESSIONAL WRITING STRUCTURE REQUIREMENTS:
- PARAGRAPH STRUCTURE: The chapter MUST have proper paragraph breaks. NEVER write one continuous paragraph. Use varied paragraph lengths (2-6 sentences per paragraph) based on content flow and narrative rhythm.
- PARAGRAPH BREAKS: Break paragraphs at natural transition points: topic shifts, time changes, location changes, character focus shifts, or when introducing new ideas.
- PUNCTUATION: Use commas for lists, clauses, and pauses within sentences. Use periods only for complete sentence endings. Avoid run-on sentences and incorrect punctuation.
- READABILITY: Each paragraph should focus on one main idea or scene beat. Use transitions between paragraphs for smooth narrative flow.
- STRUCTURE VARIETY: Mix short paragraphs (2-3 sentences) for emphasis or quick pacing with medium paragraphs (4-6 sentences) for detailed scenes. Avoid paragraphs longer than 8 sentences.`;

  const outputFormat = `Return ONLY valid JSON.

Required top-level keys:
- logicAudit: { startingValue, theFriction, theChoice, resultingValue, causalityType ("Therefore" or "But") }
- chapterTitle: string
- chapterContent: string (MUST be at least 1500 words - this is a strict minimum requirement. Count words carefully and ensure the chapter meets this length. MUST have proper paragraph breaks - use \\n\\n to separate paragraphs. NEVER return one continuous paragraph.)
- chapterSummary: string
- characterUpdates: array (can be empty)
- worldUpdates: array (optional; can be empty)
- territoryUpdates: array (optional; can be empty)

CRITICAL FORMATTING: In chapterContent, use double newlines (\\n\\n) to separate paragraphs. Ensure proper punctuation and varied paragraph lengths.`;

  // Get active recurring patterns and build prevention constraints
  let patternConstraints: string[] = [];
  try {
    const activePatterns = await getActivePatterns();
    if (activePatterns && activePatterns.length > 0) {
      patternConstraints = await buildIssuePreventionConstraints(activePatterns);
      console.log(`[Chapter Prompt] Injected ${patternConstraints.length} pattern-based constraints from ${activePatterns.length} active patterns`);
      
      // Log which patterns were included
      activePatterns.forEach(pattern => {
        if (pattern.occurrenceCount >= pattern.thresholdCount) {
          console.log(`[Chapter Prompt] Active pattern: ${pattern.issueType} at ${pattern.location} (${pattern.occurrenceCount} occurrences)`);
        }
      });
    }
  } catch (error) {
    console.warn('[Chapter Prompt] Failed to load active patterns, continuing without pattern constraints:', error);
  }

  // Base constraints (always included)
  const baseConstraints = [
    'CRITICAL: chapterContent MUST be at least 1500 words. This is a non-negotiable minimum. Count words carefully before finalizing.',
    'CRITICAL: chapterContent MUST have proper paragraph structure. Use double newlines (\\n\\n) to separate paragraphs. NEVER write one continuous paragraph. Aim for 3-8 paragraphs minimum for a 1500-word chapter.',
    'PARAGRAPH STRUCTURE: Each paragraph should be 2-6 sentences. Vary paragraph lengths for better readability. Break paragraphs at natural transition points (topic shifts, time/location changes, character focus shifts).',
    'PUNCTUATION: Use commas correctly for lists, clauses, and pauses. Use periods only for complete sentence endings. Avoid run-on sentences and incorrect punctuation usage.',
    'Keep chapterContent under 20,000 characters to ensure proper JSON formatting (1500 words ≈ 7,500-9,000 characters, so this allows for longer chapters)',
    'Escape all quotes and special characters properly in JSON response (use \\n for newlines, \\" for quotes)',
    'Ensure JSON response is valid and complete',
    'If the chapter needs to be longer than 20,000 characters, ensure it is at least 1500 words and break it into logical sections with proper paragraph breaks',
    'Maintain genre-appropriate terminology and world rules',
    'All character actions must be consistent with their established personalities',
    'World-building elements must align with established rules',
    'CRITICAL CONTINUITY: You MUST start the chapter exactly where the previous chapter ended. NO time skips. NO location changes without transition. Match ALL character states (location, emotions, physical state) from [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]. Show the immediate next moment - what happens in the next few seconds/minutes. Do NOT repeat the previous chapter\'s ending - move forward from it.',
    'Maintain story state consistency: ensure characters are in the locations and states described in [CURRENT STORY STATE] and match the character states from [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]',
    'Address or acknowledge active plot threads from [ACTIVE PLOT THREADS] where relevant to maintain narrative continuity',
  ];

  // Combine pattern constraints (priority first) with base constraints
  const specificConstraints = [...patternConstraints, ...baseConstraints];

  // Add reference context to user instruction if references were found
  let enhancedUserInstruction = userInstruction || 'Continue the epic. Apply First Principles. Ensure a clear Delta.';
  if (referenceContext.formattedContext) {
    enhancedUserInstruction = `${referenceContext.formattedContext}\n\nUSER INSTRUCTION:\n${enhancedUserInstruction}`;
  }

  const builtPrompt = await buildPrompt(state, {
    role: 'You are the "Apex Sovereign Author," a world-class novelist and master literary architect specializing in Xianxia, Xuanhuan, and System epics. You write with the precision of a master surgeon and the soul of a poet.',
    taskDescription,
    userInstruction: enhancedUserInstruction,
    outputFormat,
    specificConstraints,
  }, {
    includeFullContext: false,
    maxContextLength: 4000, // Increased from 2500 to 4000 to accommodate richer context for continuity
    prioritizeRecent: true,
    includeStyleGuidelines: state.chapters.length >= 3, // Only include if we have enough chapters to establish style
    includeCharacterDevelopment: true,
    includeStoryProgression: state.chapters.length >= 2, // Only include if we have progression to track
  });

  return {
    ...builtPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
}

/**
 * Determines narrative momentum based on recent chapters
 */
function determineNarrativeMomentum(
  state: NovelState,
  recentChapters: typeof state.chapters
): string {
  if (recentChapters.length === 0) {
    return 'NARRATIVE MOMENTUM: This is the beginning of the story. Establish the world, protagonist, and initial conflict.';
  }

  const lastChapter = recentChapters[recentChapters.length - 1];
  const lastAudit = lastChapter.logicAudit;

  if (!lastAudit) {
    return 'NARRATIVE MOMENTUM: Continue building on recent events.';
  }

  if (lastAudit.causalityType === 'But') {
    return `NARRATIVE MOMENTUM: The previous chapter ended with a disruption (${lastAudit.theFriction}). This chapter should explore the consequences and reactions.`;
  } else {
    return `NARRATIVE MOMENTUM: The previous chapter ended with a logical progression (${lastAudit.resultingValue}). This chapter should build on that foundation, but introduce new challenges or developments.`;
  }
}

/**
 * Determines appropriate chapter structure
 */
function determineChapterStructure(
  state: NovelState,
  chapterNumber: number
): string {
  if (chapterNumber === 1) {
    return 'CHAPTER STRUCTURE: Opening chapter. Establish setting, protagonist, and initial conflict. Hook the reader immediately.';
  }

  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc) {
    // Get actual arc chapters to determine position
    const arcChapters = getArcChapters(activeArc, state.chapters, state.plotLedger);
    
    // Calculate position in arc (0-indexed from start)
    let indexInArc: number;
    if (activeArc.startedAtChapter && activeArc.startedAtChapter > 0 && activeArc.startedAtChapter <= state.chapters.length + 1) {
      // Use startedAtChapter if valid (preferred method for accuracy)
      indexInArc = Math.max(0, chapterNumber - activeArc.startedAtChapter);
    } else if (arcChapters.length > 0) {
      // Fallback: use actual chapter count (next chapter will be chaptersInArc + 1, 0-indexed is chaptersInArc)
      indexInArc = arcChapters.length;
    } else {
      // No chapters yet and no valid startedAtChapter - treat as beginning
      indexInArc = 0;
    }

    if (indexInArc === 0) {
      return `CHAPTER STRUCTURE: Beginning of arc "${activeArc.title}". Set up the arc's central conflict and stakes. Establish the arc's opposing forces and a first irreversible move.`;
    }
    if (indexInArc <= 2) {
      return `CHAPTER STRUCTURE: Early in arc "${activeArc.title}". Complicate the plan, reveal costs, raise stakes, and force a clear choice.`;
    }
    if (indexInArc <= 5) {
      return `CHAPTER STRUCTURE: Middle of arc "${activeArc.title}". Escalate conflict with reversals, deepen consequences, and push toward a turning point.`;
    }
    return `CHAPTER STRUCTURE: Late in arc "${activeArc.title}". Drive toward a decisive turning point or climax pressure; set up resolution or the next arc transition.`;
  }

  return 'CHAPTER STRUCTURE: Continue the narrative flow. Balance action, character development, and world-building.';
}

/**
 * Finds the protagonist by identifying the character most mentioned in chapters
 * Falls back to first character if no chapters exist
 */
function findProtagonist(state: NovelState): typeof state.characterCodex[0] | null {
  if (state.characterCodex.length === 0) {
    return null;
  }

  const explicit = state.characterCodex.find(c => c.isProtagonist);
  if (explicit) return explicit;

  if (state.chapters.length === 0) {
    // If no chapters yet, use first character as default
    return state.characterCodex[0];
  }

  // Count mentions of each character in all chapters
  const characterMentions = state.characterCodex.map(char => {
    const mentions = state.chapters.reduce((count, chapter) => {
      const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
      const nameLower = char.name.toLowerCase();
      // Count occurrences of the character's name
      const matches = content.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);
    return { character: char, mentions };
  });

  // Sort by mentions (most mentioned first) and return the top character
  characterMentions.sort((a, b) => b.mentions - a.mentions);
  return characterMentions[0]?.character || state.characterCodex[0];
}

/**
 * Identifies character development needs
 */
function identifyCharacterDevelopmentNeeds(state: NovelState): string {
  if (state.characterCodex.length === 0) {
    return 'CHARACTER DEVELOPMENT: Introduce the protagonist and establish their core traits, goals, and initial circumstances.';
  }

  const mainCharacter = findProtagonist(state);
  if (!mainCharacter) {
    return 'CHARACTER DEVELOPMENT: Continue developing characters naturally through their actions and interactions.';
  }

  const characterMentions = state.chapters.filter(c => 
    c.content.toLowerCase().includes(mainCharacter.name.toLowerCase()) ||
    c.summary.toLowerCase().includes(mainCharacter.name.toLowerCase())
  ).length;

  if (characterMentions < 3) {
    return `CHARACTER DEVELOPMENT: Continue developing ${mainCharacter.name}. Show their personality through actions and dialogue.`;
  }

  // Check for cultivation/power progression needs
  const needsBreakthrough = mainCharacter.currentCultivation.toLowerCase().includes('condensation') ||
                           mainCharacter.currentCultivation.toLowerCase().includes('foundation');
  
  if (needsBreakthrough && characterMentions > 5) {
    return `CHARACTER DEVELOPMENT: ${mainCharacter.name} may be ready for a cultivation breakthrough or significant power advancement. Consider this in the chapter.`;
  }

  return `CHARACTER DEVELOPMENT: Continue developing characters naturally through their actions and interactions. Maintain consistency with established personalities.`;
}