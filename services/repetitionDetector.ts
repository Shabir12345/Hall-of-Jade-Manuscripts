/**
 * Repetition Detector Service
 * Detects repeated phrases, overexplanation, and sentence length variation issues
 */

export interface RepetitionReport {
  repeatedPhrases: string[];
  overexplanationCount: number;
  sentenceVariationScore: number;
  paragraphsWithSimilarSentences: number;
  toneInconsistency?: string;
}

export function detectRepetitions(text: string): RepetitionReport {
  const repeatedPhrases: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // Detect repeated phrases (2-4 words)
  const phrases = new Map<string, number>();
  sentences.forEach(sentence => {
    const words = sentence.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      for (let len = 2; len <= 4 && i + len <= words.length; len++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 5) { // Ignore very short phrases
          phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
        }
      }
    }
  });
  
  // Find phrases repeated 3+ times
  phrases.forEach((count, phrase) => {
    if (count >= 3) {
      repeatedPhrases.push(`"${phrase}" (${count} times)`);
    }
  });
  
  // Count overexplanation (because, since, as, due to, etc.)
  const overexplanationWords = ['because', 'since', 'as', 'due to', 'as a result', 'consequently', 'therefore', 'thus', 'hence'];
  const overexplanationCount = overexplanationWords.reduce((count, word) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return count + (text.match(regex) || []).length;
  }, 0);
  
  // Calculate sentence length variation score
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const sentenceVariationScore = Math.min(100, (variance / avgLength) * 10);
  
  // Count paragraphs with similar-length sentences
  let paragraphsWithSimilarSentences = 0;
  paragraphs.forEach(paragraph => {
    const paraSentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (paraSentences.length >= 3) {
      const lengths = paraSentences.map(s => s.split(/\s+/).length);
      const avgParaLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const similarCount = lengths.filter(l => Math.abs(l - avgParaLength) <= 3).length;
      if (similarCount >= 3) {
        paragraphsWithSimilarSentences++;
      }
    }
  });
  
  // Detect tone inconsistency (basic heuristic)
  const formalWords = ['thus', 'therefore', 'hence', 'consequently', 'furthermore', 'moreover'];
  const casualWords = ['yeah', 'nah', 'gonna', 'wanna', 'kinda', 'sorta', 'dunno'];
  const formalCount = formalWords.reduce((count, word) => count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0);
  const casualCount = casualWords.reduce((count, word) => count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length, 0);
  
  let toneInconsistency: string | undefined;
  if (formalCount > 0 && casualCount > 0) {
    toneInconsistency = `Mixed formal (${formalCount}) and casual (${casualCount}) language detected`;
  } else if (casualCount > formalCount * 2) {
    toneInconsistency = 'Primary tone "casual" not dominant';
  }
  
  return {
    repeatedPhrases,
    overexplanationCount,
    sentenceVariationScore,
    paragraphsWithSimilarSentences,
    toneInconsistency
  };
}
