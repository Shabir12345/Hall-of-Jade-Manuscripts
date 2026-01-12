import { NovelState } from '../types';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';
import { analyzeCharacterPsychology } from './characterPsychologyService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeTension } from './tensionAnalyzer';
import { analyzeLiteraryDevices } from './literaryDeviceAnalyzer';

/**
 * Mastery Prompts
 * Provides world-class prompt templates incorporating advanced literary techniques
 * and principles from successful novels
 */

export interface MasteryPromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'structure' | 'character' | 'prose' | 'engagement' | 'theme' | 'tension';
  template: (state: NovelState, context?: any) => string;
  effectivenessScore?: number; // Historical effectiveness
}

/**
 * Master-level prompt templates
 */
export const MASTERY_PROMPT_TEMPLATES: MasteryPromptTemplate[] = [
  {
    id: 'world-class-structure',
    name: 'World-Class Structure Prompt',
    description: 'Incorporates three-act structure, story beats, and structural mastery',
    category: 'structure',
    template: (state: NovelState) => {
      const structureAnalysis = analyzeStoryStructure(state);
      const chapters = state.chapters;
      const nextChapterNumber = chapters.length + 1;
      const totalChapters = chapters.length > 0 ? chapters.length : 100; // Estimate
      const positionPercentage = (nextChapterNumber / totalChapters) * 100;

      // Determine expected story beat
      let expectedBeat = '';
      if (positionPercentage >= 0 && positionPercentage <= 10) {
        expectedBeat = 'INCITING INCIDENT (0-10%) - Life-changing event that sets plot in motion';
      } else if (positionPercentage >= 20 && positionPercentage <= 30) {
        expectedBeat = 'PLOT POINT 1 (25%) - First major turning point, propels into Act 2';
      } else if (positionPercentage >= 45 && positionPercentage <= 55) {
        expectedBeat = 'MIDPOINT (50%) - Major revelation or reversal that shifts direction';
      } else if (positionPercentage >= 70 && positionPercentage <= 80) {
        expectedBeat = 'PLOT POINT 2 (75%) - Second major turning point, propels into Act 3';
      } else if (positionPercentage >= 85 && positionPercentage <= 95) {
        expectedBeat = 'CLIMAX (85-90%) - Ultimate confrontation or final test';
      } else if (positionPercentage >= 90) {
        expectedBeat = 'RESOLUTION (90-100%) - Aftermath and conclusion';
      }

      const structureGuidance = expectedBeat
        ? `\n\nSTORY STRUCTURE MASTERY:\n${expectedBeat}\nEnsure this chapter fulfills the structural requirements for this position in the story.`
        : '';

      const actGuidance = positionPercentage < 25
        ? 'ACT 1 (Setup): Establish world, character, and stakes. Build toward first major turning point.'
        : positionPercentage < 75
        ? 'ACT 2 (Confrontation): Develop conflicts, escalate stakes, deepen character. Build toward climax.'
        : 'ACT 3 (Resolution): Resolve conflicts, complete character arcs, provide satisfying conclusion.';

      return `Apply world-class story structure principles:

${structureGuidance}

${actGuidance}

STRUCTURAL EXCELLENCE REQUIREMENTS:
- Each chapter must serve a clear structural purpose
- Escalate tension throughout Act 2
- Build toward major story beats at appropriate positions
- Maintain proper act proportions (Act 1: 25%, Act 2: 50%, Act 3: 25%)
- Ensure smooth transitions between acts

Current position: ${positionPercentage.toFixed(1)}% through story
Chapter ${nextChapterNumber} of estimated ${totalChapters} chapters`;
    },
  },
  {
    id: 'thematic-mastery',
    name: 'Thematic Mastery Prompt',
    description: 'Emphasizes thematic depth and philosophical exploration',
    category: 'theme',
    template: (state: NovelState) => {
      const themeAnalysis = analyzeThemeEvolution(state);
      const primaryThemes = themeAnalysis.primaryThemes.map(t => t.themeName).join(', ');
      
      return `THEMATIC MASTERY REQUIREMENTS:

Primary Themes: ${primaryThemes || 'To be established'}

THEMATIC EXCELLENCE PRINCIPLES:
1. Weave themes throughout the chapter naturally (don't preach)
2. Show themes through character choices and consequences
3. Use subtext to explore themes beneath surface events
4. Connect themes to world-building and character motivations
5. Build thematic questions that will be answered later

DEPTH LEVELS:
- Surface: Theme mentioned or alluded to
- Mid: Theme explored through character actions and dialogue
- Deep: Theme examined through philosophical questions and meaningful choices

For this chapter, aim for MID to DEEP thematic integration.`;
    },
  },
  {
    id: 'character-psychology-mastery',
    name: 'Character Psychology Mastery Prompt',
    description: 'Focuses on deep character psychology and internal conflict',
    category: 'character',
    template: (state: NovelState) => {
      const characterAnalysis = analyzeCharacterPsychology(state);
      const protagonist = state.characterCodex.find(c => c.isProtagonist);
      
      return `CHARACTER PSYCHOLOGY MASTERY:

${protagonist ? `Protagonist: ${protagonist.name}` : 'Protagonist: To be specified'}

PSYCHOLOGICAL DEPTH REQUIREMENTS:
1. Internal Conflict (Want vs Need):
   - What does the character WANT? (surface desire)
   - What does the character NEED? (true need for growth)
   - Show the conflict between want and need

2. Character Arc Progression:
   - Track psychological state: stable → conflicted → growing → breaking → transformed
   - Show gradual change, not sudden shifts
   - Character actions must reflect current psychological state

3. Motivation Hierarchy:
   - Primary motivation (driving force)
   - Secondary motivations (supporting goals)
   - Motivational conflicts create internal tension

4. Character Flaw:
   - Identify and show character flaw
   - Flaw should create problems for character
   - Character should work toward acknowledging/resolving flaw

PSYCHOLOGICAL EXCELLENCE:
- Show, don't tell character psychology
- Use actions and choices to reveal internal state
- Dialogue should reflect psychological depth
- Internal monologue can reveal inner conflict`;
    },
  },
  {
    id: 'prose-mastery',
    name: 'Prose Mastery Prompt',
    description: 'Emphasizes literary quality and prose excellence',
    category: 'prose',
    template: (state: NovelState) => {
      return `PROSE MASTERY REQUIREMENTS:

LITERARY EXCELLENCE PRINCIPLES:

1. SENTENCE VARIETY:
   - Mix short (5-10 words), medium (15-25 words), and long (30+ words) sentences
   - Create rhythm through sentence patterns
   - Use short sentences for impact and emphasis
   - Use long sentences for description and flow

2. SHOW vs TELL BALANCE:
   - Target: 70% show, 30% tell
   - SHOW: Actions, sensory details, dialogue, body language
   - TELL: Summary, exposition, transitions
   - Rule: If it's important, show it. If it's routine, tell it briefly.

3. VOCABULARY SOPHISTICATION:
   - Use precise, vivid words
   - Vary word choice (avoid repetition)
   - Match vocabulary to character and context
   - Balance sophistication with accessibility

4. RHYTHM AND CADENCE:
   - Vary sentence beginnings
   - Use parallel structure for emphasis
   - Create musicality through word choice
   - Read aloud to check rhythm

5. AVOID CLICHÉS:
   - Replace common phrases with original expressions
   - Find fresh metaphors and similes
   - Use genre-specific language appropriately
   - Originality in language creates voice

PROSE QUALITY CHECKLIST:
✓ Each sentence serves a purpose
✓ Vary sentence structure and length
✓ Show emotions through actions
✓ Use sensory details
✓ Balance dialogue and narrative
✓ Avoid repetitive words and phrases`;
    },
  },
  {
    id: 'engagement-mastery',
    name: 'Engagement Mastery Prompt',
    description: 'Optimizes for reader engagement and page-turning quality',
    category: 'engagement',
    template: (state: NovelState) => {
      return `ENGAGEMENT MASTERY REQUIREMENTS:

PAGE-TURNER EXCELLENCE:

1. OPENING HOOK (First 100-200 words):
   - Start with action, dialogue, or intriguing moment
   - Create immediate questions in reader's mind
   - Avoid slow exposition or description
   - Target: Hook strength 80+/100

2. CHAPTER MOMENTUM:
   - Every scene must advance plot or character
   - Cut scenes that don't serve a purpose
   - Maintain forward motion
   - Avoid filler or unnecessary description

3. CLIFFHANGERS:
   - End chapters with unanswered questions
   - Mid-scene cuts create anticipation
   - End on action, revelation, or choice
   - Target: Cliffhanger effectiveness 75+/100

4. EMOTIONAL RESONANCE:
   - Create moments that evoke strong emotions
   - Build emotional peaks throughout chapter
   - Connect reader to character emotions
   - Target: Emotional resonance 75+/100

5. NARRATIVE MOMENTUM:
   - Each chapter should build on previous
   - Create forward-driving plot threads
   - Avoid backtracking or stagnation
   - Maintain sense of progression

ENGAGEMENT CHECKLIST:
✓ Strong opening hook
✓ Multiple engagement moments
✓ Effective chapter ending
✓ Emotional impact
✓ Forward momentum
✓ No fatigue-inducing sections`;
    },
  },
  {
    id: 'tension-mastery',
    name: 'Tension Mastery Prompt',
    description: 'Master-level tension management and conflict escalation',
    category: 'tension',
    template: (state: NovelState) => {
      const tensionAnalysis = analyzeTension(state);
      
      return `TENSION MASTERY REQUIREMENTS:

CONFLICT AND TENSION EXCELLENCE:

1. TENSION LEVELS:
   - Vary tension throughout chapter (not constant)
   - Build toward peaks, then release
   - Target: Average tension 50-70, peaks 80-90
   - Low tension (20-40) only for strategic release

2. TENSION TYPES:
   - Emotional: Internal conflict, relationships
   - Physical: Battles, danger, survival
   - Psychological: Mental pressure, paranoia, fear
   - Social: Betrayal, competition, politics

3. ESCALATION PATTERNS:
   - Rising tension: Build conflict gradually
   - Oscillating: Peak, release, peak (most engaging)
   - Stable tension: Only for transition scenes
   - Create variety in tension patterns

4. TENSION-RELEASE BALANCE:
   - After high tension (80+), provide release
   - Release allows reader to process emotions
   - Too much constant tension = fatigue
   - Balance: 70% tension, 30% release

5. MICRO-TENSION:
   - Every scene should have some tension
   - Dialogue tension: Subtext, unspoken conflict
   - Action tension: Stakes, consequences
   - Internal tension: Character struggles

TENSION CHECKLIST:
✓ Appropriate tension level for chapter position
✓ Variety in tension types
✓ Proper escalation pattern
✓ Tension-release balance
✓ Multiple tension layers`;
    },
  },
  {
    id: 'literary-device-mastery',
    name: 'Literary Device Mastery Prompt',
    description: 'Advanced use of literary devices for depth and artistry',
    category: 'prose',
    template: (state: NovelState) => {
      return `LITERARY DEVICE MASTERY:

ARTISTIC EXCELLENCE PRINCIPLES:

1. FORESHADOWING:
   - Plant seeds early for later payoffs
   - Subtle hints, not obvious predictions
   - Multiple layers create richness
   - Connect foreshadowing to themes

2. SYMBOLISM:
   - Objects, colors, actions with deeper meaning
   - Symbolism reinforces themes
   - Evolve symbols over time
   - Don't overuse - quality over quantity

3. METAPHOR AND SIMILE:
   - Fresh comparisons, not clichés
   - Connect to story world and themes
   - Use sparingly for maximum impact
   - Originality creates voice

4. IRONY:
   - Situational, dramatic, or verbal irony
   - Creates depth and complexity
   - Can subvert expectations
   - Enhances thematic resonance

5. IMAGERY:
   - Vivid sensory details
   - Multiple senses (not just sight)
   - Imagery creates atmosphere
   - Connect imagery to emotion

DEVICE EXCELLENCE:
- Quality over quantity
- Devices serve story, not decoration
- Subtlety is key - readers should feel, not be told
- Synergy: Devices working together`;
    },
  },
];

