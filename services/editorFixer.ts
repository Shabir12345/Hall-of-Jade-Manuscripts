import { NovelState, Chapter } from '../types';
import { EditorFix, EditorIssue, EditorFixProposal, FixStatus } from '../types/editor';
import { generateUUID } from '../utils/uuid';

// Cache for editor fix warnings to prevent spam
const fixWarningCache = new Map<string, number>();
const FIX_WARNING_CACHE_TTL = 30000; // 30 seconds

/**
 * Editor Fixer
 * Applies fixes to chapters - auto-fixes minor issues, generates proposals for major issues
 */

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * Uses word-based comparison for better accuracy with whitespace differences
 * Also considers character-level similarity for punctuation and formatting
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  
  const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');
  const words1 = normalize(text1).split(' ').filter(w => w.length > 0);
  const words2 = normalize(text2).split(' ').filter(w => w.length > 0);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate word overlap (primary metric)
  const maxLength = Math.max(words1.length, words2.length);
  let matches = 0;
  const used2 = new Set<number>();
  
  for (let i = 0; i < words1.length; i++) {
    for (let j = 0; j < words2.length; j++) {
      if (!used2.has(j) && words1[i] === words2[j]) {
        matches++;
        used2.add(j);
        break;
      }
    }
  }
  
  const wordSimilarity = matches / maxLength;
  
  // Also calculate character-level similarity for punctuation/formatting
  const charSimilarity = calculateCharacterSimilarity(text1, text2);
  
  // Weighted average: 80% word similarity, 20% character similarity
  return wordSimilarity * 0.8 + charSimilarity * 0.2;
}

/**
 * Calculate character-level similarity (for punctuation, formatting)
 */
function calculateCharacterSimilarity(text1: string, text2: string): number {
  const normalizeChars = (text: string) => text.toLowerCase().replace(/\s+/g, '');
  const chars1 = normalizeChars(text1);
  const chars2 = normalizeChars(text2);
  
  if (chars1 === chars2) return 1;
  if (chars1.length === 0 || chars2.length === 0) return 0;
  
  // Use Levenshtein-like approach for character similarity
  const maxLen = Math.max(chars1.length, chars2.length);
  let matches = 0;
  const minLen = Math.min(chars1.length, chars2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (chars1[i] === chars2[i]) matches++;
  }
  
  return matches / maxLen;
}

/**
 * Find the best matching position using fuzzy matching
 * Returns position and similarity score
 */
function findBestFuzzyMatch(content: string, searchText: string, minSimilarity: number = 0.8): { position: number; similarity: number } | null {
  const searchWords = searchText.trim().split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length < 3) return null;
  
  const lowerContent = content.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  
  let bestMatch: { position: number; similarity: number } | null = null;
  
  // Try sliding window approach
  const windowSize = Math.min(searchWords.length, 10);
  const firstWords = searchWords.slice(0, windowSize).join(' ');
  const firstWordsLower = firstWords.toLowerCase();
  
  let searchStart = 0;
  while (true) {
    const index = lowerContent.indexOf(firstWordsLower, searchStart);
    if (index === -1) break;
    
    // Extract a window of text around this position
    const windowStart = Math.max(0, index - 50);
    const windowEnd = Math.min(content.length, index + searchText.length + 200);
    const windowText = content.substring(windowStart, windowEnd);
    
    // Calculate similarity with the search text
    const similarity = calculateSimilarity(searchText, windowText);
    
    if (similarity >= minSimilarity) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        // Find the actual start position within the window
        const relativeStart = findTextPositionInContent(windowText, searchText);
        if (relativeStart !== -1) {
          bestMatch = {
            position: windowStart + relativeStart,
            similarity
          };
        } else {
          // Use the phrase position as approximation
          bestMatch = {
            position: index,
            similarity
          };
        }
      }
    }
    
    searchStart = index + 1;
  }
  
  return bestMatch;
}

/**
 * Helper function to find text position in content with sophisticated matching
 * This handles exact matches, case-insensitive matches, and whitespace-normalized matches
 * Improved for large text blocks (paragraphs, multiple sentences)
 * Now includes fuzzy matching as a fallback
 */
function findTextPositionInContent(content: string, searchText: string): number {
  if (!searchText || searchText.trim().length === 0) {
    return -1;
  }

  // Normalize whitespace for better matching (collapse multiple spaces/newlines to single space)
  const normalizeWhitespace = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
  };
  
  // Try exact match first
  let index = content.indexOf(searchText);
  if (index !== -1) return index;
  
  // Try case-insensitive
  const lowerContent = content.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  index = lowerContent.indexOf(lowerSearch);
  if (index !== -1) return index;
  
  // For large text blocks (paragraphs, multiple sentences), use word-by-word matching
  if (searchText.length > 100) {
    const searchWords = searchText.trim().split(/\s+/).filter(w => w.length > 0);
    if (searchWords.length >= 5) {
      // Find the first few words to locate the start
      const firstWords = searchWords.slice(0, Math.min(5, searchWords.length)).join(' ');
      const firstWordsIndex = lowerContent.indexOf(firstWords.toLowerCase());
      
      if (firstWordsIndex !== -1) {
        // Found start, now verify we have enough words following
        const contentWords = content.substring(firstWordsIndex).toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (contentWords.length >= searchWords.length) {
          // Check if the word sequence matches
          let wordMatch = true;
          for (let i = 0; i < Math.min(searchWords.length, contentWords.length); i++) {
            if (contentWords[i] !== searchWords[i].toLowerCase()) {
              wordMatch = false;
              break;
            }
          }
          if (wordMatch) {
            return firstWordsIndex;
          }
        }
      }
    }
  }
  
  // Try normalized whitespace match
  const normalizedContent = normalizeWhitespace(content);
  const normalizedSearch = normalizeWhitespace(searchText);
  const normalizedIndex = normalizedContent.toLowerCase().indexOf(normalizedSearch.toLowerCase());
  
  if (normalizedIndex !== -1) {
    // Map back to original content position by finding word sequence
    const normalizedWords = normalizedSearch.toLowerCase().split(' ').filter(w => w.length > 0);
    const contentWords = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // Find word sequence match
    for (let i = 0; i <= contentWords.length - normalizedWords.length; i++) {
      let match = true;
      for (let j = 0; j < normalizedWords.length; j++) {
        if (contentWords[i + j] !== normalizedWords[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Found word sequence, now find actual character position
        let charPos = 0;
        let wordPos = 0;
        for (let k = 0; k < content.length; k++) {
          if (wordPos === i) {
            // Skip leading whitespace
            while (k < content.length && /\s/.test(content[k])) k++;
            return k;
          }
          if (/\s/.test(content[k]) && (k === 0 || !/\s/.test(content[k - 1]))) {
            wordPos++;
          }
        }
      }
    }
    
    // Fallback: try to find by first significant word
    if (normalizedWords.length > 0) {
      const firstWord = normalizedWords[0];
      const firstWordIndex = content.toLowerCase().indexOf(firstWord);
      if (firstWordIndex !== -1) {
        return firstWordIndex;
      }
    }
  }
  
  // If still not found and search text is long, try partial matching with key phrases
  if (searchText.length > 30) {
    const words = searchText.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 3) {
      // Try different phrase lengths (first 5-10 words for large blocks)
      const maxPhraseLength = searchText.length > 200 ? 10 : 8;
      for (let phraseLength = Math.min(maxPhraseLength, words.length); phraseLength >= 3; phraseLength--) {
        const phrase = words.slice(0, phraseLength).join(' ');
        const phraseIndex = content.toLowerCase().indexOf(phrase.toLowerCase());
        if (phraseIndex !== -1) {
          // Found phrase, return its position as approximation
          return phraseIndex;
        }
      }
    }
  }
  
  // Last resort: try fuzzy matching (only for longer text to avoid false positives)
  if (searchText.length > 50) {
    const fuzzyMatch = findBestFuzzyMatch(content, searchText, 0.75);
    if (fuzzyMatch && fuzzyMatch.similarity >= 0.75) {
      console.log(`Using fuzzy match with similarity ${(fuzzyMatch.similarity * 100).toFixed(1)}%`);
      return fuzzyMatch.position;
    }
  }
  
  return -1;
}

