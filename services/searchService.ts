import { NovelState, Chapter, Scene, Character, WorldEntry } from '../types';

export interface SearchResult {
  type: 'chapter' | 'scene' | 'character' | 'world';
  id: string;
  title: string;
  content: string;
  matchScore: number;
  context?: string;
}

export interface SearchOptions {
  query: string;
  types?: ('chapter' | 'scene' | 'character' | 'world')[];
  limit?: number;
}

export const searchNovel = (novel: NovelState, options: SearchOptions): SearchResult[] => {
  const { query, types = ['chapter', 'scene', 'character', 'world'], limit = 50 } = options;
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  if (types.includes('chapter')) {
    novel.chapters.forEach(chapter => {
      const titleMatch = chapter.title.toLowerCase().includes(lowerQuery);
      const contentMatch = chapter.content.toLowerCase().includes(lowerQuery);
      const summaryMatch = chapter.summary.toLowerCase().includes(lowerQuery);
      
      if (titleMatch || contentMatch || summaryMatch) {
        let matchScore = 0;
        if (titleMatch) matchScore += 10;
        if (summaryMatch) matchScore += 5;
        if (contentMatch) matchScore += 1;
        
        // Find context around match
        let context = '';
        if (contentMatch) {
          const index = chapter.content.toLowerCase().indexOf(lowerQuery);
          const start = Math.max(0, index - 50);
          const end = Math.min(chapter.content.length, index + query.length + 50);
          context = chapter.content.substring(start, end);
          if (start > 0) context = '...' + context;
          if (end < chapter.content.length) context = context + '...';
        }
        
        results.push({
          type: 'chapter',
          id: chapter.id,
          title: `Chapter ${chapter.number}: ${chapter.title}`,
          content: chapter.summary || chapter.content.substring(0, 200),
          matchScore,
          context
        });
      }
    });
  }

  if (types.includes('scene')) {
    novel.chapters.forEach(chapter => {
      chapter.scenes.forEach(scene => {
        const titleMatch = scene.title.toLowerCase().includes(lowerQuery);
        const contentMatch = scene.content.toLowerCase().includes(lowerQuery);
        const summaryMatch = scene.summary.toLowerCase().includes(lowerQuery);
        
        if (titleMatch || contentMatch || summaryMatch) {
          let matchScore = 0;
          if (titleMatch) matchScore += 10;
          if (summaryMatch) matchScore += 5;
          if (contentMatch) matchScore += 1;
          
          let context = '';
          if (contentMatch) {
            const index = scene.content.toLowerCase().indexOf(lowerQuery);
            const start = Math.max(0, index - 50);
            const end = Math.min(scene.content.length, index + query.length + 50);
            context = scene.content.substring(start, end);
            if (start > 0) context = '...' + context;
            if (end < scene.content.length) context = context + '...';
          }
          
          results.push({
            type: 'scene',
            id: scene.id,
            title: `Ch ${chapter.number}, Scene ${scene.number}: ${scene.title || 'Untitled'}`,
            content: scene.summary || scene.content.substring(0, 200),
            matchScore,
            context
          });
        }
      });
    });
  }

  if (types.includes('character')) {
    novel.characterCodex.forEach(character => {
      const nameMatch = character.name.toLowerCase().includes(lowerQuery);
      const notesMatch = character.notes.toLowerCase().includes(lowerQuery);
      const cultivationMatch = character.currentCultivation.toLowerCase().includes(lowerQuery);
      
      if (nameMatch || notesMatch || cultivationMatch) {
        let matchScore = 0;
        if (nameMatch) matchScore += 10;
        if (cultivationMatch) matchScore += 5;
        if (notesMatch) matchScore += 1;
        
        results.push({
          type: 'character',
          id: character.id,
          title: character.name,
          content: character.notes || `${character.currentCultivation} - ${character.personality}`,
          matchScore
        });
      }
    });
  }

  if (types.includes('world')) {
    novel.worldBible.forEach(entry => {
      const titleMatch = entry.title.toLowerCase().includes(lowerQuery);
      const contentMatch = entry.content.toLowerCase().includes(lowerQuery);
      
      if (titleMatch || contentMatch) {
        let matchScore = 0;
        if (titleMatch) matchScore += 10;
        if (contentMatch) matchScore += 1;
        
        let context = '';
        if (contentMatch) {
          const index = entry.content.toLowerCase().indexOf(lowerQuery);
          const start = Math.max(0, index - 50);
          const end = Math.min(entry.content.length, index + query.length + 50);
          context = entry.content.substring(start, end);
          if (start > 0) context = '...' + context;
          if (end < entry.content.length) context = context + '...';
        }
        
        results.push({
          type: 'world',
          id: entry.id,
          title: `${entry.category}: ${entry.title}`,
          content: entry.content.substring(0, 200),
          matchScore,
          context
        });
      }
    });
  }

  // Sort by match score and limit results
  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
};
