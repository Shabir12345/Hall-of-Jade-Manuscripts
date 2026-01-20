/**
 * Back-Translation Service
 * 
 * Implements back-translation through multiple languages to break
 * n-gram patterns and reduce AI detection. Research shows this is
 * highly effective at reducing detectability.
 * 
 * Uses DeepSeek-V3.2 ("The Writer") for translation tasks as it
 * excels at multilingual tasks and creative writing.
 */

import { deepseekText } from "./deepseekService";
import { rateLimiter } from "./rateLimiter";

export interface BackTranslationResult {
  originalText: string;
  translations: Array<{
    language: string;
    translatedText: string;
    backTranslatedText: string;
  }>;
  mergedText: string;
  mergeStrategy: 'hybrid' | 'best' | 'average';
}

/**
 * Translates text to a target language and back to English
 */
async function translateAndBack(
  text: string,
  targetLanguage: string,
  languageName: string
): Promise<{ translated: string; backTranslated: string }> {
  // Translate to target language
  const translatePrompt = `Translate the following English text to ${languageName}. Preserve the meaning, tone, and style. Return ONLY the translated text, no explanations.

Text to translate:
${text}`;
  
  const translatedText = await rateLimiter.queueRequest('generate', async () => {
    return await deepseekText({
      user: translatePrompt,
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
    });
  }, `translate-to-${targetLanguage}`) || text;
  
  // Translate back to English
  const backTranslatePrompt = `Translate the following ${languageName} text back to English. Preserve the meaning, tone, and style. Return ONLY the translated text, no explanations.

Text to translate:
${translatedText}`;
  
  const backTranslatedText = await rateLimiter.queueRequest('generate', async () => {
    return await deepseekText({
      user: backTranslatePrompt,
      temperature: 0.8, // Slightly higher for more variation
      topP: 0.9,
      maxTokens: 8192,
    });
  }, `translate-from-${targetLanguage}`) || text;
  
  return {
    translated: translatedText,
    backTranslated: backTranslatedText,
  };
}

/**
 * Merges multiple back-translated versions into a hybrid text
 */
function mergeTranslations(
  original: string,
  translations: Array<{ language: string; backTranslatedText: string }>,
  strategy: 'hybrid' | 'best' | 'average' = 'hybrid'
): string {
  if (translations.length === 0) {
    return original;
  }
  
  if (strategy === 'best') {
    // Use the version that's most different from original (most variation)
    let bestTranslation = translations[0];
    let maxDifference = 0;
    
    translations.forEach(t => {
      // Simple difference metric: word overlap
      const originalWords = new Set(original.toLowerCase().split(/\s+/));
      const transWords = new Set(t.backTranslatedText.toLowerCase().split(/\s+/));
      const overlap = Array.from(originalWords).filter(w => transWords.has(w)).length;
      const difference = 1 - (overlap / Math.max(originalWords.size, transWords.size));
      
      if (difference > maxDifference) {
        maxDifference = difference;
        bestTranslation = t;
      }
    });
    
    return bestTranslation.backTranslatedText;
  }
  
  if (strategy === 'hybrid') {
    // Mix sentences from different translations
    const originalSentences = original.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const translationSentences = translations.map(t => 
      t.backTranslatedText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    );
    
    // Alternate between translations for each sentence
    const mergedSentences: string[] = [];
    for (let i = 0; i < originalSentences.length; i++) {
      const translationIndex = i % translations.length;
      const transSentences = translationSentences[translationIndex];
      if (transSentences[i] && transSentences[i].trim().length > 0) {
        mergedSentences.push(transSentences[i].trim());
      } else if (originalSentences[i]) {
        mergedSentences.push(originalSentences[i].trim());
      }
    }
    
    // Reconstruct with proper punctuation
    return mergedSentences.map((s, i) => {
      if (i === mergedSentences.length - 1) {
        return s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.';
      }
      return s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.';
    }).join(' ');
  }
  
  // 'average' strategy - use first translation (simplified)
  return translations[0].backTranslatedText;
}

/**
 * Performs back-translation through multiple languages
 */
export async function performBackTranslation(
  text: string,
  languages: string[] = ['fr', 'es', 'zh'],
  mergeStrategy: 'hybrid' | 'best' | 'average' = 'hybrid'
): Promise<BackTranslationResult> {
  const languageMap: Record<string, string> = {
    'fr': 'French',
    'es': 'Spanish',
    'zh': 'Chinese',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ja': 'Japanese',
    'ko': 'Korean',
  };
  
  const translations: Array<{
    language: string;
    translatedText: string;
    backTranslatedText: string;
  }> = [];
  
  // Translate through each language
  for (const langCode of languages.slice(0, 3)) { // Limit to 3 languages
    const languageName = languageMap[langCode] || langCode;
    try {
      const result = await translateAndBack(text, langCode, languageName);
      if (result.translated && result.backTranslated) {
        translations.push({
          language: languageName,
          translatedText: result.translated,
          backTranslatedText: result.backTranslated,
        });
      }
    } catch (error) {
      console.warn(`[Back-Translation] Failed to translate through ${languageName}:`, error);
      // Continue with other languages
    }
  }
  
  if (translations.length === 0) {
    // Fallback if all translations fail
    return {
      originalText: text,
      translations: [],
      mergedText: text,
      mergeStrategy,
    };
  }
  
  // Merge translations
  const mergedText = mergeTranslations(text, translations, mergeStrategy);
  
  return {
    originalText: text,
    translations,
    mergedText,
    mergeStrategy,
  };
}