/**
 * Separates fixes into auto-fixable and those requiring approval
 */
export function categorizeFixes(
  issues: EditorIssue[],
  fixes: EditorFix[]
): {
  autoFixable: EditorFix[];
  requiresApproval: EditorFixProposal[];
} {
  const autoFixable: EditorFix[] = [];
  const requiresApproval: EditorFixProposal[] = [];

  // Group fixes by issue
  const fixesByIssue = new Map<string, EditorFix[]>();
  fixes.forEach(fix => {
    if (!fixesByIssue.has(fix.issueId)) {
      fixesByIssue.set(fix.issueId, []);
    }
    fixesByIssue.get(fix.issueId)!.push(fix);
  });

  // Also create a map for easy issue lookup
  const issueMap = new Map<string, EditorIssue>();
  issues.forEach(issue => {
    issueMap.set(issue.id, issue);
  });

  // Categorize each fix
  fixes.forEach(fix => {
    const issue = issueMap.get(fix.issueId);
    
    // If no matching issue found, try to find by chapter and type
    const matchingIssue = issue || issues.find(iss => 
      (iss.chapterNumber === fix.chapterNumber || iss.chapterId === fix.chapterId) &&
      iss.type === fix.fixType
    ) || issues[0]; // Fallback to first issue if no match
    
    if (matchingIssue && matchingIssue.autoFixable && matchingIssue.severity === 'minor' && 
        (fix.fixType === 'grammar' || fix.fixType === 'formatting' || fix.fixType === 'style' || 
         fix.fixType === 'paragraph_structure' || fix.fixType === 'sentence_structure')) {
      // Auto-fixable minor issues (grammar, formatting, style, structure)
      autoFixable.push(fix);
    } else if (matchingIssue) {
      // Major issues or non-auto-fixable issues require approval
      requiresApproval.push({
        issue: matchingIssue,
        fix,
        preview: {
          before: fix.originalText,
          after: fix.fixedText,
          context: matchingIssue.context || fix.reason || '',
        },
      });
    } else if (fix.originalText && fix.fixedText && fix.originalText.trim() !== fix.fixedText.trim()) {
      // If we can't match to an issue but have valid fix text, require approval
      const syntheticIssue: EditorIssue = {
        id: fix.issueId,
        type: fix.fixType,
        severity: 'major',
        chapterNumber: fix.chapterNumber,
        chapterId: fix.chapterId,
        location: 'middle',
        description: fix.reason || 'Issue detected by editor',
        suggestion: fix.fixedText,
        autoFixable: false,
      };
      requiresApproval.push({
        issue: syntheticIssue,
        fix,
        preview: {
          before: fix.originalText,
          after: fix.fixedText,
          context: fix.reason || '',
        },
      });
    }
  });

  return { autoFixable, requiresApproval };
}

/**
 * Applies a fix to a chapter's content
 */
