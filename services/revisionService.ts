import { supabase } from './supabaseService';
import { Revision } from '../types';

export const saveRevision = async (
  entityType: 'chapter' | 'scene' | 'character' | 'world',
  entityId: string,
  content: any,
  metadata?: Revision['metadata']
): Promise<void> => {
  const { error } = await supabase
    .from('revisions')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      content: content,
      metadata: metadata || {}
    });

  if (error) {
    console.error('Error saving revision:', error);
    throw error;
  }
};

export const getRevisions = async (
  entityType: 'chapter' | 'scene' | 'character' | 'world',
  entityId: string
): Promise<Revision[]> => {
  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching revisions:', error);
    throw error;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    content: r.content,
    metadata: r.metadata || {},
    createdAt: new Date(r.created_at).getTime()
  }));
};

export const restoreRevision = async (
  revisionId: string
): Promise<Revision | null> => {
  const { data, error } = await supabase
    .from('revisions')
    .select('*')
    .eq('id', revisionId)
    .single();

  if (error) {
    console.error('Error fetching revision:', error);
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    entityType: data.entity_type,
    entityId: data.entity_id,
    content: data.content,
    metadata: data.metadata || {},
    createdAt: new Date(data.created_at).getTime()
  };
};
