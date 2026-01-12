import { EditorIssue, EditorFix, IssueType, IssueSeverity, FixStatus } from '../types/editor';

export type IssueSortOption = 'severity' | 'chapter' | 'type' | 'date' | 'custom';
export type SortDirection = 'asc' | 'desc';

export interface IssueFilter {
  types?: IssueType[];
  severities?: IssueSeverity[];
  chapters?: number[];
  status?: FixStatus[];
  searchQuery?: string;
}

export interface IssueSort {
  field: IssueSortOption;
  direction: SortDirection;
}

/**
 * Filter issues based on filter criteria
 */
export function filterIssues(issues: EditorIssue[], filter: IssueFilter): EditorIssue[] {
  return issues.filter(issue => {
    if (filter.types && filter.types.length > 0 && !filter.types.includes(issue.type)) {
      return false;
    }
    if (filter.severities && filter.severities.length > 0 && !filter.severities.includes(issue.severity)) {
      return false;
    }
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes(issue.chapterNumber)) {
      return false;
    }
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const matchesSearch = 
        issue.description.toLowerCase().includes(query) ||
        issue.suggestion?.toLowerCase().includes(query) ||
        issue.type.toLowerCase().includes(query) ||
        issue.location.toLowerCase().includes(query) ||
        issue.context?.toLowerCase().includes(query);
      if (!matchesSearch) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Sort issues based on sort option
 */
export function sortIssues(issues: EditorIssue[], sort: IssueSort): EditorIssue[] {
  const sorted = [...issues];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sort.field) {
      case 'severity':
        // Major issues first
        if (a.severity === 'major' && b.severity === 'minor') comparison = -1;
        else if (a.severity === 'minor' && b.severity === 'major') comparison = 1;
        else comparison = 0;
        break;
      case 'chapter':
        comparison = a.chapterNumber - b.chapterNumber;
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'date':
        // Issues don't have dates, use index as proxy
        comparison = 0;
        break;
      default:
        comparison = 0;
    }
    
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

/**
 * Get issue type icon
 */
export function getIssueTypeIcon(type: IssueType): string {
  const icons: Record<IssueType, string> = {
    gap: '⚠️',
    transition: '↔️',
    grammar: '📝',
    continuity: '🔗',
    time_skip: '⏱️',
    character_consistency: '👤',
    plot_hole: '🕳️',
    style: '✨',
    formatting: '📄',
    paragraph_structure: '📑',
    sentence_structure: '📝',
  };
  return icons[type] || '❓';
}

/**
 * Get issue type color classes
 */
export function getIssueTypeColor(type: IssueType): string {
  const colors: Record<IssueType, string> = {
    gap: 'bg-red-500/20 text-red-400 border-red-500/50',
    transition: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    grammar: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    continuity: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    time_skip: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    character_consistency: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
    plot_hole: 'bg-red-600/20 text-red-500 border-red-600/50',
    style: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50',
    formatting: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
    paragraph_structure: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
    sentence_structure: 'bg-teal-500/20 text-teal-400 border-teal-500/50',
  };
  return colors[type] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
}

/**
 * Get fix status for an issue
 */
export function getIssueFixStatus(issue: EditorIssue, fixes: EditorFix[]): FixStatus {
  const fix = fixes.find(f => f.issueId === issue.id);
  return fix?.status || 'pending';
}

/**
 * Get unique chapters from issues
 */
export function getUniqueChapters(issues: EditorIssue[]): number[] {
  const chapters = new Set(issues.map(i => i.chapterNumber));
  return Array.from(chapters).sort((a, b) => a - b);
}

/**
 * Get unique issue types from issues
 */
export function getUniqueIssueTypes(issues: EditorIssue[]): IssueType[] {
  const types = new Set(issues.map(i => i.type));
  return Array.from(types);
}

/**
 * Get issue statistics
 */
export function getIssueStatistics(issues: EditorIssue[]) {
  const byType: Record<IssueType, number> = {} as Record<IssueType, number>;
  const bySeverity: Record<IssueSeverity, number> = { major: 0, minor: 0 };
  const byChapter: Record<number, number> = {};
  
  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    byChapter[issue.chapterNumber] = (byChapter[issue.chapterNumber] || 0) + 1;
  });
  
  return { byType, bySeverity, byChapter };
}

/**
 * Get context text around an issue
 */
export function getIssueContext(issue: EditorIssue, chapterContent: string, contextLength: number = 200): string {
  if (!issue.originalText || !chapterContent) {
    return issue.context || '';
  }
  
  const index = chapterContent.indexOf(issue.originalText);
  if (index === -1) {
    return issue.context || '';
  }
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(chapterContent.length, index + issue.originalText.length + contextLength);
  
  let context = chapterContent.substring(start, end);
  
  if (start > 0) {
    context = '...' + context;
  }
  if (end < chapterContent.length) {
    context = context + '...';
  }
  
  return context;
}
