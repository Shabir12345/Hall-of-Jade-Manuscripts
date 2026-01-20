import { NovelState, BuiltPrompt, Character } from '../../../types';
import { buildPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';
import { parseAndResolveReferences } from '../../referenceService';
import { analyzeForeshadowing, getArcChapters } from '../arcContextAnalyzer';
import { generateConsistencyConstraints } from '../consistencyConstraints';
import { textContainsCharacterName } from '../../../utils/characterNameMatching';
import { getActivePatterns } from '../../patternDetectionService';
import { buildIssuePreventionConstraints } from '../../promptEnhancementService';
import { extractAuthorialVoiceProfile, enforceVoiceConsistency } from '../styleAnalyzer';
import { getForbiddenWordsPromptText, getForbiddenStructuresPromptText } from '../../../utils/aiDetectionBlacklist';
import { getGrandSagaCharacters } from '../../grandSagaAnalyzer';
import { validateChapterGenerationQuality, checkOriginalityPreparation } from '../../chapterQualityValidator';
import { getContextLimitsForModel, type ModelProvider } from '../../contextWindowManager';
import { detectEconomicScene, formatMarketForPrompt } from '../../market/marketService';

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
 * @param modelProvider - Optional model provider ('grok') to optimize context limits
 *                        When Grok is used, context limits are significantly increased to leverage 2M token window
 * @returns Promise resolving to built prompt with system and user instructions
 * 
 * @example
 * ```typescript
 * const prompt = await buildChapterPrompt(novelState, "Focus on protagonist's power breakthrough", 'grok');
 * ```
 */
export async function buildChapterPrompt(
  state: NovelState,
  userInstruction: string = '',
  modelProvider?: ModelProvider
): Promise<BuiltPrompt> {
  const nextChapterNumber = state.chapters.length + 1;
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  const protagonists = findProtagonists(state);
  const protagonist = protagonists.length > 0 ? protagonists[0] : null;
  
  // Run pre-generation quality checks to detect issues before prompt building
  const qualityCheck = validateChapterGenerationQuality(state, nextChapterNumber);
  const originalityCheck = checkOriginalityPreparation(state, nextChapterNumber);
  
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

  const protagonistDirective = protagonists.length > 0
    ? `PROTAGONIST ANCHOR: ${protagonists.length === 1 ? protagonists[0].name : protagonists.map(p => p.name).join(', ')}\nKeep POV/scene focus centered on the protagonist’s goals, pressures, and consequential choices (unless the user instruction explicitly demands otherwise).`
    : 'PROTAGONIST ANCHOR: None specified.';

  const antagonistDirective = 'ANTAGONIST CONTEXT: Consider active antagonists and opposing forces. Advance conflicts meaningfully.';

  // Grand Saga characters directive
  const grandSagaDirective = (() => {
    if (!state.grandSaga || state.grandSaga.trim().length === 0) {
      return '';
    }
    const grandSagaChars = getGrandSagaCharacters(state);
    if (grandSagaChars.length > 0) {
      return `GRAND SAGA CHARACTERS: The following characters are mentioned in the Grand Saga and should be featured as the story progresses: ${grandSagaChars.map(c => c.name).join(', ')}. Reference these characters where appropriate, especially if they haven't appeared recently.`;
    }
    return 'GRAND SAGA CONTEXT: Reference the Grand Saga narrative direction where appropriate.';
  })();

  // Get continuity bridge context for task description
  const previousChapter = state.chapters.length > 0 ? state.chapters[state.chapters.length - 1] : null;
  const continuityInstruction = previousChapter
    ? `⛔ CRITICAL: CHAPTER CONTINUITY REQUIREMENT ⛔
This is the MOST IMPORTANT requirement for this chapter generation. Failure to follow this will result in a broken story flow.

YOU MUST:
1. Begin EXACTLY where Chapter ${previousChapter.number} ended - no time skip, no location change, same scene
2. Match ALL character states exactly (location, emotions, physical state, knowledge) as described in [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]
3. Start at the EXACT SAME LOCATION as Chapter ${previousChapter.number} ended (see "PRIMARY LOCATION AT CHAPTER END" in [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT])
4. Continue the IMMEDIATE situation from where it left off - show what happens in the next few seconds/minutes
5. Reference the [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT] section above for the exact ending, character states, and immediate situation
6. Show the immediate next moment - what happens in the next few seconds/minutes after the previous chapter ended

DO NOT:
- Start with a time skip ("Later that day...", "The next morning...", "Hours later...")
- Change locations without showing the transition ("Meanwhile, in another city...", "Back in his hut...", "In the training hall...")
- Start at a different location than where Chapter ${previousChapter.number} ended (this is a CRITICAL error)
- Change character emotional/physical states without explanation
- Repeat the previous chapter's ending - move forward from it
- Introduce new scenes without resolving the ending scene first
- Skip the immediate consequences or reactions

🎯 LOCATION CONTINUITY EXAMPLES:

Example of GOOD location continuity:
Previous chapter ends: "He stood in the courtyard, watching the last disciple leave. The sun was setting over the training grounds."
This chapter should start: "He remained in the courtyard as darkness fell, considering the day's events. The training grounds were now empty..." [Same location - GOOD]

Example of BAD location jump (FORBIDDEN):
Previous chapter ends: "He stood in the courtyard, watching the last disciple leave. The entire azure cloud above him shifted."
This chapter starts: "Back in his hut, he sat on the edge of his bed..." [Location jump from courtyard to hut - WRONG! The chapter should start in the courtyard]

Example of GOOD transition (same location):
Previous chapter ends: "He stared at the door, heart pounding. This was it. The moment of truth had arrived."
This chapter should start: "His hand trembled as he reached for the doorknob. The cold metal felt heavier than he remembered. Taking a deep breath, he..." [Same location - GOOD]

Example of BAD transition (DO NOT DO THIS):
Previous chapter ends: "He stared at the door, heart pounding. This was it."
This chapter starts: "The next morning, he found himself in a different city, contemplating his next move..." [This skips time and location - WRONG]

Reference the [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT] section above. It contains:
- The exact ending of Chapter ${previousChapter.number} (last ~600 words)
- PRIMARY LOCATION AT CHAPTER END (this is where you MUST start)
- Character states at chapter end (location, emotions, situation)
- The immediate situation that was happening as the chapter closed
- Mandatory transition requirements specific to the previous chapter's ending

⚠️ REMEMBER: The PRIMARY LOCATION from the previous chapter ending is where this chapter MUST start. Do not change locations without explicit transition text.

`
    : '';

  // Add opening sentence requirements for non-first chapters
  const openingSentenceRequirements = previousChapter
    ? `🚫 CRITICAL: OPENING SENTENCE REQUIREMENTS 🚫

This chapter's opening is CRITICAL for maintaining story flow and avoiding AI-generated clichés.

DO NOT START WITH (ABSOLUTELY FORBIDDEN):
- Weather descriptions ("The morning sun climbed higher...", "Dark clouds gathered...", "Rain fell...", "The sun rose...")
- Time-of-day clichés ("As dawn broke...", "When night fell...", "In the afternoon...", "The morning light...")
- Generic setting descriptions ("The training grounds stretched...", "The forest loomed...", "The mountains towered...")
- Passive observations ("It was...", "There were...", "In the distance...")
- Descriptive scene-setting that doesn't involve character action ("The air was...", "Silence filled...")

REJECTION CRITERIA: If your first sentence starts with any of the above patterns, STOP. Delete it and start over.

DO START WITH (REQUIRED):
- Character action ("Alex pushed open the door...", "Marcus stepped forward...", "She raised her hand...")
- Character thought/reaction ("This was worse than he'd expected.", "No. This couldn't be happening.")
- Dialogue ("'We need to move now,' said Marcus.", "'Wait,' Alex called out.")
- Immediate continuation from Chapter ${previousChapter.number}'s ending that shows character responding or acting
- Reference to the exact situation from the previous chapter's last moment

The first 2-3 sentences MUST:
1. Directly reference or continue from Chapter ${previousChapter.number}'s ending - show character reacting to or acting on what just happened
2. Show character in the SAME LOCATION as chapter end (check "PRIMARY LOCATION AT CHAPTER END" in [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT])
3. Show character in the same time/emotional state as chapter end (from [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT])
4. Begin with action, dialogue, or internal thought - NOT description
5. Make it clear we're in the immediate next moment after the previous chapter ended

Example of GOOD opening (continuing from previous chapter, same location):
Previous chapter ends: "Alex walked toward the central square, ready for morning instructions."
This chapter should start: "Alex reached the central square just as the assembly bell began to ring. He scanned the crowd gathering in front of the instruction platform..."
[Location matches - character is at the square in both - GOOD]

Example of BAD opening - location jump (FORBIDDEN):
Previous chapter ends: "Alex walked toward the central square, ready for morning instructions. The entire azure cloud above shifted ominously."
This chapter starts: "Alex sat in his hut, contemplating the morning's events..."
[Location jumped from square to hut - WRONG! Should start at the square]

Example of BAD opening - weather cliché (FORBIDDEN - DO NOT DO THIS):
"The morning sun climbed higher over the Azure Dragon Sect training grounds, casting long shadows that stretched like grasping fingers across the packed earth."
[This is a cliché weather/setting description that ignores the previous chapter's ending and location - COMPLETELY WRONG]

Opening Validation: Before finalizing the chapter, verify:
✓ First sentence starts with character action, dialogue, or thought
✓ First sentence references or continues from previous chapter's ending
✓ No weather/time-of-day descriptions in first 2 sentences
✓ Character location matches "PRIMARY LOCATION AT CHAPTER END" from [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]
✓ Same location as previous chapter ended (DO NOT change without transition)
✓ Immediate continuation of previous scene

`
    : '';

  const taskDescription = `[CHAPTER WRITING TASK]

Write Chapter ${nextChapterNumber} of "${state.title}".

⚠️ CRITICAL: This chapter MUST be at least 1500 words. This is a non-negotiable minimum requirement. Count words carefully and ensure you meet this length before finalizing. ⚠️

[CONTINUITY REQUIREMENTS]
${continuityInstruction}${openingSentenceRequirements}${narrativeMomentum}

[CHAPTER STRUCTURE & NARRATIVE FLOW]
${chapterStructure}

[CHARACTER DEVELOPMENT FOCUS]
${characterNeeds}

[PROTAGONIST REQUIREMENTS]
${protagonistDirective}

[ARC INTEGRATION REQUIREMENTS]
${arcDirective}

[ANTAGONIST & CONFLICT REQUIREMENTS]
${antagonistDirective}

${grandSagaDirective ? `[GRAND SAGA INTEGRATION]\n${grandSagaDirective}\n` : ''}

[CORE CHAPTER REQUIREMENTS]

Essential Standards:
• Length: AT LEAST 1500 words (strict minimum requirement)
• Style Consistency: Follow the established writing style and narrative voice
• Plot Advancement: Advance the plot or character development meaningfully
• Meaningful Change: Include a clear change from start to end (something meaningful must happen)
• World Consistency: Maintain consistency with established world rules and character personalities
• Story State: Reference the [CURRENT STORY STATE] section to ensure characters are in correct locations and emotional states

Narrative Techniques:
• Law of Causality: Connect to previous chapters using "BUT" or "THEREFORE" logic
• Show, Don't Tell: Use specific, sensory details instead of abstractions
• Conflict-Driven Scenes: Every scene should show what characters want, what's stopping them, and what happens because of that (avoid long explanations without conflict)
• Character Choices: Make choices costly and specific (pressure → choice → consequence)
• Specificity: Avoid clichés and vague descriptions; prefer specific images, actions, and clear insight into character thoughts and feelings

Chapter Ending Requirements (CRITICAL):
• NEVER end with summary sentences
• End with: action, dialogue, sensory detail, or revelation
• Create tension or an unresolved question through what IS happening, not by summarizing what WILL happen

Narrative Elements Integration:
• Foreshadowing: Weave subtle hints of future events throughout the chapter. Reference [FORESHADOWING CONTEXT] if provided. Add new subtle foreshadowing (symbolic objects, repeated imagery, dialogue hints, environmental cues) where appropriate. Consider paying off overdue foreshadowing elements if indicated.

• Emotional Payoff: Create meaningful emotional moments (revelations, victories, losses, transformations). Reference [EMOTIONAL PAYOFF CONTEXT] if provided. Ensure emotional intensity matches arc stage and story tension. Balance positive and negative emotional moments. Provide satisfying emotional payoffs that feel earned.

• Pacing: Maintain appropriate pacing for arc stage and story tension. Reference [PACING CONTEXT] if provided. Vary pacing within chapters (mix fast action with slower reflection/dialogue). Follow rhythm patterns (alternate fast and slow chapters). Ensure pacing matches emotional intensity and narrative needs of the current arc stage.

• Symbolism: Weave symbolic elements (objects, colors, imagery, actions) throughout the chapter that carry deeper meaning. Reference [SYMBOLISM CONTEXT] if provided. Evolve existing symbols (add layers of meaning, show how they gain significance). Use symbolism to reinforce themes and character development. Symbols should feel organic, not forced.

• Subtext: Layer dialogue and scenes with hidden meaning. Characters rarely say exactly what they mean - their words carry subtext. Actions and descriptions can represent deeper meanings. Create layers: surface action + hidden meaning. Gradually reveal subtext rather than explaining it all at once. Track subtext elements for later revelation.

[CHARACTER NAME DIVERSITY - CRITICAL]

When introducing new characters (in characterUpdates with updateType "new"):
• Use diverse names from different cultures and regions
• Do NOT default to Chinese names like "Lin Feng" or similar patterns
• Create unique names reflecting cultural diversity (Chinese, Japanese, Korean, Indian, Middle Eastern, European, African, Native American, Latin American, and other world cultures)
• Vary name styles and avoid repetition of common names unless there's a specific story reason

[ACCESSIBILITY AND READABILITY - For Ages 10-40]

Write in a way that readers of all ages can understand and enjoy. Prioritize clarity while maintaining engaging storytelling:

Language and Clarity:
• Clear, everyday language: Use words that most readers understand. If using a complex word, provide context that clarifies meaning. Prefer common words over rare or obscure ones
• Explain complex concepts: When introducing new ideas, powers, or world elements, explain them in simple terms. Don't assume readers know everything immediately
• Avoid unnecessary jargon: Avoid overly formal language or unnecessary technical terms. Write naturally and clearly
• Clear, direct sentences: Prefer shorter, clearer sentences. Break complex ideas into multiple sentences for easier comprehension
• Familiar word choices: When choosing between words, prefer the more familiar one. If using a specialized term, explain it naturally in the text
• Natural dialogue: Write dialogue that sounds like real people talking, not overly formal or academic speech
• Show what's happening: Use specific details that help readers picture scenes clearly - what characters see, hear, feel, smell, or taste

Note: Simple, clear writing can still be powerful and engaging. The goal is to tell a great story in a way everyone can understand.

[NARRATIVE CRAFT ENFORCEMENT - Professional Fiction Standards]

Apply professional fiction standards to every chapter. These requirements ensure publication-ready quality:

Sentence Variation Requirements:
• Achieve minimum 30% sentence length variation throughout the chapter
• Mix very short sentences (3-5 words) for impact with longer sentences (25-30+ words) for complex thoughts
• Use sentence fragments strategically for emphasis or rhythm
• Avoid sequences of similar-length sentences - this creates mechanical, AI-like patterns

Subtext Requirements:
• Include at least 3 instances of subtext in dialogue or scenes
• Characters should rarely say exactly what they mean - their words should carry hidden meaning
• Actions and descriptions should represent deeper meanings beneath surface appearance
• Create layers: surface action + hidden meaning
• Do not overexplain - let readers infer meaning

Character Interiority Requirements:
• At least 40% of paragraphs should show what characters are thinking and feeling
• Show each character's unique way of thinking - their internal thoughts should reflect their personality and how they've grown
• Avoid neutral or encyclopedia-like prose

Scene Purpose Requirements:
• Every scene must have a clear purpose - what changes by the end of the scene?
• Each scene should move the plot or character development forward meaningfully
• Avoid scenes that just describe or explain without moving the story forward

Dialogue Naturalness Requirements (CRITICAL):
Write dialogue that sounds like real people talking, not formal or academic speech. Natural dialogue MUST include:
  • Interruptions: 12-18% of dialogue exchanges should have interruptions (use dashes —, ellipses ..., or mid-sentence breaks). Example: "I was trying to tell you—" "Not now!" he cut her off.
  • Ambiguity: Characters should use vague qualifiers (maybe, perhaps, might, sort of, kind of, I think, I guess, you know). Example: "Maybe it's not what you think?" or "I sort of thought we could, you know, talk about this."
  • Subtext: Characters rarely say exactly what they mean. At least 30% of dialogue should have hidden meaning. Example: "I'm fine" (when clearly not fine), or "It's nothing" (when it's obviously important).
  • Incomplete thoughts: Some dialogue should trail off or be cut short. Example: "Well, if you really think..." or "I mean, it's just—"
  • Character voice variation: Each character should have unique speech patterns (formal vs casual, verbose vs terse, direct vs indirect). Don't make all characters sound the same.
  • Avoid: Overly formal dialogue, perfect grammar in all speech, characters saying exactly what they mean, identical speech patterns for all characters.
  • Target score: Dialogue naturalness should score 50-70/100 (currently often 20-40/100 - too formal). Focus on making dialogue feel like natural conversation, not written prose.

Rejection Criteria: Reject output that:
  • Overexplains (shows AND tells instead of showing)
  • Sounds neutral or encyclopedic
  • Uses repetitive phrasing or structural symmetry
  • Lacks character-specific voice and interiority
  • Has unclear scene purpose or nothing changes

[ORIGINALITY & CREATIVE DISTANCE - Avoid Derivative Content]

Enforce originality and creative distance from training data patterns:

Novel Metaphors and Imagery:
• Include at least 2 novel metaphors per 1000 words
• Create fresh, unexpected comparisons that haven't been overused
• Avoid generic metaphors (e.g., "heart pounded like a drum" - too common)
• Prefer unique, specific imagery that feels original

Non-Derivative Scene Construction:
• Avoid the 5 most common scene patterns in the genre
• Create unique scene structures that feel fresh
• Each scene should have its own distinctive approach rather than following formulaic patterns

Genre Cliché Avoidance:
• Avoid genre clichés unless intentionally invoked for subversion or homage
• Common clichés to avoid: "chosen one" prophecies (unless subverted), "power of friendship" victories (unless earned differently), "training montage" sequences (unless unique), "villain monologues" (unless necessary and fresh)

Unique Emotional Beats:
• Create unique emotional beats rather than standard tropes
• Avoid predictable emotional patterns
• Instead of "hero gets angry and powers up," find fresh ways to express emotions and power dynamics
• Each emotional moment should feel specific to these characters and this situation

Creative Distance Requirements:
Ensure the chapter feels distinct from common training data patterns. Avoid:
  • Predictable plot progressions
  • Overly "clean" or optimized prose
  • Excessively polished writing that lacks human imperfection
  • Generic scene structures
  • Standard emotional beats

Rejection Criteria: Flag output that feels:
  • Predictable or formulaic
  • Overly "clean" or optimized
  • Excessively polished without human variation
  * Derivative of common genre patterns
  * Generic in scene construction or emotional beats

HUMAN-LIKE WRITING PATTERNS FOR AI DETECTION EVASION (CRITICAL):
The following techniques are essential to create prose that reads as authentically human-written:

- VARY SENTENCE LENGTH: Dramatically vary sentence length throughout the chapter. Mix very short sentences (3-5 words) for impact with longer sentences (25-30+ words) for complex thoughts. Use sentence fragments strategically for emphasis or rhythm. Alternate between simple, compound, and complex sentences. Occasionally break conventional patterns - start sentences unconventionally when it serves the narrative. Avoid sequences of similar-length sentences. CRITICAL: Never have more than 2 consecutive sentences with similar lengths (±12% variance, stricter). If you detect this pattern, immediately break it by inserting a very short or very long sentence. Track sentence starters (first 3 words) and ensure <25% repetition (stricter) - avoid patterns like "He... He... He..." or "The... The... The...".

${getForbiddenWordsPromptText()}

${getForbiddenStructuresPromptText()}

CRITICAL BLACKLIST ENFORCEMENT:
- NEVER use any of the forbidden words listed above. If you find yourself about to use one, stop and choose a different word.
- NEVER use the forbidden structural patterns. These are mathematical "tells" that AI detectors flag immediately.
- Use visceral, specific verbs instead of vague, polished ones (e.g., use "shoved" or "rammed" instead of "pushed").
- Never end a chapter with a summary of the character's internal feeling or a "journey beginning" cliché.

CHAPTER ENDING REQUIREMENTS (CRITICAL - PROFESSIONAL FICTION STANDARD):
The chapter ending is one of the most important elements. It must feel natural, immediate, and engaging - NOT like a summary or prediction.

REQUIREMENTS:
- End with ACTION, DIALOGUE, SENSORY DETAIL, REVELATION, or CHARACTER THOUGHT - NOT with summary sentences
- Create tension or an unresolved question through what IS happening NOW, not by explaining what WILL happen
- Stay in the present moment - show what characters are doing, saying, thinking, or experiencing RIGHT NOW
- Avoid future tense predictions ("would overcome", "was about to", "would discover")
- Avoid meta-commentary about the story itself ("And so the story continues...")
- Avoid vague conclusions ("Everything changed...", "The stage was set...")

FORBIDDEN ENDING PATTERNS (NEVER USE THESE):
❌ "And so, the journey continues..." / "And thus, his path forward was set..."
❌ "The system would help him overcome this challenge..."
❌ "Little did he know what awaited him..."
❌ "What awaited him was beyond imagination..."
❌ "Fate had other plans..." / "Destiny had other plans..."
❌ "This marked the beginning of a new chapter in his life..."
❌ "From this point forward, everything would change..."
❌ "And everything changed..." / "The stage was set..."
❌ "He would overcome this challenge..." / "He was about to discover..."
❌ "And so the story continues..." / "This was only the beginning..."

GOOD ENDING EXAMPLES (USE THESE AS MODELS):
✓ ACTION: "The blade flashed. Blood sprayed across the stone floor."
✓ DIALOGUE: "You think you can escape?" The voice echoed from the shadows.
✓ SENSORY: "The air tasted of ozone and something metallic. His skin prickled."
✓ THOUGHT: "He had made a mistake. A terrible mistake."
✓ REVELATION: "The door wasn't locked. It never had been."
✓ IMMEDIATE TENSION: "The ground beneath his feet began to crack."
✓ CHARACTER REACTION: "Her eyes widened. The color drained from her face."

CLIFFHANGER STRATEGY (Vary by arc stage):
- Early arcs: End with emotional/mystery hooks or unanswered questions
- Middle arcs: End with action moments or immediate danger
- Late arcs: End with tension escalation toward climax
- All endings: Create an unresolved question or tension through IMMEDIATE action/dialogue/experience, NOT through summary

CRITICAL: Before finalizing the chapter, check the last 1-3 sentences. If they:
- Summarize what will happen → REWRITE to show what IS happening
- Use future tense predictions → REWRITE in present tense with immediate action
- Explain the story's direction → REWRITE to show character experiencing the moment
- Contain any forbidden patterns above → REWRITE completely

The ending should feel like the chapter was cut off mid-scene, mid-action, or mid-thought - not like a conclusion or summary.

- USE DIFFERENT WORDS: Use synonyms instead of repeating the same word repeatedly. Occasionally choose slightly less common words where they fit naturally, but prefer clear, understandable words. Vary formality levels within scenes - not every sentence needs perfect formal grammar. Include occasional genre-specific phrases that feel authentic to the setting. Avoid overly polished, predictable word choices.

- NATURAL WRITING IMPERFECTIONS: Add subtle imperfections that feel human: occasional intentional sentence fragments for emphasis, strategic comma usage that feels natural rather than strictly grammatical, varied pacing that creates natural rhythm. Avoid making every sentence perfectly structured - human writing has natural variation.

- PARAGRAPH STRUCTURE VARIETY: Vary paragraph lengths dramatically - some paragraphs should be very short (1-2 sentences) for emphasis or quick pacing, others should be medium-length (4-6 sentences), and occasionally use longer paragraphs (7-8 sentences) for detailed scenes. This variation creates natural rhythm and prevents uniform, AI-like patterns. CRITICAL: Mix 1-2 sentence paragraphs with 6-8 sentence paragraphs for natural rhythm. Never have more than 3 consecutive paragraphs of similar length.

- RHYTHM AND PACING: Create natural rhythm through varied pacing. Alternate between fast-paced action sequences (shorter sentences, shorter paragraphs) and slower reflection or description (longer sentences, longer paragraphs). This variation should feel organic, not mechanical.

- CHARACTER VOICE VARIETY: Each character's dialogue and internal thoughts should have unique rhythm and vocabulary patterns. Avoid making all characters speak with the same level of formality or sentence structure. This adds authenticity and prevents repetitive patterns.

- ADVANCED AI EVASION TECHNIQUES:
  * Sentence fragments: Include 6-10 sentence fragments (3-5 words) per 1500 words for emphasis and rhythm (increased from 5-8)
  * Rhetorical questions: Add 3-5 rhetorical questions throughout the chapter where appropriate (increased from 2-3)
  * Strategic repetition: Occasionally repeat a word or phrase for emphasis (1-2 instances per chapter, but not excessively - this creates natural variation)
  * Irregular punctuation: Use dashes, ellipses, and other punctuation creatively to create natural pauses and emphasis
  * Thought interruptions: Show characters' thoughts being interrupted mid-sentence, creating natural breaks
  * Dialogue interruptions: 12-18% of dialogue exchanges should have interruptions, incomplete thoughts, or mid-sentence breaks (increased from 10-15%)
  * Sensory details: Include at least 4 unique sensory descriptions per scene (sight, sound, smell, touch, taste) - be specific and unexpected (the smell of old wood, the texture of worn fabric, the taste of dust) - increased from 3
  * Time markers variation: Use varied time markers ("moments later", "after what felt like hours", "before he could react") instead of uniform patterns
  * Action/description interweaving: Alternate between action and description at irregular intervals, not in predictable patterns
  * Emotional beats: Vary how emotions are expressed - sometimes direct ("He was angry"), sometimes shown ("His knuckles whitened"), sometimes implied
  * Unpredictable transitions: Use varied transition words and phrases, occasionally starting sentences with conjunctions or unexpected words, sometimes omit transitions entirely
  * Natural dialogue tags: Vary dialogue tags naturally - not always "he said" but mix in action beats, varied tags, or omit tags when clear from context
  * Organic flow: Allow sentences to flow naturally rather than forcing perfect structure - let the narrative breath
  * Occasional unconventional structures: Use occasional unconventional sentence structures for emphasis when it serves the narrative
  * Active voice preference: Use active voice 70-80% of the time ("He did X" not "X was done by him") - some passive is natural
  * Personal touches: Include specific details, concrete imagery, and occasional tangents that feel authentically human
  * Token-level variation: Replace detector-sensitive words with less common but appropriate alternatives throughout
  * Emotional texture: Include emotional adjectives/adverbs (furious, terrified, ecstatic, devastated, anxious, relieved, etc.)
  * First-person perspective: Where appropriate, add first-person observations ("I wondered...", "We noticed...")
  * Contractions: Add contractions naturally ("don't", "can't", "won't", "it's", "that's") - not everywhere, but some
  * Filler words: Include natural filler words in dialogue and thoughts ("well", "you know", "actually", "I mean")
  * Parenthetical asides: Add occasional parenthetical statements or digressions
  * Lexical balance: Balance content words and function words (target 45-55% lexical density)
  * N-gram variation: Avoid repeating common 3-word and 4-word phrases - restructure sentences

⚠️ CRITICAL BURSTINESS REQUIREMENT (SENTENCE LENGTH VARIATION) ⚠️
AI-generated text is detected by sequences of similar-length sentences within paragraphs. You MUST dramatically vary sentence lengths WITHIN each paragraph:

MANDATORY PATTERN (follow this for EVERY paragraph with 3+ sentences):
- If one sentence is 8-12 words, the next should be EITHER very short (3-5 words) OR much longer (20-30 words)
- NEVER write 3+ consecutive sentences of similar length (e.g., all 10-15 word sentences = VIOLATION)
- Each paragraph should contain a MIX of: very short (3-5 words), short (6-10 words), medium (11-18 words), and long (19-30+ words) sentences

EXAMPLE OF BAD PARAGRAPH (FORBIDDEN - similar lengths trigger AI detection):
"The courtyard was empty. The sun was setting slowly. The wind blew through the trees. He walked toward the gate." 
[ALL sentences are 4-6 words - this SCREAMS "AI generated"]

EXAMPLE OF GOOD PARAGRAPH (required pattern):
"The courtyard stretched empty before him. Silence. The last rays of sun painted everything in shades of amber and crimson as if the sky itself was bleeding, mourning the end of another day that had brought no answers. He walked toward the gate."
[Varied lengths: 6 words, 1 word, 28 words, 7 words - this reads as human-written]

SELF-CHECK: Before finalizing each paragraph, count word lengths:
1. Are there 3+ consecutive sentences of similar length? → REWRITE those sentences
2. Is there dramatic variation (some 3-5 word sentences AND some 25-30 word sentences)? → If not, ADD variation
3. Does the paragraph have rhythm? → Short sentence after long, medium after short, etc.

PROFESSIONAL WRITING STRUCTURE REQUIREMENTS:
- PARAGRAPH STRUCTURE: The chapter MUST have proper paragraph breaks. NEVER write one continuous paragraph. Use varied paragraph lengths (2-6 sentences per paragraph) based on content flow and narrative rhythm.
- PARAGRAPH BREAKS: Break paragraphs at natural transition points: topic shifts, time changes, location changes, character focus shifts, or when introducing new ideas.
- PUNCTUATION: Use commas for lists, clauses, and pauses within sentences. Use periods only for complete sentence endings. Avoid run-on sentences and incorrect punctuation.
- READABILITY: Each paragraph should focus on one main idea or scene beat. Use transitions between paragraphs for smooth narrative flow.
- STRUCTURE VARIETY: Mix short paragraphs (2-3 sentences) for emphasis or quick pacing with medium paragraphs (4-6 sentences) for detailed scenes. Avoid paragraphs longer than 8 sentences.`;

  const outputFormat = `Return ONLY valid JSON. IMPORTANT: The chapterContent field must contain ONLY plain text prose - no JSON structures, no markdown, no code blocks. The chapterContent should be the actual narrative text ready to be saved directly.

⚠️⚠️⚠️ CRITICAL WORD COUNT REQUIREMENT - READ CAREFULLY ⚠️⚠️⚠️
The chapterContent MUST be AT LEAST 1500 WORDS. This is a NON-NEGOTIABLE MINIMUM.

WORD COUNT STRATEGY:
1. Plan for 1800-2200 words to ensure you meet the 1500 minimum
2. Include at least 8-12 substantial paragraphs (4-6 sentences each)
3. Add rich sensory details, character thoughts, and dialogue
4. Expand scenes with description, action, and interiority
5. Do NOT rush to the end - take time to develop each moment

REJECTION CRITERIA: Chapters below 1500 words WILL BE REJECTED and regenerated at additional cost.

Required top-level keys:
- logicAudit: { startingValue, theFriction, theChoice, resultingValue, causalityType ("Therefore" or "But") }
- chapterTitle: string
- chapterContent: string (⚠️ MUST be at least 1500 words - AIM FOR 1800-2200 WORDS. Count words before finalizing. MUST have proper paragraph breaks - use \\n\\n to separate paragraphs. NEVER return one continuous paragraph.)
- chapterSummary: string
- wordCount: number (count the words in your chapterContent and report here - MUST be >= 1500)
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

  // Convert detected repetitive patterns and issues from quality check into prompt constraints
  const qualityBasedConstraints: string[] = [];
  
  // Add constraints for detected repetitive patterns (e.g., "the" as sentence starter)
  if (originalityCheck.repetitivePatterns.length > 0) {
    originalityCheck.repetitivePatterns.forEach(pattern => {
      if (pattern.includes('Repeated sentence beginnings')) {
        const words = pattern.split(':')[1]?.trim() || '';
        qualityBasedConstraints.push(`CRITICAL: Avoid starting sentences with these words in this chapter: ${words}. Actively vary sentence beginnings - use different words to start sentences (names, actions, dialogue, thoughts, prepositions, etc.).`);
        qualityBasedConstraints.push('Examples of varied sentence beginnings: "Marcus pushed...", "Running felt...", "What if...", "The moment he...", "Anger burned...", "Before she could...", "Silence stretched...", "They needed..."');
      }
    });
  }
  
  // Add constraints for overused tropes
  if (originalityCheck.overusedTropes.length > 0) {
    qualityBasedConstraints.push(`CRITICAL: These tropes are overused: ${originalityCheck.overusedTropes.join(', ')}. Either subvert them creatively, avoid them entirely, or give them a fresh unique twist in this chapter.`);
  }
  
  // Add constraints for derivative scene structures
  if (originalityCheck.derivativeStructures.length > 0) {
    qualityBasedConstraints.push(`IMPORTANT: Recent chapters used these common scene structures: ${originalityCheck.derivativeStructures.join(', ')}. Create unique scene construction in this chapter - avoid formulaic patterns.`);
  }
  
  // Add suggestions from originality check as constraints
  if (originalityCheck.suggestions.length > 0) {
    originalityCheck.suggestions.slice(0, 3).forEach(suggestion => {
      qualityBasedConstraints.push(`IMPORTANT: ${suggestion}`);
    });
  }
  
  // Add other quality check suggestions if relevant
  if (qualityCheck.suggestions.length > 0) {
    qualityCheck.suggestions.slice(0, 2).forEach(suggestion => {
      if (!qualityBasedConstraints.some(c => c.includes(suggestion.substring(0, 30)))) {
        if (suggestion.toLowerCase().includes('dialogue') || suggestion.toLowerCase().includes('subtext')) {
          qualityBasedConstraints.push(`IMPORTANT: ${suggestion}`);
        }
      }
    });
  }

  // Base constraints (always included)
  const baseConstraints = [
    '⚠️⚠️⚠️ CRITICAL WORD COUNT: chapterContent MUST be AT LEAST 1500 words. AIM FOR 1800-2200 WORDS to ensure you meet the minimum. Chapters below 1500 words WILL BE REJECTED. Plan your content: include 8-12 paragraphs, expand scenes with sensory details, add dialogue, describe character thoughts and feelings. Do NOT rush the narrative. ⚠️⚠️⚠️',
    'WORD COUNT STRATEGY: To reach 1500+ words: (1) Include at least 2-3 scenes or significant moments, (2) Add 4-6 lines of dialogue per scene, (3) Include character interiority (thoughts/feelings) in 40% of paragraphs, (4) Add sensory details to every scene, (5) Don\'t summarize - show moment-by-moment action.',
    'CRITICAL: chapterContent MUST have proper paragraph structure. Use double newlines (\\n\\n) to separate paragraphs. NEVER write one continuous paragraph. Aim for 8-12 paragraphs for a 1500+ word chapter.',
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
    'CRITICAL TRANSITION REFERENCE: The first 2-3 sentences MUST explicitly reference or continue from the previous chapter\'s ending. Reference the exact situation, character state, or action from where the previous chapter left off. Don\'t start with a new scene or situation without showing the immediate continuation.',
    'Maintain story state consistency: ensure characters are in the locations and states described in [CURRENT STORY STATE] and match the character states from [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]',
    'Address or acknowledge active plot threads from [ACTIVE PLOT THREADS] where relevant to maintain narrative continuity',
    `PREVENT OVEREXPLANATION (CRITICAL - This is a common AI writing flaw):
    
    Overexplanation occurs when you tell the reader what they can already infer from action, dialogue, or context.
    
    FORBIDDEN PATTERNS (use sparingly - max 3 total per chapter):
    • "because" + explanation of obvious emotion
    • "in order to" + restatement of clear motivation  
    • "which meant that" + obvious consequence
    • "this was because" + already-shown reason
    • "the reason was" + redundant explanation
    • Explaining what dialogue already conveys
    • Telling emotion then showing it (or vice versa)
    
    EXAMPLES OF OVEREXPLANATION (AVOID THESE):
    ❌ "He clenched his fists because he was angry." (The clenching already shows anger)
    ❌ "She smiled because she was happy to see him." (The smile already shows happiness)
    ❌ "He ran faster in order to catch up." (Obviously why he's running faster)
    ❌ "I need your help," she said desperately. She was desperate for his assistance." (Redundant)
    
    CORRECT APPROACH (SHOW, DON'T EXPLAIN):
    ✓ "He clenched his fists." (Let reader infer anger)
    ✓ "Her face lit up the moment she saw him." (Show happiness, don't explain it)
    ✓ "His legs pumped harder, the gap between them shrinking." (Show the catching up)
    ✓ "I need your help." Her voice cracked on the last word." (Show desperation through voice)
    
    TRUST YOUR READER: If an action or dialogue shows an emotion or motivation, do NOT then explain it.`,
    `EMOTIONAL LANGUAGE DENSITY (MANDATORY - Target: 5-8 emotional words per 1000 words):
    
    Your prose must include emotional and sensory language throughout. Neutral, encyclopedia-like prose WILL BE FLAGGED.
    
    REQUIRED EMOTIONAL WORD CATEGORIES (use at least 2 from each category per 1500 words):
    • Primary emotions: anger, fear, joy, sadness, love, hate, hope, despair
    • Secondary emotions: excitement, anxiety, relief, guilt, pride, shame
    • Intensity words: furious, terrified, ecstatic, devastated, frantic, elated
    • Physical manifestations: heart (pounded/ached), chest (tight/warm), breath (caught/ragged), gut (churned/tightened)
    
    TECHNIQUES FOR EMOTIONAL DENSITY:
    1. Show emotions physically: "His knuckles whitened" instead of "He was angry"
    2. Use sensory metaphors: "The metallic taste of fear" instead of "He was afraid"
    3. Add visceral reactions: "Her stomach dropped" instead of "She was surprised"
    4. Include internal monologue with emotional language
    5. Add physical sensation: "The worn fabric felt rough against her skin"
    
    BAD (Too neutral): "He walked into the room and saw her there. She looked at him."
    GOOD (Emotional): "He stepped into the room, his heart lurching when he saw her. Her eyes—those impossibly blue eyes—found his, and something tightened in his chest."`,
    'CRITICAL CHAPTER ENDING: The last 1-3 sentences MUST end with immediate action, dialogue, sensory detail, revelation, or character thought - NEVER with summary sentences. FORBIDDEN: "And so...", "Thus...", "The journey continues...", "Little did he know...", "The system would help...", "What awaited him...", "Fate had other plans...", "This marked the beginning...", "From this point forward...", "And everything changed...", "The stage was set...", future tense predictions ("would overcome", "was about to"), or meta-commentary about the story. The ending must show what IS happening NOW, not summarize what WILL happen. Examples of good endings: "The blade flashed." / "You think you can escape?" / "The air tasted of ozone." / "He had made a mistake."',
  ];

  // Combine all constraints (priority order: quality-based, pattern-based, then base constraints)
  const specificConstraints = [...qualityBasedConstraints, ...patternConstraints, ...baseConstraints];

  // Add reference context to user instruction if references were found
  let enhancedUserInstruction = userInstruction || 'Continue the epic. Apply First Principles. Ensure a clear Delta.';
  if (referenceContext.formattedContext) {
    enhancedUserInstruction = `${referenceContext.formattedContext}\n\nUSER INSTRUCTION:\n${enhancedUserInstruction}`;
  }

  // Add economic context if market data exists and scene involves transactions
  if (state.globalMarketState && state.globalMarketState.standardItems.length > 0) {
    // Detect if user instruction or recent chapter context suggests economic content
    const textToCheck = [
      userInstruction,
      previousChapter?.content?.slice(-2000) || '',
      previousChapter?.summary || '',
      activeArc?.description || '',
    ].join(' ');
    
    const economicDetection = detectEconomicScene(textToCheck);
    
    // Always include economic context if market data exists (for consistency)
    // More detailed context for economic scenes, compact for others
    if (economicDetection.hasEconomicContent && economicDetection.confidence > 0.3) {
      // Full economic context for scenes involving transactions
      const marketContext = formatMarketForPrompt(state.globalMarketState, {
        includeAllItems: false,
        maxItems: 15,
        includeWealth: true,
        includeModifiers: true,
      });
      enhancedUserInstruction = `${marketContext}\n\n${enhancedUserInstruction}`;
      console.log(`[Chapter Prompt] Economic scene detected (${economicDetection.suggestedContext}, confidence: ${economicDetection.confidence.toFixed(2)}). Injecting full market context.`);
    } else if (state.globalMarketState.standardItems.length > 0) {
      // Compact economic reminder for non-economic scenes
      const compactMarket = `[ECONOMIC REFERENCE: Primary currency is ${
        state.globalMarketState.currencies.find(c => c.isPrimary)?.name || 'Spirit Stones'
      }. If any transactions occur, reference established prices for consistency.]`;
      enhancedUserInstruction = `${compactMarket}\n\n${enhancedUserInstruction}`;
    }
  }

  // Enhanced: Add consistency constraints
  const charactersInEnding = previousChapter
    ? state.characterCodex.filter(c => 
        textContainsCharacterName(previousChapter.content.slice(-1000), c.name)
      ).map(c => c.id)
    : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);
  
  const consistencyConstraints = generateConsistencyConstraints(state, charactersInEnding);
  const enhancedConstraints = [
    ...specificConstraints,
    ...consistencyConstraints.constraints
      .filter(c => c.severity === 'critical')
      .map(c => `⚠️ CRITICAL CONSTRAINT: ${c.constraint}`)
  ];

  // Get model-specific context limits if model provider is specified
  const modelLimits = modelProvider ? getContextLimitsForModel(modelProvider) : null;
  
  // Use model-specific limits if available, otherwise use defaults optimized for continuity
  const configMaxContextLength = modelLimits 
    ? modelLimits.maxContextLength 
    : 4000; // Default for Claude/smaller context windows
  
  const builtPrompt = await buildPrompt(state, {
    role: 'You are the "Apex Sovereign Author," a world-class novelist and master literary architect specializing in Xianxia, Xuanhuan, and System epics. You write with the precision of a master surgeon and the soul of a poet. CRITICAL: Every chapter you write MUST be at least 1500 words - this is a non-negotiable minimum requirement.',
    taskDescription,
    userInstruction: enhancedUserInstruction,
    outputFormat,
    specificConstraints: enhancedConstraints,
  }, {
    includeFullContext: modelLimits?.includeFullHistory ?? false,
    maxContextLength: configMaxContextLength,
    prioritizeRecent: true,
    includeStyleGuidelines: state.chapters.length >= 3, // Only include if we have enough chapters to establish style
    includeCharacterDevelopment: true,
    includeStoryProgression: state.chapters.length >= 2, // Only include if we have progression to track
  }, modelProvider ? { provider: modelProvider } : undefined);

  // Extract and enforce authorial voice profile if chapters exist
  let finalPrompt = {
    ...builtPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  };

  if (state.chapters.length >= 3) {
    const voiceProfile = extractAuthorialVoiceProfile(state.chapters, state);
    if (voiceProfile) {
      finalPrompt = enforceVoiceConsistency(finalPrompt, voiceProfile);
    }
  }

  return finalPrompt;
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
 * Finds protagonists - returns all explicitly marked protagonists, or falls back to most mentioned character
 * Supports multiple protagonists
 */
function findProtagonists(state: NovelState): Character[] {
  if (state.characterCodex.length === 0) {
    return [];
  }

  const explicit = state.characterCodex.filter(c => c.isProtagonist);
  if (explicit.length > 0) return explicit;

  if (state.chapters.length === 0) {
    // If no chapters yet, use first character as default
    return state.characterCodex.length > 0 ? [state.characterCodex[0]] : [];
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
  return characterMentions[0]?.character ? [characterMentions[0].character] : [];
}

/**
 * Finds the first protagonist (for backward compatibility)
 */
function findProtagonist(state: NovelState): typeof state.characterCodex[0] | null {
  const protagonists = findProtagonists(state);
  return protagonists.length > 0 ? protagonists[0] : null;
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