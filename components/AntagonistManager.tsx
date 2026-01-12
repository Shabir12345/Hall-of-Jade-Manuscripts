import React, { useState, useCallback, useMemo } from 'react';
import { Antagonist, NovelState, AntagonistType, AntagonistStatus } from '../types';
import { createAntagonist, updateAntagonist, deleteAntagonist } from '../services/antagonistService';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '../contexts/NavigationContext';
import AntagonistView from './AntagonistView';

interface AntagonistManagerProps {
  novel: NovelState;
  onUpdate: (updatedNovel: NovelState) => void;
}

const AntagonistManager: React.FC<AntagonistManagerProps> = ({ novel, onUpdate }) => {
  const { showSuccess, showError } = useToast();
  const { navigate } = useNavigation();
  const [selectedAntagonist, setSelectedAntagonist] = useState<Antagonist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filterType, setFilterType] = useState<AntagonistType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AntagonistStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const antagonists = novel.antagonists || [];

  const filteredAntagonists = useMemo(() => {
    return antagonists.filter(ant => {
      const matchesType = filterType === 'all' || ant.type === filterType;
      const matchesStatus = filterStatus === 'all' || ant.status === filterStatus;
      const matchesSearch = searchQuery === '' || 
        ant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ant.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [antagonists, filterType, filterStatus, searchQuery]);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const newAntagonist: Omit<Antagonist, 'id' | 'createdAt' | 'updatedAt'> = {
        novelId: novel.id,
        name: 'New Antagonist',
        type: 'individual',
        description: '',
        motivation: '',
        powerLevel: '',
        status: 'hinted',
        durationScope: 'arc',
        threatLevel: 'medium',
        notes: '',
      };
      const created = await createAntagonist(newAntagonist);
      const updatedNovel = {
        ...novel,
        antagonists: [...antagonists, created],
      };
      onUpdate(updatedNovel);
      setSelectedAntagonist(created);
      setIsCreating(false);
      showSuccess('Antagonist created');
    } catch (error: any) {
      showError(error.message || 'Failed to create antagonist');
      setIsCreating(false);
    }
  }, [novel, antagonists, onUpdate, showSuccess, showError]);

  const handleUpdate = useCallback(async (updated: Antagonist) => {
    try {
      await updateAntagonist(updated);
      const updatedNovel = {
        ...novel,
        antagonists: antagonists.map(a => a.id === updated.id ? updated : a),
      };
      onUpdate(updatedNovel);
      setSelectedAntagonist(updated);
      showSuccess('Antagonist updated');
    } catch (error: any) {
      showError(error.message || 'Failed to update antagonist');
    }
  }, [novel, antagonists, onUpdate, showSuccess, showError]);

  const handleDelete = useCallback(async (antagonistId: string) => {
    if (!confirm('Are you sure you want to delete this antagonist?')) return;
    try {
      await deleteAntagonist(antagonistId);
      const updatedNovel = {
        ...novel,
        antagonists: antagonists.filter(a => a.id !== antagonistId),
      };
      onUpdate(updatedNovel);
      if (selectedAntagonist?.id === antagonistId) {
        setSelectedAntagonist(null);
      }
      showSuccess('Antagonist deleted');
    } catch (error: any) {
      showError(error.message || 'Failed to delete antagonist');
    }
  }, [novel, antagonists, selectedAntagonist, onUpdate, showSuccess, showError]);

  const activeCount = antagonists.filter(a => a.status === 'active').length;
  const hintedCount = antagonists.filter(a => a.status === 'hinted').length;

  if (selectedAntagonist) {
    return (
      <AntagonistView
        antagonist={selectedAntagonist}
        novel={novel}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBack={() => setSelectedAntagonist(null)}
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Opposition Registry</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Track all threats, opponents, and conflicts in your story
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="text-xs text-amber-500 hover:text-amber-400 font-semibold border border-amber-500/30 hover:border-amber-500/50 px-6 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-500/10"
        >
          {isCreating ? 'Creating...' : '+ New Antagonist'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-700 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Total Opposition</div>
          <div className="text-2xl md:text-3xl font-bold text-zinc-200">{antagonists.length}</div>
        </div>
        <div className="bg-red-950/20 border border-red-900/40 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-red-400 uppercase tracking-wider font-semibold mb-2">Active Threats</div>
          <div className="text-2xl md:text-3xl font-bold text-red-500">{activeCount}</div>
        </div>
        <div className="bg-yellow-950/20 border border-yellow-900/40 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-yellow-400 uppercase tracking-wider font-semibold mb-2">Foreshadowed</div>
          <div className="text-2xl md:text-3xl font-bold text-yellow-500">{hintedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/60 border border-zinc-700 p-4 md:p-6 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Filters</h3>
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search antagonists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all cursor-pointer"
            aria-label="Filter by antagonist type"
          >
            <option value="all">All Types</option>
            <option value="individual">Individual</option>
            <option value="group">Group</option>
            <option value="system">System</option>
            <option value="society">Society</option>
            <option value="abstract">Abstract</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all cursor-pointer"
            aria-label="Filter by antagonist status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="hinted">Hinted</option>
            <option value="dormant">Dormant</option>
            <option value="defeated">Defeated</option>
            <option value="transformed">Transformed</option>
          </select>
        </div>
      </div>

      {/* Antagonist List */}
      <div className="space-y-3">
        {filteredAntagonists.length === 0 ? (
          <div className="bg-zinc-900/60 border-2 border-dashed border-zinc-700 p-12 rounded-2xl text-center">
            <div className="text-5xl mb-4">⚔️</div>
            <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Opposition Recorded</h3>
            <p className="text-sm text-zinc-500">
              {antagonists.length === 0 
                ? 'Create your first antagonist to track opposition in your story'
                : 'No antagonists match your filters. Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          filteredAntagonists.map(antagonist => (
            <div
              key={antagonist.id}
              onClick={() => setSelectedAntagonist(antagonist)}
              className="bg-zinc-900/60 border border-zinc-700 p-5 md:p-6 rounded-xl hover:border-amber-500/50 hover:bg-zinc-900/80 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ type: 'antagonist', antagonistId: antagonist.id });
                      }}
                      className="text-lg md:text-xl font-fantasy font-bold text-amber-500 group-hover:text-amber-400 transition-colors text-left cursor-pointer"
                      title={`View ${antagonist.name}`}
                    >
                      {antagonist.name}
                    </button>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      antagonist.status === 'active' ? 'bg-red-950/40 text-red-400 border border-red-900/40' :
                      antagonist.status === 'hinted' ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-900/40' :
                      antagonist.status === 'defeated' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                      'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                    }`}>
                      {antagonist.status}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {antagonist.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      antagonist.threatLevel === 'extreme' ? 'bg-red-950/60 text-red-300 border border-red-900/60' :
                      antagonist.threatLevel === 'high' ? 'bg-orange-950/60 text-orange-300 border border-orange-900/60' :
                      antagonist.threatLevel === 'medium' ? 'bg-yellow-950/60 text-yellow-300 border border-yellow-900/60' :
                      'bg-green-950/60 text-green-300 border border-green-900/60'
                    }`}>
                      {antagonist.threatLevel} threat
                    </span>
                  </div>
                  {antagonist.description && (
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2 font-serif-novel italic">
                      {antagonist.description}
                    </p>
                  )}
                  {antagonist.motivation && (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-1">
                      <span className="font-semibold text-zinc-400">Motivation:</span> {antagonist.motivation}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                    <span>Scope: <span className="text-zinc-400 font-semibold">{antagonist.durationScope}</span></span>
                    {antagonist.firstAppearedChapter && (
                      <span>First: <span className="text-zinc-400 font-semibold">Ch {antagonist.firstAppearedChapter}</span></span>
                    )}
                    {antagonist.lastAppearedChapter && (
                      <span>Last: <span className="text-zinc-400 font-semibold">Ch {antagonist.lastAppearedChapter}</span></span>
                    )}
                    {antagonist.powerLevel && (
                      <span>Power: <span className="text-zinc-400 font-semibold">{antagonist.powerLevel}</span></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AntagonistManager;
