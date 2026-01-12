import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { ViewType } from '../types';
import { useNovel } from './NovelContext';

export type NavigationTarget = 
  | { type: 'view'; view: ViewType }
  | { type: 'chapter'; chapterId: string; novelId?: string }
  | { type: 'character'; characterId: string; novelId?: string }
  | { type: 'arc'; arcId: string; novelId?: string }
  | { type: 'world-entry'; entryId: string; novelId?: string }
  | { type: 'antagonist'; antagonistId: string; novelId?: string }
  | { type: 'scene'; sceneId: string; chapterId: string; novelId?: string };

interface NavigationContextType {
  navigate: (target: NavigationTarget) => void;
  navigateToChapter: (chapterId: string, novelId?: string) => void;
  navigateToCharacter: (characterId: string, novelId?: string) => void;
  navigateToArc: (arcId: string, novelId?: string) => void;
  navigateToWorldEntry: (entryId: string, novelId?: string) => void;
  navigateToAntagonist: (antagonistId: string, novelId?: string) => void;
  navigateToScene: (sceneId: string, chapterId: string, novelId?: string) => void;
  navigateToView: (view: ViewType) => void;
  // Helper to get entity details for display
  getChapterLink: (chapterId: string, novelId?: string) => { onClick: () => void; title: string };
  getCharacterLink: (characterId: string, novelId?: string) => { onClick: () => void; title: string };
  getArcLink: (arcId: string, novelId?: string) => { onClick: () => void; title: string };
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

/**
 * Hook to access the Navigation context.
 * 
 * Provides navigation methods and link generators for navigating between views
 * and entities (novels, chapters, characters, arcs).
 * Must be used within a NavigationProvider.
 * 
 * @returns {NavigationContextType} The navigation context containing:
 * - navigateToView: Navigate to a specific view
 * - navigateToNovel: Navigate to a novel's dashboard
 * - navigateToChapter: Navigate to a specific chapter
 * - getChapterLink: Get navigation link for a chapter
 * - getCharacterLink: Get navigation link for a character
 * - getArcLink: Get navigation link for an arc
 * 
 * @throws {Error} If used outside of a NavigationProvider
 * 
 * @example
 * ```typescript
 * const { navigateToView, navigateToChapter } = useNavigation();
 * 
 * // Navigate to a view
 * navigateToView('characters');
 * 
 * // Navigate to a chapter
 * navigateToChapter('chapter-id', 'novel-id');
 * 
 * // Get a link for navigation
 * const link = getChapterLink('chapter-id', 'novel-id');
 * <button onClick={link.onClick}>{link.title}</button>
 * ```
 */
export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const {
    activeNovelId,
    setActiveNovelId,
    setView,
    setActiveChapterId,
    activeNovel,
    library,
  } = useNovel();

  const navigate = useCallback((target: NavigationTarget) => {
    // Handle novel switching if needed
    const hasNovelId = (t: NavigationTarget): t is Extract<NavigationTarget, { novelId?: string }> => {
      return 'novelId' in t && t.novelId !== undefined;
    };
    
    if (hasNovelId(target) && target.novelId && target.novelId !== activeNovelId) {
      setActiveNovelId(target.novelId);
      // Wait a tick for novel to switch, then navigate
      setTimeout(() => {
        navigate(target);
      }, 0);
      return;
    }

    switch (target.type) {
      case 'view':
        setView(target.view);
        setActiveChapterId(null);
        break;

      case 'chapter': {
        // Find the chapter to get its number
        const novel = target.novelId 
          ? library.find(n => n.id === target.novelId)
          : activeNovel;
        const chapter = novel?.chapters.find(c => c.id === target.chapterId);
        
        if (chapter) {
          setView('editor');
          setActiveChapterId(target.chapterId);
        } else {
          // Fallback: navigate to chapters view
          setView('chapters');
          setActiveChapterId(null);
        }
        break;
      }

      case 'character':
        setView('characters');
        setActiveChapterId(null);
        // Could scroll to character or highlight it
        // For now, just navigate to characters view
        break;

      case 'arc':
        setView('planning');
        setActiveChapterId(null);
        // Could scroll to arc or highlight it
        break;

      case 'world-entry':
        setView('world-bible');
        setActiveChapterId(null);
        break;

      case 'antagonist':
        setView('antagonists');
        setActiveChapterId(null);
        break;

      case 'scene': {
        // Navigate to chapter editor and highlight the scene
        const novel = target.novelId 
          ? library.find(n => n.id === target.novelId)
          : activeNovel;
        const chapter = novel?.chapters.find(c => c.id === target.chapterId);
        
        if (chapter) {
          setView('editor');
          setActiveChapterId(target.chapterId);
          // Scene highlighting could be handled by ChapterEditor
        } else {
          setView('chapters');
        }
        break;
      }
    }
  }, [activeNovelId, setActiveNovelId, setView, setActiveChapterId, activeNovel, library]);

