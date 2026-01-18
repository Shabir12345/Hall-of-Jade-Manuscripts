import { NovelState, Chapter, Character } from '../types';

/**
 * Character Presence Tracker
 * 
 * Tracks character appearances across chapters and detects missing characters
 * who were active recently but haven't appeared in the latest chapters.
 */

export interface CharacterPresenceInfo {
  characterId: string;
  characterName: string;
  chaptersAppeared: number[];
  lastAppearanceChapter: number | null;
  chaptersSinceLastAppearance: number;
  recentActivityLevel: 'high' | 'medium' | 'low' | 'none';
  wasActiveRecently: boolean;
  activityContext?: string; // Description of what they were doing
}

export interface MissingCharacterWarning {
  characterId: string;
  characterName: string;
  lastAppearanceChapter: number;
  chaptersSinceLastAppearance: number;
  warningLevel: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

/**
 * Tracks character appearance frequency across all chapters
 */
export function trackCharacterPresence(
  chapters: Chapter[],
  characters: Character[]
): CharacterPresenceInfo[] {
  return characters.map(char => {
    const charNameLower = char.name.toLowerCase();
    const chaptersAppeared: number[] = [];
    let lastAppearanceChapter: number | null = null;
    let activityContext: string | undefined;

    // Find all chapters where character appears
    chapters.forEach(ch => {
      const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
      if (chContent.includes(charNameLower)) {
        chaptersAppeared.push(ch.number);
        lastAppearanceChapter = ch.number;

        // Check if character was mentioned as active or pursuing something
        const fullContent = ch.content + ' ' + (ch.summary || '');
        const activeKeywords = [
          'following', 'pursuing', 'tracking', 'investigating', 
          'trying to', 'wanted to', 'needed to', 'attempting',
          'active', 'present', 'was there', 'participated'
        ];
        
        const contentLower = fullContent.toLowerCase();
        const charIndex = contentLower.indexOf(charNameLower);
        if (charIndex >= 0) {
          // Look for activity keywords near character mention
          for (const keyword of activeKeywords) {
            const keywordIndex = contentLower.indexOf(keyword);
            if (keywordIndex >= 0 && Math.abs(charIndex - keywordIndex) < 100) {
              // Extract context around the activity
              const contextStart = Math.max(0, charIndex - 50);
              const contextEnd = Math.min(fullContent.length, charIndex + charNameLower.length + 50);
              activityContext = fullContent.substring(contextStart, contextEnd).trim();
              break;
            }
          }
        }
      }
    });

    // Determine recent activity level
    const lastChapterNumber = chapters.length > 0 ? chapters[chapters.length - 1]?.number || 0 : 0;
    const chaptersSinceLastAppearance = lastAppearanceChapter 
      ? lastChapterNumber - lastAppearanceChapter 
      : lastChapterNumber;

    // Check last 5 chapters for activity
    const recentChapters = chapters.slice(-5);
    const appearedInRecent = recentChapters.some(ch => {
      const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
      return chContent.includes(charNameLower);
    });

    let recentActivityLevel: 'high' | 'medium' | 'low' | 'none';
    if (appearedInRecent) {
      // Count appearances in recent chapters
      const recentAppearances = recentChapters.filter(ch => {
        const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
        return chContent.includes(charNameLower);
      }).length;
      
      if (recentAppearances >= 3) recentActivityLevel = 'high';
      else if (recentAppearances >= 2) recentActivityLevel = 'medium';
      else recentActivityLevel = 'low';
    } else {
      recentActivityLevel = 'none';
    }

    // Character was active if they appeared 2-5 chapters ago with activity context
    const wasActiveRecently = chaptersSinceLastAppearance >= 2 && 
                             chaptersSinceLastAppearance <= 5 && 
                             !!activityContext;

    return {
      characterId: char.id,
      characterName: char.name,
      chaptersAppeared,
      lastAppearanceChapter,
      chaptersSinceLastAppearance,
      recentActivityLevel,
      wasActiveRecently,
      activityContext,
    };
  });
}

/**
 * Detects missing characters who should appear but haven't
 */
export function detectMissingCharacters(
  chapters: Chapter[],
  characters: Character[],
  options: {
    checkLastChapters?: number; // How many recent chapters to check (default: 2)
    maxChaptersSinceAppearance?: number; // Max chapters since last appearance before warning (default: 5)
  } = {}
): MissingCharacterWarning[] {
  const {
    checkLastChapters = 2,
    maxChaptersSinceAppearance = 5,
  } = options;

  const presenceInfo = trackCharacterPresence(chapters, characters);
  const warnings: MissingCharacterWarning[] = [];
  const lastChapterNumber = chapters.length > 0 ? chapters[chapters.length - 1]?.number || 0 : 0;
  const lastChaptersToCheck = chapters.slice(-checkLastChapters);

  presenceInfo.forEach(presence => {
    // Skip protagonist - they should appear but are handled separately
    const character = characters.find(c => c.id === presence.characterId);
    if (character?.isProtagonist) return;

    // Check if character was active recently but hasn't appeared in last N chapters
    if (presence.wasActiveRecently && presence.lastAppearanceChapter) {
      const appearedInLastChapters = lastChaptersToCheck.some(ch => {
        const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
        return chContent.includes(presence.characterName.toLowerCase());
      });

      if (!appearedInLastChapters) {
        let warningLevel: 'critical' | 'warning' | 'info';
        if (presence.chaptersSinceLastAppearance >= maxChaptersSinceAppearance) {
          warningLevel = 'critical';
        } else if (presence.chaptersSinceLastAppearance >= 3) {
          warningLevel = 'warning';
        } else {
          warningLevel = 'info';
        }

        warnings.push({
          characterId: presence.characterId,
          characterName: presence.characterName,
          lastAppearanceChapter: presence.lastAppearanceChapter,
          chaptersSinceLastAppearance: presence.chaptersSinceLastAppearance,
          warningLevel,
          message: `Character "${presence.characterName}" was active ${presence.chaptersSinceLastAppearance} chapter(s) ago but hasn't appeared since. ${presence.activityContext ? `Last activity: ${presence.activityContext.substring(0, 100)}` : ''}`,
          suggestion: `Consider including "${presence.characterName}" in the next chapter to follow up on their storyline.`,
        });
      }
    }

    // Also check for characters who appeared frequently but disappeared
    if (presence.chaptersAppeared.length >= 3 && 
        presence.chaptersSinceLastAppearance > 3 &&
        presence.chaptersSinceLastAppearance <= maxChaptersSinceAppearance) {
      // Character was recurring but hasn't appeared recently
      const appearedInLastChapters = lastChaptersToCheck.some(ch => {
        const chContent = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
        return chContent.includes(presence.characterName.toLowerCase());
      });

      if (!appearedInLastChapters && !warnings.some(w => w.characterId === presence.characterId)) {
        warnings.push({
          characterId: presence.characterId,
          characterName: presence.characterName,
          lastAppearanceChapter: presence.lastAppearanceChapter || lastChapterNumber,
          chaptersSinceLastAppearance: presence.chaptersSinceLastAppearance,
          warningLevel: 'info',
          message: `Recurring character "${presence.characterName}" appeared in ${presence.chaptersAppeared.length} chapter(s) but hasn't appeared in the last ${presence.chaptersSinceLastAppearance} chapter(s).`,
          suggestion: `Consider reintroducing "${presence.characterName}" if their storyline is still relevant.`,
        });
      }
    }
  });

  return warnings.sort((a, b) => {
    const levelOrder = { critical: 3, warning: 2, info: 1 };
    return levelOrder[b.warningLevel] - levelOrder[a.warningLevel];
  });
}

/**
 * Gets characters who should appear in the next chapter
 */
export function getCharactersWhoShouldAppear(
  state: NovelState,
  nextChapterNumber: number
): Character[] {
  const warnings = detectMissingCharacters(
    state.chapters,
    state.characterCodex,
    {
      checkLastChapters: 2,
      maxChaptersSinceAppearance: 5,
    }
  );

  // Filter for critical and warning level characters
  const criticalWarnings = warnings.filter(w => w.warningLevel === 'critical' || w.warningLevel === 'warning');
  
  return criticalWarnings.map(warning => {
    return state.characterCodex.find(c => c.id === warning.characterId);
  }).filter((c): c is Character => c !== undefined);
}
