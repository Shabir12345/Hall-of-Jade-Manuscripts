import React, { useState, useCallback } from 'react';
import { Antagonist, NovelState, AntagonistType, AntagonistStatus, AntagonistDuration, ThreatLevel, Character } from '../types';
import { useToast } from '../contexts/ToastContext';
import AntagonistProgressionTimeline from './AntagonistProgressionTimeline';
import AntagonistChapterAppearances from './AntagonistChapterAppearances';

interface AntagonistViewProps {
  antagonist: Antagonist;
  novel: NovelState;
  onUpdate: (updated: Antagonist) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

const AntagonistView: React.FC<AntagonistViewProps> = ({
  antagonist,
  novel,
  onUpdate,
  onDelete,
  onBack,
}) => {
  const { showSuccess, showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState<Antagonist>(antagonist);

  const handleSave = useCallback(() => {
    onUpdate(edited);
    setIsEditing(false);
  }, [edited, onUpdate]);

  const handleCancel = useCallback(() => {
    setEdited(antagonist);
    setIsEditing(false);
  }, [antagonist]);

  const getCharacterName = (characterId: string): string => {
    const character = novel.characterCodex.find(c => c.id === characterId);
    return character?.name || 'Unknown';
  };

  const relationships = antagonist.relationships || [];
  const groupMembers = antagonist.groupMembers || [];
  const arcAssociations = antagonist.arcAssociations || [];

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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(antagonist.id)}
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
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              />
            ) : (
              <div className="text-xl md:text-2xl font-fantasy font-bold text-amber-500">
                {antagonist.name}
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
                  onChange={(e) => setEdited({ ...edited, type: e.target.value as AntagonistType })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-label="Antagonist type"
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                  <option value="system">System</option>
                  <option value="society">Society</option>
                  <option value="abstract">Abstract</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{antagonist.type}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              {isEditing ? (
                <select
                  value={edited.status}
                  onChange={(e) => setEdited({ ...edited, status: e.target.value as AntagonistStatus })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-label="Antagonist status"
                >
                  <option value="active">Active</option>
                  <option value="hinted">Hinted</option>
                  <option value="dormant">Dormant</option>
                  <option value="defeated">Defeated</option>
                  <option value="transformed">Transformed</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{antagonist.status}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration Scope
              </label>
              {isEditing ? (
                <select
                  value={edited.durationScope}
                  onChange={(e) => setEdited({ ...edited, durationScope: e.target.value as AntagonistDuration })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-label="Duration scope"
                >
                  <option value="chapter">Chapter</option>
                  <option value="arc">Arc</option>
                  <option value="multi_arc">Multi-Arc</option>
                  <option value="novel">Novel</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{antagonist.durationScope}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Threat Level
              </label>
              {isEditing ? (
                <select
                  value={edited.threatLevel}
                  onChange={(e) => setEdited({ ...edited, threatLevel: e.target.value as ThreatLevel })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  aria-label="Threat level"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="extreme">Extreme</option>
                </select>
              ) : (
                <div className="text-gray-900 dark:text-gray-100">{antagonist.threatLevel}</div>
              )}
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
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel">
                {antagonist.description || 'No description'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivation
            </label>
            {isEditing ? (
              <textarea
                value={edited.motivation}
                onChange={(e) => setEdited({ ...edited, motivation: e.target.value })}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel">
                {antagonist.motivation || 'No motivation specified'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Power Level
            </label>
            {isEditing ? (
              <input
                type="text"
                value={edited.powerLevel}
                onChange={(e) => setEdited({ ...edited, powerLevel: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              />
            ) : (
              <div className="text-gray-900 dark:text-gray-100">{antagonist.powerLevel || 'Not specified'}</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Appeared
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={edited.firstAppearedChapter || ''}
                  onChange={(e) => setEdited({ ...edited, firstAppearedChapter: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">
                  {antagonist.firstAppearedChapter ? `Chapter ${antagonist.firstAppearedChapter}` : 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Appeared
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={edited.lastAppearedChapter || ''}
                  onChange={(e) => setEdited({ ...edited, lastAppearedChapter: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">
                  {antagonist.lastAppearedChapter ? `Chapter ${antagonist.lastAppearedChapter}` : 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resolved
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={edited.resolvedChapter || ''}
                  onChange={(e) => setEdited({ ...edited, resolvedChapter: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                />
              ) : (
                <div className="text-gray-900 dark:text-gray-100">
                  {antagonist.resolvedChapter ? `Chapter ${antagonist.resolvedChapter}` : 'Not resolved'}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            {isEditing ? (
              <textarea
                value={edited.notes}
                onChange={(e) => setEdited({ ...edited, notes: e.target.value })}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              />
            ) : (
              <div className="text-zinc-300 whitespace-pre-wrap font-serif-novel">
                {antagonist.notes || 'No notes'}
              </div>
            )}
          </div>
        </div>

        {/* Relationships */}
        {relationships.length > 0 && (
          <div>
            <h3 className="text-lg font-fantasy font-bold text-amber-500 mb-4">Relationships</h3>
            <div className="space-y-3">
              {relationships.map(rel => (
                <div key={rel.id} className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                  <div className="font-semibold text-zinc-200 mb-1">
                    {getCharacterName(rel.characterId)} - <span className="text-amber-400">{rel.intensity}</span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Type: {rel.relationshipType}
                  </div>
                  {rel.currentState && (
                    <div className="text-sm text-zinc-400 mt-2 italic">
                      {rel.currentState}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group Members */}
        {antagonist.type === 'group' && groupMembers.length > 0 && (
          <div>
            <h3 className="text-lg font-fantasy font-bold text-amber-500 mb-4">Group Members</h3>
            <div className="space-y-3">
              {groupMembers.map(member => (
                <div key={member.id} className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                  <div className="font-semibold text-zinc-200 mb-1">
                    {getCharacterName(member.memberCharacterId)} - <span className="text-amber-400">{member.roleInGroup}</span>
                  </div>
                  {member.joinedChapter && (
                    <div className="text-sm text-zinc-400">
                      Joined: Chapter {member.joinedChapter}
                    </div>
                  )}
                  {member.leftChapter && (
                    <div className="text-sm text-zinc-400">
                      Left: Chapter {member.leftChapter}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Arc Associations */}
        {arcAssociations.length > 0 && (
          <div>
            <h3 className="text-lg font-fantasy font-bold text-amber-500 mb-4">Arc Associations</h3>
            <div className="space-y-3">
              {arcAssociations.map(assoc => {
                const arc = novel.plotLedger.find(a => a.id === assoc.arcId);
                return (
                  <div key={assoc.id} className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                    <div className="font-semibold text-zinc-200 mb-1">
                      {arc?.title || 'Unknown Arc'} - <span className="text-amber-400">{assoc.role}</span>
                    </div>
                    {assoc.introducedInArc && (
                      <div className="text-sm text-zinc-400">
                        Introduced in this arc
                      </div>
                    )}
                    {assoc.resolvedInArc && (
                      <div className="text-sm text-zinc-400">
                        Resolved in this arc
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progression Timeline */}
        <div className="mt-6">
          <AntagonistProgressionTimeline antagonist={antagonist} />
        </div>

        {/* Chapter Appearances */}
        <div className="mt-6">
          <AntagonistChapterAppearances
            antagonist={antagonist}
            chapters={novel.chapters}
            onChapterClick={(chapterId) => {
              // Navigate to chapter if navigation context is available
              // This would require passing navigation context or callback
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AntagonistView;
