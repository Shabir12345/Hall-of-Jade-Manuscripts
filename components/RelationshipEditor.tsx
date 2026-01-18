/**
 * Relationship Editor Component
 * Dialog for creating and editing character relationships
 */

import React, { useState, useMemo } from 'react';
import type { Character, Relationship } from '../types';
import { addOrUpdateRelationship, removeRelationship, getInverseRelationshipType } from '../services/relationshipService';

interface RelationshipEditorProps {
  sourceCharacter: Character;
  targetCharacter?: Character | null;
  existingRelationship?: Relationship | null;
  allCharacters: Character[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCharacters: Character[]) => void;
}

const RELATIONSHIP_TYPES = [
  'Ally',
  'Friend',
  'Enemy',
  'Rival',
  'Mentor',
  'Student',
  'Master',
  'Disciple',
  'Lover',
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Guardian',
  'Ward',
  'Nemesis',
  'Companion',
  'Acquaintance',
  'Follower',
  'Leader',
] as const;

export const RelationshipEditor: React.FC<RelationshipEditorProps> = ({
  sourceCharacter,
  targetCharacter: initialTargetCharacter,
  existingRelationship,
  allCharacters,
  isOpen,
  onClose,
  onSave,
}) => {
  const [targetCharacterId, setTargetCharacterId] = useState<string>(
    initialTargetCharacter?.id || existingRelationship?.characterId || ''
  );
  const [relationshipType, setRelationshipType] = useState<string>(
    existingRelationship?.type || 'Friend'
  );
  const [history, setHistory] = useState<string>(
    existingRelationship?.history || 'Karma link recorded in chronicle.'
  );
  const [impact, setImpact] = useState<string>(
    existingRelationship?.impact || 'Fate has shifted.'
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTargetCharacters = useMemo(() => {
    return allCharacters.filter(c => c.id !== sourceCharacter.id);
  }, [allCharacters, sourceCharacter.id]);

  const selectedTargetCharacter = useMemo(() => {
    return allCharacters.find(c => c.id === targetCharacterId);
  }, [allCharacters, targetCharacterId]);

  const inverseType = useMemo(() => {
    if (!relationshipType) return relationshipType;
    return getInverseRelationshipType(relationshipType);
  }, [relationshipType]);

  if (!isOpen) return null;

  const handleSave = () => {
    setError(null);

    if (!targetCharacterId) {
      setError('Please select a target character');
      return;
    }

    if (!relationshipType.trim()) {
      setError('Please select a relationship type');
      return;
    }

    if (targetCharacterId === sourceCharacter.id) {
      setError('A character cannot have a relationship with themselves');
      return;
    }

    const targetCharacter = allCharacters.find(c => c.id === targetCharacterId);
    if (!targetCharacter) {
      setError('Target character not found');
      return;
    }

    // Use relationship service to add/update relationship
    const result = addOrUpdateRelationship(
      allCharacters,
      sourceCharacter.id,
      targetCharacterId,
      relationshipType.trim(),
      history.trim() || 'Karma link recorded in chronicle.',
      impact.trim() || 'Fate has shifted.',
      true // bidirectional
    );

    if (result.success) {
      onSave(result.updatedCharacters);
      onClose();
    } else {
      setError(result.errors.join(', '));
    }
  };

  const handleDelete = () => {
    if (!existingRelationship || !targetCharacterId) return;

    setError(null);

    const confirmed = window.confirm(
      `Are you sure you want to remove the relationship between "${sourceCharacter.name}" and "${selectedTargetCharacter?.name || 'this character'}"?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    const result = removeRelationship(
      allCharacters,
      sourceCharacter.id,
      targetCharacterId,
      true // bidirectional
    );

    if (result.success) {
      onSave(result.updatedCharacters);
      onClose();
    } else {
      setError(result.errors.join(', '));
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    setTargetCharacterId(initialTargetCharacter?.id || existingRelationship?.characterId || '');
    setRelationshipType(existingRelationship?.type || 'Friend');
    setHistory(existingRelationship?.history || 'Karma link recorded in chronicle.');
    setImpact(existingRelationship?.impact || 'Fate has shifted.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-fantasy font-bold text-amber-400">
            {existingRelationship ? 'Edit Relationship' : 'Create Relationship'}
          </h2>
          <button
            onClick={handleCancel}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Source Character (read-only) */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Source Character
            </label>
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300">
              {sourceCharacter.name}
            </div>
          </div>

          {/* Target Character */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Target Character *
            </label>
            <select
              value={targetCharacterId}
              onChange={(e) => setTargetCharacterId(e.target.value)}
              disabled={!!existingRelationship}
              aria-label="Target character"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select a character...</option>
              {availableTargetCharacters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship Type */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Relationship Type *
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              title="Select relationship type"
              aria-label="Relationship type"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {RELATIONSHIP_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {inverseType && inverseType !== relationshipType && selectedTargetCharacter && (
              <p className="mt-1 text-xs text-zinc-500">
                Inverse: {selectedTargetCharacter.name} will have type "{inverseType}"
              </p>
            )}
          </div>

          {/* History */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              History
            </label>
            <textarea
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              placeholder="Describe the history of this relationship..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Impact */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Impact
            </label>
            <textarea
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="Describe the impact of this relationship..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {existingRelationship && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-950/30 hover:bg-red-950/50 text-red-400 px-4 py-2 rounded-lg border border-red-800 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              onClick={handleCancel}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg border border-zinc-700 font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-amber-900/20"
            >
              {existingRelationship ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};