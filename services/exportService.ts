// ... existing code ...
export function exportReport(report: EditorReport, format: 'json' | 'csv' | 'html' | 'markdown') {
  const timestamp = new Date(report.createdAt).toISOString().split('T')[0];
  const baseFilename = `editor-report-${report.id.substring(0, 8)}-${timestamp}`;
  
  let content: string;
  let filename: string;
  let mimeType: string;
  
  switch (format) {
    case 'json':
      content = exportReportAsJSON(report);
      filename = `${baseFilename}.json`;
      mimeType = 'application/json';
      break;
    case 'csv':
      content = exportReportAsCSV(report);
      filename = `${baseFilename}.csv`;
      mimeType = 'text/csv';
      break;
    case 'html':
      content = exportReportAsHTML(report);
      filename = `${baseFilename}.html`;
      mimeType = 'text/html';
      break;
    case 'markdown':
      content = exportReportAsMarkdown(report);
      filename = `${baseFilename}.md`;
      mimeType = 'text/markdown';
      break;
  }
  
  downloadFile(content, filename, mimeType);
}

/**
 * Export novel in specified format
 */
export async function exportNovel(novel: NovelState, format: 'markdown' | 'text'): Promise<void> {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  const timestamp = new Date().toISOString().split('T')[0];
  const safeTitle = novel.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const baseFilename = `${safeTitle}-${timestamp}`;
  
  if (format === 'markdown') {
    content = exportNovelAsMarkdown(novel);
    filename = `${baseFilename}.md`;
    mimeType = 'text/markdown';
  } else {
    content = exportNovelAsText(novel);
    filename = `${baseFilename}.txt`;
    mimeType = 'text/plain';
  }
  
  downloadFile(content, filename, mimeType);
}

/**
 * Export novel as Markdown
 */
function exportNovelAsMarkdown(novel: NovelState): string {
  const lines: string[] = [];
  
  lines.push(`# ${novel.title}`);
  lines.push('');
  if (novel.genre) {
    lines.push(`**Genre:** ${novel.genre}`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  
  novel.chapters.forEach(chapter => {
    lines.push(`## Chapter ${chapter.number}: ${chapter.title}`);
    lines.push('');
    if (chapter.summary) {
      lines.push(`*${chapter.summary}*`);
      lines.push('');
    }
    lines.push(chapter.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Export novel as plain text
 */
function exportNovelAsText(novel: NovelState): string {
  const lines: string[] = [];
  
  lines.push(novel.title.toUpperCase());
  lines.push('');
  if (novel.genre) {
    lines.push(`Genre: ${novel.genre}`);
    lines.push('');
  }
  lines.push('='.repeat(60));
  lines.push('');
  
  novel.chapters.forEach(chapter => {
    lines.push(`CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}`);
    lines.push('');
    if (chapter.summary) {
      lines.push(chapter.summary);
      lines.push('');
    }
    lines.push(chapter.content);
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('');
  });
  
  return lines.join('\n');
}
