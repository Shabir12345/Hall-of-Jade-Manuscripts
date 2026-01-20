/**
 * Query Analyzer
 * 
 * Analyzes the current chapter context to determine what information is needed
 * from the vector database. Extracts entity names, locations, and references
 * from the previous chapter ending to generate relevant semantic queries.
 */

import { NovelState, Chapter, Character } from '../../types';
import { logger } from '../loggingService';

/**
 * Extracted entity from text
 */
export interface ExtractedEntity {
  name: string;
  type: 'character' | 'location' | 'item' | 'technique' | 'sect' | 'event' | 'unknown';
  confidence: number; // 0-1
  context: string; // Surrounding text
}

/**
 * Generated query with metadata
 */
export interface GeneratedQuery {
  query: string;
  type: 'character' | 'relationship' | 'world' | 'power' | 'plot' | 'general';
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Analysis result
 */
export interface QueryAnalysisResult {
  /** Extracted entities from context */
  entities: ExtractedEntity[];
  /** Generated search queries */
  queries: GeneratedQuery[];
  /** Keywords detected */
  keywords: string[];
  /** Analysis source (what text was analyzed) */
  sourceDescription: string;
}

// Common cultivation/wuxia terms to detect
const CULTIVATION_TERMS = [
  'cultivation', 'realm', 'stage', 'breakthrough', 'tribulation', 'qi', 'spirit',
  'foundation', 'core', 'nascent', 'soul', 'immortal', 'mortal', 'divine',
  'elder', 'master', 'disciple', 'sect', 'clan', 'palace', 'peak', 'dao'
];

// Action verbs that indicate important events
const ACTION_VERBS = [
  'attacked', 'defeated', 'escaped', 'discovered', 'revealed', 'learned',
  'met', 'confronted', 'allied', 'betrayed', 'rescued', 'destroyed',
  'awakened', 'achieved', 'broke through', 'comprehended', 'refined'
];

// Relationship indicators
const RELATIONSHIP_TERMS = [
  'enemy', 'ally', 'friend', 'rival', 'master', 'disciple', 'father', 'mother',
  'brother', 'sister', 'lover', 'spouse', 'servant', 'lord', 'subordinate'
];

/**
 * Extract potential character names from text
 * Uses capitalization and context patterns
 */
function extractPotentialCharacterNames(text: string, knownCharacters: Character[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const knownNames = new Set(knownCharacters.map(c => c.name.toLowerCase()));
  
  // Look for known character names
  for (const character of knownCharacters) {
    const regex = new RegExp(`\\b${escapeRegex(character.name)}\\b`, 'gi');
    const matches = text.matchAll(regex);
    
    for (const match of matches) {
      if (match.index !== undefined) {
        const contextStart = Math.max(0, match.index - 50);
        const contextEnd = Math.min(text.length, match.index + character.name.length + 50);
        entities.push({
          name: character.name,
          type: 'character',
          confidence: 1.0,
          context: text.substring(contextStart, contextEnd),
        });
      }
    }
  }
  
  // Look for potential new character names (Title Case words not in common words)
  const titleCasePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const commonWords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'Which',
    'Who', 'Why', 'How', 'Chapter', 'Part', 'Section', 'Book', 'Volume'
  ]);
  
  const matches = text.matchAll(titleCasePattern);
  for (const match of matches) {
    const name = match[0];
    if (!commonWords.has(name) && 
        !knownNames.has(name.toLowerCase()) &&
        name.length > 2 &&
        !entities.some(e => e.name.toLowerCase() === name.toLowerCase())) {
      
      const contextStart = Math.max(0, (match.index || 0) - 50);
      const contextEnd = Math.min(text.length, (match.index || 0) + name.length + 50);
      
      // Check if it looks like a name (followed by action verb or relationship term)
      const afterText = text.substring((match.index || 0) + name.length, contextEnd).toLowerCase();
      const isLikelyName = /\s+(said|spoke|asked|replied|nodded|smiled|frowned|was|had|could)/.test(afterText);
      
      entities.push({
        name,
        type: 'character',
        confidence: isLikelyName ? 0.7 : 0.4,
        context: text.substring(contextStart, contextEnd),
      });
    }
  }
  
  return entities;
}

/**
 * Extract location references from text
 */
