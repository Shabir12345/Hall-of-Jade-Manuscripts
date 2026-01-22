import type { RegenerationConfig } from './types';
import type { CritiqueCorrectionConfig } from './types/critique';

/**
 * Core System Instruction - Concise API-compliant instruction for AI models
 * Keep this under 1000 characters to ensure API compatibility across all providers
 */
export const SYSTEM_INSTRUCTION = `You are a master novelist specializing in Xianxia, Xuanhuan, and System epics. You craft clear, engaging narratives accessible to readers aged 10-40 while maintaining literary excellence.

CORE PRINCIPLES:
• Connect chapters with "BUT" or "THEREFORE" logic, never "And then"
• Ensure meaningful change in every scene (emotional/physical state shifts)
• Use specific, sensory details over vague abstractions
• Maintain narrative voice consistency and world-building coherence
• Create diverse character names reflecting global cultures, not just Chinese conventions`;

/**
 * Extended Storytelling Guidelines - Detailed techniques for user prompts
 * This content should be integrated into specific prompt writers, not system instructions
 */
export const STORYTELLING_GUIDELINES = `
[STORYTELLING TECHNIQUES]

Foreshadowing and Setup:
• Drop subtle hints about future events using objects, imagery, environmental details, dialogue, and actions
• Mix obvious hints with subtle ones that readers only notice later
• Every hint must lead to something important - pay off setups within 3-5 chapters for major elements
• Introduce story elements early and resolve them meaningfully later

Symbolism and Subtext:
• Use objects, actions, and images that carry deeper meaning beyond their surface
• Symbols should grow and evolve meaning as the story progresses
• Connect symbols to themes and character growth
• Add hidden meanings beneath dialogue and actions - characters rarely say exactly what they mean
• Reveal subtext gradually, not all at once

Emotional Resonance:
• Create moments that make readers feel something (revelations, victories, losses, transformations)
• Build up to emotional moments so they feel earned
• Balance positive and negative emotional beats
• Show why change is difficult - characters avoid difficult choices until staying the same becomes more painful

Pacing and Rhythm:
• Adjust pacing to match scene type: faster for action, slower for character development
• Alternate between action, reflection, dialogue, and action again
• Use pacing to build and release tension strategically
• Vary pacing within chapters - mix fast sequences with slower moments

Point of View and Perspective:
• Stick to one character's perspective per scene
• Only switch POV when it serves the story (contrast, different perspectives)
• Maintain clear narrative focus within each scene

Chapter Structure:
• End chapters with hooks that create desire to continue (action, emotion, mystery, tension)
• Vary hook types: action for middle story, emotion/mystery for early story, building tension for later
• Each chapter should end with a question or problem needing resolution
• Never end with summary sentences - end with action, dialogue, sensory detail, or revelation

Parallel Storylines:
• Create storylines and character journeys that mirror or contrast each other
• Echo earlier scenes in later chapters to reinforce themes
• Build connections and deeper meaning through parallel development

Story Planning:
• Before writing: Define where scene starts, what conflict appears, what choice character must make, where scene ends
• Track new elements: Note every new character, sect, fighting system, and power rank introduced
• Update relationships: Character relationships (Karma Links) must evolve based on dialogue and actions

[CHARACTER NAME DIVERSITY - CRITICAL]

When creating new characters, use diverse names from different cultures and regions. Do NOT default to Chinese names simply because the genre is Xianxia.

Requirements:
• Cultural diversity: Names from Chinese, Japanese, Korean, Indian, Middle Eastern, European, African, Native American, Latin American, and other world cultures
• Geographic variety: Character names should match their regional background
• Avoid repetition: Do not reuse common names like "Lin Feng" unless specifically appropriate
• Unique identity: Create memorable names reflecting character background and culture
• World-building consistency: If the world is culturally diverse, names should reflect that diversity
• Vary name structures: Avoid patterns where multiple characters share similar name structures unless there's a story reason (e.g., same family/region)

Note: Xianxia genre refers to cultivation and power system themes, NOT Chinese-only naming conventions.

[STYLE CONSISTENCY PROTOCOL]

• Maintain narrative voice: Match established writing style, tone, and pacing patterns when provided
• Preserve character voices: Dialogue and internal thoughts must align with established personality and development state
• Respect established patterns: Follow narrative perspective, sentence structure, and descriptive style from previous chapters
• Genre consistency: Maintain genre-specific terminology, world rules, and narrative conventions throughout

[CONTEXT AWARENESS PROTOCOL]

• Story continuity: Every action, dialogue, and event must align with established story context, character states, and world rules
• Character development: Consider each character's current arc stage, relationships, and power level
• World consistency: All world-building elements (realms, territories, power systems, sects) must align with the established world bible
• Narrative momentum: Understand current tension level, arc stage, and story progression to maintain appropriate pacing and stakes
• Relationship dynamics: Character interactions must reflect established relationships, history, and current emotional states

[CHARACTER DEVELOPMENT PROTOCOL]

• Arc awareness: Consider each character's development stage (introduction, development, conflict, resolution, transformation)
• Power progression: Cultivation and power advancements must feel earned and align with established patterns
• Relationship evolution: Character relationships must evolve naturally based on interactions and shared history
• Voice consistency: Each character's speech patterns, thought processes, and actions must remain consistent with their established personality

[ACCESSIBILITY AND READABILITY - For Ages 10-40]

• Clear language: Use words most readers understand. If using complex words, provide context that clarifies meaning. Prefer common words over rare ones
• Simple sentences: Prefer shorter, clearer sentences. Break complex ideas into multiple sentences
• Active voice: Use active voice ("He ran") instead of passive ("He was running") for clarity and energy
• Concrete details: Use specific, concrete details instead of abstract concepts. Show what characters see, hear, feel, smell, and taste
• Natural dialogue: Write dialogue that sounds like real people talking, not overly formal speech

[PROFESSIONAL WRITING STANDARDS]

Paragraph Structure:
• Chapters MUST have proper paragraph breaks - NEVER write one continuous paragraph
• Use varied paragraph lengths (2-6 sentences) based on content flow and narrative rhythm
• Break paragraphs at natural transition points: topic shifts, time changes, location changes, character focus shifts, new ideas
• For 1500-word chapters, aim for at least 3-8 paragraphs

Paragraph Length:
• Mix short paragraphs (2-3 sentences) for emphasis or quick pacing
• Use medium paragraphs (4-6 sentences) for detailed scenes
• Avoid paragraphs longer than 8 sentences

Punctuation and Grammar:
• Use commas correctly for lists, clauses, and pauses within sentences
• Use periods only for complete sentence endings
• Avoid run-on sentences and incorrect punctuation
• Ensure proper spacing around punctuation marks
• Follow proper English grammar: subject-verb agreement, tense consistency, correct word usage
• Prefer active voice for stronger prose

Readability:
• Each paragraph should focus on one main idea or scene beat
• Use transitions between paragraphs for smooth narrative flow
• Ensure clear sentence structure and logical progression of ideas

Dialogue Formatting:
• Preserve proper dialogue formatting with quotation marks and appropriate punctuation
• Each speaker's dialogue should be in its own paragraph when possible

[NATURAL WRITING STYLE - Human-Like Prose]

To create prose that reads naturally and feels human-written:

Sentence Variation:
• Dramatically vary sentence length: Mix very short sentences (3-5 words) for impact with longer sentences (25-30+ words) for complex thoughts
• Use sentence fragments strategically for emphasis or rhythm
• Alternate between simple, compound, and complex sentences
• Avoid sequences of similar-length sentences - this creates mechanical, AI-like patterns

Vocabulary Variety:
• Use synonyms instead of repeating the same word repeatedly
• Occasionally use slightly less common words that fit naturally
• Vary formality within scenes - not every sentence needs perfect formal grammar
• Include occasional phrases that fit the genre or setting
• Avoid word choices that sound too perfect or predictable

Paragraph Rhythm:
• Vary paragraph lengths dramatically: some very short (1-2 sentences), others medium (4-6 sentences), occasionally longer (7-8 sentences)
• Alternate between fast-paced sequences (shorter sentences/paragraphs) and slower reflection (longer sentences/paragraphs)
• This variation creates natural rhythm and prevents uniform patterns

Character Voice Variety:
• Each character's dialogue and internal thoughts should have unique rhythm and vocabulary patterns
• Avoid making all characters speak with the same level of formality or sentence structure
• This adds authenticity and prevents repetitive patterns

Natural Writing Patterns:
• Strategic repetition: Occasionally repeat a word or phrase for emphasis (creates natural variation)
• Varied punctuation: Use dashes, ellipses, and other punctuation creatively for natural pauses and emphasis
• Interrupted thoughts: Show characters' thoughts being interrupted mid-sentence, creating natural breaks
• Sensory details: Include specific, unexpected sensory details that add authenticity
• Varied time markers: Use different ways to show time passing instead of always using the same phrases
• Mixed action and description: Alternate at irregular intervals, not in predictable patterns
• Varied emotion expression: Sometimes direct ("He was angry"), sometimes shown ("His knuckles whitened"), sometimes implied
• Natural transitions: Use different transition words and phrases, occasionally starting sentences with conjunctions
• Natural dialogue tags: Vary tags - not always "he said," but mix in action beats and varied tags
• Natural flow: Allow sentences to flow naturally rather than forcing perfect structure - let the narrative breathe

CRITICAL: When style guidelines are provided in the prompt, you MUST follow them precisely to maintain consistency with the established narrative voice.
`;

