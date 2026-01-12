import { supabase } from './supabaseService';
import { EditorSuggestion, CreateSuggestionInput } from '../types/editor';
import { withRetry } from '../utils/errorHandling';

/**
 * Suggestion Service
 * Handles all CRUD operations for editor suggestions (track changes)
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all suggestions for a chapter
 */
export async function getSuggestions(chapterId: string): Promise<EditorSuggestion[]> {
  return withRetry(async () => {
    const { data: suggestions, error } = await supabase
      .from('editor_suggestions')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching suggestions:', error);
      throw new Error(`Failed to fetch suggestions: ${error.message}`);
    }

    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    return suggestions.map(suggestion => ({
      id: suggestion.id,
      chapterId: suggestion.chapter_id,
      suggestionType: suggestion.suggestion_type as 'insertion' | 'deletion' | 'replacement',
      originalText: suggestion.original_text,
      suggestedText: suggestion.suggested_text,
      textRange: suggestion.text_range as { start: number; end: number },
      status: suggestion.status as 'pending' | 'accepted' | 'rejected',
      author: suggestion.author as 'user' | 'ai',
      reason: suggestion.reason || '',
      createdAt: timestampToNumber(suggestion.created_at),
      updatedAt: timestampToNumber(suggestion.updated_at),
    }));
  });
}

/**
 * Create a new suggestion
 */
export async function createSuggestion(input: CreateSuggestionInput): Promise<EditorSuggestion> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_suggestions')
      .insert({
        chapter_id: input.chapterId,
        suggestion_type: input.suggestionType,
        original_text: input.originalText,
        suggested_text: input.suggestedText,
        text_range: input.textRange,
        author: input.author || 'user',
        reason: input.reason || '',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating suggestion:', error);
      throw new Error(`Failed to create suggestion: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      suggestionType: data.suggestion_type as 'insertion' | 'deletion' | 'replacement',
      originalText: data.original_text,
      suggestedText: data.suggested_text,
      textRange: data.text_range as { start: number; end: number },
      status: data.status as 'pending' | 'accepted' | 'rejected',
      author: data.author as 'user' | 'ai',
      reason: data.reason || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Accept a suggestion
 */
export async function acceptSuggestion(suggestionId: string): Promise<EditorSuggestion> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_suggestions')
      .update({ status: 'accepted' })
      .eq('id', suggestionId)
      .select()
      .single();

    if (error) {
      console.error('Error accepting suggestion:', error);
      throw new Error(`Failed to accept suggestion: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      suggestionType: data.suggestion_type as 'insertion' | 'deletion' | 'replacement',
      originalText: data.original_text,
      suggestedText: data.suggested_text,
      textRange: data.text_range as { start: number; end: number },
      status: data.status as 'pending' | 'accepted' | 'rejected',
      author: data.author as 'user' | 'ai',
      reason: data.reason || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Reject a suggestion
 */
export async function rejectSuggestion(suggestionId: string, reason?: string): Promise<EditorSuggestion> {
  return withRetry(async () => {
    const updateData: any = { status: 'rejected' };
    if (reason) {
      updateData.reason = reason;
    }

    const { data, error } = await supabase
      .from('editor_suggestions')
      .update(updateData)
      .eq('id', suggestionId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting suggestion:', error);
      throw new Error(`Failed to reject suggestion: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      suggestionType: data.suggestion_type as 'insertion' | 'deletion' | 'replacement',
      originalText: data.original_text,
      suggestedText: data.suggested_text,
      textRange: data.text_range as { start: number; end: number },
      status: data.status as 'pending' | 'accepted' | 'rejected',
      author: data.author as 'user' | 'ai',
      reason: data.reason || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Delete a suggestion
 */
export async function deleteSuggestion(suggestionId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('editor_suggestions')
      .delete()
      .eq('id', suggestionId);

    if (error) {
      console.error('Error deleting suggestion:', error);
      throw new Error(`Failed to delete suggestion: ${error.message}`);
    }
  });
}

/**
 * Apply a suggestion to chapter content
 * Returns the modified content with the suggestion applied
 */
export async function applySuggestion(content: string, suggestion: EditorSuggestion): Promise<string> {
  // Apply suggestion based on type
  if (suggestion.suggestionType === 'insertion') {
    // Insert the suggested text at the start position
    const before = content.substring(0, suggestion.textRange.start);
    const after = content.substring(suggestion.textRange.start);
    return before + suggestion.suggestedText + after;
  } else if (suggestion.suggestionType === 'deletion') {
    // Remove the original text
    const before = content.substring(0, suggestion.textRange.start);
    const after = content.substring(suggestion.textRange.end);
    return before + after;
  } else if (suggestion.suggestionType === 'replacement') {
    // Replace the original text with suggested text
    const before = content.substring(0, suggestion.textRange.start);
    const after = content.substring(suggestion.textRange.end);
    return before + suggestion.suggestedText + after;
  }
  
  return content;
}

/**
 * Get pending suggestions for a chapter
 */
export async function getPendingSuggestions(chapterId: string): Promise<EditorSuggestion[]> {
  const all = await getSuggestions(chapterId);
  return all.filter(s => s.status === 'pending');
}

/**
 * Get accepted suggestions for a chapter
 */
export async function getAcceptedSuggestions(chapterId: string): Promise<EditorSuggestion[]> {
  const all = await getSuggestions(chapterId);
  return all.filter(s => s.status === 'accepted');
}
