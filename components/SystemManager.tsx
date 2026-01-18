import React, { useState, useCallback, useMemo } from 'react';
import { CharacterSystem, NovelState, SystemType, SystemStatus, SystemCategory } from '../types';
import { createSystem, updateSystem, deleteSystem } from '../services/systemService';
import { useToast } from '../contexts/ToastContext';
import { useNavigation } from '../contexts/NavigationContext';
import SystemView from './SystemView';
import ConfirmDialog from './ConfirmDialog';

interface SystemManagerProps {
  novel: NovelState;
  onUpdate: (updatedNovel: NovelState) => void;
}

const SystemManager: React.FC<SystemManagerProps> = ({ novel, onUpdate }) => {
  const { showSuccess, showError } = useToast();
  const { navigate } = useNavigation();
  const [selectedSystem, setSelectedSystem] = useState<CharacterSystem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filterType, setFilterType] = useState<SystemType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<SystemStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<SystemCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; systemId: string | null }>({ 
    isOpen: false, 
    systemId: null 
  });

  const systems = novel.characterSystems || [];
  const protagonist = novel.characterCodex.find(c => c.isProtagonist);

  const filteredSystems = useMemo(() => {
    return systems.filter(system => {
      const matchesType = filterType === 'all' || system.type === filterType;
      const matchesStatus = filterStatus === 'all' || system.status === filterStatus;
      const matchesCategory = filterCategory === 'all' || system.category === filterCategory;
      const matchesSearch = searchQuery === '' || 
        system.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        system.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesStatus && matchesCategory && matchesSearch;
    });
  }, [systems, filterType, filterStatus, filterCategory, searchQuery]);

  const handleCreate = useCallback(async () => {
    if (!protagonist) {
      showError('No protagonist found. Please set a protagonist character first.');
      return;
    }
    
    setIsCreating(true);
    try {
      const newSystem: Omit<CharacterSystem, 'id' | 'createdAt' | 'updatedAt'> = {
        novelId: novel.id,
        characterId: protagonist.id,
        name: 'New System',
        type: 'other',
        category: 'core',
        description: '',
        status: 'active',
        features: [],
        history: '',
        notes: '',
      };
      const created = await createSystem(newSystem);
      const updatedNovel = {
        ...novel,
        characterSystems: [...systems, created],
      };
      onUpdate(updatedNovel);
      setSelectedSystem(created);
      setIsCreating(false);
      showSuccess('System created');
    } catch (error: any) {
      showError(error.message || 'Failed to create system');
      setIsCreating(false);
    }
  }, [novel, systems, protagonist, onUpdate, showSuccess, showError]);

  const handleUpdate = useCallback(async (updated: CharacterSystem) => {
    try {
      await updateSystem(updated);
      const updatedNovel = {
        ...novel,
        characterSystems: systems.map(s => s.id === updated.id ? updated : s),
      };
      onUpdate(updatedNovel);
      setSelectedSystem(updated);
      showSuccess('System updated');
    } catch (error: any) {
      showError(error.message || 'Failed to update system');
    }
  }, [novel, systems, onUpdate, showSuccess, showError]);

  const handleDeleteClick = useCallback((systemId: string) => {
    setConfirmDelete({ isOpen: true, systemId });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDelete.systemId) return;
    const systemId = confirmDelete.systemId;
    setConfirmDelete({ isOpen: false, systemId: null });
    try {
      await deleteSystem(systemId);
      const updatedNovel = {
        ...novel,
        characterSystems: systems.filter(s => s.id !== systemId),
      };
      onUpdate(updatedNovel);
      if (selectedSystem?.id === systemId) {
        setSelectedSystem(null);
      }
      showSuccess('System deleted');
    } catch (error: any) {
      showError(error.message || 'Failed to delete system');
    }
  }, [confirmDelete.systemId, novel, systems, selectedSystem, onUpdate, showSuccess, showError]);

  const activeCount = systems.filter(s => s.status === 'active').length;
  const upgradedCount = systems.filter(s => s.status === 'upgraded').length;
  const dormantCount = systems.filter(s => s.status === 'dormant').length;
  const totalFeatures = systems.reduce((sum, s) => sum + (s.features?.length || 0), 0);

  if (selectedSystem) {
    return (
      <SystemView
        system={selectedSystem}
        novel={novel}
        onUpdate={handleUpdate}
        onDelete={handleDeleteClick}
        onBack={() => setSelectedSystem(null)}
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-purple-500 tracking-wider uppercase">Character Systems Registry</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Track systems that help the protagonist (cultivation systems, game interfaces, cheat abilities, etc.)
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isCreating || !protagonist}
          className="text-xs text-purple-500 hover:text-purple-400 font-semibold border border-purple-500/30 hover:border-purple-500/50 px-6 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-500/10"
        >
          {isCreating ? 'Creating...' : '+ New System'}
        </button>
      </div>

      {!protagonist && (
        <div className="bg-yellow-950/40 border border-yellow-900/60 rounded-xl p-4 md:p-6">
          <div className="font-fantasy font-bold text-yellow-400 mb-2">⚠️ No Protagonist Found</div>
          <div className="text-yellow-300 text-sm">
            Please set a protagonist character first to track their systems.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-zinc-900/60 border border-zinc-700 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2">Total</div>
          <div className="text-2xl md:text-3xl font-bold text-zinc-200">{systems.length}</div>
        </div>
        <div className="bg-purple-950/20 border border-purple-900/40 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-2">Active</div>
          <div className="text-2xl md:text-3xl font-bold text-purple-500">{activeCount}</div>
        </div>
        <div className="bg-blue-950/20 border border-blue-900/40 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-2">Upgraded</div>
          <div className="text-2xl md:text-3xl font-bold text-blue-500">{upgradedCount}</div>
        </div>
        <div className="bg-zinc-800/40 border border-zinc-700 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-2">Dormant</div>
          <div className="text-2xl md:text-3xl font-bold text-zinc-300">{dormantCount}</div>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-900/40 p-4 md:p-6 rounded-xl">
          <div className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-2">Features</div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-500">{totalFeatures}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/60 border border-zinc-700 p-4 md:p-6 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Filters</h3>
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search systems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all cursor-pointer"
            aria-label="Filter by system type"
          >
            <option value="all">All Types</option>
            <option value="cultivation">Cultivation</option>
            <option value="game">Game</option>
            <option value="cheat">Cheat</option>
            <option value="ability">Ability</option>
            <option value="interface">Interface</option>
            <option value="evolution">Evolution</option>
            <option value="other">Other</option>
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all cursor-pointer"
            aria-label="Filter by system category"
          >
            <option value="all">All Categories</option>
            <option value="core">Core</option>
            <option value="support">Support</option>
            <option value="evolution">Evolution</option>
            <option value="utility">Utility</option>
            <option value="combat">Combat</option>
            <option value="passive">Passive</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 outline-none transition-all cursor-pointer"
            aria-label="Filter by system status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="dormant">Dormant</option>
            <option value="upgraded">Upgraded</option>
            <option value="merged">Merged</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>
      </div>

      {/* System List */}
      <div className="space-y-3">
        {filteredSystems.length === 0 ? (
          <div className="bg-zinc-900/60 border-2 border-dashed border-zinc-700 p-12 rounded-2xl text-center">
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Systems Recorded</h3>
            <p className="text-sm text-zinc-500">
              {systems.length === 0 
                ? 'Create your first system to track abilities that help the protagonist'
                : 'No systems match your filters. Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          filteredSystems.map(system => (
            <div
              key={system.id}
              onClick={() => setSelectedSystem(system)}
              className="bg-zinc-900/60 border border-zinc-700 p-5 md:p-6 rounded-xl hover:border-purple-500/50 hover:bg-zinc-900/80 cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ type: 'system', systemId: system.id });
                      }}
                      className="text-lg md:text-xl font-fantasy font-bold text-purple-500 group-hover:text-purple-400 transition-colors text-left cursor-pointer"
                      title={`View ${system.name}`}
                    >
                      {system.name}
                    </button>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      system.status === 'active' ? 'bg-purple-950/40 text-purple-400 border border-purple-900/40' :
                      system.status === 'upgraded' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/40' :
                      system.status === 'dormant' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' :
                      'bg-red-950/40 text-red-400 border border-red-900/40'
                    }`}>
                      {system.status}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {system.type}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-950/40 text-purple-300 border border-purple-900/40">
                      {system.category}
                    </span>
                  </div>
                  {system.description && (
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2 font-serif-novel italic">
                      {system.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500 flex-wrap">
                    <span>Features: <span className="text-zinc-400 font-semibold">{system.features?.length || 0}</span></span>
                    {system.currentLevel && (
                      <span>Level: <span className="text-zinc-400 font-semibold">{system.currentLevel}</span></span>
                    )}
                    {system.currentVersion && (
                      <span>Version: <span className="text-zinc-400 font-semibold">{system.currentVersion}</span></span>
                    )}
                    {system.firstAppearedChapter && (
                      <span>First: <span className="text-zinc-400 font-semibold">Ch {system.firstAppearedChapter}</span></span>
                    )}
                    {system.lastUpdatedChapter && (
                      <span>Last: <span className="text-zinc-400 font-semibold">Ch {system.lastUpdatedChapter}</span></span>
                    )}
                    {system.features && system.features.length > 0 && (
                      <span>
                        Active Features: <span className="text-emerald-400 font-semibold">
                          {system.features.filter(f => f.isActive).length}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title="Delete System"
        message="Are you sure you want to delete this system? This will also delete all associated features and progression data."
        variant="danger"
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete({ isOpen: false, systemId: null })}
      />
    </div>
  );
};

export default SystemManager;
