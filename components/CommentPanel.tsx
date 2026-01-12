import React, { useState } from 'react';
import { EditorComment } from '../types/editor';

interface CommentPanelProps {
  comments: EditorComment[];
  onAddComment?: () => void;
  onEditComment?: (commentId: string, newText: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolveComment?: (commentId: string) => void;
  onUnresolveComment?: (commentId: string) => void;
  onJumpToComment?: (comment: EditorComment) => void;
  className?: string;
}

const CommentPanel: React.FC<CommentPanelProps> = ({
  comments,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolveComment,
  onUnresolveComment,
  onJumpToComment,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'resolved' | 'unresolved'>('unresolved');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const filteredComments = comments.filter(c => {
    if (filter === 'resolved') return c.resolved;
    if (filter === 'unresolved') return !c.resolved;
    return true;
  });

  const resolvedCount = comments.filter(c => c.resolved).length;
  const unresolvedCount = comments.filter(c => !c.resolved).length;

  const handleStartEdit = (comment: EditorComment) => {
    setEditingId(comment.id);
    setEditText(comment.comment);
  };

  const handleSaveEdit = () => {
    if (editingId && editText.trim() && onEditComment) {
      onEditComment(editingId, editText.trim());
      setEditingId(null);
      setEditText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">
            Comments ({comments.length})
          </h3>
          {onAddComment && (
            <button
              onClick={onAddComment}
              className="px-3 py-1 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-600/30 hover:border-amber-600/50 rounded transition-all duration-200 font-semibold"
            >
              + Add Comment
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {(['all', 'unresolved', 'resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === f
                  ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'unresolved' && ` (${unresolvedCount})`}
              {f === 'resolved' && ` (${resolvedCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Comments list */}
      <div className="max-h-96 overflow-y-auto scrollbar-thin">
        {filteredComments.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-zinc-500">
              {comments.length === 0 ? 'No comments yet.' : 'No comments match the current filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-700">
            {filteredComments.map((comment) => {
              const isEditing = editingId === comment.id;

              return (
                <div
                  key={comment.id}
                  className={`p-4 hover:bg-zinc-800/30 transition-colors ${
                    comment.resolved ? 'bg-zinc-800/20 opacity-75' : 'bg-zinc-900/30'
                  }`}
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

                    <div className="flex items-center gap-2">
                      {onJumpToComment && (
                        <button
                          onClick={() => onJumpToComment(comment)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          title="Jump to location"
                        >
                          📍
                        </button>
                      )}
                      {!comment.resolved && onResolveComment && (
                        <button
                          onClick={() => onResolveComment(comment.id)}
                          className="text-xs text-green-400 hover:text-green-300 transition-colors"
                          title="Resolve"
                        >
                          ✓
                        </button>
                      )}
                      {comment.resolved && onUnresolveComment && (
                        <button
                          onClick={() => onUnresolveComment(comment.id)}
                          className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                          title="Unresolve"
                        >
                          ↺
                        </button>
                      )}
                      {onEditComment && !isEditing && (
                        <button
                          onClick={() => handleStartEdit(comment)}
                          className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </button>
                      )}
                      {onDeleteComment && (
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selected text snippet */}
                  {comment.selectedText && (
                    <div className="mb-2 p-2 bg-zinc-800/50 border border-zinc-700 rounded text-xs text-zinc-400 italic">
                      "{comment.selectedText.substring(0, 100)}
                      {comment.selectedText.length > 100 && '...'}"
                    </div>
                  )}

                  {/* Comment text */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded p-2 text-sm text-zinc-200 resize-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded transition-all font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-all font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{comment.comment}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentPanel;
