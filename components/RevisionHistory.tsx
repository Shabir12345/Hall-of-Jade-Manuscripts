import React, { useState, useEffect, memo, useCallback } from 'react';
import { Revision } from '../types';
import { getRevisions, restoreRevision } from '../services/revisionService';
import { useToast } from '../contexts/ToastContext';

interface RevisionHistoryProps {
  entityType: 'chapter' | 'scene' | 'character' | 'world';
  entityId: string;
  onRestore?: (revision: Revision) => void;
  onClose: () => void;
}

const RevisionHistory: React.FC<RevisionHistoryProps> = ({ entityType, entityId, onRestore, onClose }) => {
  const { showError, showSuccess } = useToast();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);

  useEffect(() => {
    const loadRevisions = async () => {
      try {
        setLoading(true);
        const data = await getRevisions(entityType, entityId);
        setRevisions(data);
      } catch (error) {
        console.error('Error loading revisions:', error);
        showError('Failed to load revision history');
      } finally {
        setLoading(false);
      }
    };

    loadRevisions();
  }, [entityType, entityId, showError]);

  const handleRestore = useCallback(async (revision: Revision) => {
    try {
      const restored = await restoreRevision(revision.id);
      if (!restored) {
        showError('Revision not found');
        return;
      }
      if (onRestore) {
        onRestore(restored);
      }
      showSuccess('Revision restored successfully');
      onClose();
    } catch (error) {
      console.error('Error restoring revision:', error);
      showError('Failed to restore revision');
    }
  }, [onRestore, onClose, showError, showSuccess]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-2xl font-fantasy font-bold text-amber-500">Revision History</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-zinc-700 border-t-amber-600"></div>
            </div>
          ) : revisions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📜</div>
              <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Revisions</h3>
              <p className="text-sm text-zinc-500">No revision history available for this {entityType}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {revisions.map((revision) => (
                <div
                  key={revision.id}
                  className={`bg-zinc-800 border rounded-xl p-4 transition-all duration-200 ${
                    selectedRevision?.id === revision.id
                      ? 'border-amber-500 bg-amber-600/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-zinc-400 mb-1">
                        {new Date(revision.createdAt).toLocaleString()}
                      </div>
                      {revision.metadata?.changeDescription && (
                        <div className="text-xs text-zinc-500 italic">
                          {revision.metadata.changeDescription}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {revision.metadata?.wordCount && (
                        <span className="text-xs text-zinc-500">
                          {revision.metadata.wordCount} words
                        </span>
                      )}
                      <button
                        onClick={() =>
                          setSelectedRevision((prev) => (prev?.id === revision.id ? null : revision))
                        }
                        className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg text-sm font-semibold transition-all duration-200"
                        aria-label="Preview this revision"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleRestore(revision)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all duration-200"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                  {selectedRevision?.id === revision.id &&
                    typeof revision.content === 'object' &&
                    revision.content !== null && (
                    <div className="text-xs text-zinc-400 bg-zinc-900/50 rounded p-2 max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(revision.content, null, 2).substring(0, 500)}
                        {JSON.stringify(revision.content, null, 2).length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(RevisionHistory);