export const INITIAL_NOVEL_STATE = {
  title: "Untitled Epic",
  genre: "Xianxia",
  grandSaga: "",
  realms: [{ id: '1', name: 'Starting Realm', description: 'The initial realm where the story begins.', status: 'current' as const }],
  currentRealmId: '1',
  territories: [],
  worldBible: [],
      characterCodex: [
    {
      id: '1',
      name: 'Protagonist',
      isProtagonist: true,
      age: 'Unknown',
      personality: 'To be developed',
      currentCultivation: 'Unknown',
      skills: [], // @deprecated - Use techniqueMasteries instead
      items: [], // @deprecated - Use itemPossessions instead
      techniqueMasteries: [],
      itemPossessions: [],
      notes: 'The main character of the story.',
      status: 'Alive' as const,
      relationships: []
    }
  ],
  novelItems: [],
  novelTechniques: [],
  plotLedger: [],
  chapters: [],
  systemLogs: [],
  tags: [],
  writingGoals: [],
  antagonists: [],
  foreshadowingElements: [],
  symbolicElements: [],
  emotionalPayoffs: [],
  subtextElements: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// Authentic Chapter Quality & Originality System Configuration
// ADJUSTED: Lowered thresholds to reduce excessive regenerations
export const QUALITY_CONFIG: RegenerationConfig = {
  maxAttempts: 2, // Reduced from 3 to prevent excessive regenerations
  criticalThresholds: {
    originality: 50, // Reduced from 55 - more lenient
    narrativeCraft: 50, // Reduced from 55 - more lenient
    voiceConsistency: 60, // Reduced from 70 - this was too strict
  },
  minorThresholds: {
    originality: 70, // Reduced from 75
    narrativeCraft: 70, // Reduced from 80
    voiceConsistency: 75, // Reduced from 85
  },
  enabled: true,
};

// AI Detection Evasion Configuration
// ADJUSTED: Relaxed thresholds to avoid excessive regeneration cycles
export const AI_DETECTION_CONFIG = {
  multiPass: {
    enabled: true,
    pass1Temperature: { min: 1.0, max: 1.2 }, // Slightly reduced for more consistent output
    pass2Temperature: { min: 0.9, max: 1.0 },
    pass3Temperature: { min: 0.8, max: 0.9 },
    pass4Temperature: { min: 0.8, max: 0.9 }, // Humanization pass
    pass5Temperature: { min: 0.75, max: 0.85 }, // Anti-detection pass
  },
  burstiness: {
    enabled: true,
    maxSimilarSequences: 4, // RELAXED: Increased from 2 to 4 - 2 was too strict
    similarityThreshold: 0.18, // RELAXED: Increased from 0.12 to 0.18 (18% variance allowed)
  },
  blacklist: {
    enforceInPrompt: true,
    enforcePostProcess: true,
    replacementMode: 'contextual' as 'synonym' | 'remove' | 'contextual',
  },
  perplexity: {
    enabled: true,
    threshold: 75, // RELAXED: Reduced from 90 to 75 - 90 was causing too many regenerations
    checkParagraphs: true,
  },
  voiceIrregularity: {
    enabled: true,
    level: 0.15, // Reduced from 0.2 for more stable output
  },
  sentenceFragmentTarget: {
    enabled: true,
    minPer1500Words: 4, // Reduced from 6 to 4 - more achievable
    maxPer1500Words: 10,
  },
  dialogueInterruptionRate: {
    enabled: true,
    minPercentage: 8, // Reduced from 12 to 8 - more achievable
    maxPercentage: 18,
  },
  adversarialParaphrasing: {
    enabled: true,
    targetScore: 30, // Increased from 20 to 30 - more achievable target
    maxIterations: 2,
  },
  personalVoice: {
    enabled: true,
    minRhetoricalQuestions: 2, // Reduced from 3 to 2
    maxRhetoricalQuestions: 6,
    minEmotionalAdjectives: 3, // Reduced from 5 to 3
    minPersonalTouches: 1, // Reduced from 2 to 1
  },
  nGramControl: {
    enabled: true,
    minTrigramScore: 60, // Reduced from 70 to 60
    minFourgramScore: 60, // Reduced from 70 to 60
    maxRepeatedTrigrams: 3, // Increased from 2 to 3 - allow some repetition
  },
  lexicalBalance: {
    enabled: true,
    targetLexicalDensity: { min: 40, max: 60 }, // Widened range from 45-55 to 40-60
    minBalanceScore: 60, // RELAXED: Reduced from 75 to 60 - this was causing regenerations
  },
  backTranslation: {
    enabled: true,
    languages: ['fr', 'es', 'zh'],
    mergeStrategy: 'hybrid' as 'hybrid' | 'best' | 'average',
  },
  versionMixing: {
    enabled: true,
    numVersions: 2,
    mixingStrategy: 'best-parts' as 'best-parts' | 'alternating' | 'weighted',
  },
};

/**
 * Critique-Correction Loop Configuration
 * 
 * The Auto-Critic Agent uses Gemini Flash to evaluate DeepSeek-generated
 * chapters against a Style Rubric and iteratively refines prose quality.
 * 
 * Cost: ~$0.002 per chapter iteration (Gemini Flash critique + DeepSeek correction)
 * Expected iterations: 1-2 for quality chapters
 */
export const CRITIQUE_CORRECTION_CONFIG: CritiqueCorrectionConfig = {
  // Master switch for the critique-correction loop
  enabled: true,
  
  // Default minimum score (1-10) required to pass
  // 8/10 produces "published author" level quality
  defaultMinimumScore: 8,
  
  // Maximum iterations before accepting the chapter
  // More iterations = higher quality but higher cost
  // Reduced from 3 to 2 for faster generation
  maxIterations: 2,
  
  // Temperature for Gemini critique (lower = more consistent evaluation)
  critiqueTemperature: 0.3,
  
  // Temperature for DeepSeek correction (higher = more creative rewrites)
  correctionTemperature: 0.8,
  
  // Maximum issues to include in each correction prompt
  // Too many can overwhelm the model, too few may miss important issues
  maxIssuesPerCorrection: 8,
  
  // Whether to prioritize fixing high-weight criteria first
  prioritizeHighWeightCriteria: true,
  
  // Whether to preserve approximate word count during corrections
  preserveWordCount: true,
  
  // Tolerance for word count changes (0.1 = 10% change allowed)
  wordCountTolerance: 0.15,
  
  // Whether to log detailed critique information
  verboseLogging: false,
};
