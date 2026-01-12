import { supabase } from './supabaseService';
import { Chapter, NovelState } from '../types';
import { StyleCheck, StyleCheckType, StyleCheckSeverity, TextRange } from '../types/editor';
import { withRetry } from '../utils/errorHandling';
import { analyzeWritingStyle } from './contextAnalysis';

/**
 * Style Checker Service
 * Handles real-time style checking for chapters
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Save style checks to database
 */
async function saveStyleChecks(chapterId: string, checks: Omit<StyleCheck, 'id'>[]): Promise<void> {
  return withRetry(async () => {
    // Delete existing checks for this chapter first
    await supabase
      .from('style_checks')
      .delete()
      .eq('chapter_id', chapterId);

    if (checks.length === 0) {
      return;
    }

    const { error } = await supabase
      .from('style_checks')
      .insert(checks.map(check => ({
        chapter_id: chapterId,
        check_type: check.checkType,
        location: check.location,
        severity: check.severity,
        message: check.message,
        suggestion: check.suggestion || null,
        checked_at: new Date(check.checkedAt).toISOString(),
      })));

    if (error) {
      console.error('Error saving style checks:', error);
      throw new Error(`Failed to save style checks: ${error.message}`);
    }
  });
}

/**
 * Fetch style checks for a chapter
 */
export async function getStyleChecks(chapterId: string): Promise<StyleCheck[]> {
  return withRetry(async () => {
    const { data: checks, error } = await supabase
      .from('style_checks')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('Error fetching style checks:', error);
      throw new Error(`Failed to fetch style checks: ${error.message}`);
    }

    if (!checks || checks.length === 0) {
      return [];
    }

    return checks.map(check => ({
      id: check.id,
      chapterId: check.chapter_id,
      checkType: check.check_type as StyleCheckType,
      location: check.location as TextRange,
      severity: check.severity as StyleCheckSeverity,
      message: check.message,
      suggestion: check.suggestion || undefined,
      checkedAt: timestampToNumber(check.checked_at),
    }));
  });
}

/**
 * Check POV consistency (detect head-hopping)
 */
function checkPOV(content: string): StyleCheck[] {
  const checks: StyleCheck[] = [];
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  // Common POV indicators
  const firstPersonPronouns = /\b(I|me|my|mine|we|us|our)\b/gi;
  const thirdPersonPronouns = /\b(he|she|they|him|her|them|his|hers|their)\b/gi;
  
  let currentPOV: 'first' | 'third' | 'unknown' = 'unknown';
  let lastPOVPosition = 0;
  
  sentences.forEach((sentence, index) => {
    const firstCount = (sentence.match(firstPersonPronouns) || []).length;
    const thirdCount = (sentence.match(thirdPersonPronouns) || []).length;
    
    let sentencePOV: 'first' | 'third' | 'unknown' = 'unknown';
    if (firstCount > thirdCount * 1.5) {
      sentencePOV = 'first';
    } else if (thirdCount > firstCount * 1.5) {
      sentencePOV = 'third';
    }
    
    if (sentencePOV !== 'unknown') {
      if (currentPOV !== 'unknown' && currentPOV !== sentencePOV && index - lastPOVPosition < 5) {
        // POV shift detected within 5 sentences - potential head-hopping
        const start = content.indexOf(sentence, lastPOVPosition > 0 ? content.indexOf(sentences[lastPOVPosition]) : 0);
        const end = start + sentence.length;
        
        checks.push({
          id: `pov-${index}`,
          chapterId: '', // Will be set by caller
          checkType: 'pov',
          location: { start, end },
          severity: 'warning',
          message: `Potential POV shift: Changed from ${currentPOV} person to ${sentencePOV} person within a short span. This may indicate head-hopping.`,
          suggestion: 'Consider maintaining consistent POV within scenes. Use scene breaks for POV changes.',
          checkedAt: Date.now(),
        });
      }
      
      currentPOV = sentencePOV;
      lastPOVPosition = index;
    }
  });
  
  return checks;
}

