import { supabase } from './supabaseService';
import { EditorHighlight, CreateHighlightInput, UpdateHighlightInput } from '../types/editor';
import { withRetry } from '../utils/errorHandling';

/**
 * Highlight Service
 * Handles all CRUD operations for text highlighting
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all highlights for a chapter
 */
export async function getHighlights(chapterId: string): Promise<EditorHighlight[]> {
  return withRetry(async () => {
    const { data: highlights, error } = await supabase
      .from('editor_highlights')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching highlights:', error);
      throw new Error(`Failed to fetch highlights: ${error.message}`);
    }

    if (!highlights || highlights.length === 0) {
      return [];
    }

    return highlights.map(highlight => ({
      id: highlight.id,
      chapterId: highlight.chapter_id,
      textRange: highlight.text_range as { start: number; end: number },
      highlightType: highlight.highlight_type as 'issue' | 'strength' | 'needs_work' | 'note' | 'question',
      color: highlight.color,
      note: highlight.note || undefined,
      createdAt: timestampToNumber(highlight.created_at),
      updatedAt: timestampToNumber(highlight.updated_at),
    }));
  });
}

/**
 * Create a new highlight
 */
export async function createHighlight(input: CreateHighlightInput): Promise<EditorHighlight> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_highlights')
      .insert({
        chapter_id: input.chapterId,
        text_range: input.textRange,
        highlight_type: input.highlightType,
        color: input.color,
        note: input.note || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating highlight:', error);
      throw new Error(`Failed to create highlight: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      textRange: data.text_range as { start: number; end: number },
      highlightType: data.highlight_type as 'issue' | 'strength' | 'needs_work' | 'note' | 'question',
      color: data.color,
      note: data.note || undefined,
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Update a highlight
 */
export async function updateHighlight(highlightId: string, updates: UpdateHighlightInput): Promise<EditorHighlight> {
  return withRetry(async () => {
    const updateData: any = {};
    
    if (updates.highlightType !== undefined) {
      updateData.highlight_type = updates.highlightType;
    }
    
    if (updates.color !== undefined) {
      updateData.color = updates.color;
    }
    
    if (updates.note !== undefined) {
      updateData.note = updates.note || null;
    }

    const { data, error } = await supabase
      .from('editor_highlights')
      .update(updateData)
      .eq('id', highlightId)
      .select()
      .single();

    if (error) {
      console.error('Error updating highlight:', error);
      throw new Error(`Failed to update highlight: ${error.message}`);
    }

    return {
      id: data.id,
      chapterId: data.chapter_id,
      textRange: data.text_range as { start: number; end: number },
      highlightType: data.highlight_type as 'issue' | 'strength' | 'needs_work' | 'note' | 'question',
      color: data.color,
      note: data.note || undefined,
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(highlightId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('editor_highlights')
      .delete()
      .eq('id', highlightId);

    if (error) {
      console.error('Error deleting highlight:', error);
      throw new Error(`Failed to delete highlight: ${error.message}`);
    }
  });
}

/**
 * Get default color for highlight type
 */
export function getDefaultColorForType(type: 'issue' | 'strength' | 'needs_work' | 'note' | 'question'): string {
  const colors: Record<typeof type, string> = {
    issue: '#ef4444', // red-500
    strength: '#22c55e', // green-500
    needs_work: '#f59e0b', // amber-500
    note: '#3b82f6', // blue-500
    question: '#a855f7', // purple-500
  };
  return colors[type];
}
