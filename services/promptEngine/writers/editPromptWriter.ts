import { NovelState, Chapter, BuiltPrompt } from '../../../types';
import { buildSimplifiedPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';
import { analyzeWritingStyle } from '../../contextAnalysis';
import { getStyleGuidelines } from '../styleAnalyzer';
import { parseAndResolveReferences } from '../../referenceService';
import { getActivePatterns } from '../../patternDetectionService';
import { buildIssuePreventionConstraints } from '../../promptEnhancementService';

/**
 * Edit Prompt Writer
 * Creates prompts for chapter editing that preserve narrative voice
 * and style while applying user instructions
 */

/**
 * Builds a prompt for editing a chapter
 */
export async function buildEditPrompt(
  state: NovelState,
  chapter: Chapter,
  userInstruction: string
): Promise<BuiltPrompt> {
  if (!userInstruction || userInstruction.trim().length === 0) {
    throw new Error('Edit instruction cannot be empty');
  }

  // Parse and resolve @ references from user instruction
  const referenceContext = parseAndResolveReferences(userInstruction, state);

  // Analyze the original chapter's style
  const chapterStyle = analyzeWritingStyle([chapter]);
  
  // Extract style characteristics
  const styleNotes: string[] = [];
  if (chapterStyle.tone === 'formal') {
    styleNotes.push('Maintain formal, elevated language');
  } else if (chapterStyle.tone === 'casual') {
    styleNotes.push('Maintain natural, conversational language');
  }
  
  if (chapterStyle.averageSentenceLength < 12) {
    styleNotes.push('Keep sentences short and punchy');
  } else if (chapterStyle.averageSentenceLength > 20) {
    styleNotes.push('Maintain longer, descriptive sentences');
  }

  if (chapterStyle.descriptiveRatio > 0.5) {
    styleNotes.push('Preserve rich descriptive language');
  }

  if (chapterStyle.dialogueRatio > 0.4) {
    styleNotes.push('Maintain dialogue-driven approach');
  }

  // Get chapter context snippet
  const contextSnippet = `Original Chapter ${chapter.number}: "${chapter.title}"
${chapter.summary ? `Summary: ${chapter.summary}` : ''}
${chapter.logicAudit ? `Logic: ${chapter.logicAudit.startingValue} → ${chapter.logicAudit.resultingValue}` : ''}

Original Content (first 500 chars):
${chapter.content.substring(0, 500)}...`;

  // Get active recurring patterns and build prevention constraints for edits
  let patternConstraints: string[] = [];
  try {
    const activePatterns = await getActivePatterns();
    if (activePatterns && activePatterns.length > 0) {
      patternConstraints = await buildIssuePreventionConstraints(activePatterns);
      console.log(`[Edit Prompt] Injected ${patternConstraints.length} pattern-based constraints from ${activePatterns.length} active patterns`);
    }
  } catch (error) {
    console.warn('[Edit Prompt] Failed to load active patterns, continuing without pattern constraints:', error);
  }

  // Build pattern constraints section for edit instructions
  const patternConstraintsSection = patternConstraints.length > 0
    ? `\n\nRECURRING ISSUE PREVENTION (Address these issues in your edit):\n${patternConstraints.map(c => `  - ${c}`).join('\n')}`
    : '';

  const taskDescription = `Edit and refine Chapter ${chapter.number}: "${chapter.title}"

PROFESSIONAL EDITOR PERSPECTIVE:
As a professional editor, your goal is to enhance the prose while preserving the author's unique voice. Focus on:
- Clarity and readability
- Sentence structure and flow
- Pacing and rhythm
- Dialogue quality and naturalness
- Narrative consistency
- Show, don't tell (use concrete details instead of abstractions)
- Eliminating redundancy and wordiness
- Strengthening weak passages

CRITICAL REQUIREMENTS:
- Preserve the original narrative voice and writing style
- Maintain consistency with the chapter's established tone (${chapterStyle.tone})
- Keep the core plot and character actions intact
- Apply the editing instruction while maintaining style consistency
- Ensure all changes align with the story's established world rules and character personalities
- Preserve the chapter's logic audit structure if applicable
${styleNotes.length > 0 ? `- Style preservation: ${styleNotes.join(', ')}` : ''}${patternConstraintsSection}

EDITING GUIDELINES:
- Pacing: Maintain appropriate pacing. Vary sentence length for rhythm. Short sentences for action/tension, longer sentences for reflection/description.
- Dialogue: Ensure natural speech patterns. Vary dialogue tags appropriately. Show character voice through word choice and syntax.
- Sentence Variety: Avoid repetitive sentence structures. Mix simple, compound, and complex sentences. Vary sentence beginnings.
- Paragraph Structure: Ensure proper paragraph breaks. Use varied paragraph lengths (2-8 sentences typically). Break at logical points (dialogue, scene shifts, time changes, topic changes).
- Show Don't Tell: Replace abstractions with concrete details. Instead of "He was angry," show "His fists clenched, jaw tight, eyes narrowed."
- Word Choice: Use precise, evocative language. Avoid clichés and vague abstractions. Prefer specific nouns and strong verbs.
- Eliminate Redundancy: Remove repetitive words, phrases, or ideas. Trust the reader to understand without repetition.

AI DETECTION EVASION PROTOCOL (CRITICAL):
As a professional editor, you must actively identify and fix AI-like patterns in the text to ensure it reads as authentically human-written:

IDENTIFY AND FIX AI-LIKE PATTERNS:
- **Uniform sentence length**: If you notice sequences of similar-length sentences, break them up by dramatically varying sentence length (mix 3-5 word sentences with 25-30+ word sentences).
- **Predictable word choices**: Replace overly common or repetitive word choices with synonyms or slightly less predictable alternatives that fit naturally.
- **Repetitive structures**: Vary sentence beginnings and structures. Avoid patterns like "He did X. He did Y. He did Z." or similar repetitive constructions.
- **Overly polished prose**: Add subtle imperfections that feel human - strategic sentence fragments for emphasis, varied pacing that creates natural rhythm, occasional unconventional structures when they serve the narrative.
- **Perfect grammar everywhere**: While maintaining clarity, occasionally use intentional fragments or slightly unconventional structures for emphasis. Not every sentence needs to be perfectly structured.

INCREASE BURSTINESS (Sentence Variation):
- Dramatically vary sentence length throughout. Mix very short sentences (3-5 words) for impact with longer sentences (25-30+ words) for complex thoughts.
- Use sentence fragments strategically for emphasis or rhythm.
- Alternate between simple, compound, and complex sentences.
- Break conventional patterns occasionally - start sentences unconventionally when it serves the narrative.
- Avoid sequences of similar-length sentences that create uniform, AI-like patterns.

INCREASE PERPLEXITY (Vocabulary Unpredictability):
- Replace repeated words with synonyms where appropriate.
- Choose slightly less common words where they fit naturally (but maintain clarity).
- Vary formality levels within scenes - not everything needs perfect formal grammar.
- Include occasional genre-specific colloquialisms or authentic phrases.
- Avoid overly polished, predictable word choices that make text feel machine-generated.

NATURAL WRITING PATTERNS:
- Add subtle imperfections: intentional sentence fragments, strategic comma usage that feels natural, varied pacing.
- Create natural rhythm through varied pacing - alternate between fast (shorter sentences/paragraphs) and slow (longer sentences/paragraphs).
- Vary paragraph lengths dramatically - some very short (1-2 sentences), others medium (4-6), occasionally longer (7-8).
- Ensure each character has a unique voice with distinct rhythm and vocabulary patterns.

When editing, actively scan for these patterns and fix them to create prose that reads as authentically human-written.

ADVANCED AI EVASION TECHNIQUES FOR EDITING:
- Strategic repetition: Occasionally repeat a word or phrase for emphasis (creates natural variation, not excessive)
- Irregular punctuation: Use dashes, ellipses, and other punctuation creatively for natural pauses and emphasis
- Thought interruptions: Show characters' thoughts being interrupted mid-sentence for natural breaks
- Sensory details: Include specific, unexpected sensory details (smells, textures, tastes) that add authenticity
- Time markers variation: Use varied time markers ("moments later", "after what felt like hours", "before he could react")
- Action/description interweaving: Alternate between action and description at irregular intervals
- Emotional beats variation: Vary how emotions are expressed - sometimes direct, sometimes shown, sometimes implied
- Unpredictable transitions: Use varied transition words, occasionally starting sentences with conjunctions
- Natural dialogue tags: Vary dialogue tags naturally - mix action beats and varied tags, not always "he said"
- Organic flow: Allow sentences to flow naturally rather than forcing perfect structure

The edited chapter should:
- Feel like a natural refinement, not a rewrite
- Maintain the same pacing and structure (unless the instruction specifically asks to change pacing)
- Keep all important plot points and character development
- Improve clarity, flow, or impact based on the instruction
- Demonstrate professional editorial polish while preserving the author's voice
${patternConstraints.length > 0 ? '- Address any recurring issues that may be present in the current chapter' : ''}`;

  // For editing, we only need style context, not full story context
  const styleGuidelines = state.chapters.length >= 3 
    ? getStyleGuidelines(state).substring(0, 500) // Limit style guidelines
    : 'Maintain consistent writing style.';

  // Add reference context to user instruction if references were found
  let enhancedUserInstruction = userInstruction;
  if (referenceContext.formattedContext) {
    enhancedUserInstruction = `${referenceContext.formattedContext}\n\nEDIT INSTRUCTION:\n${enhancedUserInstruction}`;
  }

  const builtPrompt = await buildSimplifiedPrompt(state, {
    role: 'You are a professional editor with expertise in novel editing, specializing in Xianxia, Xuanhuan, and System novels. You bring decades of editorial experience to refine prose while meticulously preserving the author\'s unique voice and style. Your edits enhance clarity, flow, and impact without altering the essential character of the work.',
    taskDescription,
    userInstruction: enhancedUserInstruction,
    contextSnippet: `${contextSnippet}\n\n[STYLE GUIDELINES]\n${styleGuidelines}`,
  });

  return {
    ...builtPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
}