export function applyFixToChapter(
  chapter: Chapter,
  fix: EditorFix
): Chapter {
  // Check if this is an insertion fix (no originalText or empty originalText)
  const isInsertion = fix.isInsertion || 
                     !fix.originalText || 
                     fix.originalText.trim().length === 0 ||
                     (fix.fixType === 'gap' || fix.fixType === 'transition');
  
  if (!fix.fixedText || fix.fixedText.trim().length === 0) {
    console.warn(`Fix ${fix.id} missing fixedText, skipping`);
    return chapter;
  }

  // For insertion fixes, handle them by appending to chapter (simple case)
  // More complex insertions with specific locations should be handled by applyFixesToChapter
  if (isInsertion) {
    console.warn(`Fix ${fix.id} is an insertion fix but insertionLocation not specified. Appending to end.`);
    return {
      ...chapter,
      content: chapter.content + (fix.insertionLocation === 'before' ? '' : '\n\n') + fix.fixedText,
      updatedAt: Date.now(),
    };
  }

  // CRITICAL: Validate fix belongs to this chapter BEFORE applying
  if (fix.chapterId && fix.chapterId !== chapter.id) {
    console.error(`CRITICAL ERROR: Fix ${fix.id} does not belong to chapter ${chapter.number}. Fix chapterId: ${fix.chapterId}, Chapter ID: ${chapter.id}. Not applying fix!`);
    return chapter;
  }
  
  if (fix.chapterNumber && fix.chapterNumber !== chapter.number) {
    console.error(`CRITICAL ERROR: Fix ${fix.id} does not belong to chapter ${chapter.number}. Fix chapterNumber: ${fix.chapterNumber}, Chapter number: ${chapter.number}. Not applying fix!`);
    return chapter;
  }

  // Apply the fix by replacing the original text with the fixed text (for replacements)
  let updatedContent = chapter.content;
  
  // Normalize whitespace for better matching (collapse multiple spaces/newlines to single space)
  const normalizeWhitespace = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
  };
  
  // Use shared helper function to find text position
  let originalIndex = findTextPositionInContent(updatedContent, fix.originalText);
  
  // For large text blocks (sentence_structure, paragraph_structure), use more aggressive matching
  const isLargeTextBlock = fix.originalText.length > 100 || 
                          fix.fixType === 'sentence_structure' || 
                          fix.fixType === 'paragraph_structure';
  
  // Special handling for paragraph_structure fixes - preserve paragraph breaks in matching
  const isParagraphStructureFix = fix.fixType === 'paragraph_structure';
  
  // If still not found and originalText is long, try finding in surrounding context around partial matches
  if (originalIndex === -1 && fix.originalText.length > 30) {
    // Extract key phrases (first 5-10 words for large blocks) for matching
    const words = fix.originalText.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 3) {
      const maxPhraseLength = isLargeTextBlock ? 10 : 8;
      // Try different phrase lengths
      for (let phraseLength = Math.min(maxPhraseLength, words.length); phraseLength >= 3; phraseLength--) {
        const phrase = words.slice(0, phraseLength).join(' ');
        const phraseIndex = findTextPositionInContent(updatedContent, phrase);
        
        if (phraseIndex !== -1) {
          // Found the phrase, now try to find the full text in the surrounding context
          // For large blocks, use larger context window
          const contextWindow = isLargeTextBlock ? 500 : 300;
          const contextStart = Math.max(0, phraseIndex - contextWindow);
          const contextEnd = Math.min(updatedContent.length, phraseIndex + fix.originalText.length + contextWindow);
          const context = updatedContent.substring(contextStart, contextEnd);
          
          // Try to find full original text in context
          const contextMatchIndex = findTextPositionInContent(context, fix.originalText);
          if (contextMatchIndex !== -1) {
            originalIndex = contextStart + contextMatchIndex;
            break;
          }
          
          // For large text blocks, try word-by-word matching from the phrase position
          if (isLargeTextBlock && originalIndex === -1) {
            const searchWords = fix.originalText.trim().split(/\s+/).filter(w => w.length > 0);
            const contentFromPhrase = updatedContent.substring(phraseIndex);
            
            // For paragraph structure fixes, preserve paragraph breaks in word matching
            if (isParagraphStructureFix) {
              // Split by paragraphs first, then by words within paragraphs
              const searchParagraphs = fix.originalText.split(/\n\n+/).filter(p => p.trim().length > 0);
              const contentParagraphs = contentFromPhrase.split(/\n\n+/).filter(p => p.trim().length > 0);
              
              if (contentParagraphs.length >= searchParagraphs.length) {
                let paragraphMatch = true;
                for (let i = 0; i < searchParagraphs.length; i++) {
                  const searchParaWords = searchParagraphs[i].trim().split(/\s+/).filter(w => w.length > 0);
                  const contentParaWords = contentParagraphs[i].trim().split(/\s+/).filter(w => w.length > 0);
                  
                  if (contentParaWords.length < searchParaWords.length) {
                    paragraphMatch = false;
                    break;
                  }
                  
                  // Check if words match (allowing for some variation)
                  let wordMatches = 0;
                  for (let j = 0; j < Math.min(searchParaWords.length, contentParaWords.length); j++) {
                    if (searchParaWords[j].toLowerCase() === contentParaWords[j].toLowerCase()) {
                      wordMatches++;
                    }
                  }
                  
                  // Require at least 80% word match per paragraph
                  if (wordMatches / searchParaWords.length < 0.8) {
                    paragraphMatch = false;
                    break;
                  }
                }
                
                if (paragraphMatch) {
                  originalIndex = phraseIndex;
                  console.log(`Using paragraph-aware word-by-word match for paragraph structure fix in chapter ${chapter.number}.`);
                  break;
                }
              }
            }
            
            // Fallback to regular word-by-word matching
            const contentWords = contentFromPhrase.toLowerCase().split(/\s+/).filter(w => w.length > 0);
            
            // Check if we have enough words and they match
            if (contentWords.length >= searchWords.length) {
              let wordMatch = true;
              for (let i = 0; i < Math.min(searchWords.length, contentWords.length); i++) {
                if (contentWords[i] !== searchWords[i].toLowerCase()) {
                  wordMatch = false;
                  break;
                }
              }
              if (wordMatch) {
                // Use phrase position as start
                originalIndex = phraseIndex;
                console.log(`Using word-by-word match for large text block in chapter ${chapter.number}. Starting at phrase position.`);
                break;
              }
            }
          }
          
          // If full match not found and not a large block, use phrase position as approximation
          if (!isLargeTextBlock && originalIndex === -1) {
            originalIndex = phraseIndex;
            console.warn(`Using approximate position for fix in chapter ${chapter.number}. Full text match not found, using phrase match.`);
            break;
          }
        }
      }
    }
  }
  
  if (originalIndex === -1) {
    // Could not find match - skip this fix and log error with more details
    const failureReason = `Could not find text to replace. Original text (first 100 chars): "${fix.originalText.substring(0, 100)}..."`;
    
    console.error(`ERROR: Could not find match for fix in chapter ${chapter.number}. Fix ID: ${fix.id}. Fix type: ${fix.fixType}`);
    console.error(`[Chapter Content] Original text (first 200 chars): "${fix.originalText.substring(0, 200)}..."`);
    console.error(`Original text length: ${fix.originalText.length} chars`);
    console.error(`This fix claims to belong to chapter ${fix.chapterNumber || 'unknown'} (ID: ${fix.chapterId || 'unknown'}), but the text was not found.`);
    console.error(`Chapter content length: ${chapter.content.length} chars`);
    
    // Try to find similar text in chapter for debugging
    const searchWords = fix.originalText.trim().split(/\s+/).filter(w => w.length > 2);
    if (searchWords.length > 0) {
      const firstFewWords = searchWords.slice(0, 3).join(' ');
      const foundInChapter = chapter.content.toLowerCase().includes(firstFewWords.toLowerCase());
      console.error(`First few words "${firstFewWords}" found in chapter: ${foundInChapter}`);
      if (foundInChapter) {
        const wordIndex = chapter.content.toLowerCase().indexOf(firstFewWords.toLowerCase());
        const contextStart = Math.max(0, wordIndex - 100);
        const contextEnd = Math.min(chapter.content.length, wordIndex + 300);
        console.error(`[Chapter Content] Context around similar text: "${chapter.content.substring(contextStart, contextEnd)}..."`);
      }
    }
    
    // Store failure reason in the chapter object (will be used by caller)
    return chapter;
  }
  
  // Verify we have a reliable match before replacing
  // Check if this is an exact match or a normalized whitespace match
  const textAtPosition = updatedContent.substring(originalIndex, originalIndex + Math.min(fix.originalText.length + 100, updatedContent.length - originalIndex));
  const exactMatch = textAtPosition.startsWith(fix.originalText);
  const caseInsensitiveMatch = textAtPosition.toLowerCase().startsWith(fix.originalText.toLowerCase());
  
  // For normalized matches, we need to verify the text at the position matches when normalized
  let normalizedMatch = false;
  let wordSequenceMatch = false;
  
  if (!exactMatch && !caseInsensitiveMatch) {
    const normalizedTextAtPos = normalizeWhitespace(textAtPosition);
    const normalizedOriginal = normalizeWhitespace(fix.originalText);
    normalizedMatch = normalizedTextAtPos.toLowerCase().startsWith(normalizedOriginal.toLowerCase());
    
    // For large blocks, also check word-by-word match
    if (isLargeTextBlock && !normalizedMatch) {
      const searchWords = fix.originalText.trim().split(/\s+/).filter(w => w.length > 0);
      const contentWords = textAtPosition.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      
      if (contentWords.length >= searchWords.length) {
        wordSequenceMatch = true;
        for (let i = 0; i < searchWords.length; i++) {
          if (contentWords[i] !== searchWords[i].toLowerCase()) {
            wordSequenceMatch = false;
            break;
          }
        }
      }
    }
  }
  
  if (!exactMatch && !caseInsensitiveMatch && !normalizedMatch && !wordSequenceMatch) {
    // Match quality is not good enough - this was likely a phrase-based approximate match
    // For large blocks, be more lenient - if we found the start, try to proceed
    if (isLargeTextBlock) {
      console.warn(`Match quality insufficient for large text block fix in chapter ${chapter.number}, but proceeding with word-count based replacement.`);
      // We'll use word count to determine replacement length
    } else {
      console.warn(`Match quality insufficient for fix in chapter ${chapter.number}. Found phrase but full text doesn't match. Skipping to avoid text corruption.`);
      return chapter;
    }
  }
  
  // Determine the actual length to replace
  let replaceLength = fix.originalText.length;
  if ((normalizedMatch || wordSequenceMatch) && !exactMatch && !caseInsensitiveMatch) {
    // For normalized or word-sequence matches, find the actual end position by matching word count
    const normalizedOriginal = normalizeWhitespace(fix.originalText);
    const originalWordCount = normalizedOriginal.split(' ').filter(w => w.length > 0).length;
    
    // Count words from the start position
    let wordCount = 0;
    let inWord = false;
    let lastWordEnd = originalIndex;
    
    for (let i = originalIndex; i < updatedContent.length && wordCount < originalWordCount; i++) {
      const isWhitespace = /\s/.test(updatedContent[i]);
      if (!isWhitespace && !inWord) {
        inWord = true;
      } else if (isWhitespace && inWord) {
        wordCount++;
        inWord = false;
        lastWordEnd = i;
      }
    }
    
    // If we reached the word count, use that position; otherwise use original length
    if (wordCount === originalWordCount) {
      replaceLength = lastWordEnd - originalIndex;
    } else {
      // Fallback: try to find end by looking for next sentence or paragraph break
      const remainingText = updatedContent.substring(originalIndex);
      const nextParagraph = remainingText.indexOf('\n\n');
      const nextSentence = remainingText.search(/[.!?]\s+/);
      
      if (nextParagraph !== -1 && nextParagraph < fix.originalText.length * 1.5) {
        replaceLength = nextParagraph;
      } else if (nextSentence !== -1 && nextSentence < fix.originalText.length * 1.5) {
        replaceLength = nextSentence + 1;
      }
    }
  }
  
  // Replace the text
  const beforeText = updatedContent.substring(0, originalIndex);
  const afterText = updatedContent.substring(originalIndex + replaceLength);
  updatedContent = beforeText + fix.fixedText + afterText;
  
  // Verify the content actually changed
  if (updatedContent === chapter.content) {
    console.warn(`Fix ${fix.id} did not change chapter ${chapter.number} content. originalText and fixedText might be the same, or replacement failed.`);
    return chapter;
  }

  return {
    ...chapter,
    content: updatedContent,
    updatedAt: Date.now(),
  };
}