/**
 * Gets the best prompt template based on current novel state
 */
export function getBestPromptTemplate(
  state: NovelState,
  focusArea?: 'structure' | 'character' | 'prose' | 'engagement' | 'theme' | 'tension'
): MasteryPromptTemplate | null {
  if (!focusArea) {
    // Analyze novel to determine weakest area
    const structureAnalysis = analyzeStoryStructure(state);
    const themeAnalysis = analyzeThemeEvolution(state);
    const engagementAnalysis = analyzeEngagement(state);
    const proseQuality = analyzeProseQuality(state);

    const scores = {
      structure: structureAnalysis.overallStructureScore,
      theme: themeAnalysis.overallConsistencyScore,
      engagement: engagementAnalysis.overallEngagementScore,
      prose: proseQuality.overallProseScore,
    };

    // Find weakest area
    const weakestArea = Object.entries(scores).reduce((weakest, [area, score]) => 
      score < scores[weakest as keyof typeof scores] ? area : weakest
    ) as keyof typeof scores;

    focusArea = weakestArea;
  }

  // Find matching template
  const template = MASTERY_PROMPT_TEMPLATES.find(t => t.category === focusArea);
  return template || MASTERY_PROMPT_TEMPLATES[0]; // Default to structure
}

/**
 * Generates enhanced prompt incorporating mastery principles
 */
export function generateMasteryPrompt(
  state: NovelState,
  basePrompt: string,
  focusAreas?: Array<'structure' | 'character' | 'prose' | 'engagement' | 'theme' | 'tension'>
): string {
  let masteryGuidance = '';

  const areas = focusAreas || ['structure', 'engagement', 'prose'];

  areas.forEach(area => {
    const template = MASTERY_PROMPT_TEMPLATES.find(t => t.category === area);
    if (template) {
      masteryGuidance += `\n\n=== ${template.name.toUpperCase()} ===\n${template.template(state)}\n`;
    }
  });

  return `${basePrompt}\n\n${masteryGuidance}\n\nApply these mastery principles to create a world-class chapter that demonstrates literary excellence across all dimensions.`;
}

/**
 * Gets all mastery prompt templates
 */
export function getAllMasteryPrompts(): MasteryPromptTemplate[] {
  return MASTERY_PROMPT_TEMPLATES;
}