function extractLocations(text: string, state: NovelState): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // Check known territories
  for (const territory of state.territories) {
    if (text.toLowerCase().includes(territory.name.toLowerCase())) {
      const index = text.toLowerCase().indexOf(territory.name.toLowerCase());
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + territory.name.length + 50);
      
      entities.push({
        name: territory.name,
        type: 'location',
        confidence: 1.0,
        context: text.substring(contextStart, contextEnd),
      });
    }
  }
  
  // Check world bible entries for locations
  const locationEntries = state.worldBible.filter(e => 
    e.category === 'Geography' || e.category === 'Sects'
  );
  
  for (const entry of locationEntries) {
    if (text.toLowerCase().includes(entry.title.toLowerCase())) {
      const index = text.toLowerCase().indexOf(entry.title.toLowerCase());
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(text.length, index + entry.title.length + 50);
      
      entities.push({
        name: entry.title,
        type: entry.category === 'Sects' ? 'sect' : 'location',
        confidence: 0.9,
        context: text.substring(contextStart, contextEnd),
      });
    }
  }
  
  // Look for location patterns
  const locationPatterns = [
    /\b(?:in|at|to|from|near|inside|outside)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Sect|Clan|Palace|Peak|Mountain|Valley|City|Town|Village|Forest|Lake|River))?)/g,
  ];
  
  for (const pattern of locationPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const name = match[1];
      if (name && name.length > 3 && !entities.some(e => e.name === name)) {
        const contextStart = Math.max(0, (match.index || 0) - 30);
        const contextEnd = Math.min(text.length, (match.index || 0) + match[0].length + 30);
        
        entities.push({
          name,
          type: 'location',
          confidence: 0.6,
          context: text.substring(contextStart, contextEnd),
        });
      }
    }
  }
  
  return entities;
}

/**
 * Extract technique and item references
 */
function extractPowerElements(text: string, state: NovelState): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // Check known techniques
  if (state.novelTechniques) {
    for (const technique of state.novelTechniques) {
      if (text.toLowerCase().includes(technique.name.toLowerCase())) {
        entities.push({
          name: technique.name,
          type: 'technique',
          confidence: 1.0,
          context: extractContext(text, technique.name),
        });
      }
    }
  }
  
  // Check known items
  if (state.novelItems) {
    for (const item of state.novelItems) {
      if (text.toLowerCase().includes(item.name.toLowerCase())) {
        entities.push({
          name: item.name,
          type: 'item',
          confidence: 1.0,
          context: extractContext(text, item.name),
        });
      }
    }
  }
  
  return entities;
}

/**
 * Extract context around a term in text
 */
function extractContext(text: string, term: string, chars: number = 50): string {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return '';
  
  const start = Math.max(0, index - chars);
  const end = Math.min(text.length, index + term.length + chars);
  return text.substring(start, end);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const textLower = text.toLowerCase();
  
  // Check for cultivation terms
  for (const term of CULTIVATION_TERMS) {
    if (textLower.includes(term)) {
      keywords.push(term);
    }
  }
  
  // Check for action verbs
  for (const verb of ACTION_VERBS) {
    if (textLower.includes(verb)) {
      keywords.push(verb);
    }
  }
  
  // Check for relationship terms
  for (const term of RELATIONSHIP_TERMS) {
    if (textLower.includes(term)) {
      keywords.push(term);
    }
  }
  
  return [...new Set(keywords)];
}

/**
 * Generate queries based on extracted entities and context
 */
function generateQueries(
  entities: ExtractedEntity[],
  keywords: string[],
  state: NovelState
): GeneratedQuery[] {
  const queries: GeneratedQuery[] = [];
  
  // Get protagonist name for relationship queries
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const protagonistName = protagonist?.name || 'protagonist';
  
  // Generate character queries
  const characters = entities.filter(e => e.type === 'character' && e.confidence >= 0.6);
  for (const char of characters.slice(0, 3)) {
    // Don't query the protagonist themselves (we have their state)
    if (char.name.toLowerCase() === protagonistName.toLowerCase()) continue;
    
    queries.push({
      query: `Who is ${char.name} and what is their background?`,
      type: 'character',
      priority: char.confidence >= 0.9 ? 'high' : 'medium',
      reason: `Character "${char.name}" mentioned in context`,
    });
    
    // Add relationship query if protagonist mentioned nearby
    if (char.context.toLowerCase().includes(protagonistName.toLowerCase())) {
      queries.push({
        query: `What is the relationship between ${char.name} and ${protagonistName}?`,
        type: 'relationship',
        priority: 'high',
        reason: `${char.name} appears near ${protagonistName}`,
      });
    }
  }
  
  // Generate location queries
  const locations = entities.filter(e => e.type === 'location' || e.type === 'sect');
  for (const loc of locations.slice(0, 2)) {
    queries.push({
      query: `What is ${loc.name} and what happens there?`,
      type: 'world',
      priority: loc.confidence >= 0.9 ? 'medium' : 'low',
      reason: `Location "${loc.name}" referenced`,
    });
  }
  
  // Generate technique/item queries
  const powerElements = entities.filter(e => e.type === 'technique' || e.type === 'item');
  for (const elem of powerElements.slice(0, 2)) {
    queries.push({
      query: `What are the abilities of ${elem.name}?`,
      type: 'power',
      priority: 'medium',
      reason: `${elem.type} "${elem.name}" mentioned`,
    });
  }
  
  // Generate keyword-based queries
  if (keywords.includes('breakthrough') || keywords.includes('tribulation')) {
    queries.push({
      query: 'What are the cultivation breakthrough requirements and tribulations?',
      type: 'power',
      priority: 'high',
      reason: 'Breakthrough/tribulation keywords detected',
    });
  }
  
  if (keywords.some(k => RELATIONSHIP_TERMS.includes(k))) {
    queries.push({
      query: `Important relationships and alliances involving ${protagonistName}`,
      type: 'relationship',
      priority: 'medium',
      reason: 'Relationship terms detected',
    });
  }
  
  // Always add a general power system query if cultivation terms present
  if (keywords.some(k => CULTIVATION_TERMS.includes(k))) {
    queries.push({
      query: 'Cultivation realms and power levels hierarchy',
      type: 'power',
      priority: 'low',
      reason: 'Cultivation context detected',
    });
  }
  
  return queries;
}