/**
 * Applies an insertion fix to a chapter (adds text without replacing existing text)
 */
function applyInsertion(chapter: Chapter, fix: EditorFix): Chapter {
  let updatedContent = chapter.content;
  const insertionLocation = fix.insertionLocation || 'after';
  
  if (insertionLocation === 'before' || insertionLocation === 'end') {
    // Add at end of chapter
    updatedContent = updatedContent.trim() + '\n\n' + fix.fixedText;
    console.log(`[Editor] Inserted ${fix.fixedText.length} characters at end of chapter ${chapter.number}`);
  } else if (insertionLocation === 'after' || insertionLocation === 'start') {
    // Add at start of chapter
    updatedContent = fix.fixedText + '\n\n' + updatedContent.trim();
    console.log(`[Editor] Inserted ${fix.fixedText.length} characters at start of chapter ${chapter.number}`);
  } else if (insertionLocation === 'split') {
    // Split insertion - add at end of chapter (both parts would require updating two chapters)
    // For now, add at end; split handling could be added in editorService if needed
    updatedContent = updatedContent.trim() + '\n\n' + fix.fixedText;
    console.log(`[Editor] Inserted ${fix.fixedText.length} characters (split) at end of chapter ${chapter.number}`);
  } else if (fix.originalText && fix.originalText.trim().length > 0) {
    // originalText provided - insert after it (insertion at specific point)
    const normalizeWhitespace = (text: string): string => {
      return text.replace(/\s+/g, ' ').trim();
    };
    
    const findTextPosition = (content: string, searchText: string): number => {
      let index = content.indexOf(searchText);
      if (index !== -1) return index;
      
      const lowerContent = content.toLowerCase();
      const lowerSearch = searchText.toLowerCase();
      index = lowerContent.indexOf(lowerSearch);
      if (index !== -1) return index;
      
      const normalizedContent = normalizeWhitespace(content);
      const normalizedSearch = normalizeWhitespace(searchText);
      const normalizedIndex = normalizedContent.toLowerCase().indexOf(normalizedSearch.toLowerCase());
      if (normalizedIndex !== -1) {
        // Map back to original position
        let nonWhitespaceCount = 0;
        for (let i = 0; i < content.length; i++) {
          if (/\S/.test(content[i])) {
            if (nonWhitespaceCount === normalizedIndex) {
              let start = i;
              while (start > 0 && /\S/.test(content[start - 1])) {
                start--;
              }
              return start;
            }
            nonWhitespaceCount++;
          }
        }
      }
      return -1;
    };
    
    const index = findTextPosition(updatedContent, fix.originalText);
    if (index !== -1) {
      const insertPoint = index + fix.originalText.length;
      updatedContent = updatedContent.substring(0, insertPoint) + 
                      '\n\n' + fix.fixedText + '\n\n' + 
                      updatedContent.substring(insertPoint);
      console.log(`[Editor] Inserted ${fix.fixedText.length} characters after specified text in chapter ${chapter.number}`);
    } else {
      console.warn(`[Editor] Could not find insertion point in chapter ${chapter.number}. Adding at end instead.`);
      updatedContent = updatedContent.trim() + '\n\n' + fix.fixedText;
    }
  } else {
    // Default: add at end
    updatedContent = updatedContent.trim() + '\n\n' + fix.fixedText;
    console.log(`[Editor] Inserted ${fix.fixedText.length} characters at end of chapter ${chapter.number} (default location)`);
  }
  
  return {
    ...chapter,
    content: updatedContent,
    updatedAt: Date.now(),
  };
}

