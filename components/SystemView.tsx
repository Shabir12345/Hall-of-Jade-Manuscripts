import React, { useState, useCallback } from 'react';
import { CharacterSystem, NovelState, SystemType, SystemStatus, SystemCategory, SystemFeature } from '../types';
import { useToast } from '../contexts/ToastContext';
import SystemProgressionTimeline from './SystemProgressionTimeline';
import { generateUUID } from '../utils/uuid';

interface SystemViewProps {
  system: CharacterSystem;
  novel: NovelState;
  onUpdate: (updated: CharacterSystem) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const SystemView: React.FC<SystemViewProps> = ({
  system,
  novel,
  onUpdate,
  onDelete,
  onBack,
}) => {
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<CharacterSystem>(system);
  const [editingFeature, setEditingFeature] = useState<SystemFeature | null>(null);
  const [newFeatureName, setNewFeatureName] = useState('');

  const handleSave = useCallback(() => {
    onUpdate(edited);
    setIsEditing(false);
  }, [edited, onUpdate]);

  const handleCancel = useCallback(() => {
    setEdited(system);
    setIsEditing(false);
    setEditingFeature(null);
  }, [system]);

  const handleAddFeature = useCallback(() => {
    if (!newFeatureName.trim()) return;
    
    const newFeature: SystemFeature = {
      id: generateUUID(),
      systemId: edited.id,
      name: newFeatureName.trim(),
      description: '',
      isActive: true,
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setEdited({
      ...edited,
      features: [...(edited.features || []), newFeature]
    });
    setNewFeatureName('');
  }, [edited, newFeatureName]);

  const handleUpdateFeature = useCallback((updatedFeature: SystemFeature) => {
    setEdited({
      ...edited,
      features: (edited.features || []).map(f => 
        f.id === updatedFeature.id ? updatedFeature : f
      )
    });
    setEditingFeature(null);
  }, [edited]);

  const handleDeleteFeature = useCallback((featureId: string) => {
    setEdited({
      ...edited,
      features: (edited.features || []).filter(f => f.id !== featureId)
    });
  }, [edited]);

  const getCharacterName = (characterId: string): string => {
    const character = novel.characterCodex.find(c => c.id === characterId);
    return character?.name || 'Unknown';
  };

  const features = edited.features || [];

  return (
    <div className="p-4 md:p-5 lg:p-6 space-y-4">
      <div className="flex items-center justify-between mb-6 border-b border-zinc-700 pb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold shadow-lg shadow-purple-900/30 transition-all duration-200 hover:scale-105"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(system.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-semibold shadow-lg shadow-red-900/30 transition-all duration-200 hover:scale-105"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={edited.name}
                onChange={(e) => setEdited({ ...edited, name: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                aria-label="System name"
              />
            ) : (
              <div className="text-xl md:text-2xl font-fantasy font-bold text-purple-500">
                {system.name}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              {isEditing ? (
                <select
                  value={edited.type}
                  onChange={(e) => setEdited({ ...edited, type: e.target.value as SystemType })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  aria-label="System type"
                >
                  <option value="cultivation">Cultivation</option>
                  <option value="game">Game</option>
                  <option value="cheat">Cheat</option>
                  <option value="ability">Ability</option>
                  <option value="interface">Interface</option>
                  <option value="evolution">Evolution</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{system.type}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              {isEditing ? (
                <select
                  value={edited.category}
                  onChange={(e) => setEdited({ ...edited, category: e.target.value as SystemCategory })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  aria-label="System category"
                >
                  <option value="core">Core</option>
                  <option value="support">Support</option>
                  <option value="evolution">Evolution</option>
                  <option value="utility">Utility</option>
                  <option value="combat">Combat</option>
                  <option value="passive">Passive</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{system.category}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              {isEditing ? (
                <select
                  value={edited.status}
                  onChange={(e) => setEdited({ ...edited, status: e.target.value as SystemStatus })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  aria-label="System status"
                >
                  <option value="active">Active</option>
                  <option value="dormant">Dormant</option>
                  <option value="upgraded">Upgraded</option>
                  <option value="merged">Merged</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{system.status}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Character
              </label>
              <div className="text-gray-900 dark:text-gray-100">{getCharacterName(system.characterId)}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            {isEditing ? (
              <textarea
                value={edited.description}
                onChange={(e) => setEdited({ ...edited, description: e.target.value })}
                rows={4}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                aria-label="System description"
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel">
                {system.description || 'No description'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Level
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={edited.currentLevel || ''}
                  onChange={(e) => setEdited({ ...edited, currentLevel: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  placeholder="e.g., Level 5, Version 2.0"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{system.currentLevel || 'Not specified'}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Version
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={edited.currentVersion || ''}
                  onChange={(e) => setEdited({ ...edited, currentVersion: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                  placeholder="e.g., v2.1, Beta"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{system.currentVersion || 'Not specified'}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Appeared
              </label>
              <div className="text-gray-900 dark:text-gray-100">
                {system.firstAppearedChapter ? `Chapter ${system.firstAppearedChapter}` : 'Not set'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Updated
              </label>
              <div className="text-gray-900 dark:text-gray-100">
                {system.lastUpdatedChapter ? `Chapter ${system.lastUpdatedChapter}` : 'Not set'}
              </div>
            </div>
          </div>

          {/* System Features */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                Features ({features.length})
              </label>
              {isEditing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeatureName}
                    onChange={(e) => setNewFeatureName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                    placeholder="New feature name..."
                    className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                    aria-label="New feature name"
                  />
                  <button
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    Add Feature
                  </button>
                </div>
              )}
            </div>

            {features.length === 0 ? (
              <div className="text-sm text-zinc-500 italic py-4 text-center border border-dashed border-zinc-700 rounded-xl">
                No features yet. Add features to track system abilities.
              </div>
            ) : (
              <div className="space-y-2">
                {features.map(feature => (
                  <div
                    key={feature.id}
                    className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4"
                  >
                    {editingFeature?.id === feature.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingFeature.name}
                          onChange={(e) => setEditingFeature({ ...editingFeature, name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                          placeholder="Feature name"
                        />
                        <textarea
                          value={editingFeature.description || ''}
                          onChange={(e) => setEditingFeature({ ...editingFeature, description: e.target.value })}
                          rows={2}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200"
                          placeholder="Feature description"
                        />
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-zinc-400">
                            <input
                              type="checkbox"
                              checked={editingFeature.isActive}
                              onChange={(e) => setEditingFeature({ ...editingFeature, isActive: e.target.checked })}
                              className="rounded"
                              aria-label="Feature is active"
                            />
                            Active
                          </label>
                          <input
                            type="text"
                            value={editingFeature.level || ''}
                            onChange={(e) => setEditingFeature({ ...editingFeature, level: e.target.value })}
                            className="bg-zinc-950 border border-zinc-700 rounded px-3 py-1 text-xs text-zinc-200"
                            placeholder="Level"
                            aria-label="Feature level"
                          />
                          {feature.unlockedChapter && (
                            <span className="text-xs text-zinc-500">Unlocked: Ch {feature.unlockedChapter}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateFeature(editingFeature)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingFeature(null)}
                            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-purple-400">{feature.name}</span>
                            {feature.isActive ? (
                              <span className="px-2 py-0.5 text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-500 border border-zinc-700 rounded">
                                Inactive
                              </span>
                            )}
                            {feature.level && (
                              <span className="px-2 py-0.5 text-xs bg-purple-950/40 text-purple-300 border border-purple-900/40 rounded">
                                {feature.level}
                              </span>
                            )}
                            {feature.unlockedChapter && (
                              <span className="text-xs text-zinc-500">Ch {feature.unlockedChapter}</span>
                            )}
                          </div>
                          {feature.description && (
                            <p className="text-sm text-zinc-400 mt-1">{feature.description}</p>
                          )}
                        </div>
                        {isEditing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingFeature({ ...feature })}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFeature(feature.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              History
            </label>
            {isEditing ? (
              <textarea
                value={edited.history}
                onChange={(e) => setEdited({ ...edited, history: e.target.value })}
                rows={6}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                placeholder="Track system evolution and changes over chapters..."
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel text-sm">
                {system.history || 'No history recorded'}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            {isEditing ? (
              <textarea
                value={edited.notes}
                onChange={(e) => setEdited({ ...edited, notes: e.target.value })}
                rows={4}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
                placeholder="Additional notes about the system..."
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel text-sm">
                {system.notes || 'No notes'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progression Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <SystemProgressionTimeline system={system} />
      </div>
    </div>
  );
};

export default SystemView;
