import { NovelState, Chapter, Arc } from '../types';
import { EditorAnalysis, EditorIssue, EditorFix, ChapterBatchEditorInput, ArcEditorInput, EditorServiceOptions, OverallFlowRating, FixStatus } from '../types/editor';
import { buildChapterBatchAnalysisPrompt, buildArcAnalysisPrompt } from './promptEngine/writers/editorPromptWriter';
import { getActiveLlm } from './aiService';
import { deepseekJson } from './deepseekService';
import { SYSTEM_INSTRUCTION } from '../constants';
import { rateLimiter } from './rateLimiter';
import { generateUUID } from '../utils/uuid';
import { validateStructure } from '../utils/chapterFormatter';

function deepseekModelFromLlm(llm: string): 'deepseek-chat' | 'deepseek-reasoner' {
  return llm === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
}

/**
 * Editor Analyzer
 * Analyzes chapters using AI to detect issues with story flow, gaps, transitions, grammar, etc.
 */

/**
 * Analyzes a batch of chapters (typically 5)
 */
export async function analyzeChapterBatch(
  input: ChapterBatchEditorInput,
  options?: EditorServiceOptions
): Promise<EditorAnalysis> {
  const { chapters, novelState, startChapter, endChapter } = input;

  if (chapters.length === 0) {
    throw new Error('No chapters provided for analysis');
  }

  options?.onProgress?.('Building analysis prompt...', 10);

  // Pre-analyze structure issues to provide context to AI
  const structureAnalysis: string[] = [];
  
  chapters.forEach(chapter => {
    const structureCheck = validateStructure(chapter.content);
    if (!structureCheck.isValid && structureCheck.issues.length > 0) {
      structureAnalysis.push(
        `Chapter ${chapter.number}: ${structureCheck.issues.join('; ')}. Suggestions: ${structureCheck.suggestions.join('; ')}`
      );
    }
  });
  
  // Build the prompt (includes full chapter content)
  const builtPrompt = await buildChapterBatchAnalysisPrompt(input);
  
  // Enhance prompt with pre-detected structure issues if found
  if (structureAnalysis.length > 0) {
    const structureContext = `\n\nPRE-DETECTED STRUCTURE ISSUES:\n${structureAnalysis.join('\n')}\n\nPlease pay special attention to these structure issues and provide fixes for them.`;
    builtPrompt.userPrompt = builtPrompt.userPrompt + structureContext;
  }
  
  options?.onProgress?.('Calling AI for analysis...', 30);
  
  // Log which chapters we're analyzing for debugging
  console.log(`[Editor] Analyzing chapters: ${chapters.map(ch => ch.number).join(', ')}`);
  console.log(`[Editor] Chapter details:`, chapters.map(ch => ({
    number: ch.number,
    title: ch.title,
    contentLength: ch.content.length,
    id: ch.id
  })));
  
  // Verify the prompt includes the chapters we want
  if (builtPrompt.userPrompt) {
    const promptChapterMentions = chapters.map(ch => builtPrompt.userPrompt.includes(`CHAPTER ${ch.number}`) || builtPrompt.userPrompt.includes(`Chapter ${ch.number}`));
    if (!promptChapterMentions.every(m => m)) {
      console.warn(`[Editor] WARNING: Some chapters may not be fully included in the prompt!`);
    }
  }

  const llm = getActiveLlm();

  // Build JSON schema description for DeepSeek
  const jsonSchema = `{
    "analysis": {
      "overallFlow": "excellent" | "good" | "adequate" | "needs_work",
      "continuityScore": number (0-100),
      "grammarScore": number (0-100),
      "styleScore": number (0-100),
      "summary": string,
      "strengths": string[],
      "recommendations": string[]
    },
    "issues": [
      {
        "type": "gap" | "transition" | "grammar" | "continuity" | "time_skip" | "character_consistency" | "plot_hole" | "style" | "formatting",
        "severity": "minor" | "major",
        "chapterNumber": number,
        "location": "start" | "middle" | "end" | "transition",
        "description": string,
        "suggestion": string,
        "autoFixable": boolean,
        "originalText": string (optional),
        "context": string (optional)
      }
    ],
    "fixes": [
      {
        "issueId": string,
        "chapterNumber": number,
        "fixType": string,
        "originalText": string (ONLY the specific portion being fixed - NOT the entire chapter. For paragraph structure issues, include 2-3 sentences before and after the fix point),
        "fixedText": string (ONLY the fixed version of the same portion. Keep it concise - same length or shorter than originalText),
        "reason": string,
        "insertionLocation": "before" | "after" | "split" (optional, for insertions at chapter boundaries),
        "isInsertion": boolean (optional, true if this is a pure insertion)
      }
    ]
  }`;

  // Call DeepSeek API
  const parsed = await rateLimiter.queueRequest('analyze', async () => {
    return await deepseekJson<{
      analysis: {
        overallFlow: string;
        continuityScore: number;
        grammarScore: number;
        styleScore: number;
        summary: string;
        strengths: string[];
        recommendations: string[];
      };
      issues: Array<{
        type: string;
        severity: string;
        chapterNumber: number;
        location: string;
        description: string;
        suggestion: string;
        autoFixable: boolean;
        originalText?: string;
        context?: string;
      }>;
      fixes: Array<{
        issueId: string;
        chapterNumber: number;
        fixType: string;
        originalText: string | "";
        fixedText: string;
        reason: string;
        insertionLocation?: "before" | "after" | "split";
        isInsertion?: boolean;
      }>;
    }>({
      model: deepseekModelFromLlm(llm),
      system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
      user: builtPrompt.userPrompt + '\n\nReturn ONLY a valid JSON object matching this structure:\n' + jsonSchema + `\n\nCRITICAL JSON FORMATTING REQUIREMENTS:
1. ALL strings MUST be properly escaped (use \\n for newlines, \\" for quotes, \\\\ for backslashes)
2. For fixes array: originalText and fixedText MUST contain ONLY the specific portion being fixed, NOT entire chapters
3. For paragraph structure fixes: Include only 2-3 sentences before and after the fix point (50-200 words max per fix)
4. For grammar/style fixes: Include only the sentence or paragraph being fixed (typically 10-100 words)
5. Do NOT include full chapter content in originalText or fixedText - only the relevant portion
6. If a chapter needs multiple paragraph breaks, create separate fix entries for each section
7. Keep each fix's originalText and fixedText under 500 words to ensure valid JSON
8. Do NOT truncate strings mid-word - if you must truncate, do so at sentence boundaries
9. chapterNumber in fixes MUST be one of: ${chapters.map(ch => ch.number).join(', ')}. Triple-check every chapterNumber!
10. If you see chapter 16 in the novel, DO NOT use it - only use ${chapters.map(ch => ch.number).join(', ')}.`,
      temperature: 0.7,
      maxTokens: 8192, // DeepSeek API limit is 8192
    });
  }, `analyze-${novelState.id}-${startChapter}-${endChapter}`);

  options?.onProgress?.('Parsing analysis results...', 80);

  // Process issues and assign IDs
  const processedIssues: EditorIssue[] = (parsed.issues || []).map((issue: any, index: number) => {
    const chapter = chapters.find(ch => ch.number === issue.chapterNumber);
    return {
      id: generateUUID(),
      type: issue.type || 'style',
      severity: issue.severity || 'minor',
      chapterNumber: issue.chapterNumber || chapters[0]?.number || 0,
      chapterId: chapter?.id,
      location: issue.location || 'middle',
      description: issue.description || 'Issue detected',
      suggestion: issue.suggestion || 'Review needed',
      autoFixable: issue.autoFixable !== undefined ? issue.autoFixable : (issue.severity === 'minor'),
      originalText: issue.originalText || undefined,
      context: issue.context || undefined,
    };
  });

  // Get the chapter numbers that are being analyzed (for validation)
  const analyzedChapterNumbers = new Set(chapters.map(ch => ch.number));
  const analyzedChapterIds = new Set(chapters.map(ch => ch.id));

  // Process fixes and link to issues - improved matching logic with validation
  // First, filter out fixes with unreasonably long strings (likely contain entire chapters)
  const validFixes = (parsed.fixes || []).filter((fix: any) => {
    if (!fix) return false;
    // Check if originalText or fixedText is too long (over 2000 chars likely means entire chapter)
    const originalLength = fix.originalText?.length || 0;
    const fixedLength = fix.fixedText?.length || 0;
    if (originalLength > 2000 || fixedLength > 2000) {
      console.warn(`[Editor] Filtering out fix with very long text (original: ${originalLength}, fixed: ${fixedLength} chars). This likely contains entire chapter content.`);
      return false;
    }
    return true;
  });
  
  const processedFixes: EditorFix[] = validFixes.map((fix: any, fixIndex: number) => {
    // Extract chapter number from fix (preferred) or try to match to issue
    let fixChapterNumber = fix.chapterNumber || null;
    
    // Validate chapter number is in the analyzed set
    if (fixChapterNumber && !analyzedChapterNumbers.has(fixChapterNumber)) {
      console.warn(`Fix has chapter number ${fixChapterNumber} which is not in analyzed chapters ${Array.from(analyzedChapterNumbers).join(', ')}. Attempting to find correct chapter...`);
      fixChapterNumber = null; // Reset to find the correct chapter
    }
    
    // Try multiple strategies to match fix to issue
    let issue = processedIssues.find(
      (iss, idx) => fix.issueId === `issue-${idx}` || 
                   fix.issueId === iss.id || 
                   (fixChapterNumber && iss.chapterNumber === fixChapterNumber && iss.type === (fix.fixType || 'style')) ||
                   fix.issueId === String(iss.chapterNumber)
    );

    // If still no match, try matching by chapter number and type (only from analyzed chapters)
    if (!issue && fixChapterNumber) {
      issue = processedIssues.find(
        iss => iss.chapterNumber === fixChapterNumber && analyzedChapterNumbers.has(iss.chapterNumber) &&
               (iss.type === (fix.fixType || 'style') || !fix.fixType)
      );
    }

    // Try to match by originalText similarity (for orphaned fixes) - but only in analyzed chapters
    if (!issue && fix.originalText) {
      // Search through analyzed chapters to find which one contains this text
      for (const ch of chapters) {
        if (ch.content.includes(fix.originalText) || ch.content.toLowerCase().includes(fix.originalText.toLowerCase())) {
          // Found the chapter - now find matching issue
          issue = processedIssues.find(iss => 
            iss.chapterNumber === ch.number &&
            iss.originalText && fix.originalText && 
            (iss.originalText.includes(fix.originalText.substring(0, 50)) || 
             fix.originalText.includes(iss.originalText.substring(0, 50)))
          );
          if (issue) {
            fixChapterNumber = ch.number; // Update to correct chapter number
            break;
          }
        }
      }
    }

    // Last resort: match by index, but ONLY if the resulting chapter is in analyzed set
    if (!issue) {
      issue = processedIssues[fixIndex];
      if (issue && analyzedChapterNumbers.has(issue.chapterNumber)) {
        fixChapterNumber = issue.chapterNumber;
      } else {
        // Find first issue from analyzed chapters
        issue = processedIssues.find(iss => analyzedChapterNumbers.has(iss.chapterNumber));
        if (issue) {
          fixChapterNumber = issue.chapterNumber;
        }
      }
    }

    // CRITICAL: Find the chapter this fix applies to - MUST be from analyzed chapters only
    let chapter = null;
    
    if (fixChapterNumber && analyzedChapterNumbers.has(fixChapterNumber)) {
      chapter = chapters.find(ch => ch.number === fixChapterNumber);
    } else if (issue && analyzedChapterNumbers.has(issue.chapterNumber)) {
      chapter = chapters.find(ch => ch.number === issue.chapterNumber || ch.id === issue.chapterId);
    } else {
      // Last resort: try to find chapter by searching for originalText in analyzed chapters
      if (fix.originalText) {
        for (const ch of chapters) {
          if (ch.content.includes(fix.originalText) || ch.content.toLowerCase().includes(fix.originalText.toLowerCase())) {
            chapter = ch;
            fixChapterNumber = ch.number;
            break;
          }
        }
      }
    }

    // If still no chapter found, skip this fix - it doesn't belong to analyzed chapters
    if (!chapter) {
      console.warn(`Fix ${fixIndex} could not be matched to any analyzed chapter. Skipping fix. Chapter numbers analyzed: ${Array.from(analyzedChapterNumbers).join(', ')}`);
      return null;
    }

    // Validate that originalText exists in the chapter (if we have both)
    if (chapter && fix.originalText) {
      const hasText = chapter.content.includes(fix.originalText) || 
                      chapter.content.toLowerCase().includes(fix.originalText.toLowerCase());
      if (!hasText) {
        console.warn(`Fix originalText not found in chapter ${chapter.number}. Fix may not apply correctly. Text: "${fix.originalText.substring(0, 100)}..."`);
        // Still create the fix, but it may fail to apply later
      }
    }

    // Final validation: ensure chapter is in analyzed set
    if (!chapter || !analyzedChapterNumbers.has(chapter.number)) {
      console.warn(`Fix ${fixIndex} would apply to chapter ${chapter?.number || 'unknown'} which is not in analyzed set. Skipping.`);
      return null;
    }

    // Check if this is an insertion fix
    const isInsertion = fix.isInsertion || 
                       (!fix.originalText || fix.originalText.trim().length === 0) ||
                       (fix.fixType === 'gap' || fix.fixType === 'transition') ||
                       fix.insertionLocation;

    return {
      id: generateUUID(),
      issueId: issue?.id || generateUUID(),
      chapterId: chapter.id, // Use validated chapter ID
      chapterNumber: chapter.number, // Use validated chapter number
      fixType: (issue?.type || fix.fixType || 'style') as EditorIssue['type'],
      originalText: fix.originalText || issue?.originalText || '',
      fixedText: fix.fixedText || issue?.suggestion || '',
      reason: fix.reason || issue?.description || 'Fix suggested by editor',
      status: 'pending' as FixStatus,
      insertionLocation: fix.insertionLocation,
      isInsertion: isInsertion || fix.isInsertion,
    } as EditorFix;
  }).filter((fix): fix is EditorFix => {
    if (!fix || !fix.fixedText || fix.fixedText.trim().length === 0) {
      return false;
    }
    
    // For insertions, only need fixedText; for replacements, need originalText
    const isInsertion = fix.isInsertion || (!fix.originalText || fix.originalText.trim().length === 0);
    if (!isInsertion && (!fix.originalText || fix.originalText.trim().length === 0)) {
      return false;
    }
    
    // For replacements, check that originalText and fixedText are different
    if (!isInsertion && fix.originalText.trim() === fix.fixedText.trim()) {
      return false;
    }
    
    // Final validation: ensure chapter is in analyzed set
    return analyzedChapterNumbers.has(fix.chapterNumber);
  }); // Only keep valid fixes that apply to analyzed chapters

  // Build analysis result - include fixes in the response for proper handling
  const analysis: EditorAnalysis & { _fixes?: EditorFix[] } = {
    overallFlow: (parsed.analysis?.overallFlow || 'adequate') as OverallFlowRating,
    continuityScore: Math.max(0, Math.min(100, parsed.analysis?.continuityScore || 75)),
    grammarScore: Math.max(0, Math.min(100, parsed.analysis?.grammarScore || 75)),
    styleScore: Math.max(0, Math.min(100, parsed.analysis?.styleScore || 75)),
    summary: parsed.analysis?.summary || 'Analysis completed',
    strengths: parsed.analysis?.strengths || [],
    recommendations: parsed.analysis?.recommendations || [],
    issues: processedIssues,
    _fixes: processedFixes, // Include fixes in analysis for easier access
  };

  options?.onProgress?.('Analysis complete', 100);

  // Notify about issues found
  processedIssues.forEach(issue => {
    options?.onIssueFound?.(issue);
  });

  return analysis;
}

