import { NovelState, Chapter } from '../types';
import { EditorFix, EditorIssue, EditorFixProposal, FixStatus } from '../types/editor';
import { generateUUID } from '../utils/uuid';

/**
 * Editor Fixer
 * Applies fixes to chapters - auto-fixes minor issues, generates proposals for major issues
 */

/**
 * Helper function to find text position in content with sophisticated matching
 * This handles exact matches, case-insensitive matches, and whitespace-normalized matches
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
  
  // Try normalized whitespace match
  const normalizedContent = normalizeWhitespace(content);
  const normalizedSearch = normalizeWhitespace(searchText);
  const normalizedIndex = normalizedContent.toLowerCase().indexOf(normalizedSearch.toLowerCase());
  
  if (normalizedIndex !== -1) {
    // Map back to original content position by counting words
    const normalizedWords = normalizedSearch.toLowerCase().split(' ').filter(w => w.length > 0);
    let wordCount = 0;
    let foundStart = -1;
    
    // Find the position in original content by matching word sequence
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    for (let i = 0; i <= words.length - normalizedWords.length; i++) {
      let match = true;
      for (let j = 0; j < normalizedWords.length; j++) {
        if (words[i + j] !== normalizedWords[j]) {
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
            foundStart = k;
            break;
          }
          if (/\s/.test(content[k]) && (k === 0 || !/\s/.test(content[k - 1]))) {
            wordPos++;
          }
        }
        if (foundStart !== -1) return foundStart;
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
      // Try different phrase lengths (first 5-8 words)
      for (let phraseLength = Math.min(8, words.length); phraseLength >= 3; phraseLength--) {
        const phrase = words.slice(0, phraseLength).join(' ');
        const phraseIndex = content.toLowerCase().indexOf(phrase.toLowerCase());
        if (phraseIndex !== -1) {
          // Found phrase, return its position as approximation
          return phraseIndex;
        }
      }
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
  
  // If still not found and originalText is long, try finding in surrounding context around partial matches
  if (originalIndex === -1 && fix.originalText.length > 30) {
    // Extract key phrases (first 5-8 words) for matching
    const words = fix.originalText.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length >= 3) {
      // Try different phrase lengths
      for (let phraseLength = Math.min(8, words.length); phraseLength >= 3; phraseLength--) {
        const phrase = words.slice(0, phraseLength).join(' ');
        const phraseIndex = findTextPositionInContent(updatedContent, phrase);
        
        if (phraseIndex !== -1) {
          // Found the phrase, now try to find the full text in the surrounding context
          const contextStart = Math.max(0, phraseIndex - 300);
          const contextEnd = Math.min(updatedContent.length, phraseIndex + fix.originalText.length + 300);
          const context = updatedContent.substring(contextStart, contextEnd);
          
          // Try to find full original text in context
          const contextMatchIndex = findTextPositionInContent(context, fix.originalText);
          if (contextMatchIndex !== -1) {
            originalIndex = contextStart + contextMatchIndex;
            break;
          }
          
          // If full match not found, use phrase position as approximation
          // This is less ideal but better than failing completely
          originalIndex = phraseIndex;
          console.warn(`Using approximate position for fix in chapter ${chapter.number}. Full text match not found, using phrase match.`);
          break;
        }
      }
    }
  }
  
  if (originalIndex === -1) {
    // Could not find match - skip this fix and log error
    console.error(`ERROR: Could not find match for fix in chapter ${chapter.number}. Fix ID: ${fix.id}. Original text (first 150 chars): "${fix.originalText.substring(0, 150)}..."`);
    console.error(`This fix claims to belong to chapter ${fix.chapterNumber || 'unknown'} (ID: ${fix.chapterId || 'unknown'}), but the text was not found.`);
    console.error(`Chapter content length: ${chapter.content.length}, Original text length: ${fix.originalText.length}`);
    // Try to help debug by showing a sample of the chapter content
    const sampleStart = Math.max(0, chapter.content.length - 500);
    console.error(`Last 500 chars of chapter: "${chapter.content.substring(sampleStart)}"`);
    return chapter;
  }
  
  // Verify we have a reliable match before replacing
  // Check if this is an exact match or a normalized whitespace match
  const exactMatch = updatedContent.substring(originalIndex, originalIndex + fix.originalText.length) === fix.originalText;
  const caseInsensitiveMatch = updatedContent.substring(originalIndex, originalIndex + fix.originalText.length).toLowerCase() === fix.originalText.toLowerCase();
  
  // For normalized matches, we need to verify the text at the position matches when normalized
  let normalizedMatch = false;
  if (!exactMatch && !caseInsensitiveMatch) {
    const textAtPosition = updatedContent.substring(originalIndex, originalIndex + fix.originalText.length + 50); // Extra buffer for whitespace differences
    const normalizedTextAtPos = normalizeWhitespace(textAtPosition);
    const normalizedOriginal = normalizeWhitespace(fix.originalText);
    normalizedMatch = normalizedTextAtPos.toLowerCase().startsWith(normalizedOriginal.toLowerCase());
  }
  
  if (!exactMatch && !caseInsensitiveMatch && !normalizedMatch) {
    // Match quality is not good enough - this was likely a phrase-based approximate match
    // Skip to avoid corrupting the text
    console.warn(`Match quality insufficient for fix in chapter ${chapter.number}. Found phrase but full text doesn't match. Skipping to avoid text corruption.`);
    return chapter;
  }
  
  // Determine the actual length to replace
  let replaceLength = fix.originalText.length;
  if (normalizedMatch && !exactMatch && !caseInsensitiveMatch) {
    // For normalized matches, find the actual end position by matching word count
    const normalizedOriginal = normalizeWhitespace(fix.originalText);
    const originalWordCount = normalizedOriginal.split(' ').filter(w => w.length > 0).length;
    
    // Count words from the start position
    let wordCount = 0;
    let inWord = false;
    for (let i = originalIndex; i < updatedContent.length && wordCount < originalWordCount; i++) {
      const isWhitespace = /\s/.test(updatedContent[i]);
      if (!isWhitespace && !inWord) {
        inWord = true;
      } else if (isWhitespace && inWord) {
        wordCount++;
        inWord = false;
      }
      if (wordCount === originalWordCount) {
        replaceLength = i - originalIndex;
        break;
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
      .map(fix => ({
        ...fix,
        failureReason: 'Could not find original text in chapter content',
      }));
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
        console.warn(`Fix ${fix.id} did not change chapter ${chapter.number} content. originalText might not exist in chapter.`);
        failedFixes.push({
          ...fix,
          failureReason: 'Text replacement did not change content - original text may not match exactly',
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
 * Applies auto-fixable fixes to multiple chapters
 */