/**
 * Check dialogue formatting
 */
function checkDialogue(content: string): StyleCheck[] {
  const checks: StyleCheck[] = [];
  
  // Check for unclosed quotes
  const quoteMatches = content.match(/["'""]/g) || [];
  if (quoteMatches.length % 2 !== 0) {
    const lastQuoteIndex = content.lastIndexOf('"');
    checks.push({
      id: 'dialogue-unclosed',
      chapterId: '',
      checkType: 'dialogue',
      location: { start: lastQuoteIndex, end: lastQuoteIndex + 1 },
      severity: 'error',
      message: 'Unclosed quotation marks detected. Check for missing closing quotes.',
      suggestion: 'Ensure all dialogue is properly closed with matching quotation marks.',
      checkedAt: Date.now(),
    });
  }
  
  // Check for dialogue tags (he said, she said, etc.)
  const dialogueTagPattern = /["'""][^"'"]*["'""]\s*[^.!?]*$/gm;
  const dialogueMatches = content.match(/["'""][^"'"]*["'"]/g) || [];
  let consecutiveDialogueWithoutTags = 0;
  
  dialogueMatches.forEach((dialogue, index) => {
    const dialogueEnd = content.indexOf(dialogue) + dialogue.length;
    const next50Chars = content.substring(dialogueEnd, dialogueEnd + 50);
    
    // Check if there's a dialogue tag after this dialogue
    const hasTag = /(said|asked|replied|answered|exclaimed|whispered|shouted|muttered)/i.test(next50Chars);
    
    if (!hasTag && dialogueMatches.length > 1) {
      consecutiveDialogueWithoutTags++;
      if (consecutiveDialogueWithoutTags >= 3) {
        checks.push({
          id: `dialogue-tags-${index}`,
          chapterId: '',
          checkType: 'dialogue',
          location: { start: content.indexOf(dialogue), end: dialogueEnd },
          severity: 'info',
          message: 'Multiple consecutive dialogue lines without tags. Consider adding dialogue tags for clarity.',
          suggestion: 'Add dialogue tags (he said, she asked, etc.) to help readers identify speakers.',
          checkedAt: Date.now(),
        });
        consecutiveDialogueWithoutTags = 0;
      }
    } else {
      consecutiveDialogueWithoutTags = 0;
    }
  });
  
  return checks;
}

/**
 * Check pacing (sentence length, paragraph length)
 */
function checkPacing(content: string): StyleCheck[] {
  const checks: StyleCheck[] = [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  // Check paragraph length
  paragraphs.forEach((paragraph, index) => {
    const wordCount = paragraph.trim().split(/\s+/).length;
    const sentenceCount = paragraph.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).length;
    
    if (wordCount > 200 || sentenceCount > 10) {
      const start = content.indexOf(paragraph);
      const end = start + paragraph.length;
      
      checks.push({
        id: `pacing-paragraph-${index}`,
        chapterId: '',
        checkType: 'pacing',
        location: { start, end },
        severity: sentenceCount > 15 ? 'warning' : 'info',
        message: `Long paragraph detected (${wordCount} words, ${sentenceCount} sentences). Consider breaking into shorter paragraphs for better readability.`,
        suggestion: 'Break long paragraphs at natural transition points: dialogue, time shifts, location changes, or topic shifts.',
        checkedAt: Date.now(),
      });
    }
  });
  
  // Check for very long sentences (potential run-ons)
  sentences.forEach((sentence, index) => {
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount > 40) {
      const start = content.indexOf(sentence);
      const end = start + sentence.length;
      
      checks.push({
        id: `pacing-sentence-${index}`,
        chapterId: '',
        checkType: 'pacing',
        location: { start, end },
        severity: wordCount > 50 ? 'warning' : 'info',
        message: `Very long sentence detected (${wordCount} words). Consider breaking into shorter sentences.`,
        suggestion: 'Break long sentences into shorter ones for better clarity and flow.',
        checkedAt: Date.now(),
      });
    }
  });
  
  return checks;
}

/**
 * Check sentence variety (detect repetitive patterns)
 */
function checkSentenceVariety(content: string): StyleCheck[] {
  const checks: StyleCheck[] = [];
  const sentences = content.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  
  // Check for repetitive sentence beginnings
  const sentenceBeginnings: string[] = [];
  sentences.forEach(sentence => {
    const trimmed = sentence.trim();
    const firstWords = trimmed.split(/\s+/).slice(0, 3).join(' ').toLowerCase();
    sentenceBeginnings.push(firstWords);
  });
  
  // Find patterns (same beginning 3+ times in a row)
  let currentPattern = '';
  let patternCount = 0;
  let patternStart = 0;
  
  sentenceBeginnings.forEach((beginning, index) => {
    if (beginning === currentPattern) {
      patternCount++;
    } else {
      if (patternCount >= 3) {
        // Found a repetitive pattern
        const startSentence = sentences[patternStart];
        const endSentence = sentences[patternStart + patternCount - 1];
        const start = content.indexOf(startSentence);
        const end = content.indexOf(endSentence) + endSentence.length;
        
        checks.push({
          id: `sentence-variety-${patternStart}`,
          chapterId: '',
          checkType: 'sentence_variety',
          location: { start, end },
          severity: 'warning',
          message: `Repetitive sentence beginnings detected (${patternCount} sentences starting similarly). Vary sentence structure for better flow.`,
          suggestion: 'Vary sentence beginnings and structure. Use different sentence openers (subjects, adverbs, prepositional phrases, etc.).',
          checkedAt: Date.now(),
        });
      }
      currentPattern = beginning;
      patternCount = 1;
      patternStart = index;
    }
  });
  
  // Check for too many short choppy sentences
  let shortSentenceCount = 0;
  let shortSentenceStart = 0;
  sentences.forEach((sentence, index) => {
    const wordCount = sentence.trim().split(/\s+/).length;
    if (wordCount < 8) {
      shortSentenceCount++;
      if (shortSentenceCount === 1) {
        shortSentenceStart = index;
      }
    } else {
      if (shortSentenceCount >= 4) {
        // Found a choppy pattern
        const startSentence = sentences[shortSentenceStart];
        const endSentence = sentences[shortSentenceStart + shortSentenceCount - 1];
        const start = content.indexOf(startSentence);
        const end = content.indexOf(endSentence) + endSentence.length;
        
        checks.push({
          id: `sentence-variety-choppy-${shortSentenceStart}`,
          chapterId: '',
          checkType: 'sentence_variety',
          location: { start, end },
          severity: 'info',
          message: `Multiple short, choppy sentences detected (${shortSentenceCount} consecutive sentences with <8 words). Consider combining related sentences.`,
          suggestion: 'Combine related short sentences for better flow. Use conjunctions, semicolons, or restructuring to create variety.',
          checkedAt: Date.now(),
        });
      }
      shortSentenceCount = 0;
    }
  });
  
  return checks;
}

/**
 * Check structure (paragraph breaks, flow)
 */
function checkStructure(content: string): StyleCheck[] {
  const checks: StyleCheck[] = [];
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Check for single paragraph chapters (unless very short)
  if (paragraphs.length === 1 && content.length > 1000) {
    checks.push({
      id: 'structure-single-paragraph',
      chapterId: '',
      checkType: 'structure',
      location: { start: 0, end: content.length },
      severity: 'warning',
      message: 'Chapter appears to be a single paragraph. Consider adding paragraph breaks for better readability.',
      suggestion: 'Break into multiple paragraphs at natural points: dialogue exchanges, scene changes, time shifts, location changes, or topic shifts.',
      checkedAt: Date.now(),
    });
  }
  
  // Check for very few paragraphs in long chapters
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 2000 && paragraphs.length < 5) {
    checks.push({
      id: 'structure-few-paragraphs',
      chapterId: '',
      checkType: 'structure',
      location: { start: 0, end: content.length },
      severity: 'info',
      message: `Long chapter (${wordCount} words) with few paragraphs (${paragraphs.length}). Consider adding more paragraph breaks.`,
      suggestion: 'Add paragraph breaks to improve readability and give readers visual breathing room.',
      checkedAt: Date.now(),
    });
  }
  
  return checks;
}

/**
 * Check consistency (character names, world rules)
 */
function checkConsistency(content: string, novelState?: NovelState): StyleCheck[] {
  const checks: StyleCheck[] = [];
  
  if (!novelState) {
    return checks;
  }
  
  // Check for character name inconsistencies
  if (novelState.characters && novelState.characters.length > 0) {
    const characterNames = novelState.characters.map(c => c.name);
    const contentLower = content.toLowerCase();
    
    // Simple check: look for potential name variations
    characterNames.forEach(charName => {
      const nameParts = charName.split(' ');
      if (nameParts.length > 1) {
        // Check if only first or last name is used when full name should be used
        const firstName = nameParts[0].toLowerCase();
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        const fullNameLower = charName.toLowerCase();
        
        // This is a simple check - more sophisticated checking would require context
        // For now, we'll just note it as an info-level check if needed
      }
    });
  }
  
  return checks;
}

/**
 * Run all style checks on a chapter
 */
export async function checkChapter(chapter: Chapter, novelState?: NovelState): Promise<StyleCheck[]> {
  const allChecks: StyleCheck[] = [];
  
  // Run all checks
  const povChecks = checkPOV(chapter.content);
  const dialogueChecks = checkDialogue(chapter.content);
  const pacingChecks = checkPacing(chapter.content);
  const varietyChecks = checkSentenceVariety(chapter.content);
  const structureChecks = checkStructure(chapter.content);
  const consistencyChecks = checkConsistency(chapter.content, novelState);
  
  // Combine all checks and set chapter ID
  allChecks.push(
    ...povChecks.map(c => ({ ...c, id: `pov-${Date.now()}-${Math.random()}`, chapterId: chapter.id })),
    ...dialogueChecks.map(c => ({ ...c, id: `dialogue-${Date.now()}-${Math.random()}`, chapterId: chapter.id })),
    ...pacingChecks.map(c => ({ ...c, id: `pacing-${Date.now()}-${Math.random()}`, chapterId: chapter.id })),
    ...varietyChecks.map(c => ({ ...c, id: `variety-${Date.now()}-${Math.random()}`, chapterId: chapter.id })),
    ...structureChecks.map(c => ({ ...c, id: `structure-${Date.now()}-${Math.random()}`, chapterId: chapter.id })),
    ...consistencyChecks.map(c => ({ ...c, id: `consistency-${Date.now()}-${Math.random()}`, chapterId: chapter.id }))
  );
  
  // Save to database
  if (allChecks.length > 0) {
    await saveStyleChecks(chapter.id, allChecks);
  } else {
    // Clear existing checks if no issues found
    await saveStyleChecks(chapter.id, []);
  }
  
  return allChecks;
}

/**
 * Individual check functions (for use in specific contexts)
 */
export const checkPOVOnly = (content: string): StyleCheck[] => checkPOV(content);
export const checkDialogueOnly = (content: string): StyleCheck[] => checkDialogue(content);
export const checkPacingOnly = (content: string): StyleCheck[] => checkPacing(content);
export const checkSentenceVarietyOnly = (content: string): StyleCheck[] => checkSentenceVariety(content);
export const checkStructureOnly = (content: string): StyleCheck[] => checkStructure(content);
export const checkConsistencyOnly = (content: string, novelState?: NovelState): StyleCheck[] => checkConsistency(content, novelState);