/**
 * Analyzes an entire arc
 */
export async function analyzeArc(
  input: ArcEditorInput,
  options?: EditorServiceOptions
): Promise<EditorAnalysis & { readiness?: { isReadyForRelease: boolean; blockingIssues: string[]; suggestedImprovements: string[] } }> {
  const { arc, chapters, novelState } = input;

  // Get chapters in this arc
  const arcChapters = chapters.filter(ch => {
    if (!arc.startedAtChapter || !arc.endedAtChapter) return false;
    return ch.number >= arc.startedAtChapter && ch.number <= arc.endedAtChapter;
  }).sort((a, b) => a.number - b.number);

  if (arcChapters.length === 0) {
    throw new Error('No chapters found in this arc');
  }

  options?.onProgress?.('Building arc analysis prompt...', 10);

  // Pre-analyze structure issues for arc chapters
  const arcStructureAnalysis: string[] = [];
  
  arcChapters.forEach(chapter => {
    const structureCheck = validateStructure(chapter.content);
    if (!structureCheck.isValid && structureCheck.issues.length > 0) {
      arcStructureAnalysis.push(
        `Chapter ${chapter.number}: ${structureCheck.issues.join('; ')}. Suggestions: ${structureCheck.suggestions.join('; ')}`
      );
    }
  });
  
  // Build the prompt
  const builtPrompt = await buildArcAnalysisPrompt(input);
  
  // Enhance prompt with pre-detected structure issues if found
  if (arcStructureAnalysis.length > 0) {
    const structureContext = `\n\nPRE-DETECTED STRUCTURE ISSUES IN ARC:\n${arcStructureAnalysis.join('\n')}\n\nPlease pay special attention to these structure issues and provide fixes for them.`;
    builtPrompt.userPrompt = builtPrompt.userPrompt + structureContext;
  }
  
  options?.onProgress?.('Calling AI for arc analysis...', 30);

  const llm = getActiveLlm();

  // Build JSON schema description for DeepSeek (arc-specific)
  const jsonSchema = `{
    "analysis": {
      "overallFlow": "excellent" | "good" | "adequate" | "needs_work",
      "continuityScore": number (0-100),
      "structureScore": number (0-100),
      "characterDevelopmentScore": number (0-100),
      "summary": string,
      "strengths": string[],
      "missing": string[],
      "recommendations": string[]
    },
    "issues": [
      {
        "type": "gap" | "transition" | "grammar" | "continuity" | "time_skip" | "character_consistency" | "plot_hole" | "structure" | "pacing" | "paragraph_structure" | "sentence_structure",
        "severity": "minor" | "major",
        "chapterNumber": number | null,
        "location": "start" | "middle" | "end" | "transition" | "arc_wide",
        "description": string,
        "suggestion": string,
        "autoFixable": boolean,
        "originalText": string (optional),
        "context": string (optional)
      }
    ],
    "fixes": [
      {
        "issueId": string,
        "chapterNumber": number | null,
        "fixType": string,
        "originalText": string,
        "fixedText": string,
        "reason": string
      }
    ],
    "readiness": {
      "isReadyForRelease": boolean,
      "blockingIssues": string[],
      "suggestedImprovements": string[]
    }
  }`;

  // Call DeepSeek API with error handling for partial responses
  let parsed: {
    analysis?: {
      overallFlow?: string;
      continuityScore?: number;
      structureScore?: number;
      characterDevelopmentScore?: number;
      summary?: string;
      strengths?: string[];
      missing?: string[];
      recommendations?: string[];
    };
    issues?: Array<{
      type: string;
      severity: string;
      chapterNumber: number | null;
      location: string;
      description: string;
      suggestion: string;
      autoFixable: boolean;
      originalText?: string;
      context?: string;
    }>;
    fixes?: Array<{
      issueId: string;
      chapterNumber: number | null;
      fixType: string;
      originalText: string | "";
      fixedText: string;
      reason: string;
      insertionLocation?: "before" | "after" | "split";
      isInsertion?: boolean;
    }>;
    readiness?: {
      isReadyForRelease?: boolean;
      blockingIssues?: string[];
      suggestedImprovements?: string[];
    };
  };

  try {
    parsed = await rateLimiter.queueRequest('analyze-arc', async () => {
      return await deepseekJson<{
        analysis: {
          overallFlow: string;
          continuityScore: number;
          structureScore: number;
          characterDevelopmentScore: number;
          summary: string;
          strengths: string[];
          missing: string[];
          recommendations: string[];
        };
        issues: Array<{
          type: string;
          severity: string;
          chapterNumber: number | null;
          location: string;
          description: string;
          suggestion: string;
          autoFixable: boolean;
          originalText?: string;
          context?: string;
        }>;
        fixes: Array<{
          issueId: string;
          chapterNumber: number | null;
          fixType: string;
          originalText: string | "";
          fixedText: string;
          reason: string;
          insertionLocation?: "before" | "after" | "split";
          isInsertion?: boolean;
        }>;
        readiness: {
          isReadyForRelease: boolean;
          blockingIssues: string[];
          suggestedImprovements: string[];
        };
      }>({
        model: deepseekModelFromLlm(llm),
        system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
        user: builtPrompt.userPrompt + '\n\nReturn ONLY a valid JSON object matching this structure:\n' + jsonSchema + `\n\nCRITICAL JSON FORMATTING REQUIREMENTS (MUST FOLLOW TO AVOID TRUNCATION):
1. ALL strings MUST be properly escaped (use \\n for newlines, \\" for quotes, \\\\ for backslashes)
2. For fixes array: originalText and fixedText MUST be SHORT (10-200 words max per fix). Include ONLY the specific sentence/paragraph being fixed, NOT entire chapters or long excerpts
3. For paragraph structure fixes: Include only 2-3 sentences before and after the fix point (50-150 words max per fix)
4. For grammar/style fixes: Include only the sentence or short paragraph being fixed (typically 10-50 words)
5. Do NOT include full chapter content in originalText or fixedText - only the relevant small portion
6. If a chapter needs multiple paragraph breaks, create separate fix entries for each section, but keep each one under 150 words
7. CRITICAL: Keep each fix's originalText under 200 words and fixedText under 300 words to ensure valid JSON that fits within token limits
8. Do NOT truncate strings mid-word - if you must truncate, do so at sentence boundaries
9. chapterNumber in fixes MUST be one of: ${arcChapters.map(ch => ch.number).join(', ')} or null for arc-wide fixes. Triple-check every chapterNumber!
10. For arc-wide fixes, use null for chapterNumber
11. PRIORITIZE completing the JSON structure over including long text - if response is getting too long, create fewer fixes rather than truncating JSON
12. If you must choose between including all fixes or valid JSON, choose valid JSON - incomplete fixes can be added later`,
        temperature: 0.7,
        maxTokens: 6000, // Reduced from 8192 for arc analysis to leave room and prevent truncation
      });
    }, `analyze-arc-${novelState.id}-${arc.id}`);
  } catch (error) {
    // Check if we got a partial response (common with large arcs)
    if (error instanceof Error && error.message.includes('invalid JSON')) {
      console.warn('[Editor] Arc analysis returned invalid JSON - this may be due to response truncation for large arcs.');
      console.warn('[Editor] Consider analyzing the arc in smaller chapter batches, or the AI may have included too much text in fixes.');
      throw new Error(
        `Arc analysis failed: The AI response was too large and got truncated, resulting in invalid JSON. ` +
        `This commonly happens with large arcs (${arcChapters.length} chapters). ` +
        `The AI may have included too much chapter content in the fixes. ` +
        `Try analyzing smaller chapter batches instead, or the system will retry with stricter constraints. ` +
        `Original error: ${error.message.substring(0, 500)}`
      );
    }
    throw error;
  }

  options?.onProgress?.('Parsing arc analysis results...', 80);

  // Get the chapter numbers in the arc (for validation)
  const arcChapterNumbers = new Set(arcChapters.map(ch => ch.number));

  // Process issues - validate chapter numbers
  const processedIssues: EditorIssue[] = (parsed.issues || []).map((issue: any, index: number) => {
    // Validate issue chapter number is in arc (or null for arc-wide issues)
    let issueChapterNumber = issue.chapterNumber;
    
    // Null is allowed for arc-wide issues, but if a number is provided, it must be in the arc
    if (issueChapterNumber !== null && issueChapterNumber !== undefined && !arcChapterNumbers.has(issueChapterNumber)) {
      console.warn(`Arc issue ${index} has chapter number ${issueChapterNumber} which is not in arc chapters ${Array.from(arcChapterNumbers).join(', ')}. Attempting to find correct chapter...`);
      // Try to find the chapter by searching for the originalText in arc chapters
      if (issue.originalText) {
        for (const ch of arcChapters) {
          if (ch.content.includes(issue.originalText) || ch.content.toLowerCase().includes(issue.originalText.toLowerCase())) {
            issueChapterNumber = ch.number;
            break;
          }
        }
      }
      // If still not found and it's not a null/arc-wide issue, use first chapter as fallback
      if ((issueChapterNumber !== null && issueChapterNumber !== undefined) && !arcChapterNumbers.has(issueChapterNumber)) {
        issueChapterNumber = null; // Treat as arc-wide if we can't match it
        console.warn(`Arc issue ${index} could not be matched to arc chapters. Treating as arc-wide issue.`);
      }
    }
    
    const chapter = issueChapterNumber !== null && issueChapterNumber !== undefined
      ? arcChapters.find(ch => ch.number === issueChapterNumber)
      : null;
    
    return {
      id: generateUUID(),
      type: issue.type || 'style',
      severity: issue.severity || 'minor',
      chapterNumber: issueChapterNumber || 0, // 0 if arc-wide
      chapterId: chapter?.id,
      location: issue.location || 'arc_wide',
      description: issue.description || 'Issue detected',
      suggestion: issue.suggestion || 'Review needed',
      autoFixable: issue.autoFixable !== undefined ? issue.autoFixable : (issue.severity === 'minor'),
      originalText: issue.originalText || undefined,
      context: issue.context || undefined,
    };
  }).filter(issue => 
    issue.chapterNumber === null || 
    issue.chapterNumber === 0 || 
    issue.chapterNumber === undefined || 
    arcChapterNumbers.has(issue.chapterNumber)
  ); // Only keep issues in arc chapters or arc-wide issues

  // Get the chapter IDs in the arc (for validation)
  const arcChapterIds = new Set(arcChapters.map(ch => ch.id));

  // Process fixes - improved matching logic with validation for arc
  // First, filter out fixes with unreasonably long strings (likely contain entire chapters)
  const validFixes = (parsed.fixes || []).filter((fix: any) => {
    if (!fix) return false;
    // Check if originalText or fixedText is too long (over 2000 chars likely means entire chapter)
    const originalLength = fix.originalText?.length || 0;
    const fixedLength = fix.fixedText?.length || 0;
    if (originalLength > 2000 || fixedLength > 2000) {
      console.warn(`[Editor] Filtering out fix with very long text (original: ${originalLength}, fixed: ${fixedLength} chars). This likely contains entire chapter content.`);
      return false;
    }
    return true;
  });
  
  const processedFixes: EditorFix[] = validFixes.map((fix: any, fixIndex: number) => {
    // Extract chapter number from fix (preferred) or try to match to issue
    let fixChapterNumber = fix.chapterNumber || null;
    
    // Validate chapter number is in the arc
    if (fixChapterNumber && !arcChapterNumbers.has(fixChapterNumber)) {
      console.warn(`Arc fix has chapter number ${fixChapterNumber} which is not in arc chapters ${Array.from(arcChapterNumbers).join(', ')}. Attempting to find correct chapter...`);
      fixChapterNumber = null; // Reset to find the correct chapter
    }
    
    // Try multiple strategies to match fix to issue
    let issue = processedIssues.find(
      (iss, idx) => fix.issueId === `issue-${idx}` || 
                   fix.issueId === iss.id ||
                   (fixChapterNumber && iss.chapterNumber === fixChapterNumber && iss.type === (fix.fixType || 'style')) ||
                   fix.issueId === iss.chapterId
    );

    // If still no match, try matching by chapter number and type (only from arc chapters)
    if (!issue && fixChapterNumber) {
      issue = processedIssues.find(
        iss => iss.chapterNumber === fixChapterNumber && arcChapterNumbers.has(iss.chapterNumber) &&
               (iss.type === (fix.fixType || 'style') || !fix.fixType)
      );
    }

    // Try to match by originalText similarity (for orphaned fixes) - but only in arc chapters
    if (!issue && fix.originalText) {
      // Search through arc chapters to find which one contains this text
      for (const ch of arcChapters) {
        if (ch.content.includes(fix.originalText) || ch.content.toLowerCase().includes(fix.originalText.toLowerCase())) {
          // Found the chapter - now find matching issue
          issue = processedIssues.find(iss => 
            iss.chapterNumber === ch.number &&
            iss.originalText && fix.originalText && 
            (iss.originalText.includes(fix.originalText.substring(0, 50)) || 
             fix.originalText.includes(iss.originalText.substring(0, 50)))
          );
          if (issue) {
            fixChapterNumber = ch.number; // Update to correct chapter number
            break;
          }
        }
      }
    }

    // Last resort: match by index, but ONLY if the resulting chapter is in arc
    if (!issue) {
      issue = processedIssues[fixIndex];
      if (issue && arcChapterNumbers.has(issue.chapterNumber)) {
        fixChapterNumber = issue.chapterNumber;
      } else {
        // Find first issue from arc chapters
        issue = processedIssues.find(iss => arcChapterNumbers.has(iss.chapterNumber));
        if (issue) {
          fixChapterNumber = issue.chapterNumber;
        }
      }
    }

    // CRITICAL: Find the chapter this fix applies to - MUST be from arc chapters only
    let chapter = null;
    
    if (fixChapterNumber && arcChapterNumbers.has(fixChapterNumber)) {
      chapter = arcChapters.find(ch => ch.number === fixChapterNumber);
    } else if (issue && arcChapterNumbers.has(issue.chapterNumber)) {
      chapter = arcChapters.find(ch => ch.number === issue.chapterNumber || ch.id === issue.chapterId);
    } else {
      // Last resort: try to find chapter by searching for originalText in arc chapters
      if (fix.originalText) {
        for (const ch of arcChapters) {
          if (ch.content.includes(fix.originalText) || ch.content.toLowerCase().includes(fix.originalText.toLowerCase())) {
            chapter = ch;
            fixChapterNumber = ch.number;
            break;
          }
        }
      }
    }

    // If still no chapter found, skip this fix - it doesn't belong to arc chapters
    if (!chapter) {
      console.warn(`Arc fix ${fixIndex} could not be matched to any arc chapter. Skipping fix. Arc chapters: ${Array.from(arcChapterNumbers).join(', ')}`);
      return null;
    }

    // Check if this is an insertion fix
    const isInsertion = fix.isInsertion || 
                       (!fix.originalText || fix.originalText.trim().length === 0) ||
                       (fix.fixType === 'gap' || fix.fixType === 'transition') ||
                       fix.insertionLocation;
    
    // For insertions, don't require originalText to exist in chapter
    // For replacements, validate that originalText exists in the chapter
    if (chapter && fix.originalText && fix.originalText.trim().length > 0 && !isInsertion) {
      const hasText = chapter.content.includes(fix.originalText) || 
                      chapter.content.toLowerCase().includes(fix.originalText.toLowerCase());
      if (!hasText) {
        console.warn(`Arc fix originalText not found in chapter ${chapter.number}. Fix may not apply correctly. Text: "${fix.originalText.substring(0, 100)}..."`);
      }
    }
    
    // Mark as insertion if detected
    if (isInsertion && !fix.isInsertion) {
      fix.isInsertion = true;
    }

    // Final validation: ensure chapter is in arc
    if (!chapter || !arcChapterNumbers.has(chapter.number)) {
      console.warn(`Arc fix ${fixIndex} would apply to chapter ${chapter?.number || 'unknown'} which is not in arc. Skipping.`);
      return null;
    }

    return {
      id: generateUUID(),
      issueId: issue?.id || generateUUID(),
      chapterId: chapter.id, // Use validated chapter ID
      chapterNumber: chapter.number, // Use validated chapter number
      fixType: (issue?.type || fix.fixType || 'style') as EditorIssue['type'],
      originalText: fix.originalText || issue?.originalText || '',
      fixedText: fix.fixedText || issue?.suggestion || '',
      reason: fix.reason || issue?.description || 'Fix suggested by editor',
      status: 'pending' as FixStatus,
    } as EditorFix;
  }).filter((fix): fix is EditorFix => {
    if (!fix || !fix.fixedText || fix.fixedText.trim().length === 0) {
      return false;
    }
    
    // For insertions, only need fixedText; for replacements, need originalText
    const isInsertion = fix.isInsertion || (!fix.originalText || fix.originalText.trim().length === 0);
    if (!isInsertion && (!fix.originalText || fix.originalText.trim().length === 0)) {
      return false;
    }
    
    // For replacements, check that originalText and fixedText are different
    if (!isInsertion && fix.originalText.trim() === fix.fixedText.trim()) {
      return false;
    }
    
    // Final validation: ensure chapter is in arc (or null for arc-wide)
    return fix.chapterNumber === null || fix.chapterNumber === 0 || arcChapterNumbers.has(fix.chapterNumber);
  }); // Only keep valid fixes that apply to arc chapters

  // Build analysis result with arc-specific scores - include fixes
  const analysis: EditorAnalysis & { 
    readiness?: { isReadyForRelease: boolean; blockingIssues: string[]; suggestedImprovements: string[] };
    _fixes?: EditorFix[];
  } = {
    overallFlow: (parsed.analysis?.overallFlow || 'adequate') as OverallFlowRating,
    continuityScore: Math.max(0, Math.min(100, parsed.analysis?.continuityScore || 75)),
    grammarScore: Math.max(0, Math.min(100, parsed.analysis?.structureScore || 75)),
    styleScore: Math.max(0, Math.min(100, parsed.analysis?.characterDevelopmentScore || 75)),
    summary: parsed.analysis?.summary || 'Arc analysis completed',
    strengths: parsed.analysis?.strengths || [],
    recommendations: parsed.analysis?.recommendations || [],
    issues: processedIssues,
    readiness: {
      isReadyForRelease: parsed.readiness?.isReadyForRelease || false,
      blockingIssues: parsed.readiness?.blockingIssues || [],
      suggestedImprovements: parsed.readiness?.suggestedImprovements || [],
    },
    _fixes: processedFixes, // Include fixes in analysis for easier access
  };

  options?.onProgress?.('Arc analysis complete', 100);

  // Notify about issues found
  processedIssues.forEach(issue => {
    options?.onIssueFound?.(issue);
  });

  return analysis;
}
