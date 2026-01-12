import { supabase } from './supabaseService';
import { EditorComment, CreateCommentInput, UpdateCommentInput } from '../types/editor';
import { withRetry } from '../utils/errorHandling';

/**
 * Comment Service
 * Handles all CRUD operations for editor comments
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all comments for a chapter
 */
export async function getComments(chapterId: string): Promise<EditorComment[]> {
  return withRetry(async () => {
    const { data: comments, error } = await supabase
      .from('editor_comments')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    if (!comments || comments.length === 0) {
      return [];
    }

    return comments.map(comment => ({
      id: comment.id,
      chapterId: comment.chapter_id,
      entityType: comment.entity_type as 'chapter' | 'scene',
      entityId: comment.entity_id,
      textRange: comment.text_range as { start: number; end: number },
      selectedText: comment.selected_text,
      comment: comment.comment,
      author: comment.author as 'user' | 'ai',
      resolved: comment.resolved || false,
      resolvedAt: comment.resolved_at ? timestampToNumber(comment.resolved_at) : undefined,
      createdAt: timestampToNumber(comment.created_at),
      updatedAt: timestampToNumber(comment.updated_at),
    }));
  });
}

/**
 * Create a new comment
 */
export async function createComment(input: CreateCommentInput): Promise<EditorComment> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_comments')
      .insert({
        chapter_id: input.chapterId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        text_range: input.textRange,
        selected_text: input.selectedText,
        comment: input.comment,
        author: input.author || 'user',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    const now = Date.now();
    return {
      id: data.id,
      chapterId: data.chapter_id,
      entityType: data.entity_type as 'chapter' | 'scene',
      entityId: data.entity_id,
      textRange: data.text_range as { start: number; end: number },
      selectedText: data.selected_text,
      comment: data.comment,
      author: data.author as 'user' | 'ai',
      resolved: data.resolved || false,
      resolvedAt: data.resolved_at ? timestampToNumber(data.resolved_at) : undefined,
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Update a comment
 */
export async function updateComment(commentId: string, updates: UpdateCommentInput): Promise<EditorComment> {
  return withRetry(async () => {
    const updateData: any = {};
    
    if (updates.comment !== undefined) {
      updateData.comment = updates.comment;
    }
    
    if (updates.resolved !== undefined) {
      updateData.resolved = updates.resolved;
      if (updates.resolved) {
        updateData.resolved_at = new Date().toISOString();
      } else {
        updateData.resolved_at = null;
      }
    }

    const { data, error } = await supabase
      .from('editor_comments')
      .update(updateData)
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating comment:', error);
      throw new Error(`Failed to update comment: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      entityType: data.entity_type as 'chapter' | 'scene',
      entityId: data.entity_id,
      textRange: data.text_range as { start: number; end: number },
      selectedText: data.selected_text,
      comment: data.comment,
      author: data.author as 'user' | 'ai',
      resolved: data.resolved || false,
      resolvedAt: data.resolved_at ? timestampToNumber(data.resolved_at) : undefined,
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('editor_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  });
}

/**
 * Resolve a comment
 */
export async function resolveComment(commentId: string): Promise<EditorComment> {
  return updateComment(commentId, { resolved: true });
}

/**
 * Unresolve a comment
 */
export async function unresolveComment(commentId: string): Promise<EditorComment> {
  return updateComment(commentId, { resolved: false });
}
