import React from 'react';
import { EditorComment } from '../types/editor';

interface CommentAnnotationProps {
  comment: EditorComment;
  position: { top: number; left: number };
  onClose: () => void;
  onResolve?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
}

const CommentAnnotation: React.FC<CommentAnnotationProps> = ({
  comment,
  position,
  onClose,
  onResolve,
  onDelete,
}) => {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed z-50 bg-zinc-900 border border-amber-600/50 rounded-lg shadow-2xl p-4 min-w-[300px] max-w-[400px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">
            {comment.author === 'user' ? 'You' : 'AI'}
          </span>
          <span className="text-xs text-zinc-500">
            {formatDate(comment.createdAt)}
          </span>
          {comment.resolved && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
              Resolved
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {comment.selectedText && (
        <div className="mb-2 p-2 bg-zinc-800/50 border border-zinc-700 rounded text-xs text-zinc-400 italic">
          "{comment.selectedText.substring(0, 100)}
          {comment.selectedText.length > 100 && '...'}"
        </div>
      )}

      <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-3">{comment.comment}</p>

      <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
        {!comment.resolved && onResolve && (
          <button
            onClick={() => {
              onResolve(comment.id);
              onClose();
            }}
            className="px-3 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded transition-all font-semibold"
          >
            Resolve
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => {
              onDelete(comment.id);
              onClose();
            }}
            className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded transition-all font-semibold"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentAnnotation;