  const navigateToChapter = useCallback((chapterId: string, novelId?: string) => {
    navigate({ type: 'chapter', chapterId, novelId });
  }, [navigate]);

  const navigateToCharacter = useCallback((characterId: string, novelId?: string) => {
    navigate({ type: 'character', characterId, novelId });
  }, [navigate]);

  const navigateToArc = useCallback((arcId: string, novelId?: string) => {
    navigate({ type: 'arc', arcId, novelId });
  }, [navigate]);

  const navigateToWorldEntry = useCallback((entryId: string, novelId?: string) => {
    navigate({ type: 'world-entry', entryId, novelId });
  }, [navigate]);

  const navigateToAntagonist = useCallback((antagonistId: string, novelId?: string) => {
    navigate({ type: 'antagonist', antagonistId, novelId });
  }, [navigate]);

  const navigateToScene = useCallback((sceneId: string, chapterId: string, novelId?: string) => {
    navigate({ type: 'scene', sceneId, chapterId, novelId });
  }, [navigate]);

  const navigateToView = useCallback((view: ViewType) => {
    navigate({ type: 'view', view });
  }, [navigate]);

  // Helper functions to create link objects
  const getChapterLink = useCallback((chapterId: string, novelId?: string) => {
    const novel = novelId 
      ? library.find(n => n.id === novelId)
      : activeNovel;
    const chapter = novel?.chapters.find(c => c.id === chapterId);
    
    return {
      onClick: () => navigateToChapter(chapterId, novelId),
      title: chapter ? `Chapter ${chapter.number}: ${chapter.title}` : 'Chapter',
    };
  }, [navigateToChapter, activeNovel, library]);

  const getCharacterLink = useCallback((characterId: string, novelId?: string) => {
    const novel = novelId 
      ? library.find(n => n.id === novelId)
      : activeNovel;
    const character = novel?.characterCodex.find(c => c.id === characterId);
    
    return {
      onClick: () => navigateToCharacter(characterId, novelId),
      title: character?.name || 'Character',
    };
  }, [navigateToCharacter, activeNovel, library]);

  const getArcLink = useCallback((arcId: string, novelId?: string) => {
    const novel = novelId 
      ? library.find(n => n.id === novelId)
      : activeNovel;
    const arc = novel?.plotLedger.find(a => a.id === arcId);
    
    return {
      onClick: () => navigateToArc(arcId, novelId),
      title: arc?.title || 'Arc',
    };
  }, [navigateToArc, activeNovel, library]);

  const value = useMemo<NavigationContextType>(() => ({
    navigate,
    navigateToChapter,
    navigateToCharacter,
    navigateToArc,
    navigateToWorldEntry,
    navigateToAntagonist,
    navigateToScene,
    navigateToView,
    getChapterLink,
    getCharacterLink,
    getArcLink,
  }), [
    navigate,
    navigateToChapter,
    navigateToCharacter,
    navigateToArc,
    navigateToWorldEntry,
    navigateToAntagonist,
    navigateToScene,
    navigateToView,
    getChapterLink,
    getCharacterLink,
    getArcLink,
  ]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};
