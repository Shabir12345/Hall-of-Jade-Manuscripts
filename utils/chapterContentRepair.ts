/**
 * Chapter Content Repair Utility
 * 
 * Detects and repairs chapters where the entire JSON response was saved
 * as content instead of just the chapterContent field.
 */

import { Chapter, NovelState } from '../types';

/**
 * Structure of the AI generation response that may have been incorrectly saved
 */
interface AIGenerationResponse {
  logicAudit?: {
    startingValue: string;
    theFriction: string;
    theChoice: string;
    resultingValue: string;
    causalityType: string;
  };
  chapterTitle?: string;
  chapterContent?: string;
  chapterSummary?: string;
  characterUpdates?: any[];
  worldUpdates?: any[];
  territoryUpdates?: any[];
}

/**
 * Checks if chapter content is actually JSON containing a chapterContent field
 */
export function isJsonChapterContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  const trimmed = content.trim();
  
  // Quick check: must start with { and end with }
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return false;
  }
  
  try {
    const parsed = JSON.parse(trimmed);
    // Check if it has the characteristic fields of a generation response
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.chapterContent === 'string' &&
      parsed.chapterContent.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Extracts the actual chapter content from JSON-formatted content
 */
export function extractChapterContent(content: string): string | null {
  if (!isJsonChapterContent(content)) {
    return null;
  }
  
  try {
    const parsed: AIGenerationResponse = JSON.parse(content.trim());
    return parsed.chapterContent || null;
  } catch {
    return null;
  }
}

/**
 * Extracts additional metadata from JSON-formatted content
 */
export function extractChapterMetadata(content: string): {
  title?: string;
  summary?: string;
  logicAudit?: Chapter['logicAudit'];
} | null {
  if (!isJsonChapterContent(content)) {
    return null;
  }
  
  try {
    const parsed: AIGenerationResponse = JSON.parse(content.trim());
    return {
      title: parsed.chapterTitle,
      summary: parsed.chapterSummary,
      logicAudit: parsed.logicAudit as Chapter['logicAudit'],
    };
  } catch {
    return null;
  }
}

/**
 * Repairs a single chapter if it has JSON content
 * Returns the repaired chapter or null if no repair was needed
 */
export function repairChapter(chapter: Chapter): Chapter | null {
  const actualContent = extractChapterContent(chapter.content);
  
  if (!actualContent) {
    return null; // No repair needed
  }
  
  const metadata = extractChapterMetadata(chapter.content);
  
  return {
    ...chapter,
    content: actualContent,
    // Only update title/summary/logicAudit if they're empty or missing
    title: chapter.title || metadata?.title || chapter.title,
    summary: chapter.summary || metadata?.summary || chapter.summary,
    logicAudit: chapter.logicAudit || metadata?.logicAudit,
  };
}

/**
 * Finds all chapters in a novel that need repair
 */
export function findChaptersNeedingRepair(novel: NovelState): Chapter[] {
  return novel.chapters.filter(chapter => isJsonChapterContent(chapter.content));
}

/**
 * Repairs all chapters in a novel that have JSON content
 * Returns the updated novel state and a list of repaired chapter numbers
 */
export function repairNovelChapters(novel: NovelState): {
  repairedNovel: NovelState;
  repairedChapterNumbers: number[];
} {
  const repairedChapterNumbers: number[] = [];
  
  const repairedChapters = novel.chapters.map(chapter => {
    const repaired = repairChapter(chapter);
    if (repaired) {
      repairedChapterNumbers.push(chapter.number);
      return repaired;
    }
    return chapter;
  });
  
  return {
    repairedNovel: {
      ...novel,
      chapters: repairedChapters,
      updatedAt: Date.now(),
    },
    repairedChapterNumbers,
  };
}

/**
 * Generates a report of chapters needing repair
 */
export function generateRepairReport(novel: NovelState): string {
  const chaptersNeedingRepair = findChaptersNeedingRepair(novel);
  
  if (chaptersNeedingRepair.length === 0) {
    return 'No chapters need repair. All chapters have proper content format.';
  }
  
  const lines = [
    `Found ${chaptersNeedingRepair.length} chapter(s) with JSON-formatted content that need repair:`,
    '',
  ];
  
  chaptersNeedingRepair.forEach(chapter => {
    const metadata = extractChapterMetadata(chapter.content);
    const actualContent = extractChapterContent(chapter.content);
    const wordCount = actualContent ? actualContent.split(/\s+/).length : 0;
    
    lines.push(`- Chapter ${chapter.number}: "${chapter.title}"`);
    lines.push(`  Embedded title: "${metadata?.title || 'N/A'}"`);
    lines.push(`  Actual content word count: ${wordCount}`);
    lines.push('');
  });
  
  return lines.join('\n');
}
