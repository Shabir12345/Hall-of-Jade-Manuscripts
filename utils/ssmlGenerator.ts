/**
 * SSML (Speech Synthesis Markup Language) generation utilities
 * For better prosody and natural pauses in TTS
 */

export interface SSMLOptions {
  addPauses?: boolean;
  emphasizeParagraphs?: boolean;
  pauseDuration?: number; // in seconds
}

/**
 * Generate SSML from plain text
 * Note: Browser TTS has limited SSML support, but this can be used for future providers
 */
export function generateSSML(text: string, options: SSMLOptions = {}): string {
  const {
    addPauses = true,
    emphasizeParagraphs = false,
    pauseDuration = 0.5
  } = options;

  let ssml = '<speak>';
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  paragraphs.forEach((paragraph, index) => {
    if (paragraph.trim().length === 0) return;
    
    // Add paragraph emphasis if enabled
    if (emphasizeParagraphs && index > 0) {
      ssml += '<break time="' + pauseDuration + 's"/>';
    }
    
    // Process sentences in paragraph
    const sentences = paragraph.split(/([.!?]+)/);
    sentences.forEach((sentence, sIndex) => {
      if (sentence.trim().length === 0) return;
      
      // Add pause after sentence-ending punctuation
      if (/[.!?]+/.test(sentence) && addPauses && sIndex < sentences.length - 1) {
        ssml += sentence.trim();
        ssml += '<break time="0.3s"/>';
      } else {
        ssml += sentence.trim();
      }
    });
    
    // Add longer pause after paragraphs
    if (addPauses && index < paragraphs.length - 1) {
      ssml += '<break time="' + pauseDuration + 's"/>';
    }
  });
  
  ssml += '</speak>';
  
  return ssml;
}

/**
 * Add natural pauses to text (for browsers that don't support SSML)
 */
export function addNaturalPauses(text: string): string {
  // Add pauses after sentence-ending punctuation
  let processed = text.replace(/([.!?])\s+/g, '$1 <pause>');
  
  // Add longer pauses after paragraphs
  processed = processed.replace(/\n\n+/g, ' <longpause> ');
  
  return processed;
}

/**
 * Clean SSML tags from text (for display)
 */
export function stripSSML(text: string): string {
  return text
    .replace(/<speak>/g, '')
    .replace(/<\/speak>/g, '')
    .replace(/<break[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
