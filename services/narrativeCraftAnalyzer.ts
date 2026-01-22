import { NovelState, Chapter, Character, NarrativeCraftScore } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Narrative Craft Analyzer
 * Analyzes narrative craft elements including sentence variation, subtext,
 * interiority, scene intent, and dialogue naturalness
 */

// Cache for narrative craft analysis
const craftAnalysisCache = new Map<string, {
  timestamp: number;
  score: NarrativeCraftScore;
}>();
const CACHE_TTL = 300000; // 5 minutes

/**
 * Analyzes comprehensive narrative craft for a chapter
 * Uses caching for performance optimization
 */
export function analyzeNarrativeCraft(
  chapter: Chapter,
  state: NovelState
): NarrativeCraftScore {
  // Check cache
  const cacheKey = `${chapter.id}:${chapter.content.length}`;
  const cached = craftAnalysisCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.score;
  }
  const content = chapter.content || '';

  const burstinessScore = calculateBurstiness(content);
  const perplexityScore = calculatePerplexity(content);
  const subtextAnalysis = analyzeSubtext(content);
  const interiorityAnalysis = analyzeInteriority(content, state.characterCodex);
  const sceneIntentAnalysis = validateSceneIntent(chapter, state);
  const dialogueAnalysis = analyzeDialogueNaturalness(content);

  // Detect patterns
  const repetitivePatterns = detectRepetitivePatterns(content);
  const overexplanationFlags = detectOverexplanation(content);
  const neutralProseFlags = detectNeutralProse(content);

  // Calculate overall craft score (weighted average)
  const overallCraftScore = Math.round(
    burstinessScore * 0.15 +
    perplexityScore * 0.15 +
    subtextAnalysis.score * 0.20 +
    interiorityAnalysis.score * 0.20 +
    sceneIntentAnalysis.score * 0.15 +
    dialogueAnalysis.score * 0.15
  );

  const score: NarrativeCraftScore = {
    id: generateUUID(),
    chapterId: chapter.id,
    novelId: state.id,
    overallCraftScore,
    burstinessScore,
    perplexityScore,
    subtextScore: subtextAnalysis.score,
    interiorityScore: interiorityAnalysis.score,
    sceneIntentScore: sceneIntentAnalysis.score,
    dialogueNaturalnessScore: dialogueAnalysis.score,
    repetitivePatterns,
    overexplanationFlags,
    neutralProseFlags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Cache the result
  craftAnalysisCache.set(cacheKey, {
    timestamp: Date.now(),
    score,
  });

  // Clean old cache entries (keep last 10)
  if (craftAnalysisCache.size > 10) {
    const entries = Array.from(craftAnalysisCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const toKeep = entries.slice(0, 10);
    craftAnalysisCache.clear();
    toKeep.forEach(([key, value]) => craftAnalysisCache.set(key, value));
  }

  return score;
}

/**
 * Calculates burstiness (sentence length variation)
 * Higher score = more variation = more human-like
 */
export function calculateBurstiness(content: string): number {
  if (!content || content.trim().length === 0) {
    return 50; // Default score
  }

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 3) {
    return 50; // Need at least 3 sentences
  }

  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);

  // Calculate mean
  const mean = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;

  // Calculate standard deviation
  const variance = sentenceLengths.reduce((sum, len) => {
    const diff = len - mean;
    return sum + (diff * diff);
  }, 0) / sentenceLengths.length;

  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (CV) = stdDev / mean
  // Higher CV = more variation = higher burstiness
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;

  // Convert to 0-100 score (CV of 0.5+ is excellent variation)
  // Scale: 0.0 = 0, 0.3 = 60, 0.5 = 80, 0.7+ = 100
  let score = Math.min(100, Math.max(0, (coefficientOfVariation / 0.5) * 80));

  // Bonus for having both very short and very long sentences
  const hasShortSentences = sentenceLengths.some(len => len <= 5);
  const hasLongSentences = sentenceLengths.some(len => len >= 25);
  if (hasShortSentences && hasLongSentences) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
}

/**
 * Calculates perplexity (vocabulary unpredictability)
 * Higher score = more unpredictable vocabulary = more human-like
 */