/**
 * Applies multiple fixes to a chapter
 * CRITICAL: Validates fixes belong to the chapter before applying
 */
export function applyFixesToChapter(
  chapter: Chapter,
  fixes: EditorFix[]
): { updatedChapter: Chapter; appliedFixes: EditorFix[]; failedFixes: EditorFix[] } {
  let updatedChapter = chapter;
  const appliedFixes: EditorFix[] = [];
  const failedFixes: EditorFix[] = [];

  // Filter fixes to only those that belong to this chapter
  const validFixes = fixes.filter(fix => {
    const belongs = (fix.chapterId && fix.chapterId === chapter.id) || 
                    (fix.chapterNumber && fix.chapterNumber === chapter.number);
    
    if (!belongs) {
      console.error(`CRITICAL: Fix ${fix.id} does not belong to chapter ${chapter.number}. Fix chapterNumber: ${fix.chapterNumber}, Fix chapterId: ${fix.chapterId}. Skipping.`);
      failedFixes.push({
        ...fix,
        failureReason: `Fix belongs to chapter ${fix.chapterNumber}, not chapter ${chapter.number}`,
      });
      return false;
    }
    return true;
  });

  if (validFixes.length === 0) {
    console.warn(`No valid fixes to apply to chapter ${chapter.number}. All ${fixes.length} fixes were filtered out.`);
    return { updatedChapter, appliedFixes, failedFixes };
  }

  // Sort fixes by position (end to start to preserve indices)
  // Filter out insertion fixes first
  const replacementFixes = validFixes.filter(fix => 
    !fix.isInsertion && fix.originalText && fix.originalText.trim().length > 0
  );
  
  const fixesWithPositions = replacementFixes.map(fix => {
    const position = findTextPositionInContent(updatedChapter.content, fix.originalText);
    return { fix, position: position === -1 ? Infinity : position };
  }).filter(item => item.position !== Infinity)
    .sort((a, b) => b.position - a.position); // End to start
  
    // Add fixes that couldn't be positioned to failed list (with failure reason)
    const unpositionableFixes = replacementFixes
      .filter(fix => {
        const found = fixesWithPositions.find(fp => fp.fix.id === fix.id);
        return !found;
      })
      .map(fix => {
        // Provide more specific failure reason based on fix type
        let failureReason = 'Could not find original text in chapter content';
        if (fix.fixType === 'sentence_structure') {
          failureReason = 'Could not find text to replace. The original sentences may have been modified or do not match exactly.';
        } else if (fix.fixType === 'paragraph_structure') {
          failureReason = 'Could not find text to replace. The original paragraph may have been modified or does not match exactly.';
        } else if (fix.fixType === 'continuity') {
          failureReason = 'Could not find text to replace. The original text may have been modified or does not match exactly.';
        }
        return {
          ...fix,
          failureReason,
        };
      });
  failedFixes.push(...unpositionableFixes);

  fixesWithPositions.forEach(({ fix }) => {
    try {
      // Double-check the fix belongs to this chapter
      if (fix.chapterId !== chapter.id && fix.chapterNumber !== chapter.number) {
        console.error(`CRITICAL: Fix ${fix.id} does not belong to chapter ${chapter.number}. Not applying!`);
        failedFixes.push({
          ...fix,
          failureReason: `Fix belongs to chapter ${fix.chapterNumber}, not chapter ${chapter.number}`,
        });
        return;
      }

      const beforeContent = updatedChapter.content;
      updatedChapter = applyFixToChapter(updatedChapter, fix);
      
      // Check if the content actually changed
      if (updatedChapter.content !== beforeContent) {
        appliedFixes.push({
          ...fix,
          status: 'applied' as FixStatus,
          appliedAt: Date.now(),
        });
        console.log(`Applied fix ${fix.id} to chapter ${chapter.number}. Changed ${beforeContent.length} -> ${updatedChapter.content.length} characters.`);
      } else {
        // Fix didn't apply (likely couldn't find the text)
        const failureReason = fix.fixType === 'sentence_structure' 
          ? 'Could not find text to replace. The original sentences may have been modified or do not match exactly.'
          : fix.fixType === 'paragraph_structure'
          ? 'Could not find text to replace. The original paragraph may have been modified or does not match exactly.'
          : 'Text replacement did not change content - original text may not match exactly';
        
        console.warn(`Fix ${fix.id} did not change chapter ${chapter.number} content. originalText might not exist in chapter.`);
        failedFixes.push({
          ...fix,
          failureReason,
        });
      }
    } catch (error) {
      console.error(`Failed to apply fix ${fix.id} to chapter ${chapter.number}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedFixes.push({
        ...fix,
        failureReason: `Error: ${errorMessage}`,
      });
    }
  });

  // Add any fixes that couldn't be positioned (with failure reason)
  fixes
    .filter(fix => {
      const found = fixesWithPositions.find(fp => fp.fix.id === fix.id);
      return !found;
    })
    .forEach(fix => {
      // Only add if not already in failed list
      if (!failedFixes.some(f => f.id === fix.id)) {
        failedFixes.push({
          ...fix,
          failureReason: 'Could not find original text in chapter content',
        });
      }
    });

  return { updatedChapter, appliedFixes, failedFixes };
}

/**
 * Check if two text ranges overlap
 */
function rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return !(end1 < start2 || end2 < start1);
}

/**
 * Detect and resolve overlapping fixes
 * Returns fixes with adjusted positions to avoid conflicts
 */
function resolveOverlappingFixes(
  fixesWithPositions: Array<{ fix: EditorFix; position: number }>,
  chapterContent: string
): Array<{ fix: EditorFix; position: number; endPosition: number }> {
  // Calculate end positions for each fix
  const fixesWithRanges = fixesWithPositions
    .filter(item => item.position !== Infinity)
    .map(item => ({
      fix: item.fix,
      position: item.position,
      endPosition: item.position + (item.fix.originalText?.length || 0)
    }))
    .sort((a, b) => a.position - b.position); // Sort by start position
  
  // Check for overlaps and adjust
  const resolved: Array<{ fix: EditorFix; position: number; endPosition: number }> = [];
  
  for (let i = 0; i < fixesWithRanges.length; i++) {
    const current = fixesWithRanges[i];
    let adjusted = { ...current };
    
    // Check if this fix overlaps with any already resolved fixes
    for (const resolvedFix of resolved) {
      if (rangesOverlap(adjusted.position, adjusted.endPosition, resolvedFix.position, resolvedFix.endPosition)) {
        // Overlap detected - adjust current fix to start after the resolved one
        adjusted.position = resolvedFix.endPosition;
        adjusted.endPosition = adjusted.position + (adjusted.fix.originalText?.length || 0);
        console.warn(`Fix ${adjusted.fix.id} overlaps with fix ${resolvedFix.fix.id}. Adjusting position.`);
      }
    }
    
    // Verify the adjusted position still makes sense
    if (adjusted.position < chapterContent.length) {
      resolved.push(adjusted);
    } else {
      console.warn(`Fix ${adjusted.fix.id} adjusted position is beyond chapter content. Skipping.`);
    }
  }
  
  return resolved;
}

/**
 * Applies auto-fixable fixes to multiple chapters
 * Improved with overlap detection and better error handling
 */
export async function applyAutoFixes(
  chapters: Chapter[],
  fixes: EditorFix[]
): Promise<{ updatedChapters: Chapter[]; appliedFixes: EditorFix[]; failedFixes: EditorFix[] }> {
  const updatedChapters: Chapter[] = [];
  const allAppliedFixes: EditorFix[] = [];
  const allFailedFixes: EditorFix[] = [];

  // Group fixes by chapter
  const fixesByChapter = new Map<string, EditorFix[]>();
  fixes.forEach(fix => {
    const chapterKey = fix.chapterId || `chapter-${fix.chapterNumber}`;
    if (!fixesByChapter.has(chapterKey)) {
      fixesByChapter.set(chapterKey, []);
    }
    fixesByChapter.get(chapterKey)!.push(fix);
  });

  // Apply fixes to each chapter - sort fixes by position in text (start to end)
  chapters.forEach(chapter => {
    const chapterKey = chapter.id || `chapter-${chapter.number}`;
    const chapterFixes = fixesByChapter.get(chapterKey) || [];
    
    if (chapterFixes.length === 0) {
      updatedChapters.push(chapter);
      return;
    }

    // Sort fixes by their position in the text (apply fixes from end to start to preserve indices)
    // Use sophisticated matching to find positions
    const fixesWithPositions = chapterFixes
      .filter(fix => {
        // Skip insertion fixes (they don't need originalText matching)
        if (fix.isInsertion || !fix.originalText || fix.originalText.trim().length === 0) {
          return false; // Insertions will be handled separately if needed
        }
        return true;
      })
      .map(fix => {
        const position = findTextPositionInContent(chapter.content, fix.originalText);
        return { fix, position: position === -1 ? Infinity : position };
      })
      .filter(item => item.position !== Infinity); // Remove fixes that couldn't be positioned
    
    // Resolve overlapping fixes
    const resolvedFixes = resolveOverlappingFixes(fixesWithPositions, chapter.content);
    
    // Sort by position descending (end to start) to preserve indices when applying
    const sortedFixes = resolvedFixes.sort((a, b) => b.position - a.position);

    // Separate fixes that couldn't be positioned
    const unpositionableFixes = chapterFixes
      .filter(fix => {
        if (fix.isInsertion || !fix.originalText || fix.originalText.trim().length === 0) {
          return false;
        }
        const found = fixesWithPositions.find(fp => fp.fix.id === fix.id);
        return !found;
      })
      .map(fix => {
        // Provide more specific failure reason based on fix type
        let failureReason = 'Could not find original text in chapter content';
        if (fix.fixType === 'sentence_structure') {
          failureReason = 'Could not find text to replace. The original sentences may have been modified or do not match exactly.';
        } else if (fix.fixType === 'paragraph_structure') {
          failureReason = 'Could not find text to replace. The original paragraph may have been modified or does not match exactly.';
        } else if (fix.fixType === 'continuity') {
          failureReason = 'Could not find text to replace. The original text may have been modified or does not match exactly.';
        }
        return {
          ...fix,
          failureReason,
        };
      });

    // Apply fixes one by one (from end to start to preserve text positions)
    let workingChapter = chapter;
    const appliedFixesList: EditorFix[] = [];
    const failedFixesList: EditorFix[] = [...unpositionableFixes]; // Start with unpositionable fixes as failed

    sortedFixes.forEach(({ fix, position }) => {
      try {
        // Verify the fix still applies at the resolved position
        const currentTextAtPosition = workingChapter.content.substring(position, position + Math.min(fix.originalText.length + 50, workingChapter.content.length - position));
        const similarity = calculateSimilarity(fix.originalText, currentTextAtPosition);
        
        // If similarity is too low, the text may have been modified by a previous fix
        if (similarity < 0.7) {
          console.warn(`Fix ${fix.id} text at position has low similarity (${(similarity * 100).toFixed(1)}%). May have been modified by previous fix.`);
          // Try to find the text again in the current content
          const newPosition = findTextPositionInContent(workingChapter.content, fix.originalText);
          if (newPosition === -1) {
            const failureReason = fix.fixType === 'sentence_structure' 
              ? 'Could not find text to replace. The text may have been modified by a previous fix.'
              : fix.fixType === 'paragraph_structure'
              ? 'Could not find text to replace. The text may have been modified by a previous fix.'
              : 'Text was modified by a previous fix and no longer matches';
            
            failedFixesList.push({
              ...fix,
              failureReason,
            });
            return; // Skip this fix
          }
          // Update position for retry
          position = newPosition;
        }
        
        const validation = validateFix(workingChapter, fix);
        if (validation.isValid) {
          const beforeContent = workingChapter.content;
          workingChapter = applyFixToChapter(workingChapter, fix);
          
          // Check if content actually changed
          if (workingChapter.content !== beforeContent) {
            appliedFixesList.push({
              ...fix,
              status: 'applied' as const,
              appliedAt: Date.now(),
            });
            console.log(`✓ Applied fix ${fix.id} (${fix.fixType}) to chapter ${chapter.number}`);
          } else {
            // Fix didn't change content (matching might have failed despite finding position)
            const failureReason = fix.fixType === 'sentence_structure' 
              ? 'Could not find text to replace. The original sentences may have been modified or do not match exactly.'
              : fix.fixType === 'paragraph_structure'
              ? 'Could not find text to replace. The original paragraph may have been modified or does not match exactly.'
              : 'Text replacement did not change content - original text may not match exactly';
            
            console.warn(`✗ Fix ${fix.id} did not change chapter ${chapter.number} content despite finding position.`);
            failedFixesList.push({
              ...fix,
              failureReason,
            });
          }
        } else {
          console.warn(`✗ Fix ${fix.id} failed validation: ${validation.reason}`);
          failedFixesList.push({
            ...fix,
            failureReason: validation.reason || 'Validation failed',
          });
        }
      } catch (error) {
        console.error(`✗ Failed to apply fix ${fix.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedFixesList.push({
          ...fix,
          failureReason: `Error: ${errorMessage}`,
        });
      }
    });

    updatedChapters.push(workingChapter);
    allAppliedFixes.push(...appliedFixesList);
    allFailedFixes.push(...failedFixesList);
  });

  // Post-fix validation: Check transitions for chapters that were modified
  // This ensures fixes didn't break chapter flow
  if (updatedChapters.length > 0) {
    try {
      const { validateChapterTransition } = await import('./chapterTransitionValidator');
      const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);
      
      for (let i = 0; i < sortedChapters.length - 1; i++) {
        const currentChapter = sortedChapters[i];
        const nextChapter = sortedChapters[i + 1];
        
        // Check if either chapter was modified
        const currentWasModified = updatedChapters.some(uc => uc.id === currentChapter.id);
        const nextWasModified = updatedChapters.some(uc => uc.id === nextChapter.id);
        
        if (currentWasModified || nextWasModified) {
          // Use updated version if available
          const current = updatedChapters.find(uc => uc.id === currentChapter.id) || currentChapter;
          const next = updatedChapters.find(uc => uc.id === nextChapter.id) || nextChapter;
          
          // Only validate if chapters are sequential
          if (next.number === current.number + 1) {
            const transitionValidation = validateChapterTransition(current, next);
            
            if (!transitionValidation.isValid || transitionValidation.score < 70) {
              console.warn(`[Post-Fix Validation] Transition quality between Chapter ${current.number} and ${next.number} is ${transitionValidation.score}/100`);
              if (transitionValidation.issues.length > 0) {
                console.warn(`[Post-Fix Validation] Issues: ${transitionValidation.issues.map(i => i.description).join('; ')}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Post-Fix Validation] Error validating transitions after fixes:', error);
      // Don't block fix application if validation fails
    }
  }

  return {
    updatedChapters,
    appliedFixes: allAppliedFixes,
    failedFixes: allFailedFixes,
  };
}

/**
 * Validates that a fix can be safely applied
 */
export function validateFix(
  chapter: Chapter,
  fix: EditorFix
): { isValid: boolean; reason?: string } {
  // Check if this is an insertion fix (can have empty originalText)
  const isInsertion = fix.isInsertion || 
                     (!fix.originalText || fix.originalText.trim().length === 0) ||
                     fix.insertionLocation;
  
  if (!fix.fixedText || fix.fixedText.trim().length === 0) {
    return { isValid: false, reason: 'Fix missing fixedText' };
  }

  // CRITICAL: Validate the fix belongs to this chapter
  if (fix.chapterId && fix.chapterId !== chapter.id) {
    return { isValid: false, reason: `Fix belongs to chapter ${fix.chapterNumber} (ID: ${fix.chapterId}), not chapter ${chapter.number} (ID: ${chapter.id})` };
  }
  
  if (fix.chapterNumber && fix.chapterNumber !== chapter.number) {
    return { isValid: false, reason: `Fix belongs to chapter ${fix.chapterNumber}, not chapter ${chapter.number}` };
  }

  // For insertions, only need fixedText
  if (isInsertion) {
    // Insertions are valid as long as they have fixedText
    return { isValid: true };
  }

  // For replacements, need originalText
  if (!fix.originalText || fix.originalText.trim().length === 0) {
    return { isValid: false, reason: 'Replacement fix missing originalText' };
  }

  // Check if the original text exists in the chapter (for replacements)
  // For large text blocks, use more lenient matching
  const isLargeTextBlock = fix.originalText.length > 100 || 
                          fix.fixType === 'sentence_structure' || 
                          fix.fixType === 'paragraph_structure';
  
  const hasExactMatch = chapter.content.includes(fix.originalText);
  const lowerContent = chapter.content.toLowerCase();
  const lowerOriginal = fix.originalText.toLowerCase();
  const hasCaseInsensitiveMatch = lowerContent.includes(lowerOriginal);
  
  // For large blocks, also check word-by-word match
  let hasWordSequenceMatch = false;
  if (isLargeTextBlock && !hasExactMatch && !hasCaseInsensitiveMatch) {
    const searchWords = fix.originalText.trim().split(/\s+/).filter(w => w.length > 0);
    const contentWords = chapter.content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // Check if the word sequence appears in the content
    if (contentWords.length >= searchWords.length) {
      for (let i = 0; i <= contentWords.length - searchWords.length; i++) {
        let match = true;
        for (let j = 0; j < searchWords.length; j++) {
          if (contentWords[i + j] !== searchWords[j].toLowerCase()) {
            match = false;
            break;
          }
        }
        if (match) {
          hasWordSequenceMatch = true;
          break;
        }
      }
    }
  }
  
  if (!hasExactMatch && !hasCaseInsensitiveMatch && !hasWordSequenceMatch) {
    // Try to find a partial match (for fixes that might have slight variations)
    const words = fix.originalText.trim().split(/\s+/).filter(w => w.length > 3);
    if (words.length > 0) {
      const firstFewWords = words.slice(0, Math.min(5, words.length)).join(' ');
      if (lowerContent.includes(firstFewWords.toLowerCase())) {
        // Found partial match - for large blocks, this might be acceptable
        // Cache warnings to prevent spam
        const warningKey = `${chapter.id}-${firstFewWords.substring(0, 30)}`;
        const lastWarning = fixWarningCache.get(warningKey);
        const now = Date.now();
        
        if (!lastWarning || (now - lastWarning) > FIX_WARNING_CACHE_TTL) {
          if (isLargeTextBlock) {
            console.warn(`Fix originalText not found exactly in chapter ${chapter.number}, but found partial match. Proceeding with word-sequence matching.`);
          } else {
            console.warn(`Fix originalText not found exactly in chapter ${chapter.number}, but found partial match. Proceeding with caution.`);
          }
          fixWarningCache.set(warningKey, now);
        }
        // Allow it - the matching algorithm will handle it
      } else {
        return { isValid: false, reason: 'Original text not found in chapter content (no exact, case-insensitive, word-sequence, or partial match)' };
      }
    } else {
      return { isValid: false, reason: 'Original text not found in chapter content' };
    }
  }

  // Check if the fix would make meaningful changes
  if (fix.originalText.trim() === fix.fixedText.trim()) {
    return { isValid: false, reason: 'Fix does not change content' };
  }

  return { isValid: true };
}

/**
 * Creates fix proposals for major issues
 */
export function createFixProposals(
  issues: EditorIssue[],
  fixes: EditorFix[]
): EditorFixProposal[] {
  const proposals: EditorFixProposal[] = [];

  // Group fixes by issue
  const fixesByIssue = new Map<string, EditorFix[]>();
  fixes.forEach(fix => {
    if (!fixesByIssue.has(fix.issueId)) {
      fixesByIssue.set(fix.issueId, []);
    }
    fixesByIssue.get(fix.issueId)!.push(fix);
  });

  // Create a map for easy issue lookup
  const issueMap = new Map<string, EditorIssue>();
  issues.forEach(issue => {
    issueMap.set(issue.id, issue);
  });

  // Track which fixes have been processed
  const processedFixIds = new Set<string>();

  // Create proposals for each issue that requires approval
  issues.forEach(issue => {
    if (!issue.autoFixable || issue.severity === 'major') {
      const issueFixes = fixesByIssue.get(issue.id) || [];
      
      issueFixes.forEach(fix => {
        if (fix.originalText && fix.fixedText && fix.originalText.trim() !== fix.fixedText.trim()) {
          proposals.push({
            issue,
            fix,
            preview: {
              before: fix.originalText,
              after: fix.fixedText,
              context: issue.context || fix.reason || '',
            },
          });
          processedFixIds.add(fix.id);
        }
      });
    }
  });

  // Also handle fixes that don't have matching issues (orphaned fixes)
  fixes.forEach(fix => {
    if (!processedFixIds.has(fix.id) && fix.originalText && fix.fixedText && fix.originalText.trim() !== fix.fixedText.trim()) {
      // Try to find a matching issue
      let matchingIssue = issueMap.get(fix.issueId);
      
      if (!matchingIssue) {
        // Try to match by chapter and type
        matchingIssue = issues.find(iss => 
          (iss.chapterNumber === fix.chapterNumber || iss.chapterId === fix.chapterId) &&
          (iss.type === fix.fixType || !fix.fixType)
        );
      }
      
      if (!matchingIssue) {
        // Create a synthetic issue for this fix
        matchingIssue = {
          id: fix.issueId || `synthetic-${fix.id}`,
          type: fix.fixType,
          severity: 'major',
          chapterNumber: fix.chapterNumber,
          chapterId: fix.chapterId,
          location: 'middle',
          description: fix.reason || 'Issue detected by editor',
          suggestion: fix.fixedText,
          autoFixable: false,
        };
      }
      
      proposals.push({
        issue: matchingIssue,
        fix,
        preview: {
          before: fix.originalText,
          after: fix.fixedText,
          context: matchingIssue.context || fix.reason || '',
        },
      });
    }
  });

  return proposals;
}