export function applyAutoFixes(
  chapters: Chapter[],
  fixes: EditorFix[]
): { updatedChapters: Chapter[]; appliedFixes: EditorFix[]; failedFixes: EditorFix[] } {
  const updatedChapters: Chapter[] = [];
  const allAppliedFixes: EditorFix[] = [];
  const allFailedFixes: EditorFix[] = [];

  // Group fixes by chapter
  const fixesByChapter = new Map<string, EditorFix[]>();
  fixes.forEach(fix => {
    if (!fixesByChapter.has(fix.chapterId)) {
      fixesByChapter.set(fix.chapterId, []);
    }
    fixesByChapter.get(fix.chapterId)!.push(fix);
  });

  // Apply fixes to each chapter - sort fixes by position in text (start to end)
  chapters.forEach(chapter => {
    const chapterFixes = fixesByChapter.get(chapter.id) || [];
    
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
      .sort((a, b) => b.position - a.position); // Sort descending (end to start)

    // Separate fixes that can be positioned from those that cannot
    const positionableFixes = fixesWithPositions.filter(item => item.position !== Infinity);
    const unpositionableFixes = fixesWithPositions
      .filter(item => item.position === Infinity)
      .map(item => item.fix);

    // Apply fixes one by one (from end to start to preserve text positions)
    let workingChapter = chapter;
    const appliedFixesList: EditorFix[] = [];
    const failedFixesList: EditorFix[] = [...unpositionableFixes]; // Start with unpositionable fixes as failed

    positionableFixes.forEach(({ fix }) => {
      try {
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
          } else {
            // Fix didn't change content (matching might have failed despite finding position)
            console.warn(`Fix ${fix.id} did not change chapter ${chapter.number} content despite finding position.`);
            failedFixesList.push(fix);
          }
        } else {
          console.warn(`Fix ${fix.id} failed validation: ${validation.reason}`);
          failedFixesList.push(fix);
        }
      } catch (error) {
        console.error(`Failed to apply fix ${fix.id}:`, error);
        failedFixesList.push(fix);
      }
    });

    updatedChapters.push(workingChapter);
    allAppliedFixes.push(...appliedFixesList);
    allFailedFixes.push(...failedFixesList);
  });

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
  if (!chapter.content.includes(fix.originalText)) {
    // Try case-insensitive
    const lowerContent = chapter.content.toLowerCase();
    const lowerOriginal = fix.originalText.toLowerCase();
    
    if (!lowerContent.includes(lowerOriginal)) {
      // Try to find a partial match (for fixes that might have slight variations)
      const words = fix.originalText.trim().split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) {
        const firstWord = words[0];
        if (lowerContent.includes(firstWord.toLowerCase())) {
          // Found partial match - might be valid, but warn
          console.warn(`Fix originalText not found exactly in chapter ${chapter.number}, but found partial match. Proceeding with caution.`);
        } else {
          return { isValid: false, reason: 'Original text not found in chapter content' };
        }
      } else {
        return { isValid: false, reason: 'Original text not found in chapter content' };
      }
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