export function calculatePerplexity(content: string): number {
  if (!content || content.trim().length === 0) {
    return 50; // Default score
  }

  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) {
    return 50; // Need sufficient words
  }

  // Count word frequencies
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const normalized = word.replace(/[^\w]/g, ''); // Remove punctuation
    if (normalized.length > 0) {
      wordFreq[normalized] = (wordFreq[normalized] || 0) + 1;
    }
  });

  const uniqueWords = Object.keys(wordFreq).length;
  const totalWords = words.length;

  // Unique word ratio
  const uniqueRatio = uniqueWords / totalWords;

  // Calculate entropy (measure of unpredictability)
  let entropy = 0;
  Object.values(wordFreq).forEach(freq => {
    const probability = freq / totalWords;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  });

  // Convert to 0-100 score
  // Higher entropy = more unpredictable = better
  // Typical entropy for English text: 4-6 bits per word
  // Scale: 3.0 = 50, 4.0 = 70, 5.0 = 85, 6.0+ = 100
  let score = Math.min(100, Math.max(0, ((entropy - 3.0) / 3.0) * 50 + 50));

  // Bonus for unique ratio > 0.5 (high vocabulary diversity)
  if (uniqueRatio > 0.5) {
    score = Math.min(100, score + 5);
  }

  // Detect and penalize repetitive word patterns
  const wordFreqArray = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]);
  const topWords = wordFreqArray.slice(0, 10); // Top 10 most frequent words
  const topWordsTotalFreq = topWords.reduce((sum, [_, freq]) => sum + freq, 0);
  const topWordsRatio = topWordsTotalFreq / totalWords;

  // Penalize if top words make up too much of the text (indicates repetition)
  if (topWordsRatio > 0.4) {
    score = Math.max(0, score - 10); // Penalty for high repetition
  }

  // Bonus for using synonyms instead of repetition
  // Check if there's good vocabulary variety (many unique words relative to total)
  if (uniqueRatio > 0.6) {
    score = Math.min(100, score + 5);
  }

  // Weight less common words more heavily
  // Calculate average frequency - lower average = more varied vocabulary
  const avgFrequency = totalWords / uniqueWords;
  if (avgFrequency < 2.0) { // Very varied vocabulary
    score = Math.min(100, score + 5);
  }

  return Math.round(score);
}

/**
 * Analyzes subtext presence in dialogue and scenes
 */
