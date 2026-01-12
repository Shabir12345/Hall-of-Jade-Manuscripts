import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';

interface EntityLinkProps {
  type: 'chapter' | 'character' | 'arc' | 'world-entry' | 'antagonist' | 'scene';
  id: string;
  chapterId?: string; // Required for scene type
  novelId?: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}

/**
 * A clickable link component that navigates to different entity types in the app.
 * Use this to create clickable references to chapters, characters, arcs, etc.
 */
export const EntityLink: React.FC<EntityLinkProps> = ({
  type,
  id,
  chapterId,
  novelId,
  className = '',
  children,
  title,
}) => {
  const { navigate } = useNavigation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    switch (type) {
      case 'chapter':
        navigate({ type: 'chapter', chapterId: id, novelId });
        break;
      case 'character':
        navigate({ type: 'character', characterId: id, novelId });
        break;
      case 'arc':
        navigate({ type: 'arc', arcId: id, novelId });
        break;
      case 'world-entry':
        navigate({ type: 'world-entry', entryId: id, novelId });
        break;
      case 'antagonist':
        navigate({ type: 'antagonist', antagonistId: id, novelId });
        break;
      case 'scene':
        if (chapterId) {
          navigate({ type: 'scene', sceneId: id, chapterId, novelId });
        }
        break;
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-amber-500 hover:text-amber-400 hover:underline transition-colors ${className}`}
      title={title}
    >
      {children}
    </button>
  );
};
