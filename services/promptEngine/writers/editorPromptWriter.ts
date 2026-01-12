import { NovelState, BuiltPrompt, Chapter, Arc } from '../../../types';
import { buildPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';
import { ChapterBatchEditorInput, ArcEditorInput } from '../../../types/editor';

/**
 * Editor Prompt Writer
 * Creates prompts for AI-powered editing analysis of chapters and arcs
 */

/**
 * Builds a prompt for analyzing a batch of chapters (typically 5)
 */
export async function buildChapterBatchAnalysisPrompt(
  input: ChapterBatchEditorInput
): Promise<BuiltPrompt> {
  const { chapters, novelState, startChapter, endChapter } = input;
  
  // Build chapter content summaries for analysis
  const chaptersContent = chapters.map(ch => ({
    number: ch.number,
    title: ch.title,
    content: ch.content,
    summary: ch.summary,
    logicAudit: ch.logicAudit,
  }));

  const chapterRange = chapters.length > 0 
    ? `Chapters ${startChapter} to ${endChapter} (${chapters.length} chapters)`
    : `${chapters.length} chapters`;

  const taskDescription = `You are a professional novel editor with decades of experience analyzing ${chapterRange} of "${novelState.title}".

YOUR ROLE:
As a professional editor, analyze these chapters with the depth and insight of an experienced editorial professional. Your analysis should cover:
- Story flow and narrative continuity
- Grammar, punctuation, and formatting
- Style consistency and voice preservation
- Pacing, rhythm, and sentence structure
- Dialogue quality and naturalness
- Character consistency and development
- Plot logic and coherence
- Paragraph and sentence structure
- Show vs. tell balance
- Word choice and precision
- Eliminating redundancy and wordiness

Provide detailed, actionable feedback as a professional editor would give to an author, identifying both strengths and areas for improvement.

CHAPTERS TO ANALYZE (${chapters.length} chapters - Chapters ${startChapter} through ${endChapter}):

${chaptersContent.map((ch, index) => `
=== CHAPTER ${ch.number}: ${ch.title} ===
Summary: ${ch.summary || 'No summary'}
Logic Audit: ${ch.logicAudit ? JSON.stringify(ch.logicAudit, null, 2) : 'None'}

FULL CONTENT:
${ch.content}

${index < chaptersContent.length - 1 ? `--- END OF CHAPTER ${ch.number} ---` : ''}
${index < chaptersContent.length - 1 ? `--- BEGINNING OF CHAPTER ${chaptersContent[index + 1].number} ---` : ''}
`).join('\n\n')}

CRITICAL: Pay special attention to transitions between chapters. Analyze how Chapter N ends and how Chapter N+1 begins. Look for:
- Location jumps (chapter ends in one place, next starts elsewhere)
- Time jumps (chapter ends at one time, next starts at different time)
- Missing transitions that would confuse readers
- Abrupt shifts in POV, scene, or tone

ANALYSIS REQUIREMENTS:

1. STORY FLOW ANALYSIS:
   - Check for gaps between chapters (missing transitions, unexplained jumps)
   - Verify continuity between chapter endings and beginnings
   - Identify abrupt scene changes or location shifts
   - Check for consistent time progression
   - Look for logical sequence of events

2. CONTINUITY CHECK:
   - Verify character locations match between chapters
   - Check that character states (emotional, physical) are consistent
   - Ensure character knowledge is consistent (characters know what they should know)
   - Verify world state consistency
   - Check for plot holes or inconsistencies

3. TRANSITION ANALYSIS:
   - Identify weak transitions between chapters
   - Flag abrupt time skips that need explanation
   - Check scene-to-scene transitions within chapters
   - Verify logical flow from one chapter to the next

4. GRAMMAR AND STYLE:
   - Check for grammar errors
   - Identify spelling mistakes
   - Flag punctuation issues
   - Check for formatting inconsistencies
   - Verify paragraph structure (proper breaks, varied lengths)
   - Check dialogue formatting

5. CHARACTER CONSISTENCY:
   - Verify characters act according to their established personalities
   - Check for voice consistency in dialogue
   - Flag any character inconsistencies

6. NARRATIVE QUALITY:
   - Assess overall flow and pacing (sentence length variety, paragraph rhythm)
   - Check for repetitive language or phrases (identify patterns)
   - Evaluate show vs. tell balance (prefer concrete details over abstractions)
   - Identify areas that need expansion or clarification
   - Flag sections that need tightening or cutting (redundancy, wordiness)
   - Assess word choice precision (strong verbs, specific nouns, avoid clichés)
   - Evaluate sentence variety and structure (avoid repetitive patterns)
   - Check for micro-tension in scenes (want, resistance, consequence)

7. PARAGRAPH STRUCTURE ANALYSIS (CRITICAL):
   - Check if chapters are one big paragraph (no paragraph breaks)
   - Identify paragraphs with more than 10 sentences (too long)
   - Check for chapters with too few paragraphs (e.g., 1-2 paragraphs for 1500+ words)
   - Verify paragraph length variety (mix of short, medium, long paragraphs)
   - Identify wall-of-text issues (no paragraph breaks, hard to read)
   - Flag paragraphs that need splitting for better readability

8. SENTENCE STRUCTURE ANALYSIS (CRITICAL):
   - Detect excessive short, choppy sentences (e.g., many sentences under 8-10 words)
   - Identify repetitive sentence structures (all simple sentences, no variety)
   - Check for poor sentence flow (abrupt transitions between sentences)
   - Flag weak sentence beginnings (too many sentences starting the same way)
   - Detect lack of sentence variety (all same length, same structure)
   - Identify run-on sentences or overly complex sentences
   - Check for patterns like: "Sentence. Sentence. Sentence." (too choppy)

STRUCTURE FIX REQUIREMENTS:
- For single-paragraph chapters: Split into multiple paragraphs at logical points (dialogue, scene changes, topic shifts, time shifts, location changes)
- For long paragraphs (>10 sentences): Break into 2-3 focused paragraphs maintaining story flow
- For choppy sentences: Combine related short sentences, vary sentence length, improve flow
- For weak sentence structure: Improve sentence beginnings, add variety, enhance readability
- Maintain the author's voice and story flow throughout
- Break paragraphs at natural points: dialogue, time shifts, location changes, POV shifts, topic changes

ISSUE CATEGORIZATION:
- Minor (auto-fixable): Grammar errors, spelling mistakes, punctuation, formatting issues
- Major (requires review): Story gaps, time skips, abrupt transitions, plot holes, character inconsistencies

OUTPUT FORMAT:
Return ONLY valid JSON with the following structure:
{
  "analysis": {
    "overallFlow": "excellent" | "good" | "adequate" | "needs_work",
    "continuityScore": number (0-100),
    "grammarScore": number (0-100),
    "styleScore": number (0-100),
    "summary": string (2-3 sentence summary of overall quality),
    "strengths": string[] (list of what's working well),
    "recommendations": string[] (general recommendations)
  },
  "issues": [
    {
      "type": "gap" | "transition" | "grammar" | "continuity" | "time_skip" | "character_consistency" | "plot_hole" | "style" | "formatting" | "paragraph_structure" | "sentence_structure",
      "severity": "minor" | "major",
      "chapterNumber": number,
      "location": "start" | "middle" | "end" | "transition",
      "description": string (clear description of the issue),
      "suggestion": string (how to fix it),
      "autoFixable": boolean,
      "originalText": string (the problematic text, if applicable),
      "context": string (surrounding context for understanding the issue)
    }
  ],
    "fixes": [
      {
        "issueId": string (use "issue-0", "issue-1", etc. to reference issues by index, or the chapter number),
        "chapterNumber": number (CRITICAL: MUST be one of: ${chaptersContent.map(ch => ch.number).join(', ')}. NEVER use chapter numbers outside this range! Double-check before responding.),
        "fixType": string (same as the issue type: "gap", "transition", "grammar", "continuity", etc.),
        "originalText": string | "" (for replacements: EXACT text from chapter. For insertions: empty string "" or text where insertion should occur),
        "fixedText": string (for replacements: corrected text. For insertions: can be multiple paragraphs - NO LENGTH LIMIT),
        "reason": string (brief explanation of why this fix is needed),
        "insertionLocation": "before" | "after" | "split" (optional, for insertions: 'before' = end of chapter, 'after' = start of chapter, 'split' = both),
        "isInsertion": boolean (optional, true if this is a pure insertion, false/omit for replacements)
      }
    ]
    
IMPORTANT FOR FIXES:

FOR GRAMMAR/FORMATTING/STYLE ISSUES (replacements):
- Provide the exact original text and the corrected version
- originalText MUST match the chapter content exactly (copy-paste the exact text)

FOR LARGE GAPS (location jumps, time skips, major transitions):
- Add COMPREHENSIVE transition text - don't limit yourself to one sentence
- If needed, add multiple paragraphs, full scenes, or detailed explanations
- Explain HOW the character got from point A to point B
- Explain WHEN the time jump occurred and what happened during it
- Add as much detail as needed to make the transition smooth and logical
- NO LENGTH LIMIT - add whatever is necessary for a professional transition

FOR GAP/TRANSITION FIXES (insertions):
- originalText can be empty string ("") for pure insertions at chapter boundaries
- Or provide the exact text where insertion should occur (last sentence/paragraph of chapter, first sentence/paragraph of next chapter)
- fixedText can be multiple paragraphs - NO LENGTH LIMIT
- Specify insertionLocation: 'before' (end of previous chapter), 'after' (start of next chapter), or 'split' (add to both if gap is very large)
- Set isInsertion: true for pure insertions

FOR PARAGRAPH STRUCTURE FIXES:
- originalText: The entire problematic paragraph (or entire chapter if it's one paragraph) - copy EXACTLY as it appears
- fixedText: The restructured text with proper paragraph breaks inserted at logical points
- Break paragraphs at: dialogue exchanges (new paragraph per speaker), scene changes, time shifts, location changes, topic shifts, emotional beats
- Maintain story flow - don't break mid-thought, mid-action, or mid-dialogue
- Vary paragraph lengths (mix of short 1-3 sentence paragraphs for impact, medium 4-6 sentence paragraphs for standard flow, longer 7-9 sentence paragraphs for complex scenes)
- For single-paragraph chapters: Intelligently split into 5-10+ paragraphs based on content length

FOR SENTENCE STRUCTURE FIXES:
- originalText: The problematic sentences (can be multiple consecutive sentences) - copy EXACTLY as they appear
- fixedText: Improved sentences with better structure, flow, and variety
- Combine related short choppy sentences where appropriate (e.g., "He ran. He was fast." → "He ran, and he was fast." or "Running came naturally to him; he was fast.")
- Vary sentence length and structure (mix simple, compound, complex sentences)
- Improve sentence beginnings for variety (avoid patterns like "He... He... He..." or "The... The... The...")
- Add transitional words/phrases where needed for better flow
- Fix choppy patterns (e.g., "He walked. He stopped. He looked." → "He walked, then stopped to look around.")
- Maintain clarity and meaning while improving readability

AI DETECTION EVASION FOR FIXES (CRITICAL):
When generating fixedText, ensure it reads as authentically human-written by applying these principles:

- SENTENCE VARIATION (BURSTINESS): Dramatically vary sentence length in fixes. Mix very short sentences (3-5 words) with longer ones (25-30+ words). Use sentence fragments strategically. Avoid creating uniform patterns.

- VOCABULARY UNPREDICTABILITY (PERPLEXITY): Use synonyms instead of repeating words. Occasionally choose slightly less common words that fit naturally. Vary formality levels - not every sentence needs perfect formal grammar.

- NATURAL WRITING PATTERNS: Add subtle imperfections that feel human: intentional fragments for emphasis, strategic comma usage, varied pacing. Avoid making every sentence perfectly structured.

- AVOID AI-LIKE PATTERNS IN FIXES:
  * Don't create sequences of similar-length sentences
  * Don't use overly predictable word choices
  * Don't make every sentence perfectly grammatical
  * Don't create uniform paragraph structures
  * Do vary sentence beginnings dramatically
  * Do use occasional unconventional structures for emphasis
  * Do create natural rhythm through varied pacing

INTELLIGENT PARAGRAPH SPLITTING GUIDELINES:
1. Identify logical break points:
   - Dialogue exchanges (new paragraph per speaker)
   - Scene/time/location transitions
   - Topic or thought shifts
   - Action sequences (break at key moments)
   - Emotional beats (break for emphasis)
   - POV changes or internal monologue shifts

2. Don't break paragraphs:
   - Mid-thought or mid-action
   - In the middle of dialogue
   - During continuous narrative flow
   - Between closely related ideas

3. Vary paragraph lengths:
   - Short paragraphs (1-3 sentences) for impact/emphasis/action
   - Medium paragraphs (4-6 sentences) for standard narrative flow
   - Longer paragraphs (7-9 sentences) for complex scenes (but avoid >10)

SENTENCE STRUCTURE IMPROVEMENT GUIDELINES:
1. Combine related short sentences:
   - "He ran. He was fast." → "He ran, and he was fast." or "Running came naturally to him; he was fast."
   
2. Vary sentence beginnings:
   - Avoid starting multiple sentences with same word/pattern
   - Use different sentence structures (simple, compound, complex)
   - Start sentences with varied openings (subject, adverb, prepositional phrase, etc.)
   
3. Improve flow:
   - Add transitional words/phrases where needed (however, meanwhile, consequently, etc.)
   - Create logical connections between sentences
   - Maintain rhythm and pacing appropriate to the scene

4. Fix choppy patterns:
   - Pattern: "He walked. He stopped. He looked." 
   - Better: "He walked, then stopped to look around." or "After walking a few steps, he stopped and looked around."

DECIDING WHERE TO ADD TRANSITIONS:
- If Chapter N ends abruptly: Add transition at END of Chapter N (insertionLocation: 'before')
- If Chapter N+1 starts too suddenly: Add transition at START of Chapter N+1 (insertionLocation: 'after')
- If gap is large: Consider SPLIT - add setup at end of N, continuation at start of N+1 (insertionLocation: 'split')
- Choose location that flows most naturally with the story structure
}

CRITICAL REQUIREMENTS:
- Be thorough but fair - identify real issues, not nitpicking
- For minor issues (grammar, formatting), provide fixes immediately with exact originalText and fixedText
- For major issues (gaps, transitions, plot holes), describe the problem clearly with fix suggestions
- Maintain the author's voice and style in all fixes
- Provide specific chapter references - ALWAYS use the CORRECT chapter number from the chapters being analyzed
- Prioritize issues that affect story comprehension or flow
- ALWAYS verify chapter numbers in fixes match the chapters you're analyzing
- When providing fixes, include the EXACT text from the chapter (copy-paste it exactly)
- For chapter transition issues, provide transition text that bridges the gap
- For location/time jumps, provide explanatory text to smooth the transition
- Focus on professional editing concerns: story flow, continuity, character development, foreshadowing, transitions
- CRITICAL: All fixedText must read as authentically human-written - apply AI detection evasion principles (vary sentence length, vocabulary unpredictability, natural writing patterns) to ensure fixes don't introduce AI-like patterns`;

  const outputFormat = `Return ONLY valid JSON matching the structure above. Do not include any text outside the JSON. Ensure all strings are properly escaped for JSON.`;

  const specificConstraints = [
    'Return valid JSON only - no markdown, no explanatory text',
    'All strings must be properly escaped (use \\" for quotes, \\n for newlines)',
    'Issue descriptions must be specific and actionable',
    'Fixes must maintain the author\'s writing style and voice',
    'Provide context for all issues to help understand the problem',
    'Categorize issues correctly as minor (auto-fixable) or major (requires review)',
    'For grammar/style fixes, provide the exact original and fixed text',
    'For story flow issues, provide clear descriptions and suggestions',
    'For paragraph_structure fixes: Detect single-paragraph chapters and long paragraphs, intelligently split at logical break points',
    'For sentence_structure fixes: Detect choppy sentences and repetitive patterns, combine and vary sentence structure while maintaining meaning',
    'Structure fixes are typically auto-fixable as they improve readability without changing story content',
  ];

  // Build the user prompt directly with full chapter content (don't rely on buildPrompt to truncate)
  const userPrompt = `${taskDescription}

${outputFormat}

SPECIFIC CONSTRAINTS:
${specificConstraints.map(constraint => `- ${constraint}`).join('\n')}

CHAPTER NUMBERS TO USE IN FIXES: ${chaptersContent.map(ch => ch.number).join(', ')} ONLY. Do not use any other chapter numbers.`;

  return {
    systemInstruction: SYSTEM_INSTRUCTION || 'You are a professional novel editor.',
    userPrompt,
    contextSummary: `Analyzing ${chapterRange} of "${novelState.title}"`,
  };
}

/**
 * Builds a prompt for analyzing an entire arc
 */
export async function buildArcAnalysisPrompt(
  input: ArcEditorInput
): Promise<BuiltPrompt> {
  const { arc, chapters, novelState } = input;
  
  // Get all chapters in this arc
  const arcChapters = chapters.filter(ch => {
    if (!arc.startedAtChapter || !arc.endedAtChapter) return false;
    return ch.number >= arc.startedAtChapter && ch.number <= arc.endedAtChapter;
  }).sort((a, b) => a.number - b.number);

  const taskDescription = `You are a professional novel editor analyzing the complete arc "${arc.title}" of "${novelState.title}".

YOUR ROLE:
Perform a comprehensive edit review of this entire arc. Assess what was done well, what's missing, and what issues need to be fixed. Act as a senior editor reviewing a manuscript before publication.

ARC DETAILS:
- Title: ${arc.title}
- Description: ${arc.description || 'No description'}
- Chapters: ${arc.startedAtChapter} to ${arc.endedAtChapter} (${arcChapters.length} chapters)
- Status: ${arc.status}

CHAPTERS IN THIS ARC (Chapters ${arc.startedAtChapter} to ${arc.endedAtChapter}):

IMPORTANT: You are ONLY analyzing chapters ${arc.startedAtChapter} through ${arc.endedAtChapter}. When providing fixes, use ONLY these chapter numbers: ${arcChapters.map(ch => ch.number).join(', ')}. Do NOT reference or fix chapters outside this arc.

${arcChapters.map((ch, index) => `
${'='.repeat(80)}
CHAPTER ${ch.number}: "${ch.title}"
${'='.repeat(80)}
Summary: ${ch.summary || 'No summary'}
Logic Audit: ${ch.logicAudit ? JSON.stringify(ch.logicAudit, null, 2) : 'None'}

FULL CHAPTER CONTENT (${ch.content.length} characters):
${ch.content}

${index < arcChapters.length - 1 ? `\n${'─'.repeat(80)}\nTRANSITION CHECK: How does Chapter ${ch.number} END and Chapter ${arcChapters[index + 1].number} BEGIN?\n${'─'.repeat(80)}\n` : ''}
`).join('\n\n')}

COMPREHENSIVE ANALYSIS REQUIREMENTS:

1. ARC STRUCTURE:
   - Does the arc have a clear beginning, middle, and end?
   - Is the arc's central conflict established and resolved?
   - Are the arc's goals and stakes clear?
   - Does the arc flow naturally from start to finish?

2. STORY FLOW ACROSS THE ARC:
   - Check for gaps or missing transitions between chapters
   - Verify overall narrative coherence
   - Identify pacing issues (too fast/slow sections)
   - Check for logical progression of events

3. CHARACTER DEVELOPMENT:
   - Are characters developed meaningfully through the arc?
   - Do character arcs have clear progression?
   - Are character motivations consistent and clear?
   - Do relationships evolve naturally?

5. PLOT THREADS:
   - Are all major plot threads established in the arc?
   - Are plot threads properly developed and resolved (or set up for future arcs)?
   - Are there any loose ends that need addressing?
   - Is the arc properly setting up future arcs?

6. WHAT WAS DONE WELL:
   - Identify the arc's strongest elements
   - Highlight successful narrative techniques
   - Note particularly effective chapters or scenes
   - Identify moments of strong emotional impact

6. WHAT'S MISSING:
   - Identify gaps in character development
   - Note missing plot elements or explanations
   - Flag underdeveloped themes or motifs
   - Identify missed opportunities for foreshadowing or payoff

7. ISSUES THAT NEED FIXING:
   - Story flow issues
   - Continuity problems
   - Character inconsistencies
   - Plot holes
   - Pacing problems
   - Style inconsistencies

9. ARC COMPLETION:
   - Does the arc feel complete?
   - Is there a satisfying resolution (or setup for next arc)?
   - Are all major arc plot threads addressed?
   - Is the transition to the next arc (if any) smooth?
   - Is the writing structure consistent and professional throughout?

OUTPUT FORMAT:
Return ONLY valid JSON with the following structure:
{
  "analysis": {
    "overallFlow": "excellent" | "good" | "adequate" | "needs_work",
    "continuityScore": number (0-100),
    "structureScore": number (0-100),
    "characterDevelopmentScore": number (0-100),
    "summary": string (comprehensive 3-5 sentence summary of arc quality),
    "strengths": string[] (list of what was done well),
    "missing": string[] (list of what's missing or needs addition),
    "recommendations": string[] (key recommendations for improvement)
  },
  "issues": [
    {
      "type": "gap" | "transition" | "grammar" | "continuity" | "time_skip" | "character_consistency" | "plot_hole" | "structure" | "pacing" | "paragraph_structure" | "sentence_structure",
      "severity": "minor" | "major",
      "chapterNumber": number | null (null if arc-wide issue),
      "location": "start" | "middle" | "end" | "transition" | "arc_wide",
      "description": string,
      "suggestion": string,
      "autoFixable": boolean,
      "originalText": string | null,
      "context": string
    }
  ],
    "fixes": [
      {
        "issueId": string (reference to issue or chapter number),
        "chapterNumber": number | null (CRITICAL: If provided, MUST be one of: ${arcChapters.map(ch => ch.number).join(', ')}. Use null only for arc-wide fixes that don't target a specific chapter. Do NOT use chapter numbers outside this arc!),
        "fixType": string (same as issue type),
        "originalText": string | "" (CRITICAL: For replacements, include ONLY the specific sentence/paragraph being fixed - typically 10-100 words, NEVER more than 200 words. For paragraph structure fixes, include only 2-3 sentences before and after. For insertions: empty string "" or location marker),
        "fixedText": string (CRITICAL: For replacements, include ONLY the corrected version of the same portion (same length or shorter). For insertions: can be longer but keep under 500 words to ensure valid JSON. NEVER include entire chapter content),
        "reason": string (brief explanation - 1-2 sentences max, why this fix is needed),
        "insertionLocation": "before" | "after" | "split" (optional, for insertions: 'before' = end of chapter, 'after' = start of chapter, 'split' = both),
        "isInsertion": boolean (optional, true if this is a pure insertion, false/omit for replacements)
      }
    ],
  "readiness": {
    "isReadyForRelease": boolean,
    "blockingIssues": string[] (issues that must be fixed before release),
    "suggestedImprovements": string[] (non-blocking improvements)
  }
}

CRITICAL REQUIREMENTS:
- Provide comprehensive feedback suitable for a final review
- Be honest about what works and what doesn't
- Identify both strengths and weaknesses
- Prioritize issues that affect story comprehension or arc coherence
- Provide actionable recommendations
- Assess whether the arc is ready for release`;

  const outputFormat = `Return ONLY valid JSON matching the structure above. Do not include any text outside the JSON. Ensure all strings are properly escaped for JSON.`;

  const specificConstraints = [
    'Return valid JSON only - no markdown, no explanatory text',
    'Provide a comprehensive assessment suitable for arc completion review',
    'Be thorough in identifying both strengths and issues',
    'Prioritize issues that affect arc coherence or story quality',
    'Provide specific recommendations for improvement',
    'Assess readiness for release honestly',
    'CRITICAL: In fixes array, originalText and fixedText MUST be SHORT (10-200 words max per fix). Include ONLY the specific portion being fixed, NOT entire chapters or long paragraphs',
    'CRITICAL: If you must truncate text, do so at sentence boundaries. NEVER truncate mid-word',
    'CRITICAL: Properly escape ALL quotes, newlines, and special characters in JSON strings (use \\" for quotes, \\n for newlines, \\\\ for backslashes)',
    'CRITICAL: Prioritize completing the JSON structure over including long text. If response is getting too long, create fewer fixes rather than truncating JSON',
  ];

  // Build user prompt directly to ensure full chapter content is included
  // Don't use buildPrompt as it may truncate content - we need full arc chapters
  const userPromptWithFullChapters = `${taskDescription}

${outputFormat}

SPECIFIC CONSTRAINTS:
${specificConstraints.map(constraint => `- ${constraint}`).join('\n')}

REMINDER: chapterNumber in fixes MUST be one of: ${arcChapters.map(ch => ch.number).join(', ')} or null for arc-wide fixes. Do NOT use any other chapter numbers.`;

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: userPromptWithFullChapters,
    contextSummary: `Analyzing arc "${arc.title}" (chapters ${arc.startedAtChapter} to ${arc.endedAtChapter}) of "${novelState.title}"`,
  };
}