export function analyzeSubtext(content: string): {
  score: number; // 0-100
  instances: number;
  examples: string[];
  dialogueSubtext: number;
  impliedMeaning: number;
} {
  if (!content || content.trim().length === 0) {
    return { score: 0, instances: 0, examples: [], dialogueSubtext: 0, impliedMeaning: 0 };
  }

  const instances: string[] = [];
  let dialogueSubtextCount = 0;
  let impliedMeaningCount = 0;

  // Extract dialogue
  const dialogueMatches = content.match(/["'""]([^"'"]{20,200})["'"]/g) || [];

  // Subtext indicators in dialogue
  const subtextIndicators = [
    /(but|however|though|although|yet|still|even though)/gi,
    /(perhaps|maybe|might|could|possibly)/gi,
    /(I mean|that is|in other words|what I'm saying)/gi,
    /(you know|you see|understand|get it)/gi,
    /\?/g, // Questions often carry subtext
  ];

  dialogueMatches.forEach(dialogue => {
    const hasSubtext = subtextIndicators.some(pattern => pattern.test(dialogue));
    if (hasSubtext) {
      dialogueSubtextCount++;
      if (instances.length < 5) {
        instances.push(dialogue.substring(0, 100));
      }
    }
  });

  // Implied meaning indicators (actions/descriptions that suggest deeper meaning)
  const impliedMeaningPatterns = [
    /(seemed|appeared|looked as if|as though)/gi,
    /(but|however|yet|still|nevertheless)/gi,
    /(without saying|without words|silently|quietly)/gi,
    /(his eyes|her expression|the way|the manner)/gi,
  ];

  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  sentences.forEach(sentence => {
    const hasImplied = impliedMeaningPatterns.some(pattern => pattern.test(sentence));
    if (hasImplied && !sentence.match(/["'"]/)) { // Not dialogue
      impliedMeaningCount++;
      if (instances.length < 5 && !instances.some(ex => ex.includes(sentence.substring(0, 30)))) {
        instances.push(sentence.trim().substring(0, 100));
      }
    }
  });

  const totalInstances = dialogueSubtextCount + impliedMeaningCount;

  // Score based on instances per 1000 words
  const wordCount = content.split(/\s+/).length;
  const instancesPerThousand = (totalInstances / wordCount) * 1000;

  // Target: 3+ instances per 1000 words = good subtext
  // Scale: 0 = 0, 1 = 30, 2 = 60, 3 = 80, 5+ = 100
  let score = Math.min(100, Math.max(0, (instancesPerThousand / 3) * 80));

  // Bonus for having both dialogue and implied meaning
  if (dialogueSubtextCount > 0 && impliedMeaningCount > 0) {
    score = Math.min(100, score + 10);
  }

  return {
    score: Math.round(score),
    instances: totalInstances,
    examples: instances.slice(0, 5),
    dialogueSubtext: dialogueSubtextCount,
    impliedMeaning: impliedMeaningCount,
  };
}

/**
 * Analyzes character interiority depth
 * ADJUSTED: More lenient scoring with expanded indicators
 */
export function analyzeInteriority(content: string, _characters: Character[]): {
  score: number; // 0-100
  depth: number;
  naturalness: number;
  emotionalAuthenticity: number;
  thoughtPatterns: string[];
} {
  if (!content || content.trim().length === 0) {
    return { score: 50, depth: 0, naturalness: 0, emotionalAuthenticity: 0, thoughtPatterns: [] };
  }

  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) {
    // If no paragraph breaks, split by sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length === 0) {
      return { score: 50, depth: 0, naturalness: 0, emotionalAuthenticity: 0, thoughtPatterns: [] };
    }
    // Use sentences as "paragraphs" for analysis
  }

  // Expanded interiority indicators - more patterns to catch character thoughts
  const interiorityIndicators = [
    /\b(thought|thinking|wondered|considered|realized|understood|felt|feeling)/gi,
    /\b(he|she|they|I)\s+(thought|wondered|realized|felt|knew|believed|hoped|feared|sensed|noticed)/gi,
    /\b(I|me|my|mine)\s+(thought|wondered|realized|felt|knew|believed)/gi,
    /(his|her|their|my)\s+(mind|thoughts|heart|soul|emotions|feelings|eyes|gaze|expression)/gi,
    /(inside|within|deep|beneath|underneath)/gi,
    // Additional patterns for interiority
    /\b(seemed|appeared|looked|felt like|sensed|noticed|observed)/gi,
    /\b(couldn't help but|had to|needed to|wanted to|wished|longed)/gi,
    /\b(memory|memories|remembered|recalled|reminisced)/gi,
    /\b(imagined|pictured|envisioned|visualized)/gi,
    /\b(decided|chose|determined|resolved|committed)/gi,
    /\b(worried|concerned|anxious|nervous|afraid|scared|terrified)/gi,
    /\b(happy|pleased|satisfied|content|relieved|grateful)/gi,
    /\b(angry|frustrated|annoyed|irritated|furious)/gi,
    /\b(confused|puzzled|bewildered|perplexed)/gi,
    /\b(surprised|shocked|stunned|amazed|astonished)/gi,
  ];

  let interiorityParagraphs = 0;
  const thoughtPatterns: string[] = [];
  const paragraphsToCheck = paragraphs.length > 0 ? paragraphs : content.split(/[.!?]+/).filter(s => s.trim().length > 20);

  paragraphsToCheck.forEach(paragraph => {
    const hasInteriority = interiorityIndicators.some(pattern => pattern.test(paragraph));
    if (hasInteriority) {
      interiorityParagraphs++;
      // Extract thought patterns
      const thoughtMatches = paragraph.match(/\b(thought|wondered|realized|felt|knew|believed|sensed|noticed)[^.!?]{10,80}/gi);
      if (thoughtMatches && thoughtPatterns.length < 5) {
        thoughtPatterns.push(...thoughtMatches.slice(0, 2).map(m => m.trim().substring(0, 80)));
      }
    }
  });

  // Depth score: percentage of paragraphs with interiority
  const depth = paragraphsToCheck.length > 0 ? (interiorityParagraphs / paragraphsToCheck.length) * 100 : 0;

  // Naturalness: variety of interiority expressions
  const uniqueIndicators = new Set<string>();
  paragraphsToCheck.forEach(paragraph => {
    interiorityIndicators.forEach(pattern => {
      const matches = paragraph.match(pattern);
      if (matches) {
        matches.forEach(match => uniqueIndicators.add(match.toLowerCase().substring(0, 20)));
      }
    });
  });
  // Adjusted: 3+ unique indicators = natural (reduced from 5)
  const naturalness = Math.min(100, (uniqueIndicators.size / 3) * 100);

  // Emotional authenticity: presence of emotional words - expanded list
  const emotionalWords = [
    'anger', 'fear', 'joy', 'sadness', 'love', 'hate', 'hope', 'despair',
    'excitement', 'anxiety', 'relief', 'guilt', 'pride', 'shame',
    'happy', 'sad', 'angry', 'scared', 'worried', 'nervous', 'calm',
    'frustrated', 'content', 'satisfied', 'disappointed', 'surprised',
    'heart', 'soul', 'spirit', 'passion', 'desire', 'longing',
  ];
  const emotionalCount = emotionalWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\w*`, 'gi');
    return count + (content.match(regex) || []).length;
  }, 0);
  const wordCount = content.split(/\s+/).length;
  const emotionalDensity = wordCount > 0 ? (emotionalCount / wordCount) * 1000 : 0;
  // Adjusted: 3 per 1000 words = good (reduced from 5)
  const emotionalAuthenticity = Math.min(100, (emotionalDensity / 3) * 100);

  // Overall score: weighted average with adjusted target
  // Adjusted target: 25%+ paragraphs with interiority (reduced from 40%)
  const targetDepth = 25;
  const depthScore = Math.min(100, (depth / targetDepth) * 100);

  // Add base score of 30 - having some content is already good
  const baseScore = 30;
  const overallScore = Math.round(Math.min(100,
    baseScore +
    depthScore * 0.30 +
    naturalness * 0.20 +
    emotionalAuthenticity * 0.20
  ));

  return {
    score: overallScore,
    depth: Math.round(depth),
    naturalness: Math.round(naturalness),
    emotionalAuthenticity: Math.round(emotionalAuthenticity),
    thoughtPatterns: thoughtPatterns.slice(0, 5),
  };
}

/**
 * Validates scene intent (value shift, purpose clarity, momentum)
 */
export function validateSceneIntent(chapter: Chapter, _state: NovelState): {
  score: number; // 0-100
  valueShift: boolean;
  purposeClarity: number;
  momentum: number;
  issues: string[];
} {
  const issues: string[] = [];
  let valueShift = false;

  // Check logic audit for value shift
  if (chapter.logicAudit) {
    const { startingValue, resultingValue } = chapter.logicAudit;
    valueShift = startingValue !== resultingValue &&
      startingValue.length > 5 &&
      resultingValue.length > 5;

    if (!valueShift) {
      issues.push('No clear value shift detected in logic audit');
    }
  } else {
    issues.push('Missing logic audit - cannot verify value shift');
  }

  // Purpose clarity: check if chapter has clear purpose
  const content = chapter.content || '';
  const summary = chapter.summary || '';
  const combined = (content + ' ' + summary).toLowerCase();

  // Purpose indicators
  const purposeIndicators = [
    /(goal|objective|purpose|aim|intent|plan)/gi,
    /(must|need|should|have to|required)/gi,
    /(decided|chose|determined|resolved)/gi,
  ];

  const purposeCount = purposeIndicators.reduce((count, pattern) => {
    return count + (combined.match(pattern) || []).length;
  }, 0);

  const wordCount = combined.split(/\s+/).length;
  const purposeDensity = wordCount > 0 ? (purposeCount / wordCount) * 1000 : 0;
  const purposeClarity = Math.min(100, (purposeDensity / 3) * 100); // 3 per 1000 words = clear purpose

  if (purposeClarity < 50) {
    issues.push('Chapter purpose may be unclear');
  }

  // Momentum: check for forward movement
  const momentumIndicators = [
    /(then|next|after|following|subsequently|meanwhile)/gi,
    /(progress|advance|move forward|continue|proceed)/gi,
    /(but|however|yet|still|nevertheless)/gi, // Conflict creates momentum
  ];

  const momentumCount = momentumIndicators.reduce((count, pattern) => {
    return count + (content.match(pattern) || []).length;
  }, 0);

  const momentumDensity = wordCount > 0 ? (momentumCount / wordCount) * 1000 : 0;
  const momentum = Math.min(100, (momentumDensity / 5) * 100); // 5 per 1000 words = good momentum

  if (momentum < 40) {
    issues.push('Narrative momentum may be low');
  }

  // Calculate overall score
  let score = 0;
  if (valueShift) score += 40;
  score += purposeClarity * 0.3;
  score += momentum * 0.3;

  score = Math.round(Math.min(100, Math.max(0, score)));

  return {
    score,
    valueShift,
    purposeClarity: Math.round(purposeClarity),
    momentum: Math.round(momentum),
    issues,
  };
}

/**
 * Analyzes dialogue naturalness
 * ADJUSTED: More lenient scoring to avoid overly harsh penalties
 */
export function analyzeDialogueNaturalness(content: string): {
  score: number; // 0-100
  interruptions: number;
  ambiguity: number;
  subtext: number;
  naturalPatterns: string[];
  issues: string[];
} {
  if (!content || content.trim().length === 0) {
    return { score: 50, interruptions: 0, ambiguity: 0, subtext: 0, naturalPatterns: [], issues: [] };
  }

  const issues: string[] = [];
  const naturalPatterns: string[] = [];

  // Extract dialogue - improved regex to catch more dialogue patterns
  const dialogueMatches = content.match(/["'""]([^"'"]{5,300})["'"]/g) || [];
  const dialogueCount = dialogueMatches.length;

  if (dialogueCount === 0) {
    // No dialogue is okay for some chapters (action scenes, introspective moments)
    return { score: 60, interruptions: 0, ambiguity: 0, subtext: 0, naturalPatterns: [], issues: ['No dialogue detected'] };
  }

  // Count interruptions (dialogue cut off mid-sentence) - expanded patterns
  const interruptionPatterns = [
    /[—–-]{1,3}/g, // Dashes (em-dash, en-dash, hyphen)
    /\.{2,}/g, // Ellipsis
    /\.\.\./g, // Explicit ellipsis
    /but\s/gi, // Interruption with "but"
    /though\s/gi, // "though" often indicates mid-thought
    /I mean/gi, // Self-interruption
    /wait/gi, // Interruption indicator
    /—/g, // Em dash
  ];

  let interruptions = 0;
  dialogueMatches.forEach(dialogue => {
    interruptionPatterns.forEach(pattern => {
      const matches = dialogue.match(pattern);
      if (matches) {
        interruptions += matches.length;
      }
    });
  });

  // Ambiguity (questions, incomplete thoughts, vague statements) - expanded patterns
  const ambiguityPatterns = [
    /\?/g, // Questions
    /(maybe|perhaps|might|could|possibly|probably|I think|I guess|I suppose)/gi,
    /(you know|sort of|kind of|a bit|a little|somewhat|rather)/gi,
    /(seems|seemed|appears|appeared|looks like|sounds like)/gi,
    /(not sure|unsure|uncertain|don't know|no idea)/gi,
  ];

  let ambiguityCount = 0;
  dialogueMatches.forEach(dialogue => {
    ambiguityPatterns.forEach(pattern => {
      const matches = dialogue.match(pattern);
      if (matches) {
        ambiguityCount += matches.length;
      }
    });
  });

  // Adjusted: Less harsh calculation - any ambiguity is good
  const ambiguity = dialogueCount > 0 ? Math.min(100, (ambiguityCount / dialogueCount) * 50 + 30) : 30;

  // Subtext in dialogue - expanded indicators
  const subtextIndicators = [
    /(but|however|though|although|yet|still)/gi,
    /(perhaps|maybe|might|could)/gi,
    /(I mean|that is|what I'm saying)/gi,
    /\?/g, // Questions often carry subtext
    /(really|actually|honestly|truly)/gi, // Emphasis words suggest subtext
    /(if|unless|whether)/gi, // Conditional statements
  ];

  let subtextCount = 0;
  dialogueMatches.forEach(dialogue => {
    let hasSubtext = false;
    subtextIndicators.forEach(pattern => {
      if (pattern.test(dialogue)) {
        hasSubtext = true;
      }
    });
    if (hasSubtext) {
      subtextCount++;
    }
  });

  // Adjusted: More lenient subtext scoring
  const subtext = dialogueCount > 0 ? Math.min(100, (subtextCount / dialogueCount) * 100 + 20) : 20;

  // Natural patterns detection
  if (interruptions > 0) {
    naturalPatterns.push(`Interruptions: ${interruptions} instances`);
  }
  if (ambiguityCount > 0) {
    naturalPatterns.push(`Ambiguity elements: ${ambiguityCount} instances`);
  }
  if (subtextCount > 0) {
    naturalPatterns.push(`Subtext presence: ${subtextCount} dialogues`);
  }

  // Issues - only flag if truly problematic
  if (interruptions === 0 && dialogueCount > 10) {
    issues.push('Consider adding dialogue interruptions for more natural speech');
  }
  if (subtext < 30 && dialogueCount > 5) {
    issues.push('Consider adding subtext to dialogue - characters being indirect');
  }

  // Calculate overall score - ADJUSTED weights and base score
  // Give a base score of 40 - dialogue existing is already good
  // Then add bonuses for natural elements
  let baseScore = 40;

  // Interruption bonus (up to 20 points)
  const interruptionBonus = Math.min(20, (interruptions / Math.max(1, dialogueCount)) * 100);

  // Subtext bonus (up to 25 points)
  const subtextBonus = Math.min(25, (subtextCount / Math.max(1, dialogueCount)) * 50);

  // Ambiguity bonus (up to 15 points)
  const ambiguityBonus = Math.min(15, (ambiguityCount / Math.max(1, dialogueCount)) * 30);

  const overallScore = Math.round(Math.min(100, baseScore + interruptionBonus + subtextBonus + ambiguityBonus));

  return {
    score: overallScore,
    interruptions,
    ambiguity: Math.round(ambiguity),
    subtext: Math.round(subtext),
    naturalPatterns,
    issues,
  };
}

/**
 * Detects repetitive patterns
 * ADJUSTED: More lenient detection that excludes common patterns
 */
function detectRepetitivePatterns(content: string): string[] {
  const patterns: string[] = [];

  // Common words that naturally begin many sentences - exclude from repetition check
  const excludedFirstWords = new Set([
    'the', 'a', 'an', 'he', 'she', 'it', 'they', 'i', 'we', 'you',
    'his', 'her', 'its', 'their', 'my', 'our', 'your',
    'this', 'that', 'these', 'those',
    'but', 'and', 'or', 'so', 'yet', 'for',
    'as', 'when', 'while', 'if', 'then', 'now',
  ]);

  // Check for repeated sentence beginnings
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length > 10) {
    const beginnings = sentences.slice(0, 30).map(s => {
      const words = s.trim().split(/\s+/);
      return words.slice(0, 3).join(' ').toLowerCase();
    });

    const beginningFreq: Record<string, number> = {};
    beginnings.forEach(beg => {
      // Skip if it starts with a common excluded word
      const firstWord = beg.split(' ')[0];
      if (!excludedFirstWords.has(firstWord)) {
        beginningFreq[beg] = (beginningFreq[beg] || 0) + 1;
      }
    });

    // Increased threshold from 3 to 4 for less strict detection
    const repeated = Object.entries(beginningFreq)
      .filter(([_, count]) => count >= 4)
      .map(([beg]) => `Repeated sentence beginning: "${beg}"`);

    patterns.push(...repeated.slice(0, 2)); // Only report top 2
  }

  // Check for repeated phrases (3-5 word phrases)
  const words = content.toLowerCase().split(/\s+/);
  const phraseFreq: Record<string, number> = {};

  for (let i = 0; i < words.length - 3; i++) {
    const phrase = words.slice(i, i + 4).join(' ');
    if (phrase.length > 15 && phrase.length < 50) {
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    }
  }

  const repeatedPhrases = Object.entries(phraseFreq)
    .filter(([_, count]) => count >= 3)
    .map(([phrase]) => `Repeated phrase: "${phrase}"`);

  patterns.push(...repeatedPhrases.slice(0, 3));

  return patterns;
}

/**
 * Detects overexplanation
 */
function detectOverexplanation(content: string): string[] {
  const flags: string[] = [];

  // Overexplanation indicators
  const overexplanationPatterns = [
    /(in other words|that is to say|to put it simply|to clarify|to explain)/gi,
    /(because|since|as|due to|owing to).*?(because|since|as)/gi, // Double explanation
    /(showed|demonstrated|revealed).*?(showed|demonstrated|revealed)/gi, // Redundant showing
  ];

  overexplanationPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    // Raised threshold from 2 to 5 to reduce false positives
    // Some explanatory phrases are normal in prose, only flag excessive use
    if (matches && matches.length > 5) {
      flags.push(`Overexplanation detected: ${matches.length} instances of explanatory phrases`);
    }
  });

  // Check for "tell and show" (both telling and showing the same thing)
  const tellShowPattern = /(was|were|is|are)\s+\w+.*?(showed|demonstrated|revealed|displayed)/gi;
  const tellShowMatches = content.match(tellShowPattern);
  // Raised threshold from 3 to 6 to reduce false positives
  if (tellShowMatches && tellShowMatches.length > 6) {
    flags.push('Tell and show pattern detected - explaining then demonstrating');
  }

  return flags;
}

/**
 * Detects neutral prose
 */
function detectNeutralProse(content: string): string[] {
  const flags: string[] = [];

  // Neutral/encyclopedic indicators
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const wordCount = content.split(/\s+/).length;
  let neutralCount = 0;

  const neutralPattern = /\b(it is|there is|there are|it was|there were|there was|it has been|it will be|according to|it is known that|it is said that|it is believed that|the fact that|the reality that|the truth that)\b/i;

  sentences.forEach(sentence => {
    if (neutralPattern.test(sentence.trim())) {
      neutralCount++;
    }
  });

  const neutralRatio = sentences.length > 0 ? neutralCount / sentences.length : 0;

  if (neutralRatio > 0.2) {
    flags.push(`High neutral prose ratio: ${Math.round(neutralRatio * 100)}% of sentences use neutral constructions`);
  }

  // Check for telegraphic prose (missing articles)
  const articlesCount = (content.match(/\b(the|a|an)\b/gi) || []).length;
  const articlesDensity = wordCount > 0 ? (articlesCount / wordCount) * 100 : 0;

  // Typical English prose has 6-10% articles. Less than 3% is a strong sign of telegraphic/AI style.
  if (articlesDensity < 3) {
    flags.push(`Telegraphic prose detected: Abnormally low article density (${articlesDensity.toFixed(1)}%). prose may be fragmented.`);
  }

  // Check for noun-heavy fragments
  const telegraphicPatterns = [
    /^[A-Z]\w+\s+[a-z]\w+\s*[.!?]$/gm, // Single word actions like "Blade flashed."
    /^(?:\w+\s+){1,2}\w+[.!?]\s+(?:\w+\s+){1,2}\w+[.!?]$/gm, // Rapid fire fragments
  ];

  let telegraphicCount = 0;
  telegraphicPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) telegraphicCount += matches.length;
  });

  if (telegraphicCount > 5) {
    flags.push(`Excessive fragmented sentences (${telegraphicCount} instances) detected. Prose lacks flow.`);
  }

  // Check for lack of emotional language
  // Expanded list includes emotion-naming words, emotional descriptors, and physical emotional responses
  const emotionalWords = [
    // Core emotions
    'anger', 'fear', 'joy', 'sadness', 'love', 'hate', 'hope', 'despair',
    'excitement', 'anxiety', 'relief', 'guilt', 'pride', 'shame',
    'furious', 'terrified', 'ecstatic', 'devastated', 'worried', 'nervous',
    'happy', 'sad', 'angry', 'scared', 'surprised', 'disgusted',
    // Emotional intensity descriptors
    'burning', 'cold', 'icy', 'fiery', 'overwhelming', 'crushing', 'sharp',
    'dull', 'bitter', 'sweet', 'warm', 'hollow', 'heavy', 'light',
    // Physical emotional responses
    'trembled', 'shook', 'clenched', 'gripped', 'tensed', 'relaxed',
    'pounded', 'raced', 'sank', 'soared', 'churned', 'knotted',
    'tightened', 'loosened', 'froze', 'flushed', 'paled', 'sweating',
    // Emotional state descriptors
    'determined', 'resolute', 'uncertain', 'confident', 'doubtful',
    'desperate', 'hopeful', 'resigned', 'defiant', 'vulnerable',
    'shocked', 'stunned', 'bewildered', 'confused', 'conflicted',
    // Heart/soul/feeling references
    'heart', 'soul', 'feeling', 'felt', 'emotion', 'passion',
    // Common emotional phrases (single words from phrases)
    'dread', 'terror', 'rage', 'fury', 'bliss', 'agony', 'misery',
    'longing', 'yearning', 'aching', 'sorrow', 'grief', 'regret',
  ];

  const emotionalCount = emotionalWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\w*`, 'gi');
    return count + (content.match(regex) || []).length;
  }, 0);

  const emotionalDensity = wordCount > 0 ? (emotionalCount / wordCount) * 1000 : 0;

  // Lowered threshold from 2 to 1 since we now have more comprehensive detection
  // Typical prose should have 3-10 emotional indicators per 1000 words
  if (emotionalDensity < 1) {
    flags.push('Low emotional language density - prose may be too neutral');
  }

  return flags;
}