/**
 * Analyze chapter context and generate search queries
 */
export function analyzeChapterContext(
  state: NovelState,
  options: {
    /** Additional text to analyze (e.g., user instructions) */
    additionalContext?: string;
    /** Maximum queries to generate */
    maxQueries?: number;
  } = {}
): QueryAnalysisResult {
  const maxQueries = options.maxQueries || 8;
  
  logger.debug('Analyzing chapter context', 'queryAnalyzer', undefined, {
    novelId: state.id,
    chapterCount: state.chapters.length,
  });

  // Get text to analyze
  const previousChapter = state.chapters[state.chapters.length - 1];
  let textToAnalyze = '';
  
  if (previousChapter) {
    // Use last 1000 characters of previous chapter
    textToAnalyze = previousChapter.content.slice(-1000);
    // Also include summary if available
    if (previousChapter.summary) {
      textToAnalyze += '\n' + previousChapter.summary;
    }
  }
  
  // Add additional context if provided
  if (options.additionalContext) {
    textToAnalyze += '\n' + options.additionalContext;
  }
  
  // Add active arc context
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  if (activeArc) {
    textToAnalyze += '\n' + activeArc.title + ': ' + activeArc.description;
  }

  if (!textToAnalyze.trim()) {
    return {
      entities: [],
      queries: [{
        query: 'Main character background and current situation',
        type: 'general',
        priority: 'high',
        reason: 'No previous chapter context available',
      }],
      keywords: [],
      sourceDescription: 'No context available - using default queries',
    };
  }

  // Extract entities
  const characterEntities = extractPotentialCharacterNames(textToAnalyze, state.characterCodex);
  const locationEntities = extractLocations(textToAnalyze, state);
  const powerEntities = extractPowerElements(textToAnalyze, state);
  
  const allEntities = [...characterEntities, ...locationEntities, ...powerEntities];
  
  // Extract keywords
  const keywords = extractKeywords(textToAnalyze);
  
  // Generate queries
  let queries = generateQueries(allEntities, keywords, state);
  
  // Deduplicate and limit queries
  const seenQueries = new Set<string>();
  queries = queries.filter(q => {
    const key = q.query.toLowerCase();
    if (seenQueries.has(key)) return false;
    seenQueries.add(key);
    return true;
  });
  
  // Sort by priority and limit
  queries.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  queries = queries.slice(0, maxQueries);

  const sourceDescription = previousChapter 
    ? `Chapter ${previousChapter.number} ending + ${activeArc ? 'active arc' : 'no active arc'}`
    : 'Initial context';

  logger.debug('Context analysis complete', 'queryAnalyzer', undefined, {
    entityCount: allEntities.length,
    queryCount: queries.length,
    keywordCount: keywords.length,
  });

  return {
    entities: allEntities,
    queries,
    keywords,
    sourceDescription,
  };
}

/**
 * Extract queries as simple string array (convenience function)
 */
export function getSearchQueries(
  state: NovelState,
  options?: { additionalContext?: string; maxQueries?: number }
): string[] {
  const analysis = analyzeChapterContext(state, options);
  return analysis.queries.map(q => q.query);
}

/**
 * Analyze specific text for entity extraction
 */
export function analyzeText(text: string, state: NovelState): ExtractedEntity[] {
  const characterEntities = extractPotentialCharacterNames(text, state.characterCodex);
  const locationEntities = extractLocations(text, state);
  const powerEntities = extractPowerElements(text, state);
  
  return [...characterEntities, ...locationEntities, ...powerEntities];
}
